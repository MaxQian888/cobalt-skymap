/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MobileLayout } from '../mobile-layout';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/ui/drawer', () => ({
  ...(() => {
    const ReactLib = jest.requireActual<typeof import('react')>('react');
    const OpenContext = ReactLib.createContext(false);
    return {
      Drawer: ({
        children,
        open,
      }: {
        children: React.ReactNode;
        open?: boolean;
      }) => <OpenContext.Provider value={Boolean(open)}>{children}</OpenContext.Provider>,
      DrawerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      DrawerContent: ({ children }: { children: React.ReactNode }) => {
        const isOpen = ReactLib.useContext(OpenContext);
        return isOpen ? <div data-testid="more-drawer">{children}</div> : null;
      },
      DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      DrawerTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    };
  })(),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/common/toolbar-button', () => ({
  ToolbarSeparator: () => <div data-testid="toolbar-separator" />,
}));

jest.mock('@/lib/core/selection-utils', () => ({
  buildSelectionData: () => ({ currentSelection: null, observationSelection: null }),
}));

const mockSetFovSimEnabled = jest.fn();
const mockSetSensorWidth = jest.fn();
const mockSetSensorHeight = jest.fn();
const mockSetFocalLength = jest.fn();
const mockSetMosaic = jest.fn();
const mockSetGridType = jest.fn();

jest.mock('@/lib/hooks/use-equipment-fov-props', () => ({
  useEquipmentFOVProps: () => ({
    fovSimEnabled: false,
    setFovSimEnabled: mockSetFovSimEnabled,
    sensorWidth: 36,
    setSensorWidth: mockSetSensorWidth,
    sensorHeight: 24,
    setSensorHeight: mockSetSensorHeight,
    focalLength: 600,
    pixelSize: 3.76,
    rotationAngle: 0,
    setFocalLength: mockSetFocalLength,
    setPixelSize: jest.fn(),
    mosaic: { enabled: false },
    setMosaic: mockSetMosaic,
    gridType: 'rule-of-thirds',
    setGridType: mockSetGridType,
    setRotationAngle: jest.fn(),
  }),
}));

const mockSettingsState = {
  mobileFeaturePreferences: {
    compactBottomBar: true,
    oneHandMode: false,
    prioritizedTools: ['markers', 'location', 'fov', 'shotlist', 'tonight', 'daily-knowledge'],
  },
};

const mockOnboardingState = {
  openMobileDrawerRequestId: 0,
  mobileDrawerSection: null as string | null,
};

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: { aperture: number; pixelSize: number }) => unknown) =>
    selector({ aperture: 80, pixelSize: 3.76 }),
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
  useOnboardingBridgeStore: (selector: (state: typeof mockOnboardingState) => unknown) =>
    selector(mockOnboardingState),
}));

jest.mock('@/components/starmap/controls/zoom-controls', () => ({
  ZoomControls: () => <button data-testid="zoom-controls">zoom</button>,
}));

function createToolButton(id: string) {
  const ToolButton = () => <button data-testid={`tool-${id}`}>{id}</button>;
  ToolButton.displayName = `ToolButton(${id})`;
  return ToolButton;
}

jest.mock('@/components/starmap/management/marker-manager', () => ({
  MarkerManager: createToolButton('markers'),
}));

jest.mock('@/components/starmap/management/location-manager', () => ({
  LocationManager: ({ trigger }: { trigger: React.ReactNode }) => <div>{trigger}</div>,
}));

jest.mock('@/components/starmap/overlays/fov-simulator', () => ({
  FOVSimulator: createToolButton('fov'),
}));

jest.mock('@/components/starmap/planning/exposure-calculator', () => ({
  ExposureCalculator: createToolButton('exposure'),
}));

jest.mock('@/components/starmap/planning/shot-list', () => ({
  ShotList: createToolButton('shotlist'),
}));

jest.mock('@/components/starmap/planning/observation-log', () => ({
  ObservationLog: createToolButton('observation-log'),
}));

jest.mock('@/components/starmap/planning/tonight-recommendations', () => ({
  TonightRecommendations: createToolButton('tonight'),
}));

jest.mock('@/components/starmap/planning/session-planner', () => ({
  SessionPlannerButton: createToolButton('session-planner'),
}));

jest.mock('@/components/starmap/planning/astro-events-calendar', () => ({
  AstroEventsCalendar: createToolButton('astro-events'),
}));

jest.mock('@/components/starmap/planning/astro-calculator-dialog', () => ({
  AstroCalculatorDialog: createToolButton('astro-calculator'),
}));

jest.mock('@/components/starmap/mount/stellarium-mount', () => ({
  StellariumMount: createToolButton('mount'),
}));

jest.mock('@/components/starmap/plate-solving/plate-solver-unified', () => ({
  PlateSolverUnified: createToolButton('plate-solver'),
}));

jest.mock('@/components/starmap/planning/sky-atlas-panel', () => ({
  SkyAtlasPanel: createToolButton('sky-atlas'),
}));

jest.mock('@/components/starmap/management/equipment-manager', () => ({
  EquipmentManager: createToolButton('equipment-manager'),
}));

jest.mock('@/components/starmap/management/offline-cache-manager', () => ({
  OfflineCacheManager: createToolButton('offline-cache'),
}));

jest.mock('@/components/starmap/overlays/ocular-simulator', () => ({
  OcularSimulator: createToolButton('ocular'),
}));

jest.mock('@/components/starmap/knowledge/daily-knowledge-button', () => ({
  DailyKnowledgeButton: createToolButton('daily-knowledge'),
}));

const defaultProps = {
  currentFov: 45,
  selectedObject: null,
  contextMenuCoords: null,
  activeMobilePanel: null as 'search' | 'details' | 'planning' | 'settings' | null,
  onZoomIn: jest.fn(),
  onZoomOut: jest.fn(),
  onFovSliderChange: jest.fn(),
  onLocationChange: jest.fn(),
  onGoToCoordinates: jest.fn(),
  onOpenSearch: jest.fn(),
  onOpenDetails: jest.fn(),
  onOpenSessionPlanner: jest.fn(),
  onOpenSettings: jest.fn(),
};

describe('MobileLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsState.mobileFeaturePreferences = {
      compactBottomBar: true,
      oneHandMode: false,
      prioritizedTools: ['markers', 'location', 'fov', 'shotlist', 'tonight', 'daily-knowledge'],
    };
    mockOnboardingState.openMobileDrawerRequestId = 0;
    mockOnboardingState.mobileDrawerSection = null;
  });

  it('renders compact mode with prioritized tools and more entry', () => {
    const { container } = render(<MobileLayout {...defaultProps} />);
    const mobileBottomBar = container.querySelector('.mobile-bottom-bar');
    expect(mobileBottomBar).not.toBeNull();
    expect(screen.getByTestId('mobile-action-rail')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-tools-bar')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-zoom-cluster')).toBeInTheDocument();

    const bottomBar = mobileBottomBar as HTMLElement;
    expect(within(bottomBar).getByTestId('tool-markers')).toBeInTheDocument();
    expect(within(bottomBar).queryByTestId('tool-equipment-manager')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mobileToolbar.more' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'starmap.searchObjects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'settings.allSettings' })).toBeInTheDocument();
  });

  it('renders full tool set when compact mode is disabled', () => {
    mockSettingsState.mobileFeaturePreferences.compactBottomBar = false;

    const { container } = render(<MobileLayout {...defaultProps} />);
    const mobileBottomBar = container.querySelector('.mobile-bottom-bar');
    expect(mobileBottomBar).not.toBeNull();

    const bottomBar = mobileBottomBar as HTMLElement;
    expect(within(bottomBar).getByTestId('tool-equipment-manager')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'mobileToolbar.more' })).not.toBeInTheDocument();
  });

  it('applies one-hand mode layout class', () => {
    mockSettingsState.mobileFeaturePreferences.oneHandMode = true;
    const { container } = render(<MobileLayout {...defaultProps} />);

    const oneHandBar = container.querySelector('.one-hand-bottom-bar');
    expect(oneHandBar).toBeInTheDocument();
    expect(screen.getByTestId('mobile-bottom-tools-bar')).toHaveStyle({
      right: 'calc(0.5rem + var(--safe-area-right))',
    });
    expect(screen.getByTestId('mobile-zoom-cluster')).toHaveStyle({
      bottom: 'calc(8.5rem + var(--safe-area-bottom))',
    });
  });

  it('reserves right-side clearance for zoom controls in default mode', () => {
    render(<MobileLayout {...defaultProps} />);

    expect(screen.getByTestId('mobile-bottom-tools-bar')).toHaveStyle({
      right: 'calc(4rem + var(--safe-area-right))',
    });
    expect(screen.getByTestId('mobile-zoom-cluster')).toHaveStyle({
      bottom: 'calc(3.75rem + var(--safe-area-bottom))',
    });
  });

  it('calls core action callbacks from rail buttons', () => {
    const onOpenSearch = jest.fn();
    const onOpenSessionPlanner = jest.fn();
    const onOpenSettings = jest.fn();

    render(
      <MobileLayout
        {...defaultProps}
        onOpenSearch={onOpenSearch}
        onOpenSessionPlanner={onOpenSessionPlanner}
        onOpenSettings={onOpenSettings}
      />
    );

    screen.getByRole('button', { name: 'starmap.searchObjects' }).click();
    screen.getByRole('button', { name: 'sessionPlanner.title' }).click();
    screen.getByRole('button', { name: 'settings.allSettings' }).click();

    expect(onOpenSearch).toHaveBeenCalledTimes(1);
    expect(onOpenSessionPlanner).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('hides floating bottom controls when a mobile panel is active', () => {
    render(
      <MobileLayout
        {...defaultProps}
        activeMobilePanel="search"
      />
    );

    expect(screen.getByTestId('mobile-action-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-bottom-tools-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-zoom-cluster')).not.toBeInTheDocument();
  });
});
