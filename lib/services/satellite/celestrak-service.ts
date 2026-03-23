/**
 * CelesTrak satellite data fetching service
 * Extracted from satellite-tracker.tsx for proper separation of concerns
 */

import type { SatelliteData, SatelliteType } from '@/lib/core/types';
import { parseTLE, calculatePosition, type ObserverLocation } from '@/lib/services/satellite-propagator';
import { smartFetch } from '@/lib/services/http-fetch';
import { createLogger } from '@/lib/logger';

const logger = createLogger('celestrak-service');

// ============================================================================
// Types
// ============================================================================

export interface CelesTrakSatellitePass {
  satellite: SatelliteData;
  startTime: Date;
  maxTime: Date;
  endTime: Date;
  startAz: number;
  maxAz: number;
  maxEl: number;
  endAz: number;
  magnitude?: number;
  duration: number;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiUrl: string;
}

// ============================================================================
// Data Source Configuration
// ============================================================================

export const SATELLITE_SOURCES: DataSourceConfig[] = [
  { id: 'celestrak', name: 'CelesTrak', enabled: true, apiUrl: 'https://celestrak.org' },
  { id: 'n2yo', name: 'N2YO', enabled: true, apiUrl: 'https://api.n2yo.com' },
  { id: 'heavensabove', name: 'Heavens-Above', enabled: false, apiUrl: 'https://heavens-above.com' },
];

// ============================================================================
// In-memory cache
// ============================================================================

interface CacheEntry {
  data: SatelliteData[];
  timestamp: number;
}

interface CelesTrakGpRecord {
  OBJECT_NAME: string;
  NORAD_CAT_ID: number;
  MEAN_MOTION: number;
  INCLINATION: number;
  TLE_LINE1: string;
  TLE_LINE2: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3600 * 1000; // 1 hour

// ============================================================================
// Satellite Categorization
// ============================================================================

export function categorizeSatellite(name: string, category: string): SatelliteType {
  const upperName = name.toUpperCase();
  if (upperName.includes('ISS') || upperName.includes('ZARYA') || upperName.includes('TIANGONG')) return 'iss';
  if (upperName.includes('STARLINK')) return 'starlink';
  if (upperName.includes('GPS') || upperName.includes('NAVSTAR') || upperName.includes('GLONASS')) return 'gps';
  if (upperName.includes('NOAA') || upperName.includes('GOES') || upperName.includes('METEO')) return 'weather';
  if (upperName.includes('HUBBLE') || upperName.includes('JWST') || upperName.includes('CHANDRA')) return 'scientific';
  if (category === 'amateur') return 'amateur';
  return 'other';
}

// ============================================================================
// Simulated Position Fallback
// ============================================================================

export function getSimulatedSatellitePosition(noradId: number, inclination: number, period: number): { ra: number; dec: number } {
  const now = Date.now();
  const orbitalPhase = ((now / 1000 / 60) % period) / period;
  const ra = ((noradId * 137.5 + orbitalPhase * 360) % 360);
  const dec = Math.sin(orbitalPhase * 2 * Math.PI) * inclination * 0.8;
  return { ra, dec };
}

// ============================================================================
// API Functions
// ============================================================================

export async function fetchSatellitesFromCelesTrak(
  category: string = 'stations',
  observer?: ObserverLocation
): Promise<SatelliteData[]> {
  const cacheKey = `celestrak-${category}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await smartFetch(
      `https://celestrak.org/NORAD/elements/gp.php?GROUP=${category}&FORMAT=json`,
      {
        method: 'GET',
        timeout: 30000,
        cachePolicy: 'satellite-tle',
        cacheTtl: CACHE_TTL_MS,
      }
    );

    if (!response.ok) throw new Error('CelesTrak API error');

    const data = await response.json<CelesTrakGpRecord[]>();
    const now = new Date();

    const satellites: SatelliteData[] = data.map((sat) => {
      const meanMotion = sat.MEAN_MOTION;
      const period = 1440 / meanMotion;
      const altitude = Math.pow((398600.4418 * Math.pow(period * 60 / (2 * Math.PI), 2)), 1/3) - 6371;
      const velocity = Math.sqrt(398600.4418 / (6371 + altitude));

      let ra: number | undefined;
      let dec: number | undefined;
      let azimuth: number | undefined;
      let elevation: number | undefined;
      let isVisible = false;

      if (sat.TLE_LINE1 && sat.TLE_LINE2 && observer) {
        const satrec = parseTLE({
          name: sat.OBJECT_NAME,
          line1: sat.TLE_LINE1,
          line2: sat.TLE_LINE2,
        });

        if (satrec) {
          const position = calculatePosition(satrec, now, observer);
          if (position) {
            ra = position.ra;
            dec = position.dec;
            azimuth = position.azimuth;
            elevation = position.elevation;
            isVisible = position.isVisible;
          }
        }
      }

      if (ra === undefined || dec === undefined) {
        const simPosition = getSimulatedSatellitePosition(sat.NORAD_CAT_ID, sat.INCLINATION, period);
        ra = simPosition.ra;
        dec = simPosition.dec;
      }

      return {
        id: `celestrak-${sat.NORAD_CAT_ID}`,
        name: sat.OBJECT_NAME,
        noradId: sat.NORAD_CAT_ID,
        type: categorizeSatellite(sat.OBJECT_NAME, category),
        altitude: Math.round(altitude),
        velocity: parseFloat(velocity.toFixed(2)),
        inclination: sat.INCLINATION,
        period: parseFloat(period.toFixed(1)),
        ra,
        dec,
        azimuth,
        elevation,
        isVisible,
        source: 'CelesTrak',
      };
    });

    cache.set(cacheKey, { data: satellites, timestamp: Date.now() });
    return satellites;
  } catch (error) {
    logger.warn('Failed to fetch from CelesTrak', error);
    return [];
  }
}

// ============================================================================
// Sample Data (fallback when API unavailable)
// ============================================================================

export const SAMPLE_SATELLITES: SatelliteData[] = [
  {
    id: 'iss',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    type: 'iss',
    altitude: 420,
    velocity: 7.66,
    inclination: 51.6,
    period: 92.9,
    magnitude: -3.5,
    isVisible: true,
    ra: 45.2,
    dec: 23.5,
  },
  {
    id: 'hst',
    name: 'Hubble Space Telescope',
    noradId: 20580,
    type: 'scientific',
    altitude: 540,
    velocity: 7.59,
    inclination: 28.5,
    period: 95.4,
    magnitude: 1.5,
    isVisible: false,
    ra: 120.8,
    dec: -15.3,
  },
  {
    id: 'tiangong',
    name: 'Tiangong (CSS)',
    noradId: 48274,
    type: 'iss',
    altitude: 390,
    velocity: 7.68,
    inclination: 41.5,
    period: 91.5,
    magnitude: -2.0,
    isVisible: true,
    ra: 200.5,
    dec: 35.2,
  },
  {
    id: 'starlink-1',
    name: 'Starlink-1007',
    noradId: 44713,
    type: 'starlink',
    altitude: 550,
    velocity: 7.59,
    inclination: 53.0,
    period: 95.6,
    magnitude: 5.5,
    isVisible: false,
    ra: 280.3,
    dec: 42.1,
  },
  {
    id: 'starlink-2',
    name: 'Starlink-1008',
    noradId: 44714,
    type: 'starlink',
    altitude: 550,
    velocity: 7.59,
    inclination: 53.0,
    period: 95.6,
    magnitude: 5.5,
    isVisible: false,
    ra: 310.7,
    dec: -28.4,
  },
];

// ============================================================================
// Sample Pass Generation
// ============================================================================

export function generateSamplePasses(satellites: SatelliteData[]): CelesTrakSatellitePass[] {
  const passes: CelesTrakSatellitePass[] = [];
  const now = new Date();

  satellites.forEach((sat, index) => {
    const numPasses = 1 + (index % 3);

    for (let i = 0; i < numPasses; i++) {
      const startOffset = (index * 2 + i * 6) * 60 * 60 * 1000;
      const startTime = new Date(now.getTime() + startOffset);
      const duration = 4 + (index % 5);
      const maxTime = new Date(startTime.getTime() + (duration / 2) * 60 * 1000);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      passes.push({
        satellite: sat,
        startTime,
        maxTime,
        endTime,
        startAz: (45 + index * 30) % 360,
        maxAz: (135 + index * 30) % 360,
        maxEl: 30 + (index * 15) % 60,
        endAz: (225 + index * 30) % 360,
        magnitude: sat.magnitude,
        duration,
      });
    }
  });

  passes.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return passes;
}
