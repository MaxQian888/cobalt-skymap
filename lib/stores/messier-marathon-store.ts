import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import {
  evaluateMessierMarathonSession,
  updateMessierMarathonCheckpointStatus,
} from '@/lib/messier-marathon';
import type {
  EvaluateMessierMarathonOptions,
  MessierMarathonCheckpointStatus,
  MessierMarathonGuideSession,
  MessierMarathonPlannerContext,
} from '@/lib/messier-marathon';

interface LinkPlannerOptions {
  sourceListId?: string;
  sourcePlanId?: string;
}

interface MessierMarathonStoreState {
  activeSession: MessierMarathonGuideSession | null;
  lastCompletedSessionId: string | null;
  startSession: (
    options: EvaluateMessierMarathonOptions,
  ) => MessierMarathonGuideSession;
  hydrateSession: (session: MessierMarathonGuideSession) => void;
  resumeSession: () => MessierMarathonGuideSession | null;
  updateCheckpointStatus: (
    targetId: string,
    status: MessierMarathonCheckpointStatus,
  ) => void;
  linkPlanner: (options: LinkPlannerOptions) => void;
  linkExecution: (executionId: string) => void;
  rewriteRemainingOrder: (targetIds: string[]) => void;
  getPlannerContext: () => MessierMarathonPlannerContext | null;
  resetGuide: () => void;
}

function withUpdatedSession(
  session: MessierMarathonGuideSession,
  updates: Partial<MessierMarathonGuideSession>,
): MessierMarathonGuideSession {
  return {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

function buildPlannerContext(
  session: MessierMarathonGuideSession | null,
): MessierMarathonPlannerContext | null {
  if (!session) return null;
  return {
    kind: 'messier-marathon',
    sessionId: session.sessionId,
    readiness: session.readiness,
    mode: session.recovery.mode,
    checkpointOrder: session.checkpoints.map((checkpoint) => checkpoint.targetId),
    criticalCheckpointIds: session.checkpoints
      .filter((checkpoint) => checkpoint.critical)
      .map((checkpoint) => checkpoint.targetId),
    stageByTargetId: session.checkpoints.reduce<Record<string, MessierMarathonPlannerContext['stageByTargetId'][string]>>((accumulator, checkpoint) => {
      accumulator[checkpoint.targetId] = checkpoint.stageId;
      return accumulator;
    }, {}),
    sourceListId: session.sourceListId,
    sourcePlanId: session.sourcePlanId,
    sourceExecutionId: session.sourceExecutionId,
  };
}

function rewriteCheckpointOrder(
  session: MessierMarathonGuideSession,
  targetIds: string[],
): MessierMarathonGuideSession {
  const indexByTargetId = new Map(targetIds.map((targetId, index) => [targetId, index]));
  const reordered = [...session.checkpoints].sort((left, right) => {
    const leftIndex = indexByTargetId.get(left.targetId);
    const rightIndex = indexByTargetId.get(right.targetId);
    if (leftIndex != null && rightIndex != null) return leftIndex - rightIndex;
    if (leftIndex != null) return -1;
    if (rightIndex != null) return 1;
    return left.order - right.order;
  }).map((checkpoint, index) => ({
    ...checkpoint,
    order: index + 1,
  }));

  return withUpdatedSession(session, {
    checkpoints: reordered,
    recovery: {
      ...session.recovery,
      nextCheckpointId:
        reordered.find((checkpoint) => checkpoint.status === 'pending')?.targetId
        ?? null,
      nextStageId:
        reordered.find((checkpoint) => checkpoint.status === 'pending')?.stageId
        ?? null,
      catchUpTargetIds: reordered
        .filter((checkpoint) => checkpoint.status === 'pending')
        .slice(0, 3)
        .map((checkpoint) => checkpoint.targetId),
      updatedAt: new Date().toISOString(),
    },
    stages: session.stages.map((stage) => ({
      ...stage,
      checkpointIds: reordered
        .filter((checkpoint) => checkpoint.stageId === stage.id)
        .map((checkpoint) => checkpoint.targetId),
    })),
  });
}

export const useMessierMarathonStore = create<MessierMarathonStoreState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      lastCompletedSessionId: null,

      startSession: (options) => {
        const session = evaluateMessierMarathonSession(options);
        set({ activeSession: session });
        return session;
      },

      hydrateSession: (session) => {
        set({ activeSession: session });
      },

      resumeSession: () => get().activeSession,

      updateCheckpointStatus: (targetId, status) => {
        const current = get().activeSession;
        if (!current) return;
        set({
          activeSession: updateMessierMarathonCheckpointStatus(
            current,
            targetId,
            status,
          ),
        });
      },

      linkPlanner: ({ sourceListId, sourcePlanId }) => {
        const current = get().activeSession;
        if (!current) return;
        set({
          activeSession: withUpdatedSession(current, {
            sourceListId: sourceListId ?? current.sourceListId,
            sourcePlanId: sourcePlanId ?? current.sourcePlanId,
          }),
        });
      },

      linkExecution: (executionId) => {
        const current = get().activeSession;
        if (!current) return;
        set({
          activeSession: withUpdatedSession(current, {
            sourceExecutionId: executionId,
          }),
        });
      },

      rewriteRemainingOrder: (targetIds) => {
        const current = get().activeSession;
        if (!current) return;
        set({
          activeSession: rewriteCheckpointOrder(current, targetIds),
        });
      },

      getPlannerContext: () => buildPlannerContext(get().activeSession),

      resetGuide: () => {
        const current = get().activeSession;
        set({
          activeSession: null,
          lastCompletedSessionId: current?.sessionId ?? get().lastCompletedSessionId,
        });
      },
    }),
    {
      name: 'starmap-messier-marathon',
      version: 1,
      storage: getZustandStorage(),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<MessierMarathonStoreState>;
        return {
          activeSession: state.activeSession ?? null,
          lastCompletedSessionId: state.lastCompletedSessionId ?? null,
        } satisfies Partial<MessierMarathonStoreState>;
      },
      partialize: (state) => ({
        activeSession: state.activeSession,
        lastCompletedSessionId: state.lastCompletedSessionId,
      }),
    },
  ),
);
