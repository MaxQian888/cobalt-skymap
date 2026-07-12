/**
 * Enhanced Target Visibility Calculations
 * Ported from NINA's DeepSkyObject and SkyObjectBase implementations
 * 
 * Provides detailed altitude calculations over time with custom horizon support
 */

import { deg2rad, rad2deg } from '../coordinates/conversions';
import { CustomHorizon } from '../horizon/custom-horizon';
import {
  getMoonPosition,
  getMoonIllumination,
  getMoonPhase,
  getMoonPhaseName,
  MOON_PHASE_NAMES,
} from '../celestial/moon';
import { angularSeparation } from '../celestial/separation';
import { getLSTForDate, SIDEREAL_RATIO } from '../time/sidereal';

// ============================================================================
// Types
// ============================================================================

export interface DataPoint {
  x: number;  // Time as number (e.g., DateTimeAxis.ToDouble equivalent)
  y: number;  // Value (altitude in degrees)
}

export interface MoonInfo {
  separation: number;           // Angular separation from target in degrees
  illumination: number;         // Moon illumination percentage
  phase: number;                // Moon phase (0-1)
  phaseName: string;            // Human readable phase name
  isUp: boolean;                // Is moon above horizon
  altitude: number;             // Current moon altitude
  dataPoints: DataPoint[];      // Moon altitude over time
  maxAltitude: DataPoint;       // Maximum moon altitude point
  displayMoon: boolean;         // Whether to show moon on chart
}

export interface TargetAltitudeData {
  altitudes: DataPoint[];       // Altitude data points over 24 hours
  horizon: DataPoint[];         // Horizon altitude at each azimuth/time
  maxAltitude: DataPoint;       // Maximum altitude point
  transitTime: Date;            // Time of transit (highest point)
  doesTransitSouth: boolean;    // Whether object transits south (vs north)
  riseTime: Date | null;        // When target rises above horizon
  setTime: Date | null;         // When target sets below horizon
  moon: MoonInfo;               // Moon information
  referenceDate: Date;          // Reference date for calculations
  isCircumpolar: boolean;       // Never sets
  neverRises: boolean;          // Never visible at this location
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Date to DataPoint x value (days since epoch)
 * Compatible with OxyPlot's DateTimeAxis.ToDouble
 */
export function dateToDouble(date: Date): number {
  // Days since Jan 1, 1900 (OxyPlot convention)
  const epoch = new Date(Date.UTC(1900, 0, 1)).getTime();
  return (date.getTime() - epoch) / (24 * 60 * 60 * 1000);
}

/**
 * Convert DataPoint x value back to Date
 */
export function doubleToDate(value: number): Date {
  const epoch = new Date(Date.UTC(1900, 0, 1)).getTime();
  return new Date(epoch + value * 24 * 60 * 60 * 1000);
}

/**
 * Get Local Sidereal Time for a specific date
 */
function getLSTForDateInternal(date: Date, longitude: number): number {
  return getLSTForDate(longitude, date);
}

/** Milliseconds of wall-clock time per 0.1 sidereal hour chart step */
const CHART_STEP_MS = (0.1 * 3600000) / SIDEREAL_RATIO;

/**
 * Calculate altitude for a celestial object at a given hour angle
 * Based on NINA's AstroUtil.GetAltitude
 */
export function calculateAltitude(
  hourAngleDeg: number,
  latitudeDeg: number,
  declinationDeg: number
): number {
  const ha = deg2rad(hourAngleDeg);
  const lat = deg2rad(latitudeDeg);
  const dec = deg2rad(declinationDeg);
  
  const sinAlt = Math.sin(dec) * Math.sin(lat) + 
                 Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  
  return rad2deg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

/**
 * Calculate azimuth for a celestial object
 * Based on NINA's AstroUtil.GetAzimuth
 */
export function calculateAzimuth(
  hourAngleDeg: number,
  altitudeDeg: number,
  latitudeDeg: number,
  declinationDeg: number
): number {
  const ha = deg2rad(hourAngleDeg);
  const alt = deg2rad(altitudeDeg);
  const lat = deg2rad(latitudeDeg);
  const dec = deg2rad(declinationDeg);
  
  let cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / 
              (Math.cos(alt) * Math.cos(lat));
  
  // Fix floating point issues
  cosAz = Math.max(-1, Math.min(1, cosAz));
  
  if (Math.sin(ha) < 0) {
    return rad2deg(Math.acos(cosAz));
  } else {
    return 360 - rad2deg(Math.acos(cosAz));
  }
}

/**
 * Convert hours to degrees
 */
function hoursToDegrees(hours: number): number {
  return hours * 15;
}

/**
 * Get hour angle in hours
 */
function getHourAngle(siderealTimeHours: number, raHours: number): number {
  let ha = siderealTimeHours - raHours;
  if (ha < 0) ha += 24;
  return ha;
}

// ============================================================================
// Main Calculation Function
// ============================================================================

/**
 * Calculate complete target visibility data
 * Based on NINA's DeepSkyObject.UpdateHorizonAndTransit
 * 
 * @param ra Right Ascension in degrees
 * @param dec Declination in degrees  
 * @param latitude Observer latitude in degrees
 * @param longitude Observer longitude in degrees
 * @param referenceDate Reference date for calculations (default: today at noon)
 * @param customHorizon Optional custom horizon
 * @returns Complete altitude and visibility data
 */
export function calculateTargetAltitudeData(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  referenceDate?: Date,
  customHorizon?: CustomHorizon
): TargetAltitudeData {
  // Use noon of today as reference (like NINA)
  const refDate = referenceDate ?? getNoonReferenceDate(new Date());
  
  // Convert RA from degrees to hours
  const raHours = ra / 15;
  
  // Initialize arrays
  const altitudes: DataPoint[] = [];
  const horizon: DataPoint[] = [];
  
  // Calculate initial sidereal time and hour angle
  const siderealTime = getLSTForDateInternal(refDate, longitude) / 15; // Convert to hours
  const hourAngle = getHourAngle(siderealTime, raHours);
  
  // Calculate altitudes for 24 hours at 6-minute intervals (240 points like NINA)
  let currentTime = new Date(refDate);
  
  for (let angle = hourAngle; angle < hourAngle + 24; angle += 0.1) {
    const degAngle = hoursToDegrees(angle);
    const altitude = calculateAltitude(degAngle, latitude, dec);
    const azimuth = calculateAzimuth(degAngle, altitude, latitude, dec);
    
    const timeValue = dateToDouble(currentTime);
    altitudes.push({ x: timeValue, y: altitude });
    
    // Add horizon altitude if custom horizon defined
    if (customHorizon && customHorizon.hasPoints()) {
      const horizonAlt = customHorizon.getAltitude(azimuth);
      horizon.push({ x: timeValue, y: horizonAlt });
    }
    
    currentTime = new Date(currentTime.getTime() + CHART_STEP_MS); // 0.1 sidereal hours
  }

  // Find maximum altitude
  const maxAltitude = altitudes.reduce((max, point) => 
    point.y > max.y ? point : max, altitudes[0]
  );
  
  // Calculate transit (does it transit south or north?)
  const alt0 = calculateAltitude(0, latitude, dec);
  const alt180 = calculateAltitude(180, latitude, dec);
  const doesTransitSouth = alt180 > alt0;
  
  // Calculate transit time
  const transitHourAngle = doesTransitSouth ? 0 : 12;
  const transitLST = raHours + transitHourAngle;
  const currentLST = siderealTime;
  let hoursToTransit = transitLST - currentLST;
  if (hoursToTransit < 0) hoursToTransit += 24;
  if (hoursToTransit > 24) hoursToTransit -= 24;
  // Sidereal hours → wall-clock milliseconds
  const transitTime = new Date(refDate.getTime() + (hoursToTransit * 3600000) / SIDEREAL_RATIO);
  
  // Calculate rise and set times
  const { riseTime, setTime, isCircumpolar, neverRises } = calculateRiseSetTimes(
    ra, dec, latitude, longitude, refDate, customHorizon
  );
  
  // Calculate moon info
  const moon = calculateMoonInfo(ra, dec, latitude, longitude, refDate);
  
  return {
    altitudes,
    horizon,
    maxAltitude,
    transitTime,
    doesTransitSouth,
    riseTime,
    setTime,
    moon,
    referenceDate: refDate,
    isCircumpolar,
    neverRises,
  };
}

/**
 * Get reference date at noon (like NINA's GetReferenceDate)
 */
export function getNoonReferenceDate(date: Date): Date {
  const d = new Date(date);
  if (d.getHours() >= 12) {
    d.setHours(12, 0, 0, 0);
  } else {
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

/**
 * Calculate rise and set times for a target
 */
function calculateRiseSetTimes(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  referenceDate: Date,
  customHorizon?: CustomHorizon
): {
  riseTime: Date | null;
  setTime: Date | null;
  isCircumpolar: boolean;
  neverRises: boolean;
} {
  // Check for circumpolar or never rises
  const latRad = deg2rad(latitude);
  const decRad = deg2rad(dec);
  
  // Maximum and minimum altitudes
  const maxAlt = 90 - Math.abs(latitude - dec);
  const minAlt = -90 + Math.abs(latitude + dec);
  
  if (minAlt > 0) {
    // Circumpolar - never sets
    return { riseTime: null, setTime: null, isCircumpolar: true, neverRises: false };
  }
  
  if (maxAlt < 0) {
    // Never rises
    return { riseTime: null, setTime: null, isCircumpolar: false, neverRises: true };
  }
  
  // Calculate hour angle at horizon crossing
  const horizonAlt = customHorizon?.hasPoints() ? customHorizon.getAltitude(180) : 0;
  const cosH = (Math.sin(deg2rad(horizonAlt)) - Math.sin(latRad) * Math.sin(decRad)) /
               (Math.cos(latRad) * Math.cos(decRad));
  
  if (Math.abs(cosH) > 1) {
    // Doesn't cross horizon
    if (cosH > 1) {
      return { riseTime: null, setTime: null, isCircumpolar: false, neverRises: true };
    } else {
      return { riseTime: null, setTime: null, isCircumpolar: true, neverRises: false };
    }
  }
  
  const hourAngleRad = Math.acos(cosH);
  const hourAngleDeg = rad2deg(hourAngleRad);
  
  // Calculate transit time first
  const raHours = ra / 15;
  const siderealTime = getLSTForDateInternal(referenceDate, longitude) / 15;
  let hoursToTransit = raHours - siderealTime;
  if (hoursToTransit < 0) hoursToTransit += 24;
  if (hoursToTransit > 24) hoursToTransit -= 24;
  
  // Sidereal hours → wall-clock milliseconds
  const transitTime = new Date(
    referenceDate.getTime() + (hoursToTransit * 3600000) / SIDEREAL_RATIO
  );

  // Rise is hour angle before transit, set is hour angle after
  const hourAngleMs = (hourAngleDeg / 15) * 3600000 / SIDEREAL_RATIO;
  const riseTime = new Date(transitTime.getTime() - hourAngleMs);
  const setTime = new Date(transitTime.getTime() + hourAngleMs);
  
  return { riseTime, setTime, isCircumpolar: false, neverRises: false };
}

/**
 * Calculate moon information relative to target
 * Based on NINA's MoonInfo class
 */
function calculateMoonInfo(
  targetRa: number,
  targetDec: number,
  latitude: number,
  longitude: number,
  referenceDate: Date
): MoonInfo {
  // Get moon position
  const jd = referenceDate.getTime() / 86400000 + 2440587.5;
  const moonPos = getMoonPosition(jd);
  
  // Calculate separation
  const separation = angularSeparation(targetRa, targetDec, moonPos.ra, moonPos.dec);
  
  // Get moon phase and illumination
  const phase = getMoonPhase(jd);
  const illumination = getMoonIllumination(phase);
  
  // Get phase name
  const phaseName = MOON_PHASE_NAMES[getMoonPhaseName(phase)];
  
  // Calculate moon altitude now
  const moonAltAz = calculateMoonAltAz(moonPos.ra, moonPos.dec, latitude, longitude, referenceDate);
  
  // Calculate moon altitude data points over 24 hours
  const dataPoints: DataPoint[] = [];
  let maxAltitude: DataPoint = { x: 0, y: -90 };
  
  let currentTime = new Date(referenceDate);
  for (let i = 0; i < 240; i++) {
    const moonJd = currentTime.getTime() / 86400000 + 2440587.5;
    const moonPosAtTime = getMoonPosition(moonJd);
    const altAz = calculateMoonAltAz(moonPosAtTime.ra, moonPosAtTime.dec, latitude, longitude, currentTime);
    
    const point: DataPoint = {
      x: dateToDouble(currentTime),
      y: altAz.altitude,
    };
    dataPoints.push(point);
    
    if (point.y > maxAltitude.y) {
      maxAltitude = point;
    }
    
    currentTime = new Date(currentTime.getTime() + 6 * 60 * 1000); // Add 6 minutes
  }
  
  return {
    separation,
    illumination,
    phase,
    phaseName,
    isUp: moonAltAz.altitude > 0,
    altitude: moonAltAz.altitude,
    dataPoints,
    maxAltitude,
    displayMoon: true,
  };
}

/**
 * Calculate moon altitude/azimuth
 */
function calculateMoonAltAz(
  moonRa: number,
  moonDec: number,
  latitude: number,
  longitude: number,
  date: Date = new Date()
): { altitude: number; azimuth: number } {
  const lst = getLSTForDateInternal(date, longitude);
  const ha = lst - moonRa;
  
  const altitude = calculateAltitude(ha, latitude, moonDec);
  const azimuth = calculateAzimuth(ha, altitude, latitude, moonDec);
  
  return { altitude, azimuth };
}

/**
 * Calculate imaging score based on altitude, moon, and other factors
 */
export function calculateImagingScore(
  altitude: number,
  moonSeparation: number,
  moonIllumination: number,
  isMoonUp: boolean
): number {
  let score = 100;
  
  // Altitude score (ideal > 60°)
  if (altitude < 0) {
    score -= 100;
  } else if (altitude < 15) {
    score -= 50;
  } else if (altitude < 30) {
    score -= 30;
  } else if (altitude < 45) {
    score -= 15;
  } else if (altitude < 60) {
    score -= 5;
  }
  
  // Moon interference
  if (isMoonUp) {
    if (moonIllumination > 80) {
      score -= 25;
      if (moonSeparation < 30) {
        score -= 25;
      } else if (moonSeparation < 60) {
        score -= 15;
      }
    } else if (moonIllumination > 50) {
      score -= 15;
      if (moonSeparation < 30) {
        score -= 15;
      }
    } else if (moonIllumination > 20) {
      score -= 5;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}
