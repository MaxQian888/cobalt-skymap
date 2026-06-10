'use client';

import { useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSettingsStore } from '@/lib/stores';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { useARSessionStatus } from '@/lib/hooks/use-ar-session-status';
import { useDeviceOrientation } from '@/lib/hooks/use-device-orientation';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useARAdaptation } from '@/lib/hooks/use-ar-adaptation';
import {
  deriveARInvocationSeed,
  getARLaunchAssistantReason,
} from '@/lib/core/ar-invocation';
import { cn } from '@/lib/utils';
import { TOOLBAR_ICON_RESTING_CLASS } from './toolbar-button';

interface ARModeToggleProps {
  className?: string;
}

interface SavedSettings {
  atmosphereVisible: boolean;
  landscapesVisible: boolean;
  fogVisible: boolean;
  milkyWayVisible: boolean;
  sensorControl: boolean;
}

export function ARModeToggle({ className }: ARModeToggleProps) {
  const t = useTranslations();
  const isClient = useIsClient();
  const stellarium = useSettingsStore((s) => s.stellarium);
  const setStellariumSetting = useSettingsStore((s) => s.setStellariumSetting);
  const adaptation = useARAdaptation();
  const setSensorRuntime = useARRuntimeStore((state) => state.setSensorRuntime);
  const openLaunchAssistant = useARRuntimeStore((state) => state.openLaunchAssistant);
  const closeLaunchAssistant = useARRuntimeStore((state) => state.closeLaunchAssistant);

  const savedSettingsRef = useRef<SavedSettings | null>(null);

  const arMode = stellarium.arMode;
  const arSession = useARSessionStatus({ enabled: arMode });
  const { isSupported, isPermissionGranted } = useDeviceOrientation({
    enabled: false,
    calibration: {
      azimuthOffsetDeg: stellarium.sensorCalibrationAzimuthOffsetDeg,
      altitudeOffsetDeg: stellarium.sensorCalibrationAltitudeOffsetDeg,
      updatedAt: stellarium.sensorCalibrationUpdatedAt,
      required: stellarium.sensorCalibrationRequired,
    },
  });

  const handleToggle = useCallback(async () => {
    if (!arMode) {
      // Save current settings before entering AR
      savedSettingsRef.current = {
        atmosphereVisible: stellarium.atmosphereVisible,
        landscapesVisible: stellarium.landscapesVisible,
        fogVisible: stellarium.fogVisible,
        milkyWayVisible: stellarium.milkyWayVisible,
        sensorControl: stellarium.sensorControl,
      };

      // Enable AR mode + disable opaque layers first.
      setStellariumSetting('arMode', true);
      setStellariumSetting('atmosphereVisible', false);
      setStellariumSetting('landscapesVisible', false);
      setStellariumSetting('fogVisible', false);
      setStellariumSetting('milkyWayVisible', false);
      openLaunchAssistant(getARLaunchAssistantReason('enter-ar'));

      const invocationSeed = deriveARInvocationSeed({
        sensorSupported: isSupported,
        sensorPermissionGranted: isPermissionGranted,
        sensorCalibrationRequired: stellarium.sensorCalibrationRequired,
        runtimeClass: adaptation.runtimeClass,
      });

      setStellariumSetting('sensorControl', invocationSeed.sensorControlEnabled);
      setSensorRuntime(invocationSeed.sensorRuntime);
    } else {
      // Exit AR mode
      setStellariumSetting('arMode', false);
      closeLaunchAssistant();

      // Restore previous settings
      const saved = savedSettingsRef.current;
      if (saved) {
        setStellariumSetting('atmosphereVisible', saved.atmosphereVisible);
        setStellariumSetting('landscapesVisible', saved.landscapesVisible);
        setStellariumSetting('fogVisible', saved.fogVisible);
        setStellariumSetting('milkyWayVisible', saved.milkyWayVisible);
        setStellariumSetting('sensorControl', saved.sensorControl);
        savedSettingsRef.current = null;
      }
    }
  }, [
    adaptation.runtimeClass,
    arMode,
    isPermissionGranted,
    isSupported,
    openLaunchAssistant,
    closeLaunchAssistant,
    setSensorRuntime,
    setStellariumSetting,
    stellarium,
  ]);

  if (!isClient) return null;

  const tooltipText = !arMode
    ? t('settings.arModeEnable')
    : arSession.status === 'ready'
      ? t('settings.arModeDisable')
      : arSession.status === 'preflight'
        ? t('settings.arStatusPreflight')
        : arSession.status === 'blocked' && adaptation.operatingMode === 'manual-first'
          ? t('settings.arAdaptationManualOnly')
        : arSession.status === 'blocked' && adaptation.sensorPath === 'camera-primary'
          ? t('settings.arAdaptationCameraFirst')
        : arSession.status === 'degraded-camera-only'
          ? t('settings.arStatusDegradedCameraOnly')
          : arSession.status === 'degraded-sensor-only'
            ? t('settings.arStatusDegradedSensorOnly')
            : t('settings.arStatusBlocked');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tooltipText}
          data-testid="ar-mode-toggle"
          data-ar-session-status={arSession.status}
          data-ar-sensor-path={adaptation.sensorPath}
          data-ar-operating-mode={adaptation.operatingMode}
          className={cn(
            'relative h-9 w-9 backdrop-blur-md transition-colors',
            arMode && arSession.status === 'ready'
              ? 'bg-blue-500/30 text-blue-400 hover:bg-blue-500/40'
              : arMode && arSession.status === 'preflight'
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                : arMode
                  ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                  : TOOLBAR_ICON_RESTING_CLASS,
            className
          )}
          onClick={() => void handleToggle()}
        >
          <Camera className={cn('h-5 w-5', arMode && arSession.status !== 'blocked' && 'animate-pulse')} />
          {arMode && (
            <span
              className={cn(
                'absolute right-1 top-1 h-2 w-2 rounded-full',
                arSession.status === 'ready'
                  ? 'bg-blue-500'
                  : arSession.status === 'preflight'
                    ? 'bg-amber-400'
                    : 'bg-orange-400'
              )}
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
