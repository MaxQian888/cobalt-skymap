import { create } from 'zustand';
import {
  STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS,
  STARMAP_BOOTSTRAP_RESOURCES,
  type StarmapBootstrapOutcome,
  type StarmapBootstrapResourceId,
} from '@/lib/core/constants/starmap-bootstrap';
import { createLogger } from '@/lib/logger';

const logger = createLogger('starmap-bootstrap-store');

type BootstrapResourceState = 'pending' | 'loading' | 'ready' | 'failed';
type BootstrapStageClassification = 'blocking' | 'deferred';

export interface StarmapBootstrapResourceRuntime {
  id: StarmapBootstrapResourceId;
  label: string;
  tier: (typeof STARMAP_BOOTSTRAP_RESOURCES)[number]['tier'];
  critical: boolean;
  blocking: boolean;
  state: BootstrapResourceState;
  attempts: number;
  startedAt: number | null;
  endedAt: number | null;
  lastError: string | null;
}

export interface StarmapBootstrapDiagnostic {
  sessionId: string;
  stage: string;
  event:
    | 'session_start'
    | 'stage'
    | 'resource_loading'
    | 'resource_ready'
    | 'resource_retry'
    | 'resource_failed'
    | 'session_finalized'
    | 'recovery_requested'
    | 'warm_path_reused';
  timestamp: number;
  classification?: BootstrapStageClassification;
  attempt?: number;
  reason?: string;
  durationMs?: number;
}

interface StageEventMetadata {
  attempt?: number;
  reason?: string;
  classification?: BootstrapStageClassification;
  sessionId?: string;
}

interface ResourceMutationOptions {
  sessionId?: string;
}

export interface StarmapBootstrapStoreState {
  outcome: StarmapBootstrapOutcome;
  sessionId: string | null;
  sessionStartedAt: number | null;
  sessionEndedAt: number | null;
  firstInteractiveReadyAt: number | null;
  deferredWarmReadyAt: number | null;
  warmStartUsed: boolean;
  inFlight: boolean;
  recoveryNonce: number;
  resources: Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime>;
  diagnostics: StarmapBootstrapDiagnostic[];
  beginSession: () => string;
  markResourceLoading: (resourceId: StarmapBootstrapResourceId, options?: ResourceMutationOptions) => void;
  markResourceReady: (resourceId: StarmapBootstrapResourceId, options?: ResourceMutationOptions) => void;
  markResourceRetry: (
    resourceId: StarmapBootstrapResourceId,
    attempt: number,
    reason: string,
    options?: ResourceMutationOptions
  ) => void;
  markResourceFailed: (
    resourceId: StarmapBootstrapResourceId,
    reason: string,
    options?: ResourceMutationOptions
  ) => void;
  recordStageEvent: (stage: string, event: 'start' | 'complete' | 'failed', metadata?: StageEventMetadata) => void;
  requestRecovery: () => number;
  reset: () => void;
}

function createSessionId(): string {
  return `boot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createResourceMap(): Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime> {
  return STARMAP_BOOTSTRAP_RESOURCES.reduce((acc, resource) => {
    acc[resource.id] = {
      id: resource.id,
      label: resource.label,
      tier: resource.tier,
      critical: resource.critical,
      blocking: resource.blocking,
      state: 'pending',
      attempts: 0,
      startedAt: null,
      endedAt: null,
      lastError: null,
    };
    return acc;
  }, {} as Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime>);
}

function deriveOutcome(
  resources: Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime>
): StarmapBootstrapOutcome {
  const critical = STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS.map((id) => resources[id]);
  const optional = Object.values(resources).filter((resource) => !resource.critical);
  const readyCount = critical.filter((item) => item.state === 'ready').length;
  const failedCount = critical.filter((item) => item.state === 'failed').length;
  const allReady = readyCount === critical.length;
  const optionalFailure = optional.some((item) => item.state === 'failed');

  if (allReady) return optionalFailure ? 'degraded' : 'ready';
  if (failedCount === 0) return 'bootstrapping';
  if (readyCount === 0) return 'failed';
  return 'degraded';
}

function withSession(state: StarmapBootstrapStoreState): {
  nextState: Pick<
    StarmapBootstrapStoreState,
    | 'sessionId'
    | 'sessionStartedAt'
    | 'sessionEndedAt'
    | 'outcome'
    | 'inFlight'
    | 'resources'
    | 'firstInteractiveReadyAt'
    | 'deferredWarmReadyAt'
    | 'warmStartUsed'
  >;
  sessionId: string;
} {
  if (state.sessionId) {
    return {
      sessionId: state.sessionId,
      nextState: {
        sessionId: state.sessionId,
        sessionStartedAt: state.sessionStartedAt,
        sessionEndedAt: state.sessionEndedAt,
        outcome: state.outcome,
        inFlight: state.inFlight,
        resources: state.resources,
        firstInteractiveReadyAt: state.firstInteractiveReadyAt,
        deferredWarmReadyAt: state.deferredWarmReadyAt,
        warmStartUsed: state.warmStartUsed,
      },
    };
  }

  const sessionId = createSessionId();
  return {
    sessionId,
    nextState: {
      sessionId,
      sessionStartedAt: Date.now(),
      sessionEndedAt: null,
      outcome: 'bootstrapping',
      inFlight: true,
      resources: createResourceMap(),
      firstInteractiveReadyAt: null,
      deferredWarmReadyAt: null,
      warmStartUsed: false,
    },
  };
}

function createSessionStartDiagnostic(sessionId: string): StarmapBootstrapDiagnostic {
  return {
    sessionId,
    stage: 'session',
    event: 'session_start',
    timestamp: Date.now(),
  };
}

function getResourceClassification(resourceId: StarmapBootstrapResourceId): BootstrapStageClassification {
  const resource = STARMAP_BOOTSTRAP_RESOURCES.find((item) => item.id === resourceId);
  return resource?.blocking ? 'blocking' : 'deferred';
}

function inferStageClassification(stage: string): BootstrapStageClassification {
  if (stage.startsWith('cache_') || stage.includes('cache') || stage.startsWith('online_metadata')) {
    return 'deferred';
  }
  return 'blocking';
}

function resolveSessionGuard(
  state: StarmapBootstrapStoreState,
  options?: ResourceMutationOptions
): { ignored: true } | { ignored: false; sessionId: string; nextState: ReturnType<typeof withSession>['nextState'] } {
  if (options?.sessionId && state.sessionId && options.sessionId !== state.sessionId) {
    return { ignored: true };
  }

  const { sessionId, nextState } = withSession(state);
  if (options?.sessionId && sessionId !== options.sessionId) {
    return { ignored: true };
  }

  return { ignored: false, sessionId, nextState };
}

function areAllResourcesReady(
  resources: Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime>
): boolean {
  return Object.values(resources).every((resource) => resource.state === 'ready');
}

export const useStarmapBootstrapStore = create<StarmapBootstrapStoreState>((set, get) => ({
  outcome: 'idle',
  sessionId: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
  firstInteractiveReadyAt: null,
  deferredWarmReadyAt: null,
  warmStartUsed: false,
  inFlight: false,
  recoveryNonce: 0,
  resources: createResourceMap(),
  diagnostics: [],

  beginSession: () => {
    const existing = get();
    if (existing.sessionId && existing.inFlight && existing.outcome === 'bootstrapping') {
      return existing.sessionId;
    }

    const sessionId = createSessionId();
    const diagnostic = createSessionStartDiagnostic(sessionId);
    const warmStartUsed =
      existing.sessionId !== null &&
      (existing.outcome === 'ready' || existing.outcome === 'degraded') &&
      STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS.every((resourceId) => existing.resources[resourceId].state === 'ready');

    set((state) => ({
      ...state,
      outcome: 'bootstrapping',
      inFlight: true,
      sessionId,
      sessionStartedAt: diagnostic.timestamp,
      sessionEndedAt: null,
      firstInteractiveReadyAt: null,
      deferredWarmReadyAt: null,
      warmStartUsed,
      resources: createResourceMap(),
      diagnostics: [
        ...state.diagnostics,
        diagnostic,
        ...(warmStartUsed
          ? [{
              sessionId,
              stage: 'session',
              event: 'warm_path_reused' as const,
              timestamp: diagnostic.timestamp,
              classification: 'deferred' as const,
              reason: 'previous_ready_session',
            }]
          : []),
      ],
    }));

    logger.info('Starmap bootstrap session started', { sessionId });
    return sessionId;
  },

  markResourceLoading: (resourceId, options) => {
    set((state) => {
      const resolved = resolveSessionGuard(state, options);
      if (resolved.ignored) {
        return state;
      }

      const { sessionId, nextState } = resolved;
      const resource = nextState.resources[resourceId];
      const now = Date.now();

      nextState.resources = {
        ...nextState.resources,
        [resourceId]: {
          ...resource,
          state: 'loading',
          attempts: resource.attempts + 1,
          startedAt: resource.startedAt ?? now,
          lastError: null,
        },
      };

      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage: resourceId,
        event: 'resource_loading',
        timestamp: now,
        classification: getResourceClassification(resourceId),
        attempt: nextState.resources[resourceId].attempts,
      });

      return {
        ...state,
        ...nextState,
        diagnostics,
      };
    });
  },

  markResourceReady: (resourceId, options) => {
    set((state) => {
      const resolved = resolveSessionGuard(state, options);
      if (resolved.ignored) {
        return state;
      }

      const { sessionId, nextState } = resolved;
      const resource = nextState.resources[resourceId];
      const now = Date.now();
      const updatedResources = {
        ...nextState.resources,
        [resourceId]: {
          ...resource,
          state: 'ready',
          endedAt: now,
          lastError: null,
        },
      };
      const nextOutcome = deriveOutcome(updatedResources);
      const shouldFinalize = nextOutcome !== 'bootstrapping';
      const firstInteractiveReadyAt =
        nextOutcome !== 'bootstrapping' && nextState.firstInteractiveReadyAt === null
          ? now
          : nextState.firstInteractiveReadyAt;
      const deferredWarmReadyAt =
        areAllResourcesReady(updatedResources)
          ? now
          : nextState.deferredWarmReadyAt;

      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage: resourceId,
        event: 'resource_ready',
        timestamp: now,
        classification: getResourceClassification(resourceId),
        durationMs: resource.startedAt ? now - resource.startedAt : undefined,
      });
      if (shouldFinalize) {
        diagnostics.push({
          sessionId,
          stage: 'session',
          event: 'session_finalized',
          timestamp: now,
          classification: 'blocking',
          reason: nextOutcome,
        });
      }

      return {
        ...state,
        ...nextState,
        resources: updatedResources,
        outcome: nextOutcome,
        inFlight: !shouldFinalize,
        sessionEndedAt: shouldFinalize ? now : null,
        firstInteractiveReadyAt,
        deferredWarmReadyAt,
        diagnostics,
      };
    });
  },

  markResourceRetry: (resourceId, attempt, reason, options) => {
    set((state) => {
      const resolved = resolveSessionGuard(state, options);
      if (resolved.ignored) {
        return state;
      }

      const { sessionId, nextState } = resolved;
      const resource = nextState.resources[resourceId];
      const now = Date.now();
      nextState.resources = {
        ...nextState.resources,
        [resourceId]: {
          ...resource,
          state: 'loading',
          attempts: Math.max(resource.attempts, attempt),
          lastError: reason,
        },
      };

      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage: resourceId,
        event: 'resource_retry',
        timestamp: now,
        classification: getResourceClassification(resourceId),
        attempt,
        reason,
      });

      return {
        ...state,
        ...nextState,
        diagnostics,
      };
    });

    logger.warn('Starmap bootstrap resource retry scheduled', {
      resourceId,
      attempt,
      reason,
      sessionId: options?.sessionId ?? get().sessionId,
    });
  },

  markResourceFailed: (resourceId, reason, options) => {
    set((state) => {
      const resolved = resolveSessionGuard(state, options);
      if (resolved.ignored) {
        return state;
      }

      const { sessionId, nextState } = resolved;
      const resource = nextState.resources[resourceId];
      const now = Date.now();
      const updatedResources = {
        ...nextState.resources,
        [resourceId]: {
          ...resource,
          state: 'failed',
          endedAt: now,
          lastError: reason,
        },
      };
      const nextOutcome = deriveOutcome(updatedResources);
      const shouldFinalize = nextOutcome !== 'bootstrapping';

      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage: resourceId,
        event: 'resource_failed',
        timestamp: now,
        classification: getResourceClassification(resourceId),
        attempt: resource.attempts,
        reason,
        durationMs: resource.startedAt ? now - resource.startedAt : undefined,
      });
      if (shouldFinalize) {
        diagnostics.push({
          sessionId,
          stage: 'session',
          event: 'session_finalized',
          timestamp: now,
          classification: 'blocking',
          reason: nextOutcome,
        });
      }

      return {
        ...state,
        ...nextState,
        resources: updatedResources,
        outcome: nextOutcome,
        inFlight: !shouldFinalize,
        sessionEndedAt: shouldFinalize ? now : null,
        diagnostics,
      };
    });

    logger.error('Starmap bootstrap resource failed', {
      resourceId,
      reason,
      sessionId: options?.sessionId ?? get().sessionId,
    });
  },

  recordStageEvent: (stage, event, metadata) => {
    set((state) => {
      if (metadata?.sessionId && state.sessionId && metadata.sessionId !== state.sessionId) {
        return state;
      }
      const { sessionId, nextState } = withSession(state);
      if (metadata?.sessionId && sessionId !== metadata.sessionId) {
        return state;
      }
      const now = Date.now();
      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage,
        event: 'stage',
        timestamp: now,
        classification: metadata?.classification ?? inferStageClassification(stage),
        attempt: metadata?.attempt,
        reason: metadata?.reason ? `${event}:${metadata.reason}` : event,
      });

      return {
        ...state,
        ...nextState,
        diagnostics,
      };
    });
  },

  requestRecovery: () => {
    let nextNonce = 0;
    set((state) => {
      const previousSessionId = state.sessionId ?? createSessionId();
      const sessionId = createSessionId();
      nextNonce = state.recoveryNonce + 1;
      const now = Date.now();
      const resetResources = { ...state.resources };
      for (const resourceId of STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS) {
        const resource = resetResources[resourceId];
        if (resource.state !== 'ready') {
          resetResources[resourceId] = {
            ...resource,
            state: 'pending',
            endedAt: null,
            lastError: null,
          };
        }
      }

      return {
        ...state,
        outcome: 'bootstrapping',
        inFlight: true,
        sessionId,
        sessionStartedAt: now,
        sessionEndedAt: null,
        firstInteractiveReadyAt: null,
        deferredWarmReadyAt: null,
        warmStartUsed: false,
        resources: resetResources,
        recoveryNonce: nextNonce,
        diagnostics: [
          ...state.diagnostics,
          {
            sessionId: previousSessionId,
            stage: 'session',
            event: 'recovery_requested',
            timestamp: now,
            classification: 'blocking',
            attempt: nextNonce,
          },
          createSessionStartDiagnostic(sessionId),
        ],
      };
    });
    logger.warn('Starmap bootstrap recovery requested', { recoveryNonce: nextNonce });
    return nextNonce;
  },

  reset: () => {
    set({
      outcome: 'idle',
      sessionId: null,
      sessionStartedAt: null,
      sessionEndedAt: null,
      firstInteractiveReadyAt: null,
      deferredWarmReadyAt: null,
      warmStartUsed: false,
      inFlight: false,
      recoveryNonce: 0,
      resources: createResourceMap(),
      diagnostics: [],
    });
  },
}));
