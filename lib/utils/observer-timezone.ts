import tzLookup from 'tz-lookup';
import type { Coordinates } from '@/lib/services/map-providers/base-map-provider';

export interface ResolveTimezoneOptions {
  explicitTimezone?: string;
  systemTimezone?: string;
}

export function isValidTimezone(timezone?: string | null): timezone is string {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function guessTimezoneFromLongitude(longitude: number): string | null {
  if (!Number.isFinite(longitude)) return null;

  const utcOffset = Math.round(longitude / 15);
  if (utcOffset < -12 || utcOffset > 14) return null;
  if (utcOffset === 0) return 'Etc/UTC';

  const ianaOffset = utcOffset > 0
    ? `Etc/GMT-${utcOffset}`
    : `Etc/GMT+${Math.abs(utcOffset)}`;

  return isValidTimezone(ianaOffset) ? ianaOffset : null;
}

export function lookupTimezoneFromCoordinates(coordinates: Coordinates): string | null {
  if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
    return null;
  }

  try {
    const timezone = tzLookup(coordinates.latitude, coordinates.longitude);
    return isValidTimezone(timezone) ? timezone : null;
  } catch {
    return null;
  }
}

export function resolveTimezoneFromCoordinates(
  coordinates: Coordinates,
  options: ResolveTimezoneOptions = {}
): string {
  const { explicitTimezone, systemTimezone } = options;

  if (isValidTimezone(explicitTimezone)) {
    return explicitTimezone;
  }

  const coordinateLookup = lookupTimezoneFromCoordinates(coordinates);
  if (coordinateLookup) {
    return coordinateLookup;
  }

  const guessed = guessTimezoneFromLongitude(coordinates.longitude);
  if (guessed) {
    return guessed;
  }

  const resolvedSystemTimezone = systemTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (isValidTimezone(resolvedSystemTimezone)) {
    return resolvedSystemTimezone;
  }

  return 'Etc/UTC';
}
