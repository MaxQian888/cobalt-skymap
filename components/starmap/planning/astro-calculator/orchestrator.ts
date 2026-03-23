import {
  computeAlmanac,
  computeCoordinates,
  computeEphemeris,
  computeRiseTransitSet,
  searchPhenomena,
  serializeCacheKey,
  type AlmanacRequest,
  type AlmanacResponse,
  type CalculationMeta,
  type CoordinateComputationInput,
  type CoordinateComputationResult,
  type EphemerisRequest,
  type EphemerisResponse,
  type EngineBackend,
  type PhenomenaRequest,
  type PhenomenaResponse,
  type RiseTransitSetRequest,
  type RiseTransitSetResponse,
} from '@/lib/astronomy/engine';
import { RequestDeduplicator } from '@/lib/services/lru-cache';

type CalculatorOperation = 'coordinates' | 'ephemeris' | 'riseTransitSet' | 'phenomena' | 'almanac';

const operationDeduplicator = new RequestDeduplicator<string, unknown>();

export interface CalculatorOperationResult<T extends { meta: CalculationMeta }> {
  key: string;
  response: T;
  meta: CalculationMeta;
}

export interface CalculatorMetaSummary {
  total: number;
  sourceCounts: Record<EngineBackend, number>;
  cacheHits: number;
  cacheMisses: number;
  degradedCount: number;
  warningsCount: number;
  latestComputedAt: string | null;
}

function buildOperationKey(operation: CalculatorOperation, payload: unknown): string {
  return `astro-calculator:${operation}:${serializeCacheKey(payload)}`;
}

function normalizeConcurrency(concurrency?: number): number {
  if (!Number.isFinite(concurrency)) return 3;
  return Math.min(8, Math.max(1, Math.floor(concurrency as number)));
}

async function dedupeOperation<T extends { meta: CalculationMeta }>(
  operation: CalculatorOperation,
  payload: unknown,
  factory: () => Promise<T>
): Promise<CalculatorOperationResult<T>> {
  const key = buildOperationKey(operation, payload);
  const response = await operationDeduplicator.dedupe(key, factory) as T;
  return {
    key,
    response,
    meta: response.meta,
  };
}

async function mapInBatches<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      result[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(normalizeConcurrency(concurrency), Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return result;
}

export function summarizeCalculatorMeta(metas: CalculationMeta[]): CalculatorMetaSummary {
  const summary: CalculatorMetaSummary = {
    total: metas.length,
    sourceCounts: {
      tauri: 0,
      fallback: 0,
    },
    cacheHits: 0,
    cacheMisses: 0,
    degradedCount: 0,
    warningsCount: 0,
    latestComputedAt: null,
  };

  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const meta of metas) {
    summary.sourceCounts[meta.source] += 1;
    if (meta.cache === 'hit') {
      summary.cacheHits += 1;
    } else {
      summary.cacheMisses += 1;
    }
    if (meta.degraded) {
      summary.degradedCount += 1;
    }
    summary.warningsCount += meta.warnings?.length ?? 0;

    const computedAt = Date.parse(meta.computedAt);
    if (Number.isFinite(computedAt) && computedAt > latestTimestamp) {
      latestTimestamp = computedAt;
      summary.latestComputedAt = meta.computedAt;
    }
  }

  return summary;
}

export async function runCalculatorCoordinates(
  request: CoordinateComputationInput,
): Promise<CalculatorOperationResult<CoordinateComputationResult>> {
  return dedupeOperation('coordinates', request, () => computeCoordinates(request));
}

export async function runCalculatorEphemeris(
  request: EphemerisRequest,
): Promise<CalculatorOperationResult<EphemerisResponse>> {
  return dedupeOperation('ephemeris', request, () => computeEphemeris(request));
}

export async function runCalculatorRiseTransitSet(
  request: RiseTransitSetRequest,
): Promise<CalculatorOperationResult<RiseTransitSetResponse>> {
  return dedupeOperation('riseTransitSet', request, () => computeRiseTransitSet(request));
}

export async function runCalculatorPhenomena(
  request: PhenomenaRequest,
): Promise<CalculatorOperationResult<PhenomenaResponse>> {
  return dedupeOperation('phenomena', request, () => searchPhenomena(request));
}

export async function runCalculatorAlmanac(
  request: AlmanacRequest,
): Promise<CalculatorOperationResult<AlmanacResponse>> {
  return dedupeOperation('almanac', request, () => computeAlmanac(request));
}

export async function runCalculatorEphemerisBatch(
  requests: EphemerisRequest[],
  options?: { concurrency?: number },
): Promise<Array<CalculatorOperationResult<EphemerisResponse>>> {
  if (requests.length === 0) return [];
  return mapInBatches(requests, options?.concurrency ?? 3, (request) => runCalculatorEphemeris(request));
}

export async function runCalculatorRiseTransitSetBatch(
  requests: RiseTransitSetRequest[],
  options?: { concurrency?: number },
): Promise<Array<CalculatorOperationResult<RiseTransitSetResponse>>> {
  if (requests.length === 0) return [];
  return mapInBatches(requests, options?.concurrency ?? 3, (request) => runCalculatorRiseTransitSet(request));
}

export function resetAstroCalculatorOrchestratorForTests(): void {
  operationDeduplicator.clear();
}
