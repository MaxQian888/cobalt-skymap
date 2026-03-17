import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { createLogger } from '@/lib/logger';
import { normalizeSessionDraft, validateSessionDraft } from '@/lib/astronomy/session-draft-validator';
import type { OptimizationStrategy } from '@/types/starmap/planning';
import type {
  ExecutionSummary,
  ExecutionTargetStatus,
  PlannedSessionExecution,
  PlannedSessionExecutionTarget,
  SessionDraftV2,
  SessionExecutionStatus,
  SessionTemplate,
  SessionWeatherSnapshot,
} from '@/types/starmap/session-planner-v2';
export type {
  PlannedSessionExecution,
  PlannedSessionExecutionTarget,
} from '@/types/starmap/session-planner-v2';

const logger = createLogger('session-plan-store');

// ============================================================================
// Types
// ============================================================================

export interface SavedScheduledTarget {
  targetId: string;
  targetName: string;
  ra: number;
  dec: number;
  startTime: string; // ISO string for serialization
  endTime: string;
  duration: number;
  maxAltitude: number;
  moonDistance: number;
  feasibilityScore: number;
  order: number;
}

export interface SavedSessionPlan {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  // Planning parameters
  planDate: string;
  latitude: number;
  longitude: number;
  strategy: OptimizationStrategy;
  minAltitude: number;
  minImagingTime: number;
  /** Full constraint snapshot (preferred for restoring UI). */
  constraints?: SessionDraftV2['constraints'];
  /** UI planning mode at time of saving. */
  planningMode?: 'auto' | 'manual';
  // Results snapshot
  targets: SavedScheduledTarget[];
  excludedTargetIds: string[];
  totalImagingTime: number;
  nightCoverage: number;
  efficiency: number;
  notes?: string;
  weatherSnapshot?: SessionWeatherSnapshot;
  manualEdits?: SessionDraftV2['manualEdits'];
  guideContext?: SessionDraftV2['guideContext'];
}

export interface SavedSessionTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  draft: SessionDraftV2;
}

export type PlannerDraftRecoverySource = 'planner-close' | 'app-close' | 'seed-conflict';

export interface PlannerDraftRecoverySnapshot {
  draft: SessionDraftV2;
  updatedAt: string;
  source: PlannerDraftRecoverySource;
  relatedPlanId?: string;
  relatedPlanName?: string;
  dirtyFingerprint?: string;
}

export interface PlannerImportDiagnostics {
  format: 'json' | 'csv' | 'nina-xml' | 'sgp-csv';
  unmatchedTargets: string[];
  createdTargets: string[];
  skippedRows: number;
  warnings: string[];
}

export interface PlannerImportRecord {
  id: string;
  importedAt: string;
  source: 'file' | 'cli';
  sourcePath?: string;
  linkedPlanId?: string;
  linkedPlanName?: string;
  draft: SessionDraftV2;
  diagnostics: PlannerImportDiagnostics;
}

interface CreateExecutionContext {
  locationId?: string;
  locationName?: string;
  status?: SessionExecutionStatus;
}

interface ExecutionTargetSnapshot {
  id: string;
  target_id: string;
  target_name: string;
  scheduled_start: string;
  scheduled_end: string;
  scheduled_duration_minutes: number;
  order: number;
  status: ExecutionTargetStatus;
  observation_ids?: string[];
  actual_start?: string;
  actual_end?: string;
  result_notes?: string;
  skip_reason?: string;
  completion_summary?: string;
  unplanned?: boolean;
}

interface ExecutionSummarySnapshot {
  completed_targets: number;
  skipped_targets: number;
  failed_targets: number;
  total_targets: number;
  total_observations: number;
}

interface ExecutionSessionSnapshot {
  id: string;
  date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  start_time?: string;
  end_time?: string;
  source_plan_id?: string;
  source_plan_name?: string;
  execution_status?: SessionExecutionStatus;
  weather_snapshot?: unknown;
  execution_summary?: ExecutionSummarySnapshot;
  execution_targets?: ExecutionTargetSnapshot[];
}

export interface SessionPlanState {
  savedPlans: SavedSessionPlan[];
  templates: SavedSessionTemplate[];
  activePlanId: string | null;
  executions: PlannedSessionExecution[];
  activeExecutionId: string | null;
  draftRecovery: PlannerDraftRecoverySnapshot | null;
  recentImports: PlannerImportRecord[];

  // Actions
  savePlan: (plan: Omit<SavedSessionPlan, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updatePlan: (id: string, updates: Partial<Omit<SavedSessionPlan, 'id' | 'createdAt'>>) => void;
  deletePlan: (id: string) => void;
  setActivePlan: (id: string | null) => void;
  getActivePlan: () => SavedSessionPlan | null;
  getPlanById: (id: string) => SavedSessionPlan | undefined;
  renamePlan: (id: string, name: string) => void;
  duplicatePlan: (id: string) => string | null;
  importPlanV2: (draft: SessionDraftV2, name?: string) => string;
  saveTemplate: (template: Omit<SessionTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string;
  loadTemplate: (id: string) => SavedSessionTemplate | undefined;
  renameTemplate: (id: string, name: string) => void;
  duplicateTemplate: (id: string) => string | null;
  deleteTemplate: (id: string) => void;
  listTemplates: () => SavedSessionTemplate[];
  saveDraftRecovery: (
    draft: SessionDraftV2,
    metadata?: Omit<Partial<PlannerDraftRecoverySnapshot>, 'draft' | 'updatedAt'>,
  ) => void;
  clearDraftRecovery: () => void;
  addImportRecord: (record: Omit<PlannerImportRecord, 'id' | 'importedAt' | 'draft'> & {
    draft: SessionDraftV2;
  }) => string;
  dismissImportRecord: (id: string) => void;
  clearImportRecords: () => void;
  createExecutionFromPlan: (plan: SavedSessionPlan, context?: CreateExecutionContext) => string;
  setActiveExecution: (id: string | null) => void;
  getActiveExecution: () => PlannedSessionExecution | null;
  getExecutionById: (id: string) => PlannedSessionExecution | undefined;
  syncExecutionFromObservationSession: (session: ExecutionSessionSnapshot) => string | null;
  updateExecutionTarget: (
    executionId: string,
    targetId: string,
    updates: Partial<PlannedSessionExecutionTarget>,
  ) => void;
  attachObservationToExecutionTarget: (
    executionId: string,
    targetId: string,
    observationId: string,
  ) => void;
  completeExecution: (executionId: string, summary?: ExecutionSummary) => void;
  archiveExecution: (executionId: string) => void;
}

// ============================================================================
// Store
// ============================================================================

/** Maximum number of saved session plans to retain */
const MAX_SAVED_PLANS = 50;
const MAX_SAVED_TEMPLATES = 50;
const MAX_RECENT_IMPORTS = 10;

function generatePlanId(): string {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateTemplateId(): string {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateExecutionId(): string {
  return `execution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateImportRecordId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function resolveDraftFallbackDate(planDate: string): Date {
  const parsedPlanDate = new Date(planDate);
  return Number.isFinite(parsedPlanDate.getTime()) ? parsedPlanDate : new Date();
}

function normalizeRecoveryDraft(draft: SessionDraftV2): SessionDraftV2 {
  return normalizeSessionDraft(draft, {
    fallbackDate: resolveDraftFallbackDate(draft.planDate),
  });
}

function normalizeImportDiagnostics(
  diagnostics: PlannerImportDiagnostics,
): PlannerImportDiagnostics {
  return {
    format: diagnostics.format,
    unmatchedTargets: Array.isArray(diagnostics.unmatchedTargets) ? diagnostics.unmatchedTargets : [],
    createdTargets: Array.isArray(diagnostics.createdTargets) ? diagnostics.createdTargets : [],
    skippedRows: Number.isFinite(diagnostics.skippedRows) ? diagnostics.skippedRows : 0,
    warnings: Array.isArray(diagnostics.warnings) ? diagnostics.warnings : [],
  };
}

function normalizeDraftRecoverySnapshot(
  snapshot: PlannerDraftRecoverySnapshot | null | undefined,
): PlannerDraftRecoverySnapshot | null {
  if (!snapshot?.draft || !snapshot.updatedAt || !snapshot.source) {
    return null;
  }

  return {
    draft: normalizeRecoveryDraft(snapshot.draft),
    updatedAt: snapshot.updatedAt,
    source: snapshot.source,
    relatedPlanId: snapshot.relatedPlanId,
    relatedPlanName: snapshot.relatedPlanName,
    dirtyFingerprint: snapshot.dirtyFingerprint,
  };
}

function normalizeImportRecord(record: PlannerImportRecord | null | undefined): PlannerImportRecord | null {
  if (!record?.id || !record?.importedAt || !record?.source || !record?.draft || !record?.diagnostics) {
    return null;
  }

  return {
    id: record.id,
    importedAt: record.importedAt,
    source: record.source,
    sourcePath: record.sourcePath,
    linkedPlanId: record.linkedPlanId,
    linkedPlanName: record.linkedPlanName,
    draft: normalizeRecoveryDraft(record.draft),
    diagnostics: normalizeImportDiagnostics(record.diagnostics),
  };
}

function createExecutionTargets(plan: SavedSessionPlan): PlannedSessionExecutionTarget[] {
  return plan.targets.map((target) => ({
    id: `${plan.id}_${target.targetId}`,
    targetId: target.targetId,
    targetName: target.targetName,
    scheduledStart: target.startTime,
    scheduledEnd: target.endTime,
    scheduledDurationMinutes: Math.max(1, Math.round(target.duration * 60)),
    order: target.order,
    status: 'planned',
    observationIds: [],
  }));
}

function mapSnapshotTarget(target: ExecutionTargetSnapshot): PlannedSessionExecutionTarget {
  return {
    id: target.id,
    targetId: target.target_id,
    targetName: target.target_name,
    scheduledStart: target.scheduled_start,
    scheduledEnd: target.scheduled_end,
    scheduledDurationMinutes: target.scheduled_duration_minutes,
    order: target.order,
    status: target.status,
    observationIds: target.observation_ids ?? [],
    actualStart: target.actual_start,
    actualEnd: target.actual_end,
    resultNotes: target.result_notes,
    skipReason: target.skip_reason,
    completionSummary: target.completion_summary,
    unplanned: target.unplanned,
  };
}

function upsertExecution(
  executions: PlannedSessionExecution[],
  nextExecution: PlannedSessionExecution,
): PlannedSessionExecution[] {
  const filtered = executions.filter((execution) => execution.id !== nextExecution.id);
  return [nextExecution, ...filtered];
}

function normalizePlanDraftShape(
  plan: Omit<SavedSessionPlan, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const parsedPlanDate = new Date(plan.planDate);
  const report = validateSessionDraft({
    planDate: plan.planDate,
    strategy: plan.strategy,
    constraints: plan.constraints ?? {
      minAltitude: plan.minAltitude,
      minImagingTime: plan.minImagingTime,
    },
    excludedTargetIds: plan.excludedTargetIds,
    manualEdits: plan.manualEdits ?? [],
    notes: plan.notes,
    weatherSnapshot: plan.weatherSnapshot,
    guideContext: plan.guideContext,
  }, {
    fallbackDate: Number.isFinite(parsedPlanDate.getTime()) ? parsedPlanDate : new Date(),
  });
  return {
    ...plan,
    planDate: report.draft.planDate,
    strategy: report.draft.strategy,
    minAltitude: report.draft.constraints.minAltitude,
    minImagingTime: report.draft.constraints.minImagingTime,
    constraints: report.draft.constraints,
    planningMode: report.draft.manualEdits.length > 0 ? (plan.planningMode ?? 'manual') : (plan.planningMode ?? 'auto'),
    excludedTargetIds: report.draft.excludedTargetIds,
    notes: report.draft.notes,
    weatherSnapshot: report.draft.weatherSnapshot,
    manualEdits: report.draft.manualEdits,
    guideContext: report.draft.guideContext,
  };
}

const TERMINAL_TARGET_STATUSES: ExecutionTargetStatus[] = ['completed', 'skipped', 'failed'];

const TARGET_STATUS_TRANSITIONS: Record<ExecutionTargetStatus, ExecutionTargetStatus[]> = {
  planned: ['in_progress', 'completed', 'skipped', 'failed'],
  in_progress: ['completed', 'skipped', 'failed'],
  completed: [],
  skipped: [],
  failed: ['in_progress'],
};

const EXECUTION_STATUS_TRANSITIONS: Record<SessionExecutionStatus, SessionExecutionStatus[]> = {
  draft: ['ready', 'active', 'cancelled', 'archived'],
  ready: ['active', 'cancelled', 'archived'],
  active: ['completed', 'cancelled', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

function canTransitionTargetStatus(
  from: ExecutionTargetStatus,
  to: ExecutionTargetStatus,
): boolean {
  return from === to || TARGET_STATUS_TRANSITIONS[from].includes(to);
}

function canTransitionExecutionStatus(
  from: SessionExecutionStatus,
  to: SessionExecutionStatus,
): boolean {
  return from === to || EXECUTION_STATUS_TRANSITIONS[from].includes(to);
}

function buildExecutionSummary(targets: PlannedSessionExecutionTarget[]): ExecutionSummary {
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

function normalizeExecutionStatuses(execution: PlannedSessionExecution): PlannedSessionExecution {
  const targets = execution.targets.map((target) => {
    const status: ExecutionTargetStatus = (
      target.status === 'planned'
      || target.status === 'in_progress'
      || target.status === 'completed'
      || target.status === 'skipped'
      || target.status === 'failed'
    ) ? target.status : 'planned';
    return {
      ...target,
      status,
    };
  });

  const status: SessionExecutionStatus = (
    execution.status === 'draft'
    || execution.status === 'ready'
    || execution.status === 'active'
    || execution.status === 'completed'
    || execution.status === 'archived'
    || execution.status === 'cancelled'
  ) ? execution.status : 'ready';

  return {
    ...execution,
    status,
    targets,
    summary: execution.summary ?? buildExecutionSummary(targets),
  };
}

export const useSessionPlanStore = create<SessionPlanState>()(
  persist(
    (set, get) => ({
      savedPlans: [],
      templates: [],
      activePlanId: null,
      executions: [],
      activeExecutionId: null,
      draftRecovery: null,
      recentImports: [],

      savePlan: (plan) => {
        const id = generatePlanId();
        const now = new Date().toISOString();
        const normalizedPlan = normalizePlanDraftShape(plan);
        const newPlan: SavedSessionPlan = {
          ...normalizedPlan,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          savedPlans: [newPlan, ...state.savedPlans].slice(0, MAX_SAVED_PLANS),
          activePlanId: id,
        }));
        logger.info('Session plan saved', { id, name: plan.name });
        return id;
      },

      updatePlan: (id, updates) => {
        set((state) => ({
          savedPlans: state.savedPlans.map((p) =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      deletePlan: (id) => {
        set((state) => ({
          savedPlans: state.savedPlans.filter((p) => p.id !== id),
          activePlanId: state.activePlanId === id ? null : state.activePlanId,
        }));
        logger.info('Session plan deleted', { id });
      },

      setActivePlan: (id) => {
        set({ activePlanId: id });
      },

      getActivePlan: () => {
        const state = get();
        if (!state.activePlanId) return null;
        return state.savedPlans.find((p) => p.id === state.activePlanId) ?? null;
      },

      getPlanById: (id) => {
        return get().savedPlans.find((p) => p.id === id);
      },

      renamePlan: (id, name) => {
        set((state) => ({
          savedPlans: state.savedPlans.map((p) =>
            p.id === id
              ? { ...p, name, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      duplicatePlan: (id) => {
        const source = get().savedPlans.find((p) => p.id === id);
        if (!source) return null;
        const newId = generatePlanId();
        const now = new Date().toISOString();
        const copy: SavedSessionPlan = {
          ...source,
          id: newId,
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          savedPlans: [copy, ...state.savedPlans].slice(0, MAX_SAVED_PLANS),
          activePlanId: newId,
        }));
        return newId;
      },

      importPlanV2: (draft, name) => {
        const normalizedDraft = normalizeSessionDraft(draft, {
          fallbackDate: new Date(draft.planDate),
        });
        const fallbackName = name ?? `Session ${new Date(normalizedDraft.planDate).toLocaleDateString()}`;
        return get().savePlan({
          name: fallbackName,
          planDate: normalizedDraft.planDate,
          latitude: 0,
          longitude: 0,
          strategy: normalizedDraft.strategy,
          minAltitude: normalizedDraft.constraints.minAltitude,
          minImagingTime: normalizedDraft.constraints.minImagingTime,
          constraints: normalizedDraft.constraints,
          planningMode: normalizedDraft.manualEdits.length > 0 ? 'manual' : 'auto',
          targets: [],
          excludedTargetIds: normalizedDraft.excludedTargetIds,
          totalImagingTime: 0,
          nightCoverage: 0,
          efficiency: 0,
          notes: normalizedDraft.notes,
          weatherSnapshot: normalizedDraft.weatherSnapshot,
          manualEdits: normalizedDraft.manualEdits,
          guideContext: normalizedDraft.guideContext,
        });
      },

      saveTemplate: (template) => {
        const id = generateTemplateId();
        const now = new Date().toISOString();
        const normalizedDraft = normalizeSessionDraft(template.draft, {
          fallbackDate: new Date(template.draft.planDate),
        });
        const nextTemplate: SavedSessionTemplate = {
          id,
          name: template.name,
          draft: normalizedDraft,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          templates: [nextTemplate, ...state.templates].slice(0, MAX_SAVED_TEMPLATES),
        }));
        logger.info('Session template saved', { id, name: template.name });
        return id;
      },

      loadTemplate: (id) => {
        return get().templates.find((template) => template.id === id);
      },

      renameTemplate: (id, name) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, name, updatedAt: new Date().toISOString() }
              : template
          ),
        }));
      },

      duplicateTemplate: (id) => {
        const source = get().templates.find((template) => template.id === id);
        if (!source) return null;
        const nextId = generateTemplateId();
        const now = new Date().toISOString();
        const copy: SavedSessionTemplate = {
          ...source,
          id: nextId,
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          templates: [copy, ...state.templates].slice(0, MAX_SAVED_TEMPLATES),
        }));
        return nextId;
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((template) => template.id !== id),
        }));
      },

      listTemplates: () => get().templates,

      saveDraftRecovery: (draft, metadata = {}) => {
        set({
          draftRecovery: {
            draft: normalizeRecoveryDraft(draft),
            updatedAt: new Date().toISOString(),
            source: metadata.source ?? 'planner-close',
            relatedPlanId: metadata.relatedPlanId,
            relatedPlanName: metadata.relatedPlanName,
            dirtyFingerprint: metadata.dirtyFingerprint,
          },
        });
      },

      clearDraftRecovery: () => {
        set({ draftRecovery: null });
      },

      addImportRecord: (record) => {
        const nextRecord: PlannerImportRecord = {
          id: generateImportRecordId(),
          importedAt: new Date().toISOString(),
          source: record.source,
          sourcePath: record.sourcePath,
          linkedPlanId: record.linkedPlanId,
          linkedPlanName: record.linkedPlanName,
          draft: normalizeRecoveryDraft(record.draft),
          diagnostics: normalizeImportDiagnostics(record.diagnostics),
        };

        set((state) => ({
          recentImports: [nextRecord, ...state.recentImports].slice(0, MAX_RECENT_IMPORTS),
        }));

        return nextRecord.id;
      },

      dismissImportRecord: (id) => {
        set((state) => ({
          recentImports: state.recentImports.filter((record) => record.id !== id),
        }));
      },

      clearImportRecords: () => {
        set({ recentImports: [] });
      },

      createExecutionFromPlan: (plan, context = {}) => {
        const now = new Date().toISOString();
        const normalizedPlan = normalizePlanDraftShape({
          name: plan.name,
          planDate: plan.planDate,
          latitude: plan.latitude,
          longitude: plan.longitude,
          strategy: plan.strategy,
          minAltitude: plan.minAltitude,
          minImagingTime: plan.minImagingTime,
          constraints: plan.constraints,
          planningMode: plan.planningMode,
          targets: plan.targets,
          excludedTargetIds: plan.excludedTargetIds,
          totalImagingTime: plan.totalImagingTime,
          nightCoverage: plan.nightCoverage,
          efficiency: plan.efficiency,
          notes: plan.notes,
          weatherSnapshot: plan.weatherSnapshot,
          manualEdits: plan.manualEdits,
          guideContext: plan.guideContext,
        });
        const execution: PlannedSessionExecution = {
          id: generateExecutionId(),
          sourcePlanId: plan.id,
          sourcePlanName: plan.name,
          status: context.status ?? 'ready',
          planDate: normalizedPlan.planDate,
          locationId: context.locationId,
          locationName: context.locationName,
          notes: normalizedPlan.notes,
          weatherSnapshot: normalizedPlan.weatherSnapshot,
          guideContext: normalizedPlan.guideContext,
          createdAt: now,
          updatedAt: now,
          targets: createExecutionTargets(plan),
        };
        execution.summary = buildExecutionSummary(execution.targets);

        set((state) => ({
          executions: upsertExecution(state.executions, normalizeExecutionStatuses(execution)),
          activeExecutionId: execution.id,
        }));
        logger.info('Session execution created', {
          executionId: execution.id,
          sourcePlanId: plan.id,
        });
        return execution.id;
      },

      setActiveExecution: (id) => {
        set({ activeExecutionId: id });
      },

      getActiveExecution: () => {
        const state = get();
        if (!state.activeExecutionId) return null;
        return state.executions.find((execution) => execution.id === state.activeExecutionId) ?? null;
      },

      getExecutionById: (id) => {
        return get().executions.find((execution) => execution.id === id);
      },

      syncExecutionFromObservationSession: (session) => {
        if (!session.source_plan_id) return null;
        const sourceGuideContext = get().savedPlans.find(
          (plan) => plan.id === session.source_plan_id,
        )?.guideContext;

        const rawExecution: PlannedSessionExecution = {
          id: session.id,
          sourcePlanId: session.source_plan_id,
          sourcePlanName: session.source_plan_name ?? 'Observation Session',
          status: session.execution_status ?? 'active',
          planDate: session.date,
          notes: session.notes,
          weatherSnapshot: session.weather_snapshot as SessionWeatherSnapshot | undefined,
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
          targets: (session.execution_targets ?? []).map(mapSnapshotTarget),
          guideContext: sourceGuideContext,
        };
        const execution = normalizeExecutionStatuses(rawExecution);

        set((state) => ({
          executions: upsertExecution(state.executions, execution),
          activeExecutionId: execution.id,
        }));
        return execution.id;
      },

      updateExecutionTarget: (executionId, targetId, updates) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  ...(() => {
                    const now = new Date().toISOString();
                    const targets = execution.targets.map((target) => {
                      if (target.targetId !== targetId) return target;
                      const requestedStatus = updates.status ?? target.status;
                      if (updates.status && !canTransitionTargetStatus(target.status, updates.status)) {
                        logger.warn('Rejected invalid execution target transition', {
                          executionId,
                          targetId,
                          from: target.status,
                          to: updates.status,
                        });
                        return target;
                      }
                      const next: PlannedSessionExecutionTarget = {
                        ...target,
                        ...updates,
                        status: requestedStatus,
                      };
                      if (requestedStatus === 'in_progress' && !next.actualStart) {
                        next.actualStart = now;
                      }
                      if (TERMINAL_TARGET_STATUSES.includes(requestedStatus) && !next.actualEnd) {
                        next.actualEnd = now;
                      }
                      return next;
                    });
                    const summary = buildExecutionSummary(targets);
                    const allDone = targets.length > 0 && targets.every((target) => TERMINAL_TARGET_STATUSES.includes(target.status));
                    const nextStatus = allDone && canTransitionExecutionStatus(execution.status, 'completed')
                      ? 'completed'
                      : execution.status;
                    return {
                      updatedAt: now,
                      targets,
                      summary,
                      status: nextStatus,
                      endedAt: nextStatus === 'completed' ? (execution.endedAt ?? now) : execution.endedAt,
                    };
                  })(),
                },
          ),
        }));
      },

      attachObservationToExecutionTarget: (executionId, targetId, observationId) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : {
                  ...execution,
                  ...(() => {
                    const now = new Date().toISOString();
                    const targets = execution.targets.map((target) => {
                      if (target.targetId !== targetId) return target;
                      const nextStatus: ExecutionTargetStatus =
                        target.status === 'planned' ? 'completed' : target.status;
                      const canApply = canTransitionTargetStatus(target.status, nextStatus);
                      if (!canApply) return target;
                      return {
                        ...target,
                        status: nextStatus,
                        observationIds: target.observationIds.includes(observationId)
                          ? target.observationIds
                          : [...target.observationIds, observationId],
                        actualEnd: TERMINAL_TARGET_STATUSES.includes(nextStatus)
                          ? (target.actualEnd ?? now)
                          : target.actualEnd,
                      };
                    });
                    const summary = buildExecutionSummary(targets);
                    const allDone = targets.length > 0 && targets.every((target) => TERMINAL_TARGET_STATUSES.includes(target.status));
                    const nextStatus = allDone && canTransitionExecutionStatus(execution.status, 'completed')
                      ? 'completed'
                      : execution.status;
                    return {
                      updatedAt: now,
                      targets,
                      summary,
                      status: nextStatus,
                      endedAt: nextStatus === 'completed' ? (execution.endedAt ?? now) : execution.endedAt,
                    };
                  })(),
                },
          ),
        }));
      },

      completeExecution: (executionId, summary) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : (() => {
                if (!canTransitionExecutionStatus(execution.status, 'completed')) {
                  logger.warn('Rejected invalid execution status transition', {
                    executionId,
                    from: execution.status,
                    to: 'completed',
                  });
                  return execution;
                }
                const now = new Date().toISOString();
                return {
                  ...execution,
                  status: 'completed' as const,
                  summary: summary ?? buildExecutionSummary(execution.targets),
                  endedAt: execution.endedAt ?? now,
                  updatedAt: now,
                };
              })(),
          ),
        }));
      },

      archiveExecution: (executionId) => {
        set((state) => ({
          executions: state.executions.map((execution) =>
            execution.id !== executionId
              ? execution
              : (() => {
                if (!canTransitionExecutionStatus(execution.status, 'archived')) {
                  logger.warn('Rejected invalid execution status transition', {
                    executionId,
                    from: execution.status,
                    to: 'archived',
                  });
                  return execution;
                }
                return {
                  ...execution,
                  status: 'archived' as const,
                  updatedAt: new Date().toISOString(),
                };
              })(),
          ),
          activeExecutionId: state.activeExecutionId === executionId ? null : state.activeExecutionId,
        }));
      },
    }),
    {
      name: 'skymap-session-plans',
      version: 5,
      storage: getZustandStorage<Partial<SessionPlanState>>(),
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Partial<SessionPlanState>;

        const normalizedPlans: SavedSessionPlan[] = (state.savedPlans ?? [])
          .map((plan) => {
            if (!plan) return null;
            const { id, createdAt, updatedAt, ...payload } = plan as SavedSessionPlan;
            if (!id || !createdAt || !updatedAt) return null;
            const normalizedPayload = normalizePlanDraftShape(payload);
            return {
              id,
              createdAt,
              updatedAt,
              ...normalizedPayload,
              targets: Array.isArray(plan.targets) ? plan.targets : [],
            } as SavedSessionPlan;
          })
          .filter((plan): plan is SavedSessionPlan => Boolean(plan));

        const normalizedTemplates: SavedSessionTemplate[] = (state.templates ?? [])
          .map((template) => {
            if (!template?.id || !template?.name || !template?.createdAt || !template?.updatedAt) return null;
            return {
              id: template.id,
              name: template.name,
              createdAt: template.createdAt,
              updatedAt: template.updatedAt,
              draft: normalizeSessionDraft(template.draft, {
                fallbackDate: new Date(),
              }),
            };
          })
          .filter((template): template is SavedSessionTemplate => Boolean(template));

        const normalizedExecutions: PlannedSessionExecution[] = (state.executions ?? [])
          .map((execution) => (execution ? normalizeExecutionStatuses(execution) : null))
          .filter((execution): execution is PlannedSessionExecution => Boolean(execution));

        const normalizedDraftRecovery = normalizeDraftRecoverySnapshot(state.draftRecovery);
        const normalizedRecentImports: PlannerImportRecord[] = (state.recentImports ?? [])
          .map((record) => normalizeImportRecord(record))
          .filter((record): record is PlannerImportRecord => Boolean(record))
          .slice(0, MAX_RECENT_IMPORTS);

        if (version < 2) {
          return {
            savedPlans: normalizedPlans,
            activePlanId: state.activePlanId ?? null,
            templates: normalizedTemplates,
            executions: [],
            activeExecutionId: null,
            draftRecovery: null,
            recentImports: [],
          } as Partial<SessionPlanState>;
        }
        if (version < 3) {
          return {
            savedPlans: normalizedPlans,
            activePlanId: state.activePlanId ?? null,
            templates: normalizedTemplates,
            executions: [],
            activeExecutionId: null,
            draftRecovery: null,
            recentImports: [],
          } as Partial<SessionPlanState>;
        }
        if (version < 4) {
          return {
            savedPlans: normalizedPlans,
            activePlanId: state.activePlanId ?? null,
            templates: normalizedTemplates,
            executions: normalizedExecutions,
            activeExecutionId: state.activeExecutionId ?? null,
            draftRecovery: null,
            recentImports: [],
          } as Partial<SessionPlanState>;
        }
        if (version < 5) {
          return {
            savedPlans: normalizedPlans,
            activePlanId: state.activePlanId ?? null,
            templates: normalizedTemplates,
            executions: normalizedExecutions,
            activeExecutionId: state.activeExecutionId ?? null,
            draftRecovery: null,
            recentImports: [],
          } as Partial<SessionPlanState>;
        }
        return {
          savedPlans: normalizedPlans,
          activePlanId: state.activePlanId ?? null,
          templates: normalizedTemplates,
          executions: normalizedExecutions,
          activeExecutionId: state.activeExecutionId ?? null,
          draftRecovery: normalizedDraftRecovery,
          recentImports: normalizedRecentImports,
        } as Partial<SessionPlanState>;
      },
      partialize: (state) => ({
        savedPlans: state.savedPlans,
        activePlanId: state.activePlanId,
        templates: state.templates,
        executions: state.executions,
        activeExecutionId: state.activeExecutionId,
        draftRecovery: state.draftRecovery,
        recentImports: state.recentImports,
      }),
    }
  )
);
