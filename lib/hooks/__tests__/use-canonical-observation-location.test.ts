/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useCanonicalObservationLocationState } from '../use-canonical-observation-location';
import { useLocations } from '@/lib/tauri';
import { useWebLocationStore } from '@/lib/stores/web-location-store';
import type { LocationsData, ObservationLocation } from '@/lib/tauri/types';
import type { WebLocation } from '@/types/starmap/management';

jest.mock('@/lib/tauri', () => ({
  useLocations: jest.fn(),
}));

jest.mock('@/lib/stores/web-location-store', () => ({
  useWebLocationStore: jest.fn(),
}));

const mockUseLocations = useLocations as jest.MockedFunction<typeof useLocations>;
const mockUseWebLocationStore = useWebLocationStore as unknown as jest.Mock;

function createObservationLocation(
  overrides: Partial<ObservationLocation> = {},
): ObservationLocation {
  return {
    id: 'obs-1',
    name: 'Backyard',
    latitude: 40.0,
    longitude: -74.0,
    altitude: 100,
    timezone: 'UTC',
    bortle_class: 4,
    notes: 'Clear horizon',
    is_default: false,
    is_current: false,
    created_at: '2026-03-19T00:00:00Z',
    updated_at: '2026-03-19T00:00:00Z',
    ...overrides,
  };
}

function createWebLocation(overrides: Partial<WebLocation> = {}): WebLocation {
  return {
    id: 'web-1',
    name: 'Portable Site',
    latitude: 35.0,
    longitude: 110.0,
    altitude: 500,
    timezone: 'UTC',
    bortle_class: 3,
    notes: 'Dark sky',
    is_default: false,
    is_current: false,
    ...overrides,
  };
}

function createLocationsHookState(
  overrides: Partial<ReturnType<typeof useLocations>> = {},
): ReturnType<typeof useLocations> {
  return {
    locations: null,
    currentLocation: null,
    loading: false,
    error: null,
    refresh: jest.fn(),
    setCurrent: jest.fn(),
    isAvailable: false,
    ...overrides,
  };
}

function setWebLocations(locations: WebLocation[]) {
  mockUseWebLocationStore.mockImplementation(
    (selector: (state: { locations: WebLocation[] }) => unknown) =>
      selector({ locations }),
  );
}

describe('useCanonicalObservationLocationState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocations.mockReturnValue(createLocationsHookState());
    setWebLocations([]);
  });

  it('prefers the resolved currentLocation when Tauri locations are available', () => {
    const currentLocation = createObservationLocation({
      id: 'current',
      is_current: true,
    });
    const locations: LocationsData = {
      current_location_id: 'preferred',
      locations: [
        createObservationLocation({ id: 'preferred', is_default: true }),
        currentLocation,
      ],
    };

    mockUseLocations.mockReturnValue(
      createLocationsHookState({
        locations,
        currentLocation,
        loading: true,
        isAvailable: true,
      }),
    );

    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current).toEqual({
      currentLocation,
      hasSavedLocation: true,
      loading: true,
      isTauriManaged: true,
    });
  });

  it('falls back to current_location_id before current/default flags in Tauri mode', () => {
    const preferredLocation = createObservationLocation({ id: 'preferred' });
    const flaggedCurrent = createObservationLocation({
      id: 'flagged-current',
      is_current: true,
    });

    mockUseLocations.mockReturnValue(
      createLocationsHookState({
        locations: {
          current_location_id: 'preferred',
          locations: [flaggedCurrent, preferredLocation],
        },
        currentLocation: null,
        isAvailable: true,
      }),
    );

    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current.currentLocation).toEqual(preferredLocation);
  });

  it('falls back to the default Tauri location when no current location can be resolved', () => {
    const defaultLocation = createObservationLocation({
      id: 'default',
      is_default: true,
    });

    mockUseLocations.mockReturnValue(
      createLocationsHookState({
        locations: {
          locations: [
            createObservationLocation({ id: 'first' }),
            defaultLocation,
          ],
        },
        currentLocation: null,
        isAvailable: true,
      }),
    );

    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current.currentLocation).toEqual(defaultLocation);
    expect(result.current.hasSavedLocation).toBe(true);
  });

  it('uses web locations and forces loading false when Tauri is unavailable', () => {
    const webCurrent = createWebLocation({
      id: 'web-current',
      is_current: true,
    });

    mockUseLocations.mockReturnValue(
      createLocationsHookState({
        loading: true,
        isAvailable: false,
      }),
    );
    setWebLocations([
      createWebLocation({ id: 'web-default', is_default: true }),
      webCurrent,
    ]);

    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current).toEqual({
      currentLocation: webCurrent,
      hasSavedLocation: true,
      loading: false,
      isTauriManaged: false,
    });
  });

  it('falls back to the first web location when no web flags are set', () => {
    const firstLocation = createWebLocation({ id: 'first-web' });
    const secondLocation = createWebLocation({ id: 'second-web' });

    setWebLocations([firstLocation, secondLocation]);

    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current.currentLocation).toEqual(firstLocation);
  });

  it('returns an empty canonical state when no locations exist', () => {
    const { result } = renderHook(() => useCanonicalObservationLocationState());

    expect(result.current).toEqual({
      currentLocation: null,
      hasSavedLocation: false,
      loading: false,
      isTauriManaged: false,
    });
  });
});
