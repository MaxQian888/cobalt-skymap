/**
 * Astronomical Data Sources API
 * Supports multiple data sources for astronomical events and satellite tracking
 */

import { smartFetch } from '@/lib/services/http-fetch';
import { createLogger } from '@/lib/logger';
import type { EventSourceConfig } from '@/lib/stores/event-sources-store';
import {
  Body,
  EclipseKind,
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  NextMoonQuarter,
  Seasons,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchMaxElongation,
  SearchMoonQuarter,
  SearchRelativeLongitude,
} from 'astronomy-engine';
import { resolveTimezoneFromCoordinates } from '@/lib/utils/observer-timezone';

const logger = createLogger('astro-data-sources');

// ============================================================================
// Types
// ============================================================================

export type EventType = 
  | 'lunar_phase' 
  | 'meteor_shower' 
  | 'planet_conjunction' 
  | 'eclipse' 
  | 'planet_opposition'
  | 'planet_elongation'
  | 'equinox_solstice'
  | 'comet'
  | 'asteroid'
  | 'supernova'
  | 'aurora'
  | 'other';

export interface AstroEvent {
  id: string;
  type: EventType;
  name: string;
  date: Date;
  endDate?: Date;
  description: string;
  visibility: 'excellent' | 'good' | 'fair' | 'poor';
  ra?: number;
  dec?: number;
  magnitude?: number;
  peakTime?: Date;
  source: string;
  url?: string;
}

export type EventOccurrenceMode = 'instant' | 'window';
export type DailyEventStatus = 'upcoming_today' | 'ongoing' | 'ended_today';

export interface AstroObserver {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface DailyAstroEvent extends AstroEvent {
  startsAt: Date;
  endsAt?: Date;
  occurrenceMode: EventOccurrenceMode;
  statusOnSelectedDay: DailyEventStatus;
  localDateKey: string;
  sourcePriority: number;
}

export interface FetchAstroEventsInRangeParams {
  startDate: Date;
  endDate: Date;
  observer: AstroObserver;
  includeOngoing?: boolean;
  sourcesOrIds?: EventSourceConfig[] | string[];
  timezone?: string;
}

export interface FetchDailyAstroEventsParams {
  date: Date;
  observer: AstroObserver;
  includeOngoing?: boolean;
  sourcesOrIds?: EventSourceConfig[] | string[];
  timezone?: string;
}

export interface DailyAstroEventsResult {
  date: Date;
  timezone: string;
  events: DailyAstroEvent[];
  fetchedAt: Date;
  sourceBreakdown: Record<string, number>;
}

export interface SatelliteData {
  id: string;
  name: string;
  noradId: number;
  intlDesignator?: string;
  type: 'iss' | 'starlink' | 'weather' | 'gps' | 'communication' | 'scientific' | 'amateur' | 'other';
  altitude: number;
  velocity: number;
  inclination: number;
  period: number;
  ra?: number;
  dec?: number;
  azimuth?: number;
  elevation?: number;
  magnitude?: number;
  isVisible: boolean;
  tle?: {
    line1: string;
    line2: string;
  };
  source: string;
}

export interface SatellitePass {
  satellite: SatelliteData;
  startTime: Date;
  maxTime: Date;
  endTime: Date;
  startAz: number;
  startEl: number;
  maxAz: number;
  maxEl: number;
  endAz: number;
  endEl: number;
  magnitude?: number;
  duration: number;
  isVisible: boolean;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  priority: number;
}

// Re-export for backward compatibility
export { useEventSourcesStore, type EventSourceConfig as StoreEventSourceConfig } from '@/lib/stores/event-sources-store';

// Legacy constant kept for callers that haven't migrated
export const ASTRO_EVENT_SOURCES: DataSourceConfig[] = [
  { id: 'usno', name: 'US Naval Observatory', enabled: true, apiUrl: 'https://aa.usno.navy.mil/api', priority: 1 },
  { id: 'imo', name: 'International Meteor Organization', enabled: true, apiUrl: 'https://www.imo.net/api', priority: 2 },
  { id: 'nasa', name: 'NASA Eclipse', enabled: true, apiUrl: 'https://eclipse.gsfc.nasa.gov', priority: 3 },
  { id: 'mpc', name: 'Minor Planet Center', enabled: true, apiUrl: 'https://www.minorplanetcenter.net', priority: 4 },
  { id: 'astronomyapi', name: 'Astronomy API', enabled: false, apiUrl: 'https://api.astronomyapi.com/api/v2', priority: 5 },
  { id: 'local', name: 'Local Calculations', enabled: true, priority: 99 },
];

export const SATELLITE_SOURCES: DataSourceConfig[] = [
  {
    id: 'celestrak',
    name: 'CelesTrak',
    enabled: true,
    apiUrl: 'https://celestrak.org',
    priority: 1,
  },
  {
    id: 'n2yo',
    name: 'N2YO',
    enabled: true,
    apiUrl: 'https://api.n2yo.com/rest/v1/satellite',
    priority: 2,
  },
  {
    id: 'spacetrack',
    name: 'Space-Track.org',
    enabled: true,
    apiUrl: 'https://www.space-track.org/basicspacedata',
    priority: 3,
  },
  {
    id: 'heavensabove',
    name: 'Heavens-Above',
    enabled: true,
    apiUrl: 'https://www.heavens-above.com',
    priority: 4,
  },
];

const DEFAULT_ASTRO_SOURCES = ['local', 'usno', 'imo', 'nasa', 'mpc'] as const;
const GSFC_PAGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const MONTH_ABBR_TO_INDEX: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const gsfcPageCache = new Map<string, { expiresAt: number; events: AstroEvent[] }>();

function getGsfcDecadeStart(year: number): number {
  return Math.floor((year - 1) / 10) * 10 + 1;
}

function buildGsfcSolarDecadeUrl(year: number): string {
  const decadeStart = getGsfcDecadeStart(year);
  return `https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade${decadeStart}.html`;
}

function buildGsfcLunarDecadeUrl(year: number): string {
  const decadeStart = getGsfcDecadeStart(year);
  return `https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade${decadeStart}.html`;
}

function sourcePriorityMap(sources: EventSourceConfig[] = []): Record<string, number> {
  const map: Record<string, number> = {};
  sources.forEach((source) => {
    map[source.id] = source.priority;
  });
  return map;
}

function sourceIdFromEvent(eventSource: string): string {
  const normalized = eventSource.trim().toLowerCase();
  if (normalized.includes('usno')) return 'usno';
  if (normalized.includes('imo')) return 'imo';
  if (normalized.includes('nasa')) return 'nasa';
  if (normalized.includes('astronomy api')) return 'astronomyapi';
  if (normalized.includes('local')) return 'local';
  if (normalized.includes('mpc') || normalized.includes('minor planet')) return 'mpc';
  return normalized;
}

function getLocalDateParts(date: Date, timezone: string): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? `${date.getUTCFullYear()}`;
  const month = parts.find((part) => part.type === 'month')?.value ?? `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = parts.find((part) => part.type === 'day')?.value ?? `${date.getUTCDate()}`.padStart(2, '0');
  return { year, month, day };
}

function getLocalDateKey(date: Date, timezone: string): string {
  const parts = getLocalDateParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function resolveObserverTimezone(observer: AstroObserver, explicitTimezone?: string): string {
  return resolveTimezoneFromCoordinates(observer, { explicitTimezone });
}

function parseGsfcDate(dateToken: string, timeToken: string): Date | null {
  const dateMatch = dateToken.trim().match(/^(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!dateMatch) return null;
  const monthIndex = MONTH_ABBR_TO_INDEX[dateMatch[2]];
  if (monthIndex === undefined) return null;
  const year = Number.parseInt(dateMatch[1], 10);
  const day = Number.parseInt(dateMatch[3], 10);
  const safeTime = (timeToken.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/) ?? []).slice(1);
  const hour = Number.parseInt(safeTime[0] ?? '0', 10);
  const minute = Number.parseInt(safeTime[1] ?? '0', 10);
  const second = Number.parseInt(safeTime[2] ?? '0', 10);
  return new Date(Date.UTC(year, monthIndex, day, hour, minute, second));
}

function normalizeEclipseVisibility(label: string): AstroEvent['visibility'] {
  const normalized = label.toLowerCase();
  if (normalized.includes('total')) return 'excellent';
  if (normalized.includes('annular')) return 'good';
  if (normalized.includes('partial')) return 'fair';
  return 'fair';
}

function parseGsfcSolarHtml(html: string, sourceUrl: string): AstroEvent[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const events: AstroEvent[] = [];
  const rowRegex = /<td[^>]*>\s*(?:<a[^>]*>)?\s*([0-9]{4}\s+[A-Za-z]{3}\s+[0-9]{1,2})\s*(?:<\/a>)?\s*<\/td>[\s\S]*?<td[^>]*>\s*(?:<a[^>]*>)?\s*([0-9]{2}:[0-9]{2}:[0-9]{2})\s*(?:<\/a>)?\s*<\/td>[\s\S]*?<td[^>]*>\s*(?:<a[^>]*>)?\s*(Total|Annular|Hybrid|Partial)\s*(?:<\/a>)?\s*<\/td>/i;

  rows.forEach((row) => {
    const match = row.match(rowRegex);
    if (!match) return;
    const parsedDate = parseGsfcDate(match[1], match[2]);
    if (!parsedDate) return;
    const eclipseType = match[3];
    events.push({
      id: `nasa-solar-${parsedDate.toISOString()}`,
      type: 'eclipse',
      name: `${eclipseType} Solar Eclipse`,
      date: parsedDate,
      description: `${eclipseType} solar eclipse from NASA GSFC catalog.`,
      visibility: normalizeEclipseVisibility(eclipseType),
      source: 'NASA GSFC',
      url: sourceUrl,
    });
  });

  return events;
}

function parseGsfcLunarHtml(html: string, sourceUrl: string): AstroEvent[] {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const events: AstroEvent[] = [];
  const rowRegex = /<td[^>]*>\s*(?:<a[^>]*>)?\s*([0-9]{4}\s+[A-Za-z]{3}\s+[0-9]{1,2})\s*(?:<\/a>)?\s*<\/td>[\s\S]*?<td[^>]*>\s*([0-9]{2}:[0-9]{2}:[0-9]{2})\s*<\/td>[\s\S]*?<td[^>]*>\s*(Total|Partial|Penumbral)\s*<\/td>/i;

  rows.forEach((row) => {
    const match = row.match(rowRegex);
    if (!match) return;
    const parsedDate = parseGsfcDate(match[1], match[2]);
    if (!parsedDate) return;
    const eclipseType = match[3];
    events.push({
      id: `nasa-lunar-${parsedDate.toISOString()}`,
      type: 'eclipse',
      name: `${eclipseType} Lunar Eclipse`,
      date: parsedDate,
      description: `${eclipseType} lunar eclipse from NASA GSFC catalog.`,
      visibility: normalizeEclipseVisibility(eclipseType),
      source: 'NASA GSFC',
      url: sourceUrl,
    });
  });

  return events;
}

async function fetchGsfcDecadeCatalog(
  url: string,
  parser: (html: string, sourceUrl: string) => AstroEvent[]
): Promise<AstroEvent[]> {
  const now = Date.now();
  const cached = gsfcPageCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.events;
  }

  const response = await smartFetch(url, {
    timeout: 30000,
    cachePolicy: 'astro-gsfc-catalog',
    cacheTtl: GSFC_PAGE_CACHE_TTL_MS,
  });
  if (!response.ok) {
    throw new Error(`NASA GSFC catalog fetch failed: ${url}`);
  }

  const html = await response.text();
  const parsedEvents = parser(html, url);
  gsfcPageCache.set(url, {
    expiresAt: now + GSFC_PAGE_CACHE_TTL_MS,
    events: parsedEvents,
  });
  return parsedEvents;
}

async function fetchGsfcEclipsesForYear(year: number): Promise<AstroEvent[]> {
  const solarUrl = buildGsfcSolarDecadeUrl(year);
  const lunarUrl = buildGsfcLunarDecadeUrl(year);
  const [solarEvents, lunarEvents] = await Promise.all([
    fetchGsfcDecadeCatalog(solarUrl, parseGsfcSolarHtml),
    fetchGsfcDecadeCatalog(lunarUrl, parseGsfcLunarHtml),
  ]);
  return [...solarEvents, ...lunarEvents]
    .filter((event) => event.date.getUTCFullYear() === year)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

// ============================================================================
// API Fetchers
// ============================================================================

/**
 * Fetch lunar phases from USNO API
 */
export async function fetchLunarPhases(year: number, month: number): Promise<AstroEvent[]> {
  try {
    // USNO Moon Phases API
    const response = await smartFetch(
      `https://aa.usno.navy.mil/api/moon/phases/year?year=${year}`,
      {
        timeout: 30000,
        cachePolicy: 'astro-usno-phases',
      }
    );
    
    if (!response.ok) throw new Error('USNO API error');
    
    const data = await response.json<{ phasedata?: Array<{ phase: string; date: string; time: string }> }>();
    const events: AstroEvent[] = [];
    
    if (data.phasedata) {
      data.phasedata.forEach((phase) => {
        const phaseDate = new Date(`${phase.date}T${phase.time}Z`);
        if (phaseDate.getMonth() === month) {
          events.push({
            id: `lunar-${phase.phase}-${phaseDate.toISOString()}`,
            type: 'lunar_phase',
            name: phase.phase,
            date: phaseDate,
            description: `The Moon reaches ${phase.phase.toLowerCase()} phase.`,
            visibility: phase.phase === 'New Moon' ? 'excellent' : 'good',
            source: 'USNO',
            url: 'https://aa.usno.navy.mil/data/MoonPhases',
          });
        }
      });
    }
    
    return events;
  } catch (error) {
    logger.warn('Failed to fetch lunar phases from USNO', error);
    return [];
  }
}

/**
 * Fetch meteor shower data from IMO
 */
export async function fetchMeteorShowers(year: number, month: number): Promise<AstroEvent[]> {
  // IMO Meteor Shower Calendar data (static but comprehensive)
  const showers = [
    { code: 'QUA', name: 'Quadrantids', peak: [0, 4], start: [0, 1], end: [0, 10], zhr: 120, ra: 230, dec: 49, speed: 41 },
    { code: 'LYR', name: 'Lyrids', peak: [3, 22], start: [3, 16], end: [3, 25], zhr: 18, ra: 271, dec: 34, speed: 49 },
    { code: 'ETA', name: 'η-Aquariids', peak: [4, 6], start: [3, 19], end: [4, 28], zhr: 50, ra: 338, dec: -1, speed: 66 },
    { code: 'SDA', name: 'δ-Aquariids', peak: [6, 30], start: [6, 12], end: [7, 23], zhr: 25, ra: 340, dec: -16, speed: 41 },
    { code: 'CAP', name: 'α-Capricornids', peak: [6, 30], start: [6, 3], end: [7, 15], zhr: 5, ra: 307, dec: -10, speed: 23 },
    { code: 'PER', name: 'Perseids', peak: [7, 12], start: [6, 17], end: [7, 24], zhr: 100, ra: 48, dec: 58, speed: 59 },
    { code: 'ORI', name: 'Orionids', peak: [9, 21], start: [9, 2], end: [10, 7], zhr: 20, ra: 95, dec: 16, speed: 66 },
    { code: 'DRA', name: 'Draconids', peak: [9, 8], start: [9, 6], end: [9, 10], zhr: 10, ra: 262, dec: 54, speed: 20 },
    { code: 'STA', name: 'S. Taurids', peak: [9, 10], start: [8, 10], end: [10, 20], zhr: 5, ra: 52, dec: 13, speed: 27 },
    { code: 'NTA', name: 'N. Taurids', peak: [10, 12], start: [9, 20], end: [11, 10], zhr: 5, ra: 58, dec: 22, speed: 29 },
    { code: 'LEO', name: 'Leonids', peak: [10, 17], start: [10, 6], end: [10, 30], zhr: 15, ra: 152, dec: 22, speed: 71 },
    { code: 'GEM', name: 'Geminids', peak: [11, 14], start: [11, 4], end: [11, 17], zhr: 150, ra: 112, dec: 33, speed: 35 },
    { code: 'URS', name: 'Ursids', peak: [11, 22], start: [11, 17], end: [11, 26], zhr: 10, ra: 217, dec: 76, speed: 33 },
  ];
  
  const events: AstroEvent[] = [];
  
  showers.forEach(shower => {
    const peakDate = new Date(year, shower.peak[0], shower.peak[1]);
    const startDate = new Date(year, shower.start[0], shower.start[1]);
    const endDate = new Date(year, shower.end[0], shower.end[1]);
    
    // Check if active during this month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    if (startDate <= monthEnd && endDate >= monthStart) {
      events.push({
        id: `meteor-${shower.code}-${year}`,
        type: 'meteor_shower',
        name: `${shower.name} Meteor Shower`,
        date: startDate,
        endDate: endDate,
        peakTime: peakDate,
        description: `Peak ZHR: ~${shower.zhr} meteors/hour. Radiant in ${getConstellationName(shower.ra, shower.dec)}. Entry speed: ${shower.speed} km/s.`,
        visibility: shower.zhr >= 50 ? 'excellent' : shower.zhr >= 20 ? 'good' : 'fair',
        ra: shower.ra,
        dec: shower.dec,
        source: 'IMO',
        url: `https://www.imo.net/resources/calendar/#${shower.code}`,
      });
    }
  });
  
  return events;
}

/**
 * Fetch eclipse data
 */
export async function fetchEclipses(year: number, month: number): Promise<AstroEvent[]> {
  try {
    const gsfcEvents = await fetchGsfcEclipsesForYear(year);
    return gsfcEvents.filter((event) => event.date.getUTCMonth() === month);
  } catch (error) {
    logger.warn('Failed to fetch eclipses from NASA GSFC catalogs, using fallback list', error);
    return getKnownEclipses(year, month);
  }
}

function getKnownEclipses(year: number, month: number): AstroEvent[] {
  const eclipses = [
    // 2024
    { date: '2024-03-25', type: 'Penumbral Lunar Eclipse', visibility: 'fair' as const },
    { date: '2024-04-08', type: 'Total Solar Eclipse', visibility: 'excellent' as const },
    { date: '2024-09-18', type: 'Partial Lunar Eclipse', visibility: 'good' as const },
    { date: '2024-10-02', type: 'Annular Solar Eclipse', visibility: 'good' as const },
    // 2025
    { date: '2025-03-14', type: 'Total Lunar Eclipse', visibility: 'excellent' as const },
    { date: '2025-03-29', type: 'Partial Solar Eclipse', visibility: 'fair' as const },
    { date: '2025-09-07', type: 'Total Lunar Eclipse', visibility: 'excellent' as const },
    { date: '2025-09-21', type: 'Partial Solar Eclipse', visibility: 'fair' as const },
    // 2026
    { date: '2026-02-17', type: 'Annular Solar Eclipse', visibility: 'good' as const },
    { date: '2026-03-03', type: 'Total Lunar Eclipse', visibility: 'excellent' as const },
    { date: '2026-08-12', type: 'Total Solar Eclipse', visibility: 'excellent' as const },
    { date: '2026-08-28', type: 'Partial Lunar Eclipse', visibility: 'good' as const },
  ];
  
  const events: AstroEvent[] = [];
  
  eclipses.forEach(eclipse => {
    const eclipseDate = new Date(eclipse.date);
    if (eclipseDate.getFullYear() === year && eclipseDate.getMonth() === month) {
      events.push({
        id: `eclipse-${eclipse.date}`,
        type: 'eclipse',
        name: eclipse.type,
        date: eclipseDate,
        description: `${eclipse.type} visible from various locations.`,
        visibility: eclipse.visibility,
        source: 'NASA',
        url: 'https://eclipse.gsfc.nasa.gov/',
      });
    }
  });
  
  return events;
}

/**
 * Fetch comet data from Minor Planet Center
 */
function parseMpcPerihelionDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})\/(\d{1,2}(?:\.\d+)?)\/(\d{4})$/);
  if (!match) return null;

  const month = Number.parseInt(match[1], 10);
  const dayWithFraction = Number.parseFloat(match[2]);
  const year = Number.parseInt(match[3], 10);
  if (!Number.isFinite(dayWithFraction) || month < 1 || month > 12) return null;

  const day = Math.floor(dayWithFraction);
  const fraction = dayWithFraction - day;
  const totalSeconds = Math.round(fraction * 86400);
  const hour = Math.floor(totalSeconds / 3600);
  const minute = Math.floor((totalSeconds % 3600) / 60);
  const second = totalSeconds % 60;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function fetchComets(year?: number, month?: number): Promise<AstroEvent[]> {
  try {
    // MPC Observable Comets
    const response = await smartFetch(
      'https://www.minorplanetcenter.net/iau/Ephemerides/Comets/Soft03Cmt.txt',
      {
        timeout: 30000,
        cachePolicy: 'astro-mpc-comets',
      }
    );
    
    if (!response.ok) throw new Error('MPC API error');
    
    const text = await response.text();
    const events: AstroEvent[] = [];
    const filterByMonth = Number.isInteger(year) && Number.isInteger(month);
    
    // Parse MPC comet data format (comma-separated Soft03Cmt format)
    const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    lines.forEach(line => {
      const columns = line.split(',').map((part) => part.trim());
      const name = columns[0];
      if (!name) return;
      const perihelionDate = parseMpcPerihelionDate(columns[9]);
      if (!perihelionDate) return;
      if (
        filterByMonth
        && (perihelionDate.getUTCFullYear() !== year || perihelionDate.getUTCMonth() !== month)
      ) {
        return;
      }

      // Absolute magnitude is usually the second to last numeric field in Soft03Cmt.
      const numericColumns = columns
        .map((col) => Number.parseFloat(col.replace(/^g\s+/i, '')))
        .filter((value) => Number.isFinite(value));
      const mag = numericColumns.length > 0 ? numericColumns[numericColumns.length - 2] ?? numericColumns[numericColumns.length - 1] : Number.NaN;

      if (!Number.isFinite(mag) || mag > 12) return;
      events.push({
        id: `comet-${name.replace(/\s+/g, '-').toLowerCase()}-${perihelionDate.toISOString().slice(0, 10)}`,
        type: 'comet',
        name: `Comet ${name}`,
        date: perihelionDate,
        description: `Perihelion: ${perihelionDate.toISOString().slice(0, 10)} (UTC). Absolute magnitude estimate: ${mag.toFixed(1)}.`,
        visibility: mag < 6 ? 'excellent' : mag < 8 ? 'good' : 'fair',
        magnitude: mag,
        source: 'MPC',
        url: 'https://www.minorplanetcenter.net/iau/Ephemerides/Comets/Soft03Cmt.txt',
      });
    });
    
    return events;
  } catch (error) {
    logger.warn('Failed to fetch comets from MPC', error);
    return [];
  }
}

/**
 * Fetch satellite TLE data from CelesTrak
 */
export async function fetchSatelliteTLE(category: string = 'stations'): Promise<SatelliteData[]> {
  try {
    const response = await smartFetch(
      `https://celestrak.org/NORAD/elements/gp.php?GROUP=${category}&FORMAT=json`,
      {
        timeout: 30000,
        cachePolicy: 'satellite-tle',
      }
    );
    
    if (!response.ok) throw new Error('CelesTrak API error');
    
    const data = await response.json<Array<{
      OBJECT_NAME: string;
      NORAD_CAT_ID: number;
      OBJECT_ID: string;
      TLE_LINE1: string;
      TLE_LINE2: string;
      MEAN_MOTION: number;
      INCLINATION: number;
    }>>();
    const satellites: SatelliteData[] = [];
    
    data.forEach((sat) => {
      // Calculate orbital parameters from TLE
      const meanMotion = sat.MEAN_MOTION;
      const period = 1440 / meanMotion; // minutes
      const altitude = Math.pow((398600.4418 * Math.pow(period * 60 / (2 * Math.PI), 2)), 1/3) - 6371; // km
      const velocity = Math.sqrt(398600.4418 / (6371 + altitude)); // km/s
      
      satellites.push({
        id: `celestrak-${sat.NORAD_CAT_ID}`,
        name: sat.OBJECT_NAME,
        noradId: sat.NORAD_CAT_ID,
        intlDesignator: sat.OBJECT_ID,
        type: categorizesSatellite(sat.OBJECT_NAME, category),
        altitude: Math.round(altitude),
        velocity: parseFloat(velocity.toFixed(2)),
        inclination: sat.INCLINATION,
        period: parseFloat(period.toFixed(1)),
        isVisible: false,
        tle: {
          line1: sat.TLE_LINE1,
          line2: sat.TLE_LINE2,
        },
        source: 'CelesTrak',
      });
    });
    
    return satellites;
  } catch (error) {
    logger.warn('Failed to fetch TLE from CelesTrak', error);
    return [];
  }
}

/**
 * Fetch satellite passes from N2YO API
 */
export async function fetchSatellitePasses(
  noradId: number,
  lat: number,
  lng: number,
  alt: number = 0,
  days: number = 2,
  minVisibility: number = 300,
  apiKey?: string
): Promise<SatellitePass[]> {
  if (!apiKey) {
    logger.warn('N2YO API key not provided');
    return [];
  }
  
  try {
    const response = await smartFetch(
      `https://api.n2yo.com/rest/v1/satellite/visualpasses/${noradId}/${lat}/${lng}/${alt}/${days}/${minVisibility}/&apiKey=${apiKey}`,
      {
        timeout: 30000,
        cachePolicy: 'astro-satellite-passes',
      }
    );
    
    if (!response.ok) throw new Error('N2YO API error');
    
    const data = await response.json<{
      info?: { satname?: string };
      passes?: Array<{
        startUTC: number;
        startAz: number;
        startEl: number;
        maxUTC: number;
        maxAz: number;
        maxEl: number;
        endUTC: number;
        endAz: number;
        endEl: number;
        mag: number;
        duration: number;
      }>;
    }>();
    const passes: SatellitePass[] = [];
    
    if (data.passes) {
      data.passes.forEach((pass) => {
        passes.push({
          satellite: {
            id: `n2yo-${noradId}`,
            name: data.info?.satname || `NORAD ${noradId}`,
            noradId: noradId,
            type: 'other',
            altitude: 0,
            velocity: 0,
            inclination: 0,
            period: 0,
            isVisible: true,
            source: 'N2YO',
          },
          startTime: new Date(pass.startUTC * 1000),
          maxTime: new Date(pass.maxUTC * 1000),
          endTime: new Date(pass.endUTC * 1000),
          startAz: pass.startAz,
          startEl: pass.startEl,
          maxAz: pass.maxAz,
          maxEl: pass.maxEl,
          endAz: pass.endAz,
          endEl: pass.endEl,
          magnitude: pass.mag,
          duration: pass.duration / 60,
          isVisible: pass.maxEl > 10,
        });
      });
    }
    
    return passes;
  } catch (error) {
    logger.warn('Failed to fetch passes from N2YO', error);
    return [];
  }
}

/**
 * Fetch ISS position in real-time
 */
export async function fetchISSPosition(): Promise<{ lat: number; lng: number; alt: number; velocity: number } | null> {
  try {
    const response = await smartFetch(
      'http://api.open-notify.org/iss-now.json',
      {
        timeout: 10000,
        allowHttp: true,
        cachePolicy: 'astro-iss-position',
      }
    );
    
    if (!response.ok) throw new Error('Open Notify API error');
    
    const data = await response.json<{ iss_position: { latitude: string; longitude: string } }>();
    
    return {
      lat: parseFloat(data.iss_position.latitude),
      lng: parseFloat(data.iss_position.longitude),
      alt: 420, // Approximate
      velocity: 7.66, // Approximate
    };
  } catch (error) {
    logger.warn('Failed to fetch ISS position', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getConstellationName(ra: number, dec: number): string {
  // Simplified constellation lookup based on RA/Dec
  if (ra >= 45 && ra < 60 && dec >= 50) return 'Perseus';
  if (ra >= 90 && ra < 120 && dec >= 20 && dec < 40) return 'Gemini';
  if (ra >= 140 && ra < 170 && dec >= 10 && dec < 30) return 'Leo';
  if (ra >= 200 && ra < 230 && dec >= 70) return 'Ursa Minor';
  if (ra >= 260 && ra < 280 && dec >= 30 && dec < 50) return 'Lyra';
  if (ra >= 330 && ra < 350 && dec >= -20 && dec < 10) return 'Aquarius';
  return 'the sky';
}

function categorizesSatellite(name: string, category: string): SatelliteData['type'] {
  const upperName = name.toUpperCase();
  
  if (upperName.includes('ISS') || upperName.includes('ZARYA') || upperName.includes('TIANGONG') || upperName.includes('CSS')) {
    return 'iss';
  }
  if (upperName.includes('STARLINK')) return 'starlink';
  if (upperName.includes('GPS') || upperName.includes('NAVSTAR') || upperName.includes('GLONASS') || upperName.includes('GALILEO') || upperName.includes('BEIDOU')) {
    return 'gps';
  }
  if (upperName.includes('NOAA') || upperName.includes('GOES') || upperName.includes('METEO') || upperName.includes('FENGYUN')) {
    return 'weather';
  }
  if (upperName.includes('INTELSAT') || upperName.includes('IRIDIUM') || upperName.includes('ORBCOMM')) {
    return 'communication';
  }
  if (upperName.includes('HUBBLE') || upperName.includes('CHANDRA') || upperName.includes('JWST') || upperName.includes('TERRA') || upperName.includes('AQUA')) {
    return 'scientific';
  }
  if (category === 'amateur') return 'amateur';
  
  return 'other';
}

// ============================================================================
// Planetary Events Fetcher (Astronomy API)
// ============================================================================

function toBase64(input: string): string {
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(input);
  }
  return Buffer.from(input, 'utf-8').toString('base64');
}

function normalizeAstronomyApiAuthToken(rawValue?: string): string | null {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith('basic ')) {
    const token = trimmed.slice('basic '.length).trim();
    return token.length > 0 ? token : null;
  }

  if (trimmed.includes(':')) {
    return toBase64(trimmed);
  }

  return trimmed;
}

function parseDateValue(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function formatAstronomyApiLabel(label: string): string {
  return label
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeAstronomyApiVisibility(eventType: string): AstroEvent['visibility'] {
  if (eventType.includes('total')) return 'excellent';
  if (eventType.includes('annular')) return 'good';
  if (eventType.includes('partial')) return 'fair';
  return 'fair';
}

/**
 * Fetch AstronomyAPI body events (currently eclipse-focused, Sun/Moon only)
 */
export async function fetchPlanetaryEvents(
  year: number,
  month: number,
  config?: { apiUrl?: string; apiKey?: string },
  observer?: AstroObserver
): Promise<AstroEvent[]> {
  const authToken = normalizeAstronomyApiAuthToken(config?.apiKey);
  if (!authToken) {
    logger.debug('Astronomy API credentials not configured, skipping source');
    return [];
  }

  const apiUrl = config?.apiUrl || 'https://api.astronomyapi.com/api/v2';

  try {
    const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;

    const lat = observer?.latitude ?? 0;
    const lon = observer?.longitude ?? 0;
    const elevation = observer?.elevation ?? 0;
    const bodies = ['sun', 'moon'] as const;
    const events: AstroEvent[] = [];

    for (const body of bodies) {
      const query = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        elevation: elevation.toString(),
        from_date: fromDate,
        to_date: toDate,
        time: '00:00:00',
        output: 'rows',
      });

      const response = await smartFetch(
        `${apiUrl}/bodies/events/${body}?${query.toString()}`,
        {
          timeout: 30000,
          cachePolicy: 'astro-body-events',
          headers: {
            Authorization: `Basic ${authToken}`,
          },
        }
      );
      if (!response.ok) throw new Error(`Astronomy API error: ${response.status}`);

      const data = await response.json<{
        data?: {
          rows?: Array<{
            body?: {
              id?: string;
              name?: string;
            };
            events?: Array<{
              type?: string;
              eventHighlights?: Record<string, { date?: string } | null>;
              rise?: string;
              set?: string;
              extraInfo?: unknown;
            }>;
          }>;
        };
      }>();

      const rows = data.data?.rows ?? [];
      rows.forEach((row, rowIndex) => {
        row.events?.forEach((eventItem, eventIndex) => {
          const rawType = eventItem.type ?? `${body}_event`;
          const eventType = rawType.toLowerCase();
          const highlightDates = Object.values(eventItem.eventHighlights ?? {})
            .map((highlight) => parseDateValue(highlight?.date))
            .filter((date): date is Date => Boolean(date))
            .sort((left, right) => left.getTime() - right.getTime());
          const peakDate = parseDateValue(eventItem.eventHighlights?.peak?.date);
          const startsAt = highlightDates[0] ?? peakDate ?? parseDateValue(eventItem.rise) ?? parseDateValue(eventItem.set);
          if (!startsAt) return;
          const endsAt = highlightDates.length > 0 ? highlightDates[highlightDates.length - 1] : undefined;
          const normalizedType = formatAstronomyApiLabel(eventType);
          const bodyLabel = row.body?.name ?? body.toUpperCase();

          events.push({
            id: `astronomyapi-${body}-${rowIndex}-${eventIndex}-${startsAt.toISOString()}`,
            type: 'eclipse',
            name: normalizedType.includes('Eclipse') ? normalizedType : `${normalizedType} (${bodyLabel})`,
            date: startsAt,
            endDate: endsAt && endsAt.getTime() > startsAt.getTime() ? endsAt : undefined,
            peakTime: peakDate,
            description: `${normalizedType} event for ${bodyLabel} from AstronomyAPI.`,
            visibility: normalizeAstronomyApiVisibility(eventType),
            source: 'Astronomy API',
            url: 'https://docs.astronomyapi.com/endpoints/bodies/events',
          });
        });
      });
    }

    return events.filter((event) => (
      event.date.getUTCFullYear() === year && event.date.getUTCMonth() === month
    ));
  } catch (error) {
    logger.warn('Failed to fetch from Astronomy API', error);
    return [];
  }
}

function eclipseKindToLabel(kind: EclipseKind): string {
  switch (kind) {
    case EclipseKind.Total:
      return 'Total';
    case EclipseKind.Annular:
      return 'Annular';
    case EclipseKind.Partial:
      return 'Partial';
    default:
      return 'Penumbral';
  }
}

function buildLocalCalculatedEvents(year: number, month: number): AstroEvent[] {
  const events: AstroEvent[] = [];
  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  let moonQuarter = SearchMoonQuarter(new Date(monthStart.getTime() - 5 * 86400000));
  for (let guard = 0; guard < 16; guard += 1) {
    const date = moonQuarter.time.date;
    if (date > monthEnd) break;
    if (date >= monthStart && date <= monthEnd) {
      const phaseName = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'][moonQuarter.quarter % 4] || 'Moon Phase';
      events.push({
        id: `local-moon-quarter-${moonQuarter.time.ut.toFixed(6)}`,
        type: 'lunar_phase',
        name: phaseName,
        date: new Date(date),
        description: `${phaseName} (computed with Astronomy Engine).`,
        visibility: phaseName === 'New Moon' ? 'excellent' : 'good',
        source: 'Local Calculation',
      });
    }
    moonQuarter = NextMoonQuarter(moonQuarter);
  }

  try {
    const seasons = Seasons(year);
    const seasonEvents: Array<{ key: string; date: Date }> = [
      { key: 'March Equinox', date: new Date(seasons.mar_equinox.date) },
      { key: 'June Solstice', date: new Date(seasons.jun_solstice.date) },
      { key: 'September Equinox', date: new Date(seasons.sep_equinox.date) },
      { key: 'December Solstice', date: new Date(seasons.dec_solstice.date) },
    ];
    seasonEvents.forEach((seasonEvent) => {
      if (seasonEvent.date >= monthStart && seasonEvent.date <= monthEnd) {
        events.push({
          id: `local-season-${seasonEvent.key.toLowerCase().replace(/\s+/g, '-')}-${seasonEvent.date.toISOString()}`,
          type: 'equinox_solstice',
          name: seasonEvent.key,
          date: seasonEvent.date,
          description: `${seasonEvent.key} computed with Astronomy Engine.`,
          visibility: 'good',
          source: 'Local Calculation',
        });
      }
    });
  } catch (error) {
    logger.debug('Local seasons calculation failed', error);
  }

  try {
    let solar = SearchGlobalSolarEclipse(new Date(monthStart.getTime() - 45 * 86400000));
    for (let guard = 0; guard < 8; guard += 1) {
      const peakDate = solar.peak.date;
      if (peakDate > monthEnd) break;
      if (peakDate >= monthStart && peakDate <= monthEnd) {
        const label = eclipseKindToLabel(solar.kind);
        events.push({
          id: `local-solar-eclipse-${solar.peak.ut.toFixed(6)}`,
          type: 'eclipse',
          name: `${label} Solar Eclipse`,
          date: new Date(peakDate),
          description: `${label} solar eclipse computed locally.`,
          visibility: normalizeEclipseVisibility(label),
          source: 'Local Calculation',
        });
      }
      solar = NextGlobalSolarEclipse(solar.peak);
    }
  } catch (error) {
    logger.debug('Local solar eclipse calculation failed', error);
  }

  try {
    let lunar = SearchLunarEclipse(new Date(monthStart.getTime() - 45 * 86400000));
    for (let guard = 0; guard < 8; guard += 1) {
      const peakDate = lunar.peak.date;
      if (peakDate > monthEnd) break;
      if (peakDate >= monthStart && peakDate <= monthEnd) {
        const label = eclipseKindToLabel(lunar.kind);
        events.push({
          id: `local-lunar-eclipse-${lunar.peak.ut.toFixed(6)}`,
          type: 'eclipse',
          name: `${label} Lunar Eclipse`,
          date: new Date(peakDate),
          description: `${label} lunar eclipse computed locally.`,
          visibility: normalizeEclipseVisibility(label),
          source: 'Local Calculation',
        });
      }
      lunar = NextLunarEclipse(lunar.peak);
    }
  } catch (error) {
    logger.debug('Local lunar eclipse calculation failed', error);
  }

  const oppositionTargets: Array<{ body: Body; name: string; type: EventType }> = [
    { body: Body.Mercury, name: 'Mercury', type: 'planet_conjunction' },
    { body: Body.Venus, name: 'Venus', type: 'planet_conjunction' },
    { body: Body.Mars, name: 'Mars', type: 'planet_opposition' },
    { body: Body.Jupiter, name: 'Jupiter', type: 'planet_opposition' },
    { body: Body.Saturn, name: 'Saturn', type: 'planet_opposition' },
  ];

  oppositionTargets.forEach((target) => {
    let cursor = new Date(monthStart.getTime() - 10 * 86400000);
    for (let guard = 0; guard < 16; guard += 1) {
      const event = SearchRelativeLongitude(target.body, 0, cursor);
      const foundDate = event.date;
      if (foundDate > monthEnd) break;
      if (foundDate >= monthStart && foundDate <= monthEnd) {
        events.push({
          id: `local-${target.name.toLowerCase()}-${event.ut.toFixed(6)}`,
          type: target.type,
          name: target.type === 'planet_opposition' ? `${target.name} Opposition` : `${target.name} Conjunction`,
          date: new Date(foundDate),
          description: `${target.name} ${target.type === 'planet_opposition' ? 'opposition' : 'conjunction'} computed locally.`,
          visibility: 'good',
          source: 'Local Calculation',
        });
      }
      cursor = new Date(foundDate.getTime() + 3 * 86400000);
    }
  });

  [Body.Mercury, Body.Venus].forEach((innerBody) => {
    let cursor = new Date(monthStart.getTime() - 10 * 86400000);
    for (let guard = 0; guard < 8; guard += 1) {
      const event = SearchMaxElongation(innerBody, cursor);
      const foundDate = event.time.date;
      if (foundDate > monthEnd) break;
      if (foundDate >= monthStart && foundDate <= monthEnd) {
        const planetName = innerBody === Body.Mercury ? 'Mercury' : 'Venus';
        events.push({
          id: `local-${planetName.toLowerCase()}-elongation-${event.time.ut.toFixed(6)}`,
          type: 'planet_elongation',
          name: `${planetName} Maximum Elongation`,
          date: new Date(foundDate),
          description: `${planetName} maximum elongation ${event.elongation.toFixed(1)}° (${event.visibility}).`,
          visibility: 'good',
          source: 'Local Calculation',
        });
      }
      cursor = new Date(foundDate.getTime() + 7 * 86400000);
    }
  });

  return events.sort((left, right) => left.date.getTime() - right.date.getTime());
}

export async function fetchLocalCalculatedEvents(year: number, month: number): Promise<AstroEvent[]> {
  return buildLocalCalculatedEvents(year, month);
}

// ============================================================================
// Aggregated Data Fetchers
// ============================================================================

/**
 * Source ID to fetcher mapping
 */
type SourceFetcher = (
  year: number,
  month: number,
  config?: EventSourceConfig,
  observer?: AstroObserver
) => Promise<AstroEvent[]>;

const SOURCE_FETCHERS: Record<string, SourceFetcher> = {
  usno: (year, month) => fetchLunarPhases(year, month),
  imo: (year, month) => fetchMeteorShowers(year, month),
  nasa: (year, month) => fetchEclipses(year, month),
  mpc: (year, month) => fetchComets(year, month),
  local: (year, month) => fetchLocalCalculatedEvents(year, month),
  astronomyapi: (year, month, config, observer) =>
    fetchPlanetaryEvents(year, month, {
      apiUrl: config?.apiUrl,
      apiKey: config?.apiKey,
    }, observer),
};

function normalizeSources(
  sourcesOrIds?: EventSourceConfig[] | string[]
): Array<{ id: string; apiUrl?: string; apiKey?: string; priority?: number }> {
  if (!sourcesOrIds || sourcesOrIds.length === 0) {
    return DEFAULT_ASTRO_SOURCES.map((id, index) => ({ id, priority: index + 1 }));
  }

  if (typeof sourcesOrIds[0] === 'string') {
    return (sourcesOrIds as string[]).map((id, index) => ({ id, priority: index + 1 }));
  }

  return (sourcesOrIds as EventSourceConfig[])
    .filter((source) => source.enabled)
    .sort((left, right) => left.priority - right.priority);
}

function monthStartsBetween(startDate: Date, endDate: Date): Date[] {
  const starts: Date[] = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
  while (cursor <= lastMonthStart) {
    starts.push(new Date(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return starts;
}

function eventSemanticKey(event: AstroEvent): string {
  const minuteKey = event.date.toISOString().slice(0, 16);
  const endMinuteKey = (event.endDate ?? event.date).toISOString().slice(0, 16);
  const normalizedName = event.name.trim().toLowerCase();
  return `${event.type}|${normalizedName}|${minuteKey}|${endMinuteKey}`;
}

function eventCompletenessScore(event: AstroEvent): number {
  let score = 0;
  if (event.endDate) score += 2;
  if (event.peakTime) score += 2;
  if (event.ra !== undefined) score += 1;
  if (event.dec !== undefined) score += 1;
  if (event.magnitude !== undefined) score += 1;
  if (event.url) score += 1;
  return score;
}

function eventSourcePriority(event: AstroEvent, priorityMap: Record<string, number>): number {
  return priorityMap[sourceIdFromEvent(event.source)] ?? 99;
}

function mergeEventData(primary: AstroEvent, secondary: AstroEvent): AstroEvent {
  return {
    ...primary,
    endDate: primary.endDate ?? secondary.endDate,
    peakTime: primary.peakTime ?? secondary.peakTime,
    ra: primary.ra ?? secondary.ra,
    dec: primary.dec ?? secondary.dec,
    magnitude: primary.magnitude ?? secondary.magnitude,
    url: primary.url ?? secondary.url,
    description: primary.description?.trim().length > 0 ? primary.description : secondary.description,
  };
}

function dedupeEvents(events: AstroEvent[], priorityMap: Record<string, number>): AstroEvent[] {
  const deduped = new Map<string, AstroEvent>();
  for (const event of events) {
    const key = eventSemanticKey(event);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, event);
      continue;
    }

    const existingPriority = eventSourcePriority(existing, priorityMap);
    const incomingPriority = eventSourcePriority(event, priorityMap);
    const existingScore = eventCompletenessScore(existing);
    const incomingScore = eventCompletenessScore(event);
    const incomingPreferred = incomingPriority < existingPriority
      || (incomingPriority === existingPriority && incomingScore > existingScore);

    if (incomingPreferred) {
      deduped.set(key, mergeEventData(event, existing));
    } else {
      deduped.set(key, mergeEventData(existing, event));
    }
  }
  return Array.from(deduped.values());
}

function eventWindowForRange(event: AstroEvent): { startsAt: Date; endsAt: Date } {
  const startsAt = event.date;
  const endsAt = event.endDate ?? event.date;
  return { startsAt, endsAt };
}

export async function fetchAstroEventsInRange(
  params: FetchAstroEventsInRangeParams
): Promise<AstroEvent[]> {
  const {
    startDate,
    endDate,
    observer,
    includeOngoing = true,
    sourcesOrIds,
  } = params;
  const normalizedSources = normalizeSources(sourcesOrIds);
  const priorityMap = normalizedSources.reduce<Record<string, number>>((acc, source, index) => {
    acc[source.id] = source.priority ?? index + 1;
    return acc;
  }, {});
  const months = monthStartsBetween(startDate, endDate);
  const fetchTasks: Array<Promise<AstroEvent[]>> = [];

  for (const source of normalizedSources) {
    const fetcher = SOURCE_FETCHERS[source.id];
    if (!fetcher) continue;
    for (const monthStart of months) {
      const year = monthStart.getUTCFullYear();
      const month = monthStart.getUTCMonth();
      fetchTasks.push(
        fetcher(year, month, source as EventSourceConfig, observer).catch((error) => {
          logger.warn(`Failed to fetch from source ${source.id}`, error);
          return [] as AstroEvent[];
        })
      );
    }
  }

  const settled = await Promise.allSettled(fetchTasks);
  const mergedEvents: AstroEvent[] = [];
  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      mergedEvents.push(...result.value);
    }
  });

  const filtered = dedupeEvents(mergedEvents, priorityMap).filter((event) => {
    const { startsAt, endsAt } = eventWindowForRange(event);
    if (includeOngoing) {
      return startsAt <= endDate && endsAt >= startDate;
    }
    return startsAt >= startDate && startsAt <= endDate;
  });

  filtered.sort((left, right) => left.date.getTime() - right.date.getTime());
  return filtered;
}

function inferDailyStatus(
  occurrenceMode: EventOccurrenceMode,
  selectedDateKey: string,
  startsAt: Date,
  endsAt: Date | undefined,
  timezone: string
): DailyEventStatus {
  if (occurrenceMode === 'instant') return 'upcoming_today';
  if (!endsAt) return 'ongoing';
  const endKey = getLocalDateKey(endsAt, timezone);
  if (selectedDateKey === endKey) return 'ended_today';
  const startKey = getLocalDateKey(startsAt, timezone);
  if (selectedDateKey === startKey) return 'ongoing';
  return 'ongoing';
}

function dateKeyInRange(key: string, startKey: string, endKey: string): boolean {
  return key >= startKey && key <= endKey;
}

export async function fetchDailyAstroEvents(
  params: FetchDailyAstroEventsParams
): Promise<DailyAstroEventsResult> {
  const {
    date,
    observer,
    includeOngoing = true,
    sourcesOrIds,
    timezone,
  } = params;
  const resolvedTimezone = resolveObserverTimezone(observer, timezone);
  const selectedDateKey = getLocalDateKey(date, resolvedTimezone);
  const selectedYear = date.getFullYear();
  const selectedMonth = date.getMonth();
  const selectedDay = date.getDate();

  // Expand search by one day on each side to avoid timezone-boundary misses.
  const searchStart = new Date(Date.UTC(selectedYear, selectedMonth, selectedDay - 1, 0, 0, 0, 0));
  const searchEnd = new Date(Date.UTC(selectedYear, selectedMonth, selectedDay + 1, 23, 59, 59, 999));

  const events = await fetchAstroEventsInRange({
    startDate: searchStart,
    endDate: searchEnd,
    observer,
    includeOngoing,
    sourcesOrIds,
    timezone: resolvedTimezone,
  });

  const priorityMap = sourcePriorityMap(
    Array.isArray(sourcesOrIds) && sourcesOrIds.length > 0 && typeof sourcesOrIds[0] !== 'string'
      ? sourcesOrIds as EventSourceConfig[]
      : []
  );

  const dailyEvents: DailyAstroEvent[] = events
    .map((event) => {
      const startsAt = event.date;
      const endsAt = event.endDate;
      const startKey = getLocalDateKey(startsAt, resolvedTimezone);
      const endKey = getLocalDateKey(endsAt ?? startsAt, resolvedTimezone);
      const occurrenceMode: EventOccurrenceMode = endsAt ? 'window' : 'instant';
      return {
        ...event,
        startsAt,
        endsAt,
        occurrenceMode,
        localDateKey: selectedDateKey,
        statusOnSelectedDay: inferDailyStatus(
          occurrenceMode,
          selectedDateKey,
          startsAt,
          endsAt,
          resolvedTimezone
        ),
        sourcePriority: priorityMap[sourceIdFromEvent(event.source)] ?? 99,
        _startKey: startKey,
        _endKey: endKey,
      } as DailyAstroEvent & { _startKey: string; _endKey: string };
    })
    .filter((event) => {
      if (event.occurrenceMode === 'instant') {
        return event._startKey === selectedDateKey;
      }
      return dateKeyInRange(selectedDateKey, event._startKey, event._endKey);
    })
    .map(({ _startKey: _ignoreStartKey, _endKey: _ignoreEndKey, ...event }) => event)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const sourceBreakdown = dailyEvents.reduce<Record<string, number>>((acc, event) => {
    acc[event.source] = (acc[event.source] ?? 0) + 1;
    return acc;
  }, {});

  return {
    date,
    timezone: resolvedTimezone,
    events: dailyEvents,
    fetchedAt: new Date(),
    sourceBreakdown,
  };
}

/**
 * Fetch all astronomical events for a given month from multiple sources
 * @param year - Calendar year
 * @param month - 0-indexed month
 * @param sourcesOrIds - Either EventSourceConfig[] from store or legacy string[] of source IDs
 */
export async function fetchAllAstroEvents(
  year: number,
  month: number,
  sourcesOrIds?: EventSourceConfig[] | string[]
): Promise<AstroEvent[]> {
  const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return fetchAstroEventsInRange({
    startDate,
    endDate,
    observer: { latitude: 0, longitude: 0, elevation: 0 },
    includeOngoing: true,
    sourcesOrIds,
  });
}

/**
 * Fetch all satellites from multiple sources
 */
export async function fetchAllSatellites(
  categories: string[] = ['stations', 'visual', 'starlink']
): Promise<SatelliteData[]> {
  const allSatellites: SatelliteData[] = [];
  const seenIds = new Set<number>();
  
  const fetchPromises = categories.map(cat => fetchSatelliteTLE(cat));
  const results = await Promise.allSettled(fetchPromises);
  
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      result.value.forEach(sat => {
        if (!seenIds.has(sat.noradId)) {
          seenIds.add(sat.noradId);
          allSatellites.push(sat);
        }
      });
    }
  });
  
  // Sort by name
  allSatellites.sort((a, b) => a.name.localeCompare(b.name));
  
  return allSatellites;
}
