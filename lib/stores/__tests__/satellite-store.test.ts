import { act, renderHook } from '@testing-library/react';
import { useSatelliteStore, type TrackedSatellite } from '../satellite-store';
import { fetchSatellitesFromCelesTrak } from '@/lib/services/satellite/celestrak-service';

jest.mock('@/lib/services/satellite/celestrak-service', () => ({
  fetchSatellitesFromCelesTrak: jest.fn(),
}));

const mockFetch = fetchSatellitesFromCelesTrak as jest.MockedFunction<
  typeof fetchSatellitesFromCelesTrak
>;

describe('useSatelliteStore', () => {
  const mockSatellite: TrackedSatellite = {
    id: 'sat-1',
    name: 'ISS (ZARYA)',
    noradId: 25544,
    type: 'iss',
    altitude: 420,
    velocity: 7.66,
    inclination: 51.6,
    period: 92.9,
    ra: 180,
    dec: 45,
    azimuth: 90,
    elevation: 45,
    isVisible: true,
  };

  beforeEach(() => {
    const { result } = renderHook(() => useSatelliteStore());
    act(() => {
      result.current.clearTrackedSatellites();
      result.current.setShowSatellites(false);
      result.current.setShowLabels(true);
      result.current.setShowOrbits(false);
    });
  });

  describe('initial state', () => {
    it('should have showSatellites disabled by default', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.showSatellites).toBe(false);
    });

    it('should have showLabels enabled by default', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.showLabels).toBe(true);
    });

    it('should have showOrbits disabled by default', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.showOrbits).toBe(false);
    });

    it('should have empty trackedSatellites array', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.trackedSatellites).toEqual([]);
    });

    it('should have null selectedSatelliteId', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.selectedSatelliteId).toBeNull();
    });
  });

  describe('display settings', () => {
    it('should toggle showSatellites', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.setShowSatellites(true);
      });

      expect(result.current.showSatellites).toBe(true);
    });

    it('should toggle showLabels', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.setShowLabels(false);
      });

      expect(result.current.showLabels).toBe(false);
    });

    it('should toggle showOrbits', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.setShowOrbits(true);
      });

      expect(result.current.showOrbits).toBe(true);
    });
  });

  describe('addTrackedSatellite', () => {
    it('should add a new satellite', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
      });

      expect(result.current.trackedSatellites).toHaveLength(1);
      expect(result.current.trackedSatellites[0]).toEqual(mockSatellite);
    });

    it('should update existing satellite if id matches', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
      });

      const updatedSatellite = { ...mockSatellite, altitude: 430 };

      act(() => {
        result.current.addTrackedSatellite(updatedSatellite);
      });

      expect(result.current.trackedSatellites).toHaveLength(1);
      expect(result.current.trackedSatellites[0].altitude).toBe(430);
    });
  });

  describe('removeTrackedSatellite', () => {
    it('should remove satellite by id', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
      });

      expect(result.current.trackedSatellites).toHaveLength(1);

      act(() => {
        result.current.removeTrackedSatellite('sat-1');
      });

      expect(result.current.trackedSatellites).toHaveLength(0);
    });

    it('should clear selectedSatelliteId if removed satellite was selected', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
        result.current.setSelectedSatellite('sat-1');
      });

      expect(result.current.selectedSatelliteId).toBe('sat-1');

      act(() => {
        result.current.removeTrackedSatellite('sat-1');
      });

      expect(result.current.selectedSatelliteId).toBeNull();
    });
  });

  describe('updateTrackedSatellite', () => {
    it('should update satellite properties', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
      });

      act(() => {
        result.current.updateTrackedSatellite('sat-1', {
          altitude: 425,
          isVisible: false,
        });
      });

      expect(result.current.trackedSatellites[0].altitude).toBe(425);
      expect(result.current.trackedSatellites[0].isVisible).toBe(false);
    });
  });

  describe('setTrackedSatellites', () => {
    it('should replace all tracked satellites', () => {
      const { result } = renderHook(() => useSatelliteStore());

      const satellites: TrackedSatellite[] = [
        mockSatellite,
        { ...mockSatellite, id: 'sat-2', name: 'Starlink-1234' },
      ];

      act(() => {
        result.current.setTrackedSatellites(satellites);
      });

      expect(result.current.trackedSatellites).toHaveLength(2);
    });
  });

  describe('clearTrackedSatellites', () => {
    it('should clear all tracked satellites', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
        result.current.setSelectedSatellite('sat-1');
      });

      act(() => {
        result.current.clearTrackedSatellites();
      });

      expect(result.current.trackedSatellites).toHaveLength(0);
      expect(result.current.selectedSatelliteId).toBeNull();
    });
  });

  describe('selectedGroups', () => {
    it('defaults to stations/visual/active', () => {
      const { result } = renderHook(() => useSatelliteStore());
      expect(result.current.selectedGroups).toEqual(['stations', 'visual', 'active']);
    });

    it('setSelectedGroups replaces the selection', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.setSelectedGroups(['starlink']);
      });

      expect(result.current.selectedGroups).toEqual(['starlink']);
    });
  });

  describe('refreshFromCelesTrak', () => {
    it('loads satellites from the service and upserts them into the store', async () => {
      mockFetch.mockResolvedValueOnce([
        {
          id: 'celestrak-25544',
          name: 'ISS (ZARYA)',
          noradId: 25544,
          type: 'iss',
          altitude: 420,
          velocity: 7.66,
          inclination: 51.6,
          period: 92.9,
          ra: 180,
          dec: 45,
          isVisible: true,
          source: 'CelesTrak',
        },
      ]);

      const { result } = renderHook(() => useSatelliteStore());

      await act(async () => {
        await result.current.refreshFromCelesTrak('stations');
      });

      expect(mockFetch).toHaveBeenCalledWith('stations', undefined);
      expect(result.current.trackedSatellites).toHaveLength(1);
      expect(result.current.trackedSatellites[0].noradId).toBe(25544);
    });
  });

  describe('setSelectedSatellite', () => {
    it('should set selected satellite id', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.addTrackedSatellite(mockSatellite);
        result.current.setSelectedSatellite('sat-1');
      });

      expect(result.current.selectedSatelliteId).toBe('sat-1');
    });

    it('should allow setting to null', () => {
      const { result } = renderHook(() => useSatelliteStore());

      act(() => {
        result.current.setSelectedSatellite('sat-1');
      });

      act(() => {
        result.current.setSelectedSatellite(null);
      });

      expect(result.current.selectedSatelliteId).toBeNull();
    });
  });
});
