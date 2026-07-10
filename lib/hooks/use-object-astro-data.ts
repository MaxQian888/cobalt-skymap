/**
 * Shared hook for computing astronomical data of a selected celestial object
 * Extracts duplicated logic from InfoPanel and ObjectDetailDrawer
 */

import { useMemo } from 'react';
import { raDecToAltAz, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import {
  getMoonPhase,
  getMoonPhaseName,
  getMoonIllumination,
  getMoonPosition,
  getSunPosition,
  getJulianDateFromDate,
  angularSeparation,
  calculateTargetVisibility,
  calculateImagingFeasibility,
  calculateTwilightTimes,
} from '@/lib/astronomy/astro-utils';
import { transformCoordinate } from '@/lib/astronomy/pipeline';
import { buildTimeScaleContext } from '@/lib/astronomy/time-scales';
import { calculateSolarSystemVisibility } from '@/lib/astronomy/visibility/solar-system';
import { createTargetPositionModel } from '@/lib/astronomy/position-provider';
import type { PositionProvider, TargetKind, TargetPositionModel } from '@/lib/astronomy/position-provider';
import type { SelectedObjectData } from '@/lib/core/types';
import type { TargetVisibility, ImagingFeasibility, TwilightTimes } from '@/lib/core/types';
import type { AstronomicalFrame, CoordinateQualityFlag, EopFreshness, TimeScale } from '@/lib/core/types';

// ============================================================================
// Types
// ============================================================================

/** Environmental astronomical data (moon, sun, LST, twilight) */
export interface AstroEnvironmentData {
  moonPhaseName: string;
  moonIllumination: number;
  moonAltitude: number;
  moonRa: number;
  moonDec: number;
  sunAltitude: number;
  lstString: string;
  lstSource: 'UT1' | 'UTC';
  lstTimeScale: TimeScale;
  dataFreshness: EopFreshness;
  qualityFlag: CoordinateQualityFlag;
  epochJd: number;
  twilight: TwilightTimes;
}

/** Target-specific computed astronomical data */
export interface TargetAstroData {
  altitude: number;
  azimuth: number;
  moonDistance: number;
  /** Null for artificial satellites — a fixed-RA/Dec rise/set forecast would be meaningless. */
  visibility: TargetVisibility | null;
  /** Null for artificial satellites (see visibility). */
  feasibility: ImagingFeasibility | null;
  /** How the object's position evolves over time (fixed star vs planet vs satellite). */
  targetKind: TargetKind;
  /** True when positions are the selection-time snapshot (comets/asteroids, satellites). */
  positionIsSnapshot: boolean;
  /** NORAD catalog id when the selection is a satellite with a known id. */
  noradId: number | null;
  /** Stable per-selection provider: RA/Dec (ICRF degrees) at an arbitrary time. */
  positionAt: PositionProvider;
  frame: AstronomicalFrame;
  timeScale: TimeScale;
  qualityFlag: CoordinateQualityFlag;
  dataFreshness: EopFreshness;
  epochJd: number;
  updatedAt: string;
  calculationSource: 'calculation' | 'engine';
  calculationDegraded: boolean;
  calculationTimestamp: string;
  riskHints: string[];
}

export type ObjectAstroDataV2 = TargetAstroData;

// ============================================================================
// Hook
// ============================================================================

/**
 * Compute environmental astronomical data (moon phase, sun position, LST, twilight)
 * Independent of any specific target object.
 */
export function useAstroEnvironment(
  latitude: number,
  longitude: number,
  currentTime: Date,
): AstroEnvironmentData {
  const timeBucketSec = Math.floor(currentTime.getTime() / 1000);
  return useMemo(() => {
    const context = buildTimeScaleContext(currentTime);
    const jd = getJulianDateFromDate(currentTime);
    const moonPhase = getMoonPhase(jd);
    const moonPhaseName = getMoonPhaseName(moonPhase);
    const moonIllumination = getMoonIllumination(moonPhase);
    const moonPos = getMoonPosition(jd);
    const sunPos = getSunPosition(jd);

    const moonAltAz = raDecToAltAz(moonPos.ra, moonPos.dec, latitude, longitude);
    const sunAltAz = raDecToAltAz(sunPos.ra, sunPos.dec, latitude, longitude);

    const lst = transformCoordinate(
      { raDeg: moonPos.ra, decDeg: moonPos.dec },
      { latitude, longitude, date: currentTime, fromFrame: 'ICRF', toFrame: 'OBSERVED' }
    ).lstDeg;
    const lstString = degreesToHMS(lst);

    const twilight = calculateTwilightTimes(latitude, longitude, currentTime);

    return {
      moonPhaseName,
      moonIllumination,
      moonAltitude: moonAltAz.altitude,
      moonRa: moonPos.ra,
      moonDec: moonPos.dec,
      sunAltitude: sunAltAz.altitude,
      lstString,
      lstSource: context.eop.freshness === 'fallback' ? 'UTC' : 'UT1',
      lstTimeScale: context.eop.freshness === 'fallback' ? 'UTC' : 'UT1',
      dataFreshness: context.eop.freshness,
      qualityFlag: context.eop.freshness === 'fallback' ? 'fallback' : 'precise',
      epochJd: context.jdUtc,
      twilight,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, timeBucketSec]);
}

/**
 * Build the per-selection position model (how RA/Dec evolves over time).
 *
 * Deliberately NOT keyed on currentTime: the returned `positionAt` function
 * must keep a stable identity across the 1 Hz refresh so chart/component
 * memos keyed on it don't recompute every second.
 */
export function useTargetPositionModel(
  selectedObject: SelectedObjectData | null,
  latitude: number,
  longitude: number,
  typeCategory?: string | null,
): TargetPositionModel | null {
  return useMemo(() => {
    if (!selectedObject) return null;
    return createTargetPositionModel(selectedObject, { latitude, longitude }, typeCategory);
  }, [selectedObject, latitude, longitude, typeCategory]);
}

/**
 * Compute target-specific astronomical data (altitude, azimuth, moon distance,
 * visibility window, imaging feasibility).
 *
 * Positions branch by target kind: solar-system bodies are recomputed for the
 * current time (and per time point downstream), satellites get no rise/set or
 * feasibility forecast at all, comets/asteroids keep the selection snapshot.
 *
 * @param selectedObject - The currently selected celestial object (or null)
 * @param latitude - Observer latitude in degrees
 * @param longitude - Observer longitude in degrees
 * @param moonRa - Current moon RA (from useAstroEnvironment)
 * @param moonDec - Current moon Dec (from useAstroEnvironment)
 * @param currentTime - Current Date used as cache-buster for periodic refresh
 * @param typeCategory - Optional objectInfo.typeCategory as a secondary
 *   detection signal (comet/asteroid/artificial)
 */
export function useTargetAstroData(
  selectedObject: SelectedObjectData | null,
  latitude: number,
  longitude: number,
  moonRa: number,
  moonDec: number,
  currentTime: Date,
  typeCategory?: string | null,
): TargetAstroData | null {
  const positionModel = useTargetPositionModel(selectedObject, latitude, longitude, typeCategory);

  // Solar-system rise/transit/set searches are much heavier than the fixed
  // hour-angle math, and their result only drifts by seconds within a minute —
  // bucket to 60s instead of the 1s cadence of the main memo.
  const timeBucketMin = Math.floor(currentTime.getTime() / 60000);
  const solarSystemVisibility = useMemo(() => {
    if (!positionModel || positionModel.kind !== 'solar_system' || !positionModel.body) return null;
    return calculateSolarSystemVisibility(positionModel.body, latitude, longitude, 30, currentTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionModel, latitude, longitude, timeBucketMin]);

  const timeBucketSec = Math.floor(currentTime.getTime() / 1000);
  return useMemo(() => {
    if (!selectedObject || !positionModel) return null;

    // Live position: for moving bodies this fixes the stale selection-time
    // coordinates (the Moon drifts ~13°/day); for fixed targets it is the
    // snapshot and behaves exactly as before.
    const { raDeg: ra, decDeg: dec } = positionModel.positionAt(currentTime);

    const transformed = transformCoordinate(
      { raDeg: ra, decDeg: dec },
      { latitude, longitude, date: currentTime, fromFrame: 'ICRF', toFrame: 'OBSERVED' }
    );
    const altAz = {
      altitude: transformed.altitudeDeg,
      azimuth: transformed.azimuthDeg,
    };
    const moonDistance = angularSeparation(ra, dec, moonRa, moonDec);

    let visibility: TargetVisibility | null = null;
    let feasibility: ImagingFeasibility | null = null;
    if (positionModel.kind === 'solar_system' && solarSystemVisibility) {
      visibility = solarSystemVisibility;
      feasibility = calculateImagingFeasibility(ra, dec, latitude, longitude, 30, currentTime, visibility);
    } else if (positionModel.kind !== 'satellite') {
      visibility = calculateTargetVisibility(ra, dec, latitude, longitude, 30, currentTime);
      feasibility = calculateImagingFeasibility(ra, dec, latitude, longitude, 30, currentTime);
    }

    const riskHints: string[] = [];
    if (visibility?.neverRises) riskHints.push('never-rises');
    if (moonDistance < 25 && positionModel.body !== 'Moon') riskHints.push('moon-interference');
    if (feasibility && feasibility.score < 45) riskHints.push('low-feasibility');

    return {
      altitude: altAz.altitude,
      azimuth: altAz.azimuth,
      moonDistance,
      visibility,
      feasibility,
      targetKind: positionModel.kind,
      positionIsSnapshot: positionModel.isSnapshot,
      noradId: positionModel.noradId,
      positionAt: positionModel.positionAt,
      frame: transformed.metadata.frame,
      timeScale: transformed.metadata.timeScale,
      qualityFlag: transformed.metadata.qualityFlag,
      dataFreshness: transformed.metadata.dataFreshness,
      epochJd: transformed.metadata.epochJd,
      updatedAt: transformed.metadata.generatedAt,
      calculationSource: transformed.metadata.source,
      calculationDegraded: transformed.metadata.qualityFlag === 'fallback' || transformed.metadata.dataFreshness === 'fallback',
      calculationTimestamp: transformed.metadata.generatedAt,
      riskHints,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject, positionModel, solarSystemVisibility, latitude, longitude, moonRa, moonDec, timeBucketSec]);
}
