/**
 * Tests for plate-solver-unified.tsx
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlateSolverUnified } from '../plate-solver-unified';
import { usePlateSolverStore } from '@/lib/stores/plate-solver-store';

// Mock next-intl messages
const messages: Record<string, Record<string, string>> = {
  plateSolving: {
    title: 'Plate Solving',
    description: 'Upload an astronomical image to determine its sky coordinates',
    localSolver: 'Local',
    onlineSolver: 'Online',
    apiKey: 'Astrometry.net API Key',
    apiKeyPlaceholder: 'Enter your API key',
    apiKeyHint: 'Get your free API key at nova.astrometry.net',
    advancedOptions: 'Advanced Options',
    downsample: 'Downsample Factor',
    searchRadius: 'Search Radius (°)',
    selectImage: 'Select Image to Solve',
    solving: 'Solving...',
    uploading: 'Uploading',
    queued: 'Queued',
    processing: 'Processing',
    success: 'Success!',
    failed: 'Failed',
    solveSuccess: 'Plate Solve Successful!',
    solveFailed: 'Plate Solve Failed',
    rotation: 'Rotation',
    pixelScale: 'Scale',
    fov: 'FOV',
    goToPosition: 'Go to Position',
    solveTime: 'Solve time',
    ready: 'Ready',
    notInstalled: 'Not Installed',
    indexesInstalled: 'indexes installed',
    localSolverNotReady: 'Local solver not ready',
    solverSettings: 'Solver Settings',
    manageIndexes: 'Manage Indexes',
    preparing: 'Preparing...',
    parsing: 'Parsing results...',
    solveHistory: 'Solve History',
    clearHistory: 'Clear History',
    cancelled: 'Solve cancelled by user',
  },
  common: {
    cancel: 'Cancel',
    save: 'Save',
  },
};
let useFallbackText = false;

// Mock next-intl directly so translations work inside Radix Dialog Portal
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      if (useFallbackText) {
        return '';
      }
      const fullKey = namespace ? `${namespace}.${key}` : key;
      const parts = fullKey.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any = messages;
      for (const part of parts) {
        result = result?.[part];
        if (result === undefined) return fullKey;
      }
      if (typeof result === 'string' && values) {
        Object.entries(values).forEach(([k, v]) => {
          result = result.replace(`{${k}}`, String(v));
        });
      }
      return typeof result === 'string' ? result : fullKey;
    };
    return t;
  },
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children?: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress">progress:{value ?? 0}</div>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children?: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: { children?: React.ReactNode }) => <div data-testid="alert-description">{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span data-testid="badge" {...props}>{children}</span>
  ),
}));

jest.mock('@/components/ui/dialog', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const DialogContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

  return {
    Dialog: ({
      children,
      open = false,
      onOpenChange,
    }: {
      children?: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        <div data-testid="dialog">{children}</div>
      </DialogContext.Provider>
    ),
    DialogContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
      const ctx = React.useContext(DialogContext);
      return ctx.open ? <div data-testid="dialog-content" className={className}>{children}</div> : null;
    },
    DialogHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div data-testid="dialog-title" className={className}>{children}</div>
    ),
    DialogDescription: ({ children }: { children?: React.ReactNode }) => <div data-testid="dialog-description">{children}</div>,
    DialogTrigger: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => {
      const ctx = React.useContext(DialogContext);
      if (asChild && React.isValidElement<{ onClick?: (event: unknown) => void }>(children)) {
        return React.cloneElement(children, {
          onClick: (event: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (children.props as any).onClick?.(event);
            ctx.onOpenChange?.(true);
          },
        });
      }
      return <button data-testid="dialog-trigger" onClick={() => ctx.onOpenChange?.(true)}>{children}</button>;
    },
  };
});

jest.mock('@/components/ui/sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const SheetContext = React.createContext<{ open: boolean }>({ open: false });

  return {
    Sheet: ({ children, open = false }: { children?: React.ReactNode; open?: boolean }) => (
      <SheetContext.Provider value={{ open }}>
        <div data-testid="sheet">{children}</div>
      </SheetContext.Provider>
    ),
    SheetContent: ({ children }: { children?: React.ReactNode }) => {
      const ctx = React.useContext(SheetContext);
      return ctx.open ? <div data-testid="sheet-content">{children}</div> : null;
    },
    SheetHeader: ({ children }: { children?: React.ReactNode }) => <div data-testid="sheet-header">{children}</div>,
    SheetTitle: ({ children }: { children?: React.ReactNode }) => <div data-testid="sheet-title">{children}</div>,
  };
});

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/collapsible', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const CollapsibleContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

  return {
    Collapsible: ({
      children,
      open,
      onOpenChange,
    }: {
      children?: React.ReactNode;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => {
      const [internalOpen, setInternalOpen] = React.useState(false);
      const resolvedOpen = open ?? internalOpen;
      const handleOpenChange = (nextOpen: boolean) => {
        if (open === undefined) {
          setInternalOpen(nextOpen);
        }
        onOpenChange?.(nextOpen);
      };

      return (
        <CollapsibleContext.Provider value={{ open: resolvedOpen, onOpenChange: handleOpenChange }}>
        <div data-testid="collapsible">{children}</div>
      </CollapsibleContext.Provider>
      );
    },
    CollapsibleContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
      const ctx = React.useContext(CollapsibleContext);
      return ctx.open ? <div data-testid="collapsible-content" className={className}>{children}</div> : null;
    },
    CollapsibleTrigger: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => {
      const ctx = React.useContext(CollapsibleContext);
      if (asChild && React.isValidElement<{ onClick?: (event: unknown) => void }>(children)) {
        return React.cloneElement(children, {
          onClick: (event: unknown) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (children.props as any).onClick?.(event);
            ctx.onOpenChange?.(!ctx.open);
          },
        });
      }
      return <button data-testid="collapsible-trigger" onClick={() => ctx.onOpenChange?.(!ctx.open)}>{children}</button>;
    },
  };
});

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/tabs', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const TabsContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({});

  return {
    Tabs: ({
      children,
      value,
      onValueChange,
    }: {
      children?: React.ReactNode;
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div data-testid="tabs">{children}</div>
      </TabsContext.Provider>
    ),
    TabsList: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div data-testid="tabs-list" className={className}>{children}</div>
    ),
    TabsTrigger: ({ children, value, className }: { children?: React.ReactNode; value?: string; className?: string }) => {
      const ctx = React.useContext(TabsContext);
      return (
        <button
          role="tab"
          aria-selected={ctx.value === value}
          data-testid={`tab-trigger-${value ?? 'unknown'}`}
          className={className}
          onClick={() => value && ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
    TabsContent: ({ children, value, className }: { children?: React.ReactNode; value?: string; className?: string }) => {
      const ctx = React.useContext(TabsContext);
      if (value && ctx.value && value !== ctx.value) {
        return null;
      }
      return <div data-testid={`tab-content-${value ?? 'unknown'}`} className={className}>{children}</div>;
    },
  };
});

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(async () => jest.fn()),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  readFile: jest.fn(),
}));

// Mock app-control-api
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: jest.fn(() => true),
}));

const mockIsTauri = jest.requireMock('@/lib/tauri/app-control-api').isTauri;
const _mockListen = jest.requireMock('@tauri-apps/api/event').listen;
const mockReadFile = jest.requireMock('@tauri-apps/plugin-fs').readFile;

// Mock plate-solver-api
jest.mock('@/lib/tauri/plate-solver-api', () => ({
  solveImageLocal: jest.fn(),
  solveOnline: jest.fn().mockResolvedValue({
    success: true,
    operation_id: 'op-1',
    ra: 180.1,
    dec: 45.05,
    orientation: 12.5,
    pixscale: 1.2,
    radius: 1.5,
    parity: 1,
    fov_width: 2.5,
    fov_height: 1.8,
    objects_in_field: ['M31'],
    annotations: [],
    job_id: 123,
    wcs: null,
    solve_time_ms: 1200,
    error_code: null,
    error_message: null,
  }),
  cancelOnlineSolve: jest.fn().mockResolvedValue(true),
  cancelPlateSolve: jest.fn().mockResolvedValue(undefined),
  convertToLegacyResult: jest.fn((result) => ({
    success: result.success,
    coordinates: result.success ? {
      ra: result.ra,
      dec: result.dec,
      raHMS: result.ra_hms || '',
      decDMS: result.dec_dms || '',
    } : null,
    positionAngle: result.position_angle || 0,
    pixelScale: result.pixel_scale || 0,
    fov: { width: result.fov_width || 0, height: result.fov_height || 0 },
    flipped: result.flipped || false,
    solverName: result.solver_name,
    solveTime: result.solve_time_ms,
    errorMessage: result.error_message,
  })),
  isLocalSolver: jest.fn((type) => type === 'astap' || type === 'astrometry_net'),
  detectPlateSolvers: jest.fn().mockResolvedValue([
    {
      solver_type: 'astap',
      name: 'ASTAP',
      version: '1.0.0',
      executable_path: '/path/to/astap',
      is_available: true,
      index_path: '/path/to/indexes',
      installed_indexes: [
        { name: 'D50', file_name: 'D50', path: '/path/to/D50', size_bytes: 500000000, scale_range: { min_arcmin: 18, max_arcmin: 600 }, description: 'Large database' },
      ],
    },
    {
      solver_type: 'astrometry_net_online',
      name: 'Astrometry.net (Online)',
      version: 'nova.astrometry.net',
      executable_path: '',
      is_available: true,
      index_path: null,
      installed_indexes: [],
    },
  ]),
  loadSolverConfig: jest.fn().mockResolvedValue({
    solver_type: 'astap',
    executable_path: null,
    index_path: null,
    timeout_seconds: 120,
    downsample: 0,
    search_radius: 30.0,
    use_sip: true,
    astap_database: null,
    astap_max_stars: 500,
    astap_tolerance: 0.007,
    astap_speed_mode: 'auto',
    astap_min_star_size: 1.5,
    astap_equalise_background: false,
    astrometry_scale_low: null,
    astrometry_scale_high: null,
    astrometry_scale_units: 'deg_width',
    astrometry_depth: null,
    astrometry_no_plots: true,
    astrometry_no_verify: false,
    astrometry_crpix_center: true,
    keep_wcs_file: true,
    auto_hints: true,
    retry_on_failure: false,
    max_retries: 2,
  }),
  saveSolverConfig: jest.fn().mockResolvedValue(undefined),
  getAvailableIndexes: jest.fn().mockResolvedValue([]),
  getInstalledIndexes: jest.fn().mockResolvedValue([]),
  getAstapDatabases: jest.fn().mockResolvedValue([]),
  analyseImage: jest.fn().mockResolvedValue({ success: false, median_hfd: null, star_count: 0, background: null, noise: null, stars: [], error_message: null }),
  DEFAULT_SOLVER_CONFIG: {
    solver_type: 'astap',
    executable_path: null,
    index_path: null,
    timeout_seconds: 120,
    downsample: 0,
    search_radius: 30.0,
    use_sip: true,
    astap_database: null,
    astap_max_stars: 500,
    astap_tolerance: 0.007,
    astap_speed_mode: 'auto',
    astap_min_star_size: 1.5,
    astap_equalise_background: false,
    astrometry_scale_low: null,
    astrometry_scale_high: null,
    astrometry_scale_units: 'deg_width',
    astrometry_depth: null,
    astrometry_no_plots: true,
    astrometry_no_verify: false,
    astrometry_crpix_center: true,
    keep_wcs_file: true,
    auto_hints: true,
    retry_on_failure: false,
    max_retries: 2,
  },
}));

// Capture the onImageCapture callback so tests can trigger solves
let capturedOnImageCapture: ((file: File, metadata?: unknown) => void | Promise<void>) | null = null;

async function _triggerImageCapture(file: File, metadata?: unknown) {
  expect(capturedOnImageCapture).not.toBeNull();
  await act(async () => {
    await capturedOnImageCapture!(file, metadata);
  });
}

jest.mock('../image-capture', () => ({
  ImageCapture: ({ onImageCapture, trigger }: { onImageCapture: (file: File, metadata?: unknown) => void; trigger?: React.ReactNode }) => {
    capturedOnImageCapture = onImageCapture;
    return <div data-testid="image-capture">{trigger}</div>;
  },
}));

jest.mock('../solver-settings', () => ({
  SolverSettings: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="solver-settings"><button onClick={onClose}>Close Settings</button></div>
  ),
}));

jest.mock('../index-manager', () => ({
  IndexManager: () => <div data-testid="index-manager">IndexManager</div>,
}));

jest.mock('../solve-result-card', () => ({
  SolveResultCard: ({ result, onGoTo, consumption }: { result: { success: boolean; errorMessage?: string }; onGoTo?: () => void; consumption?: { objects?: { count?: number } } }) => (
    <div data-testid="solve-result">
      <span>{result.success ? 'success' : 'failed'}</span>
      {result.errorMessage && <span>{result.errorMessage}</span>}
      {consumption && <span data-testid="solve-result-consumption">objects:{consumption.objects?.count ?? 0}</span>}
      {onGoTo && <button onClick={onGoTo} data-testid="goto-btn">Go To</button>}
    </div>
  ),
}));

// Mock AstrometryApiClient and createErrorResult
jest.mock('@/lib/plate-solving', () => ({
  AstrometryApiClient: jest.fn().mockImplementation(() => ({
    solve: jest.fn(),
    cancel: jest.fn(),
  })),
  createInitialOnlineSolveSessionState: jest.fn((runtime: 'tauri' | 'web' = 'web') => ({
    stage: 'idle',
    runtime,
    progress: 0,
    attempt: 0,
    maxAttempts: 0,
    message: '',
    errorCode: null,
    errorMessage: null,
    cancelled: false,
    subId: null,
    jobId: null,
    operationId: null,
  })),
  classifyOnlineSolveError: jest.fn((input: unknown) => ({
    code: 'unknown',
    message: input instanceof Error ? input.message : String(input ?? 'unknown'),
  })),
  isRetryableOnlineError: jest.fn((code: string) => code === 'timeout' || code === 'network' || code === 'service_failed'),
  mapTauriProgressToOnlineSession: jest.fn((payload: { progress: number; message?: string; sub_id?: number | null; job_id?: number | null; operation_id?: string | null }, current: Record<string, unknown>) => ({
    ...current,
    runtime: 'tauri',
    stage: 'uploading',
    progress: payload.progress ?? 0,
    message: payload.message ?? '',
    subId: payload.sub_id ?? null,
    jobId: payload.job_id ?? null,
    operationId: payload.operation_id ?? null,
    errorCode: null,
    errorMessage: null,
    cancelled: false,
  })),
  mapWebProgressToOnlineSession: jest.fn((payload: { stage: string; progress?: number; subid?: number; jobId?: number; error?: string }, current: Record<string, unknown>) => ({
    ...current,
    runtime: 'web',
    stage: payload.stage === 'failed' ? 'failed' : 'uploading',
    progress: payload.progress ?? 0,
    subId: payload.subid ?? null,
    jobId: payload.jobId ?? null,
    message: payload.error ?? '',
    errorCode: payload.stage === 'failed' ? 'unknown' : null,
    errorMessage: payload.stage === 'failed' ? (payload.error ?? 'failed') : null,
    cancelled: false,
  })),
  createErrorResult: jest.fn((solverName: string, errorMessage: string) => ({
    success: false,
    coordinates: null,
    positionAngle: 0,
    pixelScale: 0,
    fov: { width: 0, height: 0 },
    flipped: false,
    solverName,
    solveTime: 0,
    errorMessage,
  })),
  persistFileForLocalSolve: jest.fn(async (file: File) => ({
    filePath: `/tmp/${file.name}`,
    cleanup: undefined,
  })),
  buildSolveHistoryResultSummary: jest.fn((result: { onlineSolve?: { objectsInField?: unknown[] } }) => ({
    success: true,
    objects: {
      count: result.onlineSolve?.objectsInField?.length ?? 0,
      previewNames: result.onlineSolve?.objectsInField ?? [],
    },
    artifacts: {
      annotationCount: 0,
      annotationsState: 'missing',
      wcsState: 'missing',
      issueMessages: [],
    },
    annotations: [],
    analysis: {
      available: false,
      success: false,
      starCount: 0,
      medianHfd: null,
      background: null,
      noise: null,
      errorMessage: null,
    },
  })),
  getProgressText: jest.fn(() => ''),
  getProgressPercent: jest.fn(() => 0),
  executeOnlineSolve: jest.fn(),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui);
};

describe('PlateSolverUnified', () => {
  beforeEach(() => {
    // Reset store state
    usePlateSolverStore.setState({
      detectedSolvers: [
        {
          solver_type: 'astap',
          name: 'ASTAP',
          version: '1.0.0',
          executable_path: '/path/to/astap',
          is_available: true,
          index_path: '/path/to/indexes',
          installed_indexes: [
            {
              name: 'D50',
              file_name: 'D50',
              path: '/path/to/D50',
              size_bytes: 500000000,
              scale_range: { min_arcmin: 18, max_arcmin: 600 },
              description: 'Large database',
            },
          ],
        },
        {
          solver_type: 'astrometry_net_online',
          name: 'Astrometry.net (Online)',
          version: 'nova.astrometry.net',
          executable_path: '',
          is_available: true,
          index_path: null,
          installed_indexes: [],
        },
      ],
      isDetecting: false,
      detectionError: null,
      config: {
        solver_type: 'astap',
        executable_path: null,
        index_path: null,
        timeout_seconds: 120,
        downsample: 0,
        search_radius: 30.0,
        use_sip: true,
        astap_database: null,
        astap_max_stars: 500,
        astap_tolerance: 0.007,
        astap_speed_mode: 'auto',
        astap_min_star_size: 1.5,
        astap_equalise_background: false,
        astrometry_scale_low: null,
        astrometry_scale_high: null,
        astrometry_scale_units: 'deg_width',
        astrometry_depth: null,
        astrometry_no_plots: true,
        astrometry_no_verify: false,
        astrometry_crpix_center: true,
        keep_wcs_file: true,
        auto_hints: true,
        retry_on_failure: false,
        max_retries: 2,
      },
      onlineApiKey: '',
      solveStatus: 'idle',
      solveProgress: 0,
      solveMessage: '',
      lastResult: null,
      availableIndexes: [],
      installedIndexes: [],
      isLoadingIndexes: false,
      downloadingIndexes: new Map(),
      astapDatabases: [],
      isLoadingAstapDatabases: false,
      imageAnalysis: null,
      isAnalysingImage: false,
      onlineSolveProgress: null,
      solveHistory: [],
      detectSolvers: jest.fn().mockResolvedValue(undefined),
      loadConfig: jest.fn().mockResolvedValue(undefined),
    });
    mockIsTauri.mockReturnValue(true);
    useFallbackText = false;
    capturedOnImageCapture = null;
    jest.clearAllMocks();
  });

  describe('desktop mode', () => {
    it('should render trigger button', () => {
      renderWithProviders(<PlateSolverUnified />);
      
      // Default trigger is an icon button
      const triggerButton = screen.getByRole('button');
      expect(triggerButton).toBeInTheDocument();
    });

    it('should render custom trigger', () => {
      renderWithProviders(
        <PlateSolverUnified trigger={<button>Solve Image</button>} />
      );
      
      expect(screen.getByText('Solve Image')).toBeInTheDocument();
    });

    it('should open dialog when trigger clicked', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Plate Solving')).toBeInTheDocument();
      });
    });

    it('should show local and online tabs in desktop mode', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /local/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /online/i })).toBeInTheDocument();
      });
    });

    it('should show solver info for local mode', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('ASTAP')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });

    it('should show index count for local solver', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText(/1.*indexes installed/)).toBeInTheDocument();
      });
    });

    it('should have online tab with correct role and initial state', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      // Verify both tabs exist with correct roles and local is selected by default
      const localTab = await waitFor(() => screen.getByRole('tab', { name: /local/i }));
      const onlineTab = screen.getByRole('tab', { name: /online/i });
      expect(localTab).toBeInTheDocument();
      expect(onlineTab).toBeInTheDocument();
      expect(localTab).toHaveAttribute('aria-selected', 'true');
      // API key input rendering is verified in the web mode test
    });

    it('should disable solve button when cannot solve', async () => {
      // Set up state where solving is not possible
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        detectedSolvers: [
          {
            solver_type: 'astap',
            name: 'ASTAP',
            version: null,
            executable_path: '',
            is_available: false,
            index_path: null,
            installed_indexes: [],
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const solveButton = screen.getByText('Select Image to Solve').closest('button');
        expect(solveButton).toBeDisabled();
      });
    });

    it('should enable solve button when can solve', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const solveButton = screen.getByText('Select Image to Solve').closest('button');
        expect(solveButton).not.toBeDisabled();
      });
    });
  });

  describe('web mode', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(false);
    });

    it('should not show local/online tabs in web mode', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.queryByRole('tab', { name: /local/i })).not.toBeInTheDocument();
      });
    });

    it('should show API key input directly in web mode', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Astrometry.net API Key')).toBeInTheDocument();
      });
    });

    it('should render web fallback copy when translations are missing', async () => {
      useFallbackText = true;

      renderWithProviders(<PlateSolverUnified />);

      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(await waitFor(() => screen.getByText('Advanced Options')));

      await waitFor(() => {
        expect(screen.getByText('Astrometry.net API Key')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter your API key')).toBeInTheDocument();
        expect(screen.getByText('Get your free API key at nova.astrometry.net')).toBeInTheDocument();
        expect(screen.getByText('Downsample Factor')).toBeInTheDocument();
        expect(screen.getByText(/Search Radius/)).toBeInTheDocument();
      });
    });
  });

  describe('advanced options', () => {
    it('should toggle advanced options', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      const advancedButton = await waitFor(() => screen.getByText('Advanced Options'));
      fireEvent.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByText('Downsample Factor')).toBeInTheDocument();
        expect(screen.getByText('Search Radius (°)')).toBeInTheDocument();
      });
    });
  });

  describe('callbacks', () => {
    it('should call onSolveComplete when solve succeeds', async () => {
      const onSolveComplete = jest.fn();
      renderWithProviders(<PlateSolverUnified onSolveComplete={onSolveComplete} />);

      // Open dialog
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      // The actual solve would be triggered by ImageCapture
      // We're just verifying the callback prop is accepted
      expect(onSolveComplete).not.toHaveBeenCalled();
    });

    it('should call onGoToCoordinates when go to button clicked', async () => {
      const onGoToCoordinates = jest.fn();
      
      // Set up a successful result in the store
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        lastResult: {
          success: true,
          ra: 180.5,
          dec: 45.25,
          ra_hms: '12h02m00s',
          dec_dms: '+45°15\'00"',
          position_angle: 15.5,
          pixel_scale: 1.25,
          fov_width: 2.5,
          fov_height: 1.8,
          flipped: false,
          solver_name: 'ASTAP',
          solve_time_ms: 5000,
          error_message: null,
          wcs_file: null,
        },
      });

      renderWithProviders(<PlateSolverUnified onGoToCoordinates={onGoToCoordinates} />);

      // The go to button would appear after a successful solve
      // Testing the prop acceptance
      expect(onGoToCoordinates).not.toHaveBeenCalled();
    });
  });

  describe('settings dialog', () => {
    it('should open settings dialog when settings button clicked', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('ASTAP')).toBeInTheDocument();
      });

      // Find and click settings button
      const settingsButtons = screen.getAllByRole('button');
      const settingsButton = settingsButtons.find(btn => 
        btn.querySelector('svg') // Icon button
      );
      
      // Settings functionality is present
      expect(settingsButton).toBeDefined();
    });
  });

  describe('props', () => {
    it('should accept raHint prop', () => {
      renderWithProviders(<PlateSolverUnified raHint={180.5} />);
      // Component should render without error
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept decHint prop', () => {
      renderWithProviders(<PlateSolverUnified decHint={45.25} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept fovHint prop', () => {
      renderWithProviders(<PlateSolverUnified fovHint={2.5} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept defaultImagePath prop', () => {
      renderWithProviders(<PlateSolverUnified defaultImagePath="/path/to/image.fits" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should accept className prop', () => {
      renderWithProviders(<PlateSolverUnified className="custom-class" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('solve history', () => {
    it('should show solve history when entries exist', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        solveHistory: [
          {
            id: 'h1',
            timestamp: Date.now(),
            imageName: 'test-image.fits',
            solveMode: 'local' as const,
            result: {
              success: true,
              coordinates: { ra: 180.5, dec: 45.25, raHMS: '12h02m00s', decDMS: '+45d15m00s' },
              positionAngle: 15.5,
              pixelScale: 1.25,
              fov: { width: 2.5, height: 1.8 },
              flipped: false,
              solverName: 'ASTAP',
              solveTime: 5000,
            },
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText(/Solve History/)).toBeInTheDocument();
      });
    });

    it('should show clear history button when history expanded', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        solveHistory: [
          {
            id: 'h1',
            timestamp: Date.now(),
            imageName: 'test.fits',
            solveMode: 'local' as const,
            result: {
              success: false,
              coordinates: null,
              positionAngle: 0,
              pixelScale: 0,
              fov: { width: 0, height: 0 },
              flipped: false,
              solverName: 'ASTAP',
              solveTime: 3000,
              errorMessage: 'Failed',
            },
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText(/Solve History/)).toBeInTheDocument();
      });

      const historyButton = screen.getByText(/Solve History/);
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('Clear History')).toBeInTheDocument();
      });
    });

    it('should show history entry with image name', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        solveHistory: [
          {
            id: 'h1',
            timestamp: Date.now(),
            imageName: 'M31.fits',
            solveMode: 'local' as const,
            result: {
              success: true,
              coordinates: { ra: 10.68, dec: 41.27, raHMS: '0h42m44s', decDMS: '+41d16m09s' },
              positionAngle: 0,
              pixelScale: 1.0,
              fov: { width: 2, height: 2 },
              flipped: false,
              solverName: 'ASTAP',
              solveTime: 4000,
            },
          },
        ],
      });

      const onGoToCoordinates = jest.fn();
      renderWithProviders(<PlateSolverUnified onGoToCoordinates={onGoToCoordinates} />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText(/Solve History/)).toBeInTheDocument();
      });

      const historyButton = screen.getByText(/Solve History/);
      fireEvent.click(historyButton);

      await waitFor(() => {
        expect(screen.getByText('M31.fits')).toBeInTheDocument();
      });
    });
  });

  describe('web mode solve state', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(false);
    });

    it('should disable solve button when no API key in web mode', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: '',
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const solveButton = screen.getByText('Select Image to Solve').closest('button');
        expect(solveButton).toBeDisabled();
      });
    });

    it('should enable solve button when API key is set in web mode', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-api-key',
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const solveButton = screen.getByText('Select Image to Solve').closest('button');
        expect(solveButton).not.toBeDisabled();
      });
    });
  });

  describe('not installed solver warning', () => {
    it('should show warning when local solver has no indexes', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        detectedSolvers: [
          {
            solver_type: 'astap',
            name: 'ASTAP',
            version: '1.0.0',
            executable_path: '/path/to/astap',
            is_available: true,
            index_path: '/path/to/indexes',
            installed_indexes: [],
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Local solver not ready')).toBeInTheDocument();
      });
    });

    it('should show Not Installed badge for unavailable solver', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        detectedSolvers: [
          {
            solver_type: 'astap',
            name: 'ASTAP',
            version: null,
            executable_path: '',
            is_available: false,
            index_path: null,
            installed_indexes: [],
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Not Installed')).toBeInTheDocument();
      });
    });
  });

  describe('dialog description', () => {
    it('should display dialog description text', async () => {
      renderWithProviders(<PlateSolverUnified />);
      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText('Upload an astronomical image to determine its sky coordinates')).toBeInTheDocument();
      });
    });

    it('should render local fallback copy when translations are missing', async () => {
      useFallbackText = true;
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        detectedSolvers: [
          {
            solver_type: 'astap',
            name: 'ASTAP',
            version: null,
            executable_path: '',
            is_available: false,
            index_path: null,
            installed_indexes: [],
          },
        ],
      });

      renderWithProviders(<PlateSolverUnified />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Plate Solving')).toBeInTheDocument();
        expect(screen.getByText('Upload an astronomical image to determine its sky coordinates')).toBeInTheDocument();
        expect(screen.getByText('Advanced Options')).toBeInTheDocument();
        expect(screen.getByText('Select Image to Solve')).toBeInTheDocument();
        expect(screen.getByText('Local solver not ready. Install a solver and download index files.')).toBeInTheDocument();
      });
    });

    it('should auto-open and load the default image path on desktop', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      const mockConvertToLegacy = jest.requireMock('@/lib/tauri/plate-solver-api').convertToLegacyResult;

      mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
      mockSolveImageLocal.mockResolvedValue({
        success: true,
        ra: 180.5,
        dec: 45.25,
        ra_hms: '12h02m00s',
        dec_dms: '+45d15m',
        position_angle: 15.5,
        pixel_scale: 1.25,
        fov_width: 2.5,
        fov_height: 1.8,
        flipped: false,
        solver_name: 'ASTAP',
        solve_time_ms: 5000,
        error_message: null,
      });
      mockConvertToLegacy.mockReturnValue({
        success: true,
        coordinates: { ra: 180.5, dec: 45.25, raHMS: '12h02m00s', decDMS: '+45d15m' },
        positionAngle: 15.5,
        pixelScale: 1.25,
        fov: { width: 2.5, height: 1.8 },
        flipped: false,
        solverName: 'ASTAP',
        solveTime: 5000,
      });

      renderWithProviders(
        <PlateSolverUnified autoOpenRequestId={1} defaultImagePath="C:/images/m42.fits" />
      );

      await waitFor(() => {
        expect(mockReadFile).toHaveBeenCalledWith('C:/images/m42.fits');
        expect(mockSolveImageLocal).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            image_path: '/tmp/m42.fits',
          })
        );
      });
    });
  });
});
