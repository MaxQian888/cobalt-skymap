'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, MapPinned } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isExplicitMinorObjectQuery } from '@/lib/astronomy/object-resolver/parser/minor-parser';
import { parseDecCoordinate, parseRACoordinate } from '@/lib/astronomy/coordinates/conversions';
import { type EngineBody } from '@/lib/astronomy/engine';
import { formatTimeShort } from '@/lib/astronomy/time/formats';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { AltitudeChart } from '../altitude-chart';
import { runCalculatorRiseTransitSetBatch, summarizeCalculatorMeta, type CalculatorMetaSummary } from './orchestrator';
import {
  fetchSmallBodyEphemeris,
  toSmallBodyCalculationMeta,
} from './small-body-adapter';
import {
  AstroCalculatorResultActionsBar,
  ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME,
} from './result-action-layout';
import { useAstroCalculatorResultActions } from './result-actions';
import type { AstroCalculatorObserverContext } from './types';

interface RTSTabProps {
  latitude: number;
  longitude: number;
  observerContext?: AstroCalculatorObserverContext;
  selectedTarget?: { name: string; ra: number; dec: number };
  sharedDate?: string;
  onSharedDateChange?: (nextDate: string) => void;
}

type TargetMode = EngineBody;

const TARGET_OPTIONS: Array<{ value: TargetMode; label: string }> = [
  { value: 'Custom', label: 'Custom' },
  { value: 'Sun', label: 'Sun' },
  { value: 'Moon', label: 'Moon' },
  { value: 'Mercury', label: 'Mercury' },
  { value: 'Venus', label: 'Venus' },
  { value: 'Mars', label: 'Mars' },
  { value: 'Jupiter', label: 'Jupiter' },
  { value: 'Saturn', label: 'Saturn' },
  { value: 'Uranus', label: 'Uranus' },
  { value: 'Neptune', label: 'Neptune' },
  { value: 'Pluto', label: 'Pluto' },
];

function toLocalDateString(date: Date): string {
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

interface RTSRow {
  date: Date;
  riseTime: Date | null;
  transitTime: Date | null;
  setTime: Date | null;
  transitAlt: number;
  isCircumpolar: boolean;
  neverRises: boolean;
  darkImagingHours: number;
}

export function RTSTab({ latitude, longitude, observerContext, selectedTarget, sharedDate, onSharedDateChange }: RTSTabProps) {
  const t = useTranslations();
  const [targetMode, setTargetMode] = useState<TargetMode>(selectedTarget ? 'Custom' : 'Moon');
  const [targetName, setTargetName] = useState(selectedTarget?.name ?? '');
  const [targetRA, setTargetRA] = useState(selectedTarget?.ra ? degreesToHMS(selectedTarget.ra) : '');
  const [targetDec, setTargetDec] = useState(selectedTarget?.dec ? degreesToDMS(selectedTarget.dec) : '');
  const [dateRange, setDateRange] = useState(7);
  const [startDate, setStartDate] = useState(sharedDate ?? toLocalDateString(new Date()));
  const [rows, setRows] = useState<RTSRow[]>([]);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceDiagnostics, setSourceDiagnostics] = useState<string[]>([]);
  const {
    copyResults,
    exportResults,
  } = useAstroCalculatorResultActions(observerContext);

  useEffect(() => {
    if (sharedDate && sharedDate !== startDate) {
      setStartDate(sharedDate);
    }
  }, [sharedDate, startDate]);

  const parsedRa = useMemo(() => parseRACoordinate(targetRA), [targetRA]);
  const parsedDec = useMemo(() => parseDecCoordinate(targetDec), [targetDec]);
  const explicitMinorObjectQuery = useMemo(() => getExplicitMinorObjectQuery(targetName), [targetName]);
  const exportLines = useMemo(() => {
    return [
      `Target mode: ${targetMode}`,
      `Target name: ${targetName || targetMode}`,
      `Start date: ${startDate}`,
      `Days: ${dateRange}`,
      '',
      ...rows.map((row) => [
        row.date.toISOString(),
        `Rise=${formatTimeShort(row.riseTime)}`,
        `Transit=${formatTimeShort(row.transitTime)}`,
        `Set=${formatTimeShort(row.setTime)}`,
        `TransitAlt=${row.transitAlt.toFixed(1)}`,
        row.neverRises
          ? 'Never rises'
          : row.isCircumpolar
            ? 'Circumpolar'
            : `DarkHours=${row.darkImagingHours.toFixed(1)}`,
      ].join(' | ')),
    ];
  }, [dateRange, rows, startDate, targetMode, targetName]);
  const coordinateError = useMemo(() => {
    if (explicitMinorObjectQuery) return null;
    if (targetMode !== 'Custom') return null;
    if (targetRA.trim().length === 0 || targetDec.trim().length === 0) {
      return t('astroCalc.enterCoordinates');
    }
    if (parsedRa === null || parsedDec === null) {
      return t('astroCalc.invalidCoordinates');
    }
    return null;
  }, [explicitMinorObjectQuery, parsedDec, parsedRa, targetDec, targetMode, targetRA, t]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (coordinateError) {
        setRows([]);
        setSourceDiagnostics([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const start = new Date(`${startDate}T12:00:00`);

        if (explicitMinorObjectQuery) {
          const smallBodyResult = await fetchSmallBodyEphemeris({
            query: explicitMinorObjectQuery,
            observer: {
              latitude,
              longitude,
              elevation: observerContext?.elevation,
            },
            startDate: start,
            stepHours: 24,
            steps: dateRange,
          });

          const batchResults = await runCalculatorRiseTransitSetBatch(
            smallBodyResult.points.map((point) => ({
              body: 'Custom',
              observer: { latitude, longitude },
              date: point.date,
              contextKey: observerContext?.contextKey,
              customCoordinate: {
                ra: point.ra,
                dec: point.dec,
              },
            })),
            { concurrency: 3 },
          );

          const nextRows: RTSRow[] = batchResults.map((batchResult, index) => ({
            date: smallBodyResult.points[index]?.date ?? new Date(start),
            riseTime: batchResult.response.riseTime,
            transitTime: batchResult.response.transitTime,
            setTime: batchResult.response.setTime,
            transitAlt: batchResult.response.transitAltitude,
            isCircumpolar: batchResult.response.isCircumpolar,
            neverRises: batchResult.response.neverRises,
            darkImagingHours: batchResult.response.darkImagingHours,
          }));

          if (!cancelled) {
            setRows(nextRows);
            setSourceDiagnostics([
              `Small-body source=${smallBodyResult.meta.source}`,
              `Resolved target=${smallBodyResult.meta.resolvedName}`,
              ...smallBodyResult.meta.warnings,
            ]);
            setMetaSummary(summarizeCalculatorMeta([
              ...batchResults.map(result => result.meta),
              toSmallBodyCalculationMeta(smallBodyResult.meta, start),
            ]));
          }
          return;
        }

        const jobs: Array<{ date: Date; request: Parameters<typeof runCalculatorRiseTransitSetBatch>[0][number] }> = [];
        for (let index = 0; index < dateRange; index += 1) {
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          jobs.push({
            date,
            request: {
              body: targetMode,
              observer: { latitude, longitude },
              date,
              contextKey: observerContext?.contextKey,
              customCoordinate: targetMode === 'Custom' && parsedRa !== null && parsedDec !== null
                ? { ra: parsedRa, dec: parsedDec }
                : undefined,
            },
          });
        }

        const batchResults = await runCalculatorRiseTransitSetBatch(
          jobs.map(job => job.request),
          { concurrency: 3 },
        );
        const nextRows: RTSRow[] = batchResults.map((batchResult, index) => ({
          date: jobs[index].date,
          riseTime: batchResult.response.riseTime,
          transitTime: batchResult.response.transitTime,
          setTime: batchResult.response.setTime,
          transitAlt: batchResult.response.transitAltitude,
          isCircumpolar: batchResult.response.isCircumpolar,
          neverRises: batchResult.response.neverRises,
          darkImagingHours: batchResult.response.darkImagingHours,
        }));

        if (!cancelled) {
          setRows(nextRows);
          setSourceDiagnostics(batchResults.flatMap((result) =>
            (result.meta.warnings ?? []).map((warning) => `Warning=${warning}`),
          ));
          setMetaSummary(summarizeCalculatorMeta(batchResults.map(result => result.meta)));
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
  }, [coordinateError, dateRange, explicitMinorObjectQuery, latitude, longitude, observerContext?.contextKey, observerContext?.elevation, parsedDec, parsedRa, startDate, t, targetMode]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const hasCustomCoordinate = targetMode === 'Custom' && parsedRa !== null && parsedDec !== null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.targetType')}</Label>
          <Select value={targetMode} onValueChange={(value) => setTargetMode(value as TargetMode)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TARGET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.startDate')}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              onSharedDateChange?.(value);
            }}
            className="h-8"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.targetName')}</Label>
          <Input
            value={targetName}
            onChange={(event) => setTargetName(event.target.value)}
            aria-label={t('astroCalc.targetName')}
            className="h-8"
            placeholder={targetMode === 'Custom' ? 'M31, NGC 7000...' : targetMode}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.daysAhead')}</Label>
          <Select value={dateRange.toString()} onValueChange={(value) => setDateRange(Number.parseInt(value, 10))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t('astroCalc.daysRange.7d')}</SelectItem>
              <SelectItem value="14">{t('astroCalc.daysRange.14d')}</SelectItem>
              <SelectItem value="30">{t('astroCalc.daysRange.30d')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {targetMode === 'Custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('astroCalc.raLabel')}</Label>
            <Input
              value={targetRA}
              onChange={(event) => setTargetRA(event.target.value)}
              placeholder="00:42:44.3"
              className="h-8 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('astroCalc.decLabel')}</Label>
            <Input
              value={targetDec}
              onChange={(event) => setTargetDec(event.target.value)}
              placeholder="+41:16:09"
              className="h-8 font-mono"
            />
          </div>
        </div>
      )}

      {coordinateError && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {coordinateError}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {hasCustomCoordinate && (
        <AltitudeChart
          ra={parsedRa}
          dec={parsedDec}
          name={targetName || t('astroCalc.defaultTarget')}
          hoursAhead={24}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {rows.length} {t('astroCalc.days')}
          </Badge>
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="rts-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
        </div>
        {isLoading && (
          <Badge variant="secondary" className="text-xs">
            {t('astroCalc.calculating')}
          </Badge>
        )}
      </div>

      {rows.length > 0 && (
        <AstroCalculatorResultActionsBar>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.copyResults')}
            onClick={() => void copyResults({
              title: t('astroCalc.rts'),
              fileStem: 'astro-calculator-rts',
              targetName: targetName || targetMode,
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
              title: t('astroCalc.rts'),
              fileStem: 'astro-calculator-rts',
              targetName: targetName || targetMode,
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

      <ScrollArea className="h-[320px] border rounded-lg">
        {rows.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <MapPinned className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noData')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>{t('astroCalc.date')}</TableHead>
                <TableHead>{t('astroCalc.rise')}</TableHead>
                <TableHead>{t('astroCalc.transit')}</TableHead>
                <TableHead>{t('astroCalc.set')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.transitAlt')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.darkHours')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.date.toISOString()}>
                  <TableCell className="text-xs font-medium">{formatDate(row.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.riseTime)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.transitTime)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(row.setTime)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.transitAlt.toFixed(1)}°</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {row.neverRises ? t('astroCalc.neverRises') : row.isCircumpolar ? t('astroCalc.circumpolar') : `${row.darkImagingHours.toFixed(1)}h`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}
