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
  const handledRevertProfileRequestRef = useRef(0);
  const recordedManualProfileSignatureRef = useRef<string | null>(null);

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

  const camera = useCamera({
    facingMode: profileLayers.userOverrides.facingMode,
    profileLayers,
    preferredDevice: stellarium.arCameraPreferredDevice ?? null,
    lastKnownGoodAcquisition: stellarium.arCameraLastKnownGoodAcquisition ?? null,
  });
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
      void camera.start({
        profileLayers,
        preferredDevice: stellarium.arCameraPreferredDevice ?? null,
        lastKnownGoodAcquisition: stellarium.arCameraLastKnownGoodAcquisition ?? null,
      });
      setRecoveryNoticeKey(null);
    } else {
      camera.stop();
    }
  }, [
    camera,
    enabled,
    profileLayers,
    setRecoveryNoticeKey,
    stellarium.arCameraLastKnownGoodAcquisition,
    stellarium.arCameraPreferredDevice,
  ]);

  useEffect(() => {
    if (!enabled || !camera.stream) return;
    void camera.applyProfileLayers(profileLayers);
  }, [camera, enabled, profileSignature, profileLayers]);

  useEffect(() => {
    if (!enabled) {
      resetCameraRuntime();
      return;
    }

    setCameraRuntime({
      isSupported: camera.isSupported,
      isLoading: camera.isLoading,
      hasStream: Boolean(camera.stream),
      errorType: camera.errorType,
      capabilityMap: camera.normalizedCapabilities,
      effectiveProfile: camera.effectiveProfile,
      profileApplyError: camera.profileApplyError,
      profileFallbackReason: camera.profileFallbackReason,
      lastKnownGoodProfile: camera.lastKnownGoodProfile,
      lastKnownGoodAcquisition: camera.lastKnownGoodAcquisition,
      availableDevices: camera.devices,
      acquisitionDiagnostics: camera.acquisitionDiagnostics,
    });
  }, [
    camera.effectiveProfile,
    camera.errorType,
    camera.isLoading,
    camera.isSupported,
    camera.lastKnownGoodProfile,
    camera.lastKnownGoodAcquisition,
    camera.devices,
    camera.acquisitionDiagnostics,
    camera.normalizedCapabilities,
    camera.profileApplyError,
    camera.profileFallbackReason,
    camera.stream,
    enabled,
    resetCameraRuntime,
    setCameraRuntime,
  ]);

  useEffect(() => {
    if (camera.lastKnownGoodAcquisition) {
      setStellariumSetting('arCameraLastKnownGoodAcquisition', camera.lastKnownGoodAcquisition);
    }
    if (camera.acquisitionDiagnostics.stalePreferredDevice) {
      setStellariumSetting('arCameraPreferredDevice', {
        deviceId: null,
        label: null,
        groupId: null,
      });
    }
    if (camera.acquisitionDiagnostics.staleRememberedDevice) {
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
    camera.acquisitionDiagnostics.stalePreferredDevice,
    camera.acquisitionDiagnostics.staleRememberedDevice,
    camera.lastKnownGoodAcquisition,
    setStellariumSetting,
  ]);

  useEffect(() => {
    if (retryCameraRequestVersion === handledRetryRequestRef.current) return;
    handledRetryRequestRef.current = retryCameraRequestVersion;
    if (!enabled) return;
    void camera.start({
      profileLayers,
      preferredDevice: stellarium.arCameraPreferredDevice ?? null,
      lastKnownGoodAcquisition: stellarium.arCameraLastKnownGoodAcquisition ?? null,
    });
    if (stellarium.arAdaptiveLearningEnabled) {
      const nextState = applyARAdaptiveLearnerEvent(stellarium.arAdaptiveLearnerState, {
        type: 'session_summary',
        averageFps: camera.effectiveProfile?.targetFps ?? (stellarium.arCameraTargetFps ?? 30),
        recoveryActionsPerSession: 1,
      });
      setStellariumSetting('arAdaptiveLearnerState', nextState);
    }
    setRecoveryNoticeKey(null);
  }, [
    camera,
    enabled,
    profileLayers,
    retryCameraRequestVersion,
    setRecoveryNoticeKey,
    setStellariumSetting,
    stellarium.arAdaptiveLearnerState,
    stellarium.arAdaptiveLearningEnabled,
    stellarium.arCameraLastKnownGoodAcquisition,
    stellarium.arCameraPreferredDevice,
    stellarium.arCameraTargetFps,
    camera.effectiveProfile?.targetFps,
  ]);

  useEffect(() => {
    if (switchCameraRequestVersion === 0) return;
    if (!enabled) return;
    void camera.switchCamera();
  }, [camera, enabled, switchCameraRequestVersion]);

  useEffect(() => {
    if (revertProfileRequestVersion === handledRevertProfileRequestRef.current) return;
    handledRevertProfileRequestRef.current = revertProfileRequestVersion;

    if (!enabled) return;
    const lastGood = camera.lastKnownGoodProfile;
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
    camera.lastKnownGoodProfile,
    enabled,
    revertProfileRequestVersion,
    setRecoveryNoticeKey,
    setStellariumSetting,
    stellarium.arAdaptiveLearnerState,
    stellarium.arAdaptiveLearningEnabled,
  ]);

  useEffect(() => {
    if (!enabled || !camera.effectiveProfile) return;

    if (!stellarium.arAdaptiveLearningEnabled) return;
    const signature = `${camera.effectiveProfile.resolutionTier}:${camera.effectiveProfile.targetFps}:${camera.effectiveProfile.stabilizationStrength.toFixed(2)}:${camera.effectiveProfile.sensorSmoothingFactor.toFixed(2)}:${camera.effectiveProfile.calibrationSensitivity.toFixed(2)}`;
    if (recordedManualProfileSignatureRef.current === signature) return;
    const shouldRecordManualOverride =
      profileLayers.userOverrides.targetFps === camera.effectiveProfile.targetFps
      && profileLayers.userOverrides.resolutionTier === camera.effectiveProfile.resolutionTier;

    if (!shouldRecordManualOverride) return;

    const nextState = applyARAdaptiveLearnerEvent(stellarium.arAdaptiveLearnerState, {
      type: 'manual_profile_override',
      overrides: {
        targetFps: camera.effectiveProfile.targetFps,
        resolutionTier: camera.effectiveProfile.resolutionTier,
        stabilizationStrength: camera.effectiveProfile.stabilizationStrength,
        sensorSmoothingFactor: camera.effectiveProfile.sensorSmoothingFactor,
        calibrationSensitivity: camera.effectiveProfile.calibrationSensitivity,
      },
    });

    setStellariumSetting('arAdaptiveLearnerState', nextState);
    recordedManualProfileSignatureRef.current = signature;
  }, [
    camera.effectiveProfile,
    enabled,
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
    if (!video || !camera.stream) return;
    video.srcObject = camera.stream;
  }, [camera.stream]);

  if (!enabled) return null;

  // Error state
  if (camera.error) {
    return (
      <div className={cn('absolute inset-0 z-0 flex items-center justify-center bg-black/90', className)}>
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-red-300">
            {camera.errorType === 'permission-denied'
              ? t('settings.arCameraPermission')
              : camera.errorType === 'not-supported'
                ? t('settings.arNotSupported')
                : t('settings.arCameraError')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void camera.start({ profileLayers })}
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
          camera.facingMode === 'user' && 'scale-x-[-1]'
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

      {camera.profileFallbackReason && (
        <div className="absolute left-2 top-8 z-10 rounded-md bg-amber-500/25 px-2 py-1 text-[10px] text-amber-100 backdrop-blur-sm">
          {t('settings.arCameraFallbackApplied')}
        </div>
      )}

      {/* Camera controls overlay */}
      {camera.stream && (
        <div
          className="absolute z-10 flex flex-col"
          data-testid="ar-camera-controls"
          data-ar-camera-controls-mode={adaptation.cameraControlMode}
          style={{
            top: withSafeAreaInset('top', cameraControlLayout.topOffsetRem),
            right: withSafeAreaInset('right', cameraControlLayout.sideInsetRem),
            gap: `${cameraControlLayout.gapRem}rem`,
          }}
        >
          {camera.hasMultipleCameras && (
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60"
              onClick={() => void camera.switchCamera()}
              aria-label={t('common.switchCamera') ?? 'Switch camera'}
            >
              <SwitchCamera className="h-4 w-4" />
            </Button>
          )}
          {camera.capabilities.torch && (
            <Button
              variant={camera.torchOn ? 'default' : 'secondary'}
              size="icon"
              className="h-8 w-8 rounded-full bg-background/40 backdrop-blur-sm hover:bg-background/60"
              onClick={() => void camera.toggleTorch()}
              aria-label="Torch"
            >
              <Flashlight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Loading state */}
      {camera.isLoading && (
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
