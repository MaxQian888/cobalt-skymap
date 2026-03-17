/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

const mockSetArMode = jest.fn();
let mockArMode = true;
let mockArSessionStatus: 'ready' | 'blocked' = 'blocked';
let mockArLayoutTier: 'phone-compact' | 'phone' | 'tablet' | 'desktop' = 'phone-compact';
let mockArRuntimeClass: 'browser-mobile' | 'browser-desktop' | 'tauri-desktop' = 'browser-mobile';
let mockSensorPath: 'sensor-primary' | 'camera-primary' | 'manual-only' = 'sensor-primary';

const createDivComponent = (testId: string) => {
  const Component = () => <div data-testid={testId} />;
  Component.displayName = `Mock${testId}`;
  return Component;
};
const createForwardRefComponent = (testId: string) => {
  const Component = React.forwardRef<HTMLDivElement, Record<string, unknown>>((_, ref) => (
    <div data-testid={testId} ref={ref} />
  ));
  Component.displayName = `Mock${testId}`;
  return Component;
};

jest.mock('@/components/starmap/canvas/sky-map-canvas', () => ({
  SkyMapCanvas: createForwardRefComponent('sky-map-canvas'),
}));
jest.mock('@/components/starmap/objects/info-panel', () => ({ InfoPanel: createDivComponent('info-panel') }));
jest.mock('@/components/starmap/objects/object-detail-drawer', () => ({ ObjectDetailDrawer: createDivComponent('object-detail-drawer') }));
jest.mock('@/components/starmap/controls/keyboard-shortcuts-manager', () => ({ KeyboardShortcutsManager: createDivComponent('keyboard-shortcuts-manager') }));
jest.mock('@/components/starmap/onboarding/unified-onboarding', () => ({ UnifiedOnboarding: createDivComponent('unified-onboarding') }));
jest.mock('@/components/starmap/knowledge/startup-modal-coordinator', () => ({ StartupModalCoordinator: createDivComponent('startup-modal-coordinator') }));
jest.mock('@/components/starmap/view/top-toolbar', () => ({ TopToolbar: createDivComponent('top-toolbar') }));
jest.mock('@/components/starmap/view/right-control-panel', () => ({ RightControlPanel: createDivComponent('right-control-panel') }));
jest.mock('@/components/starmap/view/mobile-layout', () => ({ MobileLayout: createDivComponent('mobile-layout') }));
jest.mock('@/components/starmap/view/canvas-context-menu', () => ({ CanvasContextMenu: createDivComponent('canvas-context-menu') }));
jest.mock('@/components/starmap/view/go-to-coordinates-dialog', () => ({ GoToCoordinatesDialog: createDivComponent('go-to-coordinates-dialog') }));
jest.mock('@/components/starmap/view/search-panel', () => ({ SearchPanel: createForwardRefComponent('search-panel') }));
jest.mock('@/components/starmap/view/close-confirm-dialog', () => ({ CloseConfirmDialog: createDivComponent('close-confirm-dialog') }));
jest.mock('@/components/starmap/view/overlays-container', () => ({ OverlaysContainer: createDivComponent('overlays-container') }));
jest.mock('@/components/starmap/view/center-crosshair', () => ({ CenterCrosshair: createDivComponent('center-crosshair') }));
jest.mock('@/components/starmap/view/bottom-status-bar', () => ({ BottomStatusBar: createDivComponent('bottom-status-bar') }));
jest.mock('@/components/starmap/management/updater/update-banner', () => ({ UpdateBanner: createDivComponent('update-banner') }));
jest.mock('@/components/starmap/management/updater/update-dialog', () => ({ UpdateDialog: createDivComponent('update-dialog') }));
jest.mock('@/components/starmap/planning/session-planner', () => ({ SessionPlanner: createDivComponent('session-planner') }));
jest.mock('@/components/starmap/planning/messier-marathon-guide', () => ({ MessierMarathonGuideDialog: createDivComponent('messier-marathon-guide') }));
jest.mock('@/components/starmap/overlays/ar-camera-background', () => ({ ARCameraBackground: createDivComponent('ar-camera-background') }));
jest.mock('@/components/starmap/overlays/ar-compass-overlay', () => ({ ARCompassOverlay: createDivComponent('ar-compass-overlay') }));
jest.mock('@/components/starmap/view/ar-launch-assistant', () => ({ ARLaunchAssistant: createDivComponent('ar-launch-assistant') }));

jest.mock('@/components/starmap/view/use-mobile-shell', () => ({
  useMobileShell: () => ({
    isMobileShell: false,
    viewportHeight: 800,
  }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: 'compact-strip',
    cameraControlMode: 'compact-strip',
    sensorPath: mockSensorPath,
    runtimeClass: mockArRuntimeClass,
    layoutTier: mockArLayoutTier,
    controlDensity: 'compact',
    capabilityTier: 'limited',
    isLandscape: false,
    isViewportReduced: false,
    viewportWidth: 390,
    viewportHeight: 844,
    safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 },
  }),
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => ({
    status: mockArSessionStatus,
    rawStatus: mockArSessionStatus,
    isStabilizing: false,
    stabilizationRemainingMs: 0,
    cameraLayerEnabled: true,
    sensorPointingEnabled: false,
    compassEnabled: false,
    needsUserAction: mockArSessionStatus !== 'ready',
    recoveryActions: mockArSessionStatus === 'ready' ? [] : ['disable-ar'],
  }),
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => false,
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
  useSettingsStore: <T,>(selector: (state: { setStellariumSetting: (key: string, value: unknown) => void }) => T): T =>
    selector({
      setStellariumSetting: (key: string, value: unknown) => {
        if (key === 'arMode') {
          mockSetArMode(key, value);
        }
      },
    }),
  useOnboardingBridgeStore: <T,>(selector: (state: {
    openSettingsDrawer: () => void;
    settingsDrawerOpen: boolean;
    closeTransientPanels: () => void;
  }) => T): T =>
    selector({
      openSettingsDrawer: jest.fn(),
      settingsDrawerOpen: false,
      closeTransientPanels: jest.fn(),
    }),
  usePlanningUiStore: <T,>(selector: (state: {
    sessionPlannerOpen: boolean;
    openSessionPlanner: () => void;
    setSessionPlannerOpen: (open: boolean) => void;
  }) => T): T =>
    selector({
      sessionPlannerOpen: false,
      openSessionPlanner: jest.fn(),
      setSessionPlannerOpen: jest.fn(),
    }),
  useStarmapMobileUiStore: <T,>(selector: (state: {
    activePanel: null;
    setMobileShell: (mobile: boolean) => void;
    openPanel: (panel: string) => void;
    closePanelIfActive: (panel: string) => void;
    resetPanelFlow: () => void;
  }) => T): T =>
    selector({
      activePanel: null,
      setMobileShell: jest.fn(),
      openPanel: jest.fn(),
      closePanelIfActive: jest.fn(),
      resetPanelFlow: jest.fn(),
    }),
}));

jest.mock('@/components/starmap/view/use-stellarium-view-state', () => ({
  useStellariumViewState: () => ({
    isSearchOpen: false,
    setIsSearchOpen: jest.fn(),
    selectedObject: null,
    setSelectedObject: jest.fn(),
    currentFov: 45,
    showSessionPanel: false,
    setShowSessionPanel: jest.fn(),
    contextMenuCoords: null,
    clickPosition: null,
    containerBounds: null,
    contextMenuOpen: false,
    setContextMenuOpen: jest.fn(),
    contextMenuPosition: null,
    goToDialogOpen: false,
    setGoToDialogOpen: jest.fn(),
    detailDrawerOpen: false,
    setDetailDrawerOpen: jest.fn(),
    closeConfirmDialogOpen: false,
    setCloseConfirmDialogOpen: jest.fn(),
    viewCenterRaDec: null,
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
    handleGoToCoordinates: jest.fn(),
    openGoToDialog: jest.fn(),
    handleCloseStarmapClick: jest.fn(),
    handleConfirmClose: jest.fn(),
    toggleSearch: jest.fn(),
    handleNavigate: jest.fn(),
    handleMarkerEdit: jest.fn(),
    handleMarkerNavigate: jest.fn(),
  }),
}));

describe('StellariumView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useARRuntimeStore.getState().resetRecoveryState();
    mockArMode = true;
    mockArSessionStatus = 'blocked';
    mockArLayoutTier = 'phone-compact';
    mockArRuntimeClass = 'browser-mobile';
    mockSensorPath = 'sensor-primary';
  });

  it('exports the component correctly', async () => {
    const viewModule = await import('../stellarium-view');
    expect(viewModule.StellariumView).toBeDefined();
  });

  it('renders AR recovery panel when AR is not ready', async () => {
    const viewModule = await import('../stellarium-view');
    render(<viewModule.StellariumView />);
    expect(screen.getByTestId('ar-recovery-panel')).toBeInTheDocument();
  });

  it('renders AR launch assistant when launch flow is open', async () => {
    useARRuntimeStore.setState((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        visible: true,
      },
    }));

    const viewModule = await import('../stellarium-view');
    render(<viewModule.StellariumView />);
    expect(screen.getByTestId('ar-launch-assistant')).toBeInTheDocument();
  });

  it('dispatches disable action from AR recovery panel', async () => {
    const viewModule = await import('../stellarium-view');
    render(<viewModule.StellariumView />);
    fireEvent.click(screen.getByTestId('ar-recovery-action-disable-ar'));
    expect(mockSetArMode).toHaveBeenCalledWith('arMode', false);
  });

  it('exposes AR adaptation metadata from the main view container', async () => {
    mockSensorPath = 'camera-primary';
    mockArRuntimeClass = 'tauri-desktop';

    const viewModule = await import('../stellarium-view');
    render(<viewModule.StellariumView />);

    expect(screen.getByTestId('stellarium-view-root')).toHaveAttribute('data-ar-layout-tier', 'phone-compact');
    expect(screen.getByTestId('stellarium-view-root')).toHaveAttribute('data-ar-runtime-class', 'tauri-desktop');
    expect(screen.getByTestId('stellarium-view-root')).toHaveAttribute('data-ar-sensor-path', 'camera-primary');
  });
});
