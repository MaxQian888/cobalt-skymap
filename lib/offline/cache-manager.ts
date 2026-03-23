/**
 * Offline Cache Manager for Stellarium data layers and HiPS survey tiles
 * Uses Cache Storage API for offline support
 */

import type { HiPSSurvey } from '@/lib/services/hips-service';
import type { StarmapDataTier } from '@/lib/core/starmap-data-tier';
import { createLogger } from '@/lib/logger';

const logger = createLogger('cache-manager');

export interface LayerConfig {
  id: string;
  name: string;
  description: string;
  tier: Extract<StarmapDataTier, 'core' | 'catalog' | 'survey'>;
  baseUrl: string;
  files: string[];
  size: number; // Estimated size in bytes
  priority: number; // Lower = higher priority
}

export interface DownloadProgress {
  layerId: string;
  totalFiles: number;
  downloadedFiles: number;
  totalBytes: number;
  downloadedBytes: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface CacheStatus {
  layerId: string;
  cached: boolean;
  cachedFiles: number;
  totalFiles: number;
  cachedBytes: number;
  totalBytes: number;
  lastUpdated?: Date;
  // New fields for integrity checking
  missingFiles?: string[];
  isComplete: boolean;
  integrityChecked?: boolean;
}

export interface StorageInfo {
  used: number;
  quota: number;
  available: number;
  usagePercent: number;
}

// HiPS Survey cache configuration
export interface HiPSCacheConfig {
  surveyId: string;
  surveyUrl: string;
  surveyName: string;
  maxOrder: number; // Maximum HiPS order to cache (higher = more detail, more tiles)
  cachedOrders: number[]; // Which orders are cached
}

export interface HiPSCacheStatus {
  surveyId: string;
  surveyName: string;
  surveyUrl: string;
  cached: boolean;
  cachedTiles: number;
  totalTiles: number;
  cachedBytes: number;
  estimatedTotalBytes: number;
  cachedOrders: number[];
  maxCachedOrder: number;
}

// Define available layers with their resources
export const STELLARIUM_LAYERS: LayerConfig[] = [
  {
    id: 'core',
    name: 'Core Engine',
    description: 'WebAssembly engine and core scripts',
    tier: 'core',
    baseUrl: '/stellarium-js/',
    files: [
      'stellarium-web-engine.js',
      'stellarium-web-engine.wasm',
    ],
    size: 15 * 1024 * 1024, // ~15MB
    priority: 0,
  },
  {
    id: 'stars',
    name: 'Star Catalog',
    description: 'Basic star catalog data',
    tier: 'catalog',
    baseUrl: '/stellarium-data/stars/',
    files: [
      'info.json',
      'stars_0.json',
      'stars_1.json',
      'stars_2.json',
    ],
    size: 5 * 1024 * 1024, // ~5MB
    priority: 1,
  },
  {
    id: 'dso',
    name: 'Deep Sky Objects',
    description: 'Galaxies, nebulae, and clusters',
    tier: 'catalog',
    baseUrl: '/stellarium-data/dso/',
    files: [
      'info.json',
      'dso.json',
    ],
    size: 2 * 1024 * 1024, // ~2MB
    priority: 2,
  },
  {
    id: 'skycultures',
    name: 'Sky Cultures',
    description: 'Constellation lines and names',
    tier: 'catalog',
    baseUrl: '/stellarium-data/skycultures/western/',
    files: [
      'info.json',
      'constellations.json',
      'star_names.json',
    ],
    size: 500 * 1024, // ~500KB
    priority: 3,
  },
  {
    id: 'planets',
    name: 'Solar System',
    description: 'Planet textures and orbital data',
    tier: 'catalog',
    baseUrl: '/stellarium-data/surveys/sso/',
    files: [
      'info.json',
      'moon/info.json',
      'sun/info.json',
      'mercury/info.json',
      'venus/info.json',
      'mars/info.json',
      'jupiter/info.json',
      'saturn/info.json',
    ],
    size: 10 * 1024 * 1024, // ~10MB
    priority: 4,
  },
  {
    id: 'dss',
    name: 'DSS Survey',
    description: 'Digital Sky Survey images (basic tiles)',
    tier: 'survey',
    baseUrl: '/stellarium-data/surveys/dss/',
    files: [
      'info.json',
      'properties',
    ],
    size: 1 * 1024 * 1024, // ~1MB (just metadata, tiles loaded on demand)
    priority: 5,
  },
  {
    id: 'milkyway',
    name: 'Milky Way',
    description: 'Milky Way panorama',
    tier: 'survey',
    baseUrl: '/stellarium-data/surveys/milkyway/',
    files: [
      'info.json',
      'properties',
    ],
    size: 5 * 1024 * 1024, // ~5MB
    priority: 6,
  },
  {
    id: 'comets',
    name: 'Comets & Asteroids',
    description: 'Minor body orbital elements',
    tier: 'catalog',
    baseUrl: '/stellarium-data/',
    files: [
      'CometEls.txt',
      'mpcorb.dat',
    ],
    size: 20 * 1024 * 1024, // ~20MB
    priority: 7,
  },
];

const CACHE_NAME_PREFIX = 'skymap-offline-';
const HIPS_CACHE_PREFIX = 'skymap-hips-';
const CACHE_VERSION = 'v1';

// Average tile size for estimation (50KB)
const AVG_TILE_SIZE = 50 * 1024;

// Calculate number of tiles for a given HiPS order
function getTileCountForOrder(order: number): number {
  const nside = Math.pow(2, order);
  return 12 * nside * nside;
}

// Get total tiles up to and including a given order
function getTotalTilesUpToOrder(maxOrder: number): number {
  let total = 0;
  for (let o = 0; o <= maxOrder; o++) {
    total += getTileCountForOrder(o);
  }
  return total;
}

class OfflineCacheManager {
  private downloadAbortControllers: Map<string, AbortController> = new Map();
  private hipsCacheConfigs: Map<string, HiPSCacheConfig> = new Map();

  /**
   * Get the cache name for a layer
   */
  private getCacheName(layerId: string): string {
    return `${CACHE_NAME_PREFIX}${layerId}-${CACHE_VERSION}`;
  }

  /**
   * Get the cache name for a HiPS survey
   */
  private getHiPSCacheName(surveyId: string): string {
    return `${HIPS_CACHE_PREFIX}${surveyId.replace(/[^a-zA-Z0-9]/g, '_')}-${CACHE_VERSION}`;
  }

  /**
   * Check if Cache API is available
   */
  isAvailable(): boolean {
    return 'caches' in window;
  }

  /**
   * Get cache status for a specific layer
   */
  async getLayerStatus(layerId: string): Promise<CacheStatus> {
    const layer = STELLARIUM_LAYERS.find(l => l.id === layerId);
    if (!layer) {
      return {
        layerId,
        cached: false,
        cachedFiles: 0,
        totalFiles: 0,
        cachedBytes: 0,
        totalBytes: 0,
        isComplete: false,
      };
    }

    if (!this.isAvailable()) {
      return {
        layerId,
        cached: false,
        cachedFiles: 0,
        totalFiles: layer.files.length,
        cachedBytes: 0,
        totalBytes: layer.size,
        isComplete: false,
      };
    }

    try {
      const cache = await caches.open(this.getCacheName(layerId));
      const keys = await cache.keys();
      const cachedUrls = new Set(keys.map(k => k.url));
      
      // Check which files are missing
      const missingFiles: string[] = [];
      for (const file of layer.files) {
        const fullUrl = new URL(layer.baseUrl + file, window.location.origin).href;
        if (!cachedUrls.has(fullUrl)) {
          missingFiles.push(file);
        }
      }
      
      const cachedFiles = layer.files.length - missingFiles.length;
      const isComplete = missingFiles.length === 0;
      
      // Estimate cached bytes based on proportion of files
      const cachedBytes = Math.round((cachedFiles / layer.files.length) * layer.size);

      return {
        layerId,
        cached: isComplete,
        cachedFiles,
        totalFiles: layer.files.length,
        cachedBytes,
        totalBytes: layer.size,
        lastUpdated: cachedFiles > 0 ? new Date() : undefined,
        missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
        isComplete,
        integrityChecked: true,
      };
    } catch (error) {
      logger.error(`Error getting cache status for ${layerId}`, error);
      return {
        layerId,
        cached: false,
        cachedFiles: 0,
        totalFiles: layer.files.length,
        cachedBytes: 0,
        totalBytes: layer.size,
        isComplete: false,
      };
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) {
      return { used: 0, quota: 0, available: 0, usagePercent: 0 };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const available = quota - used;
      const usagePercent = quota > 0 ? (used / quota) * 100 : 0;

      return { used, quota, available, usagePercent };
    } catch {
      return { used: 0, quota: 0, available: 0, usagePercent: 0 };
    }
  }

  /**
   * Verify and repair cache integrity for a layer
   */
  async verifyAndRepairLayer(
    layerId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<{ verified: boolean; repaired: number; failed: number }> {
    const status = await this.getLayerStatus(layerId);
    
    if (status.isComplete) {
      return { verified: true, repaired: 0, failed: 0 };
    }

    if (!status.missingFiles || status.missingFiles.length === 0) {
      return { verified: true, repaired: 0, failed: 0 };
    }

    const layer = STELLARIUM_LAYERS.find(l => l.id === layerId);
    if (!layer) {
      return { verified: false, repaired: 0, failed: status.missingFiles.length };
    }

    // Download missing files
    const cache = await caches.open(this.getCacheName(layerId));
    let repaired = 0;
    let failed = 0;

    const progress: DownloadProgress = {
      layerId,
      totalFiles: status.missingFiles.length,
      downloadedFiles: 0,
      totalBytes: Math.round((status.missingFiles.length / layer.files.length) * layer.size),
      downloadedBytes: 0,
      status: 'downloading',
    };

    onProgress?.(progress);

    for (const file of status.missingFiles) {
      try {
        const url = layer.baseUrl + file;
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response.clone());
          repaired++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }

      progress.downloadedFiles++;
      progress.downloadedBytes = Math.round(
        (progress.downloadedFiles / progress.totalFiles) * progress.totalBytes
      );
      onProgress?.(progress);
    }

    progress.status = failed === 0 ? 'completed' : 'error';
    onProgress?.(progress);

    return { verified: failed === 0, repaired, failed };
  }

  /**
   * Get cache status for all layers
   */
  async getAllLayerStatus(): Promise<CacheStatus[]> {
    const statuses = await Promise.all(
      STELLARIUM_LAYERS.map(layer => this.getLayerStatus(layer.id))
    );
    return statuses;
  }

  /**
   * Download and cache a specific layer
   */
  async downloadLayer(
    layerId: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    const layer = STELLARIUM_LAYERS.find(l => l.id === layerId);
    if (!layer) {
      throw new Error(`Unknown layer: ${layerId}`);
    }

    if (!this.isAvailable()) {
      throw new Error('Cache API not available');
    }

    const abortController = new AbortController();
    this.downloadAbortControllers.set(layerId, abortController);

    const progress: DownloadProgress = {
      layerId,
      totalFiles: layer.files.length,
      downloadedFiles: 0,
      totalBytes: layer.size,
      downloadedBytes: 0,
      status: 'downloading',
    };

    onProgress?.(progress);

    try {
      const cache = await caches.open(this.getCacheName(layerId));

      for (const file of layer.files) {
        if (abortController.signal.aborted) {
          progress.status = 'error';
          progress.error = 'Download cancelled';
          onProgress?.(progress);
          return false;
        }

        const url = layer.baseUrl + file;
        
        try {
          const response = await fetch(url, {
            signal: abortController.signal,
          });

          if (!response.ok) {
            logger.warn(`Failed to fetch ${url}: ${response.status}`);
            continue;
          }

          // Clone the response before caching
          await cache.put(url, response.clone());

          progress.downloadedFiles++;
          progress.downloadedBytes = Math.round(
            (progress.downloadedFiles / progress.totalFiles) * progress.totalBytes
          );
          onProgress?.(progress);
        } catch (fetchError) {
          if ((fetchError as Error).name === 'AbortError') {
            progress.status = 'error';
            progress.error = 'Download cancelled';
            onProgress?.(progress);
            return false;
          }
          logger.warn(`Error fetching ${url}`, fetchError);
        }
      }

      progress.status = 'completed';
      onProgress?.(progress);
      
      this.downloadAbortControllers.delete(layerId);
      return true;
    } catch (error) {
      progress.status = 'error';
      progress.error = (error as Error).message;
      onProgress?.(progress);
      this.downloadAbortControllers.delete(layerId);
      return false;
    }
  }

  /**
   * Download multiple layers
   */
  async downloadLayers(
    layerIds: string[],
    onProgress?: (layerId: string, progress: DownloadProgress) => void
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Sort by priority
    const sortedIds = [...layerIds].sort((a, b) => {
      const layerA = STELLARIUM_LAYERS.find(l => l.id === a);
      const layerB = STELLARIUM_LAYERS.find(l => l.id === b);
      return (layerA?.priority ?? 999) - (layerB?.priority ?? 999);
    });

    for (const layerId of sortedIds) {
      const success = await this.downloadLayer(layerId, (progress) => {
        onProgress?.(layerId, progress);
      });
      results.set(layerId, success);
    }

    return results;
  }

  /**
   * Download all available layers
   */
  async downloadAllLayers(
    onProgress?: (layerId: string, progress: DownloadProgress) => void
  ): Promise<Map<string, boolean>> {
    const allLayerIds = STELLARIUM_LAYERS.map(l => l.id);
    return this.downloadLayers(allLayerIds, onProgress);
  }

  /**
   * Cancel an ongoing download
   */
  cancelDownload(layerId: string): void {
    const controller = this.downloadAbortControllers.get(layerId);
    if (controller) {
      controller.abort();
      this.downloadAbortControllers.delete(layerId);
    }
  }

  /**
   * Cancel all ongoing downloads
   */
  cancelAllDownloads(): void {
    for (const [layerId, controller] of this.downloadAbortControllers) {
      controller.abort();
      this.downloadAbortControllers.delete(layerId);
    }
  }

  /**
   * Clear cache for a specific layer
   */
  async clearLayer(layerId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const deleted = await caches.delete(this.getCacheName(layerId));
      return deleted;
    } catch (error) {
      logger.error(`Error clearing cache for ${layerId}`, error);
      return false;
    }
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const cacheNames = await caches.keys();
      const skymapCaches = cacheNames.filter(name => 
        name.startsWith(CACHE_NAME_PREFIX)
      );

      await Promise.all(skymapCaches.map(name => caches.delete(name)));
      return true;
    } catch (error) {
      logger.error('Error clearing all caches', error);
      return false;
    }
  }

  /**
   * Get total cache size estimate
   */
  async getTotalCacheSize(): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if we're online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Get a cached response or fetch from network
   */
  async getResource(url: string): Promise<Response | null> {
    if (!this.isAvailable()) {
      return fetch(url);
    }

    // Try to find in any cache (including HiPS caches)
    const cacheNames = await caches.keys();
    const skymapCaches = cacheNames.filter(name => 
      name.startsWith(CACHE_NAME_PREFIX) || name.startsWith(HIPS_CACHE_PREFIX)
    );

    for (const cacheName of skymapCaches) {
      const cache = await caches.open(cacheName);
      const response = await cache.match(url);
      if (response) {
        return response;
      }
    }

    // Not in cache, try network
    if (this.isOnline()) {
      try {
        return await fetch(url);
      } catch {
        return null;
      }
    }

    return null;
  }

  // ==================== HiPS Survey Caching ====================

  /**
   * Get HiPS cache status for a specific survey
   */
  async getHiPSCacheStatus(survey: HiPSSurvey): Promise<HiPSCacheStatus> {
    const surveyId = survey.id;
    
    if (!this.isAvailable()) {
      return {
        surveyId,
        surveyName: survey.name,
        surveyUrl: survey.url,
        cached: false,
        cachedTiles: 0,
        totalTiles: 0,
        cachedBytes: 0,
        estimatedTotalBytes: 0,
        cachedOrders: [],
        maxCachedOrder: -1,
      };
    }

    try {
      const cacheName = this.getHiPSCacheName(surveyId);
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      
      // Analyze cached tiles to determine which orders are cached
      const cachedOrders = new Set<number>();
      for (const request of keys) {
        const url = request.url;
        const orderMatch = url.match(/Norder(\d+)/);
        if (orderMatch) {
          cachedOrders.add(parseInt(orderMatch[1], 10));
        }
      }
      
      const ordersArray = Array.from(cachedOrders).sort((a, b) => a - b);
      const maxCachedOrder = ordersArray.length > 0 ? Math.max(...ordersArray) : -1;
      const cachedTiles = keys.length;
      const cachedBytes = cachedTiles * AVG_TILE_SIZE;
      
      // Estimate total based on max order we'd want to cache (order 3 is reasonable for offline)
      const targetOrder = Math.min(survey.maxOrder, 3);
      const totalTiles = getTotalTilesUpToOrder(targetOrder);
      const estimatedTotalBytes = totalTiles * AVG_TILE_SIZE;

      return {
        surveyId,
        surveyName: survey.name,
        surveyUrl: survey.url,
        cached: cachedTiles > 0,
        cachedTiles,
        totalTiles,
        cachedBytes,
        estimatedTotalBytes,
        cachedOrders: ordersArray,
        maxCachedOrder,
      };
    } catch (error) {
      logger.error(`Error getting HiPS cache status for ${surveyId}`, error);
      return {
        surveyId,
        surveyName: survey.name,
        surveyUrl: survey.url,
        cached: false,
        cachedTiles: 0,
        totalTiles: 0,
        cachedBytes: 0,
        estimatedTotalBytes: 0,
        cachedOrders: [],
        maxCachedOrder: -1,
      };
    }
  }

  /**
   * Download and cache HiPS tiles for a survey up to a specific order
   */
  async downloadHiPSSurvey(
    survey: HiPSSurvey,
    maxOrder = 3, // Order 3 = 768 tiles, reasonable for offline
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Cache API not available');
    }

    const surveyId = survey.id;
    const abortController = new AbortController();
    this.downloadAbortControllers.set(`hips-${surveyId}`, abortController);

    // Calculate total tiles
    const totalTiles = getTotalTilesUpToOrder(maxOrder);
    const estimatedBytes = totalTiles * AVG_TILE_SIZE;

    const progress: DownloadProgress = {
      layerId: `hips-${surveyId}`,
      totalFiles: totalTiles,
      downloadedFiles: 0,
      totalBytes: estimatedBytes,
      downloadedBytes: 0,
      status: 'downloading',
    };

    onProgress?.(progress);

    try {
      const cacheName = this.getHiPSCacheName(surveyId);
      const cache = await caches.open(cacheName);
      let failedTiles = 0;

      // Download tiles for each order
      for (let order = 0; order <= maxOrder; order++) {
        if (abortController.signal.aborted) {
          progress.status = 'error';
          progress.error = 'Download cancelled';
          onProgress?.(progress);
          return false;
        }

        const tilesInOrder = getTileCountForOrder(order);
        
        // Download tiles in batches to avoid overwhelming the network
        const batchSize = 10;
        for (let i = 0; i < tilesInOrder; i += batchSize) {
          if (abortController.signal.aborted) {
            progress.status = 'error';
            progress.error = 'Download cancelled';
            onProgress?.(progress);
            return false;
          }

          const batch = [];
          for (let j = i; j < Math.min(i + batchSize, tilesInOrder); j++) {
            const { cacheKey, fetchUrl } = this.buildHiPSTileUrls(survey, order, j);
            batch.push(this.fetchAndCacheTile(cache, cacheKey, fetchUrl, abortController.signal));
          }

          const results = await Promise.allSettled(batch);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
          const batchFailures = batch.length - successCount;
          failedTiles += batchFailures;
          
          progress.downloadedFiles += successCount;
          progress.downloadedBytes = progress.downloadedFiles * AVG_TILE_SIZE;
          onProgress?.(progress);
        }
      }

      // Store cache config
      this.hipsCacheConfigs.set(surveyId, {
        surveyId,
        surveyUrl: survey.url,
        surveyName: survey.name,
        maxOrder,
        cachedOrders: Array.from({ length: maxOrder + 1 }, (_, i) => i),
      });

      if (failedTiles > 0) {
        progress.status = 'error';
        progress.error = `${failedTiles} tiles failed to download`;
      } else {
        progress.status = 'completed';
      }
      onProgress?.(progress);
      
      this.downloadAbortControllers.delete(`hips-${surveyId}`);
      return failedTiles === 0;
    } catch (error) {
      progress.status = 'error';
      progress.error = (error as Error).message;
      onProgress?.(progress);
      this.downloadAbortControllers.delete(`hips-${surveyId}`);
      return false;
    }
  }

  /**
   * Fetch and cache a single tile
   */
  private async fetchAndCacheTile(
    cache: Cache,
    cacheKey: string,
    fetchUrl: string,
    signal: AbortSignal
  ): Promise<boolean> {
    try {
      // Check if already cached
      const existing = await cache.match(cacheKey);
      if (existing) {
        return true;
      }

      const response = await fetch(fetchUrl, { signal });
      if (!response.ok) {
        return false;
      }

      await cache.put(cacheKey, response.clone());
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      logger.warn(`Failed to cache tile: ${fetchUrl}`, error);
      return false;
    }
  }

  private buildHiPSTileUrls(
    survey: HiPSSurvey,
    order: number,
    pixelIndex: number
  ): { cacheKey: string; fetchUrl: string } {
    const dir = Math.floor(pixelIndex / 10000) * 10000;
    const format = survey.tileFormat.split(' ')[0] || 'jpeg';
    const tileUrl = `${survey.url}Norder${order}/Dir${dir}/Npix${pixelIndex}.${format}`;
    // CDS Aladin HiPS servers support CORS, so we can fetch directly
    return { cacheKey: tileUrl, fetchUrl: tileUrl };
  }

  /**
   * Cancel HiPS survey download
   */
  cancelHiPSDownload(surveyId: string): void {
    const controller = this.downloadAbortControllers.get(`hips-${surveyId}`);
    if (controller) {
      controller.abort();
      this.downloadAbortControllers.delete(`hips-${surveyId}`);
    }
  }

  /**
   * Clear HiPS cache for a specific survey
   */
  async clearHiPSCache(surveyId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const cacheName = this.getHiPSCacheName(surveyId);
      const deleted = await caches.delete(cacheName);
      this.hipsCacheConfigs.delete(surveyId);
      return deleted;
    } catch (error) {
      logger.error(`Error clearing HiPS cache for ${surveyId}`, error);
      return false;
    }
  }

  /**
   * Clear all HiPS caches
   */
  async clearAllHiPSCaches(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const cacheNames = await caches.keys();
      const hipsCaches = cacheNames.filter(name => 
        name.startsWith(HIPS_CACHE_PREFIX)
      );

      await Promise.all(hipsCaches.map(name => caches.delete(name)));
      this.hipsCacheConfigs.clear();
      return true;
    } catch (error) {
      logger.error('Error clearing all HiPS caches', error);
      return false;
    }
  }

  /**
   * Get all cached HiPS surveys
   */
  async getAllCachedHiPSSurveys(): Promise<string[]> {
    if (!this.isAvailable()) return [];

    try {
      const cacheNames = await caches.keys();
      return cacheNames
        .filter(name => name.startsWith(HIPS_CACHE_PREFIX))
        .map(name => {
          // Extract survey ID from cache name
          const match = name.match(new RegExp(`^${HIPS_CACHE_PREFIX}(.+)-${CACHE_VERSION}$`));
          return match ? match[1] : null;
        })
        .filter((id): id is string => id !== null);
    } catch {
      return [];
    }
  }

  /**
   * Get a HiPS tile from cache or fetch from network
   */
  async getHiPSTile(surveyUrl: string, order: number, pixelIndex: number, format = 'jpeg'): Promise<Response | null> {
    const dir = Math.floor(pixelIndex / 10000) * 10000;
    const tileUrl = `${surveyUrl}Norder${order}/Dir${dir}/Npix${pixelIndex}.${format}`;
    return this.getResource(tileUrl);
  }
}

// Singleton instance
export const offlineCacheManager = new OfflineCacheManager();

export function getStellariumLayersForTier(
  tier: Extract<StarmapDataTier, 'core' | 'catalog' | 'survey'>
): LayerConfig[] {
  return STELLARIUM_LAYERS.filter((layer) => layer.tier === tier);
}
