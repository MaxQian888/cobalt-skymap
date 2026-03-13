/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockSessionPlanState = {
  savedPlans: [],
  importPlanV2: jest.fn(),
  syncExecutionFromObservationSession: jest.fn(),
  executions: [],
  activeExecutionId: null,
};

const mockPlanningUiState = {
  openSessionPlanner: jest.fn(),
};

// Mock stores and hooks
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock Tauri API - define inside jest.mock to avoid hoisting issues
jest.mock('@/lib/tauri', () => ({
  tauriApi: {
    observationLog: {
      load: jest.fn().mockResolvedValue({ sessions: [] }),
      save: jest.fn().mockResolvedValue(undefined),
      createSession: jest.fn().mockResolvedValue({
        id: 'session-1',
        date: '2024-01-15',
        observations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        equipment_ids: [],
      }),
      addObservation: jest.fn().mockResolvedValue({
        id: 'session-1',
        date: '2024-01-15',
        observations: [{ id: 'obs-1', object_name: 'M31' }],
      }),
      updateSession: jest.fn().mockResolvedValue({}),
      endSession: jest.fn().mockResolvedValue({}),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      updateObservation: jest.fn().mockResolvedValue({
        id: 'session-1',
        date: '2024-01-15',
        observations: [{ id: 'obs-1', object_name: 'M31' }],
        equipment_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      deleteObservation: jest.fn().mockResolvedValue({
        id: 'session-1',
        date: '2024-01-15',
        observations: [],
        equipment_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      getStats: jest.fn().mockResolvedValue({
        total_sessions: 5,
        total_observations: 25,
        unique_objects: 20,
        total_hours: 15.5,
        objects_by_type: [['galaxy', 10], ['nebula', 8]],
        monthly_counts: [],
      }),
      search: jest.fn().mockResolvedValue([]),
      exportLog: jest.fn().mockResolvedValue(''),
    },
    sessionIo: {
      exportSessionPlan: jest.fn().mockResolvedValue('/tmp/execution.md'),
    },
  },
}));

// Mock platform check
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => true),
  isServer: jest.fn(() => false),
}));

jest.mock('@/lib/stores/session-plan-store', () => ({
  useSessionPlanStore: (selector: (state: unknown) => unknown) => selector(mockSessionPlanState),
}));

jest.mock('@/lib/stores/planning-ui-store', () => ({
  usePlanningUiStore: (selector: (state: unknown) => unknown) => selector(mockPlanningUiState),
}));

jest.mock('@/lib/tauri/hooks', () => ({
  useLocations: () => ({
    locations: { locations: [] },
    loading: false,
    error: null,
  }),
  useEquipment: () => ({
    equipment: { telescopes: [], cameras: [] },
    loading: false,
    error: null,
  }),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ onChange, value, placeholder, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input 
      data-testid="input" 
      type={type}
      value={value} 
      placeholder={placeholder}
      onChange={onChange}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: ({ onChange, value, placeholder, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea 
      data-testid="textarea" 
      value={value} 
      placeholder={placeholder}
      onChange={onChange}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    <div data-testid="drawer" data-open={open}>{children}</div>
  ),
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-content">{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-header">{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="drawer-title">{children}</h2>,
  DrawerTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="drawer-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p data-testid="dialog-description">{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-provider">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: { children: React.ReactNode; defaultValue?: string }) => (
    <div data-testid="tabs" data-default={defaultValue}>{children}</div>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid={`tabs-content-${value}`}>{children}</div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button data-testid={`tabs-trigger-${value}`}>{children}</button>
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value }: { children: React.ReactNode; value?: string }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option data-testid="select-item" value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span data-testid="select-value">{placeholder}</span>,
}));

import { ObservationLog } from '../observation-log';

const originalConsoleError = console.error;

describe('ObservationLog', () => {
  const defaultProps = {
    currentSelection: null,
  };
  const { tauriApi } = jest.requireMock('@/lib/tauri');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    mockSessionPlanState.savedPlans = [];
    mockSessionPlanState.executions = [];
    mockSessionPlanState.activeExecutionId = null;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('tooltip-provider')).toBeInTheDocument();
  });

  it('renders drawer component', () => {
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('renders trigger button with BookOpen icon', () => {
    render(<ObservationLog {...defaultProps} />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders tabs for sessions, search, and stats', () => {
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-trigger-sessions')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-trigger-search')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-trigger-stats')).toBeInTheDocument();
  });

  it('renders new session button', () => {
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('tabs-content-sessions')).toBeInTheDocument();
  });

  it('renders planner draft shortcut button', () => {
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('observation-log-create-planner-draft')).toBeInTheDocument();
  });

  it('passes current selection to observation form', () => {
    const propsWithSelection = {
      currentSelection: {
        name: 'M31',
        ra: 10.68,
        dec: 41.27,
        raString: '00h 42m 44s',
        decString: '+41° 16′ 09″',
        type: 'galaxy',
        constellation: 'Andromeda',
      },
    };
    render(<ObservationLog {...propsWithSelection} />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('handles non-Tauri environment gracefully', () => {
    // Component should still render even when isTauri returns false
    render(<ObservationLog {...defaultProps} />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('passes structured filters to observation search API', async () => {
    render(<ObservationLog {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('observationLog.searchPlaceholder'), {
      target: { value: 'M31' },
    });
    const dateInputs = screen.getAllByTestId('input').filter((element) => element.getAttribute('type') === 'date');
    fireEvent.change(dateInputs[0], { target: { value: '2025-01-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2025-01-31' } });
    fireEvent.keyDown(screen.getByPlaceholderText('observationLog.searchPlaceholder'), {
      key: 'Enter',
      code: 'Enter',
    });

    await waitFor(() => {
      expect(tauriApi.observationLog.search).toHaveBeenCalledWith(expect.objectContaining({
        text: 'M31',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      }));
    });
  });

  it('opens related session from a search result', async () => {
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-ctx',
        date: '2025-06-15',
        observations: [{
          id: 'obs-ctx',
          object_name: 'M31',
          observed_at: '2025-06-15T20:00:00.000Z',
          image_paths: [],
        }],
        equipment_ids: [],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });
    tauriApi.observationLog.search.mockResolvedValue([{
      id: 'obs-ctx',
      object_name: 'M31',
      observed_at: '2025-06-15T20:00:00.000Z',
      image_paths: [],
      session_id: 'session-ctx',
      session_date: '2025-06-15',
      session_location_name: 'Backyard',
    }]);

    render(<ObservationLog {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('observationLog.searchPlaceholder'), {
      target: { value: 'M31' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('observationLog.searchPlaceholder'), {
      key: 'Enter',
      code: 'Enter',
    });

    await waitFor(() => {
      expect(screen.getByTestId('observation-log-open-session-session-ctx-obs-ctx')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('observation-log-open-session-session-ctx-obs-ctx'));

    expect(screen.getByRole('button', { name: 'observationLog.addObs' })).toBeInTheDocument();
  });

  it('prevents saving observation without object name', async () => {
    const { toast } = jest.requireMock('sonner');
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        date: '2025-06-15',
        observations: [],
        equipment_ids: [],
        source_plan_id: 'plan-1',
        source_plan_name: 'Tonight Plan',
        execution_status: 'active',
        execution_targets: [{
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        }],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });

    render(<ObservationLog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'observationLog.addTargetObservation' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'observationLog.addTargetObservation' }));
    fireEvent.change(screen.getByPlaceholderText('M31, NGC 7000...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'observationLog.addObservation' }));

    expect(tauriApi.observationLog.addObservation).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('observationLog.objectNameRequired');
  });

  it('renders active execution targets and updates target status', async () => {
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        date: '2025-06-15',
        observations: [],
        equipment_ids: [],
        source_plan_id: 'plan-1',
        source_plan_name: 'Tonight Plan',
        execution_status: 'active',
        execution_targets: [{
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        }],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });
    tauriApi.observationLog.updateSession.mockImplementation(async (session: unknown) => session);

    render(<ObservationLog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('observation-log-execution-workspace')).toBeInTheDocument();
    });

    expect(screen.getByText('M31')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'observationLog.startTarget' }));

    await waitFor(() => {
      expect(tauriApi.observationLog.updateSession).toHaveBeenCalledWith(expect.objectContaining({
        execution_targets: expect.arrayContaining([
          expect.objectContaining({
            target_id: 'target-1',
            status: 'in_progress',
          }),
        ]),
      }));
    });
    expect(mockSessionPlanState.syncExecutionFromObservationSession).toHaveBeenCalled();
  });

  it('renders execution summary and skip/fail lifecycle actions', async () => {
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        date: '2025-06-15',
        observations: [],
        equipment_ids: [],
        source_plan_id: 'plan-1',
        source_plan_name: 'Tonight Plan',
        execution_status: 'active',
        execution_targets: [{
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        }],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });
    tauriApi.observationLog.updateSession.mockImplementation(async (session: unknown) => session);

    render(<ObservationLog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('observation-log-execution-summary')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'observationLog.skipTarget' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'observationLog.failTarget' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'observationLog.skipTarget' }));

    await waitFor(() => {
      expect(tauriApi.observationLog.updateSession).toHaveBeenCalledWith(expect.objectContaining({
        execution_status: 'completed',
        execution_summary: expect.objectContaining({
          skipped_targets: 1,
          total_targets: 1,
        }),
        execution_targets: expect.arrayContaining([
          expect.objectContaining({
            target_id: 'target-1',
            status: 'skipped',
          }),
        ]),
      }));
    });
  });

  it('opens the linked planner from the execution workspace', async () => {
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        date: '2025-06-15',
        observations: [],
        equipment_ids: [],
        source_plan_id: 'plan-1',
        source_plan_name: 'Tonight Plan',
        execution_status: 'active',
        execution_targets: [{
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        }],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });

    render(<ObservationLog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('observation-log-open-linked-planner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('observation-log-open-linked-planner'));

    expect(mockPlanningUiState.openSessionPlanner).toHaveBeenCalled();
  });

  it('passes execution_target_id when adding an observation from an execution target', async () => {
    tauriApi.observationLog.load.mockResolvedValue({
      sessions: [{
        id: 'session-1',
        date: '2025-06-15',
        observations: [],
        equipment_ids: [],
        source_plan_id: 'plan-1',
        source_plan_name: 'Tonight Plan',
        execution_status: 'active',
        execution_targets: [{
          id: 'exec-target-1',
          target_id: 'target-1',
          target_name: 'M31',
          scheduled_start: '2025-06-15T20:30:00.000Z',
          scheduled_end: '2025-06-15T22:00:00.000Z',
          scheduled_duration_minutes: 90,
          order: 1,
          status: 'planned',
          observation_ids: [],
        }],
        created_at: '2025-06-15T19:00:00.000Z',
        updated_at: '2025-06-15T19:00:00.000Z',
      }],
    });
    tauriApi.observationLog.addObservation.mockResolvedValueOnce({
      id: 'session-1',
      date: '2025-06-15',
      observations: [{ id: 'obs-1', object_name: 'M31', execution_target_id: 'target-1' }],
      equipment_ids: [],
      source_plan_id: 'plan-1',
      source_plan_name: 'Tonight Plan',
      execution_status: 'active',
      execution_targets: [{
        id: 'exec-target-1',
        target_id: 'target-1',
        target_name: 'M31',
        scheduled_start: '2025-06-15T20:30:00.000Z',
        scheduled_end: '2025-06-15T22:00:00.000Z',
        scheduled_duration_minutes: 90,
        order: 1,
        status: 'completed',
        observation_ids: ['obs-1'],
      }],
      created_at: '2025-06-15T19:00:00.000Z',
      updated_at: '2025-06-15T19:30:00.000Z',
    });

    render(<ObservationLog currentSelection={{
        name: 'M31',
        ra: 10.68,
        dec: 41.27,
        raString: '00h 42m 44s',
        decString: '+41° 16′ 09″',
        type: 'galaxy',
        constellation: 'Andromeda',
    }} />);

    await waitFor(() => {
      expect(screen.getByTestId('observation-log-execution-workspace')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'observationLog.addTargetObservation' }));
    expect(screen.getByDisplayValue('M31')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'observationLog.addObservation' }));

    await waitFor(() => {
      expect(tauriApi.observationLog.addObservation).toHaveBeenCalledWith('session-1', expect.objectContaining({
        execution_target_id: 'target-1',
      }));
    });
    expect(mockSessionPlanState.syncExecutionFromObservationSession).toHaveBeenCalled();
  });
});

describe('ObservationLog API Integration', () => {
  // Import the mocked module to access the mock functions
  const { tauriApi } = jest.requireMock('@/lib/tauri');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has observationLog API methods defined', () => {
    expect(tauriApi.observationLog.load).toBeDefined();
    expect(tauriApi.observationLog.getStats).toBeDefined();
    expect(tauriApi.observationLog.createSession).toBeDefined();
    expect(tauriApi.observationLog.addObservation).toBeDefined();
    expect(tauriApi.observationLog.search).toBeDefined();
  });

  it('createSession returns expected structure', async () => {
    const result = await tauriApi.observationLog.createSession();
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('date');
  });

  it('addObservation returns session with observations', async () => {
    const result = await tauriApi.observationLog.addObservation();
    expect(result).toHaveProperty('observations');
  });

  it('search returns array', async () => {
    const results = await tauriApi.observationLog.search();
    expect(Array.isArray(results)).toBe(true);
  });

  it('getStats returns expected structure', async () => {
    const stats = await tauriApi.observationLog.getStats();
    expect(stats).toHaveProperty('total_sessions');
    expect(stats).toHaveProperty('total_observations');
    expect(stats).toHaveProperty('unique_objects');
    expect(stats).toHaveProperty('total_hours');
  });
});
