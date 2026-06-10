'use client';

import { memo, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
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
  const handledSearchRequestRef = useRef(0);
  const handledToggleSearchRequestRef = useRef(0);
  const handledToggleSessionPanelRef = useRef(0);
  const handledCloseTransientRef = useRef(0);

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

  const shellHorizontalPadding = isTauriEnv
    ? {
        paddingLeft: `calc(${shell.titlebarInsets.left}px + 0.5rem)`,
        paddingRight: `calc(${shell.titlebarInsets.right}px + 0.5rem)`,
      }
    : undefined;

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

          {/* Discovery + Navigation groups — desktop shell only */}
          {!isMobileShell && (
          <div className="flex items-center gap-1.5">
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

            {/* Navigation Group - "Where to look" */}
            <ToolbarGroup gap="none" className="p-0.5">
              <div data-tour-id="quick-actions">
                <QuickActionsPanel
                  onZoomToFov={onSetFov}
                  onResetView={onResetView}
                />
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
          </div>
          )}
        </div>

        {/* Center: Time Display — desktop shell only (mobile shows it in the drawer) */}
        {!isMobileShell && (
          <div className="pointer-events-auto animate-fade-in">
            {(stel || skyEngine === 'aladin') && <StellariumClock />}
          </div>
        )}

        {/* Right: Planning → Instruments → Config → Display → Preferences → View/Help → Window */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Desktop Toolbar Groups — desktop shell only */}
          {!isMobileShell && (
          <div className="flex items-center gap-1.5">
            {/* Observation Planning Group */}
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

            {/* Instruments & Analysis Group */}
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

            {/* Configuration Group */}
            <ToolbarGroup gap="none" className="p-0.5" data-tour-id="settings-button">
              <div data-tour-id="settings">
                <UnifiedSettings />
              </div>
              <div data-tour-id="equipment-manager">
                <EquipmentManager />
              </div>
            </ToolbarGroup>

            {/* Display Mode Group */}
            <ToolbarGroup gap="none" className="p-0.5">
              <div data-tour-id="night-mode">
                <NightModeToggle />
              </div>
              <SensorControlToggle />
              <ARModeToggle />
              <ObjectTypeLegend variant="popover" />
            </ToolbarGroup>

            {/* UI Preferences Group */}
            <ToolbarGroup gap="none" className="p-0.5">
              <div data-tour-id="theme">
                <ThemeToggle variant="icon" className="h-9 w-9" />
              </div>
              <div data-tour-id="language">
                <LanguageSwitcher className={TOOLBAR_ICON_TOGGLE_CLASS} />
              </div>
            </ToolbarGroup>
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
            <div data-tour-id="keyboard-shortcuts">
              <KeyboardShortcutsDialog />
            </div>
            <div data-tour-id="about">
              <AboutDialog />
            </div>
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

  return (
    <div
      data-testid="window-drag-handle"
      className="pointer-events-auto absolute left-1/2 top-2 z-10 flex h-5 w-20 -translate-x-1/2 items-center justify-center rounded-full bg-card/55 backdrop-blur-md sm:w-28"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className="h-1.5 w-8 rounded-full bg-foreground/35 sm:w-10" />
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
