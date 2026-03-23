'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Compass } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  altAzToRaDecAtTime,
  eclipticToRaDec,
  galacticToRaDec,
  raDecToEcliptic,
  raDecToGalactic,
} from '@/lib/astronomy/coordinates/transforms';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { runCalculatorCoordinates, type CalculatorMetaSummary } from './orchestrator';

interface CoordinateTabProps {
  latitude: number;
  longitude: number;
  sharedDate?: string;
  sharedTime?: string;
  onSharedDateChange?: (nextDate: string) => void;
  onSharedTimeChange?: (nextTime: string) => void;
}

type SourceSystem = 'equatorial' | 'galactic' | 'ecliptic' | 'horizontal';

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export function CoordinateTab({
  latitude,
  longitude,
  sharedDate,
  sharedTime,
  onSharedDateChange,
  onSharedTimeChange,
}: CoordinateTabProps) {
  const t = useTranslations();
  const [source, setSource] = useState<SourceSystem>('equatorial');
  const [coord1, setCoord1] = useState('10.684708');
  const [coord2, setCoord2] = useState('41.26875');
  const [date, setDate] = useState(sharedDate ?? toDateInput(new Date()));
  const [time, setTime] = useState(sharedTime ?? '22:00');
  const [observerLat, setObserverLat] = useState(latitude.toFixed(4));
  const [observerLon, setObserverLon] = useState(longitude.toFixed(4));
  const [useRefraction, setUseRefraction] = useState(true);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runCalculatorCoordinates>>['response'] | null>(null);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [roundTripArcsec, setRoundTripArcsec] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dateTime = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);

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
      const value1 = Number.parseFloat(coord1);
      const value2 = Number.parseFloat(coord2);
      const lat = Number.parseFloat(observerLat);
      const lon = Number.parseFloat(observerLon);

      if (![value1, value2, lat, lon].every(Number.isFinite)) {
        setError(t('astroCalc.invalidCoordinates'));
        setResult(null);
        setRoundTripArcsec(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let equatorial: { ra: number; dec: number };
        switch (source) {
          case 'equatorial':
            equatorial = { ra: value1, dec: value2 };
            break;
          case 'galactic':
            equatorial = galacticToRaDec(value1, value2, dateTime);
            break;
          case 'ecliptic':
            equatorial = eclipticToRaDec(value1, value2, dateTime);
            break;
          case 'horizontal':
            equatorial = altAzToRaDecAtTime(value2, value1, lat, lon, dateTime);
            break;
          default:
            equatorial = { ra: value1, dec: value2 };
        }

        const converted = await runCalculatorCoordinates({
          coordinate: equatorial,
          observer: { latitude: lat, longitude: lon },
          date: dateTime,
          refraction: useRefraction ? 'normal' : 'none',
        });

        if (!cancelled) {
          setResult(converted.response);
          setMetaSummary({
            total: 1,
            sourceCounts: {
              tauri: converted.meta.source === 'tauri' ? 1 : 0,
              fallback: converted.meta.source === 'fallback' ? 1 : 0,
            },
            cacheHits: converted.meta.cache === 'hit' ? 1 : 0,
            cacheMisses: converted.meta.cache === 'miss' ? 1 : 0,
            degradedCount: converted.meta.degraded ? 1 : 0,
            warningsCount: converted.meta.warnings?.length ?? 0,
            latestComputedAt: converted.meta.computedAt,
          });

          let errorDeg = 0;
          if (source === 'galactic') {
            const round = raDecToGalactic(converted.response.equatorial.ra, converted.response.equatorial.dec, dateTime);
            errorDeg = Math.max(
              normalizeDifference(round.l, value1),
              Math.abs(round.b - value2)
            );
          } else if (source === 'ecliptic') {
            const round = raDecToEcliptic(converted.response.equatorial.ra, converted.response.equatorial.dec, dateTime);
            errorDeg = Math.max(
              normalizeDifference(round.longitude, value1),
              Math.abs(round.latitude - value2)
            );
          } else if (source === 'equatorial') {
            errorDeg = Math.max(
              normalizeDifference(converted.response.equatorial.ra, value1),
              Math.abs(converted.response.equatorial.dec - value2)
            );
          } else {
            errorDeg = Math.max(
              normalizeDifference(converted.response.horizontal.azimuth, value1),
              Math.abs(converted.response.horizontal.altitude - value2)
            );
          }

          setRoundTripArcsec(errorDeg * 3600);
        }
      } catch (runError) {
        if (!cancelled) {
          setResult(null);
          setMetaSummary(null);
          setRoundTripArcsec(null);
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
  }, [coord1, coord2, dateTime, observerLat, observerLon, source, t, useRefraction]);

  const field1Label = source === 'horizontal'
    ? t('astroCalc.azimuth')
    : source === 'galactic'
      ? t('astroCalc.galacticL')
      : source === 'ecliptic'
        ? t('astroCalc.eclipticLon')
        : t('astroCalc.raLabel');

  const field2Label = source === 'horizontal'
    ? t('astroCalc.altitude')
    : source === 'galactic'
      ? t('astroCalc.galacticB')
      : source === 'ecliptic'
        ? t('astroCalc.eclipticLat')
        : t('astroCalc.decLabel');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.sourceSystem')}</Label>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as SourceSystem)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="equatorial">{t('astroCalc.coordinateModes.equatorial')}</option>
            <option value="galactic">{t('astroCalc.coordinateModes.galactic')}</option>
            <option value="ecliptic">{t('astroCalc.coordinateModes.ecliptic')}</option>
            <option value="horizontal">{t('astroCalc.coordinateModes.horizontal')}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{field1Label}</Label>
          <Input value={coord1} onChange={(event) => setCoord1(event.target.value)} className="h-8 font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{field2Label}</Label>
          <Input value={coord2} onChange={(event) => setCoord2(event.target.value)} className="h-8 font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.refraction')}</Label>
          <div className="h-8 flex items-center gap-2 rounded-md border px-2">
            <Switch checked={useRefraction} onCheckedChange={setUseRefraction} />
            <span className="text-xs">
              {useRefraction ? t('astroCalc.refractionNormal') : t('astroCalc.refractionNone')}
            </span>
          </div>
        </div>
      </div>

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
          <Label className="text-xs">{t('astroCalc.latitude')}</Label>
          <Input value={observerLat} onChange={(event) => setObserverLat(event.target.value)} className="h-8 font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.longitude')}</Label>
          <Input value={observerLon} onChange={(event) => setObserverLon(event.target.value)} className="h-8 font-mono" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isLoading && <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>}
        {roundTripArcsec !== null && (
          <Badge variant="outline">{t('astroCalc.roundTripError')}: {roundTripArcsec.toFixed(2)} arcsec</Badge>
        )}
        {metaSummary && (
          <Badge variant="secondary" className="text-[10px]" data-testid="coordinate-meta">
            {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Compass className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('astroCalc.coordinateModes.equatorial')}</span>
            </div>
            <div className="text-xs space-y-1 font-mono">
              <div>RA: {degreesToHMS(result.equatorial.ra)} ({result.equatorial.ra.toFixed(6)}°)</div>
              <div>Dec: {degreesToDMS(result.equatorial.dec)} ({result.equatorial.dec.toFixed(6)}°)</div>
              <div>HA: {result.sidereal.hourAngle.toFixed(4)}°</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-card">
            <div className="text-sm font-medium mb-2">{t('astroCalc.coordinateModes.horizontal')}</div>
            <div className="text-xs space-y-1 font-mono">
              <div>Alt: {result.horizontal.altitude.toFixed(6)}°</div>
              <div>Az: {result.horizontal.azimuth.toFixed(6)}°</div>
              <div>LST: {result.sidereal.lst.toFixed(6)}°</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-card">
            <div className="text-sm font-medium mb-2">{t('astroCalc.coordinateModes.galactic')}</div>
            <div className="text-xs space-y-1 font-mono">
              <div>l: {result.galactic.l.toFixed(6)}°</div>
              <div>b: {result.galactic.b.toFixed(6)}°</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-card">
            <div className="text-sm font-medium mb-2">{t('astroCalc.coordinateModes.ecliptic')}</div>
            <div className="text-xs space-y-1 font-mono">
              <div>λ: {result.ecliptic.longitude.toFixed(6)}°</div>
              <div>β: {result.ecliptic.latitude.toFixed(6)}°</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
