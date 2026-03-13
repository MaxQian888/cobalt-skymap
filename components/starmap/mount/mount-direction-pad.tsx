'use client';

import { memo, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { mountApi, SLEW_RATE_PRESETS } from '@/lib/tauri/mount-api';
import { useMountStore } from '@/lib/stores';
import { isTauri } from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('mount-direction-pad');

function errorMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * NSEW direction pad for manual mount motion.
 * Press-and-hold starts axis motion; release stops it.
 */
export const MountDirectionPad = memo(function MountDirectionPad() {
  const t = useTranslations('mount');
  const slewRateIndex = useMountStore((s) => s.mountInfo.SlewRateIndex ?? 3);
  const parked = useMountStore((s) => s.mountInfo.Parked);
  const connected = useMountStore((s) => s.mountInfo.Connected);
  const canMoveAxis = useMountStore((s) => s.capabilities.canMoveAxis);
  const moveAxisAvailable = useMountStore((s) => s.actionAvailability.moveAxis);

  const movingRef = useRef<{ axis: 'primary' | 'secondary'; direction: number } | null>(null);

  const disabled = !connected || !canMoveAxis || moveAxisAvailable === false || !!parked;

  const startMove = useCallback(async (axis: 'primary' | 'secondary', direction: number) => {
    if (disabled || !isTauri()) return;
    movingRef.current = { axis, direction };
    const rate = SLEW_RATE_PRESETS[slewRateIndex]?.value ?? 16;
    try {
      await mountApi.moveAxis(axis, rate * direction);
    } catch (e) {
      const msg = errorMsg(e);
      logger.error('Move axis failed', { error: msg });
      toast.error(msg);
    }
  }, [disabled, slewRateIndex]);

  const stopMove = useCallback(async () => {
    if (!movingRef.current || !isTauri()) return;
    const { axis } = movingRef.current;
    movingRef.current = null;
    try {
      await mountApi.stopAxis(axis);
    } catch (e) {
      logger.error('Stop axis failed', { error: errorMsg(e) });
    }
  }, []);

  const stopAll = useCallback(async () => {
    if (!isTauri()) return;
    movingRef.current = null;
    try {
      await Promise.all([
        mountApi.stopAxis('primary'),
        mountApi.stopAxis('secondary'),
      ]);
    } catch (e) {
      logger.error('Stop all failed', { error: errorMsg(e) });
    }
  }, []);

  // Safety net: stop all motion on global pointer-up/cancel, window blur, or unmount
  useEffect(() => {
    const safeStop = () => {
      if (movingRef.current) stopMove();
    };
    window.addEventListener('pointerup', safeStop);
    window.addEventListener('pointercancel', safeStop);
    window.addEventListener('blur', safeStop);
    return () => {
      window.removeEventListener('pointerup', safeStop);
      window.removeEventListener('pointercancel', safeStop);
      window.removeEventListener('blur', safeStop);
      // Force stop on unmount
      if (movingRef.current && isTauri()) {
        movingRef.current = null;
        Promise.all([
          mountApi.stopAxis('primary'),
          mountApi.stopAxis('secondary'),
        ]).catch(() => {});
      }
    };
  }, [stopMove]);

  const handleRateChange = useCallback(async (value: string) => {
    const idx = parseInt(value, 10);
    if (!isTauri()) return;
    try {
      await mountApi.setSlewRate(idx);
      useMountStore.getState().setMountInfo({ SlewRateIndex: idx });
    } catch (e) {
      const msg = errorMsg(e);
      logger.error('Set slew rate failed', { error: msg });
      toast.error(msg);
    }
  }, []);

  const btnClass = cn(
    'h-7 w-7 p-0',
    disabled && 'opacity-40 pointer-events-none'
  );

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Speed selector */}
      <Select value={String(slewRateIndex)} onValueChange={handleRateChange} disabled={disabled}>
        <SelectTrigger className="h-6 w-full text-[10px] px-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLEW_RATE_PRESETS.map((preset, i) => (
            <SelectItem key={i} value={String(i)} className="text-xs">
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Direction grid */}
      {moveAxisAvailable === false && (
        <p className="text-[9px] text-muted-foreground">{t('axisMotionUnavailable')}</p>
      )}
      <div className="grid grid-cols-3 gap-0.5 w-fit">
        {/* Row 1: empty / N / empty */}
        <div />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onPointerDown={() => startMove('secondary', 1)}
              onPointerUp={stopMove}
              onPointerLeave={stopMove}
              onPointerCancel={stopMove}
              aria-label={t('north')}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px] px-1.5 py-0.5">{t('north')}</TooltipContent>
        </Tooltip>
        <div />

        {/* Row 2: W / STOP / E */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onPointerDown={() => startMove('primary', -1)}
              onPointerUp={stopMove}
              onPointerLeave={stopMove}
              onPointerCancel={stopMove}
              aria-label={t('west')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-[10px] px-1.5 py-0.5">{t('west')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(btnClass, 'text-destructive hover:text-destructive hover:bg-destructive/10')}
              onClick={stopAll}
              aria-label={t('stop')}
            >
              <Square className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] px-1.5 py-0.5">{t('stop')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onPointerDown={() => startMove('primary', 1)}
              onPointerUp={stopMove}
              onPointerLeave={stopMove}
              onPointerCancel={stopMove}
              aria-label={t('east')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-[10px] px-1.5 py-0.5">{t('east')}</TooltipContent>
        </Tooltip>

        {/* Row 3: empty / S / empty */}
        <div />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={btnClass}
              onPointerDown={() => startMove('secondary', -1)}
              onPointerUp={stopMove}
              onPointerLeave={stopMove}
              onPointerCancel={stopMove}
              aria-label={t('south')}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px] px-1.5 py-0.5">{t('south')}</TooltipContent>
        </Tooltip>
        <div />
      </div>
    </div>
  );
});
MountDirectionPad.displayName = 'MountDirectionPad';
