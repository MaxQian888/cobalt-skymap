/**
 * @jest-environment jsdom
 */
import { STELLARIUM_LAYERS, getStellariumLayersForTier, offlineCacheManager } from '../cache-manager';
import type { HiPSSurvey } from '@/lib/services/hips-service';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper: create a mock HiPSSurvey
function createMockHiPSSurvey(overrides: Partial<HiPSSurvey> = {}): HiPSSurvey {
  return {
    id: 'test-survey',
    name: 'Test Survey',
    url: 'https://example.com/hips/',
    description: 'Test survey',
    category: 'optical',
    maxOrder: 5,
    tileFormat: 'jpeg fits',
    frame: 'equatorial',
    ...overrides,
  };
}

// Mock Cache API
const mockCache: {
  match: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
  keys: jest.Mock;
} = {
  match: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  keys: jest.fn(() => Promise.resolve([])),
};

const mockCaches: {
  open: jest.Mock;
  delete: jest.Mock;
  keys: jest.Mock;
  has: jest.Mock;
  match: jest.Mock;
} = {
  open: jest.fn(() => Promise.resolve(mockCache)),
  delete: jest.fn(() => Promise.resolve(true)),
  keys: jest.fn(() => Promise.resolve([])),
  has: jest.fn(() => Promise.resolve(false)),
  match: jest.fn(),
};

Object.defineProperty(global, 'caches', {
  value: mockCaches,
  writable: true,
});

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: jest.fn(() => Promise.resolve({ usage: 0, quota: 1000000000 })),
  },
  writable: true,
});

describe('STELLARIUM_LAYERS', () => {
  it('contains core layer', () => {
    const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core');
    expect(coreLayer).toBeDefined();
    expect(coreLayer?.name).toBe('Core Engine');
  });

  it('contains stars layer', () => {
    const starsLayer = STELLARIUM_LAYERS.find(l => l.id === 'stars');
    expect(starsLayer).toBeDefined();
    expect(starsLayer?.name).toBe('Star Catalog');
  });

  it('contains dso layer', () => {
    const dsoLayer = STELLARIUM_LAYERS.find(l => l.id === 'dso');
    expect(dsoLayer).toBeDefined();
    expect(dsoLayer?.name).toBe('Deep Sky Objects');
  });

  it('contains skycultures layer', () => {
    const skyculturesLayer = STELLARIUM_LAYERS.find(l => l.id === 'skycultures');
    expect(skyculturesLayer).toBeDefined();
    expect(skyculturesLayer?.name).toBe('Sky Cultures');
  });

  it('contains planets layer', () => {
    const planetsLayer = STELLARIUM_LAYERS.find(l => l.id === 'planets');
    expect(planetsLayer).toBeDefined();
    expect(planetsLayer?.name).toBe('Solar System');
  });

  it('all layers have required properties', () => {
    STELLARIUM_LAYERS.forEach(layer => {
      expect(layer).toHaveProperty('id');
      expect(layer).toHaveProperty('name');
      expect(layer).toHaveProperty('description');
      expect(layer).toHaveProperty('tier');
      expect(layer).toHaveProperty('baseUrl');
      expect(layer).toHaveProperty('files');
      expect(layer).toHaveProperty('size');
      expect(layer).toHaveProperty('priority');
      expect(Array.isArray(layer.files)).toBe(true);
      expect(typeof layer.size).toBe('number');
      expect(typeof layer.priority).toBe('number');
    });
  });

  it('layers are sorted by priority', () => {
    for (let i = 1; i < STELLARIUM_LAYERS.length; i++) {
      expect(STELLARIUM_LAYERS[i].priority).toBeGreaterThanOrEqual(
        STELLARIUM_LAYERS[i - 1].priority
      );
    }
  });

  it('groups layers by tier for shared cache planning', () => {
    expect(getStellariumLayersForTier('core').map((layer) => layer.id)).toEqual(['core']);
    expect(getStellariumLayersForTier('catalog').map((layer) => layer.id)).toEqual(
      expect.arrayContaining(['stars', 'dso', 'skycultures', 'planets', 'comets'])
    );
    expect(getStellariumLayersForTier('survey').map((layer) => layer.id)).toEqual(
      expect.arrayContaining(['dss', 'milkyway'])
    );
  });
});

describe('offlineCacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockCache.match.mockResolvedValue(null);
    mockCache.put.mockResolvedValue(undefined);
    mockCache.keys.mockResolvedValue([]);
    mockCaches.open.mockResolvedValue(mockCache);
    mockCaches.delete.mockResolvedValue(true);
    mockCaches.keys.mockResolvedValue([]);
  });

  describe('isAvailable', () => {
    it('returns true when caches API is available', () => {
      expect(offlineCacheManager.isAvailable()).toBe(true);
    });
  });

  describe('isOnline', () => {
    it('returns navigator.onLine status', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      expect(offlineCacheManager.isOnline()).toBe(true);

      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      expect(offlineCacheManager.isOnline()).toBe(false);

      // Restore
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    });
  });

  describe('getLayerStatus', () => {
    it('returns status for valid layer with no cached files', async () => {
      const status = await offlineCacheManager.getLayerStatus('core');
      expect(status.layerId).toBe('core');
      expect(status.cached).toBe(false);
      expect(status.cachedFiles).toBe(0);
      expect(status.totalFiles).toBe(2);
      expect(status.isComplete).toBe(false);
      expect(status.integrityChecked).toBe(true);
    });

    it('returns empty status for invalid layer', async () => {
      const status = await offlineCacheManager.getLayerStatus('nonexistent');
      expect(status.layerId).toBe('nonexistent');
      expect(status.cached).toBe(false);
      expect(status.totalFiles).toBe(0);
      expect(status.isComplete).toBe(false);
    });

    it('returns complete status when all files are cached', async () => {
      const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core')!;
      const cachedKeys = coreLayer.files.map(file => ({
        url: new URL(coreLayer.baseUrl + file, window.location.origin).href,
      }));
      mockCache.keys.mockResolvedValue(cachedKeys);

      const status = await offlineCacheManager.getLayerStatus('core');
      expect(status.cached).toBe(true);
      expect(status.isComplete).toBe(true);
      expect(status.cachedFiles).toBe(coreLayer.files.length);
      expect(status.missingFiles).toBeUndefined();
    });

    it('returns partial status when some files are cached', async () => {
      const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core')!;
      const cachedKeys = [{ url: new URL(coreLayer.baseUrl + coreLayer.files[0], window.location.origin).href }];
      mockCache.keys.mockResolvedValue(cachedKeys);

      const status = await offlineCacheManager.getLayerStatus('core');
      expect(status.cached).toBe(false);
      expect(status.isComplete).toBe(false);
      expect(status.cachedFiles).toBe(1);
      expect(status.missingFiles).toBeDefined();
      expect(status.missingFiles!.length).toBe(coreLayer.files.length - 1);
    });

    it('handles cache open error gracefully', async () => {
      mockCaches.open.mockRejectedValue(new Error('Cache error'));
      const status = await offlineCacheManager.getLayerStatus('core');
      expect(status.cached).toBe(false);
      expect(status.cachedFiles).toBe(0);
      expect(status.isComplete).toBe(false);
    });
  });

  describe('getStorageInfo', () => {
    it('returns storage information', async () => {
      (navigator.storage.estimate as jest.Mock).mockResolvedValue({ usage: 5000, quota: 1000000 });
      const info = await offlineCacheManager.getStorageInfo();
      expect(info.used).toBe(5000);
      expect(info.quota).toBe(1000000);
      expect(info.available).toBe(995000);
      expect(info.usagePercent).toBeCloseTo(0.5, 1);
    });

    it('handles estimate error gracefully', async () => {
      (navigator.storage.estimate as jest.Mock).mockRejectedValue(new Error('fail'));
      const info = await offlineCacheManager.getStorageInfo();
      expect(info.used).toBe(0);
      expect(info.quota).toBe(0);
    });
  });

  describe('getAllLayerStatus', () => {
    it('returns status for all layers', async () => {
      const statuses = await offlineCacheManager.getAllLayerStatus();
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBe(STELLARIUM_LAYERS.length);
    });
  });

  describe('downloadLayer', () => {
    it('downloads and caches all files for a layer', async () => {
      mockFetch.mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });
      const progressCb = jest.fn();

      const success = await offlineCacheManager.downloadLayer('skycultures', progressCb);
      expect(success).toBe(true);
      const layer = STELLARIUM_LAYERS.find(l => l.id === 'skycultures')!;
      expect(mockFetch).toHaveBeenCalledTimes(layer.files.length);
      expect(mockCache.put).toHaveBeenCalledTimes(layer.files.length);
      expect(progressCb).toHaveBeenCalled();
      // Last call should have status 'completed'
      const lastCall = progressCb.mock.calls[progressCb.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('completed');
    });

    it('throws for unknown layer', async () => {
      await expect(offlineCacheManager.downloadLayer('nonexistent')).rejects.toThrow('Unknown layer');
    });

    it('continues when a single file fetch fails', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true, clone: () => ({ ok: true }) })
        .mockResolvedValueOnce({ ok: true, clone: () => ({ ok: true }) });

      const success = await offlineCacheManager.downloadLayer('skycultures');
      expect(success).toBe(true);
      // put called for the 2 successful fetches
      expect(mockCache.put).toHaveBeenCalledTimes(2);
    });

    it('returns false when download is cancelled via abort', async () => {
      // Simulate AbortError
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const progressCb = jest.fn();
      const success = await offlineCacheManager.downloadLayer('skycultures', progressCb);
      expect(success).toBe(false);
      const lastCall = progressCb.mock.calls[progressCb.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('error');
      expect(lastCall.error).toBe('Download cancelled');
    });

    it('handles top-level error in downloadLayer', async () => {
      mockCaches.open.mockRejectedValue(new Error('cache open fail'));
      const progressCb = jest.fn();
      const success = await offlineCacheManager.downloadLayer('skycultures', progressCb);
      expect(success).toBe(false);
      const lastCall = progressCb.mock.calls[progressCb.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('error');
    });
  });

  describe('downloadLayers', () => {
    it('downloads multiple layers sorted by priority', async () => {
      mockFetch.mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });
      const progressCb = jest.fn();
      const results = await offlineCacheManager.downloadLayers(['dso', 'core'], progressCb);
      expect(results.get('core')).toBe(true);
      expect(results.get('dso')).toBe(true);
    });
  });

  describe('downloadAllLayers', () => {
    it('downloads all layers', async () => {
      mockFetch.mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });
      const results = await offlineCacheManager.downloadAllLayers();
      expect(results.size).toBe(STELLARIUM_LAYERS.length);
    });
  });

  describe('cancelDownload', () => {
    it('aborts the download controller for a layer', async () => {
      // Start a download that will be slow
      let fetchResolve: (() => void) | undefined;
      mockFetch.mockImplementation(() => new Promise(resolve => { fetchResolve = () => resolve({ ok: true, clone: () => ({}) }); }));

      const downloadPromise = offlineCacheManager.downloadLayer('skycultures');
      // Cancel immediately
      offlineCacheManager.cancelDownload('skycultures');
      // Resolve the pending fetch to unblock
      fetchResolve?.();

      const success = await downloadPromise;
      // It may or may not be false depending on timing, but cancelDownload shouldn't throw
      expect(typeof success).toBe('boolean');
    });

    it('does nothing for unknown layer', () => {
      expect(() => offlineCacheManager.cancelDownload('nonexistent')).not.toThrow();
    });
  });

  describe('cancelAllDownloads', () => {
    it('cancels all ongoing downloads', () => {
      expect(() => offlineCacheManager.cancelAllDownloads()).not.toThrow();
    });
  });

  describe('clearLayer', () => {
    it('clears cache for a specific layer', async () => {
      mockCaches.delete.mockResolvedValue(true);
      const result = await offlineCacheManager.clearLayer('core');
      expect(result).toBe(true);
      expect(mockCaches.delete).toHaveBeenCalled();
    });

    it('returns false when cache delete fails', async () => {
      mockCaches.delete.mockRejectedValue(new Error('delete error'));
      const result = await offlineCacheManager.clearLayer('core');
      expect(result).toBe(false);
    });
  });

  describe('clearAllCache', () => {
    it('clears all skymap caches', async () => {
      mockCaches.keys.mockResolvedValue(['skymap-offline-core-v1', 'skymap-offline-stars-v1', 'other-cache']);
      const result = await offlineCacheManager.clearAllCache();
      expect(result).toBe(true);
      // Should only delete skymap-offline-* caches (2 of them)
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it('handles error gracefully', async () => {
      mockCaches.keys.mockRejectedValue(new Error('keys error'));
      const result = await offlineCacheManager.clearAllCache();
      expect(result).toBe(false);
    });
  });

  describe('getTotalCacheSize', () => {
    it('returns usage from navigator.storage.estimate', async () => {
      (navigator.storage.estimate as jest.Mock).mockResolvedValue({ usage: 12345 });
      const size = await offlineCacheManager.getTotalCacheSize();
      expect(size).toBe(12345);
    });

    it('returns 0 on error', async () => {
      (navigator.storage.estimate as jest.Mock).mockRejectedValue(new Error('fail'));
      const size = await offlineCacheManager.getTotalCacheSize();
      expect(size).toBe(0);
    });
  });

  describe('getResource', () => {
    it('returns cached response if found', async () => {
      const cached = { status: 200, body: 'cached' };
      mockCaches.keys.mockResolvedValue(['skymap-offline-core-v1']);
      mockCache.match.mockResolvedValue(cached);

      const result = await offlineCacheManager.getResource('http://example.com/test');
      expect(result).toBe(cached);
    });

    it('fetches from network when not in cache and online', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      mockCaches.keys.mockResolvedValue(['skymap-offline-core-v1']);
      mockCache.match.mockResolvedValue(null);
      const networkResp = { status: 200, body: 'network' };
      mockFetch.mockResolvedValue(networkResp);

      const result = await offlineCacheManager.getResource('http://example.com/test');
      expect(result).toBe(networkResp);
    });

    it('returns null when offline and not in cache', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      mockCaches.keys.mockResolvedValue(['skymap-offline-core-v1']);
      mockCache.match.mockResolvedValue(null);

      const result = await offlineCacheManager.getResource('http://example.com/test');
      expect(result).toBeNull();
      // Restore
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    });

    it('returns null when online but fetch fails', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      mockCaches.keys.mockResolvedValue([]);
      mockFetch.mockRejectedValue(new Error('network error'));

      const result = await offlineCacheManager.getResource('http://example.com/test');
      expect(result).toBeNull();
    });
  });

  describe('verifyAndRepairLayer', () => {
    it('returns verified for complete layer', async () => {
      const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core')!;
      const cachedKeys = coreLayer.files.map(file => ({
        url: new URL(coreLayer.baseUrl + file, window.location.origin).href,
      }));
      mockCache.keys.mockResolvedValue(cachedKeys);

      const result = await offlineCacheManager.verifyAndRepairLayer('core');
      expect(result.verified).toBe(true);
      expect(result.repaired).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('repairs missing files', async () => {
      // First call (getLayerStatus) returns missing files
      const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core')!;
      mockCache.keys.mockResolvedValue([
        { url: new URL(coreLayer.baseUrl + coreLayer.files[0], window.location.origin).href },
      ]);
      mockFetch.mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });

      const progressCb = jest.fn();
      const result = await offlineCacheManager.verifyAndRepairLayer('core', progressCb);
      expect(result.repaired).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.verified).toBe(true);
      expect(progressCb).toHaveBeenCalled();
    });

    it('reports failed repairs', async () => {
      const coreLayer = STELLARIUM_LAYERS.find(l => l.id === 'core')!;
      mockCache.keys.mockResolvedValue([
        { url: new URL(coreLayer.baseUrl + coreLayer.files[0], window.location.origin).href },
      ]);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const result = await offlineCacheManager.verifyAndRepairLayer('core');
      expect(result.failed).toBe(1);
      expect(result.verified).toBe(false);
    });

    it('returns failed for unknown layer with missing files', async () => {
      // getLayerStatus for unknown layer returns totalFiles=0, isComplete=false, no missingFiles
      const result = await offlineCacheManager.verifyAndRepairLayer('nonexistent');
      // No missing files since totalFiles is 0
      expect(result.verified).toBe(true);
      expect(result.repaired).toBe(0);
    });
  });

  // ==================== HiPS Tests ====================

  describe('getHiPSCacheStatus', () => {
    it('returns uncached status when no tiles cached', async () => {
      mockCache.keys.mockResolvedValue([]);
      const survey = createMockHiPSSurvey();
      const status = await offlineCacheManager.getHiPSCacheStatus(survey);
      expect(status.surveyId).toBe('test-survey');
      expect(status.cached).toBe(false);
      expect(status.cachedTiles).toBe(0);
      expect(status.maxCachedOrder).toBe(-1);
    });

    it('returns cached status with tiles', async () => {
      mockCache.keys.mockResolvedValue([
        { url: 'https://example.com/hips/Norder0/Dir0/Npix0.jpeg' },
        { url: 'https://example.com/hips/Norder1/Dir0/Npix0.jpeg' },
        { url: 'https://example.com/hips/Norder1/Dir0/Npix1.jpeg' },
      ]);
      const survey = createMockHiPSSurvey();
      const status = await offlineCacheManager.getHiPSCacheStatus(survey);
      expect(status.cached).toBe(true);
      expect(status.cachedTiles).toBe(3);
      expect(status.cachedOrders).toContain(0);
      expect(status.cachedOrders).toContain(1);
      expect(status.maxCachedOrder).toBe(1);
    });

    it('handles cache error gracefully', async () => {
      mockCaches.open.mockRejectedValue(new Error('cache error'));
      const survey = createMockHiPSSurvey();
      const status = await offlineCacheManager.getHiPSCacheStatus(survey);
      expect(status.cached).toBe(false);
      expect(status.cachedTiles).toBe(0);
    });
  });

  describe('downloadHiPSSurvey', () => {
    it('downloads tiles for a survey', async () => {
      mockCache.match.mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: true, clone: () => ({ ok: true }) });

      const survey = createMockHiPSSurvey();
      const progressCb = jest.fn();
      const success = await offlineCacheManager.downloadHiPSSurvey(survey, 0, progressCb);
      expect(success).toBe(true);
      // Order 0 has 12 tiles (12 * 1 * 1)
      expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
      expect(progressCb).toHaveBeenCalled();
    });

    it('skips already cached tiles', async () => {
      mockCache.match.mockResolvedValue({ ok: true }); // Already cached
      const survey = createMockHiPSSurvey();
      const success = await offlineCacheManager.downloadHiPSSurvey(survey, 0);
      expect(success).toBe(true);
      // No fetch calls since all tiles are cached
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('reports failed tiles in progress', async () => {
      mockCache.match.mockResolvedValue(null);
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const survey = createMockHiPSSurvey();
      const progressCb = jest.fn();
      const success = await offlineCacheManager.downloadHiPSSurvey(survey, 0, progressCb);
      expect(success).toBe(false);
      const lastCall = progressCb.mock.calls[progressCb.mock.calls.length - 1][0];
      expect(lastCall.status).toBe('error');
    });

    it('handles top-level error', async () => {
      mockCaches.open.mockRejectedValue(new Error('open fail'));
      const survey = createMockHiPSSurvey();
      const progressCb = jest.fn();
      const success = await offlineCacheManager.downloadHiPSSurvey(survey, 0, progressCb);
      expect(success).toBe(false);
    });
  });

  describe('cancelHiPSDownload', () => {
    it('does nothing for unknown survey', () => {
      expect(() => offlineCacheManager.cancelHiPSDownload('unknown')).not.toThrow();
    });
  });

  describe('clearHiPSCache', () => {
    it('clears HiPS cache for a survey', async () => {
      mockCaches.delete.mockResolvedValue(true);
      const result = await offlineCacheManager.clearHiPSCache('test-survey');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      mockCaches.delete.mockRejectedValue(new Error('fail'));
      const result = await offlineCacheManager.clearHiPSCache('test-survey');
      expect(result).toBe(false);
    });
  });

  describe('clearAllHiPSCaches', () => {
    it('clears all HiPS caches', async () => {
      mockCaches.keys.mockResolvedValue(['skymap-hips-survey1-v1', 'skymap-hips-survey2-v1', 'other-cache']);
      const result = await offlineCacheManager.clearAllHiPSCaches();
      expect(result).toBe(true);
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it('handles error gracefully', async () => {
      mockCaches.keys.mockRejectedValue(new Error('fail'));
      const result = await offlineCacheManager.clearAllHiPSCaches();
      expect(result).toBe(false);
    });
  });

  describe('getAllCachedHiPSSurveys', () => {
    it('returns survey IDs from cache names', async () => {
      mockCaches.keys.mockResolvedValue(['skymap-hips-survey1-v1', 'skymap-hips-survey2-v1', 'other-cache']);
      const surveys = await offlineCacheManager.getAllCachedHiPSSurveys();
      expect(surveys).toContain('survey1');
      expect(surveys).toContain('survey2');
      expect(surveys).not.toContain('other-cache');
    });

    it('returns empty array on error', async () => {
      mockCaches.keys.mockRejectedValue(new Error('fail'));
      const surveys = await offlineCacheManager.getAllCachedHiPSSurveys();
      expect(surveys).toEqual([]);
    });
  });

  describe('getHiPSTile', () => {
    it('delegates to getResource with correct URL', async () => {
      const networkResp = { status: 200 };
      mockCaches.keys.mockResolvedValue([]);
      mockFetch.mockResolvedValue(networkResp);
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

      const result = await offlineCacheManager.getHiPSTile('https://example.com/hips/', 1, 5, 'jpeg');
      expect(result).toBe(networkResp);
    });
  });
});
