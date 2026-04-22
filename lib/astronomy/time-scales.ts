import { dateToJulianDate, julianDateToDate, utcToMJD } from './time/julian';
import type { EopFreshness } from '@/lib/core/types/astronomy';
import { createLogger } from '@/lib/logger';
import {
  EOP_BASELINE_DATA,
  EOP_BASELINE_UPDATED_AT,
  EOP_BASELINE_VERSION,
  type EopBaselineEntry,
} from './data/eop-baseline';

const logger = createLogger('astronomy-time-scales');

const EOP_CACHE_KEY = 'starmap-eop-cache-v1';
const EOP_FRESHNESS_DAYS = 30;
const EOP_STALE_DAYS = 90;
const DEFAULT_DUT1_SECONDS = 0;
const DEFAULT_TAI_MINUS_UTC = 37;
const TT_MINUS_TAI_SECONDS = 32.184;
const EOP_BACKGROUND_REFRESH_COOLDOWN_MS = 60_000;

export interface EopSnapshot {
  dut1: number;
  xp?: number;
  yp?: number;
  freshness: EopFreshness;
  source: 'baseline' | 'remote' | 'fallback';
  sampleMjd?: number;
  version: string;
  updatedAt: string;
}

interface EopCachePayload {
  version: string;
  updatedAt: string;
  samples: EopBaselineEntry[];
  source: 'baseline' | 'remote';
}

export interface TimeScaleContext {
  jdUtc: number;
  jdUt1: number;
  jdTt: number;
  eop: EopSnapshot;
}

let runtimeEopPayload: EopCachePayload | null = null;
let eopLoadAttempted = false;
let backgroundRefreshPromise: Promise<boolean> | null = null;
let lastBackgroundRefreshStartedAt = 0;

function normalizeJd(jd: number): number {
  if (!Number.isFinite(jd)) return dateToJulianDate(new Date());
  return jd;
}

function createBaselinePayload(): EopCachePayload {
  return {
    version: EOP_BASELINE_VERSION,
    updatedAt: EOP_BASELINE_UPDATED_AT,
    samples: EOP_BASELINE_DATA,
    source: 'baseline',
  };
}

function parseCachedPayload(raw: string | null): EopCachePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EopCachePayload>;
    if (!parsed || !Array.isArray(parsed.samples) || !parsed.updatedAt || !parsed.version) {
      return null;
    }
    const samples = parsed.samples
      .filter((item): item is EopBaselineEntry => (
        !!item && Number.isFinite(item.mjd) && Number.isFinite(item.dut1)
      ))
      .map((item) => ({
        mjd: item.mjd,
        dut1: item.dut1,
        xp: Number.isFinite(item.xp) ? item.xp : undefined,
        yp: Number.isFinite(item.yp) ? item.yp : undefined,
      }));
    if (samples.length === 0) return null;

    return {
      version: parsed.version,
      updatedAt: parsed.updatedAt,
      samples,
      source: parsed.source === 'remote' ? 'remote' : 'baseline',
    };
  } catch {
    return null;
  }
}

function loadEopPayload(): EopCachePayload {
  if (runtimeEopPayload) return runtimeEopPayload;
  if (!eopLoadAttempted) {
    eopLoadAttempted = true;
    if (typeof window !== 'undefined') {
      const cached = parseCachedPayload(window.localStorage.getItem(EOP_CACHE_KEY));
      if (cached) {
        runtimeEopPayload = cached;
        return runtimeEopPayload;
      }
    }
  }

  runtimeEopPayload = createBaselinePayload();
  return runtimeEopPayload;
}

function saveEopPayload(payload: EopCachePayload): void {
  runtimeEopPayload = payload;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(EOP_CACHE_KEY, JSON.stringify(payload));
    } catch {
      logger.warn('Unable to persist EOP cache');
    }
  }
}

function classifyFreshness(sampleMjd: number, date: Date): EopFreshness {
  const targetMjd = utcToMJD(date);
  const deltaDays = Math.abs(targetMjd - sampleMjd);
  if (deltaDays <= EOP_FRESHNESS_DAYS) return 'fresh';
  if (deltaDays <= EOP_STALE_DAYS) return 'stale';
  return 'fallback';
}

function selectClosestSample(payload: EopCachePayload, date: Date): EopBaselineEntry | null {
  if (payload.samples.length === 0) return null;
  const targetMjd = utcToMJD(date);
  let closest = payload.samples[0];
  let minDelta = Math.abs(payload.samples[0].mjd - targetMjd);
  for (let index = 1; index < payload.samples.length; index += 1) {
    const candidate = payload.samples[index];
    const delta = Math.abs(candidate.mjd - targetMjd);
    if (delta < minDelta) {
      minDelta = delta;
      closest = candidate;
    }
  }
  return closest;
}

export function getEopSnapshot(date: Date = new Date()): EopSnapshot {
  const payload = loadEopPayload();
  const sample = selectClosestSample(payload, date);
  if (!sample) {
    return {
      dut1: DEFAULT_DUT1_SECONDS,
      freshness: 'fallback',
      source: 'fallback',
      version: payload.version,
      updatedAt: payload.updatedAt,
    };
  }

  const freshness = classifyFreshness(sample.mjd, date);
  return {
    dut1: sample.dut1,
    xp: sample.xp,
    yp: sample.yp,
    freshness,
    source: freshness === 'fallback' ? 'fallback' : payload.source,
    sampleMjd: sample.mjd,
    version: payload.version,
    updatedAt: payload.updatedAt,
  };
}

export function utcJdToUt1Jd(jdUtc: number, dut1Seconds: number = DEFAULT_DUT1_SECONDS): number {
  return normalizeJd(jdUtc) + dut1Seconds / 86400;
}

export function utcJdToTtJd(jdUtc: number, taiMinusUtcSeconds: number = DEFAULT_TAI_MINUS_UTC): number {
  const ttMinusUtcSeconds = taiMinusUtcSeconds + TT_MINUS_TAI_SECONDS;
  return normalizeJd(jdUtc) + ttMinusUtcSeconds / 86400;
}

export function buildTimeScaleContext(date: Date = new Date(), jdUtc?: number): TimeScaleContext {
  const normalizedJdUtc = normalizeJd(jdUtc ?? dateToJulianDate(date));
  const snapshot = getEopSnapshot(date);

  return {
    jdUtc: normalizedJdUtc,
    jdUt1: utcJdToUt1Jd(normalizedJdUtc, snapshot.dut1),
    jdTt: utcJdToTtJd(normalizedJdUtc),
    eop: snapshot,
  };
}

export async function refreshEopData(sourceUrls: string[] = []): Promise<boolean> {
  const urls = sourceUrls.length > 0
    ? sourceUrls
    : [
      'https://raw.githubusercontent.com/maxqian/astro-data/main/eop/latest.json',
      'https://raw.githubusercontent.com/maxqian/astro-data/main/eop/fallback.json',
    ];

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) continue;
      const raw = await response.text();
      const parsed = parseCachedPayload(raw);
      if (!parsed) continue;
      saveEopPayload({ ...parsed, source: 'remote' });
      return true;
    } catch (error) {
      logger.debug('Failed to refresh EOP source', { url, error });
    }
  }

  return false;
}

export function triggerBackgroundEopRefresh(date: Date = new Date()): void {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const status = getEopSnapshot(date);
  if (status.freshness === 'fresh') return;
  if (backgroundRefreshPromise) return;

  const now = Date.now();
  if (now - lastBackgroundRefreshStartedAt < EOP_BACKGROUND_REFRESH_COOLDOWN_MS) {
    return;
  }

  lastBackgroundRefreshStartedAt = now;

  backgroundRefreshPromise = refreshEopData()
    .then((ok) => {
      if (!ok) {
        logger.debug('EOP background refresh skipped - no source available');
      }
      return ok;
    })
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

export function jdToIsoTimestamp(jd: number): string {
  return julianDateToDate(jd).toISOString();
}
