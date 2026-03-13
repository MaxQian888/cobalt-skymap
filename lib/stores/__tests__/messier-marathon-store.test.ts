import { act } from '@testing-library/react';
import { useMessierMarathonStore } from '../messier-marathon-store';

jest.mock('@/lib/storage', () => ({
  getZustandStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

jest.mock('@/lib/messier-marathon', () => ({
  evaluateMessierMarathonSession: jest.fn(),
  updateMessierMarathonCheckpointStatus: jest.fn(),
}));

const {
  evaluateMessierMarathonSession,
  updateMessierMarathonCheckpointStatus,
} = jest.requireMock('@/lib/messier-marathon') as {
  evaluateMessierMarathonSession: jest.Mock;
  updateMessierMarathonCheckpointStatus: jest.Mock;
};

const sessionFixture = {
  sessionId: 'session-1',
  date: '2026-03-21T12:00:00.000Z',
  latitude: 35,
  longitude: -105,
  readiness: 'recommended' as const,
  visibleTargetCount: 5,
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
  startedAt: '2026-03-21T12:00:00.000Z',
  updatedAt: '2026-03-21T12:00:00.000Z',
};

describe('useMessierMarathonStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMessierMarathonStore.setState({
      activeSession: null,
      lastCompletedSessionId: null,
    });
  });

  it('starts and resumes a marathon session', () => {
    evaluateMessierMarathonSession.mockReturnValue(sessionFixture);

    let started;
    act(() => {
      started = useMessierMarathonStore.getState().startSession({
        date: new Date('2026-03-21T12:00:00.000Z'),
        latitude: 35,
        longitude: -105,
      });
    });

    expect(evaluateMessierMarathonSession).toHaveBeenCalled();
    expect(started).toEqual(sessionFixture);
    expect(useMessierMarathonStore.getState().resumeSession()).toEqual(sessionFixture);
  });

  it('updates checkpoint status through the domain helper', () => {
    evaluateMessierMarathonSession.mockReturnValue(sessionFixture);
    updateMessierMarathonCheckpointStatus.mockReturnValue({
      ...sessionFixture,
      checkpoints: sessionFixture.checkpoints.map((checkpoint) =>
        checkpoint.targetId === 'M74'
          ? { ...checkpoint, status: 'completed' as const }
          : checkpoint,
      ),
      recovery: {
        ...sessionFixture.recovery,
        nextCheckpointId: 'M42',
        nextStageId: 'early-evening' as const,
      },
    });

    act(() => {
      useMessierMarathonStore.getState().startSession({
        date: new Date('2026-03-21T12:00:00.000Z'),
        latitude: 35,
        longitude: -105,
      });
      useMessierMarathonStore.getState().updateCheckpointStatus('M74', 'completed');
    });

    expect(updateMessierMarathonCheckpointStatus).toHaveBeenCalledWith(
      sessionFixture,
      'M74',
      'completed',
    );
    expect(useMessierMarathonStore.getState().activeSession?.recovery.nextCheckpointId).toBe('M42');
  });

  it('links planner and execution metadata into derived guide context', () => {
    evaluateMessierMarathonSession.mockReturnValue(sessionFixture);

    act(() => {
      useMessierMarathonStore.getState().startSession({
        date: new Date('2026-03-21T12:00:00.000Z'),
        latitude: 35,
        longitude: -105,
      });
      useMessierMarathonStore.getState().linkPlanner({
        sourceListId: 'list-1',
        sourcePlanId: 'plan-1',
      });
      useMessierMarathonStore.getState().linkExecution('execution-1');
    });

    const context = useMessierMarathonStore.getState().getPlannerContext();
    expect(context).toEqual(expect.objectContaining({
      kind: 'messier-marathon',
      sessionId: 'session-1',
      sourceListId: 'list-1',
      sourcePlanId: 'plan-1',
      sourceExecutionId: 'execution-1',
      checkpointOrder: ['M74', 'M42'],
      criticalCheckpointIds: ['M74'],
    }));
  });

  it('can rewrite the remaining checkpoint order after a replan', () => {
    evaluateMessierMarathonSession.mockReturnValue(sessionFixture);

    act(() => {
      useMessierMarathonStore.getState().startSession({
        date: new Date('2026-03-21T12:00:00.000Z'),
        latitude: 35,
        longitude: -105,
      });
      useMessierMarathonStore.getState().rewriteRemainingOrder(['M42']);
    });

    expect(useMessierMarathonStore.getState().activeSession?.checkpoints.map((checkpoint) => checkpoint.targetId)).toEqual([
      'M42',
      'M74',
    ]);
  });

  it('resets only guide session state', () => {
    evaluateMessierMarathonSession.mockReturnValue(sessionFixture);

    act(() => {
      useMessierMarathonStore.getState().startSession({
        date: new Date('2026-03-21T12:00:00.000Z'),
        latitude: 35,
        longitude: -105,
      });
      useMessierMarathonStore.getState().resetGuide();
    });

    expect(useMessierMarathonStore.getState().activeSession).toBeNull();
    expect(useMessierMarathonStore.getState().lastCompletedSessionId).toBe('session-1');
  });
});
