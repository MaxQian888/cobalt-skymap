/**
 * FOV (Field of View) calculation utilities
 * Pure functions for camera FOV, mosaic coverage, and overlay dimension calculations
 */

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

export type MosaicLayoutMode = 'rectangular' | 'staggered';
export type MosaicPanelOrder = 'row-major' | 'serpentine' | 'center-out';

export interface MosaicSettings {
  enabled: boolean;
  rows: number;
  cols: number;
  overlap: number;
  overlapUnit?: 'percent' | 'pixels';
  layoutMode?: MosaicLayoutMode;
  panelOrder?: MosaicPanelOrder;
}

export interface NormalizedMosaicSettings extends MosaicSettings {
  overlapUnit: 'percent' | 'pixels';
  layoutMode: MosaicLayoutMode;
  panelOrder: MosaicPanelOrder;
}

export interface ResolvedMosaicPanel {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  centerOffsetX: number;
  centerOffsetY: number;
  sequence: number;
  isCenter: boolean;
}

export interface ResolvedMosaicPlan {
  layoutMode: MosaicLayoutMode;
  panelOrder: MosaicPanelOrder;
  totalPanels: number;
  width: number;
  height: number;
  overlapFactor: number;
  estimatedPanelMinutes: number | null;
  estimatedTotalMinutes: number | null;
  panels: ResolvedMosaicPanel[];
  warnings: MosaicValidationIssue[];
}

export interface MosaicExposurePlanInput {
  totalExposure?: number;
  advanced?: {
    stackEstimate?: {
      estimatedTotalMinutes?: number;
    };
  };
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
  | 'overlap_high'
  | 'estimated_time_high'
  | 'estimated_time_extreme';

export interface MosaicValidationIssue {
  code: MosaicValidationIssueCode;
  severity: 'error' | 'warning';
  actual?: number;
  min?: number;
  max?: number;
}

export interface MosaicValidationResult {
  sanitized: NormalizedMosaicSettings;
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
const DEFAULT_MOSAIC_OVERLAP_UNIT: NormalizedMosaicSettings['overlapUnit'] = 'percent';
const DEFAULT_MOSAIC_LAYOUT_MODE: MosaicLayoutMode = 'rectangular';
const DEFAULT_MOSAIC_PANEL_ORDER: MosaicPanelOrder = 'row-major';
const MOSAIC_ESTIMATED_TIME_WARN_MINUTES = 240;
const MOSAIC_ESTIMATED_TIME_EXTREME_MINUTES = 480;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isMosaicOverlapUnit(value: unknown): value is NormalizedMosaicSettings['overlapUnit'] {
  return value === 'percent' || value === 'pixels';
}

function isMosaicLayoutMode(value: unknown): value is MosaicLayoutMode {
  return value === 'rectangular' || value === 'staggered';
}

function isMosaicPanelOrder(value: unknown): value is MosaicPanelOrder {
  return value === 'row-major' || value === 'serpentine' || value === 'center-out';
}

function resolveMosaicOverlapFactor(
  mosaic: NormalizedMosaicSettings,
  resolution: { width: number; height: number }
): number {
  if (mosaic.overlapUnit === 'pixels') {
    const resolutionWidth = Math.max(resolution.width, 1);
    return clamp(1 - mosaic.overlap / resolutionWidth, 0, 1);
  }

  return clamp(1 - mosaic.overlap / 100, 0, 1);
}

interface RawMosaicPanel {
  row: number;
  col: number;
  x: number;
  y: number;
}

function calculateMosaicPanelGeometry(
  panelWidth: number,
  panelHeight: number,
  stepX: number,
  stepY: number,
  mosaic: NormalizedMosaicSettings
): {
  panels: RawMosaicPanel[];
  width: number;
  height: number;
  centerX: number;
  centerY: number;
} {
  const rawPanels: RawMosaicPanel[] = [];

  for (let row = 0; row < mosaic.rows; row++) {
    const rowOffsetX = mosaic.layoutMode === 'staggered' && row % 2 === 1
      ? stepX / 2
      : 0;

    for (let col = 0; col < mosaic.cols; col++) {
      rawPanels.push({
        row,
        col,
        x: rowOffsetX + col * stepX,
        y: row * stepY,
      });
    }
  }

  if (rawPanels.length === 0) {
    return {
      panels: [],
      width: panelWidth,
      height: panelHeight,
      centerX: panelWidth / 2,
      centerY: panelHeight / 2,
    };
  }

  const minX = Math.min(...rawPanels.map((panel) => panel.x));
  const minY = Math.min(...rawPanels.map((panel) => panel.y));
  const maxX = Math.max(...rawPanels.map((panel) => panel.x + panelWidth));
  const maxY = Math.max(...rawPanels.map((panel) => panel.y + panelHeight));
  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = width / 2;
  const centerY = height / 2;

  return {
    panels: rawPanels.map((panel) => ({
      ...panel,
      x: panel.x - minX,
      y: panel.y - minY,
    })),
    width,
    height,
    centerX,
    centerY,
  };
}

function buildPanelSequence(
  panels: RawMosaicPanel[],
  panelWidth: number,
  panelHeight: number,
  centerX: number,
  centerY: number,
  order: MosaicPanelOrder
): Map<string, number> {
  const sortable = panels.map((panel) => ({
    ...panel,
    key: `${panel.row}-${panel.col}`,
    centerOffsetX: panel.x + panelWidth / 2 - centerX,
    centerOffsetY: panel.y + panelHeight / 2 - centerY,
  }));

  if (order === 'row-major') {
    sortable.sort((a, b) => a.row - b.row || a.col - b.col);
  } else if (order === 'serpentine') {
    sortable.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.row % 2 === 0 ? a.col - b.col : b.col - a.col;
    });
  } else {
    sortable.sort((a, b) => {
      const aDistance = Math.hypot(a.centerOffsetX, a.centerOffsetY);
      const bDistance = Math.hypot(b.centerOffsetX, b.centerOffsetY);
      return aDistance - bDistance || a.row - b.row || a.col - b.col;
    });
  }

  return new Map(sortable.map((panel, index) => [panel.key, index + 1]));
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

  const overlapUnit = isMosaicOverlapUnit(mosaic.overlapUnit)
    ? mosaic.overlapUnit
    : DEFAULT_MOSAIC_OVERLAP_UNIT;
  const layoutMode = isMosaicLayoutMode(mosaic.layoutMode)
    ? mosaic.layoutMode
    : DEFAULT_MOSAIC_LAYOUT_MODE;
  const panelOrder = isMosaicPanelOrder(mosaic.panelOrder)
    ? mosaic.panelOrder
    : DEFAULT_MOSAIC_PANEL_ORDER;

  const overlapMax = overlapUnit === 'percent'
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

  const highOverlapThreshold = overlapUnit === 'percent' ? 40 : 400;
  if (overlap > highOverlapThreshold) {
    issues.push({ code: 'overlap_high', severity: 'warning', actual: overlap, max: highOverlapThreshold });
  }

  return {
    sanitized: {
      ...mosaic,
      rows,
      cols,
      overlap,
      overlapUnit,
      layoutMode,
      panelOrder,
    },
    issues,
  };
}

export function buildResolvedMosaicPlan(
  panelWidth: number,
  panelHeight: number,
  mosaic: MosaicSettings,
  resolution: { width: number; height: number },
  estimatedPanelMinutes?: number | null
): ResolvedMosaicPlan | null {
  if (!mosaic.enabled) return null;

  const validation = validateMosaicSettings(mosaic);
  const sanitized = validation.sanitized;
  const overlapFactor = resolveMosaicOverlapFactor(sanitized, resolution);
  const stepX = panelWidth * overlapFactor;
  const stepY = panelHeight * overlapFactor;
  const geometry = calculateMosaicPanelGeometry(panelWidth, panelHeight, stepX, stepY, sanitized);
  const sequenceMap = buildPanelSequence(
    geometry.panels,
    panelWidth,
    panelHeight,
    geometry.centerX,
    geometry.centerY,
    sanitized.panelOrder
  );
  const centerSequence = Math.min(...sequenceMap.values());

  const panels: ResolvedMosaicPanel[] = geometry.panels.map((panel) => {
    const centerOffsetX = panel.x + panelWidth / 2 - geometry.centerX;
    const centerOffsetY = panel.y + panelHeight / 2 - geometry.centerY;
    const sequence = sequenceMap.get(`${panel.row}-${panel.col}`) ?? Number.MAX_SAFE_INTEGER;
    const distance = Math.hypot(centerOffsetX, centerOffsetY);
    const nearestDistance = Math.min(
      ...geometry.panels.map((candidate) => {
        const candidateOffsetX = candidate.x + panelWidth / 2 - geometry.centerX;
        const candidateOffsetY = candidate.y + panelHeight / 2 - geometry.centerY;
        return Math.hypot(candidateOffsetX, candidateOffsetY);
      })
    );

    return {
      id: `panel-r${panel.row + 1}-c${panel.col + 1}`,
      row: panel.row,
      col: panel.col,
      x: panel.x,
      y: panel.y,
      centerOffsetX,
      centerOffsetY,
      sequence,
      isCenter: Math.abs(distance - nearestDistance) < 1e-6 && sequence === centerSequence,
    };
  });

  const normalizedEstimatedPanelMinutes = typeof estimatedPanelMinutes === 'number' && Number.isFinite(estimatedPanelMinutes) && estimatedPanelMinutes > 0
    ? estimatedPanelMinutes
    : null;
  const estimatedTotalMinutes = normalizedEstimatedPanelMinutes === null
    ? null
    : normalizedEstimatedPanelMinutes * panels.length;
  const warnings = [...validation.issues];

  if (estimatedTotalMinutes !== null) {
    if (estimatedTotalMinutes > MOSAIC_ESTIMATED_TIME_EXTREME_MINUTES) {
      warnings.push({
        code: 'estimated_time_extreme',
        severity: 'warning',
        actual: estimatedTotalMinutes,
        max: MOSAIC_ESTIMATED_TIME_EXTREME_MINUTES,
      });
    } else if (estimatedTotalMinutes > MOSAIC_ESTIMATED_TIME_WARN_MINUTES) {
      warnings.push({
        code: 'estimated_time_high',
        severity: 'warning',
        actual: estimatedTotalMinutes,
        max: MOSAIC_ESTIMATED_TIME_WARN_MINUTES,
      });
    }
  }

  return {
    layoutMode: sanitized.layoutMode,
    panelOrder: sanitized.panelOrder,
    totalPanels: panels.length,
    width: geometry.width,
    height: geometry.height,
    overlapFactor,
    estimatedPanelMinutes: normalizedEstimatedPanelMinutes,
    estimatedTotalMinutes,
    panels: panels.sort((a, b) => a.row - b.row || a.col - b.col),
    warnings,
  };
}

export function resolveEstimatedPanelMinutes(
  exposurePlan?: MosaicExposurePlanInput | null
): number | null {
  if (!exposurePlan) return null;

  const stackEstimateMinutes = exposurePlan.advanced?.stackEstimate?.estimatedTotalMinutes;
  if (typeof stackEstimateMinutes === 'number' && Number.isFinite(stackEstimateMinutes) && stackEstimateMinutes > 0) {
    return stackEstimateMinutes;
  }

  if (typeof exposurePlan.totalExposure === 'number' && Number.isFinite(exposurePlan.totalExposure) && exposurePlan.totalExposure > 0) {
    return exposurePlan.totalExposure;
  }

  return null;
}

export function applyEstimatedPanelMinutesToPlan(
  plan: ResolvedMosaicPlan,
  estimatedPanelMinutes?: number | null
): ResolvedMosaicPlan {
  const normalizedEstimatedPanelMinutes = typeof estimatedPanelMinutes === 'number' && Number.isFinite(estimatedPanelMinutes) && estimatedPanelMinutes > 0
    ? estimatedPanelMinutes
    : null;
  const estimatedTotalMinutes = normalizedEstimatedPanelMinutes === null
    ? null
    : normalizedEstimatedPanelMinutes * plan.totalPanels;
  const warnings = plan.warnings.filter(
    (warning) => warning.code !== 'estimated_time_high' && warning.code !== 'estimated_time_extreme'
  );

  if (estimatedTotalMinutes !== null) {
    if (estimatedTotalMinutes > MOSAIC_ESTIMATED_TIME_EXTREME_MINUTES) {
      warnings.push({
        code: 'estimated_time_extreme',
        severity: 'warning',
        actual: estimatedTotalMinutes,
        max: MOSAIC_ESTIMATED_TIME_EXTREME_MINUTES,
      });
    } else if (estimatedTotalMinutes > MOSAIC_ESTIMATED_TIME_WARN_MINUTES) {
      warnings.push({
        code: 'estimated_time_high',
        severity: 'warning',
        actual: estimatedTotalMinutes,
        max: MOSAIC_ESTIMATED_TIME_WARN_MINUTES,
      });
    }
  }

  return {
    ...plan,
    estimatedPanelMinutes: normalizedEstimatedPanelMinutes,
    estimatedTotalMinutes,
    warnings,
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
  const plan = buildResolvedMosaicPlan(fovWidth, fovHeight, mosaic, resolution);
  if (!plan) return null;

  return {
    width: plan.width,
    height: plan.height,
    totalPanels: plan.totalPanels,
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
    overlapFactor = resolveMosaicOverlapFactor(validatedMosaic, { width: resolutionWidth, height: Math.round((sensorHeight * 1000) / pixelSize) });
  } else {
    overlapFactor = resolveMosaicOverlapFactor(validatedMosaic, { width: 1, height: 1 });
  }

  const panelWidthPx = overlayWidthPx;
  const panelHeightPx = overlayHeightPx;
  const geometry = calculateMosaicPanelGeometry(
    panelWidthPx,
    panelHeightPx,
    panelWidthPx * overlapFactor,
    panelHeightPx * overlapFactor,
    validatedMosaic
  );
  const totalMosaicWidthPx = geometry.width;
  const totalMosaicHeightPx = geometry.height;

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
