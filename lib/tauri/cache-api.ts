/**
 * Tauri API wrapper for offline cache management
 * Only available in Tauri desktop environment
 */

import { isTauri } from '@/lib/storage/platform';

// Lazy import to avoid errors in web environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error('Tauri API is only available in desktop environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

// ============================================================================
// Types
// ============================================================================

export type CacheStatus = 
  | 'pending'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface CacheRegion {
  id: string;
  name: string;
  center_ra: number;
  center_dec: number;
  radius_deg: number;
  min_zoom: number;
  max_zoom: number;
  survey_id: string;
  tile_count: number;
  size_bytes: number;
  status: CacheStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyCacheInfo {
  survey_id: string;
  tile_count: number;
  size_bytes: number;
}

export interface CacheStats {
  total_regions: number;
  total_tiles: number;
  total_size_bytes: number;
  completed_regions: number;
  surveys: SurveyCacheInfo[];
}

// ============================================================================
// Cache API
// ============================================================================

export const cacheApi = {
  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const invoke = await getInvoke();
    return invoke('get_cache_stats');
  },

  /**
   * List all cache regions
   */
  async listRegions(): Promise<CacheRegion[]> {
    const invoke = await getInvoke();
    return invoke('list_cache_regions');
  },

  /**
   * Create a new cache region
   */
  async createRegion(
    name: string,
    center_ra: number,
    center_dec: number,
    radius_deg: number,
    min_zoom: number,
    max_zoom: number,
    survey_id: string
  ): Promise<CacheRegion> {
    const invoke = await getInvoke();
    return invoke('create_cache_region', {
      args: {
        name,
        center_ra,
        center_dec,
        radius_deg,
        min_zoom,
        max_zoom,
        survey_id,
      },
    });
  },

  /**
   * Update cache region status
   */
  async updateRegion(
    regionId: string,
    status?: CacheStatus,
    progress?: number,
    sizeBytes?: number
  ): Promise<CacheRegion> {
    const invoke = await getInvoke();
    return invoke('update_cache_region', {
      regionId,
      status,
      progress,
      sizeBytes,
    });
  },

  /**
   * Delete a cache region
   */
  async deleteRegion(regionId: string, deleteTiles: boolean = true): Promise<void> {
    const invoke = await getInvoke();
    return invoke('delete_cache_region', { regionId, deleteTiles });
  },

  /**
   * Save a tile to cache
   */
  async saveTile(
    surveyId: string,
    zoom: number,
    x: number,
    y: number,
    data: Uint8Array
  ): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_cached_tile', {
      surveyId,
      zoom,
      x,
      y,
      data: Array.from(data),
    });
  },

  /**
   * Load a tile from cache
   */
  async loadTile(
    surveyId: string,
    zoom: number,
    x: number,
    y: number
  ): Promise<Uint8Array | null> {
    const invoke = await getInvoke();
    const data = await invoke<number[] | null>('load_cached_tile', {
      surveyId,
      zoom,
      x,
      y,
    });
    return data ? new Uint8Array(data) : null;
  },

  /**
   * Check if a tile is cached
   */
  async isTileCached(
    surveyId: string,
    zoom: number,
    x: number,
    y: number
  ): Promise<boolean> {
    const invoke = await getInvoke();
    return invoke('is_tile_cached', { surveyId, zoom, x, y });
  },

  /**
   * Clear all cached tiles for a survey
   */
  async clearSurveyCache(surveyId: string): Promise<number> {
    const invoke = await getInvoke();
    return invoke('clear_survey_cache', { surveyId });
  },

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<number> {
    const invoke = await getInvoke();
    return invoke('clear_all_cache');
  },

  /**
   * Get cache directory path
   */
  async getCacheDirectory(): Promise<string> {
    const invoke = await getInvoke();
    return invoke('get_cache_directory');
  },

  /**
   * Register the survey id -> upstream HiPS base URL map so the tile-cache
   * protocol can resolve the upstream URL on a cache miss.
   */
  async setTileSurveySources(sources: Record<string, string>): Promise<void> {
    const invoke = await getInvoke();
    return invoke('set_tile_survey_sources', { sources });
  },

  /**
   * Toggle offline mode for the tile-cache protocol. When enabled the handler
   * serves only from cache (404 on miss) and never hits the network.
   */
  async setOfflineTileMode(enabled: boolean): Promise<void> {
    const invoke = await getInvoke();
    return invoke('set_offline_tile_mode', { enabled });
  },

  /** Check if cache API is available */
  isAvailable: isTauri,
};

export default cacheApi;
