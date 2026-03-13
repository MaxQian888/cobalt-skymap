'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMountStore } from '@/lib/stores';
import { useDeviceStore, PRIMARY_MOUNT_DEVICE_PROFILE_ID } from '@/lib/stores/device-store';
import { mountApi } from '@/lib/tauri/mount-api';
import { isTauri } from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('mount-polling');

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 1500;

/** Number of consecutive failures before marking disconnected */
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Hook that polls mount state at a regular interval while connected.
 *
 * Responsibilities:
 * - Periodically calls `mountApi.getState()` and applies the result to the store
 * - Pauses polling when the page is not visible (`document.visibilityState`)
 * - Tracks consecutive failures and marks the mount as disconnected after threshold
 * - Cleans up on unmount
 */
export function useMountPolling(intervalMs: number = DEFAULT_POLL_INTERVAL_MS) {
  const connected = useMountStore((s) => s.mountInfo.Connected);
  const applyMountState = useMountStore((s) => s.applyMountState);
  const resetMountInfo = useMountStore((s) => s.resetMountInfo);
  const markDegraded = useDeviceStore((s) => s.markDegraded);
  const markFailed = useDeviceStore((s) => s.markFailed);
  const markConnected = useDeviceStore((s) => s.markConnected);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);
  const pollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (pollingRef.current) return; // skip if previous poll still running
    pollingRef.current = true;

    try {
      const state = await mountApi.getState();
      const hadFailures = failCountRef.current > 0;
      applyMountState(state);
      failCountRef.current = 0;
      if (state.connected && hadFailures) {
        markConnected(
          PRIMARY_MOUNT_DEVICE_PROFILE_ID,
          'health_check',
          'mount-poll-recovered',
        );
      }

      // If backend reports disconnected, sync the store
      if (!state.connected) {
        markFailed(
          PRIMARY_MOUNT_DEVICE_PROFILE_ID,
          {
            code: 'mount-disconnected',
            message: 'Mount backend reported a disconnected session.',
            recoverable: true,
          },
          'health_check',
          'mount-poll-disconnected',
        );
        resetMountInfo();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      failCountRef.current += 1;
      logger.warn('Mount poll failed', {
        attempt: failCountRef.current,
        error: message,
      });

      if (failCountRef.current < MAX_CONSECUTIVE_FAILURES) {
        markDegraded(
          PRIMARY_MOUNT_DEVICE_PROFILE_ID,
          {
            code: 'mount-poll-degraded',
            message,
            recoverable: true,
          },
          'health_check',
          'mount-polling',
        );
      } else {
        logger.error('Mount connection lost after consecutive failures', {
          failures: failCountRef.current,
        });
        markFailed(
          PRIMARY_MOUNT_DEVICE_PROFILE_ID,
          {
            code: 'mount-poll-failed',
            message,
            recoverable: true,
          },
          'health_check',
          'mount-polling',
        );
        resetMountInfo();
      }
    } finally {
      pollingRef.current = false;
    }
  }, [applyMountState, markConnected, markDegraded, markFailed, resetMountInfo]);

  useEffect(() => {
    if (!connected || !isTauri()) {
      // Stop any existing timer when disconnected
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    failCountRef.current = 0;

    const startPolling = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(poll, intervalMs);
    };

    const stopPolling = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Immediately poll once on resume, then restart interval
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Start polling immediately
    startPolling();

    // Pause/resume on visibility change
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [connected, intervalMs, poll]);
}
