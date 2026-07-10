'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Crosshair, AlertTriangle, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

import { useMountStore } from '@/lib/stores';
import { useMountOperations } from '@/lib/hooks/use-mount-operations';
import { checkTargetSafety } from '@/lib/astronomy/mount-safety';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import { isTauri } from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('slew-confirm');

export interface SlewConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetName: string;
  targetRa: number;
  targetDec: number;
  onSlewStarted?: () => void;
}

export function SlewConfirmDialog({
  open,
  onOpenChange,
  targetName,
  targetRa,
  targetDec,
  onSlewStarted,
}: SlewConfirmDialogProps) {
  const t = useTranslations('mount');
  const [pendingAction, setPendingAction] = useState<'slew' | 'sync' | null>(null);
  const [error, setError] = useState('');

  const safetyConfig = useMountStore((s) => s.safetyConfig);
  const profileInfo = useMountStore((s) => s.profileInfo);
  const canSync = useMountStore((s) => Boolean(s.capabilities.canSync));
  const connected = useMountStore((s) => s.mountInfo.Connected);
  const parked = useMountStore((s) => s.mountInfo.Parked);
  const blockedActionReasons = useMountStore((s) => s.blockedActionReasons);
  const { queueTargetAction, clearTargetAction, executeTargetAction } = useMountOperations();

  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;

  // Run safety check
  const safetyResult = useMemo(() => {
    if (!open) return null;
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour window
    return checkTargetSafety(
      'slew-target',
      targetName,
      targetRa,
      targetDec,
      now,
      end,
      latitude,
      longitude,
      safetyConfig,
    );
  }, [open, targetName, targetRa, targetDec, latitude, longitude, safetyConfig]);

  const dangers = safetyResult?.issues.filter((i) => i.severity === 'danger') ?? [];
  const warnings = safetyResult?.issues.filter((i) => i.severity === 'warning') ?? [];
  const hasDanger = dangers.length > 0;

  useEffect(() => {
    if (!open) {
      clearTargetAction();
      // Reset local dialog state when the dialog closes. Deferred past the effect body
      // so the reset doesn't run synchronously.
      queueMicrotask(() => {
        setError('');
        setPendingAction(null);
      });
      return;
    }

    queueTargetAction({
      action: 'slew',
      targetName,
      ra: targetRa,
      dec: targetDec,
      source: 'slew-confirm-dialog',
    });
  }, [clearTargetAction, open, queueTargetAction, targetDec, targetName, targetRa]);

  const handleAction = useCallback(async (action: 'slew' | 'sync') => {
    if (!isTauri() || !connected) return;

    setPendingAction(action);
    setError('');

    try {
      queueTargetAction({
        action,
        targetName,
        ra: targetRa,
        dec: targetDec,
        source: 'slew-confirm-dialog',
      });
      const failure = await executeTargetAction({
        action,
        targetName,
        ra: targetRa,
        dec: targetDec,
        source: 'slew-confirm-dialog',
        requestedAt: new Date().toISOString(),
      });
      if (failure) {
        setError(failure.message);
        logger.error('Target action failed', { action, error: failure.message });
        return;
      }
      logger.info('Target action started', { action, target: targetName, ra: targetRa, dec: targetDec });
      onSlewStarted?.();
      onOpenChange(false);
    } finally {
      setPendingAction(null);
    }
  }, [connected, executeTargetAction, onOpenChange, onSlewStarted, queueTargetAction, targetDec, targetName, targetRa]);

  const raDisplay = degreesToHMS(((targetRa % 360) + 360) % 360);
  const decDisplay = degreesToDMS(targetDec);
  const slewDisabled = !connected || !!parked || !!blockedActionReasons.slew;
  const syncDisabled = !connected || !!parked || !!blockedActionReasons.sync;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="compact-confirmation">
      <ResponsiveDialogContent className="sm:max-w-md max-h-[92vh] max-h-[92dvh] overflow-hidden flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Crosshair className="h-4 w-4" />
            {t('slewConfirm')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t('slewConfirmDescription')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {/* Target info */}
          <Card className="py-3 gap-0 shadow-none">
            <CardContent className="px-3 space-y-1">
              <p className="text-sm font-medium">{targetName}</p>
              <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                <span>RA: {raDisplay}</span>
                <span>Dec: {decDisplay}</span>
              </div>
            </CardContent>
          </Card>

          {/* Safety status */}
          {safetyResult && (
            <div className="space-y-2">
              {dangers.length === 0 && warnings.length === 0 && (
                <Alert className="bg-green-500/10 text-green-500 border-green-500/30 py-2 text-xs [&>svg]:text-green-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <AlertDescription>{t('safetyClear')}</AlertDescription>
                </Alert>
              )}

              {dangers.map((issue, i) => (
                <Alert key={`d-${i}`} variant="destructive" className="py-2 text-xs">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <AlertDescription>{t(`safetyIssues.${issue.type}`)}</AlertDescription>
                </Alert>
              ))}

              {warnings.map((issue, i) => (
                <Alert key={`w-${i}`} className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 py-2 text-xs [&>svg]:text-yellow-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <AlertDescription>{t(`safetyIssues.${issue.type}`)}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Status warnings */}
          {parked && (
            <Alert className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 py-2 text-xs [&>svg]:text-yellow-500">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription>{t('mountParkedWarning')}</AlertDescription>
            </Alert>
          )}

          {!connected && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription>{t('notConnectedWarning')}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <ResponsiveDialogFooter stickyOnMobile>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {canSync && (
            <Button
              onClick={() => void handleAction('sync')}
              disabled={pendingAction !== null || syncDisabled}
              variant="secondary"
            >
              {pendingAction === 'sync' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Crosshair className="h-4 w-4 mr-2" />
              {t('syncMount')}
            </Button>
          )}
          <Button
            onClick={() => void handleAction('slew')}
            disabled={pendingAction !== null || slewDisabled}
            variant={hasDanger ? 'destructive' : 'default'}
          >
            {pendingAction === 'slew' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Crosshair className="h-4 w-4 mr-2" />
            {hasDanger ? t('slewAnyway') : t('startSlew')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
