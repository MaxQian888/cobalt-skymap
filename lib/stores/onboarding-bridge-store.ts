import { create } from 'zustand';

interface OnboardingBridgeState {
  expandRightPanelRequestId: number;
  openSettingsDrawerRequestId: number;
  settingsDrawerTab: string | null;
  settingsDrawerOpen: boolean;
  openSearchRequestId: number;
  toggleSearchRequestId: number;
  toggleSessionPanelRequestId: number;
  openMobileDrawerRequestId: number;
  openDailyKnowledgeRequestId: number;
  mobileDrawerSection: string | null;
  closeTransientPanelsRequestId: number;
  openToolbarOverflowRequestId: number;
  closeToolbarOverflowRequestId: number;

  expandRightPanel: () => void;
  openSettingsDrawer: (tab?: string) => void;
  setSettingsDrawerOpen: (open: boolean) => void;
  openSearch: () => void;
  toggleSearch: () => void;
  toggleSessionPanel: () => void;
  openMobileDrawer: (section?: string) => void;
  openDailyKnowledge: () => void;
  closeTransientPanels: () => void;
  /** Reveal the desktop top-bar "More" overflow menu (tour reveal for folded groups). */
  openToolbarOverflow: () => void;
  closeToolbarOverflow: () => void;
}

export const useOnboardingBridgeStore = create<OnboardingBridgeState>()(
  (set) => ({
    expandRightPanelRequestId: 0,
    openSettingsDrawerRequestId: 0,
    settingsDrawerTab: null,
    settingsDrawerOpen: false,
    openSearchRequestId: 0,
    toggleSearchRequestId: 0,
    toggleSessionPanelRequestId: 0,
    openMobileDrawerRequestId: 0,
    openDailyKnowledgeRequestId: 0,
    mobileDrawerSection: null,
    closeTransientPanelsRequestId: 0,
    openToolbarOverflowRequestId: 0,
    closeToolbarOverflowRequestId: 0,

    expandRightPanel: () =>
      set((state) => ({
        expandRightPanelRequestId: state.expandRightPanelRequestId + 1,
      })),

    openSettingsDrawer: (tab) =>
      set((state) => ({
        openSettingsDrawerRequestId: state.openSettingsDrawerRequestId + 1,
        settingsDrawerTab: tab ?? null,
        settingsDrawerOpen: true,
      })),

    setSettingsDrawerOpen: (open) => set({ settingsDrawerOpen: open }),

    openSearch: () =>
      set((state) => ({
        openSearchRequestId: state.openSearchRequestId + 1,
      })),

    toggleSearch: () =>
      set((state) => ({
        toggleSearchRequestId: state.toggleSearchRequestId + 1,
      })),

    toggleSessionPanel: () =>
      set((state) => ({
        toggleSessionPanelRequestId: state.toggleSessionPanelRequestId + 1,
      })),

    openMobileDrawer: (section) =>
      set((state) => ({
        openMobileDrawerRequestId: state.openMobileDrawerRequestId + 1,
        mobileDrawerSection: section ?? null,
      })),

    openDailyKnowledge: () =>
      set((state) => ({
        openDailyKnowledgeRequestId: state.openDailyKnowledgeRequestId + 1,
      })),

    closeTransientPanels: () =>
      set((state) => ({
        closeTransientPanelsRequestId: state.closeTransientPanelsRequestId + 1,
      })),

    openToolbarOverflow: () =>
      set((state) => ({
        openToolbarOverflowRequestId: state.openToolbarOverflowRequestId + 1,
      })),

    closeToolbarOverflow: () =>
      set((state) => ({
        closeToolbarOverflowRequestId: state.closeToolbarOverflowRequestId + 1,
      })),
  }),
);
