import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import type { HiPSSurvey } from '@/lib/services/hips/types';

// ============================================================================
// Types
// ============================================================================

interface HipsSurveyState {
  /** Currently selected survey/catalog id (image or catalog HiPS). */
  selectedSurveyId: string | null;
  /** Survey/catalog ids the user has starred. */
  favoriteSurveyIds: string[];
  /** Catalog HiPS discovered from the CDS MocServer (or curated fallback). */
  discoveredCatalogs: HiPSSurvey[];

  // Actions
  setSelectedSurvey: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  setDiscoveredCatalogs: (catalogs: HiPSSurvey[]) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useHipsSurveyStore = create<HipsSurveyState>()(
  persist(
    (set) => ({
      selectedSurveyId: null,
      favoriteSurveyIds: [],
      discoveredCatalogs: [],

      setSelectedSurvey: (id) => set({ selectedSurveyId: id }),

      toggleFavorite: (id) =>
        set((state) => ({
          favoriteSurveyIds: state.favoriteSurveyIds.includes(id)
            ? state.favoriteSurveyIds.filter((f) => f !== id)
            : [...state.favoriteSurveyIds, id],
        })),

      setDiscoveredCatalogs: (catalogs) => set({ discoveredCatalogs: catalogs }),
    }),
    {
      name: 'starmap-hips-surveys',
      storage: getZustandStorage(),
      // Discovered catalogs are re-fetched (cached at the service layer); persist
      // only the user's selection and favorites.
      partialize: (state) => ({
        selectedSurveyId: state.selectedSurveyId,
        favoriteSurveyIds: state.favoriteSurveyIds,
      }),
    }
  )
);
