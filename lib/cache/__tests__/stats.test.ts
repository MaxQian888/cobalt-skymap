/**
 * Tests for cache/stats.ts
 */

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    getCacheStats: jest.fn(() => ({ hits: 100, misses: 20, hitRate: 0.833, errors: 1 })),
    getSize: jest.fn(async () => 1024 * 1024),
    keys: jest.fn(async () => ['key1', 'key2', 'key3']),
  },
}));

jest.mock('@/lib/tauri/unified-cache-api', () => ({
  unifiedCacheApi: {
    getStats: jest.fn(async () => ({
      total_size: 2048 * 1024,
      max_size: 1024 * 1024 * 1024,
      total_entries: 50,
      max_entries: 10000,
      hit_rate: 0.9,
    })),
  },
}));

jest.mock('@/lib/catalogs/nighttime-calculator', () => ({
  getNighttimeCacheStats: jest.fn(() => ({
    nighttime: { size: 10, hits: 50, misses: 5 },
    sunPosition: { size: 20, hits: 80, misses: 10 },
    moonPosition: { size: 15, hits: 60, misses: 8 },
    hourAngle: { size: 5, hits: 30, misses: 2 },
  })),
}));

jest.mock('@/lib/cache/integration-policy', () => ({
  getCacheProviderDiagnostics: jest.fn(() => ({
    providerId: 'browser-cache-api',
    available: true,
    supportsPersistent: true,
    supportsClear: true,
    supportsCleanup: false,
    supportsFlush: false,
    supportsInterception: true,
  })),
  getCacheIntegrationDiagnostics: jest.fn(() => ([
    {
      id: 'hips-registry',
      title: 'HiPS registry fetches',
      modulePath: 'lib/services/hips/service.ts',
      policyId: 'hips-registry',
      owner: 'starmap-settings',
      environments: ['web', 'tauri'],
      implementation: 'shared-policy',
      cacheMode: 'persistent-shared',
      status: 'active',
      strategy: 'network-first',
      ttl: 86400000,
      providerId: 'browser-cache-api',
      runtimeEnvironment: 'web',
      environmentSupported: true,
    },
    {
      id: 'nighttime-calculations',
      title: 'Nighttime calculations',
      modulePath: 'lib/catalogs/nighttime-calculator.ts',
      policyId: 'nighttime-calculations',
      owner: 'astronomy-catalogs',
      environments: ['web', 'tauri'],
      implementation: 'local-cache',
      reason: 'Derived astronomy calculations are memoized in process memory only.',
      cacheMode: 'local-only',
      status: 'local-only',
      strategy: 'cache-first',
      ttl: 3600000,
      providerId: 'browser-cache-api',
      runtimeEnvironment: 'web',
      environmentSupported: true,
      statusReason: 'Derived astronomy calculations are memoized in process memory only.',
    },
  ])),
}));

import { isTauri } from '@/lib/storage/platform';
import { unifiedCache } from '@/lib/offline/unified-cache';
import { unifiedCacheApi } from '@/lib/tauri/unified-cache-api';
import { getNighttimeCacheStats } from '@/lib/catalogs/nighttime-calculator';

import {
  collectCacheStats,
  formatCacheStats,
  getCacheStatsSummary,
  cacheStats,
  type AggregatedCacheStats,
  type CacheStatsEntry,
} from '../stats';
import defaultCacheStats from '../stats';

const mockIsTauri = isTauri as jest.Mock;
const mockGetNighttimeCacheStats = getNighttimeCacheStats as jest.Mock;

function makeDiagnosticsStats(overrides: Partial<AggregatedCacheStats> = {}): AggregatedCacheStats {
  return {
    totalSize: 0,
    totalEntries: 0,
    totalHits: 0,
    totalMisses: 0,
    overallHitRate: undefined,
    caches: [],
    providerDiagnostics: {
      providerId: 'browser-cache-api',
      available: true,
      supportsPersistent: true,
      supportsClear: true,
      supportsInterception: true,
      supportsCleanup: false,
      supportsFlush: false,
    },
    integrationDiagnostics: [],
    lastUpdated: Date.now(),
    ...overrides,
  };
}

describe('formatCacheStats', () => {
  const mockStats: AggregatedCacheStats = makeDiagnosticsStats({
    totalSize: 1024 * 1024 * 100,
    totalEntries: 500,
    totalHits: 800,
    totalMisses: 200,
    overallHitRate: 0.8,
    integrationDiagnostics: [{
      id: 'test-integration',
      title: 'Test integration',
      modulePath: 'test/module',
      policyId: 'hips-registry',
      owner: 'cache-tests',
      environments: ['web', 'tauri'],
      implementation: 'shared-policy',
      cacheMode: 'persistent-shared',
      status: 'active',
      strategy: 'network-first',
      ttl: 60_000,
      providerId: 'browser-cache-api',
      runtimeEnvironment: 'web',
      environmentSupported: true,
    }],
    caches: [
      {
        name: 'Test Cache 1',
        size: 1024 * 1024 * 50,
        maxSize: 1024 * 1024 * 200,
        entries: 300,
        maxEntries: 1000,
        hits: 500,
        misses: 100,
        hitRate: 0.833,
      },
      {
        name: 'Test Cache 2',
        size: 1024 * 1024 * 50,
        maxSize: 1024 * 1024 * 100,
        entries: 200,
        hits: 300,
        misses: 100,
        hitRate: 0.75,
        errors: 5,
      },
    ],
  });

  it('should format stats as string', () => {
    const result = formatCacheStats(mockStats);
    
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should include total size', () => {
    const result = formatCacheStats(mockStats);
    expect(result).toContain('Total Size');
    expect(result).toContain('MB');
  });

  it('should include total entries', () => {
    const result = formatCacheStats(mockStats);
    expect(result).toContain('Total Entries');
    expect(result).toContain('500');
  });

  it('should include hit rate', () => {
    const result = formatCacheStats(mockStats);
    expect(result).toContain('Hit Rate');
    expect(result).toContain('80');
  });

  it('should include per-cache breakdown', () => {
    const result = formatCacheStats(mockStats);
    expect(result).toContain('Test Cache 1');
    expect(result).toContain('Test Cache 2');
  });

  it('should include errors when present', () => {
    const result = formatCacheStats(mockStats);
    expect(result).toContain('Errors');
    expect(result).toContain('5');
  });

  it('should handle undefined hit rate', () => {
    const statsWithNoHitRate: AggregatedCacheStats = {
      ...mockStats,
      overallHitRate: undefined,
    };
    
    const result = formatCacheStats(statsWithNoHitRate);
    expect(result).toContain('N/A');
  });

  it('should fall back when diagnostics or optional cache fields are missing', () => {
    const result = formatCacheStats({
      ...makeDiagnosticsStats(),
      providerDiagnostics: undefined as never,
      integrationDiagnostics: undefined as never,
      caches: [{
        name: 'Fallback Cache',
        size: 256,
        maxSize: 1024,
        entries: 1,
        hits: 0,
        misses: 0,
        hitRate: undefined,
      }],
    } as AggregatedCacheStats);

    expect(result).toContain('Provider: unavailable');
    expect(result).toContain('Integrations: 0');
    expect(result).toContain('Fallback Cache');
    expect(result).toContain('Entries: 1');
    expect(result).not.toContain('Entries: 1 /');
    expect(result).toContain('Hit Rate: N/A (0 hits, 0 misses)');
  });
});

describe('getCacheStatsSummary', () => {
  it('should return a summary string', () => {
    const stats: AggregatedCacheStats = makeDiagnosticsStats({
      totalSize: 1024 * 1024 * 125,
      totalEntries: 1234,
      totalHits: 870,
      totalMisses: 130,
      overallHitRate: 0.87,
    });
    
    const result = getCacheStatsSummary(stats);
    
    expect(typeof result).toBe('string');
    expect(result).toContain('125');
    expect(result).toContain('MB');
    expect(result).toContain('1234');
    expect(result).toContain('entries');
    expect(result).toContain('87%');
    expect(result).toContain('hit rate');
  });

  it('should handle undefined hit rate', () => {
    const stats: AggregatedCacheStats = makeDiagnosticsStats();
    
    const result = getCacheStatsSummary(stats);
    expect(result).toContain('-');
  });

  it('should format small sizes correctly', () => {
    const stats: AggregatedCacheStats = makeDiagnosticsStats({
      totalSize: 512,
      totalEntries: 5,
      totalHits: 3,
      totalMisses: 2,
      overallHitRate: 0.6,
    });
    
    const result = getCacheStatsSummary(stats);
    expect(result).toContain('B');
  });
});

describe('CacheStatsEntry type', () => {
  it('should accept valid cache stats entry', () => {
    const entry: CacheStatsEntry = {
      name: 'Test Cache',
      size: 1000,
      maxSize: 10000,
      entries: 50,
      maxEntries: 500,
      hits: 100,
      misses: 20,
      hitRate: 0.833,
      errors: 2,
    };
    
    expect(entry.name).toBe('Test Cache');
    expect(entry.hitRate).toBe(0.833);
  });

  it('should accept entry without optional fields', () => {
    const entry: CacheStatsEntry = {
      name: 'Minimal Cache',
      size: 500,
      maxSize: 5000,
      entries: 10,
      hits: 5,
      misses: 5,
      hitRate: 0.5,
    };
    
    expect(entry.maxEntries).toBeUndefined();
    expect(entry.errors).toBeUndefined();
  });
});

describe('collectCacheStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
  });

  it('should collect web cache stats in non-Tauri environment', async () => {
    mockIsTauri.mockReturnValue(false);
    const stats = await collectCacheStats();

    expect(stats.caches.length).toBeGreaterThanOrEqual(1);
    const webCache = stats.caches.find(c => c.name.includes('Web'));
    expect(webCache).toBeDefined();
    expect(webCache!.size).toBe(1024 * 1024);
    expect(webCache!.entries).toBe(3);
    expect(webCache!.hits).toBe(100);
    expect(webCache!.misses).toBe(20);
    expect(webCache!.hitRate).toBe(0.833);
    expect(webCache!.errors).toBe(1);
    expect(stats.providerDiagnostics.providerId).toBe('browser-cache-api');
    expect(stats.integrationDiagnostics.length).toBe(2);
  });

  it('should collect Tauri cache stats in Tauri environment', async () => {
    mockIsTauri.mockReturnValue(true);
    const stats = await collectCacheStats();

    const tauriCache = stats.caches.find(c => c.name.includes('Desktop'));
    expect(tauriCache).toBeDefined();
    expect(tauriCache!.size).toBe(2048 * 1024);
    expect(tauriCache!.entries).toBe(50);
    expect(tauriCache!.hitRate).toBe(0.9);
  });

  it('should collect nighttime calculator cache stats', async () => {
    const stats = await collectCacheStats();

    const astroCache = stats.caches.find(c => c.name.includes('Astronomical'));
    expect(astroCache).toBeDefined();
    expect(astroCache!.entries).toBe(50); // 10+20+15+5
    expect(astroCache!.hits).toBe(220); // 50+80+60+30
    expect(astroCache!.misses).toBe(25); // 5+10+8+2
  });

  it('should aggregate totals correctly', async () => {
    const stats = await collectCacheStats();

    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.totalEntries).toBeGreaterThan(0);
    expect(stats.totalHits).toBeGreaterThan(0);
    expect(stats.totalMisses).toBeGreaterThan(0);
    expect(stats.overallHitRate).toBeDefined();
    expect(stats.lastUpdated).toBeGreaterThan(0);
    expect(stats.providerDiagnostics.available).toBe(true);
  });

  it('should compute overallHitRate as undefined when no hits and misses', async () => {
    (unifiedCache.getCacheStats as jest.Mock).mockReturnValueOnce({
      hits: 0, misses: 0, hitRate: undefined, errors: 0,
    });
    (unifiedCache.getSize as jest.Mock).mockResolvedValueOnce(0);
    (unifiedCache.keys as jest.Mock).mockResolvedValueOnce([]);
    mockGetNighttimeCacheStats.mockReturnValueOnce({
      nighttime: { size: 0, hits: 0, misses: 0 },
      sunPosition: { size: 0, hits: 0, misses: 0 },
      moonPosition: { size: 0, hits: 0, misses: 0 },
      hourAngle: { size: 0, hits: 0, misses: 0 },
    });

    const stats = await collectCacheStats();
    expect(stats.overallHitRate).toBeUndefined();
  });

  it('should handle unified cache error gracefully', async () => {
    (unifiedCache.getCacheStats as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Cache error');
    });

    const stats = await collectCacheStats();
    // Should still return stats (nighttime cache at least)
    expect(stats).toBeDefined();
    expect(stats.caches.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle nighttime cache error gracefully', async () => {
    mockGetNighttimeCacheStats.mockImplementationOnce(() => {
      throw new Error('Nighttime error');
    });

    const stats = await collectCacheStats();
    // Should still return unified cache stats
    expect(stats).toBeDefined();
    expect(stats.caches.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle Tauri API returning nullish max values', async () => {
    mockIsTauri.mockReturnValue(true);
    (unifiedCacheApi.getStats as jest.Mock).mockResolvedValueOnce({
      total_size: 500,
      max_size: 0,
      total_entries: 2,
      max_entries: 0,
      hit_rate: undefined,
    });

    const stats = await collectCacheStats();
    const tauriCache = stats.caches.find(c => c.name.includes('Desktop'));
    expect(tauriCache).toBeDefined();
    expect(tauriCache!.maxSize).toBe(1024 * 1024 * 1024);
    expect(tauriCache!.maxEntries).toBe(10000);
  });
});

describe('cacheStats singleton', () => {
  it('should expose collect, format, and summary methods', () => {
    expect(typeof cacheStats.collect).toBe('function');
    expect(typeof cacheStats.format).toBe('function');
    expect(typeof cacheStats.summary).toBe('function');
  });
});

describe('default export', () => {
  it('should be the same as cacheStats', () => {
    expect(defaultCacheStats).toBe(cacheStats);
  });
});
