import { fetchHorizonsEphemeris, resolveHorizonsCommand } from '../service';

const mockSmartFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const RESULT_TEXT = `Target body name: Mars (499)
 Date__(UT)__HR:MN, , , R.A._(ICRF), DEC_(ICRF), Azi, Elev, APmag,
$$SOE
 2026-Jun-12 00:00, , , 157.65, 11.22, 123.4, 45.6, -1.05,
$$EOE`;

describe('resolveHorizonsCommand', () => {
  it('maps major body names to Horizons COMMAND ids', () => {
    expect(resolveHorizonsCommand('Mars')).toBe('499');
    expect(resolveHorizonsCommand('mars')).toBe('499');
    expect(resolveHorizonsCommand('Sun')).toBe('10');
    expect(resolveHorizonsCommand('Moon')).toBe('301');
    expect(resolveHorizonsCommand('Jupiter')).toBe('599');
  });

  it('passes through unknown identifiers unchanged', () => {
    expect(resolveHorizonsCommand('499')).toBe('499');
    expect(resolveHorizonsCommand('DES=1P')).toBe('DES=1P');
  });
});

describe('fetchHorizonsEphemeris', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSmartFetch.mockReset();
  });

  it('requests the Horizons API and parses the result block', async () => {
    mockSmartFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: RESULT_TEXT }),
    });

    const eph = await fetchHorizonsEphemeris({
      body: 'Mars',
      start: '2026-06-12',
      stop: '2026-06-13',
      step: '1 h',
    });

    expect(eph.body).toBe('499');
    expect(eph.rows).toHaveLength(1);
    expect(eph.rows[0].raDeg).toBeCloseTo(157.65, 2);

    const [url, options] = mockSmartFetch.mock.calls[0];
    expect(url).toContain('ssd.jpl.nasa.gov/api/horizons.api');
    expect(url).toContain('format=json');
    expect(url).toContain('CSV_FORMAT');
    expect(url).toContain('ANG_FORMAT');
    expect(decodeURIComponent(url)).toContain("COMMAND='499'");
    expect(options).toEqual(
      expect.objectContaining({ cachePolicy: 'horizons-ephemeris' })
    );
  });

  it('throws on a non-ok response', async () => {
    mockSmartFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(
      fetchHorizonsEphemeris({ body: 'Mars', start: '2026-06-12', stop: '2026-06-13', step: '1 h' })
    ).rejects.toThrow();
  });
});
