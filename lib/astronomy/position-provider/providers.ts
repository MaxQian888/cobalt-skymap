import { Equator, Observer } from 'astronomy-engine';
import { bodyFromName } from '../engine/backend-fallback';
import type { EngineBody } from '../engine/types';
import { detectTargetKind } from './detect';
import type { ObserverPosition, PositionProvider, TargetPositionModel } from './types';

const normalizeDegrees = (value: number): number => ((value % 360) + 360) % 360;

export function createFixedPositionProvider(raDeg: number, decDeg: number): PositionProvider {
  const position = { raDeg, decDeg };
  return () => position;
}

/**
 * Per-date position of a major solar-system body via astronomy-engine.
 * `ofdate` MUST stay false: the rest of the app (transformCoordinate, the
 * altitude math) consumes ICRF/J2000 coordinates, and equator-of-date RA/Dec
 * would silently disagree with that pipeline by up to ~0.4°.
 */
export function createSolarSystemPositionProvider(
  engineBody: EngineBody,
  observer: ObserverPosition,
): PositionProvider {
  const body = bodyFromName(engineBody);
  const obs = new Observer(observer.latitude, observer.longitude, observer.elevation ?? 0);
  return (date: Date) => {
    const eq = Equator(body, date, obs, /* ofdate */ false, /* aberration */ true);
    return { raDeg: normalizeDegrees(eq.ra * 15), decDeg: eq.dec };
  };
}

export interface TargetPositionInput {
  names: readonly string[];
  raDeg: number;
  decDeg: number;
  type?: string | null;
}

/**
 * Build the position model for a selection. Detection failures degrade to the
 * `fixed` snapshot provider (today's behavior for everything).
 */
export function createTargetPositionModel(
  selected: TargetPositionInput,
  observer: ObserverPosition,
  typeCategory?: string | null,
): TargetPositionModel {
  const detection = detectTargetKind(selected.names ?? [], selected.type, typeCategory);
  const snapshot = createFixedPositionProvider(selected.raDeg, selected.decDeg);

  switch (detection.kind) {
    case 'solar_system':
      return {
        ...detection,
        isSnapshot: false,
        positionAt: detection.body
          ? createSolarSystemPositionProvider(detection.body, observer)
          : snapshot,
      };
    case 'minor_body':
    case 'satellite':
      return { ...detection, isSnapshot: true, positionAt: snapshot };
    default:
      return { ...detection, isSnapshot: false, positionAt: snapshot };
  }
}
