'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStellariumStore, useMountStore } from '@/lib/stores';
import { useEquipmentStore } from '@/lib/stores/equipment-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { SearchResultItem, I18nMessage, RecommendationProfile, RecommendationBreakdownV2 } from '@/lib/core/types';
import {
  neverRises,
  isCircumpolar,
  calculateImagingHours,
} from '@/lib/astronomy/astro-utils';
import {
  calculateNighttimeData,
  calculateAltitudeData,
  calculateMoonDistance,
  enrichDeepSkyObject,
  DSO_CATALOG,
  MOON_PHASE_NAMES,
  // Advanced scoring algorithms
  calculateAirmass,
  getAirmassQuality,
  calculateMeridianProximity,
  transitDuringDarkHours,
  calculateMoonImpact,
  calculateSeasonalScore,
  calculateComprehensiveImagingScore,
  EXTENDED_SEASONAL_DATA,
  // Recommendation Engine
  RecommendationEngine,
  type DeepSkyObject,
  type NighttimeData,
  type ImagingScoreResult,
  type ScoredRecommendation,
} from '@/lib/catalogs';

// ============================================================================
// Types
// ============================================================================

export interface RecommendedTarget extends SearchResultItem {
  score: number;
  scoreVersion: 'v2';
  scoreProfile: RecommendationProfile;
  scoreConfidence: 'high' | 'medium' | 'low';
  maxAltitude: number;
  transitTime: Date | null;
  riseTime: Date | null;
  setTime: Date | null;
  moonDistance: number;
  imagingHours: number;
  reasons: I18nMessage[];
  warnings: I18nMessage[];
  dsoData?: DeepSkyObject;
  // Enhanced scoring data
  airmass?: number;
  airmassQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'bad';
  scoreBreakdown?: ImagingScoreResult['breakdown'];
  scoreBreakdownV2?: RecommendationBreakdownV2;
  qualityRating?: ImagingScoreResult['quality'];
  seasonalOptimal?: boolean;
  transitDuringDark?: boolean;
}

export interface TwilightInfo {
  sunset: Date | null;
  civilDusk: Date | null;
  nauticalDusk: Date | null;
  astronomicalDusk: Date | null;
  astronomicalDawn: Date | null;
  nauticalDawn: Date | null;
  civilDawn: Date | null;
  sunrise: Date | null;
}

export interface TonightConditions {
  moonPhase: number;
  moonIllumination: number;
  moonPhaseName: string;
  darkHoursStart: Date | null;
  darkHoursEnd: Date | null;
  totalDarkHours: number;
  latitude: number;
  longitude: number;
  twilight: TwilightInfo;
  currentTime: Date;
  nighttimeData?: NighttimeData;
}

// ============================================================================
// Using Extended Seasonal Data from scoring-algorithms.ts
// The EXTENDED_SEASONAL_DATA provides comprehensive information including:
// - bestMonths: optimal imaging months
// - optimalAltitude: recommended minimum altitude
// - requiresDarkSky: whether dark skies are needed
// - difficulty: beginner/intermediate/advanced/expert
// - recommendedExposure: suggested exposure times
// ============================================================================

// ============================================================================
// Utility Functions
// ============================================================================

// neverRises, isCircumpolar, calculateImagingHours imported from @/lib/astronomy/astro-utils

const PROFILE_WEIGHTS: Record<RecommendationProfile, RecommendationBreakdownV2> = {
  imaging: {
    observability: 30,
    moonImpact: 20,
    equipmentMatch: 25,
    targetSuitability: 10,
    timingQuality: 10,
    difficultyPenalty: 5,
  },
  visual: {
    observability: 35,
    moonImpact: 10,
    equipmentMatch: 5,
    targetSuitability: 25,
    timingQuality: 20,
    difficultyPenalty: 5,
  },
  hybrid: {
    observability: 32.5,
    moonImpact: 15,
    equipmentMatch: 15,
    targetSuitability: 17.5,
    timingQuality: 15,
    difficultyPenalty: 5,
  },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeScore(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return clampScore((value / max) * 100);
}

function weightedScore(
  profile: RecommendationProfile,
  breakdown: RecommendationBreakdownV2,
  hasEquipmentData: boolean,
): { score: number; confidence: 'high' | 'medium' | 'low' } {
  const baseWeights = { ...PROFILE_WEIGHTS[profile] };
  const confidence: 'high' | 'medium' | 'low' = hasEquipmentData ? 'high' : 'medium';

  if (!hasEquipmentData) {
    const equipmentWeight = baseWeights.equipmentMatch;
    baseWeights.equipmentMatch = 0;
    const redistribute = equipmentWeight / 5;
    baseWeights.observability += redistribute;
    baseWeights.moonImpact += redistribute;
    baseWeights.targetSuitability += redistribute;
    baseWeights.timingQuality += redistribute;
    baseWeights.difficultyPenalty += redistribute;
  }

  const raw =
    (breakdown.observability * baseWeights.observability +
      breakdown.moonImpact * baseWeights.moonImpact +
      breakdown.equipmentMatch * baseWeights.equipmentMatch +
      breakdown.targetSuitability * baseWeights.targetSuitability +
      breakdown.timingQuality * baseWeights.timingQuality) /
      100 -
    (breakdown.difficultyPenalty * baseWeights.difficultyPenalty) / 100;

  return {
    score: clampScore(raw),
    confidence,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

interface UseTonightRecommendationOptions {
  limit?: number;
}

export function useTonightRecommendations(
  profileOverride?: RecommendationProfile,
  options: UseTonightRecommendationOptions = {},
) {
  const stel = useStellariumStore((state) => state.stel);
  const focalLength = useEquipmentStore((s) => s.focalLength);
  const aperture = useEquipmentStore((s) => s.aperture);
  const sensorWidth = useEquipmentStore((s) => s.sensorWidth);
  const sensorHeight = useEquipmentStore((s) => s.sensorHeight);
  const pixelSize = useEquipmentStore((s) => s.pixelSize);
  const bortle = useEquipmentStore((s) => s.exposureDefaults.bortle);
  const bortleIndex = useSettingsStore((s) => s.stellarium.bortleIndex);
  const observationProfile = useSettingsStore((s) => s.observationProfile);
  const [recommendations, setRecommendations] = useState<RecommendedTarget[]>([]);
  const [conditions, setConditions] = useState<TonightConditions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [planDate, setPlanDate] = useState<Date>(new Date());
  const profile = profileOverride ?? observationProfile;
  const limit = options.limit ?? 25;

  // Get observer location from Stellarium, mount store, or default
  const getObserverLocation = useCallback(() => {
    if (stel?.core?.observer) {
      try {
        const obs = stel.core.observer;
        return {
          latitude: obs.latitude ?? 40,
          longitude: obs.longitude ?? -74,
        };
      } catch {
        // Fallback
      }
    }
    // Fallback to mount store location (works for Aladin engine)
    try {
      const profile = useMountStore.getState().profileInfo;
      const lat = profile.AstrometrySettings.Latitude;
      const lon = profile.AstrometrySettings.Longitude;
      if (lat != null && lon != null) return { latitude: lat, longitude: lon };
    } catch { /* ignore */ }
    return { latitude: 40, longitude: -74 };
  }, [stel]);

  // Calculate tonight's conditions using Sky Atlas
  const calculateConditions = useCallback((date?: Date): TonightConditions => {
    const { latitude, longitude } = getObserverLocation();
    const now = date ?? planDate;

    // Use Sky Atlas nighttime calculator
    const nighttimeData = calculateNighttimeData(latitude, longitude, now);

    const twilight: TwilightInfo = {
      sunset: nighttimeData.sunRiseAndSet.set,
      civilDusk: nighttimeData.civilTwilightRiseAndSet.set,
      nauticalDusk: nighttimeData.nauticalTwilightRiseAndSet.set,
      astronomicalDusk: nighttimeData.twilightRiseAndSet.set,
      astronomicalDawn: nighttimeData.twilightRiseAndSet.rise,
      nauticalDawn: nighttimeData.nauticalTwilightRiseAndSet.rise,
      civilDawn: nighttimeData.civilTwilightRiseAndSet.rise,
      sunrise: nighttimeData.sunRiseAndSet.rise,
    };

    const darkStart = nighttimeData.twilightRiseAndSet.set;
    const darkEnd = nighttimeData.twilightRiseAndSet.rise;

    const totalDarkHours = darkStart && darkEnd
      ? (darkEnd.getTime() - darkStart.getTime()) / (1000 * 60 * 60)
      : 0;

    return {
      moonPhase: nighttimeData.moonPhaseValue,
      moonIllumination: nighttimeData.moonIllumination,
      moonPhaseName: MOON_PHASE_NAMES[nighttimeData.moonPhase],
      darkHoursStart: darkStart,
      darkHoursEnd: darkEnd,
      totalDarkHours: Math.max(0, totalDarkHours),
      latitude,
      longitude,
      twilight,
      currentTime: now,
      nighttimeData,
    };
  }, [getObserverLocation, planDate]);

  // Calculate recommendations using Sky Atlas catalog with advanced scoring algorithms
  const calculateRecommendations = useCallback(() => {
    setIsLoading(true);

    const cond = calculateConditions();
    setConditions(cond);

    const { latitude, longitude, darkHoursStart, darkHoursEnd, moonIllumination } = cond;
    const refDate = planDate;
    const currentMonth = refDate.getMonth() + 1;
    const referenceDate = cond.nighttimeData?.referenceDate || refDate;
    const effectiveBortle = bortle || bortleIndex || 5;

    const scored: RecommendedTarget[] = [];

    // Try equipment-aware scoring via RecommendationEngine
    const hasEquipmentData = focalLength > 0 && aperture > 0 && sensorWidth > 0;
    let advancedResults: ScoredRecommendation[] | null = null;

    if (hasEquipmentData) {
      try {
        const engine = new RecommendationEngine(
          {
            telescopeFocalLength: focalLength,
            telescopeAperture: aperture,
            cameraSensorWidth: sensorWidth,
            cameraSensorHeight: sensorHeight,
            cameraPixelSize: pixelSize || 3.76,
            cameraResolutionX: sensorWidth > 0 && pixelSize > 0 ? Math.round((sensorWidth * 1000) / pixelSize) : 4096,
            cameraResolutionY: sensorHeight > 0 && pixelSize > 0 ? Math.round((sensorHeight * 1000) / pixelSize) : 3072,
            mountType: 'equatorial',
            hasAutoGuider: false,
          },
          {
            latitude,
            longitude,
            elevation: 0,
            bortleClass: effectiveBortle,
          }
        );
        advancedResults = engine.getRecommendations(DSO_CATALOG, refDate, 30);
      } catch {
        // Fall through to standard scoring
      }
    }

    // If advanced engine produced results, convert them to RecommendedTarget format
    if (advancedResults && advancedResults.length > 0) {
      for (const rec of advancedResults) {
        const dso = rec.object;
        const reasons: I18nMessage[] = [];
        const warnings: I18nMessage[] = [];

        for (const r of rec.reasons) {
          reasons.push({ key: 'tonightRec.compReason', params: { text: r } });
        }
        for (const w of rec.warnings) {
          warnings.push({ key: 'tonightRec.compWarning', params: { text: w } });
        }

        // Add equipment-specific info from feasibility
        if (rec.feasibility.fovFit === 'perfect' || rec.feasibility.fovFit === 'good') {
          reasons.push({ key: 'tonightRec.goodFovFit' });
        } else if (rec.feasibility.fovFit === 'too_large') {
          warnings.push({ key: 'tonightRec.tooLargeForFov' });
        }

        const commonName = dso.alternateNames?.[0] || dso.name;
        const altData = calculateAltitudeData(dso.ra, dso.dec, latitude, longitude, referenceDate);
        const moonDistance = dso.moonDistance ?? calculateMoonDistance(dso.ra, dso.dec, referenceDate);
        const advancedDifficulty = EXTENDED_SEASONAL_DATA[dso.id]?.difficulty;
        const breakdownV2: RecommendationBreakdownV2 = {
          observability: normalizeScore(rec.imagingWindow.peakAltitude, 90),
          moonImpact: normalizeScore(moonDistance, 180),
          equipmentMatch: clampScore(rec.feasibility.snrEstimate ?? 0),
          targetSuitability: normalizeScore(25 - Math.min(25, dso.surfaceBrightness ?? 23), 25),
          timingQuality: normalizeScore(rec.imagingWindow.darkHours, Math.max(1, cond.totalDarkHours)),
          difficultyPenalty: advancedDifficulty === 'expert' ? 90 : advancedDifficulty === 'advanced' ? 70 : advancedDifficulty === 'intermediate' ? 40 : 15,
        };
        const weighted = weightedScore(profile, breakdownV2, hasEquipmentData);
        const boundedAdvancedScore = Number.isFinite(weighted.score)
          ? clampScore(Math.round(weighted.score))
          : 0;

        scored.push({
          Name: dso.name,
          Type: 'DSO',
          RA: dso.ra,
          Dec: dso.dec,
          'Common names': commonName,
          score: boundedAdvancedScore,
          scoreVersion: 'v2',
          scoreProfile: profile,
          scoreConfidence: weighted.confidence,
          maxAltitude: rec.imagingWindow.peakAltitude,
          transitTime: altData.transitTime,
          riseTime: altData.riseTime,
          setTime: altData.setTime,
          moonDistance,
          imagingHours: rec.imagingWindow.darkHours,
          reasons: reasons.slice(0, 4),
          warnings: warnings.slice(0, 3),
          dsoData: dso,
          airmass: calculateAirmass(rec.imagingWindow.peakAltitude),
          airmassQuality: getAirmassQuality(calculateAirmass(rec.imagingWindow.peakAltitude)),
          scoreBreakdown: {
            altitudeScore: Math.round(rec.scoreBreakdown.altitudeScore * (25 / 15)),
            airmassScore: Math.round(rec.scoreBreakdown.lightPollutionScore * (20 / 8)),
            moonScore: Math.round(rec.scoreBreakdown.moonScore),
            brightnessScore: Math.round(rec.scoreBreakdown.brightnessScore * (15 / 10)),
            seasonalScore: Math.round(rec.scoreBreakdown.seasonalScore * (10 / 15)),
            transitScore: Math.round(rec.scoreBreakdown.transitScore * 2),
          },
          scoreBreakdownV2: breakdownV2,
          seasonalOptimal: rec.scoreBreakdown.seasonalScore >= 12,
          transitDuringDark: rec.scoreBreakdown.transitScore >= 4,
        });
      }

      scored.sort((a, b) => b.score - a.score);
      setRecommendations(scored.slice(0, limit));
      setIsLoading(false);
      return;
    }

    // Fallback: standard scoring (no equipment data)
    // Use DSO_CATALOG from Sky Atlas
    for (const dso of DSO_CATALOG) {
      // Skip targets that never rise
      if (neverRises(dso.dec, latitude)) {
        continue;
      }

      const reasons: I18nMessage[] = [];
      const warnings: I18nMessage[] = [];

      // Enrich DSO with calculated data
      const enrichedDso = enrichDeepSkyObject(dso, latitude, longitude, referenceDate);
      const altitudeData = calculateAltitudeData(dso.ra, dso.dec, latitude, longitude, referenceDate);

      const maxAlt = altitudeData.maxAltitude;
      const isCircumpolarTarget = isCircumpolar(dso.dec, latitude);
      const moonDistance = enrichedDso.moonDistance ?? calculateMoonDistance(dso.ra, dso.dec, referenceDate);

      // Calculate imaging hours during dark time
      const imagingHours = calculateImagingHours(altitudeData, 25, darkHoursStart, darkHoursEnd);

      // Skip if not enough imaging time (unless circumpolar)
      if (imagingHours < 1 && !isCircumpolarTarget) {
        continue;
      }

      // ========================================================================
      // Use Industry-Standard Comprehensive Scoring Algorithm
      // ========================================================================
      
      // Calculate airmass at maximum altitude (industry standard metric)
      const airmass = calculateAirmass(maxAlt);
      const airmassQuality = getAirmassQuality(airmass);
      
      // Calculate meridian transit proximity
      const transitProximity = calculateMeridianProximity(
        altitudeData.transitTime,
        referenceDate,
        6 // 6-hour window
      );
      
      // Check if transit occurs during dark hours
      const transitsDuringDark = transitDuringDarkHours(
        altitudeData.transitTime,
        darkHoursStart,
        darkHoursEnd
      );
      
      // Calculate moon impact score
      const moonImpact = calculateMoonImpact(moonDistance, moonIllumination);
      
      // Calculate seasonal score using extended data
      const seasonalScore = calculateSeasonalScore(dso.id, currentMonth);
      const seasonal = EXTENDED_SEASONAL_DATA[dso.id];
      const isSeasonalOptimal = seasonalScore >= 0.8;
      
      // Use comprehensive imaging score calculator
      const comprehensiveScore = calculateComprehensiveImagingScore({
        altitude: maxAlt,
        airmass,
        moonDistance,
        moonIllumination,
        magnitude: dso.magnitude,
        surfaceBrightness: dso.surfaceBrightness,
        sizeArcmin: dso.sizeMax,
        transitProximity,
        seasonalScore,
        darkSkyRequired: seasonal?.requiresDarkSky,
        bortleClass: effectiveBortle,
      });
      
      // ========================================================================
      // Generate I18n Reasons and Warnings
      // ========================================================================
      
      // Add recommendations from comprehensive score as raw warnings
      for (const r of comprehensiveScore.recommendations) {
        if (r.includes('too low') || r.includes('too high') || r.includes('faint') || 
            r.includes('close') || r.includes('not') || r.includes('needs')) {
          warnings.push({ key: 'tonightRec.compWarning', params: { text: r } });
        }
      }
      
      // Airmass quality
      if (airmassQuality === 'excellent') {
        reasons.push({ key: 'tonightRec.excellentAirmass', params: { value: airmass.toFixed(2) } });
      } else if (airmassQuality === 'good') {
        reasons.push({ key: 'tonightRec.goodAirmass', params: { value: airmass.toFixed(2) } });
      } else if (airmassQuality === 'poor' || airmassQuality === 'bad') {
        warnings.push({ key: 'tonightRec.highAirmass', params: { value: airmass.toFixed(2) } });
      }
      
      // Seasonal information
      if (isSeasonalOptimal) {
        reasons.push({ key: 'tonightRec.bestSeason' });
      } else if (seasonalScore < 0.3) {
        warnings.push({ key: 'tonightRec.notOptimalSeason' });
      }
      
      // Transit timing
      if (transitsDuringDark) {
        reasons.push({ key: 'tonightRec.transitDuringDark' });
      }
      
      // Moon impact
      if (moonImpact >= 0.9) {
        if (moonIllumination < 25) {
          reasons.push({ key: 'tonightRec.darkMoon' });
        } else {
          reasons.push({ key: 'tonightRec.farFromMoon' });
        }
      } else if (moonImpact < 0.5) {
        warnings.push({ key: 'tonightRec.moonInterference' });
      }
      
      // Imaging window
      const effectiveHours = isCircumpolarTarget ? cond.totalDarkHours : imagingHours;
      if (effectiveHours > 5) {
        reasons.push({ key: 'tonightRec.longWindow', params: { hours: effectiveHours.toFixed(1) } });
      } else if (effectiveHours < 2) {
        warnings.push({ key: 'tonightRec.limitedTime' });
      }
      
      // Circumpolar
      if (isCircumpolarTarget) {
        reasons.push({ key: 'tonightRec.circumpolar' });
      }
      
      // Difficulty and equipment recommendations
      if (seasonal?.difficulty === 'beginner') {
        reasons.push({ key: 'tonightRec.beginnerFriendly' });
      } else if (seasonal?.difficulty === 'advanced' || seasonal?.difficulty === 'expert') {
        warnings.push({ key: 'tonightRec.challenging' });
      }
      
      // Size recommendations
      const size = dso.sizeMax ?? dso.sizeMin;
      if (size && size > 60) {
        reasons.push({ key: 'tonightRec.largeTarget' });
      } else if (size && size < 3) {
        warnings.push({ key: 'tonightRec.smallTarget' });
      }
      
      // Surface brightness
      if (dso.surfaceBrightness) {
        if (dso.surfaceBrightness < 20) {
          reasons.push({ key: 'tonightRec.highSB' });
        } else if (dso.surfaceBrightness > 24) {
          warnings.push({ key: 'tonightRec.lowSB' });
        }
      }
      
      // Magnitude
      if (dso.magnitude !== undefined) {
        if (dso.magnitude < 6) {
          reasons.push({ key: 'tonightRec.veryBright' });
        } else if (dso.magnitude > 12) {
          warnings.push({ key: 'tonightRec.faint' });
        }
      }
      
      // ========================================================================
      // Calculate Final Score
      // ========================================================================
      const breakdownV2: RecommendationBreakdownV2 = {
        observability: normalizeScore(maxAlt, 90),
        moonImpact: normalizeScore(moonDistance, 180),
        equipmentMatch: hasEquipmentData ? clampScore(comprehensiveScore.breakdown.altitudeScore * 4) : 50,
        targetSuitability: normalizeScore(20 - Math.min(20, dso.surfaceBrightness ?? 21), 20),
        timingQuality: normalizeScore(effectiveHours, Math.max(1, cond.totalDarkHours)),
        difficultyPenalty: seasonal?.difficulty === 'expert'
          ? 90
          : seasonal?.difficulty === 'advanced'
            ? 70
            : seasonal?.difficulty === 'intermediate'
              ? 40
              : 15,
      };
      const weighted = weightedScore(profile, breakdownV2, hasEquipmentData);
      let finalScore = weighted.score;

      if (isCircumpolarTarget) finalScore += profile === 'visual' ? 6 : 3;
      if (transitsDuringDark) finalScore += profile === 'imaging' ? 5 : 3;
      if (effectiveHours > 4) finalScore += 4;
      const boundedScore = Number.isFinite(finalScore)
        ? Math.max(0, Math.min(100, Math.round(finalScore)))
        : 0;

      // Get common name from alternate names
      const commonName = dso.alternateNames?.[0] || dso.name;

      scored.push({
        Name: dso.name,
        Type: 'DSO',
        RA: dso.ra,
        Dec: dso.dec,
        'Common names': commonName,
        score: boundedScore,
        scoreVersion: 'v2',
        scoreProfile: profile,
        scoreConfidence: weighted.confidence,
        maxAltitude: maxAlt,
        transitTime: altitudeData.transitTime,
        riseTime: altitudeData.riseTime,
        setTime: altitudeData.setTime,
        moonDistance,
        imagingHours: effectiveHours,
        reasons: reasons.slice(0, 4), // Limit to top 4 reasons
        warnings: warnings.slice(0, 3), // Limit to top 3 warnings
        dsoData: enrichedDso,
        // Enhanced scoring data
        airmass,
        airmassQuality,
        scoreBreakdown: comprehensiveScore.breakdown,
        scoreBreakdownV2: breakdownV2,
        qualityRating: comprehensiveScore.quality,
        seasonalOptimal: isSeasonalOptimal,
        transitDuringDark: transitsDuringDark,
      });
    }

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Take top 25 for better selection
    setRecommendations(scored.slice(0, limit));
    setIsLoading(false);
  }, [calculateConditions, planDate, focalLength, aperture, sensorWidth, sensorHeight, pixelSize, bortle, bortleIndex, limit, profile]);

  // Auto-calculate on mount
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setTimeout(() => calculateRecommendations(), 0);
    }
  }, [calculateRecommendations]);

  return {
    recommendations,
    conditions,
    isLoading,
    profile,
    refresh: calculateRecommendations,
    planDate,
    setPlanDate,
  };
}

