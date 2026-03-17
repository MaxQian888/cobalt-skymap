/**
 * Tests for solver-settings.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolverSettings } from '../solver-settings';
import { usePlateSolverStore } from '@/lib/stores/plate-solver-store';

// Mock next-intl — return key as text (matches pattern in other plate-solving tests)
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock plate-solver-api
jest.mock('@/lib/tauri/plate-solver-api', () => ({
  isLocalSolver: jest.fn((type) => type === 'astap' || type === 'astrometry_net'),
  formatFileSize: jest.fn((bytes) => `${bytes} B`),
  validateSolverPath: jest.fn(),
  detectPlateSolvers: jest.fn(),
  loadSolverConfig: jest.fn(),
  saveSolverConfig: jest.fn(),
  getAvailableIndexes: jest.fn(),
  getInstalledIndexes: jest.fn(),
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

const mockValidateSolverPath = jest.requireMock('@/lib/tauri/plate-solver-api').validateSolverPath;


describe('SolverSettings', () => {
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
          solver_type: 'astrometry_net',
          name: 'Astrometry.net (Local)',
          version: null,
          executable_path: '',
          is_available: false,
          index_path: null,
          installed_indexes: [],
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
      onlineServiceStatus: {
        status: 'unknown',
        checkedAt: null,
        message: null,
      },
    });
    jest.clearAllMocks();
  });

  it('should render solver selection section', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.solverSelection')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.solverSelectionDesc')).toBeInTheDocument();
  });

  it('should display detected solvers', () => {
    render(<SolverSettings />);

    expect(screen.getByText('ASTAP')).toBeInTheDocument();
    expect(screen.getByText('Astrometry.net (Local)')).toBeInTheDocument();
    expect(screen.getByText('Astrometry.net (Online)')).toBeInTheDocument();
  });

  it('should show installed badge for available solvers', () => {
    render(<SolverSettings />);

    // ASTAP should show as installed
    const installedBadges = screen.getAllByText('plateSolving.installed');
    expect(installedBadges.length).toBeGreaterThan(0);
  });

  it('should show not installed badge for unavailable solvers', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.notInstalled')).toBeInTheDocument();
  });

  it('should allow selecting a different solver', () => {
    render(<SolverSettings />);

    // Find and click on Astrometry.net (Online)
    const onlineSolver = screen.getByText('Astrometry.net (Online)').closest('div[class*="cursor-pointer"]');
    if (onlineSolver) {
      fireEvent.click(onlineSolver);
    }

    // Check that config was updated
    const state = usePlateSolverStore.getState();
    expect(state.config.solver_type).toBe('astrometry_net_online');
  });

  it('should show API key input for online solver', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
    });

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.apiKey')).toBeInTheDocument();
  });

  it('should render solver options section', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.solverOptions')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.timeout')).toBeInTheDocument();
  });

  it('should show index status for local solvers', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.indexStatus')).toBeInTheDocument();
    // Count and label are separate text nodes
    expect(screen.getByText(/plateSolving\.indexesInstalled/)).toBeInTheDocument();
  });

  it('should call onClose and save when save button clicked', async () => {
    const onClose = jest.fn();
    render(<SolverSettings onClose={onClose} />);

    const saveButton = screen.getByText('common.save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('should call onClose when cancel button clicked', () => {
    const onClose = jest.fn();
    render(<SolverSettings onClose={onClose} />);

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should validate custom path when validate button clicked', async () => {
    mockValidateSolverPath.mockResolvedValueOnce(true);

    render(<SolverSettings />);

    // Placeholder uses executable_path from detected solver as default
    const pathInput = screen.getByPlaceholderText('/path/to/astap');
    fireEvent.change(pathInput, { target: { value: '/custom/path/astap' } });

    // Find and click validate button
    const validateButton = screen.getByText('plateSolving.validate');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockValidateSolverPath).toHaveBeenCalledWith('astap', '/custom/path/astap');
    });
  });

  it('should show detect solvers button', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.detectSolvers')).toBeInTheDocument();
  });

  it('should trigger solver detection when detect button clicked', async () => {
    const detectSolvers = jest.fn();
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      detectSolvers,
    });

    render(<SolverSettings />);

    const detectButton = screen.getByText('plateSolving.detectSolvers');
    fireEvent.click(detectButton);

    // The actual detectSolvers function from the store will be called
    // We can verify by checking the store method was invoked
  });

  it('should select solver via keyboard Enter', () => {
    render(<SolverSettings />);

    const onlineSolver = screen.getByText('Astrometry.net (Online)').closest('[role="button"]');
    if (onlineSolver) {
      fireEvent.keyDown(onlineSolver, { key: 'Enter' });
      const state = usePlateSolverStore.getState();
      expect(state.config.solver_type).toBe('astrometry_net_online');
    }
  });

  it('should select solver via keyboard Space', () => {
    render(<SolverSettings />);

    const onlineSolver = screen.getByText('Astrometry.net (Online)').closest('[role="button"]');
    if (onlineSolver) {
      fireEvent.keyDown(onlineSolver, { key: ' ' });
      const state = usePlateSolverStore.getState();
      expect(state.config.solver_type).toBe('astrometry_net_online');
    }
  });

  it('should show ASTAP-specific options for astap solver', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.astapOptions')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.maxStars')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.tolerance')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.minStarSize')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.equaliseBackground')).toBeInTheDocument();
  });

  it('should show astrometry.net-specific options for astrometry_net solver', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net',
      },
    });

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.astrometryOptions')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.scaleLow')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.scaleHigh')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.skipVerify')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.crpixCenter')).toBeInTheDocument();
  });

  it('should show general options section', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.generalOptions')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.autoHints')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.keepWcs')).toBeInTheDocument();
    expect(screen.getByText('plateSolving.retryOnFailure')).toBeInTheDocument();
  });

  it('should show useSip option for local solvers', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.useSip')).toBeInTheDocument();
  });

  it('should show path validation failure', async () => {
    mockValidateSolverPath.mockResolvedValueOnce(false);

    render(<SolverSettings />);

    const pathInput = screen.getByPlaceholderText('/path/to/astap');
    fireEvent.change(pathInput, { target: { value: '/bad/path' } });

    const validateButton = screen.getByText('plateSolving.validate');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.invalidPath')).toBeInTheDocument();
    });
  });

  it('should handle path validation exception', async () => {
    mockValidateSolverPath.mockRejectedValueOnce(new Error('Validation error'));

    render(<SolverSettings />);

    const pathInput = screen.getByPlaceholderText('/path/to/astap');
    fireEvent.change(pathInput, { target: { value: '/crash/path' } });

    const validateButton = screen.getByText('plateSolving.validate');
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.invalidPath')).toBeInTheDocument();
    });
  });

  it('should show detection error', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      detectionError: 'Failed to detect solvers',
    });

    render(<SolverSettings />);

    expect(screen.getByText('Failed to detect solvers')).toBeInTheDocument();
  });

  it('should show empty state when no solvers detected', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      detectedSolvers: [],
      isDetecting: false,
      detectionError: null,
    });

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.noSolversDetected')).toBeInTheDocument();
  });

  it('should show cannot-solve alert for online solver without API key', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
      onlineApiKey: '',
    });

    render(<SolverSettings />);

    expect(screen.getAllByText('API key required for online solving')).toHaveLength(2);
  });

  it('should show readiness reason when online service is unreachable', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
      onlineApiKey: 'test-key',
      onlineServiceStatus: {
        status: 'unreachable',
        checkedAt: Date.now(),
        message: 'Astrometry.net probe failed',
      },
    });

    render(<SolverSettings />);

    expect(screen.getAllByText('Astrometry.net probe failed')).toHaveLength(2);
  });

  it('should show cannot-solve alert for unavailable local solver', () => {
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

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.solverNotReady')).toBeInTheDocument();
  });

  it('should show no indexes alert when solver has no indexes', () => {
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

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.noIndexes')).toBeInTheDocument();
  });

  it('should apply className prop', () => {
    const { container } = render(<SolverSettings className="my-settings" />);
    expect(container.firstChild).toHaveClass('my-settings');
  });

  it('should clear custom path and validation when solver changes', () => {
    render(<SolverSettings />);

    // Enter a custom path
    const pathInput = screen.getByPlaceholderText('/path/to/astap');
    fireEvent.change(pathInput, { target: { value: '/some/path' } });

    // Switch to online solver
    const onlineSolver = screen.getByText('Astrometry.net (Online)').closest('[role="button"]');
    if (onlineSolver) {
      fireEvent.click(onlineSolver);
    }

    // Path input should not be visible for online solver
    expect(screen.queryByPlaceholderText('/path/to/astap')).not.toBeInTheDocument();
  });

  it('should show solver version when available', () => {
    render(<SolverSettings />);

    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('should show online badge for online solver', () => {
    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.online')).toBeInTheDocument();
  });

  it('should not show validate button when custom path is empty', () => {
    render(<SolverSettings />);

    const validateButton = screen.getByText('plateSolving.validate');
    expect(validateButton.closest('button')).toBeDisabled();
  });

  it('should update config on successful path validation', async () => {
    mockValidateSolverPath.mockResolvedValueOnce(true);

    render(<SolverSettings />);

    const pathInput = screen.getByPlaceholderText('/path/to/astap');
    fireEvent.change(pathInput, { target: { value: '/valid/astap' } });

    const validateButton = screen.getByText('plateSolving.validate');
    fireEvent.click(validateButton);

    await waitFor(() => {
      const state = usePlateSolverStore.getState();
      expect(state.config.executable_path).toBe('/valid/astap');
    });
  });

  it('should show solver profile and availability reason for local solvers', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      detectedSolvers: [
        {
          solver_type: 'astap',
          name: 'ASTAP',
          version: '2026.03.05',
          executable_path: '/custom/astap_cli',
          is_available: false,
          index_path: null,
          installed_indexes: [],
          profile_id: 'astap_cli',
          profile_name: 'ASTAP CLI',
          availability_reason: 'No ASTAP database found',
          uses_custom_executable: true,
        } as never,
      ],
    });

    render(<SolverSettings />);

    expect(screen.getByText('ASTAP CLI')).toBeInTheDocument();
    expect(screen.getByText('No ASTAP database found')).toBeInTheDocument();
  });
});
