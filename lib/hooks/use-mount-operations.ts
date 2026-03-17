'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import type {
  MountCommandAction,
  MountCommandFailure,
  MountTargetAction,
} from '@/lib/core/types';
import { useMountStore } from '@/lib/stores';
import { createLogger } from '@/lib/logger';
import { isTauri } from '@/lib/tauri/app-control-api';
import { mountApi } from '@/lib/tauri/mount-api';

const logger = createLogger('mount-operations');

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMountOperations() {
  const mountInfo = useMountStore((state) => state.mountInfo);
  const blockedActionReasons = useMountStore((state) => state.blockedActionReasons);
  const activeTargetAction = useMountStore((state) => state.activeTargetAction);
  const latestCommandFailure = useMountStore((state) => state.latestCommandFailure);
  const setActiveTargetAction = useMountStore((state) => state.setActiveTargetAction);
  const clearActiveTargetAction = useMountStore((state) => state.clearActiveTargetAction);
  const setLatestCommandFailure = useMountStore((state) => state.setLatestCommandFailure);
  const clearLatestCommandFailure = useMountStore((state) => state.clearLatestCommandFailure);

  const reportFailure = useCallback((action: MountCommandAction, message: string): MountCommandFailure => {
    const failure: MountCommandFailure = {
      action,
      message,
      at: new Date().toISOString(),
    };
    setLatestCommandFailure(failure);
    logger.error('Mount operation failed', failure);
    toast.error(message);
    return failure;
  }, [setLatestCommandFailure]);

  const ensureActionReady = useCallback((action: MountCommandAction) => {
    const blockedReason = blockedActionReasons[action];
    if (blockedReason) {
      return reportFailure(action, `blocked:${blockedReason}`);
    }

    if (!isTauri()) {
      return reportFailure(action, 'Mount API is only available in Tauri desktop environment');
    }

    return null;
  }, [blockedActionReasons, reportFailure]);

  const queueTargetAction = useCallback((action: Omit<MountTargetAction, 'requestedAt'>) => {
    clearLatestCommandFailure();
    setActiveTargetAction(action);
  }, [clearLatestCommandFailure, setActiveTargetAction]);

  const executeTargetAction = useCallback(async (action: MountTargetAction | null = activeTargetAction) => {
    if (!action) return null;
    const gatingFailure = ensureActionReady(action.action);
    if (gatingFailure) return gatingFailure;

    try {
      if (action.action === 'sync') {
        await mountApi.syncTo(action.ra, action.dec);
      } else {
        await mountApi.slewTo(action.ra, action.dec);
      }
      clearLatestCommandFailure();
      clearActiveTargetAction();
      return null;
    } catch (error) {
      return reportFailure(action.action, toErrorMessage(error));
    }
  }, [
    activeTargetAction,
    clearActiveTargetAction,
    clearLatestCommandFailure,
    ensureActionReady,
    reportFailure,
  ]);

  const toggleTracking = useCallback(async () => {
    const action: MountCommandAction = 'tracking';
    const gatingFailure = ensureActionReady(action);
    if (gatingFailure) return gatingFailure;

    try {
      await mountApi.setTracking(!Boolean(mountInfo.Tracking));
      clearLatestCommandFailure();
      return null;
    } catch (error) {
      return reportFailure(action, toErrorMessage(error));
    }
  }, [clearLatestCommandFailure, ensureActionReady, mountInfo.Tracking, reportFailure]);

  const togglePark = useCallback(async () => {
    const action: MountCommandAction = mountInfo.Parked ? 'unpark' : 'park';
    const gatingFailure = ensureActionReady(action);
    if (gatingFailure) return gatingFailure;

    try {
      if (mountInfo.Parked) {
        await mountApi.unpark();
      } else {
        await mountApi.park();
      }
      clearLatestCommandFailure();
      return null;
    } catch (error) {
      return reportFailure(action, toErrorMessage(error));
    }
  }, [clearLatestCommandFailure, ensureActionReady, mountInfo.Parked, reportFailure]);

  const abortSlew = useCallback(async () => {
    const action: MountCommandAction = 'abortSlew';
    const gatingFailure = ensureActionReady(action);
    if (gatingFailure) return gatingFailure;

    try {
      await mountApi.abortSlew();
      clearLatestCommandFailure();
      return null;
    } catch (error) {
      return reportFailure(action, toErrorMessage(error));
    }
  }, [clearLatestCommandFailure, ensureActionReady, reportFailure]);

  return {
    activeTargetAction,
    latestCommandFailure,
    blockedActionReasons,
    queueTargetAction,
    clearTargetAction: clearActiveTargetAction,
    executeTargetAction,
    toggleTracking,
    togglePark,
    abortSlew,
  };
}
