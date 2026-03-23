'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Clock3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { degreesToHMS } from '@/lib/astronomy/starmap-utils';
import { parseRACoordinate } from '@/lib/astronomy/coordinates/conversions';
import { dateToJulianDate, mjdToUTC, utcToMJD } from '@/lib/astronomy/time/julian';
import { getGMSTForDate, getLSTForDate } from '@/lib/astronomy/time/sidereal';
import { getHourAngleAtTime } from '@/lib/astronomy/coordinates/transforms';

interface TimeTabProps {
  longitude: number;
  sharedDate?: string;
  sharedTime?: string;
  onSharedDateChange?: (nextDate: string) => void;
  onSharedTimeChange?: (nextTime: string) => void;
}

type InputMode = 'datetime' | 'jd' | 'mjd';

function toDateTimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function TimeTab({
  longitude,
  sharedDate,
  sharedTime,
  onSharedDateChange,
  onSharedTimeChange,
}: TimeTabProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<InputMode>('datetime');
  const [dateTimeInputLocal, setDateTimeInputLocal] = useState(() => toDateTimeInput(new Date()));
  const [jdInput, setJdInput] = useState('2460400.500000');
  const [mjdInput, setMjdInput] = useState('60400.000000');
  const [longitudeInput, setLongitudeInput] = useState(longitude.toFixed(6));
  const [raInput, setRaInput] = useState('00:00:00');
  const dateTimeInput = sharedDate && sharedTime
    ? `${sharedDate}T${sharedTime}`
    : dateTimeInputLocal;

  const computed = useMemo(() => {
    const lon = Number.parseFloat(longitudeInput);
    if (!Number.isFinite(lon)) {
      return { error: t('astroCalc.invalidLongitude') };
    }

    let date: Date | null = null;
    if (mode === 'datetime') {
      const parsed = new Date(dateTimeInput);
      if (!Number.isFinite(parsed.getTime())) {
        return { error: t('astroCalc.invalidTimeInput') };
      }
      date = parsed;
    } else if (mode === 'jd') {
      const jd = Number.parseFloat(jdInput);
      if (!Number.isFinite(jd)) {
        return { error: t('astroCalc.invalidTimeInput') };
      }
      date = new Date((jd - 2440587.5) * 86400000);
    } else {
      const mjd = Number.parseFloat(mjdInput);
      if (!Number.isFinite(mjd)) {
        return { error: t('astroCalc.invalidTimeInput') };
      }
      date = mjdToUTC(mjd);
    }

    if (!date || !Number.isFinite(date.getTime())) {
      return { error: t('astroCalc.invalidTimeInput') };
    }

    const jd = dateToJulianDate(date);
    const mjd = utcToMJD(date);
    const gmst = getGMSTForDate(date);
    const lst = getLSTForDate(lon, date);

    const parsedRa = parseRACoordinate(raInput);
    const raForHa = parsedRa ?? 0;
    const hourAngle = getHourAngleAtTime(raForHa, lon, date);

    return {
      date,
      jd,
      mjd,
      gmst,
      lst,
      hourAngle,
      raForHa,
      error: null,
    };
  }, [dateTimeInput, jdInput, longitudeInput, mjdInput, mode, raInput, t]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.timeInputMode')}</Label>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as InputMode)}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="datetime">{t('astroCalc.utcLocal')}</option>
            <option value="jd">JD</option>
            <option value="mjd">MJD</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{mode === 'datetime' ? t('astroCalc.dateTime') : mode === 'jd' ? 'JD' : 'MJD'}</Label>
          {mode === 'datetime' && (
            <Input
              type="datetime-local"
              value={dateTimeInput}
              onChange={(event) => {
                const value = event.target.value;
                setDateTimeInputLocal(value);
                const [datePart, timePart] = value.split('T');
                if (datePart) {
                  onSharedDateChange?.(datePart);
                }
                if (timePart) {
                  onSharedTimeChange?.(timePart.slice(0, 5));
                }
              }}
              className="h-8"
            />
          )}
          {mode === 'jd' && (
            <Input value={jdInput} onChange={(event) => setJdInput(event.target.value)} className="h-8 font-mono" />
          )}
          {mode === 'mjd' && (
            <Input value={mjdInput} onChange={(event) => setMjdInput(event.target.value)} className="h-8 font-mono" />
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.longitude')}</Label>
          <Input value={longitudeInput} onChange={(event) => setLongitudeInput(event.target.value)} className="h-8 font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.raForHourAngle')}</Label>
          <Input value={raInput} onChange={(event) => setRaInput(event.target.value)} className="h-8 font-mono" />
        </div>
      </div>

      {computed.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {computed.error}
        </div>
      )}

      {!computed.error && computed.date && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t('astroCalc.utc')}: {computed.date.toISOString()}</Badge>
            <Badge variant="secondary">{t('astroCalc.local')}: {computed.date.toLocaleString()}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{t('astroCalc.timeScales')}</span>
              </div>
              <div className="space-y-1 text-xs font-mono">
                <div>JD: {computed.jd.toFixed(8)}</div>
                <div>MJD: {computed.mjd.toFixed(8)}</div>
                <div>GMST: {computed.gmst.toFixed(6)}°</div>
                <div>LST: {computed.lst.toFixed(6)}°</div>
              </div>
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <div className="text-sm font-medium mb-2">{t('astroCalc.hourAngle')}</div>
              <div className="space-y-1 text-xs font-mono">
                <div>RA: {degreesToHMS(computed.raForHa)}</div>
                <div>HA: {computed.hourAngle.toFixed(6)}°</div>
                <div>Longitude: {Number.parseFloat(longitudeInput).toFixed(6)}°</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
