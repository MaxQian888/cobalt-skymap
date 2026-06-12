/**
 * JPL Horizons ephemeris types.
 *
 * Populated from the OBSERVER ephemeris API (ssd.jpl.nasa.gov/api/horizons.api)
 * requested with CSV_FORMAT=YES, ANG_FORMAT=DEG, QUANTITIES='1,4,9'.
 */

export interface HorizonsRow {
  /** UT timestamp as returned by Horizons, e.g. "2026-Jun-12 00:00". */
  timeUtc: string;
  /** Astrometric Right Ascension (ICRF), decimal degrees. */
  raDeg: number;
  /** Astrometric Declination (ICRF), decimal degrees. */
  decDeg: number;
  /** Apparent azimuth, decimal degrees (if requested/available). */
  azDeg?: number;
  /** Apparent elevation, decimal degrees (if requested/available). */
  elDeg?: number;
  /** Visual magnitude (APmag) if available. */
  vMag?: number;
}

export interface HorizonsEphemeris {
  /** Horizons COMMAND used for the target body. */
  body: string;
  /** Observer center used for the query (e.g. coordinate site or '500@399'). */
  center: string;
  rows: HorizonsRow[];
}

export interface HorizonsQuery {
  /** Object name or NAIF/designation; mapped to a Horizons COMMAND. */
  body: string;
  /** Observer center; defaults to geocentric '500@399' if omitted. */
  center?: string;
  /** START_TIME, e.g. '2026-06-12'. */
  start: string;
  /** STOP_TIME, e.g. '2026-06-13'. */
  stop: string;
  /** STEP_SIZE, e.g. '1 h' or '10 m'. */
  step: string;
}
