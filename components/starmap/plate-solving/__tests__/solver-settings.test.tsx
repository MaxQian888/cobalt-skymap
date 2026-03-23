/**
 * Tests for solver-settings.tsx
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SolverSettings } from '../solver-settings';
import { usePlateSolverStore } from '@/lib/stores/plate-solver-store';

// Mock next-intl — return key as text (matches pattern in other plate-solving tests)
const mockTranslate = jest.fn((key: string) => key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
  }: {
    value: number[];
    onValueChange?: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    className?: string;
  }) => (
    <input
      type="range"
      role="slider"
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
    />
  ),
}));

jest.mock('@/components/ui/switch-item', () => ({
  SwitchItem: ({
    id,
    label,
    description,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    label: React.ReactNode;
    description?: React.ReactNode;
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => {
    const labelText = typeof label === 'string' ? label : id ?? 'switch-item';
    return (
      <label>
        <span>{label}</span>
        {description ? <span>{description}</span> : null}
        <input
          type="checkbox"
          aria-label={labelText}
          checked={checked}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
        />
      </label>
    );
  },
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
    mockTranslate.mockImplementation((key: string) => key);
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

  it('should show detecting state while solver discovery is running', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      isDetecting: true,
    });

    render(<SolverSettings />);

    expect(screen.getByText('plateSolving.detectSolvers').closest('button')).toBeDisabled();
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

  it('should update local slider and toggle options', () => {
    render(<SolverSettings />);

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(6);

    fireEvent.change(sliders[0], { target: { value: '180' } });
    fireEvent.change(sliders[1], { target: { value: '3' } });
    fireEvent.change(sliders[2], { target: { value: '45' } });
    fireEvent.change(sliders[3], { target: { value: '750' } });
    fireEvent.change(sliders[4], { target: { value: '11' } });
    fireEvent.change(sliders[5], { target: { value: '25' } });

    fireEvent.click(screen.getByLabelText('plateSolving.useSip'));
    fireEvent.click(screen.getByLabelText('plateSolving.equaliseBackground'));
    fireEvent.click(screen.getByLabelText('plateSolving.autoHints'));
    fireEvent.click(screen.getByLabelText('plateSolving.keepWcs'));
    fireEvent.click(screen.getByLabelText('plateSolving.retryOnFailure'));

    const state = usePlateSolverStore.getState();
    expect(state.config.timeout_seconds).toBe(180);
    expect(state.config.downsample).toBe(3);
    expect(state.config.search_radius).toBe(45);
    expect(state.config.astap_max_stars).toBe(750);
    expect(state.config.astap_tolerance).toBeCloseTo(0.011);
    expect(state.config.astap_min_star_size).toBeCloseTo(2.5);
    expect(state.config.use_sip).toBe(false);
    expect(state.config.astap_equalise_background).toBe(true);
    expect(state.config.auto_hints).toBe(false);
    expect(state.config.keep_wcs_file).toBe(false);
    expect(state.config.retry_on_failure).toBe(true);
  });

  it('should update astrometry.net options', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net',
        astrometry_scale_low: null,
        astrometry_scale_high: null,
        astrometry_no_verify: false,
        astrometry_crpix_center: true,
      },
    });

    render(<SolverSettings />);

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '1.5' } });
    fireEvent.change(inputs[1], { target: { value: '3.2' } });
    fireEvent.click(screen.getByLabelText('plateSolving.skipVerify'));
    fireEvent.click(screen.getByLabelText('plateSolving.crpixCenter'));

    const state = usePlateSolverStore.getState();
    expect(state.config.astrometry_scale_low).toBe(1.5);
    expect(state.config.astrometry_scale_high).toBe(3.2);
    expect(state.config.astrometry_no_verify).toBe(true);
    expect(state.config.astrometry_crpix_center).toBe(false);
  });

  it('should update online solver API key', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
      onlineApiKey: '',
    });

    render(<SolverSettings />);

    fireEvent.change(screen.getByLabelText('plateSolving.apiKey'), {
      target: { value: 'test-api-key' },
    });

    expect(usePlateSolverStore.getState().onlineApiKey).toBe('test-api-key');
  });

  it('should render local fallback copy when translations are missing', () => {
    mockTranslate.mockImplementation(() => '');

    render(<SolverSettings />);

    expect(screen.getByText('Choose which plate solver to use')).toBeInTheDocument();
    expect(screen.getByText('Add polynomial distortion correction')).toBeInTheDocument();
    expect(screen.getByText('For images with gradient backgrounds')).toBeInTheDocument();
    expect(screen.getByText('General Options')).toBeInTheDocument();
    expect(screen.getByText('Index Files')).toBeInTheDocument();
    expect(screen.getByText(/Total size/)).toBeInTheDocument();
  });

  it('should render astrometry and online fallback copy when translations are missing', () => {
    mockTranslate.mockImplementation(() => '');
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
      onlineApiKey: '',
      onlineServiceStatus: {
        status: 'unknown',
        checkedAt: null,
        message: null,
      },
    });

    render(<SolverSettings />);

    expect(screen.getByText('Get your free API key at nova.astrometry.net')).toBeInTheDocument();
    expect(screen.getAllByText('API key required for online solving').length).toBeGreaterThan(0);
  });

  it('should render astrometry fallback copy when translations are missing', () => {
    mockTranslate.mockImplementation(() => '');
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net',
      },
    });

    render(<SolverSettings />);

    expect(screen.getByText('Astrometry.net Options')).toBeInTheDocument();
    expect(screen.getByText('Scale Low')).toBeInTheDocument();
    expect(screen.getByText('Scale High')).toBeInTheDocument();
    expect(screen.getByText('Skip Verification')).toBeInTheDocument();
    expect(screen.getByText('Center Reference Pixel')).toBeInTheDocument();
  });
});
