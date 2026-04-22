import { isTauri } from '@/lib/storage/platform';
import { astronomyEngineCache } from './cache';
import { fallbackAstronomyBackend } from './backend-fallback';
import { tauriAstronomyBackend } from './backend-tauri';
import { withCacheState } from './meta';
import {
  AstronomyEngineValidationError,
  buildNormalizedContext,
  normalizeAlmanacRequest,
  normalizeCoordinateComputationInput,
  normalizeEphemerisRequest,
  normalizePhenomenaRequest,
  normalizeRiseTransitSetRequest,
} from './normalization';
import type {
  AlmanacRequest,
  AlmanacResponse,
  AstronomyEngineBackend,
  CalculationCacheState,
  CalculationMeta,
  CoordinateComputationInput,
  CoordinateComputationResult,
  EngineBackend,
  EphemerisRequest,
  EphemerisResponse,
  PhenomenaRequest,
  PhenomenaResponse,
  RiseTransitSetRequest,
  RiseTransitSetResponse,
} from './types';

const CACHE_TTL = {
  coordinates: 15_000,
  ephemeris: 30_000,
  riseTransitSet: 30_000,
  phenomena: 60_000,
  almanac: 60_000,
} as const;

type EngineOperation = 'coordinates' | 'ephemeris' | 'riseTransitSet' | 'phenomena' | 'almanac';

const OPERATION_PREFIX: Record<EngineOperation, string> = {
  coordinates: 'coordinates',
  ephemeris: 'ephemeris',
  riseTransitSet: 'rts',
  phenomena: 'phenomena',
  almanac: 'almanac',
} as const;

const lastContextByOperation = new Map<EngineOperation, string>();
let lastBackendAvailability: EngineBackend | null = null;

function truncateDates(obj: unknown): unknown {
  if (obj instanceof Date) {
    return new Date(Math.floor(obj.getTime() / 1000) * 1000).toISOString();
  }
  if (Array.isArray(obj)) return obj.map(truncateDates);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateDates(value);
    }
    return result;
  }
  return obj;
}

function getBackendAvailability(): EngineBackend {
  return isTauri() ? 'tauri' : 'fallback';
}

function ensureBackendInvalidation(): void {
  const current = getBackendAvailability();
  if (lastBackendAvailability && lastBackendAvailability !== current) {
    astronomyEngineCache.clear();
    lastContextByOperation.clear();
  }
  lastBackendAvailability = current;
}

function buildOperationCacheKey(operation: EngineOperation, payload: unknown): string {
  return `${OPERATION_PREFIX[operation]}:${serializeCacheKey(payload)}`;
}

function buildContextFingerprint(operation: EngineOperation, payload: { observerKey: string; timeWindowKey: string; requestKey: string }): string {
  return [
    operation,
    getBackendAvailability(),
    payload.observerKey,
    payload.timeWindowKey,
    payload.requestKey,
  ].join('|');
}

function invalidateOperationCache(operation: EngineOperation): void {
  astronomyEngineCache.deleteByPrefix(`${OPERATION_PREFIX[operation]}:`);
}

function invalidateOnContextShift(operation: EngineOperation, fingerprint: string): void {
  const previous = lastContextByOperation.get(operation);
  if (previous && previous !== fingerprint) {
    invalidateOperationCache(operation);
  }
  lastContextByOperation.set(operation, fingerprint);
}

type InvalidationReason = 'observer_change' | 'time_window_change' | 'backend_source_change' | 'planner_refresh' | 'manual';

export function invalidateAstronomyCache(
  reason: InvalidationReason = 'manual',
  operation?: EngineOperation
): void {
  if (operation) {
    invalidateOperationCache(operation);
    lastContextByOperation.delete(operation);
    return;
  }

  astronomyEngineCache.clear();
  lastContextByOperation.clear();

  if (reason === 'backend_source_change') {
    lastBackendAvailability = getBackendAvailability();
  }
}

export function serializeCacheKey(payload: unknown): string {
  return JSON.stringify(truncateDates(payload));
}

async function withCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<{ value: T; cache: CalculationCacheState }> {
  const cached = astronomyEngineCache.get<T>(key);
  if (cached !== undefined) {
    return { value: cached, cache: 'hit' };
  }

  const value = await factory();
  astronomyEngineCache.set(key, value, ttlMs);
  return { value, cache: 'miss' };
}

async function runWithFallback<T>(
  primaryAction: () => Promise<T>,
  fallbackAction: () => Promise<T>
): Promise<{ value: T; source: EngineBackend; degraded: boolean; warnings: string[] }> {
  if (!isTauri()) {
    return {
      value: await fallbackAction(),
      source: 'fallback',
      degraded: true,
      warnings: ['tauri_unavailable'],
    };
  }

  try {
    return {
      value: await primaryAction(),
      source: 'tauri',
      degraded: false,
      warnings: [],
    };
  } catch {
    return {
      value: await fallbackAction(),
      source: 'fallback',
      degraded: true,
      warnings: ['tauri_primary_failed'],
    };
  }
}

function mergeWarnings(existing?: string[], next?: string[]): string[] {
  const unique = new Set<string>([...(existing ?? []), ...(next ?? [])]);
  return [...unique];
}

function applyExecutionMeta<T extends { meta: CalculationMeta }>(
  value: T,
  execution: { source: EngineBackend; degraded: boolean; warnings: string[] }
): T {
  return {
    ...value,
    meta: {
      ...value.meta,
      source: execution.source,
      degraded: execution.degraded,
      computedAt: value.meta.computedAt || new Date().toISOString(),
      cache: 'miss',
      warnings: mergeWarnings(value.meta.warnings, execution.warnings),
    },
  };
}

function buildTimeWindowKey(date: Date): string {
  return date.toISOString().slice(0, 13);
}

function buildDateRangeKey(startDate: Date, endDate: Date): string {
  return `${startDate.toISOString().slice(0, 10)}..${endDate.toISOString().slice(0, 10)}`;
}

export function getAstronomyEngine(): AstronomyEngineBackend {
  if (isTauri()) {
    return tauriAstronomyBackend;
  }
  return fallbackAstronomyBackend;
}

export async function computeCoordinates(input: CoordinateComputationInput): Promise<CoordinateComputationResult> {
  ensureBackendInvalidation();
  const normalized = normalizeCoordinateComputationInput(input);
  const requestKey = serializeCacheKey({
    coordinate: normalized.coordinate,
    refraction: normalized.refraction ?? 'normal',
    contextKey: normalized.contextKey ?? null,
  });
  const context = buildNormalizedContext(normalized.observer, normalized.date, requestKey);
  const fingerprint = buildContextFingerprint('coordinates', {
    ...context,
    timeWindowKey: buildTimeWindowKey(normalized.date),
  });
  invalidateOnContextShift('coordinates', fingerprint);

  const cacheKey = buildOperationCacheKey('coordinates', {
    coordinate: normalized.coordinate,
    observer: normalized.observer,
    date: normalized.date,
    refraction: normalized.refraction ?? 'normal',
  });

  const { value, cache } = await withCache(cacheKey, CACHE_TTL.coordinates, async () => {
    const execution = await runWithFallback(
      () => tauriAstronomyBackend.computeCoordinates(normalized),
      () => fallbackAstronomyBackend.computeCoordinates(normalized),
    );
    return applyExecutionMeta(execution.value, execution);
  });

  return withCacheState(value, cache);
}

export async function computeEphemeris(request: EphemerisRequest): Promise<EphemerisResponse> {
  ensureBackendInvalidation();
  const normalized = normalizeEphemerisRequest(request);
  const requestKey = serializeCacheKey({
    body: normalized.body,
    stepHours: normalized.stepHours,
    steps: normalized.steps,
    refraction: normalized.refraction ?? 'normal',
    customCoordinate: normalized.customCoordinate,
    contextKey: normalized.contextKey ?? null,
  });
  const context = buildNormalizedContext(normalized.observer, normalized.startDate, requestKey);
  const fingerprint = buildContextFingerprint('ephemeris', {
    ...context,
    timeWindowKey: buildTimeWindowKey(normalized.startDate),
  });
  invalidateOnContextShift('ephemeris', fingerprint);

  const cacheKey = buildOperationCacheKey('ephemeris', normalized);
  const { value, cache } = await withCache(cacheKey, CACHE_TTL.ephemeris, async () => {
    const execution = await runWithFallback(
      () => tauriAstronomyBackend.computeEphemeris(normalized),
      () => fallbackAstronomyBackend.computeEphemeris(normalized),
    );
    return applyExecutionMeta(execution.value, execution);
  });
  return withCacheState(value, cache);
}

export async function computeRiseTransitSet(request: RiseTransitSetRequest): Promise<RiseTransitSetResponse> {
  ensureBackendInvalidation();
  const normalized = normalizeRiseTransitSetRequest(request);
  const requestKey = serializeCacheKey({
    body: normalized.body,
    minAltitude: normalized.minAltitude ?? 0,
    customCoordinate: normalized.customCoordinate,
    contextKey: normalized.contextKey ?? null,
  });
  const context = buildNormalizedContext(normalized.observer, normalized.date, requestKey);
  const fingerprint = buildContextFingerprint('riseTransitSet', {
    ...context,
    timeWindowKey: buildTimeWindowKey(normalized.date),
  });
  invalidateOnContextShift('riseTransitSet', fingerprint);

  const cacheKey = buildOperationCacheKey('riseTransitSet', normalized);
  const { value, cache } = await withCache(cacheKey, CACHE_TTL.riseTransitSet, async () => {
    const execution = await runWithFallback(
      () => tauriAstronomyBackend.computeRiseTransitSet(normalized),
      () => fallbackAstronomyBackend.computeRiseTransitSet(normalized),
    );
    return applyExecutionMeta(execution.value, execution);
  });
  return withCacheState(value, cache);
}

export async function searchPhenomena(request: PhenomenaRequest): Promise<PhenomenaResponse> {
  ensureBackendInvalidation();
  const normalized = normalizePhenomenaRequest(request);
  const requestKey = serializeCacheKey({
    includeMinor: normalized.includeMinor ?? false,
    contextKey: normalized.contextKey ?? null,
  });
  const context = buildNormalizedContext(
    normalized.observer,
    { startDate: normalized.startDate, endDate: normalized.endDate },
    requestKey,
  );
  const fingerprint = buildContextFingerprint('phenomena', {
    ...context,
    timeWindowKey: buildDateRangeKey(normalized.startDate, normalized.endDate),
  });
  invalidateOnContextShift('phenomena', fingerprint);

  const cacheKey = buildOperationCacheKey('phenomena', normalized);
  const { value, cache } = await withCache(cacheKey, CACHE_TTL.phenomena, async () => {
    const execution = await runWithFallback(
      () => tauriAstronomyBackend.searchPhenomena(normalized),
      () => fallbackAstronomyBackend.searchPhenomena(normalized),
    );
    return applyExecutionMeta(execution.value, execution);
  });
  return withCacheState(value, cache);
}

export async function computeAlmanac(request: AlmanacRequest): Promise<AlmanacResponse> {
  ensureBackendInvalidation();
  const normalized = normalizeAlmanacRequest(request);
  const requestKey = serializeCacheKey({
    refraction: normalized.refraction ?? 'normal',
    contextKey: normalized.contextKey ?? null,
  });
  const context = buildNormalizedContext(normalized.observer, normalized.date, requestKey);
  const fingerprint = buildContextFingerprint('almanac', {
    ...context,
    timeWindowKey: buildTimeWindowKey(normalized.date),
  });
  invalidateOnContextShift('almanac', fingerprint);

  const cacheKey = buildOperationCacheKey('almanac', normalized);
  const { value, cache } = await withCache(cacheKey, CACHE_TTL.almanac, async () => {
    const execution = await runWithFallback(
      () => tauriAstronomyBackend.computeAlmanac(normalized),
      () => fallbackAstronomyBackend.computeAlmanac(normalized),
    );
    return applyExecutionMeta(execution.value, execution);
  });
  return withCacheState(value, cache);
}

export { AstronomyEngineValidationError };
export type * from './types';
