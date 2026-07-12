'use client';

import { memo, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, Menu, RotateCcw, PanelLeftClose, PanelLeft, LogOut, Compass, Power } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

import { ToolbarButton, ToolbarGroup, TOOLBAR_ICON_TOGGLE_CLASS } from '@/components/common/toolbar-button';
import { StatusToggleButton } from '@/components/common/status-toggle-button';
import { TopToolbarOverflowMenu } from './top-toolbar-overflow-menu';
import { useToolbarOverflow, type ToolbarOverflowGroup } from '@/lib/hooks/use-toolbar-overflow';
import { LanguageSwitcher } from '@/components/common/language-switcher';
import { ThemeToggle } from '@/components/common/theme-toggle';
import { NightModeToggle } from '@/components/common/night-mode-toggle';
import { SensorControlToggle } from '@/components/common/sensor-control-toggle';
import { ARModeToggle } from '@/components/common/ar-mode-toggle';
import { AppControlMenu } from '@/components/common/app-control-menu';

import { StellariumClock } from '../time/stellarium-clock';
import { StellariumSettings } from '../settings/stellarium-settings';
import { UnifiedSettings } from '../management/unified-settings';
import { OfflineCacheManager } from '../management/offline-cache-manager';
import { TonightRecommendations } from '../planning/tonight-recommendations';
import { SkyAtlasPanel } from '../planning/sky-atlas-panel';
import { AstroEventsCalendar } from '../planning/astro-events-calendar';
import { AstroCalculatorDialog } from '../planning/astro-calculator-dialog';
import { SessionPlannerButton } from '../planning/session-planner';
import { SatelliteTracker } from '../overlays/satellite-tracker';
import { OcularSimulator } from '../overlays/ocular-simulator';
import { PlateSolverUnified } from '../plate-solving/plate-solver-unified';
import { EquipmentManager } from '../management/equipment-manager';
import { KeyboardShortcutsDialog } from '../dialogs/keyboard-shortcuts-dialog';
import { AboutDialog } from '../dialogs/about-dialog';
import { QuickActionsPanel } from '../controls/quick-actions-panel';
import { NavigationHistory } from '../controls/navigation-history';
import { ViewBookmarks } from '../controls/view-bookmarks';
import { ObjectTypeLegend } from '../objects/object-type-legend';
import { DailyKnowledgeButton } from '../knowledge/daily-knowledge-button';

import { isTauri, quitApp } from '@/lib/tauri/app-control-api';
import { useWindowControls } from '@/lib/hooks/use-window-controls';
import { useOnboardingBridgeStore, useSettingsStore, useStellariumStore } from '@/lib/stores';
import {
  DEFAULT_MOBILE_PRIORITIZED_TOOLS,
  sortByMobileToolPriority,
} from '@/lib/constants/mobile-tools';
import type { TopToolbarProps } from '@/types/starmap/view';

// Toolbar groups that fold into the "More" overflow menu when the row would
// otherwise clip. Lower priority folds first: the right-cluster secondary tools
// (Preferences → Display → Instruments → Planning) collapse before the left
// cluster (Navigation → Discovery), so the headline "what to observe" entries
// stay inline longest. Search / Config / View-Help / Window are never folded.
// Stable module-level reference so it can be a useToolbarOverflow dependency.
const TOOLBAR_FOLDABLE_GROUPS: ToolbarOverflowGroup[] = [
  { id: 'preferences', priority: 1 },
  { id: 'display', priority: 2 },
  { id: 'instruments', priority: 3 },
  { id: 'planning', priority: 4 },
  { id: 'navigation', priority: 5 },
  { id: 'discovery', priority: 6 },
];

export const TopToolbar = memo(function TopToolbar({
  stel,
  isMobileShell,
  isSearchOpen,
  showSessionPanel,
  viewCenterRaDec,
  currentFov,
  onToggleSearch,
  onToggleSessionPanel,
  onResetView,
  onCloseStarmapClick,
  onSetFov,
  onNavigate,
  onGoToCoordinates,
  onSelectObject,
}: TopToolbarProps) {
  const t = useTranslations();
  const { isTauriEnv, shell, handleMaximize, handleStartWindowDrag } = useWindowControls();
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const openSearchRequestId = useOnboardingBridgeStore((state) => state.openSearchRequestId);
  const toggleSearchRequestId = useOnboardingBridgeStore((state) => state.toggleSearchRequestId);
  const toggleSessionPanelRequestId = useOnboardingBridgeStore((state) => state.toggleSessionPanelRequestId);
  const closeTransientPanelsRequestId = useOnboardingBridgeStore((state) => state.closeTransientPanelsRequestId);
  const openToolbarOverflowRequestId = useOnboardingBridgeStore((state) => state.openToolbarOverflowRequestId);
  const closeToolbarOverflowRequestId = useOnboardingBridgeStore((state) => state.closeToolbarOverflowRequestId);
  const handledSearchRequestRef = useRef(0);
  const handledToggleSearchRequestRef = useRef(0);
  const handledToggleSessionPanelRef = useRef(0);
  const handledCloseTransientRef = useRef(0);
  const handledOverflowOpenRef = useRef(0);
  const handledOverflowCloseRef = useRef(0);

  // Desktop top-bar priority+ overflow: fold the lowest-priority right-cluster
  // groups into a "More" popover when the justify-between row would clip.
  const toolbarRowRef = useRef<HTMLDivElement | null>(null);
  const { overflowIds, registerGroup } = useToolbarOverflow(
    toolbarRowRef,
    TOOLBAR_FOLDABLE_GROUPS,
    { enabled: !isMobileShell },
  );
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);

  useEffect(() => {
    if (
      openSearchRequestId > 0 &&
      openSearchRequestId !== handledSearchRequestRef.current
    ) {
      handledSearchRequestRef.current = openSearchRequestId;
      if (!isSearchOpen) {
        onToggleSearch();
      }
    }
  }, [isSearchOpen, onToggleSearch, openSearchRequestId]);

  useEffect(() => {
    if (
      toggleSearchRequestId > 0 &&
      toggleSearchRequestId !== handledToggleSearchRequestRef.current
    ) {
      handledToggleSearchRequestRef.current = toggleSearchRequestId;
      onToggleSearch();
    }
  }, [onToggleSearch, toggleSearchRequestId]);

  useEffect(() => {
    if (
      toggleSessionPanelRequestId > 0 &&
      toggleSessionPanelRequestId !== handledToggleSessionPanelRef.current
    ) {
      handledToggleSessionPanelRef.current = toggleSessionPanelRequestId;
      onToggleSessionPanel();
    }
  }, [onToggleSessionPanel, toggleSessionPanelRequestId]);

  useEffect(() => {
    if (
      closeTransientPanelsRequestId > 0 &&
      closeTransientPanelsRequestId !== handledCloseTransientRef.current
    ) {
      handledCloseTransientRef.current = closeTransientPanelsRequestId;
      if (isSearchOpen) {
        onToggleSearch();
      }
    }
  }, [closeTransientPanelsRequestId, isSearchOpen, onToggleSearch]);

  // Onboarding tour: reveal a folded toolbar group by opening the "More" menu.
  // Setting open is safe even when nothing is folded — the menu only mounts when
  // overflowIds is non-empty, so it has no effect until a group actually folds.
  useEffect(() => {
    if (
      openToolbarOverflowRequestId > 0 &&
      openToolbarOverflowRequestId !== handledOverflowOpenRef.current
    ) {
      handledOverflowOpenRef.current = openToolbarOverflowRequestId;
      const timer = window.setTimeout(() => setOverflowMenuOpen(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [openToolbarOverflowRequestId]);

  useEffect(() => {
    if (
      closeToolbarOverflowRequestId > 0 &&
      closeToolbarOverflowRequestId !== handledOverflowCloseRef.current
    ) {
      handledOverflowCloseRef.current = closeToolbarOverflowRequestId;
      const timer = window.setTimeout(() => setOverflowMenuOpen(false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [closeToolbarOverflowRequestId]);

  const shellHorizontalPadding = isTauriEnv
    ? {
        paddingLeft: `calc(${shell.titlebarInsets.left}px + 0.5rem)`,
        paddingRight: `calc(${shell.titlebarInsets.right}px + 0.5rem)`,
      }
    : undefined;

  // Foldable desktop right-cluster groups (rendered inline OR inside the "More"
  // overflow popover, per useToolbarOverflow). Config / View-Help / Window stay
  // inline. Each node is rendered in exactly one place at a time.
  const planningGroup = (
    <ToolbarGroup gap="none" className="p-0.5">
      <div data-tour-id="session-planner">
        <SessionPlannerButton />
      </div>
      <div data-tour-id="astro-events">
        <AstroEventsCalendar />
      </div>
      <div data-tour-id="astro-calculator">
        <AstroCalculatorDialog />
      </div>
    </ToolbarGroup>
  );
  const instrumentsGroup = (
    <ToolbarGroup gap="none" className="p-0.5">
      <div data-tour-id="plate-solver">
        <PlateSolverUnified onGoToCoordinates={onGoToCoordinates} onSelectObject={onSelectObject} />
      </div>
      <div data-tour-id="ocular">
        <OcularSimulator onApplyFov={onSetFov} currentFov={currentFov} />
      </div>
      <div data-tour-id="satellite">
        <SatelliteTracker />
      </div>
    </ToolbarGroup>
  );
  const displayGroup = (
    <ToolbarGroup gap="none" className="p-0.5">
      <div data-tour-id="night-mode">
        <NightModeToggle />
      </div>
      <SensorControlToggle />
      <ARModeToggle />
      <ObjectTypeLegend variant="popover" />
    </ToolbarGroup>
  );
  const preferencesGroup = (
    <ToolbarGroup gap="none" className="p-0.5">
      <div data-tour-id="theme">
        <ThemeToggle variant="icon" className="h-9 w-9" />
      </div>
      <div data-tour-id="language">
        <LanguageSwitcher className={TOOLBAR_ICON_TOGGLE_CLASS} />
      </div>
    </ToolbarGroup>
  );
  // Left-cluster foldable groups — "what to observe" discovery + view navigation.
  // Folded last (highest priority), so they stay inline until the right cluster
  // is exhausted. Tour anchors stay mounted whether inline or inside the menu.
  const discoveryGroup = (
    <ToolbarGroup gap="none" className="p-0.5" data-tour-id="tonight-button">
      <div data-tour-id="tonight">
        <TonightRecommendations />
      </div>
      <div data-tour-id="daily-knowledge">
        <DailyKnowledgeButton />
      </div>
      <div data-tour-id="sky-atlas">
        <SkyAtlasPanel />
      </div>
    </ToolbarGroup>
  );
  const navigationGroup = (
    <ToolbarGroup gap="none" className="p-0.5">
      <div data-tour-id="quick-actions">
        <QuickActionsPanel onZoomToFov={onSetFov} onResetView={onResetView} />
      </div>
      <div data-tour-id="navigation-history">
        <NavigationHistory onNavigate={onNavigate} />
      </div>
      <div data-tour-id="view-bookmarks">
        <ViewBookmarks
          currentRa={viewCenterRaDec.ra}
          currentDec={viewCenterRaDec.dec}
          currentFov={currentFov}
          onNavigate={onNavigate}
        />
      </div>
    </ToolbarGroup>
  );
  const foldableNodes: Record<string, ReactNode> = {
    discovery: discoveryGroup,
    navigation: navigationGroup,
    planning: planningGroup,
    instruments: instrumentsGroup,
    display: displayGroup,
    preferences: preferencesGroup,
  };
  const renderInline = (id: string) =>
    overflowIds.has(id) ? null : (
      <div ref={registerGroup(id)} className="flex">
        {foldableNodes[id]}
      </div>
    );

  return (
    <div
      className="absolute top-0 left-0 right-0 z-30 pointer-events-none safe-area-top animate-fade-in"
      style={{ paddingLeft: 'var(--safe-area-left)', paddingRight: 'var(--safe-area-right)' }}
    >
      {isTauriEnv && shell.supportsManualDragging && (
        <WindowDragHandle
          onStartDrag={handleStartWindowDrag}
          onToggleMaximize={shell.supportsDoubleClickMaximize ? handleMaximize : undefined}
        />
      )}

      <div
        ref={toolbarRowRef}
        data-starmap-ui-control="true"
        className="relative p-2 sm:p-3 flex items-center justify-between"
        style={{ zIndex: 1, ...shellHorizontalPadding }}
      >
        {/* Left: Menu, Search, Discovery & Navigation */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Mobile-shell entry points: drawer + sensor/AR. Mounted ONLY in the
              mobile shell so the stateful sensor/AR toggles never coexist with
              their desktop twins (which would run a second orientation rAF loop). */}
          {isMobileShell && (
            <>
              <MobileMenuDrawer stel={stel} onSetFov={onSetFov} currentFov={currentFov} />
              <div className="flex items-center gap-1">
                <SensorControlToggle />
                <ARModeToggle />
              </div>
            </>
          )}

          {/* Search Button */}
          <div data-tour-id="search">
            <StatusToggleButton
              data-tour-id="search-button"
              data-testid="search-toggle-button"
              icon={isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              label={t('starmap.searchObjects')}
              active={isSearchOpen}
              onClick={onToggleSearch}
            />
          </div>

          {/* Discovery ("what to observe") + Navigation ("where to look") groups —
              desktop shell only. Foldable: they collapse into the "More" popover
              after the right cluster is exhausted, so the narrow-desktop row
              (~900–1100px) never clips. */}
          {!isMobileShell && (
          <div className="flex items-center gap-1.5">
            {renderInline('discovery')}
            {renderInline('navigation')}
          </div>
          )}
        </div>

        {/* Center: Time Display — desktop shell only (mobile shows it in the drawer).
            Intentionally NOT flex-shrinkable: a shrink guard here engages on the
            first pixel of overflow (immediately), pre-empting the rAF-measured
            priority+ fold so groups would stop collapsing and the clock would
            squeeze instead. The group fold (incl. the Tauri-inset case) is the
            backstop; the clock must keep its natural width to drive that fold. */}
        {!isMobileShell && (
          <div className="pointer-events-auto animate-fade-in">
            {(stel || skyEngine === 'aladin') && <StellariumClock />}
          </div>
        )}

        {/* Right: Planning → Instruments → Config → Display → Preferences → View/Help → Window */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Desktop Toolbar Groups — desktop shell only. Foldable groups
              (Planning/Instruments/Display/Preferences) collapse into the "More"
              overflow popover, lowest-priority first, when the row would clip.
              Visual order: Planning · Instruments · Config · Display · Preferences · More. */}
          {!isMobileShell && (
          <div className="flex items-center gap-1.5">
            {renderInline('planning')}
            {renderInline('instruments')}

            {/* Configuration Group — never folded */}
            <ToolbarGroup gap="none" className="p-0.5" data-tour-id="settings-button">
              <div data-tour-id="settings">
                <UnifiedSettings />
              </div>
              <div data-tour-id="equipment-manager">
                <EquipmentManager />
              </div>
            </ToolbarGroup>

            {renderInline('display')}
            {renderInline('preferences')}

            {overflowIds.size > 0 && (
              <TopToolbarOverflowMenu open={overflowMenuOpen} onOpenChange={setOverflowMenuOpen}>
                {TOOLBAR_FOLDABLE_GROUPS
                  .filter((group) => overflowIds.has(group.id))
                  .sort((a, b) => b.priority - a.priority)
                  .map((group) => (
                    <div key={group.id} data-overflow-group={group.id}>
                      {foldableNodes[group.id]}
                    </div>
                  ))}
              </TopToolbarOverflowMenu>
            )}
          </div>
          )}

          {/* View & Help Group (always visible) */}
          <ToolbarGroup gap="none" className="p-0.5">
            <ToolbarButton
              icon={showSessionPanel ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              label={showSessionPanel ? t('starmap.hideSessionInfo') : t('starmap.showSessionInfo')}
              iconOnly
              isActive={showSessionPanel}
              onClick={onToggleSessionPanel}
            />
            <ToolbarButton
              icon={<RotateCcw className="h-4 w-4" />}
              label={t('starmap.resetView')}
              iconOnly
              onClick={onResetView}
            />
            {/* Shortcuts/About live in the MobileMenuDrawer on the mobile shell;
                hiding the duplicates keeps the ≤360px top row from clipping. */}
            {!isMobileShell && (
              <>
                <div data-tour-id="keyboard-shortcuts">
                  <KeyboardShortcutsDialog />
                </div>
                <div data-tour-id="about">
                  <AboutDialog />
                </div>
              </>
            )}
          </ToolbarGroup>

          {/* Window Controls Group */}
          <ToolbarGroup gap="none" className="p-0.5">
            <ToolbarButton
              icon={<LogOut className="h-4 w-4" />}
              label={t('starmap.closeStarmap')}
              iconOnly
              className="hover:text-destructive hover:bg-destructive/10"
              onClick={onCloseStarmapClick}
            />
            {!isMobileShell && (
              <div className="flex">
                <AppControlMenu variant="inline" />
              </div>
            )}
          </ToolbarGroup>
        </div>
      </div>
    </div>
  );
});
TopToolbar.displayName = 'TopToolbar';

interface WindowDragHandleProps {
  onStartDrag: () => Promise<void>;
  onToggleMaximize?: () => Promise<void>;
}

function WindowDragHandle({ onStartDrag, onToggleMaximize }: WindowDragHandleProps) {
  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    void onStartDrag();
  };

  const handleDoubleClick = () => {
    if (!onToggleMaximize) return;
    void onToggleMaximize();
  };

  // Full-bar drag region: spans the whole top toolbar so any empty space moves
  // the frameless window (double-click maximizes), matching native title-bar UX.
  // It sits beneath the toolbar row (which carries `zIndex: 1`), so the
  // pointer-events-auto button clusters still receive their own clicks while the
  // pointer-events-none gaps fall through to this layer.
  return (
    <div
      data-testid="window-drag-handle"
      aria-hidden="true"
      className="pointer-events-auto absolute inset-0"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Subtle centered grip as a discoverability hint. */}
      <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/15" />
    </div>
  );
}

// Mobile Menu Drawer Sub-component - memoized
const MobileMenuDrawer = memo(function MobileMenuDrawer({
  stel,
  onSetFov,
  currentFov,
}: {
  stel: boolean;
  onSetFov: (fov: number) => void;
  currentFov: number;
}) {
  const t = useTranslations();
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const prioritizedTools = useSettingsStore(
    (state) => state.mobileFeaturePreferences.prioritizedTools ?? DEFAULT_MOBILE_PRIORITIZED_TOOLS,
  );
  const setSkyEngine = useSettingsStore((state) => state.setSkyEngine);
  const aladinDisplay = useSettingsStore((state) => state.aladinDisplay);
  const toggleAladinDisplaySetting = useSettingsStore((state) => state.toggleAladinDisplaySetting);
  const setAladinDisplaySetting = useSettingsStore((state) => state.setAladinDisplaySetting);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const openMobileDrawerRequestId = useOnboardingBridgeStore((state) => state.openMobileDrawerRequestId);
  const closeTransientPanelsRequestId = useOnboardingBridgeStore((state) => state.closeTransientPanelsRequestId);
  const mobileDrawerSection = useOnboardingBridgeStore((state) => state.mobileDrawerSection);
  const isStellarium = skyEngine === 'stellarium';
  const [open, setOpen] = useState(false);
  const handledOpenRequestRef = useRef(0);
  const handledCloseRequestRef = useRef(0);

  const mobileFeatureRegistry = [
    {
      id: 'tonight',
      label: t('tonight.title'),
      element: <TonightRecommendations />,
    },
    {
      id: 'daily-knowledge',
      label: t('dailyKnowledge.open'),
      element: <DailyKnowledgeButton />,
    },
    {
      id: 'sky-atlas',
      label: t('skyAtlas.title'),
      element: <SkyAtlasPanel />,
    },
    {
      id: 'astro-events',
      label: t('events.calendar'),
      element: <AstroEventsCalendar />,
    },
    {
      id: 'satellite',
      label: t('satellites.tracker'),
      element: <SatelliteTracker />,
    },
    {
      id: 'session-planner',
      label: t('sessionPlanner.title'),
      element: <SessionPlannerButton />,
    },
    {
      id: 'astro-calculator',
      label: t('settingsNew.mobile.tools.astro-calculator'),
      element: <AstroCalculatorDialog />,
    },
    {
      id: 'plate-solver',
      label: t('settingsNew.mobile.tools.plate-solver'),
      element: (
        <PlateSolverUnified
          onGoToCoordinates={(ra, dec) => setViewDirection?.(ra, dec)}
        />
      ),
    },
    {
      id: 'ocular',
      label: t('ocular.title'),
      element: <OcularSimulator onApplyFov={onSetFov} currentFov={currentFov} />,
    },
    {
      id: 'equipment-manager',
      label: t('equipment.title'),
      element: <EquipmentManager />,
    },
    {
      id: 'settings',
      label: t('settings.allSettings'),
      element: <UnifiedSettings />,
    },
    {
      id: 'offline-cache',
      label: t('cache.offlineStorage'),
      element: <OfflineCacheManager />,
    },
    {
      id: 'keyboard-shortcuts',
      label: t('settingsNew.mobile.tools.keyboard-shortcuts'),
      element: <KeyboardShortcutsDialog />,
    },
    {
      id: 'about',
      label: t('about.title'),
      element: <AboutDialog />,
    },
  ];

  const orderedMobileFeatures = sortByMobileToolPriority(
    mobileFeatureRegistry,
    prioritizedTools,
  );

  useEffect(() => {
    if (
      openMobileDrawerRequestId > 0 &&
      openMobileDrawerRequestId !== handledOpenRequestRef.current
    ) {
      handledOpenRequestRef.current = openMobileDrawerRequestId;
      const openTimer = window.setTimeout(() => {
        setOpen(true);
      }, 0);
      const scrollTimer = mobileDrawerSection
        ? window.setTimeout(() => {
            const target = document.querySelector(
              `[data-tour-id="${mobileDrawerSection}"]`,
            ) as HTMLElement | null;
            target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          }, 220)
        : null;
      return () => {
        window.clearTimeout(openTimer);
        if (scrollTimer !== null) {
          window.clearTimeout(scrollTimer);
        }
      };
    }
  }, [mobileDrawerSection, openMobileDrawerRequestId]);

  useEffect(() => {
    if (
      closeTransientPanelsRequestId > 0 &&
      closeTransientPanelsRequestId !== handledCloseRequestRef.current
    ) {
      handledCloseRequestRef.current = closeTransientPanelsRequestId;
      const timer = window.setTimeout(() => {
        setOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [closeTransientPanelsRequestId]);

  return (
    <Drawer direction="left" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          data-tour-id="mobile-menu"
          aria-label={t('starmap.title')}
          variant="ghost"
          size="icon"
          data-starmap-ui-control="true"
          className="h-9 w-9 bg-card/60 backdrop-blur-md border border-border/50 text-foreground/80 hover:text-foreground hover:bg-accent touch-target toolbar-btn"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        data-starmap-ui-control="true"
        className="w-[85vw] max-w-80 h-full bg-card border-border p-0 flex flex-col drawer-content"
      >
        <DrawerHeader className="p-4 border-b border-border shrink-0">
          <DrawerTitle className="text-foreground flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            {t('starmap.title')}
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Time Display */}
            {(stel || skyEngine === 'aladin') && (
              <div className="p-3 rounded-lg bg-muted/50">
                <StellariumClock />
              </div>
            )}
            
            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center" data-tour-id="night-mode">
                <NightModeToggle />
                <span className="text-[10px] text-muted-foreground mt-1">{t('settings.nightMode')}</span>
              </div>
              <div className="flex flex-col items-center">
                <SensorControlToggle showStatusLabel />
              </div>
              <div className="flex flex-col items-center" data-tour-id="theme">
                <ThemeToggle />
                <span className="text-[10px] text-muted-foreground mt-1">{t('common.darkMode')}</span>
              </div>
              <div className="flex flex-col items-center" data-tour-id="language">
                <LanguageSwitcher className="h-10 w-10" />
                <span className="text-[10px] text-muted-foreground mt-1">{t('common.language')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {orderedMobileFeatures.map((feature) => (
                <div key={feature.id} className="flex flex-col items-center" data-tour-id={feature.id}>
                  {feature.element}
                  <span className="text-[10px] text-muted-foreground mt-1">{feature.label}</span>
                </div>
              ))}
              {isTauri() && (
                <div className="flex flex-col items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive hover:bg-destructive/10"
                    onClick={() => quitApp()}
                  >
                    <Power className="h-5 w-5" />
                  </Button>
                  <span className="text-[10px] text-destructive mt-1">{t('appControl.quit')}</span>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Display Settings */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t('settings.displaySettings')}</h3>
              {isStellarium ? (
                <StellariumSettings />
              ) : (
                <div className="space-y-3 px-1">
                  {/* Coordinate Grid */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('settings.coordinateGrid')}</Label>
                    <Switch
                      checked={aladinDisplay.showCooGrid}
                      onCheckedChange={() => toggleAladinDisplaySetting('showCooGrid')}
                    />
                  </div>
                  {/* Reticle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('settings.reticle')}</Label>
                    <Switch
                      checked={aladinDisplay.showReticle}
                      onCheckedChange={() => toggleAladinDisplaySetting('showReticle')}
                    />
                  </div>
                  {/* Coordinate Frame */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{t('settings.coordinateFrame')}</Label>
                    <select
                      className="text-sm bg-background border border-border rounded px-2 py-1"
                      value={aladinDisplay.cooFrame}
                      onChange={(e) => setAladinDisplaySetting('cooFrame', e.target.value as 'ICRSd' | 'galactic')}
                    >
                      <option value="ICRSd">{t('settings.equatorial')}</option>
                      <option value="galactic">{t('settings.galactic')}</option>
                    </select>
                  </div>
                  {/* Engine switcher */}
                  <div className="pt-2 border-t border-border/50">
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setSkyEngine('stellarium')}>
                      {t('engine.switchToStellarium')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Offline Storage */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{t('cache.offlineStorage')}</h3>
              <OfflineCacheManager />
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
});
MobileMenuDrawer.displayName = 'MobileMenuDrawer';
