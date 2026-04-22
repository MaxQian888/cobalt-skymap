/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useAladinLoader } from '../use-aladin-loader';

// Mock stores
jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn((selector: (state: unknown) => unknown) => {
      const state = { setHelpers: jest.fn() };
      return selector ? selector(state) : state;
    }),
    { getState: () => ({ setHelpers: jest.fn() }) }
  ),
  useMountStore: Object.assign(
    jest.fn((selector: (state: unknown) => unknown) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 40,
            Longitude: -74,
            Elevation: 0,
          },
        },
      };
      return selector ? selector(state) : state;
    }),
    {
      getState: () => ({
        profileInfo: {
          AstrometrySettings: {
            Latitude: 40,
            Longitude: -74,
            Elevation: 0,
          },
        },
      }),
    }
  ),
}));

// Mock aladin-lite dynamic import via manual resolution
const mockAladin = {
  getRaDec: jest.fn(() => [180, 45]),
  getFov: jest.fn(() => [60, 60]),
  setFov: jest.fn(),
  on: jest.fn(),
  pix2world: jest.fn(),
  world2pix: jest.fn(),
};

const mockAladinApi = {
  init: Promise.resolve(),
  aladin: jest.fn(() => mockAladin),
};

// Mock the dynamic import() call used inside the loader hook
jest.mock('../use-aladin-loader', () => {
  const actual = jest.requireActual('../use-aladin-loader');
  return actual;
});

// Override the dynamic import by intercepting at module level
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).__mockAladinApi = mockAladinApi;
});

describe('useAladinLoader', () => {
  it('should initialize with idle state', () => {
    const containerDiv = document.createElement('div');
    containerDiv.id = 'aladin-lite-container';
    const { result } = renderHook(() =>
      useAladinLoader({
        containerRef: { current: containerDiv },
        aladinRef: { current: null },
      })
    );

    expect(result.current.loadingState.isLoading).toBe(false);
    expect(result.current.loadingState.errorMessage).toBeNull();
    expect(result.current.loadingState.phase).toBe('idle');
    expect(result.current.engineReady).toBe(false);
  });

  it('should have startLoading, handleRetry, reloadEngine functions', () => {
    const containerDiv = document.createElement('div');
    const { result } = renderHook(() =>
      useAladinLoader({
        containerRef: { current: containerDiv },
        aladinRef: { current: null },
      })
    );

    expect(typeof result.current.startLoading).toBe('function');
    expect(typeof result.current.handleRetry).toBe('function');
    expect(typeof result.current.reloadEngine).toBe('function');
  });

  it('should handle missing container gracefully', async () => {
    const { result } = renderHook(() =>
      useAladinLoader({
        containerRef: { current: null },
        aladinRef: { current: null },
      })
    );

    await act(async () => {
      result.current.startLoading();
      await new Promise(r => setTimeout(r, 50));
    });

    expect(result.current.engineReady).toBe(false);
    expect(result.current.loadingState.errorMessage).toBe('Container element not found');
    expect(result.current.loadingState.phase).toBe('failed');
    expect(result.current.loadingState.errorCode).toBe('container_not_ready');
  });

  it('should clear any previous Aladin instance before retrying', async () => {
    const containerDiv = document.createElement('div');
    const remove = jest.fn();
    const aladinRef = { current: { remove } as unknown as never };

    const { result } = renderHook(() =>
      useAladinLoader({
        containerRef: { current: containerDiv },
        aladinRef,
      })
    );

    await act(async () => {
      result.current.handleRetry();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(remove).toHaveBeenCalled();
  });
});
