/**
 * Plate Solving Interface Types
 * Ported from NINA's plate solving infrastructure
 * 
 * Provides type definitions for plate solving integration
 */

// ============================================================================
// Plate Solver Types
// ============================================================================

import type { OnlineSolveArtifact } from './online-solve-types';

export interface PlateSolveResult {
  success: boolean;
  coordinates: {
    ra: number;          // RA in degrees
    dec: number;         // Dec in degrees
    raHMS: string;       // RA formatted as HH:MM:SS
    decDMS: string;      // Dec formatted as +DD:MM:SS
  } | null;
  positionAngle: number; // Camera rotation in degrees
  pixelScale: number;    // Arcseconds per pixel
  fov: {
    width: number;       // FOV width in degrees
    height: number;      // FOV height in degrees
  };
  flipped: boolean;      // Image is mirrored
  
  // Solver info
  solverName: string;
  solveTime: number;     // Milliseconds

  // Optional online solve metadata
  onlineSolve?: OnlineSolveArtifact | null;
  
  // Error info
  errorMessage?: string;
}

export function createErrorResult(solverName: string, errorMessage: string): PlateSolveResult {
  return {
    success: false,
    coordinates: null,
    positionAngle: 0,
    pixelScale: 0,
    fov: { width: 0, height: 0 },
    flipped: false,
    solverName,
    solveTime: 0,
    onlineSolve: null,
    errorMessage,
  };
}

export interface PlateSolveParameters {
  // Image info
  imageWidth: number;
  imageHeight: number;
  focalLength?: number;
  pixelSize?: number;
  
  // Search parameters
  searchRadius: number;  // Degrees
  coordinates?: {
    ra: number;
    dec: number;
  };
  
  // Solver settings
  downSampleFactor: number;
  maxObjects: number;
  regions: number;
  
  // Blind solving
  blindFailoverEnabled: boolean;
  
  // Timeouts
  timeout: number;       // Milliseconds
  attempts: number;
  reattemptDelay: number; // Milliseconds
}

export interface PlateSolver {
  name: string;
  isAvailable: boolean;
  
  solve(
    imageData: ArrayBuffer | string,
    parameters: PlateSolveParameters
  ): Promise<PlateSolveResult>;
  
  cancel(): void;
}

// ============================================================================
// Solver Provider Types
// ============================================================================

export type PlateSolverType = 
  | 'astap'
  | 'astrometry_net'
  | 'all_sky'
  | 'pinpoint'
  | 'platesolve2'
  | 'platesolve3'
  | 'theskyx';

export interface PlateSolverConfig {
  type: PlateSolverType;
  enabled: boolean;
  path?: string;
  apiKey?: string;
  serverUrl?: string;
  
  // Solver-specific settings
  settings: Record<string, unknown>;
}

export interface BlindSolverConfig extends PlateSolverConfig {
  // Additional settings for blind solving
  useCatalog?: boolean;
  catalogPath?: string;
  minFieldWidth?: number;
  maxFieldWidth?: number;
}

// ============================================================================
// Capture Solver (Plate solve from camera capture)
// ============================================================================

export interface CaptureSolverParameter {
  coordinates?: {
    ra: number;
    dec: number;
  };
  focalLength: number;
  pixelSize: number;
  searchRadius: number;
  downSampleFactor: number;
  maxObjects: number;
  regions: number;
  binning: number;
  attempts: number;
  reattemptDelay: number;  // Milliseconds
  blindFailoverEnabled: boolean;
}

export interface CaptureSequence {
  exposureTime: number;
  gain?: number;
  offset?: number;
  binning: { x: number; y: number };
  filterType?: string;
  totalExposureCount: number;
}

// ============================================================================
// Center and Rotate (Slew + Solve + Rotate)
// ============================================================================

export interface CenterResult {
  success: boolean;
  iterations: number;
  finalSeparation: number;  // Arcseconds from target
  platesolveResult?: PlateSolveResult;
}

export interface CenterAndRotateResult extends CenterResult {
  rotationAchieved: boolean;
  finalPositionAngle: number;
  positionAngleError: number;  // Degrees from target
}

// ============================================================================
// Framing Integration
// ============================================================================

export interface FramingPlateSolveResult {
  success: boolean;
  positionAngle: number;
  coordinates: {
    ra: number;
    dec: number;
  };
  
  // For applying to framing assistant
  suggestedRotation: number;
}

/**
 * Get camera rotation from plate solve result
 * Used in NINA's GetRotationFromCamera
 */
export function getRotationFromSolveResult(result: PlateSolveResult): number | null {
  if (!result.success) return null;
  return 360 - result.positionAngle;
}

/**
 * Calculate DSO position angle from plate solve
 * Used for matching orientation to existing images
 */
export function calculateDSOPositionAngle(
  solvePositionAngle: number,
  rectangleRotation: number
): number {
  return euclidianModulus(solvePositionAngle + rectangleRotation, 360);
}

/**
 * Euclidian modulus (always positive result)
 * Based on NINA's AstroUtil.EuclidianModulus
 */
function euclidianModulus(x: number, y: number): number {
  if (y > 0) {
    const r = x % y;
    return r < 0 ? r + y : r;
  } else if (y < 0) {
    return -euclidianModulus(-x, -y);
  }
  return NaN;
}

// ============================================================================
// WCS (World Coordinate System) Types
// ============================================================================

export interface WorldCoordinateSystem {
  referencePixel: { x: number; y: number };
  referenceCoordinates: { ra: number; dec: number };
  
  cdMatrix: [number, number, number, number]; // CD1_1, CD1_2, CD2_1, CD2_2
  
  // Derived values
  pixelScale: number;
  rotation: number;
  
  // Methods would be implemented elsewhere
}

export interface FITSWCSHeader {
  CRPIX1: number;
  CRPIX2: number;
  CRVAL1: number;
  CRVAL2: number;
  CD1_1: number;
  CD1_2: number;
  CD2_1: number;
  CD2_2: number;
  CDELT1: number;
  CDELT2: number;
  CROTA1: number;
  CROTA2: number;
  CTYPE1: string;
  CTYPE2: string;
  NAXIS1: number;
  NAXIS2: number;
}

/**
 * Parse WCS from FITS header
 */
export function parseWCSFromFITS(header: Partial<FITSWCSHeader>): WorldCoordinateSystem | null {
  if (!header.CRPIX1 || !header.CRPIX2 || !header.CRVAL1 || !header.CRVAL2) {
    return null;
  }
  
  let cd1_1: number, cd1_2: number, cd2_1: number, cd2_2: number;
  
  if (header.CD1_1 !== undefined) {
    // CD matrix is directly available
    cd1_1 = header.CD1_1 ?? 0;
    cd1_2 = header.CD1_2 ?? 0;
    cd2_1 = header.CD2_1 ?? 0;
    cd2_2 = header.CD2_2 ?? 0;
  } else if (header.CDELT1 !== undefined) {
    // Construct CD matrix from CDELT + CROTA (legacy WCS convention)
    const cdelt1 = header.CDELT1 ?? 0;
    const cdelt2 = header.CDELT2 ?? 0;
    const crota = header.CROTA2 ?? header.CROTA1 ?? 0;
    const crotaRad = crota * (Math.PI / 180);
    
    cd1_1 = cdelt1 * Math.cos(crotaRad);
    cd1_2 = -cdelt2 * Math.sin(crotaRad);
    cd2_1 = cdelt1 * Math.sin(crotaRad);
    cd2_2 = cdelt2 * Math.cos(crotaRad);
  } else {
    return null;
  }
  
  // Calculate pixel scale (arcsec/pixel)
  const pixelScale = Math.sqrt(cd1_1 ** 2 + cd2_1 ** 2) * 3600;
  
  // Calculate rotation (degrees)
  const rotation = Math.atan2(cd2_1, cd1_1) * (180 / Math.PI);
  
  return {
    referencePixel: { x: header.CRPIX1, y: header.CRPIX2 },
    referenceCoordinates: { ra: header.CRVAL1, dec: header.CRVAL2 },
    cdMatrix: [cd1_1, cd1_2, cd2_1, cd2_2],
    pixelScale,
    rotation,
  };
}
