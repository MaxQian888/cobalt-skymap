/**
 * Fetches a single-epoch JPL Horizons ephemeris ("now") for a solar-system body,
 * for use as a high-precision reference position in object panels. Gracefully
 * degrades: returns an error string the consumer can hide on, rather than throwing.
 */

import { useEffect, useState } from 'react';
import { fetchHorizonsEphemeris } from '@/lib/services/horizons/service';
import type { HorizonsRow } from '@/lib/services/horizons/types';

export interface HorizonsEphemerisState {
  row: HorizonsRow | null;
  loading: boolean;
  error: string | null;
}

interface HorizonsResult {
  /** The body this result corresponds to; '' before any fetch resolves. */
  key: string;
  row: HorizonsRow | null;
  error: string | null;
}

/** Format a Date as Horizons-friendly UTC `YYYY-MM-DD HH:MM`. */
function formatHorizonsTime(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())} ` +
    `${p(date.getUTCHours())}:${p(date.getUTCMinutes())}`
  );
}

export function useHorizonsEphemeris(
  body: string | null,
  enabled: boolean,
): HorizonsEphemerisState {
  // State is only written from async callbacks (never synchronously in the
  // effect); `loading` is derived from whether the result matches the request.
  const [result, setResult] = useState<HorizonsResult>({ key: '', row: null, error: null });

  useEffect(() => {
    if (!enabled || !body) return;

    let cancelled = false;
    const now = new Date();
    const start = formatHorizonsTime(now);
    const stop = formatHorizonsTime(new Date(now.getTime() + 60_000));

    fetchHorizonsEphemeris({ body, start, stop, step: '30 m' })
      .then((eph) => {
        if (!cancelled) setResult({ key: body, row: eph.rows[0] ?? null, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setResult({ key: body, row: null, error: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [body, enabled]);

  if (!enabled || !body) {
    return { row: null, loading: false, error: null };
  }

  const ready = result.key === body;
  return {
    row: ready ? result.row : null,
    loading: !ready,
    error: ready ? result.error : null,
  };
}
