'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { executeARRecoveryAction, type ARRecoveryActionHandlers } from '@/lib/core/ar-recovery-actions';
import type { ARRecoveryAction, ARSessionStatus } from '@/lib/core/ar-session';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useOnboardingBridgeStore, useSettingsStore } from '@/lib/stores';
import { useARAdaptation } from '@/lib/hooks/use-ar-adaptation';
import { getARSurfaceLayoutTokens, withSafeAreaInset } from '@/lib/constants/ar-layout';

const RECOVERY_COOLDOWN_MS = 3000;

interface ARRecoveryPanelProps {
  status: ARSessionStatus;
  recoveryActions: ARRecoveryAction[];
  isStabilizing?: boolean;
  className?: string;
}

function getStatusTextKey(status: ARSessionStatus): string {
  if (status === 'preflight') return 'settings.arStatusPreflight';
  if (status === 'degraded-camera-only') return 'settings.arStatusDegradedCameraOnly';
  if (status === 'degraded-sensor-only') return 'settings.arStatusDegradedSensorOnly';
  if (status === 'blocked') return 'settings.arStatusBlocked';
  if (status === 'ready') return 'settings.arStatusReady';
  return 'settings.arMode';
}

function getActionTextKey(action: ARRecoveryAction): string {
  if (action === 'retry-camera') return 'settings.arRecoveryRetryCamera';
  if (action === 'switch-camera') return 'settings.arRecoverySwitchCamera';
  if (action === 'request-sensor-permission') return 'settings.arRecoveryRequestSensorPermission';
  if (action === 'calibrate-sensor') return 'settings.arRecoveryCalibrateSensor';
  if (action === 'open-camera-settings') return 'settings.arRecoveryOpenCameraSettings';
  if (action === 'revert-last-known-good-profile') return 'settings.arRecoveryRevertProfile';
  return 'settings.arRecoveryDisable';
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

export function ARRecoveryPanel({
  status,
  recoveryActions,
  isStabilizing = false,
  className,
}: ARRecoveryPanelProps) {
  const t = useTranslations();
  const adaptation = useARAdaptation();
  const layoutTokens = getARSurfaceLayoutTokens('recovery', adaptation.recoveryMode);
  const setStellariumSetting = useSettingsStore((state) => state.setStellariumSetting);
  const openSettingsDrawer = useOnboardingBridgeStore((state) => state.openSettingsDrawer);
  const requestRecoveryAction = useARRuntimeStore((state) => state.requestRecoveryAction);
  const recoveryNoticeKey = useARRuntimeStore((state) => state.recoveryNoticeKey);
  const setRecoveryNoticeKey = useARRuntimeStore((state) => state.setRecoveryNoticeKey);
  const cameraRuntime = useARRuntimeStore((state) => state.camera);
  const launchAssistantVisible = useARRuntimeStore((state) => state.launchAssistant.visible);
  const openLaunchAssistant = useARRuntimeStore((state) => state.openLaunchAssistant);

  const recoveryActionLastFiredAt = useARRuntimeStore((state) => state.recoveryActionLastFiredAt);
  const [now, setNow] = useState(0);

  const actions = Array.from(new Set(recoveryActions));

  const handlers: ARRecoveryActionHandlers = {
    onRetryCamera: () => requestRecoveryAction('retry-camera'),
    onSwitchCamera: () => requestRecoveryAction('switch-camera'),
    onRequestSensorPermission: () => requestRecoveryAction('request-sensor-permission'),
    onCalibrateSensor: () => requestRecoveryAction('calibrate-sensor'),
    onOpenCameraSettings: () => openSettingsDrawer('display'),
    onRevertLastKnownGoodProfile: () => requestRecoveryAction('revert-last-known-good-profile'),
    onDisableAr: () => setStellariumSetting('arMode', false),
  };

  const handleRecoveryAction = async (action: ARRecoveryAction): Promise<void> => {
    setRecoveryNoticeKey(getActionRequestedNoticeKey(action));

    const succeeded = await executeARRecoveryAction(action, handlers, {
      onError: (_a, err) => {
        const fallbackKey = getActionFailureNoticeKey(action);
        if (err instanceof Error && err.message.startsWith('settings.')) {
          setRecoveryNoticeKey(err.message);
          return;
        }
        setRecoveryNoticeKey(fallbackKey);
      },
    });

    if (!succeeded) return;

    if (action === 'disable-ar') {
      setRecoveryNoticeKey(null);
    }
  };

  useEffect(() => {
    if (status === 'ready' && recoveryNoticeKey) {
      setRecoveryNoticeKey(null);
    }
  }, [recoveryNoticeKey, setRecoveryNoticeKey, status]);

  useEffect(() => {
    const currentNow = Date.now();
    const hasActiveCooldown = actions.some(
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
  }, [actions, recoveryActionLastFiredAt]);

  if (launchAssistantVisible || status === 'ready' || (actions.length === 0 && !recoveryNoticeKey)) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute z-30 flex flex-col gap-2 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-white/95 shadow-lg backdrop-blur-sm',
        layoutTokens.align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0 right-0',
        className
      )}
      style={{
        top: withSafeAreaInset('top', layoutTokens.topOffsetRem),
        left: layoutTokens.align === 'center' ? undefined : withSafeAreaInset('left', layoutTokens.sideInsetRem),
        right: layoutTokens.align === 'center' ? undefined : withSafeAreaInset('right', layoutTokens.sideInsetRem),
        width: layoutTokens.align === 'center'
          ? `min(calc(100vw - var(--safe-area-left) - var(--safe-area-right) - ${layoutTokens.sideInsetRem * 2}rem), ${layoutTokens.maxWidthRem}rem)`
          : undefined,
        maxWidth: layoutTokens.align === 'center' ? undefined : `${layoutTokens.maxWidthRem}rem`,
      }}
      data-testid="ar-recovery-panel"
      data-ar-recovery-mode={adaptation.recoveryMode}
      data-ar-sticky-actions={String(layoutTokens.stickyActions)}
    >
      <p className="text-xs font-medium">{t(getStatusTextKey(status))}</p>
      {(cameraRuntime.acquisitionDiagnostics.activeDevice || cameraRuntime.acquisitionDiagnostics.lastFailureStage) && (
        <p className="text-[11px] text-white/80" data-testid="ar-recovery-diagnostics">
          {[
            cameraRuntime.acquisitionDiagnostics.activeDevice?.label,
            cameraRuntime.acquisitionDiagnostics.lastFailureStage
              ? t('settings.arCameraLastFailureStage')
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 rounded-full bg-white/15 px-3 text-xs text-white hover:bg-white/25"
            onClick={() => openLaunchAssistant('recovery')}
            data-testid="ar-recovery-open-launch-assistant"
          >
            {t('settings.arLaunchOpenAssistant')}
          </Button>
          {actions.map((action) => (
            <Button
              key={action}
              variant="secondary"
              size="sm"
              className="h-7 rounded-full bg-white/15 px-3 text-xs text-white hover:bg-white/25 disabled:opacity-40"
              disabled={(() => {
                const lastFiredAt = recoveryActionLastFiredAt[action];
                return typeof lastFiredAt === 'number'
                  && lastFiredAt > 0
                  && now - lastFiredAt < RECOVERY_COOLDOWN_MS;
              })()}
              onClick={() => {
                void handleRecoveryAction(action);
              }}
              data-testid={`ar-recovery-action-${action}`}
            >
              {t(getActionTextKey(action))}
            </Button>
          ))}
        </div>
      )}
      {recoveryNoticeKey && (
        <p className="text-[11px] text-amber-200" data-testid="ar-recovery-notice">
          {t(recoveryNoticeKey)}
        </p>
      )}
      {isStabilizing && (
        <p className="text-[11px] text-sky-200" data-testid="ar-recovery-stabilizing">
          {t('settings.arStatusStabilizing')}
        </p>
      )}
    </div>
  );
}
