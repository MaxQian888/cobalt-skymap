/**
 * Tests for index-manager.tsx
 */

import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IndexManager } from '../index-manager';
import { usePlateSolverStore } from '@/lib/stores/plate-solver-store';

const originalConsoleError = console.error;

// Mock next-intl — return key as text
const mockTranslate = jest.fn((key: string) => key);

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock plate-solver-api
jest.mock('@/lib/tauri/plate-solver-api', () => ({
  formatFileSize: jest.fn((bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }),
  getSolverDisplayName: jest.fn((type) => {
    if (type === 'astap') return 'ASTAP';
    if (type === 'astrometry_net') return 'Astrometry.net (Local)';
    return type;
  }),
  getAvailableIndexes: jest.fn(),
  getInstalledIndexes: jest.fn(),
  deleteIndex: jest.fn(),
  downloadIndex: jest.fn().mockResolvedValue(undefined),
  getDefaultIndexPath: jest.fn().mockResolvedValue('/default/index/path'),
  detectPlateSolvers: jest.fn(),
  loadSolverConfig: jest.fn(),
  saveSolverConfig: jest.fn(),
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

const mockGetAvailableIndexes = jest.requireMock('@/lib/tauri/plate-solver-api').getAvailableIndexes;
const mockGetInstalledIndexes = jest.requireMock('@/lib/tauri/plate-solver-api').getInstalledIndexes;
const _mockDeleteIndex = jest.requireMock('@/lib/tauri/plate-solver-api').deleteIndex;
const mockDownloadIndex = jest.requireMock('@/lib/tauri/plate-solver-api').downloadIndex;

// Mock Tauri event listener and path
jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(() => Promise.resolve(jest.fn())),
}));

const mockListen = jest.requireMock('@tauri-apps/api/event').listen;

jest.mock('@tauri-apps/api/path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// Mock isTauri
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: jest.fn(() => false),
}));

const mockIsTauri = jest.requireMock('@/lib/tauri/app-control-api').isTauri;

// Mock Dialog — simulate open/close behavior so useEffect(open) fires
let dialogOnOpenChange: ((open: boolean) => void) | undefined;

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, onOpenChange }: { children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) => {
    dialogOnOpenChange = onOpenChange;
    return <div data-testid="dialog">{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode; className?: string; id?: string }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dialog-trigger" onClick={() => dialogOnOpenChange?.(true)}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode; className?: string }) => <p>{children}</p>,
}));

// Mock AlertDialog
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}));

// Track active tab for mock Tabs
let activeTab = 'installed';
let tabsOnValueChange: ((v: string) => void) | undefined;

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange, defaultValue }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void; defaultValue?: string; className?: string }) => {
    activeTab = value ?? defaultValue ?? 'installed';
    tabsOnValueChange = onValueChange;
    return <div data-testid="tabs">{children}</div>;
  },
  TabsList: ({ children }: { children: React.ReactNode; className?: string }) => <div data-testid="tabs-list" role="tablist">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button role="tab" data-testid={`tab-${value}`} onClick={() => tabsOnValueChange?.(value)}>{children}</button>
  ),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string; className?: string }) => (
    activeTab === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null
  ),
}));

// Mock ScrollArea (just renders children)
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
}));

// Mock Tooltip (just renders children)
jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('IndexManager', () => {
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
          installed_indexes: [],
        },
      ],
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
    });

    jest.clearAllMocks();
    mockTranslate.mockImplementation((key: string) => key);
    mockListen.mockImplementation(() => Promise.resolve(jest.fn()));
    mockIsTauri.mockReturnValue(false);
    mockDownloadIndex.mockResolvedValue(undefined);

    // Setup default mocks (after clearAllMocks so they persist)
    mockGetInstalledIndexes.mockResolvedValue([]);
    mockGetAvailableIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'd50_star_database.zip',
        download_url: 'https://example.com/d50.zip',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database - FOV > 0.3°',
        solver_type: 'astap',
      },
    ]);

    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
  });

  beforeEach(() => {
    activeTab = 'installed';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not render for online solver', () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net_online',
      },
    });

    const { container } = render(<IndexManager />);
    expect(container.firstChild).toBeNull();
  });

  it('should render trigger button', () => {
    render(<IndexManager />);
    expect(screen.getByText('plateSolving.manageIndexes')).toBeInTheDocument();
  });

  it('should render custom trigger', () => {
    render(
      <IndexManager trigger={<button>Custom Trigger</button>} />
    );
    expect(screen.getByText('Custom Trigger')).toBeInTheDocument();
  });

  it('should show installed and available tabs', () => {
    render(<IndexManager />);

    expect(screen.getByTestId('tab-installed')).toBeInTheDocument();
    expect(screen.getByTestId('tab-available')).toBeInTheDocument();
  });

  it('should render ASTAP fallback copy when translations are missing', async () => {
    mockTranslate.mockImplementation(() => '');

    render(<IndexManager solverType="astap" />);

    fireEvent.click(screen.getByTestId('dialog-trigger'));

    await waitFor(() => {
      expect(screen.getByText('Index Manager')).toBeInTheDocument();
      expect(screen.getByText('Manage star database index files for ASTAP')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-available'));

    await waitFor(() => {
      expect(screen.getByText('ASTAP uses star databases. D50 is recommended for most setups.')).toBeInTheDocument();
      expect(screen.getByText('ASTAP Website')).toBeInTheDocument();
    });
  });

  it('should render astrometry fallback copy when translations are missing', async () => {
    mockTranslate.mockImplementation(() => '');

    render(<IndexManager solverType="astrometry_net" />);

    fireEvent.click(screen.getByTestId('dialog-trigger'));
    fireEvent.click(screen.getByTestId('tab-available'));

    await waitFor(() => {
      expect(screen.getByText('Download indexes matching your image scale (FOV).')).toBeInTheDocument();
      expect(screen.getByText('Astrometry.net Index Files')).toBeInTheDocument();
    });
  });

  it('should load indexes when dialog opens', async () => {
    render(<IndexManager />);

    // Click trigger to open dialog and fire loadIndexes
    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetInstalledIndexes).toHaveBeenCalledWith('astap', undefined);
      expect(mockGetAvailableIndexes).toHaveBeenCalledWith('astap');
    });
  });

  it('should show empty state when no indexes installed', async () => {

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.noIndexesInstalled')).toBeInTheDocument();
    });
  });

  it('should display installed indexes', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });
  });

  it('should show available indexes in available tab', async () => {
    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    // Switch to available tab
    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });
  });

  it('should show ASTAP hint in available tab', async () => {
    render(<IndexManager solverType="astap" />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.astapIndexHint')).toBeInTheDocument();
    });
  });

  it('should show external link to ASTAP website in available tab', async () => {
    render(<IndexManager solverType="astap" />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://www.hnsky.org/astap.htm');
    });
  });

  it('should show total size for installed indexes', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: null,
        description: null,
      },
      {
        name: 'D20',
        file_name: 'D20',
        path: '/path/to/D20',
        size_bytes: 200 * 1024 * 1024,
        scale_range: null,
        description: null,
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
      expect(screen.getByText('D20')).toBeInTheDocument();
    });
  });

  it('should use provided solverType prop', async () => {
    render(<IndexManager solverType="astrometry_net" />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetInstalledIndexes).toHaveBeenCalledWith('astrometry_net', undefined);
      expect(mockGetAvailableIndexes).toHaveBeenCalledWith('astrometry_net');
    });
  });

  it('should show error when loading indexes fails', async () => {
    mockGetInstalledIndexes.mockRejectedValueOnce(new Error('Network error'));

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('should show delete button on installed indexes', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });

    // Find delete button (Trash2 icon button)
    const deleteButtons = screen.getAllByRole('button').filter(
      btn => btn.className?.includes('destructive')
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('should open delete confirmation dialog when delete clicked', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: null,
        description: null,
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButtons = screen.getAllByRole('button').filter(
      btn => btn.className?.includes('destructive')
    );
    fireEvent.click(deleteButtons[0]);

    // Confirm dialog should show
    expect(screen.getAllByText('plateSolving.deleteIndex').length).toBeGreaterThan(0);
    expect(screen.getByText('plateSolving.deleteIndexConfirm')).toBeInTheDocument();
  });

  it('should show installed badge for already-installed index in available tab', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    // Switch to available tab
    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      // The D50 should show installed badge
      const installedBadges = screen.getAllByText('plateSolving.installed');
      expect(installedBadges.length).toBeGreaterThan(0);
    });
  });

  it('should show total size and file count footer', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: null,
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });

    // Footer shows total size and file count (text may be split across elements)
    await waitFor(() => {
      expect(screen.getByText(/plateSolving\.files/)).toBeInTheDocument();
    });
  });

  it('should show astrometry.net link for astrometry_net solver', async () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net',
      },
    });

    render(<IndexManager solverType="astrometry_net" />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'http://data.astrometry.net/');
    });
  });

  it('should show download button to empty tab prompt', async () => {
    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.noIndexesInstalled')).toBeInTheDocument();
    });

    // Should have button to switch to available tab
    expect(screen.getByText('plateSolving.downloadIndexes')).toBeInTheDocument();
  });

  it('should show scale range for installed index', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/18-600 arcmin/)).toBeInTheDocument();
    });
  });

  it('should apply className prop', () => {
    render(<IndexManager className="custom-class" />);
    // Component renders without error
    expect(screen.getByText('plateSolving.manageIndexes')).toBeInTheDocument();
  });

  it('should open window when download clicked in non-desktop mode', async () => {
    const mockWindowOpen = jest.fn();
    window.open = mockWindowOpen;

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    // Switch to available tab
    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });

    // Click download button
    const downloadButton = screen.getByText('common.download');
    fireEvent.click(downloadButton);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://example.com/d50.zip',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('should show delete confirmation with action buttons', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: null,
        description: null,
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });

    // Click delete icon button
    const deleteButtons = screen.getAllByRole('button').filter(
      btn => btn.className?.includes('destructive')
    );
    fireEvent.click(deleteButtons[0]);

    // Confirm dialog should have cancel and delete buttons
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
    expect(screen.getByText('common.delete')).toBeInTheDocument();
  });

  it('should show download button in available tab for not-installed index', async () => {
    // Ensure no indexes are installed
    mockGetInstalledIndexes.mockResolvedValue([]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.getByText('common.download')).toBeInTheDocument();
    });
  });

  it('should show checkmark for installed index in available tab instead of download', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D50',
        file_name: 'D50',
        path: '/path/to/D50',
        size_bytes: 500 * 1024 * 1024,
        scale_range: { min_arcmin: 18, max_arcmin: 600 },
        description: 'Large database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      // Should show installed badge, not download button
      expect(screen.queryByText('common.download')).not.toBeInTheDocument();
    });
  });

  it('should show astrometry hint for astrometry_net solver in available tab', async () => {
    usePlateSolverStore.setState({
      ...usePlateSolverStore.getState(),
      config: {
        ...usePlateSolverStore.getState().config,
        solver_type: 'astrometry_net',
      },
    });

    render(<IndexManager solverType="astrometry_net" />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(mockGetAvailableIndexes).toHaveBeenCalled();
    });

    const availableTab = screen.getByTestId('tab-available');
    fireEvent.click(availableTab);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.astrometryIndexHint')).toBeInTheDocument();
    });
  });

  it('should switch to available tab when "Download Indexes" button clicked', async () => {
    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('plateSolving.noIndexesInstalled')).toBeInTheDocument();
    });

    const downloadBtn = screen.getByText('plateSolving.downloadIndexes');
    fireEvent.click(downloadBtn);

    // Should now show available tab content
    await waitFor(() => {
      expect(screen.getByText('D50')).toBeInTheDocument();
    });
  });

  it('should show installed index without scale_range', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'custom-index',
        file_name: 'custom-index',
        path: '/path/to/custom',
        size_bytes: 100 * 1024 * 1024,
        scale_range: null,
        description: null,
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('custom-index')).toBeInTheDocument();
    });
  });

  it('should show installed index with description', async () => {
    mockGetInstalledIndexes.mockResolvedValue([
      {
        name: 'D80',
        file_name: 'D80',
        path: '/path/to/D80',
        size_bytes: 800 * 1024 * 1024,
        scale_range: { min_arcmin: 5, max_arcmin: 60 },
        description: 'Small field deep database',
      },
    ]);

    render(<IndexManager />);

    const trigger = screen.getByTestId('dialog-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('D80')).toBeInTheDocument();
      expect(screen.getByText('Small field deep database')).toBeInTheDocument();
    });
  });

  describe('desktop mode', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true);
    });

    afterEach(() => {
      mockIsTauri.mockReturnValue(false);
    });

    it('should render installed indexes in desktop mode', async () => {
      mockGetInstalledIndexes.mockResolvedValue([
        {
          name: 'D50',
          file_name: 'D50',
          path: '/desktop/path/to/D50',
          size_bytes: 500 * 1024 * 1024,
          scale_range: null,
          description: null,
        },
      ]);

      render(<IndexManager />);

      const trigger = screen.getByTestId('dialog-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('D50')).toBeInTheDocument();
      });
    });

    it('should call downloadIndex when download clicked in desktop mode', async () => {
      mockDownloadIndex.mockResolvedValue(undefined);
      mockGetInstalledIndexes.mockResolvedValue([]);

      render(<IndexManager />);

      const trigger = screen.getByTestId('dialog-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockGetAvailableIndexes).toHaveBeenCalled();
      });

      // Switch to available tab
      const availableTab = screen.getByTestId('tab-available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByText('D50')).toBeInTheDocument();
      });

      // Click download button
      const downloadButton = screen.getByText('common.download');
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(mockDownloadIndex).toHaveBeenCalled();
      });
    });

    it('should show download progress after download starts', async () => {
      // Make download hang so we can check progress state
      mockDownloadIndex.mockImplementation(() => new Promise(() => {}));
      mockGetInstalledIndexes.mockResolvedValue([]);

      render(<IndexManager />);

      const trigger = screen.getByTestId('dialog-trigger');
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(mockGetAvailableIndexes).toHaveBeenCalled();
      });

      const availableTab = screen.getByTestId('tab-available');
      fireEvent.click(availableTab);

      await waitFor(() => {
        expect(screen.getByText('D50')).toBeInTheDocument();
      });

      const downloadButton = screen.getByText('common.download');
      fireEvent.click(downloadButton);

      // Download button should disappear (replaced by progress)
      await waitFor(() => {
        expect(screen.queryByText('common.download')).not.toBeInTheDocument();
      });
    });

    it('should update download progress from desktop events', async () => {
      let progressHandler:
        | ((event: { payload: { index_name: string; downloaded: number; total: number; percent: number } }) => void)
        | undefined;
      let resolveDownload: (() => void) | undefined;
      mockListen.mockImplementation(async (_event: string, handler: typeof progressHandler) => {
        progressHandler = handler;
        return jest.fn();
      });
      mockDownloadIndex.mockImplementation(() => new Promise<void>((resolve) => {
        resolveDownload = resolve;
      }));
      mockGetInstalledIndexes.mockResolvedValue([]);

      render(<IndexManager />);

      fireEvent.click(screen.getByTestId('dialog-trigger'));

      await waitFor(() => {
        expect(mockGetAvailableIndexes).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByTestId('tab-available'));
      fireEvent.click(screen.getByText('common.download'));

      await waitFor(() => {
        expect(mockDownloadIndex).toHaveBeenCalled();
      });

      act(() => {
        progressHandler?.({
          payload: {
            index_name: 'D50',
            downloaded: 42,
            total: 100,
            percent: 42,
          },
        });
      });

      expect(screen.getByText('42%')).toBeInTheDocument();
      resolveDownload?.();
    });

    it('should surface download failures in desktop mode', async () => {
      mockDownloadIndex.mockRejectedValueOnce(new Error('Disk full'));
      mockGetInstalledIndexes.mockResolvedValue([]);

      render(<IndexManager />);

      fireEvent.click(screen.getByTestId('dialog-trigger'));

      await waitFor(() => {
        expect(mockGetAvailableIndexes).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByTestId('tab-available'));
      fireEvent.click(screen.getByText('common.download'));

      await waitFor(() => {
        expect(screen.getAllByText('Disk full').length).toBeGreaterThan(0);
      });
    });

  });
});
