'use client';

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import { useStellariumStore, useSettingsStore } from '@/lib/stores';
import type { StellariumEngine } from '@/lib/core/types';

// Import from lib modules
import { DEFAULT_FOV } from '@/lib/core/constants/fov';
import { fovToDeg, getEffectiveDpr } from '@/lib/core/stellarium-canvas-utils';
import type { StellariumCanvasRef, StellariumCanvasProps } from '@/types/stellarium-canvas';
import {
  useClickCoordinates,
  useStellariumZoom,
  useStellariumEvents,
  useObserverSync,
  useSettingsSync,
  useStellariumLoader,
  useStellariumCalendar,
  useStellariumFonts,
} from '@/lib/hooks/stellarium';
import { LoadingOverlay } from './components';
import { LongPressIndicator } from './components/long-press-indicator';

// Re-export types for external consumers
export type { StellariumCanvasRef, StellariumCanvasProps } from '@/types/stellarium-canvas';

/**
 * StellariumCanvas - Main star map visualization component
 * 
 * This component integrates the Stellarium Web Engine for interactive sky visualization.
 * It handles:
 * - Engine loading and initialization (WASM)
 * - Mouse/touch interactions (zoom, pan, context menu)
 * - Observer location sync from profile
 * - Settings synchronization
 * - Selection change events
 */
export const StellariumCanvas = forwardRef<StellariumCanvasRef, StellariumCanvasProps>(
  function StellariumCanvas({ onSelectionChange, onFovChange, onContextMenu }, ref) {
    type EngineEventName = 'click' | 'rectSelection';
    type EngineEventCallback = (event: unknown) => void;

    // ============================================================================
    // Refs
    // ============================================================================
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stelRef = useRef<StellariumEngine | null>(null);
    const boundEngineRef = useRef<StellariumEngine | null>(null);
    const engineEventListenersRef = useRef<Record<EngineEventName, Set<EngineEventCallback>>>({
      click: new Set(),
      rectSelection: new Set(),
    });
    const startLoadingRef = useRef<() => Promise<void>>(async () => {});

    // ============================================================================
    // Store Actions
    // ============================================================================
    const setStel = useStellariumStore((state) => state.setStel);
    const setActiveEngine = useStellariumStore((state) => state.setActiveEngine);
    const setCanvasEl = useStellariumStore((state) => state.setCanvasEl);

    // Expose the engine canvas so overlays can forward drags into the engine.
    useEffect(() => {
      setCanvasEl(canvasRef.current);
      return () => setCanvasEl(null);
    }, [setCanvasEl]);

    // ============================================================================
    // Hooks
    // ============================================================================
    
    // Click coordinates calculation
    const { getClickCoordinates } = useClickCoordinates(stelRef, canvasRef);

    // Engine loading and initialization
    const {
      loadingState,
      engineReady,
      startLoading,
      handleRetry,
      reloadEngine,
    } = useStellariumLoader({
      containerRef,
      canvasRef,
      stelRef,
      onSelectionChange,
      onFovChange,
    });

    useEffect(() => {
      startLoadingRef.current = startLoading;
    }, [startLoading]);

    // Zoom functionality
    const {
      zoomIn,
      zoomOut,
      setFov,
    } = useStellariumZoom({
      stelRef,
      canvasRef,
      // Container-level wheel handling: also works over DOM overlays (markers)
      // and suppresses the engine's legacy double-zoom.
      containerRef,
      onFovChange,
    });

    // Long-press progress feedback (mobile context menu affordance)
    const [longPressPosition, setLongPressPosition] = useState<{ x: number; y: number } | null>(null);

    // Right-click context menu and touch events
    useStellariumEvents({
      containerRef,
      getClickCoordinates,
      onContextMenu,
      onLongPressStateChange: setLongPressPosition,
    });

    // Observer location sync from profile
    useObserverSync(stelRef);

    // Settings synchronization with debouncing
    useSettingsSync(stelRef, engineReady);

    const { runCalendar } = useStellariumCalendar(stelRef);
    const { setEngineFont } = useStellariumFonts(stelRef);

    const bindEngineEvents = useCallback((stel: StellariumEngine) => {
      if (boundEngineRef.current === stel || !stel.on) return;

      stel.on('click', (event) => {
        for (const callback of engineEventListenersRef.current.click) {
          callback(event);
        }
      });
      stel.on('rectSelection', (event) => {
        for (const callback of engineEventListenersRef.current.rectSelection) {
          callback(event);
        }
      });
      boundEngineRef.current = stel;
    }, []);

    const onEngineEvent = useCallback((event: EngineEventName, callback: EngineEventCallback) => {
      engineEventListenersRef.current[event].add(callback);
      if (stelRef.current) {
        bindEngineEvents(stelRef.current);
      }
      return () => {
        engineEventListenersRef.current[event].delete(callback);
      };
    }, [bindEngineEvents]);

    useEffect(() => {
      if (engineReady && stelRef.current) {
        bindEngineEvents(stelRef.current);

        // Restore saved view state from engine switch
        const { savedViewState, clearSavedViewState, setViewDirection: restoreDir } = useStellariumStore.getState();
        if (savedViewState && restoreDir) {
          restoreDir(savedViewState.raDeg, savedViewState.decDeg);
          stelRef.current.core.fov = savedViewState.fov * (Math.PI / 180);
          clearSavedViewState();
        }
      }
    }, [engineReady, bindEngineEvents]);

    // ============================================================================
    // Export & Navigation
    // ============================================================================
    const exportImage = useCallback(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    }, []);

    const gotoObject = useCallback((name: string) => {
      const stel = stelRef.current;
      if (!stel) return;
      const obj = stel.getObj(name) ?? stel.getObj(`NAME ${name}`);
      if (obj) {
        stel.core.selection = obj;
        stel.pointAndLock(obj, 1.0);
      }
    }, []);

    // ============================================================================
    // Engine Status
    // ============================================================================
    const getEngineStatus = useCallback(() => {
      return {
        isLoading: loadingState.isLoading,
        hasError: loadingState.errorMessage !== null,
        isReady: engineReady && stelRef.current !== null,
      };
    }, [loadingState.isLoading, loadingState.errorMessage, engineReady]);

    // ============================================================================
    // Expose Methods via Ref
    // ============================================================================
    useImperativeHandle(ref, () => ({
      zoomIn,
      zoomOut,
      setFov,
      getFov: () => {
        return stelRef.current ? fovToDeg(stelRef.current.core.fov) : DEFAULT_FOV;
      },
      getClickCoordinates,
      reloadEngine,
      getEngineStatus,
      getEngine: () => stelRef.current,
      onEngineEvent,
      setEngineFont,
      runCalendar,
      exportImage,
      gotoObject,
    }), [zoomIn, zoomOut, setFov, getClickCoordinates, reloadEngine, getEngineStatus, onEngineEvent, setEngineFont, runCalendar, exportImage, gotoObject]);

    // ============================================================================
    // Effect: Start Loading on Mount
    // ============================================================================
    useEffect(() => {
      const engineEventListeners = engineEventListenersRef.current;
      let isDisposed = false;
      let hasStarted = false;

      const kickOffLoading = () => {
        if (isDisposed || hasStarted) return;
        hasStarted = true;
        void startLoadingRef.current();
      };

      setActiveEngine('stellarium');
      // Start immediately; keep a short timeout fallback in case runtime scheduling is delayed.
      kickOffLoading();
      const fallbackTimer = window.setTimeout(kickOffLoading, 120);

      return () => {
        isDisposed = true;
        window.clearTimeout(fallbackTimer);
        // Cleanup on unmount
        stelRef.current = null;
        setStel(null);
        boundEngineRef.current = null;
        engineEventListeners.click.clear();
        engineEventListeners.rectSelection.clear();
        // Clear helpers to prevent stale closures when switching engines
        const { setHelpers } = useStellariumStore.getState();
        setHelpers({ getCurrentViewDirection: null, setViewDirection: null });
      };
    }, [setStel, setActiveEngine]);

    // ============================================================================
    // Effect: ResizeObserver for dynamic canvas resize
    // ============================================================================
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      let rafId: number | null = null;

      const observer = new ResizeObserver(() => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const rect = container.getBoundingClientRect();
          const renderQuality = useSettingsStore.getState().performance?.renderQuality ?? 'high';
          const dpr = getEffectiveDpr(renderQuality);
          // Keep the engine's per-frame resize check on the same DPR, or the
          // two would resize the canvas back and forth every frame.
          if (stelRef.current) {
            stelRef.current.__skymapDpr = dpr;
          }
          const newWidth = Math.round(rect.width * dpr);
          const newHeight = Math.round(rect.height * dpr);
          if (canvas.width !== newWidth || canvas.height !== newHeight) {
            canvas.width = newWidth;
            canvas.height = newHeight;
          }
          rafId = null;
        });
      });

      observer.observe(container);

      // Render-quality changes must reach the engine immediately (the
      // ResizeObserver only fires on container size changes).
      const unsubscribeQuality = useSettingsStore.subscribe((state) => {
        const stel = stelRef.current;
        if (!stel) return;
        stel.__skymapDpr = getEffectiveDpr(state.performance?.renderQuality ?? 'high');
      });

      return () => {
        observer.disconnect();
        unsubscribeQuality();
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }, []);

    // ============================================================================
    // Render
    // ============================================================================
    return (
      <div ref={containerRef} className="relative w-full h-full touch-none">
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none"
        />

        {/* Long-press progress ring (touch context-menu feedback) */}
        <LongPressIndicator position={longPressPosition} />

        {/* Loading Overlay */}
        <LoadingOverlay
          loadingState={loadingState}
          onRetry={handleRetry}
        />
      </div>
    );
  }
);


