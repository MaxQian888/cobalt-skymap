/**
 * Tests for session-plan-store.ts
 * Session plan persistence and template management
 */

import { act } from '@testing-library/react';
import { useSessionPlanStore } from '../session-plan-store';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';
import type { SessionPlanState } from '../session-plan-store';

jest.mock('@/lib/storage', () => ({
  getZustandStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

function resetStore() {
  useSessionPlanStore.setState({
    savedPlans: [],
    templates: [],
    activePlanId: null,
    executions: [],
    activeExecutionId: null,
  });
}

function makePlanInput(name = 'Test Plan') {
  return {
    name,
    planDate: '2025-06-15',
    latitude: 40.0,
    longitude: -74.0,
    strategy: 'altitude' as const,
    minAltitude: 30,
    minImagingTime: 60,
    targets: [],
    excludedTargetIds: [],
    totalImagingTime: 120,
    nightCoverage: 0.8,
    efficiency: 0.75,
  };
}

function makeDraft(overrides?: Partial<SessionDraftV2>): SessionDraftV2 {
  return {
    planDate: '2025-07-01',
    strategy: 'balanced',
    constraints: { minAltitude: 25, minImagingTime: 45 },
    excludedTargetIds: ['t1'],
    manualEdits: [],
    ...overrides,
  };
}

function makeGuideContext() {
  return {
    kind: 'messier-marathon' as const,
    sessionId: 'marathon-1',
    readiness: 'recommended' as const,
    mode: 'full' as const,
    checkpointOrder: ['m74', 'm42'],
    criticalCheckpointIds: ['m74'],
    stageByTargetId: {
      m74: 'dusk' as const,
      m42: 'early-evening' as const,
    },
    sourceListId: 'list-1',
    sourcePlanId: 'plan-1',
    sourceExecutionId: 'execution-1',
  };
}

function makeExecutionPlanInput(name = 'Execution Plan') {
  return {
    ...makePlanInput(name),
    notes: 'Execution notes',
    weatherSnapshot: {
      source: 'manual' as const,
      capturedAt: '2025-07-01T00:00:00Z',
      cloudCover: 20,
    },
    targets: [
      {
        targetId: 'm31',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-07-01T20:00:00.000Z',
        endTime: '2025-07-01T21:30:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 94,
        order: 1,
      },
    ],
  };
}

describe('useSessionPlanStore', () => {
  beforeEach(() => resetStore());

  describe('initial state', () => {
    it('should have empty savedPlans, templates and null activePlanId', () => {
      const s = useSessionPlanStore.getState();
      expect(s.savedPlans).toEqual([]);
      expect(s.templates).toEqual([]);
      expect(s.activePlanId).toBeNull();
    });
  });

  describe('savePlan', () => {
    it('should save a plan and return id starting with plan_', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput()); });
      expect(id).toMatch(/^plan_/);
      expect(useSessionPlanStore.getState().savedPlans).toHaveLength(1);
      expect(useSessionPlanStore.getState().savedPlans[0].name).toBe('Test Plan');
    });

    it('should set createdAt, updatedAt and activePlanId', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput()); });
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.createdAt).toBeDefined();
      expect(plan.updatedAt).toBe(plan.createdAt);
      expect(useSessionPlanStore.getState().activePlanId).toBe(id);
    });

    it('should prepend new plans (newest first)', () => {
      act(() => {
        useSessionPlanStore.getState().savePlan(makePlanInput('First'));
        useSessionPlanStore.getState().savePlan(makePlanInput('Second'));
      });
      expect(useSessionPlanStore.getState().savedPlans[0].name).toBe('Second');
      expect(useSessionPlanStore.getState().savedPlans[1].name).toBe('First');
    });

    it('should enforce MAX_SAVED_PLANS (50)', () => {
      act(() => {
        for (let i = 0; i < 55; i++) {
          useSessionPlanStore.getState().savePlan(makePlanInput(`Plan ${i}`));
        }
      });
      expect(useSessionPlanStore.getState().savedPlans).toHaveLength(50);
    });
  });

  describe('updatePlan', () => {
    it('should update plan properties and updatedAt', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput()); });
      const orig = useSessionPlanStore.getState().savedPlans[0].updatedAt;

      act(() => { useSessionPlanStore.getState().updatePlan(id, { name: 'Updated', efficiency: 0.9 }); });
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.name).toBe('Updated');
      expect(plan.efficiency).toBe(0.9);
      expect(plan.updatedAt >= orig).toBe(true);
    });

    it('should not affect other plans', () => {
      let id1 = '', id2 = '';
      act(() => {
        id1 = useSessionPlanStore.getState().savePlan(makePlanInput('A'));
        id2 = useSessionPlanStore.getState().savePlan(makePlanInput('B'));
      });
      act(() => { useSessionPlanStore.getState().updatePlan(id1, { name: 'A2' }); });
      expect(useSessionPlanStore.getState().savedPlans.find(p => p.id === id2)?.name).toBe('B');
    });
  });

  describe('deletePlan', () => {
    it('should remove a plan and clear activePlanId if active', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput()); });
      act(() => { useSessionPlanStore.getState().deletePlan(id); });
      expect(useSessionPlanStore.getState().savedPlans).toHaveLength(0);
      expect(useSessionPlanStore.getState().activePlanId).toBeNull();
    });

    it('should not clear activePlanId when deleting non-active plan', () => {
      let id1 = '', id2 = '';
      act(() => {
        id1 = useSessionPlanStore.getState().savePlan(makePlanInput('A'));
        id2 = useSessionPlanStore.getState().savePlan(makePlanInput('B'));
      });
      act(() => { useSessionPlanStore.getState().deletePlan(id1); });
      expect(useSessionPlanStore.getState().activePlanId).toBe(id2);
    });
  });

  describe('setActivePlan', () => {
    it('should set and clear active plan id', () => {
      act(() => { useSessionPlanStore.getState().setActivePlan('x'); });
      expect(useSessionPlanStore.getState().activePlanId).toBe('x');
      act(() => { useSessionPlanStore.getState().setActivePlan(null); });
      expect(useSessionPlanStore.getState().activePlanId).toBeNull();
    });
  });

  describe('getActivePlan', () => {
    it('should return null when no active plan', () => {
      expect(useSessionPlanStore.getState().getActivePlan()).toBeNull();
    });

    it('should return the active plan object', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput('Active')); });
      const plan = useSessionPlanStore.getState().getActivePlan();
      expect(plan).not.toBeNull();
      expect(plan?.name).toBe('Active');
      expect(plan?.id).toBe(id);
    });

    it('should return null if activePlanId points to deleted plan', () => {
      act(() => { useSessionPlanStore.getState().setActivePlan('nonexistent'); });
      expect(useSessionPlanStore.getState().getActivePlan()).toBeNull();
    });
  });

  describe('getPlanById', () => {
    it('should return plan by id', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput('Find Me')); });
      expect(useSessionPlanStore.getState().getPlanById(id)?.name).toBe('Find Me');
    });

    it('should return undefined for non-existent id', () => {
      expect(useSessionPlanStore.getState().getPlanById('nope')).toBeUndefined();
    });
  });

  describe('renamePlan', () => {
    it('should rename a plan and update updatedAt', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput('Old')); });
      const orig = useSessionPlanStore.getState().savedPlans[0].updatedAt;
      act(() => { useSessionPlanStore.getState().renamePlan(id, 'New'); });
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.name).toBe('New');
      expect(plan.updatedAt >= orig).toBe(true);
    });
  });

  describe('duplicatePlan', () => {
    it('should duplicate a plan with (copy) suffix', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput('Original')); });

      let newId: string | null = null;
      act(() => { newId = useSessionPlanStore.getState().duplicatePlan(id); });

      expect(newId).toMatch(/^plan_/);
      expect(newId).not.toBe(id);
      expect(useSessionPlanStore.getState().savedPlans).toHaveLength(2);

      const copy = useSessionPlanStore.getState().savedPlans.find(p => p.id === newId);
      expect(copy?.name).toBe('Original (copy)');
      expect(copy?.latitude).toBe(40.0);
    });

    it('should set duplicated plan as active', () => {
      let id = '';
      act(() => { id = useSessionPlanStore.getState().savePlan(makePlanInput()); });
      let newId: string | null = null;
      act(() => { newId = useSessionPlanStore.getState().duplicatePlan(id); });
      expect(useSessionPlanStore.getState().activePlanId).toBe(newId);
    });

    it('should return null for non-existent plan', () => {
      let result: string | null = 'x';
      act(() => { result = useSessionPlanStore.getState().duplicatePlan('nope'); });
      expect(result).toBeNull();
    });
  });

  describe('importPlanV2', () => {
    it('should import a draft as a saved plan', () => {
      const draft = makeDraft();
      let id = '';
      act(() => { id = useSessionPlanStore.getState().importPlanV2(draft, 'Imported Plan'); });

      expect(id).toMatch(/^plan_/);
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.name).toBe('Imported Plan');
      expect(plan.strategy).toBe('balanced');
      expect(plan.minAltitude).toBe(25);
      expect(plan.excludedTargetIds).toEqual(['t1']);
      expect(plan.planningMode).toBe('auto');
    });

    it('should generate fallback name from planDate if none given', () => {
      const draft = makeDraft();
      act(() => { useSessionPlanStore.getState().importPlanV2(draft); });
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.name).toContain('Session');
    });

    it('should set planningMode to manual if manualEdits present', () => {
      const draft = makeDraft({
        manualEdits: [{ targetId: 't1', durationMinutes: 60 }],
      });
      act(() => { useSessionPlanStore.getState().importPlanV2(draft, 'Manual'); });
      expect(useSessionPlanStore.getState().savedPlans[0].planningMode).toBe('manual');
    });

    it('should persist constraints and weatherSnapshot', () => {
      const draft = makeDraft({
        weatherSnapshot: { source: 'manual', capturedAt: '2025-07-01T00:00:00Z', cloudCover: 20 },
        notes: 'Test notes',
      });
      act(() => { useSessionPlanStore.getState().importPlanV2(draft, 'Weather'); });
      const plan = useSessionPlanStore.getState().savedPlans[0];
      expect(plan.constraints).toEqual(expect.objectContaining({
        minAltitude: draft.constraints.minAltitude,
        minImagingTime: draft.constraints.minImagingTime,
      }));
      expect(plan.weatherSnapshot?.cloudCover).toBe(20);
      expect(plan.notes).toBe('Test notes');
    });

    it('should persist guide metadata for guide-seeded drafts', () => {
      const guideContext = makeGuideContext();
      const draft = makeDraft({
        guideContext,
      });

      act(() => { useSessionPlanStore.getState().importPlanV2(draft, 'Guide Plan'); });

      expect(useSessionPlanStore.getState().savedPlans[0].guideContext).toEqual(guideContext);
    });
  });

  describe('execution workflow', () => {
    it('should create an active execution from a saved plan', () => {
      let planId = '';
      act(() => {
        planId = useSessionPlanStore.getState().savePlan(makeExecutionPlanInput());
      });

      const saved = useSessionPlanStore.getState().getPlanById(planId);
      expect(saved).toBeDefined();

      let executionId = '';
      act(() => {
        executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved!, {
          locationId: 'loc-1',
          locationName: 'Backyard',
        });
      });

      const state = useSessionPlanStore.getState();
      expect(state.activeExecutionId).toBe(executionId);
      expect(state.executions).toHaveLength(1);
      expect(state.executions[0].sourcePlanId).toBe(planId);
      expect(state.executions[0].targets[0].status).toBe('planned');
      expect(state.executions[0].targets[0].scheduledDurationMinutes).toBe(90);
    });

    it('should carry guide metadata into execution state', () => {
      const planInput = {
        ...makeExecutionPlanInput(),
        guideContext: makeGuideContext(),
      };
      let planId = '';
      act(() => {
        planId = useSessionPlanStore.getState().savePlan(planInput);
      });

      const saved = useSessionPlanStore.getState().getPlanById(planId);
      let executionId = '';
      act(() => {
        executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved!, {
          locationId: 'loc-1',
          locationName: 'Backyard',
        });
      });

      const execution = useSessionPlanStore.getState().getExecutionById(executionId);
      expect(execution?.guideContext).toEqual(planInput.guideContext);
    });

    it('should attach an observation id to the matching execution target', () => {
      let planId = '';
      act(() => {
        planId = useSessionPlanStore.getState().savePlan(makeExecutionPlanInput());
      });

      const saved = useSessionPlanStore.getState().getPlanById(planId);
      let executionId = '';
      act(() => {
        executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved!, {
          locationId: 'loc-1',
          locationName: 'Backyard',
        });
      });

      act(() => {
        useSessionPlanStore.getState().attachObservationToExecutionTarget(executionId, 'm31', 'obs-1');
      });

      const target = useSessionPlanStore.getState().executions[0].targets[0];
      expect(target.observationIds).toEqual(['obs-1']);
    });

    it('should allow valid target status transitions planned -> in_progress -> completed', () => {
      let planId = '';
      act(() => {
        planId = useSessionPlanStore.getState().savePlan(makeExecutionPlanInput());
      });
      const saved = useSessionPlanStore.getState().getPlanById(planId);
      let executionId = '';
      act(() => {
        executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved!, {
          locationId: 'loc-1',
          locationName: 'Backyard',
        });
      });

      act(() => {
        useSessionPlanStore.getState().updateExecutionTarget(executionId, 'm31', {
          status: 'in_progress',
        });
      });
      expect(useSessionPlanStore.getState().executions[0].targets[0].status).toBe('in_progress');

      act(() => {
        useSessionPlanStore.getState().updateExecutionTarget(executionId, 'm31', {
          status: 'completed',
        });
      });
      const target = useSessionPlanStore.getState().executions[0].targets[0];
      expect(target.status).toBe('completed');
      expect(target.actualStart).toBeDefined();
      expect(target.actualEnd).toBeDefined();
      expect(useSessionPlanStore.getState().executions[0].summary?.completedTargets).toBe(1);
    });

    it('should reject invalid target status regression completed -> planned', () => {
      let planId = '';
      act(() => {
        planId = useSessionPlanStore.getState().savePlan(makeExecutionPlanInput());
      });
      const saved = useSessionPlanStore.getState().getPlanById(planId);
      let executionId = '';
      act(() => {
        executionId = useSessionPlanStore.getState().createExecutionFromPlan(saved!, {
          locationId: 'loc-1',
          locationName: 'Backyard',
        });
      });

      act(() => {
        useSessionPlanStore.getState().updateExecutionTarget(executionId, 'm31', {
          status: 'completed',
        });
      });
      expect(useSessionPlanStore.getState().executions[0].targets[0].status).toBe('completed');

      act(() => {
        useSessionPlanStore.getState().updateExecutionTarget(executionId, 'm31', {
          status: 'planned',
        });
      });
      expect(useSessionPlanStore.getState().executions[0].targets[0].status).toBe('completed');
    });
  });

  describe('saveTemplate', () => {
    it('should save a template and return id', () => {
      const draft = makeDraft();
      let id = '';
      act(() => {
        id = useSessionPlanStore.getState().saveTemplate({ name: 'Tpl1', draft });
      });
      expect(id).toMatch(/^template_/);
      expect(useSessionPlanStore.getState().templates).toHaveLength(1);
      expect(useSessionPlanStore.getState().templates[0].name).toBe('Tpl1');
    });

    it('should normalize template draft payload before persist', () => {
      const draft = makeDraft({
        constraints: {
          minAltitude: 999,
          minImagingTime: -10,
          sessionWindow: { startTime: '99:99' as unknown as string, endTime: '01:00' },
        },
        manualEdits: [
          { targetId: 'm31', startTime: '22:00', durationMinutes: 60, locked: true },
          { targetId: 'bad', startTime: '99:99', durationMinutes: 30, locked: true },
        ],
      });
      act(() => {
        useSessionPlanStore.getState().saveTemplate({ name: 'Tpl normalize', draft });
      });
      const savedDraft = useSessionPlanStore.getState().templates[0].draft;
      expect(savedDraft.constraints.minAltitude).toBe(90);
      expect(savedDraft.constraints.minImagingTime).toBe(1);
      expect(savedDraft.constraints.sessionWindow).toBeUndefined();
      expect(savedDraft.manualEdits).toHaveLength(1);
    });

    it('should preserve guide metadata in template round-trips', () => {
      const guideContext = makeGuideContext();
      const draft = makeDraft({
        guideContext,
      });

      let templateId = '';
      act(() => {
        templateId = useSessionPlanStore.getState().saveTemplate({ name: 'Guide Template', draft });
      });

      expect(useSessionPlanStore.getState().loadTemplate(templateId)?.draft.guideContext).toEqual(guideContext);
    });

    it('should enforce MAX_SAVED_TEMPLATES (50)', () => {
      const draft = makeDraft();
      act(() => {
        for (let i = 0; i < 55; i++) {
          useSessionPlanStore.getState().saveTemplate({ name: `Tpl ${i}`, draft });
        }
      });
      expect(useSessionPlanStore.getState().templates).toHaveLength(50);
    });
  });

  describe('loadTemplate', () => {
    it('should return template by id', () => {
      const draft = makeDraft();
      let id = '';
      act(() => { id = useSessionPlanStore.getState().saveTemplate({ name: 'Load Me', draft }); });
      const tpl = useSessionPlanStore.getState().loadTemplate(id);
      expect(tpl?.name).toBe('Load Me');
      expect(tpl?.draft.strategy).toBe('balanced');
    });

    it('should return undefined for non-existent id', () => {
      expect(useSessionPlanStore.getState().loadTemplate('nope')).toBeUndefined();
    });
  });

  describe('deleteTemplate', () => {
    it('should remove a template', () => {
      const draft = makeDraft();
      let id = '';
      act(() => { id = useSessionPlanStore.getState().saveTemplate({ name: 'Del', draft }); });
      expect(useSessionPlanStore.getState().templates).toHaveLength(1);
      act(() => { useSessionPlanStore.getState().deleteTemplate(id); });
      expect(useSessionPlanStore.getState().templates).toHaveLength(0);
    });
  });

  describe('listTemplates', () => {
    it('should return all templates', () => {
      const draft = makeDraft();
      act(() => {
        useSessionPlanStore.getState().saveTemplate({ name: 'A', draft });
        useSessionPlanStore.getState().saveTemplate({ name: 'B', draft });
      });
      const list = useSessionPlanStore.getState().listTemplates();
      expect(list).toHaveLength(2);
    });
  });

  describe('migration', () => {
    it('should normalize legacy persisted records during migrate', () => {
      const migrate = useSessionPlanStore.persist.getOptions().migrate;
      expect(migrate).toBeDefined();
      const migrated = migrate?.({
        savedPlans: [{
          id: 'plan-legacy',
          name: 'Legacy Plan',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          planDate: 'invalid-date',
          latitude: 40,
          longitude: -74,
          strategy: 'balanced',
          minAltitude: 10,
          minImagingTime: 20,
          targets: [],
          excludedTargetIds: [],
          totalImagingTime: 0,
          nightCoverage: 0,
          efficiency: 0,
          guideContext: makeGuideContext(),
        }],
        templates: [{
          id: 'tpl-legacy',
          name: 'Legacy Template',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          draft: {
            planDate: 'invalid',
            strategy: 'balanced',
            constraints: {
              minAltitude: 25,
              minImagingTime: 30,
            },
            excludedTargetIds: [],
            manualEdits: [],
            guideContext: makeGuideContext(),
          },
        }],
        executions: [],
        activePlanId: null,
        activeExecutionId: null,
      } as Partial<SessionPlanState>, 3);

      const next = migrated as Partial<SessionPlanState>;
      expect(next.savedPlans?.[0].constraints).toBeDefined();
      expect(next.savedPlans?.[0].minImagingTime).toBeGreaterThanOrEqual(1);
      expect(next.savedPlans?.[0].guideContext).toEqual(makeGuideContext());
      expect(next.templates?.[0].draft.planDate).toContain('T');
      expect(next.templates?.[0].draft.guideContext).toEqual(makeGuideContext());
    });
  });
});
