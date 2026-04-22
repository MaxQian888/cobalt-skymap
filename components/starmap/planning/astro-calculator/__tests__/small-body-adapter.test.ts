/**
 * @jest-environment node
 */
import { fetchSmallBodyEphemeris } from '../small-body-adapter';

const mockSmartFetch = jest.fn();
const mockSearchOnlineByName = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

jest.mock('@/lib/services/online-search-service', () => ({
  searchOnlineByName: (...args: unknown[]) => mockSearchOnlineByName(...args),
}));

describe('small-body-adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchOnlineByName.mockResolvedValue({
      results: [{
        id: 'halley',
        name: '1P/Halley',
        canonicalId: '1P/Halley',
        identifiers: ['1P/Halley', '1P'],
        confidence: 0.99,
        type: 'Comet',
        category: 'comet',
        ra: 124.7,
        dec: 2.32,
        source: 'sbdb',
      }],
      sources: ['sbdb'],
      totalCount: 1,
      searchTimeMs: 3,
    });
  });

  it('returns normalized Horizons ephemeris points for a resolved small body', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: `header
$$SOE
 2025-Jan-01 00:00,*, ,   124.70441,    2.32426,   25.540, 29.028,  34.2760819727549,-12.5034507,  149.3472,/L,    0.8215,   Hya,
 2025-Jan-02 00:00,*, ,   124.67704,    2.32728,   25.539, 29.027,  34.2687917787653,-12.0299265,  150.2026,/L,    0.8008,   Hya,
$$EOE
footer`,
      }),
    });

    const result = await fetchSmallBodyEphemeris({
      query: '1P/Halley',
      observer: { latitude: 39.9042, longitude: 116.4074, elevation: 50 },
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      stepHours: 24,
      steps: 2,
    });

    expect(result.meta.source).toBe('horizons');
    expect(result.meta.degraded).toBe(false);
    expect(result.points).toHaveLength(2);
    expect(result.points[0].ra).toBeCloseTo(124.70441, 5);
    expect(result.points[0].dec).toBeCloseTo(2.32426, 5);
    expect(result.points[0].magnitude).toBeCloseTo(25.54, 2);
    expect(result.points[0].distanceAu).toBeCloseTo(34.2760819727549, 5);
  });

  it('falls back to resolved static coordinates when Horizons is unavailable', async () => {
    mockSmartFetch.mockRejectedValue(new Error('network down'));

    const result = await fetchSmallBodyEphemeris({
      query: '1P/Halley',
      observer: { latitude: 39.9042, longitude: 116.4074, elevation: 50 },
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      stepHours: 24,
      steps: 3,
    });

    expect(result.meta.source).toBe('sbdb');
    expect(result.meta.degraded).toBe(true);
    expect(result.meta.warnings).toContain('small-body-horizons-unavailable');
    expect(result.points).toHaveLength(3);
    expect(result.points.every((point) => point.ra === 124.7)).toBe(true);
    expect(result.points.every((point) => point.dec === 2.32)).toBe(true);
  });
});
