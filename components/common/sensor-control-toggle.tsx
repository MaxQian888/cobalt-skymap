'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Compass, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { altAzToRaDec } from '@/lib/astronomy/coordinates/transforms';
import { rad2deg } from '@/lib/astronomy/starmap-utils';
import { useMountStore, useSettingsStore, useStellariumStore } from '@/lib/stores';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import {
  useDeviceOrientation,
  type SensorDegradedReason,
  type SkyDirection,
  type SensorCalibrationState,
  type SensorStatus,
} from '@/lib/hooks/use-device-orientation';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { useARSessionStatus } from '@/lib/hooks/use-ar-session-status';
import { isTauri } from '@/lib/tauri/app-control-api';
import { cn } from '@/lib/utils';
import { SensorCalibrationDialog } from './sensor-calibration-dialog';

const DESKTOP_CAMERA_FIRST_NOTICE = 'Desktop AR defaults to camera-first mode until sensor data is confirmed.';

interface SensorControlToggleProps {
  className?: string;
  showStatusLabel?: boolean;
}

function getStatusClass(status: SensorStatus): string {
  switch (status) {
    case 'active':
      return 'bg-emerald-500';
    case 'calibration-required':
      return 'bg-amber-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'permission-denied':
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-muted-foreground';
  }
}

export function SensorControlToggle({ className, showStatusLabel = false }: SensorControlToggleProps) {
  const t = useTranslations();
  const stellarium = useSettingsStore((state) => state.stellarium);
  const sensorControl = stellarium.sensorControl;
  const toggleStellariumSetting = useSettingsStore((state) => state.toggleStellariumSetting);
  const setStellariumSetting = useSettingsStore((state) => state.setStellariumSetting);
  const profileInfo = useMountStore((state) => state.profileInfo);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const getCurrentViewDirection = useStellariumStore((state) => state.getCurrentViewDirection);
  const viewDirection = useStellariumStore((state) => state.viewDirection);
  const setSensorRuntime = useARRuntimeStore((state) => state.setSensorRuntime);
  const resetSensorRuntime = useARRuntimeStore((state) => state.resetSensorRuntime);
  const requestSensorPermissionVersion = useARRuntimeStore(
    (state) => state.recoveryRequestVersion['request-sensor-permission']
  );
  const requestSensorCalibrationVersion = useARRuntimeStore(
    (state) => state.recoveryRequestVersion['calibrate-sensor']
  );
  const setRecoveryNoticeKey = useARRuntimeStore((state) => state.setRecoveryNoticeKey);
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const handledPermissionRequestRef = useRef(0);
  const handledCalibrationRequestRef = useRef(0);
  
  // Track if component is on client to avoid hydration mismatch
  const isClient = useIsClient();

  // Handle orientation change - update view direction
  const handleOrientationChange = useCallback((direction: SkyDirection) => {
    if (!setViewDirection) return;

    const latitude = profileInfo.AstrometrySettings.Latitude;
    const longitude = profileInfo.AstrometrySettings.Longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    try {
      const { ra, dec } = altAzToRaDec(
        direction.altitude,
        direction.azimuth,
        latitude,
        longitude
      );
      if (Number.isFinite(ra) && Number.isFinite(dec)) {
        setViewDirection(ra, dec);
      }
    } catch {
      // Ignore conversion errors
    }
  }, [setViewDirection, profileInfo.AstrometrySettings.Latitude, profileInfo.AstrometrySettings.Longitude]);

  const currentCalibration = useMemo<SensorCalibrationState>(() => ({
    azimuthOffsetDeg: stellarium.sensorCalibrationAzimuthOffsetDeg,
    altitudeOffsetDeg: stellarium.sensorCalibrationAltitudeOffsetDeg,
    updatedAt: stellarium.sensorCalibrationUpdatedAt,
    required: stellarium.sensorCalibrationRequired,
  }), [
    stellarium.sensorCalibrationAzimuthOffsetDeg,
    stellarium.sensorCalibrationAltitudeOffsetDeg,
    stellarium.sensorCalibrationUpdatedAt,
    stellarium.sensorCalibrationRequired,
  ]);

  const handleCalibrationChange = useCallback((nextCalibration: SensorCalibrationState) => {
    setStellariumSetting('sensorCalibrationAzimuthOffsetDeg', nextCalibration.azimuthOffsetDeg);
    setStellariumSetting('sensorCalibrationAltitudeOffsetDeg', nextCalibration.altitudeOffsetDeg);
    setStellariumSetting('sensorCalibrationUpdatedAt', nextCalibration.updatedAt);
    setStellariumSetting('sensorCalibrationRequired', nextCalibration.required);
  }, [setStellariumSetting]);

  const {
    isSupported,
    isPermissionGranted,
    status,
    source,
    accuracyDeg,
    degradedReason,
    calibration,
    requestPermission,
    calibrateToCurrentView,
    resetCalibration,
    error,
  } = useDeviceOrientation({
    enabled: sensorControl && isClient,
    smoothingFactor: stellarium.sensorSmoothingFactor,
    updateHz: stellarium.sensorUpdateHz,
    deadbandDeg: stellarium.sensorDeadbandDeg,
    absolutePreferred: stellarium.sensorAbsolutePreferred,
    useCompassHeading: stellarium.sensorUseCompassHeading,
    calibration: currentCalibration,
    onCalibrationChange: handleCalibrationChange,
    onOrientationChange: handleOrientationChange,
  });
  const arSession = useARSessionStatus({ enabled: stellarium.arMode });
  const shouldPreferDesktopCameraFirst =
    stellarium.arMode &&
    !sensorControl &&
    isTauri() &&
    isSupported &&
    isPermissionGranted &&
    status === 'idle' &&
    source === 'none' &&
    !error;

  const projectedSensorRuntime = useMemo(() => {
    if (shouldPreferDesktopCameraFirst) {
      return {
        isSupported: false,
        isPermissionGranted: false,
        status: 'unsupported' as const,
        calibrationRequired: calibration.required,
        degradedReason: null,
        source: 'none' as const,
        accuracyDeg: null,
        error: DESKTOP_CAMERA_FIRST_NOTICE,
      };
    }

    if (stellarium.arMode && !sensorControl && !isPermissionGranted && status === 'idle') {
      return {
        isSupported,
        isPermissionGranted,
        status: 'permission-required' as const,
        calibrationRequired: calibration.required,
        degradedReason,
        source,
        accuracyDeg,
        error,
      };
    }

    return {
      isSupported,
      isPermissionGranted,
      status,
      calibrationRequired: calibration.required,
      degradedReason,
      source,
      accuracyDeg,
      error,
    };
  }, [
    accuracyDeg,
    calibration.required,
    degradedReason,
    error,
    isPermissionGranted,
    isSupported,
    sensorControl,
    shouldPreferDesktopCameraFirst,
    source,
    status,
    stellarium.arMode,
  ]);

  useEffect(() => {
    setSensorRuntime(projectedSensorRuntime);
  }, [projectedSensorRuntime, setSensorRuntime]);

  useEffect(() => {
    if (sensorControl || stellarium.arMode) return;
    resetSensorRuntime();
  }, [resetSensorRuntime, sensorControl, stellarium.arMode]);

  const handleCalibrateNow = useCallback((): boolean => {
    const latitude = profileInfo.AstrometrySettings.Latitude;
    const longitude = profileInfo.AstrometrySettings.Longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return false;
    }

    let current = viewDirection;
    if (!current && getCurrentViewDirection) {
      try {
        current = getCurrentViewDirection();
      } catch {
        current = null;
      }
    }
    if (!current) return false;

    calibrateToCurrentView({
      raDeg: rad2deg(current.ra),
      decDeg: rad2deg(current.dec),
      latitude,
      longitude,
      at: new Date(),
    });
    setCalibrationDialogOpen(false);
    setRecoveryNoticeKey(null);
    return true;
  }, [
    profileInfo.AstrometrySettings.Latitude,
    profileInfo.AstrometrySettings.Longitude,
    viewDirection,
    getCurrentViewDirection,
    calibrateToCurrentView,
    setRecoveryNoticeKey,
  ]);

  const handleRetryPermission = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermission();
    if (granted && !sensorControl) {
      toggleStellariumSetting('sensorControl');
    }
    if (granted) {
      setRecoveryNoticeKey(null);
    }
    return granted;
  }, [requestPermission, sensorControl, setRecoveryNoticeKey, toggleStellariumSetting]);

  useEffect(() => {
    if (requestSensorPermissionVersion === handledPermissionRequestRef.current) return;
    handledPermissionRequestRef.current = requestSensorPermissionVersion;
    void (async () => {
      const granted = await handleRetryPermission();
      if (!granted) {
        setRecoveryNoticeKey('settings.arRecoveryPermissionRequestFailed');
      }
    })();
  }, [handleRetryPermission, requestSensorPermissionVersion, setRecoveryNoticeKey]);

  useEffect(() => {
    if (requestSensorCalibrationVersion === handledCalibrationRequestRef.current) return;
    handledCalibrationRequestRef.current = requestSensorCalibrationVersion;
    const timerId = window.setTimeout(() => {
      const calibrated = handleCalibrateNow();
      if (!calibrated) {
        setRecoveryNoticeKey('settings.arRecoveryCalibrationUnavailable');
      }
    }, 0);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [handleCalibrateNow, requestSensorCalibrationVersion, setRecoveryNoticeKey]);

  const getDegradedReasonText = useCallback((reason: SensorDegradedReason | null) => {
    if (reason === 'relative-source') return t('settings.sensorDegradedRelativeSource');
    if (reason === 'low-confidence') return t('settings.sensorDegradedLowConfidence');
    if (reason === 'stale-sample') return t('settings.sensorDegradedStaleSample');
    return t('settings.sensorStatusDegraded');
  }, [t]);

  // Handle toggle click
  const handleToggle = useCallback(async () => {
    if (!sensorControl) {
      // Turning on - check permission first
      if (!isPermissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      toggleStellariumSetting('sensorControl');
      if (currentCalibration.required) {
        setCalibrationDialogOpen(true);
      }
      return;
    }
    toggleStellariumSetting('sensorControl');
    setCalibrationDialogOpen(false);
  }, [
    sensorControl,
    isPermissionGranted,
    requestPermission,
    toggleStellariumSetting,
    currentCalibration.required,
  ]);

  // Auto-disable if not supported (only after client render)
  useEffect(() => {
    if (isClient && sensorControl && !isSupported) {
      toggleStellariumSetting('sensorControl');
    }
  }, [isClient, sensorControl, isSupported, toggleStellariumSetting]);

  // Don't render until client to avoid hydration mismatch
  if (!isClient) {
    return null;
  }

  const getTooltipText = () => {
    if (!isSupported) return t('settings.sensorStatusUnsupported');
    if (status === 'permission-denied') return t('settings.sensorStatusPermissionDenied');
    if (status === 'permission-required') return t('settings.sensorControlPermission');
    if (status === 'calibration-required') return t('settings.sensorCalibrationRequired');
    if (status === 'degraded') return getDegradedReasonText(degradedReason);
    if (error) return error;
    if (!isPermissionGranted) return t('settings.sensorControlPermission');
    if (status === 'active' && accuracyDeg !== null) {
      return `${t('settings.sensorAccuracy')}: ±${accuracyDeg.toFixed(1)}° (${source})`;
    }
    return sensorControl ? t('settings.sensorControlDisable') : t('settings.sensorControlEnable');
  };

  const statusText = status === 'active'
    ? t('settings.sensorStatusActive')
    : status === 'degraded'
      ? t('settings.sensorStatusDegraded')
    : status === 'permission-denied'
      ? t('settings.sensorStatusPermissionDenied')
      : status === 'calibration-required'
        ? t('settings.sensorCalibrationRequired')
        : !isSupported
          ? t('settings.sensorStatusUnsupported')
          : stellarium.arMode && arSession.status === 'degraded-camera-only'
            ? t('settings.arStatusDegradedCameraOnly')
            : null;

  const button = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={getTooltipText()}
          data-testid="sensor-control-toggle"
          data-sensor-status={status}
          disabled={!isSupported}
          className={cn(
            'relative h-9 w-9 backdrop-blur-sm transition-colors',
            sensorControl
              ? 'bg-primary/30 text-primary hover:bg-primary/40'
              : 'bg-background/60 text-foreground hover:bg-background/80',
            className
          )}
          onClick={handleToggle}
        >
          {sensorControl ? (
            <Compass className="h-5 w-5 animate-pulse" />
          ) : (
            <Smartphone className="h-5 w-5" />
          )}
          <span
            className={cn(
              'absolute right-1 top-1 h-2 w-2 rounded-full',
              getStatusClass(status)
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {showStatusLabel ? (
        <div className="flex flex-col items-center gap-1">
          {button}
          <span className="text-[10px] text-muted-foreground leading-tight text-center">
            {statusText ?? t('settings.sensorControl')}
          </span>
          {status === 'calibration-required' && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px]"
              onClick={handleCalibrateNow}
            >
              {t('settings.sensorCalibrateNow')}
            </Button>
          )}
          {(status === 'permission-required' || status === 'permission-denied') && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px]"
              onClick={() => void handleRetryPermission()}
            >
              {t('settings.sensorRetryPermission')}
            </Button>
          )}
          {status === 'degraded' && (
            <span className="text-[10px] text-muted-foreground leading-tight text-center">
              {getDegradedReasonText(degradedReason)}
            </span>
          )}
          {!calibration.required && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-[10px]"
              onClick={resetCalibration}
            >
              {t('settings.sensorRecalibrate')}
            </Button>
          )}
        </div>
      ) : (
        button
      )}
      <SensorCalibrationDialog
        open={calibrationDialogOpen}
        onOpenChange={setCalibrationDialogOpen}
        onCalibrate={handleCalibrateNow}
      />
    </>
  );
}
