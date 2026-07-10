'use client';

import { useCallback, useEffect, useRef, RefObject } from 'react';
import {
  MIN_FOV,
  MAX_FOV,
  DEFAULT_FOV,
  WHEEL_ZOOM_DURATION,
  BUTTON_ZOOM_DURATION,
  SLIDER_ZOOM_DURATION,
  ZOOM_TARGET_RESET_MS,
} from '@/lib/core/constants/fov';
import { fovToRad, fovToDeg } from '@/lib/core/stellarium-canvas-utils';
import { isUiControlElement } from './use-stellarium-events';
import type { StellariumEngine } from '@/lib/core/types';

interface UseStellariumZoomOptions {
  stelRef: RefObject<StellariumEngine | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /**
   * Container to attach wheel handling to (capture phase). Preferred over the
   * canvas: it also catches wheel events over DOM overlays (markers) and lets
   * us suppress the engine's own legacy `mousewheel` zoom, which otherwise
   * double-handles every notch alongside this hook.
   */
  containerRef?: RefObject<HTMLDivElement | null>;
  onFovChange?: (fov: number) => void;
}

const clampFov = (fovDeg: number) => Math.max(MIN_FOV, Math.min(MAX_FOV, fovDeg));

/**
 * Hook for managing FOV/zoom functionality.
 *
 * All zooms route through the engine's animated `zoomTo` (a new call retargets
 * the running animation from the current FOV — last call wins), replacing the
 * previous instant `core.fov =` jumps. Wheel gestures accumulate into a target
 * FOV so rapid notches compound instead of being eaten by animation lag.
 */
export function useStellariumZoom({
  stelRef,
  canvasRef,
  containerRef,
  onFovChange,
}: UseStellariumZoomOptions) {
  // Accumulated zoom target (degrees) while a gesture is in progress.
  const zoomTargetRef = useRef<number | null>(null);
  const zoomTargetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleZoomTargetReset = useCallback(() => {
    if (zoomTargetTimerRef.current) clearTimeout(zoomTargetTimerRef.current);
    zoomTargetTimerRef.current = setTimeout(() => {
      zoomTargetRef.current = null;
    }, ZOOM_TARGET_RESET_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (zoomTargetTimerRef.current) clearTimeout(zoomTargetTimerRef.current);
    };
  }, []);

  // Helper to set FOV with proper engine update.
  // Uses the engine's smooth zoomTo when duration > 0, direct assignment otherwise.
  const setEngineFov = useCallback((fovDeg: number, duration = 0) => {
    if (!stelRef.current) return;
    const clampedFov = clampFov(fovDeg);
    const fovRad = fovToRad(clampedFov);
    if (duration > 0 && stelRef.current.zoomTo) {
      stelRef.current.zoomTo(fovRad, duration);
    } else {
      stelRef.current.core.fov = fovRad;
    }
    zoomTargetRef.current = clampedFov;
    scheduleZoomTargetReset();
    onFovChange?.(clampedFov);
  }, [stelRef, onFovChange, scheduleZoomTargetReset]);

  /** Base FOV for the next zoom step: the in-flight target, else the engine's. */
  const getBaseFov = useCallback(() => {
    if (zoomTargetRef.current != null) return zoomTargetRef.current;
    return (stelRef.current && fovToDeg(stelRef.current.core.fov)) || DEFAULT_FOV;
  }, [stelRef]);

  // Zoom in function
  const zoomIn = useCallback(() => {
    if (stelRef.current) {
      setEngineFov(getBaseFov() * 0.8, BUTTON_ZOOM_DURATION);
    }
  }, [stelRef, getBaseFov, setEngineFov]);

  // Zoom out function
  const zoomOut = useCallback(() => {
    if (stelRef.current) {
      setEngineFov(getBaseFov() * 1.25, BUTTON_ZOOM_DURATION);
    }
  }, [stelRef, getBaseFov, setEngineFov]);

  // Set specific FOV (slider/presets) — short animation so it feels immediate
  // without mixing direct writes into a possibly-running zoom animation.
  const setFov = useCallback((fov: number) => {
    setEngineFov(fov, SLIDER_ZOOM_DURATION);
  }, [setEngineFov]);

  // Get current FOV
  const getFov = useCallback(() => {
    return stelRef.current ? fovToDeg(stelRef.current.core.fov) : DEFAULT_FOV;
  }, [stelRef]);

  // Wheel zoom + engine legacy-wheel suppression.
  useEffect(() => {
    const el: HTMLElement | null = containerRef?.current ?? canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Scrollable panels/controls keep their native wheel behavior.
      if (isUiControlElement(e.target)) return;
      e.preventDefault();
      if (!stelRef.current) return;

      const base = zoomTargetRef.current
        ?? (fovToDeg(stelRef.current.core.fov) || DEFAULT_FOV);
      const target = clampFov(base * (e.deltaY > 0 ? 1.1 : 1 / 1.1));
      zoomTargetRef.current = target;
      scheduleZoomTargetReset();

      if (stelRef.current.zoomTo) {
        stelRef.current.zoomTo(fovToRad(target), WHEEL_ZOOM_DURATION);
      } else {
        stelRef.current.core.fov = fovToRad(target);
      }
      onFovChange?.(target);
    };

    // The engine registers its own legacy 'mousewheel'/'DOMMouseScroll' zoom
    // on the canvas (instant, cursor-anchored). Chromium still fires
    // 'mousewheel', so without suppression every notch is handled twice —
    // once by the engine (jump) and once here (animation).
    const suppressEngineWheel = (e: Event) => {
      if (isUiControlElement(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    el.addEventListener('mousewheel', suppressEngineWheel, { passive: false, capture: true });
    el.addEventListener('DOMMouseScroll', suppressEngineWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true });
      el.removeEventListener('mousewheel', suppressEngineWheel, { capture: true });
      el.removeEventListener('DOMMouseScroll', suppressEngineWheel, { capture: true });
    };
  }, [stelRef, canvasRef, containerRef, onFovChange, scheduleZoomTargetReset]);

  return {
    zoomIn,
    zoomOut,
    setFov,
    getFov,
    setEngineFov,
  };
}
