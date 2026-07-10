/**
 * Type definitions for starmap object components
 * Extracted from components/starmap/objects/ for architectural separation
 */

import type { SelectedObjectData } from '@/lib/core/types';
import type { ObjectImage } from '@/lib/services/object-info-service';
import type { ImageSourceConfig, DataSourceConfig } from '@/lib/services/object-info-config';

// ============================================================================
// Shared Types
// ============================================================================

/** Shared callback data for slew/framing coordinate actions */
export interface FramingCoordinatesData {
  ra: number;
  dec: number;
  raString: string;
  decString: string;
  name: string;
}

// ============================================================================
// InfoPanel
// ============================================================================

export interface InfoPanelProps {
  selectedObject: SelectedObjectData | null;
  onClose?: () => void;
  onSetFramingCoordinates?: (data: FramingCoordinatesData) => void;
  /** Callback to open the detail drawer */
  onViewDetails?: () => void;
  className?: string;
  /** Click position for adaptive positioning */
  clickPosition?: { x: number; y: number };
  /** Container bounds for adaptive positioning */
  containerBounds?: { width: number; height: number };
}

// ============================================================================
// AltitudeChartCompact
// ============================================================================

export interface AltitudeChartCompactProps {
  ra: number;
  dec: number;
  /**
   * Per-time position provider for moving bodies (planets, Moon). When set,
   * the curve tracks the body instead of freezing the selection-time RA/Dec.
   * Must be referentially stable across renders (the chart is memoized).
   */
  positionAt?: (date: Date) => { raDeg: number; decDeg: number };
  /**
   * Pre-computed visibility for moving bodies (rise/set/transit markers).
   * When omitted the chart computes fixed-target visibility internally.
   */
  visibility?: import('@/lib/core/types').TargetVisibility | null;
  /** Show the "position is a selection-time snapshot" footnote (comets/asteroids). */
  isSnapshot?: boolean;
}

export interface ChartTooltipPayload {
  hour: number;
  altitude: number;
  time: string;
}

// ============================================================================
// ObjectDetailDrawer
// ============================================================================

export interface ObjectDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedObject: SelectedObjectData | null;
  onSetFramingCoordinates?: (data: FramingCoordinatesData) => void;
}

// ============================================================================
// ObjectImageGallery
// ============================================================================

export interface ObjectImageGalleryProps {
  images: ObjectImage[];
  objectName: string;
  className?: string;
}

export interface ImageState {
  loaded: boolean;
  error: boolean;
}

// ============================================================================
// ObjectInfoSourcesConfig (sub-component props)
// ============================================================================

export interface StatusBadgeProps {
  status: ImageSourceConfig['status'];
  responseTime?: number;
}

export interface SourceItemProps {
  source: ImageSourceConfig | DataSourceConfig;
  onToggle: () => void;
  onCheck: () => void;
  onRemove?: () => void;
  onEdit: () => void;
}

export interface EditSourceDialogProps {
  source: ImageSourceConfig | DataSourceConfig;
  type: 'image' | 'data';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<ImageSourceConfig | DataSourceConfig>) => void;
}

export interface AddCustomSourceDialogProps {
  type: 'image' | 'data';
  onAdd: (source: Partial<ImageSourceConfig | DataSourceConfig>) => void;
}

// ============================================================================
// RiseTransitSetGrid
// ============================================================================

export interface RiseTransitSetGridProps {
  visibility: import('@/lib/core/types').TargetVisibility;
  /** 'compact' for InfoPanel, 'full' for ObjectDetailDrawer */
  variant?: 'compact' | 'full';
  className?: string;
}

// ============================================================================
// ObjectTypeLegend
// ============================================================================

export interface ObjectTypeLegendContentProps {
  compact?: boolean;
}

export interface ObjectTypeLegendProps {
  variant?: 'dialog' | 'popover';
  triggerClassName?: string;
}

// ============================================================================
// TranslatedName
// ============================================================================

export interface TranslatedNameProps {
  name: string;
  className?: string;
}
