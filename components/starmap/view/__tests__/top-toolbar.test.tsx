/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((selector) => {
    const state = { stel: null, activeEngine: 'stellarium', engineReady: false };
    return selector(state);
  }),
  useSettingsStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        preferences: { mobilePrioritizedTools: [] },
        display: {},
        skyEngine: 'stellarium',
        setSkyEngine: jest.fn(),
        mobileFeaturePreferences: { prioritizedTools: [] },
      };
      return selector(state);
    }),
    { getState: jest.fn(() => ({ preferences: { mobilePrioritizedTools: [] }, display: {}, mobileFeaturePreferences: { prioritizedTools: [] } })) }
  ),
  useMountStore: jest.fn((selector) => {
    const state = { isConnected: false };
    return selector(state);
  }),
  useOnboardingBridgeStore: jest.fn((selector) => {
    const state = { openDailyKnowledgeRequestId: 0 };
    return selector(state);
  }),
}));
jest.mock('@/lib/constants/mobile-tools', () => ({
  DEFAULT_MOBILE_PRIORITIZED_TOOLS: [],
  sortByMobileToolPriority: jest.fn((items: unknown[]) => items),
}));
jest.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }: React.PropsWithChildren) => <button {...props}>{children}</button> }));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
const mockIsTauri = jest.fn(() => false);
const mockToggleMaximizeWindow = jest.fn();
const mockStartWindowDragging = jest.fn();
const mockUseWindowControls = jest.fn(() => ({
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
  handleMaximize: jest.fn(),
  handleStartWindowDrag: mockStartWindowDragging,
}));
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri(),
  quitApp: jest.fn(),
  toggleMaximizeWindow: () => mockToggleMaximizeWindow(),
  startWindowDragging: () => mockStartWindowDragging(),
}));
jest.mock('@/lib/hooks/use-window-controls', () => ({
  useWindowControls: () => mockUseWindowControls(),
}));
jest.mock('@/components/common/toolbar-button', () => ({
  ToolbarButton: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  ToolbarGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/common/language-switcher', () => ({ LanguageSwitcher: () => null }));
jest.mock('@/components/common/theme-toggle', () => ({ ThemeToggle: () => null }));
jest.mock('@/components/common/night-mode-toggle', () => ({ NightModeToggle: () => null }));
jest.mock('@/components/common/sensor-control-toggle', () => ({ SensorControlToggle: () => null }));
jest.mock('@/components/common/app-control-menu', () => ({ AppControlMenu: () => null }));
jest.mock('@/components/common/ar-mode-toggle', () => ({ ARModeToggle: () => null }));
jest.mock('@/components/starmap/time/stellarium-clock', () => ({ StellariumClock: () => null }));
jest.mock('@/components/starmap/settings/stellarium-settings', () => ({ StellariumSettings: () => null }));
jest.mock('@/components/starmap/management/unified-settings', () => ({ UnifiedSettings: () => null }));
jest.mock('@/components/starmap/management/offline-cache-manager', () => ({ OfflineCacheManager: () => null }));
jest.mock('@/components/starmap/planning/tonight-recommendations', () => ({ TonightRecommendations: () => null }));
jest.mock('@/components/starmap/planning/sky-atlas-panel', () => ({ SkyAtlasPanel: () => null }));
jest.mock('@/components/starmap/planning/astro-events-calendar', () => ({ AstroEventsCalendar: () => null }));
jest.mock('@/components/starmap/planning/astro-calculator-dialog', () => ({ AstroCalculatorDialog: () => null }));
jest.mock('@/components/starmap/planning/session-planner', () => ({ SessionPlannerButton: () => null }));
jest.mock('@/components/starmap/overlays/satellite-tracker', () => ({ SatelliteTracker: () => null }));
jest.mock('@/components/starmap/overlays/ocular-simulator', () => ({ OcularSimulator: () => null }));
jest.mock('@/components/starmap/plate-solving/plate-solver-unified', () => ({ PlateSolverUnified: () => null }));
jest.mock('@/components/starmap/management/equipment-manager', () => ({ EquipmentManager: () => null }));
jest.mock('@/components/starmap/dialogs/keyboard-shortcuts-dialog', () => ({ KeyboardShortcutsDialog: () => null }));
jest.mock('@/components/starmap/dialogs/about-dialog', () => ({ AboutDialog: () => null }));
jest.mock('@/components/starmap/controls/quick-actions-panel', () => ({ QuickActionsPanel: () => null }));
jest.mock('@/components/starmap/controls/navigation-history', () => ({ NavigationHistory: () => null }));
jest.mock('@/components/starmap/controls/view-bookmarks', () => ({ ViewBookmarks: () => null }));
jest.mock('@/components/starmap/objects/object-type-legend', () => ({ ObjectTypeLegend: () => null }));
jest.mock('@/components/starmap/knowledge/daily-knowledge-button', () => ({ DailyKnowledgeButton: () => null }));

import { TopToolbar } from '../top-toolbar';

const defaultProps = {
  stel: false,
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
    mockUseWindowControls.mockReturnValue({
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
      handleMaximize: jest.fn(),
      handleStartWindowDrag: mockStartWindowDragging,
    });
  });

  it('renders without crashing', () => {
    render(<TopToolbar {...defaultProps} />);
  });

  it('renders search button', () => {
    const { container } = render(<TopToolbar {...defaultProps} />);
    const searchBtn = container.querySelector('[data-tour-id="search-button"]');
    expect(searchBtn).toBeInTheDocument();
  });

  it('calls onToggleSearch when search button is clicked', () => {
    const onToggleSearch = jest.fn();
    const { container } = render(<TopToolbar {...defaultProps} onToggleSearch={onToggleSearch} />);
    const searchBtn = container.querySelector('[data-tour-id="search-button"]') as HTMLElement;
    fireEvent.click(searchBtn);
    expect(onToggleSearch).toHaveBeenCalled();
  });

  it('renders with stel=true without crashing', () => {
    render(<TopToolbar {...defaultProps} stel={true} />);
  });

  it('renders with isSearchOpen=true without crashing', () => {
    render(<TopToolbar {...defaultProps} isSearchOpen={true} />);
  });

  it('renders with showSessionPanel=true without crashing', () => {
    render(<TopToolbar {...defaultProps} showSessionPanel={true} />);
  });

  it('renders explicit drag handles instead of a full-width drag overlay', () => {
    mockIsTauri.mockReturnValue(true);
    mockUseWindowControls.mockReturnValue({
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
      handleMaximize: jest.fn(),
      handleStartWindowDrag: mockStartWindowDragging,
    });

    const { container } = render(<TopToolbar {...defaultProps} />);

    expect(container.querySelector('[data-testid="window-drag-handle"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tauri-drag-region]')).not.toBeInTheDocument();
  });
});
