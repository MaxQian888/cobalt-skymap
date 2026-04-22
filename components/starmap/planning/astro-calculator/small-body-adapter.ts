import { raDecToAltAzAtTime } from '@/lib/astronomy/coordinates/transforms';
import type { CalculationMeta } from '@/lib/astronomy/engine';
import { parseMinorIdentifier } from '@/lib/astronomy/object-resolver/parser/minor-parser';
import { smartFetch } from '@/lib/services/http-fetch';
import { searchOnlineByName } from '@/lib/services/online-search-service';

export interface SmallBodyEphemerisObserver {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface SmallBodyEphemerisRequest {
  query: string;
  observer: SmallBodyEphemerisObserver;
  startDate: Date;
  stepHours: number;
  steps: number;
}

export interface SmallBodyEphemerisPoint {
  date: Date;
  ra: number;
  dec: number;
  altitude: number;
  azimuth: number;
  magnitude?: number;
  distanceAu?: number;
  elongation?: number;
}

export interface SmallBodyEphemerisMeta {
  source: 'horizons' | 'sbdb' | 'mpc';
  degraded: boolean;
  warnings: string[];
  resolvedName: string;
}

export interface SmallBodyEphemerisResult {
  points: SmallBodyEphemerisPoint[];
  meta: SmallBodyEphemerisMeta;
}

export function isResolvableSmallBodyQuery(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }
  if (parseMinorIdentifier(trimmed)) {
    return true;
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex <= 0) {
    return false;
  }

  return parseMinorIdentifier(trimmed.slice(0, slashIndex)) !== null;
}

export function toSmallBodyCalculationMeta(
  meta: SmallBodyEphemerisMeta,
  computedAt: Date,
): CalculationMeta {
  return {
    backend: 'fallback',
    model: `small-body:${meta.source}`,
    source: 'fallback',
    degraded: meta.degraded,
    computedAt: computedAt.toISOString(),
    cache: 'miss',
    warnings: meta.warnings,
  };
}

function buildHorizonsCommand(query: string, category: 'asteroid' | 'comet'): string {
  const parsed = parseMinorIdentifier(query);
  const designation = parsed?.normalized ?? query.trim();
  const suffix = category === 'comet' ? ';CAP;NOFRAG' : ';CAP';
  return `DES=${designation}${suffix}`;
}

function buildHorizonsUrl(request: SmallBodyEphemerisRequest, command: string): string {
  const stopDate = new Date(request.startDate);
  stopDate.setHours(stopDate.getHours() + (request.stepHours * Math.max(request.steps - 1, 0)));

  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'YES'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${request.observer.longitude},${request.observer.latitude},${(request.observer.elevation ?? 0) / 1000}'`,
    START_TIME: `'${request.startDate.toISOString().slice(0, 10)}'`,
    STOP_TIME: `'${stopDate.toISOString().slice(0, 10)}'`,
    STEP_SIZE: `'${request.stepHours} h'`,
    QUANTITIES: "'1,9,20,23,24,29'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
    TIME_TYPE: "'UT'",
  });

  return `https://ssd.jpl.nasa.gov/api/horizons.api?${params.toString()}`;
}

function parseHorizonsDate(value: string): Date | null {
  const parsed = Date.parse(`${value.trim()} UTC`);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return new Date(parsed);
}

function parseHorizonsEphemerisPoints(rawResult: string, observer: SmallBodyEphemerisObserver): SmallBodyEphemerisPoint[] {
  const startMarker = rawResult.indexOf('$$SOE');
  const endMarker = rawResult.indexOf('$$EOE');
  if (startMarker === -1 || endMarker === -1 || endMarker <= startMarker) {
    return [];
  }

  const lines = rawResult
    .slice(startMarker + 5, endMarker)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const points: SmallBodyEphemerisPoint[] = [];
  for (const line of lines) {
    const columns = line.split(',').map((part) => part.trim());
    if (columns.length < 10) {
      continue;
    }

    const date = parseHorizonsDate(columns[0]);
    const ra = Number.parseFloat(columns[3] ?? '');
    const dec = Number.parseFloat(columns[4] ?? '');
    if (!date || !Number.isFinite(ra) || !Number.isFinite(dec)) {
      continue;
    }

    const horizontal = raDecToAltAzAtTime(ra, dec, observer.latitude, observer.longitude, date);
    const magnitude = Number.parseFloat(columns[5] ?? '');
    const distanceAu = Number.parseFloat(columns[7] ?? '');
    const elongation = Number.parseFloat(columns[9] ?? '');

    points.push({
      date,
      ra,
      dec,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
      magnitude: Number.isFinite(magnitude) ? magnitude : undefined,
      distanceAu: Number.isFinite(distanceAu) ? distanceAu : undefined,
      elongation: Number.isFinite(elongation) ? elongation : undefined,
    });
  }

  return points;
}

function buildFallbackPoints(request: SmallBodyEphemerisRequest, ra: number, dec: number): SmallBodyEphemerisPoint[] {
  return Array.from({ length: request.steps }, (_, index) => {
    const date = new Date(request.startDate);
    date.setHours(date.getHours() + (request.stepHours * index));
    const horizontal = raDecToAltAzAtTime(ra, dec, request.observer.latitude, request.observer.longitude, date);
    return {
      date,
      ra,
      dec,
      altitude: horizontal.altitude,
      azimuth: horizontal.azimuth,
    };
  });
}

export async function fetchSmallBodyEphemeris(request: SmallBodyEphemerisRequest): Promise<SmallBodyEphemerisResult> {
  const searchResponse = await searchOnlineByName(request.query, {
    sources: ['sbdb', 'mpc'],
    limit: 1,
    timeout: 15000,
  });
  const resolved = searchResponse.results[0];

  if (!resolved || (resolved.category !== 'comet' && resolved.category !== 'asteroid')) {
    throw new Error(`Unable to resolve minor object: ${request.query}`);
  }

  const command = buildHorizonsCommand(
    resolved.identifiers[0] ?? resolved.canonicalId ?? request.query,
    resolved.category,
  );

  try {
    const response = await smartFetch(buildHorizonsUrl(request, command), {
      timeout: 15000,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Horizons request failed with status ${response.status}`);
    }

    const payload = await response.json<{ result?: string }>();
    const rawResult = payload.result ?? '';
    const points = parseHorizonsEphemerisPoints(rawResult, request.observer);
    if (points.length === 0) {
      throw new Error('Horizons response did not contain ephemeris rows');
    }

    return {
      points,
      meta: {
        source: 'horizons',
        degraded: false,
        warnings: [],
        resolvedName: resolved.name,
      },
    };
  } catch {
    return {
      points: buildFallbackPoints(request, resolved.ra, resolved.dec),
      meta: {
        source: resolved.source === 'mpc' ? 'mpc' : 'sbdb',
        degraded: true,
        warnings: ['small-body-horizons-unavailable'],
        resolvedName: resolved.name,
      },
    };
  }
}
