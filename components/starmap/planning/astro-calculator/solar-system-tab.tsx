'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, ListPlus, NotebookPen, Orbit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isExplicitMinorObjectQuery } from '@/lib/astronomy/object-resolver/parser/minor-parser';
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
import {
  fetchSmallBodyEphemeris,
} from './small-body-adapter';
import {
  AstroCalculatorResultActionsBar,
  AstroCalculatorRowActions,
  ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME,
  ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME,
} from './result-action-layout';
import { useAstroCalculatorResultActions } from './result-actions';
import type { AstroCalculatorObserverContext } from './types';

interface SolarSystemTabProps {
  latitude: number;
  longitude: number;
  observerContext?: AstroCalculatorObserverContext;
  sharedDate?: string;
  sharedTime?: string;
  onSharedDateChange?: (nextDate: string) => void;
  onSharedTimeChange?: (nextTime: string) => void;
}

interface SolarSystemRow {
  body: string;
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

function getExplicitMinorObjectQuery(input: string): string | null {
  const query = input.trim();
  if (!query) {
    return null;
  }
  if (isExplicitMinorObjectQuery(query)) {
    return query;
  }

  const slashIndex = query.indexOf('/');
  if (slashIndex > 0 && isExplicitMinorObjectQuery(query.slice(0, slashIndex))) {
    return query;
  }

  return null;
}

export function SolarSystemTab({
  latitude,
  longitude,
  observerContext,
  sharedDate,
  sharedTime,
  onSharedDateChange,
  onSharedTimeChange,
}: SolarSystemTabProps) {
  const t = useTranslations();
  // Controlled by the dialog's shared date/time when provided; local state is
  // only the fallback for standalone usage. No sync effect needed.
  const [localDate, setLocalDate] = useState(() => sharedDate ?? toDateInput(new Date()));
  const [localTime, setLocalTime] = useState(sharedTime ?? '22:00');
  const date = sharedDate ?? localDate;
  const time = sharedTime ?? localTime;
  const [minorObjectQuery, setMinorObjectQuery] = useState('');
  const [includePluto, setIncludePluto] = useState(true);
  const [rows, setRows] = useState<SolarSystemRow[]>([]);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceDiagnostics, setSourceDiagnostics] = useState<string[]>([]);
  const {
    copyResults,
    exportResults,
    addTargetToList,
    openPlannerForTarget,
  } = useAstroCalculatorResultActions(observerContext);

  const dateTime = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);
  const bodies = useMemo(() => includePluto ? [...BASE_BODIES, 'Pluto' as const] : BASE_BODIES, [includePluto]);
  const explicitMinorObjectQuery = useMemo(() => getExplicitMinorObjectQuery(minorObjectQuery), [minorObjectQuery]);
  const exportLines = useMemo(() => {
    return [
      `Date: ${date}`,
      `Time: ${time}`,
      `Include Pluto: ${includePluto}`,
      '',
      ...rows.map((row) => [
        row.body,
        `RA=${degreesToHMS(row.ra)}`,
        `Dec=${degreesToDMS(row.dec)}`,
        `Alt=${row.altitude.toFixed(2)}`,
        `Az=${row.azimuth.toFixed(2)}`,
        `Mag=${row.magnitude !== undefined ? row.magnitude.toFixed(2) : '--'}`,
        `Phase=${row.phaseFraction !== undefined ? `${(row.phaseFraction * 100).toFixed(1)}%` : '--'}`,
        `Rise=${formatTimeShort(row.riseTime)}`,
        `Transit=${formatTimeShort(row.transitTime)}`,
        `Set=${formatTimeShort(row.setTime)}`,
      ].join(' | ')),
    ];
  }, [date, includePluto, rows, time]);

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
              contextKey: observerContext?.contextKey,
            })),
            { concurrency: 3 },
          ),
          runCalculatorRiseTransitSetBatch(
            bodies.map((body) => ({
              body,
              observer: { latitude, longitude },
              date: dateTime,
              contextKey: observerContext?.contextKey,
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

        const metaEntries = [
          ...ephemerisResults.map(item => item.meta),
          ...rtsResults.map(item => item.meta),
        ];
        const nextSourceDiagnostics: string[] = [];

        if (explicitMinorObjectQuery) {
          const smallBodyResult = await fetchSmallBodyEphemeris({
            query: explicitMinorObjectQuery,
            observer: {
              latitude,
              longitude,
              elevation: observerContext?.elevation,
            },
            startDate: dateTime,
            stepHours: 24,
            steps: 1,
          });
          const spotlight = smallBodyResult.points[0];

          if (spotlight) {
            const [smallBodyRts] = await runCalculatorRiseTransitSetBatch([
              {
                body: 'Custom',
                observer: { latitude, longitude },
                date: spotlight.date,
                contextKey: observerContext?.contextKey,
                customCoordinate: {
                  ra: spotlight.ra,
                  dec: spotlight.dec,
                },
              },
            ]);

            nextRows.push({
              body: smallBodyResult.meta.resolvedName,
              ra: spotlight.ra,
              dec: spotlight.dec,
              altitude: spotlight.altitude,
              azimuth: spotlight.azimuth,
              magnitude: spotlight.magnitude,
              phaseFraction: undefined,
              riseTime: smallBodyRts.response.riseTime,
              transitTime: smallBodyRts.response.transitTime,
              setTime: smallBodyRts.response.setTime,
            });

            metaEntries.push(smallBodyRts.meta);
          }

          nextSourceDiagnostics.push(
            `Small-body query=${explicitMinorObjectQuery}`,
            `Small-body source=${smallBodyResult.meta.source}`,
            `Resolved target=${smallBodyResult.meta.resolvedName}`,
            ...smallBodyResult.meta.warnings,
          );
        }

        const combinedMeta = summarizeCalculatorMeta(metaEntries);

        if (!cancelled) {
          setRows(nextRows);
          setSourceDiagnostics(nextSourceDiagnostics);
          setMetaSummary(combinedMeta);
        }
      } catch (runError) {
        if (!cancelled) {
          setRows([]);
          setSourceDiagnostics([]);
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
  }, [bodies, dateTime, explicitMinorObjectQuery, latitude, longitude, observerContext?.contextKey, observerContext?.elevation, t]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.date')}</Label>
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              const value = event.target.value;
              setLocalDate(value);
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
              setLocalTime(value);
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
        <div className="flex flex-wrap items-end justify-end gap-2">
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="solar-system-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
          {isLoading && <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>}
          <Badge variant="outline">{rows.length} {t('astroCalc.objects')}</Badge>
        </div>
      </div>

      <div className="space-y-1.5 shrink-0">
        <Label className="text-xs">{t('astroCalc.minorObjectQuery')}</Label>
        <Input
          value={minorObjectQuery}
          onChange={(event) => setMinorObjectQuery(event.target.value)}
          aria-label={t('astroCalc.minorObjectQuery')}
          placeholder={t('astroCalc.minorObjectPlaceholder')}
          className="h-8"
        />
      </div>

      {error && (
        <div className="shrink-0 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 border rounded-lg">
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
                <TableHead>{t('astroCalc.actions')}</TableHead>
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
                  <TableCell>
                    <AstroCalculatorRowActions rowKey={row.body}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME}
                        aria-label={`${t('astroCalc.addToList')}: ${row.body}`}
                        onClick={() => addTargetToList({
                          name: row.body,
                          ra: row.ra,
                          dec: row.dec,
                        })}
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME}
                        aria-label={`${t('astroCalc.openPlanner')}: ${row.body}`}
                        onClick={() => openPlannerForTarget({
                          name: row.body,
                          ra: row.ra,
                          dec: row.dec,
                        })}
                      >
                        <NotebookPen className="h-3.5 w-3.5" />
                      </Button>
                    </AstroCalculatorRowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {rows.length > 0 && (
        <AstroCalculatorResultActionsBar className="shrink-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.copyResults')}
            onClick={() => void copyResults({
              title: t('astroCalc.solarSystem'),
              fileStem: 'astro-calculator-solar-system',
              observerContext,
              metaSummary,
              diagnostics: sourceDiagnostics,
              contentLines: exportLines,
            })}
          >
            {t('astroCalc.copyResults')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.exportResults')}
            onClick={() => exportResults({
              title: t('astroCalc.solarSystem'),
              fileStem: 'astro-calculator-solar-system',
              observerContext,
              metaSummary,
              diagnostics: sourceDiagnostics,
              contentLines: exportLines,
            })}
          >
            <Download className="h-3.5 w-3.5" />
            {t('astroCalc.exportResults')}
          </Button>
        </AstroCalculatorResultActionsBar>
      )}
    </div>
  );
}
