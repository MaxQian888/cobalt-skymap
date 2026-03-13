import { create } from 'zustand';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';

interface PlanningUiState {
  sessionPlannerOpen: boolean;
  shotListOpen: boolean;
  tonightRecommendationsOpen: boolean;
  messierMarathonGuideOpen: boolean;
  plannerDraftSeed: SessionDraftV2 | null;
  plannerDraftSeedRequestId: number;
  openSessionPlanner: () => void;
  closeSessionPlanner: () => void;
  setSessionPlannerOpen: (open: boolean) => void;
  openShotList: () => void;
  closeShotList: () => void;
  setShotListOpen: (open: boolean) => void;
  openTonightRecommendations: () => void;
  closeTonightRecommendations: () => void;
  setTonightRecommendationsOpen: (open: boolean) => void;
  openMessierMarathonGuide: () => void;
  closeMessierMarathonGuide: () => void;
  setMessierMarathonGuideOpen: (open: boolean) => void;
  launchPlannerWithDraftSeed: (draft: SessionDraftV2) => void;
  clearPlannerDraftSeed: () => void;
}

export const usePlanningUiStore = create<PlanningUiState>((set) => ({
  sessionPlannerOpen: false,
  shotListOpen: false,
  tonightRecommendationsOpen: false,
  messierMarathonGuideOpen: false,
  plannerDraftSeed: null,
  plannerDraftSeedRequestId: 0,
  openSessionPlanner: () => set({ sessionPlannerOpen: true }),
  closeSessionPlanner: () => set({ sessionPlannerOpen: false }),
  setSessionPlannerOpen: (open) => set({ sessionPlannerOpen: open }),
  openShotList: () => set({ shotListOpen: true }),
  closeShotList: () => set({ shotListOpen: false }),
  setShotListOpen: (open) => set({ shotListOpen: open }),
  openTonightRecommendations: () => set({ tonightRecommendationsOpen: true }),
  closeTonightRecommendations: () => set({ tonightRecommendationsOpen: false }),
  setTonightRecommendationsOpen: (open) => set({ tonightRecommendationsOpen: open }),
  openMessierMarathonGuide: () => set({ messierMarathonGuideOpen: true }),
  closeMessierMarathonGuide: () => set({ messierMarathonGuideOpen: false }),
  setMessierMarathonGuideOpen: (open) => set({ messierMarathonGuideOpen: open }),
  launchPlannerWithDraftSeed: (draft) => set((state) => ({
    sessionPlannerOpen: true,
    plannerDraftSeed: draft,
    plannerDraftSeedRequestId: state.plannerDraftSeedRequestId + 1,
  })),
  clearPlannerDraftSeed: () => set({ plannerDraftSeed: null }),
}));
