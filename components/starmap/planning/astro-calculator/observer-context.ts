import { serializeCacheKey } from '@/lib/astronomy/engine';
import { resolveTimezoneFromCoordinates } from '@/lib/utils/observer-timezone';
import type { ObservationLocation } from '@/lib/tauri/types';

export type MoonInterferenceMode = 'any' | 'low' | 'moderate' | 'strict';

type AstroCalculatorObserverLocation = Pick<
  ObservationLocation,
  'id' | 'name' | 'latitude' | 'longitude' | 'altitude' | 'timezone'
>;

export interface AstroCalculatorObserverConstraints {
  minAltitude: number;
  moonInterference: MoonInterferenceMode;
  horizonProfileId?: string | null;
}

export interface AstroCalculatorObserverContext {
  locationId?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  sharedDate: string;
  sharedTime: string;
  constraints: AstroCalculatorObserverConstraints;
  source: 'saved-location' | 'profile';
  contextKey: string;
}

export interface AstroCalculatorObserverContextInput {
  currentLocation?: AstroCalculatorObserverLocation | null;
  profileInfo?: {
    AstrometrySettings?: {
      Latitude?: number;
      Longitude?: number;
      Elevation?: number;
    };
  } | null;
  sharedDate: string;
  sharedTime: string;
  constraints?: Partial<AstroCalculatorObserverConstraints>;
}

export const DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS: AstroCalculatorObserverConstraints = {
  minAltitude: 0,
  moonInterference: 'any',
  horizonProfileId: null,
};

export function buildAstroCalculatorObserverContext({
  currentLocation,
  profileInfo,
  sharedDate,
  sharedTime,
  constraints,
}: AstroCalculatorObserverContextInput): AstroCalculatorObserverContext {
  const profileSettings = profileInfo?.AstrometrySettings;
  const latitude = currentLocation?.latitude ?? profileSettings?.Latitude ?? 0;
  const longitude = currentLocation?.longitude ?? profileSettings?.Longitude ?? 0;
  const elevation = currentLocation?.altitude ?? profileSettings?.Elevation ?? 0;
  const timezone = currentLocation?.timezone
    ?? resolveTimezoneFromCoordinates({ latitude, longitude });
  const mergedConstraints: AstroCalculatorObserverConstraints = {
    ...DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS,
    ...constraints,
  };
  const source = currentLocation ? 'saved-location' : 'profile';
  const locationName = currentLocation?.name ?? 'Current site';
  const locationId = currentLocation?.id;

  return {
    locationId,
    locationName,
    latitude,
    longitude,
    elevation,
    timezone,
    sharedDate,
    sharedTime,
    constraints: mergedConstraints,
    source,
    contextKey: serializeCacheKey({
      locationId: locationId ?? null,
      locationName,
      latitude,
      longitude,
      elevation,
      timezone,
      sharedDate,
      sharedTime,
      constraints: mergedConstraints,
      source,
    }),
  };
}
