/**
 * Target visibility calculations
 */

import { deg2rad, rad2deg } from '../coordinates/conversions';
import { getLSTForDate, SIDEREAL_RATIO } from '../time/sidereal';
import { calculateTwilightTimes } from '../twilight/calculator';
import { isCircumpolar, neverRises } from './circumpolar';
import { getMaxAltitude } from './altitude';
import type { TargetVisibility } from '@/lib/core/types/astronomy';

// ============================================================================
// Hour Angle for Altitude
// ============================================================================

/**
 * Calculate hour angle for a given altitude threshold
 */
function calculateHourAngle(dec: number, lat: number, altThreshold: number): number {
  const latRad = deg2rad(lat);
  const decRad = deg2rad(dec);
  const altRad = deg2rad(altThreshold);
  
  const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) /
               (Math.cos(latRad) * Math.cos(decRad));
  
  if (cosH > 1) return NaN;  // Never rises above threshold
  if (cosH < -1) return 180; // Always above threshold
  
  return rad2deg(Math.acos(cosH));
}

// ============================================================================
// Dark-Window Intersection
// ============================================================================

export interface DarkImagingWindow {
  darkImagingStart: Date | null;
  darkImagingEnd: Date | null;
  darkImagingHours: number;
}

/**
 * Intersect an imaging window (target above the altitude threshold) with the
 * astronomical night at the observer's location. Shared by the fixed-target
 * and solar-system visibility calculators.
 */
export function intersectDarkWindow(
  imagingWindowStart: Date | null,
  imagingWindowEnd: Date | null,
  latitude: number,
  longitude: number,
  date: Date,
): DarkImagingWindow {
  const twilight = calculateTwilightTimes(latitude, longitude, date);

  if (twilight.astronomicalDusk && twilight.astronomicalDawn &&
      imagingWindowStart && imagingWindowEnd) {
    const overlapStart = Math.max(twilight.astronomicalDusk.getTime(), imagingWindowStart.getTime());
    const overlapEnd = Math.min(twilight.astronomicalDawn.getTime(), imagingWindowEnd.getTime());

    if (overlapEnd > overlapStart) {
      return {
        darkImagingStart: new Date(overlapStart),
        darkImagingEnd: new Date(overlapEnd),
        darkImagingHours: (overlapEnd - overlapStart) / 3600000,
      };
    }
  }

  return { darkImagingStart: null, darkImagingEnd: null, darkImagingHours: 0 };
}

// ============================================================================
// Target Visibility Calculation
// ============================================================================

/**
 * Calculate complete target visibility data
 * @param ra - Right Ascension in degrees
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude
 * @param longitude - Observer longitude
 * @param minAltitude - Minimum altitude for imaging (default 30°)
 * @param date - Date for calculation
 * @returns Complete visibility information
 */
export function calculateTargetVisibility(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  minAltitude: number = 30,
  date: Date = new Date()
): TargetVisibility {
  const now = date;

  const solarMsFromSiderealHours = (siderealHours: number): number => {
    return (siderealHours * 3600000) / SIDEREAL_RATIO;
  };
  
  // Check if circumpolar or never rises
  const maxAlt = getMaxAltitude(dec, latitude);
  const circumpolar = isCircumpolar(dec, latitude);
  const neverRisesFlag = neverRises(dec, latitude);
  
  // Current position
  const LST = getLSTForDate(longitude, now);
  const HA = deg2rad(LST - ra);
  const decRad = deg2rad(dec);
  const latRad = deg2rad(latitude);
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(HA);
  const currentAlt = rad2deg(Math.asin(sinAlt));
  const isCurrentlyVisible = currentAlt > 0;
  
  // Calculate hour angle for horizon crossing
  const haHorizon = calculateHourAngle(dec, latitude, 0);
  const haMinAlt = calculateHourAngle(dec, latitude, minAltitude);
  
  // Calculate transit time
  const lstNow = getLSTForDate(longitude, now);
  let deltaSiderealHours = (ra - lstNow) / 15;
  deltaSiderealHours = ((deltaSiderealHours % 24) + 24) % 24;
  const transitTime = new Date(now.getTime() + solarMsFromSiderealHours(deltaSiderealHours));
  
  // Calculate rise and set times
  let riseTime: Date | null = null;
  let setTime: Date | null = null;
  let imagingWindowStart: Date | null = null;
  let imagingWindowEnd: Date | null = null;
  
  if (!neverRisesFlag && !circumpolar && !isNaN(haHorizon)) {
    const horizonOffsetMs = solarMsFromSiderealHours(haHorizon / 15);
    riseTime = new Date(transitTime.getTime() - horizonOffsetMs);
    setTime = new Date(transitTime.getTime() + horizonOffsetMs);
  }
  
  // Imaging window (above minAltitude)
  if (!isNaN(haMinAlt) && haMinAlt !== 180) {
    const minAltOffsetMs = solarMsFromSiderealHours(haMinAlt / 15);
    imagingWindowStart = new Date(transitTime.getTime() - minAltOffsetMs);
    imagingWindowEnd = new Date(transitTime.getTime() + minAltOffsetMs);
  } else if (haMinAlt === 180 || circumpolar) {
    // For circumpolar/always-above-threshold targets we create a full 24h window
    // centered on the calculation date so dark-window intersection still works.
    imagingWindowStart = new Date(date.getTime() - 12 * 3600000);
    imagingWindowEnd = new Date(date.getTime() + 12 * 3600000);
  }
  
  const imagingHours = imagingWindowStart && imagingWindowEnd
    ? (imagingWindowEnd.getTime() - imagingWindowStart.getTime()) / 3600000
    : circumpolar ? 24 : 0;
  
  // Calculate dark imaging window (intersection with astronomical night)
  const { darkImagingStart, darkImagingEnd, darkImagingHours } = intersectDarkWindow(
    imagingWindowStart,
    imagingWindowEnd,
    latitude,
    longitude,
    date,
  );

  return {
    riseTime,
    setTime,
    transitTime,
    transitAltitude: maxAlt,
    isCurrentlyVisible,
    isCircumpolar: circumpolar,
    neverRises: neverRisesFlag,
    imagingWindowStart,
    imagingWindowEnd,
    imagingHours,
    darkImagingStart,
    darkImagingEnd,
    darkImagingHours,
  };
}

/**
 * Get transit time for a target
 * @param ra - Right Ascension in degrees
 * @param longitude - Observer longitude
 * @returns Transit LST and hours until transit
 */
export function getTransitTime(
  ra: number,
  longitude: number
): { transitLST: number; hoursUntilTransit: number } {
  const LST = getLSTForDate(longitude, new Date());
  const transitLST = ra;
  
  let deltaSiderealHours = (transitLST - LST) / 15;
  deltaSiderealHours = ((deltaSiderealHours % 24) + 24) % 24;
  const hoursUntilTransit = deltaSiderealHours / SIDEREAL_RATIO;
  
  return { transitLST, hoursUntilTransit };
}
