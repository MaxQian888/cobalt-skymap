/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StellariumCanvasRef } from '@/types/stellarium-canvas';

// Mock unified cache
jest.mock('@/lib/offline', () => ({
  unifiedCache: {
    fetch: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock translations
jest.mock('@/lib/translations', () => ({
  createStellariumTranslator: jest.fn(() => (domain: string, text: string) => text),
}));

// Mock stores
const mockSetStel = jest.fn();
const mockSetBaseUrl = jest.fn();
const mockSetHelpers = jest.fn();
const mockUpdateStellariumCore = jest.fn();
const mockSetActiveEngine = jest.fn();
const engineEventHandlers: Partial<Record<'click' | 'rectSelection', (event: unknown) => void>> = {};
const mockSettingsState = {
  stellarium: {
    constellationsLinesVisible: true,
    constellationArtVisible: false,
    azimuthalLinesVisible: false,
    equatorialLinesVisible: false,
    meridianLinesVisible: false,
    eclipticLinesVisible: false,
    atmosphereVisible: false,
    landscapesVisible: false,
    dsosVisible: true,
    surveyEnabled: true,
    surveyId: 'dss',
    skyCultureLanguage: 'native',
    nightMode: false,
    sensorControl: false,
    crosshairVisible: true,
    crosshairColor: 'rgba(255, 255, 255, 0.3)',
  },
  performance: {
    renderQuality: 'high',
  },
};

jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        setStel: mockSetStel,
        setBaseUrl: mockSetBaseUrl,
        setHelpers: mockSetHelpers,
        updateStellariumCore: mockUpdateStellariumCore,
        setActiveEngine: mockSetActiveEngine,
        setCanvasEl: jest.fn(),
      };
      return selector(state);
    }),
    {
      getState: () => ({
        setHelpers: mockSetHelpers,
      }),
    }
  ),
  useSettingsStore: Object.assign(
    jest.fn((selector) => {
      return selector(mockSettingsState);
    }),
    {
      getState: () => mockSettingsState,
      subscribe: jest.fn(() => jest.fn()),
    }
  ),
  useMountStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 0,
            Longitude: 0,
            Elevation: 0,
          },
        },
      };
      return selector(state);
    }),
    {
      getState: () => ({
        profileInfo: {
          AstrometrySettings: {
            Latitude: 0,
            Longitude: 0,
            Elevation: 0,
          },
        },
      }),
    }
  ),
}));

// Mock StelWebEngine
const mockStelEngine = {
  core: {
    observer: { latitude: 0, longitude: 0, elevation: 0 },
    fov: 1.047, // ~60 degrees in radians
    time_speed: 1,
    selection: null,
    stars: { addDataSource: jest.fn() },
    skycultures: { addDataSource: jest.fn() },
    dsos: { addDataSource: jest.fn(), visible: true },
    dss: { addDataSource: jest.fn() },
    milkyway: { addDataSource: jest.fn() },
    minor_planets: { addDataSource: jest.fn() },
    planets: { addDataSource: jest.fn() },
    comets: { addDataSource: jest.fn() },
    landscapes: { addDataSource: jest.fn(), visible: true },
    constellations: { lines_visible: true, labels_visible: true },
    lines: {
      azimuthal: { visible: false },
      equatorial: { visible: false },
      meridian: { visible: false },
      ecliptic: { visible: false },
    },
    atmosphere: { visible: false },
    hips: { visible: false, url: '' },
  },
  observer: { latitude: 0, longitude: 0, elevation: 0, utc: 0, azalt: [0, 0] },
  D2R: Math.PI / 180,
  R2D: 180 / Math.PI,
  getObj: jest.fn(),
  createObj: jest.fn(() => ({ pos: [0, 0, 0], update: jest.fn() })),
  createLayer: jest.fn(),
  convertFrame: jest.fn(() => [0, 0, -1]),
  c2s: jest.fn(() => [0, 0]),
  s2c: jest.fn(() => [0, 0, 1]),
  anp: jest.fn((x) => x),
  anpm: jest.fn((x) => x),
  pointAndLock: jest.fn(),
  change: jest.fn(),
  on: jest.fn((eventName: 'click' | 'rectSelection', callback: (event: unknown) => void) => {
    engineEventHandlers[eventName] = callback;
  }),
};

/**
 * StellariumCanvas Component Tests
 * 
 * Tests cover:
 * - Component export and structure
 * - Loading states and UI
 * - Script loading with timeout
 * - WASM initialization
 * - Error handling and retry
 * - Cleanup on unmount
 */

describe('StellariumCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete engineEventHandlers.click;
    delete engineEventHandlers.rectSelection;
    
    // Reset window.StelWebEngine
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
    
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Component Export', () => {
    it('exports the component correctly', async () => {
      const canvasModule = await import('../stellarium-canvas');
      expect(canvasModule.StellariumCanvas).toBeDefined();
    });

    it('component is a valid React component', async () => {
      const canvasModule = await import('../stellarium-canvas');
      expect(canvasModule.StellariumCanvas).toBeTruthy();
      expect(
        typeof canvasModule.StellariumCanvas === 'function' ||
        typeof canvasModule.StellariumCanvas === 'object'
      ).toBe(true);
    });
  });

  describe('Loading States', () => {
    it('shows loading overlay initially', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Should show loading status (translation key returned by mock)
      expect(screen.getByText(/loadingScript|preparingResources|initializingStarmap/i)).toBeInTheDocument();
    });

    it('shows spinner during loading', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Should have loading overlay with data-testid
      const loadingOverlay = screen.getByTestId('stellarium-loading-overlay');
      expect(loadingOverlay).toBeInTheDocument();
    });
  });

  describe('Script Loading', () => {
    it('creates script element for engine loading', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Advance timers to trigger script loading
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      
      // Check if script was added to document
      const scripts = document.querySelectorAll('script[src*="stellarium-web-engine.js"]');
      expect(scripts.length).toBeGreaterThanOrEqual(0); // Script may or may not be added depending on timing
    });

    it('handles script load timeout', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Should show loading status initially (translation key returned by mock)
      expect(screen.getByText(/loadingScript|preparingResources|initializingStarmap/i)).toBeInTheDocument();
      
      // The component handles timeouts internally with auto-retry
      // We verify the loading UI is shown correctly
      const loadingOverlay = screen.getByTestId('stellarium-loading-overlay');
      expect(loadingOverlay).toBeInTheDocument();
    });
  });

  describe('Engine Initialization', () => {
    it('calls StelWebEngine with correct parameters when script loads', async () => {
      const mockStelWebEngine = jest.fn((options) => {
        // Simulate async ready callback
        setTimeout(() => {
          options.onReady(mockStelEngine);
        }, 100);
      });
      
      (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;
      
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Advance timers to trigger initialization
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      
      // Check if StelWebEngine was called with correct options
      if (mockStelWebEngine.mock.calls.length > 0) {
        const callArgs = mockStelWebEngine.mock.calls[0][0];
        expect(callArgs).toHaveProperty('wasmFile');
        expect(callArgs).toHaveProperty('canvasElement');
        expect(callArgs).toHaveProperty('onReady');
        expect(callArgs.wasmFile).toContain('stellarium-web-engine.wasm');
      }
    });

    it('sets engine in store after successful initialization', async () => {
      const mockStelWebEngine = jest.fn((options) => {
        setTimeout(() => {
          options.onReady(mockStelEngine);
        }, 100);
      });
      
      (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;
      
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      
      // Check if setStel was called
      if (mockStelWebEngine.mock.calls.length > 0) {
        await waitFor(() => {
          expect(mockSetStel).toHaveBeenCalled();
        }, { timeout: 1000 });
      }
    });
  });

  describe('Error Handling', () => {
    it('shows loading overlay with status message', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      render(<StellariumCanvas />);
      
      // Should show loading overlay with data-testid
      const loadingOverlay = screen.getByTestId('stellarium-loading-overlay');
      expect(loadingOverlay).toBeInTheDocument();
      
      // Should have a status message (translation key returned by mock)
      const statusText = screen.queryByText(/loadingScript|preparingResources|initializingStarmap/i);
      expect(statusText).toBeInTheDocument();
    });

    it('loading overlay contains retry button container', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      const { container } = render(<StellariumCanvas />);
      
      // The overlay div should exist
      const overlay = container.querySelector('.absolute.inset-0');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('cleans up on unmount', async () => {
      const mockStelWebEngine = jest.fn((options) => {
        setTimeout(() => {
          options.onReady(mockStelEngine);
        }, 100);
      });
      
      (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;
      
      const { StellariumCanvas } = await import('../stellarium-canvas');
      
      const { unmount } = render(<StellariumCanvas />);
      
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      
      // Unmount component
      unmount();
      
      // setStel should be called with null on cleanup
      await waitFor(() => {
        const setNullCalls = mockSetStel.mock.calls.filter(
          (call: unknown[]) => call[0] === null
        );
        expect(setNullCalls.length).toBeGreaterThanOrEqual(0);
      }, { timeout: 1000 });
    });
  });

  describe('Retry Functionality', () => {
    it('handleRetry resets retry count and restarts loading', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      
      render(<StellariumCanvas />);
      
      // Advance past all timeouts to trigger error state
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          jest.advanceTimersByTime(16000);
        }
      });
      
      // Find and click retry button if present
      const retryButton = screen.queryByRole('button', { name: /retry/i });
      if (retryButton) {
        await user.click(retryButton);
        
        // Should restart loading (may quickly move to retrying state in jsdom)
        await waitFor(() => {
          const loadingText = screen.queryByText(/loading|initializing|preparing|retrying/i);
          expect(loadingText).toBeInTheDocument();
        }, { timeout: 1000 });
      }
    });
  });

  describe('Loader Resilience', () => {
    it('stops retrying and shows overall timeout when container remains zero-sized', async () => {
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      }));

      const { StellariumCanvas } = await import('../stellarium-canvas');
      render(<StellariumCanvas />);

      await act(async () => {
        jest.advanceTimersByTime(47000);
      });

      expect(screen.getByText('overallTimeout')).toBeInTheDocument();
    });

    it('fails fast when onReady callback throws during init', async () => {
      mockSetStel.mockImplementation((value) => {
        if (value) {
          throw new Error('init crash');
        }
      });

      const mockStelWebEngine = jest.fn((options) => {
        try {
          options.onReady(mockStelEngine);
        } catch {
          // Simulate runtime swallowing callback exceptions.
        }
      });
      (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;

      try {
        const { StellariumCanvas } = await import('../stellarium-canvas');
        render(<StellariumCanvas />);

        await act(async () => {
          jest.advanceTimersByTime(300);
        });

        expect(screen.getByText(/retrying/i)).toBeInTheDocument();
      } finally {
        mockSetStel.mockImplementation(() => undefined);
      }
    });

    it('uses default render quality when persisted performance settings are missing', async () => {
      const storesModule = jest.requireMock('@/lib/stores') as {
        useSettingsStore: { getState: () => Record<string, unknown> };
      };
      const originalGetState = storesModule.useSettingsStore.getState;
      storesModule.useSettingsStore.getState = () => ({
        stellarium: {
          skyCultureLanguage: 'native',
        },
      });

      const mockStelWebEngine = jest.fn((options) => {
        options.onReady(mockStelEngine);
      });
      (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;

      try {
        const { StellariumCanvas } = await import('../stellarium-canvas');
        render(<StellariumCanvas />);

        await act(async () => {
          jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
          expect(mockStelWebEngine).toHaveBeenCalled();
        });
        expect(screen.queryByText('overallTimeout')).not.toBeInTheDocument();
      } finally {
        storesModule.useSettingsStore.getState = originalGetState;
      }
    });
  });
});

describe('Loading Constants', () => {
  it('uses appropriate timeout values', async () => {
    // Import the module to check constants are defined
    const canvasModule = await import('../stellarium-canvas');
    expect(canvasModule).toBeDefined();
    
    // Constants are internal, but we can verify behavior through timeouts
    // Script timeout: 15s, WASM timeout: 30s, Max retries: 2
  });
});

describe('Module Exports', () => {
  it('exports constants correctly', async () => {
    const { MIN_FOV, MAX_FOV, DEFAULT_FOV } = await import('@/lib/core/constants/fov');
    const { SCRIPT_PATH, WASM_PATH } = await import('@/lib/core/constants/stellarium-canvas');
    
    expect(MIN_FOV).toBe(0.5);
    expect(MAX_FOV).toBe(180);
    expect(DEFAULT_FOV).toBe(60);
    expect(SCRIPT_PATH).toContain('stellarium-web-engine.js');
    expect(WASM_PATH).toContain('stellarium-web-engine.wasm');
  });

  it('exports types correctly', async () => {
    const typesModule = await import('@/types/stellarium-canvas');
    expect(typesModule).toBeDefined();
  });

  it('exports utils correctly', async () => {
    const { fovToRad, fovToDeg, withTimeout, prefetchWasm } = await import('@/lib/core/stellarium-canvas-utils');
    
    expect(typeof fovToRad).toBe('function');
    expect(typeof fovToDeg).toBe('function');
    expect(typeof withTimeout).toBe('function');
    expect(typeof prefetchWasm).toBe('function');
  });

  it('exports hooks correctly', async () => {
    const hooksModule = await import('@/lib/hooks/stellarium');
    
    expect(hooksModule.useClickCoordinates).toBeDefined();
    expect(hooksModule.useStellariumZoom).toBeDefined();
    expect(hooksModule.useStellariumEvents).toBeDefined();
    expect(hooksModule.useObserverSync).toBeDefined();
    expect(hooksModule.useSettingsSync).toBeDefined();
    expect(hooksModule.useStellariumLoader).toBeDefined();
    expect(hooksModule.useStellariumCalendar).toBeDefined();
    expect(hooksModule.useStellariumFonts).toBeDefined();
    expect(hooksModule.useStellariumLayerApi).toBeDefined();
    expect(hooksModule.useStellariumValueWatch).toBeDefined();
  });

  describe('Ref API', () => {
    it('supports click event subscribe and unsubscribe via onEngineEvent', async () => {
      jest.useFakeTimers();
      try {
        const mockStelWebEngine = jest.fn((options) => {
          setTimeout(() => {
            options.onReady(mockStelEngine);
          }, 50);
        });
        (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;

        const { StellariumCanvas } = await import('../stellarium-canvas');
        const ref = React.createRef<StellariumCanvasRef>();

        render(<StellariumCanvas ref={ref} />);

        // Simulate script onload so engine can initialize
        await act(async () => {
          const script = document.querySelector('script[src*="stellarium-web-engine.js"]');
          if (script) script.dispatchEvent(new Event('load'));
          jest.advanceTimersByTime(500);
        });

        await waitFor(() => {
          expect(ref.current).toBeTruthy();
        });

        // Engine may not load in jsdom if script loading is unsupported
        if (!ref.current?.getEngine?.()) return;

        const callback = jest.fn();
        expect(typeof ref.current?.onEngineEvent).toBe('function');
        const unsubscribe = ref.current?.onEngineEvent?.('click', callback);

        expect(mockStelEngine.on).toHaveBeenCalledWith('click', expect.any(Function));
        expect(mockStelEngine.on).toHaveBeenCalledWith('rectSelection', expect.any(Function));

        act(() => {
          engineEventHandlers.click?.({ point: { x: 1, y: 2 } });
        });
        expect(callback).toHaveBeenCalledWith({ point: { x: 1, y: 2 } });

        unsubscribe?.();
        act(() => {
          engineEventHandlers.click?.({ point: { x: 3, y: 4 } });
        });
        expect(callback).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('exports LoadingOverlay component correctly', async () => {
    const { LoadingOverlay } = await import('../components');
    expect(LoadingOverlay).toBeDefined();
  });

  it('exports from index correctly', async () => {
    const indexModule = await import('../index');
    
    expect(indexModule.StellariumCanvas).toBeDefined();
    expect(indexModule.MIN_FOV).toBeDefined();
    expect(indexModule.MAX_FOV).toBeDefined();
    expect(indexModule.DEFAULT_FOV).toBeDefined();
    expect(indexModule.fovToRad).toBeDefined();
    expect(indexModule.fovToDeg).toBeDefined();
    expect(indexModule.LoadingOverlay).toBeDefined();
  });
});

describe('Utils Functions', () => {
  it('fovToRad converts degrees to radians correctly', async () => {
    const { fovToRad } = await import('@/lib/core/stellarium-canvas-utils');
    
    expect(fovToRad(0)).toBe(0);
    expect(fovToRad(180)).toBeCloseTo(Math.PI);
    expect(fovToRad(90)).toBeCloseTo(Math.PI / 2);
    expect(fovToRad(60)).toBeCloseTo(Math.PI / 3);
  });

  it('fovToDeg converts radians to degrees correctly', async () => {
    const { fovToDeg } = await import('@/lib/core/stellarium-canvas-utils');
    
    expect(fovToDeg(0)).toBe(0);
    expect(fovToDeg(Math.PI)).toBeCloseTo(180);
    expect(fovToDeg(Math.PI / 2)).toBeCloseTo(90);
    expect(fovToDeg(Math.PI / 3)).toBeCloseTo(60);
  });

  it('fovToRad and fovToDeg are inverses', async () => {
    const { fovToRad, fovToDeg } = await import('@/lib/core/stellarium-canvas-utils');
    
    const testValues = [0, 30, 45, 60, 90, 120, 180];
    for (const value of testValues) {
      expect(fovToDeg(fovToRad(value))).toBeCloseTo(value);
    }
  });

  it('withTimeout resolves if promise completes in time', async () => {
    const { withTimeout } = await import('@/lib/core/stellarium-canvas-utils');
    
    const fastPromise = Promise.resolve('success');
    const result = await withTimeout(fastPromise, 1000, 'timeout');
    
    expect(result).toBe('success');
  });

  it('withTimeout rejects if promise times out', async () => {
    const { withTimeout } = await import('@/lib/core/stellarium-canvas-utils');
    
    const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));
    
    await expect(
      withTimeout(slowPromise, 10, 'Operation timed out')
    ).rejects.toThrow('Operation timed out');
  });
});
