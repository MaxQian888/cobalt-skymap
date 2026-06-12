import type { HorizonsRow } from './types';

/**
 * Parse the `result` text block returned by the JPL Horizons API.
 *
 * Pure function — no network. Expects the ephemeris to have been requested with
 * CSV_FORMAT=YES and ANG_FORMAT=DEG so the data rows between the `$$SOE` and
 * `$$EOE` markers are comma-separated with RA/Dec in decimal degrees. Columns are
 * located by matching the CSV header line (robust to Horizons' leading
 * solar/lunar presence flag columns), with the timestamp always first.
 */
export function parseHorizonsResult(result: string): HorizonsRow[] {
  const soe = result.indexOf('$$SOE');
  const eoe = result.indexOf('$$EOE');
  if (soe === -1 || eoe === -1 || eoe < soe) return [];

  const headerLine = result
    .slice(0, soe)
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.includes('R.A.') && line.includes('DEC'));
  if (!headerLine) return [];

  const cols = headerLine.split(',').map((c) => c.trim());
  const idxOf = (pred: (c: string) => boolean) => cols.findIndex(pred);
  const raIdx = idxOf((c) => c.includes('R.A.'));
  const decIdx = idxOf((c) => c.includes('DEC'));
  const azIdx = idxOf((c) => c.includes('Azi'));
  const elIdx = idxOf((c) => c.includes('Elev'));
  const magIdx = idxOf((c) => c.includes('APmag') || c.includes('mag'));
  if (raIdx === -1 || decIdx === -1) return [];

  const safeFloat = (v: string | undefined): number | undefined => {
    if (v === undefined) return undefined;
    const n = Number.parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  };

  const rows: HorizonsRow[] = [];
  for (const line of result.slice(soe + '$$SOE'.length, eoe).split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split(',').map((c) => c.trim());
    const raDeg = safeFloat(parts[raIdx]);
    const decDeg = safeFloat(parts[decIdx]);
    if (raDeg === undefined || decDeg === undefined) continue;

    rows.push({
      timeUtc: parts[0] ?? '',
      raDeg,
      decDeg,
      azDeg: azIdx >= 0 ? safeFloat(parts[azIdx]) : undefined,
      elDeg: elIdx >= 0 ? safeFloat(parts[elIdx]) : undefined,
      vMag: magIdx >= 0 ? safeFloat(parts[magIdx]) : undefined,
    });
  }
  return rows;
}
