/**
 * FOV (Field of View) calculation utilities
 * Pure functions for camera FOV, mosaic coverage, and overlay dimension calculations
 */

import type { MosaicSettings } from '@/lib/stores';

// ============================================================================
// Camera FOV Calculations
// ============================================================================

/**
 * Calculate camera field of view in degrees from sensor dimensions and focal length
 */
export function calculateCameraFov(
  sensorWidth: number,
  sensorHeight: number,
  focalLength: number
): { width: number; height: number } {
  return {
    width: (2 * Math.atan(sensorWidth / (2 * focalLength)) * 180) / Math.PI,
    height: (2 * Math.atan(sensorHeight / (2 * focalLength)) * 180) / Math.PI,
  };
}

/**
 * Calculate image scale in arcseconds per pixel
 */
export function calculateImageScale(pixelSize: number, focalLength: number): number {
  return (206.265 * pixelSize) / focalLength;
}

/**
 * Calculate sensor resolution in pixels from physical dimensions and pixel size
 */
export function calculateSensorResolution(
  sensorWidth: number,
  sensorHeight: number,
  pixelSize: number
): { width: number; height: number } {
  return {
    width: Math.round((sensorWidth * 1000) / pixelSize),
    height: Math.round((sensorHeight * 1000) / pixelSize),
  };
}

// ============================================================================
// Mosaic Calculations
// ============================================================================

/** Mosaic coverage result */
export interface MosaicCoverage {
  width: number;
  height: number;
  totalPanels: number;
}

export interface FramePlacement {
  x: number;
  y: number;
}

export type FOVFitStatus = 'too_large' | 'tight' | 'good' | 'roomy';

export interface ParsedAngularSizeArcmin {
  widthArcmin: number;
  heightArcmin: number;
  majorArcmin: number;
  minorArcmin: number;
}

export interface TargetFitEvaluation {
  status: FOVFitStatus;
  fitRatio: number;
  targetMajorArcmin: number;
  frameMinArcmin: number;
}

export type MosaicValidationIssueCode =
  | 'rows_clamped'
  | 'cols_clamped'
  | 'overlap_clamped'
  | 'panel_count_high'
  | 'panel_count_extreme'
  | 'overlap_high';

export interface MosaicValidationIssue {
  code: MosaicValidationIssueCode;
  severity: 'error' | 'warning';
  actual?: number;
  min?: number;
  max?: number;
}

export interface MosaicValidationResult {
  sanitized: MosaicSettings;
  issues: MosaicValidationIssue[];
}

const MOSAIC_ROWS_MIN = 1;
const MOSAIC_ROWS_MAX = 10;
const MOSAIC_COLS_MIN = 1;
const MOSAIC_COLS_MAX = 10;
const MOSAIC_OVERLAP_PERCENT_MAX = 50;
const MOSAIC_OVERLAP_PIXELS_MAX = 500;
const MOSAIC_PANEL_COUNT_WARN = 16;
const MOSAIC_PANEL_COUNT_EXTREME = 36;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Resolve effective focal length using an optional accessory factor.
 * Invalid factors fall back to the base focal length.
 */
export function resolveEffectiveFocalLength(
  baseFocalLength: number,
  accessoryFactor?: number | null
): number {
  if (!Number.isFinite(baseFocalLength) || baseFocalLength <= 0) {
    return 0;
  }
  const validAccessoryFactor = typeof accessoryFactor === 'number' && Number.isFinite(accessoryFactor) && accessoryFactor > 0
    ? accessoryFactor
    : null;
  if (validAccessoryFactor === null) {
    return baseFocalLength;
  }
  return baseFocalLength * validAccessoryFactor;
}

/**
 * Clamp normalized frame placement offsets to visible overlay bounds.
 */
export function clampFramePlacement(placement: FramePlacement): FramePlacement {
  return {
    x: clamp(placement.x, -1, 1),
    y: clamp(placement.y, -1, 1),
  };
}

function toArcmin(value: number, rawUnit: string | undefined, fallbackUnit: string): number {
  const unit = (rawUnit || fallbackUnit).toLowerCase();
  if (unit.includes('"') || unit.includes('arcsec') || unit.includes('″')) {
    return value / 60;
  }
  if (unit.includes('°') || unit.includes('deg') || unit === 'd') {
    return value * 60;
  }
  return value;
}

/**
 * Parse angular-size strings like `120' x 90'`, `2.0° × 1.5°`, `30" x 20"`.
 * Returns arcminutes or `null` if no numeric size can be extracted.
 */
export function parseAngularSizeArcmin(sizeText?: string | null): ParsedAngularSizeArcmin | null {
  if (!sizeText || typeof sizeText !== 'string') return null;

  const normalized = sizeText
    .replaceAll('×', 'x')
    .replaceAll('′', "'")
    .replaceAll('″', '"')
    .trim();

  const matches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(°|deg|d|arcmin|arcsec|'|")?/gi)];
  if (matches.length === 0) return null;

  const firstValue = Number.parseFloat(matches[0][1] ?? '');
  if (!Number.isFinite(firstValue) || firstValue <= 0) return null;

  const firstUnit = matches[0][2] ?? "'";
  const secondValue = Number.parseFloat(matches[1]?.[1] ?? `${firstValue}`);
  const secondUnit = matches[1]?.[2] ?? firstUnit;

  const widthArcmin = toArcmin(firstValue, firstUnit, "'");
  const heightArcmin = toArcmin(secondValue, secondUnit, firstUnit);
  if (!(widthArcmin > 0) || !(heightArcmin > 0)) return null;

  return {
    widthArcmin,
    heightArcmin,
    majorArcmin: Math.max(widthArcmin, heightArcmin),
    minorArcmin: Math.min(widthArcmin, heightArcmin),
  };
}

/**
 * Evaluate selected-target fit status against the active frame footprint.
 */
export function evaluateTargetFit(
  targetMajorArcmin: number,
  fovWidthDeg: number,
  fovHeightDeg: number
): TargetFitEvaluation | null {
  if (!Number.isFinite(targetMajorArcmin) || targetMajorArcmin <= 0) return null;
  if (!Number.isFinite(fovWidthDeg) || !Number.isFinite(fovHeightDeg)) return null;
  if (fovWidthDeg <= 0 || fovHeightDeg <= 0) return null;

  const frameMinArcmin = Math.min(fovWidthDeg, fovHeightDeg) * 60;
  if (frameMinArcmin <= 0) return null;

  const fitRatio = targetMajorArcmin / frameMinArcmin;
  let status: FOVFitStatus = 'roomy';

  if (fitRatio >= 0.98) status = 'too_large';
  else if (fitRatio >= 0.72) status = 'tight';
  else if (fitRatio >= 0.38) status = 'good';

  return {
    status,
    fitRatio,
    targetMajorArcmin,
    frameMinArcmin,
  };
}

/**
 * Parse a target size string and evaluate fit in one step.
 */
export function evaluateTargetFitFromSize(
  sizeText: string | undefined,
  fovWidthDeg: number,
  fovHeightDeg: number
): TargetFitEvaluation | null {
  const parsed = parseAngularSizeArcmin(sizeText);
  if (!parsed) return null;
  return evaluateTargetFit(parsed.majorArcmin, fovWidthDeg, fovHeightDeg);
}

/**
 * Validate mosaic inputs, clamp invalid values, and return warning/error issues.
 */
export function validateMosaicSettings(mosaic: MosaicSettings): MosaicValidationResult {
  const issues: MosaicValidationIssue[] = [];

  const rows = clamp(Math.round(mosaic.rows), MOSAIC_ROWS_MIN, MOSAIC_ROWS_MAX);
  const cols = clamp(Math.round(mosaic.cols), MOSAIC_COLS_MIN, MOSAIC_COLS_MAX);

  if (rows !== mosaic.rows) {
    issues.push({ code: 'rows_clamped', severity: 'error', actual: mosaic.rows, min: MOSAIC_ROWS_MIN, max: MOSAIC_ROWS_MAX });
  }
  if (cols !== mosaic.cols) {
    issues.push({ code: 'cols_clamped', severity: 'error', actual: mosaic.cols, min: MOSAIC_COLS_MIN, max: MOSAIC_COLS_MAX });
  }

  const overlapMax = mosaic.overlapUnit === 'percent'
    ? MOSAIC_OVERLAP_PERCENT_MAX
    : MOSAIC_OVERLAP_PIXELS_MAX;
  const overlap = clamp(mosaic.overlap, 0, overlapMax);
  if (overlap !== mosaic.overlap) {
    issues.push({ code: 'overlap_clamped', severity: 'error', actual: mosaic.overlap, min: 0, max: overlapMax });
  }

  const totalPanels = rows * cols;
  if (totalPanels > MOSAIC_PANEL_COUNT_EXTREME) {
    issues.push({ code: 'panel_count_extreme', severity: 'warning', actual: totalPanels, max: MOSAIC_PANEL_COUNT_EXTREME });
  } else if (totalPanels > MOSAIC_PANEL_COUNT_WARN) {
    issues.push({ code: 'panel_count_high', severity: 'warning', actual: totalPanels, max: MOSAIC_PANEL_COUNT_WARN });
  }

  const highOverlapThreshold = mosaic.overlapUnit === 'percent' ? 40 : 400;
  if (overlap > highOverlapThreshold) {
    issues.push({ code: 'overlap_high', severity: 'warning', actual: overlap, max: highOverlapThreshold });
  }

  return {
    sanitized: {
      ...mosaic,
      rows,
      cols,
      overlap,
    },
    issues,
  };
}

/**
 * Calculate total mosaic coverage in degrees
 */
export function calculateMosaicCoverage(
  fovWidth: number,
  fovHeight: number,
  mosaic: MosaicSettings,
  resolution: { width: number; height: number }
): MosaicCoverage | null {
  if (!mosaic.enabled) return null;
  const validated = validateMosaicSettings(mosaic).sanitized;
  const overlapFactor = validated.overlapUnit === 'percent'
    ? (1 - validated.overlap / 100)
    : (1 - validated.overlap / (resolution.width / validated.cols));
  return {
    width: fovWidth * validated.cols * overlapFactor + fovWidth * (1 - overlapFactor),
    height: fovHeight * validated.rows * overlapFactor + fovHeight * (1 - overlapFactor),
    totalPanels: validated.rows * validated.cols,
  };
}

// ============================================================================
// Overlay Dimension Calculations
// ============================================================================

/** Overlay dimension result for rendering */
export interface OverlayDimensions {
  /** Single panel width in pixels */
  panelWidthPx: number;
  /** Single panel height in pixels */
  panelHeightPx: number;
  /** Total mosaic width in pixels */
  totalMosaicWidthPx: number;
  /** Total mosaic height in pixels */
  totalMosaicHeightPx: number;
  /** Whether the FOV is too large to display */
  isTooLarge: boolean;
  /** Scale factor applied for clamping */
  scale: number;
  /** Scaled panel width */
  scaledPanelWidth: number;
  /** Scaled panel height */
  scaledPanelHeight: number;
  /** Scaled horizontal step between panels */
  scaledStepX: number;
  /** Scaled vertical step between panels */
  scaledStepY: number;
  /** Scaled total width */
  scaledTotalWidth: number;
  /** Scaled total height */
  scaledTotalHeight: number;
  /** Camera FOV width in degrees */
  cameraFovWidth: number;
  /** Camera FOV height in degrees */
  cameraFovHeight: number;
}

/**
 * Calculate all overlay pixel dimensions for rendering the FOV rectangle
 */
export function calculateOverlayDimensions(
  sensorWidth: number,
  sensorHeight: number,
  focalLength: number,
  currentFov: number,
  containerWidth: number,
  containerHeight: number,
  mosaic: MosaicSettings,
  pixelSize?: number
): OverlayDimensions {
  const validatedMosaic = validateMosaicSettings(mosaic).sanitized;

  // Calculate camera FOV in degrees
  const { width: cameraFovWidth, height: cameraFovHeight } =
    calculateCameraFov(sensorWidth, sensorHeight, focalLength);

  // Calculate the view's vertical FOV using proper perspective math
  const safeHeight = Math.max(containerHeight, 1);
  const viewAspect = containerWidth / safeHeight;
  const deg2rad = Math.PI / 180;
  const horizontalFovRad = currentFov * deg2rad;
  const verticalFovRad = viewAspect > 0
    ? 2 * Math.atan(Math.tan(horizontalFovRad / 2) / viewAspect)
    : horizontalFovRad;
  const viewFovVerticalDeg = (verticalFovRad * 180) / Math.PI;

  // Scale camera frame by degree ratios to match background imagery
  const overlayWidthPx = containerWidth * (cameraFovWidth / currentFov);
  const overlayHeightPx = safeHeight * (cameraFovHeight / viewFovVerticalDeg);

  // Calculate mosaic dimensions
  const mosaicCols = validatedMosaic.enabled ? validatedMosaic.cols : 1;
  const mosaicRows = validatedMosaic.enabled ? validatedMosaic.rows : 1;
  let overlapFactor: number;
  if (validatedMosaic.overlapUnit === 'pixels' && pixelSize && pixelSize > 0) {
    const resolutionWidth = Math.round((sensorWidth * 1000) / pixelSize);
    overlapFactor = 1 - validatedMosaic.overlap / (resolutionWidth / mosaicCols);
  } else {
    overlapFactor = 1 - validatedMosaic.overlap / 100;
  }

  const panelWidthPx = overlayWidthPx;
  const panelHeightPx = overlayHeightPx;

  const totalMosaicWidthPx = panelWidthPx * (1 + (mosaicCols - 1) * overlapFactor);
  const totalMosaicHeightPx = panelHeightPx * (1 + (mosaicRows - 1) * overlapFactor);

  // Check if FOV is too large to display
  const isTooLarge = totalMosaicWidthPx > containerWidth || totalMosaicHeightPx > containerHeight;

  // Clamp overlay size to reasonable bounds
  const clampedWidth = Math.min(containerWidth * 0.95, Math.max(20, totalMosaicWidthPx));
  const clampedHeight = Math.min(containerHeight * 0.95, Math.max(20, totalMosaicHeightPx));

  // Calculate scale factor for clamped display
  const scaleX = clampedWidth / totalMosaicWidthPx;
  const scaleY = clampedHeight / totalMosaicHeightPx;
  const scale = Math.min(scaleX, scaleY, 1);

  // Scaled panel dimensions
  const scaledPanelWidth = panelWidthPx * scale;
  const scaledPanelHeight = panelHeightPx * scale;
  const scaledStepX = scaledPanelWidth * overlapFactor;
  const scaledStepY = scaledPanelHeight * overlapFactor;
  const scaledTotalWidth = scaledPanelWidth + scaledStepX * (mosaicCols - 1);
  const scaledTotalHeight = scaledPanelHeight + scaledStepY * (mosaicRows - 1);

  return {
    panelWidthPx,
    panelHeightPx,
    totalMosaicWidthPx,
    totalMosaicHeightPx,
    isTooLarge,
    scale,
    scaledPanelWidth,
    scaledPanelHeight,
    scaledStepX,
    scaledStepY,
    scaledTotalWidth,
    scaledTotalHeight,
    cameraFovWidth,
    cameraFovHeight,
  };
}

/** Panel position in the mosaic grid */
export interface MosaicPanel {
  x: number;
  y: number;
  isCenter: boolean;
}

/**
 * Generate mosaic panel positions for rendering
 */
export function calculateMosaicLayout(
  scaledPanelWidth: number,
  scaledPanelHeight: number,
  scaledStepX: number,
  scaledStepY: number,
  mosaicCols: number,
  mosaicRows: number
): MosaicPanel[] {
  const panels: MosaicPanel[] = [];
  for (let row = 0; row < mosaicRows; row++) {
    for (let col = 0; col < mosaicCols; col++) {
      const x = col * scaledStepX;
      const y = row * scaledStepY;
      const isCenter = mosaicCols > 1 || mosaicRows > 1
        ? (col === Math.floor((mosaicCols - 1) / 2) && row === Math.floor((mosaicRows - 1) / 2))
        : true;
      panels.push({ x, y, isCenter });
    }
  }
  return panels;
}
