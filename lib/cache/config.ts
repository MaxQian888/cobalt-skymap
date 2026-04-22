/**
 * Unified Cache Configuration
 * Centralized configuration for all caching systems in the application
 */

import type { StarmapDataTier } from '@/lib/core/starmap-data-tier';

// Time constants
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Cache configuration for different subsystems
 */
export const CACHE_CONFIG = {
  /**
   * Unified network cache (Web Cache API / Tauri file system)
   */
  unified: {
    /** Maximum cache size in bytes (500MB) */
    maxSize: 500 * 1024 * 1024,
    /** Default TTL for cached resources (7 days) */
    defaultTTL: 7 * DAY,
    /** TTL for prefetched resources (30 days) */
    prefetchTTL: 30 * DAY,
    /** Cache name for Web Cache API */
    cacheName: 'skymap-unified-cache',
  },

  /**
   * Geocoding service cache
   */
  geocoding: {
    /** Maximum number of cached entries */
    maxSize: 500,
    /** TTL for geocoding results (24 hours) */
    ttl: 24 * HOUR,
  },

  /**
   * Nighttime/astronomical calculations cache
   */
  nighttime: {
    /** Maximum entries for nighttime data */
    maxSize: 500,
    /** TTL for nighttime data (1 minute - changes with time) */
    ttl: 1 * MINUTE,
    /** Maximum entries for sun/moon position caches */
    positionCacheMaxSize: 1000,
    /** Maximum entries for hour angle cache */
    hourAngleCacheMaxSize: 1000,
  },

  /**
   * Search results cache
   */
  search: {
    /** Maximum number of cached search results */
    maxSize: 100,
    /** Default TTL for search results (6 hours) */
    defaultTTL: 6 * HOUR,
  },

  /**
   * Object info service cache
   */
  objectInfo: {
    /** Maximum cached object info entries */
    maxSize: 200,
    /** TTL for object info (1 hour) */
    ttl: 1 * HOUR,
  },

  /**
   * Stellarium data layers (offline cache)
   */
  stellariumLayers: {
    /** Cache name for layers */
    cacheName: 'skymap-stellarium-layers',
  },

  /**
   * HiPS survey tiles cache
   */
  hipsSurvey: {
    /** Cache name prefix for HiPS surveys */
    cacheNamePrefix: 'skymap-hips-',
    /** Maximum tile size in bytes (5MB) */
    maxTileSize: 5 * 1024 * 1024,
  },

  /**
   * Tauri backend cache limits (must match src-tauri/src/network/security.rs)
   */
  tauri: {
    /** Maximum cache entries (10,000) */
    maxEntries: 10_000,
    /** Maximum total cache size (1GB) */
    maxTotalSize: 1024 * 1024 * 1024,
    /** Maximum single tile size (5MB) */
    maxTileSize: 5 * 1024 * 1024,
  },
} as const;

/**
 * URL patterns that should be cached by the unified cache
 */
export const CACHEABLE_URL_PATTERNS = [
  // Stellarium resources
  '/stellarium-js/',
  '/stellarium-data/',
  // HiPS survey tiles
  'alasky.u-strasbg.fr',
  'alaskybis.u-strasbg.fr',
  'cds.unistra.fr',
  // DSS image service
  'archive.stsci.edu',
  // Simbad/Vizier
  'simbad.u-strasbg.fr',
  'vizier.u-strasbg.fr',
  'celestrak.org',
  // Daily knowledge online sources
  'api.nasa.gov',
  'en.wikipedia.org',
  'upload.wikimedia.org',
  'wikimedia.org',
] as const;

/**
 * Critical resources to prefetch on startup
 */
export const STARMAP_TIER_PREFETCH_RESOURCES: Readonly<Record<StarmapDataTier, readonly string[]>> = {
  core: [
    // WASM is intentionally excluded — the Stellarium engine fetches it directly
    // via WebAssembly.instantiateStreaming, and the browser handles code caching.
    '/stellarium-js/stellarium-web-engine.js',
  ],
  catalog: [
    '/stellarium-data/stars/properties',
    '/stellarium-data/dso/properties',
  ],
  survey: [
    '/stellarium-data/surveys/dss/properties',
  ],
  enrichment: [],
} as const;

export const PREFETCH_RESOURCES = [
  ...STARMAP_TIER_PREFETCH_RESOURCES.core,
  ...STARMAP_TIER_PREFETCH_RESOURCES.catalog,
  ...STARMAP_TIER_PREFETCH_RESOURCES.survey,
] as const;

export function getStarmapTierPrefetchResources(tier: StarmapDataTier): readonly string[] {
  return STARMAP_TIER_PREFETCH_RESOURCES[tier];
}

/**
 * Get TTL in milliseconds from hours
 */
export function hoursToMs(hours: number): number {
  return hours * HOUR;
}

/**
 * Get TTL in milliseconds from days
 */
export function daysToMs(days: number): number {
  return days * DAY;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < MINUTE) return `${Math.round(ms / SECOND)}s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  return `${Math.round(ms / DAY)}d`;
}
