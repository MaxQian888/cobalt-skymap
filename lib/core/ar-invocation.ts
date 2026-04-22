import type { ARLaunchAssistantReason } from '@/lib/core/ar-launch-assistant';
import type { ARAdaptationRuntimeClass } from '@/lib/core/ar-adaptation';
import type {
  ARCameraRuntimeState,
  ARRecoveryAction,
  ARSensorRuntimeState,
} from '@/lib/core/ar-session';

export interface ARInvocationSeedInput {
  sensorSupported: boolean;
  sensorPermissionGranted: boolean;
  sensorCalibrationRequired: boolean;
  runtimeClass?: ARAdaptationRuntimeClass;
}

export interface ARInvocationSeed {
  sensorControlEnabled: boolean;
  sensorRuntime: Pick<
    ARSensorRuntimeState,
    | 'isSupported'
    | 'isPermissionGranted'
    | 'status'
    | 'calibrationRequired'
    | 'degradedReason'
    | 'source'
    | 'accuracyDeg'
    | 'error'
  >;
}

export interface ARCameraDiagnosticSummary {
  deviceLabel: string | null;
  currentStage: string | null;
  lastFailureStage: string | null;
  usedRememberedPlan: boolean;
}

export function deriveARInvocationSeed(
  input: ARInvocationSeedInput,
): ARInvocationSeed {
  const runtimeClass = input.runtimeClass ?? 'browser-mobile';

  if (!input.sensorSupported) {
    return {
      sensorControlEnabled: false,
      sensorRuntime: {
        isSupported: false,
        isPermissionGranted: false,
        status: 'unsupported',
        calibrationRequired: input.sensorCalibrationRequired,
        degradedReason: null,
        source: 'none',
        accuracyDeg: null,
        error: 'Device orientation not supported',
      },
    };
  }

  if (runtimeClass !== 'browser-mobile') {
    return {
      sensorControlEnabled: false,
      sensorRuntime: {
        isSupported: false,
        isPermissionGranted: false,
        status: 'unsupported',
        calibrationRequired: input.sensorCalibrationRequired,
        degradedReason: null,
        source: 'none',
        accuracyDeg: null,
        error: 'Desktop AR defaults to camera-first mode until sensor data is confirmed.',
      },
    };
  }

  if (input.sensorPermissionGranted) {
    return {
      sensorControlEnabled: true,
      sensorRuntime: {
        isSupported: true,
        isPermissionGranted: true,
        status: input.sensorCalibrationRequired ? 'calibration-required' : 'idle',
        calibrationRequired: input.sensorCalibrationRequired,
        degradedReason: null,
        source: 'none',
        accuracyDeg: null,
        error: null,
      },
    };
  }

  return {
    sensorControlEnabled: false,
    sensorRuntime: {
      isSupported: true,
      isPermissionGranted: false,
      status: 'permission-required',
      calibrationRequired: input.sensorCalibrationRequired,
      degradedReason: null,
      source: 'none',
      accuracyDeg: null,
      error: null,
    },
  };
}

export function shouldGuideRecoveryThroughAssistant(
  action: ARRecoveryAction,
): boolean {
  return (
    action === 'retry-camera' ||
    action === 'switch-camera' ||
    action === 'request-sensor-permission' ||
    action === 'calibrate-sensor' ||
    action === 'revert-last-known-good-profile'
  );
}

export function getARLaunchAssistantReason(
  reason: ARLaunchAssistantReason,
): ARLaunchAssistantReason {
  return reason;
}

export function getRecoveryAssistantReason(
  action: ARRecoveryAction,
): ARLaunchAssistantReason | null {
  if (shouldGuideRecoveryThroughAssistant(action)) {
    return 'recovery';
  }

  return null;
}

export function deriveARCameraDiagnosticSummary(
  camera: ARCameraRuntimeState,
): ARCameraDiagnosticSummary {
  return {
    deviceLabel:
      camera.acquisitionDiagnostics.activeDevice?.label ??
      camera.lastKnownGoodAcquisition?.label ??
      null,
    currentStage:
      camera.acquisitionDiagnostics.currentStage ??
      camera.lastKnownGoodAcquisition?.stage ??
      null,
    lastFailureStage: camera.acquisitionDiagnostics.lastFailureStage,
    usedRememberedPlan: camera.acquisitionDiagnostics.usedRememberedPlan,
  };
}
