import type { OnlineSolveResult as TauriOnlineSolveResult, OnlineWcsResult } from '@/lib/tauri/plate-solver-api';
import { solveOnline } from '@/lib/tauri/plate-solver-api';
import { secretVaultApi } from '@/lib/tauri/secret-vault-api';
import { type SolveProgress, type UploadOptions, AstrometryApiClient } from './astrometry-api';
import {
  classifyOnlineSolveError,
  createInitialOnlineSolveSessionState,
  isRetryableOnlineError,
  mapTauriProgressToOnlineSession,
  mapWebProgressToOnlineSession,
} from './online-solve-contract';
import {
  createEmptyOnlineSolveArtifact,
  summarizeOnlineSolveArtifact,
  type OnlineSolveDetailedResult,
  type OnlineSolveDiagnostics,
  type OnlineSolveRuntime,
} from './online-solve-types';
import { createErrorResult, parseWCSFromFITS, type PlateSolveResult } from './types';
import { persistFileForLocalSolve } from './solve-utils';

function toNormalizedTauriWcs(wcs: OnlineWcsResult | null): {
  wcs: NonNullable<OnlineSolveDetailedResult['artifact']['wcs']>;
  frameSize: { width: number; height: number } | null;
} | null {
  if (!wcs) {
    return null;
  }

  const parsed = parseWCSFromFITS({
    CRPIX1: wcs.crpix1 ?? undefined,
    CRPIX2: wcs.crpix2 ?? undefined,
    CRVAL1: wcs.crval1 ?? undefined,
    CRVAL2: wcs.crval2 ?? undefined,
    CD1_1: wcs.cd1_1 ?? undefined,
    CD1_2: wcs.cd1_2 ?? undefined,
    CD2_1: wcs.cd2_1 ?? undefined,
    CD2_2: wcs.cd2_2 ?? undefined,
    CDELT1: wcs.cdelt1 ?? undefined,
    CDELT2: wcs.cdelt2 ?? undefined,
    CROTA1: wcs.crota1 ?? undefined,
    CROTA2: wcs.crota2 ?? undefined,
    CTYPE1: wcs.ctype1 ?? undefined,
    CTYPE2: wcs.ctype2 ?? undefined,
    NAXIS1: wcs.naxis1 ?? undefined,
    NAXIS2: wcs.naxis2 ?? undefined,
  });

  if (!parsed) {
    return null;
  }

  return {
    wcs: parsed,
    frameSize:
      typeof wcs.naxis1 === 'number' && typeof wcs.naxis2 === 'number'
        ? { width: wcs.naxis1, height: wcs.naxis2 }
        : null,
  };
}

export function mapTauriOnlineSolveResult(
  online: TauriOnlineSolveResult,
  fallbackOperationId?: string | null
): OnlineSolveDetailedResult {
  const artifact = createEmptyOnlineSolveArtifact('tauri');
  artifact.operationId = online.operation_id ?? fallbackOperationId ?? null;
  artifact.jobId = online.job_id;
  artifact.objectsInField = [...online.objects_in_field];
  artifact.annotations = online.annotations.map((annotation) => ({
    names: [...annotation.names],
    annotationType: annotation.annotation_type,
    pixelX: annotation.pixelx,
    pixelY: annotation.pixely,
    radius: annotation.radius,
  }));
  artifact.diagnostics.annotations = 'complete';
  artifact.errorCode = online.error_code;
  artifact.errorMessage = online.error_message;

  const normalizedWcs = toNormalizedTauriWcs(online.wcs);
  if (normalizedWcs) {
    artifact.wcs = normalizedWcs.wcs;
    artifact.frameSize = normalizedWcs.frameSize;
    artifact.diagnostics.wcs = 'complete';
  } else if (online.wcs) {
    artifact.diagnostics.issues.push({
      artifact: 'wcs',
      message: 'Unable to normalize Tauri WCS payload',
    });
  }

  if (!online.success) {
    const errorPrefix = online.error_code ? `[${online.error_code}] ` : '';
    const solveResult = createErrorResult(
      'astrometry.net',
      `${errorPrefix}${online.error_message ?? 'Online plate solve failed'}`
    );
    solveResult.solveTime = online.solve_time_ms;
    solveResult.onlineSolve = artifact;
    return {
      solveResult,
      artifact,
    };
  }

  const ra = online.ra ?? artifact.wcs?.referenceCoordinates.ra ?? null;
  const dec = online.dec ?? artifact.wcs?.referenceCoordinates.dec ?? null;
  const wcsRotation = artifact.wcs?.rotation ?? null;
  const wcsPixelScale = artifact.wcs?.pixelScale ?? null;
  const frameSize = artifact.frameSize;
  const fovWidth = online.fov_width ?? (
    frameSize?.width && wcsPixelScale ? (frameSize.width * wcsPixelScale) / 3600 : null
  );
  const fovHeight = online.fov_height ?? (
    frameSize?.height && wcsPixelScale ? (frameSize.height * wcsPixelScale) / 3600 : null
  );

  const solveResult: PlateSolveResult = {
    success: true,
    coordinates: ra !== null && dec !== null
      ? {
          ra,
          dec,
          raHMS: `${Math.floor(ra / 15)}h${Math.round((((ra / 15) % 1) * 60)).toString().padStart(2, '0')}m`,
          decDMS: `${dec >= 0 ? '+' : '-'}${Math.abs(dec).toFixed(2)}°`,
        }
      : null,
    positionAngle: online.orientation ?? wcsRotation ?? 0,
    pixelScale: online.pixscale ?? wcsPixelScale ?? 0,
    fov: {
      width: fovWidth ?? 0,
      height: fovHeight ?? 0,
    },
    flipped: (online.parity ?? 1) < 0,
    solverName: 'Astrometry.net (Online)',
    solveTime: online.solve_time_ms,
    onlineSolve: artifact,
  };

  return {
    solveResult,
    artifact,
  };
}

export interface ExecuteOnlineSolveParams {
  runtime: OnlineSolveRuntime;
  file: File;
  onlineApiKey: string;
  options: Partial<UploadOptions>;
  searchRadius: number;
  retryOnFailure: boolean;
  maxRetries: number;
  timeoutSeconds: number;
  effectiveRaHint?: number;
  effectiveDecHint?: number;
  updateSession: (session: ReturnType<typeof createInitialOnlineSolveSessionState>) => void;
  registerWebClient?: ((client: { cancel: () => void } | null) => void) | undefined;
  t: (key: string) => string;
  dependencies?: {
    isNetworkOnline?: () => boolean;
    sleep?: (ms: number) => Promise<void>;
    persistFileForLocalSolve?: typeof persistFileForLocalSolve;
    solveOnline?: typeof solveOnline;
    createWebClient?: (config: ConstructorParameters<typeof AstrometryApiClient>[0]) => Pick<AstrometryApiClient, 'solveDetailed' | 'cancel'>;
    saveApiKey?: (key: string) => Promise<void>;
    listenToTauriProgress?: (
      onProgress: (payload: Parameters<typeof mapTauriProgressToOnlineSession>[0]) => void
    ) => Promise<() => void>;
    buildOperationId?: (attemptCount: number) => string;
  };
}

export interface ExecuteOnlineSolveResult {
  result: PlateSolveResult;
  diagnostics: OnlineSolveDiagnostics;
  session: ReturnType<typeof createInitialOnlineSolveSessionState>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, ms);
});

export async function executeOnlineSolve(
  params: ExecuteOnlineSolveParams
): Promise<ExecuteOnlineSolveResult> {
  const dependencies = params.dependencies ?? {};
  const isNetworkOnline = dependencies.isNetworkOnline ?? (() => (
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  ));
  const sleep = dependencies.sleep ?? defaultSleep;
  const createWebClient = dependencies.createWebClient
    ?? ((config: ConstructorParameters<typeof AstrometryApiClient>[0]) => new AstrometryApiClient(config));
  const persistFile = dependencies.persistFileForLocalSolve ?? persistFileForLocalSolve;
  const saveApiKey = dependencies.saveApiKey ?? ((key: string) => secretVaultApi.setPlateSolverApiKey(key));
  const solveOnlineCommand = dependencies.solveOnline ?? solveOnline;
  const buildOperationId = dependencies.buildOperationId ?? ((attemptCount: number) => `${Date.now()}-${attemptCount}`);
  const listenToTauriProgress = dependencies.listenToTauriProgress ?? (async (onProgress) => {
    const { listen } = await import('@tauri-apps/api/event');
    return listen<Parameters<typeof onProgress>[0]>('astrometry-progress', (event) => onProgress(event.payload));
  });

  const runtime = params.runtime;
  const maxAttempts = params.retryOnFailure ? (params.maxRetries + 1) : 1;
  let session = createInitialOnlineSolveSessionState(runtime);

  const commitSession = (next: typeof session) => {
    session = next;
    params.updateSession(next);
  };

  const finalize = (
    result: PlateSolveResult,
    attemptCount: number,
    terminalErrorCode?: OnlineSolveDiagnostics['terminalErrorCode'],
    readinessMessage?: string
  ): ExecuteOnlineSolveResult => ({
    result,
    diagnostics: {
      runtime,
      attemptCount,
      maxAttempts,
      terminalErrorCode: terminalErrorCode ?? null,
      cancelled: terminalErrorCode === 'cancelled',
      submissionId: session.subId,
      jobId: session.jobId,
      operationId: session.operationId,
      readiness: readinessMessage
        ? {
            state: terminalErrorCode === 'cancelled' ? 'blocked' : 'blocked',
            reason: terminalErrorCode === 'offline' ? 'offline' : 'missing_api_key',
            message: readinessMessage,
          }
        : null,
      artifactSummary: result.onlineSolve ? summarizeOnlineSolveArtifact(result.onlineSolve) : null,
    },
    session,
  });

  if (!params.onlineApiKey.trim()) {
    const message = params.t('plateSolving.needApiKey') || 'API key required for online solving';
    commitSession({
      ...session,
      stage: 'failed',
      progress: 100,
      errorCode: 'missing_api_key',
      errorMessage: message,
      message,
    });
    return finalize(createErrorResult('astrometry.net', `[missing_api_key] ${message}`), 0, 'missing_api_key', message);
  }

  if (!isNetworkOnline()) {
    const message = params.t('plateSolving.offlineCannotSolve') || 'Network is offline. Online solving unavailable.';
    commitSession({
      ...session,
      stage: 'failed',
      progress: 100,
      errorCode: 'offline',
      errorMessage: message,
      message,
    });
    return finalize(createErrorResult('astrometry.net', `[offline] ${message}`), 0, 'offline', message);
  }

  if (runtime === 'tauri') {
    try {
      await saveApiKey(params.onlineApiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : params.t('plateSolving.needApiKey');
      commitSession({
        ...session,
        stage: 'failed',
        progress: 100,
        errorCode: 'auth_failed',
        errorMessage: message,
        message,
      });
      return finalize(createErrorResult('astrometry.net', `[auth_failed] ${message}`), 0, 'auth_failed');
    }
  }

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const attemptCount = attemptIndex + 1;
    commitSession({
      ...session,
      attempt: attemptCount,
      maxAttempts,
      stage: 'authenticating',
      progress: 10,
      message: params.t('plateSolving.authenticating') || 'Authenticating...',
      errorCode: null,
      errorMessage: null,
      cancelled: false,
    });

    try {
      const effectiveOptions = { ...params.options };
      if (params.effectiveRaHint !== undefined && params.effectiveDecHint !== undefined) {
        effectiveOptions.centerRa = params.effectiveRaHint;
        effectiveOptions.centerDec = params.effectiveDecHint;
        effectiveOptions.radius = params.searchRadius;
      }
      if (attemptIndex > 0 && effectiveOptions.downsampleFactor) {
        effectiveOptions.downsampleFactor = Math.min(effectiveOptions.downsampleFactor + attemptIndex, 4);
      }

      let detailed: OnlineSolveDetailedResult;
      if (runtime === 'tauri') {
        const operationId = buildOperationId(attemptCount);
        const unlisten = await listenToTauriProgress((payload) => {
          commitSession(mapTauriProgressToOnlineSession(payload, session));
        });
        const persisted = await persistFile(params.file);
        try {
          const onlineResult = await solveOnlineCommand({
            api_key: params.onlineApiKey,
            image_path: persisted.filePath,
            operation_id: operationId,
            ra_hint: effectiveOptions.centerRa,
            dec_hint: effectiveOptions.centerDec,
            radius: effectiveOptions.radius,
            scale_units: effectiveOptions.scaleUnits,
            scale_lower: effectiveOptions.scaleLower,
            scale_upper: effectiveOptions.scaleUpper,
            scale_est: effectiveOptions.scaleEst,
            scale_err: effectiveOptions.scaleErr,
            downsample_factor: effectiveOptions.downsampleFactor,
            tweak_order: effectiveOptions.tweakOrder,
            crpix_center: effectiveOptions.crpixCenter,
            parity: effectiveOptions.parity,
            timeout_seconds: params.timeoutSeconds,
            publicly_visible: effectiveOptions.publiclyVisible === 'y',
          });
          detailed = mapTauriOnlineSolveResult(onlineResult, operationId);
        } finally {
          await Promise.resolve(persisted.cleanup?.());
          await Promise.resolve(unlisten?.());
        }
      } else {
        const client = createWebClient({
          apiKey: params.onlineApiKey,
          timeout: params.timeoutSeconds * 1000,
        });
        params.registerWebClient?.(client);
        try {
          detailed = await client.solveDetailed(
            params.file,
            effectiveOptions,
            (payload: SolveProgress) => commitSession(mapWebProgressToOnlineSession(payload, session))
          );
        } finally {
          params.registerWebClient?.(null);
        }
      }

      const errorCode = detailed.artifact.errorCode ?? (
        detailed.solveResult.success
          ? null
          : classifyOnlineSolveError(detailed.solveResult.errorMessage ?? params.t('plateSolving.failed')).code
      );
      const errorMessage = detailed.artifact.errorMessage ?? detailed.solveResult.errorMessage ?? null;

      commitSession({
        ...session,
        subId: detailed.artifact.submissionId ?? session.subId,
        jobId: detailed.artifact.jobId ?? session.jobId,
        operationId: detailed.artifact.operationId ?? session.operationId,
        stage: detailed.solveResult.success
          ? 'success'
          : (errorCode === 'cancelled' ? 'cancelled' : 'failed'),
        progress: 100,
        errorCode,
        errorMessage,
        cancelled: errorCode === 'cancelled',
      });

      if (detailed.solveResult.success) {
        return {
          result: detailed.solveResult,
          diagnostics: {
            runtime,
            attemptCount,
            maxAttempts,
            terminalErrorCode: null,
            cancelled: false,
            submissionId: detailed.artifact.submissionId,
            jobId: detailed.artifact.jobId,
            operationId: detailed.artifact.operationId,
            artifactSummary: summarizeOnlineSolveArtifact(detailed.artifact),
          },
          session,
        };
      }

      const terminalCode = errorCode ?? 'unknown';
      if (!isRetryableOnlineError(terminalCode) || attemptCount >= maxAttempts) {
        const finalResult = createErrorResult(
          'astrometry.net',
          `[${terminalCode}] ${errorMessage ?? (params.t('plateSolving.failed') || 'Failed')} (Attempt ${attemptCount}/${maxAttempts})`
        );
        finalResult.onlineSolve = detailed.artifact;
        return {
          result: finalResult,
          diagnostics: {
            runtime,
            attemptCount,
            maxAttempts,
            terminalErrorCode: terminalCode,
            cancelled: terminalCode === 'cancelled',
            submissionId: detailed.artifact.submissionId,
            jobId: detailed.artifact.jobId,
            operationId: detailed.artifact.operationId,
            artifactSummary: summarizeOnlineSolveArtifact(detailed.artifact),
          },
          session,
        };
      }
    } catch (error) {
      const { code, message } = classifyOnlineSolveError(error);
      commitSession({
        ...session,
        stage: code === 'cancelled' ? 'cancelled' : 'failed',
        progress: 100,
        errorCode: code,
        errorMessage: message,
        cancelled: code === 'cancelled',
      });

      if (!isRetryableOnlineError(code) || attemptCount >= maxAttempts) {
        return finalize(
          createErrorResult('astrometry.net', `[${code}] ${message} (Attempt ${attemptCount}/${maxAttempts})`),
          attemptCount,
          code
        );
      }
    }

    await sleep(2000 * attemptCount);
  }

  return finalize(createErrorResult('astrometry.net', '[unknown] Online solve failed'), maxAttempts, 'unknown');
}
