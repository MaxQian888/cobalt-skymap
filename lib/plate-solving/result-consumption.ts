import type { ImageAnalysisResult } from '@/lib/tauri/plate-solver-api';
import type { PlateSolveResult, WorldCoordinateSystem } from './types';
import { createWCSTransformFromParams } from './wcs-transform';

export type SolveAnnotationDisabledReason = 'missing_wcs' | 'missing_frame_size';

export interface SolveAnnotationActionability {
  canNavigate: boolean;
  canCreateMarker: boolean;
  disabledReason: SolveAnnotationDisabledReason | null;
}

export interface SolveDerivedCoordinates {
  ra: number;
  dec: number;
}

export interface SolveResultAnnotationSummary {
  names: string[];
  annotationType: string;
  radius: number;
  derivedCoordinates: SolveDerivedCoordinates | null;
  actionability: SolveAnnotationActionability;
}

export interface SolveResultObjectSummary {
  count: number;
  previewNames: string[];
}

export interface SolveResultArtifactSummary {
  annotationCount: number;
  annotationsState: 'complete' | 'missing';
  wcsState: 'complete' | 'missing';
  issueMessages: string[];
}

export interface SolveResultAnalysisSummary {
  available: boolean;
  success: boolean;
  starCount: number;
  medianHfd: number | null;
  background: number | null;
  noise: number | null;
  errorMessage: string | null;
}

export interface SolveResultConsumptionSummary {
  success: boolean;
  objects: SolveResultObjectSummary;
  artifacts: SolveResultArtifactSummary;
  annotations: SolveResultAnnotationSummary[];
  analysis: SolveResultAnalysisSummary;
}

function buildAnalysisSummary(imageAnalysis?: ImageAnalysisResult | null): SolveResultAnalysisSummary {
  if (!imageAnalysis) {
    return {
      available: false,
      success: false,
      starCount: 0,
      medianHfd: null,
      background: null,
      noise: null,
      errorMessage: null,
    };
  }

  return {
    available: true,
    success: imageAnalysis.success,
    starCount: imageAnalysis.star_count,
    medianHfd: imageAnalysis.median_hfd,
    background: imageAnalysis.background,
    noise: imageAnalysis.noise,
    errorMessage: imageAnalysis.error_message,
  };
}

function deriveCoordinates(
  wcs: WorldCoordinateSystem | null,
  pixelX: number,
  pixelY: number
): SolveDerivedCoordinates | null {
  if (!wcs) {
    return null;
  }

  const transform = createWCSTransformFromParams({
    crpix1: wcs.referencePixel.x,
    crpix2: wcs.referencePixel.y,
    crval1: wcs.referenceCoordinates.ra,
    crval2: wcs.referenceCoordinates.dec,
    cd1_1: wcs.cdMatrix[0],
    cd1_2: wcs.cdMatrix[1],
    cd2_1: wcs.cdMatrix[2],
    cd2_2: wcs.cdMatrix[3],
  });

  const world = transform.pixelToWorld({ x: pixelX, y: pixelY });
  if (!Number.isFinite(world.ra) || !Number.isFinite(world.dec)) {
    return null;
  }

  return {
    ra: world.ra,
    dec: world.dec,
  };
}

function buildAnnotationSummary(
  result: PlateSolveResult
): SolveResultAnnotationSummary[] {
  const artifact = result.onlineSolve;
  if (!artifact) {
    return [];
  }

  return artifact.annotations.map((annotation) => {
    const hasFrameSize = artifact.frameSize !== null;
    const derivedCoordinates = hasFrameSize
      ? deriveCoordinates(artifact.wcs, annotation.pixelX, annotation.pixelY)
      : null;

    let disabledReason: SolveAnnotationDisabledReason | null = null;
    if (!artifact.wcs) {
      disabledReason = 'missing_wcs';
    } else if (!hasFrameSize) {
      disabledReason = 'missing_frame_size';
    }

    const canAct = derivedCoordinates !== null && disabledReason === null;

    return {
      names: [...annotation.names],
      annotationType: annotation.annotationType,
      radius: annotation.radius,
      derivedCoordinates,
      actionability: {
        canNavigate: canAct,
        canCreateMarker: canAct,
        disabledReason,
      },
    };
  });
}

export function buildSolveResultConsumption(
  result: PlateSolveResult,
  options: { imageAnalysis?: ImageAnalysisResult | null; maxPreviewNames?: number } = {}
): SolveResultConsumptionSummary {
  const artifact = result.onlineSolve;
  const previewLimit = options.maxPreviewNames ?? 3;
  const annotations = buildAnnotationSummary(result);

  return {
    success: result.success,
    objects: {
      count: artifact?.objectsInField.length ?? 0,
      previewNames: artifact?.objectsInField.slice(0, previewLimit) ?? [],
    },
    artifacts: {
      annotationCount: artifact?.annotations.length ?? 0,
      annotationsState: artifact?.diagnostics.annotations ?? 'missing',
      wcsState: artifact?.diagnostics.wcs ?? 'missing',
      issueMessages: artifact?.diagnostics.issues.map((issue) => issue.message) ?? [],
    },
    annotations,
    analysis: buildAnalysisSummary(options.imageAnalysis),
  };
}

export function buildSolveHistoryResultSummary(
  result: PlateSolveResult,
  imageAnalysis?: ImageAnalysisResult | null
): SolveResultConsumptionSummary {
  return buildSolveResultConsumption(result, { imageAnalysis });
}
