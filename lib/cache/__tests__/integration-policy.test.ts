import fs from 'node:fs';
import path from 'node:path';

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

import { isTauri } from '@/lib/storage/platform';
import {
  getCacheCapabilityDiagnostics,
  getCachePolicy,
  getCacheProviderDiagnostics,
  getCacheDiagnosticsSummary,
  getCacheIntegrationDiagnostics,
  getStarmapTierCacheDiagnostics,
  listCacheIntegrations,
  listCachePolicies,
  resolveCachePolicyForPrefetchResource,
  resolveCachePolicy,
} from '../integration-policy';

const mockIsTauri = isTauri as jest.Mock;
const repoRoot = path.resolve(__dirname, '../../..');

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
    expect(policies.some((policy) => policy.id === 'ar-optimization-pack')).toBe(true);
    expect(policies.some((policy) => policy.id === 'object-info-cache')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-wikimedia')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-nasa-library')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-nasa-photojournal')).toBe(true);
    expect(policies.some((policy) => policy.id === 'daily-knowledge-esa-science')).toBe(true);
    expect(policies.some((policy) => policy.id === 'object-source-health-check')).toBe(true);
    expect(policies.some((policy) => policy.mode === 'uncached')).toBe(true);
  });

  it('reports browser cache provider diagnostics when Cache API is available', () => {
    (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;

    const diagnostics = getCacheProviderDiagnostics();

    expect(diagnostics.providerId).toBe('browser-cache-api');
    expect(diagnostics.supportsPersistent).toBe(true);
    expect(diagnostics.supportsCleanup).toBe(true);
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
    const sourceHealthCheck = diagnostics.find((item) => item.id === 'object-source-health-check');

    expect(hipsRegistry?.cacheMode).toBe('persistent-shared');
    expect(hipsRegistry?.status).toBe('active');
    expect(hipsRegistry?.runtimeEnvironment).toBe('web');
    expect(hipsRegistry?.environmentSupported).toBe(true);
    expect(nighttime?.cacheMode).toBe('local-only');
    expect(nighttime?.status).toBe('local-only');
    expect(issPosition?.cacheMode).toBe('uncached');
    expect(issPosition?.status).toBe('uncached-by-design');
    expect(issPosition?.statusReason).toContain('Realtime position');
    expect(sourceHealthCheck?.status).toBe('uncached-by-design');
    expect(sourceHealthCheck?.statusReason).toContain('Health probes');
  });

  it('derives starmap tier cache diagnostics for the active runtime', () => {
    (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;

    const diagnostics = getStarmapTierCacheDiagnostics();

    expect(diagnostics.core.readiness).toBe('ready');
    expect(diagnostics.catalog.readiness).toBe('ready');
    expect(diagnostics.survey.readiness).toBe('ready');
    expect(diagnostics.enrichment.readiness).toBe('ready');
    expect(diagnostics.survey.policyIds.length).toBeGreaterThan(0);
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

  describe('resolveCachePolicyForPrefetchResource', () => {
    it('maps known starmap prefetch resources to declared policies', () => {
      expect(resolveCachePolicyForPrefetchResource('/stellarium-js/stellarium-web-engine.js')).toBe('starmap-core-bootstrap');
      expect(resolveCachePolicyForPrefetchResource('https://example.com/stellarium-data/stars/info.json')).toBe('starmap-catalog-bootstrap');
      expect(resolveCachePolicyForPrefetchResource('/stellarium-data/surveys/dss/info.json?ts=1')).toBe('starmap-survey-manifest');
    });

    it('returns null for resources without declared tier policy', () => {
      expect(resolveCachePolicyForPrefetchResource('/not-prefetched/resource.json')).toBeNull();
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

    it('every declared policy has at least one integration mapping', () => {
      const integrations = listCacheIntegrations();
      const usedPolicyIds = new Set<string>(integrations.map((item) => item.policyId));
      for (const policy of listCachePolicies()) {
        expect(usedPolicyIds.has(policy.id)).toBe(true);
      }
    });

    it('tracks uncached runtime probe integrations with explicit reasons', () => {
      const integrations = listCacheIntegrations();
      const probeIds = [
        'object-source-health-check',
        'map-provider-connectivity-check',
        'network-connectivity-smoke-test',
      ];

      for (const probeId of probeIds) {
        const probe = integrations.find((item) => item.id === probeId);
        expect(probe?.implementation).toBe('uncached');
        expect(probe?.reason).toBeTruthy();
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
      expect(summary.mismatch).toBe(0);
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
      expect(summary.mismatch).toBe(0);
    });

    it('marks render-relevant tiers degraded when persistent cache support is unavailable', () => {
      mockIsTauri.mockReturnValue(false);
      Reflect.deleteProperty(globalThis, 'caches');

      const diagnostics = getStarmapTierCacheDiagnostics();

      expect(diagnostics.core.readiness).toBe('degraded');
      expect(diagnostics.catalog.readiness).toBe('degraded');
      expect(diagnostics.survey.readiness).toBe('degraded');
      expect(diagnostics.enrichment.readiness).toBe('ready');
    });
  });

  describe('cache policy usage consistency', () => {
    const policyLiteralPattern = /cachePolicy\s*:\s*'([^']+)'/g;
    const auditedServiceFiles = [
      'lib/services/http-fetch.ts',
      'lib/services/hips-service.ts',
      'lib/services/hips/service.ts',
      'lib/services/satellite/celestrak-service.ts',
      'lib/services/satellite/data-sources.ts',
      'lib/services/astro-data-sources.ts',
      'lib/services/daily-knowledge/source-apod.ts',
      'lib/services/daily-knowledge/source-wikimedia.ts',
      'lib/services/daily-knowledge/source-nasa-image-library.ts',
      'lib/services/daily-knowledge/source-nasa-photojournal.ts',
      'lib/services/daily-knowledge/source-esa-science.ts',
      'lib/hooks/use-cache-init.ts',
    ];

    it('all literal cachePolicy usages resolve to known policy ids', () => {
      const knownPolicyIds = new Set(listCachePolicies().map((policy) => policy.id));
      const usedPolicyIds = new Set<string>();

      for (const relativePath of auditedServiceFiles) {
        const filePath = path.join(repoRoot, relativePath);
        const source = fs.readFileSync(filePath, 'utf8');
        for (const match of source.matchAll(policyLiteralPattern)) {
          const policyId = match[1];
          if (policyId) {
            usedPolicyIds.add(policyId);
          }
        }
      }

      for (const policyId of usedPolicyIds) {
        expect(knownPolicyIds.has(policyId)).toBe(true);
      }
    });

    it('all literal cachePolicy usages are represented in integration inventory', () => {
      const inventoryPolicyIds = new Set<string>(listCacheIntegrations().map((integration) => integration.policyId));

      for (const relativePath of auditedServiceFiles) {
        const filePath = path.join(repoRoot, relativePath);
        const source = fs.readFileSync(filePath, 'utf8');
        for (const match of source.matchAll(policyLiteralPattern)) {
          const policyId = match[1];
          if (policyId) {
            expect(inventoryPolicyIds.has(policyId)).toBe(true);
          }
        }
      }
    });
  });

  describe('cache capability diagnostics', () => {
    it('reports capability statuses for current runtime', () => {
      (globalThis as typeof globalThis & { caches?: CacheStorage | undefined }).caches = {} as CacheStorage;
      const capabilities = getCacheCapabilityDiagnostics();

      expect(capabilities.find((item) => item.action === 'persistent')?.status).toBe('supported');
      expect(capabilities.find((item) => item.action === 'cleanup')?.status).toBe('supported');
      expect(capabilities.find((item) => item.action === 'flush')?.status).toBe('degraded');
    });
  });
});
