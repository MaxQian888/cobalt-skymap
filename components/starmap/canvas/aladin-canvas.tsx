'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type A from 'aladin-lite';
import { useStellariumStore } from '@/lib/stores';
import { DEFAULT_FOV, MIN_FOV, MAX_FOV } from '@/lib/core/constants/fov';
import { ALADIN_ZOOM_IN_FACTOR, ALADIN_ZOOM_OUT_FACTOR } from '@/lib/core/constants/aladin-canvas';
import { buildClickCoords } from '@/lib/astronomy/coordinates/format-coords';
import type { SkyMapCanvasRef, SkyMapCanvasProps } from '@/lib/core/types/sky-engine';
import { destroyAladinCompat, exportViewCompat, getFoVCompat, setFoVCompat } from '@/lib/aladin/aladin-compat';
import {
  useAladinCatalogs,
  useAladinCatalogHips,
  useAladinEvents,
  useAladinFits,
  useAladinLayers,
  useAladinLoader,
  useAladinMOC,
  useAladinOverlays,
  useAladinSettingsSync,
} from '@/lib/hooks/aladin';
import { HoverObjectLabel, LoadingOverlay } from './components';

type AladinInstance = ReturnType<typeof A.aladin>;

/**
 * AladinCanvas - Aladin Lite sky map visualization component
 *
 * Alternative sky engine using Aladin Lite v3 (HiPS survey viewer).
 * Implements the same SkyMapCanvasRef interface as StellariumCanvas.
 */
export const AladinCanvas = forwardRef<SkyMapCanvasRef, SkyMapCanvasProps>(
  function AladinCanvas({ onSelectionChange, onFovChange, onContextMenu }, ref) {
    // ========================================================================
    // Refs
    // ========================================================================
    const containerRef = useRef<HTMLDivElement>(null);
    const aladinRef = useRef<AladinInstance | null>(null);

    // ========================================================================
    // Store Actions
    // ========================================================================
    const setAladin = useStellariumStore((state) => state.setAladin);
    const setActiveEngine = useStellariumStore((state) => state.setActiveEngine);

    // ========================================================================
    // Hooks
    // ========================================================================

    const {
      loadingState,
      engineReady,
      startLoading,
      handleRetry,
      reloadEngine,
    } = useAladinLoader({
      containerRef,
      aladinRef,
      onFovChange,
    });

    // ========================================================================
    // Hover Tooltip State
    // ========================================================================
    const [hoverInfo, setHoverInfo] = useState<{ name: string; x: number; y: number } | null>(null);

    const handleHoverChange = useCallback((object: unknown | null) => {
      if (!object || typeof object !== 'object') {
        setHoverInfo(null);
        return;
      }
      const obj = object as Record<string, unknown>;
      const data = (obj.data ?? {}) as Record<string, unknown>;
      const name = typeof data.name === 'string' ? data.name : '';
      if (!name) { setHoverInfo(null); return; }

      const aladin = aladinRef.current;
      if (!aladin) { setHoverInfo(null); return; }
      const ra = typeof obj.ra === 'number' ? obj.ra : 0;
      const dec = typeof obj.dec === 'number' ? obj.dec : 0;
      const pix = aladin.world2pix(ra, dec);
      if (pix) {
        setHoverInfo({ name, x: pix[0], y: pix[1] });
      }
    }, []);

    useAladinEvents({
      containerRef,
      aladinRef,
      engineReady,
      onSelectionChange,
      onContextMenu,
      onHoverChange: handleHoverChange,
    });

    // ========================================================================
    // Settings Sync
    // ========================================================================
    useAladinSettingsSync(aladinRef, engineReady);

    // ========================================================================
    // Catalog Overlays
    // ========================================================================
    useAladinCatalogs({ aladinRef, engineReady });

    // Progressive catalog HiPS (Gaia DR3, etc.) selected via the survey store
    useAladinCatalogHips({ aladinRef, engineReady });

    // HiPS/FITS image layers
    useAladinLayers({ aladinRef, engineReady });
    useAladinFits({ aladinRef, engineReady });

    // MOC layers
    useAladinMOC({ aladinRef, engineReady });

    // ========================================================================
    // Graphic Overlays (markers, targets)
    // ========================================================================
    useAladinOverlays({ aladinRef, engineReady });

    // ========================================================================
    // Engine Status
    // ========================================================================
    const getEngineStatus = useCallback(() => ({
      isLoading: loadingState.isLoading,
      hasError: loadingState.errorMessage !== null,
      isReady: engineReady && aladinRef.current !== null,
    }), [loadingState.isLoading, loadingState.errorMessage, engineReady]);

    // ========================================================================
    // Zoom
    // ========================================================================
    const zoomIn = useCallback(() => {
      const aladin = aladinRef.current;
      if (!aladin) return;
      const fov = getFoVCompat(aladin) ?? DEFAULT_FOV;
      const newFov = Math.max(MIN_FOV, fov * ALADIN_ZOOM_IN_FACTOR);
      setFoVCompat(aladin, newFov);
      onFovChange?.(newFov);
    }, [onFovChange]);

    const zoomOut = useCallback(() => {
      const aladin = aladinRef.current;
      if (!aladin) return;
      const fov = getFoVCompat(aladin) ?? DEFAULT_FOV;
      const newFov = Math.min(MAX_FOV, fov * ALADIN_ZOOM_OUT_FACTOR);
      setFoVCompat(aladin, newFov);
      onFovChange?.(newFov);
    }, [onFovChange]);

    const setFov = useCallback((fov: number) => {
      const aladin = aladinRef.current;
      if (!aladin) return;
      const clampedFov = Math.max(MIN_FOV, Math.min(MAX_FOV, fov));
      setFoVCompat(aladin, clampedFov);
      onFovChange?.(clampedFov);
    }, [onFovChange]);

    // ========================================================================
    // Click Coordinates
    // ========================================================================
    const getClickCoordinates = useCallback((clientX: number, clientY: number) => {
      const aladin = aladinRef.current;
      const container = containerRef.current;
      if (!aladin || !container) return null;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const worldCoords = aladin.pix2world(x, y);
      if (!worldCoords) return null;

      const [ra, dec] = worldCoords;
      return buildClickCoords(ra, dec);
    }, []);

    // ========================================================================
    // Export & Navigation
    // ========================================================================
    const exportImage = useCallback(async () => {
      const aladin = aladinRef.current;
      if (!aladin) return null;
      return exportViewCompat(aladin, { format: 'image/png' });
    }, []);

    const gotoObject = useCallback((name: string) => {
      const aladin = aladinRef.current;
      if (!aladin || typeof aladin.gotoObject !== 'function') return;
      aladin.gotoObject(name, {
        success: () => {
          if (typeof aladin.adjustFovForObject === 'function') {
            aladin.adjustFovForObject(name);
          }
        },
      });
    }, []);

    // ========================================================================
    // Expose Methods via Ref
    // ========================================================================
    useImperativeHandle(ref, () => ({
      zoomIn,
      zoomOut,
      setFov,
      getFov: () => {
        return getFoVCompat(aladinRef.current) ?? DEFAULT_FOV;
      },
      getClickCoordinates,
      reloadEngine,
      getEngineStatus,
      exportImage,
      gotoObject,
    }), [zoomIn, zoomOut, setFov, getClickCoordinates, reloadEngine, getEngineStatus, exportImage, gotoObject]);

    // ========================================================================
    // Effect: Start Loading on Mount
    // ========================================================================
    useEffect(() => {
      setActiveEngine('aladin');
      startLoading();

      return () => {
        destroyAladinCompat(aladinRef.current);
        aladinRef.current = null;
        setAladin(null);
        // Clear helpers to prevent stale closures when switching engines
        const { setHelpers } = useStellariumStore.getState();
        setHelpers({ getCurrentViewDirection: null, setViewDirection: null });
      };
    }, [startLoading, setAladin, setActiveEngine]);

    // Effect: Store aladin instance when ready + restore saved view state
    useEffect(() => {
      if (engineReady && aladinRef.current) {
        setAladin(aladinRef.current);

        // Restore saved view state from engine switch
        const { savedViewState, clearSavedViewState } = useStellariumStore.getState();
        if (savedViewState) {
          const aladin = aladinRef.current;
          if (typeof aladin.gotoRaDec === 'function') {
            aladin.gotoRaDec(savedViewState.raDeg, savedViewState.decDeg);
          }
          setFoVCompat(aladin, savedViewState.fov);
          onFovChange?.(savedViewState.fov);
          clearSavedViewState();
        }
      }
    }, [engineReady, setAladin, onFovChange]);

    // ========================================================================
    // Render
    // ========================================================================
    return (
      <div ref={containerRef} className="relative w-full h-full touch-none" id="aladin-lite-container">
        {/* Aladin Lite renders its own canvas elements inside this div */}

        {/* Hover Tooltip */}
        {hoverInfo && (
          <HoverObjectLabel name={hoverInfo.name} x={hoverInfo.x} y={hoverInfo.y} />
        )}

        {/* Loading Overlay */}
        <LoadingOverlay
          loadingState={loadingState}
          onRetry={handleRetry}
        />
      </div>
    );
  }
);
