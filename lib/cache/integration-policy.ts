import type { StarmapDataTier } from '@/lib/core/starmap-data-tier';
import { daysToMs, getStarmapTierPrefetchResources, hoursToMs } from './config';
import { getUnifiedCacheProviderDiagnostics, type CacheStrategy } from '@/lib/offline/unified-cache';
import { isTauri } from '@/lib/storage/platform';

export type CacheIntegrationMode = 'persistent-shared' | 'local-only' | 'uncached';
export type CacheRuntimeEnvironment = 'web' | 'tauri';
export type CacheIntegrationImplementation = 'shared-policy' | 'local-cache' | 'uncached';
export type CacheIntegrationStatus = 'active' | 'degraded' | 'mismatch' | 'local-only' | 'uncached-by-design';
export type CacheCapabilityStatus = 'supported' | 'degraded' | 'unsupported';

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
  owner: string;
  environments: CacheRuntimeEnvironment[];
  implementation: CacheIntegrationImplementation;
  reason?: string;
}

export interface CacheIntegrationDiagnostic extends CacheIntegrationDefinition {
  cacheMode: CacheIntegrationMode;
  status: CacheIntegrationStatus;
  strategy: CacheStrategy;
  ttl: number;
  providerId: ReturnType<typeof getUnifiedCacheProviderDiagnostics>['providerId'];
  runtimeEnvironment: CacheRuntimeEnvironment;
  environmentSupported: boolean;
  statusReason?: string;
}

export interface StarmapTierCacheDiagnostic {
  tier: StarmapDataTier;
  readiness: 'ready' | 'degraded';
  policyIds: CachePolicyId[];
  providerId: ReturnType<typeof getUnifiedCacheProviderDiagnostics>['providerId'];
  runtimeEnvironment: CacheRuntimeEnvironment;
  reason?: string;
}

export interface CacheCapabilityDiagnostics {
  action: 'persistent' | 'clear' | 'cleanup' | 'flush';
  status: CacheCapabilityStatus;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

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
  'horizons-ephemeris': {
    id: 'horizons-ephemeris',
    title: 'JPL Horizons ephemerides',
    description: 'Solar-system body ephemerides from the JPL Horizons API.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: hoursToMs(1),
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
  'ar-optimization-pack': {
    id: 'ar-optimization-pack',
    title: 'AR optimization pack',
    description: 'Signed AR optimization pack cached in local memory and localStorage.',
    mode: 'local-only',
    strategy: 'cache-first',
    ttl: daysToMs(1),
    allowStaleFallback: true,
  },
  'object-info-cache': {
    id: 'object-info-cache',
    title: 'Object info enrichment cache',
    description: 'Service-local LRU cache for enriched object detail payloads.',
    mode: 'local-only',
    strategy: 'cache-first',
    ttl: THIRTY_MINUTES_MS,
    allowStaleFallback: true,
  },
  'starmap-core-bootstrap': {
    id: 'starmap-core-bootstrap',
    title: 'Starmap core bootstrap',
    description: 'Bootstrap-critical engine and startup resources.',
    mode: 'persistent-shared',
    strategy: 'cache-first',
    ttl: daysToMs(30),
    allowStaleFallback: true,
  },
  'starmap-catalog-bootstrap': {
    id: 'starmap-catalog-bootstrap',
    title: 'Starmap catalog bootstrap',
    description: 'Catalog manifests required for minimum-ready rendering.',
    mode: 'persistent-shared',
    strategy: 'cache-first',
    ttl: daysToMs(30),
    allowStaleFallback: true,
  },
  'starmap-survey-manifest': {
    id: 'starmap-survey-manifest',
    title: 'Starmap survey manifests',
    description: 'Survey manifest metadata for richer imagery fallback.',
    mode: 'persistent-shared',
    strategy: 'network-first',
    ttl: daysToMs(7),
    allowStaleFallback: true,
  },
  'starmap-enrichment-cache': {
    id: 'starmap-enrichment-cache',
    title: 'Starmap enrichment metadata',
    description: 'Optional metadata enrichments reused across rendering-adjacent flows.',
    mode: 'local-only',
    strategy: 'cache-first',
    ttl: THIRTY_MINUTES_MS,
    allowStaleFallback: true,
  },
  'online-search-query': {
    id: 'online-search-query',
    title: 'Online search queries',
    description: 'Query-specific catalog search lookups remain uncached by design.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
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
  'object-source-health-check': {
    id: 'object-source-health-check',
    title: 'Object source health checks',
    description: 'Source health probes are uncached and always hit the network.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
    allowStaleFallback: false,
  },
  'map-provider-connectivity-check': {
    id: 'map-provider-connectivity-check',
    title: 'Map provider connectivity checks',
    description: 'Provider connectivity checks are uncached and executed against live endpoints.',
    mode: 'uncached',
    strategy: 'network-only',
    ttl: 0,
    allowStaleFallback: false,
  },
  'network-connectivity-smoke-test': {
    id: 'network-connectivity-smoke-test',
    title: 'Network smoke tests',
    description: 'Connectivity smoke tests stay uncached to reflect current network reachability.',
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
    modulePath: 'lib/services/hips-service.ts',
    policyId: 'hips-registry',
    owner: 'starmap-settings',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'hips-registry-typed',
    title: 'HiPS registry fetches (typed service)',
    modulePath: 'lib/services/hips/service.ts',
    policyId: 'hips-registry',
    owner: 'starmap-core',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'satellite-tle',
    title: 'Satellite TLE sources',
    modulePath: 'lib/services/satellite/data-sources.ts',
    policyId: 'satellite-tle',
    owner: 'satellite-data',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'satellite-tle-events',
    title: 'Satellite TLE event feed',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'satellite-tle',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'satellite-tle-tracker',
    title: 'Satellite tracker feed',
    modulePath: 'lib/services/satellite/celestrak-service.ts',
    policyId: 'satellite-tle',
    owner: 'satellite-tracker',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'daily-knowledge-apod',
    title: 'Daily Knowledge APOD',
    modulePath: 'lib/services/daily-knowledge/source-apod.ts',
    policyId: 'daily-knowledge-apod',
    owner: 'daily-knowledge',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'daily-knowledge-wikimedia',
    title: 'Daily Knowledge Wikimedia',
    modulePath: 'lib/services/daily-knowledge/source-wikimedia.ts',
    policyId: 'daily-knowledge-wikimedia',
    owner: 'daily-knowledge',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'daily-knowledge-nasa-library',
    title: 'Daily Knowledge NASA image library',
    modulePath: 'lib/services/daily-knowledge/source-nasa-image-library.ts',
    policyId: 'daily-knowledge-nasa-library',
    owner: 'daily-knowledge',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'daily-knowledge-nasa-photojournal',
    title: 'Daily Knowledge NASA photojournal',
    modulePath: 'lib/services/daily-knowledge/source-nasa-photojournal.ts',
    policyId: 'daily-knowledge-nasa-photojournal',
    owner: 'daily-knowledge',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'daily-knowledge-esa-science',
    title: 'Daily Knowledge ESA science',
    modulePath: 'lib/services/daily-knowledge/source-esa-science.ts',
    policyId: 'daily-knowledge-esa-science',
    owner: 'daily-knowledge',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'horizons-ephemeris',
    title: 'JPL Horizons ephemerides',
    modulePath: 'lib/services/horizons/service.ts',
    policyId: 'horizons-ephemeris',
    owner: 'object-info',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'astro-gsfc-catalog',
    title: 'GSFC decade catalogs',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-gsfc-catalog',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'astro-usno-phases',
    title: 'USNO moon phases',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-usno-phases',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'astro-mpc-comets',
    title: 'MPC comet data',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-mpc-comets',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'starmap-core-bootstrap-prefetch',
    title: 'Starmap core bootstrap prefetch',
    modulePath: 'lib/hooks/use-cache-init.ts',
    policyId: 'starmap-core-bootstrap',
    owner: 'starmap-bootstrap',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'starmap-catalog-bootstrap-prefetch',
    title: 'Starmap catalog bootstrap prefetch',
    modulePath: 'lib/hooks/use-cache-init.ts',
    policyId: 'starmap-catalog-bootstrap',
    owner: 'starmap-bootstrap',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'starmap-survey-bootstrap-prefetch',
    title: 'Starmap survey manifest prefetch',
    modulePath: 'lib/hooks/use-cache-init.ts',
    policyId: 'starmap-survey-manifest',
    owner: 'starmap-bootstrap',
    environments: ['web', 'tauri'],
    implementation: 'shared-policy',
  },
  {
    id: 'starmap-enrichment-runtime-cache',
    title: 'Starmap enrichment runtime cache',
    modulePath: 'lib/hooks/use-object-search.ts',
    policyId: 'starmap-enrichment-cache',
    owner: 'starmap-search',
    environments: ['web', 'tauri'],
    implementation: 'local-cache',
    reason: 'Search enrichment keeps short-lived in-memory fallback entries for quick repeated lookups.',
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
  },
  {
    id: 'geocoding-search',
    title: 'Geocoding search cache',
    modulePath: 'lib/services/geocoding-service.ts',
    policyId: 'geocoding-search',
    owner: 'map-location',
    environments: ['web', 'tauri'],
    implementation: 'local-cache',
    reason: 'Service-local geocoder cache is tuned for short-lived repeated lookups.',
  },
  {
    id: 'ar-optimization-pack',
    title: 'AR optimization pack',
    modulePath: 'lib/services/ar-optimization-pack-service.ts',
    policyId: 'ar-optimization-pack',
    owner: 'ar-runtime',
    environments: ['web', 'tauri'],
    implementation: 'local-cache',
    reason: 'Signed optimization packs are cached in localStorage plus memory for frontend-only reuse.',
  },
  {
    id: 'object-info-cache',
    title: 'Object info enrichment cache',
    modulePath: 'lib/services/object-info-service.ts',
    policyId: 'object-info-cache',
    owner: 'object-info',
    environments: ['web', 'tauri'],
    implementation: 'local-cache',
    reason: 'Merged object detail payloads are kept in a service-local LRU cache.',
  },
  {
    id: 'object-source-health-check',
    title: 'Object source health checks',
    modulePath: 'lib/services/object-info-config.ts',
    policyId: 'object-source-health-check',
    owner: 'object-info',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Health probes must reflect the current provider status and intentionally bypass cached responses.',
  },
  {
    id: 'map-provider-connectivity-check',
    title: 'Map provider connectivity checks',
    modulePath: 'lib/services/map-providers/base-map-provider.ts',
    policyId: 'map-provider-connectivity-check',
    owner: 'map-location',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Connectivity checks must evaluate live endpoint reachability.',
  },
  {
    id: 'network-connectivity-smoke-test',
    title: 'Network connectivity smoke tests',
    modulePath: 'lib/services/connectivity-checker.ts',
    policyId: 'network-connectivity-smoke-test',
    owner: 'network-health',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Smoke tests are intentionally uncached to avoid stale network-health signals.',
  },
  {
    id: 'online-search-query',
    title: 'Online catalog search queries',
    modulePath: 'lib/services/online-search-service.ts',
    policyId: 'online-search-query',
    owner: 'online-search',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Provider searches and availability probes must remain query-specific and fresh.',
  },
  {
    id: 'astro-satellite-passes',
    title: 'Satellite passes',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-satellite-passes',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Observer-specific pass predictions cannot be safely shared across users or locations.',
  },
  {
    id: 'astro-iss-position',
    title: 'ISS realtime position',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-iss-position',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Realtime position lookups are intentionally kept fresh on every request.',
  },
  {
    id: 'astro-body-events',
    title: 'Astronomy API body events',
    modulePath: 'lib/services/astro-data-sources.ts',
    policyId: 'astro-body-events',
    owner: 'astro-events',
    environments: ['web', 'tauri'],
    implementation: 'uncached',
    reason: 'Observer-specific body-event queries remain network-only by design.',
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

function getRuntimeEnvironment(): CacheRuntimeEnvironment {
  return isTauri() ? 'tauri' : 'web';
}

function isImplementationMismatch(
  integration: CacheIntegrationDefinition,
  policy: CachePolicyDefinition
): boolean {
  switch (policy.mode) {
    case 'persistent-shared':
      return integration.implementation !== 'shared-policy';
    case 'local-only':
      return integration.implementation !== 'local-cache';
    case 'uncached':
    default:
      return integration.implementation !== 'uncached';
  }
}

export function getCacheIntegrationDiagnostics(): CacheIntegrationDiagnostic[] {
  const provider = getCacheProviderDiagnostics();
  const runtimeEnvironment = getRuntimeEnvironment();

  return CACHE_INTEGRATIONS.map((integration) => {
    const policy = getCachePolicy(integration.policyId);
    const environmentSupported = integration.environments.includes(runtimeEnvironment);
    const implementationMismatch = isImplementationMismatch(integration, policy);
    let status: CacheIntegrationStatus;
    let statusReason: string | undefined;

    if (!environmentSupported) {
      status = 'mismatch';
      statusReason = `Declared environments: ${integration.environments.join(', ')}`;
    } else if (implementationMismatch) {
      status = 'mismatch';
      statusReason = 'Declared cache mode does not match the implementation route.';
    } else {
      switch (policy.mode) {
        case 'persistent-shared':
          status = provider.supportsPersistent ? 'active' : 'degraded';
          statusReason = provider.supportsPersistent
            ? undefined
            : 'Persistent cache provider is unavailable in the current runtime.';
          break;
        case 'local-only':
          status = 'local-only';
          statusReason = integration.reason;
          break;
        case 'uncached':
        default:
          status = 'uncached-by-design';
          statusReason = integration.reason;
          break;
      }
    }

    return {
      ...integration,
      cacheMode: policy.mode,
      status,
      strategy: policy.strategy,
      ttl: policy.ttl,
      providerId: provider.providerId,
      runtimeEnvironment,
      environmentSupported,
      statusReason,
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
    mismatch: integrations.filter((item) => item.status === 'mismatch').length,
  };
}

const STARMAP_TIER_CACHE_POLICY_IDS: Record<StarmapDataTier, CachePolicyId[]> = {
  core: ['starmap-core-bootstrap'],
  catalog: ['starmap-catalog-bootstrap'],
  survey: ['starmap-survey-manifest'],
  enrichment: ['starmap-enrichment-cache'],
};

const STARMAP_PREFETCH_POLICY_BINDINGS: ReadonlyArray<{ resourcePath: string; policyId: CachePolicyId }> = [
  ...getStarmapTierPrefetchResources('core').map((resourcePath) => ({
    resourcePath,
    policyId: STARMAP_TIER_CACHE_POLICY_IDS.core[0],
  })),
  ...getStarmapTierPrefetchResources('catalog').map((resourcePath) => ({
    resourcePath,
    policyId: STARMAP_TIER_CACHE_POLICY_IDS.catalog[0],
  })),
  ...getStarmapTierPrefetchResources('survey').map((resourcePath) => ({
    resourcePath,
    policyId: STARMAP_TIER_CACHE_POLICY_IDS.survey[0],
  })),
];

function normalizeResourcePath(resourceUrl: string): string {
  const withoutOrigin = resourceUrl.replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split('?')[0]?.split('#')[0] ?? withoutOrigin;
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

function toCapabilityStatus(supported: boolean, providerAvailable: boolean): CacheCapabilityStatus {
  if (supported) return 'supported';
  return providerAvailable ? 'degraded' : 'unsupported';
}

export function resolveCachePolicyForPrefetchResource(resourceUrl: string): CachePolicyId | null {
  const normalized = normalizeResourcePath(resourceUrl);
  const match = STARMAP_PREFETCH_POLICY_BINDINGS.find((binding) => binding.resourcePath === normalized);
  return match?.policyId ?? null;
}

export function getCacheCapabilityDiagnostics(): CacheCapabilityDiagnostics[] {
  const provider = getCacheProviderDiagnostics();

  return [
    {
      action: 'persistent',
      status: toCapabilityStatus(provider.supportsPersistent, provider.available),
    },
    {
      action: 'clear',
      status: toCapabilityStatus(provider.supportsClear, provider.available),
    },
    {
      action: 'cleanup',
      status: toCapabilityStatus(provider.supportsCleanup, provider.available),
    },
    {
      action: 'flush',
      status: toCapabilityStatus(provider.supportsFlush, provider.available),
    },
  ];
}

export function getStarmapTierCacheDiagnostics(): Record<StarmapDataTier, StarmapTierCacheDiagnostic> {
  const provider = getCacheProviderDiagnostics();
  const runtimeEnvironment = getRuntimeEnvironment();
  const persistentReady = provider.supportsPersistent;

  return {
    core: {
      tier: 'core',
      readiness: persistentReady ? 'ready' : 'degraded',
      policyIds: STARMAP_TIER_CACHE_POLICY_IDS.core,
      providerId: provider.providerId,
      runtimeEnvironment,
      reason: persistentReady ? undefined : 'Persistent cache provider is unavailable for core bootstrap reuse.',
    },
    catalog: {
      tier: 'catalog',
      readiness: persistentReady ? 'ready' : 'degraded',
      policyIds: STARMAP_TIER_CACHE_POLICY_IDS.catalog,
      providerId: provider.providerId,
      runtimeEnvironment,
      reason: persistentReady ? undefined : 'Persistent cache provider is unavailable for catalog bootstrap reuse.',
    },
    survey: {
      tier: 'survey',
      readiness: persistentReady ? 'ready' : 'degraded',
      policyIds: STARMAP_TIER_CACHE_POLICY_IDS.survey,
      providerId: provider.providerId,
      runtimeEnvironment,
      reason: persistentReady ? undefined : 'Persistent cache provider is unavailable for survey manifest reuse.',
    },
    enrichment: {
      tier: 'enrichment',
      readiness: 'ready',
      policyIds: STARMAP_TIER_CACHE_POLICY_IDS.enrichment,
      providerId: provider.providerId,
      runtimeEnvironment,
      reason: 'Enrichment metadata falls back to local-only cache behavior.',
    },
  };
}
