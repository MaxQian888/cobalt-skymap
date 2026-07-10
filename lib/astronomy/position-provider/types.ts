import type { EngineBody } from '../engine/types';

/**
 * How a selected object's position evolves over time:
 * - `fixed` — star/DSO; the selection-time RA/Dec is valid at any time.
 * - `solar_system` — Sun/Moon/planet; position is recomputed per time point.
 * - `minor_body` — comet/asteroid; no local ephemeris, position is a
 *   selection-time snapshot that drifts over hours (annotated in the UI).
 * - `satellite` — artificial satellite; the snapshot is wrong within minutes,
 *   so time-based forecasts (rise/set, altitude curve) must not be shown.
 */
export type TargetKind = 'fixed' | 'solar_system' | 'minor_body' | 'satellite';

export type PositionProvider = (date: Date) => { raDeg: number; decDeg: number };

export interface TargetKindDetection {
  kind: TargetKind;
  body: EngineBody | null;
  noradId: number | null;
}

export interface TargetPositionModel extends TargetKindDetection {
  /** True when positionAt returns the selection-time snapshot for every date. */
  isSnapshot: boolean;
  positionAt: PositionProvider;
}

export interface ObserverPosition {
  latitude: number;
  longitude: number;
  elevation?: number;
}
