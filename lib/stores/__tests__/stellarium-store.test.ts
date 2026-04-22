import { act, renderHook } from '@testing-library/react';
import { useStellariumStore } from '../stellarium-store';
import type { StellariumSettings } from '@/lib/core/types';
import { logManager } from '@/lib/logger';

// Mock translations
jest.mock('@/lib/translations', () => ({
  updateStellariumTranslation: jest.fn(),
}));

// Mock core constants
jest.mock('@/lib/core/constants', () => ({
  SKY_SURVEYS: [
    { id: 'DSS', url: 'https://hips.example/dss' },
    { id: '2MASS', url: 'https://hips.example/2mass/' },
  ],
}));

// Helper to create mock settings
const createMockSettings = (overrides?: Partial<StellariumSettings>): StellariumSettings => ({
  constellationsLinesVisible: true,
  constellationArtVisible: false,
  constellationLabelsVisible: true,
  constellationBoundariesVisible: true,
  starLabelsVisible: true,
  planetLabelsVisible: true,
  azimuthalLinesVisible: true,
  equatorialLinesVisible: true,
  equatorialJnowLinesVisible: true,
  meridianLinesVisible: false,
  eclipticLinesVisible: true,
  horizonLinesVisible: true,
  galacticLinesVisible: true,
  atmosphereVisible: true,
  dsosVisible: true,
  milkyWayVisible: true,
  fogVisible: false,
  landscapesVisible: true,
  skyCultureLanguage: 'en',
  surveyEnabled: true,
  surveyId: 'DSS',
  nightMode: false,
  sensorControl: false,
  sensorAbsolutePreferred: true,
  sensorUseCompassHeading: true,
  sensorUpdateHz: 30,
  sensorDeadbandDeg: 0.35,
  sensorSmoothingFactor: 0.2,
  sensorCalibrationRequired: true,
  sensorCalibrationAzimuthOffsetDeg: 0,
  sensorCalibrationAltitudeOffsetDeg: 0,
  sensorCalibrationUpdatedAt: null,
  crosshairVisible: true,
  crosshairColor: 'rgba(255, 255, 255, 0.3)',
  projectionType: 'stereographic',
  bortleIndex: 3,
  starLinearScale: 0.8,
  starRelativeScale: 1.1,
  displayLimitMag: 99,
  flipViewVertical: false,
  flipViewHorizontal: false,
  exposureScale: 2,
  tonemapperP: 0.5,
  mountFrame: 5,
  viewYOffset: 0.1,
  arMode: false,
  arOpacity: 0.5,
  arShowCompass: true,
  ...overrides,
});

describe('useStellariumStore', () => {
  beforeEach(() => {
    logManager.initialize({ enableConsole: false, enablePersistence: false });
    // Reset store state
    const { result } = renderHook(() => useStellariumStore());
    act(() => {
      result.current.setStel(null);
      result.current.setAladin(null);
      result.current.setActiveEngine('stellarium');
      result.current.setBaseUrl('');
      result.current.setSearch({
        RAangle: 0,
        DECangle: 0,
        RAangleString: '',
        DECangleString: '',
      });
    });
  });

  describe('initial state', () => {
    it('should have null stel initially', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.stel).toBeNull();
    });

    it('should have empty baseUrl initially', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.baseUrl).toBe('');
    });

    it('should have default search state', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.search).toEqual({
        RAangle: 0,
        DECangle: 0,
        RAangleString: '',
        DECangleString: '',
      });
    });

    it('should have null helper functions initially', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.getCurrentViewDirection).toBeNull();
      expect(result.current.setViewDirection).toBeNull();
    });
  });

  describe('setStel', () => {
    it('should set stellarium engine instance', () => {
      const { result } = renderHook(() => useStellariumStore());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: {} } as any;

      act(() => {
        result.current.setStel(mockStel);
      });

      expect(result.current.stel).toBe(mockStel);
    });

    it('should set stel to null', () => {
      const { result } = renderHook(() => useStellariumStore());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: {} } as any;

      act(() => {
        result.current.setStel(mockStel);
      });

      expect(result.current.stel).toBe(mockStel);

      act(() => {
        result.current.setStel(null);
      });

      expect(result.current.stel).toBeNull();
    });
  });

  describe('setBaseUrl', () => {
    it('should set base URL', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setBaseUrl('https://example.com/');
      });

      expect(result.current.baseUrl).toBe('https://example.com/');
    });
  });

  describe('setSearch', () => {
    it('should update search state partially', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setSearch({ RAangle: 180 });
      });

      expect(result.current.search.RAangle).toBe(180);
      expect(result.current.search.DECangle).toBe(0); // Should remain unchanged
    });

    it('should update multiple search properties', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setSearch({
          RAangle: 180,
          DECangle: 45,
          RAangleString: '12h 00m 00s',
          DECangleString: '+45° 00\' 00"',
        });
      });

      expect(result.current.search).toEqual({
        RAangle: 180,
        DECangle: 45,
        RAangleString: '12h 00m 00s',
        DECangleString: '+45° 00\' 00"',
      });
    });
  });

  describe('setHelpers', () => {
    it('should set helper functions', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockGetViewDir = jest.fn(() => ({ ra: 0, dec: 0, alt: 0, az: 0 }));
      const mockSetViewDir = jest.fn();

      act(() => {
        result.current.setHelpers({
          getCurrentViewDirection: mockGetViewDir,
          setViewDirection: mockSetViewDir,
        });
      });

      expect(result.current.getCurrentViewDirection).toBe(mockGetViewDir);
      expect(result.current.setViewDirection).toBe(mockSetViewDir);
    });

    it('should preserve existing helpers when setting only one', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockGetViewDir = jest.fn(() => ({ ra: 0, dec: 0, alt: 0, az: 0 }));
      const mockSetViewDir = jest.fn();

      act(() => {
        result.current.setHelpers({
          getCurrentViewDirection: mockGetViewDir,
          setViewDirection: mockSetViewDir,
        });
      });

      const newMockGetViewDir = jest.fn(() => ({ ra: 90, dec: 45, alt: 30, az: 180 }));

      act(() => {
        result.current.setHelpers({
          getCurrentViewDirection: newMockGetViewDir,
        });
      });

      expect(result.current.getCurrentViewDirection).toBe(newMockGetViewDir);
      expect(result.current.setViewDirection).toBe(mockSetViewDir); // Should remain unchanged
    });
  });

  describe('setAladin', () => {
    it('should set aladin instance', () => {
      const { result } = renderHook(() => useStellariumStore());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockAladin = { getRaDec: jest.fn() } as any;

      act(() => {
        result.current.setAladin(mockAladin);
      });

      expect(result.current.aladin).toBe(mockAladin);
    });

    it('should set aladin to null', () => {
      const { result } = renderHook(() => useStellariumStore());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockAladin = { getRaDec: jest.fn() } as any;

      act(() => {
        result.current.setAladin(mockAladin);
      });
      expect(result.current.aladin).toBe(mockAladin);

      act(() => {
        result.current.setAladin(null);
      });
      expect(result.current.aladin).toBeNull();
    });
  });

  describe('setActiveEngine', () => {
    it('should default to stellarium', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.activeEngine).toBe('stellarium');
    });

    it('should switch to aladin', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setActiveEngine('aladin');
      });

      expect(result.current.activeEngine).toBe('aladin');
    });

    it('should switch back to stellarium', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setActiveEngine('aladin');
      });
      act(() => {
        result.current.setActiveEngine('stellarium');
      });

      expect(result.current.activeEngine).toBe('stellarium');
    });
  });

  describe('updateStellariumCore', () => {
    it('should warn if stel is not ready', () => {
      const { result } = renderHook(() => useStellariumStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      logManager.initialize({ enableConsole: true, enablePersistence: false });

      act(() => {
        result.current.updateStellariumCore(createMockSettings());
      });

      // Logger outputs styled console messages, check that warn was called with message containing expected text
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      const fullMessage = callArgs.join(' ');
      expect(fullMessage).toContain('Stellarium engine not ready, settings update skipped');
      consoleSpy.mockRestore();
      logManager.initialize({ enableConsole: false, enablePersistence: false });
    });

    it('should update stellarium core settings when stel is available', () => {
      const { result } = renderHook(() => useStellariumStore());
      
      const mockCore = {
        bortle_index: 0,
        star_linear_scale: 0,
        star_relative_scale: 0,
        display_limit_mag: 0,
        flip_view_vertical: false,
        flip_view_horizontal: false,
        exposure_scale: 0,
        tonemapper_p: 0,
        mount_frame: 0,
        y_offset: 0,
        projection: 0,
        constellations: {
          lines_visible: false,
          labels_visible: false,
          images_visible: false,
          boundaries_visible: false,
        },
        lines: {
          azimuthal: { visible: false },
          equatorial: { visible: false },
          equatorial_jnow: { visible: false },
          meridian: { visible: false },
          ecliptic: { visible: false },
          horizon: { visible: false },
          galactic: { visible: false },
        },
        atmosphere: { visible: false },
        dsos: { visible: false },
        stars: { hints_visible: false },
        planets: { hints_visible: false },
        milkyway: { visible: false },
        hips: { visible: false, url: '' },
        landscapes: {
          addDataSource: jest.fn(),
          visible: false,
          fog_visible: false,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: mockCore } as any;

      act(() => {
        result.current.setStel(mockStel);
        result.current.setBaseUrl('https://example.com/');
      });

      act(() => {
        result.current.updateStellariumCore(createMockSettings());
      });

      expect(mockCore.constellations.lines_visible).toBe(true);
      expect(mockCore.constellations.boundaries_visible).toBe(true);
      expect(mockCore.lines.azimuthal.visible).toBe(true);
      expect(mockCore.lines.equatorial_jnow.visible).toBe(true);
      expect(mockCore.lines.horizon.visible).toBe(true);
      expect(mockCore.lines.galactic.visible).toBe(true);
      expect(mockCore.atmosphere.visible).toBe(true);
      expect(mockCore.dsos.visible).toBe(true);
      expect(mockCore.tonemapper_p).toBe(0.5);
      expect(mockCore.mount_frame).toBe(5);
      expect(mockCore.y_offset).toBe(0.1);
    });

    it('normalizes explicit surveyUrl and keeps survey enabled', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockCore = {
        hips: { visible: false, url: '' },
        landscapes: { addDataSource: jest.fn(), visible: false, fog_visible: false },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: mockCore } as any;

      act(() => {
        result.current.setStel(mockStel);
        result.current.updateStellariumCore(
          createMockSettings({
            surveyEnabled: true,
            surveyId: 'DSS',
            surveyUrl: 'https://custom.example/hips',
          })
        );
      });

      expect(mockCore.hips.visible).toBe(true);
      expect(mockCore.hips.url).toBe('https://custom.example/hips/');
    });

    it('falls back to surveyId URL when surveyUrl is absent', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockCore = {
        hips: { visible: false, url: '' },
        landscapes: { addDataSource: jest.fn(), visible: false, fog_visible: false },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: mockCore } as any;

      act(() => {
        result.current.setStel(mockStel);
        result.current.updateStellariumCore(
          createMockSettings({
            surveyEnabled: true,
            surveyId: 'dss',
            surveyUrl: undefined,
          })
        );
      });

      expect(mockCore.hips.visible).toBe(true);
      expect(mockCore.hips.url).toBe('https://hips.example/dss/');
    });

    it('disables survey when no URL can be resolved', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockCore = {
        hips: { visible: true, url: 'https://previous.example/' },
        landscapes: { addDataSource: jest.fn(), visible: false, fog_visible: false },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: mockCore } as any;

      act(() => {
        result.current.setStel(mockStel);
        result.current.updateStellariumCore(
          createMockSettings({
            surveyEnabled: true,
            surveyId: 'unknown-survey',
            surveyUrl: '',
          })
        );
      });

      expect(mockCore.hips.visible).toBe(false);
    });

    it('keeps applying non-landscape settings when landscape data source loading fails', () => {
      const { result } = renderHook(() => useStellariumStore());
      const mockCore = {
        hips: { visible: false, url: '' },
        landscapes: {
          addDataSource: jest.fn(() => {
            throw new Error('function signature mismatch');
          }),
          visible: true,
          fog_visible: true,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: mockCore } as any;

      act(() => {
        result.current.setStel(mockStel);
        result.current.setBaseUrl('https://example.com/');
        result.current.updateStellariumCore(
          createMockSettings({
            surveyEnabled: true,
            surveyId: 'DSS',
            landscapesVisible: true,
            fogVisible: true,
          })
        );
      });

      expect(mockCore.hips.visible).toBe(true);
      expect(mockCore.hips.url).toBe('https://hips.example/dss/');
      expect(mockCore.landscapes.visible).toBe(false);
      expect(mockCore.landscapes.fog_visible).toBe(false);
    });
  });

  describe('saveViewState / clearSavedViewState', () => {
    it('should have null savedViewState initially', () => {
      const { result } = renderHook(() => useStellariumStore());
      expect(result.current.savedViewState).toBeNull();
    });

    it('should save view state from current viewDirection', () => {
      const { result } = renderHook(() => useStellariumStore());

      // Set up viewDirection (radians) and a mock stel with FOV
      const raRad = (180 * Math.PI) / 180; // 180 deg
      const decRad = (45 * Math.PI) / 180;  // 45 deg
      const fovRad = (60 * Math.PI) / 180;  // 60 deg

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockStel = { core: { fov: fovRad } } as any;

      act(() => {
        result.current.setStel(mockStel);
        // Directly set viewDirection to simulate a polled update
        useStellariumStore.setState({
          viewDirection: { ra: raRad, dec: decRad, alt: 0.5, az: 1.0 },
        });
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(result.current.savedViewState).not.toBeNull();
      expect(result.current.savedViewState!.raDeg).toBeCloseTo(180, 5);
      expect(result.current.savedViewState!.decDeg).toBeCloseTo(45, 5);
      expect(result.current.savedViewState!.fov).toBeCloseTo(60, 5);
    });

    it('should use explicit fov when provided', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        useStellariumStore.setState({
          viewDirection: { ra: 0, dec: 0, alt: 0, az: 0 },
        });
      });

      act(() => {
        result.current.saveViewState(120);
      });

      expect(result.current.savedViewState).not.toBeNull();
      expect(result.current.savedViewState!.fov).toBe(120);
    });

    it('should not save when viewDirection is null', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        useStellariumStore.setState({ viewDirection: null, savedViewState: null });
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(result.current.savedViewState).toBeNull();
    });

    it('should clear saved view state', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        useStellariumStore.setState({
          viewDirection: { ra: 1, dec: 0.5, alt: 0.3, az: 0.2 },
        });
      });

      act(() => {
        result.current.saveViewState(60);
      });

      expect(result.current.savedViewState).not.toBeNull();

      act(() => {
        result.current.clearSavedViewState();
      });

      expect(result.current.savedViewState).toBeNull();
    });

    it('should fallback to 60 deg FOV when no engine is available', () => {
      const { result } = renderHook(() => useStellariumStore());

      act(() => {
        result.current.setStel(null);
        result.current.setAladin(null);
        useStellariumStore.setState({
          viewDirection: { ra: 0, dec: 0, alt: 0, az: 0 },
        });
      });

      act(() => {
        result.current.saveViewState();
      });

      expect(result.current.savedViewState).not.toBeNull();
      expect(result.current.savedViewState!.fov).toBe(60);
    });
  });
});
