'use client';

import { useEffect, useCallback, useRef, type RefObject } from 'react';
import type A from 'aladin-lite';
import type { SelectedObjectData, ClickCoords } from '@/lib/core/types';
import { LONG_PRESS_DURATION, TOUCH_MOVE_THRESHOLD } from '@/lib/core/constants/stellarium-canvas';
import { raDecToAltAzAtTime } from '@/lib/astronomy/coordinates/transforms';
import { formatRaString, formatDecString, buildClickCoords } from '@/lib/astronomy/coordinates/format-coords';
import { searchOnlineByCoordinates } from '@/lib/services/online-search-service';
import { useMountStore, useStellariumStore } from '@/lib/stores';
import { getFoVCompat } from '@/lib/aladin/aladin-compat';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;

const logger = createLogger('aladin-events');

// Minimum angular separation (degrees) to accept a SIMBAD match as the clicked object.
// Objects farther than this from the click point are rejected.
const MAX_MATCH_SEPARATION_DEG = 0.25;

function buildSelectionTimestamp(): string {
  return new Date().toISOString();
}

function resolveCatalogLabel(object: Record<string, unknown>, data: Record<string, unknown>): string | null {
  const candidates = [
    data.catalog,
    data.catalogName,
    data.source,
    data.sourceCatalog,
    object.catalog,
    object.catalogName,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return 'Aladin catalog';
}

/** Haversine angular distance in degrees between two sky positions (both in degrees). */
function angularSeparation(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const toRad = Math.PI / 180;
  const dRa = (ra2 - ra1) * toRad;
  const dDec = (dec2 - dec1) * toRad;
  const a =
    Math.sin(dDec / 2) ** 2 +
    Math.cos(dec1 * toRad) * Math.cos(dec2 * toRad) * Math.sin(dRa / 2) ** 2;
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) / toRad;
}

interface UseAladinEventsOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
  onSelectionChange?: (selection: SelectedObjectData | null) => void;
  onContextMenu?: (e: React.MouseEvent, coords: ClickCoords | null) => void;
  onHoverChange?: (object: unknown | null) => void;
}

export function useAladinEvents({
  containerRef,
  aladinRef,
  engineReady,
  onSelectionChange,
  onContextMenu,
  onHoverChange,
}: UseAladinEventsOptions): void {
  // Guard: Aladin has no off() method, so we track the instance we registered on
  // to prevent duplicate handler registration across re-renders.
  const registeredAladinRef = useRef<AladinInstance | null>(null);

  // Touch long-press handling for context menu
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Store latest callbacks in refs so the one-time-registered handler always
  // calls the current version without needing to re-register.
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onHoverChangeRef = useRef(onHoverChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    onHoverChangeRef.current = onHoverChange;
  });

  // Flag to suppress the generic `click` handler when `objectClicked` just
  // fired.  Aladin fires both events for catalog-source clicks; without this
  // guard the `click` handler would start a redundant SIMBAD lookup.
  // Uses setTimeout (not queueMicrotask) for robustness — gives a wider window
  // in case events fire in separate microtask batches.
  const objectClickedRef = useRef(false);
  const objectClickedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Abort controller for pending SIMBAD coordinate queries — each new click
  // (or objectClicked) cancels the previous in-flight lookup.
  const simbadAbortRef = useRef<AbortController | null>(null);

  // Register Aladin event handlers exactly once per engine instance.
  // Aladin Lite v3 has no off() / removeEventListener, so we must not
  // re-register when React deps like onSelectionChange change.
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady) return;

    // Skip if we already registered on this exact instance
    if (registeredAladinRef.current === aladin) return;
    registeredAladinRef.current = aladin;

    // Object click → selection change
    aladin.on('objectClicked', (object: unknown) => {
      const cb = onSelectionChangeRef.current;
      if (!cb) return;

      // Cancel any pending SIMBAD lookup from a previous click — prevents
      // stale results from overwriting this catalog-based selection.
      simbadAbortRef.current?.abort();
      simbadAbortRef.current = null;

      // Set flag so the subsequent `click` event doesn't trigger a redundant
      // SIMBAD lookup.  Use setTimeout with 100 ms window (not queueMicrotask)
      // to handle cases where events fire in separate microtask batches.
      objectClickedRef.current = true;
      if (objectClickedTimerRef.current) clearTimeout(objectClickedTimerRef.current);
      objectClickedTimerRef.current = setTimeout(() => {
        objectClickedRef.current = false;
        objectClickedTimerRef.current = null;
      }, 100);

      if (!object || typeof object !== 'object') {
        cb(null);
        return;
      }

      try {
        const obj = object as Record<string, unknown>;
        const data = (obj.data ?? {}) as Record<string, unknown>;
        const ra = typeof obj.ra === 'number' ? obj.ra : 0;
        const dec = typeof obj.dec === 'number' ? obj.dec : 0;
        const name = typeof data.name === 'string' ? data.name : 'Unknown';

        const selection: SelectedObjectData = {
          names: [name],
          ra: formatRaString(ra),
          dec: formatDecString(dec),
          raDeg: ra,
          decDeg: dec,
          selectionSource: 'catalog',
          selectionFallback: name === 'Unknown' ? 'catalog_partial' : 'resolved',
          sourceCatalog: resolveCatalogLabel(obj, data),
          selectionTimestamp: buildSelectionTimestamp(),
          type: typeof data.type === 'string' ? data.type : undefined,
          magnitude: typeof data.mag === 'number' ? data.mag : undefined,
        };

        cb(selection);
      } catch (error) {
        logger.warn('Failed to parse clicked object', error);
        cb(null);
      }
    });

    // Click on sky → resolve clicked position (like Stellarium's click-to-select).
    // Aladin Lite v3 'click' event provides {ra, dec, x, y, isDragging}.
    aladin.on('click', (event: unknown) => {
      // Skip if objectClicked just fired — that handler already set the selection
      if (objectClickedRef.current) return;

      const cb = onSelectionChangeRef.current;
      if (!cb) return;
      if (!event || typeof event !== 'object') return;

      const e = event as Record<string, unknown>;

      // Ignore drag-end clicks
      if (e.isDragging === true) return;

      // Extract RA/Dec from click event (Aladin v3 provides them directly)
      let ra: number | undefined;
      let dec: number | undefined;

      if (typeof e.ra === 'number' && typeof e.dec === 'number') {
        ra = e.ra;
        dec = e.dec;
      } else if (typeof e.x === 'number' && typeof e.y === 'number') {
        // Fallback: convert pixel → world via aladin instance
        const worldCoords = aladin.pix2world(e.x as number, e.y as number);
        if (worldCoords) {
          [ra, dec] = worldCoords;
        }
      }

      if (ra === undefined || dec === undefined) {
        cb(null);
        return;
      }

      // Immediate coordinate-based selection (instant feedback, no waiting)
      const coordName = `${formatRaString(ra)} ${formatDecString(dec)}`;
      cb({
        names: [coordName],
        ra: formatRaString(ra),
        dec: formatDecString(dec),
        raDeg: ra,
        decDeg: dec,
        selectionSource: 'coordinate',
        selectionFallback: 'coordinate_fallback',
        sourceCatalog: null,
        selectionTimestamp: buildSelectionTimestamp(),
      });

      // Cancel any in-flight SIMBAD query from a previous click
      simbadAbortRef.current?.abort();
      const abortController = new AbortController();
      simbadAbortRef.current = abortController;

      // Adaptive search radius based on FOV-to-pixel ratio.
      // At any zoom, ~10 px click tolerance ≈ currentFov / viewWidth * 10.
      // Clamp between 0.003° (~10 arcsec) and 0.15° (9 arcmin).
      const currentFov = getFoVCompat(aladin) ?? 60;
      const viewSize = typeof aladin.getSize === 'function'
        ? aladin.getSize()
        : [800, 600];
      const viewWidth = Array.isArray(viewSize) ? (viewSize[0] as number) : 800;
      const pixelScale = currentFov / viewWidth; // degrees per pixel
      const clickTolerancePx = 12;
      const searchRadius = Math.max(0.003, Math.min(0.15, pixelScale * clickTolerancePx));

      // Async SIMBAD lookup to enrich the selection with object name/type/mag
      searchOnlineByCoordinates(
        { ra, dec, radius: searchRadius },
        { sources: ['simbad'], limit: 3, timeout: 6000, signal: abortController.signal }
      )
        .then((response) => {
          // Bail if this query was superseded
          if (abortController.signal.aborted) return;

          // Find the closest result that is within an acceptable angular
          // distance from the click point.
          const maxSep = Math.min(MAX_MATCH_SEPARATION_DEG, searchRadius * 2);
          let best: (typeof response.results)[number] | undefined;
          let bestDist = Infinity;
          for (const r of response.results) {
            const d = angularSeparation(ra!, dec!, r.ra, r.dec);
            if (d < bestDist && d <= maxSep) {
              bestDist = d;
              best = r;
            }
          }

          if (!best) return; // No close-enough object — keep coordinate selection

          const enriched: SelectedObjectData = {
            names: best.alternateNames
              ? [best.name, ...best.alternateNames]
              : [best.name],
            ra: best.raString ?? formatRaString(best.ra),
            dec: best.decString ?? formatDecString(best.dec),
            raDeg: best.ra,
            decDeg: best.dec,
            selectionSource: 'enriched',
            selectionFallback: 'resolved',
            sourceCatalog: 'SIMBAD',
            selectionTimestamp: buildSelectionTimestamp(),
            type: best.type !== 'Unknown' ? best.type : undefined,
            magnitude: best.magnitude,
          };

          // Only update if the callback ref is still alive
          onSelectionChangeRef.current?.(enriched);
          logger.debug(
            `Resolved click → ${best.name} (${best.type}, dist=${bestDist.toFixed(4)}°)`
          );
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          logger.debug('SIMBAD coordinate lookup failed (keeping coordinate selection)', err);
        });
    });

    // Position changed → update store view direction in real-time (replaces polling)
    const D2R = Math.PI / 180;
    aladin.on('positionChanged', (position: unknown) => {
      if (!position || typeof position !== 'object') return;
      const pos = position as Record<string, unknown>;
      const ra = typeof pos.ra === 'number' ? pos.ra : 0;
      const dec = typeof pos.dec === 'number' ? pos.dec : 0;
      const location = useMountStore.getState().profileInfo.AstrometrySettings;
      const hasValidLocation = Number.isFinite(location.Latitude) && Number.isFinite(location.Longitude);
      let altDeg = Number.NaN;
      let azDeg = Number.NaN;
      if (hasValidLocation) {
        const altAz = raDecToAltAzAtTime(
          ra,
          dec,
          location.Latitude,
          location.Longitude,
          new Date()
        );
        altDeg = altAz.altitude;
        azDeg = altAz.azimuth;
      }
      useStellariumStore.setState({
        viewDirection: {
          ra: ra * D2R,
          dec: dec * D2R,
          alt: altDeg * D2R,
          az: azDeg * D2R,
        },
      });
    });

    // Object hover → lightweight tooltip feedback
    aladin.on('objectHovered', (object: unknown) => {
      if (!object || typeof object !== 'object') return;
      const obj = object as Record<string, unknown>;
      const data = (obj.data ?? {}) as Record<string, unknown>;
      const name = typeof data.name === 'string' ? data.name : '';
      if (name) {
        logger.debug(`Hovered: ${name}`);
      }
      onHoverChangeRef.current?.(object);
    });

    aladin.on('objectHoveredStop', () => {
      onHoverChangeRef.current?.(null);
    });

    return () => {
      // On unmount, clear the tracked instance so a new mount can re-register
      registeredAladinRef.current = null;
      // Cancel any pending SIMBAD query
      simbadAbortRef.current?.abort();
      if (objectClickedTimerRef.current) clearTimeout(objectClickedTimerRef.current);
    };
  }, [aladinRef, engineReady]);

  // Right-click context menu (mouse)
  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      const aladin = aladinRef.current;
      if (!aladin || !onContextMenu) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const worldCoords = aladin.pix2world(x, y);
      if (!worldCoords) {
        onContextMenu(e as unknown as React.MouseEvent, null);
        return;
      }

      const [ra, dec] = worldCoords;
      onContextMenu(e as unknown as React.MouseEvent, buildClickCoords(ra, dec));
    },
    [aladinRef, containerRef, onContextMenu]
  );

  // Touch long-press for context menu (mobile)
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      touchTimerRef.current = setTimeout(() => {
        const aladin = aladinRef.current;
        if (!aladin || !onContextMenu) return;

        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const worldCoords = aladin.pix2world(x, y);
        if (!worldCoords) return;

        const [ra, dec] = worldCoords;
        const syntheticEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => {},
        } as unknown as React.MouseEvent;

        onContextMenu(syntheticEvent, buildClickCoords(ra, dec));
      }, LONG_PRESS_DURATION);
    },
    [aladinRef, containerRef, onContextMenu]
  );

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchStartPosRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  // Register DOM event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !engineReady) return;

    container.addEventListener('contextmenu', handleContextMenu);
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
      }
    };
  }, [containerRef, engineReady, handleContextMenu, handleTouchStart, handleTouchMove, handleTouchEnd]);
}
