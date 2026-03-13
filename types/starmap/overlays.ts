/**
 * Type definitions for starmap overlay components
 * Extracted from components/starmap/overlays/ for architectural separation
 */

import type { MosaicSettings, GridType } from '@/lib/stores';
import type { SatelliteData } from '@/lib/core/types';
import type { SkyMarker } from '@/lib/stores';
import type { CelesTrakSatellitePass } from '@/lib/services/satellite/celestrak-service';

// ============================================================================
// FOVOverlay
// ============================================================================

export interface FOVOverlayProps {
  enabled: boolean;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  currentFov: number; // Current view FOV in degrees (horizontal)
  rotationAngle: number; // Rotation angle in degrees
  onRotationChange?: (angle: number) => void;
  mosaic: MosaicSettings;
  pixelSize?: number; // Sensor pixel size in µm (needed for pixel-based overlap)
  framePlacement?: { x: number; y: number };
  onFramePlacementChange?: (placement: { x: number; y: number }) => void;
  dragToPosition?: boolean;
  gridType?: GridType;
  frameColor?: string;
  frameStyle?: 'solid' | 'dashed' | 'dotted';
  overlayOpacity?: number; // 0-100
}

// ============================================================================
// FOVSimulator
// ============================================================================

export interface FOVSimulatorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  pixelSize?: number;
  rotationAngle?: number;
  selectedTarget?: {
    name: string;
    raDeg: number;
    decDeg: number;
    size?: string;
  } | null;
  onSensorWidthChange: (width: number) => void;
  onSensorHeightChange: (height: number) => void;
  onFocalLengthChange: (length: number) => void;
  onPixelSizeChange?: (size: number) => void;
  onRotationAngleChange?: (angle: number) => void;
  onCenterTarget?: (ra: number, dec: number) => void;
  mosaic: MosaicSettings;
  onMosaicChange: (mosaic: MosaicSettings) => void;
  gridType: GridType;
  onGridTypeChange: (type: GridType) => void;
}

// ============================================================================
// NumberStepper
// ============================================================================

export interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

// ============================================================================
// OcularSimulator
// ============================================================================

/** Result of ocular view calculation */
export interface OcularViewResult {
  magnification: number;
  tfov: number;
  exitPupil: number;
  dawesLimit: number;
  rayleighLimit: number;
  maxUsefulMag: number;
  minUsefulMag: number;
  bestPlanetaryMag: number;
  focalRatio: number;
  lightGathering: number;
  limitingMag: number;
  surfaceBrightness: number;
  isOverMagnified: boolean;
  isUnderMagnified: boolean;
  effectiveFocalLength: number;
  observingSuggestion: 'deepsky' | 'allround' | 'planetary' | 'overlimit';
}

/** Props for ocular view preview sub-component */
export interface OcularViewPreviewProps {
  tfov: number;
  magnification: number;
  exitPupil: number;
  isOverMagnified: boolean;
  isUnderMagnified: boolean;
}

export interface OcularSimulatorProps {
  onApplyFov?: (fovDeg: number) => void;
  currentFov?: number;
}

export interface OcularOverlayProps {
  enabled: boolean;
  tfov: number | null;
  currentFov: number;
  opacity: number;
  showCrosshair?: boolean;
}

/** Pre-generated star data for ocular view simulation */
export interface OcularStar {
  id: number;
  size: number;
  left: number;
  top: number;
  opacity: number;
}

// ============================================================================
// SatelliteOverlay
// ============================================================================

export interface SatelliteOverlayProps {
  containerWidth: number;
  containerHeight: number;
  onSatelliteClick?: (satellite: SatelliteData) => void;
}

export interface SatelliteMarkerProps {
  satellite: SatelliteData;
  x: number;
  y: number;
  showLabel: boolean;
  onClick?: () => void;
}

export interface SatelliteTrailProps {
  points: Array<{ x: number; y: number }>;
  color: string;
  containerWidth: number;
  containerHeight: number;
}

// ============================================================================
// SatelliteTracker
// ============================================================================

export interface SatelliteCardProps {
  satellite: SatelliteData;
  onTrack: () => void;
}

export interface PassCardProps {
  pass: CelesTrakSatellitePass;
  onTrack: () => void;
}

// ============================================================================
// SkyMarkers
// ============================================================================

export interface SkyMarkersProps {
  containerWidth: number;
  containerHeight: number;
  interactionOnly?: boolean;
  onMarkerClick?: (marker: SkyMarker) => void;
  onMarkerDoubleClick?: (marker: SkyMarker) => void;
  onMarkerEdit?: (marker: SkyMarker) => void;
  onMarkerDelete?: (marker: SkyMarker) => void;
  onMarkerNavigate?: (marker: SkyMarker) => void;
}

// ============================================================================
// StatusBar
// ============================================================================

export interface StatusBarProps {
  currentFov: number;
  className?: string;
}

/** Sky quality assessment level */
export type SkyQuality = 'excellent' | 'good' | 'fair' | 'poor';

/** Astronomical conditions data */
export interface AstroConditions {
  moonPhase: number;
  moonPhaseName: string;
  moonIllumination: number;
  moonAltitude: number;
  sunAltitude: number;
  twilight: {
    sunset: Date | null;
    sunrise: Date | null;
    astronomicalDusk: Date | null;
    astronomicalDawn: Date | null;
  };
  lstString: string;
  skyQuality: SkyQuality;
  isDark: boolean;
  isTwilight: boolean;
}
