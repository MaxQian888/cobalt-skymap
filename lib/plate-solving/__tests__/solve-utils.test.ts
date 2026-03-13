/**
 * Tests for plate-solving/solve-utils.ts
 * Progress formatting utilities and file persistence
 */

import { getProgressText, getProgressPercent, persistFileForLocalSolve } from '../solve-utils';
import type { SolveProgress } from '../astrometry-api';
import { createInitialOnlineSolveSessionState } from '../online-solve-contract';
import type { PlateSolveResult } from '../types';

const mockT = (key: string) => key;

// ============================================================================
// persistFileForLocalSolve
// ============================================================================

jest.mock('@tauri-apps/plugin-fs', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  remove: jest.fn(),
  BaseDirectory: { AppCache: 'AppCache' },
}), { virtual: true });

jest.mock('@tauri-apps/api/path', () => ({
  BaseDirectory: { AppCache: 'AppCache' },
  appCacheDir: jest.fn(() => Promise.resolve('/mock/cache')),
  join: jest.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}), { virtual: true });

describe('persistFileForLocalSolve', () => {
  it('should return native file path directly when available', async () => {
    const file = new File(['data'], 'test.fits') as File & { path?: string };
    (file as unknown as Record<string, unknown>).path = '/native/path/test.fits';

    const result = await persistFileForLocalSolve(file);
    expect(result.filePath).toBe('/native/path/test.fits');
    expect(result.cleanup).toBeUndefined();
  });

  it('should write file to AppCache and return cleanup when no native path', async () => {
    const file = new File(['pixel-data'], 'astro image!.fits');
    // jsdom File doesn't implement arrayBuffer(), so mock it
    if (!file.arrayBuffer) {
      (file as unknown as Record<string, unknown>).arrayBuffer = () =>
        Promise.resolve(new TextEncoder().encode('pixel-data').buffer);
    }

    const result = await persistFileForLocalSolve(file);
    expect(result.filePath).toContain('/mock/cache');
    expect(result.filePath).toContain('plate-solving');
    expect(result.cleanup).toBeDefined();

    // Cleanup should call remove
    const { remove } = await import('@tauri-apps/plugin-fs');
    await result.cleanup!();
    expect(remove).toHaveBeenCalled();
  });
});

// ============================================================================
// getProgressText
// ============================================================================

describe('getProgressText', () => {
  it('should return empty string when progress is null', () => {
    const text = getProgressText(null, mockT);
    expect(text).toBe('');
  });

  it('should return text for uploading stage', () => {
    const p: SolveProgress = { stage: 'uploading', progress: 50 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('50');
  });

  it('should return text for queued stage', () => {
    const p: SolveProgress = { stage: 'queued', subid: 12345 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('12345');
  });

  it('should return text for processing stage', () => {
    const p: SolveProgress = { stage: 'processing', jobId: 9999 };
    const text = getProgressText(p, mockT);
    expect(text).toContain('9999');
  });

  it('should return text for success stage', () => {
    const p: SolveProgress = { stage: 'success', result: {} as PlateSolveResult };
    const text = getProgressText(p, mockT);
    expect(text).toBeDefined();
  });

  it('should return text for failed stage', () => {
    const p: SolveProgress = { stage: 'failed', error: 'Timeout' };
    const text = getProgressText(p, mockT);
    expect(text).toContain('Timeout');
  });

  it('should use fallback text when translation key returns empty', () => {
    const emptyT = () => '';
    const p: SolveProgress = { stage: 'uploading', progress: 10 };
    const text = getProgressText(p, emptyT);
    expect(text).toContain('Uploading');
  });

  it('should use fallback text for queued, processing, success, and failed stages', () => {
    const emptyT = () => '';

    expect(getProgressText({ stage: 'queued', subid: 9 }, emptyT)).toBe('Queued (ID: 9)');
    expect(getProgressText({ stage: 'processing', jobId: 12 }, emptyT)).toBe('Processing (Job: 12)');
    expect(getProgressText({ stage: 'success', result: {} as PlateSolveResult }, emptyT)).toBe('Success!');
    expect(getProgressText({ stage: 'failed', error: 'Network down' }, emptyT)).toBe('Failed: Network down');
  });

  it('should support normalized session stages', () => {
    const session = {
      ...createInitialOnlineSolveSessionState('tauri'),
      stage: 'authenticating' as const,
      progress: 10,
    };
    const text = getProgressText(session, mockT);
    expect(text).toContain('authenticating');
  });

  it.each([
    [
      {
        ...createInitialOnlineSolveSessionState('web'),
        stage: 'queued' as const,
        subId: 18,
      },
      '18',
    ],
    [
      {
        ...createInitialOnlineSolveSessionState('web'),
        stage: 'solving' as const,
        jobId: 27,
      },
      '27',
    ],
    [
      {
        ...createInitialOnlineSolveSessionState('web'),
        stage: 'failed' as const,
        errorMessage: 'Bad header',
      },
      'Bad header',
    ],
  ])('should format normalized session state details', (session, expectedText) => {
    expect(getProgressText(session, mockT)).toContain(expectedText);
  });

  it('should format normalized session fallback states', () => {
    const emptyT = () => '';

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'preflight',
    }, emptyT)).toBe('Checking requirements...');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'uploading',
      progress: 22,
    }, emptyT)).toBe('Uploading... 22%');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'queued',
    }, emptyT)).toBe('Queued');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'solving',
    }, emptyT)).toBe('Processing');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'fetching',
    }, emptyT)).toBe('Fetching solve result...');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'success',
    }, emptyT)).toBe('Success!');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'failed',
    }, emptyT)).toBe('Failed');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'cancelled',
    }, emptyT)).toBe('Solve cancelled by user');

    expect(getProgressText({
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'idle',
    }, emptyT)).toBe('');
  });
});

// ============================================================================
// getProgressPercent
// ============================================================================

describe('getProgressPercent', () => {
  it('should return 0 when online progress is null', () => {
    expect(getProgressPercent('online', 0, null)).toBe(0);
  });

  it('should return localProgress for local mode', () => {
    expect(getProgressPercent('local', 75, null)).toBe(75);
  });

  it('should return uploading progress * 0.3', () => {
    const p: SolveProgress = { stage: 'uploading', progress: 50 };
    expect(getProgressPercent('online', 0, p)).toBe(15);
  });

  it('should return 30 for queued stage', () => {
    const p: SolveProgress = { stage: 'queued', subid: 1 };
    expect(getProgressPercent('online', 0, p)).toBe(30);
  });

  it('should return 60 for processing stage', () => {
    const p: SolveProgress = { stage: 'processing', jobId: 1 };
    expect(getProgressPercent('online', 0, p)).toBe(60);
  });

  it('should return 100 for success stage', () => {
    const p: SolveProgress = { stage: 'success', result: {} as PlateSolveResult };
    expect(getProgressPercent('online', 0, p)).toBe(100);
  });

  it('should return 100 for failed stage', () => {
    const p: SolveProgress = { stage: 'failed', error: 'err' };
    expect(getProgressPercent('online', 0, p)).toBe(100);
  });

  it('should return normalized progress for session state', () => {
    const session = {
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'queued' as const,
      progress: 42,
    };
    expect(getProgressPercent('online', 0, session)).toBe(42);
  });

  it.each([
    [{ stage: 'idle' as const, progress: 0 }, 0],
    [{ stage: 'preflight' as const, progress: 0 }, 5],
    [{ stage: 'authenticating' as const, progress: 0 }, 10],
    [{ stage: 'uploading' as const, progress: 5 }, 10],
    [{ stage: 'solving' as const, progress: 55 }, 55],
    [{ stage: 'fetching' as const, progress: 79 }, 80],
    [{ stage: 'cancelled' as const, progress: 0 }, 100],
  ])('should normalize session stage %s progress', (partialSession, expectedPercent) => {
    const session = {
      ...createInitialOnlineSolveSessionState('web'),
      ...partialSession,
    };

    expect(getProgressPercent('online', 0, session)).toBe(expectedPercent);
  });

  it('should return default progress for unknown states', () => {
    const unknownSession = {
      ...createInitialOnlineSolveSessionState('web'),
      stage: 'mystery' as never,
    };

    const unknownProgress = {
      stage: 'mystery',
    } as unknown as SolveProgress;

    expect(getProgressPercent('online', 0, unknownSession)).toBe(0);
    expect(getProgressPercent('online', 0, unknownProgress)).toBe(0);
  });
});
