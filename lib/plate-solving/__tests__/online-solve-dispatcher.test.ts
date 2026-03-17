import { createEmptyOnlineSolveArtifact } from '../online-solve-types';
import { executeOnlineSolve, mapTauriOnlineSolveResult } from '../online-solve-dispatcher';
import type { PlateSolveResult } from '../types';

const translate = (key: string) => {
  const translations: Record<string, string> = {
    'plateSolving.needApiKey': 'API key required for online solving',
    'plateSolving.offlineCannotSolve': 'Network is offline. Online solving unavailable.',
    'plateSolving.cancelled': 'Solve cancelled by user',
    'plateSolving.failed': 'Failed',
  };
  return translations[key] ?? key;
};

const successSolveResult: PlateSolveResult = {
  success: true,
  coordinates: {
    ra: 180.5,
    dec: 45.25,
    raHMS: '12h02m00s',
    decDMS: '+45d15m',
  },
  positionAngle: 12.5,
  pixelScale: 1.2,
  fov: { width: 2.5, height: 1.8 },
  flipped: false,
  solverName: 'astrometry.net',
  solveTime: 1200,
  onlineSolve: {
    ...createEmptyOnlineSolveArtifact('web'),
    submissionId: 42,
    jobId: 77,
    objectsInField: ['M31'],
    diagnostics: {
      annotations: 'complete',
      wcs: 'complete',
      issues: [],
    },
  },
};

describe('online-solve-dispatcher', () => {
  it('blocks immediately when API key is missing', async () => {
    const updateSession = jest.fn();

    const result = await executeOnlineSolve({
      runtime: 'web',
      file: new File(['test'], 'test.fits'),
      onlineApiKey: '',
      options: {},
      searchRadius: 5,
      retryOnFailure: false,
      maxRetries: 2,
      timeoutSeconds: 120,
      updateSession,
      t: translate,
      dependencies: {
        isNetworkOnline: () => true,
      },
    });

    expect(result.result.success).toBe(false);
    expect(result.diagnostics.terminalErrorCode).toBe('missing_api_key');
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
      stage: 'failed',
      errorCode: 'missing_api_key',
    }));
  });

  it('runs the web solve path through the shared dispatcher and preserves normalized artifact diagnostics', async () => {
    const updateSession = jest.fn();
    const cancel = jest.fn();
    const solveDetailed = jest.fn().mockResolvedValue({
      solveResult: successSolveResult,
      artifact: successSolveResult.onlineSolve,
    });
    const registerClient = jest.fn();

    const result = await executeOnlineSolve({
      runtime: 'web',
      file: new File(['test'], 'test.fits'),
      onlineApiKey: 'test-key',
      options: {},
      searchRadius: 5,
      retryOnFailure: false,
      maxRetries: 2,
      timeoutSeconds: 120,
      updateSession,
      registerWebClient: registerClient,
      t: translate,
      dependencies: {
        isNetworkOnline: () => true,
        createWebClient: () => ({ solveDetailed, cancel }),
      },
    });

    expect(solveDetailed).toHaveBeenCalled();
    expect(result.result.onlineSolve?.jobId).toBe(77);
    expect(result.diagnostics.artifactSummary?.annotationCount).toBe(0);
    expect(registerClient).toHaveBeenCalledWith(expect.objectContaining({ cancel }));
    expect(registerClient).toHaveBeenLastCalledWith(null);
  });

  it('maps tauri online results into the normalized artifact contract', () => {
    const mapped = mapTauriOnlineSolveResult({
      success: true,
      operation_id: 'op-1',
      ra: 83.633,
      dec: 22.014,
      orientation: 45,
      pixscale: 1.2,
      radius: 0.5,
      parity: 1,
      fov_width: 0.6,
      fov_height: 0.4,
      objects_in_field: ['M42'],
      annotations: [{ names: ['M42'], annotation_type: 'nebula', pixelx: 500, pixely: 400, radius: 30 }],
      job_id: 12345,
      wcs: {
        crpix1: 1500.5,
        crpix2: 1000.5,
        crval1: 83.633,
        crval2: 22.014,
        cdelt1: null,
        cdelt2: null,
        crota1: null,
        crota2: null,
        cd1_1: -0.00012,
        cd1_2: 0,
        cd2_1: 0,
        cd2_2: 0.00012,
        ctype1: 'RA---TAN-SIP',
        ctype2: 'DEC--TAN-SIP',
        naxis1: 3000,
        naxis2: 2000,
        sip: null,
      },
      solve_time_ms: 5000,
      error_code: null,
      error_message: null,
    });

    expect(mapped.solveResult.success).toBe(true);
    expect(mapped.artifact.operationId).toBe('op-1');
    expect(mapped.artifact.jobId).toBe(12345);
    expect(mapped.artifact.annotations).toHaveLength(1);
    expect(mapped.artifact.wcs?.referenceCoordinates.ra).toBeCloseTo(83.633);
    expect(mapped.artifact.frameSize).toEqual({ width: 3000, height: 2000 });
  });
});
