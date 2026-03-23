import type { ARCameraCapabilityMap, ARCameraProfile } from '@/lib/core/ar-camera-profile';
import type { ARSensorStatus } from '@/lib/core/ar-session';

export type ARAdaptationRuntimeKind = 'browser' | 'tauri';
export type ARAdaptationRuntimeClass = 'browser-mobile' | 'browser-desktop' | 'tauri-desktop';
export type ARAdaptationLayoutTier = 'phone-compact' | 'phone' | 'tablet' | 'desktop';
export type ARAdaptationControlDensity = 'compact' | 'comfortable';
export type ARSurfacePresentationMode = 'floating-card' | 'edge-sheet' | 'compact-strip';
export type ARCapabilityTier = 'full' | 'limited' | 'minimal';
export type ARSensorPath = 'sensor-primary' | 'camera-primary' | 'manual-only';

export interface ARSafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ARAdaptationInput {
  viewportWidth: number;
  viewportHeight: number;
  safeAreaInsets: ARSafeAreaInsets;
  runtimeKind: ARAdaptationRuntimeKind;
  cameraSupported: boolean;
  capabilityMap: ARCameraCapabilityMap | null;
  sensorSupported: boolean;
  sensorPermissionGranted: boolean;
  sensorStatus: ARSensorStatus;
}

export interface ARAdaptationContext {
  viewportWidth: number;
  viewportHeight: number;
  safeAreaInsets: ARSafeAreaInsets;
  runtimeClass: ARAdaptationRuntimeClass;
  layoutTier: ARAdaptationLayoutTier;
  controlDensity: ARAdaptationControlDensity;
  assistantMode: ARSurfacePresentationMode;
  recoveryMode: ARSurfacePresentationMode;
  cameraControlMode: ARSurfacePresentationMode;
  capabilityTier: ARCapabilityTier;
  sensorPath: ARSensorPath;
  isLandscape: boolean;
  isViewportReduced: boolean;
}

const MOBILE_SHELL_MAX_WIDTH = 900;
const MOBILE_SHELL_LANDSCAPE_MAX_WIDTH = 1200;
const MOBILE_SHELL_LANDSCAPE_MAX_HEIGHT = 640;
const COMPACT_PHONE_MAX_WIDTH = 430;
const COMPACT_PHONE_MAX_HEIGHT = 420;
const TABLET_PORTRAIT_MIN_WIDTH = 768;
const TABLET_PORTRAIT_MIN_HEIGHT = 900;

function isMobileLikeViewport(width: number, height: number): boolean {
  return width <= MOBILE_SHELL_MAX_WIDTH || (
    width > height &&
    width <= MOBILE_SHELL_LANDSCAPE_MAX_WIDTH &&
    height <= MOBILE_SHELL_LANDSCAPE_MAX_HEIGHT
  );
}

function deriveCapabilityTier(
  cameraSupported: boolean,
  capabilityMap: ARCameraCapabilityMap | null,
): ARCapabilityTier {
  if (!cameraSupported) {
    return 'minimal';
  }

  if (!capabilityMap) {
    return 'limited';
  }

  if (!capabilityMap.supported) {
    return 'minimal';
  }

  const has1080p = capabilityMap.resolutionTiers.includes('1080p') || capabilityMap.resolutionTiers.includes('4k');
  const onlyLowResolution = !has1080p;

  if (capabilityMap.fpsRange.max < 24 || capabilityMap.resolutionTiers.length <= 1) {
    return 'minimal';
  }

  if (
    capabilityMap.fpsRange.max < 30 ||
    onlyLowResolution ||
    !capabilityMap.supportsFrameRateConstraint ||
    !capabilityMap.zoom ||
    !capabilityMap.supportsTorch
  ) {
    return 'limited';
  }

  return 'full';
}

function deriveSensorPath(input: ARAdaptationInput, runtimeClass: ARAdaptationRuntimeClass): ARSensorPath {
  if (!input.cameraSupported) {
    return input.sensorSupported && input.sensorPermissionGranted ? 'sensor-primary' : 'manual-only';
  }

  if (!input.sensorSupported || input.sensorStatus === 'unsupported') {
    return 'camera-primary';
  }

  if (input.sensorPermissionGranted && (
    input.sensorStatus === 'active' ||
    input.sensorStatus === 'calibration-required' ||
    input.sensorStatus === 'degraded'
  )) {
    return 'sensor-primary';
  }

  if (runtimeClass !== 'browser-mobile') {
    return 'camera-primary';
  }

  return 'camera-primary';
}

export function deriveARAdaptationContext(input: ARAdaptationInput): ARAdaptationContext {
  const isLandscape = input.viewportWidth > input.viewportHeight;
  const isMobileLike = isMobileLikeViewport(input.viewportWidth, input.viewportHeight);
  const isShortViewport = input.viewportHeight <= COMPACT_PHONE_MAX_HEIGHT;
  const isNarrowViewport = input.viewportWidth <= COMPACT_PHONE_MAX_WIDTH;
  const isTabletPortrait =
    !isLandscape &&
    input.viewportWidth >= TABLET_PORTRAIT_MIN_WIDTH &&
    input.viewportHeight >= TABLET_PORTRAIT_MIN_HEIGHT;
  const hasLargeInsets = (
    input.safeAreaInsets.top +
    input.safeAreaInsets.bottom +
    input.safeAreaInsets.left +
    input.safeAreaInsets.right
  ) >= 48;

  const runtimeClass: ARAdaptationRuntimeClass = input.runtimeKind === 'tauri'
    ? 'tauri-desktop'
    : isMobileLike
      ? 'browser-mobile'
      : 'browser-desktop';

  const layoutTier: ARAdaptationLayoutTier = isMobileLike
    ? (
      isTabletPortrait
        ? 'tablet'
        : (isNarrowViewport || isShortViewport || isLandscape ? 'phone-compact' : 'phone')
    )
    : input.viewportWidth <= 1280
      ? 'tablet'
      : 'desktop';

  const isViewportReduced = isShortViewport || (isLandscape && input.viewportHeight <= 460) || hasLargeInsets;
  const controlDensity: ARAdaptationControlDensity = layoutTier === 'phone-compact' || layoutTier === 'phone'
    ? 'compact'
    : 'comfortable';
  const capabilityTier = deriveCapabilityTier(input.cameraSupported, input.capabilityMap);
  const sensorPath = deriveSensorPath(input, runtimeClass);

  return {
    viewportWidth: input.viewportWidth,
    viewportHeight: input.viewportHeight,
    safeAreaInsets: input.safeAreaInsets,
    runtimeClass,
    layoutTier,
    controlDensity,
    assistantMode: layoutTier === 'phone-compact' || layoutTier === 'phone'
      ? 'edge-sheet'
      : 'floating-card',
    recoveryMode: layoutTier === 'phone-compact' || layoutTier === 'phone'
      ? 'compact-strip'
      : 'floating-card',
    cameraControlMode: layoutTier === 'phone-compact' || layoutTier === 'phone'
      ? 'compact-strip'
      : 'floating-card',
    capabilityTier,
    sensorPath,
    isLandscape,
    isViewportReduced,
  };
}

export function deriveARSessionCameraDefaults(
  context: Pick<ARAdaptationContext, 'capabilityTier' | 'sensorPath'>,
): Partial<ARCameraProfile> {
  const defaults: Partial<ARCameraProfile> = {
    facingMode: 'environment',
  };

  if (context.capabilityTier === 'minimal') {
    defaults.resolutionTier = 'auto';
    defaults.targetFps = 20;
    defaults.overlayOpacity = 0.65;
    defaults.stabilizationStrength = 0.5;
    defaults.sensorSmoothingFactor = 0.3;
    defaults.calibrationSensitivity = 0.6;
    defaults.torchPreferred = false;
  } else if (context.capabilityTier === 'limited') {
    defaults.resolutionTier = '720p';
    defaults.targetFps = 24;
    defaults.overlayOpacity = 0.68;
    defaults.stabilizationStrength = 0.55;
    defaults.sensorSmoothingFactor = 0.25;
    defaults.calibrationSensitivity = 0.55;
    defaults.torchPreferred = false;
  }

  if (context.sensorPath === 'camera-primary') {
    defaults.overlayOpacity = Math.max(defaults.overlayOpacity ?? 0.7, 0.75);
    defaults.stabilizationStrength = Math.max(defaults.stabilizationStrength ?? 0.6, 0.65);
  } else if (context.sensorPath === 'manual-only') {
    defaults.overlayOpacity = Math.max(defaults.overlayOpacity ?? 0.7, 0.8);
    defaults.sensorSmoothingFactor = Math.max(defaults.sensorSmoothingFactor ?? 0.2, 0.3);
  }

  return defaults;
}
