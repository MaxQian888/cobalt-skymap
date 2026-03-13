import type { ObservationSession } from '@/lib/tauri/types';
import type { PlannedSessionExecution } from '@/types/starmap/session-planner-v2';
import {
  applyExecutionSessionStatusAction,
  applyExecutionTargetStatusAction,
  buildExecutionWorkspaceViewModel,
} from '../session-execution-helpers';

function makeExecution(
  overrides: Partial<PlannedSessionExecution> = {},
): PlannedSessionExecution {
  return {
    id: 'execution-1',
    sourcePlanId: 'plan-1',
    sourcePlanName: 'Tonight Plan',
    status: 'active',
    planDate: '2025-06-15',
    createdAt: '2025-06-15T19:00:00.000Z',
    updatedAt: '2025-06-15T19:00:00.000Z',
    targets: [
      {
        id: 'exec-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:00:00.000Z',
        scheduledEnd: '2025-06-15T21:00:00.000Z',
        scheduledDurationMinutes: 60,
        order: 1,
        status: 'completed',
        observationIds: ['obs-1'],
        actualStart: '2025-06-15T20:00:00.000Z',
        actualEnd: '2025-06-15T21:00:00.000Z',
      },
      {
        id: 'exec-target-2',
        targetId: 'target-2',
        targetName: 'NGC 7000',
        scheduledStart: '2025-06-15T21:30:00.000Z',
        scheduledEnd: '2025-06-15T22:30:00.000Z',
        scheduledDurationMinutes: 60,
        order: 2,
        status: 'in_progress',
        observationIds: [],
      },
      {
        id: 'exec-target-3',
        targetId: 'target-3',
        targetName: 'M45',
        scheduledStart: '2025-06-15T23:00:00.000Z',
        scheduledEnd: '2025-06-16T00:00:00.000Z',
        scheduledDurationMinutes: 60,
        order: 3,
        status: 'planned',
        observationIds: [],
      },
      {
        id: 'exec-target-4',
        targetId: 'target-4',
        targetName: 'IC 1396',
        scheduledStart: '2025-06-16T00:30:00.000Z',
        scheduledEnd: '2025-06-16T01:30:00.000Z',
        scheduledDurationMinutes: 60,
        order: 4,
        status: 'failed',
        observationIds: [],
      },
    ],
    ...overrides,
  };
}

function makeObservationSession(
  overrides: Partial<ObservationSession> = {},
): ObservationSession {
  return {
    id: 'session-1',
    date: '2025-06-15',
    observations: [],
    equipment_ids: [],
    source_plan_id: 'plan-1',
    source_plan_name: 'Tonight Plan',
    execution_status: 'active',
    execution_targets: [
      {
        id: 'exec-target-1',
        target_id: 'target-1',
        target_name: 'M31',
        scheduled_start: '2025-06-15T20:00:00.000Z',
        scheduled_end: '2025-06-15T21:00:00.000Z',
        scheduled_duration_minutes: 60,
        order: 1,
        status: 'planned',
        observation_ids: [],
      },
    ],
    created_at: '2025-06-15T19:00:00.000Z',
    updated_at: '2025-06-15T19:00:00.000Z',
    ...overrides,
  };
}

describe('session-execution-helpers', () => {
  it('derives execution summary, focus target, and allowed actions for active executions', () => {
    const model = buildExecutionWorkspaceViewModel(makeExecution());

    expect(model.summary.completedTargets).toBe(1);
    expect(model.summary.failedTargets).toBe(1);
    expect(model.summary.remainingTargets).toBe(2);
    expect(model.summary.totalObservations).toBe(1);
    expect(model.activeTarget?.targetId).toBe('target-2');
    expect(model.nextTarget?.targetId).toBe('target-3');
    expect(model.focusTarget?.targetId).toBe('target-2');
    expect(model.canResume).toBe(true);
    expect(model.canReplan).toBe(true);
    expect(model.canArchive).toBe(false);
    expect(model.targetActions['target-3']).toEqual(['start', 'skip', 'fail', 'observe']);
    expect(model.targetActions['target-2']).toEqual(['complete', 'skip', 'fail', 'observe']);
  });

  it('marks completed executions as archivable and not resumable', () => {
    const model = buildExecutionWorkspaceViewModel(makeExecution({
      status: 'completed',
      targets: makeExecution().targets.map((target) => ({
        ...target,
        status: target.status === 'planned' || target.status === 'in_progress' ? 'completed' : target.status,
      })),
    }));

    expect(model.summary.remainingTargets).toBe(0);
    expect(model.canResume).toBe(false);
    expect(model.canReplan).toBe(false);
    expect(model.canArchive).toBe(true);
    expect(model.canReview).toBe(true);
    expect(model.focusTarget).toBeNull();
  });

  it('persists target status changes through the tauri mutation path and syncs local execution state', async () => {
    const session = makeObservationSession();
    const persistSession = jest.fn(async (nextSession: ObservationSession) => nextSession);
    const syncExecutionFromObservationSession = jest.fn();

    await applyExecutionTargetStatusAction({
      runtime: 'tauri',
      executionId: 'execution-1',
      targetId: 'target-1',
      nextStatus: 'completed',
      observationSession: session,
      persistSession,
      syncExecutionFromObservationSession,
      storeActions: {
        updateExecutionTarget: jest.fn(),
        completeExecution: jest.fn(),
        archiveExecution: jest.fn(),
      },
      now: '2025-06-15T21:00:00.000Z',
    });

    expect(persistSession).toHaveBeenCalledWith(expect.objectContaining({
      execution_status: 'completed',
      execution_summary: expect.objectContaining({
        completed_targets: 1,
        total_targets: 1,
      }),
      execution_targets: expect.arrayContaining([
        expect.objectContaining({
          target_id: 'target-1',
          status: 'completed',
          actual_end: '2025-06-15T21:00:00.000Z',
        }),
      ]),
    }));
    expect(syncExecutionFromObservationSession).toHaveBeenCalledWith(expect.objectContaining({
      id: 'session-1',
      execution_status: 'completed',
    }));
  });

  it('updates execution targets directly through the web mutation path', async () => {
    const updateExecutionTarget = jest.fn();

    await applyExecutionTargetStatusAction({
      runtime: 'web',
      executionId: 'execution-1',
      targetId: 'target-2',
      nextStatus: 'failed',
      storeActions: {
        updateExecutionTarget,
        completeExecution: jest.fn(),
        archiveExecution: jest.fn(),
      },
    });

    expect(updateExecutionTarget).toHaveBeenCalledWith('execution-1', 'target-2', {
      status: 'failed',
    });
  });

  it('archives completed executions through the web session-action path', async () => {
    const archiveExecution = jest.fn();

    await applyExecutionSessionStatusAction({
      runtime: 'web',
      executionId: 'execution-1',
      nextStatus: 'archived',
      storeActions: {
        updateExecutionTarget: jest.fn(),
        completeExecution: jest.fn(),
        archiveExecution,
      },
    });

    expect(archiveExecution).toHaveBeenCalledWith('execution-1');
  });
});
