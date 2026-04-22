/**
 * @jest-environment jsdom
 */

import {
  fetchAstroEventsInRange,
  fetchDailyAstroEvents,
  fetchMeteorShowers,
  fetchAllAstroEvents,
  fetchAllSatellites,
  fetchPlanetaryEvents,
  ASTRO_EVENT_SOURCES,
  SATELLITE_SOURCES,
} from '../astro-data-sources';
import { logManager } from '@/lib/logger';

// Mock fetch
const mockFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockFetch(...args),
}));

describe('astro-data-sources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    logManager.initialize({ enableConsole: false, enablePersistence: false });
  });

  describe('ASTRO_EVENT_SOURCES', () => {
    it('should have required source configurations', () => {
      expect(ASTRO_EVENT_SOURCES.length).toBeGreaterThan(0);
      
      ASTRO_EVENT_SOURCES.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.priority).toBe('number');
      });
    });

    it('should include local calculations source', () => {
      const localSource = ASTRO_EVENT_SOURCES.find(s => s.id === 'local');
      expect(localSource).toBeDefined();
      expect(localSource?.enabled).toBe(true);
    });

    it('should include usno, imo, nasa, mpc sources', () => {
      const ids = ASTRO_EVENT_SOURCES.map(s => s.id);
      expect(ids).toContain('usno');
      expect(ids).toContain('imo');
      expect(ids).toContain('nasa');
      expect(ids).toContain('mpc');
    });
  });

  describe('SATELLITE_SOURCES', () => {
    it('should have required source configurations', () => {
      expect(SATELLITE_SOURCES.length).toBeGreaterThan(0);
      
      SATELLITE_SOURCES.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.priority).toBe('number');
      });
    });

    it('should include CelesTrak source', () => {
      const celestrak = SATELLITE_SOURCES.find(s => s.id === 'celestrak');
      expect(celestrak).toBeDefined();
      expect(celestrak?.apiUrl).toContain('celestrak');
    });
  });

  describe('fetchMeteorShowers', () => {
    it('should return meteor shower events for January', async () => {
      const events = await fetchMeteorShowers(2024, 0);
      
      expect(events.length).toBeGreaterThan(0);
      
      // Quadrantids peak in January
      const quadrantids = events.find(e => e.name.includes('Quadrantids'));
      expect(quadrantids).toBeDefined();
      expect(quadrantids?.type).toBe('meteor_shower');
      expect(quadrantids?.source).toBe('IMO');
    });

    it('should return meteor shower events for August', async () => {
      const events = await fetchMeteorShowers(2024, 7);
      
      // Perseids peak in August
      const perseids = events.find(e => e.name.includes('Perseids'));
      expect(perseids).toBeDefined();
      expect(perseids?.visibility).toBe('excellent'); // ZHR >= 50
    });

    it('should return meteor shower events for December', async () => {
      const events = await fetchMeteorShowers(2024, 11);
      
      // Geminids peak in December
      const geminids = events.find(e => e.name.includes('Geminids'));
      expect(geminids).toBeDefined();
      expect(geminids?.visibility).toBe('excellent'); // ZHR = 150
    });

    it('should include RA/Dec for radiants', async () => {
      const events = await fetchMeteorShowers(2024, 0);
      
      events.forEach(event => {
        expect(event.ra).toBeDefined();
        expect(event.dec).toBeDefined();
        expect(typeof event.ra).toBe('number');
        expect(typeof event.dec).toBe('number');
      });
    });

    it('should include IMO URL', async () => {
      const events = await fetchMeteorShowers(2024, 0);
      
      events.forEach(event => {
        expect(event.url).toContain('imo.net');
      });
    });
  });

  describe('getKnownEclipses (internal)', () => {
    // Testing via fetchEclipses fallback behavior
    it('should return eclipse for April 2024', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));
      
      // Import the module to access the function
      const { fetchEclipses } = await import('../astro-data-sources');
      const events = await fetchEclipses(2024, 3);
      
      const totalSolar = events.find(e => e.name.includes('Total Solar'));
      expect(totalSolar).toBeDefined();
      expect(totalSolar?.date.getMonth()).toBe(3);
    });

    it('should return eclipse for March 2025', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));
      
      const { fetchEclipses } = await import('../astro-data-sources');
      const events = await fetchEclipses(2025, 2);
      
      const lunarEclipse = events.find(e => e.name.includes('Lunar'));
      expect(lunarEclipse).toBeDefined();
    });

    it('parses GSFC decade pages for 2026 eclipse fixtures', async () => {
      const solarHtml = `
        <table>
          <tr><td><a>2026 Feb 17</a></td><td><a>12:13:05</a></td><td><a>Annular</a></td></tr>
          <tr><td><a>2026 Aug 12</a></td><td><a>17:47:05</a></td><td><a>Total</a></td></tr>
        </table>
      `;
      const lunarHtml = `
        <table>
          <tr><td><a>2026 Mar 03</a></td><td>11:34:52</td><td>Total</td></tr>
          <tr><td><a>2026 Aug 28</a></td><td>04:14:04</td><td>Partial</td></tr>
        </table>
      `;

      mockFetch
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(solarHtml) })
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(lunarHtml) });

      const { fetchEclipses } = await import('../astro-data-sources');

      const feb = await fetchEclipses(2026, 1);
      const aug = await fetchEclipses(2026, 7);
      const mar = await fetchEclipses(2026, 2);

      expect(feb.some(e => e.name.includes('Annular Solar'))).toBe(true);
      expect(aug.some(e => e.name.includes('Total Solar') || e.name.includes('Partial Lunar'))).toBe(true);
      expect(mar.some(e => e.name.includes('Total Lunar'))).toBe(true);
    });
  });

  describe('fetchPlanetaryEvents', () => {
    it('should return empty without API key', async () => {
      const events = await fetchPlanetaryEvents(2025, 0);
      expect(events).toEqual([]);
    });

    it('should return empty when no API key is provided for any month', async () => {
      const events = await fetchPlanetaryEvents(2025, 3); // April
      expect(events.length).toBe(0);
    });

    it('should return empty when API key is provided but request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API error'));
      const events = await fetchPlanetaryEvents(2025, 0, {
        apiKey: 'test-key',
        apiUrl: 'https://api.example.com',
      });
      expect(events).toEqual([]);
    });

    it('should call AstronomyAPI body-specific endpoint with observer params', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { rows: [] } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { rows: [] } }),
        });

      await fetchPlanetaryEvents(
        2026,
        1,
        { apiKey: 'test-key', apiUrl: 'https://api.astronomyapi.com/api/v2' },
        { latitude: 40.7, longitude: -74.0, elevation: 0 }
      );

      const firstCallUrl = mockFetch.mock.calls[0][0] as string;
      const secondCallUrl = mockFetch.mock.calls[1][0] as string;
      expect(firstCallUrl).toContain('/bodies/events/sun?');
      expect(firstCallUrl).toContain('latitude=40.7');
      expect(firstCallUrl).toContain('longitude=-74');
      expect(secondCallUrl).toContain('/bodies/events/moon?');
    });
  });

  describe('fetchAllAstroEvents', () => {
    it('should aggregate events from multiple sources (string IDs)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      const events = await fetchAllAstroEvents(2024, 0, ['imo']);
      
      expect(events.length).toBeGreaterThan(0);
      // Should be sorted by date
      for (let i = 1; i < events.length; i++) {
        expect(events[i].date.getTime()).toBeGreaterThanOrEqual(events[i - 1].date.getTime());
      }
    });

    it('should accept EventSourceConfig[] and filter by enabled', async () => {
      const configs = [
        { id: 'imo', name: 'IMO', apiUrl: '', apiKey: '', enabled: true, priority: 1, cacheMinutes: 60 },
        { id: 'usno', name: 'USNO', apiUrl: '', apiKey: '', enabled: false, priority: 2, cacheMinutes: 60 },
      ];
      const events = await fetchAllAstroEvents(2024, 0, configs);
      // Only IMO (enabled) should return events
      events.forEach(event => {
        expect(event.source).toBe('IMO');
      });
    });

    it('should handle partial failures gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        mockFetch
          .mockRejectedValueOnce(new Error('USNO error'))
          .mockRejectedValueOnce(new Error('NASA error'));

        const events = await fetchAllAstroEvents(2024, 7, ['usno', 'nasa', 'imo']);
        
        // Should still return IMO meteor showers
        expect(events.length).toBeGreaterThan(0);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should filter by enabled sources (legacy string[])', async () => {
      const events = await fetchAllAstroEvents(2024, 0, ['imo']);
      
      events.forEach(event => {
        expect(event.source).toBe('IMO');
      });
    });

    it('should use defaults when no sources provided', async () => {
      const events = await fetchAllAstroEvents(2024, 0);
      // Should still work with default sources
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('daily and range aggregation', () => {
    it('fetchAstroEventsInRange returns active-window events', async () => {
      const events = await fetchAstroEventsInRange({
        startDate: new Date(2024, 7, 10, 0, 0, 0),
        endDate: new Date(2024, 7, 10, 23, 59, 59),
        observer: { latitude: 40.7, longitude: -74.0 },
        includeOngoing: true,
        sourcesOrIds: ['imo'],
      });

      const perseidsWindow = events.find(event => event.name.includes('Perseids'));
      expect(perseidsWindow).toBeDefined();
      expect(perseidsWindow?.endDate).toBeDefined();
    });

    it('fetchDailyAstroEvents classifies ongoing status', async () => {
      const daily = await fetchDailyAstroEvents({
        date: new Date(2024, 7, 10, 12, 0, 0),
        observer: { latitude: 40.7, longitude: -74.0 },
        includeOngoing: true,
        sourcesOrIds: ['imo'],
      });

      const meteorWindow = daily.events.find(event => event.type === 'meteor_shower' && event.occurrenceMode === 'window');
      expect(meteorWindow).toBeDefined();
      expect(meteorWindow?.statusOnSelectedDay).toBe('ongoing');
    });

    it('fetchDailyAstroEvents preserves explicit timezone', async () => {
      const daily = await fetchDailyAstroEvents({
        date: new Date(2024, 7, 10, 12, 0, 0),
        observer: { latitude: 31.2, longitude: 121.5 },
        includeOngoing: true,
        sourcesOrIds: ['imo'],
        timezone: 'Asia/Shanghai',
      });

      expect(daily.timezone).toBe('Asia/Shanghai');
    });

    it('fetchDailyAstroEvents resolves observer timezone from coordinates', async () => {
      const daily = await fetchDailyAstroEvents({
        date: new Date(2024, 7, 10, 12, 0, 0),
        observer: { latitude: 40.7128, longitude: -74.0060 },
        includeOngoing: true,
        sourcesOrIds: ['imo'],
      });

      expect(daily.timezone).toBe('America/New_York');
    });
  });

  describe('fetchAllSatellites', () => {
    it('should fetch satellites from CelesTrak', async () => {
      const mockSatellites = [
        {
          OBJECT_NAME: 'ISS (ZARYA)',
          NORAD_CAT_ID: 25544,
          OBJECT_ID: '1998-067A',
          TLE_LINE1: '1 25544U...',
          TLE_LINE2: '2 25544...',
          MEAN_MOTION: 15.5,
          INCLINATION: 51.6,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSatellites),
      });

      const satellites = await fetchAllSatellites(['stations']);

      expect(satellites.length).toBeGreaterThan(0);
      expect(satellites[0].name).toBe('ISS (ZARYA)');
      expect(satellites[0].noradId).toBe(25544);
      expect(satellites[0].type).toBe('iss');
    });

    it('should deduplicate satellites across categories', async () => {
      const mockSat = {
        OBJECT_NAME: 'ISS (ZARYA)',
        NORAD_CAT_ID: 25544,
        OBJECT_ID: '1998-067A',
        TLE_LINE1: '1 25544U...',
        TLE_LINE2: '2 25544...',
        MEAN_MOTION: 15.5,
        INCLINATION: 51.6,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockSat]) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockSat]) });

      const satellites = await fetchAllSatellites(['stations', 'visual']);

      // Should only have one ISS despite appearing in both categories
      const issSatellites = satellites.filter(s => s.noradId === 25544);
      expect(issSatellites.length).toBe(1);
    });

    it('should categorize satellites correctly', async () => {
      const mockSatellites = [
        { OBJECT_NAME: 'STARLINK-1234', NORAD_CAT_ID: 1, MEAN_MOTION: 15, INCLINATION: 53 },
        { OBJECT_NAME: 'GPS IIR-10', NORAD_CAT_ID: 2, MEAN_MOTION: 2, INCLINATION: 55 },
        { OBJECT_NAME: 'NOAA 19', NORAD_CAT_ID: 3, MEAN_MOTION: 14, INCLINATION: 99 },
        { OBJECT_NAME: 'HUBBLE', NORAD_CAT_ID: 4, MEAN_MOTION: 15, INCLINATION: 28 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSatellites),
      });

      const satellites = await fetchAllSatellites(['visual']);

      const starlink = satellites.find(s => s.name === 'STARLINK-1234');
      expect(starlink?.type).toBe('starlink');

      const gps = satellites.find(s => s.name === 'GPS IIR-10');
      expect(gps?.type).toBe('gps');

      const noaa = satellites.find(s => s.name === 'NOAA 19');
      expect(noaa?.type).toBe('weather');

      const hubble = satellites.find(s => s.name === 'HUBBLE');
      expect(hubble?.type).toBe('scientific');
    });

    it('should handle fetch errors gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const satellites = await fetchAllSatellites(['stations']);

        expect(satellites).toEqual([]);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('should sort satellites by name', async () => {
      const mockSatellites = [
        { OBJECT_NAME: 'ZARYA', NORAD_CAT_ID: 3, MEAN_MOTION: 15, INCLINATION: 51 },
        { OBJECT_NAME: 'ALPHA', NORAD_CAT_ID: 1, MEAN_MOTION: 15, INCLINATION: 51 },
        { OBJECT_NAME: 'MIKE', NORAD_CAT_ID: 2, MEAN_MOTION: 15, INCLINATION: 51 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSatellites),
      });

      const satellites = await fetchAllSatellites(['stations']);

      expect(satellites[0].name).toBe('ALPHA');
      expect(satellites[1].name).toBe('MIKE');
      expect(satellites[2].name).toBe('ZARYA');
    });
  });

  describe('fetchSatellitePasses', () => {
    it('should return empty array without API key', async () => {
      const { fetchSatellitePasses } = await import('../astro-data-sources');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      logManager.initialize({ enableConsole: true, enablePersistence: false });

      const passes = await fetchSatellitePasses(25544, 45.0, -75.0, 0, 2, 300);

      expect(passes).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.flat().join(' ')).toContain('N2YO API key not provided');
      consoleSpy.mockRestore();
      logManager.initialize({ enableConsole: false, enablePersistence: false });
    });

    it('should fetch passes with valid API key', async () => {
      const mockPasses = {
        info: { satname: 'ISS' },
        passes: [
          {
            startUTC: 1704067200,
            startAz: 180,
            startEl: 10,
            maxUTC: 1704067500,
            maxAz: 270,
            maxEl: 45,
            endUTC: 1704067800,
            endAz: 0,
            endEl: 10,
            mag: -3.5,
            duration: 600,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPasses),
      });

      const { fetchSatellitePasses } = await import('../astro-data-sources');
      const passes = await fetchSatellitePasses(25544, 45.0, -75.0, 0, 2, 300, 'test-api-key');

      expect(passes.length).toBe(1);
      expect(passes[0].maxEl).toBe(45);
      expect(passes[0].magnitude).toBe(-3.5);
    });
  });

  describe('fetchISSPosition', () => {
    it('should return ISS position', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          iss_position: { latitude: '45.5', longitude: '-75.5' },
        }),
      });

      const { fetchISSPosition } = await import('../astro-data-sources');
      const position = await fetchISSPosition();

      expect(position).toBeDefined();
      expect(position?.lat).toBe(45.5);
      expect(position?.lng).toBe(-75.5);
      expect(position?.alt).toBe(420); // Approximate altitude
    });

    it('should return null on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { fetchISSPosition } = await import('../astro-data-sources');
      const position = await fetchISSPosition();

      expect(position).toBeNull();
      consoleSpy.mockRestore();
    });
  });
});
