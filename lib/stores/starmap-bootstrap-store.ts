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

export interface StarmapBootstrapResourceRuntime {
  id: StarmapBootstrapResourceId;
  label: string;
  tier: (typeof STARMAP_BOOTSTRAP_RESOURCES)[number]['tier'];
  critical: boolean;
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
    | 'recovery_requested';
  timestamp: number;
  attempt?: number;
  reason?: string;
}

interface StageEventMetadata {
  attempt?: number;
  reason?: string;
}

export interface StarmapBootstrapStoreState {
  outcome: StarmapBootstrapOutcome;
  sessionId: string | null;
  sessionStartedAt: number | null;
  sessionEndedAt: number | null;
  inFlight: boolean;
  recoveryNonce: number;
  resources: Record<StarmapBootstrapResourceId, StarmapBootstrapResourceRuntime>;
  diagnostics: StarmapBootstrapDiagnostic[];
  beginSession: () => string;
  markResourceLoading: (resourceId: StarmapBootstrapResourceId) => void;
  markResourceReady: (resourceId: StarmapBootstrapResourceId) => void;
  markResourceRetry: (resourceId: StarmapBootstrapResourceId, attempt: number, reason: string) => void;
  markResourceFailed: (resourceId: StarmapBootstrapResourceId, reason: string) => void;
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
    'sessionId' | 'sessionStartedAt' | 'sessionEndedAt' | 'outcome' | 'inFlight' | 'resources'
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

export const useStarmapBootstrapStore = create<StarmapBootstrapStoreState>((set, get) => ({
  outcome: 'idle',
  sessionId: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
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

    set((state) => ({
      ...state,
      outcome: 'bootstrapping',
      inFlight: true,
      sessionId,
      sessionStartedAt: diagnostic.timestamp,
      sessionEndedAt: null,
      resources: createResourceMap(),
      diagnostics: [...state.diagnostics, diagnostic],
    }));

    logger.info('Starmap bootstrap session started', { sessionId });
    return sessionId;
  },

  markResourceLoading: (resourceId) => {
    set((state) => {
      const { sessionId, nextState } = withSession(state);
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
        attempt: nextState.resources[resourceId].attempts,
      });

      return {
        ...state,
        ...nextState,
        diagnostics,
      };
    });
  },

  markResourceReady: (resourceId) => {
    set((state) => {
      const { sessionId, nextState } = withSession(state);
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

      const diagnostics = [...state.diagnostics];
      if (sessionId !== state.sessionId) {
        diagnostics.push(createSessionStartDiagnostic(sessionId));
      }
      diagnostics.push({
        sessionId,
        stage: resourceId,
        event: 'resource_ready',
        timestamp: now,
      });
      if (shouldFinalize) {
        diagnostics.push({
          sessionId,
          stage: 'session',
          event: 'session_finalized',
          timestamp: now,
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
  },

  markResourceRetry: (resourceId, attempt, reason) => {
    set((state) => {
      const { sessionId, nextState } = withSession(state);
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
      sessionId: get().sessionId,
    });
  },

  markResourceFailed: (resourceId, reason) => {
    set((state) => {
      const { sessionId, nextState } = withSession(state);
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
        attempt: resource.attempts,
        reason,
      });
      if (shouldFinalize) {
        diagnostics.push({
          sessionId,
          stage: 'session',
          event: 'session_finalized',
          timestamp: now,
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
      sessionId: get().sessionId,
    });
  },

  recordStageEvent: (stage, event, metadata) => {
    set((state) => {
      const { sessionId, nextState } = withSession(state);
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
      const sessionId = state.sessionId ?? createSessionId();
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
        sessionStartedAt: state.sessionStartedAt ?? now,
        sessionEndedAt: null,
        resources: resetResources,
        recoveryNonce: nextNonce,
        diagnostics: [
          ...state.diagnostics,
          {
            sessionId,
            stage: 'session',
            event: 'recovery_requested',
            timestamp: now,
            attempt: nextNonce,
          },
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
      inFlight: false,
      recoveryNonce: 0,
      resources: createResourceMap(),
      diagnostics: [],
    });
  },
}));
