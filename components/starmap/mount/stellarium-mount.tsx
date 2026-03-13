'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import { useMountOverlay } from '@/lib/hooks/use-mount-overlay';
import { useMountPolling } from '@/lib/hooks/use-mount-polling';
import {
  Telescope,
  RefreshCw,
  WifiOff,
  Settings,
  CircleStop,
  Play,
  Pause,
  ParkingSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TrackingRate } from '@/lib/tauri/mount-api';

import { MountConnectionDialog } from './mount-connection-dialog';
import { MountDirectionPad } from './mount-direction-pad';
import { useMountStore } from '@/lib/stores';
import { mountApi } from '@/lib/tauri/mount-api';
import { isTauri } from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';
import type { StellariumMountProps } from '@/types/starmap/mount';

const logger = createLogger('stellarium-mount');

function MountPanel({ compact }: StellariumMountProps) {
  const t = useTranslations('mount');
  // Poll mount state at ~1.5s interval while connected
  useMountPolling();

  const {
    connected,
    raDegree,
    decDegree,
    effectiveAutoSync,
    toggleAutoSync,
    syncViewToMount,
    altAz,
  } = useMountOverlay();

  const tracking = useMountStore((s) => s.mountInfo.Tracking);
  const slewing = useMountStore((s) => s.mountInfo.Slewing);
  const parked = useMountStore((s) => s.mountInfo.Parked);
  const pierSide = useMountStore((s) => s.mountInfo.PierSide);
  const trackMode = useMountStore((s) => s.mountInfo.TrackMode);
  const selectedDevice = useMountStore((s) => s.selectedDevice);
  const parkActionExplicitlyUnavailable = useMountStore((s) => (
    s.mountInfo.Parked
      ? s.actionAvailability.unpark === false
      : s.actionAvailability.park === false
  ));
  const trackingActionExplicitlyUnavailable = useMountStore((s) => s.actionAvailability.tracking === false);
  const canTogglePark = useMountStore((s) => {
    const availability = s.actionAvailability;
    return s.mountInfo.Parked
      ? (availability.unpark ?? (s.capabilities.canUnpark || s.capabilities.canPark))
      : (availability.park ?? (s.capabilities.canPark || s.capabilities.canUnpark));
  });
  const canSetTracking = useMountStore((s) => s.actionAvailability.tracking ?? s.capabilities.canSetTracking);
  const canChangeTrackingRate = useMountStore((s) => s.actionAvailability.trackingRate ?? Boolean(s.mountInfo.Tracking));
  const canAbortSlew = useMountStore((s) => s.actionAvailability.abortSlew ?? Boolean(s.mountInfo.Slewing));

  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);

  const handleToggleTracking = useCallback(async () => {
    if (!isTauri()) return;
    const isTracking = useMountStore.getState().mountInfo.Tracking;
    try {
      await mountApi.setTracking(!isTracking);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Toggle tracking failed', { error: msg });
      toast.error(t('operationFailed'), { description: msg });
    }
  }, [t]);

  const handlePark = useCallback(async () => {
    if (!isTauri()) return;
    const isParked = useMountStore.getState().mountInfo.Parked;
    try {
      if (isParked) {
        await mountApi.unpark();
      } else {
        await mountApi.park();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Park/Unpark failed', { error: msg });
      toast.error(t('operationFailed'), { description: msg });
    }
  }, [t]);

  const handleAbort = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await mountApi.abortSlew();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Abort slew failed', { error: msg });
      toast.error(t('operationFailed'), { description: msg });
    }
  }, [t]);

  const handleTrackingRate = useCallback(async (rate: TrackingRate) => {
    if (!isTauri()) return;
    try {
      await mountApi.setTrackingRate(rate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error('Set tracking rate failed', { error: msg });
      toast.error(t('operationFailed'), { description: msg });
    }
  }, [t]);

  // ----- Disconnected state -----
  if (!connected) {
    if (compact) return null;
    return (
      <div className="flex flex-col items-center gap-1 p-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground/50 hover:text-foreground hover:bg-accent"
              onClick={() => setConnectionDialogOpen(true)}
            >
              <WifiOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t('disconnected')}</p>
          </TooltipContent>
        </Tooltip>
        <MountConnectionDialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen} />
      </div>
    );
  }

  // ----- Connected state -----
  const raDisplay = degreesToHMS(((raDegree % 360) + 360) % 360);
  const decDisplay = degreesToDMS(decDegree);

  const panel = (
    <div className="flex flex-col gap-1.5 p-2 w-full">
      {/* Header: status + settings */}
      <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-medium text-green-400">{t('mount')}</span>
            {selectedDevice?.name && (
              <span className="text-[9px] text-muted-foreground">{selectedDevice.name}</span>
            )}
          </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => setConnectionDialogOpen(true)}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('connectionSettings')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Coordinates */}
      <div className="text-center px-1">
        <p className="text-[11px] font-mono text-foreground leading-tight">{raDisplay}</p>
        <p className="text-[11px] font-mono text-foreground leading-tight">{decDisplay}</p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap items-center justify-center gap-0.5">
        {tracking && (
          canChangeTrackingRate ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-green-400 border-green-400/30 cursor-pointer hover:bg-green-400/10">
                  {trackMode === 'sidereal' ? '☆' : trackMode === 'lunar' ? '☽' : trackMode === 'solar' ? '☀' : '⏸'} {t(`rate.${trackMode ?? 'sidereal'}`)}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[100px]">
                {(['sidereal', 'lunar', 'solar'] as const).map((rate) => (
                  <DropdownMenuItem
                    key={rate}
                    className={cn('text-xs', trackMode === rate && 'font-bold')}
                    onClick={() => handleTrackingRate(rate)}
                  >
                    {rate === 'sidereal' ? '☆' : rate === 'lunar' ? '☽' : '☀'} {t(`rate.${rate}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-green-400 border-green-400/30">
              {trackMode === 'sidereal' ? '☆' : trackMode === 'lunar' ? '☽' : trackMode === 'solar' ? '☀' : '⏸'} {t(`rate.${trackMode ?? 'sidereal'}`)}
            </Badge>
          )
        )}
        {slewing && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-blue-400 border-blue-400/30 animate-pulse">
            {t('slewing')}
          </Badge>
        )}
        {parked && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 text-yellow-400 border-yellow-400/30">
            {t('parked')}
          </Badge>
        )}
        {pierSide && pierSide !== 'unknown' && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
            {t(`pier.${pierSide}`)}
          </Badge>
        )}
      </div>

      {/* Alt/Az */}
      {altAz && (
        <div className="text-center">
          <p className="text-[9px] font-mono text-muted-foreground">
            {t('altitude')}: {degreesToDMS(altAz.alt)} · {t('azimuth')}: {degreesToDMS(altAz.az)}
          </p>
        </div>
      )}

      <Separator />

      {/* Control buttons row */}
      <div className="flex items-center justify-center gap-0.5">
        {/* Sync view */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={syncViewToMount}>
              <Telescope className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('goToMountPosition')}</TooltipContent>
        </Tooltip>

        {/* Auto-sync */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={effectiveAutoSync}
              onPressedChange={toggleAutoSync}
              className="h-7 w-7 min-w-7 p-0 data-[state=on]:text-primary data-[state=on]:bg-primary/20"
              aria-label={effectiveAutoSync ? t('disableAutoSync') : t('enableAutoSync')}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', effectiveAutoSync && 'animate-spin')} />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="left">
            {effectiveAutoSync ? t('disableAutoSync') : t('enableAutoSync')}
          </TooltipContent>
        </Tooltip>

        {/* Tracking toggle */}
        {canSetTracking && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={!!tracking}
                onPressedChange={handleToggleTracking}
                className="h-7 w-7 min-w-7 p-0 data-[state=on]:text-green-400 data-[state=off]:text-muted-foreground"
                aria-label={tracking ? t('stopTracking') : t('startTracking')}
              >
                {tracking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="left">
              {tracking ? t('stopTracking') : t('startTracking')}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Park */}
        {canTogglePark && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={!!parked}
                onPressedChange={handlePark}
                className="h-7 w-7 min-w-7 p-0 data-[state=on]:text-yellow-400"
                aria-label={parked ? t('unpark') : t('park')}
              >
                <ParkingSquare className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent side="left">
              {parked ? t('unpark') : t('park')}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Abort */}
        {slewing && canAbortSlew && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleAbort}
              >
                <CircleStop className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{t('abortSlew')}</TooltipContent>
          </Tooltip>
        )}
      </div>

      {connected && (
        <div className="text-center">
          {trackingActionExplicitlyUnavailable && (
            <p className="text-[9px] text-muted-foreground">{t('trackingUnavailable')}</p>
          )}
          {parkActionExplicitlyUnavailable && (
            <p className="text-[9px] text-muted-foreground">{t('actionUnavailable')}</p>
          )}
        </div>
      )}

      {/* Direction pad */}
      <MountDirectionPad />
    </div>
  );

  // Compact mode: popover
  if (compact) {
    return (
      <>
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9',
                    connected ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground',
                    slewing && 'animate-pulse',
                  )}
                >
                  <Telescope className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('mount')}</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="top" align="center" className="w-56 p-0">
            <ScrollArea className="max-h-[400px]">
              {panel}
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <MountConnectionDialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen} />
      </>
    );
  }

  return (
    <>
      {panel}
      <MountConnectionDialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen} />
    </>
  );
}

export { MountPanel as StellariumMount };
