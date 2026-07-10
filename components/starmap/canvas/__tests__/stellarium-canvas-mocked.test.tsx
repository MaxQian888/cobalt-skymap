/**
 * @jest-environment jsdom
 *
 * Tests for StellariumCanvas internal logic (bindEngineEvents, onEngineEvent,
 * gotoObject, getEngineStatus, getFov, ResizeObserver) by mocking all hooks
 * to capture and control stelRef directly.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import type { StellariumCanvasRef } from '@/types/stellarium-canvas';

// ============================================================================
// Mocks
// ============================================================================

const mockSetStel = jest.fn();
const mockSetHelpers = jest.fn();
const mockSetActiveEngine = jest.fn();
const mockClearSavedViewState = jest.fn();
let mockGetStateResult: Record<string, unknown> = {
  setHelpers: mockSetHelpers,
  savedViewState: null,
  clearSavedViewState: mockClearSavedViewState,
  setViewDirection: null,
};

jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        setStel: mockSetStel,
        setBaseUrl: jest.fn(),
        setHelpers: mockSetHelpers,
        updateStellariumCore: jest.fn(),
        setActiveEngine: mockSetActiveEngine,
        setCanvasEl: jest.fn(),
      };
      return selector(state);
    }),
    { getState: () => mockGetStateResult }
  ),
  useSettingsStore: Object.assign(
    jest.fn((selector) => selector({
      stellarium: { skyCultureLanguage: 'native' },
      performance: { renderQuality: 'high' },
    })),
    {
      getState: () => ({
        stellarium: { skyCultureLanguage: 'native' },
        performance: { renderQuality: 'high' },
      }),
      subscribe: jest.fn(() => jest.fn()),
    }
  ),
  useMountStore: Object.assign(
    jest.fn((selector) => selector({
      profileInfo: { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } },
    })),
    {
      getState: () => ({
        profileInfo: { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } },
      }),
    }
  ),
}));

// Capture stelRef from useStellariumLoader
let capturedStelRef: React.MutableRefObject<unknown> | null = null;

const mockLoadingState = {
  isLoading: false,
  errorMessage: null as string | null,
  loadingStatus: '',
  startTime: null,
};

// Stable references to prevent useEffect dependency changes between renders
const stableStartLoading = jest.fn();
const stableHandleRetry = jest.fn();
const stableReloadEngine = jest.fn();
const stableGetClickCoordinates = jest.fn();
const stableZoomIn = jest.fn();
const stableZoomOut = jest.fn();
const stableSetFov = jest.fn();
const stableRunCalendar = jest.fn();
const stableSetEngineFont = jest.fn();

jest.mock('@/lib/hooks/stellarium', () => ({
  useClickCoordinates: jest.fn(() => ({ getClickCoordinates: stableGetClickCoordinates })),
  useStellariumLoader: jest.fn((opts) => {
    capturedStelRef = opts.stelRef;
    return {
      loadingState: mockLoadingState,
      engineReady: true,
      startLoading: stableStartLoading,
      handleRetry: stableHandleRetry,
      reloadEngine: stableReloadEngine,
    };
  }),
  useStellariumZoom: jest.fn(() => ({
    zoomIn: stableZoomIn,
    zoomOut: stableZoomOut,
    setFov: stableSetFov,
  })),
  useStellariumEvents: jest.fn(),
  useObserverSync: jest.fn(),
  useSettingsSync: jest.fn(),
  useStellariumCalendar: jest.fn(() => ({ runCalendar: stableRunCalendar })),
  useStellariumFonts: jest.fn(() => ({ setEngineFont: stableSetEngineFont })),
}));

// Mock LoadingOverlay
jest.mock('../components', () => ({
  LoadingOverlay: () => <div data-testid="loading-overlay" />,
}));

// Mock canvas utils
jest.mock('@/lib/core/stellarium-canvas-utils', () => ({
  fovToDeg: (rad: number) => rad * (180 / Math.PI),
  fovToRad: (deg: number) => deg * (Math.PI / 180),
  getEffectiveDpr: () => 1,
}));

jest.mock('@/lib/core/constants/fov', () => ({
  DEFAULT_FOV: 60,
  MIN_FOV: 0.5,
  MAX_FOV: 180,
}));

import { StellariumCanvas } from '../stellarium-canvas';

// ============================================================================
// Helpers
// ============================================================================

function createMockStelEngine() {
  return {
    core: {
      observer: { latitude: 0, longitude: 0, elevation: 0 },
      fov: Math.PI / 3, // 60 deg
      selection: null as unknown,
    },
    on: jest.fn(),
    getObj: jest.fn(),
    pointAndLock: jest.fn(),
  };
}

function renderWithStel(props: Record<string, unknown> = {}) {
  const ref = React.createRef<StellariumCanvasRef>();
  const mockStel = createMockStelEngine();
  const result = render(<StellariumCanvas ref={ref} {...props} />);

  // Inject mock engine into captured stelRef
  if (capturedStelRef) {
    capturedStelRef.current = mockStel;
  }
  // Re-render so useImperativeHandle picks up the populated ref
  result.rerender(<StellariumCanvas ref={ref} {...props} />);

  return { ref, mockStel, ...result };
}

// ============================================================================
// Tests
// ============================================================================

describe('StellariumCanvas (mocked hooks)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedStelRef = null;
    mockGetStateResult = {
      setHelpers: mockSetHelpers,
      savedViewState: null,
      clearSavedViewState: mockClearSavedViewState,
      setViewDirection: null,
    };
  });

  describe('gotoObject', () => {
    it('selects and locks object found by direct name', () => {
      const { ref, mockStel } = renderWithStel();
      const mockObj = { name: 'M31' };
      mockStel.getObj.mockReturnValueOnce(mockObj);

      act(() => { ref.current!.gotoObject!('M31'); });

      expect(mockStel.getObj).toHaveBeenCalledWith('M31');
      expect(mockStel.core.selection).toBe(mockObj);
      expect(mockStel.pointAndLock).toHaveBeenCalledWith(mockObj, 1.0);
    });

    it('falls back to NAME prefix when direct lookup fails', () => {
      const { ref, mockStel } = renderWithStel();
      const mockObj = { name: 'Sirius' };
      mockStel.getObj
        .mockReturnValueOnce(null)     // 'Sirius' not found
        .mockReturnValueOnce(mockObj);  // 'NAME Sirius' found

      act(() => { ref.current!.gotoObject!('Sirius'); });

      expect(mockStel.getObj).toHaveBeenCalledWith('Sirius');
      expect(mockStel.getObj).toHaveBeenCalledWith('NAME Sirius');
      expect(mockStel.core.selection).toBe(mockObj);
      expect(mockStel.pointAndLock).toHaveBeenCalledWith(mockObj, 1.0);
    });

    it('does nothing when object not found by either lookup', () => {
      const { ref, mockStel } = renderWithStel();
      mockStel.getObj.mockReturnValue(null);

      act(() => { ref.current!.gotoObject!('NonExistent'); });

      expect(mockStel.pointAndLock).not.toHaveBeenCalled();
    });

    it('does nothing when stelRef is null', () => {
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      act(() => { ref.current!.gotoObject!('M31'); });
      // No error, no calls
    });
  });

  describe('getEngineStatus', () => {
    it('returns isReady true when engine is loaded', () => {
      const { ref } = renderWithStel();
      const status = ref.current!.getEngineStatus();
      // engineReady=true from mock, stelRef.current is set via renderWithStel
      expect(status.isLoading).toBe(false);
      expect(status.hasError).toBe(false);
      // stelRef.current should be populated after renderWithStel
      expect(status.isReady).toBe(true);
    });

    it('returns hasError true when error exists', () => {
      // Modify loading state to simulate error
      const origError = mockLoadingState.errorMessage;
      mockLoadingState.errorMessage = 'test error';
      try {
        const ref = React.createRef<StellariumCanvasRef>();
        render(<StellariumCanvas ref={ref} />);
        const status = ref.current!.getEngineStatus();
        expect(status.hasError).toBe(true);
      } finally {
        mockLoadingState.errorMessage = origError;
      }
    });

    it('returns isReady false when engine is null', () => {
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);
      const status = ref.current!.getEngineStatus();
      expect(status.isReady).toBe(false);
    });
  });

  describe('getFov', () => {
    it('returns fov in degrees from engine', () => {
      const { ref } = renderWithStel();
      // mockStel.core.fov was set to Math.PI / 3 (60 deg) in createMockStelEngine
      const fov = ref.current!.getFov();
      expect(fov).toBeCloseTo(60, 0);
    });

    it('returns DEFAULT_FOV when engine is null', () => {
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);
      expect(ref.current!.getFov()).toBe(60);
    });
  });

  describe('exportImage', () => {
    it('returns null when toDataURL throws', async () => {
      const ref = React.createRef<StellariumCanvasRef>();
      const { container } = render(<StellariumCanvas ref={ref} />);
      const canvas = container.querySelector('canvas');
      if (canvas) {
        jest.spyOn(canvas, 'toDataURL').mockImplementation(() => {
          throw new Error('tainted');
        });
      }
      const result = await ref.current!.exportImage!();
      expect(result).toBeNull();
    });
  });

  describe('onEngineEvent', () => {
    it('registers and dispatches click events', () => {
      // Set up on() to capture handlers BEFORE rendering
      const onHandlers: Record<string, (e: unknown) => void> = {};
      const mockStel = createMockStelEngine();
      mockStel.on.mockImplementation((event: string, cb: (e: unknown) => void) => {
        onHandlers[event] = cb;
      });

      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      // Inject stel before calling onEngineEvent
      if (capturedStelRef) capturedStelRef.current = mockStel;

      const callback = jest.fn();
      const unsubscribe = ref.current!.onEngineEvent!('click', callback);

      // bindEngineEvents should have been called via onEngineEvent
      expect(mockStel.on).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockStel.on).toHaveBeenCalledWith('rectSelection', expect.any(Function));

      // Dispatch event through the registered handler
      act(() => {
        onHandlers['click']?.({ x: 1, y: 2 });
      });
      expect(callback).toHaveBeenCalledWith({ x: 1, y: 2 });

      // Unsubscribe and verify no more events
      unsubscribe();
      act(() => {
        onHandlers['click']?.({ x: 3, y: 4 });
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('registers rectSelection events', () => {
      const onHandlers: Record<string, (e: unknown) => void> = {};
      const mockStel = createMockStelEngine();
      mockStel.on.mockImplementation((event: string, cb: (e: unknown) => void) => {
        onHandlers[event] = cb;
      });

      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      if (capturedStelRef) capturedStelRef.current = mockStel;

      const callback = jest.fn();
      ref.current!.onEngineEvent!('rectSelection', callback);

      act(() => {
        onHandlers['rectSelection']?.({ rect: [0, 0, 100, 100] });
      });
      expect(callback).toHaveBeenCalledWith({ rect: [0, 0, 100, 100] });
    });

    it('skips binding if engine has no on method', () => {
      const mockStel = createMockStelEngine();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockStel as any).on = undefined;

      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      if (capturedStelRef) capturedStelRef.current = mockStel;

      // Should not throw
      const callback = jest.fn();
      ref.current!.onEngineEvent!('click', callback);
    });

    it('does not re-bind if same engine instance', () => {
      const onHandlers: Record<string, (e: unknown) => void> = {};
      const mockStel = createMockStelEngine();
      mockStel.on.mockImplementation((event: string, cb: (e: unknown) => void) => {
        onHandlers[event] = cb;
      });

      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      if (capturedStelRef) capturedStelRef.current = mockStel;

      // First subscription triggers binding
      ref.current!.onEngineEvent!('click', jest.fn());
      const callCount = mockStel.on.mock.calls.length;

      // Second subscription should not re-bind (same engine)
      ref.current!.onEngineEvent!('click', jest.fn());
      expect(mockStel.on.mock.calls.length).toBe(callCount);
    });
  });

  describe('cleanup on unmount', () => {
    it('clears stel and helpers on unmount', () => {
      const { unmount } = renderWithStel();
      unmount();
      expect(mockSetStel).toHaveBeenCalledWith(null);
      expect(mockSetHelpers).toHaveBeenCalledWith({
        getCurrentViewDirection: null,
        setViewDirection: null,
      });
    });
  });
});
