import { daysToMs, hoursToMs } from './config';
import { getUnifiedCacheProviderDiagnostics, type CacheStrategy } from '@/lib/offline/unified-cache';

export type CacheIntegrationMode = 'persistent-shared' | 'local-only' | 'uncached';
export type CacheIntegrationStatus = 'active' | 'degraded' | 'local-only' | 'uncached-by-design';

export interface CachePolicyDefinition {
  id: string;
  title: string;
  description: string;
  mode: CacheIntegrationMode;
  strategy: CacheStrategy;
  ttl: number;
  allowStaleFallback: boolean;
}

export interface CacheIntegrationDefinition {
  id: string;
  title: string;
  modulePath: string;
  policyId: CachePolicyId;
}

export interface CacheIntegrationDiagnostic extends CacheIntegrationDefinition {
  cacheMode: CacheIntegrationMode;
  status: CacheIntegrationStatus;
  strategy: CacheStrategy;
  ttl: number;
  providerId: ReturnType<typeof getUnifiedCacheProviderDiagnostics>['providerId'];
}

const CACHE_POLICIES = {
  'hips-registry': {
    id: 'hips-registry',
    title: 'HiPS registry',
    description: 'Remote HiPS survey registry loaded from Aladin/CDS.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(1),
    allowStaleFallback: true,
  },
  'satellite-tle': {
    id: 'satellite-tle',
    title: 'Satellite TLE catalogs',
    description: 'Read-only orbital element feeds fetched from CelesTrak.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: hoursToMs(12),
    allowStaleFallback: true,
  },
  'astro-gsfc-catalog': {
    id: 'astro-gsfc-catalog',
    title: 'GSFC eclipse catalogs',
    description: 'Stable NASA GSFC eclipse catalog pages.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(1),
    allowStaleFallback: true,
  },
  'astro-usno-phases': {
    id: 'astro-usno-phases',
    title: 'USNO moon phases',
    description: 'USNO moon phase API responses by year.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(7),
    allowStaleFallback: true,
  },
  'astro-mpc-comets': {
    id: 'astro-mpc-comets',
    title: 'MPC comet ephemerides',
    description: 'Minor Planet Center comet catalog downloads.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(1),
    allowStaleFallback: true,
  },
  'daily-knowledge-apod': {
    id: 'daily-knowledge-apod',
    title: 'NASA APOD',
    description: 'Astronomy Picture of the Day API responses.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(1),
    allowStaleFallback: true,
  },
  'daily-knowledge-wikimedia': {
    id: 'daily-knowledge-wikimedia',
    title: 'Wikimedia knowledge lookups',
    description: 'Daily knowledge lookups against Wikimedia REST APIs.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(7),
    allowStaleFallback: true,
  },
  'daily-knowledge-nasa-library': {
    id: 'daily-knowledge-nasa-library',
    title: 'NASA image library',
    description: 'NASA Image and Video Library astronomy searches.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: hoursToMs(12),
    allowStaleFallback: true,
  },
  'daily-knowledge-nasa-photojournal': {
    id: 'daily-knowledge-nasa-photojournal',
    title: 'NASA photojournal feed',
    description: 'NASA Science Photojournal RSS feed entries.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: hoursToMs(6),
    allowStaleFallback: true,
  },
  'daily-knowledge-esa-science': {
    id: 'daily-knowledge-esa-science',
    title: 'ESA space science feed',
    description: 'ESA Space Science RSS feed entries.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: hoursToMs(6),
    allowStaleFallback: true,
  },
  'nighttime-calculations': {
    id: 'nighttime-calculations',
    title: 'Nighttime calculations',
    description: 'In-memory astronomy calculation caches.',
    mode: 'local-only',
    strategy: 'cache-first',
    ttl: hoursToMs(1),
    allowStaleFallback: false,
  },
  'geocoding-search': {
    id: 'geocoding-search',
    title: 'Geocoding search',
    description: 'Service-local geocoding LRU cache.',
    mode: 'local-only',
    strategy: 'cache-first',
    ttl: hoursToMs(24),
    allowStaleFallback: false,
  },
  'astro-satellite-passes': {
    id: 'astro-satellite-passes',
    title: 'Satellite passes',
    description: 'Observer-specific pass predictions remain uncached by design.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
    allowStaleFallback: false,
  },
  'astro-iss-position': {
    id: 'astro-iss-position',
    title: 'ISS realtime position',
    description: 'Realtime location endpoint remains uncached by design.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
    allowStaleFallback: false,
  },
  'astro-body-events': {
    id: 'astro-body-events',
    title: 'Astronomy API body events',
    description: 'Observer-specific body-event lookups remain uncached by design.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
    allowStaleFallback: false,
  },
} as const satisfies Record<string, CachePolicyDefinition>;

export type CachePolicyId = keyof typeof CACHE_POLICIES;

const CACHE_INTEGRATIONS: CacheIntegrationDefinition[] = [
  {
    id: 'hips-registry',
    title: 'HiPS registry fetches',
    modulePath: 'lib/services/hips/service.ts',
    policyId: 'hips-registry',
  },
  {
    id: 'satellite-tle',
    title: 'Satellite TLE sources',
    modulePath: 'lib/services/satellite/data-sources.ts',
    policyId: 'satellite-tle',
  },
  {
    id: 'daily-knowledge-apod',
    title: 'Daily Knowledge APOD',
    modulePath: 'lib/services/daily-knowledge/source-apod.ts',
    policyId: 'daily-knowledge-apod',
  },
  {
    id: 'daily-knowledge-wikimedia',
    title: 'Daily Knowledge Wikimedia',
    modulePath: 'lib/services/daily-knowledge/source-wikimedia.ts',
    policyId: 'daily-knowledge-wikimedia',
  },
  {
    id: 'daily-knowledge-nasa-library',
    title: 'Daily Knowledge NASA image library',
    modulePath: 'lib/services/daily-knowledge/source-nasa-image-library.ts',
    policyId: 'daily-knowledge-nasa-library',
  },
  {
    id: 'daily-knowledge-nasa-photojournal',
    title: 'Daily Knowledge NASA photojournal',
    modulePath: 'lib/services/daily-knowledge/source-nasa-photojournal.ts',
    policyId: 'daily-knowledge-nasa-photojournal',
  },
  {
    id: 'daily-knowledge-esa-science',
    title: 'Daily Knowledge ESA science',
    modulePath: 'lib/services/daily-knowledge/source-esa-science.ts',
    policyId: 'daily-knowledge-esa-science',
  },
  {
    id: 'astro-gsfc-catalog',
    title: 'GSFC decade catalogs',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-gsfc-catalog',
  },
  {
    id: 'astro-usno-phases',
    title: 'USNO moon phases',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-usno-phases',
  },
  {
    id: 'astro-mpc-comets',
    title: 'MPC comet data',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-mpc-comets',
  },
  {
    id: 'nighttime-calculations',
    title: 'Nighttime calculations',
    modulePath: 'lib/catalogs/nighttime-calculator.ts',
    policyId: 'nighttime-calculations',
  },
  {
    id: 'geocoding-search',
    title: 'Geocoding search cache',
    modulePath: 'lib/services/geocoding-service.ts',
    policyId: 'geocoding-search',
  },
  {
    id: 'astro-satellite-passes',
    title: 'Satellite passes',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-satellite-passes',
  },
  {
    id: 'astro-iss-position',
    title: 'ISS realtime position',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-iss-position',
  },
  {
    id: 'astro-body-events',
    title: 'Astronomy API body events',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-body-events',
  },
];

export function getCachePolicy(policyId: CachePolicyId): CachePolicyDefinition {
  return CACHE_POLICIES[policyId];
}

export function listCachePolicies(): CachePolicyDefinition[] {
  return Object.values(CACHE_POLICIES);
}

export function listCacheIntegrations(): CacheIntegrationDefinition[] {
  return [...CACHE_INTEGRATIONS];
}

export function resolveCachePolicy(
  policyId: CachePolicyId,
  overrides: Partial<Pick<CachePolicyDefinition, 'strategy' | 'ttl'>> = {}
): CachePolicyDefinition {
  const basePolicy = getCachePolicy(policyId);

  return {
    ...basePolicy,
    strategy: overrides.strategy ?? basePolicy.strategy,
    ttl: overrides.ttl ?? basePolicy.ttl,
  };
}

export function getCacheProviderDiagnostics() {
  return getUnifiedCacheProviderDiagnostics();
}

export function getCacheIntegrationDiagnostics(): CacheIntegrationDiagnostic[] {
  const provider = getCacheProviderDiagnostics();

  return CACHE_INTEGRATIONS.map((integration) => {
    const policy = getCachePolicy(integration.policyId);
    let status: CacheIntegrationStatus;

    switch (policy.mode) {
      case 'persistent-shared':
        status = provider.supportsPersistent ? 'active' : 'degraded';
        break;
      case 'local-only':
        status = 'local-only';
        break;
      case 'uncached':
      default:
        status = 'uncached-by-design';
        break;
    }

    return {
      ...integration,
      cacheMode: policy.mode,
      status,
      strategy: policy.strategy,
      ttl: policy.ttl,
      providerId: provider.providerId,
    };
  });
}

export function getCacheDiagnosticsSummary() {
  const integrations = getCacheIntegrationDiagnostics();

  return {
    total: integrations.length,
    persistentShared: integrations.filter((item) => item.cacheMode === 'persistent-shared').length,
    localOnly: integrations.filter((item) => item.cacheMode === 'local-only').length,
    uncached: integrations.filter((item) => item.cacheMode === 'uncached').length,
    active: integrations.filter((item) => item.status === 'active').length,
    degraded: integrations.filter((item) => item.status === 'degraded').length,
  };
}
