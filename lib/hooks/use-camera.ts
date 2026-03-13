'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  buildARCameraAdvancedConstraints,
  buildARCameraConstraints,
  createConservativeARCameraCapabilities,
  hasSignificantARCameraProfileDelta,
  normalizeARCameraCapabilities,
  resolveARCameraProfileLayers,
  type ARCameraCapabilityMap,
  type ARCameraProfile,
  type ARCameraProfileLayerInput,
  type ARCameraProfileLayerResolution,
  type FacingMode as CoreFacingMode,
} from '@/lib/core/ar-camera-profile';
import {
  buildARCameraAcquisitionPlan,
  type ARCameraAcquisitionAttempt,
  type ARCameraLastKnownGoodAcquisition,
  type ARCameraPreferredDevice,
} from '@/lib/core/ar-camera-acquisition';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-camera');
export type FacingMode = CoreFacingMode;

const VISIBILITY_RESUME_DEBOUNCE_MS = 180;

// ============================================================================
// Types
// ============================================================================

export type CameraErrorType =
  | 'not-supported'
  | 'not-found'
  | 'permission-denied'
  | 'in-use'
  | 'unknown';

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface CameraCapabilities {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
}

export interface CameraResolution {
  label: string;
  width: number;
  height: number;
}

export const CAMERA_RESOLUTIONS: CameraResolution[] = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: 'Max', width: 4096, height: 2160 },
];

export interface CameraAcquisitionDiagnostics {
  currentStage: ARCameraAcquisitionAttempt['stage'] | null;
  attemptedStages: ARCameraAcquisitionAttempt['stage'][];
  lastFailureStage: ARCameraAcquisitionAttempt['stage'] | null;
  lastFailureMessage: string | null;
  stalePreferredDevice: boolean;
  staleRememberedDevice: boolean;
  usedRememberedPlan: boolean;
  activeDevice: CameraDevice | null;
}

const DEFAULT_CAMERA_ACQUISITION_DIAGNOSTICS: CameraAcquisitionDiagnostics = {
  currentStage: null,
  attemptedStages: [],
  lastFailureStage: null,
  lastFailureMessage: null,
  stalePreferredDevice: false,
  staleRememberedDevice: false,
  usedRememberedPlan: false,
  activeDevice: null,
};

export interface UseCameraOptions {
  facingMode?: CoreFacingMode;
  resolution?: CameraResolution;
  autoStart?: boolean;
  profileLayers?: Omit<ARCameraProfileLayerInput, 'capabilities'>;
  preferredDevice?: ARCameraPreferredDevice | null;
  lastKnownGoodAcquisition?: ARCameraLastKnownGoodAcquisition | null;
}

export interface UseCameraReturn {
  // State
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  errorType: CameraErrorType | null;
  facingMode: CoreFacingMode;
  devices: CameraDevice[];
  capabilities: CameraCapabilities;
  normalizedCapabilities: ARCameraCapabilityMap | null;
  effectiveProfile: ARCameraProfile | null;
  profileResolution: ARCameraProfileLayerResolution | null;
  profileApplyError: string | null;
  profileFallbackReason: string | null;
  lastKnownGoodProfile: ARCameraProfile | null;
  lastKnownGoodAcquisition: ARCameraLastKnownGoodAcquisition | null;
  acquisitionDiagnostics: CameraAcquisitionDiagnostics;
  isSupported: boolean;
  hasMultipleCameras: boolean;
  zoomLevel: number;
  torchOn: boolean;

  // Actions
  start: (constraints?: Partial<UseCameraOptions>) => Promise<void>;
  stop: () => void;
  switchCamera: () => Promise<void>;
  setFacingMode: (mode: CoreFacingMode) => Promise<void>;
  applyProfileLayers: (layers: UseCameraOptions['profileLayers']) => Promise<void>;
  capture: (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    quality?: number,
  ) => { file: File; dataUrl: string; width: number; height: number } | null;
  setZoom: (level: number) => Promise<void>;
  toggleTorch: () => Promise<void>;
  enumerateDevices: () => Promise<void>;
}

// ============================================================================
// Error Classification
// ============================================================================

function classifyError(error: unknown): { message: string; type: CameraErrorType } {
  if (error instanceof Error) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return { message: error.message, type: 'permission-denied' };
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return { message: error.message, type: 'not-found' };
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        return { message: error.message, type: 'in-use' };
      default:
        return { message: error.message, type: 'unknown' };
    }
  }
  return { message: 'Unknown camera error', type: 'unknown' };
}

function toLegacyCapabilities(track: MediaStreamTrack | undefined): CameraCapabilities {
  if (!track) return {};

  try {
    const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
    if (!caps) return {};

    const next: CameraCapabilities = {};
    if (caps.zoom && typeof caps.zoom === 'object') {
      const zoomRange = caps.zoom as { min?: number; max?: number; step?: number };
      next.zoom = {
        min: zoomRange.min ?? 1,
        max: zoomRange.max ?? 1,
        step: zoomRange.step ?? 0.1,
      };
    }

    if ('torch' in caps) {
      next.torch = true;
    }

    return next;
  } catch {
    return {};
  }
}

function resolveProfile(
  layers: UseCameraOptions['profileLayers'],
  capabilities: ARCameraCapabilityMap,
): ARCameraProfileLayerResolution | null {
  if (!layers) return null;
  return resolveARCameraProfileLayers({
    ...layers,
    capabilities,
  });
}

function buildConstraintsForAttempt(options: {
  attempt: ARCameraAcquisitionAttempt;
  mode: CoreFacingMode;
  resolution?: CameraResolution;
  constraintsFromProfile: Partial<MediaTrackConstraints>;
}): MediaStreamConstraints {
  const { attempt, mode, resolution, constraintsFromProfile } = options;
  const video: MediaTrackConstraints = {};

  if (attempt.deviceId) {
    video.deviceId = { exact: attempt.deviceId };
  } else if (attempt.facingMode) {
    video.facingMode = attempt.facingMode;
  } else {
    video.facingMode = mode;
  }

  if (attempt.safeMode) {
    video.width = { ideal: 1280 };
    video.height = { ideal: 720 };
  } else if (resolution) {
    video.width = { ideal: resolution.width };
    video.height = { ideal: resolution.height };
  } else if (constraintsFromProfile.width || constraintsFromProfile.height) {
    if (constraintsFromProfile.width) video.width = constraintsFromProfile.width;
    if (constraintsFromProfile.height) video.height = constraintsFromProfile.height;
  } else {
    video.width = { ideal: 1920 };
    video.height = { ideal: 1080 };
  }

  if (!attempt.safeMode && constraintsFromProfile.frameRate) {
    video.frameRate = constraintsFromProfile.frameRate;
  }

  return { video };
}

function resolveAttemptDevice(
  attempt: ARCameraAcquisitionAttempt,
  knownDevices: CameraDevice[],
): CameraDevice | null {
  if (!attempt.deviceId) return null;
  return knownDevices.find((device) => device.deviceId === attempt.deviceId) ?? null;
}

// ============================================================================
// Hook
// ============================================================================

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    facingMode: initialFacingMode = 'environment',
    resolution: initialResolution,
    profileLayers: initialProfileLayers,
    preferredDevice: initialPreferredDevice = null,
    lastKnownGoodAcquisition: initialLastKnownGoodAcquisition = null,
  } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<CameraErrorType | null>(null);
  const [facingMode, setFacingModeState] = useState<CoreFacingMode>(initialFacingMode);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({});
  const [normalizedCapabilities, setNormalizedCapabilities] = useState<ARCameraCapabilityMap | null>(null);
  const [effectiveProfile, setEffectiveProfile] = useState<ARCameraProfile | null>(null);
  const [profileResolution, setProfileResolution] = useState<ARCameraProfileLayerResolution | null>(null);
  const [profileApplyError, setProfileApplyError] = useState<string | null>(null);
  const [profileFallbackReason, setProfileFallbackReason] = useState<string | null>(null);
  const [lastKnownGoodProfile, setLastKnownGoodProfile] = useState<ARCameraProfile | null>(null);
  const [lastKnownGoodAcquisition, setLastKnownGoodAcquisition] = useState<ARCameraLastKnownGoodAcquisition | null>(initialLastKnownGoodAcquisition);
  const [acquisitionDiagnostics, setAcquisitionDiagnostics] = useState<CameraAcquisitionDiagnostics>(DEFAULT_CAMERA_ACQUISITION_DIAGNOSTICS);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchOn, setTorchOn] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const shouldResumeOnVisibleRef = useRef(false);
  const visibilityResumeTimerRef = useRef<number | null>(null);
  const resumeInFlightRef = useRef(false);
  const lastStartOverridesRef = useRef<Partial<UseCameraOptions>>({});
  const profileLayersRef = useRef<UseCameraOptions['profileLayers']>(initialProfileLayers);
  const preferredDeviceRef = useRef<ARCameraPreferredDevice | null>(initialPreferredDevice);
  const rememberedAcquisitionRef = useRef<ARCameraLastKnownGoodAcquisition | null>(initialLastKnownGoodAcquisition);
  const startedWithRememberedRef = useRef(false);
  const savedZoomRef = useRef(1);
  const savedTorchRef = useRef(false);

  const isSupported =
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  const hasMultipleCameras = devices.length > 1;

  const conservativeCapabilities = useMemo(
    () => createConservativeARCameraCapabilities(),
    [],
  );

  const listVideoDevices = useCallback(async (): Promise<CameraDevice[]> => {
    if (!isSupported) return [];
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      return allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 4)}`,
          groupId: d.groupId,
        }));
    } catch {
      return [];
    }
  }, [isSupported]);

  // Enumerate available video devices
  const enumerateDevicesAction = useCallback(async () => {
    const videoDevices = await listVideoDevices();
    setDevices(videoDevices);
  }, [listVideoDevices]);

  useEffect(() => {
    preferredDeviceRef.current = initialPreferredDevice;
  }, [initialPreferredDevice]);

  useEffect(() => {
    rememberedAcquisitionRef.current = initialLastKnownGoodAcquisition;
  }, [initialLastKnownGoodAcquisition]);

  const clearStream = useCallback((preserveResume = false) => {
    if (visibilityResumeTimerRef.current !== null) {
      window.clearTimeout(visibilityResumeTimerRef.current);
      visibilityResumeTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
    setTorchOn(false);
    setZoomLevel(1);
    setCapabilities({});
    if (!preserveResume) {
      shouldResumeOnVisibleRef.current = false;
    }
  }, []);

  const applyProfileToTrack = useCallback(async (
    track: MediaStreamTrack,
    resolved: ARCameraProfileLayerResolution,
    capabilityMap: ARCameraCapabilityMap,
  ) => {
    logger.info('Resolved AR camera profile', {
      sourceByField: resolved.sourceByField,
      clampedFields: resolved.clampedFields,
      fallbackReason: resolved.fallbackReason,
      capabilities: {
        facingModes: capabilityMap.facingModes,
        resolutionTiers: capabilityMap.resolutionTiers,
        fpsRange: capabilityMap.fpsRange,
        supportsTorch: capabilityMap.supportsTorch,
      },
    });

    const advanced = buildARCameraAdvancedConstraints(resolved.profile, capabilityMap);
    if (advanced.length === 0) {
      setProfileApplyError(null);
      setProfileFallbackReason(resolved.fallbackReason);
      setProfileResolution(resolved);
      setEffectiveProfile(resolved.profile);
      setLastKnownGoodProfile(resolved.profile);
      if (resolved.fallbackReason) {
        logger.warn('Applied AR camera profile with fallback', {
          fallbackReason: resolved.fallbackReason,
          clampedFields: resolved.clampedFields,
        });
      }
      return;
    }

    try {
      await track.applyConstraints({ advanced });
      setProfileApplyError(null);
      setProfileFallbackReason(resolved.fallbackReason);
      setProfileResolution(resolved);
      setEffectiveProfile(resolved.profile);
      setLastKnownGoodProfile(resolved.profile);
      if (resolved.fallbackReason) {
        logger.warn('Applied AR camera profile with fallback', {
          fallbackReason: resolved.fallbackReason,
          clampedFields: resolved.clampedFields,
        });
      }
    } catch (profileError) {
      const message = profileError instanceof Error
        ? profileError.message
        : 'Failed to apply camera profile constraints';
      setProfileApplyError(message);
      setProfileFallbackReason('profile_apply_failed');
      logger.warn('AR camera profile apply failed', {
        message,
        clampedFields: resolved.clampedFields,
        fallbackReason: resolved.fallbackReason,
      });
    }
  }, []);

  // Stop the current stream
  const stop = useCallback(() => {
    clearStream(false);
  }, [clearStream]);

  // Start camera with given constraints
  const start = useCallback(
    async (overrides: Partial<UseCameraOptions> = {}) => {
      if (!isSupported) {
        setError('Camera API not supported');
        setErrorType('not-supported');
        return;
      }

      setIsLoading(true);
      setError(null);
      setErrorType(null);
      setProfileApplyError(null);

      clearStream(true);

      const activeProfileLayers = overrides.profileLayers ?? profileLayersRef.current;
      profileLayersRef.current = activeProfileLayers;
      const preflightResolution = resolveProfile(activeProfileLayers, conservativeCapabilities);

      const mode = overrides.facingMode
        ?? preflightResolution?.profile.facingMode
        ?? facingMode;
      const res = overrides.resolution ?? initialResolution;
      const activePreferredDevice = overrides.preferredDevice ?? preferredDeviceRef.current;
      preferredDeviceRef.current = activePreferredDevice;
      const activeRememberedAcquisition = overrides.lastKnownGoodAcquisition ?? rememberedAcquisitionRef.current;
      startedWithRememberedRef.current = Boolean(activeRememberedAcquisition);

      const knownDevices = await listVideoDevices();
      if (knownDevices.length > 0) {
        setDevices(knownDevices);
      }

      const plan = buildARCameraAcquisitionPlan({
        devices: knownDevices,
        preferredDevice: activePreferredDevice,
        lastKnownGood: activeRememberedAcquisition,
        requestedFacingMode: mode,
      });

      setAcquisitionDiagnostics({
        ...DEFAULT_CAMERA_ACQUISITION_DIAGNOSTICS,
        stalePreferredDevice: plan.stalePreferredDevice,
        staleRememberedDevice: plan.staleRememberedDevice,
      });

      lastStartOverridesRef.current = {
        ...overrides,
        facingMode: mode,
        resolution: res,
        profileLayers: activeProfileLayers,
        preferredDevice: activePreferredDevice,
        lastKnownGoodAcquisition: activeRememberedAcquisition,
      };

      let lastError = null;
      let failureStage = null;
      const attemptedStages: ARCameraAcquisitionAttempt['stage'][] = [];
      const constraintsFromProfile = preflightResolution
        ? buildARCameraConstraints(preflightResolution.profile, conservativeCapabilities).constraints
        : {};

      try {
        for (const attempt of plan.attempts) {
          attemptedStages.push(attempt.stage);

          try {
            const constraints = buildConstraintsForAttempt({
              attempt,
              mode,
              resolution: res,
              constraintsFromProfile,
            });

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            const activeDevice = resolveAttemptDevice(attempt, knownDevices);

            streamRef.current = mediaStream;
            setStream(mediaStream);
            setFacingModeState(attempt.facingMode ?? mode);
            shouldResumeOnVisibleRef.current = true;

            const track = mediaStream.getVideoTracks()[0];
            setCapabilities(toLegacyCapabilities(track));

            const capabilityMap = normalizeARCameraCapabilities(
              track ?? null,
              navigator.mediaDevices.getSupportedConstraints?.(),
            );
            setNormalizedCapabilities(capabilityMap);
            logger.info('Detected AR camera capabilities', {
              facingModes: capabilityMap.facingModes,
              resolutionTiers: capabilityMap.resolutionTiers,
              fpsRange: capabilityMap.fpsRange,
              supportsTorch: capabilityMap.supportsTorch,
              supportsFrameRateConstraint: capabilityMap.supportsFrameRateConstraint,
            });

            if (activeProfileLayers && track) {
              const resolved = resolveProfile(activeProfileLayers, capabilityMap);
              if (resolved) {
                await applyProfileToTrack(track, resolved, capabilityMap);
              }
            }

            // Restore previous zoom/torch after stream resume
            if (savedZoomRef.current > 1 && capabilityMap.zoom && track) {
              const clampedZoom = Math.min(savedZoomRef.current, capabilityMap.zoom.max ?? savedZoomRef.current);
              try {
                await track.applyConstraints({ advanced: [{ zoom: clampedZoom } as MediaTrackConstraintSet] });
                setZoomLevel(clampedZoom);
              } catch { /* zoom not supported on new track */ }
            }
            if (savedTorchRef.current && capabilityMap.supportsTorch && track) {
              try {
                await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] });
                setTorchOn(true);
              } catch { /* torch not supported on new track */ }
            }

            const refreshedDevices = await listVideoDevices();
            if (refreshedDevices.length > 0) {
              setDevices(refreshedDevices);
            }

            const nextLastKnownGoodAcquisition = {
              deviceId: activeDevice?.deviceId ?? attempt.deviceId ?? null,
              label: activeDevice?.label ?? null,
              groupId: activeDevice?.groupId ?? null,
              facingMode: attempt.facingMode ?? mode,
              stage: attempt.stage,
              updatedAt: Date.now(),
            };
            rememberedAcquisitionRef.current = nextLastKnownGoodAcquisition;
            setLastKnownGoodAcquisition(nextLastKnownGoodAcquisition);
            lastStartOverridesRef.current = {
              ...lastStartOverridesRef.current,
              lastKnownGoodAcquisition: nextLastKnownGoodAcquisition,
            };

            const usedRememberedPlan = startedWithRememberedRef.current && attemptedStages.length === 1;
            setAcquisitionDiagnostics({
              currentStage: usedRememberedPlan ? 'remembered-device' : attempt.stage,
              attemptedStages,
              lastFailureStage: failureStage,
              lastFailureMessage: lastError instanceof Error ? lastError.message : null,
              stalePreferredDevice: plan.stalePreferredDevice,
              staleRememberedDevice: plan.staleRememberedDevice,
              usedRememberedPlan,
              activeDevice,
            });
            lastError = null;
            break;
          } catch (attemptError) {
            lastError = attemptError;
            failureStage = attempt.stage;
            setAcquisitionDiagnostics({
              currentStage: attempt.stage,
              attemptedStages: [...attemptedStages],
              lastFailureStage: attempt.stage,
              lastFailureMessage: attemptError instanceof Error ? attemptError.message : 'Unknown camera error',
              stalePreferredDevice: plan.stalePreferredDevice,
              staleRememberedDevice: plan.staleRememberedDevice,
              usedRememberedPlan: false,
              activeDevice: resolveAttemptDevice(attempt, knownDevices),
            });
          }
        }

        if (lastError) {
          throw lastError;
        }
      } catch (err) {
        const classified = classifyError(err);
        setError(classified.message);
        setErrorType(classified.type);
        shouldResumeOnVisibleRef.current = false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      applyProfileToTrack,
      clearStream,
      conservativeCapabilities,
      facingMode,
      initialResolution,
      isSupported,
      listVideoDevices,
    ],
  );

  const applyProfileLayers = useCallback(async (
    layers: UseCameraOptions['profileLayers'],
  ) => {
    profileLayersRef.current = layers;

    const currentStream = streamRef.current;
    if (!currentStream) {
      await start({ profileLayers: layers });
      return;
    }

    const track = currentStream.getVideoTracks()[0];
    if (!track) {
      await start({ profileLayers: layers });
      return;
    }

    const capabilityMap = normalizeARCameraCapabilities(
      track,
      navigator.mediaDevices.getSupportedConstraints?.(),
    );
    setNormalizedCapabilities(capabilityMap);

    const resolved = resolveProfile(layers, capabilityMap);
    if (!resolved) return;

    const requiresRestart = hasSignificantARCameraProfileDelta(
      effectiveProfile,
      resolved.profile,
    );

    if (requiresRestart) {
      await start({
        profileLayers: layers,
        facingMode: resolved.profile.facingMode,
      });
      return;
    }

    await applyProfileToTrack(track, resolved, capabilityMap);
  }, [applyProfileToTrack, effectiveProfile, start]);

  // Switch between front and back cameras or cycle known device list
  const switchCamera = useCallback(async () => {
    if (devices.length > 1) {
      const activeDeviceId = acquisitionDiagnostics.activeDevice?.deviceId ?? lastKnownGoodAcquisition?.deviceId ?? null;
      const currentIndex = devices.findIndex((device) => device.deviceId === activeDeviceId);
      const nextDevice = devices[(currentIndex + 1 + devices.length) % devices.length];
      await start({
        preferredDevice: {
          deviceId: nextDevice.deviceId,
          label: nextDevice.label,
          groupId: nextDevice.groupId,
        },
        facingMode,
      });
      return;
    }

    const newMode: CoreFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    await start({ facingMode: newMode });
  }, [acquisitionDiagnostics.activeDevice?.deviceId, devices, facingMode, lastKnownGoodAcquisition?.deviceId, start]);

  // Set specific facing mode
  const setFacingMode = useCallback(
    async (mode: CoreFacingMode) => {
      if (mode !== facingMode) {
        await start({ facingMode: mode });
      }
    },
    [facingMode, start],
  );

  // Capture a photo from the video element
  const capture = useCallback(
    (
      videoRef: React.RefObject<HTMLVideoElement | null>,
      canvasRef: React.RefObject<HTMLCanvasElement | null>,
      quality = 0.92,
    ) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Mirror front camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0);

      // Reset transform
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Convert to file synchronously via base64
      const byteString = atob(dataUrl.split(',')[1]);
      const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

      return {
        file,
        dataUrl,
        width: video.videoWidth,
        height: video.videoHeight,
      };
    },
    [facingMode],
  );

  // Set zoom level
  const setZoom = useCallback(
    async (level: number) => {
      if (!streamRef.current || !capabilities.zoom) return;

      const track = streamRef.current.getVideoTracks()[0];
      if (!track) return;

      const clamped = Math.min(Math.max(level, capabilities.zoom.min), capabilities.zoom.max);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
        });
        setZoomLevel(clamped);
        savedZoomRef.current = clamped;
      } catch {
        // Zoom not supported
      }
    },
    [capabilities.zoom],
  );

  // Toggle torch / flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !capabilities.torch) return;

    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    const newTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: newTorchState } as MediaTrackConstraintSet],
      });
      setTorchOn(newTorchState);
      savedTorchRef.current = newTorchState;
    } catch {
      // Torch not supported
    }
  }, [capabilities.torch, torchOn]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resumeInFlightRef.current = false;
        if (streamRef.current) {
          clearStream(true);
        }
        return;
      }

      if (!shouldResumeOnVisibleRef.current || streamRef.current || isLoading) {
        return;
      }

      if (visibilityResumeTimerRef.current !== null) {
        window.clearTimeout(visibilityResumeTimerRef.current);
      }

      visibilityResumeTimerRef.current = window.setTimeout(() => {
        visibilityResumeTimerRef.current = null;

        if (resumeInFlightRef.current || streamRef.current || isLoading || !shouldResumeOnVisibleRef.current) {
          return;
        }

        resumeInFlightRef.current = true;
        void start(lastStartOverridesRef.current).finally(() => {
          resumeInFlightRef.current = false;
        });
      }, VISIBILITY_RESUME_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityResumeTimerRef.current !== null) {
        window.clearTimeout(visibilityResumeTimerRef.current);
        visibilityResumeTimerRef.current = null;
      }
      resumeInFlightRef.current = false;
    };
  }, [clearStream, isLoading, start]);

  const normalizedAcquisitionDiagnostics = useMemo(() => ({
    ...acquisitionDiagnostics,
    usedRememberedPlan:
      acquisitionDiagnostics.currentStage === 'remembered-device' || acquisitionDiagnostics.usedRememberedPlan,
  }), [acquisitionDiagnostics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearStream(false);
    };
  }, [clearStream]);

  return {
    stream,
    isLoading,
    error,
    errorType,
    facingMode,
    devices,
    capabilities,
    normalizedCapabilities,
    effectiveProfile,
    profileResolution,
    profileApplyError,
    profileFallbackReason,
    lastKnownGoodProfile,
    lastKnownGoodAcquisition,
    acquisitionDiagnostics: normalizedAcquisitionDiagnostics,
    isSupported,
    hasMultipleCameras,
    zoomLevel,
    torchOn,
    start,
    stop,
    switchCamera,
    setFacingMode,
    applyProfileLayers,
    capture,
    setZoom,
    toggleTorch,
    enumerateDevices: enumerateDevicesAction,
  };
}
