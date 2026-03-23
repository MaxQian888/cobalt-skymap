/**
 * @jest-environment jsdom
 */

const mockSmartFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

describe('service cache policy integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('uses the hips registry cache policy', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: 'https://alasky.cds.unistra.fr/DSS/DSSColor/',
        },
      ],
    });

    const { fetchRegistry, __resetRegistryCacheForTests } = await import('../hips/service');
    __resetRegistryCacheForTests();
    await fetchRegistry();

    expect(mockSmartFetch).toHaveBeenCalledWith(
      'https://aladin.cds.unistra.fr/hips/list',
      expect.objectContaining({
        cachePolicy: 'hips-registry',
      })
    );
  });

  it('uses the hips registry cache policy for the legacy survey selector service', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: 'https://alasky.cds.unistra.fr/DSS/DSSColor/',
        },
      ],
    });

    const { hipsService } = await import('../hips-service');
    hipsService.clearCache();
    await hipsService.fetchSurveys();

    expect(mockSmartFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://alasky.cds.unistra.fr/MocServer/query'),
      expect.objectContaining({
        cachePolicy: 'hips-registry',
      })
    );
  });

  it('uses the satellite TLE cache policy', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      text: async () => 'ISS (ZARYA)\n1 25544U 98067A\n2 25544 51.6 0.0 0.0 0.0 15.5',
    });

    const { fetchTLEFromSource, TLE_SOURCES } = await import('../satellite/data-sources');
    await fetchTLEFromSource(TLE_SOURCES[0]);

    expect(mockSmartFetch).toHaveBeenCalledWith(
      TLE_SOURCES[0].url,
      expect.objectContaining({
        cachePolicy: 'satellite-tle',
      })
    );
  });

  it('uses the satellite TLE cache policy for the tracker feed service', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          OBJECT_NAME: 'ISS (ZARYA)',
          NORAD_CAT_ID: 25544,
          MEAN_MOTION: 15.5,
          INCLINATION: 51.6,
          TLE_LINE1: '',
          TLE_LINE2: '',
        },
      ],
    });

    const { fetchSatellitesFromCelesTrak } = await import('../satellite/celestrak-service');
    await fetchSatellitesFromCelesTrak('stations');

    expect(mockSmartFetch).toHaveBeenCalledWith(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
      expect.objectContaining({
        cachePolicy: 'satellite-tle',
      })
    );
  });

  it('uses the APOD cache policy', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        date: '2026-02-20',
        title: 'Cosmic Clouds',
        explanation: 'A beautiful nebula.',
        url: 'https://apod.nasa.gov/apod/image/cosmic.jpg',
        media_type: 'image',
      }),
    });

    const { fetchApodItem } = await import('../daily-knowledge/source-apod');
    await fetchApodItem('2026-02-20', 'DEMO_KEY');

    expect(mockSmartFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.nasa.gov/planetary/apod'),
      expect.objectContaining({
        cachePolicy: 'daily-knowledge-apod',
      })
    );
  });

  it('uses the Wikimedia cache policy', async () => {
    mockSmartFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          pages: [
            {
              key: 'Andromeda_Galaxy',
              title: 'Andromeda Galaxy',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          html_url: 'https://en.wikipedia.org/wiki/Andromeda_Galaxy',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          html: '<p>Andromeda Galaxy</p>',
        }),
      });

    const { fetchWikimediaItem } = await import('../daily-knowledge/source-wikimedia');
    await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');

    expect(mockSmartFetch).toHaveBeenCalledWith(
      expect.stringContaining('/w/rest.php/v1/search/page'),
      expect.objectContaining({
        cachePolicy: 'daily-knowledge-wikimedia',
      })
    );
  });

  it('uses a persistent policy for lunar phases and an explicit opt-out for ISS position', async () => {
    mockSmartFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          phasedata: [
            { phase: 'New Moon', date: '2026-02-20', time: '00:00' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          iss_position: { latitude: '1.0', longitude: '2.0' },
        }),
      });

    const { fetchLunarPhases, fetchISSPosition } = await import('../astro-data-sources');
    await fetchLunarPhases(2026, 1);
    await fetchISSPosition();

    expect(mockSmartFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('aa.usno.navy.mil'),
      expect.objectContaining({ cachePolicy: 'astro-usno-phases' })
    );
    expect(mockSmartFetch).toHaveBeenNthCalledWith(
      2,
      'http://api.open-notify.org/iss-now.json',
      expect.objectContaining({ cachePolicy: 'astro-iss-position' })
    );
  });
});
