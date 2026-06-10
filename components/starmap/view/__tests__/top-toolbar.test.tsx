/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

const mockQuitApp = jest.fn();
const mockStartWindowDrag = jest.fn();
const mockHandleMaximize = jest.fn();
const mockSetSkyEngine = jest.fn();
const mockToggleAladinDisplaySetting = jest.fn();
const mockSetAladinDisplaySetting = jest.fn();
const mockSetViewDirection = jest.fn();

let mockIsTauri = false;
let mockWindowControls = {
  isTauriEnv: false,
  shell: {
    platform: 'web',
    mode: 'browser',
    dragStrategy: 'none',
    showsNativeWindowControls: false,
    supportsManualDragging: false,
    supportsDoubleClickMaximize: false,
    titlebarInsets: { left: 0, right: 0, top: 0 },
  },
  handleMaximize: mockHandleMaximize,
  handleStartWindowDrag: mockStartWindowDrag,
};

const mockSettingsState = {
  skyEngine: 'stellarium' as 'stellarium' | 'aladin',
  setSkyEngine: mockSetSkyEngine,
  mobileFeaturePreferences: {
    prioritizedTools: [] as string[],
  },
  aladinDisplay: {
    surveyEnabled: true,
    showCooGrid: false,
    showReticle: true,
    cooFrame: 'ICRSd' as 'ICRSd' | 'galactic',
  },
  toggleAladinDisplaySetting: mockToggleAladinDisplaySetting,
  setAladinDisplaySetting: mockSetAladinDisplaySetting,
};

const mockOnboardingBridgeState = {
  openSearchRequestId: 0,
  toggleSearchRequestId: 0,
  toggleSessionPanelRequestId: 0,
  closeTransientPanelsRequestId: 0,
  openMobileDrawerRequestId: 0,
  mobileDrawerSection: null as string | null,
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/constants/mobile-tools', () => ({
  DEFAULT_MOBILE_PRIORITIZED_TOOLS: [],
  sortByMobileToolPriority: jest.fn((items: unknown[]) => items),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button data-testid="switch-control" onClick={() => onCheckedChange?.(!checked)}>
      {String(checked)}
    </button>
  ),
}));

jest.mock('@/components/ui/drawer', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const DrawerOpenContext = ReactLib.createContext(false);

  return {
    Drawer: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) => <DrawerOpenContext.Provider value={Boolean(open)}>{children}</DrawerOpenContext.Provider>,
    DrawerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DrawerContent: ({ children }: { children: React.ReactNode }) => {
      const isOpen = ReactLib.useContext(DrawerOpenContext);
      return isOpen ? <div data-testid="mobile-menu-drawer">{children}</div> : null;
    },
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/common/toolbar-button', () => ({
  ToolbarButton: ({
    label,
    onClick,
    children,
  }: React.PropsWithChildren<{ label: string; onClick?: () => void }>) => (
    <button aria-label={label} onClick={onClick}>
      {children ?? label}
    </button>
  ),
  ToolbarGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/common/language-switcher', () => ({ LanguageSwitcher: () => <button>language</button> }));
jest.mock('@/components/common/theme-toggle', () => ({ ThemeToggle: () => <button>theme</button> }));
jest.mock('@/components/common/night-mode-toggle', () => ({ NightModeToggle: () => <button>night</button> }));
jest.mock('@/components/common/sensor-control-toggle', () => ({ SensorControlToggle: () => <button>sensor</button> }));
jest.mock('@/components/common/app-control-menu', () => ({ AppControlMenu: () => <div>app-controls</div> }));
jest.mock('@/components/common/ar-mode-toggle', () => ({ ARModeToggle: () => <button>ar</button> }));

jest.mock('@/components/starmap/time/stellarium-clock', () => ({ StellariumClock: () => <div data-testid="stellarium-clock" /> }));
jest.mock('@/components/starmap/settings/stellarium-settings', () => ({ StellariumSettings: () => <div>stellarium-settings</div> }));
jest.mock('@/components/starmap/management/unified-settings', () => ({ UnifiedSettings: () => <button>settings</button> }));
jest.mock('@/components/starmap/management/offline-cache-manager', () => ({ OfflineCacheManager: () => <button>offline-cache</button> }));
jest.mock('@/components/starmap/planning/tonight-recommendations', () => ({ TonightRecommendations: () => <button>tonight</button> }));
jest.mock('@/components/starmap/planning/sky-atlas-panel', () => ({ SkyAtlasPanel: () => <button>sky-atlas</button> }));
jest.mock('@/components/starmap/planning/astro-events-calendar', () => ({ AstroEventsCalendar: () => <button>astro-events</button> }));
jest.mock('@/components/starmap/planning/astro-calculator-dialog', () => ({ AstroCalculatorDialog: () => <button>astro-calculator</button> }));
jest.mock('@/components/starmap/planning/session-planner', () => ({ SessionPlannerButton: () => <button>session-planner</button> }));
jest.mock('@/components/starmap/overlays/satellite-tracker', () => ({ SatelliteTracker: () => <button>satellite</button> }));
jest.mock('@/components/starmap/overlays/ocular-simulator', () => ({ OcularSimulator: () => <button>ocular</button> }));
jest.mock('@/components/starmap/plate-solving/plate-solver-unified', () => ({
  PlateSolverUnified: ({ onGoToCoordinates }: { onGoToCoordinates: (ra: number, dec: number) => void }) => (
    <button onClick={() => onGoToCoordinates(10, 20)}>plate-solver</button>
  ),
}));
jest.mock('@/components/starmap/management/equipment-manager', () => ({ EquipmentManager: () => <button>equipment-manager</button> }));
jest.mock('@/components/starmap/dialogs/keyboard-shortcuts-dialog', () => ({ KeyboardShortcutsDialog: () => <button>shortcuts</button> }));
jest.mock('@/components/starmap/dialogs/about-dialog', () => ({ AboutDialog: () => <button>about</button> }));
jest.mock('@/components/starmap/controls/quick-actions-panel', () => ({
  QuickActionsPanel: ({ onZoomToFov, onResetView }: { onZoomToFov: (fov: number) => void; onResetView: () => void }) => (
    <div>
      <button onClick={() => onZoomToFov(45)}>quick-fov</button>
      <button onClick={onResetView}>quick-reset</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/controls/navigation-history', () => ({
  NavigationHistory: ({ onNavigate }: { onNavigate: (ra: number, dec: number, fov: number) => void }) => (
    <button onClick={() => onNavigate(1, 2, 3)}>history</button>
  ),
}));
jest.mock('@/components/starmap/controls/view-bookmarks', () => ({
  ViewBookmarks: ({ onNavigate }: { onNavigate: (ra: number, dec: number, fov: number) => void }) => (
    <button onClick={() => onNavigate(4, 5, 6)}>bookmarks</button>
  ),
}));
jest.mock('@/components/starmap/objects/object-type-legend', () => ({ ObjectTypeLegend: () => <button>legend</button> }));
jest.mock('@/components/starmap/knowledge/daily-knowledge-button', () => ({ DailyKnowledgeButton: () => <button>daily-knowledge</button> }));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri,
  quitApp: () => mockQuitApp(),
}));

jest.mock('@/lib/hooks/use-window-controls', () => ({
  useWindowControls: () => mockWindowControls,
}));

jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((selector: (state: { setViewDirection: typeof mockSetViewDirection }) => unknown) =>
    selector({
      setViewDirection: mockSetViewDirection,
    })),
  useSettingsStore: jest.fn((selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState)),
  useOnboardingBridgeStore: jest.fn((selector: (state: typeof mockOnboardingBridgeState) => unknown) =>
    selector(mockOnboardingBridgeState)),
}));

import { TopToolbar } from '../top-toolbar';

const defaultProps = {
  stel: false,
  isMobileShell: false,
  isSearchOpen: false,
  showSessionPanel: false,
  viewCenterRaDec: { ra: 0, dec: 0 },
  currentFov: 60,
  onToggleSearch: jest.fn(),
  onToggleSessionPanel: jest.fn(),
  onResetView: jest.fn(),
  onCloseStarmapClick: jest.fn(),
  onSetFov: jest.fn(),
  onNavigate: jest.fn(),
  onGoToCoordinates: jest.fn(),
};

describe('TopToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockIsTauri = false;
    mockWindowControls = {
      isTauriEnv: false,
      shell: {
        platform: 'web',
        mode: 'browser',
        dragStrategy: 'none',
        showsNativeWindowControls: false,
        supportsManualDragging: false,
        supportsDoubleClickMaximize: false,
        titlebarInsets: { left: 0, right: 0, top: 0 },
      },
      handleMaximize: mockHandleMaximize,
      handleStartWindowDrag: mockStartWindowDrag,
    };
    mockSettingsState.skyEngine = 'stellarium';
    mockOnboardingBridgeState.openSearchRequestId = 0;
    mockOnboardingBridgeState.toggleSearchRequestId = 0;
    mockOnboardingBridgeState.toggleSessionPanelRequestId = 0;
    mockOnboardingBridgeState.closeTransientPanelsRequestId = 0;
    mockOnboardingBridgeState.openMobileDrawerRequestId = 0;
    mockOnboardingBridgeState.mobileDrawerSection = null;
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders search controls and toggles search on click', () => {
    const onToggleSearch = jest.fn();
    render(<TopToolbar {...defaultProps} onToggleSearch={onToggleSearch} />);

    expect(screen.getByTestId('search-toggle-button')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-toggle-button'));
    expect(onToggleSearch).toHaveBeenCalledTimes(1);
  });

  it('responds to onboarding bridge request ids exactly once per change', () => {
    const onToggleSearch = jest.fn();
    const onToggleSessionPanel = jest.fn();

    mockOnboardingBridgeState.openSearchRequestId = 1;
    const view = render(
      <TopToolbar
        {...defaultProps}
        onToggleSearch={onToggleSearch}
        onToggleSessionPanel={onToggleSessionPanel}
      />,
    );

    expect(onToggleSearch).toHaveBeenCalledTimes(1);

    view.rerender(
      <TopToolbar
        {...defaultProps}
        onToggleSearch={onToggleSearch}
        onToggleSessionPanel={onToggleSessionPanel}
      />,
    );

    expect(onToggleSearch).toHaveBeenCalledTimes(1);

    mockOnboardingBridgeState.toggleSearchRequestId = 2;
    mockOnboardingBridgeState.toggleSessionPanelRequestId = 3;
    mockOnboardingBridgeState.closeTransientPanelsRequestId = 4;

    view.rerender(
      <TopToolbar
        {...defaultProps}
        isSearchOpen={true}
        onToggleSearch={onToggleSearch}
        onToggleSessionPanel={onToggleSessionPanel}
      />,
    );

    expect(onToggleSearch).toHaveBeenCalledTimes(3);
    expect(onToggleSessionPanel).toHaveBeenCalledTimes(1);
  });

  it('uses the explicit drag handle for manual window dragging and maximize', () => {
    mockWindowControls = {
      isTauriEnv: true,
      shell: {
        platform: 'windows',
        mode: 'custom-frameless',
        dragStrategy: 'manual',
        showsNativeWindowControls: false,
        supportsManualDragging: true,
        supportsDoubleClickMaximize: true,
        titlebarInsets: { left: 0, right: 0, top: 0 },
      },
      handleMaximize: mockHandleMaximize,
      handleStartWindowDrag: mockStartWindowDrag,
    };

    render(<TopToolbar {...defaultProps} />);

    const handle = screen.getByTestId('window-drag-handle');
    fireEvent.mouseDown(handle, { button: 0 });
    fireEvent.mouseDown(handle, { button: 2 });
    fireEvent.doubleClick(handle);

    expect(mockStartWindowDrag).toHaveBeenCalledTimes(1);
    expect(mockHandleMaximize).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the mobile drawer from onboarding requests and can quit the Tauri app', () => {
    mockIsTauri = true;
    mockOnboardingBridgeState.openMobileDrawerRequestId = 1;

    const view = render(<TopToolbar {...defaultProps} stel={true} isMobileShell />);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const drawer = screen.getByTestId('mobile-menu-drawer');
    expect(drawer).toBeInTheDocument();
    fireEvent.click(within(drawer).getAllByRole('button', { name: '' })[0]);
    expect(mockQuitApp).toHaveBeenCalledTimes(1);

    mockOnboardingBridgeState.closeTransientPanelsRequestId = 2;
    view.rerender(<TopToolbar {...defaultProps} stel={true} isMobileShell />);

    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('renders the clock when Stellarium is available or Aladin is the active engine', () => {
    const view = render(<TopToolbar {...defaultProps} stel={true} />);
    expect(screen.getByTestId('stellarium-clock')).toBeInTheDocument();

    mockSettingsState.skyEngine = 'aladin';
    view.rerender(<TopToolbar {...defaultProps} stel={false} />);
    expect(screen.getByTestId('stellarium-clock')).toBeInTheDocument();
  });

  it('handles Aladin mobile drawer controls and plate-solver navigation callbacks', () => {
    mockSettingsState.skyEngine = 'aladin';
    mockOnboardingBridgeState.openMobileDrawerRequestId = 1;

    render(<TopToolbar {...defaultProps} stel={false} isMobileShell />);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const drawer = screen.getByTestId('mobile-menu-drawer');
    fireEvent.click(within(drawer).getByText('plate-solver'));
    expect(mockSetViewDirection).toHaveBeenCalledWith(10, 20);

    const switches = within(drawer).getAllByTestId('switch-control');
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    expect(mockToggleAladinDisplaySetting).toHaveBeenCalledWith('showCooGrid');
    expect(mockToggleAladinDisplaySetting).toHaveBeenCalledWith('showReticle');

    fireEvent.change(within(drawer).getByDisplayValue('settings.equatorial'), {
      target: { value: 'galactic' },
    });
    expect(mockSetAladinDisplaySetting).toHaveBeenCalledWith('cooFrame', 'galactic');

    fireEvent.click(within(drawer).getByText('engine.switchToStellarium'));
    expect(mockSetSkyEngine).toHaveBeenCalledWith('stellarium');
  });

  it('mounts desktop tool groups and the center clock, and hides the mobile menu, in the desktop shell', () => {
    const { container } = render(<TopToolbar {...defaultProps} isMobileShell={false} stel={true} />);

    // Desktop tool groups are mounted
    expect(screen.getByText('tonight')).toBeInTheDocument();
    expect(screen.getByText('session-planner')).toBeInTheDocument();
    expect(screen.getByText('app-controls')).toBeInTheDocument();
    // Center clock is desktop-only
    expect(screen.getByTestId('stellarium-clock')).toBeInTheDocument();
    // The mobile hamburger is NOT mounted in the desktop shell
    expect(container.querySelector('[data-tour-id="mobile-menu"]')).toBeNull();
  });

  it('mounts the mobile menu and unmounts desktop tool groups in the mobile shell', () => {
    const { container } = render(<TopToolbar {...defaultProps} isMobileShell={true} stel={true} />);

    // The mobile hamburger is mounted
    expect(container.querySelector('[data-tour-id="mobile-menu"]')).not.toBeNull();
    // Desktop-only tool group items are NOT mounted in the bar (drawer is closed)
    expect(screen.queryByText('tonight')).not.toBeInTheDocument();
    expect(screen.queryByText('session-planner')).not.toBeInTheDocument();
    expect(screen.queryByText('app-controls')).not.toBeInTheDocument();
    // Center clock is desktop-only, so it is absent in the mobile shell (clock lives in the drawer)
    expect(screen.queryByTestId('stellarium-clock')).not.toBeInTheDocument();
    // The search button stays available in both shells
    expect(screen.getByTestId('search-toggle-button')).toBeInTheDocument();
  });
});
