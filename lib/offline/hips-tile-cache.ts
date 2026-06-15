/**
 * Rust-backed HiPS tile cache service.
 *
 * Replaces the browser-Cache-Storage HiPS path (`offlineCacheManager`) with the
 * `offline.rs` tile cache. Pre-download works by fetching the `hipscache://`
 * protocol URLs (with `?prefetch=1` to bypass offline mode): each fetch routes
 * through the Rust handler which fetches upstream and writes the tile to the
 * offline cache — the exact same path used at runtime. Stats are read back from
 * `get_cache_stats`, which aggregates actually-cached tiles per survey.
 *
 * Desktop (Tauri) only; on web these are no-ops.
 */

'use client';

import { isTauri } from '@/lib/storage/platform';
import { cacheApi } from '@/lib/tauri/cache-api';
import type { SkySurvey } from '@/lib/core/constants/sky-surveys';
import { toHipsCacheBase, sanitizeSurveyId } from './tile-protocol-url';
import type { HiPSCacheStatus } from './cache-manager';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hips-tile-cache');

const AVG_TILE_BYTES = 50 * 1024;
const DEFAULT_MAX_ORDER = 3;
const FETCH_CONCURRENCY = 6;

export interface HiPSDownloadProgress {
  downloadedFiles: number;
  totalFiles: number;
}

/** Number of HEALPix tiles covering the whole sky at a given order. */
function tilesForOrder(order: number): number {
  const nside = 2 ** order;
  return 12 * nside * nside;
}

function totalTilesUpToOrder(maxOrder: number): number {
  let total = 0;
  for (let order = 0; order <= maxOrder; order += 1) {
    total += tilesForOrder(order);
  }
  return total;
}

function emptyStatus(survey: SkySurvey, maxOrder: number): HiPSCacheStatus {
  return {
    surveyId: survey.id,
    surveyName: survey.name,
    surveyUrl: survey.url,
    cached: false,
    cachedTiles: 0,
    totalTiles: totalTilesUpToOrder(maxOrder),
    cachedBytes: 0,
    estimatedTotalBytes: totalTilesUpToOrder(maxOrder) * AVG_TILE_BYTES,
    cachedOrders: [],
    maxCachedOrder: 0,
  };
}

/** Read a survey's cache status from the Rust offline tile cache. */
export async function getRustHiPSCacheStatus(
  survey: SkySurvey,
  maxOrder: number = DEFAULT_MAX_ORDER
): Promise<HiPSCacheStatus> {
  if (!isTauri()) return emptyStatus(survey, maxOrder);

  try {
    const id = sanitizeSurveyId(survey.id);
    const stats = await cacheApi.getStats();
    const info = stats.surveys.find((s) => s.survey_id === id);
    const cachedTiles = info?.tile_count ?? 0;
    const cachedBytes = info?.size_bytes ?? 0;
    const totalTiles = totalTilesUpToOrder(maxOrder);
    return {
      surveyId: survey.id,
      surveyName: survey.name,
      surveyUrl: survey.url,
      cached: cachedTiles > 0,
      cachedTiles,
      totalTiles,
      cachedBytes,
      estimatedTotalBytes: totalTiles * AVG_TILE_BYTES,
      cachedOrders: [],
      maxCachedOrder: 0,
    };
  } catch (error) {
    logger.warn('Failed to read HiPS cache status', error);
    return emptyStatus(survey, maxOrder);
  }
}

/** Build a prefetch protocol URL for a single tile (jpg; DSS-family default). */
function tileProtocolUrl(surveyId: string, order: number, npix: number): string {
  const dir = Math.floor(npix / 10000) * 10000;
  return `${toHipsCacheBase(surveyId)}/Norder${order}/Dir${dir}/Npix${npix}.jpg?prefetch=1`;
}

/**
 * Pre-download a survey (whole-sky, orders 0..maxOrder) into the offline tile
 * cache by fetching the protocol URLs. Returns true if any tile was cached.
 */
export async function downloadHiPSSurveyToRust(
  survey: SkySurvey,
  maxOrder: number = DEFAULT_MAX_ORDER,
  onProgress?: (progress: HiPSDownloadProgress) => void
): Promise<boolean> {
  if (!isTauri()) return false;

  const urls: string[] = [];
  for (let order = 0; order <= maxOrder; order += 1) {
    const count = tilesForOrder(order);
    for (let npix = 0; npix < count; npix += 1) {
      urls.push(tileProtocolUrl(survey.id, order, npix));
    }
  }

  const total = urls.length;
  let completed = 0;
  let succeeded = 0;
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      try {
        const response = await fetch(urls[index]);
        if (response.ok) succeeded += 1;
      } catch {
        // A missing tile (partial-sky survey) or transient error is non-fatal.
      }
      completed += 1;
      onProgress?.({ downloadedFiles: completed, totalFiles: total });
    }
  };

  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));
  logger.info(`Pre-downloaded ${survey.id}: ${succeeded}/${total} tiles cached`);
  return succeeded > 0;
}

/** Clear all cached tiles for one survey. */
export async function clearRustHiPSCache(surveyId: string): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await cacheApi.clearSurveyCache(sanitizeSurveyId(surveyId));
    return true;
  } catch (error) {
    logger.warn('Failed to clear survey cache', error);
    return false;
  }
}

/** Clear all cached survey tiles. */
export async function clearAllRustHiPSCaches(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    await cacheApi.clearAllCache();
    return true;
  } catch (error) {
    logger.warn('Failed to clear all survey caches', error);
    return false;
  }
}
