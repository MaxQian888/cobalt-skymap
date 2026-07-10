/**
 * Unified coordinate projection hook for overlay components
 * Converts RA/Dec celestial coordinates to screen coordinates
 * 
 * Supports dual engines:
 * - Stellarium: gnomonic (rectilinear) projection via engine API
 * - Aladin Lite: world2pix() direct coordinate conversion
 * 
 * This hook consolidates the coordinate transformation logic previously duplicated in:
 * - SkyMarkers
 * - SatelliteOverlay
 */

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useStellariumStore } from '@/lib/stores';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useGlobalAnimationLoop } from './use-animation-frame';
import { createLogger } from '@/lib/logger';
import { viewVectorToNdc } from '@/lib/core/stellarium-projection';

const logger = createLogger('use-coordinate-projection');

// ============================================================================
// Types
// ============================================================================

export interface ScreenPosition {
  x: number;
  y: number;
  visible: boolean;
  /**
   * Screen-space direction toward the object when it is NOT visible
   * (Stellarium only). Used for off-screen edge indicators.
   */
  dir?: import('@/lib/core/offscreen-indicator').OffscreenDirection;
}

export interface CelestialCoordinate {
  ra: number;  // Right Ascension in degrees
  dec: number; // Declination in degrees
}

export interface ProjectedItem<T> {
  item: T;
  x: number;
  y: number;
  visible: boolean;
  /** Direction info for off-screen items (only with includeOffscreen). */
  dir?: import('@/lib/core/offscreen-indicator').OffscreenDirection;
}

/**
 * Structural equality for two projected-position arrays. Used to skip redundant
 * `setState` (and the re-render it triggers) when the projection is unchanged
 * frame-to-frame, e.g. while the sky view is static.
 */
function samePositions<T>(a: ProjectedItem<T>[], b: ProjectedItem<T>[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (
      p.item !== q.item ||
      p.x !== q.x ||
      p.y !== q.y ||
      p.visible !== q.visible ||
      p.dir !== q.dir
    ) {
      return false;
    }
  }
  return true;
}

export interface UseCoordinateProjectionOptions {
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Visibility margin factor (default: 1.1, meaning 10% beyond viewport) */
  visibilityMargin?: number;
}

export interface UseCoordinateProjectionReturn {
  /** Convert a single RA/Dec coordinate to screen position */
  convertToScreen: (ra: number, dec: number) => ScreenPosition | null;
  /** Project multiple items with coordinates to screen positions */
  projectItems: <T extends CelestialCoordinate>(items: T[]) => ProjectedItem<T>[];
  /** Whether the Stellarium engine is ready */
  isReady: boolean;
}

export interface UseBatchProjectionOptions<T> {
  /** Container width in pixels */
  containerWidth: number;
  /** Container height in pixels */
  containerHeight: number;
  /** Items to project */
  items: T[];
  /** Function to extract RA from item */
  getRa: (item: T) => number | undefined;
  /** Function to extract Dec from item */
  getDec: (item: T) => number | undefined;
  /** Whether projection is enabled */
  enabled?: boolean;
  /** Update interval in milliseconds (default: 33ms for ~30fps) */
  intervalMs?: number;
  /** Visibility margin factor (default: 1.1) */
  visibilityMargin?: number;
  /** Animation loop ID for global loop subscription */
  loopId?: string;
  /**
   * Adaptive mode (Stellarium only): run a cheap per-frame probe (FOV + view
   * center) and reproject only when the view actually changed. Overlays then
   * track fast pans at full frame rate with near-zero idle cost. NOT suitable
   * for items whose RA/Dec change on their own (satellites) — those need the
   * periodic interval. Falls back to interval throttling on Aladin.
   */
  adaptive?: boolean;
  /**
   * Also return off-screen items (visible: false) with their screen direction
   * (`dir`) so consumers can render edge indicators. Default: filtered out.
   */
  includeOffscreen?: boolean;
}

// ============================================================================
// Core Projection Functions
// ============================================================================

/**
 * Screen-space direction toward an off-screen point from its VIEW vector.
 * View x maps to screen x; view y is up, screen y is down. Returns undefined
 * for the degenerate straight-behind case.
 */
function offscreenDirectionFromViewVec(viewVec: number[]): ScreenPosition['dir'] {
  const [vx, vy, vz] = viewVec;
  const planar = Math.hypot(vx, vy);
  if (!Number.isFinite(planar) || planar < 1e-9) return undefined;
  const length = Math.hypot(vx, vy, vz);
  return {
    dx: vx / planar,
    dy: -vy / planar,
    angDist: Math.acos(Math.max(-1, Math.min(1, -vz / length))),
  };
}

/** Creates a Stellarium-specific coordinate projector using the active core projection. */
function createStellariumProjector(
  stel: NonNullable<ReturnType<typeof useStellariumStore.getState>['stel']>,
  containerWidth: number,
  containerHeight: number,
  visibilityMargin: number
): (ra: number, dec: number) => ScreenPosition | null {
  return (ra: number, dec: number): ScreenPosition | null => {
    try {
      const raRad = ra * stel.D2R;
      const decRad = dec * stel.D2R;
      const icrfVec = stel.s2c(raRad, decRad);
      const viewVec = stel.convertFrame(stel.observer, 'ICRF', 'VIEW', icrfVec);
      if (Array.isArray(viewVec) && viewVec.length >= 3 && viewVec[2] >= 0) {
        return { x: 0, y: 0, visible: false, dir: offscreenDirectionFromViewVec(viewVec) };
      }
      const ndc = viewVectorToNdc(viewVec, {
        projection: stel.core.projection,
        fov: stel.core.fov,
        aspect: containerWidth / containerHeight,
      });
      if (!ndc) {
        return { x: 0, y: 0, visible: false, dir: offscreenDirectionFromViewVec(viewVec) };
      }
      const ndcX = ndc.x;
      const ndcY = ndc.y;

      if (Math.abs(ndcX) > visibilityMargin || Math.abs(ndcY) > visibilityMargin) {
        return { x: 0, y: 0, visible: false, dir: offscreenDirectionFromViewVec(viewVec) };
      }

      const screenX = (ndcX + 1) * 0.5 * containerWidth;
      const screenY = (1 - ndcY) * 0.5 * containerHeight;

      return { x: screenX, y: screenY, visible: true };
    } catch (error) {
      logger.error('Error converting coordinates (Stellarium)', error);
      return null;
    }
  };
}

/**
 * Creates an Aladin Lite-specific coordinate projector
 * Uses Aladin's native world2pix() for coordinate conversion
 */
function createAladinProjector(
  aladin: NonNullable<ReturnType<typeof useStellariumStore.getState>['aladin']>,
  containerWidth: number,
  containerHeight: number,
  visibilityMargin: number
): (ra: number, dec: number) => ScreenPosition | null {
  return (ra: number, dec: number): ScreenPosition | null => {
    try {
      const result = aladin.world2pix(ra, dec);
      if (!result) {
        return { x: 0, y: 0, visible: false };
      }
      const [x, y] = result;
      const marginX = containerWidth * (visibilityMargin - 1);
      const marginY = containerHeight * (visibilityMargin - 1);
      const visible = x >= -marginX && x <= containerWidth + marginX
        && y >= -marginY && y <= containerHeight + marginY;
      return { x, y, visible };
    } catch (error) {
      logger.error('Error converting coordinates (Aladin)', error);
      return null;
    }
  };
}

/**
 * Creates a coordinate projection function for the currently active sky engine.
 * Automatically dispatches to Stellarium or Aladin projector.
 */
export function createCoordinateProjector(
  stel: ReturnType<typeof useStellariumStore.getState>['stel'],
  containerWidth: number,
  containerHeight: number,
  visibilityMargin: number = 1.1,
  aladin?: ReturnType<typeof useStellariumStore.getState>['aladin'],
  activeEngine?: string
): (ra: number, dec: number) => ScreenPosition | null {
  // If Aladin engine is active and instance is available, use Aladin projector
  if (activeEngine === 'aladin' && aladin) {
    return createAladinProjector(aladin, containerWidth, containerHeight, visibilityMargin);
  }
  // Default: Stellarium projector
  if (!stel) {
    return () => null;
  }
  return createStellariumProjector(stel, containerWidth, containerHeight, visibilityMargin);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for basic coordinate projection
 * Returns a memoized convertToScreen function that updates with container size
 */
export function useCoordinateProjection({
  containerWidth,
  containerHeight,
  visibilityMargin = 1.1,
}: UseCoordinateProjectionOptions): UseCoordinateProjectionReturn {
  const stel = useStellariumStore((state) => state.stel);
  const aladin = useStellariumStore((state) => state.aladin);
  // Use settings-store (updated synchronously) instead of stellarium-store's
  // activeEngine (set in useEffect, one tick behind) to avoid desync.
  const skyEngine = useSettingsStore((state) => state.skyEngine);

  const convertToScreen = useCallback(
    (ra: number, dec: number): ScreenPosition | null => {
      const projector = createCoordinateProjector(
        stel,
        containerWidth,
        containerHeight,
        visibilityMargin,
        aladin,
        skyEngine
      );
      return projector(ra, dec);
    },
    [stel, aladin, skyEngine, containerWidth, containerHeight, visibilityMargin]
  );

  const projectItems = useCallback(
    <T extends CelestialCoordinate>(items: T[]): ProjectedItem<T>[] => {
      const projector = createCoordinateProjector(
        stel,
        containerWidth,
        containerHeight,
        visibilityMargin,
        aladin,
        skyEngine
      );

      const results: ProjectedItem<T>[] = [];
      for (const item of items) {
        const pos = projector(item.ra, item.dec);
        if (pos) {
          results.push({
            item,
            x: pos.x,
            y: pos.y,
            visible: pos.visible,
          });
        }
      }
      return results;
    },
    [stel, aladin, skyEngine, containerWidth, containerHeight, visibilityMargin]
  );

  return {
    convertToScreen,
    projectItems,
    isReady: skyEngine === 'aladin' ? !!aladin : !!stel,
  };
}

/**
 * Hook for batch projection with automatic updates via global animation loop
 * Optimized for rendering multiple items (markers, satellites, etc.)
 */
export function useBatchProjection<T>({
  containerWidth,
  containerHeight,
  items,
  getRa,
  getDec,
  enabled = true,
  intervalMs = 33, // ~30fps
  visibilityMargin = 1.1,
  loopId = 'batch-projection',
  adaptive = false,
  includeOffscreen = false,
}: UseBatchProjectionOptions<T>): ProjectedItem<T>[] {
  const stel = useStellariumStore((state) => state.stel);
  const aladin = useStellariumStore((state) => state.aladin);
  // Use settings-store (updated synchronously) instead of stellarium-store's
  // activeEngine (set in useEffect, one tick behind) to avoid desync.
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const [positions, setPositions] = useState<ProjectedItem<T>[]>([]);

  // Last committed positions. Kept in lockstep with `positions` so the animation
  // loop can bail out of `setPositions` when nothing changed.
  const committedRef = useRef<ProjectedItem<T>[]>(positions);

  // Store items in ref to avoid stale closures
  const itemsRef = useRef(items);
  const itemsVersionRef = useRef(0);
  useEffect(() => {
    itemsRef.current = items;
    itemsVersionRef.current += 1;
  }, [items]);

  // Throttle timestamp tracking
  const lastUpdateRef = useRef<number>(0);

  // Adaptive-mode probe: last observed view state. Null forces a recompute.
  const probeRef = useRef<{
    fov: number;
    vx: number;
    vy: number;
    vz: number;
    itemsVersion: number;
    projector: unknown;
  } | null>(null);

  const engineReady = skyEngine === 'aladin' ? !!aladin : !!stel;

  // Memoize the projector to avoid re-creating the closure on every animation frame
  const projector = useMemo(
    () => engineReady
      ? createCoordinateProjector(stel, containerWidth, containerHeight, visibilityMargin, aladin, skyEngine)
      : null,
    [stel, aladin, skyEngine, engineReady, containerWidth, containerHeight, visibilityMargin]
  );

  // Memoize the update callback
  const updatePositions = useCallback(() => {
    if (!projector || !enabled) {
      if (committedRef.current.length !== 0) {
        committedRef.current = [];
        setPositions(committedRef.current);
      }
      return;
    }

    const currentItems = itemsRef.current;
    const newPositions: ProjectedItem<T>[] = [];

    for (const item of currentItems) {
      const ra = getRa(item);
      const dec = getDec(item);
      
      if (ra !== undefined && dec !== undefined) {
        const screenPos = projector(ra, dec);
        if (screenPos) {
          newPositions.push({
            item,
            x: screenPos.x,
            y: screenPos.y,
            visible: screenPos.visible,
            dir: screenPos.dir,
          });
        }
      }
    }

    if (samePositions(committedRef.current, newPositions)) return;
    committedRef.current = newPositions;
    setPositions(newPositions);
  }, [projector, enabled, getRa, getDec]);

  // Subscribe to global animation loop with throttling
  useGlobalAnimationLoop(
    loopId,
    useCallback(
      (_deltaTime: number, timestamp: number) => {
        // Adaptive path (Stellarium only): probe the view state each frame
        // (2 cheap engine reads, independent of item count) and skip the whole
        // O(n) reprojection + React commit when nothing changed.
        if (adaptive && skyEngine !== 'aladin' && stel) {
          try {
            const fov = stel.core.fov;
            const center = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', [0, 0, -1]);
            const [vx, vy, vz] = Array.isArray(center) ? center : [0, 0, 0];
            const prev = probeRef.current;
            const unchanged =
              prev !== null &&
              prev.projector === projector &&
              prev.itemsVersion === itemsVersionRef.current &&
              Math.abs(prev.fov - fov) < 1e-9 &&
              Math.abs(prev.vx - vx) < 1e-9 &&
              Math.abs(prev.vy - vy) < 1e-9 &&
              Math.abs(prev.vz - vz) < 1e-9;
            if (unchanged) return;
            probeRef.current = { fov, vx, vy, vz, itemsVersion: itemsVersionRef.current, projector };
          } catch {
            // Probe failure — fall through to an unconditional update.
            probeRef.current = null;
          }
          updatePositions();
          return;
        }

        if (timestamp - lastUpdateRef.current >= intervalMs) {
          lastUpdateRef.current = timestamp;
          updatePositions();
        }
      },
      [updatePositions, intervalMs, adaptive, skyEngine, stel, projector]
    ),
    enabled && engineReady
  );

  // Return only visible items unless the consumer wants off-screen ones too.
  return useMemo(
    () => (includeOffscreen ? positions : positions.filter((p) => p.visible)),
    [positions, includeOffscreen]
  );
}
