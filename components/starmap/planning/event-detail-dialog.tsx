'use client';

import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Calendar,
  Star,
  Eye,
  Clock,
  ExternalLink,
  MapPin,
  Crosshair,
  Activity,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EVENT_ICON_MAP,
  getEventColorClass,
  getEventTypeLabelKey,
} from './event-visuals';
import type { AstroEvent, DailyAstroEvent } from '@/lib/services/astro-data-sources';

// ============================================================================
// Props
// ============================================================================

interface EventDetailDialogProps {
  event: (AstroEvent | DailyAstroEvent) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoTo?: (ra: number, dec: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  onGoTo,
}: EventDetailDialogProps) {
  const t = useTranslations();

  if (!event) return null;

  const Icon = EVENT_ICON_MAP[event.type] ?? EVENT_ICON_MAP.other;
  const colorClass = getEventColorClass(event.type);
  const typeLabel = t(getEventTypeLabelKey(event.type));

  const formatFullDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

  const getVisibilityInfo = (visibility: string) => {
    switch (visibility) {
      case 'excellent':
        return { label: t('events.excellent'), className: 'bg-green-500/20 text-green-400 border-green-500/30' };
      case 'good':
        return { label: t('events.good'), className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'fair':
        return { label: t('events.fair'), className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
      case 'poor':
        return { label: t('events.poor'), className: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default:
        return null;
    }
  };

  const visibilityInfo = getVisibilityInfo(event.visibility);
  const startsAt = 'startsAt' in event ? event.startsAt : event.date;
  const endsAt = 'endsAt' in event ? event.endsAt : event.endDate;
  const occurrenceMode = 'occurrenceMode' in event ? event.occurrenceMode : undefined;
  const sourcePriority = 'sourcePriority' in event ? event.sourcePriority : undefined;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="standard-form">
      <ResponsiveDialogContent className="sm:max-w-[480px] overflow-hidden flex flex-col">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl', colorClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base truncate">{event.name}</div>
              <div className="text-xs text-muted-foreground font-normal">{typeLabel}</div>
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-hidden">
          <div className="space-y-4 pr-3 pb-4">
            {/* Visibility Badge */}
            {visibilityInfo && (
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('eventDetail.visibility')}:</span>
                <Badge variant="outline" className={cn('text-xs', visibilityInfo.className)}>
                  {visibilityInfo.label}
                </Badge>
              </div>
            )}

            {/* Date & Time */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">{formatFullDate(startsAt)}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span>{t('eventDetail.startTime')}: {formatTime(startsAt)}</span>
              </div>

              {event.peakTime && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{t('eventDetail.peakTime')}: {formatTime(event.peakTime)}</span>
                </div>
              )}

              {endsAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{t('eventDetail.activeUntil')}: {formatFullDate(endsAt)}</span>
                </div>
              )}
              {occurrenceMode && (
                <Badge variant="outline" className="text-[10px] w-fit">
                  {occurrenceMode === 'window' ? t('events.ongoingWindow') : t('events.instantEvent')}
                </Badge>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-muted-foreground" />
                {t('eventDetail.description')}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                {event.description}
              </p>
            </div>

            <Separator />

            {/* Coordinates */}
            {event.ra !== undefined && event.dec !== undefined && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Crosshair className="h-4 w-4 text-muted-foreground" />
                  {t('eventDetail.coordinates')}
                </div>
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">RA</div>
                    <div className="text-sm font-mono">{event.ra.toFixed(4)}°</div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">DEC</div>
                    <div className="text-sm font-mono">{event.dec.toFixed(4)}°</div>
                  </div>
                </div>
              </div>
            )}

            {/* Magnitude */}
            {event.magnitude !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('eventDetail.magnitude')}:</span>
                <span className="font-medium font-mono">{event.magnitude.toFixed(1)}</span>
              </div>
            )}

            {/* Source */}
            {event.source && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{t('eventDetail.source')}:</span>
                    <Badge variant="outline" className="text-xs">
                      {event.source}
                    </Badge>
                    {typeof sourcePriority === 'number' && (
                      <Badge variant="outline" className="text-xs">
                        {t('eventDetail.sourcePriority')}: {sourcePriority}
                      </Badge>
                    )}
                  </div>
                  {event.url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" asChild>
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        {event.ra !== undefined && event.dec !== undefined && onGoTo && (
          <>
            <Separator />
            <div className="shrink-0 border-t pt-2 pb-[calc(var(--safe-area-bottom)+0.25rem)]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full"
                    onClick={() => {
                      onGoTo(event.ra!, event.dec!);
                      onOpenChange(false);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {t('eventDetail.goToLocation')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('events.goToRadiant')}</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
