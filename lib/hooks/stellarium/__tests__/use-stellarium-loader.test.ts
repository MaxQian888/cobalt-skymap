/**
 * Tests for use-stellarium-loader.ts
 * Stellarium engine loading and initialization
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useStellariumLoader } from '../use-stellarium-loader';
import { useRef } from 'react';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setStel: jest.fn(),
      setBaseUrl: jest.fn(),
      setHelpers: jest.fn(),
      setLoading: jest.fn(),
      updateStellariumCore: jest.fn(),
    })
  ),
  useSettingsStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        stellarium: {
          skyCultureLanguage: 'native',
        },
        performance: {
          renderQuality: 'high',
        },
      })
    ),
    {
      getState: () => ({
        stellarium: {
          skyCultureLanguage: 'native',
        },
        performance: {
          renderQuality: 'high',
        },
      }),
    }
  ),
  useMountStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      profileInfo: {
        AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 100 },
      },
    })
  ),
}));

jest.mock('@/lib/translations', () => ({
  createStellariumTranslator: jest.fn(() => ({
    translate: (key: string) => key,
  })),
}));

describe('useStellariumLoader', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return loading state and control functions', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const stelRef = useRef(null);
      return useStellariumLoader({
        containerRef,
        canvasRef,
        stelRef,
      });
    });

    expect(result.current.loadingState).toBeDefined();
    expect(result.current.engineReady).toBe(false);
    expect(result.current.loadingState.tierReadiness?.core).toBeDefined();
    expect(typeof result.current.startLoading).toBe('function');
    expect(typeof result.current.handleRetry).toBe('function');
    expect(typeof result.current.reloadEngine).toBe('function');
  });

  it('should start with loading state not loaded', () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const stelRef = useRef(null);
      return useStellariumLoader({
        containerRef,
        canvasRef,
        stelRef,
      });
    });

    expect(result.current.loadingState).toBeDefined();
    expect(result.current.engineReady).toBe(false);
    expect(result.current.loadingState.phase).toBe('preparing');
  });

  it('should stop retrying and surface overall timeout when canvas/container never become ready', async () => {
    const { result } = renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      const stelRef = useRef(null);
      return useStellariumLoader({
        containerRef,
        canvasRef,
        stelRef,
      });
    });

    await act(async () => {
      void result.current.startLoading();
      jest.advanceTimersByTime(60000);
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(result.current.loadingState.errorMessage).toBe('overallTimeout');
      expect(result.current.loadingState.isLoading).toBe(false);
      expect(result.current.loadingState.phase).toBe('timed_out');
      expect(result.current.loadingState.errorCode).toBe('overall_timeout');
    });
  });
});
