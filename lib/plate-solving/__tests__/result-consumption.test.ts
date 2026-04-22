import type { ImageAnalysisResult } from '@/lib/tauri/plate-solver-api';
import type { PlateSolveResult } from '../types';
import {
  buildSolveResultConsumption,
  buildSolveHistoryResultSummary,
} from '../result-consumption';

describe('result-consumption', () => {
  const imageAnalysis: ImageAnalysisResult = {
    success: true,
    median_hfd: 2.3,
    star_count: 124,
    background: 1200,
    noise: 45,
    stars: [],
    error_message: null,
  };

  const result: PlateSolveResult = {
    success: true,
    coordinates: {
      ra: 10.6847083,
      dec: 41.26875,
      raHMS: '00h42m44s',
      decDMS: '+41d16m09s',
    },
    positionAngle: 15.5,
    pixelScale: 1.2,
    fov: { width: 2.5, height: 1.8 },
    flipped: false,
    solverName: 'Astrometry.net (Online)',
    solveTime: 5200,
    onlineSolve: {
      runtime: 'web',
      operationId: 'op-1',
      submissionId: 42,
      jobId: 77,
      objectsInField: ['M31', 'NGC 224'],
      annotations: [
        {
          names: ['M31'],
          annotationType: 'galaxy',
          pixelX: 1500.5,
          pixelY: 1000.5,
          radius: 42,
        },
      ],
      wcs: {
        referencePixel: { x: 1500.5, y: 1000.5 },
        referenceCoordinates: { ra: 10.6847083, dec: 41.26875 },
        cdMatrix: [-0.00012, 0, 0, 0.00012],
        pixelScale: 1.2,
        rotation: 0,
      },
      frameSize: { width: 3000, height: 2000 },
      diagnostics: {
        annotations: 'complete',
        wcs: 'complete',
        issues: [],
      },
      errorCode: null,
      errorMessage: null,
    },
  };

  it('builds a consolidated result-consumption summary from solve and image-analysis data', () => {
    const consumption = buildSolveResultConsumption(result, { imageAnalysis });

    expect(consumption.success).toBe(true);
    expect(consumption.objects.previewNames).toEqual(['M31', 'NGC 224']);
    expect(consumption.artifacts.annotationCount).toBe(1);
    expect(consumption.analysis).toEqual({
      available: true,
      success: true,
      starCount: 124,
      medianHfd: 2.3,
      background: 1200,
      noise: 45,
      errorMessage: null,
    });
  });

  it('derives actionable annotation coordinates when WCS metadata is complete', () => {
    const consumption = buildSolveResultConsumption(result, { imageAnalysis });
    const [annotation] = consumption.annotations;

    expect(annotation.actionability.canNavigate).toBe(true);
    expect(annotation.actionability.canCreateMarker).toBe(true);
    expect(annotation.derivedCoordinates).toEqual({
      ra: expect.closeTo(10.6847083, 6),
      dec: expect.closeTo(41.26875, 6),
    });
  });

  it('keeps annotations informational when WCS metadata is incomplete', () => {
    const noWcsConsumption = buildSolveResultConsumption({
      ...result,
      onlineSolve: {
        ...result.onlineSolve!,
        wcs: null,
        diagnostics: {
          ...result.onlineSolve!.diagnostics,
          wcs: 'missing',
          issues: [{ artifact: 'wcs', message: 'WCS unavailable' }],
        },
      },
    });

    const [annotation] = noWcsConsumption.annotations;
    expect(annotation.actionability.canNavigate).toBe(false);
    expect(annotation.actionability.canCreateMarker).toBe(false);
    expect(annotation.actionability.disabledReason).toBe('missing_wcs');
    expect(annotation.derivedCoordinates).toBeNull();
  });

  it('creates backward-compatible history summaries with safe defaults', () => {
    const summary = buildSolveHistoryResultSummary(result, undefined);

    expect(summary.objects.previewNames).toEqual(['M31', 'NGC 224']);
    expect(summary.analysis.available).toBe(false);
    expect(summary.annotations[0]?.actionability.canNavigate).toBe(true);
  });
});
