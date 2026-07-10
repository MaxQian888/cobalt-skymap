/**
 * Pure screen-pixel → RA/Dec unprojection for the Stellarium engine.
 * Extracted from use-click-coordinates so non-hook consumers (marker move
 * mode) can share the exact same math.
 */

import { ndcToViewVector } from '@/lib/core/stellarium-projection';
import { rad2deg } from '@/lib/astronomy/starmap-utils';
import type { StellariumEngine } from '@/lib/core/types';

export function normalizeRaDeg(raDeg: number): number {
  return ((raDeg % 360) + 360) % 360;
}

export function clampDecDeg(decDeg: number): number {
  return Math.min(90, Math.max(-90, decDeg));
}

/**
 * Convert a pixel position (relative to the rendered canvas area of the given
 * width/height) into ICRF RA/Dec degrees, or null when the pixel unprojects
 * outside the current projection's valid area.
 */
export function screenToRaDec(
  stel: StellariumEngine,
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
): { ra: number; dec: number } | null {
  const core = stel.core;
  const ndcX = (pixelX / width) * 2 - 1;
  const ndcY = 1 - (pixelY / height) * 2;

  const viewVec = ndcToViewVector(ndcX, ndcY, {
    projection: core.projection,
    fov: core.fov,
    aspect: width / height,
  });
  if (!viewVec) return null;

  const icrfVec = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', viewVec);
  const spherical = stel.c2s(icrfVec);

  return {
    ra: normalizeRaDeg(rad2deg(stel.anp(spherical[0]))),
    dec: clampDecDeg(rad2deg(spherical[1])),
  };
}
