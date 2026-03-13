/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessierMarathonGuideDialog } from '../messier-marathon-guide';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useMessierMarathonStore } from '@/lib/stores/messier-marathon-store';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockCreateList = jest.fn(() => 'list-1');
const mockSetActiveList = jest.fn();
const mockAddEntryToList = jest.fn((listId: string, target: { name: string }) => ({
  id: `${target.name}-entry`,
  listId,
  ...target,
}));
const mockGetEntriesForList = jest.fn(() => []);
const mockSessionPlanState = {
  executions: [] as Array<Record<string, unknown>>,
};

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) => selector({
    createList: mockCreateList,
    setActiveList: mockSetActiveList,
    addEntryToList: mockAddEntryToList,
    getEntriesForList: mockGetEntriesForList,
  }),
}));

jest.mock('@/lib/stores/mount-store', () => ({
  useMountStore: (selector: (state: unknown) => unknown) => selector({
    profileInfo: {
      AstrometrySettings: {
        Latitude: 35,
        Longitude: -105,
      },
    },
  }),
}));

jest.mock('@/lib/stores/session-plan-store', () => ({
  useSessionPlanStore: (selector: (state: unknown) => unknown) => selector(mockSessionPlanState),
}));

const sessionFixture = {
  sessionId: 'session-1',
  date: '2026-03-21T12:00:00.000Z',
  latitude: 35,
  longitude: -105,
  readiness: 'recommended' as const,
  visibleTargetCount: 2,
  totalMessierCount: 110,
  darknessHours: 9.5,
  limitingFactors: [],
  stages: [
    {
      id: 'dusk' as const,
      labelKey: 'messierMarathon.stages.dusk',
      checkpointIds: ['M74'],
      completedCount: 0,
      criticalCount: 1,
    },
    {
      id: 'early-evening' as const,
      labelKey: 'messierMarathon.stages.early-evening',
      checkpointIds: ['M42'],
      completedCount: 0,
      criticalCount: 0,
    },
  ],
  checkpoints: [
    {
      targetId: 'M74',
      targetName: 'M74',
      stageId: 'dusk' as const,
      order: 1,
      critical: true,
      status: 'pending' as const,
      visibilityHours: 0.5,
      transitAltitude: 38,
      recommendedWindowStart: '2026-03-21T19:35:00.000Z',
      recommendedWindowEnd: '2026-03-21T20:10:00.000Z',
    },
    {
      targetId: 'M42',
      targetName: 'M42',
      stageId: 'early-evening' as const,
      order: 2,
      critical: false,
      status: 'pending' as const,
      visibilityHours: 1.8,
      transitAltitude: 56,
      recommendedWindowStart: '2026-03-21T20:30:00.000Z',
      recommendedWindowEnd: '2026-03-21T22:10:00.000Z',
    },
  ],
  recovery: {
    mode: 'full' as const,
    nextCheckpointId: 'M74',
    nextStageId: 'dusk' as const,
    catchUpTargetIds: ['M74', 'M42'],
    updatedAt: '2026-03-21T12:00:00.000Z',
  },
  sourceListId: undefined,
  sourcePlanId: undefined,
  sourceExecutionId: undefined,
  startedAt: '2026-03-21T12:00:00.000Z',
  updatedAt: '2026-03-21T12:00:00.000Z',
};

describe('MessierMarathonGuideDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionPlanState.executions = [];
    usePlanningUiStore.setState({
      sessionPlannerOpen: false,
      shotListOpen: false,
      tonightRecommendationsOpen: false,
      messierMarathonGuideOpen: true,
      plannerDraftSeed: null,
      plannerDraftSeedRequestId: 0,
    });
    useMessierMarathonStore.setState({
      activeSession: sessionFixture,
      lastCompletedSessionId: null,
    });
  });

  it('renders readiness summary and checkpoint list', () => {
    render(<MessierMarathonGuideDialog />);

    expect(screen.getByText('messierMarathon.title')).toBeInTheDocument();
    expect(screen.getByText('messierMarathon.readiness.recommended')).toBeInTheDocument();
    expect(screen.getByText('M74')).toBeInTheDocument();
    expect(screen.getByText('M42')).toBeInTheDocument();
    expect(screen.getByText('messierMarathon.mode.full')).toBeInTheDocument();
  });

  it('updates recovery mode after skipping a critical checkpoint', () => {
    render(<MessierMarathonGuideDialog />);

    const skipButtons = screen.getAllByRole('button', { name: 'messierMarathon.actions.skipCheckpoint' });
    fireEvent.click(skipButtons[0]);

    expect(useMessierMarathonStore.getState().activeSession?.recovery.mode).toBe('best_effort');
    expect(screen.getByText('messierMarathon.mode.best_effort')).toBeInTheDocument();
  });

  it('seeds the planner and target list from the active session', () => {
    render(<MessierMarathonGuideDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'messierMarathon.actions.openPlanner' }));

    expect(mockCreateList).toHaveBeenCalled();
    expect(mockSetActiveList).toHaveBeenCalledWith('list-1');
    expect(mockAddEntryToList).toHaveBeenCalledTimes(2);
    expect(usePlanningUiStore.getState().plannerDraftSeed?.guideContext?.kind).toBe('messier-marathon');
    expect(usePlanningUiStore.getState().sessionPlannerOpen).toBe(true);
    expect(useMessierMarathonStore.getState().activeSession?.sourceListId).toBe('list-1');
  });

  it('keeps the guide cleared after an explicit reset', () => {
    render(<MessierMarathonGuideDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'messierMarathon.actions.resetGuide' }));

    expect(useMessierMarathonStore.getState().activeSession).toBeNull();
    expect(
      screen.getByRole('button', { name: 'messierMarathon.actions.openPlanner' }),
    ).toBeDisabled();
  });

  it('syncs execution target completion back into guide progress', () => {
    mockSessionPlanState.executions = [
      {
        id: 'execution-1',
        sourcePlanId: 'plan-1',
        sourcePlanName: 'Guide Plan',
        status: 'active',
        planDate: '2026-03-21T12:00:00.000Z',
        createdAt: '2026-03-21T12:00:00.000Z',
        updatedAt: '2026-03-21T12:00:00.000Z',
        guideContext: {
          kind: 'messier-marathon',
          sessionId: 'session-1',
          readiness: 'recommended',
          mode: 'full',
          checkpointOrder: ['M74-entry', 'M42-entry'],
          criticalCheckpointIds: ['M74-entry'],
          stageByTargetId: {
            'M74-entry': 'dusk',
            'M42-entry': 'early-evening',
          },
          catalogIdByPlannerTargetId: {
            'M74-entry': 'M74',
            'M42-entry': 'M42',
          },
        },
        targets: [
          {
            id: 'M74-entry',
            targetId: 'M74-entry',
            targetName: 'M74',
            scheduledStart: '2026-03-21T19:35:00.000Z',
            scheduledEnd: '2026-03-21T20:10:00.000Z',
            scheduledDurationMinutes: 35,
            order: 1,
            status: 'completed',
            observationIds: [],
          },
        ],
      },
    ];

    useMessierMarathonStore.setState({
      activeSession: {
        ...sessionFixture,
        sourcePlanId: 'plan-1',
        sourceExecutionId: 'execution-1',
      },
    });

    render(<MessierMarathonGuideDialog />);

    expect(
      useMessierMarathonStore.getState().activeSession?.checkpoints.find(
        (checkpoint) => checkpoint.targetId === 'M74',
      )?.status,
    ).toBe('completed');
  });
});
