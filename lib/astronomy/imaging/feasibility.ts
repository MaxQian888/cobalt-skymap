/**
 * Imaging feasibility assessment
 */

import { getMoonDistance, getMoonInterference } from '../celestial/separation';
import { getMoonIllumination, getMoonPhase } from '../celestial/moon';
import { calculateTargetVisibility } from '../visibility/target';
import { calculateTwilightTimes } from '../twilight/calculator';
import { dateToJulianDate } from '../time/julian';
import type {
  ImagingFeasibility,
  FeasibilityRecommendation,
  TargetVisibility,
} from '@/lib/core/types/astronomy';

// ============================================================================
// Feasibility Assessment
// ============================================================================

/**
 * Calculate comprehensive imaging feasibility
 * @param ra - Target RA in degrees
 * @param dec - Target Dec in degrees
 * @param latitude - Observer latitude
 * @param longitude - Observer longitude
 * @param minAltitude - Minimum altitude for imaging
 * @param date - Date for calculation
 * @param visibilityOverride - Pre-computed visibility (e.g. from
 *   calculateSolarSystemVisibility for moving bodies); skips the fixed-target
 *   visibility calculation when provided
 * @returns Feasibility assessment
 */
export function calculateImagingFeasibility(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  minAltitude: number = 30,
  date: Date = new Date(),
  visibilityOverride?: TargetVisibility
): ImagingFeasibility {
  const warnings: string[] = [];
  const tips: string[] = [];

  // Get visibility data
  const visibility = visibilityOverride
    ?? calculateTargetVisibility(ra, dec, latitude, longitude, minAltitude, date);
  
  // Get moon data
  const julianDate = dateToJulianDate(date);
  const moonPhase = getMoonPhase(julianDate);
  const moonIllumination = getMoonIllumination(moonPhase);
  const moonDistance = getMoonDistance(ra, dec, julianDate);
  // moonInterference is calculated but used for future enhancements
  getMoonInterference(ra, dec, moonIllumination);
  
  // Get twilight data
  const twilight = calculateTwilightTimes(latitude, longitude, date);
  
  // Calculate individual scores (0-100)
  
  // Moon score: 100 = new moon far away, 0 = full moon close
  let moonScore = 100;
  if (moonIllumination > 80) {
    moonScore -= 40;
    warnings.push('Bright moon may affect image quality');
  } else if (moonIllumination > 50) {
    moonScore -= 20;
  }
  
  if (moonDistance < 30) {
    moonScore -= 40;
    warnings.push(`Moon is only ${Math.round(moonDistance)}° away`);
  } else if (moonDistance < 60) {
    moonScore -= 20;
  }
  moonScore = Math.max(0, moonScore);
  
  // Altitude score: based on max altitude and imaging window
  let altitudeScore = 0;
  if (visibility.transitAltitude >= 60) {
    altitudeScore = 100;
  } else if (visibility.transitAltitude >= 45) {
    altitudeScore = 80;
  } else if (visibility.transitAltitude >= 30) {
    altitudeScore = 60;
    tips.push('Consider waiting for better altitude');
  } else if (visibility.transitAltitude >= 20) {
    altitudeScore = 40;
    warnings.push('Low altitude may cause atmospheric effects');
  } else {
    altitudeScore = 20;
    warnings.push('Target is too low for good imaging');
  }
  
  // Duration score: based on dark imaging hours
  let durationScore = 0;
  if (visibility.darkImagingHours >= 6) {
    durationScore = 100;
  } else if (visibility.darkImagingHours >= 4) {
    durationScore = 80;
  } else if (visibility.darkImagingHours >= 2) {
    durationScore = 60;
    tips.push('Limited imaging window - prioritize this target');
  } else if (visibility.darkImagingHours >= 1) {
    durationScore = 40;
    warnings.push('Very short imaging window');
  } else {
    durationScore = 0;
    warnings.push('No dark imaging time available');
  }
  
  // Twilight score: based on current darkness
  let twilightScore = 100;
  if (!twilight.isCurrentlyNight) {
    twilightScore = 50;
    const phase = twilight.currentTwilightPhase;
    if (phase === 'day') {
      twilightScore = 0;
      warnings.push('Sun is up - wait for darkness');
    } else if (phase === 'civil') {
      twilightScore = 20;
      warnings.push('Still in civil twilight');
    } else if (phase === 'nautical') {
      twilightScore = 40;
      tips.push('Nautical twilight - narrowband possible');
    } else if (phase === 'astronomical') {
      twilightScore = 80;
    }
  }
  
  // Calculate overall score
  const score = Math.round(
    moonScore * 0.25 +
    altitudeScore * 0.35 +
    durationScore * 0.25 +
    twilightScore * 0.15
  );
  
  // Determine recommendation
  let recommendation: FeasibilityRecommendation;
  if (score >= 80) {
    recommendation = 'excellent';
  } else if (score >= 60) {
    recommendation = 'good';
  } else if (score >= 40) {
    recommendation = 'fair';
  } else if (score >= 20) {
    recommendation = 'poor';
  } else {
    recommendation = 'not_recommended';
  }
  
  // Add positive tips
  if (moonIllumination < 10) {
    tips.push('Excellent new moon conditions');
  }
  if (visibility.isCircumpolar) {
    tips.push('Circumpolar target - visible all night');
  }
  if (visibility.transitAltitude > 70) {
    tips.push('Target reaches excellent altitude');
  }
  
  return {
    score,
    moonScore,
    altitudeScore,
    durationScore,
    twilightScore,
    recommendation,
    warnings,
    tips,
  };
}

/**
 * Get a simple go/no-go recommendation
 */
export function shouldImage(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  minScore: number = 40
): boolean {
  const feasibility = calculateImagingFeasibility(ra, dec, latitude, longitude);
  return feasibility.score >= minScore;
}

/**
 * Compare feasibility of multiple targets
 */
export function rankTargets(
  targets: Array<{ id: string; ra: number; dec: number }>,
  latitude: number,
  longitude: number,
  date: Date = new Date()
): Array<{ id: string; score: number; feasibility: ImagingFeasibility }> {
  return targets
    .map(target => ({
      id: target.id,
      score: 0,
      feasibility: calculateImagingFeasibility(
        target.ra, target.dec, latitude, longitude, 30, date
      ),
    }))
    .map(item => ({ ...item, score: item.feasibility.score }))
    .sort((a, b) => b.score - a.score);
}
