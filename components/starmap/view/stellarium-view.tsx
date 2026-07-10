'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { TooltipProvider } from '@/components/ui/tooltip';

import { SkyMapCanvas } from '../canvas/sky-map-canvas';
import { InfoPanel } from '../objects/info-panel';
import { ObjectDetailDrawer } from '../objects/object-detail-drawer';
import { KeyboardShortcutsManager } from '../controls/keyboard-shortcuts-manager';
import { UnifiedOnboarding } from '../onboarding/unified-onboarding';
import { StartupModalCoordinator } from '../knowledge/startup-modal-coordinator';

import { TopToolbar } from './top-toolbar';
import { RightControlPanel } from './right-control-panel';
import { MobileLayout } from './mobile-layout';
import { CanvasContextMenu } from './canvas-context-menu';
import { GoToCoordinatesDialog } from './go-to-coordinates-dialog';
import { SearchPanel } from './search-panel';
import { CloseConfirmDialog } from './close-confirm-dialog';
import { OverlaysContainer } from './overlays-container';
import { CenterCrosshair } from './center-crosshair';
import { BottomStatusBar } from './bottom-status-bar';
import { WindowResizeHandles } from './window-resize-handles';
import { useStellariumViewState } from './use-stellarium-view-state';
import { UpdateBanner } from '../management/updater/update-banner';
import { UpdateDialog } from '../management/updater/update-dialog';
import { MessierMarathonGuideDialog } from '../planning/messier-marathon-guide';
import { PlateSolverUnified } from '../plate-solving/plate-solver-unified';
import { isTauri } from '@/lib/tauri/app-control-api';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useOnboardingBridgeStore, usePlanningUiStore, useStarmapMobileUiStore } from '@/lib/stores';
import { useCliBridgeStore } from '@/lib/stores/cli-bridge-store';
import { ARCameraBackground } from '../overlays/ar-camera-background';
import { ARCompassOverlay } from '../overlays/ar-compass-overlay';
import { SelectionPulse } from '../overlays/selection-pulse';
import { ARRecoveryPanel } from './ar-recovery-panel';
import { ARLaunchAssistant } from './ar-launch-assistant';
import { useMobileShell } from './use-mobile-shell';
import { useARSessionStatus } from '@/lib/hooks/use-ar-session-status';
import { useARAdaptation } from '@/lib/hooks/use-ar-adaptation';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { cn } from '@/lib/utils';

// SessionPlanner is the heaviest panel in the app (3000+ lines). Defer
// loading its chunk until the user first opens the planner, then keep it
// mounted so close/open animations remain smooth.
const SessionPlanner = dynamic(
  () => import('../planning/session-planner').then((m) => ({ default: m.SessionPlanner })),
  { ssr: false },
);

interface StellariumViewProps {
  showSplash?: boolean;
}

export function StellariumView({ showSplash = false }: StellariumViewProps) {
  const {
    // UI state
    isSearchOpen,
    setIsSearchOpen,
    selectedObject,
    currentFov,
    showSessionPanel,
    toggleSessionPanel,
    contextMenuCoords,
    infoPanelAnchor,
    containerBounds,

    // Context menu state
    contextMenuOpen,
    setContextMenuOpen,
    contextMenuPosition,

    // Dialog states
    goToDialogOpen,
    setGoToDialogOpen,
    detailDrawerOpen,
    setDetailDrawerOpen,
    closeConfirmDialogOpen,
    setCloseConfirmDialogOpen,

    // View center
    viewCenterRaDec,

    // Refs
    canvasRef,
    searchRef,
    containerRef,

    // Equipment settings (only setters needed by handlers)
    setRotationAngle,

    // Store states
    stel,
    skyEngine,
    mountConnected,
    stellariumSettings,
    toggleStellariumSetting,

    // Marker store
    setPendingMarkerCoords,

    // Handlers
    handleSelectionChange,
    handleDeselectObject,
    handleFovChange,
    handleSetFramingCoordinates,
    handleZoomIn,
    handleZoomOut,
    handleSetFov,
    handleResetView,
    handleLocationChange,
    handleContextMenuCapture,
    handleAddToTargetList,
    handleNavigateToCoords,
    handleGoToCoordinates,
    openGoToDialog,
    handleCloseStarmapClick,
    handleConfirmClose,
    toggleSearch,
    handleNavigate,
    handleMarkerEdit,
    handleMarkerNavigate,
  } = useStellariumViewState();

  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const { isMobileShell, viewportHeight } = useMobileShell();
  const activeMobilePanel = useStarmapMobileUiStore((state) => state.activePanel);
  const setMobileShell = useStarmapMobileUiStore((state) => state.setMobileShell);
  const openMobilePanel = useStarmapMobileUiStore((state) => state.openPanel);
  const closeMobilePanelIfActive = useStarmapMobileUiStore((state) => state.closePanelIfActive);
  const resetMobilePanelFlow = useStarmapMobileUiStore((state) => state.resetPanelFlow);
  const sessionPlannerOpen = usePlanningUiStore((state) => state.sessionPlannerOpen);
  const openSessionPlanner = usePlanningUiStore((state) => state.openSessionPlanner);
  const setSessionPlannerOpen = usePlanningUiStore((state) => state.setSessionPlannerOpen);
  const openSettingsDrawer = useOnboardingBridgeStore((state) => state.openSettingsDrawer);
  const settingsDrawerOpen = useOnboardingBridgeStore((state) => state.settingsDrawerOpen);
  const closeTransientPanels = useOnboardingBridgeStore((state) => state.closeTransientPanels);
  const cliSearchRequestId = useCliBridgeStore((state) => state.searchRequestId);
  const cliSearchQuery = useCliBridgeStore((state) => state.pendingSearchQuery);
  const cliPlateSolverRequestId = useCliBridgeStore((state) => state.plateSolverRequestId);
  const cliPlateSolverLaunch = useCliBridgeStore((state) => state.plateSolverLaunch);
  const arMode = useSettingsStore((s) => s.stellarium.arMode);
  const arLaunchAssistantVisible = useARRuntimeStore((state) => state.launchAssistant.visible);
  const arOpacity = useSettingsStore((s) => s.stellarium.arOpacity);
  const arShowCompass = useSettingsStore((s) => s.stellarium.arShowCompass);
  const arSession = useARSessionStatus({ enabled: arMode });
  const arAdaptation = useARAdaptation();
  const useCameraBlend = arMode && arSession.cameraLayerEnabled;
  const wasSessionPlannerOpenRef = useRef(sessionPlannerOpen);
  // Latch: once the user opens the planner the chunk is loaded; keep the
  // component mounted afterwards so exit animations and subsequent opens
  // don't pay the chunk-fetch cost again. Adjust during render (the
  // React-recommended pattern) rather than in an effect — no extra commit.
  const [sessionPlannerEverOpened, setSessionPlannerEverOpened] = useState(sessionPlannerOpen);
  if (sessionPlannerOpen && !sessionPlannerEverOpened) {
    setSessionPlannerEverOpened(true);
  }
  const wasSettingsDrawerOpenRef = useRef(settingsDrawerOpen);
  const handledCliSearchRef = useRef(0);

  useEffect(() => {
    if (cliSearchRequestId <= 0 || cliSearchRequestId === handledCliSearchRef.current) {
      return;
    }

    handledCliSearchRef.current = cliSearchRequestId;
    requestAnimationFrame(() => {
      if (cliSearchQuery) {
        searchRef.current?.setQuery?.(cliSearchQuery);
      }
      searchRef.current?.focusSearchInput();
    });
  }, [cliSearchQuery, cliSearchRequestId, searchRef]);

  useEffect(() => {
    setMobileShell(isMobileShell);
    if (!isMobileShell) {
      resetMobilePanelFlow();
      closeTransientPanels();
    }
  }, [closeTransientPanels, isMobileShell, resetMobilePanelFlow, setMobileShell]);

  useEffect(() => {
    if (!isMobileShell || !activeMobilePanel) return;
    if (activeMobilePanel === 'details' && !selectedObject) {
      closeMobilePanelIfActive('details');
    }
  }, [activeMobilePanel, closeMobilePanelIfActive, isMobileShell, selectedObject]);

  useEffect(() => {
    if (!isMobileShell) {
      wasSessionPlannerOpenRef.current = sessionPlannerOpen;
      return;
    }

    const wasOpen = wasSessionPlannerOpenRef.current;
    if (activeMobilePanel === 'planning' && wasOpen && !sessionPlannerOpen) {
      closeMobilePanelIfActive('planning');
    }
    wasSessionPlannerOpenRef.current = sessionPlannerOpen;
  }, [activeMobilePanel, closeMobilePanelIfActive, isMobileShell, sessionPlannerOpen]);

  useEffect(() => {
    if (!isMobileShell) return;

    if (activeMobilePanel === 'search') {
      if (!isSearchOpen) {
        setIsSearchOpen(true);
      }
    } else if (isSearchOpen) {
      setIsSearchOpen(false);
    }

    if (activeMobilePanel === 'details') {
      if (selectedObject && !detailDrawerOpen) {
        setDetailDrawerOpen(true);
      }
    } else if (detailDrawerOpen) {
      setDetailDrawerOpen(false);
    }

    if (activeMobilePanel === 'planning') {
      if (!sessionPlannerOpen) {
        setSessionPlannerOpen(true);
      }
    } else if (sessionPlannerOpen) {
      setSessionPlannerOpen(false);
    }

    if (activeMobilePanel === 'settings') {
      if (!settingsDrawerOpen) {
        openSettingsDrawer();
      }
      return;
    }

    if (settingsDrawerOpen) {
      closeTransientPanels();
    }
  }, [
    activeMobilePanel,
    closeTransientPanels,
    detailDrawerOpen,
    isMobileShell,
    isSearchOpen,
    openSettingsDrawer,
    selectedObject,
    sessionPlannerOpen,
    setDetailDrawerOpen,
    setIsSearchOpen,
    setSessionPlannerOpen,
    settingsDrawerOpen,
  ]);

  useEffect(() => {
    if (!isMobileShell) return;
    if (isSearchOpen && activeMobilePanel !== 'search') {
      openMobilePanel('search');
    }
    if (detailDrawerOpen && activeMobilePanel !== 'details') {
      openMobilePanel('details');
    }
    if (sessionPlannerOpen && activeMobilePanel !== 'planning') {
      openMobilePanel('planning');
    }
    if (settingsDrawerOpen && activeMobilePanel !== 'settings') {
      openMobilePanel('settings');
    }
  }, [
    activeMobilePanel,
    detailDrawerOpen,
    isMobileShell,
    isSearchOpen,
    openMobilePanel,
    sessionPlannerOpen,
    settingsDrawerOpen,
  ]);

  useEffect(() => {
    if (!isMobileShell) {
      wasSettingsDrawerOpenRef.current = settingsDrawerOpen;
      return;
    }

    const wasOpen = wasSettingsDrawerOpenRef.current;
    if (activeMobilePanel === 'settings' && wasOpen && !settingsDrawerOpen) {
      closeMobilePanelIfActive('settings');
    }
    wasSettingsDrawerOpenRef.current = settingsDrawerOpen;
  }, [activeMobilePanel, closeMobilePanelIfActive, isMobileShell, settingsDrawerOpen]);

  const closeMobilePanelContext = useCallback((panel: 'search' | 'details' | 'planning' | 'settings') => {
    if (panel === 'settings') {
      closeTransientPanels();
      closeMobilePanelIfActive('settings');
      return;
    }

    if (panel === 'planning') {
      setSessionPlannerOpen(false);
      closeMobilePanelIfActive('planning');
      return;
    }

    if (panel === 'search') {
      setIsSearchOpen(false);
      closeMobilePanelIfActive('search');
      return;
    }

    setDetailDrawerOpen(false);
    closeMobilePanelIfActive('details');
  }, [
    closeMobilePanelIfActive,
    closeTransientPanels,
    setDetailDrawerOpen,
    setIsSearchOpen,
    setSessionPlannerOpen,
  ]);

  const handleSearchToggle = useCallback(() => {
    if (!isMobileShell) {
      toggleSearch();
      return;
    }

    if (activeMobilePanel === 'search') {
      closeMobilePanelContext('search');
      return;
    }

    openMobilePanel('search');
  }, [
    activeMobilePanel,
    closeMobilePanelContext,
    isMobileShell,
    openMobilePanel,
    toggleSearch,
  ]);

  const handleOpenDetails = useCallback(() => {
    if (!selectedObject) return;
    if (isMobileShell) {
      openMobilePanel('details');
      return;
    }
    setDetailDrawerOpen(true);
  }, [isMobileShell, openMobilePanel, selectedObject, setDetailDrawerOpen]);

  // Stable identity so memo(InfoPanel) is not defeated by an inline closure
  // on every StellariumView render (it polls view direction every 500ms).
  // Routes through handleDeselectObject so the engine's own selection reticle
  // and the continuity target context are cleared along with the React state.
  const handleCloseInfoPanel = handleDeselectObject;

  // Stable handler so memo(ObjectDetailDrawer) holds across frequent re-renders.
  const handleDetailDrawerOpenChange = useCallback((open: boolean) => {
    setDetailDrawerOpen(open);
    if (!open && isMobileShell) {
      closeMobilePanelContext('details');
    }
  }, [setDetailDrawerOpen, isMobileShell, closeMobilePanelContext]);

  // Shared stable handler for memo(SearchPanel)'s close/select (both just
  // dismiss the mobile search context).
  const handleCloseSearchContext = useCallback(
    () => closeMobilePanelContext('search'),
    [closeMobilePanelContext],
  );

  const handleOpenSessionPlanner = useCallback(() => {
    if (isMobileShell) {
      openMobilePanel('planning');
    }
    openSessionPlanner();
  }, [isMobileShell, openMobilePanel, openSessionPlanner]);

  const handleOpenSettings = useCallback(() => {
    if (isMobileShell) {
      openMobilePanel('settings');
    }
    openSettingsDrawer();
  }, [isMobileShell, openMobilePanel, openSettingsDrawer]);

  const handleToggleAr = useCallback(() => {
    const btn = document.querySelector('[data-testid="ar-mode-toggle"]') as HTMLButtonElement | null;
    btn?.click();
  }, []);

  const mobileShellContainerStyle: CSSProperties | undefined = isMobileShell
    ? ({
        ['--mobile-shell-height' as string]: `${viewportHeight}px`,
        height: 'var(--mobile-shell-height)',
        minHeight: 'var(--mobile-shell-height)',
        maxHeight: 'var(--mobile-shell-height)',
      } as CSSProperties)
    : undefined;

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn('relative w-full h-full overflow-hidden', arMode ? 'bg-transparent' : 'bg-black')}
        data-tour-id="canvas"
        data-testid="stellarium-view-root"
        data-shell={isMobileShell ? 'mobile' : 'desktop'}
        data-ar-layout-tier={arAdaptation.layoutTier}
        data-ar-runtime-class={arAdaptation.runtimeClass}
        data-ar-sensor-path={arAdaptation.sensorPath}
        style={mobileShellContainerStyle}
      >
        {/* Unified Onboarding (Welcome + Setup Wizard + Tour) */}
        <UnifiedOnboarding />
        <StartupModalCoordinator showSplash={showSplash} />

        {/* Keyboard Shortcuts Manager */}
        <KeyboardShortcutsManager
          onToggleSearch={handleSearchToggle}
          onToggleSessionPanel={toggleSessionPanel}
          onToggleAr={handleToggleAr}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onClosePanel={() => {
            if (isMobileShell && activeMobilePanel) {
              closeMobilePanelContext(activeMobilePanel);
              return;
            }
            if (isSearchOpen) {
              setIsSearchOpen(false);
              return;
            }
            if (detailDrawerOpen) {
              setDetailDrawerOpen(false);
              return;
            }
            if (selectedObject) handleDeselectObject();
          }}
          enabled={!!stel || skyEngine === 'aladin'}
        />

        {/* AR Camera Background (behind canvas) */}
        {arMode && <ARCameraBackground enabled={arMode} />}

        {/* Canvas 鈥?switches between Stellarium and Aladin based on skyEngine setting */}
        <div
          className="absolute inset-0"
          style={useCameraBlend ? { mixBlendMode: 'screen' as const, opacity: arOpacity } : undefined}
        >
          <SkyMapCanvas
            ref={canvasRef}
            onSelectionChange={handleSelectionChange}
            onFovChange={handleFovChange}
            onContextMenu={handleContextMenuCapture}
          />
        </div>

        {/* Context Menu */}
        <CanvasContextMenu
          open={contextMenuOpen}
          position={contextMenuPosition}
          coords={contextMenuCoords}
          selectedObject={selectedObject}
          mountConnected={mountConnected}
          stellariumSettings={stellariumSettings}
          onOpenChange={setContextMenuOpen}
          onAddToTargetList={handleAddToTargetList}
          onNavigateToCoords={handleNavigateToCoords}
          onOpenGoToDialog={openGoToDialog}
          onSetPendingMarkerCoords={setPendingMarkerCoords}
          onSetFramingCoordinates={handleSetFramingCoordinates}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onSetFov={handleSetFov}
          onToggleStellariumSetting={toggleStellariumSetting}
          onToggleSearch={handleSearchToggle}
          onResetView={handleResetView}
        />

        {/* Go to Coordinates Dialog */}
        <GoToCoordinatesDialog
          open={goToDialogOpen}
          onOpenChange={setGoToDialogOpen}
          onNavigate={handleGoToCoordinates}
        />

        {/* Session Planner Dialog: lazy-mounted on first open, then retained. */}
        {sessionPlannerEverOpened && <SessionPlanner showTrigger={false} />}
        <MessierMarathonGuideDialog />
        <PlateSolverUnified
          trigger={<span className="hidden" aria-hidden="true" />}
          autoOpenRequestId={cliPlateSolverRequestId}
          defaultImagePath={cliPlateSolverLaunch?.imagePath}
          raHint={cliPlateSolverLaunch?.raHint}
          decHint={cliPlateSolverLaunch?.decHint}
          fovHint={cliPlateSolverLaunch?.fovHint}
          onGoToCoordinates={handleGoToCoordinates}
          onSelectObject={handleSelectionChange}
        />

        {arMode && arLaunchAssistantVisible && <ARLaunchAssistant />}

        {arMode && (
          <ARRecoveryPanel
            status={arSession.status}
            recoveryActions={arSession.recoveryActions}
            isStabilizing={arSession.isStabilizing}
            className="top-[calc(0.5rem+var(--safe-area-top))]"
          />
        )}

        {/* AR Compass Overlay */}
        {arMode && (
          <ARCompassOverlay
            enabled={arShowCompass}
            sessionStatus={arSession.status}
          />
        )}

        {/* Overlays */}
        <OverlaysContainer
          containerBounds={containerBounds}
          currentFov={currentFov}
          onRotationChange={setRotationAngle}
          onMarkerDoubleClick={handleMarkerNavigate}
          onMarkerEdit={handleMarkerEdit}
          onMarkerNavigate={handleMarkerNavigate}
        />

        {/* One-shot selection acknowledgement ring (kept outside
            OverlaysContainer to avoid widening its memo props) */}
        {containerBounds && (
          <SelectionPulse
            selectedObject={selectedObject}
            containerWidth={containerBounds.width}
            containerHeight={containerBounds.height}
          />
        )}

        {/* Top Toolbar */}
        <TopToolbar
          stel={!!stel || skyEngine === 'aladin'}
          isMobileShell={isMobileShell}
          isSearchOpen={isSearchOpen}
          showSessionPanel={showSessionPanel}
          viewCenterRaDec={viewCenterRaDec}
          currentFov={currentFov}
          onToggleSearch={handleSearchToggle}
          onToggleSessionPanel={toggleSessionPanel}
          onResetView={handleResetView}
          onCloseStarmapClick={handleCloseStarmapClick}
          onSetFov={handleSetFov}
          onNavigate={handleNavigate}
          onGoToCoordinates={handleGoToCoordinates}
          onSelectObject={handleSelectionChange}
        />

        {/* Search Panel */}
        <SearchPanel
          ref={searchRef}
          isOpen={isSearchOpen}
          isMobileShell={isMobileShell}
          onClose={handleCloseSearchContext}
          onSelect={handleCloseSearchContext}
        />

        {/* Right Side Controls - Desktop shell only. Gated on the same
            isMobileShell boolean as InfoPanel/BottomStatusBar so the desktop
            rail never coexists with the mobile layer (the 640-900px dead-zone). */}
        {!isMobileShell && (
          <RightControlPanel
            stel={!!stel || skyEngine === 'aladin'}
            currentFov={currentFov}
            selectedObject={selectedObject}
            showSessionPanel={showSessionPanel}
            contextMenuCoords={contextMenuCoords}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFovSliderChange={handleSetFov}
            onGoToCoordinates={handleGoToCoordinates}
            onLocationChange={handleLocationChange}
          />
        )}

        {/* Mobile Layout */}
        {isMobileShell && (
          <MobileLayout
            currentFov={currentFov}
            selectedObject={selectedObject}
            contextMenuCoords={contextMenuCoords}
            activeMobilePanel={activeMobilePanel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFovSliderChange={handleSetFov}
            onLocationChange={handleLocationChange}
            onGoToCoordinates={handleGoToCoordinates}
            onSelectObject={handleSelectionChange}
            onOpenSearch={handleSearchToggle}
            onOpenDetails={handleOpenDetails}
            onOpenSessionPlanner={handleOpenSessionPlanner}
            onOpenSettings={handleOpenSettings}
          />
        )}

        {/* Info Panel */}
        {selectedObject && !isSearchOpen && !isMobileShell && (
          <InfoPanel
            selectedObject={selectedObject}
            onClose={handleCloseInfoPanel}
            onSetFramingCoordinates={handleSetFramingCoordinates}
            onViewDetails={handleOpenDetails}
            // Frozen selection anchor: the click point for click-driven
            // selections, the projected object position for search/toolbar ones.
            clickPosition={infoPanelAnchor}
            containerBounds={containerBounds}
            className="pointer-events-auto info-panel-enter"
          />
        )}

        {/* Object Detail Drawer */}
        <ObjectDetailDrawer
          open={detailDrawerOpen}
          onOpenChange={handleDetailDrawerOpenChange}
          selectedObject={selectedObject}
          onSetFramingCoordinates={handleSetFramingCoordinates}
        />

        {/* Close Confirmation Dialog */}
        <CloseConfirmDialog
          open={closeConfirmDialogOpen}
          onOpenChange={setCloseConfirmDialogOpen}
          onConfirm={handleConfirmClose}
        />

        {/* Bottom Status Bar */}
        {!isMobileShell && <BottomStatusBar currentFov={currentFov} />}

        {/* Center Crosshair */}
        <CenterCrosshair />

        {/* Frameless-window resize affordance (custom shell only) */}
        <WindowResizeHandles />

        {/* Update Banner & Dialog (Tauri desktop only) */}
        {isTauri() && (
          <>
            <UpdateBanner
              className="absolute left-1/2 -translate-x-1/2 z-40 top-[calc(3rem+var(--safe-area-top))]"
              onOpenDialog={() => setUpdateDialogOpen(true)}
            />
            <UpdateDialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}


