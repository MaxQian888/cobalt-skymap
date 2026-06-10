/**
 * Type definitions for starmap view components
 * Extracted from components/starmap/view/ for architectural separation
 */

import type { SelectedObjectData, ClickCoords } from '@/lib/core/types';
import type { StellariumSettings as FullStellariumSettings } from '@/lib/core/types/stellarium';

// ============================================================================
// Selection Types (shared between RightControlPanel and MobileLayout)
// ============================================================================

export interface CurrentSelection {
  name: string;
  ra: number;
  dec: number;
  raString: string;
  decString: string;
}

export interface ObservationSelection extends CurrentSelection {
  type?: string;
  constellation?: string;
}

// ============================================================================
// TopToolbar
// ============================================================================

export interface TopToolbarProps {
  stel: boolean;
  /**
   * Single source of truth for the mobile/desktop shell split (from
   * useMobileShell). The toolbar conditionally MOUNTS the mobile vs desktop
   * subtrees off this boolean instead of CSS sm/md breakpoints, so a stateful
   * control (sensor/AR orientation loops) only ever mounts once, and the
   * 640-900px / landscape dead-zones cannot occur.
   */
  isMobileShell: boolean;
  isSearchOpen: boolean;
  showSessionPanel: boolean;
  viewCenterRaDec: { ra: number; dec: number };
  currentFov: number;
  onToggleSearch: () => void;
  onToggleSessionPanel: () => void;
  onResetView: () => void;
  onCloseStarmapClick: () => void;
  onSetFov: (fov: number) => void;
  onNavigate: (ra: number, dec: number, fov: number) => void;
  onGoToCoordinates: (ra: number, dec: number) => void;
  onSelectObject?: (selection: SelectedObjectData) => void;
}

// ============================================================================
// CanvasContextMenu
// ============================================================================

/**
 * Subset of StellariumSettings used by the context menu display toggles
 */
export type ContextMenuStellariumSettings = Pick<FullStellariumSettings,
  'constellationsLinesVisible' | 'equatorialLinesVisible' | 'azimuthalLinesVisible' |
  'dsosVisible' | 'surveyEnabled' | 'atmosphereVisible'
>;

// CanvasContextMenuProps is defined locally in canvas-context-menu.tsx

// ============================================================================
// BottomStatusBar
// ============================================================================

export interface BottomStatusBarProps {
  currentFov: number;
}

// ============================================================================
// RightControlPanel
// ============================================================================

export interface RightControlPanelProps {
  stel: boolean;
  currentFov: number;
  selectedObject: SelectedObjectData | null;
  showSessionPanel: boolean;
  contextMenuCoords: ClickCoords | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFovSliderChange: (fov: number) => void;
  onGoToCoordinates: (ra: number, dec: number) => void;
  onLocationChange: (lat: number, lon: number, alt: number) => void;
}

// ============================================================================
// MobileLayout
// ============================================================================

export interface MobileLayoutProps {
  currentFov: number;
  selectedObject: SelectedObjectData | null;
  contextMenuCoords: ClickCoords | null;
  activeMobilePanel: 'search' | 'details' | 'planning' | 'settings' | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFovSliderChange: (fov: number) => void;
  onLocationChange: (lat: number, lon: number, alt: number) => void;
  onGoToCoordinates: (ra: number, dec: number) => void;
  onSelectObject?: (selection: SelectedObjectData) => void;
  onOpenSearch: () => void;
  onOpenDetails: () => void;
  onOpenSessionPlanner: () => void;
  onOpenSettings: () => void;
}

// OverlaysContainerProps is defined locally in overlays-container.tsx

// ============================================================================
// GoToCoordinatesDialog
// ============================================================================

export interface GoToCoordinatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (ra: number, dec: number) => void;
}

// ============================================================================
// CloseConfirmDialog
// ============================================================================

export interface CloseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dontShowAgain: boolean) => void;
}

// ============================================================================
// SearchPanel
// ============================================================================

export interface SearchPanelProps {
  isOpen: boolean;
  isMobileShell?: boolean;
  onClose: () => void;
  onSelect: () => void;
}
