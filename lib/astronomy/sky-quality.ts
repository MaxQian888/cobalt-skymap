/**
 * Sky quality assessment utilities
 * Pure functions for estimating observing conditions
 */

import type { SkyQuality, AstroConditions } from '@/types/starmap/overlays';
import {
  getMoonPhase,
  getMoonPhaseName,
  getMoonIllumination,
  getMoonPosition,
  getSunPosition,
  calculateTwilightTimes,
} from '@/lib/astronomy/astro-utils';
import { raDecToAltAz, getLST, degreesToHMS } from '@/lib/astronomy/starmap-utils';

// ============================================================================
// Sky Quality Estimation
// ============================================================================

/**
 * Estimate sky quality based on sun altitude, moon altitude, and moon illumination
 */
export function estimateSkyQuality(
  sunAltitude: number,
  moonAltitude: number,
  moonIllumination: number
): SkyQuality {
  if (sunAltitude > -6) return 'poor';
  if (sunAltitude > -12) return 'fair';
  if (sunAltitude > -18) return 'good';
  if (moonAltitude <= 0) return 'excellent';
  // Moon impact grows monotonically with illumination and altitude, so a
  // brighter/higher moon can never yield a better rating.
  const moonImpact = moonIllumination * Math.sin((moonAltitude * Math.PI) / 180);
  if (moonImpact > 60) return 'poor';
  if (moonImpact > 35) return 'fair';
  if (moonImpact > 15) return 'good';
  return 'excellent';
}

/**
 * Get CSS color class for sky quality level
 */
export function getSkyQualityColor(quality: SkyQuality): string {
  switch (quality) {
    case 'excellent': return 'text-green-400';
    case 'good': return 'text-emerald-400';
    case 'fair': return 'text-yellow-400';
    case 'poor': return 'text-red-400';
  }
}

// ============================================================================
// Astronomical Conditions
// ============================================================================

/**
 * Calculate comprehensive astronomical conditions for a given location
 */
export function calculateAstroConditions(
  latitude: number,
  longitude: number
): AstroConditions {
  const now = new Date();
  const moonPhase = getMoonPhase();
  const moonPhaseName = getMoonPhaseName(moonPhase);
  const moonIllumination = getMoonIllumination(moonPhase);
  const moonPos = getMoonPosition();
  const sunPos = getSunPosition();

  const moonAltAz = raDecToAltAz(moonPos.ra, moonPos.dec, latitude, longitude);
  const sunAltAz = raDecToAltAz(sunPos.ra, sunPos.dec, latitude, longitude);

  const twilight = calculateTwilightTimes(latitude, longitude, now);
  const lst = getLST(longitude);
  const lstString = degreesToHMS(lst);

  const skyQuality = estimateSkyQuality(
    sunAltAz.altitude,
    moonAltAz.altitude,
    moonIllumination
  );

  return {
    moonPhase,
    moonPhaseName,
    moonIllumination: Math.round(moonIllumination),
    moonAltitude: moonAltAz.altitude,
    sunAltitude: sunAltAz.altitude,
    twilight,
    lstString,
    skyQuality,
    isDark: sunAltAz.altitude < -18,
    isTwilight: sunAltAz.altitude >= -18 && sunAltAz.altitude < 0,
  };
}
