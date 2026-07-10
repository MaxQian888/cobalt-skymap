/**
 * System Stats Hook
 * 
 * Tracks system performance metrics: FPS, network status, memory usage.
 * Extracted from system-status-indicator component.
 */

import { useState, useEffect } from 'react';
import { isTauri } from '@/lib/tauri/app-control-api';

export interface SystemStats {
  online: boolean;
  memoryUsage: number | null;
  fps: number | null;
}

export interface UseSystemStatsReturn extends SystemStats {
  isTauriEnv: boolean;
}

/**
 * Hook to track system performance statistics.
 * - FPS counter via requestAnimationFrame
 * - Online/offline network status
 * - JS heap memory usage (Chrome/Electron only)
 * - Tauri environment detection
 */
export function useSystemStats(): UseSystemStatsReturn {
  const [stats, setStats] = useState<SystemStats>({
    online: true, // Default to true for SSR, sync actual value in useEffect
    memoryUsage: null,
    fps: null,
  });
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  // Update FPS
  useEffect(() => {
    let animationId: number;
    let frames = 0;
    let lastTime = Date.now();

    const updateFps = () => {
      frames++;
      const now = Date.now();

      if (now - lastTime >= 1000) {
        setStats(prev => ({ ...prev, fps: frames }));
        frames = 0;
        lastTime = now;
      }

      animationId = requestAnimationFrame(updateFps);
    };

    animationId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Check online status
  useEffect(() => {
    // Sync actual online status after hydration
    // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving sync timing
    queueMicrotask(() => {
      setStats(prev => ({ ...prev, online: navigator.onLine }));
    });

    const handleOnline = () => setStats(prev => ({ ...prev, online: true }));
    const handleOffline = () => setStats(prev => ({ ...prev, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check memory usage (if available)
  useEffect(() => {
    // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving mount timing
    queueMicrotask(() => {
      setIsTauriEnv(isTauri());
    });

    const updateMemory = () => {
      // @ts-expect-error - performance.memory is non-standard but available in Chrome/Electron
      if (performance.memory) {
        // @ts-expect-error - usedJSHeapSize is Chrome-specific
        const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        setStats(prev => ({ ...prev, memoryUsage: usedMB }));
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    ...stats,
    isTauriEnv,
  };
}
