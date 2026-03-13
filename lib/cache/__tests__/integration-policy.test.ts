jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

import { isTauri } from '@/lib/storage/platform';
import {
  getCachePolicy,
  getCacheProviderDiagnostics,
  getCacheDiagnosticsSummary,
  getCacheIntegrationDiagnostics,
  listCacheIntegrations,
  listCachePolicies,
  resolveCachePolicy,
} from '../integration-policy';

const mockIsTauri = isTauri as jest.Mock;

describe('cache integration policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    Reflect.deleteProperty(globalThis, 'caches');
  });

  it('exposes named persistent cache policies', () => {
    const policy = getCachePolicy('hips-registry');

    expect(policy.id).toBe('hips-registry');
    expect(policy.mode).toBe('persistent-shared');
    expect(policy.strategy).toBe('network-first');
    expect(policy.ttl).toBeGreaterThan(0);
  });

  it('lists multiple audited cache policies', () => {
    const policies = listCachePolicies();

    expect(policies.length).toBeGreaterThan(3);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-wikimedia')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-nasa-library')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-nasa-photojournal')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-esa-science')).toBe(true);
    expect(policies.some((policy) => policy.mode === 'uncached')).toBe(true);
  });

  it('reports browser cache provider diagnostics when Cache API is available', () => {
    (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;

    const diagnostics = getCacheProviderDiagnostics();

    expect(diagnostics.providerId).toBe('browser-cache-api');
    expect(diagnostics.supportsPersistent).toBe(true);
    expect(diagnostics.supportsCleanup).toBe(false);
  });

  it('reports tauri unified cache provider diagnostics in desktop mode', () => {
    mockIsTauri.mockReturnValue(true);

    const diagnostics = getCacheProviderDiagnostics();

    expect(diagnostics.providerId).toBe('tauri-unified-cache');
    expect(diagnostics.supportsFlush).toBe(true);
    expect(diagnostics.supportsCleanup).toBe(true);
  });

  it('classifies audited integrations by persistent, local-only, and uncached modes', () => {
    (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;

    const diagnostics = getCacheIntegrationDiagnostics();

    const hipsRegistry = diagnostics.find((item) => item.id === 'hips-registry');
    const nighttime = diagnostics.find((item) => item.id === 'nighttime-calculations');
    const issPosition = diagnostics.find((item) => item.id === 'astro-iss-position');

    expect(hipsRegistry?.cacheMode).toBe('persistent-shared');
    expect(hipsRegistry?.status).toBe('active');
    expect(nighttime?.cacheMode).toBe('local-only');
    expect(nighttime?.status).toBe('local-only');
    expect(issPosition?.cacheMode).toBe('uncached');
    expect(issPosition?.status).toBe('uncached-by-design');
  });

  describe('resolveCachePolicy', () => {
    it('returns base policy when no overrides', () => {
      const policy = resolveCachePolicy('hips-registry');
      expect(policy.id).toBe('hips-registry');
      expect(policy.strategy).toBe('network-first');
    });

    it('applies strategy override', () => {
      const policy = resolveCachePolicy('hips-registry', { strategy: 'cache-first' });
      expect(policy.strategy).toBe('cache-first');
      expect(policy.ttl).toBe(getCachePolicy('hips-registry').ttl);
    });

    it('applies ttl override', () => {
      const policy = resolveCachePolicy('satellite-tle', { ttl: 99999 });
      expect(policy.ttl).toBe(99999);
      expect(policy.strategy).toBe('network-first');
    });

    it('applies both overrides', () => {
      const policy = resolveCachePolicy('nighttime-calculations', {
        strategy: 'network-only',
        ttl: 5000,
      });
      expect(policy.strategy).toBe('network-only');
      expect(policy.ttl).toBe(5000);
    });
  });

  describe('listCacheIntegrations', () => {
    it('returns a non-empty array of integrations', () => {
      const integrations = listCacheIntegrations();
      expect(integrations.length).toBeGreaterThan(0);
    });

    it('returns a copy (not the original array)', () => {
      const a = listCacheIntegrations();
      const b = listCacheIntegrations();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it('each integration has a valid policyId', () => {
      const integrations = listCacheIntegrations();
      const policyIds = listCachePolicies().map((p) => p.id);
      for (const integration of integrations) {
        expect(policyIds).toContain(integration.policyId);
      }
    });
  });

  describe('getCacheDiagnosticsSummary', () => {
    it('returns correct total count', () => {
      (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;
      const summary = getCacheDiagnosticsSummary();
      const integrations = listCacheIntegrations();
      expect(summary.total).toBe(integrations.length);
    });

    it('counts sum to total', () => {
      (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;
      const summary = getCacheDiagnosticsSummary();
      expect(summary.persistentShared + summary.localOnly + summary.uncached).toBe(summary.total);
    });

    it('has active integrations when cache API is available', () => {
      (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;
      const summary = getCacheDiagnosticsSummary();
      expect(summary.active).toBeGreaterThan(0);
      expect(summary.degraded).toBe(0);
    });
  });

  describe('degraded status for persistent integrations without Cache API', () => {
    it('reports degraded when no caches API and not Tauri', () => {
      mockIsTauri.mockReturnValue(false);
      Reflect.deleteProperty(globalThis, 'caches');
      const diagnostics = getCacheIntegrationDiagnostics();
      const persistent = diagnostics.filter((d) => d.cacheMode === 'persistent-shared');
      expect(persistent.length).toBeGreaterThan(0);
      persistent.forEach((d) => expect(d.status).toBe('degraded'));
    });

    it('getCacheDiagnosticsSummary counts degraded when cache unavailable', () => {
      mockIsTauri.mockReturnValue(false);
      Reflect.deleteProperty(globalThis, 'caches');
      const summary = getCacheDiagnosticsSummary();
      expect(summary.degraded).toBeGreaterThan(0);
      expect(summary.active).toBe(0);
    });
  });
});
