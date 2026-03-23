import {
  categorizeSatellite,
  getSimulatedSatellitePosition,
  SAMPLE_SATELLITES,
  generateSamplePasses,
  SATELLITE_SOURCES,
  fetchSatellitesFromCelesTrak,
} from '../celestrak-service';

const mockSmartFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

// Mock satellite propagator
jest.mock('@/lib/services/satellite-propagator', () => ({
  parseTLE: jest.fn(),
  calculatePosition: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('celestrak-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSmartFetch.mockReset();
  });

  describe('categorizeSatellite', () => {
    it('should categorize ISS correctly', () => {
      expect(categorizeSatellite('ISS (ZARYA)', 'stations')).toBe('iss');
      expect(categorizeSatellite('ZARYA', 'stations')).toBe('iss');
      expect(categorizeSatellite('TIANGONG', 'stations')).toBe('iss');
    });

    it('should categorize Starlink correctly', () => {
      expect(categorizeSatellite('STARLINK-1007', 'starlink')).toBe('starlink');
    });

    it('should categorize GPS correctly', () => {
      expect(categorizeSatellite('GPS BIIR-2', 'gps')).toBe('gps');
      expect(categorizeSatellite('NAVSTAR 43', 'gps')).toBe('gps');
      expect(categorizeSatellite('GLONASS 802', 'gps')).toBe('gps');
    });

    it('should categorize weather satellites correctly', () => {
      expect(categorizeSatellite('NOAA 18', 'weather')).toBe('weather');
      expect(categorizeSatellite('GOES 16', 'weather')).toBe('weather');
      expect(categorizeSatellite('METEOSAT 11', 'weather')).toBe('weather');
    });

    it('should categorize scientific satellites correctly', () => {
      expect(categorizeSatellite('HUBBLE', 'science')).toBe('scientific');
      expect(categorizeSatellite('JWST', 'science')).toBe('scientific');
      expect(categorizeSatellite('CHANDRA', 'science')).toBe('scientific');
    });

    it('should categorize amateur satellites correctly', () => {
      expect(categorizeSatellite('AMSAT-OSCAR', 'amateur')).toBe('amateur');
    });

    it('should default to other for unknown satellites', () => {
      expect(categorizeSatellite('UNKNOWN SAT', 'misc')).toBe('other');
    });
  });

  describe('getSimulatedSatellitePosition', () => {
    it('should return RA in 0-360 range', () => {
      const pos = getSimulatedSatellitePosition(25544, 51.6, 92.9);
      expect(pos.ra).toBeGreaterThanOrEqual(0);
      expect(pos.ra).toBeLessThan(360);
    });

    it('should return Dec within inclination bounds', () => {
      const inclination = 51.6;
      const pos = getSimulatedSatellitePosition(25544, inclination, 92.9);
      expect(Math.abs(pos.dec)).toBeLessThanOrEqual(inclination);
    });

    it('should produce different positions for different NORAD IDs', () => {
      const pos1 = getSimulatedSatellitePosition(25544, 51.6, 92.9);
      const pos2 = getSimulatedSatellitePosition(20580, 28.5, 95.4);
      expect(pos1.ra).not.toEqual(pos2.ra);
    });
  });

  describe('SAMPLE_SATELLITES', () => {
    it('should contain expected sample satellites', () => {
      expect(SAMPLE_SATELLITES.length).toBeGreaterThanOrEqual(3);
      const names = SAMPLE_SATELLITES.map(s => s.name);
      expect(names).toContain('ISS (ZARYA)');
      expect(names).toContain('Hubble Space Telescope');
    });

    it('should have valid satellite data', () => {
      for (const sat of SAMPLE_SATELLITES) {
        expect(sat.id).toBeTruthy();
        expect(sat.name).toBeTruthy();
        expect(sat.noradId).toBeGreaterThan(0);
        expect(sat.altitude).toBeGreaterThan(0);
        expect(sat.velocity).toBeGreaterThan(0);
        expect(typeof sat.isVisible).toBe('boolean');
      }
    });
  });

  describe('SATELLITE_SOURCES', () => {
    it('should contain CelesTrak source', () => {
      const celestrak = SATELLITE_SOURCES.find(s => s.id === 'celestrak');
      expect(celestrak).toBeDefined();
      expect(celestrak!.enabled).toBe(true);
    });

    it('should have valid source configs', () => {
      for (const source of SATELLITE_SOURCES) {
        expect(source.id).toBeTruthy();
        expect(source.name).toBeTruthy();
        expect(source.apiUrl).toBeTruthy();
      }
    });
  });

  describe('generateSamplePasses', () => {
    it('should generate passes for given satellites', () => {
      const passes = generateSamplePasses(SAMPLE_SATELLITES);
      expect(passes.length).toBeGreaterThan(0);
    });

    it('should sort passes by start time', () => {
      const passes = generateSamplePasses(SAMPLE_SATELLITES);
      for (let i = 1; i < passes.length; i++) {
        expect(passes[i].startTime.getTime()).toBeGreaterThanOrEqual(
          passes[i - 1].startTime.getTime()
        );
      }
    });

    it('should have valid pass data', () => {
      const passes = generateSamplePasses(SAMPLE_SATELLITES);
      for (const pass of passes) {
        expect(pass.satellite).toBeDefined();
        expect(pass.startTime).toBeInstanceOf(Date);
        expect(pass.maxTime).toBeInstanceOf(Date);
        expect(pass.endTime).toBeInstanceOf(Date);
        expect(pass.maxTime.getTime()).toBeGreaterThan(pass.startTime.getTime());
        expect(pass.endTime.getTime()).toBeGreaterThan(pass.maxTime.getTime());
        expect(pass.maxEl).toBeGreaterThan(0);
        expect(pass.duration).toBeGreaterThan(0);
      }
    });
  });

  describe('fetchSatellitesFromCelesTrak', () => {
    it('should return empty array on fetch error', async () => {
      mockSmartFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await fetchSatellitesFromCelesTrak('stations');
      expect(result).toEqual([]);
    });

    it('should return empty array on non-ok response', async () => {
      mockSmartFetch.mockResolvedValueOnce({ ok: false });
      const result = await fetchSatellitesFromCelesTrak('stations');
      expect(result).toEqual([]);
    });

    it('should parse CelesTrak GP data correctly', async () => {
      mockSmartFetch.mockResolvedValueOnce({
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

      const result = await fetchSatellitesFromCelesTrak('stations');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('ISS (ZARYA)');
      expect(result[0].noradId).toBe(25544);
      expect(result[0].type).toBe('iss');
      expect(result[0].source).toBe('CelesTrak');
      expect(result[0].altitude).toBeGreaterThan(0);
      expect(result[0].velocity).toBeGreaterThan(0);
      expect(mockSmartFetch).toHaveBeenCalledWith(
        'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
        expect.objectContaining({
          cachePolicy: 'satellite-tle',
          cacheTtl: 3600 * 1000,
        })
      );
    });
  });
});
