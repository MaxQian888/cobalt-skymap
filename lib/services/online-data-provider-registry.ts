import {
  sortStarmapTierCandidates,
  type StarmapDataTier,
  type StarmapSourceFallbackRole,
  type StarmapTierCandidate,
} from '@/lib/core/starmap-data-tier';

export type SearchProviderId =
  | 'sesame'
  | 'simbad'
  | 'vizier'
  | 'ned'
  | 'mpc'
  | 'sbdb'
  | 'local';

export type ObjectInfoDataProviderId =
  | 'simbad'
  | 'wikipedia'
  | 'vizier'
  | 'ned'
  | 'sbdb'
  | 'dss'
  | 'nasa-apod'
  | 'local'
  | 'stellarium';

export type SearchQueryKind = 'name' | 'coordinates' | 'minor';

export type ProviderCapability =
  | 'name_search'
  | 'coordinate_search'
  | 'small_body_search'
  | 'metadata_enrichment'
  | 'description_enrichment'
  | 'image_enrichment'
  | 'survey_enrichment';

export type ObjectInfoTargetClass =
  | 'deep-sky'
  | 'star'
  | 'planetary'
  | 'small-body'
  | 'extragalactic'
  | 'generic';

export type ObjectInfoResponseMode =
  | 'json'
  | 'xml'
  | 'votable'
  | 'hips2fits'
  | 'html'
  | 'local';

export type ObjectInfoAuthorityLevel = 'authoritative' | 'reference' | 'fallback-local';
export type ObjectInfoHealthCheckStrategy = 'query' | 'lookup' | 'cutout' | 'none' | 'disabled';

export type RenderProviderTier = Exclude<StarmapDataTier, 'core'>;
export type RenderProviderWorkflow = 'search' | 'objectInfo' | 'render';

interface SearchProviderConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  queryKinds: SearchQueryKind[];
  availabilityCheckPath?: string;
}

interface ObjectInfoProviderConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  apiEndpoint?: string;
  targetClasses: readonly ObjectInfoTargetClass[];
  responseMode: ObjectInfoResponseMode;
  authorityLevel: ObjectInfoAuthorityLevel;
  healthCheck: {
    strategy: ObjectInfoHealthCheckStrategy;
    probePath?: string;
  };
}

interface RenderProviderConfig {
  enabled: boolean;
  tier: RenderProviderTier;
  priority: number;
  fallbackRole: StarmapSourceFallbackRole;
  workflows: RenderProviderWorkflow[];
}

export interface OnlineDataProviderDefinition {
  id: SearchProviderId | ObjectInfoDataProviderId;
  name: string;
  description: string;
  baseUrl?: string;
  endpoint?: string;
  tapEndpoint?: string;
  identifierEndpoint?: string;
  observationEndpoint?: string;
  search?: SearchProviderConfig;
  objectInfo?: ObjectInfoProviderConfig;
  render?: RenderProviderConfig;
  capabilities: ProviderCapability[];
}

const SEARCH_PROVIDER_PRIORITY: Record<SearchQueryKind, SearchProviderId[]> = {
  name: ['sesame', 'simbad', 'vizier', 'ned'],
  coordinates: ['simbad'],
  minor: ['sbdb', 'mpc', 'sesame', 'simbad'],
};

export const ONLINE_DATA_PROVIDER_REGISTRY: Record<string, OnlineDataProviderDefinition> = {
  sesame: {
    id: 'sesame',
    name: 'Sesame',
    description: 'CDS name resolver (SIMBAD + NED + VizieR)',
    baseUrl: 'https://cds.unistra.fr',
    endpoint: '/cgi-bin/Sesame',
    search: {
      enabled: true,
      priority: 0,
      timeout: 10000,
      queryKinds: ['name', 'minor'],
      availabilityCheckPath: '/cgi-bin/Sesame/-ox/SNV?M31',
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 3,
      fallbackRole: 'supplemental',
      workflows: ['search', 'render'],
    },
    capabilities: ['name_search'],
  },
  simbad: {
    id: 'simbad',
    name: 'SIMBAD',
    description: 'CDS astronomical database with rich object metadata',
    baseUrl: 'https://simbad.cds.unistra.fr',
    tapEndpoint: '/simbad/sim-tap/sync',
    search: {
      enabled: true,
      priority: 1,
      timeout: 15000,
      queryKinds: ['name', 'coordinates', 'minor'],
      availabilityCheckPath: '/simbad/',
    },
    objectInfo: {
      enabled: true,
      priority: 1,
      timeout: 5000,
      apiEndpoint: '/simbad/sim-tap/sync',
      targetClasses: ['deep-sky', 'star', 'extragalactic', 'generic'],
      responseMode: 'json',
      authorityLevel: 'authoritative',
      healthCheck: {
        strategy: 'query',
        probePath: '/simbad/sim-tap/sync',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 0,
      fallbackRole: 'primary',
      workflows: ['search', 'objectInfo', 'render'],
    },
    capabilities: ['name_search', 'coordinate_search', 'metadata_enrichment'],
  },
  sbdb: {
    id: 'sbdb',
    name: 'JPL SBDB',
    description: 'JPL Small-Body Database for comet and asteroid metadata',
    baseUrl: 'https://ssd-api.jpl.nasa.gov',
    endpoint: '/sbdb.api',
    search: {
      enabled: true,
      priority: 2,
      timeout: 12000,
      queryKinds: ['minor'],
      availabilityCheckPath: '/sbdb.api?sstr=1P&phys-par=1',
    },
    objectInfo: {
      enabled: true,
      priority: 3,
      timeout: 5000,
      apiEndpoint: '/sbdb.api',
      targetClasses: ['small-body'],
      responseMode: 'json',
      authorityLevel: 'authoritative',
      healthCheck: {
        strategy: 'query',
        probePath: '/sbdb.api?sstr=1P&phys-par=1',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 2,
      fallbackRole: 'fallback',
      workflows: ['search', 'objectInfo', 'render'],
    },
    capabilities: ['small_body_search', 'metadata_enrichment'],
  },
  mpc: {
    id: 'mpc',
    name: 'MPC',
    description: 'Minor Planet Center designation resolver',
    baseUrl: 'https://data.minorplanetcenter.net',
    identifierEndpoint: '/api/query-identifier',
    observationEndpoint: '/api/get-obs',
    search: {
      enabled: true,
      priority: 3,
      timeout: 15000,
      queryKinds: ['minor'],
      availabilityCheckPath: '/api/query-identifier',
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 4,
      fallbackRole: 'supplemental',
      workflows: ['search'],
    },
    capabilities: ['small_body_search'],
  },
  vizier: {
    id: 'vizier',
    name: 'VizieR',
    description: 'CDS catalog library with extensive survey catalogs',
    baseUrl: 'https://vizier.cds.unistra.fr',
    tapEndpoint: '/viz-bin/votable',
    search: {
      enabled: false,
      priority: 4,
      timeout: 20000,
      queryKinds: ['name'],
      availabilityCheckPath: '/viz-bin/VizieR',
    },
    objectInfo: {
      enabled: false,
      priority: 4,
      timeout: 5000,
      apiEndpoint: '/viz-bin/votable',
      targetClasses: ['deep-sky', 'extragalactic', 'generic'],
      responseMode: 'votable',
      authorityLevel: 'reference',
      healthCheck: {
        strategy: 'query',
        probePath: '/viz-bin/votable?-source=I/239/hip_main&-c=M31&-c.rs=1',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 1,
      fallbackRole: 'supplemental',
      workflows: ['objectInfo', 'render'],
    },
    capabilities: ['name_search', 'metadata_enrichment', 'survey_enrichment'],
  },
  ned: {
    id: 'ned',
    name: 'NED',
    description: 'NASA/IPAC Extragalactic Database',
    baseUrl: 'https://ned.ipac.caltech.edu',
    endpoint: '/cgi-bin/objsearch',
    search: {
      enabled: false,
      priority: 5,
      timeout: 15000,
      queryKinds: ['name'],
      availabilityCheckPath: '/',
    },
    objectInfo: {
      enabled: false,
      priority: 5,
      timeout: 5000,
      apiEndpoint: '/cgi-bin/objsearch',
      targetClasses: ['extragalactic', 'generic'],
      responseMode: 'xml',
      authorityLevel: 'reference',
      healthCheck: {
        strategy: 'lookup',
        probePath: '/cgi-bin/objsearch?objname=M31&of=xml_main',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 5,
      fallbackRole: 'supplemental',
      workflows: ['objectInfo', 'render'],
    },
    capabilities: ['name_search', 'metadata_enrichment'],
  },
  wikipedia: {
    id: 'wikipedia',
    name: 'Wikipedia',
    description: 'Wikipedia summaries and lead images for well-known targets',
    baseUrl: 'https://en.wikipedia.org',
    objectInfo: {
      enabled: true,
      priority: 2,
      timeout: 5000,
      apiEndpoint: '/api/rest_v1/page/summary',
      targetClasses: ['deep-sky', 'star', 'planetary', 'small-body', 'extragalactic', 'generic'],
      responseMode: 'json',
      authorityLevel: 'reference',
      healthCheck: {
        strategy: 'lookup',
        probePath: '/api/rest_v1/page/summary/M31',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 1,
      fallbackRole: 'fallback',
      workflows: ['objectInfo', 'render'],
    },
    capabilities: ['description_enrichment', 'image_enrichment'],
  },
  dss: {
    id: 'dss',
    name: 'Digitized Sky Survey',
    description: 'Digitized Sky Survey image cutouts',
    baseUrl: 'https://archive.stsci.edu/cgi-bin/dss_search',
    objectInfo: {
      enabled: true,
      priority: 4,
      timeout: 10000,
      targetClasses: ['deep-sky', 'star', 'planetary', 'small-body', 'extragalactic', 'generic'],
      responseMode: 'html',
      authorityLevel: 'reference',
      healthCheck: {
        strategy: 'cutout',
      },
    },
    render: {
      enabled: true,
      tier: 'survey',
      priority: 0,
      fallbackRole: 'primary',
      workflows: ['objectInfo', 'render'],
    },
    capabilities: ['image_enrichment', 'survey_enrichment'],
  },
  'nasa-apod': {
    id: 'nasa-apod',
    name: 'NASA APOD',
    description: 'Astronomy Picture of the Day archive',
    baseUrl: 'https://api.nasa.gov',
    objectInfo: {
      enabled: false,
      priority: 6,
      timeout: 5000,
      apiEndpoint: '/planetary/apod',
      targetClasses: ['deep-sky', 'planetary', 'generic'],
      responseMode: 'json',
      authorityLevel: 'reference',
      healthCheck: {
        strategy: 'lookup',
        probePath: '/planetary/apod',
      },
    },
    render: {
      enabled: true,
      tier: 'enrichment',
      priority: 6,
      fallbackRole: 'supplemental',
      workflows: ['objectInfo'],
    },
    capabilities: ['description_enrichment', 'image_enrichment'],
  },
  local: {
    id: 'local',
    name: 'Local',
    description: 'Built-in offline object metadata',
    search: {
      enabled: true,
      priority: -1,
      timeout: 100,
      queryKinds: ['name', 'coordinates', 'minor'],
    },
    objectInfo: {
      enabled: true,
      priority: 0,
      timeout: 100,
      targetClasses: ['deep-sky', 'star', 'planetary', 'small-body', 'extragalactic', 'generic'],
      responseMode: 'local',
      authorityLevel: 'fallback-local',
      healthCheck: {
        strategy: 'none',
      },
    },
    render: {
      enabled: true,
      tier: 'catalog',
      priority: 0,
      fallbackRole: 'primary',
      workflows: ['search', 'objectInfo', 'render'],
    },
    capabilities: ['metadata_enrichment'],
  },
  stellarium: {
    id: 'stellarium',
    name: 'Stellarium Engine',
    description: 'Embedded Stellarium Web Engine metadata',
    objectInfo: {
      enabled: true,
      priority: 0,
      timeout: 100,
      targetClasses: ['deep-sky', 'star', 'planetary', 'small-body', 'extragalactic', 'generic'],
      responseMode: 'local',
      authorityLevel: 'authoritative',
      healthCheck: {
        strategy: 'none',
      },
    },
    render: {
      enabled: true,
      tier: 'catalog',
      priority: 1,
      fallbackRole: 'fallback',
      workflows: ['objectInfo', 'render'],
    },
    capabilities: ['metadata_enrichment'],
  },
};

export function getSearchProviderDefinition(id: SearchProviderId): OnlineDataProviderDefinition {
  return ONLINE_DATA_PROVIDER_REGISTRY[id];
}

export function getObjectInfoProviderDefinition(id: ObjectInfoDataProviderId): OnlineDataProviderDefinition {
  return ONLINE_DATA_PROVIDER_REGISTRY[id];
}

export function getSearchProviderDefinitions(): OnlineDataProviderDefinition[] {
  return Object.values(ONLINE_DATA_PROVIDER_REGISTRY)
    .filter((provider) => provider.search)
    .sort((left, right) => (left.search?.priority ?? 999) - (right.search?.priority ?? 999));
}

function toTierCandidate(provider: OnlineDataProviderDefinition): StarmapTierCandidate | null {
  if (!provider.render) {
    return null;
  }

  return {
    id: provider.id,
    tier: provider.render.tier,
    enabled: provider.render.enabled,
    priority: provider.render.priority,
    fallbackRole: provider.render.fallbackRole,
    available: true,
  };
}

export function getRenderEligibleProviders(tier: RenderProviderTier): OnlineDataProviderDefinition[] {
  const providerMap = new Map<OnlineDataProviderDefinition['id'], OnlineDataProviderDefinition>(
    Object.values(ONLINE_DATA_PROVIDER_REGISTRY).map((provider) => [provider.id, provider])
  );

  return sortStarmapTierCandidates(
    Object.values(ONLINE_DATA_PROVIDER_REGISTRY)
      .map((provider) => toTierCandidate(provider))
      .filter((candidate): candidate is StarmapTierCandidate => candidate !== null && candidate.tier === tier)
  )
    .map((candidate) => providerMap.get(candidate.id as OnlineDataProviderDefinition['id']))
    .filter((provider): provider is OnlineDataProviderDefinition => Boolean(provider));
}

export function getEligibleSearchProviders(kind: SearchQueryKind): SearchProviderId[] {
  const eligible = new Set(
    getSearchProviderDefinitions()
      .filter((provider) => provider.search?.queryKinds.includes(kind))
      .map((provider) => provider.id as SearchProviderId)
  );

  return SEARCH_PROVIDER_PRIORITY[kind].filter((providerId) => eligible.has(providerId));
}

export function filterSearchProvidersForQuery(
  sources: SearchProviderId[],
  kind: SearchQueryKind
): SearchProviderId[] {
  const requested = new Set(sources);
  return getEligibleSearchProviders(kind).filter((providerId) => requested.has(providerId));
}

export function getDefaultSearchSourceConfigs(): Array<{
  id: SearchProviderId;
  enabled: boolean;
  priority: number;
}> {
  return getSearchProviderDefinitions().map((provider) => ({
    id: provider.id as SearchProviderId,
    enabled: provider.search?.enabled ?? false,
    priority: provider.search?.priority ?? 999,
  }));
}

export function getDefaultSearchOnlineStatus(): Record<SearchProviderId, boolean> {
  return getSearchProviderDefinitions().reduce<Record<SearchProviderId, boolean>>((acc, provider) => {
    acc[provider.id as SearchProviderId] = true;
    return acc;
  }, {} as Record<SearchProviderId, boolean>);
}

export function getDefaultObjectInfoDataSourceConfigs(): Array<{
  id: Extract<ObjectInfoDataProviderId, 'simbad' | 'wikipedia' | 'vizier' | 'ned' | 'sbdb'>;
  name: string;
  type: Extract<ObjectInfoDataProviderId, 'simbad' | 'wikipedia' | 'vizier' | 'ned' | 'sbdb'>;
  enabled: boolean;
  priority: number;
  baseUrl: string;
  apiEndpoint: string;
  timeout: number;
  description: string;
  renderTier: Extract<RenderProviderTier, 'enrichment'>;
  fallbackRole: StarmapSourceFallbackRole;
  targetClasses: readonly ObjectInfoTargetClass[];
  responseMode: ObjectInfoResponseMode;
  authorityLevel: ObjectInfoAuthorityLevel;
  healthCheck: {
    strategy: ObjectInfoHealthCheckStrategy;
    probePath?: string;
  };
}> {
  return (['simbad', 'wikipedia', 'sbdb', 'vizier', 'ned'] as const).map((providerId) => {
    const provider = ONLINE_DATA_PROVIDER_REGISTRY[providerId];
    return {
      id: providerId,
      name: provider.name,
      type: providerId,
      enabled: provider.objectInfo?.enabled ?? false,
      priority: provider.objectInfo?.priority ?? 999,
      baseUrl: provider.baseUrl ?? '',
      apiEndpoint: provider.objectInfo?.apiEndpoint ?? provider.endpoint ?? provider.tapEndpoint ?? '',
      timeout: provider.objectInfo?.timeout ?? provider.search?.timeout ?? 5000,
      description: provider.description,
      renderTier: provider.render?.tier === 'enrichment' ? 'enrichment' : 'enrichment',
      fallbackRole: provider.render?.fallbackRole ?? 'fallback',
      targetClasses: provider.objectInfo?.targetClasses ?? ['generic'],
      responseMode: provider.objectInfo?.responseMode ?? 'json',
      authorityLevel: provider.objectInfo?.authorityLevel ?? 'reference',
      healthCheck: provider.objectInfo?.healthCheck ?? { strategy: 'disabled' },
    };
  });
}
