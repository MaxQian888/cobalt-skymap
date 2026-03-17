import type { PlateSolveResult, WorldCoordinateSystem } from './types';

export type OnlineSolveRuntime = 'tauri' | 'web';

export type OnlineSolveLifecycleStage =
  | 'idle'
  | 'preflight'
  | 'authenticating'
  | 'uploading'
  | 'queued'
  | 'solving'
  | 'fetching'
  | 'success'
  | 'failed'
  | 'cancelled';

export type OnlineSolveErrorCode =
  | 'missing_api_key'
  | 'offline'
  | 'auth_failed'
  | 'upload_failed'
  | 'timeout'
  | 'network'
  | 'service_failed'
  | 'cancelled'
  | 'invalid_image'
  | 'unknown';

export interface OnlineServiceStatus {
  status: 'unknown' | 'reachable' | 'unreachable';
  checkedAt: number | null;
  message: string | null;
}

export type OnlineSolverReadinessState = 'ready' | 'blocked' | 'degraded';
export type OnlineSolverReadinessReason =
  | 'ready'
  | 'missing_api_key'
  | 'offline'
  | 'service_unreachable'
  | 'checking';

export interface OnlineSolverReadiness {
  state: OnlineSolverReadinessState;
  reason: OnlineSolverReadinessReason;
  message: string;
  checkedAt: number | null;
  hasApiKey: boolean;
  networkAvailable: boolean;
  serviceReachable: boolean | null;
  canStart: boolean;
}

export interface OnlineSolveArtifactIssue {
  artifact: 'annotations' | 'wcs';
  message: string;
}

export interface NormalizedOnlineAnnotation {
  names: string[];
  annotationType: string;
  pixelX: number;
  pixelY: number;
  radius: number;
}

export interface OnlineSolveArtifactDiagnostics {
  annotations: 'complete' | 'missing';
  wcs: 'complete' | 'missing';
  issues: OnlineSolveArtifactIssue[];
}

export interface OnlineSolveArtifactSummary {
  objectsInFieldCount: number;
  annotationCount: number;
  hasWcs: boolean;
  annotations: OnlineSolveArtifactDiagnostics['annotations'];
  wcs: OnlineSolveArtifactDiagnostics['wcs'];
  issues: OnlineSolveArtifactIssue[];
}

export interface OnlineSolveArtifact {
  runtime: OnlineSolveRuntime;
  operationId: string | null;
  submissionId: number | null;
  jobId: number | null;
  objectsInField: string[];
  annotations: NormalizedOnlineAnnotation[];
  wcs: WorldCoordinateSystem | null;
  frameSize: { width: number; height: number } | null;
  diagnostics: OnlineSolveArtifactDiagnostics;
  errorCode: OnlineSolveErrorCode | null;
  errorMessage: string | null;
}

export interface OnlineSolveDetailedResult {
  solveResult: PlateSolveResult;
  artifact: OnlineSolveArtifact;
}

export interface OnlineSolveDiagnostics {
  runtime: OnlineSolveRuntime;
  attemptCount: number;
  maxAttempts: number;
  terminalErrorCode?: OnlineSolveErrorCode | null;
  cancelled?: boolean;
  submissionId?: number | null;
  jobId?: number | null;
  operationId?: string | null;
  readiness?: Pick<OnlineSolverReadiness, 'state' | 'reason' | 'message'> | null;
  artifactSummary?: OnlineSolveArtifactSummary | null;
}

export function createEmptyOnlineSolveArtifact(
  runtime: OnlineSolveRuntime = 'web'
): OnlineSolveArtifact {
  return {
    runtime,
    operationId: null,
    submissionId: null,
    jobId: null,
    objectsInField: [],
    annotations: [],
    wcs: null,
    frameSize: null,
    diagnostics: {
      annotations: 'missing',
      wcs: 'missing',
      issues: [],
    },
    errorCode: null,
    errorMessage: null,
  };
}

export function summarizeOnlineSolveArtifact(
  artifact: Pick<OnlineSolveArtifact, 'objectsInField' | 'annotations' | 'wcs' | 'diagnostics'>
): OnlineSolveArtifactSummary {
  return {
    objectsInFieldCount: artifact.objectsInField.length,
    annotationCount: artifact.annotations.length,
    hasWcs: artifact.wcs !== null,
    annotations: artifact.diagnostics.annotations,
    wcs: artifact.diagnostics.wcs,
    issues: [...artifact.diagnostics.issues],
  };
}
