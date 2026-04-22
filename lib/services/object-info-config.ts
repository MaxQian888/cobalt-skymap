/**
 * Object Information Sources Configuration
 * Allows customization of image and data sources with connectivity checking
 */

import {
  sortStarmapTierCandidates,
  type StarmapDataTier,
  type StarmapSourceFallbackRole,
} from '@/lib/core/starmap-data-tier';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getDefaultObjectInfoDataSourceConfigs,
  type ObjectInfoAuthorityLevel,
  type ObjectInfoHealthCheckStrategy,
  type ObjectInfoResponseMode,
} from './online-data-provider-registry';

// ============================================================================
// Types
// ============================================================================

export type ImageSourceType = 'aladin' | 'skyview' | 'dss' | 'eso' | 'custom';
export type DataSourceType = 'simbad' | 'vizier' | 'ned' | 'wikipedia' | 'sbdb' | 'custom';

export interface ImageSourceConfig {
  id: string;
  name: string;
  type: ImageSourceType;
  enabled: boolean;
  priority: number;
  baseUrl: string;
  // Template for URL generation: {ra}, {dec}, {size}, {format}
  urlTemplate: string;
  // Additional parameters
  params?: Record<string, string>;
  // Source attribution
  credit: string;
  // Description
  description: string;
  // Health status
  status: 'unknown' | 'checking' | 'online' | 'offline' | 'error';
  lastChecked?: number;
  responseTime?: number;
  // Is built-in (cannot be deleted)
  builtIn: boolean;
  renderTier: Extract<StarmapDataTier, 'survey'>;
  fallbackRole: StarmapSourceFallbackRole;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  type: DataSourceType;
  enabled: boolean;
  priority: number;
  baseUrl: string;
  // API endpoint template
  apiEndpoint: string;
  // Timeout in ms
  timeout: number;
  // Description
  description: string;
  // Health status
  status: 'unknown' | 'checking' | 'online' | 'offline' | 'error';
  lastChecked?: number;
  responseTime?: number;
  // Is built-in (cannot be deleted)
  builtIn: boolean;
  renderTier: Extract<StarmapDataTier, 'enrichment'>;
  fallbackRole: StarmapSourceFallbackRole;
  targetClasses: readonly string[];
  responseMode: ObjectInfoResponseMode;
  authorityLevel: ObjectInfoAuthorityLevel;
  healthCheck: {
    strategy: ObjectInfoHealthCheckStrategy;
    probePath?: string;
  };
}

type LegacyImageSourceConfig = Omit<ImageSourceConfig, 'renderTier' | 'fallbackRole'> & Partial<
  Pick<ImageSourceConfig, 'renderTier' | 'fallbackRole'>
>;

type LegacyDataSourceConfig = Omit<
  DataSourceConfig,
  'renderTier' | 'fallbackRole' | 'targetClasses' | 'responseMode' | 'authorityLevel' | 'healthCheck'
> & Partial<
  Pick<
    DataSourceConfig,
    'renderTier' | 'fallbackRole' | 'targetClasses' | 'responseMode' | 'authorityLevel' | 'healthCheck'
  >
>;

export interface ObjectInfoConfig {
  // Image sources
  imageSources: ImageSourceConfig[];
  // Data sources
  dataSources: DataSourceConfig[];
  // Global settings
  settings: {
    // Max concurrent requests
    maxConcurrentRequests: number;
    // Default timeout for image loading (ms)
    imageTimeout: number;
    // Default timeout for API requests (ms)
    apiTimeout: number;
    // Auto-skip offline sources
    autoSkipOffline: boolean;
    // Check interval for source health (ms), 0 = disabled
    healthCheckInterval: number;
    // Cache duration for object info (ms)
    cacheDuration: number;
    // Preferred image format
    preferredImageFormat: 'jpg' | 'png' | 'gif';
    // Default image size in arcminutes
    defaultImageSize: number;
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_IMAGE_SOURCES: ImageSourceConfig[] = [
  {
    id: 'aladin-dss2-color',
    name: 'Aladin DSS2 Color',
    type: 'aladin',
    enabled: true,
    priority: 1,
    baseUrl: 'https://alasky.cds.unistra.fr',
    urlTemplate: '/hips-image-services/hips2fits?hips=CDS/P/DSS2/color&ra={ra}&dec={dec}&fov={size}&width=500&height=500&format={format}',
    credit: 'CDS Aladin Sky Atlas - DSS2 Color',
    description: 'High-quality color composite from DSS2 via Aladin',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'primary',
  },
  {
    id: 'skyview-dss2-red',
    name: 'SkyView DSS2 Red',
    type: 'skyview',
    enabled: true,
    priority: 2,
    baseUrl: 'https://skyview.gsfc.nasa.gov',
    urlTemplate: '/current/cgi/runquery.pl?Position={ra},{dec}&Survey=DSS2+Red&Coordinates=J2000&Size={size}&Pixels=500&Return=GIF',
    credit: 'NASA SkyView - DSS2 Red',
    description: 'Digitized Sky Survey 2 Red band via NASA SkyView',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'fallback',
  },
  {
    id: 'skyview-2mass-j',
    name: 'SkyView 2MASS J-band',
    type: 'skyview',
    enabled: true,
    priority: 3,
    baseUrl: 'https://skyview.gsfc.nasa.gov',
    urlTemplate: '/current/cgi/runquery.pl?Position={ra},{dec}&Survey=2MASS-J&Coordinates=J2000&Size={size}&Pixels=500&Return=GIF',
    credit: 'NASA SkyView - 2MASS J-band',
    description: 'Near-infrared J-band from Two Micron All Sky Survey',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'fallback',
  },
  {
    id: 'skyview-sdss-r',
    name: 'SkyView SDSS r-band',
    type: 'skyview',
    enabled: true,
    priority: 4,
    baseUrl: 'https://skyview.gsfc.nasa.gov',
    urlTemplate: '/current/cgi/runquery.pl?Position={ra},{dec}&Survey=SDSSr&Coordinates=J2000&Size={size}&Pixels=500&Return=GIF',
    credit: 'NASA SkyView - SDSS r-band',
    description: 'Sloan Digital Sky Survey r-band (northern sky only)',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'supplemental',
  },
  {
    id: 'skyview-wise',
    name: 'SkyView WISE 3.4μm',
    type: 'skyview',
    enabled: true,
    priority: 5,
    baseUrl: 'https://skyview.gsfc.nasa.gov',
    urlTemplate: '/current/cgi/runquery.pl?Position={ra},{dec}&Survey=WISE+3.4&Coordinates=J2000&Size={size}&Pixels=500&Return=GIF',
    credit: 'NASA SkyView - WISE 3.4μm',
    description: 'Wide-field Infrared Survey Explorer mid-infrared',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'supplemental',
  },
  {
    id: 'aladin-panstarrs',
    name: 'Aladin PanSTARRS',
    type: 'aladin',
    enabled: false,
    priority: 6,
    baseUrl: 'https://alasky.cds.unistra.fr',
    urlTemplate: '/hips-image-services/hips2fits?hips=CDS/P/PanSTARRS/DR1/color-z-zg-g&ra={ra}&dec={dec}&fov={size}&width=500&height=500&format={format}',
    credit: 'CDS Aladin - PanSTARRS DR1',
    description: 'Panoramic Survey Telescope and Rapid Response System',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'supplemental',
  },
  {
    id: 'aladin-allwise',
    name: 'Aladin AllWISE Color',
    type: 'aladin',
    enabled: false,
    priority: 7,
    baseUrl: 'https://alasky.cds.unistra.fr',
    urlTemplate: '/hips-image-services/hips2fits?hips=CDS/P/allWISE/color&ra={ra}&dec={dec}&fov={size}&width=500&height=500&format={format}',
    credit: 'CDS Aladin - AllWISE Color',
    description: 'AllWISE infrared color composite',
    status: 'unknown',
    builtIn: true,
    renderTier: 'survey',
    fallbackRole: 'supplemental',
  },
];

export const DEFAULT_DATA_SOURCES: DataSourceConfig[] = getDefaultObjectInfoDataSourceConfigs().map((source) => ({
  ...source,
  status: 'unknown' as const,
  builtIn: true,
}));

export const DEFAULT_SETTINGS: ObjectInfoConfig['settings'] = {
  maxConcurrentRequests: 3,
  imageTimeout: 10000,
  apiTimeout: 5000,
  autoSkipOffline: true,
  healthCheckInterval: 300000, // 5 minutes
  cacheDuration: 3600000, // 1 hour
  preferredImageFormat: 'jpg',
  defaultImageSize: 15, // arcminutes
};

function normalizeImageSourceConfig(source: LegacyImageSourceConfig): ImageSourceConfig {
  return {
    ...source,
    renderTier: source.renderTier ?? 'survey',
    fallbackRole: source.fallbackRole ?? (source.priority <= 1 ? 'primary' : 'fallback'),
  };
}

function normalizeDataSourceConfig(source: LegacyDataSourceConfig): DataSourceConfig {
  return {
    ...source,
    renderTier: source.renderTier ?? 'enrichment',
    fallbackRole: source.fallbackRole ?? (source.priority <= 1 ? 'primary' : 'fallback'),
    targetClasses: source.targetClasses ?? ['generic'],
    responseMode: source.responseMode ?? 'json',
    authorityLevel: source.authorityLevel ?? 'reference',
    healthCheck: source.healthCheck ?? { strategy: 'disabled' },
  };
}

function buildImageHealthProbeUrl(source: ImageSourceConfig): string {
  const testRa = 10.68;
  const testDec = 41.27;
  const testSize = 0.5;

  return source.baseUrl + source.urlTemplate
    .replace('{ra}', testRa.toString())
    .replace('{dec}', testDec.toString())
    .replace('{size}', testSize.toString())
    .replace('{format}', 'jpg');
}

function buildDataSourceHealthProbeUrl(source: DataSourceConfig): string | null {
  if (source.healthCheck.strategy === 'none' || source.healthCheck.strategy === 'disabled') {
    return null;
  }

  if (source.healthCheck.probePath) {
    return `${source.baseUrl}${source.healthCheck.probePath}`;
  }

  return source.baseUrl + source.apiEndpoint;
}

export function getObjectInfoConfigMigratedState(
  persisted: Partial<Omit<ObjectInfoConfig, 'imageSources' | 'dataSources'>> & {
    imageSources?: LegacyImageSourceConfig[];
    dataSources?: LegacyDataSourceConfig[];
  }
): ObjectInfoConfig {
  return {
    imageSources: (persisted.imageSources ?? DEFAULT_IMAGE_SOURCES).map((source) =>
      normalizeImageSourceConfig(source as ImageSourceConfig)
    ),
    dataSources: (persisted.dataSources ?? DEFAULT_DATA_SOURCES).map((source) =>
      normalizeDataSourceConfig(source as DataSourceConfig)
    ),
    settings: {
      ...DEFAULT_SETTINGS,
      ...(persisted.settings ?? {}),
    },
  };
}

function sortSourceConfigs<T extends { id: string; renderTier: StarmapDataTier; enabled: boolean; priority: number; fallbackRole: StarmapSourceFallbackRole }>(
  sources: T[]
): T[] {
  return sortStarmapTierCandidates(
    sources.map((source) => ({
      id: source.id,
      tier: source.renderTier,
      enabled: source.enabled,
      priority: source.priority,
      fallbackRole: source.fallbackRole,
      available: true,
    }))
  ).map((candidate) => sources.find((source) => source.id === candidate.id) as T);
}

// ============================================================================
// Store
// ============================================================================

interface ObjectInfoConfigStore extends ObjectInfoConfig {
  // Actions
  setImageSourceEnabled: (id: string, enabled: boolean) => void;
  setImageSourcePriority: (id: string, priority: number) => void;
  updateImageSource: (id: string, updates: Partial<ImageSourceConfig>) => void;
  addImageSource: (
    source: Omit<ImageSourceConfig, 'id' | 'builtIn' | 'status' | 'renderTier' | 'fallbackRole'> &
      Partial<Pick<ImageSourceConfig, 'renderTier' | 'fallbackRole'>>
  ) => void;
  removeImageSource: (id: string) => void;
  
  setDataSourceEnabled: (id: string, enabled: boolean) => void;
  setDataSourcePriority: (id: string, priority: number) => void;
  updateDataSource: (id: string, updates: Partial<DataSourceConfig>) => void;
  addDataSource: (
    source: Omit<DataSourceConfig, 'id' | 'builtIn' | 'status' | 'renderTier' | 'fallbackRole'> &
      Partial<Pick<DataSourceConfig, 'renderTier' | 'fallbackRole'>>
  ) => void;
  removeDataSource: (id: string) => void;
  
  updateSettings: (settings: Partial<ObjectInfoConfig['settings']>) => void;
  
  // Health check
  setImageSourceStatus: (id: string, status: ImageSourceConfig['status'], responseTime?: number) => void;
  setDataSourceStatus: (id: string, status: DataSourceConfig['status'], responseTime?: number) => void;
  
  // Reset
  resetToDefaults: () => void;
}

export const useObjectInfoConfigStore = create<ObjectInfoConfigStore>()(
  persist(
    (set) => ({
      imageSources: DEFAULT_IMAGE_SOURCES,
      dataSources: DEFAULT_DATA_SOURCES,
      settings: DEFAULT_SETTINGS,

      setImageSourceEnabled: (id, enabled) => {
        set((state) => ({
          imageSources: state.imageSources.map((s) =>
            s.id === id ? normalizeImageSourceConfig({ ...s, enabled }) : s
          ),
        }));
      },

      setImageSourcePriority: (id, priority) => {
        set((state) => ({
          imageSources: state.imageSources.map((s) =>
            s.id === id ? normalizeImageSourceConfig({ ...s, priority }) : s
          ),
        }));
      },

      updateImageSource: (id, updates) => {
        set((state) => ({
          imageSources: state.imageSources.map((s) =>
            s.id === id ? normalizeImageSourceConfig({ ...s, ...updates }) : s
          ),
        }));
      },

      addImageSource: (source) => {
        const id = `custom-${Date.now()}`;
        set((state) => ({
          imageSources: [
            ...state.imageSources,
            normalizeImageSourceConfig({
              ...source,
              id,
              builtIn: false,
              status: 'unknown' as const,
            }),
          ],
        }));
      },

      removeImageSource: (id) => {
        set((state) => ({
          imageSources: state.imageSources.filter((s) => s.id !== id || s.builtIn),
        }));
      },

      setDataSourceEnabled: (id, enabled) => {
        set((state) => ({
          dataSources: state.dataSources.map((s) =>
            s.id === id ? normalizeDataSourceConfig({ ...s, enabled }) : s
          ),
        }));
      },

      setDataSourcePriority: (id, priority) => {
        set((state) => ({
          dataSources: state.dataSources.map((s) =>
            s.id === id ? normalizeDataSourceConfig({ ...s, priority }) : s
          ),
        }));
      },

      updateDataSource: (id, updates) => {
        set((state) => ({
          dataSources: state.dataSources.map((s) =>
            s.id === id ? normalizeDataSourceConfig({ ...s, ...updates }) : s
          ),
        }));
      },

      addDataSource: (source) => {
        const id = `custom-${Date.now()}`;
        set((state) => ({
          dataSources: [
            ...state.dataSources,
            normalizeDataSourceConfig({
              ...source,
              id,
              builtIn: false,
              status: 'unknown' as const,
            }),
          ],
        }));
      },

      removeDataSource: (id) => {
        set((state) => ({
          dataSources: state.dataSources.filter((s) => s.id !== id || s.builtIn),
        }));
      },

      updateSettings: (settings) => {
        set((state) => ({
          settings: { ...state.settings, ...settings },
        }));
      },

      setImageSourceStatus: (id, status, responseTime) => {
        set((state) => ({
          imageSources: state.imageSources.map((s) =>
            s.id === id
              ? { ...s, status, lastChecked: Date.now(), responseTime }
              : s
          ),
        }));
      },

      setDataSourceStatus: (id, status, responseTime) => {
        set((state) => ({
          dataSources: state.dataSources.map((s) =>
            s.id === id
              ? { ...s, status, lastChecked: Date.now(), responseTime }
              : s
          ),
        }));
      },

      resetToDefaults: () => {
        set({
          imageSources: DEFAULT_IMAGE_SOURCES,
          dataSources: DEFAULT_DATA_SOURCES,
          settings: DEFAULT_SETTINGS,
        });
      },
    }),
    {
      name: 'object-info-config',
      version: 2,
      migrate: (persistedState) => getObjectInfoConfigMigratedState(persistedState as Partial<ObjectInfoConfig>),
    }
  )
);

// ============================================================================
// Health Check Functions
// ============================================================================

/**
 * Check if an image source is accessible
 */
export async function checkImageSourceHealth(
  source: ImageSourceConfig
): Promise<{ online: boolean; responseTime: number }> {
  const startTime = performance.now();
  
  try {
    const url = buildImageHealthProbeUrl(source);
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    const responseTime = Math.round(performance.now() - startTime);
    return { online: response.ok, responseTime };
  } catch {
    const responseTime = Math.round(performance.now() - startTime);
    return { online: false, responseTime };
  }
}

/**
 * Check if a data source is accessible
 */
export async function checkDataSourceHealth(
  source: DataSourceConfig
): Promise<{ online: boolean; responseTime: number }> {
  const startTime = performance.now();
  
  try {
    if (source.healthCheck.strategy === 'none') {
      const responseTime = Math.round(performance.now() - startTime);
      return { online: true, responseTime };
    }

    if (source.healthCheck.strategy === 'disabled') {
      const responseTime = Math.round(performance.now() - startTime);
      return { online: false, responseTime };
    }

    const testUrl = buildDataSourceHealthProbeUrl(source);
    if (!testUrl) {
      const responseTime = Math.round(performance.now() - startTime);
      return { online: false, responseTime };
    }

    const response = await fetch(testUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(source.timeout),
    });
    
    const responseTime = Math.round(performance.now() - startTime);
    return { online: response.ok, responseTime };
  } catch {
    const responseTime = Math.round(performance.now() - startTime);
    return { online: false, responseTime };
  }
}

/**
 * Check all sources health
 */
export async function checkAllSourcesHealth(): Promise<void> {
  const store = useObjectInfoConfigStore.getState();
  
  // Check image sources
  for (const source of store.imageSources) {
    if (!source.enabled) continue;
    
    store.setImageSourceStatus(source.id, 'checking');
    const result = await checkImageSourceHealth(source);
    store.setImageSourceStatus(
      source.id,
      result.online ? 'online' : 'offline',
      result.responseTime
    );
  }
  
  // Check data sources
  for (const source of store.dataSources) {
    if (!source.enabled) continue;
    
    store.setDataSourceStatus(source.id, 'checking');
    const result = await checkDataSourceHealth(source);
    store.setDataSourceStatus(
      source.id,
      result.online ? 'online' : 'offline',
      result.responseTime
    );
  }
}

/**
 * Start periodic health checks
 */
let healthCheckIntervalId: ReturnType<typeof setInterval> | null = null;

export function startHealthChecks(): void {
  const settings = useObjectInfoConfigStore.getState().settings;
  
  if (settings.healthCheckInterval <= 0) return;
  
  // Initial check
  checkAllSourcesHealth();
  
  // Periodic checks
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId);
  }
  
  healthCheckIntervalId = setInterval(() => {
    checkAllSourcesHealth();
  }, settings.healthCheckInterval);
}

export function stopHealthChecks(): void {
  if (healthCheckIntervalId) {
    clearInterval(healthCheckIntervalId);
    healthCheckIntervalId = null;
  }
}

// ============================================================================
// URL Generation with Config
// ============================================================================

/**
 * Generate image URL from source config
 */
export function generateImageUrl(
  source: ImageSourceConfig,
  ra: number,
  dec: number,
  sizeArcmin?: number
): string {
  const settings = useObjectInfoConfigStore.getState().settings;
  const size = (sizeArcmin || settings.defaultImageSize) / 60; // Convert to degrees
  
  return source.baseUrl + source.urlTemplate
    .replace('{ra}', ra.toString())
    .replace('{dec}', dec.toString())
    .replace('{size}', size.toString())
    .replace('{format}', settings.preferredImageFormat);
}

/**
 * Get enabled and sorted image sources
 */
export function getActiveImageSources(): ImageSourceConfig[] {
  const store = useObjectInfoConfigStore.getState();
  
  return sortSourceConfigs(
    store.imageSources
    .filter((s) => s.enabled)
    .filter((s) => !store.settings.autoSkipOffline || s.status !== 'offline')
  );
}

/**
 * Get enabled and sorted data sources
 */
export function getActiveDataSources(): DataSourceConfig[] {
  const store = useObjectInfoConfigStore.getState();
  
  return sortSourceConfigs(
    store.dataSources
    .filter((s) => s.enabled)
    .filter((s) => !store.settings.autoSkipOffline || s.status !== 'offline')
  );
}
