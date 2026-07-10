'use client';

import { useTranslations } from 'next-intl';
import { Satellite } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSatellitePasses } from '@/lib/hooks/use-satellite-passes';

export interface SatelliteInfoNoticeProps {
  noradId: number | null;
  latitude: number;
  longitude: number;
  className?: string;
}

/**
 * Replaces the rise/set grid, altitude chart, and feasibility blocks for
 * artificial satellites: fixed-RA/Dec forecasts are meaningless for objects
 * whose position changes within minutes. Shows real SGP4 pass predictions
 * instead when a TLE is available (cached CelesTrak fetch).
 */
export function SatelliteInfoNotice({ noradId, latitude, longitude, className }: SatelliteInfoNoticeProps) {
  const t = useTranslations();
  const { status, passes } = useSatellitePasses(noradId, latitude, longitude);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Card className={cn('py-2 shadow-none', className)} data-testid="satellite-info-notice">
      <CardContent className="space-y-2 px-3">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Satellite className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden />
          <span>{t('objectDetail.satelliteNoForecast')}</span>
        </p>

        {status === 'loading' && (
          <div className="space-y-1" aria-busy="true" data-testid="satellite-pass-loading">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}

        {status === 'ready' && passes.length > 0 && (
          <div className="space-y-1" data-testid="satellite-pass-list">
            <p className="text-[11px] font-medium text-foreground">
              {t('satellites.upcomingPasses')} · {t('satellites.next24Hours')}
            </p>
            {passes.map((pass) => (
              <div
                key={pass.startTime.getTime()}
                className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground"
              >
                <span>{t('satellites.start')} {formatTime(pass.startTime)}</span>
                <span>{t('satellites.max')} {formatTime(pass.maxTime)} · {Math.round(pass.maxElevation)}°</span>
                <span>{t('satellites.end')} {formatTime(pass.endTime)}</span>
              </div>
            ))}
          </div>
        )}

        {status === 'ready' && passes.length === 0 && (
          <p className="text-[11px] text-muted-foreground">{t('satellites.noPasses')}</p>
        )}
      </CardContent>
    </Card>
  );
}
