/**
 * JPL Horizons ephemeris service.
 *
 * Fetches solar-system body ephemerides from the JPL Horizons REST API via
 * `smartFetch`, which in Tauri routes through the Rust HTTP client (bypassing
 * the browser CORS that Horizons does not send) and applies the shared
 * `horizons-ephemeris` cache policy. Parsing is delegated to the pure
 * `parseHorizonsResult`.
 */

import { smartFetch } from '@/lib/services/http-fetch';
import { createLogger } from '@/lib/logger';
import { parseHorizonsResult } from './parser';
import type { HorizonsEphemeris, HorizonsQuery } from './types';

const logger = createLogger('horizons-service');

const HORIZONS_API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Default observer center: geocentric (Earth body center). */
const DEFAULT_CENTER = '500@399';

/** Common body name → Horizons COMMAND id. */
const BODY_COMMANDS: Record<string, string> = {
  sun: '10',
  moon: '301',
  mercury: '199',
  venus: '299',
  mars: '499',
  jupiter: '599',
  saturn: '699',
  uranus: '799',
  neptune: '899',
  pluto: '999',
};

/**
 * Map a body name to a Horizons COMMAND. Known major bodies resolve to their
 * NAIF id; anything else (a numeric id, `DES=...` designation, etc.) passes
 * through unchanged.
 */
export function resolveHorizonsCommand(body: string): string {
  return BODY_COMMANDS[body.trim().toLowerCase()] ?? body;
}

/**
 * Return the canonical major-body name (Sun/Moon/planet) from a list of object
 * designations, or null if none match. Used to decide whether to offer a JPL
 * high-precision position for the selected object.
 */
export function findHorizonsBody(names: string[]): string | null {
  for (const name of names) {
    // Engine designations prefix common names ("NAME Jupiter") — strip it so
    // canvas-clicked planets resolve, not just typed searches.
    const key = name.trim().replace(/^NAME\s+/i, '').toLowerCase();
    if (key in BODY_COMMANDS) {
      return key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
  return null;
}

function buildUrl(query: HorizonsQuery): { url: string; command: string } {
  const command = resolveHorizonsCommand(query.body);
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${command}'`,
    EPHEM_TYPE: 'OBSERVER',
    CENTER: `'${query.center ?? DEFAULT_CENTER}'`,
    START_TIME: `'${query.start}'`,
    STOP_TIME: `'${query.stop}'`,
    STEP_SIZE: `'${query.step}'`,
    QUANTITIES: "'1,4,9'",
    CSV_FORMAT: 'YES',
    ANG_FORMAT: 'DEG',
  });
  return { url: `${HORIZONS_API}?${params.toString()}`, command };
}

/**
 * Fetch and parse a Horizons OBSERVER ephemeris for a body over a time range.
 * Throws on a non-ok HTTP response.
 */
export async function fetchHorizonsEphemeris(query: HorizonsQuery): Promise<HorizonsEphemeris> {
  const { url, command } = buildUrl(query);
  const center = query.center ?? DEFAULT_CENTER;

  const response = await smartFetch(url, {
    method: 'GET',
    timeout: 30000,
    cachePolicy: 'horizons-ephemeris',
  });

  if (!response.ok) {
    logger.warn('Horizons request failed', { status: response.status, command });
    throw new Error(`Horizons API error: ${response.status}`);
  }

  const data = await response.json<{ result?: string }>();
  const rows = parseHorizonsResult(data.result ?? '');

  return { body: command, center, rows };
}
