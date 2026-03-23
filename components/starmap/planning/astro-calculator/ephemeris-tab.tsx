'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, MapPinned } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { parseDecCoordinate, parseRACoordinate } from '@/lib/astronomy/coordinates/conversions';
import { type EngineBody, type EphemerisPoint } from '@/lib/astronomy/engine';
import { runCalculatorEphemeris, type CalculatorMetaSummary } from './orchestrator';

interface EphemerisTabProps {
  latitude: number;
  longitude: number;
  selectedTarget?: { name: string; ra: number; dec: number };
  sharedDate?: string;
  onSharedDateChange?: (nextDate: string) => void;
}

type CoordinateOutputMode = 'equatorial' | 'horizontal' | 'galactic' | 'ecliptic';

const TARGET_OPTIONS: Array<{ value: EngineBody; label: string }> = [
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

function toDateInputString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function EphemerisTab({
  latitude,
  longitude,
  selectedTarget,
  sharedDate,
  onSharedDateChange,
}: EphemerisTabProps) {
  const t = useTranslations();
  const [targetMode, setTargetMode] = useState<EngineBody>(selectedTarget ? 'Custom' : 'Moon');
  const [targetRA, setTargetRA] = useState(selectedTarget?.ra ? degreesToHMS(selectedTarget.ra) : '');
  const [targetDec, setTargetDec] = useState(selectedTarget?.dec ? degreesToDMS(selectedTarget.dec) : '');
  const [startDate, setStartDate] = useState(sharedDate ?? toDateInputString(new Date()));
  const [stepHours, setStepHours] = useState(1);
  const [numSteps, setNumSteps] = useState(24);
  const [coordinateMode, setCoordinateMode] = useState<CoordinateOutputMode>('equatorial');
  const [ephemeris, setEphemeris] = useState<EphemerisPoint[]>([]);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const parsedRa = useMemo(() => parseRACoordinate(targetRA), [targetRA]);
  const parsedDec = useMemo(() => parseDecCoordinate(targetDec), [targetDec]);

  const customCoordinateError = useMemo(() => {
    if (targetMode !== 'Custom') {
      return null;
    }
    if (targetRA.trim().length === 0 || targetDec.trim().length === 0) {
      return t('astroCalc.enterCoordinates');
    }
    if (parsedRa === null || parsedDec === null) {
      return t('astroCalc.invalidCoordinates');
    }
    return null;
  }, [parsedDec, parsedRa, targetDec, targetMode, targetRA, t]);

  useEffect(() => {
    if (sharedDate && sharedDate !== startDate) {
      setStartDate(sharedDate);
    }
  }, [sharedDate, startDate]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (customCoordinateError) {
        setEphemeris([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const result = await runCalculatorEphemeris({
          body: targetMode,
          observer: { latitude, longitude },
          startDate: new Date(`${startDate}T00:00:00`),
          stepHours,
          steps: numSteps,
          customCoordinate: targetMode === 'Custom' && parsedRa !== null && parsedDec !== null
            ? { ra: parsedRa, dec: parsedDec }
            : undefined,
        });

        if (!cancelled) {
          setEphemeris(result.response.points);
          setMetaSummary({
            total: 1,
            sourceCounts: {
              tauri: result.meta.source === 'tauri' ? 1 : 0,
              fallback: result.meta.source === 'fallback' ? 1 : 0,
            },
            cacheHits: result.meta.cache === 'hit' ? 1 : 0,
            cacheMisses: result.meta.cache === 'miss' ? 1 : 0,
            degradedCount: result.meta.degraded ? 1 : 0,
            warningsCount: result.meta.warnings?.length ?? 0,
            latestComputedAt: result.meta.computedAt,
          });
        }
      } catch (runError) {
        if (!cancelled) {
          setEphemeris([]);
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
  }, [customCoordinateError, latitude, longitude, numSteps, parsedDec, parsedRa, startDate, stepHours, t, targetMode]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.targetType')}</Label>
          <Select value={targetMode} onValueChange={(value) => setTargetMode(value as EngineBody)}>
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
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.stepHours')}</Label>
          <Select value={stepHours.toString()} onValueChange={(value) => setStepHours(Number.parseInt(value, 10))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t('astroCalc.hourIntervals.1h')}</SelectItem>
              <SelectItem value="2">{t('astroCalc.hourIntervals.2h')}</SelectItem>
              <SelectItem value="6">{t('astroCalc.hourIntervals.6h')}</SelectItem>
              <SelectItem value="12">{t('astroCalc.hourIntervals.12h')}</SelectItem>
              <SelectItem value="24">{t('astroCalc.hourIntervals.1d')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.steps')}</Label>
          <Select value={numSteps.toString()} onValueChange={(value) => setNumSteps(Number.parseInt(value, 10))}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12</SelectItem>
              <SelectItem value="24">24</SelectItem>
              <SelectItem value="48">48</SelectItem>
              <SelectItem value="96">96</SelectItem>
              <SelectItem value="168">{t('astroCalc.oneWeek')}</SelectItem>
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

      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.coordinateOutput')}</Label>
          <Select value={coordinateMode} onValueChange={(value) => setCoordinateMode(value as CoordinateOutputMode)}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equatorial">{t('astroCalc.coordinateModes.equatorial')}</SelectItem>
              <SelectItem value="horizontal">{t('astroCalc.coordinateModes.horizontal')}</SelectItem>
              <SelectItem value="galactic">{t('astroCalc.coordinateModes.galactic')}</SelectItem>
              <SelectItem value="ecliptic">{t('astroCalc.coordinateModes.ecliptic')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{ephemeris.length} {t('astroCalc.entries')}</Badge>
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="ephemeris-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
          {isLoading && (
            <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>
          )}
        </div>
      </div>

      {customCoordinateError && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-2 text-xs text-yellow-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {customCoordinateError}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <ScrollArea className="h-[330px] border rounded-lg">
        {ephemeris.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <MapPinned className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noData')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>{t('astroCalc.dateTime')}</TableHead>
                {coordinateMode === 'equatorial' && (
                  <>
                    <TableHead>{t('astroCalc.tableRA')}</TableHead>
                    <TableHead>{t('astroCalc.tableDec')}</TableHead>
                  </>
                )}
                {coordinateMode === 'horizontal' && (
                  <>
                    <TableHead className="text-right">{t('astroCalc.altitude')}</TableHead>
                    <TableHead className="text-right">{t('astroCalc.azimuth')}</TableHead>
                  </>
                )}
                {coordinateMode === 'galactic' && (
                  <>
                    <TableHead className="text-right">{t('astroCalc.galacticL')}</TableHead>
                    <TableHead className="text-right">{t('astroCalc.galacticB')}</TableHead>
                  </>
                )}
                {coordinateMode === 'ecliptic' && (
                  <>
                    <TableHead className="text-right">{t('astroCalc.eclipticLon')}</TableHead>
                    <TableHead className="text-right">{t('astroCalc.eclipticLat')}</TableHead>
                  </>
                )}
                <TableHead className="text-right">{t('astroCalc.mag')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.phase')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ephemeris.map((entry) => (
                <TableRow key={entry.date.toISOString()}>
                  <TableCell className="font-mono text-xs">
                    {entry.date.toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  {coordinateMode === 'equatorial' && (
                    <>
                      <TableCell className="font-mono text-xs">{degreesToHMS(entry.ra)}</TableCell>
                      <TableCell className="font-mono text-xs">{degreesToDMS(entry.dec)}</TableCell>
                    </>
                  )}
                  {coordinateMode === 'horizontal' && (
                    <>
                      <TableCell className={cn(
                        'text-xs text-right tabular-nums',
                        entry.altitude > 30 ? 'text-green-500' : entry.altitude > 0 ? 'text-yellow-500' : 'text-red-500'
                      )}
                      >
                        {entry.altitude.toFixed(2)}°
                      </TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{entry.azimuth.toFixed(2)}°</TableCell>
                    </>
                  )}
                  {coordinateMode === 'galactic' && (
                    <>
                      <TableCell className="text-xs text-right tabular-nums">{entry.galacticL.toFixed(4)}°</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{entry.galacticB.toFixed(4)}°</TableCell>
                    </>
                  )}
                  {coordinateMode === 'ecliptic' && (
                    <>
                      <TableCell className="text-xs text-right tabular-nums">{entry.eclipticLon.toFixed(4)}°</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{entry.eclipticLat.toFixed(4)}°</TableCell>
                    </>
                  )}
                  <TableCell className="text-xs text-right tabular-nums">
                    {entry.magnitude !== undefined ? entry.magnitude.toFixed(2) : '--'}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">
                    {entry.phaseFraction !== undefined ? `${(entry.phaseFraction * 100).toFixed(1)}%` : '--'}
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
