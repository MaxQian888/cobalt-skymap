/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SessionPlanner } from '../session-planner';
import type { SessionPlanState } from '@/lib/stores/session-plan-store';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('../mount-safety-simulator', () => ({
  MountSafetySimulator: () => <div data-testid="mount-safety-simulator" />,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
  isServer: jest.fn(() => false),
  isWeb: jest.fn(() => true),
  isMobile: jest.fn(() => false),
  isDesktop: jest.fn(() => true),
  getPlatform: jest.fn(() => 'web'),
  onlyInTauri: jest.fn(),
  onlyInWeb: jest.fn(),
}));

jest.mock('@/lib/tauri', () => ({
  tauriApi: {
    observationLog: {
      createPlannedSession: jest.fn(),
    },
    sessionIo: {
      exportSessionPlan: jest.fn(),
      importSessionPlan: jest.fn(),
      saveSessionTemplate: jest.fn(),
      loadSessionTemplates: jest.fn(),
    },
  },
  mountApi: {
    getObservingConditions: jest.fn(),
    getSafetyState: jest.fn(),
  },
}));

jest.mock('@/lib/astronomy/astro-utils', () => {
  const dusk = new Date('2025-06-15T20:00:00.000Z');
  const dawn = new Date('2025-06-16T04:00:00.000Z');
  return {
    calculateTwilightTimes: jest.fn(() => ({
      sunset: new Date('2025-06-15T18:00:00.000Z'),
      civilDusk: new Date('2025-06-15T18:30:00.000Z'),
      nauticalDusk: new Date('2025-06-15T19:00:00.000Z'),
      astronomicalDusk: dusk,
      astronomicalDawn: dawn,
      nauticalDawn: new Date('2025-06-16T04:30:00.000Z'),
      civilDawn: new Date('2025-06-16T05:00:00.000Z'),
      sunrise: new Date('2025-06-16T05:30:00.000Z'),
      nightDuration: 8,
      darknessDuration: 8,
      isCurrentlyNight: true,
      currentTwilightPhase: 'night',
    })),
    getMoonPhase: jest.fn(() => 0.2),
    getMoonPhaseName: jest.fn(() => 'Waxing Crescent'),
    getMoonIllumination: jest.fn(() => 22),
    formatTimeShort: jest.fn((date: Date | null) => (date ? '20:00' : '--:--')),
    formatDuration: jest.fn((hours: number) => `${hours.toFixed(1)}h`),
    getJulianDateFromDate: jest.fn(() => 2460000),
  };
});

jest.mock('@/lib/astronomy/session-scheduler-v2', () => ({
  optimizeScheduleV2: jest.fn(() => {
    const start = new Date('2025-06-15T20:30:00.000Z');
    const end = new Date('2025-06-15T22:00:00.000Z');
    return {
      targets: [
        {
          target: {
            id: 'target-1',
            name: 'M31',
            ra: 10.684,
            dec: 41.269,
            raString: '',
            decString: '',
            addedAt: Date.now(),
            status: 'planned',
            priority: 'medium',
            tags: [],
            isFavorite: false,
            isArchived: false,
          },
          startTime: start,
          endTime: end,
          duration: 1.5,
          transitTime: start,
          maxAltitude: 72,
          moonDistance: 88,
          feasibility: {
            score: 86,
            moonScore: 90,
            altitudeScore: 85,
            durationScore: 80,
            twilightScore: 92,
            recommendation: 'excellent',
            warnings: [],
            tips: [],
          },
          conflicts: [],
          isOptimal: true,
          order: 1,
        },
      ],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
      gaps: [
        {
          start: new Date('2025-06-15T22:30:00.000Z'),
          end: new Date('2025-06-15T23:00:00.000Z'),
          duration: 0.5,
        },
      ],
      recommendations: [],
      warnings: [],
      conflicts: [{ type: 'weather', targetId: 'global', message: 'Cloud cover too high' }],
    };
  }),
}));

const mockMountState = {
  profileInfo: {
    AstrometrySettings: {
      Latitude: 40,
      Longitude: -74,
    },
  },
  mountInfo: {
    Connected: false,
  },
  connectionConfig: {
    protocol: 'alpaca',
    host: 'localhost',
    port: 11111,
    deviceId: 0,
  },
  safetyConfig: {
    enabled: false,
  },
};

const mockStellariumState = {
  setViewDirection: jest.fn(),
};

const mockEquipmentState = {
  focalLength: 800,
  aperture: 100,
  sensorWidth: 22.3,
  sensorHeight: 14.9,
  pixelSize: 3.76,
  activeCameraId: null,
  activeTelescopeId: null,
  customCameras: [],
  customTelescopes: [],
};

type MockedStoreAction<T extends (...args: never[]) => unknown> = jest.MockedFunction<T>;

const createStoreActionMock = <T extends (...args: never[]) => unknown>(
  implementation?: (...args: Parameters<T>) => ReturnType<T>,
): MockedStoreAction<T> => jest.fn(implementation) as unknown as MockedStoreAction<T>;

type MockSessionPlanState = {
  savedPlans: SessionPlanState['savedPlans'];
  templates: SessionPlanState['templates'];
  executions: SessionPlanState['executions'];
  activeExecutionId: SessionPlanState['activeExecutionId'];
  draftRecovery: SessionPlanState['draftRecovery'];
  recentImports: SessionPlanState['recentImports'];
  savePlan: MockedStoreAction<SessionPlanState['savePlan']>;
  updatePlan: MockedStoreAction<SessionPlanState['updatePlan']>;
  saveTemplate: MockedStoreAction<SessionPlanState['saveTemplate']>;
  loadTemplate: MockedStoreAction<SessionPlanState['loadTemplate']>;
  renamePlan: MockedStoreAction<SessionPlanState['renamePlan']>;
  duplicatePlan: MockedStoreAction<SessionPlanState['duplicatePlan']>;
  renameTemplate: MockedStoreAction<SessionPlanState['renameTemplate']>;
  duplicateTemplate: MockedStoreAction<SessionPlanState['duplicateTemplate']>;
  importPlanV2: MockedStoreAction<SessionPlanState['importPlanV2']>;
  getPlanById: MockedStoreAction<SessionPlanState['getPlanById']>;
  deletePlan: MockedStoreAction<SessionPlanState['deletePlan']>;
  deleteTemplate: MockedStoreAction<SessionPlanState['deleteTemplate']>;
  saveDraftRecovery: MockedStoreAction<SessionPlanState['saveDraftRecovery']>;
  clearDraftRecovery: MockedStoreAction<SessionPlanState['clearDraftRecovery']>;
  addImportRecord: MockedStoreAction<SessionPlanState['addImportRecord']>;
  dismissImportRecord: MockedStoreAction<SessionPlanState['dismissImportRecord']>;
  clearImportRecords: MockedStoreAction<SessionPlanState['clearImportRecords']>;
  listTemplates: MockedStoreAction<SessionPlanState['listTemplates']>;
  syncExecutionFromObservationSession: MockedStoreAction<SessionPlanState['syncExecutionFromObservationSession']>;
  setActiveExecution: MockedStoreAction<SessionPlanState['setActiveExecution']>;
  createExecutionFromPlan: MockedStoreAction<SessionPlanState['createExecutionFromPlan']>;
};

const mockSessionPlanState: MockSessionPlanState = {
  savedPlans: [] as SessionPlanState['savedPlans'],
  templates: [{
    id: 'tpl-1',
    name: 'Template A',
    draft: {
      planDate: new Date('2025-06-15T00:00:00.000Z').toISOString(),
      strategy: 'balanced',
      constraints: {
        minAltitude: 20,
        minImagingTime: 30,
      },
      excludedTargetIds: [],
      manualEdits: [],
    },
    createdAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
  }],
  executions: [] as SessionPlanState['executions'],
  activeExecutionId: null as string | null,
  draftRecovery: null as SessionPlanState['draftRecovery'],
  recentImports: [] as SessionPlanState['recentImports'],
  savePlan: createStoreActionMock<SessionPlanState['savePlan']>(() => 'saved-plan-1'),
  updatePlan: createStoreActionMock<SessionPlanState['updatePlan']>(),
  saveTemplate: createStoreActionMock<SessionPlanState['saveTemplate']>(),
  loadTemplate: createStoreActionMock<SessionPlanState['loadTemplate']>(),
  renamePlan: createStoreActionMock<SessionPlanState['renamePlan']>(),
  duplicatePlan: createStoreActionMock<SessionPlanState['duplicatePlan']>(() => 'saved-plan-copy'),
  renameTemplate: createStoreActionMock<SessionPlanState['renameTemplate']>(),
  duplicateTemplate: createStoreActionMock<SessionPlanState['duplicateTemplate']>(() => 'template-copy'),
  importPlanV2: createStoreActionMock<SessionPlanState['importPlanV2']>(),
  getPlanById: createStoreActionMock<SessionPlanState['getPlanById']>(),
  deletePlan: createStoreActionMock<SessionPlanState['deletePlan']>(),
  deleteTemplate: createStoreActionMock<SessionPlanState['deleteTemplate']>(),
  saveDraftRecovery: createStoreActionMock<SessionPlanState['saveDraftRecovery']>(),
  clearDraftRecovery: createStoreActionMock<SessionPlanState['clearDraftRecovery']>(),
  addImportRecord: createStoreActionMock<SessionPlanState['addImportRecord']>(() => 'import-1'),
  dismissImportRecord: createStoreActionMock<SessionPlanState['dismissImportRecord']>(),
  clearImportRecords: createStoreActionMock<SessionPlanState['clearImportRecords']>(),
  listTemplates: createStoreActionMock<SessionPlanState['listTemplates']>(() => []),
  syncExecutionFromObservationSession: createStoreActionMock<SessionPlanState['syncExecutionFromObservationSession']>(),
  setActiveExecution: createStoreActionMock<SessionPlanState['setActiveExecution']>(),
  createExecutionFromPlan: createStoreActionMock<SessionPlanState['createExecutionFromPlan']>(),
};

const mockPlanningUiState = {
  sessionPlannerOpen: true,
  setSessionPlannerOpen: jest.fn(),
  openShotList: jest.fn(),
  openTonightRecommendations: jest.fn(),
  openMessierMarathonGuide: jest.fn(),
  plannerDraftSeed: null as Record<string, unknown> | null,
  plannerDraftSeedRequestId: 0,
  clearPlannerDraftSeed: jest.fn(),
  plannerWorkspaceOpen: false,
  plannerWorkspaceTab: 'plans',
  plannerWorkspaceFilter: 'all',
  selectedPlannerWorkspaceEntryId: null as string | null,
  recoveryPromptVisible: false,
  openPlannerWorkspace: jest.fn(),
  closePlannerWorkspace: jest.fn(),
  setPlannerWorkspaceOpen: jest.fn(),
  setPlannerWorkspaceTab: jest.fn(),
  setPlannerWorkspaceFilter: jest.fn(),
  setSelectedPlannerWorkspaceEntry: jest.fn(),
  setRecoveryPromptVisible: jest.fn(),
};

const mockStoreSelectors = {
  useMountStore: jest.fn((selector: (state: typeof mockMountState) => unknown) => selector(mockMountState)),
  useStellariumStore: jest.fn((selector: (state: typeof mockStellariumState) => unknown) => selector(mockStellariumState)),
  useEquipmentStore: jest.fn((selector: (state: typeof mockEquipmentState) => unknown) => selector(mockEquipmentState)),
  useSessionPlanStore: jest.fn((selector: (state: typeof mockSessionPlanState) => unknown) => selector(mockSessionPlanState)),
  usePlanningUiStore: jest.fn((selector: (state: typeof mockPlanningUiState) => unknown) => selector(mockPlanningUiState)),
};

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (state: unknown) => unknown) => mockStoreSelectors.useMountStore(selector),
  useStellariumStore: (selector: (state: unknown) => unknown) => mockStoreSelectors.useStellariumStore(selector),
  useEquipmentStore: (selector: (state: unknown) => unknown) => mockStoreSelectors.useEquipmentStore(selector),
  useSessionPlanStore: (selector: (state: unknown) => unknown) => mockStoreSelectors.useSessionPlanStore(selector),
  usePlanningUiStore: (selector: (state: unknown) => unknown) => mockStoreSelectors.usePlanningUiStore(selector),
}));

const mockTargetStoreState = {
  targets: [{
    id: 'target-1',
    name: 'M31',
    ra: 10.684,
    dec: 41.269,
    raString: '',
    decString: '',
    addedAt: 1,
    status: 'planned',
    priority: 'medium',
    tags: [],
    isFavorite: false,
    isArchived: false,
  }],
  setActiveTarget: jest.fn(),
  addTargetsBatch: jest.fn(),
};

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: typeof mockTargetStoreState) => unknown) => selector(mockTargetStoreState),
}));
const mockDeviceStoreState = {
  profiles: [],
  syncFromEquipmentStore: jest.fn(),
  syncFromMountStore: jest.fn(),
  getSessionReadiness: jest.fn(() => ({ isReady: true, required: [], missing: [], warnings: [] })),
  setActiveSessionProfileIds: jest.fn(),
};

jest.mock('@/lib/stores/device-store', () => {
  const useDeviceStore = (selector: (state: typeof mockDeviceStoreState) => unknown) => selector(mockDeviceStoreState);
  (useDeviceStore as typeof useDeviceStore & { getState: () => typeof mockDeviceStoreState }).getState = () => mockDeviceStoreState;
  return { useDeviceStore };
});

describe('SessionPlanner', () => {
  const mockIsTauri = jest.requireMock('@/lib/storage/platform').isTauri as jest.Mock;
  const mockCreatePlannedSession = jest.requireMock('@/lib/tauri').tauriApi.observationLog.createPlannedSession as jest.Mock;
  const mockLoadSessionTemplates = jest.requireMock('@/lib/tauri').tauriApi.sessionIo.loadSessionTemplates as jest.Mock;
  const mockImportSessionPlan = jest.requireMock('@/lib/tauri').tauriApi.sessionIo.importSessionPlan as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const cliBridgeStore = jest.requireActual('@/lib/stores/cli-bridge-store') as typeof import('@/lib/stores/cli-bridge-store');
    cliBridgeStore.useCliBridgeStore.setState({
      sessionPlanImportRequestId: 0,
      sessionPlanImportContent: null,
      sessionPlanImportSourcePath: null,
    });
    mockIsTauri.mockReturnValue(false);
    mockSessionPlanState.savedPlans = [];
    mockSessionPlanState.executions = [];
    mockSessionPlanState.activeExecutionId = null;
    mockSessionPlanState.draftRecovery = null;
    mockSessionPlanState.recentImports = [];
    mockSessionPlanState.savePlan.mockReturnValue('saved-plan-1');
    mockLoadSessionTemplates.mockResolvedValue([]);
    mockImportSessionPlan.mockResolvedValue('');
    mockPlanningUiState.plannerWorkspaceOpen = false;
    mockPlanningUiState.plannerWorkspaceTab = 'plans';
    mockPlanningUiState.plannerWorkspaceFilter = 'all';
    mockPlanningUiState.selectedPlannerWorkspaceEntryId = null;
    mockPlanningUiState.recoveryPromptVisible = false;
    mockCreatePlannedSession.mockResolvedValue({
      id: 'session-1',
      date: '2025-06-15',
      observations: [],
      equipment_ids: [],
      source_plan_id: 'saved-plan-1',
      source_plan_name: 'sessionPlanner.title - 6/15/2025',
      execution_status: 'active',
      execution_targets: [
        {
          id: 'saved-plan-1-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        },
      ],
      created_at: '2025-06-15T19:00:00.000Z',
      updated_at: '2025-06-15T19:00:00.000Z',
    });
  });

  it('renders conflict banners and template entry points', () => {
    render(<SessionPlanner />);
    expect(screen.getByText('Cloud cover too high')).toBeInTheDocument();
    expect(screen.getByText('sessionPlanner.workspace')).toBeInTheDocument();
    expect(screen.getByText('sessionPlanner.importPlan')).toBeInTheDocument();
  });

  it('opens the dedicated workspace with mixed entries and query filtering', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [],
      excludedTargetIds: [],
      totalImagingTime: 0,
      nightCoverage: 0,
      efficiency: 0,
    }];
    mockSessionPlanState.recentImports = [{
      id: 'import-1',
      importedAt: '2025-06-15T18:00:00.000Z',
      source: 'cli',
      linkedPlanId: 'saved-plan-2',
      linkedPlanName: 'Imported Plan',
      draft: {
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
      },
      diagnostics: {
        format: 'csv',
        unmatchedTargets: ['missing-target'],
        createdTargets: ['M31'],
        skippedRows: 1,
        warnings: ['warning-1'],
      },
    }];
    mockSessionPlanState.draftRecovery = {
      draft: {
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
      },
      updatedAt: '2025-06-15T17:00:00.000Z',
      source: 'planner-close',
      relatedPlanName: 'Recovered Plan',
    };
    mockLoadSessionTemplates.mockResolvedValue([{
      id: 'template-remote',
      name: 'Remote Observatory Template',
      draft: {
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
      },
      created_at: '2025-06-15T16:00:00.000Z',
      updated_at: '2025-06-15T16:30:00.000Z',
    }]);

    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: /sessionPlanner\.workspace/ }));

    await waitFor(() => {
      expect(screen.getByTestId('planner-workspace-panel')).toBeInTheDocument();
      expect(screen.getAllByText('Saved Plan').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Imported Plan').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Recovered Plan').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Remote Observatory Template').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByTestId('planner-workspace-search'), {
      target: { value: 'remote' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Remote Observatory Template').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('Saved Plan')).toHaveLength(0);
    });
  });

  it('shows load-only actions for remote templates inside the workspace', async () => {
    mockIsTauri.mockReturnValue(true);
    mockLoadSessionTemplates.mockResolvedValue([{
      id: 'template-remote',
      name: 'Remote Observatory Template',
      draft: {
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
      },
      created_at: '2025-06-15T16:00:00.000Z',
      updated_at: '2025-06-15T16:30:00.000Z',
    }]);

    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: /sessionPlanner\.workspace/ }));

    const remoteTemplateLabel = await screen.findByText('Remote Observatory Template');
    fireEvent.click(remoteTemplateLabel);

    expect(screen.getByTestId('planner-workspace-action-load')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-workspace-action-rename')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planner-workspace-action-duplicate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('planner-workspace-action-delete')).not.toBeInTheDocument();
  });

  it('closes the planner dialog from the footer button', () => {
    render(<SessionPlanner />);

    fireEvent.change(screen.getByTestId('session-notes'), {
      target: { value: 'Unsaved planner notes' },
    });
    fireEvent.click(screen.getByTestId('session-planner-close-button'));

    expect(mockPlanningUiState.setSessionPlannerOpen).toHaveBeenCalledWith(false);
  });

  it('shows a recovery prompt when a recoverable draft exists on reopen', () => {
    mockPlanningUiState.recoveryPromptVisible = true;
    mockSessionPlanState.draftRecovery = {
      draft: {
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
      },
      updatedAt: '2025-06-15T17:00:00.000Z',
      source: 'planner-close',
      relatedPlanName: 'Recovered Plan',
    };

    render(<SessionPlanner />);

    expect(screen.getByTestId('planner-draft-recovery-prompt')).toBeInTheDocument();
    expect(screen.getByText('Recovered Plan')).toBeInTheDocument();
  });

  it('applies CLI import payloads from the bridge store', async () => {
    mockSessionPlanState.importPlanV2.mockReturnValue('saved-plan-2');
    mockSessionPlanState.getPlanById = jest.fn((id: string) => id === 'saved-plan-2'
      ? {
          id: 'saved-plan-2',
          name: 'CLI Imported Plan',
          createdAt: '2025-06-15T19:00:00.000Z',
          updatedAt: '2025-06-15T19:00:00.000Z',
          planDate: '2025-06-15T00:00:00.000Z',
          latitude: 40,
          longitude: -74,
          strategy: 'balanced',
          minAltitude: 20,
          minImagingTime: 30,
          targets: [],
          excludedTargetIds: [],
          totalImagingTime: 0,
          nightCoverage: 0,
          efficiency: 0,
        }
      : undefined);
    mockPlanningUiState.plannerDraftSeedRequestId = 0;
    const cliBridgeStore = jest.requireActual('@/lib/stores/cli-bridge-store') as typeof import('@/lib/stores/cli-bridge-store');
    cliBridgeStore.useCliBridgeStore.setState({
      sessionPlanImportRequestId: 1,
      sessionPlanImportContent: JSON.stringify({
        planDate: '2025-06-15T00:00:00.000Z',
        strategy: 'balanced',
        constraints: { minAltitude: 20, minImagingTime: 30 },
        excludedTargetIds: [],
        manualEdits: [],
        notes: 'Imported from CLI',
      }),
      sessionPlanImportSourcePath: 'D:/imports/cli-plan.json',
    });

    render(<SessionPlanner />);

    await waitFor(() => {
      expect(mockSessionPlanState.importPlanV2).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Imported from CLI',
        }),
      );
      expect(mockPlanningUiState.setSessionPlannerOpen).toHaveBeenCalledWith(true);
    });

    expect(screen.getByTestId('session-notes')).toHaveValue('Imported from CLI');
  });

  it('resumes an execution directly from a workspace plan entry', async () => {
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [],
      excludedTargetIds: [],
      totalImagingTime: 0,
      nightCoverage: 0,
      efficiency: 0,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'active',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'planned',
        observationIds: [],
      }],
    }];

    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: /sessionPlanner\.workspace/ }));
    fireEvent.click(screen.getAllByText('Saved Plan')[0]);

    await waitFor(() => {
      expect(screen.getByTestId('planner-workspace-action-resume')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('planner-workspace-action-resume'));
    expect(mockSessionPlanState.setActiveExecution).toHaveBeenCalledWith('session-1');
  });

  it('toggles timeline gaps through showGaps switch', () => {
    render(<SessionPlanner />);
    expect(screen.getAllByTestId('session-gap').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.optimizationSettings' }));
    const gapSwitch = screen.getByRole('switch', { name: 'sessionPlanner.showGaps' });
    fireEvent.click(gapSwitch);

    expect(screen.queryByTestId('session-gap')).not.toBeInTheDocument();
  });

  it('renders new constraint controls and allows basic interaction', () => {
    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.optimizationSettings' }));

    expect(screen.getByText(/sessionPlanner\.minMoonDistance/)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot=\"slider\"]').length).toBeGreaterThanOrEqual(3);

    const exposureSwitch = screen.getByRole('switch', { name: 'sessionPlanner.useExposurePlanDuration' });
    fireEvent.click(exposureSwitch);
    expect(exposureSwitch).toHaveAttribute('aria-checked', 'false');

    const startInput = screen.getByLabelText('sessionPlanner.sessionWindowStart') as HTMLInputElement;
    const endInput = screen.getByLabelText('sessionPlanner.sessionWindowEnd') as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '21:00' } });
    fireEvent.change(endInput, { target: { value: '03:00' } });
    expect(startInput.value).toBe('21:00');
    expect(endInput.value).toBe('03:00');

    const enforceSwitch = screen.getByRole('switch', { name: 'sessionPlanner.enforceMountSafety' });
    const avoidSwitch = screen.getByRole('switch', { name: 'sessionPlanner.avoidMeridianFlipWindow' });
    expect(avoidSwitch).toBeDisabled();

    fireEvent.click(enforceSwitch);
    expect(avoidSwitch).not.toBeDisabled();
  });

  it('starts execution from the current plan in Tauri mode', async () => {
    mockIsTauri.mockReturnValue(true);

    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.startExecution' }));

    await waitFor(() => {
      expect(mockSessionPlanState.savePlan).toHaveBeenCalled();
      expect(mockCreatePlannedSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePlanId: 'saved-plan-1',
          executionTargets: expect.arrayContaining([
            expect.objectContaining({
              targetId: 'target-1',
              targetName: 'M31',
            }),
          ]),
        }),
      );
      expect(mockSessionPlanState.syncExecutionFromObservationSession).toHaveBeenCalled();
    });
  });

  it('shows continue execution when an active execution exists', () => {
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [{
        targetId: 'target-1',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-06-15T20:30:00.000Z',
        endTime: '2025-06-15T22:00:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 86,
        order: 1,
      }],
      excludedTargetIds: [],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'active',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'planned',
        observationIds: [],
      }],
    }];
    mockSessionPlanState.activeExecutionId = 'session-1';

    render(<SessionPlanner />);

    expect(screen.getByRole('button', { name: 'sessionPlanner.continueExecution' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'sessionPlanner.replanRemaining' })).toBeInTheDocument();
  });

  it('falls back to start execution when there is no related execution', () => {
    render(<SessionPlanner />);

    expect(screen.getByRole('button', { name: 'sessionPlanner.startExecution' })).toBeInTheDocument();
    expect(screen.queryByTestId('session-planner-execution-summary')).not.toBeInTheDocument();
  });

  it('renders active execution summary with focus target context', () => {
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [{
        targetId: 'target-1',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-06-15T20:30:00.000Z',
        endTime: '2025-06-15T22:00:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 86,
        order: 1,
      }],
      excludedTargetIds: [],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'active',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'in_progress',
        observationIds: [],
      }],
    }];

    render(<SessionPlanner />);

    const summary = screen.getByTestId('session-planner-execution-summary');
    expect(summary).toBeInTheDocument();
    expect(within(summary).getByText('M31')).toBeInTheDocument();
  });

  it('shows archive follow-through for completed executions', () => {
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [{
        targetId: 'target-1',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-06-15T20:30:00.000Z',
        endTime: '2025-06-15T22:00:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 86,
        order: 1,
      }],
      excludedTargetIds: [],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'completed',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      summary: {
        completedTargets: 1,
        skippedTargets: 0,
        failedTargets: 0,
        totalTargets: 1,
        totalObservations: 1,
      },
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'completed',
        observationIds: ['obs-1'],
      }],
    }];

    render(<SessionPlanner />);

    expect(screen.getByTestId('session-planner-archive-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'sessionPlanner.continueExecution' })).not.toBeInTheDocument();
  });

  it('hides live execution controls for archived executions', () => {
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [{
        targetId: 'target-1',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-06-15T20:30:00.000Z',
        endTime: '2025-06-15T22:00:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 86,
        order: 1,
      }],
      excludedTargetIds: [],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'archived',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'completed',
        observationIds: ['obs-1'],
      }],
    }];

    render(<SessionPlanner />);

    expect(screen.getByRole('button', { name: 'sessionPlanner.startExecution' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'sessionPlanner.continueExecution' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('session-planner-execution-summary')).not.toBeInTheDocument();
  });

  it('blocks replan when no remaining targets are available', () => {
    const { toast } = jest.requireMock('sonner');
    mockSessionPlanState.savedPlans = [{
      id: 'saved-plan-1',
      name: 'Saved Plan',
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      planDate: new Date().toISOString(),
      latitude: 40,
      longitude: -74,
      strategy: 'balanced',
      minAltitude: 30,
      minImagingTime: 30,
      targets: [{
        targetId: 'target-1',
        targetName: 'M31',
        ra: 10.684,
        dec: 41.269,
        startTime: '2025-06-15T20:30:00.000Z',
        endTime: '2025-06-15T22:00:00.000Z',
        duration: 1.5,
        maxAltitude: 72,
        moonDistance: 88,
        feasibilityScore: 86,
        order: 1,
      }],
      excludedTargetIds: [],
      totalImagingTime: 1.5,
      nightCoverage: 40,
      efficiency: 100,
    }];
    mockSessionPlanState.executions = [{
      id: 'session-1',
      sourcePlanId: 'saved-plan-1',
      sourcePlanName: 'Saved Plan',
      status: 'active',
      planDate: new Date().toISOString(),
      createdAt: '2025-06-15T19:00:00.000Z',
      updatedAt: '2025-06-15T19:00:00.000Z',
      targets: [{
        id: 'saved-plan-1-target-1',
        targetId: 'target-1',
        targetName: 'M31',
        scheduledStart: '2025-06-15T20:30:00.000Z',
        scheduledEnd: '2025-06-15T22:00:00.000Z',
        scheduledDurationMinutes: 90,
        order: 1,
        status: 'completed',
        observationIds: ['obs-1'],
      }],
    }];

    render(<SessionPlanner />);
    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.replanRemaining' }));

    expect(toast.error).toHaveBeenCalledWith('sessionPlanner.noRemainingTargetsToReplan');
  });

  it('blocks save when session window is incomplete', () => {
    render(<SessionPlanner />);

    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.optimizationSettings' }));
    const startInput = screen.getByLabelText('sessionPlanner.sessionWindowStart') as HTMLInputElement;
    const endInput = screen.getByLabelText('sessionPlanner.sessionWindowEnd') as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '21:00' } });
    fireEvent.change(endInput, { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.savePlan' }));

    expect(mockSessionPlanState.savePlan).not.toHaveBeenCalled();
  });

  it('renders messier marathon guide entry point', () => {
    render(<SessionPlanner />);

    expect(screen.getByRole('button', { name: 'sessionPlanner.messierMarathonGuide' })).toBeInTheDocument();
  });

  it('persists guide context when launched from a seeded draft', () => {
    mockPlanningUiState.plannerDraftSeed = {
      planDate: new Date('2025-06-15T00:00:00.000Z').toISOString(),
      strategy: 'balanced',
      constraints: {
        minAltitude: 20,
        minImagingTime: 30,
      },
      excludedTargetIds: [],
      manualEdits: [],
      notes: 'Messier Marathon (recommended)',
      guideContext: {
        kind: 'messier-marathon',
        sessionId: 'marathon-1',
        readiness: 'recommended',
        mode: 'full',
        checkpointOrder: ['target-1'],
        criticalCheckpointIds: ['target-1'],
        stageByTargetId: { 'target-1': 'dusk' },
      },
    };
    mockPlanningUiState.plannerDraftSeedRequestId = 1;

    render(<SessionPlanner />);
    fireEvent.click(screen.getByRole('button', { name: 'sessionPlanner.savePlan' }));

    expect(mockPlanningUiState.clearPlannerDraftSeed).toHaveBeenCalled();
    expect(mockSessionPlanState.savePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        guideContext: expect.objectContaining({
          kind: 'messier-marathon',
          sessionId: 'marathon-1',
        }),
        notes: 'Messier Marathon (recommended)',
      }),
    );
  });
});




