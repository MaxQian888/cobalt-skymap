/**
 * Tests for fov-calculations.ts
 * Camera FOV, mosaic coverage, overlay dimensions, and mosaic layout calculations
 */

import * as fovCalculations from '../fov-calculations';

const {
  calculateCameraFov,
  calculateImageScale,
  calculateSensorResolution,
  calculateMosaicCoverage,
  buildResolvedMosaicPlan,
  parseAngularSizeArcmin,
  evaluateTargetFit,
  evaluateTargetFitFromSize,
  validateMosaicSettings,
  calculateOverlayDimensions,
  calculateMosaicLayout,
} = fovCalculations;

describe('calculateCameraFov', () => {
  it('should calculate FOV from sensor dimensions and focal length', () => {
    // Typical APS-C sensor (23.5mm x 15.6mm) with 200mm focal length
    const result = calculateCameraFov(23.5, 15.6, 200);
    expect(result.width).toBeCloseTo(6.73, 1);
    expect(result.height).toBeCloseTo(4.47, 1);
  });

  it('should produce wider FOV with shorter focal length', () => {
    const short = calculateCameraFov(23.5, 15.6, 100);
    const long = calculateCameraFov(23.5, 15.6, 400);
    expect(short.width).toBeGreaterThan(long.width);
    expect(short.height).toBeGreaterThan(long.height);
  });

  it('should produce wider FOV with larger sensor', () => {
    const small = calculateCameraFov(10, 10, 200);
    const large = calculateCameraFov(36, 24, 200);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });
});

describe('calculateImageScale', () => {
  it('should calculate image scale in arcsec/pixel', () => {
    // 3.75μm pixel, 1000mm FL → 0.774 arcsec/pixel
    const scale = calculateImageScale(3.75, 1000);
    expect(scale).toBeCloseTo(0.774, 2);
  });

  it('should increase with larger pixels', () => {
    const small = calculateImageScale(3.75, 1000);
    const large = calculateImageScale(7.5, 1000);
    expect(large).toBeGreaterThan(small);
  });
});

describe('calculateSensorResolution', () => {
  it('should calculate resolution from sensor dimensions and pixel size', () => {
    // 23.5mm sensor width, 3.75μm pixel → ~6267 pixels
    const result = calculateSensorResolution(23.5, 15.6, 3.75);
    expect(result.width).toBe(6267);
    expect(result.height).toBe(4160);
  });
});

describe('calculateMosaicCoverage', () => {
  it('should return null when mosaic is disabled', () => {
    const result = calculateMosaicCoverage(
      2, 1.5,
      { enabled: false, rows: 2, cols: 2, overlap: 10, overlapUnit: 'percent' },
      { width: 4000, height: 3000 }
    );
    expect(result).toBeNull();
  });

  it('should calculate coverage for percent overlap', () => {
    const result = calculateMosaicCoverage(
      2, 1.5,
      { enabled: true, rows: 2, cols: 2, overlap: 10, overlapUnit: 'percent' },
      { width: 4000, height: 3000 }
    );
    expect(result).not.toBeNull();
    expect(result!.totalPanels).toBe(4);
    expect(result!.width).toBeGreaterThan(2);
    expect(result!.height).toBeGreaterThan(1.5);
  });

  it('should calculate coverage for pixel overlap', () => {
    const result = calculateMosaicCoverage(
      2, 1.5,
      { enabled: true, rows: 2, cols: 3, overlap: 100, overlapUnit: 'pixels' },
      { width: 4000, height: 3000 }
    );
    expect(result).not.toBeNull();
    expect(result!.totalPanels).toBe(6);
  });
});

describe('effective focal length helpers', () => {
  it('resolves effective focal length with accessory factor', () => {
    const resolveEffectiveFocalLength = (fovCalculations as Record<string, unknown>).resolveEffectiveFocalLength as
      | ((baseFocalLength: number, accessoryFactor?: number | null) => number)
      | undefined;

    expect(resolveEffectiveFocalLength).toBeDefined();
    expect(resolveEffectiveFocalLength?.(500, 0.8)).toBeCloseTo(400);
    expect(resolveEffectiveFocalLength?.(500, 2)).toBeCloseTo(1000);
  });

  it('falls back to base focal length for invalid accessory factors', () => {
    const resolveEffectiveFocalLength = (fovCalculations as Record<string, unknown>).resolveEffectiveFocalLength as
      | ((baseFocalLength: number, accessoryFactor?: number | null) => number)
      | undefined;

    expect(resolveEffectiveFocalLength?.(500, 0)).toBe(500);
    expect(resolveEffectiveFocalLength?.(500, Number.NaN)).toBe(500);
    expect(resolveEffectiveFocalLength?.(500, null)).toBe(500);
  });

  it('returns zero when the base focal length is not positive', () => {
    const resolveEffectiveFocalLength = (fovCalculations as Record<string, unknown>).resolveEffectiveFocalLength as
      | ((baseFocalLength: number, accessoryFactor?: number | null) => number)
      | undefined;

    expect(resolveEffectiveFocalLength?.(0, 2)).toBe(0);
    expect(resolveEffectiveFocalLength?.(-100, 0.8)).toBe(0);
  });
});

describe('parseAngularSizeArcmin', () => {
  it('parses arcminute dimensions', () => {
    const parsed = parseAngularSizeArcmin("120' x 90'");
    expect(parsed).not.toBeNull();
    expect(parsed!.widthArcmin).toBeCloseTo(120);
    expect(parsed!.heightArcmin).toBeCloseTo(90);
    expect(parsed!.majorArcmin).toBeCloseTo(120);
  });

  it('parses degree dimensions', () => {
    const parsed = parseAngularSizeArcmin('2.0° × 1.5°');
    expect(parsed).not.toBeNull();
    expect(parsed!.widthArcmin).toBeCloseTo(120);
    expect(parsed!.heightArcmin).toBeCloseTo(90);
  });

  it('parses arcsecond dimensions', () => {
    const parsed = parseAngularSizeArcmin('30" x 20"');
    expect(parsed).not.toBeNull();
    expect(parsed!.widthArcmin).toBeCloseTo(0.5);
    expect(parsed!.heightArcmin).toBeCloseTo(0.333, 2);
  });

  it('returns null for invalid input', () => {
    expect(parseAngularSizeArcmin(undefined)).toBeNull();
    expect(parseAngularSizeArcmin('unknown')).toBeNull();
  });
});

describe('evaluateTargetFit', () => {
  it('classifies too_large, tight, good, roomy', () => {
    const tooLarge = evaluateTargetFit(120, 1.2, 1.0); // 120/60=2.0
    const tight = evaluateTargetFit(50, 1.2, 1.0); // 50/60=0.83
    const good = evaluateTargetFit(28, 1.2, 1.0); // 28/60=0.47
    const roomy = evaluateTargetFit(10, 1.2, 1.0); // 10/60=0.16

    expect(tooLarge?.status).toBe('too_large');
    expect(tight?.status).toBe('tight');
    expect(good?.status).toBe('good');
    expect(roomy?.status).toBe('roomy');
  });

  it('returns null on invalid input', () => {
    expect(evaluateTargetFit(0, 1, 1)).toBeNull();
    expect(evaluateTargetFit(10, 0, 1)).toBeNull();
  });
});

describe('evaluateTargetFitFromSize', () => {
  it('evaluates fit from size text', () => {
    const result = evaluateTargetFitFromSize("50' x 20'", 1.5, 1.0);
    expect(result).not.toBeNull();
    expect(result!.status).toBe('tight');
  });

  it('returns null when no size available', () => {
    expect(evaluateTargetFitFromSize(undefined, 1, 1)).toBeNull();
  });
});

describe('validateMosaicSettings', () => {
  it('clamps invalid rows, cols, and overlap', () => {
    const result = validateMosaicSettings({
      enabled: true,
      rows: 100,
      cols: -1,
      overlap: 80,
      overlapUnit: 'percent',
    });

    expect(result.sanitized.rows).toBe(10);
    expect(result.sanitized.cols).toBe(1);
    expect(result.sanitized.overlap).toBe(50);
    expect(result.issues.some((i) => i.code === 'rows_clamped')).toBe(true);
    expect(result.issues.some((i) => i.code === 'cols_clamped')).toBe(true);
    expect(result.issues.some((i) => i.code === 'overlap_clamped')).toBe(true);
  });

  it('adds warning for high panel count', () => {
    const result = validateMosaicSettings({
      enabled: true,
      rows: 5,
      cols: 5,
      overlap: 20,
      overlapUnit: 'percent',
    });

    expect(result.issues.some((i) => i.code === 'panel_count_high')).toBe(true);
  });

  it('adds warning for extreme panel count', () => {
    const result = validateMosaicSettings({
      enabled: true,
      rows: 7,
      cols: 6,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'rectangular',
      panelOrder: 'row-major',
    });

    expect(result.issues.some((i) => i.code === 'panel_count_extreme')).toBe(true);
  });

  it('fills advanced planner defaults for legacy mosaic payloads', () => {
    const result = validateMosaicSettings({
      enabled: true,
      rows: 2,
      cols: 3,
      overlap: 15,
      overlapUnit: 'percent',
    } as unknown as Parameters<typeof validateMosaicSettings>[0]);

    expect(result.sanitized.layoutMode).toBe('rectangular');
    expect(result.sanitized.panelOrder).toBe('row-major');
  });
});

describe('buildResolvedMosaicPlan', () => {
  it('builds rectangular plans with row-major ordering', () => {
    const plan = buildResolvedMosaicPlan(2, 1, {
      enabled: true,
      rows: 2,
      cols: 2,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'rectangular',
      panelOrder: 'row-major',
    }, { width: 4000, height: 3000 });

    expect(plan).not.toBeNull();
    expect(plan?.totalPanels).toBe(4);
    expect(plan?.width).toBeCloseTo(3.8);
    expect(plan?.height).toBeCloseTo(1.9);
    expect(plan?.panels.map((panel) => panel.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('offsets alternate rows for staggered layouts', () => {
    const plan = buildResolvedMosaicPlan(2, 1, {
      enabled: true,
      rows: 2,
      cols: 3,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'staggered',
      panelOrder: 'row-major',
    }, { width: 4000, height: 3000 });

    expect(plan).not.toBeNull();
    expect(plan?.panels.find((panel) => panel.row === 1 && panel.col === 0)?.x).toBeGreaterThan(0);
    expect(plan?.width).toBeGreaterThan(5.6);
  });

  it('reorders acquisition sequence for serpentine and center-out modes', () => {
    const serpentine = buildResolvedMosaicPlan(2, 1, {
      enabled: true,
      rows: 2,
      cols: 3,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'rectangular',
      panelOrder: 'serpentine',
    }, { width: 4000, height: 3000 });
    const centerOut = buildResolvedMosaicPlan(2, 1, {
      enabled: true,
      rows: 3,
      cols: 3,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'rectangular',
      panelOrder: 'center-out',
    }, { width: 4000, height: 3000 });

    const serpentineSecondRow = serpentine?.panels
      .filter((panel) => panel.row === 1)
      .sort((a, b) => a.col - b.col)
      .map((panel) => panel.sequence);
    const centerPanel = centerOut?.panels.find((panel) => panel.isCenter);

    expect(serpentineSecondRow).toEqual([6, 5, 4]);
    expect(centerPanel?.sequence).toBe(1);
  });

  it('estimates imaging time when per-panel exposure time is available', () => {
    const plan = buildResolvedMosaicPlan(2, 1, {
      enabled: true,
      rows: 2,
      cols: 2,
      overlap: 10,
      overlapUnit: 'percent',
      layoutMode: 'rectangular',
      panelOrder: 'row-major',
    }, { width: 4000, height: 3000 }, 45);

    expect(plan?.estimatedPanelMinutes).toBe(45);
    expect(plan?.estimatedTotalMinutes).toBe(180);
  });
});

describe('calculateOverlayDimensions', () => {
  const baseMosaic = { enabled: false, rows: 1, cols: 1, overlap: 0, overlapUnit: 'percent' as const };

  it('should calculate single panel overlay dimensions', () => {
    const result = calculateOverlayDimensions(
      23.5, 15.6, 200, 10, 800, 600, baseMosaic
    );
    expect(result.panelWidthPx).toBeGreaterThan(0);
    expect(result.panelHeightPx).toBeGreaterThan(0);
    expect(result.cameraFovWidth).toBeGreaterThan(0);
    expect(result.cameraFovHeight).toBeGreaterThan(0);
  });

  it('should clamp overlay when FOV is too large', () => {
    // Very short focal length → huge FOV relative to view
    const result = calculateOverlayDimensions(
      36, 24, 10, 5, 800, 600, baseMosaic
    );
    expect(result.scale).toBeLessThanOrEqual(1);
  });

  it('should handle mosaic enabled', () => {
    const mosaic = { enabled: true, rows: 2, cols: 2, overlap: 10, overlapUnit: 'percent' as const };
    const result = calculateOverlayDimensions(
      23.5, 15.6, 200, 10, 800, 600, mosaic
    );
    expect(result.totalMosaicWidthPx).toBeGreaterThan(result.panelWidthPx);
    expect(result.totalMosaicHeightPx).toBeGreaterThan(result.panelHeightPx);
  });

  it('should use pixel overlap math when pixel size is provided', () => {
    const mosaic = { enabled: true, rows: 2, cols: 2, overlap: 120, overlapUnit: 'pixels' as const };
    const result = calculateOverlayDimensions(
      23.5, 15.6, 200, 10, 800, 600, mosaic, 3.75
    );

    expect(result.scaledStepX).toBeLessThan(result.scaledPanelWidth);
    expect(result.scaledStepY).toBeLessThan(result.scaledPanelHeight);
  });

  it('should handle zero-width containers by falling back to horizontal fov math', () => {
    const result = calculateOverlayDimensions(
      23.5, 15.6, 200, 10, 0, 0, baseMosaic
    );

    expect(Number.isNaN(result.scale)).toBe(true);
    expect(Number.isFinite(result.cameraFovWidth)).toBe(true);
    expect(result.panelWidthPx).toBe(0);
  });
});

describe('frame placement helpers', () => {
  it('clamps normalized frame placement to visible bounds', () => {
    const clampFramePlacement = (fovCalculations as Record<string, unknown>).clampFramePlacement as
      | ((placement: { x: number; y: number }) => { x: number; y: number })
      | undefined;

    expect(clampFramePlacement).toBeDefined();
    expect(clampFramePlacement?.({ x: 1.4, y: -2.2 })).toEqual({ x: 1, y: -1 });
  });

  it('keeps valid normalized frame placement unchanged', () => {
    const clampFramePlacement = (fovCalculations as Record<string, unknown>).clampFramePlacement as
      | ((placement: { x: number; y: number }) => { x: number; y: number })
      | undefined;

    expect(clampFramePlacement?.({ x: 0.25, y: -0.5 })).toEqual({ x: 0.25, y: -0.5 });
  });
});

describe('calculateMosaicLayout', () => {
  it('should generate correct number of panels', () => {
    const panels = calculateMosaicLayout(100, 80, 90, 72, 3, 2);
    expect(panels).toHaveLength(6);
  });

  it('should mark center panel for multi-panel layout', () => {
    const panels = calculateMosaicLayout(100, 80, 90, 72, 3, 3);
    const centerPanels = panels.filter(p => p.isCenter);
    expect(centerPanels).toHaveLength(1);
    // Center of 3x3 grid is at row=1, col=1
    expect(centerPanels[0].x).toBeCloseTo(90);
    expect(centerPanels[0].y).toBeCloseTo(72);
  });

  it('should mark single panel as center', () => {
    const panels = calculateMosaicLayout(100, 80, 90, 72, 1, 1);
    expect(panels).toHaveLength(1);
    expect(panels[0].isCenter).toBe(true);
    expect(panels[0].x).toBe(0);
    expect(panels[0].y).toBe(0);
  });

  it('should calculate correct positions based on step sizes', () => {
    const panels = calculateMosaicLayout(100, 80, 50, 40, 2, 2);
    expect(panels[0]).toEqual({ x: 0, y: 0, isCenter: true });
    expect(panels[1]).toEqual({ x: 50, y: 0, isCenter: false });
    expect(panels[2]).toEqual({ x: 0, y: 40, isCenter: false });
    expect(panels[3]).toEqual({ x: 50, y: 40, isCenter: false });
  });
});
