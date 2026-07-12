/**
 * Mount Sequence Simulator
 *
 * Simulates running an equatorial mount through a target sequence,
 * detecting all potential safety issues before actual execution.
 *
 * Takes a list of scheduled targets and mount configuration,
 * then produces a comprehensive safety report.
 */

import {
  type MountSafetyConfig,
  type SafetyIssue,
  type TargetSafetyCheck,
  checkTargetSafety,
  calculateHourAngleAtTime,
  calculateRASlew,
  calculateCumulativeRotation,
  checkSlewThroughPole,
  determinePierSide,
} from './mount-safety';
import { angularSeparation } from './celestial/separation';

// ============================================================================
// Types
// ============================================================================

export interface SimulationTarget {
  id: string;
  name: string;
  ra: number;
  dec: number;
  startTime: Date;
  endTime: Date;
  /** Seconds per sub-frame (used for timing display) */
  exposureDuration?: number;
}

export interface SlewEvent {
  fromTargetId: string;
  fromTargetName: string;
  toTargetId: string;
  toTargetName: string;
  time: Date;
  /** RA slew angle in degrees */
  raSlewAngle: number;
  /** Dec slew angle in degrees */
  decSlewAngle: number;
  /** Total angular separation in degrees */
  totalAngle: number;
  /** Estimated slew duration in seconds (at ~4°/s typical) */
  estimatedDuration: number;
  /** Whether a meridian flip occurs during this slew */
  hasMeridianFlip: boolean;
  issues: SafetyIssue[];
}

export interface SimulationSummary {
  safe: number;
  warnings: number;
  dangers: number;
}

export interface SimulationResult {
  targets: TargetSafetyCheck[];
  slews: SlewEvent[];
  allIssues: SafetyIssue[];
  overallSafe: boolean;
  totalMeridianFlips: number;
  /** Total estimated slew time in seconds */
  totalSlewTime: number;
  /** Cumulative RA rotation in degrees (for cable wrap detection) */
  cumulativeRotation: number;
  /** Whether cable wrap risk is detected */
  cableWrapRisk: boolean;
  summary: SimulationSummary;
}

// ============================================================================
// Constants
// ============================================================================

/** Typical GEM slew speed in degrees per second */
const TYPICAL_SLEW_SPEED = 4;

// ============================================================================
// Simulation Engine
// ============================================================================

/**
 * Simulate a slew between two targets and check for safety issues.
 */
function simulateSlew(
  from: { id: string; name: string; ra: number; dec: number },
  to: { id: string; name: string; ra: number; dec: number },
  slewTime: Date,
  latitude: number,
  longitude: number,
  config: MountSafetyConfig
): SlewEvent {
  const issues: SafetyIssue[] = [];

  const raSlewAngle = calculateRASlew(from.ra, to.ra);
  const decSlewAngle = to.dec - from.dec;
  const totalAngle = angularSeparation(from.ra, from.dec, to.ra, to.dec);
  const estimatedDuration = totalAngle / TYPICAL_SLEW_SPEED;

  // Check if slew crosses the pole
  if (checkSlewThroughPole(from.dec, to.dec, latitude)) {
    issues.push({
      type: 'slew_through_pole',
      severity: 'warning',
      targetId: to.id,
      targetName: to.name,
      time: slewTime,
      descriptionKey: 'mountSafety.issues.slewThroughPole',
      descriptionParams: {
        from: from.name,
        to: to.name,
      },
      suggestionKey: 'mountSafety.suggestions.slewThroughPole',
    });
  }

  // Check if slew involves a meridian flip
  const fromHA = calculateHourAngleAtTime(from.ra, longitude, slewTime);
  const toHA = calculateHourAngleAtTime(to.ra, longitude, slewTime);
  const fromPier = determinePierSide(fromHA);
  const toPier = determinePierSide(toHA);
  const hasMeridianFlip =
    config.mountType === 'gem' && fromPier !== toPier;

  if (hasMeridianFlip) {
    issues.push({
      type: 'meridian_flip',
      severity: 'info',
      targetId: to.id,
      targetName: to.name,
      time: slewTime,
      descriptionKey: 'mountSafety.issues.slewMeridianFlip',
      descriptionParams: {
        from: from.name,
        to: to.name,
      },
      suggestionKey: 'mountSafety.suggestions.slewMeridianFlip',
    });
  }

  return {
    fromTargetId: from.id,
    fromTargetName: from.name,
    toTargetId: to.id,
    toTargetName: to.name,
    time: slewTime,
    raSlewAngle,
    decSlewAngle,
    totalAngle,
    estimatedDuration,
    hasMeridianFlip,
    issues,
  };
}

/**
 * Run a full sequence simulation.
 *
 * @param targets - Ordered list of targets with scheduled times
 * @param config - Mount safety configuration
 * @param latitude - Observer latitude in degrees
 * @param longitude - Observer longitude in degrees
 * @param startPierSide - Initial pier side (default: auto-detect from first target)
 */
export function simulateSequence(
  targets: SimulationTarget[],
  config: MountSafetyConfig,
  latitude: number,
  longitude: number,
  startPierSide?: 'east' | 'west'
): SimulationResult {
  if (targets.length === 0) {
    return {
      targets: [],
      slews: [],
      allIssues: [],
      overallSafe: true,
      totalMeridianFlips: 0,
      totalSlewTime: 0,
      cumulativeRotation: 0,
      cableWrapRisk: false,
      summary: { safe: 0, warnings: 0, dangers: 0 },
    };
  }

  // Sort targets by start time
  const sorted = [...targets].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  // Auto-detect initial pier side from first target's HA
  if (!startPierSide) {
    const firstHA = calculateHourAngleAtTime(
      sorted[0].ra, longitude, sorted[0].startTime
    );
    startPierSide = determinePierSide(firstHA);
  }

  // Check each target
  const targetChecks: TargetSafetyCheck[] = sorted.map((target) =>
    checkTargetSafety(
      target.id,
      target.name,
      target.ra,
      target.dec,
      target.startTime,
      target.endTime,
      latitude,
      longitude,
      config
    )
  );

  // Check slews between consecutive targets
  const slews: SlewEvent[] = [];
  const raSlewAngles: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    // Slew happens at the end of the current target
    const slewTime = from.endTime;

    const slew = simulateSlew(
      { id: from.id, name: from.name, ra: from.ra, dec: from.dec },
      { id: to.id, name: to.name, ra: to.ra, dec: to.dec },
      slewTime,
      latitude,
      longitude,
      config
    );

    slews.push(slew);
    raSlewAngles.push(slew.raSlewAngle);
  }

  // Cable wrap check
  const cableWrap = calculateCumulativeRotation(raSlewAngles);
  const cableWrapIssues: SafetyIssue[] = [];

  if (cableWrap.isRisky) {
    cableWrapIssues.push({
      type: 'cable_wrap',
      severity: 'warning',
      targetId: '__sequence__',
      targetName: 'Sequence',
      time: sorted[0].startTime,
      descriptionKey: 'mountSafety.issues.cableWrap',
      descriptionParams: {
        rotation: Math.round(cableWrap.totalRotation),
      },
      suggestionKey: 'mountSafety.suggestions.cableWrap',
    });
  }

  // Aggregate all issues
  const allIssues: SafetyIssue[] = [
    ...targetChecks.flatMap((tc) => tc.issues),
    ...slews.flatMap((s) => s.issues),
    ...cableWrapIssues,
  ];

  // Count meridian flips
  const totalMeridianFlips =
    targetChecks.filter((tc) => tc.needsMeridianFlip).length +
    slews.filter((s) => s.hasMeridianFlip).length;

  // Total slew time
  const totalSlewTime = slews.reduce((sum, s) => sum + s.estimatedDuration, 0);

  // Summary
  const dangers = allIssues.filter((i) => i.severity === 'danger').length;
  const warnings = allIssues.filter((i) => i.severity === 'warning').length;
  const safe = targetChecks.filter((tc) => tc.isSafe).length;

  return {
    targets: targetChecks,
    slews,
    allIssues,
    overallSafe: dangers === 0,
    totalMeridianFlips,
    totalSlewTime,
    cumulativeRotation: cableWrap.totalRotation,
    cableWrapRisk: cableWrap.isRisky,
    summary: { safe, warnings, dangers },
  };
}
