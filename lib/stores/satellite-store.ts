import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SatelliteType } from '@/lib/core/types';
import { fetchSatellitesFromCelesTrak } from '@/lib/services/satellite/celestrak-service';
import type { ObserverLocation } from '@/lib/services/satellite-propagator';

// ============================================================================
// Types
// ============================================================================

export interface TrackedSatellite {
  id: string;
  name: string;
  noradId: number;
  type: SatelliteType;
  altitude: number;
  velocity: number;
  inclination: number;
  period: number;
  ra: number;
  dec: number;
  azimuth?: number;
  elevation?: number;
  magnitude?: number;
  isVisible: boolean;
  source?: string;
}

interface SatelliteState {
  // Display settings
  showSatellites: boolean;
  showLabels: boolean;
  showOrbits: boolean;
  
  // Tracked satellites (for rendering)
  trackedSatellites: TrackedSatellite[];
  
  // Selected satellite for tracking
  selectedSatelliteId: string | null;

  // CelesTrak groups to load on refresh
  selectedGroups: string[];

  // Actions
  setShowSatellites: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowOrbits: (show: boolean) => void;
  addTrackedSatellite: (satellite: TrackedSatellite) => void;
  removeTrackedSatellite: (id: string) => void;
  updateTrackedSatellite: (id: string, updates: Partial<TrackedSatellite>) => void;
  setTrackedSatellites: (satellites: TrackedSatellite[]) => void;
  clearTrackedSatellites: () => void;
  setSelectedSatellite: (id: string | null) => void;
  setSelectedGroups: (groups: string[]) => void;
  refreshFromCelesTrak: (group: string, observer?: ObserverLocation) => Promise<void>;
}

// ============================================================================
// Store
// ============================================================================

export const useSatelliteStore = create<SatelliteState>()(
  persist(
    (set) => ({
      // Default settings
      showSatellites: false,
      showLabels: true,
      showOrbits: false,
      trackedSatellites: [],
      selectedSatelliteId: null,
      selectedGroups: ['stations', 'visual', 'active'],

      // Actions
      setShowSatellites: (show) => set({ showSatellites: show }),
      setShowLabels: (show) => set({ showLabels: show }),
      setShowOrbits: (show) => set({ showOrbits: show }),
      
      addTrackedSatellite: (satellite) => set((state) => ({
        trackedSatellites: state.trackedSatellites.some(s => s.id === satellite.id)
          ? state.trackedSatellites.map(s => s.id === satellite.id ? satellite : s)
          : [...state.trackedSatellites, satellite],
      })),
      
      removeTrackedSatellite: (id) => set((state) => ({
        trackedSatellites: state.trackedSatellites.filter(s => s.id !== id),
        selectedSatelliteId: state.selectedSatelliteId === id ? null : state.selectedSatelliteId,
      })),
      
      updateTrackedSatellite: (id, updates) => set((state) => ({
        trackedSatellites: state.trackedSatellites.map(s => 
          s.id === id ? { ...s, ...updates } : s
        ),
      })),
      
      setTrackedSatellites: (satellites) => set({ trackedSatellites: satellites }),
      
      clearTrackedSatellites: () => set({ 
        trackedSatellites: [],
        selectedSatelliteId: null,
      }),
      
      setSelectedSatellite: (id) => set({ selectedSatelliteId: id }),

      setSelectedGroups: (groups) => set({ selectedGroups: groups }),

      refreshFromCelesTrak: async (group, observer) => {
        const satellites = await fetchSatellitesFromCelesTrak(group, observer);
        const mapped: TrackedSatellite[] = satellites.map((s) => ({
          id: s.id,
          name: s.name,
          noradId: s.noradId,
          type: s.type,
          altitude: s.altitude,
          velocity: s.velocity,
          inclination: s.inclination ?? 0,
          period: s.period ?? 0,
          ra: s.ra ?? 0,
          dec: s.dec ?? 0,
          azimuth: s.azimuth,
          elevation: s.elevation,
          magnitude: s.magnitude,
          isVisible: s.isVisible,
          source: s.source,
        }));

        // Upsert by id so refreshing one group does not wipe others.
        set((state) => {
          const byId = new Map(state.trackedSatellites.map((s) => [s.id, s]));
          for (const sat of mapped) byId.set(sat.id, sat);
          return { trackedSatellites: Array.from(byId.values()) };
        });
      },
    }),
    {
      name: 'satellite-settings',
      partialize: (state) => ({
        showSatellites: state.showSatellites,
        showLabels: state.showLabels,
        showOrbits: state.showOrbits,
        selectedGroups: state.selectedGroups,
      }),
    }
  )
);
