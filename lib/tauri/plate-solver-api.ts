/**
 * Plate Solver API
 * TypeScript wrapper for local plate solving Tauri commands
 */

import { invoke } from '@tauri-apps/api/core';
import { isTauri, isDesktop, isMobile } from '@/lib/storage/platform';

/**
 * Most plate-solver commands are #[cfg(desktop)] in the Rust backend.
 * On web or mobile Tauri they are not registered, so guard every invoke.
 */
export function isPlateSolverAvailable(): boolean {
  return isTauri() && isDesktop();
}

/**
 * The mobile ASTAP commands (`*_mobile`, `download_astap_database`) are
 * #[cfg(mobile)] in the Rust backend — only available in mobile Tauri.
 */
export function isMobilePlateSolverAvailable(): boolean {
  return isTauri() && isMobile();
}

function invokeSolver<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isPlateSolverAvailable()) {
    return Promise.reject(
      new Error(`Plate solver command '${command}' is only available in the desktop app`)
    );
  }
  return args === undefined ? invoke<T>(command) : invoke<T>(command, args);
}

function invokeMobileSolver<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isMobilePlateSolverAvailable()) {
    return Promise.reject(
      new Error(`Plate solver command '${command}' is only available in the mobile app`)
    );
  }
  return invoke<T>(command, args);
}

// ============================================================================
// Types
// ============================================================================

export type SolverType = 'astap' | 'astrometry_net' | 'astrometry_net_online';

export interface ScaleRange {
  min_arcmin: number;
  max_arcmin: number;
}

export interface IndexInfo {
  name: string;
  file_name: string;
  path: string;
  size_bytes: number;
  scale_range: ScaleRange | null;
  description: string | null;
}

export interface SolverInfo {
  solver_type: SolverType;
  name: string;
  version: string | null;
  executable_path: string;
  is_available: boolean;
  index_path: string | null;
  installed_indexes: IndexInfo[];
  profile_id?: string | null;
  profile_name?: string | null;
  availability_reason?: string | null;
  uses_custom_executable?: boolean;
}

export interface LocalInvocationDiagnostics {
  error_code: string;
  profile_id: string | null;
  executable_path: string | null;
  workspace_path: string | null;
  exit_code: number | null;
  availability_reason: string | null;
  stdout_excerpt: string | null;
  stderr_excerpt: string | null;
}

export type AstapSpeedMode = 'auto' | 'slow';
export type ScaleUnits = 'deg_width' | 'arcmin_width' | 'arcsec_per_pix';

export interface SolverConfig {
  solver_type: SolverType;
  executable_path: string | null;
  index_path: string | null;
  timeout_seconds: number;
  downsample: number;
  search_radius: number;
  use_sip: boolean;
  // ASTAP-specific options
  astap_database: string | null;
  astap_max_stars: number;
  astap_tolerance: number;
  astap_speed_mode: AstapSpeedMode;
  astap_min_star_size: number;
  astap_equalise_background: boolean;
  // Astrometry.net-specific options
  astrometry_scale_low: number | null;
  astrometry_scale_high: number | null;
  astrometry_scale_units: ScaleUnits;
  astrometry_depth: string | null;
  astrometry_no_plots: boolean;
  astrometry_no_verify: boolean;
  astrometry_crpix_center: boolean;
  // General options
  keep_wcs_file: boolean;
  auto_hints: boolean;
  retry_on_failure: boolean;
  max_retries: number;
}

export interface SolveParameters {
  image_path: string;
  ra_hint: number | null;
  dec_hint: number | null;
  fov_hint: number | null;
  search_radius: number | null;
  downsample: number | null;
  timeout: number | null;
}

export interface SolveResult {
  success: boolean;
  ra: number | null;
  dec: number | null;
  ra_hms: string | null;
  dec_dms: string | null;
  position_angle: number | null;
  pixel_scale: number | null;
  fov_width: number | null;
  fov_height: number | null;
  flipped: boolean | null;
  solver_name: string;
  solve_time_ms: number;
  error_message: string | null;
  wcs_file: string | null;
  local_diagnostics?: LocalInvocationDiagnostics | null;
}

export interface DownloadableIndex {
  name: string;
  file_name: string;
  download_url: string;
  size_bytes: number;
  scale_range: ScaleRange;
  description: string;
  solver_type: SolverType;
}

export interface DownloadProgress {
  file_name: string;
  downloaded_bytes: number;
  total_bytes: number;
  percent: number;
  status: string;
}

// ============================================================================
// ASTAP Database Types
// ============================================================================

export interface AstapDatabaseInfo {
  name: string;
  abbreviation: string;
  installed: boolean;
  path: string | null;
  fov_min_deg: number;
  fov_max_deg: number;
  description: string;
  size_mb: number;
  download_url: string | null;
}

// ============================================================================
// Image Analysis Types
// ============================================================================

export interface StarDetection {
  x: number;
  y: number;
  hfd: number;
  flux: number;
  snr: number;
  ra: number | null;
  dec: number | null;
  magnitude: number | null;
}

export interface ImageAnalysisResult {
  success: boolean;
  median_hfd: number | null;
  star_count: number;
  background: number | null;
  noise: number | null;
  stars: StarDetection[];
  error_message: string | null;
}

// ============================================================================
// Online Astrometry.net Types
// ============================================================================

export interface OnlineSolveConfig {
  api_key: string;
  image_path: string;
  operation_id?: string;
  base_url?: string;
  ra_hint?: number;
  dec_hint?: number;
  radius?: number;
  scale_units?: OnlineScaleUnits;
  scale_lower?: number;
  scale_upper?: number;
  scale_est?: number;
  scale_err?: number;
  downsample_factor?: number;
  tweak_order?: number;
  crpix_center?: boolean;
  parity?: number;
  timeout_seconds?: number;
  publicly_visible?: boolean;
}

export interface OnlineAnnotation {
  names: string[];
  annotation_type: string;
  pixelx: number;
  pixely: number;
  radius: number;
}

export type OnlineScaleUnits = 'degwidth' | 'arcminwidth' | 'arcsecperpix';

export interface OnlineSipCoefficients {
  a_order: number | null;
  b_order: number | null;
  ap_order: number | null;
  bp_order: number | null;
  a_coeffs: Record<string, number>;
  b_coeffs: Record<string, number>;
  ap_coeffs: Record<string, number>;
  bp_coeffs: Record<string, number>;
}

export interface OnlineWcsResult {
  crpix1: number | null;
  crpix2: number | null;
  crval1: number | null;
  crval2: number | null;
  cdelt1: number | null;
  cdelt2: number | null;
  crota1: number | null;
  crota2: number | null;
  cd1_1: number | null;
  cd1_2: number | null;
  cd2_1: number | null;
  cd2_2: number | null;
  ctype1: string | null;
  ctype2: string | null;
  naxis1: number | null;
  naxis2: number | null;
  sip: OnlineSipCoefficients | null;
}

export interface OnlineSolveProgress {
  stage: string;
  progress: number;
  message: string;
  sub_id: number | null;
  job_id: number | null;
  operation_id: string | null;
}

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

export interface OnlineSolveResult {
  success: boolean;
  operation_id: string | null;
  ra: number | null;
  dec: number | null;
  orientation: number | null;
  pixscale: number | null;
  radius: number | null;
  parity: number | null;
  fov_width: number | null;
  fov_height: number | null;
  objects_in_field: string[];
  annotations: OnlineAnnotation[];
  job_id: number | null;
  wcs: OnlineWcsResult | null;
  solve_time_ms: number;
  error_code: OnlineSolveErrorCode | null;
  error_message: string | null;
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  solver_type: 'astap',
  executable_path: null,
  index_path: null,
  timeout_seconds: 120,
  downsample: 0, // auto
  search_radius: 30.0,
  use_sip: true,
  // ASTAP defaults
  astap_database: null,
  astap_max_stars: 500,
  astap_tolerance: 0.007,
  astap_speed_mode: 'auto',
  astap_min_star_size: 1.5,
  astap_equalise_background: false,
  // Astrometry.net defaults
  astrometry_scale_low: null,
  astrometry_scale_high: null,
  astrometry_scale_units: 'deg_width',
  astrometry_depth: null,
  astrometry_no_plots: true,
  astrometry_no_verify: false,
  astrometry_crpix_center: true,
  // General defaults
  keep_wcs_file: true,
  auto_hints: true,
  retry_on_failure: false,
  max_retries: 2,
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Detect all installed plate solvers
 */
export async function detectPlateSolvers(): Promise<SolverInfo[]> {
  const solvers = await invokeSolver<Array<Record<string, unknown>>>('detect_plate_solvers');
  return solvers.map(normalizeSolverInfo);
}

/**
 * Get info for a specific solver type
 */
export async function getSolverInfo(solverType: SolverType): Promise<SolverInfo> {
  const solver = await invokeSolver<Record<string, unknown>>('get_solver_info', { solverType });
  return normalizeSolverInfo(solver);
}

/**
 * Validate a custom solver executable path
 */
export async function validateSolverPath(
  solverType: SolverType,
  path: string
): Promise<boolean> {
  return invokeSolver<boolean>('validate_solver_path', { solverType, path });
}

/**
 * Cancel an active local plate solve operation
 */
export async function cancelPlateSolve(): Promise<void> {
  return invokeSolver<void>('cancel_plate_solve');
}

/**
 * Solve an image using a local solver
 */
export async function solveImageLocal(
  config: SolverConfig,
  params: SolveParameters
): Promise<SolveResult> {
  return invokeSolver<SolveResult>('solve_image_local', { config, params });
}

/**
 * Get list of available indexes to download for a solver
 */
export async function getAvailableIndexes(
  solverType: SolverType
): Promise<DownloadableIndex[]> {
  return invokeSolver<DownloadableIndex[]>('get_available_indexes', { solverType });
}

/**
 * Get list of installed indexes for a solver
 */
export async function getInstalledIndexes(
  solverType: SolverType,
  indexPath?: string
): Promise<IndexInfo[]> {
  return invokeSolver<IndexInfo[]>('get_installed_indexes', { 
    solverType, 
    indexPath: indexPath ?? null 
  });
}

/**
 * Delete an index file or directory
 */
export async function deleteIndex(path: string): Promise<void> {
  return invokeSolver<void>('delete_index', { path });
}

/**
 * Get recommended indexes for a given FOV
 */
export async function getRecommendedIndexes(
  solverType: SolverType,
  fovDegrees: number
): Promise<DownloadableIndex[]> {
  return invokeSolver<DownloadableIndex[]>('get_recommended_indexes', { 
    solverType, 
    fovDegrees 
  });
}

/**
 * Get the default index path for a solver
 */
export async function getDefaultIndexPath(
  solverType: SolverType
): Promise<string | null> {
  return invokeSolver<string | null>('get_default_index_path', { solverType });
}

/**
 * Save solver configuration
 */
export async function saveSolverConfig(config: SolverConfig): Promise<void> {
  return invokeSolver<void>('save_solver_config', { config });
}

/**
 * Load solver configuration
 */
export async function loadSolverConfig(): Promise<SolverConfig> {
  return invokeSolver<SolverConfig>('load_solver_config');
}

// ============================================================================
// ASTAP Database API
// ============================================================================

/**
 * Get all known ASTAP databases with installation status
 */
export async function getAstapDatabases(): Promise<AstapDatabaseInfo[]> {
  return invokeSolver<AstapDatabaseInfo[]>('get_astap_databases');
}

/**
 * Get recommended ASTAP databases for a given FOV
 */
export async function recommendAstapDatabase(
  fovDegrees: number
): Promise<AstapDatabaseInfo[]> {
  return invokeSolver<AstapDatabaseInfo[]>('recommend_astap_database', { fovDegrees });
}

/**
 * Download + install an ASTAP star database (.zip) into destDir.
 * Progress is emitted via the 'index-download-progress' event
 * (payload.index_name === database.name).
 */
export async function downloadAstapDatabase(
  database: AstapDatabaseInfo,
  destDir: string
): Promise<void> {
  return invokeSolver<void>('download_astap_database', { database, destDir });
}

// ============================================================================
// Mobile (Android) ASTAP API — commands are #[cfg(mobile)] in Rust
// ============================================================================

/**
 * Solve an image locally on mobile using the bundled ASTAP CLI
 * (libastap_cli.so executed from the APK's native library dir).
 * Progress is emitted via the same 'solve-progress' event as desktop.
 */
export async function solveImageLocalMobile(
  config: SolverConfig,
  params: SolveParameters
): Promise<SolveResult> {
  return invokeMobileSolver<SolveResult>('solve_image_local_mobile', { config, params });
}

/**
 * Cancel an active mobile local solve.
 */
export async function cancelPlateSolveMobile(): Promise<void> {
  return invokeMobileSolver<void>('cancel_plate_solve_mobile');
}

/**
 * ASTAP database catalog with install status, scanning <app_data_dir>/astap_data.
 */
export async function getAstapDatabasesMobile(): Promise<AstapDatabaseInfo[]> {
  return invokeMobileSolver<AstapDatabaseInfo[]>('get_astap_databases_mobile');
}

/**
 * Directory where mobile ASTAP databases are installed (download destination).
 */
export async function getAstapDataDirMobile(): Promise<string> {
  return invokeMobileSolver<string>('get_astap_data_dir_mobile');
}

/**
 * Download + install an ASTAP star database on mobile. Same Rust command as
 * desktop (shared core), but guarded by the mobile availability check because
 * this wrapper is only meant for the mobile UI path.
 * Progress: 'index-download-progress' event (payload.index_name === database.name).
 */
export async function downloadAstapDatabaseMobile(
  database: AstapDatabaseInfo,
  destDir: string
): Promise<void> {
  return invokeMobileSolver<void>('download_astap_database', { database, destDir });
}

// ============================================================================
// Image Analysis API
// ============================================================================

/**
 * Analyse an image using ASTAP to get HFD, star count, and background info
 */
export async function analyseImage(
  imagePath: string,
  snrMinimum?: number
): Promise<ImageAnalysisResult> {
  return invokeSolver<ImageAnalysisResult>('analyse_image', {
    imagePath,
    snrMinimum: snrMinimum ?? null,
  });
}

/**
 * Extract star detections from an image using ASTAP
 */
export async function extractStars(
  imagePath: string,
  snrMinimum?: number,
  includeCoordinates = false
): Promise<ImageAnalysisResult> {
  return invokeSolver<ImageAnalysisResult>('extract_stars', {
    imagePath,
    snrMinimum: snrMinimum ?? null,
    includeCoordinates,
  });
}

// ============================================================================
// Online Astrometry.net API
// ============================================================================

/**
 * Solve an image using Astrometry.net online service
 * Progress is emitted via 'astrometry-progress' Tauri event
 */
export async function solveOnline(
  config: OnlineSolveConfig
): Promise<OnlineSolveResult> {
  return invokeSolver<OnlineSolveResult>('solve_online', { config });
}

/**
 * Cancel an active online solve operation.
 * Returns true when a running solve was found and cancellation was signaled.
 */
export async function cancelOnlineSolve(operationId?: string): Promise<boolean> {
  return invokeSolver<boolean>('cancel_online_solve', { operationId: operationId ?? null });
}

// ============================================================================
// Legacy Plate Solver API (backward compatibility)
// ============================================================================

export type LegacySolverType = 'astap' | 'astrometrynet' | 'localastrometry';

export interface LegacyPlateSolverConfig {
  solver_type: LegacySolverType;
  image_path: string;
  ra_hint: number | null;
  dec_hint: number | null;
  radius_hint: number | null;
  scale_low: number | null;
  scale_high: number | null;
  downsample: number | null;
  timeout_seconds: number | null;
}

export interface LegacyPlateSolveResult {
  success: boolean;
  ra: number | null;
  dec: number | null;
  rotation: number | null;
  scale: number | null;
  width_deg: number | null;
  height_deg: number | null;
  error_message: string | null;
  solve_time_ms: number;
}

export interface LegacyAstrometryIndex {
  name: string;
  path: string;
  scale_low: number;
  scale_high: number;
  size_mb: number;
}

export interface LegacyDownloadableIndex {
  name: string;
  url: string;
  scale_low: number;
  scale_high: number;
  size_mb: number;
  description: string;
}

/**
 * Plate solve an image (legacy API)
 */
export async function plateSolve(config: LegacyPlateSolverConfig): Promise<LegacyPlateSolveResult> {
  return invokeSolver<LegacyPlateSolveResult>('plate_solve', { config });
}

/**
 * Get installed indexes for a solver type (legacy API)
 */
export async function getSolverIndexes(solverType: LegacySolverType): Promise<LegacyAstrometryIndex[]> {
  return invokeSolver<LegacyAstrometryIndex[]>('get_solver_indexes', { solverType });
}

/**
 * Get list of downloadable indexes (legacy API)
 */
export async function getDownloadableIndexes(): Promise<LegacyDownloadableIndex[]> {
  return invokeSolver<LegacyDownloadableIndex[]>('get_downloadable_indexes');
}

/**
 * Download an index file (legacy API)
 */
export async function downloadIndex(
  index: LegacyDownloadableIndex,
  destPath: string
): Promise<void> {
  return invokeSolver<void>('download_index', { index, destPath });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Get human-readable solver name
 */
export function getSolverDisplayName(solverType: SolverType): string {
  switch (solverType) {
    case 'astap':
      return 'ASTAP';
    case 'astrometry_net':
      return 'Astrometry.net (Local)';
    case 'astrometry_net_online':
      return 'Astrometry.net (Online)';
    default:
      return solverType;
  }
}

/**
 * Check if a solver type is a local solver
 */
export function isLocalSolver(solverType: SolverType): boolean {
  return solverType === 'astap' || solverType === 'astrometry_net';
}

/**
 * Convert SolveResult to the existing PlateSolveResult format
 */
export function convertToLegacyResult(result: SolveResult): {
  success: boolean;
  coordinates: {
    ra: number;
    dec: number;
    raHMS: string;
    decDMS: string;
  } | null;
  positionAngle: number;
  pixelScale: number;
  fov: { width: number; height: number };
  flipped: boolean;
  solverName: string;
  solveTime: number;
  errorMessage?: string;
} {
  return {
    success: result.success,
    coordinates: result.success && result.ra !== null && result.dec !== null
      ? {
          ra: result.ra,
          dec: result.dec,
          raHMS: result.ra_hms ?? '',
          decDMS: result.dec_dms ?? '',
        }
      : null,
    positionAngle: result.position_angle ?? 0,
    pixelScale: result.pixel_scale ?? 0,
    fov: {
      width: result.fov_width ?? 0,
      height: result.fov_height ?? 0,
    },
    flipped: result.flipped ?? false,
    solverName: result.solver_name,
    solveTime: result.solve_time_ms,
    errorMessage: result.error_message ?? undefined,
  };
}

function normalizeSolverInfo(payload: Record<string, unknown>): SolverInfo {
  return {
    solver_type: payload.solver_type as SolverType,
    name: typeof payload.name === 'string' ? payload.name : '',
    version: typeof payload.version === 'string' ? payload.version : null,
    executable_path:
      typeof payload.executable_path === 'string'
        ? payload.executable_path
        : typeof payload.path === 'string'
          ? payload.path
          : '',
    is_available:
      typeof payload.is_available === 'boolean'
        ? payload.is_available
        : typeof payload.available === 'boolean'
          ? payload.available
          : false,
    index_path: typeof payload.index_path === 'string' ? payload.index_path : null,
    installed_indexes: Array.isArray(payload.installed_indexes)
      ? (payload.installed_indexes as IndexInfo[])
      : [],
    profile_id: typeof payload.profile_id === 'string' ? payload.profile_id : null,
    profile_name: typeof payload.profile_name === 'string' ? payload.profile_name : null,
    availability_reason:
      typeof payload.availability_reason === 'string' ? payload.availability_reason : null,
    uses_custom_executable:
      typeof payload.uses_custom_executable === 'boolean'
        ? payload.uses_custom_executable
        : false,
  };
}

// ============================================================================
// Plate Solver API Object
// ============================================================================

export const plateSolverApi = {
  detectPlateSolvers,
  getSolverInfo,
  validateSolverPath,
  cancelPlateSolve,
  solveImageLocal,
  getAvailableIndexes,
  getInstalledIndexes,
  deleteIndex,
  getRecommendedIndexes,
  getDefaultIndexPath,
  saveSolverConfig,
  loadSolverConfig,
  formatFileSize,
  getSolverDisplayName,
  isLocalSolver,
  convertToLegacyResult,
  // ASTAP Database API
  getAstapDatabases,
  recommendAstapDatabase,
  // Mobile ASTAP API
  solveImageLocalMobile,
  cancelPlateSolveMobile,
  getAstapDatabasesMobile,
  getAstapDataDirMobile,
  downloadAstapDatabaseMobile,
  // Image Analysis API
  analyseImage,
  extractStars,
  // Online Solving API
  solveOnline,
  cancelOnlineSolve,
  // Legacy API
  plateSolve,
  getSolverIndexes,
  getDownloadableIndexes,
  downloadIndex,
};

export default plateSolverApi;
