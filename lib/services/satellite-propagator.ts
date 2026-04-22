/**
 * Satellite Orbit Propagator using SGP4/SDP4
 * Uses satellite.js for accurate orbital calculations
 */

import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  radiansToDegrees,
} from '@/lib/vendor/satellite-js-v7';
import type { EciVec3, GeodeticLocation, SatRec } from '@/lib/vendor/satellite-js-v7';
import { createLogger } from '@/lib/logger';

const logger = createLogger('satellite-propagator');

// ============================================================================
// Types
// ============================================================================

export interface TLEData {
  name: string;
  line1: string;
  line2: string;
}

export interface SatellitePosition {
  // Geographic position
  latitude: number;  // degrees
  longitude: number; // degrees
  altitude: number;  // km
  
  // Topocentric position (relative to observer)
  azimuth: number;   // degrees, 0 = North, 90 = East
  elevation: number; // degrees, 0 = horizon, 90 = zenith
  range: number;     // km
  
  // Equatorial coordinates
  ra: number;        // degrees
  dec: number;       // degrees
  
  // Velocity
  velocity: number;  // km/s
  
  // Visibility
  isVisible: boolean;
  isSunlit: boolean;
}

export interface ObserverLocation {
  latitude: number;  // degrees
  longitude: number; // degrees
  altitude: number;  // meters
}

export interface SatellitePass {
  startTime: Date;
  startAzimuth: number;
  startElevation: number;
  
  maxTime: Date;
  maxAzimuth: number;
  maxElevation: number;
  
  endTime: Date;
  endAzimuth: number;
  endElevation: number;
  
  duration: number; // seconds
  isVisible: boolean;
  magnitude?: number;
}

// ============================================================================
// TLE Parsing
// ============================================================================

/**
 * Parse TLE data from CelesTrak format
 */
export function parseTLE(tle: TLEData): SatRec | null {
  try {
    const satrec = twoline2satrec(tle.line1, tle.line2);
    return satrec;
  } catch (error) {
    logger.error('Failed to parse TLE', error);
    return null;
  }
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Calculate satellite position at a given time
 */
export function calculatePosition(
  satrec: SatRec,
  date: Date,
  observer: ObserverLocation
): SatellitePosition | null {
  try {
    // Propagate satellite position
    const positionAndVelocity = propagate(satrec, date);
    
    if (!positionAndVelocity || !positionAndVelocity.position || typeof positionAndVelocity.position === 'boolean') {
      return null;
    }
    
    if (!positionAndVelocity.velocity || typeof positionAndVelocity.velocity === 'boolean') {
      return null;
    }
    
    const positionEci = positionAndVelocity.position as EciVec3<number>;
    const velocityEci = positionAndVelocity.velocity as EciVec3<number>;
    
    // Get GMST for coordinate conversion
    const gmst = gstime(date);
    
    // Convert ECI to geodetic coordinates
    const positionGd = eciToGeodetic(positionEci, gmst);
    
    // Observer position in geodetic
    const observerGd: GeodeticLocation = {
      longitude: degreesToRadians(observer.longitude),
      latitude: degreesToRadians(observer.latitude),
      height: observer.altitude / 1000, // Convert to km
    };
    
    // Calculate look angles (azimuth, elevation, range)
    const lookAngles = ecfToLookAngles(
      observerGd,
      eciToEcf(positionEci, gmst)
    );
    
    // Convert to degrees
    const azimuth = radiansToDegrees(lookAngles.azimuth);
    const elevation = radiansToDegrees(lookAngles.elevation);
    const range = lookAngles.rangeSat;
    
    // Calculate velocity magnitude
    const velocity = Math.sqrt(
      velocityEci.x ** 2 + velocityEci.y ** 2 + velocityEci.z ** 2
    );
    
    // Calculate RA/Dec from ECI position
    const { ra, dec } = eciToRaDec(positionEci, gmst);
    
    // Check if satellite is sunlit (simplified)
    const isSunlit = checkSunlit(positionEci, date);
    
    // Satellite is visible if above horizon and sunlit while observer is in darkness
    const isVisible = elevation > 0 && isSunlit && isObserverInDarkness(observer, date);
    
    return {
      latitude: radiansToDegrees(positionGd.latitude),
      longitude: radiansToDegrees(positionGd.longitude),
      altitude: positionGd.height,
      azimuth: (azimuth + 360) % 360, // Normalize to 0-360
      elevation,
      range,
      ra,
      dec,
      velocity,
      isVisible,
      isSunlit,
    };
  } catch (error) {
    logger.error('Failed to calculate position', error);
    return null;
  }
}

/**
 * Convert ECI coordinates to RA/Dec
 */
function eciToRaDec(positionEci: EciVec3<number>, gmst: number): { ra: number; dec: number } {
  // Convert ECI to ECEF
  const ecf = eciToEcf(positionEci, gmst);
  
  // Calculate RA and Dec
  const r = Math.sqrt(ecf.x ** 2 + ecf.y ** 2 + ecf.z ** 2);
  const dec = radiansToDegrees(Math.asin(positionEci.z / r));
  
  // RA from ECI coordinates (not ECEF)
  let ra = radiansToDegrees(Math.atan2(positionEci.y, positionEci.x));
  if (ra < 0) ra += 360;
  
  return { ra, dec };
}

/**
 * Check if satellite is sunlit (simplified calculation)
 */
function checkSunlit(positionEci: EciVec3<number>, date: Date): boolean {
  // Simplified: calculate sun position and check if satellite is in Earth's shadow
  const sunPos = getSunPosition(date);
  
  // Vector from Earth center to satellite
  const satDist = Math.sqrt(positionEci.x ** 2 + positionEci.y ** 2 + positionEci.z ** 2);
  
  // Earth radius in km
  const earthRadius = 6371;
  
  // Simplified shadow check: if satellite is on the night side and close to Earth's shadow cone
  const dotProduct = (positionEci.x * sunPos.x + positionEci.y * sunPos.y + positionEci.z * sunPos.z) / satDist;
  
  // If dot product is negative, satellite is on the night side
  if (dotProduct < 0) {
    // Check if in shadow cone (simplified)
    const perpDist = Math.sqrt(satDist ** 2 - dotProduct ** 2);
    if (perpDist < earthRadius) {
      return false; // In Earth's shadow
    }
  }
  
  return true;
}

/**
 * Get approximate sun position in ECI coordinates
 */
function getSunPosition(date: Date): { x: number; y: number; z: number } {
  // Simplified sun position calculation
  const dayOfYear = getDayOfYear(date);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  
  // Sun's ecliptic longitude (simplified)
  const L = 280.46 + 0.9856474 * dayOfYear;
  const g = 357.528 + 0.9856003 * dayOfYear;
  const lambda = L + 1.915 * Math.sin(g * Math.PI / 180) + 0.02 * Math.sin(2 * g * Math.PI / 180);
  
  // Obliquity of ecliptic
  const epsilon = 23.439;
  
  // Convert to RA/Dec
  const lambdaRad = lambda * Math.PI / 180;
  const epsilonRad = epsilon * Math.PI / 180;
  
  // Sun's RA
  const ra = Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad));
  // Sun's Dec
  const dec = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad));
  
  // Convert to ECI (approximate, at 1 AU)
  const dist = 149597870.7; // 1 AU in km
  const gmst = (280.46061837 + 360.98564736629 * (getJulianDate(date) - 2451545.0) + hour * 15) * Math.PI / 180;
  
  return {
    x: dist * Math.cos(dec) * Math.cos(ra + gmst),
    y: dist * Math.cos(dec) * Math.sin(ra + gmst),
    z: dist * Math.sin(dec),
  };
}

/**
 * Check if observer is in darkness
 */
function isObserverInDarkness(observer: ObserverLocation, date: Date): boolean {
  // Simplified: check if sun is below horizon for observer
  const sunAltitude = getSunAltitude(observer, date);
  return sunAltitude < -6; // Civil twilight
}

/**
 * Get sun altitude for observer
 */
function getSunAltitude(observer: ObserverLocation, date: Date): number {
  const dayOfYear = getDayOfYear(date);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  
  // Solar declination (simplified)
  const declination = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365);
  
  // Hour angle
  const solarNoon = 12 - observer.longitude / 15;
  const hourAngle = (hour - solarNoon) * 15;
  
  // Solar altitude
  const latRad = observer.latitude * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  const haRad = hourAngle * Math.PI / 180;
  
  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  );
  
  return altitude * 180 / Math.PI;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

// ============================================================================
// Pass Prediction
// ============================================================================

/**
 * Predict satellite passes for the next N hours
 */
export function predictPasses(
  satrec: SatRec,
  observer: ObserverLocation,
  startTime: Date,
  hours: number = 24,
  minElevation: number = 10
): SatellitePass[] {
  const passes: SatellitePass[] = [];
  const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
  const stepMs = 60 * 1000; // 1 minute steps
  
  let currentPass: Partial<SatellitePass> | null = null;
  let maxElevation = 0;
  
  for (let time = startTime.getTime(); time < endTime.getTime(); time += stepMs) {
    const date = new Date(time);
    const position = calculatePosition(satrec, date, observer);
    
    if (!position) continue;
    
    if (position.elevation > 0) {
      // Satellite is above horizon
      if (!currentPass) {
        // Start of new pass
        currentPass = {
          startTime: date,
          startAzimuth: position.azimuth,
          startElevation: position.elevation,
          maxElevation: position.elevation,
          maxTime: date,
          maxAzimuth: position.azimuth,
          isVisible: position.isVisible,
        };
        maxElevation = position.elevation;
      } else {
        // Continue tracking pass
        if (position.elevation > maxElevation) {
          maxElevation = position.elevation;
          currentPass.maxElevation = position.elevation;
          currentPass.maxTime = date;
          currentPass.maxAzimuth = position.azimuth;
        }
        if (position.isVisible) {
          currentPass.isVisible = true;
        }
      }
    } else if (currentPass) {
      // End of pass
      const prevDate = new Date(time - stepMs);
      const prevPosition = calculatePosition(satrec, prevDate, observer);
      
      currentPass.endTime = prevDate;
      currentPass.endAzimuth = prevPosition?.azimuth || 0;
      currentPass.endElevation = prevPosition?.elevation || 0;
      currentPass.duration = (prevDate.getTime() - currentPass.startTime!.getTime()) / 1000;
      
      // Only add pass if it meets minimum elevation
      if (maxElevation >= minElevation) {
        passes.push(currentPass as SatellitePass);
      }
      
      currentPass = null;
      maxElevation = 0;
    }
  }
  
  return passes;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Calculate positions for multiple satellites
 */
export function calculateMultiplePositions(
  satellites: Array<{ satrec: SatRec; id: string; name: string }>,
  date: Date,
  observer: ObserverLocation
): Array<{ id: string; name: string; position: SatellitePosition | null }> {
  return satellites.map(sat => ({
    id: sat.id,
    name: sat.name,
    position: calculatePosition(sat.satrec, date, observer),
  }));
}

/**
 * Update satellite positions in real-time
 */
export function createPositionUpdater(
  satellites: Array<{ satrec: SatRec; id: string; name: string }>,
  observer: ObserverLocation,
  onUpdate: (positions: Array<{ id: string; name: string; position: SatellitePosition | null }>) => void,
  intervalMs: number = 1000
): () => void {
  const update = () => {
    const positions = calculateMultiplePositions(satellites, new Date(), observer);
    onUpdate(positions);
  };
  
  // Initial update
  update();
  
  // Set up interval
  const intervalId = setInterval(update, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(intervalId);
}
