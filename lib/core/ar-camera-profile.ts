export type FacingMode = 'user' | 'environment';

export type ARCameraPreset = 'balanced' | 'performance' | 'quality';
export type ARCameraResolutionTier = 'auto' | '720p' | '1080p' | '4k';

export interface ARCameraProfile {
  preset: ARCameraPreset;
  facingMode: FacingMode;
  resolutionTier: ARCameraResolutionTier;
  targetFps: number;
  overlayOpacity: number;
  stabilizationStrength: number;
  sensorSmoothingFactor: number;
  calibrationSensitivity: number;
  zoomLevel: number;
  torchPreferred: boolean;
}

export interface ARCameraProfileLayerInput {
  basePreset: ARCameraPreset;
  userOverrides?: Partial<ARCameraProfile>;
  adaptiveAdjustments?: Partial<ARCameraProfile>;
  remoteHints?: Partial<ARCameraProfile>;
  sessionDefaults?: Partial<ARCameraProfile>;
  capabilities?: ARCameraCapabilityMap | null;
}

export type ARCameraProfileSource = 'base' | 'remote' | 'session' | 'adaptive' | 'user';

export interface ARCameraProfileLayerResolution {
  profile: ARCameraProfile;
  sourceByField: Partial<Record<keyof ARCameraProfile, ARCameraProfileSource>>;
  clampedFields: Array<keyof ARCameraProfile>;
  fallbackReason: string | null;
}

export interface NumericRange {
  min: number;
  max: number;
}

export interface ARCameraCapabilityMap {
  supported: boolean;
  facingModes: FacingMode[];
  resolutionTiers: ARCameraResolutionTier[];
  fpsRange: NumericRange;
  zoom: NumericRange | null;
  supportsTorch: boolean;
  supportsExposureCompensation: boolean;
  supportsWhiteBalanceMode: boolean;
  supportsFrameRateConstraint: boolean;
}

export interface ARCameraValidationResult {
  profile: ARCameraProfile;
  clampedFields: Array<keyof ARCameraProfile>;
}

export const DEFAULT_AR_CAMERA_PROFILE_BY_PRESET: Record<ARCameraPreset, ARCameraProfile> = {
  balanced: {
    preset: 'balanced',
    facingMode: 'environment',
    resolutionTier: '1080p',
    targetFps: 30,
    overlayOpacity: 0.7,
    stabilizationStrength: 0.6,
    sensorSmoothingFactor: 0.2,
    calibrationSensitivity: 0.5,
    zoomLevel: 1,
    torchPreferred: false,
  },
  performance: {
    preset: 'performance',
    facingMode: 'environment',
    resolutionTier: '720p',
    targetFps: 24,
    overlayOpacity: 0.65,
    stabilizationStrength: 0.5,
    sensorSmoothingFactor: 0.25,
    calibrationSensitivity: 0.55,
    zoomLevel: 1,
    torchPreferred: false,
  },
  quality: {
    preset: 'quality',
    facingMode: 'environment',
    resolutionTier: '4k',
    targetFps: 30,
    overlayOpacity: 0.75,
    stabilizationStrength: 0.7,
    sensorSmoothingFactor: 0.15,
    calibrationSensitivity: 0.45,
    zoomLevel: 1,
    torchPreferred: false,
  },
};

const DEFAULT_RESOLUTION_DIMENSIONS: Record<Exclude<ARCameraResolutionTier, 'auto'>, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getRange(value: unknown, fallback: NumericRange): NumericRange {
  if (!value || typeof value !== 'object') return fallback;
  const range = value as { min?: unknown; max?: unknown };
  const min = typeof range.min === 'number' && Number.isFinite(range.min) ? range.min : fallback.min;
  const max = typeof range.max === 'number' && Number.isFinite(range.max) ? range.max : fallback.max;
  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

function asResolutionTiers(
  caps: Record<string, unknown> | undefined,
): ARCameraResolutionTier[] {
  const tiers: ARCameraResolutionTier[] = ['auto'];

  const widthRange = getRange(caps?.width, { min: 0, max: 0 });
  const heightRange = getRange(caps?.height, { min: 0, max: 0 });

  const maxPixels = widthRange.max * heightRange.max;
  if (maxPixels >= 1280 * 720) tiers.push('720p');
  if (maxPixels >= 1920 * 1080) tiers.push('1080p');
  if (maxPixels >= 3840 * 2160) tiers.push('4k');

  return tiers;
}

function asFacingModes(caps: Record<string, unknown> | undefined): FacingMode[] {
  const facingMode = caps?.facingMode;
  if (!Array.isArray(facingMode)) {
    return ['environment', 'user'];
  }

  const modes: FacingMode[] = [];
  for (const candidate of facingMode) {
    if (candidate === 'environment' || candidate === 'user') {
      modes.push(candidate);
    }
  }

  return modes.length > 0 ? Array.from(new Set(modes)) : ['environment', 'user'];
}

export function createConservativeARCameraCapabilities(): ARCameraCapabilityMap {
  return {
    supported: true,
    facingModes: ['environment', 'user'],
    resolutionTiers: ['auto', '720p', '1080p'],
    fpsRange: { min: 15, max: 30 },
    zoom: null,
    supportsTorch: false,
    supportsExposureCompensation: false,
    supportsWhiteBalanceMode: false,
    supportsFrameRateConstraint: true,
  };
}

export function normalizeARCameraCapabilities(
  track: MediaStreamTrack | null,
  supportedConstraints?: MediaTrackSupportedConstraints,
): ARCameraCapabilityMap {
  if (!track) {
    return createConservativeARCameraCapabilities();
  }

  const getCapabilities = track.getCapabilities as
    | (() => MediaTrackCapabilities)
    | undefined;
  if (!getCapabilities) {
    return createConservativeARCameraCapabilities();
  }

  try {
    const caps = getCapabilities.call(track) as Record<string, unknown>;
    const fpsRange = getRange(caps.frameRate, { min: 15, max: 30 });
    const zoomRange = caps.zoom ? getRange(caps.zoom, { min: 1, max: 1 }) : null;

    const supportsFrameRateConstraint = supportedConstraints?.frameRate ?? true;
    const supportsExposureCompensation = Boolean(caps.exposureCompensation);
    const supportsWhiteBalanceMode = Array.isArray(caps.whiteBalanceMode);

    return {
      supported: true,
      facingModes: asFacingModes(caps),
      resolutionTiers: asResolutionTiers(caps),
      fpsRange,
      zoom: zoomRange,
      supportsTorch: 'torch' in caps,
      supportsExposureCompensation,
      supportsWhiteBalanceMode,
      supportsFrameRateConstraint,
    };
  } catch {
    return createConservativeARCameraCapabilities();
  }
}

function pickFallbackPreset(capabilities: ARCameraCapabilityMap): ARCameraPreset {
  if (capabilities.fpsRange.max < 25) return 'performance';
  if (capabilities.resolutionTiers.includes('4k')) return 'quality';
  return 'balanced';
}

export function validateAndClampARCameraProfile(
  profile: ARCameraProfile,
  capabilities: ARCameraCapabilityMap,
): ARCameraValidationResult {
  const clampedFields: Array<keyof ARCameraProfile> = [];
  const next: ARCameraProfile = { ...profile };

  if (!capabilities.facingModes.includes(next.facingMode)) {
    next.facingMode = capabilities.facingModes[0] ?? 'environment';
    clampedFields.push('facingMode');
  }

  if (!capabilities.resolutionTiers.includes(next.resolutionTier)) {
    next.resolutionTier = capabilities.resolutionTiers.includes('1080p')
      ? '1080p'
      : capabilities.resolutionTiers[capabilities.resolutionTiers.length - 1] ?? 'auto';
    clampedFields.push('resolutionTier');
  }

  const targetFps = clamp(next.targetFps, capabilities.fpsRange.min, capabilities.fpsRange.max);
  if (targetFps !== next.targetFps) {
    next.targetFps = targetFps;
    clampedFields.push('targetFps');
  }

  const overlayOpacity = clamp(next.overlayOpacity, 0.1, 1);
  if (overlayOpacity !== next.overlayOpacity) {
    next.overlayOpacity = overlayOpacity;
    clampedFields.push('overlayOpacity');
  }

  const stabilizationStrength = clamp(next.stabilizationStrength, 0, 1);
  if (stabilizationStrength !== next.stabilizationStrength) {
    next.stabilizationStrength = stabilizationStrength;
    clampedFields.push('stabilizationStrength');
  }

  const sensorSmoothingFactor = clamp(next.sensorSmoothingFactor, 0.05, 0.95);
  if (sensorSmoothingFactor !== next.sensorSmoothingFactor) {
    next.sensorSmoothingFactor = sensorSmoothingFactor;
    clampedFields.push('sensorSmoothingFactor');
  }

  const calibrationSensitivity = clamp(next.calibrationSensitivity, 0, 1);
  if (calibrationSensitivity !== next.calibrationSensitivity) {
    next.calibrationSensitivity = calibrationSensitivity;
    clampedFields.push('calibrationSensitivity');
  }

  if (capabilities.zoom) {
    const zoomLevel = clamp(next.zoomLevel, capabilities.zoom.min, capabilities.zoom.max);
    if (zoomLevel !== next.zoomLevel) {
      next.zoomLevel = zoomLevel;
      clampedFields.push('zoomLevel');
    }
  } else if (next.zoomLevel !== 1) {
    next.zoomLevel = 1;
    clampedFields.push('zoomLevel');
  }

  if (!capabilities.supportsTorch && next.torchPreferred) {
    next.torchPreferred = false;
    clampedFields.push('torchPreferred');
  }

  return {
    profile: next,
    clampedFields,
  };
}

function mergeLayer(
  target: ARCameraProfile,
  source: Partial<ARCameraProfile> | undefined,
  sourceLabel: ARCameraProfileSource,
  sourceByField: Partial<Record<keyof ARCameraProfile, ARCameraProfileSource>>,
  allowOverwrite: (field: keyof ARCameraProfile, existing: ARCameraProfileSource | undefined) => boolean,
): void {
  if (!source) return;
  const keys = Object.keys(source) as Array<keyof ARCameraProfile>;
  const mutableTarget = target as ARCameraProfile;
  for (const key of keys) {
    const value = source[key];
    if (value === undefined) continue;
    const currentSource = sourceByField[key];
    if (!allowOverwrite(key, currentSource)) continue;
    mutableTarget[key] = value as never;
    sourceByField[key] = sourceLabel;
  }
}

export function resolveARCameraProfileLayers(
  input: ARCameraProfileLayerInput,
): ARCameraProfileLayerResolution {
  const base = { ...DEFAULT_AR_CAMERA_PROFILE_BY_PRESET[input.basePreset] };
  const sourceByField: Partial<Record<keyof ARCameraProfile, ARCameraProfileSource>> = {
    preset: 'base',
    facingMode: 'base',
    resolutionTier: 'base',
    targetFps: 'base',
    overlayOpacity: 'base',
    stabilizationStrength: 'base',
    sensorSmoothingFactor: 'base',
    calibrationSensitivity: 'base',
    zoomLevel: 'base',
    torchPreferred: 'base',
  };

  mergeLayer(base, input.remoteHints, 'remote', sourceByField, (_, existing) => existing === 'base');
  mergeLayer(base, input.sessionDefaults, 'session', sourceByField, (_, existing) => existing !== 'adaptive' && existing !== 'user');
  mergeLayer(base, input.adaptiveAdjustments, 'adaptive', sourceByField, (_, existing) => existing !== 'user');
  mergeLayer(base, input.userOverrides, 'user', sourceByField, () => true);

  const capabilities = input.capabilities ?? createConservativeARCameraCapabilities();
  const validated = validateAndClampARCameraProfile(base, capabilities);

  let fallbackReason: string | null = null;
  let profile = validated.profile;

  if (validated.clampedFields.length > 0 && input.capabilities) {
    fallbackReason = `profile_clamped:${validated.clampedFields.join(',')}`;
  }

  if (!input.capabilities?.supported) {
    const fallbackPreset = pickFallbackPreset(capabilities);
    profile = { ...DEFAULT_AR_CAMERA_PROFILE_BY_PRESET[fallbackPreset] };
    fallbackReason = 'capabilities_unsupported';
  }

  return {
    profile,
    sourceByField,
    clampedFields: validated.clampedFields,
    fallbackReason,
  };
}

export interface ARCameraConstraintBuildResult {
  constraints: MediaTrackConstraints;
  requiresRestart: boolean;
}

export function buildARCameraConstraints(
  profile: ARCameraProfile,
  capabilities: ARCameraCapabilityMap,
): ARCameraConstraintBuildResult {
  const constraints: MediaTrackConstraints = {
    facingMode: profile.facingMode,
  };

  if (profile.resolutionTier !== 'auto') {
    const dims = DEFAULT_RESOLUTION_DIMENSIONS[profile.resolutionTier];
    constraints.width = { ideal: dims.width };
    constraints.height = { ideal: dims.height };
  }

  if (capabilities.supportsFrameRateConstraint) {
    constraints.frameRate = {
      ideal: profile.targetFps,
      max: profile.targetFps,
    };
  }

  return {
    constraints,
    requiresRestart: profile.resolutionTier !== 'auto' || capabilities.supportsFrameRateConstraint,
  };
}

export function buildARCameraAdvancedConstraints(
  profile: ARCameraProfile,
  capabilities: ARCameraCapabilityMap,
): MediaTrackConstraintSet[] {
  const advanced: MediaTrackConstraintSet[] = [];

  if (capabilities.zoom && profile.zoomLevel > 0) {
    advanced.push({ zoom: profile.zoomLevel } as MediaTrackConstraintSet);
  }

  if (capabilities.supportsTorch) {
    advanced.push({ torch: profile.torchPreferred } as MediaTrackConstraintSet);
  }

  return advanced;
}

export function hasSignificantARCameraProfileDelta(
  previous: ARCameraProfile | null,
  next: ARCameraProfile,
): boolean {
  if (!previous) return true;
  if (previous.facingMode !== next.facingMode) return true;
  if (previous.resolutionTier !== next.resolutionTier) return true;
  if (Math.abs(previous.targetFps - next.targetFps) >= 5) return true;
  if (Math.abs(previous.zoomLevel - next.zoomLevel) >= 0.25) return true;
  return false;
}

export function createARCameraTelemetryPayload(
  profileResolution: ARCameraProfileLayerResolution,
  capabilities: ARCameraCapabilityMap,
): Record<string, unknown> {
  return {
    preset: profileResolution.profile.preset,
    resolutionTier: profileResolution.profile.resolutionTier,
    targetFps: profileResolution.profile.targetFps,
    sourceByField: profileResolution.sourceByField,
    clampedFields: profileResolution.clampedFields,
    fallbackReason: profileResolution.fallbackReason,
    capabilities: {
      supported: capabilities.supported,
      facingModes: capabilities.facingModes,
      resolutionTiers: capabilities.resolutionTiers,
      fpsRange: capabilities.fpsRange,
      supportsTorch: capabilities.supportsTorch,
      supportsExposureCompensation: capabilities.supportsExposureCompensation,
      supportsWhiteBalanceMode: capabilities.supportsWhiteBalanceMode,
    },
  };
}

export function serializeARCameraProfile(profile: ARCameraProfile): string {
  return JSON.stringify(profile);
}
