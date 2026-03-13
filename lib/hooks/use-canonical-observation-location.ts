import { useMemo } from 'react';
import { useLocations } from '@/lib/tauri';
import { useWebLocationStore } from '@/lib/stores/web-location-store';
import type { ObservationLocation } from '@/lib/tauri/types';
import type { WebLocation } from '@/types/starmap/management';

type LocationLike = ObservationLocation | WebLocation;

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

export function useCanonicalObservationLocationState() {
  const {
    locations,
    currentLocation,
    loading,
    isAvailable,
  } = useLocations();
  const webLocations = useWebLocationStore((state) => state.locations);

  return useMemo(() => {
    if (isAvailable) {
      const allLocations = locations?.locations ?? [];
      const canonicalCurrent = currentLocation
        ?? pickDeterministicCurrent(allLocations, locations?.current_location_id);

      return {
        currentLocation: canonicalCurrent,
        hasSavedLocation: allLocations.length > 0,
        loading,
        isTauriManaged: true,
      };
    }

    return {
      currentLocation: pickDeterministicCurrent(webLocations),
      hasSavedLocation: webLocations.length > 0,
      loading: false,
      isTauriManaged: false,
    };
  }, [currentLocation, isAvailable, loading, locations?.current_location_id, locations?.locations, webLocations]);
}
