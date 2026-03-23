/**
 * @jest-environment jsdom
 */
import {
  resetAstroCalculatorOrchestratorForTests,
  runCalculatorEphemeris,
  runCalculatorRiseTransitSetBatch,
  summarizeCalculatorMeta,
} from '../orchestrator';

const mockComputeCoordinates = jest.fn();
const mockComputeEphemeris = jest.fn();
const mockComputeRiseTransitSet = jest.fn();
const mockComputeAlmanac = jest.fn();
const mockSearchPhenomena = jest.fn();

jest.mock('@/lib/astronomy/engine', () => ({
  computeCoordinates: (...args: unknown[]) => mockComputeCoordinates(...args),
  computeEphemeris: (...args: unknown[]) => mockComputeEphemeris(...args),
  computeRiseTransitSet: (...args: unknown[]) => mockComputeRiseTransitSet(...args),
  computeAlmanac: (...args: unknown[]) => mockComputeAlmanac(...args),
  searchPhenomena: (...args: unknown[]) => mockSearchPhenomena(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

function createMeta(cache: 'hit' | 'miss' = 'miss') {
  return {
    backend: 'fallback' as const,
    model: 'test-model',
    source: 'fallback' as const,
    degraded: true,
    computedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    cache,
    warnings: [],
  };
}

describe('astro calculator orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAstroCalculatorOrchestratorForTests();
  });

  it('deduplicates concurrent ephemeris requests with identical payloads', async () => {
    mockComputeEphemeris.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ body: 'Sun', points: [], meta: createMeta('miss') }), 20))
    );

    const request = {
      body: 'Sun' as const,
      observer: { latitude: 39.9, longitude: 116.4 },
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      stepHours: 1,
      steps: 12,
    };

    const [first, second] = await Promise.all([
      runCalculatorEphemeris(request),
      runCalculatorEphemeris(request),
    ]);

    expect(mockComputeEphemeris).toHaveBeenCalledTimes(1);
    expect(first.key).toBe(second.key);
    expect(first.response.body).toBe('Sun');
  });

  it('limits batched rise/transit/set execution concurrency', async () => {
    let active = 0;
    let maxActive = 0;

    mockComputeRiseTransitSet.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return {
        riseTime: null,
        transitTime: null,
        setTime: null,
        transitAltitude: 0,
        currentAltitude: 0,
        currentAzimuth: 0,
        isCircumpolar: false,
        neverRises: false,
        darkImagingStart: null,
        darkImagingEnd: null,
        darkImagingHours: 0,
        meta: createMeta('hit'),
      };
    });

    const requests = Array.from({ length: 6 }, (_, index) => ({
      body: 'Moon' as const,
      observer: { latitude: 39.9, longitude: 116.4 },
      date: new Date(`2026-01-01T00:0${index}:00.000Z`),
    }));

    const results = await runCalculatorRiseTransitSetBatch(requests, { concurrency: 2 });

    expect(results).toHaveLength(6);
    expect(mockComputeRiseTransitSet).toHaveBeenCalledTimes(6);
    expect(maxActive).toBeLessThanOrEqual(2);

    const summary = summarizeCalculatorMeta(results.map((item) => item.meta));
    expect(summary.total).toBe(6);
    expect(summary.cacheHits).toBe(6);
  });
});
