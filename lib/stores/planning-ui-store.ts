import { create } from 'zustand';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';

export type PlannerWorkspaceTab = 'plans' | 'templates' | 'imports' | 'recovery';
export type PlannerWorkspaceFilter = 'all' | 'plans' | 'templates' | 'imports' | 'recovery';

interface PlanningUiState {
  sessionPlannerOpen: boolean;
  shotListOpen: boolean;
  tonightRecommendationsOpen: boolean;
  messierMarathonGuideOpen: boolean;
  plannerDraftSeed: SessionDraftV2 | null;
  plannerDraftSeedRequestId: number;
  plannerWorkspaceOpen: boolean;
  plannerWorkspaceTab: PlannerWorkspaceTab;
  plannerWorkspaceFilter: PlannerWorkspaceFilter;
  selectedPlannerWorkspaceEntryId: string | null;
  recoveryPromptVisible: boolean;
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
  openPlannerWorkspace: (tab?: PlannerWorkspaceTab) => void;
  closePlannerWorkspace: () => void;
  setPlannerWorkspaceOpen: (open: boolean) => void;
  setPlannerWorkspaceTab: (tab: PlannerWorkspaceTab) => void;
  setPlannerWorkspaceFilter: (filter: PlannerWorkspaceFilter) => void;
  setSelectedPlannerWorkspaceEntry: (entryId: string | null) => void;
  setRecoveryPromptVisible: (visible: boolean) => void;
}

export const usePlanningUiStore = create<PlanningUiState>((set) => ({
  sessionPlannerOpen: false,
  shotListOpen: false,
  tonightRecommendationsOpen: false,
  messierMarathonGuideOpen: false,
  plannerDraftSeed: null,
  plannerDraftSeedRequestId: 0,
  plannerWorkspaceOpen: false,
  plannerWorkspaceTab: 'plans',
  plannerWorkspaceFilter: 'all',
  selectedPlannerWorkspaceEntryId: null,
  recoveryPromptVisible: false,
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
    recoveryPromptVisible: false,
  })),
  clearPlannerDraftSeed: () => set({ plannerDraftSeed: null }),
  openPlannerWorkspace: (tab = 'plans') => set({
    plannerWorkspaceOpen: true,
    plannerWorkspaceTab: tab,
  }),
  closePlannerWorkspace: () => set({
    plannerWorkspaceOpen: false,
    selectedPlannerWorkspaceEntryId: null,
  }),
  setPlannerWorkspaceOpen: (open) => set({ plannerWorkspaceOpen: open }),
  setPlannerWorkspaceTab: (tab) => set({ plannerWorkspaceTab: tab }),
  setPlannerWorkspaceFilter: (filter) => set({ plannerWorkspaceFilter: filter }),
  setSelectedPlannerWorkspaceEntry: (entryId) => set({ selectedPlannerWorkspaceEntryId: entryId }),
  setRecoveryPromptVisible: (visible) => set({ recoveryPromptVisible: visible }),
}));
