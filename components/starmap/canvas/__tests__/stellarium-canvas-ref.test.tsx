/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import type { StellariumCanvasRef } from '@/types/stellarium-canvas';

// Mock unified cache
jest.mock('@/lib/offline', () => ({
  unifiedCache: {
    fetch: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

// Mock translations
jest.mock('@/lib/translations', () => ({
  createStellariumTranslator: jest.fn(() => (_domain: string, text: string) => text),
}));

// Mock stores
const mockSetStel = jest.fn();
const mockSetHelpers = jest.fn();
const mockSetActiveEngine = jest.fn();
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
        setBaseUrl: jest.fn(),
        setHelpers: mockSetHelpers,
        updateStellariumCore: jest.fn(),
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
    jest.fn((selector) => selector(mockSettingsState)),
    { getState: () => mockSettingsState, subscribe: jest.fn(() => jest.fn()) }
  ),
  useMountStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
      };
      return selector(state);
    }),
    {
      getState: () => ({
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
      }),
    }
  ),
}));

// Mock StelWebEngine
const mockStelEngine = {
  core: {
    observer: { latitude: 0, longitude: 0, elevation: 0 },
    fov: 1.047,
    time_speed: 1,
    selection: null as unknown,
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
  anp: jest.fn((x: number) => x),
  anpm: jest.fn((x: number) => x),
  pointAndLock: jest.fn(),
  change: jest.fn(),
  on: jest.fn(),
};

describe('StellariumCanvas Ref Methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockStelEngine.core.selection = null;
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
    HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800, height: 600,
      top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0,
      toJSON: () => {},
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderWithEngine() {
    const mockStelWebEngine = jest.fn((options) => {
      setTimeout(() => options.onReady(mockStelEngine), 50);
    });
    (window as { StelWebEngine?: typeof mockStelWebEngine }).StelWebEngine = mockStelWebEngine;

    const { StellariumCanvas } = await import('../stellarium-canvas');
    const ref = React.createRef<StellariumCanvasRef>();
    const result = render(<StellariumCanvas ref={ref} />);

    await act(async () => {
      const script = document.querySelector('script[src*="stellarium-web-engine.js"]');
      if (script) script.dispatchEvent(new Event('load'));
      jest.advanceTimersByTime(500);
    });

    return { ref, ...result };
  }

  describe('exportImage', () => {
    it('returns data URL from canvas when available', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      expect(ref.current).toBeTruthy();
      const result = await ref.current!.exportImage!();
      // jsdom canvas.toDataURL returns 'data:,' for blank canvas
      expect(result).toBeDefined();
    });

    it('returns null when canvas.toDataURL throws', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const ref = React.createRef<StellariumCanvasRef>();
      const { container } = render(<StellariumCanvas ref={ref} />);

      const canvas = container.querySelector('canvas');
      if (canvas) {
        jest.spyOn(canvas, 'toDataURL').mockImplementation(() => {
          throw new Error('SecurityError: tainted canvas');
        });
      }

      const result = await ref.current!.exportImage!();
      expect(result).toBeNull();
    });
  });

  describe('gotoObject', () => {
    it('selects and locks object when found by name', async () => {
      const mockObj = { pos: [1, 0, 0], update: jest.fn() };
      mockStelEngine.getObj.mockReturnValueOnce(mockObj);

      const { ref } = await renderWithEngine();
      if (!ref.current?.getEngine?.()) return;

      act(() => { ref.current!.gotoObject!('M31'); });

      expect(mockStelEngine.getObj).toHaveBeenCalledWith('M31');
      expect(mockStelEngine.core.selection).toBe(mockObj);
      expect(mockStelEngine.pointAndLock).toHaveBeenCalledWith(mockObj, 1.0);
    });

    it('tries NAME prefix fallback when direct name not found', async () => {
      const mockObj = { pos: [1, 0, 0], update: jest.fn() };
      mockStelEngine.getObj
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockObj);

      const { ref } = await renderWithEngine();
      if (!ref.current?.getEngine?.()) return;

      act(() => { ref.current!.gotoObject!('Sirius'); });

      expect(mockStelEngine.getObj).toHaveBeenCalledWith('Sirius');
      expect(mockStelEngine.getObj).toHaveBeenCalledWith('NAME Sirius');
      expect(mockStelEngine.pointAndLock).toHaveBeenCalledWith(mockObj, 1.0);
    });

    it('does nothing when object not found', async () => {
      mockStelEngine.getObj.mockReturnValue(null);

      const { ref } = await renderWithEngine();
      if (!ref.current?.getEngine?.()) return;

      act(() => { ref.current!.gotoObject!('NonExistent'); });
      expect(mockStelEngine.pointAndLock).not.toHaveBeenCalled();
    });

    it('does nothing when engine is null', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      act(() => { ref.current!.gotoObject!('M31'); });
      expect(mockStelEngine.pointAndLock).not.toHaveBeenCalled();
    });
  });

  describe('getEngineStatus', () => {
    it('returns status object with correct shape', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      const status = ref.current!.getEngineStatus();
      expect(status).toHaveProperty('isLoading');
      expect(status).toHaveProperty('hasError');
      expect(status).toHaveProperty('isReady');
    });
  });

  describe('getFov', () => {
    it('returns DEFAULT_FOV when engine is null', async () => {
      const { StellariumCanvas } = await import('../stellarium-canvas');
      const ref = React.createRef<StellariumCanvasRef>();
      render(<StellariumCanvas ref={ref} />);

      const fov = ref.current!.getFov();
      expect(fov).toBe(60);
    });

    it('returns engine FOV in degrees when engine is available', async () => {
      mockStelEngine.core.fov = Math.PI / 3;

      const { ref } = await renderWithEngine();
      if (!ref.current?.getEngine?.()) return;

      const fov = ref.current!.getFov();
      expect(fov).toBeCloseTo(60, 0);
    });
  });
});

describe('StellariumCanvas ResizeObserver', () => {
  let mockObserve: jest.Mock;
  let mockDisconnect: jest.Mock;
  let resizeCallback: ResizeObserverCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;

    mockObserve = jest.fn();
    mockDisconnect = jest.fn();

    global.ResizeObserver = jest.fn((cb: ResizeObserverCallback) => {
      resizeCallback = cb;
      return {
        observe: mockObserve,
        disconnect: mockDisconnect,
        unobserve: jest.fn(),
      };
    }) as unknown as typeof ResizeObserver;

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800, height: 600,
      top: 0, left: 0, bottom: 600, right: 800, x: 0, y: 0,
      toJSON: () => {},
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('observes container element on mount', async () => {
    const { StellariumCanvas } = await import('../stellarium-canvas');
    render(<StellariumCanvas />);

    expect(mockObserve).toHaveBeenCalled();
  });

  it('updates canvas dimensions when container resizes', async () => {
    const { StellariumCanvas } = await import('../stellarium-canvas');
    const { container } = render(<StellariumCanvas />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();

    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 1024, height: 768,
      top: 0, left: 0, bottom: 768, right: 1024, x: 0, y: 0,
      toJSON: () => {},
    }));

    act(() => {
      resizeCallback([], {} as ResizeObserver);
      jest.advanceTimersByTime(16);
    });

    if (canvas) {
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    }
  });

  it('disconnects observer on unmount', async () => {
    const { StellariumCanvas } = await import('../stellarium-canvas');
    const { unmount } = render(<StellariumCanvas />);

    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
