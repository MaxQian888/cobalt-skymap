/**
 * Tests for cache/config.ts
 */

import {
  CACHE_CONFIG,
  CACHEABLE_URL_PATTERNS,
  PREFETCH_RESOURCES,
  getStarmapTierPrefetchResources,
  hoursToMs,
  daysToMs,
  formatBytes,
  formatDuration,
} from '../config';

describe('CACHE_CONFIG', () => {
  describe('unified cache config', () => {
    it('should have valid maxSize', () => {
      expect(CACHE_CONFIG.unified.maxSize).toBeGreaterThan(0);
      expect(CACHE_CONFIG.unified.maxSize).toBe(500 * 1024 * 1024); // 500MB
    });

    it('should have valid defaultTTL', () => {
      expect(CACHE_CONFIG.unified.defaultTTL).toBeGreaterThan(0);
      expect(CACHE_CONFIG.unified.defaultTTL).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
    });

    it('should have valid prefetchTTL', () => {
      expect(CACHE_CONFIG.unified.prefetchTTL).toBeGreaterThan(CACHE_CONFIG.unified.defaultTTL);
    });

    it('should have a cache name', () => {
      expect(CACHE_CONFIG.unified.cacheName).toBeDefined();
      expect(typeof CACHE_CONFIG.unified.cacheName).toBe('string');
    });
  });

  describe('geocoding cache config', () => {
    it('should have valid maxSize', () => {
      expect(CACHE_CONFIG.geocoding.maxSize).toBeGreaterThan(0);
    });

    it('should have valid ttl', () => {
      expect(CACHE_CONFIG.geocoding.ttl).toBeGreaterThan(0);
    });
  });

  describe('nighttime cache config', () => {
    it('should have valid maxSize', () => {
      expect(CACHE_CONFIG.nighttime.maxSize).toBeGreaterThan(0);
    });

    it('should have short ttl (data changes frequently)', () => {
      expect(CACHE_CONFIG.nighttime.ttl).toBeLessThan(5 * 60 * 1000); // < 5 minutes
    });

    it('should have position cache sizes', () => {
      expect(CACHE_CONFIG.nighttime.positionCacheMaxSize).toBeGreaterThan(0);
      expect(CACHE_CONFIG.nighttime.hourAngleCacheMaxSize).toBeGreaterThan(0);
    });
  });

  describe('search cache config', () => {
    it('should have valid maxSize', () => {
      expect(CACHE_CONFIG.search.maxSize).toBeGreaterThan(0);
    });

    it('should have valid defaultTTL', () => {
      expect(CACHE_CONFIG.search.defaultTTL).toBeGreaterThan(0);
    });
  });

  describe('tauri cache config', () => {
    it('should have valid maxEntries', () => {
      expect(CACHE_CONFIG.tauri.maxEntries).toBeGreaterThan(0);
      expect(CACHE_CONFIG.tauri.maxEntries).toBe(10_000);
    });

    it('should have valid maxTotalSize', () => {
      expect(CACHE_CONFIG.tauri.maxTotalSize).toBeGreaterThan(0);
      expect(CACHE_CONFIG.tauri.maxTotalSize).toBe(1024 * 1024 * 1024); // 1GB
    });
  });
});

describe('CACHEABLE_URL_PATTERNS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(CACHEABLE_URL_PATTERNS)).toBe(true);
    expect(CACHEABLE_URL_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should contain stellarium patterns', () => {
    const hasStellarium = CACHEABLE_URL_PATTERNS.some(p => p.includes('stellarium'));
    expect(hasStellarium).toBe(true);
  });
});

describe('PREFETCH_RESOURCES', () => {
  it('should be an array', () => {
    expect(Array.isArray(PREFETCH_RESOURCES)).toBe(true);
  });

  it('should contain the stellarium engine bootstrap script', () => {
    const hasEngineScript = PREFETCH_RESOURCES.some((p) => p.includes('stellarium-web-engine.js'));
    expect(hasEngineScript).toBe(true);
  });

  it('should include catalog bootstrap manifests for richer first render', () => {
    expect(PREFETCH_RESOURCES.some((p) => p.includes('/stellarium-data/stars/info.json'))).toBe(true);
    expect(PREFETCH_RESOURCES.some((p) => p.includes('/stellarium-data/dso/info.json'))).toBe(true);
  });
});

describe('getStarmapTierPrefetchResources', () => {
  it('returns tier-specific prefetch resources', () => {
    expect(getStarmapTierPrefetchResources('core')).toEqual(
      expect.arrayContaining(['/stellarium-js/stellarium-web-engine.js'])
    );
    expect(getStarmapTierPrefetchResources('catalog')).toEqual(
      expect.arrayContaining(['/stellarium-data/stars/info.json'])
    );
    expect(getStarmapTierPrefetchResources('survey')).toEqual(
      expect.arrayContaining(['/stellarium-data/surveys/dss/info.json'])
    );
  });
});

describe('hoursToMs', () => {
  it('should convert hours to milliseconds', () => {
    expect(hoursToMs(1)).toBe(3600000);
    expect(hoursToMs(24)).toBe(86400000);
    expect(hoursToMs(0.5)).toBe(1800000);
  });

  it('should handle zero', () => {
    expect(hoursToMs(0)).toBe(0);
  });
});

describe('daysToMs', () => {
  it('should convert days to milliseconds', () => {
    expect(daysToMs(1)).toBe(86400000);
    expect(daysToMs(7)).toBe(604800000);
    expect(daysToMs(0.5)).toBe(43200000);
  });

  it('should handle zero', () => {
    expect(daysToMs(0)).toBe(0);
  });
});

describe('formatBytes', () => {
  it('should format bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });
});

describe('formatDuration', () => {
  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(30000)).toBe('30s');
  });

  it('should format minutes', () => {
    expect(formatDuration(60000)).toBe('1m');
    expect(formatDuration(300000)).toBe('5m');
  });

  it('should format hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
    expect(formatDuration(7200000)).toBe('2h');
  });

  it('should format days', () => {
    expect(formatDuration(86400000)).toBe('1d');
    expect(formatDuration(604800000)).toBe('7d');
  });
});
