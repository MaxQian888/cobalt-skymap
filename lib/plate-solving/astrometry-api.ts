/**
 * Astrometry.net API Client
 * 
 * Implements the nova.astrometry.net web services API for plate solving
 * Reference: https://astrometry.net/doc/net/api.html
 */

import { createErrorResult, type PlateSolveResult, type WorldCoordinateSystem } from './types';
import { parseFITSHeader, type WCSInfo } from './fits-parser';
import { formatRA, formatDec } from '@/lib/astronomy/coordinates/formats';
import {
  createEmptyOnlineSolveArtifact,
  type NormalizedOnlineAnnotation,
  type OnlineSolveDetailedResult,
} from './online-solve-types';

// ============================================================================
// Types
// ============================================================================

export interface AstrometryConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  pollInterval?: number;
}

export interface AstrometrySession {
  sessionKey: string;
  expiresAt?: Date;
}

export interface SubmissionResult {
  status: 'success' | 'error';
  subid?: number;
  hash?: string;
  error?: string;
}

export interface SubmissionStatus {
  processing_started?: string;
  processing_finished?: string;
  jobs: number[];
  job_calibrations: [number, number][];
  user_images: number[];
}

export interface JobStatus {
  status: 'solving' | 'success' | 'failure';
}

export interface CalibrationResult {
  parity: number;
  orientation: number;
  pixscale: number;
  radius: number;
  ra: number;
  dec: number;
}

export interface AnnotationObject {
  radius: number;
  type: string;
  names: string[];
  pixelx: number;
  pixely: number;
}

export type SolveProgress = 
  | { stage: 'uploading'; progress: number }
  | { stage: 'queued'; subid: number }
  | { stage: 'processing'; jobId: number }
  | { stage: 'fetching'; jobId: number; progress: number }
  | { stage: 'success'; result: PlateSolveResult }
  | { stage: 'failed'; error: string };

function toWorldCoordinateSystem(wcs?: WCSInfo): WorldCoordinateSystem | null {
  if (!wcs?.cdMatrix) {
    return null;
  }

  return {
    referencePixel: wcs.referencePixel,
    referenceCoordinates: wcs.referenceCoordinates,
    cdMatrix: [
      wcs.cdMatrix.cd1_1,
      wcs.cdMatrix.cd1_2,
      wcs.cdMatrix.cd2_1,
      wcs.cdMatrix.cd2_2,
    ],
    pixelScale: wcs.pixelScale,
    rotation: wcs.rotation,
  };
}

function normalizeAnnotations(annotations: AnnotationObject[]): NormalizedOnlineAnnotation[] {
  return annotations.map((annotation) => ({
    names: [...annotation.names],
    annotationType: annotation.type,
    pixelX: annotation.pixelx,
    pixelY: annotation.pixely,
    radius: annotation.radius,
  }));
}

// ============================================================================
// API Client
// ============================================================================

const DEFAULT_BASE_URL = 'https://nova.astrometry.net';
const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_POLL_INTERVAL = 5000; // 5 seconds

export class AstrometryApiClient {
  private config: Required<AstrometryConfig>;
  private session: AstrometrySession | null = null;
  private abortController: AbortController | null = null;

  constructor(config: AstrometryConfig) {
    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      pollInterval: config.pollInterval || DEFAULT_POLL_INTERVAL,
    };
  }

  /**
   * Login to astrometry.net and get a session key
   */
  async login(): Promise<AstrometrySession> {
    const response = await this.apiRequest('/api/login', {
      apikey: this.config.apiKey,
    });

    if (response.status !== 'success') {
      throw new Error(String(response.message || 'Login failed'));
    }

    this.session = {
      sessionKey: String(response.session),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };

    return this.session;
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureSession(): Promise<string> {
    if (!this.session || (this.session.expiresAt && this.session.expiresAt < new Date())) {
      await this.login();
    }
    if (!this.session) {
      throw new Error('Failed to establish session');
    }
    return this.session.sessionKey;
  }

  /**
   * Upload an image file for plate solving
   */
  async uploadFile(
    file: File | Blob,
    options: Partial<UploadOptions> = {},
    onProgress?: (progress: SolveProgress) => void
  ): Promise<SubmissionResult> {
    const sessionKey = await this.ensureSession();

    onProgress?.({ stage: 'uploading', progress: 0 });

    const formData = new FormData();
    
    const requestJson = JSON.stringify({
      session: sessionKey,
      publicly_visible: options.publiclyVisible ?? 'n',
      allow_commercial_use: options.allowCommercialUse ?? 'd',
      allow_modifications: options.allowModifications ?? 'd',
      scale_units: options.scaleUnits,
      scale_type: options.scaleType,
      scale_lower: options.scaleLower,
      scale_upper: options.scaleUpper,
      scale_est: options.scaleEst,
      scale_err: options.scaleErr,
      center_ra: options.centerRa,
      center_dec: options.centerDec,
      radius: options.radius,
      downsample_factor: options.downsampleFactor,
      tweak_order: options.tweakOrder,
      crpix_center: options.crpixCenter,
      parity: options.parity,
    });

    formData.append('request-json', requestJson);
    formData.append('file', file, file instanceof File ? file.name : 'image.jpg');

    const response = await fetch(`${this.config.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
      signal: this.abortController?.signal,
    });

    const result = await response.json();

    onProgress?.({ stage: 'uploading', progress: 100 });

    if (result.status !== 'success') {
      throw new Error(String(result.errormessage || 'Upload failed'));
    }

    return {
      status: 'success',
      subid: result.subid as number,
      hash: result.hash as string,
    };
  }

  /**
   * Upload an image from URL
   */
  async uploadUrl(
    url: string,
    options: Partial<UploadOptions> = {}
  ): Promise<SubmissionResult> {
    const sessionKey = await this.ensureSession();

    const response = await this.apiRequest('/api/url_upload', {
      session: sessionKey,
      url,
      publicly_visible: options.publiclyVisible ?? 'n',
      allow_commercial_use: options.allowCommercialUse ?? 'd',
      allow_modifications: options.allowModifications ?? 'd',
      scale_units: options.scaleUnits,
      scale_type: options.scaleType,
      scale_lower: options.scaleLower,
      scale_upper: options.scaleUpper,
      center_ra: options.centerRa,
      center_dec: options.centerDec,
      radius: options.radius,
      downsample_factor: options.downsampleFactor,
    });

    if (response.status !== 'success') {
      throw new Error(String(response.errormessage || 'URL upload failed'));
    }

    return {
      status: 'success',
      subid: response.subid as number,
      hash: response.hash as string,
    };
  }

  /**
   * Get submission status
   */
  async getSubmissionStatus(subid: number): Promise<SubmissionStatus> {
    const response = await fetch(
      `${this.config.baseUrl}/api/submissions/${subid}`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get submission status: HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: number): Promise<JobStatus> {
    const response = await fetch(
      `${this.config.baseUrl}/api/jobs/${jobId}`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get job status: HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get calibration result for a job
   */
  async getCalibration(jobId: number): Promise<CalibrationResult> {
    const response = await fetch(
      `${this.config.baseUrl}/api/jobs/${jobId}/calibration/`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get calibration: HTTP ${response.status}`);
    }
    return response.json();
  }

  /**
   * Get objects in field
   */
  async getObjectsInField(jobId: number): Promise<string[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/jobs/${jobId}/objects_in_field/`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get objects in field: HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.objects_in_field || [];
  }

  /**
   * Get annotations with coordinates
   */
  async getAnnotations(jobId: number): Promise<AnnotationObject[]> {
    const response = await fetch(
      `${this.config.baseUrl}/api/jobs/${jobId}/annotations/`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get annotations: HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.annotations || [];
  }

  async getWcsMetadata(jobId: number): Promise<{
    wcs: WorldCoordinateSystem | null;
    frameSize: { width: number; height: number } | null;
  }> {
    const response = await fetch(
      `${this.config.baseUrl}/wcs_file/${jobId}`,
      { signal: this.abortController?.signal }
    );
    if (!response.ok) {
      throw new Error(`Failed to get WCS metadata: HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const file = new File([blob], `astrometry-${jobId}.fits`, {
      type: blob.type || 'application/fits',
    });
    const metadata = await parseFITSHeader(file);

    return {
      wcs: toWorldCoordinateSystem(metadata.wcs),
      frameSize: metadata.image
        ? { width: metadata.image.width, height: metadata.image.height }
        : null,
    };
  }

  /**
   * Solve an image file with progress updates
   */
  async solve(
    file: File | Blob,
    options: Partial<UploadOptions> = {},
    onProgress?: (progress: SolveProgress) => void
  ): Promise<PlateSolveResult> {
    const detailed = await this.solveDetailed(file, options, onProgress);
    return detailed.solveResult;
  }

  async solveDetailed(
    file: File | Blob,
    options: Partial<UploadOptions> = {},
    onProgress?: (progress: SolveProgress) => void
  ): Promise<OnlineSolveDetailedResult> {
    this.abortController = new AbortController();
    const startTime = Date.now();
    const artifact = createEmptyOnlineSolveArtifact('web');

    try {
      // Upload the file
      const submission = await this.uploadFile(file, options, onProgress);
      
      if (!submission.subid) {
        throw new Error('No submission ID returned');
      }
      artifact.submissionId = submission.subid;

      onProgress?.({ stage: 'queued', subid: submission.subid });

      // Poll for job ID
      let jobId: number | null = null;
      while (!jobId) {
        if (Date.now() - startTime > this.config.timeout) {
          throw new Error('Timeout waiting for job to start');
        }

        await this.delay(this.config.pollInterval);
        const status = await this.getSubmissionStatus(submission.subid);
        
        if (status.jobs && status.jobs.length > 0) {
          jobId = status.jobs[0];
          artifact.jobId = jobId;
        }
      }

      onProgress?.({ stage: 'processing', jobId });

      // Poll for job completion
      while (true) {
        if (Date.now() - startTime > this.config.timeout) {
          throw new Error('Timeout waiting for solve to complete');
        }

        await this.delay(this.config.pollInterval);
        const jobStatus = await this.getJobStatus(jobId);

        if (jobStatus.status === 'success') {
          break;
        } else if (jobStatus.status === 'failure') {
          throw new Error('Plate solving failed');
        }
      }

      // Get results
      onProgress?.({ stage: 'fetching', jobId, progress: 85 });
      const calibration = await this.getCalibration(jobId);
      const objects = await this.getObjectsInField(jobId);
      artifact.objectsInField = objects;

      try {
        const annotations = await this.getAnnotations(jobId);
        artifact.annotations = normalizeAnnotations(annotations);
        artifact.diagnostics.annotations = 'complete';
      } catch (error) {
        artifact.diagnostics.annotations = 'missing';
        artifact.diagnostics.issues.push({
          artifact: 'annotations',
          message: error instanceof Error ? error.message : 'Failed to fetch annotations',
        });
      }

      try {
        const wcsMetadata = await this.getWcsMetadata(jobId);
        artifact.wcs = wcsMetadata.wcs;
        artifact.frameSize = wcsMetadata.frameSize;
        if (wcsMetadata.wcs) {
          artifact.diagnostics.wcs = 'complete';
        } else {
          artifact.diagnostics.wcs = 'missing';
          artifact.diagnostics.issues.push({
            artifact: 'wcs',
            message: 'WCS metadata missing from response',
          });
        }
      } catch (error) {
        artifact.diagnostics.wcs = 'missing';
        artifact.diagnostics.issues.push({
          artifact: 'wcs',
          message: error instanceof Error ? error.message : 'Failed to fetch WCS metadata',
        });
      }

      // Extract image dimensions for accurate FOV calculation
      let imageWidth: number | undefined;
      let imageHeight: number | undefined;
      if (file instanceof File) {
        const dims = await this.getImageDimensions(file);
        imageWidth = dims?.width;
        imageHeight = dims?.height;
      }

      const result = this.convertCalibrationToResult(
        calibration,
        objects,
        Date.now() - startTime,
        imageWidth,
        imageHeight
      );
      result.onlineSolve = artifact;

      onProgress?.({ stage: 'success', result });

      return {
        solveResult: result,
        artifact,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({ stage: 'failed', error: errorMessage });
      
      const result = createErrorResult('astrometry.net', errorMessage);
      result.solveTime = Date.now() - startTime;
      artifact.errorMessage = errorMessage;
      result.onlineSolve = artifact;
      return {
        solveResult: result,
        artifact,
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel the current solve operation
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Extract image dimensions from a File object
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   * Convert calibration result to PlateSolveResult
   */
  private convertCalibrationToResult(
    calibration: CalibrationResult,
    objects: string[],
    solveTime: number,
    imageWidth?: number,
    imageHeight?: number
  ): PlateSolveResult {
    const ra = calibration.ra;
    const dec = calibration.dec;

    // Calculate accurate FOV from pixel scale and image dimensions when available
    const fovWidth = imageWidth && calibration.pixscale
      ? (calibration.pixscale * imageWidth) / 3600
      : calibration.radius * 2;
    const fovHeight = imageHeight && calibration.pixscale
      ? (calibration.pixscale * imageHeight) / 3600
      : calibration.radius * 2;

    return {
      success: true,
      coordinates: {
        ra,
        dec,
        raHMS: formatRA(ra),
        decDMS: formatDec(dec),
      },
      positionAngle: calibration.orientation,
      pixelScale: calibration.pixscale,
      fov: {
        width: fovWidth,
        height: fovHeight,
      },
      flipped: calibration.parity < 0,
      solverName: 'astrometry.net',
      solveTime,
    };
  }

  /**
   * Make an API request with JSON encoding
   */
  private async apiRequest(endpoint: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const formData = new URLSearchParams();
    formData.append('request-json', JSON.stringify(data));

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: this.abortController?.signal,
    });

    return response.json();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}

// ============================================================================
// Upload Options
// ============================================================================

export interface UploadOptions {
  publiclyVisible: 'y' | 'n';
  allowCommercialUse: 'd' | 'y' | 'n';
  allowModifications: 'd' | 'y' | 'n' | 'sa';
  scaleUnits: 'degwidth' | 'arcminwidth' | 'arcsecperpix';
  scaleType: 'ul' | 'ev';
  scaleLower: number;
  scaleUpper: number;
  scaleEst: number;
  scaleErr: number;
  centerRa: number;
  centerDec: number;
  radius: number;
  downsampleFactor: number;
  tweakOrder: number;
  crpixCenter: boolean;
  parity: 0 | 1 | 2;
}

