/**
 * Mount Safety Configuration and Check Functions
 * 
 * Pure functions for detecting potential equipment damage risks
 * when running an equatorial mount through a target sequence.
 * 
 * Covers: meridian flip, hour angle limits, declination limits,
 * altitude limits, counterweight-up, cable wrap, pier collision.
 * 
 * Reference: NINA meridian flip logic, EQASCOM mount limits,
 * ASCOM SideOfPier specification.
 */

import { deg2rad, rad2deg } from './starmap-utils';
import { getLSTForDate, SIDEREAL_RATIO } from './time/sidereal';

// ============================================================================
// Types
// ============================================================================

export type MountType = 'gem' | 'fork' | 'altaz';

export interface MeridianFlipConfig {
  enabled: boolean;
  /** Minutes after meridian before flip is triggered (default 5) */
  minutesAfterMeridian: number;
  /** Maximum minutes after meridian before forced stop (default 15) */
  maxMinutesAfterMeridian: number;
  /** Minutes before meridian to pause (for long tubes, default 0) */
  pauseBeforeMeridian: number;
}

export interface MountSafetyConfig {
  mountType: MountType;
  /** East hour angle limit in degrees (negative = east, default -90) */
  hourAngleLimitEast: number;
  /** West hour angle limit in degrees (positive = west, default 90) */
  hourAngleLimitWest: number;
  /** Minimum declination in degrees (default -85) */
  declinationLimitMin: number;
  /** Maximum declination in degrees (default 85) */
  declinationLimitMax: number;
  /** Minimum altitude in degrees (default 15) */
  minAltitude: number;
  /** Meridian flip settings (GEM only) */
  meridianFlip: MeridianFlipConfig;
  /** Telescope tube length in mm (for collision estimation, default 500) */
  telescopeLength: number;
  /** Counterweight bar length in mm (default 300) */
  counterweightBarLength: number;
}

export type SafetyIssueSeverity = 'info' | 'warning' | 'danger';

export type SafetyIssueType =
  | 'meridian_flip'
  | 'hour_angle_limit'
  | 'dec_limit'
  | 'below_horizon'
  | 'counterweight_up'
  | 'cable_wrap'
  | 'pier_collision'
  | 'slew_through_pole';

export interface SafetyIssue {
  type: SafetyIssueType;
  severity: SafetyIssueSeverity;
  targetId: string;
  targetName: string;
  time: Date;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
  suggestionKey: string;
  suggestionParams?: Record<string, string | number>;
  hourAngle?: number;
  altitude?: number;
  pierSide?: 'east' | 'west';
}

export interface TargetSafetyCheck {
  targetId: string;
  targetName: string;
  ra: number;
  dec: number;
  startTime: Date;
  endTime: Date;
  pierSideAtStart: 'east' | 'west';
  pierSideAtEnd: 'east' | 'west';
  hourAngleAtStart: number;
  hourAngleAtEnd: number;
  minAltitude: number;
  maxAltitude: number;
  needsMeridianFlip: boolean;
  meridianFlipTime: Date | null;
  issues: SafetyIssue[];
  isSafe: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_MERIDIAN_FLIP: MeridianFlipConfig = {
  enabled: true,
  minutesAfterMeridian: 5,
  maxMinutesAfterMeridian: 15,
  pauseBeforeMeridian: 0,
};

export const DEFAULT_MOUNT_SAFETY_CONFIG: MountSafetyConfig = {
  mountType: 'gem',
  hourAngleLimitEast: -90,
  hourAngleLimitWest: 90,
  declinationLimitMin: -85,
  declinationLimitMax: 85,
  minAltitude: 15,
  meridianFlip: DEFAULT_MERIDIAN_FLIP,
  telescopeLength: 500,
  counterweightBarLength: 300,
};

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Calculate Local Sidereal Time for a specific date and longitude.
 * Returns LST in degrees (0-360).
 */
export function getLSTAtTime(date: Date, longitude: number): number {
  return getLSTForDate(longitude, date);
}

/**
 * Calculate hour angle in degrees for a target at a specific time.
 * Positive HA = west of meridian, Negative HA = east of meridian.
 * Range: -180 to +180.
 */
export function calculateHourAngleAtTime(
  raDeg: number,
  longitude: number,
  time: Date
): number {
  const lst = getLSTAtTime(time, longitude);
  let ha = lst - raDeg;
  // Normalize to -180..+180
  while (ha > 180) ha -= 360;
  while (ha < -180) ha += 360;
  return ha;
}

/**
 * Calculate altitude of a target at a specific time.
 */
export function calculateAltitudeAtTime(
  raDeg: number,
  decDeg: number,
  latitude: number,
  longitude: number,
  time: Date
): number {
  const ha = calculateHourAngleAtTime(raDeg, longitude, time);
  const haRad = deg2rad(ha);
  const decRad = deg2rad(decDeg);
  const latRad = deg2rad(latitude);

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);

  return rad2deg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
}

/**
 * Determine pier side from hour angle (for GEM).
 * Normal pointing: HA < 0 (east) → telescope west of pier → pierSide 'west'
 *                  HA > 0 (west) → telescope east of pier → pierSide 'east'
 * 
 * Per ASCOM convention, SideOfPier reports the pointing state:
 * - 'west' = normal (counterweights down, scope looking east)
 * - 'east' = through-the-pole / flipped (scope looking west)
 */
export function determinePierSide(hourAngleDeg: number): 'east' | 'west' {
  return hourAngleDeg >= 0 ? 'east' : 'west';
}

/**
 * Calculate the time when a target crosses the meridian (HA = 0).
 * Returns the next meridian crossing time after `afterTime`.
 */
export function getMeridianCrossingTime(
  raDeg: number,
  longitude: number,
  afterTime: Date
): Date {
  const lst = getLSTAtTime(afterTime, longitude);
  // Hours until RA matches LST (meridian transit)
  let hoursUntil = (raDeg - lst) / 15;
  if (hoursUntil < 0) hoursUntil += 24;
  if (hoursUntil > 24) hoursUntil -= 24;
  // If very close to 0 or 24, the transit is essentially now
  if (hoursUntil < 0.001) hoursUntil += 24;
  // hoursUntil is in sidereal hours; convert to solar (wall-clock) time
  return new Date(afterTime.getTime() + (hoursUntil * 3600000) / SIDEREAL_RATIO);
}

/**
 * Calculate the meridian flip time based on config.
 * For GEM: flip happens `minutesAfterMeridian` after the target crosses the meridian.
 */
export function getMeridianFlipTime(
  raDeg: number,
  longitude: number,
  config: MountSafetyConfig,
  afterTime: Date
): Date | null {
  if (config.mountType !== 'gem' || !config.meridianFlip.enabled) {
    return null;
  }

  const crossingTime = getMeridianCrossingTime(raDeg, longitude, afterTime);
  return new Date(
    crossingTime.getTime() +
      config.meridianFlip.minutesAfterMeridian * 60000
  );
}

// ============================================================================
// Safety Check Functions
// ============================================================================

/**
 * Check if hour angle exceeds configured limits.
 */
export function checkHourAngleLimits(
  hourAngleDeg: number,
  config: MountSafetyConfig
): { exceeded: boolean; side: 'east' | 'west' | null } {
  if (hourAngleDeg < config.hourAngleLimitEast) {
    return { exceeded: true, side: 'east' };
  }
  if (hourAngleDeg > config.hourAngleLimitWest) {
    return { exceeded: true, side: 'west' };
  }
  return { exceeded: false, side: null };
}

/**
 * Check if declination exceeds configured limits.
 */
export function checkDeclinationLimits(
  decDeg: number,
  config: MountSafetyConfig
): boolean {
  return decDeg < config.declinationLimitMin || decDeg > config.declinationLimitMax;
}

/**
 * Check if altitude is below minimum safe altitude.
 */
export function checkAltitudeSafety(
  altitude: number,
  config: MountSafetyConfig
): boolean {
  return altitude < config.minAltitude;
}

/**
 * Check counterweight-up condition.
 * Counterweight-up occurs when the GEM is tracking past the meridian
 * without flipping — the counterweight bar is above the RA axis.
 * This happens when HA > 0 and pierSide is still 'west' (not yet flipped).
 */
export function checkCounterweightUp(
  hourAngleDeg: number,
  pierSide: 'east' | 'west'
): boolean {
  // Counterweight-up: target has crossed meridian (HA > 0)
  // but mount hasn't flipped yet (still on 'west' pointing state)
  return hourAngleDeg > 0 && pierSide === 'west';
}

/**
 * Check if a meridian flip is needed during a target's imaging window.
 */
export function checkMeridianFlipNeeded(
  raDeg: number,
  longitude: number,
  startTime: Date,
  endTime: Date,
  config: MountSafetyConfig
): { needed: boolean; flipTime: Date | null; crossingTime: Date | null } {
  if (config.mountType !== 'gem' || !config.meridianFlip.enabled) {
    return { needed: false, flipTime: null, crossingTime: null };
  }

  const crossingTime = getMeridianCrossingTime(raDeg, longitude, startTime);

  // Check if the meridian crossing falls within the imaging window
  if (crossingTime.getTime() >= startTime.getTime() &&
      crossingTime.getTime() <= endTime.getTime()) {
    const flipTime = new Date(
      crossingTime.getTime() +
        config.meridianFlip.minutesAfterMeridian * 60000
    );
    return { needed: true, flipTime, crossingTime };
  }

  return { needed: false, flipTime: null, crossingTime: null };
}

/**
 * Estimate cable wrap risk from cumulative RA rotation.
 * Returns accumulated rotation in degrees (absolute).
 * Risk threshold: typically > 360° cumulative.
 */
export function calculateCumulativeRotation(
  slewAngles: number[]
): { totalRotation: number; isRisky: boolean } {
  const totalRotation = slewAngles.reduce(
    (sum, angle) => sum + Math.abs(angle),
    0
  );
  return { totalRotation, isRisky: totalRotation > 360 };
}

/**
 * Calculate the RA slew angle between two targets (shortest path).
 */
export function calculateRASlew(fromRA: number, toRA: number): number {
  let diff = toRA - fromRA;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Check if a slew path passes through the celestial pole
 * (which can cause issues with some mounts).
 */
export function checkSlewThroughPole(
  fromDec: number,
  toDec: number,
  latitude: number
): boolean {
  // If both targets are on the same side of the pole, no issue.
  // If they straddle the pole (one > 80°, other < -80° etc.), flag it.
  const poleThreshold = 85;
  if (latitude >= 0) {
    // Northern hemisphere: check if slew crosses near NCP
    return (
      (fromDec > poleThreshold && toDec < -poleThreshold) ||
      (toDec > poleThreshold && fromDec < -poleThreshold)
    );
  } else {
    // Southern hemisphere: check if slew crosses near SCP
    return (
      (fromDec < -poleThreshold && toDec > poleThreshold) ||
      (toDec < -poleThreshold && fromDec > poleThreshold)
    );
  }
}

/**
 * Estimate pier collision risk based on telescope geometry.
 * A long telescope tube near the meridian and near the pole
 * can physically hit the pier/tripod.
 */
export function checkPierCollisionRisk(
  hourAngleDeg: number,
  decDeg: number,
  latitude: number,
  config: MountSafetyConfig
): boolean {
  if (config.mountType !== 'gem') return false;

  // Risk zone: HA near 0 (meridian) and Dec near latitude (near zenith/pole)
  // The closer to zenith, the more the tube can swing into the pier.
  const haThreshold = 10; // degrees from meridian
  const zenithDec = latitude;
  const decFromZenith = Math.abs(decDeg - zenithDec);

  // Long tubes are more at risk
  const tubeRiskFactor = config.telescopeLength / 500; // normalized to 500mm

  // Risk increases when HA is near 0 and tube is long and Dec is near zenith
  return (
    Math.abs(hourAngleDeg) < haThreshold * tubeRiskFactor &&
    decFromZenith < 20 * tubeRiskFactor
  );
}

// ============================================================================
// Comprehensive Single-Target Safety Check
// ============================================================================

/**
 * Perform a full safety check on a single target during its imaging window.
 * Samples at configurable interval (default 5 minutes) throughout the window.
 */
export function checkTargetSafety(
  targetId: string,
  targetName: string,
  raDeg: number,
  decDeg: number,
  startTime: Date,
  endTime: Date,
  latitude: number,
  longitude: number,
  config: MountSafetyConfig,
  sampleIntervalMinutes: number = 5
): TargetSafetyCheck {
  const issues: SafetyIssue[] = [];

  // Calculate HA at start and end
  const haAtStart = calculateHourAngleAtTime(raDeg, longitude, startTime);
  const haAtEnd = calculateHourAngleAtTime(raDeg, longitude, endTime);
  const pierSideAtStart = determinePierSide(haAtStart);
  const pierSideAtEnd = determinePierSide(haAtEnd);

  // Check declination limits (static)
  if (checkDeclinationLimits(decDeg, config)) {
    issues.push({
      type: 'dec_limit',
      severity: 'danger',
      targetId,
      targetName,
      time: startTime,
      descriptionKey: 'mountSafety.issues.decLimit',
      descriptionParams: { dec: Math.round(decDeg * 100) / 100 },
      suggestionKey: 'mountSafety.suggestions.decLimit',
    });
  }

  // Check meridian flip
  const flipCheck = checkMeridianFlipNeeded(
    raDeg, longitude, startTime, endTime, config
  );

  // Sample through the imaging window
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  let currentPierSide = pierSideAtStart;
  const flipTime = flipCheck.flipTime;

  // Meridian crossing relative to this window (also needed when flip is
  // disabled, where checkMeridianFlipNeeded reports nothing)
  const crossingTime =
    config.mountType === 'gem' && haAtStart < 0
      ? getMeridianCrossingTime(raDeg, longitude, startTime)
      : null;
  const crossingInWindow =
    crossingTime !== null && crossingTime.getTime() <= endTime.getTime();

  // Forced-stop limit: tracking beyond crossing + maxMinutesAfterMeridian
  // without having flipped is a hard stop on most GEM controllers.
  if (
    config.mountType === 'gem' &&
    crossingInWindow &&
    crossingTime !== null
  ) {
    const forcedStop = new Date(
      crossingTime.getTime() + config.meridianFlip.maxMinutesAfterMeridian * 60000
    );
    const flipHappensInTime =
      flipTime !== null && flipTime.getTime() <= forcedStop.getTime();
    if (!flipHappensInTime && endTime.getTime() > forcedStop.getTime()) {
      issues.push({
        type: 'hour_angle_limit',
        severity: 'danger',
        targetId,
        targetName,
        time: forcedStop,
        descriptionKey: 'mountSafety.issues.pastMeridianLimit',
        descriptionParams: {
          maxMinutes: config.meridianFlip.maxMinutesAfterMeridian,
        },
        suggestionKey: 'mountSafety.suggestions.pastMeridianLimit',
      });
    }

    // Pause window before the meridian (long tubes)
    if (config.meridianFlip.pauseBeforeMeridian > 0) {
      const pauseStart = new Date(
        crossingTime.getTime() - config.meridianFlip.pauseBeforeMeridian * 60000
      );
      if (pauseStart.getTime() >= startTime.getTime()) {
        issues.push({
          type: 'meridian_flip',
          severity: 'info',
          targetId,
          targetName,
          time: pauseStart,
          descriptionKey: 'mountSafety.issues.pauseBeforeMeridian',
          descriptionParams: {
            pauseMinutes: config.meridianFlip.pauseBeforeMeridian,
            pauseTimeStr: pauseStart.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
          suggestionKey: 'mountSafety.suggestions.pauseBeforeMeridian',
        });
      }
    }
  }

  const duration = endTime.getTime() - startTime.getTime();
  const steps = Math.max(1, Math.ceil(duration / (sampleIntervalMinutes * 60000)));

  for (let i = 0; i <= steps; i++) {
    const t = new Date(
      startTime.getTime() + (i / steps) * duration
    );

    const ha = calculateHourAngleAtTime(raDeg, longitude, t);
    const alt = calculateAltitudeAtTime(raDeg, decDeg, latitude, longitude, t);

    minAlt = Math.min(minAlt, alt);
    maxAlt = Math.max(maxAlt, alt);

    // Update pier side after flip
    if (flipTime && t.getTime() >= flipTime.getTime()) {
      currentPierSide = determinePierSide(ha);
    }

    // Check altitude
    if (checkAltitudeSafety(alt, config)) {
      // Only add one altitude issue (at the worst point)
      if (alt === minAlt || i === 0) {
        const existing = issues.find(
          (iss) => iss.type === 'below_horizon' && iss.targetId === targetId
        );
        if (!existing) {
          issues.push({
            type: 'below_horizon',
            severity: alt < 0 ? 'danger' : 'warning',
            targetId,
            targetName,
            time: t,
            descriptionKey: 'mountSafety.issues.belowHorizon',
            descriptionParams: {
              altitude: Math.round(alt * 10) / 10,
              minAltitude: config.minAltitude,
            },
            suggestionKey: 'mountSafety.suggestions.belowHorizon',
            altitude: alt,
          });
        }
      }
    }

    // Check hour angle limits
    const haCheck = checkHourAngleLimits(ha, config);
    if (haCheck.exceeded) {
      const existing = issues.find(
        (iss) => iss.type === 'hour_angle_limit' && iss.targetId === targetId
      );
      if (!existing) {
        issues.push({
          type: 'hour_angle_limit',
          severity: 'danger',
          targetId,
          targetName,
          time: t,
          descriptionKey: 'mountSafety.issues.haLimit',
          descriptionParams: {
            ha: Math.round(ha * 10) / 10,
            side: haCheck.side || 'unknown',
          },
          suggestionKey: 'mountSafety.suggestions.haLimit',
          hourAngle: ha,
        });
      }
    }

    // Check counterweight-up: target started east of meridian, has now
    // crossed it (HA > 0), and the flip has not happened yet (either flip
    // disabled, or this sample is before the scheduled flip time).
    if (
      config.mountType === 'gem' &&
      haAtStart < 0 &&
      ha > 0 &&
      (flipTime === null || t.getTime() < flipTime.getTime())
    ) {
      const existing = issues.find(
        (iss) => iss.type === 'counterweight_up' && iss.targetId === targetId
      );
      if (!existing) {
        issues.push({
          type: 'counterweight_up',
          severity: 'warning',
          targetId,
          targetName,
          time: t,
          descriptionKey: 'mountSafety.issues.counterweightUp',
          suggestionKey: 'mountSafety.suggestions.counterweightUp',
          hourAngle: ha,
          pierSide: currentPierSide,
        });
      }
    }

    // Check pier collision risk
    if (checkPierCollisionRisk(ha, decDeg, latitude, config)) {
      const existing = issues.find(
        (iss) => iss.type === 'pier_collision' && iss.targetId === targetId
      );
      if (!existing) {
        issues.push({
          type: 'pier_collision',
          severity: 'warning',
          targetId,
          targetName,
          time: t,
          descriptionKey: 'mountSafety.issues.pierCollision',
          suggestionKey: 'mountSafety.suggestions.pierCollision',
          hourAngle: ha,
        });
      }
    }
  }

  // Add meridian flip info
  if (flipCheck.needed && flipTime) {
    issues.push({
      type: 'meridian_flip',
      severity: 'info',
      targetId,
      targetName,
      time: flipTime,
      descriptionKey: 'mountSafety.issues.meridianFlip',
      descriptionParams: {
        flipTimeStr: flipTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
      suggestionKey: 'mountSafety.suggestions.meridianFlip',
      hourAngle: 0,
      pierSide: pierSideAtEnd,
    });
  }

  if (minAlt === Infinity) minAlt = 0;
  if (maxAlt === -Infinity) maxAlt = 0;

  const hasDanger = issues.some((i) => i.severity === 'danger');

  return {
    targetId,
    targetName,
    ra: raDeg,
    dec: decDeg,
    startTime,
    endTime,
    pierSideAtStart,
    pierSideAtEnd,
    hourAngleAtStart: haAtStart,
    hourAngleAtEnd: haAtEnd,
    minAltitude: minAlt,
    maxAltitude: maxAlt,
    needsMeridianFlip: flipCheck.needed,
    meridianFlipTime: flipTime,
    issues,
    isSafe: !hasDanger,
  };
}
