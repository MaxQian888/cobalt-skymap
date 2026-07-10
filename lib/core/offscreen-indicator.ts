/**
 * Pure math for the off-screen marker direction indicators: given a screen
 * direction toward an off-screen object, place a chevron on an inset border
 * rectangle pointing at it.
 */

export interface OffscreenDirection {
  /** Unit screen-space direction toward the object (y grows downward). */
  dx: number;
  dy: number;
  /** Angular distance from the view center (radians) — used for ranking. */
  angDist: number;
}

export interface EdgeIndicatorPlacement {
  x: number;
  y: number;
  /** Rotation for an up-pointing glyph so it points along (dx, dy). */
  angleDeg: number;
}

/**
 * Intersect the ray from the viewport center along (dx, dy) with a rectangle
 * inset from the viewport edges. Returns null for a degenerate direction.
 */
export function edgeIndicatorPosition(
  dx: number,
  dy: number,
  width: number,
  height: number,
  inset: number = 28,
): EdgeIndicatorPlacement | null {
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length < 1e-9) return null;
  const ux = dx / length;
  const uy = dy / length;

  const cx = width / 2;
  const cy = height / 2;
  const halfW = Math.max(0, width / 2 - inset);
  const halfH = Math.max(0, height / 2 - inset);

  const tx = ux === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(ux);
  const ty = uy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(uy);
  const t = Math.min(tx, ty);
  if (!Number.isFinite(t)) return null;

  return {
    x: cx + ux * t,
    y: cy + uy * t,
    angleDeg: (Math.atan2(uy, ux) * 180) / Math.PI + 90,
  };
}

export interface OffscreenCandidate<T> {
  item: T;
  dir: OffscreenDirection;
}

/** Keep the `cap` angularly-nearest off-screen candidates. */
export function selectIndicators<T>(
  candidates: OffscreenCandidate<T>[],
  cap: number = 8,
): OffscreenCandidate<T>[] {
  return [...candidates]
    .sort((a, b) => a.dir.angDist - b.dir.angDist)
    .slice(0, Math.max(0, cap));
}
