import { parseMinorIdentifier } from '../object-resolver/parser/minor-parser';
import type { EngineBody } from '../engine/types';
import type { TargetKindDetection } from './types';

/**
 * Solar-system bodies the local ephemeris (astronomy-engine) can propagate,
 * keyed by the lowercase designation after stripping the "NAME " prefix that
 * Stellarium Web Engine puts on common names (e.g. "NAME Jupiter").
 */
const SOLAR_SYSTEM_BODIES: Record<string, EngineBody> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

/** SWE otype codes / plain words that mark an artificial satellite. */
const SATELLITE_TYPE_HINTS = /^(asa|satellite|artificial)/i;
/** Type strings that mark a comet or asteroid (SWE otypes Com/MPl/Ast included). */
const MINOR_TYPE_HINTS = /^(com(et)?$|mpl$|ast(eroid)?$|minor)/i;

const stripNamePrefix = (name: string): string => name.trim().replace(/^NAME\s+/i, '');

const matchesMinorIdentifier = (designation: string): boolean => {
  // Comet designations from the engine often carry a trailing common name,
  // e.g. "C/2020 F3 (NEOWISE)" — retry without it.
  const candidates = [designation, designation.replace(/\s*\([^)]*\)\s*$/, '')];
  for (const candidate of candidates) {
    const parsed = parseMinorIdentifier(candidate);
    // A bare number parses as a numbered asteroid, but bare numbers also occur
    // in unrelated designations — only trust the explicit "(N)" form.
    if (parsed && (parsed.kind !== 'numbered' || candidate.trim().startsWith('('))) {
      return true;
    }
  }
  return false;
};

/**
 * Classify a selected object from its engine designations plus optional type
 * hints (SelectedObjectData.type and the async objectInfo.typeCategory).
 * Falls back to `fixed` — i.e. today's behavior — whenever unsure, so a
 * detection miss is never a regression.
 */
export function detectTargetKind(
  names: readonly string[],
  typeHint?: string | null,
  typeCategory?: string | null,
): TargetKindDetection {
  // Satellites: the bundled TLE layer designates them as "NORAD <id>".
  for (const name of names) {
    const noradMatch = name.trim().match(/^NORAD\s+(\d+)$/i);
    if (noradMatch) {
      return { kind: 'satellite', body: null, noradId: Number.parseInt(noradMatch[1], 10) };
    }
  }
  if (typeCategory === 'artificial' || (typeHint && SATELLITE_TYPE_HINTS.test(typeHint.trim()))) {
    return { kind: 'satellite', body: null, noradId: null };
  }

  for (const name of names) {
    const body = SOLAR_SYSTEM_BODIES[stripNamePrefix(name).toLowerCase()];
    if (body) {
      return { kind: 'solar_system', body, noradId: null };
    }
  }

  if (
    typeCategory === 'comet'
    || typeCategory === 'asteroid'
    || (typeHint && MINOR_TYPE_HINTS.test(typeHint.trim()))
    || names.some((name) => matchesMinorIdentifier(stripNamePrefix(name)))
  ) {
    return { kind: 'minor_body', body: null, noradId: null };
  }

  return { kind: 'fixed', body: null, noradId: null };
}
