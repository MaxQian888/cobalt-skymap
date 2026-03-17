'use client';

import { buildExecutionWorkspaceViewModel } from '@/lib/stores/session-execution-helpers';
import type {
  PlannerDraftRecoverySnapshot,
  PlannerImportRecord,
  SavedSessionPlan,
  SavedSessionTemplate,
} from '@/lib/stores/session-plan-store';
import type { PlannedSessionExecution, SessionExecutionStatus } from '@/types/starmap/session-planner-v2';
import type { PlannerWorkspaceFilter } from '@/lib/stores/planning-ui-store';

export type PlannerWorkspaceEntryType = 'plan' | 'template' | 'import' | 'recovery';
export type PlannerWorkspaceEntrySource =
  | 'local-plan'
  | 'local-template'
  | 'desktop-template'
  | 'file-import'
  | 'cli-import'
  | 'draft-recovery';

export interface PlannerWorkspaceActionFlags {
  canLoad: boolean;
  canRename: boolean;
  canDuplicate: boolean;
  canDelete: boolean;
  canResumeExecution: boolean;
  canReviewExecution: boolean;
  canRestoreDraft: boolean;
  canDismiss: boolean;
}

interface PlannerWorkspaceEntryBase {
  id: string;
  type: PlannerWorkspaceEntryType;
  source: PlannerWorkspaceEntrySource;
  title: string;
  updatedAt: string;
  searchText: string;
  actionFlags: PlannerWorkspaceActionFlags;
}

export interface PlannerWorkspacePlanEntry extends PlannerWorkspaceEntryBase {
  type: 'plan';
  source: 'local-plan';
  plan: SavedSessionPlan;
  targetCount: number;
  executionStatus: SessionExecutionStatus | null;
  remainingTargets: number;
}

export interface PlannerWorkspaceTemplateEntry extends PlannerWorkspaceEntryBase {
  type: 'template';
  source: 'local-template' | 'desktop-template';
  template: SavedSessionTemplate;
}

export interface PlannerWorkspaceImportEntry extends PlannerWorkspaceEntryBase {
  type: 'import';
  source: 'file-import' | 'cli-import';
  importRecord: PlannerImportRecord;
}

export interface PlannerWorkspaceRecoveryEntry extends PlannerWorkspaceEntryBase {
  type: 'recovery';
  source: 'draft-recovery';
  recovery: PlannerDraftRecoverySnapshot;
}

export type PlannerWorkspaceEntry =
  | PlannerWorkspacePlanEntry
  | PlannerWorkspaceTemplateEntry
  | PlannerWorkspaceImportEntry
  | PlannerWorkspaceRecoveryEntry;

export interface PlannerWorkspaceModel {
  entries: PlannerWorkspaceEntry[];
  counts: {
    plans: number;
    templates: number;
    imports: number;
    recovery: number;
  };
}

interface BuildPlannerWorkspaceModelOptions {
  savedPlans: SavedSessionPlan[];
  executions: PlannedSessionExecution[];
  localTemplates: SavedSessionTemplate[];
  remoteTemplates: SavedSessionTemplate[];
  recentImports: PlannerImportRecord[];
  draftRecovery: PlannerDraftRecoverySnapshot | null;
  query: string;
  filter: PlannerWorkspaceFilter;
}

function matchesFilter(entry: PlannerWorkspaceEntry, filter: PlannerWorkspaceFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'plans') return entry.type === 'plan';
  if (filter === 'templates') return entry.type === 'template';
  if (filter === 'imports') return entry.type === 'import';
  return entry.type === 'recovery';
}

function matchesQuery(entry: PlannerWorkspaceEntry, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return entry.searchText.includes(normalizedQuery);
}

function getExecutionTimestamp(execution: PlannedSessionExecution): number {
  const updatedAt = new Date(execution.updatedAt).getTime();
  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }

  const createdAt = new Date(execution.createdAt).getTime();
  if (Number.isFinite(createdAt)) {
    return createdAt;
  }

  return 0;
}

export function buildPlannerWorkspaceModel({
  savedPlans,
  executions,
  localTemplates,
  remoteTemplates,
  recentImports,
  draftRecovery,
  query,
  filter,
}: BuildPlannerWorkspaceModelOptions): PlannerWorkspaceModel {
  const executionByPlanId = new Map<string, PlannedSessionExecution>();
  for (const execution of executions) {
    if (!execution.sourcePlanId) continue;

    const existing = executionByPlanId.get(execution.sourcePlanId);
    if (!existing || getExecutionTimestamp(execution) >= getExecutionTimestamp(existing)) {
      executionByPlanId.set(execution.sourcePlanId, execution);
    }
  }

  const planEntries: PlannerWorkspacePlanEntry[] = savedPlans.map((plan) => {
    const execution = executionByPlanId.get(plan.id) ?? null;
    const executionView = buildExecutionWorkspaceViewModel(execution);
    return {
      id: plan.id,
      type: 'plan',
      source: 'local-plan',
      title: plan.name,
      updatedAt: plan.updatedAt,
      searchText: `${plan.name} ${plan.planDate} ${plan.targets.map((target) => target.targetName).join(' ')}`.toLowerCase(),
      plan,
      targetCount: plan.targets.length,
      executionStatus: execution?.status ?? null,
      remainingTargets: executionView.summary.remainingTargets,
      actionFlags: {
        canLoad: true,
        canRename: true,
        canDuplicate: true,
        canDelete: true,
        canResumeExecution: executionView.canResume,
        canReviewExecution: executionView.canReview,
        canRestoreDraft: false,
        canDismiss: false,
      },
    };
  });

  const localTemplateEntries: PlannerWorkspaceTemplateEntry[] = localTemplates.map((template) => ({
    id: template.id,
    type: 'template',
    source: 'local-template',
    title: template.name,
    updatedAt: template.updatedAt,
    searchText: `${template.name} local template`.toLowerCase(),
    template,
    actionFlags: {
      canLoad: true,
      canRename: true,
      canDuplicate: true,
      canDelete: true,
      canResumeExecution: false,
      canReviewExecution: false,
      canRestoreDraft: false,
      canDismiss: false,
    },
  }));

  const remoteTemplateEntries: PlannerWorkspaceTemplateEntry[] = remoteTemplates.map((template) => ({
    id: template.id,
    type: 'template',
    source: 'desktop-template',
    title: template.name,
    updatedAt: template.updatedAt,
    searchText: `${template.name} desktop template remote`.toLowerCase(),
    template,
    actionFlags: {
      canLoad: true,
      canRename: false,
      canDuplicate: false,
      canDelete: false,
      canResumeExecution: false,
      canReviewExecution: false,
      canRestoreDraft: false,
      canDismiss: false,
    },
  }));

  const importEntries: PlannerWorkspaceImportEntry[] = recentImports.map((record) => ({
    id: record.id,
    type: 'import',
    source: record.source === 'cli' ? 'cli-import' : 'file-import',
    title: record.linkedPlanName ?? `Imported ${record.diagnostics.format.toUpperCase()}`,
    updatedAt: record.importedAt,
    searchText: [
      record.linkedPlanName,
      record.sourcePath,
      record.diagnostics.format,
      ...record.diagnostics.unmatchedTargets,
      ...record.diagnostics.createdTargets,
      ...record.diagnostics.warnings,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    importRecord: record,
    actionFlags: {
      canLoad: true,
      canRename: false,
      canDuplicate: false,
      canDelete: false,
      canResumeExecution: false,
      canReviewExecution: false,
      canRestoreDraft: false,
      canDismiss: true,
    },
  }));

  const recoveryEntries: PlannerWorkspaceRecoveryEntry[] = draftRecovery
    ? [{
        id: `recovery:${draftRecovery.relatedPlanId ?? 'draft-recovery'}`,
        type: 'recovery',
        source: 'draft-recovery',
        title: draftRecovery.relatedPlanName ?? 'Recovered draft',
        updatedAt: draftRecovery.updatedAt,
        searchText: `${draftRecovery.relatedPlanName ?? ''} recovered draft ${draftRecovery.source}`.toLowerCase(),
        recovery: draftRecovery,
        actionFlags: {
          canLoad: false,
          canRename: false,
          canDuplicate: false,
          canDelete: false,
          canResumeExecution: false,
          canReviewExecution: false,
          canRestoreDraft: true,
          canDismiss: true,
        },
      }]
    : [];

  const allEntries = [
    ...planEntries,
    ...localTemplateEntries,
    ...remoteTemplateEntries,
    ...importEntries,
    ...recoveryEntries,
  ].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());

  const entries = allEntries.filter((entry) => matchesFilter(entry, filter) && matchesQuery(entry, query));

  return {
    entries,
    counts: {
      plans: planEntries.length,
      templates: localTemplateEntries.length + remoteTemplateEntries.length,
      imports: importEntries.length,
      recovery: recoveryEntries.length,
    },
  };
}

export function usePlannerWorkspaceModel(options: BuildPlannerWorkspaceModelOptions): PlannerWorkspaceModel {
  return buildPlannerWorkspaceModel(options);
}
