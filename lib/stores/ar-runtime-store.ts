import { create } from 'zustand';
import type { ARRecoveryAction } from '@/lib/core/ar-session';
import type {
  ARCameraRuntimeState,
  ARSensorRuntimeState,
} from '@/lib/core/ar-session';
import type {
  ARLaunchAssistantCheck,
  ARLaunchAssistantOutcome,
  ARLaunchAssistantPhase,
  ARLaunchAssistantReason,
  ARLaunchAssistantRuntimeState,
} from '@/lib/core/ar-launch-assistant';
import {
  DEFAULT_AR_CAMERA_RUNTIME_STATE,
  DEFAULT_AR_SENSOR_RUNTIME_STATE,
} from '@/lib/core/ar-session';
import { DEFAULT_AR_LAUNCH_ASSISTANT_STATE } from '@/lib/core/ar-launch-assistant';

interface ARRuntimeStoreState {
  camera: ARCameraRuntimeState;
  sensor: ARSensorRuntimeState;
  launchAssistant: ARLaunchAssistantRuntimeState;
  recoveryRequestVersion: Record<ARRecoveryAction, number>;
  recoveryNoticeKey: string | null;
  recoveryActionLastFiredAt: Record<ARRecoveryAction, number>;
  setCameraRuntime: (next: Partial<ARCameraRuntimeState>) => void;
  setSensorRuntime: (next: Partial<ARSensorRuntimeState>) => void;
  openLaunchAssistant: (reason?: ARLaunchAssistantReason) => void;
  closeLaunchAssistant: () => void;
  confirmLaunchAssistantDegraded: () => void;
  markLaunchAssistantResumed: () => void;
  syncLaunchAssistant: (next: {
    phase: ARLaunchAssistantPhase;
    outcome: ARLaunchAssistantOutcome;
    checks: ARLaunchAssistantCheck[];
    summaryActions: ARRecoveryAction[];
    activeDeviceLabel: string | null;
    currentAcquisitionStage: string | null;
  }) => void;
  resetLaunchAssistant: () => void;
  resetCameraRuntime: () => void;
  resetSensorRuntime: () => void;
  requestRecoveryAction: (action: ARRecoveryAction) => void;
  setRecoveryNoticeKey: (noticeKey: string | null) => void;
  resetRecoveryState: () => void;
}

function mergeIfChanged<T extends object>(current: T, next: Partial<T>): T {
  let changed = false;
  const merged = { ...current } as T;

  for (const [key, value] of Object.entries(next) as [keyof T, T[keyof T]][]) {
    if (!areValuesEqual(current[key], value)) {
      changed = true;
      merged[key] = value;
    }
  }

  return changed ? merged : current;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => areValuesEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    if (leftEntries.length !== rightEntries.length) {
      return false;
    }

    return leftEntries.every(([key, value]) =>
      Object.prototype.hasOwnProperty.call(right, key)
      && areValuesEqual(value, right[key]),
    );
  }

  return false;
}

export const useARRuntimeStore = create<ARRuntimeStoreState>((set) => ({
  camera: DEFAULT_AR_CAMERA_RUNTIME_STATE,
  sensor: DEFAULT_AR_SENSOR_RUNTIME_STATE,
  launchAssistant: DEFAULT_AR_LAUNCH_ASSISTANT_STATE,
  recoveryRequestVersion: {
    'retry-camera': 0,
    'switch-camera': 0,
    'request-sensor-permission': 0,
    'calibrate-sensor': 0,
    'open-camera-settings': 0,
    'revert-last-known-good-profile': 0,
    'disable-ar': 0,
  },
  recoveryNoticeKey: null,
  recoveryActionLastFiredAt: {
    'retry-camera': 0,
    'switch-camera': 0,
    'request-sensor-permission': 0,
    'calibrate-sensor': 0,
    'open-camera-settings': 0,
    'revert-last-known-good-profile': 0,
    'disable-ar': 0,
  },
  setCameraRuntime: (next) =>
    set((state) => {
      const camera = mergeIfChanged(state.camera, next);
      return camera === state.camera ? state : { camera };
    }),
  setSensorRuntime: (next) =>
    set((state) => {
      const sensor = mergeIfChanged(state.sensor, next);
      return sensor === state.sensor ? state : { sensor };
    }),
  openLaunchAssistant: (reason = 'enter-ar') =>
    set((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        visible: true,
        reason,
        degradedConfirmed: false,
        requestedAt: Date.now(),
      },
    })),
  closeLaunchAssistant: () =>
    set((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        visible: false,
        phase: state.launchAssistant.phase === 'idle' ? 'idle' : 'completed',
      },
    })),
  confirmLaunchAssistantDegraded: () =>
    set((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        degradedConfirmed: true,
        visible: false,
        phase: 'completed',
      },
    })),
  markLaunchAssistantResumed: () =>
    set((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        lastResumeAt: Date.now(),
        resumeCount: state.launchAssistant.resumeCount + 1,
      },
    })),
  syncLaunchAssistant: (next) =>
    set((state) => {
      const phaseChanged = state.launchAssistant.phase !== next.phase;
      const checksChanged = JSON.stringify(state.launchAssistant.checks) !== JSON.stringify(next.checks);
      const actionsChanged = JSON.stringify(state.launchAssistant.summaryActions) !== JSON.stringify(next.summaryActions);
      const outcomeChanged = state.launchAssistant.outcome !== next.outcome;
      const deviceChanged = state.launchAssistant.activeDeviceLabel !== next.activeDeviceLabel;
      const stageChanged = state.launchAssistant.currentAcquisitionStage !== next.currentAcquisitionStage;

      if (!phaseChanged && !checksChanged && !actionsChanged && !outcomeChanged && !deviceChanged && !stageChanged) {
        return state;
      }

      return {
        launchAssistant: {
          ...state.launchAssistant,
          phase: next.phase,
          outcome: next.outcome,
          checks: next.checks,
          summaryActions: next.summaryActions,
          activeDeviceLabel: next.activeDeviceLabel,
          currentAcquisitionStage: next.currentAcquisitionStage,
          lastStepAt: phaseChanged ? Date.now() : state.launchAssistant.lastStepAt,
        },
      };
    }),
  resetLaunchAssistant: () => set({ launchAssistant: DEFAULT_AR_LAUNCH_ASSISTANT_STATE }),
  resetCameraRuntime: () => set({ camera: DEFAULT_AR_CAMERA_RUNTIME_STATE }),
  resetSensorRuntime: () => set({ sensor: DEFAULT_AR_SENSOR_RUNTIME_STATE }),
  requestRecoveryAction: (action) =>
    set((state) => ({
      recoveryRequestVersion: {
        ...state.recoveryRequestVersion,
        [action]: state.recoveryRequestVersion[action] + 1,
      },
      recoveryActionLastFiredAt: {
        ...state.recoveryActionLastFiredAt,
        [action]: Date.now(),
      },
    })),
  setRecoveryNoticeKey: (noticeKey) =>
    set({
      recoveryNoticeKey: noticeKey,
    }),
  resetRecoveryState: () =>
    set({
      recoveryRequestVersion: {
        'retry-camera': 0,
        'switch-camera': 0,
        'request-sensor-permission': 0,
        'calibrate-sensor': 0,
        'open-camera-settings': 0,
        'revert-last-known-good-profile': 0,
        'disable-ar': 0,
      },
      recoveryActionLastFiredAt: {
        'retry-camera': 0,
        'switch-camera': 0,
        'request-sensor-permission': 0,
        'calibrate-sensor': 0,
        'open-camera-settings': 0,
        'revert-last-known-good-profile': 0,
        'disable-ar': 0,
      },
      recoveryNoticeKey: null,
      launchAssistant: DEFAULT_AR_LAUNCH_ASSISTANT_STATE,
    }),
}));
