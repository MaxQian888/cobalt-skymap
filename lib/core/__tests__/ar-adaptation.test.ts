import { createConservativeARCameraCapabilities } from '@/lib/core/ar-camera-profile';
import { deriveARAdaptationContext, deriveARSessionCameraDefaults } from '@/lib/core/ar-adaptation';

describe('ar-adaptation', () => {
  it('classifies narrow phone portrait as compact touch-oriented AR', () => {
    const context = deriveARAdaptationContext({
      viewportWidth: 390,
      viewportHeight: 844,
      safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 },
      runtimeKind: 'browser',
      cameraSupported: true,
      capabilityMap: createConservativeARCameraCapabilities(),
      sensorSupported: true,
      sensorPermissionGranted: true,
      sensorStatus: 'active',
    });

    expect(context.runtimeClass).toBe('browser-mobile');
    expect(context.layoutTier).toBe('phone-compact');
    expect(context.controlDensity).toBe('compact');
    expect(context.assistantMode).toBe('edge-sheet');
    expect(context.recoveryMode).toBe('compact-strip');
    expect(context.sensorPath).toBe('sensor-primary');
  });

  it('classifies sensor-limited Tauri runtime as camera-first desktop AR', () => {
    const context = deriveARAdaptationContext({
      viewportWidth: 1440,
      viewportHeight: 900,
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
      runtimeKind: 'tauri',
      cameraSupported: true,
      capabilityMap: createConservativeARCameraCapabilities(),
      sensorSupported: false,
      sensorPermissionGranted: false,
      sensorStatus: 'unsupported',
    });

    expect(context.runtimeClass).toBe('tauri-desktop');
    expect(context.layoutTier).toBe('desktop');
    expect(context.assistantMode).toBe('floating-card');
    expect(context.sensorPath).toBe('camera-primary');
  });

  it('classifies tablet portrait as expanded mobile AR without desktop fallback', () => {
    const context = deriveARAdaptationContext({
      viewportWidth: 820,
      viewportHeight: 1180,
      safeAreaInsets: { top: 20, right: 0, bottom: 20, left: 0 },
      runtimeKind: 'browser',
      cameraSupported: true,
      capabilityMap: createConservativeARCameraCapabilities(),
      sensorSupported: true,
      sensorPermissionGranted: true,
      sensorStatus: 'active',
    });

    expect(context.runtimeClass).toBe('browser-mobile');
    expect(context.layoutTier).toBe('tablet');
    expect(context.assistantMode).toBe('floating-card');
    expect(context.recoveryMode).toBe('floating-card');
    expect(context.sensorPath).toBe('sensor-primary');
  });

  it('treats short landscape viewport as reduced compact layout', () => {
    const context = deriveARAdaptationContext({
      viewportWidth: 844,
      viewportHeight: 360,
      safeAreaInsets: { top: 0, right: 12, bottom: 21, left: 12 },
      runtimeKind: 'browser',
      cameraSupported: true,
      capabilityMap: {
        ...createConservativeARCameraCapabilities(),
        resolutionTiers: ['auto', '720p'],
        fpsRange: { min: 15, max: 24 },
        supportsTorch: false,
      },
      sensorSupported: true,
      sensorPermissionGranted: false,
      sensorStatus: 'permission-required',
    });

    expect(context.isLandscape).toBe(true);
    expect(context.isViewportReduced).toBe(true);
    expect(context.layoutTier).toBe('phone-compact');
    expect(context.capabilityTier).toBe('limited');
    expect(context.cameraControlMode).toBe('compact-strip');
  });

  it('derives conservative session camera defaults for limited capability tiers', () => {
    const context = deriveARAdaptationContext({
      viewportWidth: 844,
      viewportHeight: 360,
      safeAreaInsets: { top: 0, right: 12, bottom: 21, left: 12 },
      runtimeKind: 'browser',
      cameraSupported: true,
      capabilityMap: {
        ...createConservativeARCameraCapabilities(),
        resolutionTiers: ['auto', '720p'],
        fpsRange: { min: 15, max: 24 },
        supportsTorch: false,
      },
      sensorSupported: true,
      sensorPermissionGranted: false,
      sensorStatus: 'permission-required',
    });

    const defaults = deriveARSessionCameraDefaults(context);

    expect(defaults.resolutionTier).toBe('720p');
    expect(defaults.targetFps).toBe(24);
    expect(defaults.torchPreferred).toBe(false);
  });
});
