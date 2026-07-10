/**
 * Altitude calculations over time
 */

import { deg2rad, rad2deg } from '../coordinates/conversions';
import { dateToJulianDate } from '../time/julian';

// ============================================================================
// Altitude Calculations
// ============================================================================

/**
 * Calculate altitude for a target at a specific time
 * @param ra - Right Ascension in degrees
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude in degrees
 * @param longitude - Observer longitude in degrees
 * @param date - Date for calculation
 * @returns Altitude in degrees
 */
export function getAltitudeAtTime(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  date: Date
): number {
  const jd = dateToJulianDate(date);
  const S = jd - 2451545.0;
  const T = S / 36525.0;
  const GST = 280.46061837 + 360.98564736629 * S + T ** 2 * (0.000387933 - T / 38710000);
  const LST = ((GST + longitude) % 360 + 360) % 360;
  
  const HA = deg2rad(LST - ra);
  const decRad = deg2rad(dec);
  const latRad = deg2rad(latitude);
  
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(HA);
  
  return rad2deg(Math.asin(sinAlt));
}

/**
 * Calculate target altitude over time (for altitude chart)
 * @param ra - Right Ascension in degrees
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude
 * @param longitude - Observer longitude
 * @param hoursAhead - How many hours to calculate
 * @param intervalMinutes - Time step in minutes
 * @param positionAt - Optional per-time position for moving bodies (planets,
 *   Moon). When provided it overrides `ra`/`dec` at every sample so the curve
 *   tracks the body instead of freezing its selection-time coordinates.
 * @returns Array of altitude points
 */
export function getAltitudeOverTime(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  hoursAhead: number = 24,
  intervalMinutes: number = 30,
  positionAt?: (date: Date) => { raDeg: number; decDeg: number }
): Array<{ hour: number; altitude: number; azimuth: number }> {
  const result: Array<{ hour: number; altitude: number; azimuth: number }> = [];
  const now = new Date();
  const stepsPerHour = 60 / intervalMinutes;
  const totalSteps = hoursAhead * stepsPerHour;

  for (let i = 0; i <= totalSteps; i++) {
    const futureTime = new Date(now.getTime() + i * intervalMinutes * 60 * 1000);
    const hour = i / stepsPerHour;

    const samplePos = positionAt ? positionAt(futureTime) : null;
    const sampleRa = samplePos ? samplePos.raDeg : ra;
    const sampleDec = samplePos ? samplePos.decDeg : dec;

    // Calculate LST at future time
    const futureJD = futureTime.getTime() / 86400000 + 2440587.5;
    const S = futureJD - 2451545.0;
    const T = S / 36525.0;
    const GST = 280.46061837 + 360.98564736629 * S + T ** 2 * (0.000387933 - T / 38710000);
    const LST = (GST + longitude) % 360;

    // Calculate hour angle
    const HA = LST - sampleRa;
    const HARad = deg2rad(HA);
    const decRad = deg2rad(sampleDec);
    const latRad = deg2rad(latitude);

    // Calculate altitude
    const sinAlt = Math.sin(decRad) * Math.sin(latRad) +
                   Math.cos(decRad) * Math.cos(latRad) * Math.cos(HARad);
    const altitude = rad2deg(Math.asin(sinAlt));

    // Calculate azimuth
    const y = -Math.cos(decRad) * Math.sin(HARad);
    const x = Math.sin(decRad) * Math.cos(latRad) -
              Math.cos(decRad) * Math.sin(latRad) * Math.cos(HARad);
    let azimuth = rad2deg(Math.atan2(y, x));
    if (azimuth < 0) azimuth += 360;

    result.push({ hour, altitude, azimuth });
  }

  return result;
}

/**
 * Get maximum altitude for an object
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude in degrees
 * @returns Maximum altitude in degrees
 */
export function getMaxAltitude(dec: number, latitude: number): number {
  // Maximum altitude occurs at transit
  return 90 - Math.abs(latitude - dec);
}

/**
 * Get minimum altitude for an object (if circumpolar)
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude in degrees
 * @returns Minimum altitude in degrees
 */
export function getMinAltitude(dec: number, latitude: number): number {
  return -90 + Math.abs(latitude + dec);
}

/**
 * Calculate when target reaches a specific altitude
 * @param ra - Right Ascension in degrees
 * @param dec - Declination in degrees
 * @param latitude - Observer latitude
 * @param longitude - Observer longitude
 * @param targetAltitude - Desired altitude in degrees
 * @param rising - True for rising, false for setting
 * @param from - Start date
 * @returns Date when altitude is reached, or null
 */
export function getTimeAtAltitude(
  ra: number,
  dec: number,
  latitude: number,
  longitude: number,
  targetAltitude: number,
  rising: boolean,
  from: Date = new Date()
): Date | null {
  const latRad = deg2rad(latitude);
  const decRad = deg2rad(dec);
  const altRad = deg2rad(targetAltitude);
  
  const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) /
               (Math.cos(latRad) * Math.cos(decRad));
  
  if (cosH > 1 || cosH < -1) return null;
  
  const H = rad2deg(Math.acos(cosH));
  
  // Get current LST
  const jd = dateToJulianDate(from);
  const S = jd - 2451545.0;
  const T = S / 36525.0;
  const GST = 280.46061837 + 360.98564736629 * S + T ** 2 * (0.000387933 - T / 38710000);
  const LST = ((GST + longitude) % 360 + 360) % 360;
  
  // Calculate target LST
  const targetLST = rising ? (ra - H + 360) % 360 : (ra + H) % 360;
  
  // Hours until target LST
  let hoursUntil = (targetLST - LST) / 15;
  if (hoursUntil < 0) hoursUntil += 24;
  
  return new Date(from.getTime() + hoursUntil * 3600000);
}

/**
 * Calculate imaging hours within a dark window above minimum altitude
 * @param altitudeData - Altitude data points over time
 * @param minAltitude - Minimum altitude for imaging in degrees
 * @param darkStart - Start of dark window
 * @param darkEnd - End of dark window
 * @returns Total imaging hours
 */
export function calculateImagingHours(
  altitudeData: { points: Array<{ altitude: number; time: Date }> },
  minAltitude: number,
  darkStart: Date | null,
  darkEnd: Date | null
): number {
  if (!darkStart || !darkEnd) return 0;

  const darkStartMs = darkStart.getTime();
  const darkEndMs = darkEnd.getTime();

  let totalHours = 0;
  const intervalHours = 0.1; // 6 minutes

  for (const point of altitudeData.points) {
    const timeMs = point.time.getTime();
    if (timeMs >= darkStartMs && timeMs <= darkEndMs && point.altitude >= minAltitude) {
      totalHours += intervalHours;
    }
  }

  return totalHours;
}
