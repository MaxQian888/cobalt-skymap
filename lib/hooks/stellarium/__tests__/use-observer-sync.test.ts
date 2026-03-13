/**
 * Tests for use-observer-sync.ts
 * Observer location sync from profile to Stellarium engine
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useObserverSync } from '../use-observer-sync';
import { useRef } from 'react';

const mockSetProfileInfo = jest.fn();

jest.mock('@/lib/stores', () => ({
  useMountStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
        setProfileInfo: mockSetProfileInfo,
      })
    ),
    {
      getState: () => ({
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
        setProfileInfo: mockSetProfileInfo,
      }),
    }
  ),
}));

const mockMigrateLegacyObserverLocation = jest.fn<
  Promise<{ status: 'skipped'; location: null }>,
  []
>(async () => ({ status: 'skipped', location: null }));
const mockResolveCanonicalObservationLocation = jest.fn<
  Promise<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    altitude: number;
    is_current: boolean;
    is_default: boolean;
  } | null>,
  []
>(async () => null);

jest.mock('@/lib/services/observation-location-controller', () => ({
  migrateLegacyObserverLocation: () => mockMigrateLegacyObserverLocation(),
  resolveCanonicalObservationLocation: () => mockResolveCanonicalObservationLocation(),
}));

describe('useObserverSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not throw when stelRef is null', () => {
    expect(() => {
      renderHook(() => {
        const ref = useRef(null);
        useObserverSync(ref);
      });
    }).not.toThrow();
  });

  it('should sync observer when engine is available', () => {
    const mockStel = {
      core: {
        observer: {
          latitude: 0,
          longitude: 0,
          elevation: 0,
        },
      },
    };
    renderHook(() => {
      const ref = useRef(mockStel);
      useObserverSync(ref as never);
    });
    // Should not throw
  });

  it('bootstraps mount profile from the canonical current site', async () => {
    mockResolveCanonicalObservationLocation.mockResolvedValue({
      id: 'loc-1',
      name: 'Backyard',
      latitude: 51.5,
      longitude: -0.1,
      altitude: 100,
      is_current: true,
      is_default: true,
    });

    renderHook(() => {
      const ref = useRef(null);
      useObserverSync(ref);
    });

    await waitFor(() => {
      expect(mockMigrateLegacyObserverLocation).toHaveBeenCalled();
      expect(mockResolveCanonicalObservationLocation).toHaveBeenCalled();
      expect(mockSetProfileInfo).toHaveBeenCalledWith({
        AstrometrySettings: {
          Latitude: 51.5,
          Longitude: -0.1,
          Elevation: 100,
        },
      });
    });
  });
});
