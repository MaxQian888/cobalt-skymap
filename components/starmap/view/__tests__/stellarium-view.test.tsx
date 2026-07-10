/**
 * @jest-environment jsdom
 */

import React from 'react';
import type { SkyMapCanvasProps } from '@/lib/core/types/sky-engine';
import { fireEvent, render, screen } from '@testing-library/react';

const mockArToggleButtonClick = jest.fn();

let mockArMode = true;
let mockArLaunchAssistantVisible = false;
let mockIsMobileShell = false;
let mockViewportHeight = 800;
let mockIsTauri = false;
let mockCliBridgeState = {
  searchRequestId: 0,
  pendingSearchQuery: '',
  plateSolverRequestId: 0,
  plateSolverLaunch: null as null | {
    imagePath?: string;
    raHint?: number;
    decHint?: number;
    fovHint?: number;
  },
};
let mockMobileUiState = {
  activePanel: null as null | 'search' | 'details' | 'planning' | 'settings',
  setMobileShell: jest.fn(),
  openPanel: jest.fn(),
  closePanelIfActive: jest.fn(),
  resetPanelFlow: jest.fn(),
};
let mockPlanningUiState = {
  sessionPlannerOpen: false,
  openSessionPlanner: jest.fn(),
  setSessionPlannerOpen: jest.fn(),
};
let mockOnboardingBridgeState = {
  openSettingsDrawer: jest.fn(),
  settingsDrawerOpen: false,
  closeTransientPanels: jest.fn(),
};
let mockArSession = {
  status: 'blocked' as 'ready' | 'blocked',
  rawStatus: 'blocked' as 'ready' | 'blocked',
  isStabilizing: false,
  stabilizationRemainingMs: 0,
  cameraLayerEnabled: true,
  sensorPointingEnabled: false,
  compassEnabled: false,
  needsUserAction: true,
  recoveryActions: ['disable-ar'] as string[],
};
let mockArAdaptation = {
  assistantMode: 'edge-sheet',
  recoveryMode: 'compact-strip',
  cameraControlMode: 'compact-strip',
  sensorPath: 'sensor-primary',
  runtimeClass: 'browser-mobile',
  layoutTier: 'phone-compact',
  controlDensity: 'compact',
  capabilityTier: 'limited',
  isLandscape: false,
  isViewportReduced: false,
  viewportWidth: 390,
  viewportHeight: 844,
  safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 },
};

const mockViewState = {
  isSearchOpen: false,
  setIsSearchOpen: jest.fn(),
  selectedObject: null as null | { names: string[]; raDeg: number; decDeg: number; ra: string; dec: string },
  setSelectedObject: jest.fn(),
  currentFov: 45,
  showSessionPanel: false,
  setShowSessionPanel: jest.fn(),
  toggleSessionPanel: jest.fn(),
  contextMenuCoords: null as null | { ra: number; dec: number; raStr: string; decStr: string },
  clickPosition: null as null | { x: number; y: number },
  containerBounds: null as null | { width: number; height: number },
  contextMenuOpen: false,
  setContextMenuOpen: jest.fn(),
  contextMenuPosition: { x: 0, y: 0 },
  goToDialogOpen: false,
  setGoToDialogOpen: jest.fn(),
  detailDrawerOpen: false,
  setDetailDrawerOpen: jest.fn(),
  closeConfirmDialogOpen: false,
  setCloseConfirmDialogOpen: jest.fn(),
  viewCenterRaDec: { ra: 10, dec: 20 },
  canvasRef: { current: null as null | Record<string, unknown> },
  searchRef: { current: null as null | { setQuery?: (query: string) => void; focusSearchInput?: () => void } },
  containerRef: { current: null as null | HTMLDivElement },
  setRotationAngle: jest.fn(),
  stel: true as null | boolean,
  skyEngine: 'stellarium' as 'stellarium' | 'aladin',
  mountConnected: false,
  stellariumSettings: {},
  toggleStellariumSetting: jest.fn(),
  setPendingMarkerCoords: jest.fn(),
  handleSelectionChange: jest.fn(),
  handleDeselectObject: jest.fn(),
  handleFovChange: jest.fn(),
  handleSetFramingCoordinates: jest.fn(),
  handleZoomIn: jest.fn(),
  handleZoomOut: jest.fn(),
  handleSetFov: jest.fn(),
  handleResetView: jest.fn(),
  handleLocationChange: jest.fn(),
  handleContextMenuCapture: jest.fn(),
  handleAddToTargetList: jest.fn(),
  handleNavigateToCoords: jest.fn(),
  openGoToDialog: jest.fn(),
  handleGoToCoordinates: jest.fn(),
  handleCloseStarmapClick: jest.fn(),
  handleConfirmClose: jest.fn(),
  toggleSearch: jest.fn(),
  handleNavigate: jest.fn(),
  handleMarkerEdit: jest.fn(),
  handleMarkerNavigate: jest.fn(),
};

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

type MockSkyMapCanvasProps = Pick<SkyMapCanvasProps, 'onSelectionChange' | 'onContextMenu'>;

function createInteractiveDiv(testId: string) {
  const Component = () => <div data-testid={testId} />;
  Component.displayName = `Mock${testId}`;
  return Component;
}

jest.mock('@/components/starmap/canvas/sky-map-canvas', () => ({
  SkyMapCanvas: React.forwardRef<HTMLDivElement, MockSkyMapCanvasProps>(function MockSkyMapCanvas(props, ref) {
    const selection = { names: ['M31'] } as Parameters<NonNullable<MockSkyMapCanvasProps['onSelectionChange']>>[0];
    const syntheticEvent = { clientX: 10, clientY: 20 } as React.MouseEvent;
    return (
      <div data-testid="sky-map-canvas" ref={ref}>
        <button data-testid="canvas-selection" onClick={() => props.onSelectionChange?.(selection)}>
          selection
        </button>
        <button data-testid="canvas-context" onClick={() => props.onContextMenu?.(syntheticEvent, null)}>
          context
        </button>
      </div>
    );
  }),
}));
jest.mock('@/components/starmap/objects/info-panel', () => ({
  InfoPanel: ({
    onClose,
    onViewDetails,
  }: {
    onClose: () => void;
    onViewDetails: () => void;
  }) => (
    <div data-testid="info-panel">
      <button data-testid="info-close" onClick={onClose}>close info</button>
      <button data-testid="info-view-details" onClick={onViewDetails}>details</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/objects/object-detail-drawer', () => ({
  ObjectDetailDrawer: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="object-detail-drawer" data-open={String(open)}>
      <button data-testid="drawer-close" onClick={() => onOpenChange(false)}>close drawer</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/controls/keyboard-shortcuts-manager', () => ({
  KeyboardShortcutsManager: ({
    onToggleSearch,
    onToggleSessionPanel,
    onToggleAr,
    onClosePanel,
  }: {
    onToggleSearch: () => void;
    onToggleSessionPanel: () => void;
    onToggleAr: () => void;
    onClosePanel: () => void;
  }) => (
    <div data-testid="keyboard-shortcuts-manager">
      <button data-testid="ks-toggle-search" onClick={onToggleSearch}>toggle search</button>
      <button data-testid="ks-toggle-session" onClick={onToggleSessionPanel}>toggle session</button>
      <button data-testid="ks-toggle-ar" onClick={onToggleAr}>toggle ar</button>
      <button data-testid="ks-close-panel" onClick={onClosePanel}>close panel</button>
      <button data-testid="ar-mode-toggle" onClick={mockArToggleButtonClick}>real ar toggle</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/onboarding/unified-onboarding', () => ({ UnifiedOnboarding: createInteractiveDiv('unified-onboarding') }));
jest.mock('@/components/starmap/knowledge/startup-modal-coordinator', () => ({ StartupModalCoordinator: createInteractiveDiv('startup-modal-coordinator') }));
jest.mock('@/components/starmap/view/top-toolbar', () => ({
  TopToolbar: ({
    stel,
    onToggleSearch,
  }: {
    stel: boolean;
    onToggleSearch: () => void;
  }) => (
    <div data-testid="top-toolbar" data-stel={String(stel)}>
      <button data-testid="top-toolbar-search" onClick={onToggleSearch}>toolbar search</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/view/right-control-panel', () => ({ RightControlPanel: createInteractiveDiv('right-control-panel') }));
jest.mock('@/components/starmap/view/mobile-layout', () => ({
  MobileLayout: ({
    onOpenSearch,
    onOpenDetails,
    onOpenSessionPlanner,
    onOpenSettings,
  }: {
    onOpenSearch: () => void;
    onOpenDetails: () => void;
    onOpenSessionPlanner: () => void;
    onOpenSettings: () => void;
  }) => (
    <div data-testid="mobile-layout">
      <button data-testid="mobile-open-search" onClick={onOpenSearch}>search</button>
      <button data-testid="mobile-open-details" onClick={onOpenDetails}>details</button>
      <button data-testid="mobile-open-planning" onClick={onOpenSessionPlanner}>planning</button>
      <button data-testid="mobile-open-settings" onClick={onOpenSettings}>settings</button>
    </div>
  ),
}));
jest.mock('@/components/starmap/view/canvas-context-menu', () => ({ CanvasContextMenu: createInteractiveDiv('canvas-context-menu') }));
jest.mock('@/components/starmap/view/go-to-coordinates-dialog', () => ({ GoToCoordinatesDialog: createInteractiveDiv('go-to-coordinates-dialog') }));
jest.mock('@/components/starmap/view/search-panel', () => ({
  SearchPanel: React.forwardRef<HTMLDivElement, {
    isMobileShell?: boolean;
    onClose: () => void;
    onSelect: () => void;
  }>(function MockSearchPanel({ isMobileShell = false, onClose, onSelect }, _ref) {
    return (
      <div data-testid="search-panel" data-mobile-shell={String(isMobileShell)}>
        <button data-testid="search-close" onClick={onClose}>close search</button>
        <button data-testid="search-select" onClick={onSelect}>select result</button>
      </div>
    );
  }),
}));
jest.mock('@/components/starmap/view/close-confirm-dialog', () => ({ CloseConfirmDialog: createInteractiveDiv('close-confirm-dialog') }));
jest.mock('@/components/starmap/view/overlays-container', () => ({ OverlaysContainer: createInteractiveDiv('overlays-container') }));
jest.mock('@/components/starmap/view/center-crosshair', () => ({ CenterCrosshair: createInteractiveDiv('center-crosshair') }));
jest.mock('@/components/starmap/view/bottom-status-bar', () => ({ BottomStatusBar: createInteractiveDiv('bottom-status-bar') }));
jest.mock('@/components/starmap/management/updater/update-banner', () => ({
  UpdateBanner: ({ onOpenDialog }: { onOpenDialog: () => void }) => (
    <button data-testid="update-banner-open" onClick={onOpenDialog}>open update</button>
  ),
}));
jest.mock('@/components/starmap/management/updater/update-dialog', () => ({
  UpdateDialog: ({ open }: { open: boolean }) => <div data-testid="update-dialog" data-open={String(open)} />,
}));
jest.mock('@/components/starmap/planning/session-planner', () => ({ SessionPlanner: createInteractiveDiv('session-planner') }));
jest.mock('@/components/starmap/planning/messier-marathon-guide', () => ({ MessierMarathonGuideDialog: createInteractiveDiv('messier-marathon-guide') }));
jest.mock('@/components/starmap/plate-solving/plate-solver-unified', () => ({ PlateSolverUnified: createInteractiveDiv('plate-solver-unified') }));
jest.mock('@/components/starmap/overlays/ar-camera-background', () => ({ ARCameraBackground: createInteractiveDiv('ar-camera-background') }));
jest.mock('@/components/starmap/overlays/ar-compass-overlay', () => ({ ARCompassOverlay: createInteractiveDiv('ar-compass-overlay') }));
jest.mock('@/components/starmap/view/ar-recovery-panel', () => ({ ARRecoveryPanel: createInteractiveDiv('ar-recovery-panel') }));
jest.mock('@/components/starmap/view/ar-launch-assistant', () => ({ ARLaunchAssistant: createInteractiveDiv('ar-launch-assistant') }));

jest.mock('@/components/starmap/view/use-mobile-shell', () => ({
  useMobileShell: () => ({
    isMobileShell: mockIsMobileShell,
    viewportHeight: mockViewportHeight,
  }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => mockArAdaptation,
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => mockArSession,
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri,
}));

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: <T,>(selector: (state: { stellarium: { arMode: boolean; arOpacity: number; arShowCompass: boolean } }) => T): T =>
    selector({
      stellarium: {
        arMode: mockArMode,
        arOpacity: 0.7,
        arShowCompass: true,
      },
    }),
}));

jest.mock('@/lib/stores', () => ({
  useOnboardingBridgeStore: <T,>(selector: (state: typeof mockOnboardingBridgeState) => T): T =>
    selector(mockOnboardingBridgeState),
  usePlanningUiStore: <T,>(selector: (state: typeof mockPlanningUiState) => T): T =>
    selector(mockPlanningUiState),
  useStarmapMobileUiStore: <T,>(selector: (state: typeof mockMobileUiState) => T): T =>
    selector(mockMobileUiState),
}));

jest.mock('@/lib/stores/cli-bridge-store', () => ({
  useCliBridgeStore: <T,>(selector: (state: typeof mockCliBridgeState) => T): T =>
    selector(mockCliBridgeState),
}));

jest.mock('@/lib/stores/ar-runtime-store', () => ({
  useARRuntimeStore: <T,>(selector: (state: { launchAssistant: { visible: boolean } }) => T): T =>
    selector({
      launchAssistant: {
        visible: mockArLaunchAssistantVisible,
      },
    }),
}));

jest.mock('@/components/starmap/view/use-stellarium-view-state', () => ({
  useStellariumViewState: () => mockViewState,
}));

import { StellariumView } from '../stellarium-view';

function resetViewState() {
  mockArMode = true;
  mockArLaunchAssistantVisible = false;
  mockIsMobileShell = false;
  mockViewportHeight = 800;
  mockIsTauri = false;
  mockCliBridgeState = {
    searchRequestId: 0,
    pendingSearchQuery: '',
    plateSolverRequestId: 0,
    plateSolverLaunch: null,
  };
  mockMobileUiState = {
    activePanel: null,
    setMobileShell: jest.fn(),
    openPanel: jest.fn(),
    closePanelIfActive: jest.fn(),
    resetPanelFlow: jest.fn(),
  };
  mockPlanningUiState = {
    sessionPlannerOpen: false,
    openSessionPlanner: jest.fn(),
    setSessionPlannerOpen: jest.fn(),
  };
  mockOnboardingBridgeState = {
    openSettingsDrawer: jest.fn(),
    settingsDrawerOpen: false,
    closeTransientPanels: jest.fn(),
  };
  mockArSession = {
    status: 'blocked',
    rawStatus: 'blocked',
    isStabilizing: false,
    stabilizationRemainingMs: 0,
    cameraLayerEnabled: true,
    sensorPointingEnabled: false,
    compassEnabled: false,
    needsUserAction: true,
    recoveryActions: ['disable-ar'],
  };
  mockArAdaptation = {
    assistantMode: 'edge-sheet',
    recoveryMode: 'compact-strip',
    cameraControlMode: 'compact-strip',
    sensorPath: 'sensor-primary',
    runtimeClass: 'browser-mobile',
    layoutTier: 'phone-compact',
    controlDensity: 'compact',
    capabilityTier: 'limited',
    isLandscape: false,
    isViewportReduced: false,
    viewportWidth: 390,
    viewportHeight: 844,
    safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 },
  };

  Object.assign(mockViewState, {
    isSearchOpen: false,
    setIsSearchOpen: jest.fn(),
    selectedObject: null,
    setSelectedObject: jest.fn(),
    currentFov: 45,
    showSessionPanel: false,
    setShowSessionPanel: jest.fn(),
    toggleSessionPanel: jest.fn(),
    contextMenuCoords: null,
    clickPosition: null,
    containerBounds: null,
    contextMenuOpen: false,
    setContextMenuOpen: jest.fn(),
    contextMenuPosition: { x: 0, y: 0 },
    goToDialogOpen: false,
    setGoToDialogOpen: jest.fn(),
    detailDrawerOpen: false,
    setDetailDrawerOpen: jest.fn(),
    closeConfirmDialogOpen: false,
    setCloseConfirmDialogOpen: jest.fn(),
    viewCenterRaDec: { ra: 10, dec: 20 },
    canvasRef: { current: null },
    searchRef: { current: null },
    containerRef: { current: null },
    setRotationAngle: jest.fn(),
    stel: true,
    skyEngine: 'stellarium',
    mountConnected: false,
    stellariumSettings: {},
    toggleStellariumSetting: jest.fn(),
    setPendingMarkerCoords: jest.fn(),
    handleSelectionChange: jest.fn(),
    handleDeselectObject: jest.fn(),
    handleFovChange: jest.fn(),
    handleSetFramingCoordinates: jest.fn(),
    handleZoomIn: jest.fn(),
    handleZoomOut: jest.fn(),
    handleSetFov: jest.fn(),
    handleResetView: jest.fn(),
    handleLocationChange: jest.fn(),
    handleContextMenuCapture: jest.fn(),
    handleAddToTargetList: jest.fn(),
    handleNavigateToCoords: jest.fn(),
    openGoToDialog: jest.fn(),
    handleGoToCoordinates: jest.fn(),
    handleCloseStarmapClick: jest.fn(),
    handleConfirmClose: jest.fn(),
    toggleSearch: jest.fn(),
    handleNavigate: jest.fn(),
    handleMarkerEdit: jest.fn(),
    handleMarkerNavigate: jest.fn(),
  });
}

describe('StellariumView', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    resetViewState();
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
  });

  it('renders non-AR desktop state and treats Aladin as an active engine', () => {
    mockArMode = false;
    mockViewState.stel = null;
    mockViewState.skyEngine = 'aladin';

    render(<StellariumView />);

    expect(screen.getByTestId('stellarium-view-root')).toHaveClass('bg-black');
    expect(screen.queryByTestId('ar-camera-background')).not.toBeInTheDocument();
    expect(screen.getByTestId('top-toolbar')).toHaveAttribute('data-stel', 'true');
    expect(screen.getByTestId('bottom-status-bar')).toBeInTheDocument();
  });

  it('routes keyboard shortcuts through desktop close-panel branches and AR toggle bridge', () => {
    const initialView = render(<StellariumView />);

    fireEvent.click(screen.getByTestId('ks-toggle-search'));
    expect(mockViewState.toggleSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('ks-toggle-session'));
    expect(mockViewState.toggleSessionPanel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('ks-toggle-ar'));
    expect(mockArToggleButtonClick).toHaveBeenCalledTimes(1);

    initialView.unmount();
    resetViewState();
    mockViewState.isSearchOpen = true;
    const searchView = render(<StellariumView />);
    fireEvent.click(screen.getByTestId('ks-close-panel'));
    expect(mockViewState.setIsSearchOpen).toHaveBeenCalledWith(false);
    searchView.unmount();

    resetViewState();
    mockViewState.detailDrawerOpen = true;
    const drawerView = render(<StellariumView />);
    fireEvent.click(screen.getByTestId('ks-close-panel'));
    expect(mockViewState.setDetailDrawerOpen).toHaveBeenCalledWith(false);
    drawerView.unmount();

    resetViewState();
    mockViewState.selectedObject = {
      names: ['M42'],
      raDeg: 83.82,
      decDeg: -5.39,
      ra: '05h35m',
      dec: '-05d23m',
    };
    render(<StellariumView />);
    fireEvent.click(screen.getByTestId('ks-close-panel'));
    expect(mockViewState.handleDeselectObject).toHaveBeenCalled();
  });

  it('synchronizes mobile panel state through effects and child callbacks', () => {
    mockIsMobileShell = true;
    mockMobileUiState.activePanel = 'search';
    const searchPanelView = render(<StellariumView />);

    expect(mockMobileUiState.setMobileShell).toHaveBeenCalledWith(true);
    expect(mockViewState.setIsSearchOpen).toHaveBeenCalledWith(true);
    searchPanelView.unmount();

    resetViewState();
    mockIsMobileShell = true;
    mockMobileUiState.activePanel = 'details';
    mockViewState.selectedObject = {
      names: ['M31'],
      raDeg: 10.68,
      decDeg: 41.27,
      ra: '00h42m',
      dec: '+41d16m',
    };
    const detailsView = render(<StellariumView />);
    expect(mockViewState.setDetailDrawerOpen).toHaveBeenCalledWith(true);
    detailsView.unmount();

    resetViewState();
    mockIsMobileShell = true;
    mockMobileUiState.activePanel = 'planning';
    const planningView = render(<StellariumView />);
    expect(mockPlanningUiState.setSessionPlannerOpen).toHaveBeenCalledWith(true);
    planningView.unmount();

    resetViewState();
    mockIsMobileShell = true;
    mockMobileUiState.activePanel = 'settings';
    const settingsView = render(<StellariumView />);
    expect(mockOnboardingBridgeState.openSettingsDrawer).toHaveBeenCalledTimes(1);
    settingsView.unmount();

    resetViewState();
    mockIsMobileShell = true;
    mockViewState.isSearchOpen = true;
    mockViewState.detailDrawerOpen = true;
    mockPlanningUiState.sessionPlannerOpen = true;
    mockOnboardingBridgeState.settingsDrawerOpen = true;
    render(<StellariumView />);

    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('search');
    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('details');
    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('planning');
    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('settings');

    fireEvent.click(screen.getByTestId('search-close'));
    fireEvent.click(screen.getByTestId('search-select'));
    expect(mockMobileUiState.closePanelIfActive).toHaveBeenCalledWith('search');

    fireEvent.click(screen.getByTestId('mobile-open-search'));
    fireEvent.click(screen.getByTestId('mobile-open-details'));
    fireEvent.click(screen.getByTestId('mobile-open-planning'));
    fireEvent.click(screen.getByTestId('mobile-open-settings'));

    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('search');
    expect(mockMobileUiState.openPanel).toHaveBeenCalledWith('details');
    expect(mockPlanningUiState.openSessionPlanner).toHaveBeenCalledTimes(1);
    expect(mockOnboardingBridgeState.openSettingsDrawer).toHaveBeenCalled();
  });

  it('handles info panel and drawer close flows across desktop and mobile paths', () => {
    mockViewState.selectedObject = {
      names: ['M42'],
      raDeg: 83.82,
      decDeg: -5.39,
      ra: '05h35m',
      dec: '-05d23m',
    };

    const desktopView = render(<StellariumView />);

    fireEvent.click(screen.getByTestId('info-close'));
    fireEvent.click(screen.getByTestId('info-view-details'));

    expect(mockViewState.handleDeselectObject).toHaveBeenCalled();
    expect(mockViewState.setDetailDrawerOpen).toHaveBeenCalledWith(true);
    desktopView.unmount();

    resetViewState();
    mockIsMobileShell = true;
    mockViewState.detailDrawerOpen = true;
    mockMobileUiState.activePanel = 'details';
    render(<StellariumView />);

    fireEvent.click(screen.getByTestId('drawer-close'));
    expect(mockViewState.setDetailDrawerOpen).toHaveBeenCalledWith(false);
    expect(mockMobileUiState.closePanelIfActive).toHaveBeenCalledWith('details');
  });

  it('processes CLI search focus requests and opens the update dialog in Tauri', () => {
    const setQuery = jest.fn();
    const focusSearchInput = jest.fn();
    mockIsTauri = true;
    mockCliBridgeState.searchRequestId = 1;
    mockCliBridgeState.pendingSearchQuery = 'M42';
    mockViewState.searchRef.current = { setQuery, focusSearchInput };

    render(<StellariumView />);

    expect(setQuery).toHaveBeenCalledWith('M42');
    expect(focusSearchInput).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('update-banner-open'));
    expect(screen.getByTestId('update-dialog')).toHaveAttribute('data-open', 'true');
  });
});
