/**
 * Re-export shim for backward compatibility.
 * 
 * All implementations now live in modular subdirectories:
 *   coordinates/, time/, celestial/, visibility/, twilight/, imaging/
 * 
 * Prefer importing directly from those modules for new code.
 * @module
 */

import { getMoonPhaseName as _getMoonPhaseName, MOON_PHASE_NAMES } from './celestial/moon';

// ============================================================================
// Types (re-exported from canonical locations)
// ============================================================================

export type {
  TwilightTimes,
  TargetVisibility,
  ImagingFeasibility,
  MultiTargetPlan,
  FeasibilityRecommendation,
  AstronomicalFrame,
  TimeScale,
  CoordinateQualityFlag,
  EopFreshness,
  CoordinateContext,
  CoordinateResult,
  RecommendationProfile,
  RecommendationBreakdownV2,
} from '@/lib/core/types/astronomy';

export type { I18nMessage } from '@/lib/core/types';

// ============================================================================
// Time calculations
// ============================================================================

export { dateToJulianDate as getJulianDateFromDate, julianDateToDate } from './time/julian';
export { getJulianDate } from './time/julian';

// ============================================================================
// Coordinate conversions
// ============================================================================

export { deg2rad, rad2deg, degreesToHMS, degreesToDMS } from './coordinates/conversions';
export { raDecToAltAz } from './coordinates/transforms';
export { getLST } from './time/sidereal';
export { buildTimeScaleContext, getEopSnapshot, triggerBackgroundEopRefresh } from './time-scales';
export { transformCoordinate } from './pipeline';

// ============================================================================
// Celestial body positions
// ============================================================================

export { getMoonPhase, getMoonIllumination, getMoonPosition } from './celestial/moon';
export { getSunPosition } from './celestial/sun';

/**
 * Get human-readable moon phase name (backward-compatible wrapper).
 * The modular getMoonPhaseName returns enum keys; this converts to display strings.
 */
export function getMoonPhaseName(phase: number): string {
  return MOON_PHASE_NAMES[_getMoonPhaseName(phase)];
}
export { angularSeparation } from './celestial/separation';

// ============================================================================
// Twilight calculations
// ============================================================================

export { calculateTwilightTimes } from './twilight/calculator';

// ============================================================================
// Target visibility
// ============================================================================

export { calculateTargetVisibility, getTransitTime, intersectDarkWindow } from './visibility/target';
export { calculateSolarSystemVisibility } from './visibility/solar-system';
export { getAltitudeOverTime, getMaxAltitude, calculateImagingHours } from './visibility/altitude';
export { isCircumpolar, neverRises } from './visibility/circumpolar';

// ============================================================================
// Imaging calculations
// ============================================================================

export { calculateImagingFeasibility } from './imaging/feasibility';
export { calculateExposure, calculateTotalIntegration, BORTLE_SCALE } from './imaging/exposure';
export { planMultipleTargets } from './imaging/planning';

// ============================================================================
// Time formatting
// ============================================================================

export { formatTimeShort, formatDuration } from './time/formats';

// ============================================================================
// Unified engine API (async)
// ============================================================================

export {
  computeCoordinates,
  computeEphemeris,
  computeRiseTransitSet,
  searchPhenomena,
  computeAlmanac,
} from './engine';
