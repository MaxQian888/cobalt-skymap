import {
  classifyOnlineSolveError,
  createInitialOnlineSolveSessionState,
  isRetryableOnlineError,
  mapTauriProgressToOnlineSession,
  mapWebProgressToOnlineSession,
} from '../online-solve-contract';
import type { PlateSolveResult } from '../types';

const successSolveResult: PlateSolveResult = {
  success: true,
  coordinates: {
    ra: 0,
    dec: 0,
    raHMS: '00:00:00',
    decDMS: '+00:00:00',
  },
  positionAngle: 0,
  pixelScale: 1,
  fov: {
    width: 1,
    height: 1,
  },
  flipped: false,
  solverName: 'web',
  solveTime: 1000,
};

describe('online-solve-contract', () => {
  it('creates a clean initial session state', () => {
    expect(createInitialOnlineSolveSessionState()).toEqual({
      stage: 'idle',
      runtime: 'web',
      progress: 0,
      attempt: 0,
      maxAttempts: 0,
      message: '',
      errorCode: null,
      errorMessage: null,
      cancelled: false,
      subId: null,
      jobId: null,
      operationId: null,
    });
    expect(createInitialOnlineSolveSessionState('tauri').runtime).toBe('tauri');
  });

  it('maps tauri login progress to authenticating stage', () => {
    const current = createInitialOnlineSolveSessionState('tauri');
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'login',
        progress: 0,
        message: 'Authenticating...',
        sub_id: null,
        job_id: null,
        operation_id: 'op-1',
      },
      current
    );

    expect(mapped.stage).toBe('authenticating');
    expect(mapped.operationId).toBe('op-1');
  });

  it('maps tauri processing with sub_id to queued stage', () => {
    const current = createInitialOnlineSolveSessionState('tauri');
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'processing',
        progress: 34,
        message: 'Waiting for job...',
        sub_id: 101,
        job_id: null,
        operation_id: 'op-2',
      },
      current
    );

    expect(mapped.stage).toBe('queued');
    expect(mapped.subId).toBe(101);
  });

  it.each([
    [
      {
        stage: 'upload',
        progress: 120,
        message: 'Uploading...',
        sub_id: null,
        job_id: null,
        operation_id: 'op-upload',
      },
      'uploading',
      100,
    ],
    [
      {
        stage: 'solving',
        progress: 64,
        message: 'Solving...',
        sub_id: 99,
        job_id: 123,
        operation_id: 'op-solving',
      },
      'solving',
      64,
    ],
    [
      {
        stage: 'fetching',
        progress: 84,
        message: 'Fetching...',
        sub_id: 99,
        job_id: 123,
        operation_id: 'op-fetching',
      },
      'fetching',
      84,
    ],
    [
      {
        stage: 'complete',
        progress: 88,
        message: 'Done',
        sub_id: 99,
        job_id: 123,
        operation_id: 'op-complete',
      },
      'success',
      100,
    ],
  ] as const)(
    'maps tauri %s progress to %s',
    (payload, expectedStage, expectedProgress) => {
      const mapped = mapTauriProgressToOnlineSession(
        payload,
        createInitialOnlineSolveSessionState('tauri')
      );

      expect(mapped.stage).toBe(expectedStage);
      expect(mapped.progress).toBe(expectedProgress);
      expect(mapped.runtime).toBe('tauri');
      expect(mapped.operationId).toBe(payload.operation_id);
    }
  );

  it('maps tauri processing without submission id back to uploading', () => {
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'processing',
        progress: Number.NaN,
        message: 'Preparing upload...',
        sub_id: null,
        job_id: null,
        operation_id: null,
      },
      createInitialOnlineSolveSessionState('tauri')
    );

    expect(mapped.stage).toBe('uploading');
    expect(mapped.progress).toBe(0);
  });

  it('keeps the current stage for unknown tauri progress values', () => {
    const mapped = mapTauriProgressToOnlineSession(
      {
        stage: 'mystery',
        progress: Number.POSITIVE_INFINITY,
        message: undefined as unknown as string,
        sub_id: null,
        job_id: 88,
        operation_id: 'op-unknown',
      },
      {
        ...createInitialOnlineSolveSessionState('tauri'),
        stage: 'queued',
        message: 'Existing message',
      }
    );

    expect(mapped.stage).toBe('queued');
    expect(mapped.message).toBe('Existing message');
    expect(mapped.progress).toBe(0);
    expect(mapped.jobId).toBe(88);
  });

  it.each([
    [{ stage: 'uploading', progress: 12 }, 'uploading', 12],
    [{ stage: 'queued', subid: 42 }, 'queued', 30],
    [{ stage: 'processing', jobId: 77 }, 'solving', 60],
    [{ stage: 'success', result: successSolveResult }, 'success', 100],
  ] as const)('maps web %s progress to a normalized session', (payload, expectedStage, expectedProgress) => {
    const mapped = mapWebProgressToOnlineSession(
      payload,
      createInitialOnlineSolveSessionState('web')
    );

    expect(mapped.runtime).toBe('web');
    expect(mapped.stage).toBe(expectedStage);
    expect(mapped.progress).toBe(expectedProgress);
    expect(mapped.errorCode).toBeNull();
    expect(mapped.errorMessage).toBeNull();
    expect(mapped.cancelled).toBe(false);
  });

  it('maps web cancellation failures to a cancelled terminal session', () => {
    const mapped = mapWebProgressToOnlineSession(
      { stage: 'failed', error: 'Solve canceled by user request' },
      createInitialOnlineSolveSessionState('web')
    );

    expect(mapped.stage).toBe('cancelled');
    expect(mapped.errorCode).toBe('cancelled');
    expect(mapped.cancelled).toBe(true);
  });

  it('maps web failed progress to classified terminal failure', () => {
    const current = createInitialOnlineSolveSessionState('web');
    const mapped = mapWebProgressToOnlineSession(
      { stage: 'failed', error: 'Login failed: invalid api key' },
      current
    );

    expect(mapped.stage).toBe('failed');
    expect(mapped.errorCode).toBe('auth_failed');
  });

  it('classifies cancellation errors', () => {
    const classified = classifyOnlineSolveError(new Error('Solve cancelled by user'));
    expect(classified.code).toBe('cancelled');
  });

  it.each([
    ['api key required to continue', 'missing_api_key'],
    ['Network is offline', 'offline'],
    ['Login failed: invalid api key', 'auth_failed'],
    ['Upload failed during transfer', 'upload_failed'],
    ['Job timed out while waiting', 'timeout'],
    ['Image not found on disk', 'invalid_image'],
    ['DNS connection issue', 'network'],
    ['Remote service failed to solve', 'service_failed'],
    ['Something unexpected happened', 'unknown'],
  ] as const)('classifies "%s" as %s', (message, expectedCode) => {
    expect(classifyOnlineSolveError(message)).toEqual({
      code: expectedCode,
      message,
    });
  });

  it('falls back to a generic message for non-error inputs', () => {
    expect(classifyOnlineSolveError({ detail: 'opaque' })).toEqual({
      code: 'unknown',
      message: 'Unknown online solve error',
    });
  });

  it('marks timeout/network/service failures as retryable', () => {
    expect(isRetryableOnlineError('timeout')).toBe(true);
    expect(isRetryableOnlineError('network')).toBe(true);
    expect(isRetryableOnlineError('service_failed')).toBe(true);
    expect(isRetryableOnlineError('auth_failed')).toBe(false);
  });
});
