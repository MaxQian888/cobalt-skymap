import {
  buildARCameraConstraints,
  createConservativeARCameraCapabilities,
  DEFAULT_AR_CAMERA_PROFILE_BY_PRESET,
  hasSignificantARCameraProfileDelta,
  normalizeARCameraCapabilities,
  resolveARCameraProfileLayers,
  type ARCameraCapabilityMap,
  type ARCameraResolutionTier,
  type FacingMode,
  validateAndClampARCameraProfile,
} from '@/lib/core/ar-camera-profile';

describe('ar-camera-profile', () => {
  it('normalizes capabilities from media track data', () => {
    const track = {
      getCapabilities: () => ({
        facingMode: ['environment'],
        width: { min: 640, max: 3840 },
        height: { min: 480, max: 2160 },
        frameRate: { min: 15, max: 60 },
        zoom: { min: 1, max: 4, step: 0.1 },
        torch: true,
      }),
    } as unknown as MediaStreamTrack;

    const capabilities = normalizeARCameraCapabilities(track, {
      frameRate: true,
    } as MediaTrackSupportedConstraints);

    expect(capabilities.facingModes).toEqual(['environment']);
    expect(capabilities.resolutionTiers).toContain('4k');
    expect(capabilities.fpsRange.max).toBe(60);
    expect(capabilities.zoom?.max).toBe(4);
    expect(capabilities.supportsTorch).toBe(true);
  });

  it('clamps invalid profile values against capabilities', () => {
    const capabilities: ARCameraCapabilityMap = {
      ...createConservativeARCameraCapabilities(),
      facingModes: ['environment'] satisfies FacingMode[],
      resolutionTiers: ['auto', '720p'] satisfies ARCameraResolutionTier[],
      fpsRange: { min: 15, max: 24 },
      zoom: { min: 1, max: 2 },
      supportsTorch: false,
    };

    const result = validateAndClampARCameraProfile(
      {
        ...DEFAULT_AR_CAMERA_PROFILE_BY_PRESET.quality,
        facingMode: 'user',
        resolutionTier: '4k',
        targetFps: 60,
        zoomLevel: 4,
        torchPreferred: true,
      },
      capabilities,
    );

    expect(result.profile.facingMode).toBe('environment');
    expect(result.profile.resolutionTier).toBe('720p');
    expect(result.profile.targetFps).toBe(24);
    expect(result.profile.zoomLevel).toBe(2);
    expect(result.profile.torchPreferred).toBe(false);
    expect(result.clampedFields).toEqual(
      expect.arrayContaining(['facingMode', 'resolutionTier', 'targetFps', 'zoomLevel', 'torchPreferred']),
    );
  });

  it('resolves layered profile with user > adaptive > remote precedence', () => {
    const resolved = resolveARCameraProfileLayers({
      basePreset: 'balanced',
      userOverrides: { targetFps: 25, resolutionTier: '720p' },
      adaptiveAdjustments: { targetFps: 40, stabilizationStrength: 0.85 },
      remoteHints: { targetFps: 20, resolutionTier: '4k', overlayOpacity: 0.9 },
      capabilities: createConservativeARCameraCapabilities(),
    });

    expect(resolved.profile.targetFps).toBe(25);
    expect(resolved.profile.resolutionTier).toBe('720p');
    expect(resolved.profile.stabilizationStrength).toBeCloseTo(0.85, 3);
    expect(resolved.profile.overlayOpacity).toBeCloseTo(0.9, 3);
    expect(resolved.sourceByField.targetFps).toBe('user');
    expect(resolved.sourceByField.stabilizationStrength).toBe('adaptive');
    expect(resolved.sourceByField.overlayOpacity).toBe('remote');
  });

  it('applies session defaults beneath user and adaptive overrides', () => {
    const resolved = resolveARCameraProfileLayers({
      basePreset: 'quality',
      sessionDefaults: {
        resolutionTier: '720p',
        targetFps: 24,
        torchPreferred: false,
      },
      userOverrides: { targetFps: 30 },
      adaptiveAdjustments: { stabilizationStrength: 0.85 },
      remoteHints: { overlayOpacity: 0.9 },
      capabilities: createConservativeARCameraCapabilities(),
    });

    expect(resolved.profile.resolutionTier).toBe('720p');
    expect(resolved.profile.targetFps).toBe(30);
    expect(resolved.profile.stabilizationStrength).toBeCloseTo(0.85, 3);
    expect(resolved.sourceByField.resolutionTier).toBe('session');
    expect(resolved.sourceByField.targetFps).toBe('user');
  });

  it('builds media constraints from profile', () => {
    const result = buildARCameraConstraints(
      {
        ...DEFAULT_AR_CAMERA_PROFILE_BY_PRESET.performance,
        facingMode: 'environment',
        resolutionTier: '1080p',
        targetFps: 24,
      },
      createConservativeARCameraCapabilities(),
    );

    expect(result.constraints.facingMode).toBe('environment');
    expect(result.constraints.width).toEqual({ ideal: 1920 });
    expect(result.constraints.height).toEqual({ ideal: 1080 });
    expect(result.constraints.frameRate).toEqual({ ideal: 24, max: 24 });
    expect(result.requiresRestart).toBe(true);
  });

  it('detects significant profile delta for camera restarts', () => {
    const previous = DEFAULT_AR_CAMERA_PROFILE_BY_PRESET.balanced;
    const next = {
      ...previous,
      targetFps: 28,
    };
    const changed = {
      ...previous,
      resolutionTier: '4k' as const,
    };

    expect(hasSignificantARCameraProfileDelta(previous, next)).toBe(false);
    expect(hasSignificantARCameraProfileDelta(previous, changed)).toBe(true);
  });
});
