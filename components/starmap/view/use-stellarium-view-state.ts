'use client';

import { useState, useReducer, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStellariumStore, useFramingStore, useMountStore, useEquipmentStore, useMarkerStore } from '@/lib/stores';
import { buildContinuityTargetSummary, useMapInteractionStore } from '@/lib/stores/map-interaction-store';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useNavigationHistoryStore } from '@/lib/hooks';
import { useSelectionAnchor } from './use-selection-anchor';
import { rad2deg } from '@/lib/astronomy/starmap-utils';
import type { SelectedObjectData, ClickCoords } from '@/lib/core/types';
import type { SkyMapCanvasRef } from '@/lib/core/types/sky-engine';
import type { StellariumSearchRef } from '../search/stellarium-search';

// Dialog state consolidated into reducer to avoid 5 individual useState hooks.
// Changes to dialog open/close states won't cause FOV/selection state to re-reference.
export interface DialogState {
  contextMenuOpen: boolean;
  contextMenuPosition: { x: number; y: number };
  goToDialogOpen: boolean;
  detailDrawerOpen: boolean;
  closeConfirmDialogOpen: boolean;
}

export type DialogAction =
  | { type: 'SET_CONTEXT_MENU'; open: boolean }
  | { type: 'OPEN_CONTEXT_MENU'; position: { x: number; y: number } }
  | { type: 'SET_GO_TO_DIALOG'; open: boolean }
  | { type: 'SET_DETAIL_DRAWER'; open: boolean }
  | { type: 'SET_CLOSE_CONFIRM'; open: boolean };

export const initialDialogState: DialogState = {
  contextMenuOpen: false,
  contextMenuPosition: { x: 0, y: 0 },
  goToDialogOpen: false,
  detailDrawerOpen: false,
  closeConfirmDialogOpen: false,
};

export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenuOpen: action.open };
    case 'OPEN_CONTEXT_MENU':
      return { ...state, contextMenuOpen: true, contextMenuPosition: action.position };
    case 'SET_GO_TO_DIALOG':
      return { ...state, goToDialogOpen: action.open };
    case 'SET_DETAIL_DRAWER':
      return { ...state, detailDrawerOpen: action.open };
    case 'SET_CLOSE_CONFIRM':
      return { ...state, closeConfirmDialogOpen: action.open };
    default:
      return state;
  }
}

export function useStellariumViewState() {
  const router = useRouter();
  const t = useTranslations();

  // UI state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState<SelectedObjectData | null>(null);
  const [currentFov, setCurrentFov] = useState(60);
  const [showSessionPanel, setShowSessionPanel] = useState(true);
  const [contextMenuCoords, setContextMenuCoords] = useState<ClickCoords | null>(null);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | undefined>();
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number } | undefined>();

  // Dialog & overlay states — consolidated into reducer to batch updates
  // and prevent high-frequency state (FOV) from recreating dialog setters
  const [dialogs, dispatchDialog] = useReducer(dialogReducer, initialDialogState);

  // Refs
  const canvasRef = useRef<SkyMapCanvasRef>(null);
  const searchRef = useRef<StellariumSearchRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fovChangeRafRef = useRef<number | null>(null);
  const lastFovRef = useRef(currentFov);
  const containerBoundsRef = useRef<{ left: number; top: number } | null>(null);
  const lastCanvasPointerDownAtRef = useRef(0);

  // Equipment store — only subscribe to setters needed in handlers
  // Display values (fovSimEnabled, sensorWidth, etc.) are subscribed directly by child components
  const setRotationAngle = useEquipmentStore((state) => state.setRotationAngle);

  // Stellarium store
  const stel = useStellariumStore((state) => state.stel);
  const setViewDirectionRaw = useStellariumStore((state) => state.setViewDirection);
  const viewDirection = useStellariumStore((state) => state.viewDirection);
  const updateViewDirection = useStellariumStore((state) => state.updateViewDirection);

  // Safe wrapper that handles null check once
  const safeSetViewDirection = useCallback((ra: number, dec: number) => {
    if (setViewDirectionRaw) {
      setViewDirectionRaw(ra, dec);
    }
  }, [setViewDirectionRaw]);

  // Mount store
  const mountConnected = useMountStore((state) => state.mountInfo.Connected);
  const setProfileInfo = useMountStore((state) => state.setProfileInfo);

  // Framing store
  const setShowFramingModal = useFramingStore((state) => state.setShowFramingModal);
  const setCoordinates = useFramingStore((state) => state.setCoordinates);
  const setSelectedItem = useFramingStore((state) => state.setSelectedItem);

  // Target list store
  const addTarget = useTargetListStore((state) => state.addTarget);

  // Settings store
  const stellariumSettings = useSettingsStore((state) => state.stellarium);
  const toggleStellariumSetting = useSettingsStore((state) => state.toggleStellariumSetting);
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const skipCloseConfirmation = useSettingsStore((state) => state.preferences.skipCloseConfirmation);
  const setPreference = useSettingsStore((state) => state.setPreference);

  // Marker store
  const setPendingMarkerCoords = useMarkerStore((state) => state.setPendingCoords);
  const setEditingMarkerId = useMarkerStore((state) => state.setEditingMarkerId);

  // Navigation history store
  const pushNavigationHistory = useNavigationHistoryStore((state) => state.push);
  const setTargetContext = useMapInteractionStore((state) => state.setTargetContext);
  const clearTargetContext = useMapInteractionStore((state) => state.clearTargetContext);

  // Single centralized view direction polling — updates the store
  useEffect(() => {
    updateViewDirection();
    const interval = setInterval(updateViewDirection, 500);
    return () => clearInterval(interval);
  }, [updateViewDirection]);

  // Derive view center (degrees) from store's viewDirection for bookmarks
  const viewCenterRaDec = useMemo(() => {
    if (!viewDirection) return { ra: 0, dec: 0 };
    return { ra: rad2deg(viewDirection.ra), dec: rad2deg(viewDirection.dec) };
  }, [viewDirection]);

  // Track container bounds via ResizeObserver. The observer can fire many times
  // per gesture; coalesce writes into a single rAF and skip no-op updates so the
  // overlay tree (which consumes containerBounds) doesn't reconcile on every tick.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const updateBounds = () => {
      rafId = null;
      const rect = el.getBoundingClientRect();
      containerBoundsRef.current = { left: rect.left, top: rect.top };
      setContainerBounds((prev) =>
        prev && prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(updateBounds);
    };

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(el);
    // Set initial bounds synchronously.
    updateBounds();

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Track last click position on container for info panel placement
  // Uses mousedown (fires once per click) instead of mousemove (fires every frame)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only track clicks on the canvas itself for info panel placement.
      // Clicks on UI overlays (InfoPanel, toolbars, etc.) must be ignored
      // to prevent repositioning the panel mid-click and breaking button interactions.
      if (!(e.target instanceof HTMLCanvasElement)) return;

      // Timestamp lets useSelectionAnchor tell click-driven selections apart
      // from programmatic ones (search/toolbar) that must not reuse a stale
      // click position.
      lastCanvasPointerDownAtRef.current = performance.now();

      const rect = containerBoundsRef.current;
      if (rect) {
        setClickPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    el.addEventListener('mousedown', handleMouseDown);
    return () => el.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Handle selection change from canvas
  const handleSelectionChange = useCallback((selection: SelectedObjectData | null) => {
    if (selection) {
      setIsSearchOpen(false);
      const mountProfile = useMountStore.getState().profileInfo.AstrometrySettings;
      setTargetContext(
        buildContinuityTargetSummary(selection, {
          siteCoordinates: {
            latitude: mountProfile.Latitude,
            longitude: mountProfile.Longitude,
          },
        })
      );
      pushNavigationHistory({
        ra: selection.raDeg,
        dec: selection.decDeg,
        fov: lastFovRef.current,
        name: selection.names[0],
      });
    } else {
      clearTargetContext();
    }
    setSelectedObject(selection);
  }, [clearTargetContext, pushNavigationHistory, setTargetContext]);

  // Frozen anchor for the floating InfoPanel — click position for click-driven
  // selections, projected object position for programmatic ones.
  const infoPanelAnchor = useSelectionAnchor({
    selectedObject,
    clickPosition,
    lastCanvasPointerDownAtRef,
    containerBounds,
  });

  // Canonical deselect. Clearing only the React state leaves the engine's own
  // selection reticle drawn on the sky and the continuity targetContext stale,
  // so every close path must also null the engine selection. The engine write
  // re-fires the selection watcher with null → handleSelectionChange(null);
  // the local clears keep the UI synchronous and cover the Aladin engine
  // (stel === null). Double-clearing is idempotent.
  const handleDeselectObject = useCallback(() => {
    const engine = useStellariumStore.getState().stel;
    if (engine?.core?.selection) {
      engine.core.selection = null;
    }
    clearTargetContext();
    setSelectedObject(null);
  }, [clearTargetContext]);

  // Handle FOV change with rAF throttling
  const handleFovChange = useCallback((fov: number) => {
    lastFovRef.current = fov;

    if (fovChangeRafRef.current) return;

    fovChangeRafRef.current = requestAnimationFrame(() => {
      setCurrentFov(lastFovRef.current);
      fovChangeRafRef.current = null;
    });
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (fovChangeRafRef.current) {
        cancelAnimationFrame(fovChangeRafRef.current);
      }
    };
  }, []);

  // Handle framing coordinates
  const handleSetFramingCoordinates = useCallback((data: {
    ra: number;
    dec: number;
    raString: string;
    decString: string;
    name: string;
  }) => {
    setCoordinates({
      ra: data.ra,
      dec: data.dec,
      raString: data.raString,
      decString: data.decString,
    });
    setSelectedItem({
      Name: data.name,
      RA: data.ra,
      Dec: data.dec,
    });
    setShowFramingModal(true);
  }, [setCoordinates, setSelectedItem, setShowFramingModal]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut();
  }, []);

  const handleSetFov = useCallback((fov: number) => {
    canvasRef.current?.setFov(fov);
  }, []);

  // Reset view
  const handleResetView = useCallback(() => {
    canvasRef.current?.setFov(60);
    setRotationAngle(0);
  }, [setRotationAngle]);

  // Location change handler
  const handleLocationChange = useCallback((lat: number, lon: number, alt: number) => {
    const currentProfile = useMountStore.getState().profileInfo;
    setProfileInfo({
      AstrometrySettings: {
        ...currentProfile.AstrometrySettings,
        Latitude: lat,
        Longitude: lon,
        Elevation: alt,
      },
    });
  }, [setProfileInfo]);

  // Context menu handlers
  const handleContextMenuCapture = useCallback((e: React.MouseEvent, coords: { ra: number; dec: number; raStr: string; decStr: string } | null) => {
    e.preventDefault();
    setContextMenuCoords(coords);
    dispatchDialog({ type: 'OPEN_CONTEXT_MENU', position: { x: e.clientX, y: e.clientY } });
  }, []);

  // Add to target list
  const handleAddToTargetList = useCallback(() => {
    // Read equipment values at call time (avoids reactive subscriptions)
    const eq = useEquipmentStore.getState();
    const eqData = {
      sensorWidth: eq.sensorWidth,
      sensorHeight: eq.sensorHeight,
      focalLength: eq.focalLength,
      rotationAngle: eq.rotationAngle,
      mosaic: eq.mosaic.enabled ? eq.mosaic : undefined,
      priority: 'medium' as const,
    };

    if (contextMenuCoords) {
      addTarget({
        name: t('actions.defaultTargetName', { coords: contextMenuCoords.raStr }),
        ra: contextMenuCoords.ra,
        dec: contextMenuCoords.dec,
        raString: contextMenuCoords.raStr,
        decString: contextMenuCoords.decStr,
        ...eqData,
      });
    } else if (selectedObject) {
      addTarget({
        name: selectedObject.names[0] || t('common.unknown'),
        ra: selectedObject.raDeg,
        dec: selectedObject.decDeg,
        raString: selectedObject.ra,
        decString: selectedObject.dec,
        ...eqData,
      });
    }
  }, [contextMenuCoords, selectedObject, addTarget, t]);

  // Navigate to coords
  const handleNavigateToCoords = useCallback(() => {
    if (contextMenuCoords) {
      safeSetViewDirection(contextMenuCoords.ra, contextMenuCoords.dec);
    }
    dispatchDialog({ type: 'SET_CONTEXT_MENU', open: false });
  }, [contextMenuCoords, safeSetViewDirection]);

  // Go to coordinates
  const handleGoToCoordinates = useCallback((ra: number, dec: number) => {
    safeSetViewDirection(ra, dec);
  }, [safeSetViewDirection]);

  // Open go to dialog
  const openGoToDialog = useCallback(() => {
    dispatchDialog({ type: 'SET_CONTEXT_MENU', open: false });
    dispatchDialog({ type: 'SET_GO_TO_DIALOG', open: true });
  }, []);

  // Close starmap
  const handleCloseStarmapClick = useCallback(() => {
    if (skipCloseConfirmation) {
      router.push('/');
    } else {
      dispatchDialog({ type: 'SET_CLOSE_CONFIRM', open: true });
    }
  }, [skipCloseConfirmation, router]);

  // Confirm close
  const handleConfirmClose = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      setPreference('skipCloseConfirmation', true);
    }
    dispatchDialog({ type: 'SET_CLOSE_CONFIRM', open: false });
    router.push('/');
  }, [setPreference, router]);

  // Toggle search
  const toggleSearch = useCallback(() => {
    setIsSearchOpen(prev => {
      if (!prev) {
        handleDeselectObject();
        // Use rAF to focus after DOM update + CSS transition start
        requestAnimationFrame(() => {
          searchRef.current?.focusSearchInput();
        });
      }
      return !prev;
    });
  }, [handleDeselectObject]);

  // Stable session-panel toggle — passed to memo'd TopToolbar and the keyboard
  // shortcut manager. Inlining `() => setShowSessionPanel(p => !p)` at the call
  // sites created a fresh closure every render and defeated TopToolbar's memo.
  const toggleSessionPanel = useCallback(() => {
    setShowSessionPanel((prev) => !prev);
  }, []);

  // Navigation handler
  const handleNavigate = useCallback((ra: number, dec: number, fov: number) => {
    safeSetViewDirection(ra, dec);
    canvasRef.current?.setFov(fov);
  }, [safeSetViewDirection]);

  // Marker handlers
  const handleMarkerNavigate = useCallback((marker: { ra: number; dec: number }) => {
    safeSetViewDirection(marker.ra, marker.dec);
  }, [safeSetViewDirection]);

  const handleMarkerEdit = useCallback((marker: { id: string }) => {
    setEditingMarkerId(marker.id);
  }, [setEditingMarkerId]);

  // Stable setter callbacks wrapping dispatchDialog — avoids inline closures in JSX
  const setContextMenuOpen = useCallback((open: boolean) => {
    dispatchDialog({ type: 'SET_CONTEXT_MENU', open });
  }, []);

  const setGoToDialogOpen = useCallback((open: boolean) => {
    dispatchDialog({ type: 'SET_GO_TO_DIALOG', open });
  }, []);

  const setDetailDrawerOpen = useCallback((open: boolean) => {
    dispatchDialog({ type: 'SET_DETAIL_DRAWER', open });
  }, []);

  const setCloseConfirmDialogOpen = useCallback((open: boolean) => {
    dispatchDialog({ type: 'SET_CLOSE_CONFIRM', open });
  }, []);

  return {
    // UI state
    isSearchOpen,
    setIsSearchOpen,
    selectedObject,
    setSelectedObject,
    currentFov,
    showSessionPanel,
    setShowSessionPanel,
    toggleSessionPanel,
    contextMenuCoords,
    clickPosition,
    infoPanelAnchor,
    containerBounds,

    // Context menu state
    contextMenuOpen: dialogs.contextMenuOpen,
    setContextMenuOpen,
    contextMenuPosition: dialogs.contextMenuPosition,

    // Dialog states
    goToDialogOpen: dialogs.goToDialogOpen,
    setGoToDialogOpen,
    detailDrawerOpen: dialogs.detailDrawerOpen,
    setDetailDrawerOpen,
    closeConfirmDialogOpen: dialogs.closeConfirmDialogOpen,
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
    safeSetViewDirection,
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
  };
}
