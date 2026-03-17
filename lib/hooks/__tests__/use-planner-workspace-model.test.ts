import type {
  PlannerDraftRecoverySnapshot,
  PlannerImportRecord,
  SavedSessionPlan,
  SavedSessionTemplate,
} from '@/lib/stores/session-plan-store';
import type { PlannedSessionExecution } from '@/types/starmap/session-planner-v2';
import { buildPlannerWorkspaceModel } from '../use-planner-workspace-model';

function makeDraft() {
  return {
    planDate: '2026-03-14T12:00:00.000Z',
    strategy: 'balanced' as const,
    constraints: {
      minAltitude: 25,
      minImagingTime: 45,
    },
    excludedTargetIds: [],
    manualEdits: [],
  };
}

function makeSavedPlan(overrides: Partial<SavedSessionPlan> = {}): SavedSessionPlan {
  return {
    id: 'plan-1',
    name: 'Nebula Night',
    createdAt: '2026-03-14T12:00:00.000Z',
    updatedAt: '2026-03-14T12:30:00.000Z',
    planDate: '2026-03-14T12:00:00.000Z',
    latitude: 40,
    longitude: -74,
    strategy: 'balanced',
    minAltitude: 25,
    minImagingTime: 45,
    constraints: {
      minAltitude: 25,
      minImagingTime: 45,
    },
    planningMode: 'auto',
    targets: [{
      targetId: 'm42',
      targetName: 'M42',
      ra: 83.8,
      dec: -5.4,
      startTime: '2026-03-14T20:00:00.000Z',
      endTime: '2026-03-14T21:00:00.000Z',
      duration: 1,
      maxAltitude: 60,
      moonDistance: 80,
      feasibilityScore: 90,
      order: 1,
    }],
    excludedTargetIds: [],
    totalImagingTime: 1,
    nightCoverage: 50,
    efficiency: 90,
    ...overrides,
  };
}

function makeExecution(overrides: Partial<PlannedSessionExecution> = {}): PlannedSessionExecution {
  return {
    id: 'execution-1',
    sourcePlanId: 'plan-1',
    sourcePlanName: 'Nebula Night',
    status: 'active',
    planDate: '2026-03-14T12:00:00.000Z',
    createdAt: '2026-03-14T12:30:00.000Z',
    updatedAt: '2026-03-14T13:00:00.000Z',
    targets: [{
      id: 'execution-1_m42',
      targetId: 'm42',
      targetName: 'M42',
      scheduledStart: '2026-03-14T20:00:00.000Z',
      scheduledEnd: '2026-03-14T21:00:00.000Z',
      scheduledDurationMinutes: 60,
      order: 1,
      status: 'planned',
      observationIds: [],
    }],
    summary: {
      completedTargets: 0,
      skippedTargets: 0,
      failedTargets: 0,
      totalTargets: 1,
      totalObservations: 0,
    },
    ...overrides,
  };
}

function makeTemplate(id: string, name: string): SavedSessionTemplate {
  return {
    id,
    name,
    draft: makeDraft(),
    createdAt: '2026-03-14T10:00:00.000Z',
    updatedAt: '2026-03-14T10:30:00.000Z',
  };
}

function makeImportRecord(): PlannerImportRecord {
  return {
    id: 'import-1',
    importedAt: '2026-03-14T09:00:00.000Z',
    source: 'cli',
    sourcePath: 'D:/imports/m42.csv',
    linkedPlanId: 'plan-imported',
    linkedPlanName: 'Imported Night',
    draft: makeDraft(),
    diagnostics: {
      format: 'csv',
      unmatchedTargets: ['unknown-target'],
      createdTargets: ['m42'],
      skippedRows: 1,
      warnings: ['one warning'],
    },
  };
}

function makeRecovery(): PlannerDraftRecoverySnapshot {
  return {
    draft: makeDraft(),
    updatedAt: '2026-03-14T08:00:00.000Z',
    source: 'planner-close',
    relatedPlanId: 'plan-1',
    relatedPlanName: 'Nebula Night',
    dirtyFingerprint: 'fingerprint-1',
  };
}

describe('buildPlannerWorkspaceModel', () => {
  it('merges plans, templates, imports, and recovery into one visible model', () => {
    const model = buildPlannerWorkspaceModel({
      savedPlans: [makeSavedPlan()],
      executions: [makeExecution()],
      localTemplates: [makeTemplate('template-local', 'Backyard Template')],
      remoteTemplates: [makeTemplate('template-remote', 'Remote Observatory Template')],
      recentImports: [makeImportRecord()],
      draftRecovery: makeRecovery(),
      query: '',
      filter: 'all',
    });

    expect(model.entries).toHaveLength(5);
    expect(model.counts.plans).toBe(1);
    expect(model.counts.templates).toBe(2);
    expect(model.counts.imports).toBe(1);
    expect(model.counts.recovery).toBe(1);
  });

  it('adds execution-aware metadata to saved plan entries', () => {
    const model = buildPlannerWorkspaceModel({
      savedPlans: [makeSavedPlan()],
      executions: [makeExecution()],
      localTemplates: [],
      remoteTemplates: [],
      recentImports: [],
      draftRecovery: null,
      query: '',
      filter: 'plans',
    });

    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]).toEqual(expect.objectContaining({
      type: 'plan',
      executionStatus: 'active',
      remainingTargets: 1,
      actionFlags: expect.objectContaining({
        canResumeExecution: true,
        canReviewExecution: true,
        canRename: true,
      }),
    }));
  });

  it('prefers the newest execution when a plan has multiple execution records', () => {
    const model = buildPlannerWorkspaceModel({
      savedPlans: [makeSavedPlan()],
      executions: [
        makeExecution({
          id: 'execution-newest',
          status: 'active',
          updatedAt: '2026-03-14T14:00:00.000Z',
        }),
        makeExecution({
          id: 'execution-older',
          status: 'completed',
          updatedAt: '2026-03-14T11:00:00.000Z',
          targets: [{
            id: 'execution-older_m42',
            targetId: 'm42',
            targetName: 'M42',
            scheduledStart: '2026-03-14T20:00:00.000Z',
            scheduledEnd: '2026-03-14T21:00:00.000Z',
            scheduledDurationMinutes: 60,
            order: 1,
            status: 'completed',
            observationIds: [],
          }],
          summary: {
            completedTargets: 1,
            skippedTargets: 0,
            failedTargets: 0,
            totalTargets: 1,
            totalObservations: 0,
          },
        }),
      ],
      localTemplates: [],
      remoteTemplates: [],
      recentImports: [],
      draftRecovery: null,
      query: '',
      filter: 'plans',
    });

    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]).toEqual(expect.objectContaining({
      type: 'plan',
      executionStatus: 'active',
      actionFlags: expect.objectContaining({
        canResumeExecution: true,
        canReviewExecution: true,
      }),
    }));
  });

  it('gives recovery entries an id that does not collide with the saved plan row', () => {
    const model = buildPlannerWorkspaceModel({
      savedPlans: [makeSavedPlan()],
      executions: [],
      localTemplates: [],
      remoteTemplates: [],
      recentImports: [],
      draftRecovery: makeRecovery(),
      query: '',
      filter: 'all',
    });

    const planEntry = model.entries.find((entry) => entry.type === 'plan');
    const recoveryEntry = model.entries.find((entry) => entry.type === 'recovery');

    expect(planEntry).toBeDefined();
    expect(recoveryEntry).toBeDefined();
    expect(recoveryEntry?.id).not.toBe(planEntry?.id);
  });

  it('keeps desktop templates load-only and filters by query', () => {
    const model = buildPlannerWorkspaceModel({
      savedPlans: [],
      executions: [],
      localTemplates: [makeTemplate('template-local', 'Portable Rig')],
      remoteTemplates: [makeTemplate('template-remote', 'Remote Observatory Template')],
      recentImports: [],
      draftRecovery: null,
      query: 'remote',
      filter: 'templates',
    });

    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]).toEqual(expect.objectContaining({
      id: 'template-remote',
      source: 'desktop-template',
      actionFlags: expect.objectContaining({
        canLoad: true,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
      }),
    }));
  });
});
