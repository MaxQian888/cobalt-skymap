'use client';

import { useMemo, useCallback } from 'react';
import { useTargetListStore, type ObservableWindow } from '@/lib/stores/target-list-store';
import { useMountStore } from '@/lib/stores';
import {
  calculateNighttimeData,
  calculateAltitudeData,
  calculateMoonDistance,
  type NighttimeData,
} from '@/lib/catalogs';
import {
  neverRises as neverRisesFn,
  isCircumpolar as isCircumpolarFn,
} from '@/lib/astronomy/astro-utils';
import { optimizeSchedule } from '@/lib/astronomy/session-scheduler';
import type { TwilightTimes } from '@/lib/core/types/astronomy';

// ============================================================================
// Types
// ============================================================================

export interface TargetVisibility {
  targetId: string;
  name: string;
  ra: number;
  dec: number;
  // Visibility data
  maxAltitude: number;
  transitTime: Date | null;
  riseTime: Date | null;
  setTime: Date | null;
  // Dark sky window
  darkStart: Date | null;
  darkEnd: Date | null;
  darkHours: number;
  // Moon data
  moonDistance: number;
  moonInterference: 'none' | 'low' | 'moderate' | 'high';
  // Imaging feasibility
  imagingScore: number;
  isVisible: boolean;
  isCircumpolar: boolean;
  neverRises: boolean;
  // Optimal imaging window
  optimalStart: Date | null;
  optimalEnd: Date | null;
  optimalHours: number;
}

export interface SessionPlan {
  date: Date;
  nighttimeData: NighttimeData;
  targets: TargetVisibility[];
  totalImagingHours: number;
  scheduledOrder: string[]; // target IDs in optimal order
  conflicts: SessionConflict[];
  coverage: number; // percentage of dark time utilized
}

export interface SessionConflict {
  targetA: string;
  targetB: string;
  overlapStart: Date;
  overlapEnd: Date;
  type: 'overlap' | 'gap';
}

export interface TargetScheduleSlot {
  targetId: string;
  start: Date;
  end: Date;
  duration: number; // hours
  altitude: number; // average altitude during slot
}

// ============================================================================
// Utility Functions
// ============================================================================

function calculateOptimalWindow(
  altitudeData: ReturnType<typeof calculateAltitudeData>,
  nighttimeData: NighttimeData,
  minAltitude: number = 30
): { start: Date | null; end: Date | null; hours: number } {
  const darkStart = nighttimeData.twilightRiseAndSet.set;
  const darkEnd = nighttimeData.twilightRiseAndSet.rise;
  
  if (!darkStart || !darkEnd) {
    return { start: null, end: null, hours: 0 };
  }

  // Find points above minimum altitude during dark time
  const darkStartMs = darkStart.getTime();
  const darkEndMs = darkEnd.getTime();
  
  const validPoints = altitudeData.points.filter(p => {
    const timeMs = p.time.getTime();
    return timeMs >= darkStartMs && timeMs <= darkEndMs && p.altitude >= minAltitude;
  });

  if (validPoints.length === 0) {
    return { start: null, end: null, hours: 0 };
  }

  const start = validPoints[0].time;
  const end = validPoints[validPoints.length - 1].time;
  const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  return { start, end, hours };
}

function getMoonInterference(moonDistance: number, moonIllumination: number): 'none' | 'low' | 'moderate' | 'high' {
  if (moonIllumination < 20) return 'none';
  if (moonIllumination < 50) {
    return moonDistance < 30 ? 'moderate' : 'low';
  }
  if (moonDistance < 30) return 'high';
  if (moonDistance < 60) return 'moderate';
  return 'low';
}

function calculateImagingScore(
  maxAlt: number,
  darkHours: number,
  moonDistance: number,
  moonIllumination: number
): number {
  let score = 0;
  
  // Altitude score (0-35)
  if (maxAlt >= 70) score += 35;
  else if (maxAlt >= 60) score += 30;
  else if (maxAlt >= 50) score += 25;
  else if (maxAlt >= 40) score += 20;
  else if (maxAlt >= 30) score += 15;
  else score += Math.max(0, maxAlt / 2);
  
  // Dark hours score (0-35)
  if (darkHours >= 6) score += 35;
  else if (darkHours >= 4) score += 28;
  else if (darkHours >= 2) score += 20;
  else if (darkHours >= 1) score += 12;
  else score += darkHours * 10;
  
  // Moon score (0-30)
  const interference = getMoonInterference(moonDistance, moonIllumination);
  switch (interference) {
    case 'none': score += 30; break;
    case 'low': score += 22; break;
    case 'moderate': score += 12; break;
    case 'high': score += 0; break;
  }
  
  return Math.min(100, Math.max(0, score));
}

function nighttimeDataToTwilightTimes(nd: NighttimeData): TwilightTimes {
  const darkStart = nd.twilightRiseAndSet.set;
  const darkEnd = nd.twilightRiseAndSet.rise;
  const darknessDuration = darkStart && darkEnd
    ? (darkEnd.getTime() - darkStart.getTime()) / 3600000
    : 0;
  
  return {
    sunset: nd.sunRiseAndSet.set,
    civilDusk: nd.civilTwilightRiseAndSet.set,
    nauticalDusk: nd.nauticalTwilightRiseAndSet.set,
    astronomicalDusk: nd.twilightRiseAndSet.set,
    astronomicalDawn: nd.twilightRiseAndSet.rise,
    nauticalDawn: nd.nauticalTwilightRiseAndSet.rise,
    civilDawn: nd.civilTwilightRiseAndSet.rise,
    sunrise: nd.sunRiseAndSet.rise,
    nightDuration: darknessDuration,
    darknessDuration,
    isCurrentlyNight: false,
    currentTwilightPhase: 'night',
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useTargetPlanner() {
  const targets = useTargetListStore((state) => state.targets);
  const updateObservableWindow = useTargetListStore((state) => state.updateObservableWindow);
  const profileInfo = useMountStore((state) => state.profileInfo);
  
  // Get location
  const location = useMemo(() => ({
    latitude: profileInfo.AstrometrySettings.Latitude ?? 40,
    longitude: profileInfo.AstrometrySettings.Longitude ?? -74,
  }), [profileInfo.AstrometrySettings.Latitude, profileInfo.AstrometrySettings.Longitude]);
  
  // Calculate nighttime data
  const nighttimeData = useMemo(() => {
    return calculateNighttimeData(location.latitude, location.longitude, new Date());
  }, [location.latitude, location.longitude]);
  
  // Calculate visibility for all targets
  const targetVisibilities = useMemo((): TargetVisibility[] => {
    const referenceDate = nighttimeData.referenceDate;
    
    return targets.map((target): TargetVisibility => {
      const altitudeData = calculateAltitudeData(
        target.ra,
        target.dec,
        location.latitude,
        location.longitude,
        referenceDate
      );
      
      const moonDistance = calculateMoonDistance(target.ra, target.dec, referenceDate);
      const optimalWindow = calculateOptimalWindow(altitudeData, nighttimeData, 30);
      
      // Calculate dark hours
      const darkStart = nighttimeData.twilightRiseAndSet.set;
      const darkEnd = nighttimeData.twilightRiseAndSet.rise;
      let darkHours = 0;

      if (darkStart && darkEnd) {
        // Circumpolar targets have no rise/set — they are up for the whole
        // dark window, so fall back to the window bounds.
        const upStart = altitudeData.riseTime?.getTime() ?? darkStart.getTime();
        const upEnd = altitudeData.setTime?.getTime() ?? darkEnd.getTime();
        const overlapStart = Math.max(darkStart.getTime(), upStart);
        const overlapEnd = Math.min(darkEnd.getTime(), upEnd);
        if (overlapEnd > overlapStart) {
          darkHours = (overlapEnd - overlapStart) / (1000 * 60 * 60);
        }
      }
      
      const moonInterference = getMoonInterference(moonDistance, nighttimeData.moonIllumination);
      const imagingScore = calculateImagingScore(
        altitudeData.maxAltitude,
        optimalWindow.hours,
        moonDistance,
        nighttimeData.moonIllumination
      );
      
      // Check if target is visible
      const targetNeverRises = neverRisesFn(target.dec, location.latitude);
      const targetIsCircumpolar = isCircumpolarFn(target.dec, location.latitude);
      const isVisible = !targetNeverRises && altitudeData.maxAltitude > 0;
      
      return {
        targetId: target.id,
        name: target.name,
        ra: target.ra,
        dec: target.dec,
        maxAltitude: altitudeData.maxAltitude,
        transitTime: altitudeData.transitTime,
        riseTime: altitudeData.riseTime,
        setTime: altitudeData.setTime,
        darkStart,
        darkEnd,
        darkHours,
        moonDistance,
        moonInterference,
        imagingScore,
        isVisible,
        isCircumpolar: targetIsCircumpolar,
        neverRises: targetNeverRises,
        optimalStart: optimalWindow.start,
        optimalEnd: optimalWindow.end,
        optimalHours: optimalWindow.hours,
      };
    });
  }, [targets, location.latitude, location.longitude, nighttimeData]);
  
  // Generate session plan using the unified scheduler
  const sessionPlan = useMemo((): SessionPlan => {
    const twilight = nighttimeDataToTwilightTimes(nighttimeData);
    const activeTargets = targets.filter(t => !t.isArchived && t.status !== 'completed');
    
    const schedulerResult = optimizeSchedule(
      activeTargets,
      location.latitude,
      location.longitude,
      twilight,
      'balanced',
      30, // minAltitude
      30, // minImagingTime (minutes)
      nighttimeData.referenceDate
    );
    
    // Map scheduler gaps to the hook's SessionConflict format. Gaps and
    // scheduled targets are different arrays, so find the targets actually
    // adjacent to each gap by time.
    const conflicts: SessionConflict[] = (schedulerResult.gaps ?? []).map((gap) => {
      const before = schedulerResult.targets.findLast(
        (s) => s.endTime.getTime() <= gap.start.getTime()
      );
      const after = schedulerResult.targets.find(
        (s) => s.startTime.getTime() >= gap.end.getTime()
      );
      return {
        targetA: before?.target.id ?? '',
        targetB: after?.target.id ?? '',
        overlapStart: gap.start,
        overlapEnd: gap.end,
        type: 'gap' as const,
      };
    });
    
    return {
      date: nighttimeData.referenceDate,
      nighttimeData,
      targets: targetVisibilities,
      totalImagingHours: schedulerResult.totalImagingTime,
      scheduledOrder: schedulerResult.targets.map(s => s.target.id),
      conflicts,
      coverage: Math.min(100, schedulerResult.nightCoverage),
    };
  }, [targets, targetVisibilities, nighttimeData, location.latitude, location.longitude]);
  
  // Update observable windows for all targets - called manually to avoid infinite loops
  const updateAllVisibility = useCallback(() => {
    for (const vis of targetVisibilities) {
      if (vis.isVisible) {
        const window: ObservableWindow = {
          start: vis.optimalStart || new Date(),
          end: vis.optimalEnd || new Date(),
          maxAltitude: vis.maxAltitude,
          transitTime: vis.transitTime || new Date(),
          isCircumpolar: vis.isCircumpolar,
        };
        updateObservableWindow(vis.targetId, window);
      }
    }
  }, [targetVisibilities, updateObservableWindow]);
  
  // Get sorted targets by various criteria
  const getSortedByScore = useCallback(() => {
    return [...targetVisibilities]
      .filter(t => t.isVisible)
      .sort((a, b) => b.imagingScore - a.imagingScore);
  }, [targetVisibilities]);
  
  const getSortedByTransit = useCallback(() => {
    return [...targetVisibilities]
      .filter(t => t.isVisible && t.transitTime)
      .sort((a, b) => {
        if (!a.transitTime || !b.transitTime) return 0;
        return a.transitTime.getTime() - b.transitTime.getTime();
      });
  }, [targetVisibilities]);
  
  const getSortedByAltitude = useCallback(() => {
    return [...targetVisibilities]
      .filter(t => t.isVisible)
      .sort((a, b) => b.maxAltitude - a.maxAltitude);
  }, [targetVisibilities]);
  
  const getSortedByDarkHours = useCallback(() => {
    return [...targetVisibilities]
      .filter(t => t.isVisible)
      .sort((a, b) => b.darkHours - a.darkHours);
  }, [targetVisibilities]);
  
  // Get best targets for tonight
  const getBestTargets = useCallback((limit: number = 5) => {
    return getSortedByScore().slice(0, limit);
  }, [getSortedByScore]);
  
  // Get targets with moon interference
  const getTargetsWithMoonIssues = useCallback(() => {
    return targetVisibilities.filter(t => 
      t.isVisible && (t.moonInterference === 'moderate' || t.moonInterference === 'high')
    );
  }, [targetVisibilities]);
  
  return {
    // Data
    location,
    nighttimeData,
    targetVisibilities,
    sessionPlan,
    
    // Sorted lists
    getSortedByScore,
    getSortedByTransit,
    getSortedByAltitude,
    getSortedByDarkHours,
    
    // Helpers
    getBestTargets,
    getTargetsWithMoonIssues,
    
    // Actions
    updateAllVisibility,
  };
}

