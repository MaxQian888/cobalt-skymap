'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Camera, CheckCircle2, Compass, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useOnboardingBridgeStore } from '@/lib/stores';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useARAdaptation } from '@/lib/hooks/use-ar-adaptation';
import { getARSurfaceLayoutTokens, withSafeAreaInset } from '@/lib/constants/ar-layout';
import { executeARRecoveryAction, type ARRecoveryActionHandlers } from '@/lib/core/ar-recovery-actions';
import type { ARRecoveryAction } from '@/lib/core/ar-session';

const RECOVERY_COOLDOWN_MS = 3000;

function getCheckIcon(status: 'pending' | 'pass' | 'warn' | 'block') {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'warn' || status === 'block') return <AlertTriangle className="h-4 w-4 text-amber-300" />;
  return <LoaderCircle className="h-4 w-4 animate-spin text-sky-300" />;
}

function getActionRequestedNoticeKey(action: ARRecoveryAction): string {
  if (action === 'retry-camera') return 'settings.arRecoveryNoticeRetryCameraRequested';
  if (action === 'switch-camera') return 'settings.arRecoveryNoticeSwitchCameraRequested';
  if (action === 'request-sensor-permission') return 'settings.arRecoveryNoticeSensorPermissionRequested';
  if (action === 'calibrate-sensor') return 'settings.arRecoveryNoticeCalibrationRequested';
  if (action === 'open-camera-settings') return 'settings.arRecoveryNoticeOpenCameraSettingsRequested';
  if (action === 'revert-last-known-good-profile') return 'settings.arRecoveryNoticeRevertProfileRequested';
  return 'settings.arRecoveryNoticeDisableArRequested';
}

function getActionFailureNoticeKey(action: ARRecoveryAction): string {
  if (action === 'request-sensor-permission') return 'settings.arRecoveryNoticeSensorPermissionFailed';
  if (action === 'calibrate-sensor') return 'settings.arRecoveryNoticeCalibrationFailed';
  return 'settings.arRecoveryNoticeActionFailed';
}

export function ARLaunchAssistant() {
  const t = useTranslations();
  const adaptation = useARAdaptation();
  const layoutTokens = getARSurfaceLayoutTokens('assistant', adaptation.assistantMode);
  const setStellariumSetting = useSettingsStore((state) => state.setStellariumSetting);
  const openSettingsDrawer = useOnboardingBridgeStore((state) => state.openSettingsDrawer);
  const cameraRuntime = useARRuntimeStore((state) => state.camera);
  const launchAssistant = useARRuntimeStore((state) => state.launchAssistant);
  const closeLaunchAssistant = useARRuntimeStore((state) => state.closeLaunchAssistant);
  const confirmLaunchAssistantDegraded = useARRuntimeStore((state) => state.confirmLaunchAssistantDegraded);
  const requestRecoveryAction = useARRuntimeStore((state) => state.requestRecoveryAction);
  const markLaunchAssistantResumed = useARRuntimeStore((state) => state.markLaunchAssistantResumed);
  const recoveryActionLastFiredAt = useARRuntimeStore((state) => state.recoveryActionLastFiredAt);
  const setRecoveryNoticeKey = useARRuntimeStore((state) => state.setRecoveryNoticeKey);
  const recoveryNoticeKey = useARRuntimeStore((state) => state.recoveryNoticeKey);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!launchAssistant.visible || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markLaunchAssistantResumed();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [launchAssistant.visible, markLaunchAssistantResumed]);

  useEffect(() => {
    const currentNow = Date.now();
    const allActions = launchAssistant.summaryActions;
    const hasActiveCooldown = allActions.some(
      (action) => {
        const lastFiredAt = recoveryActionLastFiredAt[action];
        return typeof lastFiredAt === 'number'
          && lastFiredAt > 0
          && currentNow - lastFiredAt < RECOVERY_COOLDOWN_MS;
      }
    );
    if (!hasActiveCooldown) return;

    const frameId = window.requestAnimationFrame(() => setNow(Date.now()));
    const timerId = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearInterval(timerId);
    };
  }, [launchAssistant.summaryActions, recoveryActionLastFiredAt]);

  const handlers = useMemo<ARRecoveryActionHandlers>(
    () => ({
      onRetryCamera: () => requestRecoveryAction('retry-camera'),
      onSwitchCamera: () => requestRecoveryAction('switch-camera'),
      onRequestSensorPermission: () => requestRecoveryAction('request-sensor-permission'),
      onCalibrateSensor: () => requestRecoveryAction('calibrate-sensor'),
      onOpenCameraSettings: () => openSettingsDrawer('display'),
      onRevertLastKnownGoodProfile: () => requestRecoveryAction('revert-last-known-good-profile'),
      onDisableAr: () => {
        closeLaunchAssistant();
        setStellariumSetting('arMode', false);
      },
    }),
    [closeLaunchAssistant, openSettingsDrawer, requestRecoveryAction, setStellariumSetting],
  );

  const handleRecoveryAction = async (action: ARRecoveryAction): Promise<void> => {
    setRecoveryNoticeKey(getActionRequestedNoticeKey(action));

    const succeeded = await executeARRecoveryAction(action, handlers, {
      onError: (_a, err) => {
        if (err instanceof Error && err.message.startsWith('settings.')) {
          setRecoveryNoticeKey(err.message);
          return;
        }
        setRecoveryNoticeKey(getActionFailureNoticeKey(action));
      },
    });

    if (!succeeded) return;

    if (action === 'disable-ar') {
      setRecoveryNoticeKey(null);
    }
  };

  if (!launchAssistant.visible) {
    return null;
  }

  const titleKey = launchAssistant.outcome === 'ready'
    ? 'settings.arLaunchReadyTitle'
    : launchAssistant.outcome === 'degraded'
      ? 'settings.arLaunchDegradedTitle'
      : launchAssistant.outcome === 'blocked'
        ? 'settings.arLaunchBlockedTitle'
        : 'settings.arLaunchTitle';
  const adaptationNoticeKey = adaptation.sensorPath === 'camera-primary'
    ? 'settings.arAdaptationCameraFirst'
    : adaptation.sensorPath === 'manual-only'
      ? 'settings.arAdaptationManualOnly'
      : null;

  return (
    <div
      className={cn(
        'absolute inset-x-0 z-40 flex',
        layoutTokens.align === 'center' ? 'justify-center' : 'justify-stretch',
      )}
      style={{
        top: withSafeAreaInset('top', layoutTokens.topOffsetRem),
        paddingLeft: withSafeAreaInset('left', layoutTokens.sideInsetRem),
        paddingRight: withSafeAreaInset('right', layoutTokens.sideInsetRem),
      }}
      data-testid="ar-launch-assistant"
      data-ar-assistant-mode={adaptation.assistantMode}
      data-ar-sensor-path={adaptation.sensorPath}
      data-ar-sticky-actions={String(layoutTokens.stickyActions)}
    >
      <div
        className="w-full rounded-xl border border-white/20 bg-black/70 p-4 text-white shadow-xl backdrop-blur-md"
        style={{
          maxWidth: `min(calc(100vw - var(--safe-area-left) - var(--safe-area-right) - ${layoutTokens.sideInsetRem * 2}rem), ${layoutTokens.maxWidthRem}rem)`,
          maxHeight: 'calc(100dvh - var(--safe-area-top) - var(--safe-area-bottom) - 1rem)',
          overflowY: 'auto',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t(titleKey)}</p>
            <p className="text-xs text-white/70">{t('settings.arLaunchPhaseLabel')}: {launchAssistant.phase}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => closeLaunchAssistant()}
            data-testid="ar-launch-close"
          >
            {t('common.close')}
          </Button>
        </div>

        {(launchAssistant.activeDeviceLabel || launchAssistant.currentAcquisitionStage) && (
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/80">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              <span>{launchAssistant.activeDeviceLabel ?? t('settings.arCameraDeviceSystemDefault')}</span>
            </div>
            {launchAssistant.currentAcquisitionStage && (
              <p className="mt-1 text-[11px] text-white/60">{launchAssistant.currentAcquisitionStage}</p>
            )}
          </div>
        )}

        <div className="mt-3 space-y-2">
          {launchAssistant.checks.map((check) => (
            <div
              key={check.key}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2 text-sm',
                check.status === 'pass'
                  ? 'bg-emerald-500/10'
                  : check.status === 'block'
                    ? 'bg-amber-500/10'
                    : 'bg-white/5',
              )}
              data-testid={`ar-launch-check-${check.key}`}
            >
              {getCheckIcon(check.status)}
              <div className="min-w-0">
                <p className="font-medium">{t(check.titleKey)}</p>
                <p className="text-xs text-white/70">{t(check.detailKey)}</p>
              </div>
            </div>
          ))}
        </div>

        {adaptationNoticeKey && (
          <div className="mt-3 rounded-lg bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
            {t(adaptationNoticeKey)}
          </div>
        )}

        {cameraRuntime.availableDevices.length > 1 && (
          <div className="mt-3 rounded-lg bg-white/5 p-3">
            <p className="mb-2 text-xs text-white/70">{t('settings.arLaunchCameraDevicePrompt')}</p>
            <div className="flex flex-wrap gap-2">
              {cameraRuntime.availableDevices.map((device) => (
                <Button
                  key={device.deviceId}
                  variant="secondary"
                  size="sm"
                  className="h-7 rounded-full bg-white/10 px-3 text-xs text-white hover:bg-white/20"
                  onClick={() => {
                    setStellariumSetting('arCameraPreferredDevice', {
                      deviceId: device.deviceId,
                      label: device.label,
                      groupId: device.groupId,
                    });
                    requestRecoveryAction('retry-camera');
                  }}
                  data-testid={`ar-launch-device-${device.deviceId}`}
                >
                  {device.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {launchAssistant.summaryActions.length > 0 && (
          <div
            className={cn(
              'mt-3 flex flex-wrap gap-2',
              layoutTokens.stickyActions && 'sticky bottom-0 -mx-4 bg-black/90 px-4 pb-[calc(var(--safe-area-bottom)+0.25rem)] pt-2 backdrop-blur-sm',
            )}
          >
            {launchAssistant.summaryActions.map((action) => (
              <Button
                key={action}
                variant="secondary"
                size="sm"
                className="h-8 rounded-full bg-white/10 px-3 text-xs text-white hover:bg-white/20 disabled:opacity-40"
                disabled={(() => {
                  const lastFiredAt = recoveryActionLastFiredAt[action];
                  return typeof lastFiredAt === 'number'
                    && lastFiredAt > 0
                    && now - lastFiredAt < RECOVERY_COOLDOWN_MS;
                })()}
                onClick={() => {
                  void handleRecoveryAction(action);
                }}
                data-testid={`ar-launch-action-${action}`}
              >
                {t(
                  action === 'retry-camera'
                    ? 'settings.arRecoveryRetryCamera'
                    : action === 'switch-camera'
                      ? 'settings.arRecoverySwitchCamera'
                      : action === 'request-sensor-permission'
                        ? 'settings.arRecoveryRequestSensorPermission'
                        : action === 'calibrate-sensor'
                          ? 'settings.arRecoveryCalibrateSensor'
                          : action === 'open-camera-settings'
                            ? 'settings.arRecoveryOpenCameraSettings'
                            : action === 'revert-last-known-good-profile'
                              ? 'settings.arRecoveryRevertProfile'
                              : 'settings.arRecoveryDisable',
                )}
              </Button>
            ))}
          </div>
        )}

        {recoveryNoticeKey && (
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-amber-100" data-testid="ar-launch-recovery-notice">
            {t(recoveryNoticeKey)}
          </div>
        )}

        {launchAssistant.outcome === 'degraded' && !launchAssistant.degradedConfirmed && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4" />
              <span>{t('settings.arLaunchDegradedSummary')}</span>
            </div>
            <Button
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => confirmLaunchAssistantDegraded()}
              data-testid="ar-launch-continue-degraded"
            >
              {t('settings.arLaunchContinueDegraded')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
