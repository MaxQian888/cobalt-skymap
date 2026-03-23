'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Orbit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type EngineBody } from '@/lib/astronomy/engine';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { formatTimeShort } from '@/lib/astronomy/time/formats';
import { cn } from '@/lib/utils';
import {
  runCalculatorEphemerisBatch,
  runCalculatorRiseTransitSetBatch,
  summarizeCalculatorMeta,
  type CalculatorMetaSummary,
} from './orchestrator';

interface SolarSystemTabProps {
  latitude: number;
  longitude: number;
  sharedDate?: string;
  sharedTime?: string;
  onSharedDateChange?: (nextDate: string) => void;
  onSharedTimeChange?: (nextTime: string) => void;
}

interface SolarSystemRow {
  body: EngineBody;
  ra: number;
  dec: number;
  altitude: number;
  azimuth: number;
  magnitude?: number;
  phaseFraction?: number;
  riseTime: Date | null;
  transitTime: Date | null;
  setTime: Date | null;
}

const BASE_BODIES: EngineBody[] = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
];

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function SolarSystemTab({
  latitude,
  longitude,
  sharedDate,
  sharedTime,
  onSharedDateChange,
  onSharedTimeChange,
}: SolarSystemTabProps) {
  const t = useTranslations();
  const [date, setDate] = useState(sharedDate ?? toDateInput(new Date()));
  const [time, setTime] = useState(sharedTime ?? '22:00');
  const [includePluto, setIncludePluto] = useState(true);
  const [rows, setRows] = useState<SolarSystemRow[]>([]);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dateTime = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);
  const bodies = useMemo(() => includePluto ? [...BASE_BODIES, 'Pluto' as const] : BASE_BODIES, [includePluto]);

  useEffect(() => {
    if (sharedDate && sharedDate !== date) {
      setDate(sharedDate);
    }
  }, [sharedDate, date]);

  useEffect(() => {
    if (sharedTime && sharedTime !== time) {
      setTime(sharedTime);
    }
  }, [sharedTime, time]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const [ephemerisResults, rtsResults] = await Promise.all([
          runCalculatorEphemerisBatch(
            bodies.map((body) => ({
              body,
              observer: { latitude, longitude },
              startDate: dateTime,
              stepHours: 24,
              steps: 1,
            })),
            { concurrency: 3 },
          ),
          runCalculatorRiseTransitSetBatch(
            bodies.map((body) => ({
              body,
              observer: { latitude, longitude },
              date: dateTime,
            })),
            { concurrency: 3 },
          ),
        ]);

        const nextRows = bodies.map((body, index): SolarSystemRow => {
          const ephemeris = ephemerisResults[index].response;
          const rts = rtsResults[index].response;
          const point = ephemeris.points[0];

          return {
            body,
            ra: point.ra,
            dec: point.dec,
            altitude: point.altitude,
            azimuth: point.azimuth,
            magnitude: point.magnitude,
            phaseFraction: point.phaseFraction,
            riseTime: rts.riseTime,
            transitTime: rts.transitTime,
            setTime: rts.setTime,
          };
        });

        const combinedMeta = summarizeCalculatorMeta([
          ...ephemerisResults.map(item => item.meta),
          ...rtsResults.map(item => item.meta),
        ]);

        if (!cancelled) {
          setRows(nextRows);
          setMetaSummary(combinedMeta);
        }
      } catch (runError) {
        if (!cancelled) {
          setRows([]);
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
  }, [bodies, dateTime, latitude, longitude, t]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.date')}</Label>
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              const value = event.target.value;
              setDate(value);
              onSharedDateChange?.(value);
            }}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.time')}</Label>
          <Input
            type="time"
            value={time}
            onChange={(event) => {
              const value = event.target.value;
              setTime(value);
              onSharedTimeChange?.(value);
            }}
            className="h-8"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.includePluto')}</Label>
          <div className="h-8 rounded-md border px-2 flex items-center gap-2">
            <Switch checked={includePluto} onCheckedChange={setIncludePluto} />
            <span className="text-xs">Pluto</span>
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="solar-system-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
          {isLoading && <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>}
          <Badge variant="outline">{rows.length} {t('astroCalc.objects')}</Badge>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <ScrollArea className="h-[360px] border rounded-lg">
        {rows.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <Orbit className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noData')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>{t('astroCalc.name')}</TableHead>
                <TableHead>{t('astroCalc.tableRA')}</TableHead>
                <TableHead>{t('astroCalc.tableDec')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.altitude')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.azimuth')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.mag')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.phase')}</TableHead>
                <TableHead>{t('astroCalc.rise')}</TableHead>
                <TableHead>{t('astroCalc.transit')}</TableHead>
                <TableHead>{t('astroCalc.set')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.body}>
                  <TableCell className="font-medium text-sm">{row.body}</TableCell>
                  <TableCell className="font-mono text-xs">{degreesToHMS(row.ra)}</TableCell>
                  <TableCell className="font-mono text-xs">{degreesToDMS(row.dec)}</TableCell>
                  <TableCell className={cn(
                    'text-xs text-right tabular-nums',
                    row.altitude > 30 ? 'text-green-500' : row.altitude > 0 ? 'text-yellow-500' : 'text-red-500'
                  )}
                  >
                    {row.altitude.toFixed(2)}°
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.azimuth.toFixed(2)}°</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.magnitude !== undefined ? row.magnitude.toFixed(2) : '--'}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.phaseFraction !== undefined ? `${(row.phaseFraction * 100).toFixed(1)}%` : '--'}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.riseTime)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.transitTime)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.setTime)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
