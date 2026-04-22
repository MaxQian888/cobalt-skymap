'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Calendar, Moon, Sun } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MoonPhaseSVG } from '../moon-phase-svg';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { formatDuration, formatTimeShort } from '@/lib/astronomy/time/formats';
import {
  runCalculatorAlmanac,
  runCalculatorRiseTransitSet,
  summarizeCalculatorMeta,
  type CalculatorMetaSummary,
} from './orchestrator';
import type { AstroCalculatorObserverContext } from './types';

interface AlmanacTabProps {
  latitude: number;
  longitude: number;
  observerContext?: AstroCalculatorObserverContext;
  sharedDate?: string;
  sharedTime?: string;
  onSharedDateChange?: (nextDate: string) => void;
  onSharedTimeChange?: (nextTime: string) => void;
}

function toDateInputString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AlmanacTab({
  latitude,
  longitude,
  observerContext,
  sharedDate,
  sharedTime,
  onSharedDateChange,
  onSharedTimeChange,
}: AlmanacTabProps) {
  const t = useTranslations();
  const [selectedDate, setSelectedDate] = useState(sharedDate ?? toDateInputString(new Date()));
  const [selectedTime, setSelectedTime] = useState(sharedTime ?? '22:00');
  const [almanac, setAlmanac] = useState<Awaited<ReturnType<typeof runCalculatorAlmanac>>['response'] | null>(null);
  const [sunTransit, setSunTransit] = useState<Date | null>(null);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const date = useMemo(() => new Date(`${selectedDate}T${selectedTime}:00`), [selectedDate, selectedTime]);

  useEffect(() => {
    if (sharedDate && sharedDate !== selectedDate) {
      setSelectedDate(sharedDate);
    }
  }, [sharedDate, selectedDate]);

  useEffect(() => {
    if (sharedTime && sharedTime !== selectedTime) {
      setSelectedTime(sharedTime);
    }
  }, [sharedTime, selectedTime]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const [almanacResult, sunRts] = await Promise.all([
          runCalculatorAlmanac({
            date,
            observer: { latitude, longitude },
            contextKey: observerContext?.contextKey,
          }),
          runCalculatorRiseTransitSet({
            body: 'Sun',
            date,
            observer: { latitude, longitude },
            contextKey: observerContext?.contextKey,
          }),
        ]);

        if (!cancelled) {
          setAlmanac(almanacResult.response);
          setSunTransit(sunRts.response.transitTime);
          setMetaSummary(summarizeCalculatorMeta([almanacResult.meta, sunRts.meta]));
        }
      } catch (runError) {
        if (!cancelled) {
          setAlmanac(null);
          setSunTransit(null);
          setMetaSummary(null);
          setError(runError instanceof Error ? runError.message : t('astroCalc.calculationFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [date, latitude, longitude, observerContext?.contextKey, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('astroCalc.date')}</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDate(value);
                onSharedDateChange?.(value);
              }}
              className="h-8 w-44"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('astroCalc.time')}</Label>
            <Input
              type="time"
              step={60}
              value={selectedTime}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedTime(value);
                onSharedTimeChange?.(value);
              }}
              className="h-8 w-32"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="almanac-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
          {isLoading && <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>}
          <Badge variant="outline">
            {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
          </Badge>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {almanac && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Sun className="h-5 w-5 text-amber-500" />
                <span className="font-medium">{t('astroCalc.sun')}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.sunrise')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.sunrise)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.sunset')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.sunset)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.solarNoon')}</span>
                  <span className="font-mono">{formatTimeShort(sunTransit)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.tableRA')}</span>
                  <span className="font-mono">{degreesToHMS(almanac.sun.ra)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.tableDec')}</span>
                  <span className="font-mono">{degreesToDMS(almanac.sun.dec)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.altitude')}</span>
                  <span className={cn('font-mono', almanac.sun.altitude > 0 ? 'text-amber-500' : 'text-blue-400')}>
                    {almanac.sun.altitude.toFixed(2)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.azimuth')}</span>
                  <span className="font-mono">{almanac.sun.azimuth.toFixed(2)}°</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="h-5 w-5 text-amber-400" />
                <span className="font-medium">{t('astroCalc.moon')}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.phase')}</span>
                  <span>{(almanac.moon.phase * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.illumination')}</span>
                  <span>{almanac.moon.illumination.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.rise')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.moon.riseTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.set')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.moon.setTime)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.tableRA')}</span>
                  <span className="font-mono">{degreesToHMS(almanac.moon.ra)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.tableDec')}</span>
                  <span className="font-mono">{degreesToDMS(almanac.moon.dec)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.altitude')}</span>
                  <span className={cn('font-mono', almanac.moon.altitude > 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                    {almanac.moon.altitude.toFixed(2)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.azimuth')}</span>
                  <span className="font-mono">{almanac.moon.azimuth.toFixed(2)}°</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">{t('astroCalc.twilight')}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.civilDusk')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.civilDusk)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.nauticalDusk')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.nauticalDusk)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.astroDusk')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.astronomicalDusk)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.astroDawn')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.astronomicalDawn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.nauticalDawn')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.nauticalDawn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.civilDawn')}</span>
                  <span className="font-mono">{formatTimeShort(almanac.twilight.civilDawn)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('astroCalc.darknessDuration')}</span>
                  <span>{formatDuration(almanac.twilight.darknessDuration)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="h-5 w-5 text-primary" />
                <span className="font-medium">{t('astroCalc.moonPhaseCalendar')}</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {Array.from({ length: 14 }, (_, index) => {
                  const phase = (almanac.moon.phase + index * (1 / 29.53)) % 1;
                  const datePoint = new Date(date);
                  datePoint.setDate(date.getDate() + index);

                  return (
                    <div key={datePoint.toISOString()} className="min-w-[58px] rounded-md border p-2 text-center">
                      <div className="text-[10px] text-muted-foreground">
                        {datePoint.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className="text-xs font-medium">{datePoint.getDate()}</div>
                      <div className="flex justify-center py-1">
                        <MoonPhaseSVG phase={phase} size={22} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {(phase * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
