/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { LoadingState } from '@/types/stellarium-canvas';
import { LoadingOverlay } from './loading-overlay';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { seconds?: number }) => {
    if (key === 'elapsedTime') {
      return `elapsedTime:${values?.seconds ?? 0}`;
    }
    return key;
  },
}));

function createLoadingState(overrides: Partial<LoadingState> = {}): LoadingState {
  return {
    isLoading: true,
    loadingStatus: 'Preparing resources...',
    errorMessage: null,
    startTime: null,
    progress: 25,
    phase: 'preparing',
    ...overrides,
  };
}

describe('LoadingOverlay', () => {
  const onRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when idle without errors or terminal phase', () => {
    const { container } = render(
      <LoadingOverlay
        loadingState={createLoadingState({ isLoading: false, phase: 'idle' })}
        onRetry={onRetry}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders loading UI with status role and progress indicator', () => {
    render(
      <LoadingOverlay
        loadingState={createLoadingState({ loadingStatus: 'Loading engine...' })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('stellarium-loading-overlay')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Loading engine...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('animates progress towards target value via requestAnimationFrame', async () => {
    const rafQueue: FrameRequestCallback[] = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
    const cancelSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    try {
      const { container } = render(
        <LoadingOverlay
          loadingState={createLoadingState({ progress: 60 })}
          onRetry={onRetry}
        />
      );

      expect(rafQueue.length).toBeGreaterThan(0);

      await act(async () => {
        for (let i = 0; i < 8 && rafQueue.length > 0; i += 1) {
          const frame = rafQueue.shift();
          frame?.(16 * (i + 1));
        }
      });

      const indicator = container.querySelector('[data-slot="progress-indicator"]') as HTMLElement;
      expect(indicator.style.transform).not.toBe('translateX(-100%)');
    } finally {
      rafSpy.mockRestore();
      cancelSpy.mockRestore();
    }
  });

  it('renders error state with alert role and retry action', () => {
    const { container } = render(
      <LoadingOverlay
        loadingState={createLoadingState({
          isLoading: false,
          loadingStatus: 'Initialization failed',
          errorMessage: 'WASM error',
          progress: 0,
        })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('stellarium-loading-overlay')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('WASM error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('shows terminal retry for timed_out phase without explicit error', () => {
    render(
      <LoadingOverlay
        loadingState={createLoadingState({
          isLoading: false,
          loadingStatus: 'Timed out',
          phase: 'timed_out',
          progress: 100,
        })}
        onRetry={onRetry}
      />
    );

    expect(screen.getByTestId('stellarium-loading-overlay')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    render(
      <LoadingOverlay
        loadingState={createLoadingState({
          isLoading: false,
          errorMessage: 'Script load failed',
          progress: 0,
        })}
        onRetry={onRetry}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  describe('timing hints', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T00:00:20.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows elapsed time and first-load hint after initial seconds', () => {
      render(
        <LoadingOverlay
          loadingState={createLoadingState({
            startTime: Date.now() - 6000,
            progress: 40,
          })}
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('elapsedTime:6')).toBeInTheDocument();
      expect(screen.getByText('firstLoadHint')).toBeInTheDocument();
      expect(screen.queryByText('loadingSlowHint')).not.toBeInTheDocument();
    });

    it('shows slow-loading hint and retry after threshold', () => {
      render(
        <LoadingOverlay
          loadingState={createLoadingState({
            startTime: Date.now() - 16000,
            progress: 60,
          })}
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('loadingSlowHint')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
    });
  });
});
