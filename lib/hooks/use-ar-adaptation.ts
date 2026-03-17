'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { deriveARAdaptationContext, type ARAdaptationContext } from '@/lib/core/ar-adaptation';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { isTauri } from '@/lib/tauri/app-control-api';

const FALLBACK_VIEWPORT_WIDTH = 1024;
const FALLBACK_VIEWPORT_HEIGHT = 768;

function readSafeAreaInset(variableName: '--safe-area-top' | '--safe-area-right' | '--safe-area-bottom' | '--safe-area-left'): number {
  if (typeof window === 'undefined') return 0;

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(variableName);
  return Number.parseFloat(value) || 0;
}

function getViewportSnapshot(): string {
  const visualViewport = window.visualViewport;
  const width = Math.round(visualViewport?.width ?? window.innerWidth);
  const height = Math.round(visualViewport?.height ?? window.innerHeight);
  const top = readSafeAreaInset('--safe-area-top');
  const right = readSafeAreaInset('--safe-area-right');
  const bottom = readSafeAreaInset('--safe-area-bottom');
  const left = readSafeAreaInset('--safe-area-left');

  return `${width}x${height}|${top},${right},${bottom},${left}`;
}

function getServerSnapshot(): string {
  return `${FALLBACK_VIEWPORT_WIDTH}x${FALLBACK_VIEWPORT_HEIGHT}|0,0,0,0`;
}

function parseViewportSnapshot(snapshot: string) {
  const [viewportPart, insetPart] = snapshot.split('|');
  const [widthRaw, heightRaw] = viewportPart.split('x');
  const [topRaw, rightRaw, bottomRaw, leftRaw] = insetPart.split(',');

  return {
    viewportWidth: Number(widthRaw) || FALLBACK_VIEWPORT_WIDTH,
    viewportHeight: Number(heightRaw) || FALLBACK_VIEWPORT_HEIGHT,
    safeAreaInsets: {
      top: Number(topRaw) || 0,
      right: Number(rightRaw) || 0,
      bottom: Number(bottomRaw) || 0,
      left: Number(leftRaw) || 0,
    },
  };
}

export function useARAdaptation(): ARAdaptationContext {
  const cameraRuntime = useARRuntimeStore((state) => state.camera);
  const sensorRuntime = useARRuntimeStore((state) => state.sensor);

  const viewportSnapshot = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {};

      const handleResize = () => {
        onStoreChange();
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      window.visualViewport?.addEventListener('resize', handleResize);
      window.visualViewport?.addEventListener('scroll', handleResize);
      const bootstrapTimer = window.setTimeout(onStoreChange, 0);

      return () => {
        window.clearTimeout(bootstrapTimer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('scroll', handleResize);
      };
    },
    () => {
      if (typeof window === 'undefined') return getServerSnapshot();
      return getViewportSnapshot();
    },
    getServerSnapshot,
  );

  return useMemo(() => {
    const { viewportWidth, viewportHeight, safeAreaInsets } = parseViewportSnapshot(viewportSnapshot);

    return deriveARAdaptationContext({
      viewportWidth,
      viewportHeight,
      safeAreaInsets,
      runtimeKind: isTauri() ? 'tauri' : 'browser',
      cameraSupported: cameraRuntime.isSupported,
      capabilityMap: cameraRuntime.capabilityMap,
      sensorSupported: sensorRuntime.isSupported,
      sensorPermissionGranted: sensorRuntime.isPermissionGranted,
      sensorStatus: sensorRuntime.status,
    });
  }, [
    cameraRuntime.capabilityMap,
    cameraRuntime.isSupported,
    sensorRuntime.isPermissionGranted,
    sensorRuntime.isSupported,
    sensorRuntime.status,
    viewportSnapshot,
  ]);
}
