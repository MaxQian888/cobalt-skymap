/**
 * @jest-environment jsdom
 */

const mockIsTauri = jest.fn(() => false);

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

type MockProfileInfo = {
  AstrometrySettings: {
    Latitude: number;
    Longitude: number;
    Elevation: number;
  };
};

const mountStoreState: {
  profileInfo: MockProfileInfo;
  setProfileInfo: jest.Mock<void, [MockProfileInfo]>;
} = {
  profileInfo: {
    AstrometrySettings: {
      Latitude: 0,
      Longitude: 0,
      Elevation: 0,
    },
  },
  setProfileInfo: jest.fn((value: MockProfileInfo) => {
    mountStoreState.profileInfo = value;
  }),
};

jest.mock('@/lib/stores/mount-store', () => ({
  useMountStore: {
    getState: () => mountStoreState,
  },
}));

type MockWebLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  is_current: boolean;
  is_default: boolean;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
};

const webLocationState: {
  locations: MockWebLocation[];
  addLocation: jest.Mock<string, [Omit<MockWebLocation, 'id'>]>;
  updateLocation: jest.Mock<void, [string, Partial<Omit<MockWebLocation, 'id'>>]>;
  setCurrent: jest.Mock<void, [string]>;
} = {
  locations: [],
  addLocation: jest.fn((location) => {
    const id = `web-loc-${webLocationState.locations.length + 1}`;
    webLocationState.locations = [
      ...webLocationState.locations.map((item) => ({
        ...item,
        is_current: false,
        is_default: item.is_default,
      })),
      { ...location, id },
    ];
    return id;
  }),
  updateLocation: jest.fn((id, updates) => {
    webLocationState.locations = webLocationState.locations.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
  }),
  setCurrent: jest.fn((id) => {
    webLocationState.locations = webLocationState.locations.map((item) => ({
      ...item,
      is_current: item.id === id,
    }));
  }),
};

const tauriLocationsApi = {
  load: jest.fn(),
  add: jest.fn(),
  update: jest.fn(),
  getCurrent: jest.fn(),
};

jest.mock('@/lib/stores/web-location-store', () => ({
  useWebLocationStore: {
    getState: () => webLocationState,
  },
}));

jest.mock('@/lib/tauri', () => ({
  tauriApi: {
    get locations() {
      return tauriLocationsApi;
    },
  },
}));

const mockLoadStoredLocation = jest.fn();
const mockClearStoredLocation = jest.fn();

jest.mock('@/lib/utils/observer-location', () => ({
  loadStoredLocation: () => mockLoadStoredLocation(),
  clearStoredLocation: () => mockClearStoredLocation(),
  isValidLocation: (location: { latitude: number; longitude: number } | null) => (
    !!location
    && Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180
  ),
}));

import {
  applyCanonicalObservationLocation,
  migrateLegacyObserverLocation,
} from '../observation-location-controller';

describe('observation-location-controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mountStoreState.profileInfo = {
      AstrometrySettings: {
        Latitude: 0,
        Longitude: 0,
        Elevation: 0,
      },
    };
    webLocationState.locations = [];
  });

  it('updates the current web location and syncs the observer profile', async () => {
    webLocationState.locations = [
      {
        id: 'loc-1',
        name: 'Backyard',
        latitude: 10,
        longitude: 20,
        altitude: 30,
        is_current: true,
        is_default: true,
      },
    ];

    const result = await applyCanonicalObservationLocation({
      latitude: 11,
      longitude: 22,
      altitude: 33,
    });

    expect(webLocationState.updateLocation).toHaveBeenCalledWith('loc-1', {
      latitude: 11,
      longitude: 22,
      altitude: 33,
    });
    expect(mountStoreState.setProfileInfo).toHaveBeenCalledWith({
      AstrometrySettings: {
        Latitude: 11,
        Longitude: 22,
        Elevation: 33,
      },
    });
    expect(result?.id).toBe('loc-1');
  });

  it('creates the first canonical web location when none exists', async () => {
    const result = await applyCanonicalObservationLocation({
      name: 'Imported Site',
      latitude: 40.7128,
      longitude: -74.006,
      altitude: 15,
    });

    expect(webLocationState.addLocation).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Imported Site',
      latitude: 40.7128,
      longitude: -74.006,
      altitude: 15,
      is_current: true,
      is_default: true,
    }));
    expect(result?.name).toBe('Imported Site');
  });

  it('updates the current tauri location instead of creating a duplicate', async () => {
    mockIsTauri.mockReturnValue(true);
    tauriLocationsApi.load.mockResolvedValue({
      locations: [
        {
          id: 'tauri-1',
          name: 'Observatory',
          latitude: 30,
          longitude: 40,
          altitude: 50,
          is_current: true,
          is_default: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
      current_location_id: 'tauri-1',
    });
    tauriLocationsApi.getCurrent.mockResolvedValue({
      id: 'tauri-1',
      name: 'Observatory',
      latitude: 30,
      longitude: 40,
      altitude: 50,
      is_current: true,
      is_default: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    tauriLocationsApi.update.mockResolvedValue({
      locations: [],
      current_location_id: 'tauri-1',
    });

    const result = await applyCanonicalObservationLocation({
      latitude: 31,
      longitude: 41,
      altitude: 51,
    });

    expect(tauriLocationsApi.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 'tauri-1',
      latitude: 31,
      longitude: 41,
      altitude: 51,
    }));
    expect(tauriLocationsApi.add).not.toHaveBeenCalled();
    expect(result?.id).toBe('tauri-1');
  });

  it('migrates legacy observer-location storage into the first canonical site', async () => {
    mockLoadStoredLocation.mockReturnValue({
      latitude: 51.5074,
      longitude: -0.1278,
      altitude: 12,
    });

    const result = await migrateLegacyObserverLocation();

    expect(webLocationState.addLocation).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 51.5074,
      longitude: -0.1278,
      altitude: 12,
      is_current: true,
      is_default: true,
    }));
    expect(mockClearStoredLocation).toHaveBeenCalled();
    expect(result.status).toBe('migrated');
  });

  it('skips duplicate legacy migration when a matching saved site already exists', async () => {
    mockLoadStoredLocation.mockReturnValue({
      latitude: 35.6762,
      longitude: 139.6503,
      altitude: 44,
    });
    webLocationState.locations = [
      {
        id: 'loc-1',
        name: 'Tokyo',
        latitude: 35.6762,
        longitude: 139.6503,
        altitude: 44,
        is_current: true,
        is_default: true,
      },
    ];

    const result = await migrateLegacyObserverLocation();

    expect(webLocationState.addLocation).not.toHaveBeenCalled();
    expect(mockClearStoredLocation).toHaveBeenCalled();
    expect(result.status).toBe('skipped');
  });
});
