import { findPotentialDuplicateLocation } from '@/lib/core/management-validators';
import { isTauri } from '@/lib/storage/platform';
import { useMountStore } from '@/lib/stores/mount-store';
import { useWebLocationStore } from '@/lib/stores/web-location-store';
import { tauriApi } from '@/lib/tauri';
import type { ObservationLocation } from '@/lib/tauri/types';
import type { WebLocation } from '@/types/starmap/management';
import {
  clearStoredLocation,
  isValidLocation,
  loadStoredLocation,
} from '@/lib/utils/observer-location';

export interface CanonicalObservationLocationInput {
  latitude: number;
  longitude: number;
  altitude?: number;
  name?: string;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
}

interface LocationLike {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
  is_current?: boolean;
  is_default?: boolean;
}

export interface CanonicalObservationLocationResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
  is_current: boolean;
  is_default: boolean;
}

export interface LegacyMigrationResult {
  status: 'migrated' | 'skipped';
  location?: CanonicalObservationLocationResult | null;
}

function pickDeterministicCurrent<T extends LocationLike>(
  locations: T[],
  preferredId?: string,
): T | null {
  if (!locations.length) return null;
  if (preferredId) {
    const preferred = locations.find((location) => location.id === preferredId);
    if (preferred) return preferred;
  }
  return (
    locations.find((location) => location.is_current)
    ?? locations.find((location) => location.is_default)
    ?? locations[0]
  );
}

function buildFallbackName(input: CanonicalObservationLocationInput): string {
  const trimmedName = input.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }
  return `Location ${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`;
}

export function syncObservationLocationToMountProfile(
  location: Pick<LocationLike, 'latitude' | 'longitude' | 'altitude'>,
): void {
  const currentProfile = useMountStore.getState().profileInfo;
  useMountStore.getState().setProfileInfo({
    ...currentProfile,
    AstrometrySettings: {
      ...currentProfile.AstrometrySettings,
      Latitude: location.latitude,
      Longitude: location.longitude,
      Elevation: location.altitude,
    },
  });
}

function toCanonicalResult(location: LocationLike | null): CanonicalObservationLocationResult | null {
  if (!location) return null;
  return {
    id: location.id,
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
    timezone: location.timezone,
    notes: location.notes,
    bortle_class: location.bortle_class,
    is_current: Boolean(location.is_current),
    is_default: Boolean(location.is_default),
  };
}

function mergeWithExistingLocation<T extends LocationLike>(
  existing: T,
  input: CanonicalObservationLocationInput,
): T {
  const mergedName = input.name?.trim();
  return {
    ...existing,
    ...(mergedName ? { name: mergedName } : {}),
    latitude: input.latitude,
    longitude: input.longitude,
    altitude: input.altitude ?? 0,
    ...(input.timezone !== undefined ? { timezone: input.timezone || undefined } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || undefined } : {}),
    ...(input.bortle_class !== undefined ? { bortle_class: input.bortle_class } : {}),
  };
}

function toPartialLocationUpdate(
  input: CanonicalObservationLocationInput,
): Partial<Omit<WebLocation, 'id'>> {
  return {
    latitude: input.latitude,
    longitude: input.longitude,
    altitude: input.altitude ?? 0,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone || undefined } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || undefined } : {}),
    ...(input.bortle_class !== undefined ? { bortle_class: input.bortle_class } : {}),
  };
}

async function loadCanonicalState(): Promise<{
  locations: LocationLike[];
  current: LocationLike | null;
}> {
  if (isTauri()) {
    const [data, current] = await Promise.all([
      tauriApi.locations.load(),
      tauriApi.locations.getCurrent().catch(() => null),
    ]);

    return {
      locations: data.locations,
      current: current ?? pickDeterministicCurrent(data.locations, data.current_location_id),
    };
  }

  const locations = useWebLocationStore.getState().locations;
  return {
    locations,
    current: pickDeterministicCurrent(locations),
  };
}

export async function resolveCanonicalObservationLocation(): Promise<CanonicalObservationLocationResult | null> {
  const state = await loadCanonicalState();
  return toCanonicalResult(state.current);
}

export async function applyCanonicalObservationLocation(
  input: CanonicalObservationLocationInput,
): Promise<CanonicalObservationLocationResult | null> {
  const normalizedInput: CanonicalObservationLocationInput = {
    ...input,
    altitude: input.altitude ?? 0,
  };

  const state = await loadCanonicalState();
  const current = state.current;

  if (isTauri()) {
    if (current) {
      const updated = mergeWithExistingLocation(current as ObservationLocation, normalizedInput);
      await tauriApi.locations.update(updated);
      syncObservationLocationToMountProfile(updated);
      return toCanonicalResult(updated);
    }

    const result = await tauriApi.locations.add({
      name: buildFallbackName(normalizedInput),
      latitude: normalizedInput.latitude,
      longitude: normalizedInput.longitude,
      altitude: normalizedInput.altitude ?? 0,
      timezone: normalizedInput.timezone,
      notes: normalizedInput.notes,
      bortle_class: normalizedInput.bortle_class,
      is_current: true,
      is_default: true,
    });
    const created = pickDeterministicCurrent(result.locations, result.current_location_id);
    if (created) {
      syncObservationLocationToMountProfile(created);
    }
    return toCanonicalResult(created);
  }

  const webStore = useWebLocationStore.getState();
  if (current) {
    const updates = mergeWithExistingLocation(current as WebLocation, normalizedInput);
    webStore.updateLocation(current.id, toPartialLocationUpdate(normalizedInput));
    const updated = useWebLocationStore.getState().locations.find((location) => location.id === current.id)
      ?? updates;
    syncObservationLocationToMountProfile(updated);
    return toCanonicalResult(updated);
  }

  const createdId = webStore.addLocation({
    name: buildFallbackName(normalizedInput),
    latitude: normalizedInput.latitude,
    longitude: normalizedInput.longitude,
    altitude: normalizedInput.altitude ?? 0,
    timezone: normalizedInput.timezone,
    notes: normalizedInput.notes,
    bortle_class: normalizedInput.bortle_class,
    is_current: true,
    is_default: true,
  });
  const created = useWebLocationStore.getState().locations.find((location) => location.id === createdId) ?? null;
  if (created) {
    syncObservationLocationToMountProfile(created);
  }
  return toCanonicalResult(created);
}

export async function migrateLegacyObserverLocation(): Promise<LegacyMigrationResult> {
  const legacyLocation = loadStoredLocation();
  if (!isValidLocation(legacyLocation)) {
    return { status: 'skipped', location: null };
  }

  const { locations, current } = await loadCanonicalState();
  if (locations.length > 0) {
    const duplicate = findPotentialDuplicateLocation(
      locations,
      current?.name ?? buildFallbackName(legacyLocation),
      legacyLocation.latitude,
      legacyLocation.longitude,
    );
    clearStoredLocation();
    return {
      status: 'skipped',
      location: toCanonicalResult(duplicate ?? current),
    };
  }

  const migrated = await applyCanonicalObservationLocation({
    latitude: legacyLocation.latitude,
    longitude: legacyLocation.longitude,
    altitude: legacyLocation.altitude,
  });
  clearStoredLocation();
  return {
    status: migrated ? 'migrated' : 'skipped',
    location: migrated,
  };
}
