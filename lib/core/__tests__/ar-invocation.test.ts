import {
  deriveARCameraDiagnosticSummary,
  deriveARInvocationSeed,
  shouldGuideRecoveryThroughAssistant,
} from '@/lib/core/ar-invocation';
import { DEFAULT_AR_CAMERA_RUNTIME_STATE } from '@/lib/core/ar-session';

describe('ar-invocation', () => {
  it('derives unsupported sensor seed for AR entry', () => {
    const seed = deriveARInvocationSeed({
      sensorSupported: false,
      sensorPermissionGranted: false,
      sensorCalibrationRequired: true,
    });

    expect(seed.sensorControlEnabled).toBe(false);
    expect(seed.sensorRuntime).toMatchObject({
      isSupported: false,
      isPermissionGranted: false,
      status: 'unsupported',
      calibrationRequired: true,
      source: 'none',
      error: 'Device orientation not supported',
    });
  });

  it('derives calibration-gated seed when permission is already granted', () => {
    const seed = deriveARInvocationSeed({
      sensorSupported: true,
      sensorPermissionGranted: true,
      sensorCalibrationRequired: true,
      runtimeClass: 'browser-mobile',
    });

    expect(seed.sensorControlEnabled).toBe(true);
    expect(seed.sensorRuntime).toMatchObject({
      isSupported: true,
      isPermissionGranted: true,
      status: 'calibration-required',
      calibrationRequired: true,
    });
  });

  it('defaults desktop entry to camera-first even when orientation permissions look granted', () => {
    const seed = deriveARInvocationSeed({
      sensorSupported: true,
      sensorPermissionGranted: true,
      sensorCalibrationRequired: false,
      runtimeClass: 'tauri-desktop',
    });

    expect(seed.sensorControlEnabled).toBe(false);
    expect(seed.sensorRuntime).toMatchObject({
      isSupported: false,
      isPermissionGranted: false,
      status: 'unsupported',
      calibrationRequired: false,
      source: 'none',
      error: 'Desktop AR defaults to camera-first mode until sensor data is confirmed.',
    });
  });

  it('routes active recovery actions back through guided assistant', () => {
    expect(shouldGuideRecoveryThroughAssistant('retry-camera')).toBe(true);
    expect(shouldGuideRecoveryThroughAssistant('switch-camera')).toBe(true);
    expect(shouldGuideRecoveryThroughAssistant('request-sensor-permission')).toBe(true);
    expect(shouldGuideRecoveryThroughAssistant('calibrate-sensor')).toBe(true);
    expect(shouldGuideRecoveryThroughAssistant('revert-last-known-good-profile')).toBe(true);
    expect(shouldGuideRecoveryThroughAssistant('open-camera-settings')).toBe(false);
    expect(shouldGuideRecoveryThroughAssistant('disable-ar')).toBe(false);
  });

  it('derives a shared diagnostics summary for remembered-plan camera recovery', () => {
    const summary = deriveARCameraDiagnosticSummary({
      ...DEFAULT_AR_CAMERA_RUNTIME_STATE,
      acquisitionDiagnostics: {
        ...DEFAULT_AR_CAMERA_RUNTIME_STATE.acquisitionDiagnostics,
        currentStage: 'remembered-device',
        lastFailureStage: 'requested-facing-mode-safe',
        usedRememberedPlan: true,
        activeDevice: {
          deviceId: 'cam-back',
          label: 'Back Camera',
          groupId: 'g1',
        },
      },
    });

    expect(summary.deviceLabel).toBe('Back Camera');
    expect(summary.currentStage).toBe('remembered-device');
    expect(summary.lastFailureStage).toBe('requested-facing-mode-safe');
    expect(summary.usedRememberedPlan).toBe(true);
  });
});
