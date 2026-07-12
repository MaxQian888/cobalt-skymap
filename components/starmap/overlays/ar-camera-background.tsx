'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, SwitchCamera, Flashlight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/lib/hooks/use-camera';
import { useARSessionStatus } from '@/lib/hooks/use-ar-session-status';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useSettingsStore } from '@/lib/stores';
import {
  applyARAdaptiveLearnerEvent,
  buildARAdaptiveTelemetryPayload,
  deriveARAdaptiveAdjustments,
} from '@/lib/core/ar-adaptive-learner';
import { deriveARSessionCameraDefaults } from '@/lib/core/ar-adaptation';
import {
  fetchAROptimizationPack,
  syncARLearningTelemetry,
  type AROptimizationPack,
} from '@/lib/services/ar-optimization-pack-service';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import { useARAdaptation } from '@/lib/hooks/use-ar-adaptation';
import { getARSurfaceLayoutTokens, withSafeAreaInset } from '@/lib/constants/ar-layout';

const logger = createLogger('ar-camera-background');

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

  if (
    left !== null &&
    right !== null &&
    typeof left === 'object' &&
    typeof right === 'object'
  ) {
    const leftEntries = Object.entries(left);
    const rightEntries = Object.entries(right);

    if (leftEntries.length !== rightEntries.length) {
      return false;
    }

    return leftEntries.every(([key, value]) =>
      Object.prototype.hasOwnProperty.call(right, key)
      && areValuesEqual(value, (right as Record<string, unknown>)[key]),
    );
  }

  return false;
}

interface ARCameraBackgroundProps {
  enabled: boolean;
  className?: string;
}

export function ARCameraBackground({ enabled, className }: ARCameraBackgroundProps) {
  const t = useTranslations();
  const adaptation = useARAdaptation();
  const cameraControlLayout = getARSurfaceLayoutTokens('camera-controls', adaptation.cameraControlMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handledRetryRequestRef = useRef(0);
  const handledSwitchCameraRequestRef = useRef(0);
  const handledRevertProfileRequestRef = useRef(0);
  const recordedManualProfileSignatureRef = useRef<string | null>(null);
  const lastStartSignatureRef = useRef<string | null>(null);

  const stellarium = useSettingsStore((state) => state.stellarium);
  const setStellariumSetting = useSettingsStore((state) => state.setStellariumSetting);

  const [remotePack, setRemotePack] = useState<AROptimizationPack | null>(null);

  const adaptiveAdjustments = useMemo(
    () => deriveARAdaptiveAdjustments(stellarium.arAdaptiveLearnerState, {
      enabled: Boolean(stellarium.arAdaptiveLearningEnabled),
    }),
    [stellarium.arAdaptiveLearnerState, stellarium.arAdaptiveLearningEnabled],
  );
  const sessionDefaults = useMemo(
    () => deriveARSessionCameraDefaults(adaptation),
    [adaptation],
  );

  const profileLayers = useMemo(() => ({
    basePreset: stellarium.arCameraPreset ?? 'balanced',
    sessionDefaults,
    userOverrides: {
      facingMode: stellarium.arCameraFacingMode ?? 'environment',
      resolutionTier: stellarium.arCameraResolutionTier ?? '1080p',
      targetFps: stellarium.arCameraTargetFps ?? 30,
      overlayOpacity: stellarium.arOpacity,
      stabilizationStrength: stellarium.arCameraStabilizationStrength ?? 0.6,
      sensorSmoothingFactor: stellarium.sensorSmoothingFactor,
      calibrationSensitivity: stellarium.arCameraCalibrationSensitivity ?? 0.5,
      zoomLevel: stellarium.arCameraZoomLevel ?? 1,
      torchPreferred: stellarium.arCameraTorchPreferred ?? false,
    },
    adaptiveAdjustments,
    remoteHints: remotePack?.hints,
  }), [
    adaptiveAdjustments,
    sessionDefaults,
    remotePack?.hints,
    stellarium.arCameraFacingMode,
    stellarium.arCameraPreset,
    stellarium.arCameraResolutionTier,
    stellarium.arCameraStabilizationStrength,
    stellarium.arCameraTargetFps,
    stellarium.arCameraCalibrationSensitivity,
    stellarium.arCameraTorchPreferred,
    stellarium.arCameraZoomLevel,
    stellarium.arOpacity,
    stellarium.sensorSmoothingFactor,
  ]);

  const profileSignature = useMemo(
    () => JSON.stringify(profileLayers),
    [profileLayers],
  );
  const preferredDevice = stellarium.arCameraPreferredDevice ?? null;
  const rememberedAcquisition = stellarium.arCameraLastKnownGoodAcquisition ?? null;
  const startRequestSignature = useMemo(
    () => [
      enabled ? 'enabled' : 'disabled',
      profileSignature,
      preferredDevice?.deviceId ?? 'system-default',
      preferredDevice?.groupId ?? 'no-group',
    ].join('|'),
    [
      enabled,
      preferredDevice?.deviceId,
      preferredDevice?.groupId,
      profileSignature,
    ],
  );

  const camera = useCamera({
    facingMode: profileLayers.userOverrides.facingMode,
    profileLayers,
    preferredDevice: stellarium.arCameraPreferredDevice ?? null,
    lastKnownGoodAcquisition: stellarium.arCameraLastKnownGoodAcquisition ?? null,
  });
  const {
    stream: cameraStream,
    isLoading: cameraIsLoading,
    error: cameraError,
    errorType: cameraErrorType,
    facingMode: cameraFacingMode,
    devices: cameraDevices,
    capabilities: cameraCapabilities,
    normalizedCapabilities,
    effectiveProfile,
    profileApplyError,
    profileFallbackReason,
    lastKnownGoodProfile,
    lastKnownGoodAcquisition,
    acquisitionDiagnostics,
    isSupported: cameraIsSupported,
    hasMultipleCameras,
    torchOn,
    start: startCamera,
    stop: stopCamera,
    switchCamera,
    applyProfileLayers: applyCameraProfileLayers,
    toggleTorch,
  } = camera;
  const arSession = useARSessionStatus({ enabled });

  const setCameraRuntime = useARRuntimeStore((state) => state.setCameraRuntime);
  const resetCameraRuntime = useARRuntimeStore((state) => state.resetCameraRuntime);
  const retryCameraRequestVersion = useARRuntimeStore((state) => state.recoveryRequestVersion['retry-camera']);
  const switchCameraRequestVersion = useARRuntimeStore((state) => state.recoveryRequestVersion['switch-camera']);
  const revertProfileRequestVersion = useARRuntimeStore(
    (state) => state.recoveryRequestVersion['revert-last-known-good-profile'],
  );
  const setRecoveryNoticeKey = useARRuntimeStore((state) => state.setRecoveryNoticeKey);

  useEffect(() => {
    if (!enabled || !stellarium.arNetworkOptimizationEnabled) {
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      const packUrl = process.env.NEXT_PUBLIC_AR_OPTIMIZATION_PACK_URL
        ?? '/api/ar/optimization-pack';
      const result = await fetchAROptimizationPack({
        enabled: true,
        url: packUrl,
        timeoutMs: 4000,
        currentVersion: stellarium.arRemotePackVersion,
      });

      if (controller.signal.aborted) return;

      if (result.pack) {
        setRemotePack(result.pack);
        setStellariumSetting('arRemotePackVersion', result.pack.version);
        setStellariumSetting('arRemotePackUpdatedAt', Date.now());
      }

      if (result.error) {
        logger.warn('AR optimization pack fallback triggered', {
          source: result.source,
          error: result.error,
        });
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [
    enabled,
    stellarium.arNetworkOptimizationEnabled,
    stellarium.arRemotePackVersion,
    setStellariumSetting,
  ]);

  useEffect(() => {
    if (!enabled || !stellarium.arTelemetryOptIn) return;

    const telemetryUrl = process.env.NEXT_PUBLIC_AR_LEARNING_TELEMETRY_URL
      ?? '/api/ar/learning-telemetry';

    const payload = buildARAdaptiveTelemetryPayload(stellarium.arAdaptiveLearnerState);
    void syncARLearningTelemetry({
      enabled: true,
      url: telemetryUrl,
      payload,
      timeoutMs: 3000,
    }).then((result) => {
      if (!result.ok && result.error) {
        logger.warn('AR learning telemetry sync failed', { error: result.error });
      }
    });
  }, [
    enabled,
    stellarium.arAdaptiveLearnerState,
    stellarium.arTelemetryOptIn,
  ]);

  // Start/stop camera based on enabled prop
  useEffect(() => {
    if (enabled) {
      if (lastStartSignatureRef.current === startRequestSignature) {
        return;
      }
      lastStartSignatureRef.current = startRequestSignature;
      void startCamera({
        profileLayers,
        preferredDevice,
        lastKnownGoodAcquisition: rememberedAcquisition,
      });
      setRecoveryNoticeKey(null);
    } else {
      lastStartSignatureRef.current = null;
      stopCamera();
    }
  }, [
    enabled,
    preferredDevice,
    profileLayers,
    rememberedAcquisition,
    setRecoveryNoticeKey,
    startRequestSignature,
    startCamera,
    stopCamera,
  ]);

  // Keep the latest applyProfileLayers callback without letting its identity churn
  // re-fire the apply effect below. That callback closes over `effectiveProfile`,
  // which it sets itself (apply -> setEffectiveProfile). Depending on its identity
  // here created an infinite setState loop: apply -> setEffectiveProfile -> new
  // callback identity -> effect re-runs -> apply -> ... ("Maximum update depth").
  const applyCameraProfileLayersRef = useRef(applyCameraProfileLayers);
  useEffect(() => {
    applyCameraProfileLayersRef.current = applyCameraProfileLayers;
  }, [applyCameraProfileLayers]);

  useEffect(() => {
    if (!enabled || !cameraStream) return;
    void applyCameraProfileLayersRef.current(profileLayers);
    // `profileLayers` is stably memoized (all inputs are memoized/primitive), and
    // `profileSignature` is derived from it via useMemo, so listing the signature
    // here as well was redundant — the object dep alone gates re-applies.
  }, [cameraStream, enabled, profileLayers]);

  useEffect(() => {
    if (!enabled) {
      resetCameraRuntime();
      return;
    }

    setCameraRuntime({
      isSupported: cameraIsSupported,
      isLoading: cameraIsLoading,
      hasStream: Boolean(cameraStream),
      errorType: cameraErrorType,
      capabilityMap: normalizedCapabilities,
      effectiveProfile,
      profileApplyError,
      profileFallbackReason,
      lastKnownGoodProfile,
      lastKnownGoodAcquisition,
      availableDevices: cameraDevices,
      acquisitionDiagnostics,
    });
  }, [
    acquisitionDiagnostics,
    cameraDevices,
    cameraErrorType,
    cameraIsLoading,
    cameraIsSupported,
    cameraStream,
    enabled,
    effectiveProfile,
    lastKnownGoodAcquisition,
    lastKnownGoodProfile,
    normalizedCapabilities,
    profileApplyError,
    profileFallbackReason,
    resetCameraRuntime,
    setCameraRuntime,
  ]);

  useEffect(() => {
    if (
      lastKnownGoodAcquisition &&
      !areValuesEqual(stellarium.arCameraLastKnownGoodAcquisition, lastKnownGoodAcquisition)
    ) {
      setStellariumSetting('arCameraLastKnownGoodAcquisition', lastKnownGoodAcquisition);
    }
    if (
      acquisitionDiagnostics.stalePreferredDevice &&
      !areValuesEqual(stellarium.arCameraPreferredDevice, {
        deviceId: null,
        label: null,
        groupId: null,
      })
    ) {
      setStellariumSetting('arCameraPreferredDevice', {
        deviceId: null,
        label: null,
        groupId: null,
      });
    }
    if (
      acquisitionDiagnostics.staleRememberedDevice &&
      !areValuesEqual(stellarium.arCameraLastKnownGoodAcquisition, {
        deviceId: null,
        label: null,
        groupId: null,
        facingMode: 'environment',
        stage: null,
        updatedAt: null,
      })
    ) {
      setStellariumSetting('arCameraLastKnownGoodAcquisition', {
        deviceId: null,
        label: null,
        groupId: null,
        facingMode: 'environment',
        stage: null,
        updatedAt: null,
      });
    }
  }, [
    acquisitionDiagnostics.stalePreferredDevice,
    acquisitionDiagnostics.staleRememberedDevice,
    lastKnownGoodAcquisition,
    stellarium.arCameraLastKnownGoodAcquisition,
    stellarium.arCameraPreferredDevice,
    setStellariumSetting,
  ]);

  useEffect(() => {
    if (retryCameraRequestVersion === handledRetryRequestRef.current) return;
    handledRetryRequestRef.current = retryCameraRequestVersion;
    if (!enabled) return;
    lastStartSignatureRef.current = startRequestSignature;
    void startCamera({
      profileLayers,
      preferredDevice,
      lastKnownGoodAcquisition: rememberedAcquisition,
    });
    if (stellarium.arAdaptiveLearningEnabled) {
      const nextState = applyARAdaptiveLearnerEvent(stellarium.arAdaptiveLearnerState, {
        type: 'session_summary',
        averageFps: effectiveProfile?.targetFps ?? (stellarium.arCameraTargetFps ?? 30),
        recoveryActionsPerSession: 1,
      });
      setStellariumSetting('arAdaptiveLearnerState', nextState);
    }
    setRecoveryNoticeKey(null);
  }, [
    enabled,
    effectiveProfile?.targetFps,
    preferredDevice,
    profileLayers,
    rememberedAcquisition,
    retryCameraRequestVersion,
    setRecoveryNoticeKey,
    setStellariumSetting,
    startRequestSignature,
    startCamera,
    stellarium.arAdaptiveLearnerState,
    stellarium.arAdaptiveLearningEnabled,
    stellarium.arCameraTargetFps,
  ]);

  useEffect(() => {
    if (switchCameraRequestVersion === handledSwitchCameraRequestRef.current) return;
    handledSwitchCameraRequestRef.current = switchCameraRequestVersion;
    if (!enabled) return;
    void switchCamera();
  }, [enabled, switchCameraRequestVersion, switchCamera]);

  useEffect(() => {
    if (revertProfileRequestVersion === handledRevertProfileRequestRef.current) return;
    handledRevertProfileRequestRef.current = revertProfileRequestVersion;

    if (!enabled) return;
    const lastGood = lastKnownGoodProfile;
    if (!lastGood) {
      setRecoveryNoticeKey('settings.arRecoveryNoKnownGoodProfile');
      return;
    }

    setStellariumSetting('arCameraFacingMode', lastGood.facingMode);
    setStellariumSetting('arCameraResolutionTier', lastGood.resolutionTier);
    setStellariumSetting('arCameraTargetFps', lastGood.targetFps);
    setStellariumSetting('arOpacity', lastGood.overlayOpacity);
    setStellariumSetting('arCameraStabilizationStrength', lastGood.stabilizationStrength);
    setStellariumSetting('sensorSmoothingFactor', lastGood.sensorSmoothingFactor);
    setStellariumSetting('arCameraCalibrationSensitivity', lastGood.calibrationSensitivity);
    setStellariumSetting('arCameraZoomLevel', lastGood.zoomLevel);
    setStellariumSetting('arCameraTorchPreferred', lastGood.torchPreferred);
    if (stellarium.arAdaptiveLearningEnabled) {
      const nextState = applyARAdaptiveLearnerEvent(stellarium.arAdaptiveLearnerState, {
        type: 'session_summary',
        averageFps: lastGood.targetFps,
        recoveryActionsPerSession: 1,
      });
      setStellariumSetting('arAdaptiveLearnerState', nextState);
    }
    setRecoveryNoticeKey(null);
  }, [
    enabled,
    lastKnownGoodProfile,
    revertProfileRequestVersion,
    setRecoveryNoticeKey,
    setStellariumSetting,
    stellarium.arAdaptiveLearnerState,
    stellarium.arAdaptiveLearningEnabled,
  ]);

  useEffect(() => {
    if (!enabled || !effectiveProfile) return;

    if (!stellarium.arAdaptiveLearningEnabled) return;
    const signature = `${effectiveProfile.resolutionTier}:${effectiveProfile.targetFps}:${effectiveProfile.stabilizationStrength.toFixed(2)}:${effectiveProfile.sensorSmoothingFactor.toFixed(2)}:${effectiveProfile.calibrationSensitivity.toFixed(2)}`;
    if (recordedManualProfileSignatureRef.current === signature) return;
    const shouldRecordManualOverride =
      profileLayers.userOverrides.targetFps === effectiveProfile.targetFps
      && profileLayers.userOverrides.resolutionTier === effectiveProfile.resolutionTier;

    if (!shouldRecordManualOverride) return;

    const nextState = applyARAdaptiveLearnerEvent(stellarium.arAdaptiveLearnerState, {
      type: 'manual_profile_override',
      overrides: {
        targetFps: effectiveProfile.targetFps,
        resolutionTier: effectiveProfile.resolutionTier,
        stabilizationStrength: effectiveProfile.stabilizationStrength,
        sensorSmoothingFactor: effectiveProfile.sensorSmoothingFactor,
        calibrationSensitivity: effectiveProfile.calibrationSensitivity,
      },
    });

    setStellariumSetting('arAdaptiveLearnerState', nextState);
    recordedManualProfileSignatureRef.current = signature;
  }, [
    enabled,
    effectiveProfile,
    profileLayers.userOverrides.resolutionTier,
    profileLayers.userOverrides.targetFps,
    setStellariumSetting,
    stellarium.arAdaptiveLearnerState,
    stellarium.arAdaptiveLearningEnabled,
  ]);

  useEffect(() => () => {
    resetCameraRuntime();
  }, [resetCameraRuntime]);

  // Attach stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !cameraStream) return;
    video.srcObject = cameraStream;
  }, [cameraStream]);

  if (!enabled) return null;

  // Error state
  if (cameraError) {
    return (
      <div className={cn('absolute inset-0 z-0 flex items-center justify-center bg-black/90', className)}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-300">
            {cameraErrorType === 'permission-denied'
              ? t('settings.arCameraPermission')
              : cameraErrorType === 'not-supported'
                ? t('settings.arNotSupported')
                : t('settings.arCameraError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void startCamera({ profileLayers })}
          >
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 z-0', className)}>
      <video
        ref={videoRef}
        className={cn(
          'w-full h-full object-cover',
          cameraFacingMode === 'user' && 'scale-x-[-1]'
        )}
        autoPlay
        playsInline
        muted
        aria-label="AR camera background"
      />

      {arSession.status !== 'ready' && (
        <div className="absolute left-2 top-2 z-10 rounded-md bg-black/40 px-2 py-1 text-[10px] text-white/90 backdrop-blur-sm">
          {arSession.status === 'preflight'
            ? t('settings.arStatusPreflight')
            : arSession.status === 'degraded-camera-only'
              ? t('settings.arStatusDegradedCameraOnly')
              : arSession.status === 'degraded-sensor-only'
                ? t('settings.arStatusDegradedSensorOnly')
                : t('settings.arStatusBlocked')}
        </div>
      )}

      {profileFallbackReason && (
        <div className="absolute left-2 top-8 z-10 rounded-md bg-amber-500/25 px-2 py-1 text-[10px] text-amber-100 backdrop-blur-sm">
          {t('settings.arCameraFallbackApplied')}
        </div>
      )}

      {/* Camera controls overlay */}
      {cameraStream && (
        <div
          className={cn(
            'absolute z-10 flex',
            adaptation.runtimeClass === 'browser-mobile' ? 'flex-col' : 'flex-row items-center',
          )}
          data-testid="ar-camera-controls"
          data-ar-camera-controls-mode={adaptation.cameraControlMode}
          data-ar-operating-mode={adaptation.operatingMode}
          data-ar-runtime-class={adaptation.runtimeClass}
          style={{
            top: withSafeAreaInset('top', cameraControlLayout.topOffsetRem),
            right: withSafeAreaInset('right', cameraControlLayout.sideInsetRem),
            gap: `${cameraControlLayout.gapRem}rem`,
          }}
        >
          {hasMultipleCameras && (
            <Button
              variant="secondary"
              size="icon"
              className={cn(
                'rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60',
                adaptation.runtimeClass === 'browser-mobile' ? 'h-11 w-11' : 'h-9 w-9',
              )}
              onClick={() => void switchCamera()}
              aria-label={t('common.switchCamera') ?? 'Switch camera'}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          {cameraCapabilities.torch && (
            <Button
              variant={torchOn ? 'default' : 'secondary'}
              size="icon"
              className={cn(
                'rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60',
                adaptation.runtimeClass === 'browser-mobile' ? 'h-11 w-11' : 'h-9 w-9',
              )}
              onClick={() => void toggleTorch()}
              aria-label="Torch"
            >
              <Flashlight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Loading state */}
      {cameraIsLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="flex flex-col items-center gap-2">
            <Camera className="h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
