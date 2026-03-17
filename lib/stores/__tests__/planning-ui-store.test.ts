/**
 * Tests for planning-ui-store.ts
 * Planning panel open/close state management
 */

import { act } from '@testing-library/react';
import { usePlanningUiStore } from '../planning-ui-store';

beforeEach(() => {
  act(() => {
    usePlanningUiStore.setState({
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
    });
  });
});

describe('usePlanningUiStore', () => {
  it('should start with all panels closed', () => {
    const state = usePlanningUiStore.getState();
    expect(state.sessionPlannerOpen).toBe(false);
    expect(state.shotListOpen).toBe(false);
    expect(state.tonightRecommendationsOpen).toBe(false);
    expect(state.messierMarathonGuideOpen).toBe(false);
    expect(state.plannerWorkspaceOpen).toBe(false);
    expect(state.plannerWorkspaceTab).toBe('plans');
  });

  it('should open session planner', () => {
    act(() => {
      usePlanningUiStore.getState().openSessionPlanner();
    });
    expect(usePlanningUiStore.getState().sessionPlannerOpen).toBe(true);
  });

  it('should close session planner', () => {
    act(() => {
      usePlanningUiStore.getState().openSessionPlanner();
      usePlanningUiStore.getState().closeSessionPlanner();
    });
    expect(usePlanningUiStore.getState().sessionPlannerOpen).toBe(false);
  });

  it('should toggle session planner via set', () => {
    act(() => {
      usePlanningUiStore.getState().setSessionPlannerOpen(true);
    });
    expect(usePlanningUiStore.getState().sessionPlannerOpen).toBe(true);
  });

  it('should open shot list', () => {
    act(() => {
      usePlanningUiStore.getState().openShotList();
    });
    expect(usePlanningUiStore.getState().shotListOpen).toBe(true);
  });

  it('should close shot list', () => {
    act(() => {
      usePlanningUiStore.getState().openShotList();
      usePlanningUiStore.getState().closeShotList();
    });
    expect(usePlanningUiStore.getState().shotListOpen).toBe(false);
  });

  it('should open tonight recommendations', () => {
    act(() => {
      usePlanningUiStore.getState().openTonightRecommendations();
    });
    expect(usePlanningUiStore.getState().tonightRecommendationsOpen).toBe(true);
  });

  it('should close tonight recommendations', () => {
    act(() => {
      usePlanningUiStore.getState().openTonightRecommendations();
      usePlanningUiStore.getState().closeTonightRecommendations();
    });
    expect(usePlanningUiStore.getState().tonightRecommendationsOpen).toBe(false);
  });

  it('should open and close messier marathon guide', () => {
    act(() => {
      usePlanningUiStore.getState().openMessierMarathonGuide();
    });
    expect(usePlanningUiStore.getState().messierMarathonGuideOpen).toBe(true);

    act(() => {
      usePlanningUiStore.getState().closeMessierMarathonGuide();
    });
    expect(usePlanningUiStore.getState().messierMarathonGuideOpen).toBe(false);
  });

  it('should launch planner with a seeded draft', () => {
    act(() => {
      usePlanningUiStore.getState().launchPlannerWithDraftSeed({
        planDate: '2026-03-21T12:00:00.000Z',
        strategy: 'balanced',
        constraints: {
          minAltitude: 20,
          minImagingTime: 30,
        },
        excludedTargetIds: [],
        manualEdits: [],
        guideContext: {
          kind: 'messier-marathon',
          sessionId: 'marathon-1',
          readiness: 'recommended',
          mode: 'full',
          checkpointOrder: ['M74'],
          criticalCheckpointIds: ['M74'],
          stageByTargetId: { M74: 'dusk' },
        },
      });
    });

    const state = usePlanningUiStore.getState();
    expect(state.sessionPlannerOpen).toBe(true);
    expect(state.plannerDraftSeed?.guideContext?.sessionId).toBe('marathon-1');
    expect(state.plannerDraftSeedRequestId).toBe(1);
  });

  it('should clear planner draft seed without closing the planner', () => {
    act(() => {
      usePlanningUiStore.getState().launchPlannerWithDraftSeed({
        planDate: '2026-03-21T12:00:00.000Z',
        strategy: 'balanced',
        constraints: {
          minAltitude: 20,
          minImagingTime: 30,
        },
        excludedTargetIds: [],
        manualEdits: [],
      });
      usePlanningUiStore.getState().clearPlannerDraftSeed();
    });

    const state = usePlanningUiStore.getState();
    expect(state.sessionPlannerOpen).toBe(true);
    expect(state.plannerDraftSeed).toBeNull();
  });

  it('should open planner workspace with a specific tab', () => {
    act(() => {
      usePlanningUiStore.getState().openPlannerWorkspace('imports');
    });

    const state = usePlanningUiStore.getState();
    expect(state.plannerWorkspaceOpen).toBe(true);
    expect(state.plannerWorkspaceTab).toBe('imports');
  });

  it('should update workspace filter and selected entry independently', () => {
    act(() => {
      usePlanningUiStore.getState().setPlannerWorkspaceFilter('templates');
      usePlanningUiStore.getState().setSelectedPlannerWorkspaceEntry('template-1');
    });

    const state = usePlanningUiStore.getState();
    expect(state.plannerWorkspaceFilter).toBe('templates');
    expect(state.selectedPlannerWorkspaceEntryId).toBe('template-1');
  });

  it('should show and hide the recovery prompt', () => {
    act(() => {
      usePlanningUiStore.getState().setRecoveryPromptVisible(true);
    });
    expect(usePlanningUiStore.getState().recoveryPromptVisible).toBe(true);

    act(() => {
      usePlanningUiStore.getState().setRecoveryPromptVisible(false);
    });
    expect(usePlanningUiStore.getState().recoveryPromptVisible).toBe(false);
  });
});
