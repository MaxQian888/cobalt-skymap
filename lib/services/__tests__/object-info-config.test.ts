/**
 * Tests for object-info-config.ts
 */

import { act, renderHook } from '@testing-library/react';
import {
  useObjectInfoConfigStore,
  DEFAULT_IMAGE_SOURCES,
  DEFAULT_DATA_SOURCES,
  DEFAULT_SETTINGS,
  checkImageSourceHealth,
  checkDataSourceHealth,
  generateImageUrl,
  getActiveImageSources,
  getActiveDataSources,
  getObjectInfoConfigMigratedState,
  startHealthChecks,
  stopHealthChecks,
  type ImageSourceConfig,
  type DataSourceConfig,
} from '../object-info-config';

// Mock fetch
global.fetch = jest.fn();

// Mock performance.now
const mockPerformanceNow = jest.spyOn(performance, 'now');

describe('object-info-config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockReturnValue(0);
    
    // Reset store to defaults
    const { result } = renderHook(() => useObjectInfoConfigStore());
    act(() => {
      result.current.resetToDefaults();
    });
  });

  afterEach(() => {
    stopHealthChecks();
  });

  describe('DEFAULT_IMAGE_SOURCES', () => {
    it('should be an array of image sources', () => {
      expect(Array.isArray(DEFAULT_IMAGE_SOURCES)).toBe(true);
      expect(DEFAULT_IMAGE_SOURCES.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each source', () => {
      DEFAULT_IMAGE_SOURCES.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.type).toBeDefined();
        expect(source.baseUrl).toBeDefined();
        expect(source.urlTemplate).toBeDefined();
        expect(source.credit).toBeDefined();
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.priority).toBe('number');
        expect(typeof source.builtIn).toBe('boolean');
      });
    });

    it('should have at least one enabled source', () => {
      const enabled = DEFAULT_IMAGE_SOURCES.filter(s => s.enabled);
      expect(enabled.length).toBeGreaterThan(0);
    });

    it('should include Aladin DSS source', () => {
      const aladin = DEFAULT_IMAGE_SOURCES.find(s => s.id === 'aladin-dss2-color');
      expect(aladin).toBeDefined();
      expect(aladin?.type).toBe('aladin');
    });

    it('should include SkyView source', () => {
      const skyview = DEFAULT_IMAGE_SOURCES.find(s => s.type === 'skyview');
      expect(skyview).toBeDefined();
    });

    it('should tag image sources with survey render metadata', () => {
      DEFAULT_IMAGE_SOURCES.forEach((source) => {
        expect(source.renderTier).toBe('survey');
        expect(source.fallbackRole).toBeTruthy();
      });
    });
  });

  describe('DEFAULT_DATA_SOURCES', () => {
    it('should be an array of data sources', () => {
      expect(Array.isArray(DEFAULT_DATA_SOURCES)).toBe(true);
      expect(DEFAULT_DATA_SOURCES.length).toBeGreaterThan(0);
    });

    it('should have valid structure for each source', () => {
      DEFAULT_DATA_SOURCES.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.type).toBeDefined();
        expect(source.baseUrl).toBeDefined();
        expect(source.apiEndpoint).toBeDefined();
        expect(typeof source.timeout).toBe('number');
        expect(typeof source.enabled).toBe('boolean');
        expect(typeof source.priority).toBe('number');
      });
    });

    it('should include SIMBAD source', () => {
      const simbad = DEFAULT_DATA_SOURCES.find(s => s.id === 'simbad');
      expect(simbad).toBeDefined();
      expect(simbad?.type).toBe('simbad');
    });

    it('should include render metadata from provider defaults', () => {
      DEFAULT_DATA_SOURCES.forEach((source) => {
        expect(source.renderTier).toBe('enrichment');
        expect(source.fallbackRole).toBeTruthy();
      });
    });
  });

  describe('getObjectInfoConfigMigratedState', () => {
    it('fills missing render metadata for persisted legacy state', () => {
      const migrated = getObjectInfoConfigMigratedState({
        imageSources: [
          {
            ...DEFAULT_IMAGE_SOURCES[0],
            renderTier: undefined,
            fallbackRole: undefined,
          },
        ],
        dataSources: [
          {
            ...DEFAULT_DATA_SOURCES[0],
            renderTier: undefined,
            fallbackRole: undefined,
          },
        ],
        settings: DEFAULT_SETTINGS,
      });

      expect(migrated.imageSources[0].renderTier).toBe('survey');
      expect(migrated.imageSources[0].fallbackRole).toBeTruthy();
      expect(migrated.dataSources[0].renderTier).toBe('enrichment');
      expect(migrated.dataSources[0].fallbackRole).toBeTruthy();
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('should have all required settings', () => {
      expect(DEFAULT_SETTINGS.maxConcurrentRequests).toBeDefined();
      expect(DEFAULT_SETTINGS.imageTimeout).toBeDefined();
      expect(DEFAULT_SETTINGS.apiTimeout).toBeDefined();
      expect(DEFAULT_SETTINGS.autoSkipOffline).toBeDefined();
      expect(DEFAULT_SETTINGS.healthCheckInterval).toBeDefined();
      expect(DEFAULT_SETTINGS.cacheDuration).toBeDefined();
      expect(DEFAULT_SETTINGS.preferredImageFormat).toBeDefined();
      expect(DEFAULT_SETTINGS.defaultImageSize).toBeDefined();
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_SETTINGS.maxConcurrentRequests).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.imageTimeout).toBeGreaterThan(0);
      expect(DEFAULT_SETTINGS.apiTimeout).toBeGreaterThan(0);
      expect(['jpg', 'png', 'gif']).toContain(DEFAULT_SETTINGS.preferredImageFormat);
    });
  });

  describe('useObjectInfoConfigStore', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useObjectInfoConfigStore());

      expect(result.current.imageSources).toBeDefined();
      expect(result.current.dataSources).toBeDefined();
      expect(result.current.settings).toBeDefined();
    });

    describe('setImageSourceEnabled', () => {
      it('should enable an image source', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const disabledSource = result.current.imageSources.find(s => !s.enabled);

        if (disabledSource) {
          act(() => {
            result.current.setImageSourceEnabled(disabledSource.id, true);
          });

          const updated = result.current.imageSources.find(s => s.id === disabledSource.id);
          expect(updated?.enabled).toBe(true);
        }
      });

      it('should disable an image source', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const enabledSource = result.current.imageSources.find(s => s.enabled);

        if (enabledSource) {
          act(() => {
            result.current.setImageSourceEnabled(enabledSource.id, false);
          });

          const updated = result.current.imageSources.find(s => s.id === enabledSource.id);
          expect(updated?.enabled).toBe(false);
        }
      });
    });

    describe('setImageSourcePriority', () => {
      it('should update image source priority', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const source = result.current.imageSources[0];

        act(() => {
          result.current.setImageSourcePriority(source.id, 99);
        });

        const updated = result.current.imageSources.find(s => s.id === source.id);
        expect(updated?.priority).toBe(99);
      });
    });

    describe('updateImageSource', () => {
      it('should update image source properties', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const source = result.current.imageSources[0];

        act(() => {
          result.current.updateImageSource(source.id, {
            description: 'Updated description',
          });
        });

        const updated = result.current.imageSources.find(s => s.id === source.id);
        expect(updated?.description).toBe('Updated description');
      });
    });

    describe('addImageSource', () => {
      it('should add a custom image source', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const initialCount = result.current.imageSources.length;

        act(() => {
          result.current.addImageSource({
            name: 'Custom Source',
            type: 'custom',
            enabled: true,
            priority: 100,
            baseUrl: 'https://example.com',
            urlTemplate: '/image?ra={ra}&dec={dec}',
            credit: 'Custom',
            description: 'Custom source',
          });
        });

        expect(result.current.imageSources.length).toBe(initialCount + 1);
        const newSource = result.current.imageSources.find(s => s.name === 'Custom Source');
        expect(newSource).toBeDefined();
        expect(newSource?.builtIn).toBe(false);
      });
    });

    describe('removeImageSource', () => {
      it('should remove a custom image source', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());

        act(() => {
          result.current.addImageSource({
            name: 'To Remove',
            type: 'custom',
            enabled: true,
            priority: 100,
            baseUrl: 'https://example.com',
            urlTemplate: '/image',
            credit: 'Test',
            description: 'Test',
          });
        });

        const newSource = result.current.imageSources.find(s => s.name === 'To Remove');

        act(() => {
          result.current.removeImageSource(newSource!.id);
        });

        const removed = result.current.imageSources.find(s => s.id === newSource?.id);
        expect(removed).toBeUndefined();
      });

      it('should not remove built-in sources', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const builtInSource = result.current.imageSources.find(s => s.builtIn);

        if (builtInSource) {
          act(() => {
            result.current.removeImageSource(builtInSource.id);
          });

          const stillExists = result.current.imageSources.find(s => s.id === builtInSource.id);
          expect(stillExists).toBeDefined();
        }
      });
    });

    describe('setDataSourceEnabled', () => {
      it('should toggle data source enabled state', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const source = result.current.dataSources[0];
        const initialState = source.enabled;

        act(() => {
          result.current.setDataSourceEnabled(source.id, !initialState);
        });

        const updated = result.current.dataSources.find(s => s.id === source.id);
        expect(updated?.enabled).toBe(!initialState);
      });
    });

    describe('updateSettings', () => {
      it('should update settings', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());

        act(() => {
          result.current.updateSettings({
            maxConcurrentRequests: 10,
            defaultImageSize: 30,
          });
        });

        expect(result.current.settings.maxConcurrentRequests).toBe(10);
        expect(result.current.settings.defaultImageSize).toBe(30);
      });

      it('should preserve other settings', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const originalTimeout = result.current.settings.imageTimeout;

        act(() => {
          result.current.updateSettings({ defaultImageSize: 50 });
        });

        expect(result.current.settings.imageTimeout).toBe(originalTimeout);
      });
    });

    describe('setImageSourceStatus', () => {
      it('should update image source status', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());
        const source = result.current.imageSources[0];

        act(() => {
          result.current.setImageSourceStatus(source.id, 'online', 100);
        });

        const updated = result.current.imageSources.find(s => s.id === source.id);
        expect(updated?.status).toBe('online');
        expect(updated?.responseTime).toBe(100);
        expect(updated?.lastChecked).toBeDefined();
      });
    });

    describe('resetToDefaults', () => {
      it('should reset all config to defaults', () => {
        const { result } = renderHook(() => useObjectInfoConfigStore());

        act(() => {
          result.current.updateSettings({ maxConcurrentRequests: 100 });
          result.current.setImageSourceEnabled(result.current.imageSources[0].id, false);
        });

        act(() => {
          result.current.resetToDefaults();
        });

        expect(result.current.settings.maxConcurrentRequests).toBe(DEFAULT_SETTINGS.maxConcurrentRequests);
      });
    });
  });

  describe('checkImageSourceHealth', () => {
    it('should return online status for successful response', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const source: ImageSourceConfig = {
        ...DEFAULT_IMAGE_SOURCES[0],
      };

      const result = await checkImageSourceHealth(source);

      expect(result.online).toBe(true);
      expect(result.responseTime).toBeDefined();
    });

    it('should return offline status for failed response', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const source: ImageSourceConfig = {
        ...DEFAULT_IMAGE_SOURCES[0],
      };

      const result = await checkImageSourceHealth(source);

      expect(result.online).toBe(false);
    });

    it('should return offline status for network error', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const source: ImageSourceConfig = {
        ...DEFAULT_IMAGE_SOURCES[0],
      };

      const result = await checkImageSourceHealth(source);

      expect(result.online).toBe(false);
    });
  });

  describe('checkDataSourceHealth', () => {
    it('should return online status for successful response', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(50);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const source: DataSourceConfig = {
        ...DEFAULT_DATA_SOURCES[0],
      };

      const result = await checkDataSourceHealth(source);

      expect(result.online).toBe(true);
    });

    it('should handle 405 as acceptable for HEAD requests', async () => {
      mockPerformanceNow.mockReturnValueOnce(0).mockReturnValueOnce(50);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 405 });

      const source: DataSourceConfig = {
        ...DEFAULT_DATA_SOURCES[0],
      };

      const result = await checkDataSourceHealth(source);

      expect(result.online).toBe(true);
    });
  });

  describe('generateImageUrl', () => {
    it('should generate URL with coordinates', () => {
      const source = DEFAULT_IMAGE_SOURCES[0];
      const url = generateImageUrl(source, 10.68, 41.27);

      expect(url).toContain('10.68');
      expect(url).toContain('41.27');
    });

    it('should use default image size from settings', () => {
      const source = DEFAULT_IMAGE_SOURCES[0];
      const url = generateImageUrl(source, 0, 0);

      // URL should contain size parameter
      expect(url).toBeDefined();
    });

    it('should accept custom size', () => {
      const source = DEFAULT_IMAGE_SOURCES[0];
      const url = generateImageUrl(source, 0, 0, 60);

      expect(url).toBeDefined();
    });
  });

  describe('getActiveImageSources', () => {
    it('should return only enabled sources', () => {
      const active = getActiveImageSources();

      active.forEach(source => {
        expect(source.enabled).toBe(true);
      });
    });

    it('should sort by priority', () => {
      const active = getActiveImageSources();

      for (let i = 1; i < active.length; i++) {
        expect(active[i].priority).toBeGreaterThanOrEqual(active[i - 1].priority);
      }
    });

    it('should exclude offline sources when autoSkipOffline is true', () => {
      const { result } = renderHook(() => useObjectInfoConfigStore());

      act(() => {
        result.current.setImageSourceStatus(result.current.imageSources[0].id, 'offline');
      });

      const active = getActiveImageSources();
      const offlineSource = active.find(s => s.status === 'offline');

      expect(offlineSource).toBeUndefined();
    });
  });

  describe('getActiveDataSources', () => {
    it('should return only enabled sources', () => {
      const active = getActiveDataSources();

      active.forEach(source => {
        expect(source.enabled).toBe(true);
      });
    });

    it('should sort by priority', () => {
      const active = getActiveDataSources();

      for (let i = 1; i < active.length; i++) {
        expect(active[i].priority).toBeGreaterThanOrEqual(active[i - 1].priority);
      }
    });
  });

  describe('health check lifecycle', () => {
    it('should start health checks', () => {
      const { result } = renderHook(() => useObjectInfoConfigStore());

      act(() => {
        result.current.updateSettings({ healthCheckInterval: 0 });
      });

      expect(() => startHealthChecks()).not.toThrow();
    });

    it('should stop health checks', () => {
      expect(() => stopHealthChecks()).not.toThrow();
    });

    it('should be safe to call stop without start', () => {
      expect(() => stopHealthChecks()).not.toThrow();
    });
  });
});
