import type {
  ObservationExecutionStatus,
  ObservationExecutionSummary,
  ObservationExecutionTarget,
  ObservationExecutionTargetStatus,
  ObservationSession,
} from '@/lib/tauri/types';
import type {
  ExecutionSummary,
  ExecutionTargetStatus,
  PlannedSessionExecution,
  PlannedSessionExecutionTarget,
  SessionExecutionStatus,
} from '@/types/starmap/session-planner-v2';
import type { SessionPlanState } from './session-plan-store';

export type ExecutionWorkspaceTargetAction = 'start' | 'complete' | 'skip' | 'fail' | 'observe';

export interface ExecutionWorkspaceSummary extends ExecutionSummary {
  remainingTargets: number;
  completionRatio: number;
}

export interface ExecutionWorkspaceViewModel {
  summary: ExecutionWorkspaceSummary;
  activeTarget: PlannedSessionExecutionTarget | null;
  nextTarget: PlannedSessionExecutionTarget | null;
  focusTarget: PlannedSessionExecutionTarget | null;
  remainingTargets: PlannedSessionExecutionTarget[];
  targetActions: Record<string, ExecutionWorkspaceTargetAction[]>;
  canResume: boolean;
  canReplan: boolean;
  canArchive: boolean;
  canReview: boolean;
}

type StoreExecutionActions = Pick<
  SessionPlanState,
  'updateExecutionTarget' | 'completeExecution' | 'archiveExecution'
>;

interface ApplyExecutionTargetStatusActionOptions {
  runtime: 'tauri' | 'web';
  executionId: string;
  targetId: string;
  nextStatus: ExecutionTargetStatus;
  observationSession?: ObservationSession;
  persistSession?: (session: ObservationSession) => Promise<ObservationSession | void>;
  syncExecutionFromObservationSession?: (session: ObservationSession) => string | null;
  storeActions: StoreExecutionActions;
  now?: string;
}

interface ApplyExecutionSessionStatusActionOptions {
  runtime: 'tauri' | 'web';
  executionId: string;
  nextStatus: SessionExecutionStatus;
  observationSession?: ObservationSession;
  persistSession?: (session: ObservationSession) => Promise<ObservationSession | void>;
  syncExecutionFromObservationSession?: (session: ObservationSession) => string | null;
  storeActions: StoreExecutionActions;
  now?: string;
}

const TERMINAL_TARGET_STATUSES = new Set<ExecutionTargetStatus>(['completed', 'skipped', 'failed']);

function buildExecutionSummaryFromTargets(
  targets: Array<{ status: ExecutionTargetStatus; observationIds: string[] }>,
): ExecutionSummary {
  const completedTargets = targets.filter((target) => target.status === 'completed').length;
  const skippedTargets = targets.filter((target) => target.status === 'skipped').length;
  const failedTargets = targets.filter((target) => target.status === 'failed').length;
  return {
    completedTargets,
    skippedTargets,
    failedTargets,
    totalTargets: targets.length,
    totalObservations: targets.reduce((sum, target) => sum + target.observationIds.length, 0),
  };
}

function buildObservationExecutionSummary(
  targets: ObservationExecutionTarget[],
): ObservationExecutionSummary {
  const summary = buildExecutionSummaryFromTargets(targets.map((target) => ({
    status: target.status as ExecutionTargetStatus,
    observationIds: target.observation_ids,
  })));

  return {
    completed_targets: summary.completedTargets,
    skipped_targets: summary.skippedTargets,
    failed_targets: summary.failedTargets,
    total_targets: summary.totalTargets,
    total_observations: summary.totalObservations,
  };
}

function resolveObservationExecutionStatus(
  previousStatus: ObservationExecutionStatus | undefined,
  targets: ObservationExecutionTarget[],
): ObservationExecutionStatus {
  if (previousStatus === 'archived' || previousStatus === 'cancelled') {
    return previousStatus;
  }
  if (targets.length > 0 && targets.every((target) => TERMINAL_TARGET_STATUSES.has(target.status as ExecutionTargetStatus))) {
    return 'completed';
  }
  if (
    previousStatus === 'active'
    || targets.some((target) => target.status === 'in_progress')
    || targets.some((target) => TERMINAL_TARGET_STATUSES.has(target.status as ExecutionTargetStatus))
  ) {
    return 'active';
  }
  return previousStatus === 'draft' ? 'draft' : 'ready';
}

function getTargetActions(status: ExecutionTargetStatus): ExecutionWorkspaceTargetAction[] {
  if (status === 'planned') return ['start', 'skip', 'fail', 'observe'];
  if (status === 'in_progress') return ['complete', 'skip', 'fail', 'observe'];
  return ['observe'];
}

export function buildExecutionWorkspaceViewModel(
  execution: PlannedSessionExecution | null | undefined,
): ExecutionWorkspaceViewModel {
  if (!execution) {
    return {
      summary: {
        completedTargets: 0,
        skippedTargets: 0,
        failedTargets: 0,
        totalTargets: 0,
        totalObservations: 0,
        remainingTargets: 0,
        completionRatio: 0,
      },
      activeTarget: null,
      nextTarget: null,
      focusTarget: null,
      remainingTargets: [],
      targetActions: {},
      canResume: false,
      canReplan: false,
      canArchive: false,
      canReview: false,
    };
  }

  const orderedTargets = [...execution.targets].sort((left, right) => left.order - right.order);
  const summary = execution.summary ?? buildExecutionSummaryFromTargets(orderedTargets);
  const remainingTargets = orderedTargets.filter((target) => !TERMINAL_TARGET_STATUSES.has(target.status));
  const activeTarget = orderedTargets.find((target) => target.status === 'in_progress') ?? null;
  const nextTarget = orderedTargets.find((target) => target.status === 'planned') ?? null;
  const targetActions = Object.fromEntries(
    orderedTargets.map((target) => [target.targetId, getTargetActions(target.status)]),
  );
  const canResume = execution.status === 'ready' || execution.status === 'active';
  const canReplan = canResume && remainingTargets.length > 0;
  const canArchive = execution.status === 'completed' || execution.status === 'cancelled';
  const canReview = execution.status !== 'archived' && orderedTargets.length > 0;

  return {
    summary: {
      ...summary,
      remainingTargets: remainingTargets.length,
      completionRatio: summary.totalTargets === 0
        ? 0
        : (summary.completedTargets + summary.skippedTargets + summary.failedTargets) / summary.totalTargets,
    },
    activeTarget,
    nextTarget,
    focusTarget: activeTarget ?? nextTarget,
    remainingTargets,
    targetActions,
    canResume,
    canReplan,
    canArchive,
    canReview,
  };
}

export function buildObservationExecutionWorkspaceViewModel(
  session: ObservationSession | null | undefined,
): ExecutionWorkspaceViewModel {
  if (!session?.execution_targets?.length) {
    return buildExecutionWorkspaceViewModel(null);
  }

  return buildExecutionWorkspaceViewModel({
    id: session.id,
    sourcePlanId: session.source_plan_id ?? session.id,
    sourcePlanName: session.source_plan_name ?? 'Observation Session',
    status: (session.execution_status ?? 'active') as SessionExecutionStatus,
    planDate: session.date,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    startedAt: session.start_time,
    endedAt: session.end_time,
    summary: session.execution_summary
      ? {
          completedTargets: session.execution_summary.completed_targets,
          skippedTargets: session.execution_summary.skipped_targets,
          failedTargets: session.execution_summary.failed_targets,
          totalTargets: session.execution_summary.total_targets,
          totalObservations: session.execution_summary.total_observations,
        }
      : undefined,
    targets: session.execution_targets.map((target) => ({
      id: target.id,
      targetId: target.target_id,
      targetName: target.target_name,
      scheduledStart: target.scheduled_start,
      scheduledEnd: target.scheduled_end,
      scheduledDurationMinutes: target.scheduled_duration_minutes,
      order: target.order,
      status: target.status as ExecutionTargetStatus,
      observationIds: target.observation_ids,
      actualStart: target.actual_start,
      actualEnd: target.actual_end,
      resultNotes: target.result_notes,
      skipReason: target.skip_reason,
      completionSummary: target.completion_summary,
      unplanned: target.unplanned,
    })),
  });
}

function applyTargetStatusToObservationSession(
  session: ObservationSession,
  targetId: string,
  nextStatus: ObservationExecutionTargetStatus,
  now: string,
): ObservationSession {
  const executionTargets = (session.execution_targets ?? []).map((target) => {
    if (target.target_id !== targetId) return target;
    return {
      ...target,
      status: nextStatus,
      actual_start: nextStatus === 'in_progress' ? (target.actual_start ?? now) : target.actual_start,
      actual_end: TERMINAL_TARGET_STATUSES.has(nextStatus as ExecutionTargetStatus)
        ? (target.actual_end ?? now)
        : target.actual_end,
    };
  });

  return {
    ...session,
    execution_targets: executionTargets,
    execution_summary: buildObservationExecutionSummary(executionTargets),
    execution_status: resolveObservationExecutionStatus(session.execution_status, executionTargets),
    updated_at: now,
  };
}

export async function applyExecutionTargetStatusAction({
  runtime,
  executionId,
  targetId,
  nextStatus,
  observationSession,
  persistSession,
  syncExecutionFromObservationSession,
  storeActions,
  now = new Date().toISOString(),
}: ApplyExecutionTargetStatusActionOptions): Promise<ObservationSession | null> {
  if (runtime === 'tauri' && observationSession && persistSession && syncExecutionFromObservationSession) {
    const nextSession = applyTargetStatusToObservationSession(
      observationSession,
      targetId,
      nextStatus as ObservationExecutionTargetStatus,
      now,
    );
    const persistedSession = await persistSession(nextSession);
    const normalizedSession = persistedSession && 'id' in persistedSession ? persistedSession : nextSession;
    syncExecutionFromObservationSession(normalizedSession);
    return normalizedSession;
  }

  storeActions.updateExecutionTarget(executionId, targetId, {
    status: nextStatus,
  });
  return null;
}

export async function applyExecutionSessionStatusAction({
  runtime,
  executionId,
  nextStatus,
  observationSession,
  persistSession,
  syncExecutionFromObservationSession,
  storeActions,
  now = new Date().toISOString(),
}: ApplyExecutionSessionStatusActionOptions): Promise<ObservationSession | null> {
  if (runtime === 'tauri' && observationSession && persistSession && syncExecutionFromObservationSession) {
    const nextSession: ObservationSession = {
      ...observationSession,
      execution_status: nextStatus as ObservationExecutionStatus,
      execution_summary: observationSession.execution_summary
        ?? buildObservationExecutionSummary(observationSession.execution_targets ?? []),
      updated_at: now,
    };
    const persistedSession = await persistSession(nextSession);
    const normalizedSession = persistedSession && 'id' in persistedSession ? persistedSession : nextSession;
    syncExecutionFromObservationSession(normalizedSession);
    return normalizedSession;
  }

  if (nextStatus === 'completed') {
    storeActions.completeExecution(executionId);
  }
  if (nextStatus === 'archived') {
    storeActions.archiveExecution(executionId);
  }
  return null;
}
