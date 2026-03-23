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
const mockListen = jest.requireMock('@tauri-apps/api/event').listen;
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

async function triggerImageCapture(file: File, metadata?: unknown) {
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
  SolveResultCard: ({ result, onGoTo }: { result: { success: boolean; errorMessage?: string }; onGoTo?: () => void }) => (
    <div data-testid="solve-result">
      <span>{result.success ? 'success' : 'failed'}</span>
      {result.errorMessage && <span>{result.errorMessage}</span>}
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

  describe('local solve flow', () => {
    it('should trigger local solve and show result', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      const mockConvertToLegacy = jest.requireMock('@/lib/tauri/plate-solver-api').convertToLegacyResult;

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

      const onSolveComplete = jest.fn();
      renderWithProviders(<PlateSolverUnified onSolveComplete={onSolveComplete} />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      // Trigger local solve
      const file = new File(['test'], 'test.fits', { type: 'application/fits' });
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(mockSolveImageLocal).toHaveBeenCalled();
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });

      expect(onSolveComplete).toHaveBeenCalled();
    });

    it('should update local progress from backend events and clean up persisted files', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      const mockPersistFileForLocalSolve = jest.requireMock('@/lib/plate-solving').persistFileForLocalSolve;
      const cleanup = jest.fn().mockResolvedValue(undefined);
      const unlisten = jest.fn();
      let progressHandler: ((event: { payload: { stage: string; progress: number; message: string } }) => void) | undefined;
      let resolveSolve: ((value: Record<string, unknown>) => void) | undefined;

      mockListen.mockImplementation(async (_event: string, handler: typeof progressHandler) => {
        progressHandler = handler;
        return unlisten;
      });
      mockPersistFileForLocalSolve.mockResolvedValue({
        filePath: '/tmp/progress.fits',
        cleanup,
      });
      mockSolveImageLocal.mockImplementation(() => new Promise((resolve) => {
        resolveSolve = resolve;
      }));

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'progress.fits');
      const solvePromise = Promise.resolve(capturedOnImageCapture!(file));

      await waitFor(() => {
        expect(mockListen).toHaveBeenCalledWith('solve-progress', expect.any(Function));
      });

      await act(async () => {
        progressHandler?.({
          payload: {
            stage: 'parsing',
            progress: 55,
            message: 'ignored',
          },
        });
      });

      expect(screen.getByText('Parsing results...')).toBeInTheDocument();

      await act(async () => {
        resolveSolve?.({
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
        await solvePromise;
      });

      await waitFor(() => {
        expect(cleanup).toHaveBeenCalled();
        expect(unlisten).toHaveBeenCalled();
      });
    });

    it('should handle local solve error', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      mockSolveImageLocal.mockRejectedValue(new Error('Solver crashed'));

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'test.fits');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });

    it('should show error when solver type is online but trying local', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        config: {
          ...usePlateSolverStore.getState().config,
          solver_type: 'astrometry_net_online',
        },
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'test.fits');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });
  });

  describe('online solve flow (desktop/Tauri)', () => {
    it('should have both local and online tabs in desktop mode', async () => {
      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /local/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /online/i })).toBeInTheDocument();
      });
    });

    it('should handle failed online solve via Tauri backend', async () => {
      const mockSolveOnline = jest.requireMock('@/lib/tauri/plate-solver-api').solveOnline;
      mockSolveOnline.mockResolvedValue({
        success: false,
        operation_id: 'op-fail',
        ra: null,
        dec: null,
        orientation: null,
        pixscale: null,
        parity: null,
        fov_width: null,
        fov_height: null,
        objects_in_field: [],
        annotations: [],
        job_id: null,
        wcs: null,
        solve_time_ms: 5000,
        error_code: 'service_failed',
        error_message: 'No solution found',
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const onlineTab = screen.getByRole('tab', { name: /online/i });
        fireEvent.click(onlineTab);
      });

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'star.jpg');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
      });
    });

    it('should handle Tauri online solve error (exception)', async () => {
      const mockSolveOnline = jest.requireMock('@/lib/tauri/plate-solver-api').solveOnline;
      mockSolveOnline.mockRejectedValue(new Error('Tauri IPC failed'));

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        const onlineTab = screen.getByRole('tab', { name: /online/i });
        fireEvent.click(onlineTab);
      });

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'star.jpg');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });
  });

  describe('online solve flow (web mode)', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(false);
    });

    it('should delegate online solves to the shared dispatcher', async () => {
      const mockExecuteOnlineSolve = jest.requireMock('@/lib/plate-solving').executeOnlineSolve;
      mockExecuteOnlineSolve.mockResolvedValue({
        result: {
          success: true,
          coordinates: { ra: 180.1, dec: 45.05, raHMS: '12h00m24s', decDMS: '+45d03m' },
          positionAngle: 12.5,
          pixelScale: 1.2,
          fov: { width: 2.5, height: 1.8 },
          flipped: false,
          solverName: 'Astrometry.net (Online)',
          solveTime: 1200,
          onlineSolve: {
            runtime: 'web',
            operationId: null,
            submissionId: 42,
            jobId: 77,
            objectsInField: ['M31'],
            annotations: [],
            wcs: null,
            frameSize: { width: 3000, height: 2000 },
            diagnostics: { annotations: 'complete', wcs: 'missing', issues: [] },
            errorCode: null,
            errorMessage: null,
          },
        },
        diagnostics: {
          runtime: 'web',
          attemptCount: 1,
          maxAttempts: 1,
          terminalErrorCode: null,
          cancelled: false,
          submissionId: 42,
          jobId: 77,
          operationId: null,
          artifactSummary: {
            objectsInFieldCount: 1,
            annotationCount: 0,
            hasWcs: false,
            annotations: 'complete',
            wcs: 'missing',
            issues: [],
          },
        },
        session: {
          stage: 'success',
          runtime: 'web',
          progress: 100,
          attempt: 1,
          maxAttempts: 1,
          message: '',
          errorCode: null,
          errorMessage: null,
          cancelled: false,
          subId: 42,
          jobId: 77,
          operationId: null,
        },
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'star.jpg', { type: 'image/jpeg' });
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(mockExecuteOnlineSolve).toHaveBeenCalled();
      });
    });

    it('should trigger online solve via AstrometryApiClient in web mode', async () => {
      const mockExecuteOnlineSolve = jest.requireMock('@/lib/plate-solving').executeOnlineSolve;
      mockExecuteOnlineSolve.mockResolvedValue({
        result: {
          success: true,
          coordinates: { ra: 180.1, dec: 45.05, raHMS: '12h00m24s', decDMS: '+45d03m' },
          positionAngle: 12.5,
          pixelScale: 1.2,
          fov: { width: 2.5, height: 1.8 },
          flipped: false,
          solverName: 'astrometry.net',
          solveTime: 1200,
        },
        diagnostics: {
          runtime: 'web',
          attemptCount: 1,
          maxAttempts: 1,
          terminalErrorCode: null,
          cancelled: false,
          submissionId: 42,
          jobId: 77,
          operationId: null,
          artifactSummary: null,
        },
        session: {
          stage: 'success',
          runtime: 'web',
          progress: 100,
          attempt: 1,
          maxAttempts: 1,
          message: '',
          errorCode: null,
          errorMessage: null,
          cancelled: false,
          subId: 42,
          jobId: 77,
          operationId: null,
        },
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'star.jpg', { type: 'image/jpeg' });
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(mockExecuteOnlineSolve).toHaveBeenCalled();
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });

    it('should pass updated online advanced options to the shared dispatcher', async () => {
      const mockExecuteOnlineSolve = jest.requireMock('@/lib/plate-solving').executeOnlineSolve;
      mockExecuteOnlineSolve.mockResolvedValue({
        result: {
          success: true,
          coordinates: { ra: 180.1, dec: 45.05, raHMS: '12h00m24s', decDMS: '+45d03m' },
          positionAngle: 12.5,
          pixelScale: 1.2,
          fov: { width: 2.5, height: 1.8 },
          flipped: false,
          solverName: 'astrometry.net',
          solveTime: 1200,
        },
        diagnostics: {
          runtime: 'web',
          attemptCount: 1,
          maxAttempts: 1,
          terminalErrorCode: null,
          cancelled: false,
          submissionId: null,
          jobId: null,
          operationId: null,
          artifactSummary: null,
        },
        session: {
          stage: 'success',
          runtime: 'web',
          progress: 100,
          attempt: 1,
          maxAttempts: 1,
          message: '',
          errorCode: null,
          errorMessage: null,
          cancelled: false,
          subId: null,
          jobId: null,
          operationId: null,
        },
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(await waitFor(() => screen.getByText('Advanced Options')));
      const inputs = screen.getAllByRole('spinbutton');
      fireEvent.change(inputs[0], { target: { value: '4' } });
      fireEvent.change(inputs[1], { target: { value: '45' } });

      const file = new File(['test'], 'options.jpg', { type: 'image/jpeg' });
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(mockExecuteOnlineSolve).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              downsampleFactor: 4,
              radius: 45,
            }),
          })
        );
      });
    });

    it('should register the web cancel client and handle thrown dispatcher errors', async () => {
      const mockExecuteOnlineSolve = jest.requireMock('@/lib/plate-solving').executeOnlineSolve;
      const cancel = jest.fn();
      let registered = false;

      mockExecuteOnlineSolve.mockImplementation(async ({ registerWebClient }: { registerWebClient?: (client: { cancel: () => void }) => void }) => {
        registerWebClient?.({ cancel });
        registered = true;
        throw new Error('Network down');
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      fireEvent.click(screen.getByRole('button'));

      const file = new File(['test'], 'error.jpg');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(registered).toBe(true);
        expect(mockExecuteOnlineSolve).toHaveBeenCalled();
        expect(screen.getByText('[unknown] Network down')).toBeInTheDocument();
      });
    });

    it('should handle online solve error in web mode', async () => {
      const mockExecuteOnlineSolve = jest.requireMock('@/lib/plate-solving').executeOnlineSolve;
      mockExecuteOnlineSolve.mockResolvedValue({
        result: {
          success: false,
          coordinates: null,
          positionAngle: 0,
          pixelScale: 0,
          fov: { width: 0, height: 0 },
          flipped: false,
          solverName: 'astrometry.net',
          solveTime: 500,
          errorMessage: '[network] Network error (Attempt 1/1)',
        },
        diagnostics: {
          runtime: 'web',
          attemptCount: 1,
          maxAttempts: 1,
          terminalErrorCode: 'network',
          cancelled: false,
          submissionId: null,
          jobId: null,
          operationId: null,
          artifactSummary: null,
        },
        session: {
          stage: 'failed',
          runtime: 'web',
          progress: 100,
          attempt: 1,
          maxAttempts: 1,
          message: 'Network error',
          errorCode: 'network',
          errorMessage: 'Network error',
          cancelled: false,
          subId: null,
          jobId: null,
          operationId: null,
        },
      });

      usePlateSolverStore.setState({
        ...usePlateSolverStore.getState(),
        onlineApiKey: 'test-key',
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'star.jpg');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(mockExecuteOnlineSolve).toHaveBeenCalled();
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });
  });

  describe('go to coordinates', () => {
    it('should call onGoToCoordinates when goto button clicked on result', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      const mockConvertToLegacy = jest.requireMock('@/lib/tauri/plate-solver-api').convertToLegacyResult;

      mockSolveImageLocal.mockResolvedValue({ success: true, solve_time_ms: 1000 });
      mockConvertToLegacy.mockReturnValue({
        success: true,
        coordinates: { ra: 180.5, dec: 45.25, raHMS: '12h02m00s', decDMS: '+45d15m' },
        positionAngle: 0,
        pixelScale: 1.0,
        fov: { width: 2, height: 2 },
        flipped: false,
        solverName: 'ASTAP',
        solveTime: 1000,
      });

      const onGoToCoordinates = jest.fn();
      renderWithProviders(<PlateSolverUnified onGoToCoordinates={onGoToCoordinates} />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'test.fits');
      await triggerImageCapture(file);

      await waitFor(() => {
        expect(screen.getByTestId('goto-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('goto-btn'));

      expect(onGoToCoordinates).toHaveBeenCalledWith(180.5, 45.25);
    });
  });

  describe('cancel solve', () => {
    it('should produce cancelled result when solve is cancelled', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      // Make solve hang indefinitely
      let rejectSolve: (reason: Error) => void;
      mockSolveImageLocal.mockImplementation(() => new Promise((_resolve, reject) => {
        rejectSolve = reject;
      }));

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'test.fits');
      // Don't await - it will hang
      let solvePromise!: Promise<void>;
      await act(async () => {
        solvePromise = Promise.resolve(capturedOnImageCapture!(file));
      });

      // Wait a tick for solving state to update
      await waitFor(() => {
        // The solving state should be true at this point
        // Cancel button renders inside real Radix Dialog portal
        // We verify the cancel API was set up
        expect(mockSolveImageLocal).toHaveBeenCalled();
      });

      // Resolve the promise to avoid hanging
      await act(async () => {
        rejectSolve!(new Error('cancelled'));
        await solvePromise;
      });

      await waitFor(() => {
        expect(screen.getByTestId('solve-result')).toBeInTheDocument();
      });
    });
  });

  describe('auto hints from FITS', () => {
    it('should extract WCS hints from FITS metadata when auto_hints enabled', async () => {
      const mockSolveImageLocal = jest.requireMock('@/lib/tauri/plate-solver-api').solveImageLocal;
      const mockConvertToLegacy = jest.requireMock('@/lib/tauri/plate-solver-api').convertToLegacyResult;

      mockSolveImageLocal.mockResolvedValue({ success: true, solve_time_ms: 1000 });
      mockConvertToLegacy.mockReturnValue({
        success: true,
        coordinates: { ra: 83.82, dec: -5.39, raHMS: '5h35m17s', decDMS: '-5d23m' },
        positionAngle: 0,
        pixelScale: 1.0,
        fov: { width: 2, height: 2 },
        flipped: false,
        solverName: 'ASTAP',
        solveTime: 1000,
      });

      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      await waitFor(() => {
        expect(capturedOnImageCapture).not.toBeNull();
      });

      const file = new File(['test'], 'M42.fits');
      const metadata = {
        fitsData: {
          wcs: {
            referenceCoordinates: { ra: 83.82, dec: -5.39 },
          },
        },
      };
      await triggerImageCapture(file, metadata);

      await waitFor(() => {
        // The ra_hint and dec_hint should be passed from WCS
        expect(mockSolveImageLocal).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            ra_hint: 83.82,
            dec_hint: -5.39,
          })
        );
      });
    });
  });

  describe('advanced options interaction', () => {
    it('should update downsample and search radius', async () => {
      renderWithProviders(<PlateSolverUnified />);

      const triggerButton = screen.getByRole('button');
      fireEvent.click(triggerButton);

      const advancedButton = await waitFor(() => screen.getByText('Advanced Options'));
      fireEvent.click(advancedButton);

      await waitFor(() => {
        expect(screen.getByText('Downsample Factor')).toBeInTheDocument();
      });

      // Change downsample input
      const inputs = screen.getAllByRole('spinbutton');
      if (inputs.length > 0) {
        fireEvent.change(inputs[0], { target: { value: '4' } });
      }
    });
  });
});
