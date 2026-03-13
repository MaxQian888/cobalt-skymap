/**
 * @jest-environment node
 */

import { dateToJulianDate } from '../time/julian';
import { EOP_BASELINE_VERSION } from '../data/eop-baseline';
import { buildTimeScaleContext, getEopSnapshot, utcJdToTtJd, utcJdToUt1Jd } from '../time-scales';
import { transformCoordinate } from '../pipeline';

const flushAsyncWork = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const toMjd = (date: Date): number => dateToJulianDate(date) - 2400000.5;

async function loadFreshTimeScaleModule() {
  jest.resetModules();
  return import('../time-scales');
}

describe('time-scales', () => {
  it('builds UTC/UT1/TT context with stable ordering', () => {
    const context = buildTimeScaleContext(new Date('2026-01-01T00:00:00Z'));
    expect(context.jdUt1).toBeCloseTo(utcJdToUt1Jd(context.jdUtc, context.eop.dut1), 10);
    expect(context.jdTt).toBeCloseTo(utcJdToTtJd(context.jdUtc), 10);
    expect(context.jdTt).toBeGreaterThan(context.jdUtc);
  });

  it('returns eop freshness marker', () => {
    const status = getEopSnapshot(new Date('2026-01-15T00:00:00Z'));
    expect(['fresh', 'stale', 'fallback']).toContain(status.freshness);
    expect(typeof status.dut1).toBe('number');
  });

  it('downgrades far-future requests to fallback freshness', () => {
    const status = getEopSnapshot(new Date('2035-01-01T00:00:00Z'));
    expect(status.freshness).toBe('fallback');
    expect(status.source).toBe('fallback');
  });

  it('normalizes invalid julian-date inputs back to a finite context', () => {
    const context = buildTimeScaleContext(new Date('2026-01-01T00:00:00Z'), Number.NaN);
    expect(Number.isFinite(context.jdUtc)).toBe(true);
    expect(Number.isFinite(context.jdUt1)).toBe(true);
    expect(Number.isFinite(context.jdTt)).toBe(true);
  });
});

describe('coordinate pipeline', () => {
  it('transforms equatorial coordinates with metadata', () => {
    const result = transformCoordinate(
      { raDeg: 10.684, decDeg: 41.269 },
      { latitude: 31.2, longitude: 121.5, fromFrame: 'ICRF', toFrame: 'OBSERVED' }
    );

    expect(result.raDeg).toBeGreaterThanOrEqual(0);
    expect(result.raDeg).toBeLessThan(360);
    expect(result.decDeg).toBeGreaterThanOrEqual(-90);
    expect(result.decDeg).toBeLessThanOrEqual(90);
    expect(result.metadata.frame).toBe('OBSERVED');
    expect(result.metadata.timeScale).toBe('UTC');
  });
});

describe('time-scale refresh flows', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    Reflect.deleteProperty(globalThis, 'fetch');
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('refreshes remote EOP data and persists it to localStorage', async () => {
    const localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          version: 'remote-test',
          updatedAt: '2026-03-05T00:00:00.000Z',
          samples: [{ mjd: toMjd(new Date('2026-03-05T00:00:00Z')), dut1: 0.1234 }],
          source: 'baseline',
        }),
      });

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    const { getEopSnapshot: getSnapshot, refreshEopData } = await loadFreshTimeScaleModule();

    await expect(refreshEopData(['https://bad.example/eop.json', 'https://good.example/eop.json'])).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);

    const snapshot = getSnapshot(new Date('2026-03-05T00:00:00Z'));
    expect(snapshot.version).toBe('remote-test');
    expect(snapshot.updatedAt).toBe('2026-03-05T00:00:00.000Z');
    expect(snapshot.source).toBe('remote');
  });

  it('falls back to baseline when cached payload JSON is malformed', async () => {
    const localStorage = {
      getItem: jest.fn(() => '{not-json'),
      setItem: jest.fn(),
    };

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    const { getEopSnapshot: getSnapshot } = await loadFreshTimeScaleModule();

    const snapshot = getSnapshot(new Date('2026-03-05T00:00:00Z'));
    expect(localStorage.getItem).toHaveBeenCalled();
    expect(snapshot.version).toBe(EOP_BASELINE_VERSION);
  });

  it('ignores cached payloads that are missing required metadata fields', async () => {
    const localStorage = {
      getItem: jest.fn(() => JSON.stringify({
        samples: [{ mjd: toMjd(new Date('2026-03-05T00:00:00Z')), dut1: 0.1 }],
      })),
      setItem: jest.fn(),
    };

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });

    const { getEopSnapshot: getSnapshot } = await loadFreshTimeScaleModule();

    const snapshot = getSnapshot(new Date('2026-03-05T00:00:00Z'));
    expect(snapshot.version).toBe(EOP_BASELINE_VERSION);
  });

  it('returns false when every refresh source fails or is unusable', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({
          version: 'broken',
          updatedAt: '2026-03-05T00:00:00.000Z',
          samples: [],
        }),
      });

    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    const { refreshEopData } = await loadFreshTimeScaleModule();

    await expect(refreshEopData(['https://offline.example/eop.json', 'https://invalid.example/eop.json'])).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps refresh successful even when local persistence throws', async () => {
    const localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error('quota exceeded');
      }),
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        version: 'persist-test',
        updatedAt: '2026-03-07T00:00:00.000Z',
        samples: [{ mjd: toMjd(new Date('2026-03-07T00:00:00Z')), dut1: 0.2 }],
      }),
    });

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    const { getEopSnapshot: getSnapshot, refreshEopData } = await loadFreshTimeScaleModule();

    await expect(refreshEopData(['https://persist.example/eop.json'])).resolves.toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(getSnapshot(new Date('2026-03-07T00:00:00Z')).version).toBe('persist-test');
  });

  it('skips fresh/offline background refreshes and triggers stale online refreshes', async () => {
    const freshDate = new Date('2026-03-06T00:00:00Z');
    const staleDate = new Date('2035-01-01T00:00:00Z');
    const cachedPayload = JSON.stringify({
      version: 'cached',
      updatedAt: '2026-03-06T00:00:00.000Z',
      samples: [{ mjd: toMjd(freshDate), dut1: 0.05 }],
      source: 'remote',
    });
    const localStorage = {
      getItem: jest.fn(() => cachedPayload),
      setItem: jest.fn(),
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => '',
    });

    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });

    const { triggerBackgroundEopRefresh } = await loadFreshTimeScaleModule();

    triggerBackgroundEopRefresh(freshDate);
    await flushAsyncWork();
    expect(fetchMock).not.toHaveBeenCalled();

    triggerBackgroundEopRefresh(staleDate);
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
      writable: true,
    });

    triggerBackgroundEopRefresh(staleDate);
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
