'use client';

import { useEffect, useRef } from 'react';
import { installFetchInterceptor, unifiedCache, getUnifiedCacheProviderDiagnostics, type CacheStrategy, type UnifiedCacheProviderDiagnostics } from '@/lib/offline';
import { PREFETCH_RESOURCES, CACHE_CONFIG } from '@/lib/cache/config';
import { resolveCachePolicyForPrefetchResource } from '@/lib/cache/integration-policy';
import { initializeCacheSystem } from '@/lib/cache/migration';
import { smartFetch } from '@/lib/services/http-fetch';
import { isTauri } from '@/lib/storage/platform';
import { cacheApi } from '@/lib/tauri/cache-api';
import { SKY_SURVEYS } from '@/lib/core/constants/sky-surveys';
import { sanitizeSurveyId } from '@/lib/offline/tile-protocol-url';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { createLogger } from '@/lib/logger';

const logger = createLogger('cache-init');

interface UseCacheInitOptions {
  /** Cache strategy to use */
  strategy?: CacheStrategy;
  /** Whether to enable fetch interception */
  enableInterception?: boolean;
  /** Whether to prefetch critical resources on startup */
  enablePrefetch?: boolean;
  /** Custom resources to prefetch (in addition to defaults) */
  additionalPrefetchUrls?: string[];
  /** Called when deferred cache startup stages change state */
  onCacheStage?: (event: CacheStartupStageEvent) => void;
}

type CacheStartupStage = 'cache_index' | 'cache_prefetch' | 'cache_cleanup';
type CacheStartupStageState = 'loading' | 'ready' | 'degraded' | 'unsupported';

export interface CacheStartupStageEvent {
  stage: CacheStartupStage;
  state: CacheStartupStageState;
  blocking: false;
  reason?: string;
}

/**
 * Prefetch critical resources for better cold-start performance
 */
async function prefetchCriticalResources(
  additionalUrls: string[] = []
): Promise<{ state: CacheStartupStageState; reason?: string }> {
  const urlsToPrefetch = Array.from(new Set([...PREFETCH_RESOURCES, ...additionalUrls]));
  if (urlsToPrefetch.length === 0) {
    return { state: 'ready' };
  }
  
  logger.info('Starting prefetch of critical resources');
  
  const results = await Promise.allSettled(
    urlsToPrefetch.map(async (url) => {
      const cachePolicy = resolveCachePolicyForPrefetchResource(url);
      if (!cachePolicy) {
        logger.warn('Skipping prefetch for resource without declared cache policy', { url });
        return false;
      }

      const response = await smartFetch(url, {
        method: 'GET',
        cachePolicy,
        cacheTtl: CACHE_CONFIG.unified.prefetchTTL,
      });

      if (!response.ok) {
        logger.warn('Prefetch request failed', { url, cachePolicy, status: response.status });
        return false;
      }

      return true;
    })
  );

  const successCount = results.filter((result) => result.status === 'fulfilled' && result.value).length;
  const skippedOrFailed = urlsToPrefetch.length - successCount;

  if (skippedOrFailed > 0) {
    logger.warn(`Prefetched ${successCount}/${urlsToPrefetch.length} resources`, { skippedOrFailed });
    return { state: 'degraded', reason: `prefetch_partial:${successCount}/${urlsToPrefetch.length}` };
  }

  logger.info(`Prefetched ${successCount}/${urlsToPrefetch.length} resources`);
  return { state: 'ready' };
}

/**
 * Hook to initialize the unified cache system
 * Should be called once at app startup
 */
export function useCacheInit(options: UseCacheInitOptions = {}) {
  const {
    strategy = 'cache-first',
    enableInterception = true,
    enablePrefetch = true,
    additionalPrefetchUrls = [],
    onCacheStage,
  } = options;
  const initialized = useRef(false);
  const providerDiagnostics: UnifiedCacheProviderDiagnostics | null = getUnifiedCacheProviderDiagnostics();
  const offlineTileMode = useSettingsStore((state) => state.offlineTileMode);

  // Register the survey id -> upstream HiPS base map once, so the Rust
  // tile-cache protocol can resolve upstream URLs on a cache miss. Desktop only.
  useEffect(() => {
    if (!isTauri()) return;
    const sources: Record<string, string> = {};
    for (const survey of SKY_SURVEYS) {
      sources[sanitizeSurveyId(survey.id)] = survey.url;
    }
    cacheApi.setTileSurveySources(sources).catch((error) => {
      logger.warn('Failed to register tile survey sources', error);
    });
  }, []);

  // Keep the Rust tile-cache protocol's offline mode in sync with the setting.
  useEffect(() => {
    if (!isTauri()) return;
    cacheApi.setOfflineTileMode(offlineTileMode).catch((error) => {
      logger.warn('Failed to sync offline tile mode', error);
    });
  }, [offlineTileMode]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const emitStage = (event: CacheStartupStageEvent) => {
      onCacheStage?.(event);
    };

    // Run cache migrations on startup
    emitStage({ stage: 'cache_index', state: 'loading', blocking: false });
    if (!providerDiagnostics?.supportsPersistent) {
      emitStage({
        stage: 'cache_index',
        state: 'unsupported',
        blocking: false,
        reason: 'persistent_cache_unavailable',
      });
    } else {
      initializeCacheSystem().then((result) => {
        if (result.migratedItems > 0 || result.deletedItems > 0) {
          logger.info('Cache migration completed', result);
        }
        emitStage({ stage: 'cache_index', state: 'ready', blocking: false });
      }).catch((error) => {
        logger.warn('Cache migration failed', error);
        emitStage({
          stage: 'cache_index',
          state: 'degraded',
          blocking: false,
          reason: error instanceof Error ? error.message : 'cache_index_failed',
        });
      });
    }

    // Install fetch interceptor for automatic caching
    if (enableInterception && getUnifiedCacheProviderDiagnostics().supportsInterception) {
      installFetchInterceptor(strategy);
      logger.info('Fetch interceptor installed', { strategy });
    }

    // Set up online/offline listeners
    const handleOnline = () => {
      logger.info('Network online');
    };

    const handleOffline = () => {
      logger.info('Network offline - using cached data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Request persistent storage if available
    if ('storage' in navigator && 'persist' in navigator.storage) {
      navigator.storage.persist().then((granted) => {
        if (granted) {
          logger.info('Persistent storage granted');
        }
      });
    }

    // Prefetch critical resources (non-blocking, uses idle time)
    if (enablePrefetch) {
      const startPrefetch = () => {
        emitStage({ stage: 'cache_prefetch', state: 'loading', blocking: false });
        void prefetchCriticalResources(additionalPrefetchUrls)
          .then((result) => {
            emitStage({ stage: 'cache_prefetch', blocking: false, ...result });
          })
          .catch((error: unknown) => {
            emitStage({
              stage: 'cache_prefetch',
              state: 'degraded',
              blocking: false,
              reason: error instanceof Error ? error.message : 'cache_prefetch_failed',
            });
          });
      };
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(startPrefetch);
      } else {
        setTimeout(startPrefetch, 1000);
      }
    }

    // Setup cache flush on unload for Tauri
    let cleanupFlush: (() => void) | undefined;
    if (isTauri()) {
      const handleBeforeUnload = () => {
        unifiedCache.flush().catch(() => {});
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      cleanupFlush = () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    // Periodic cleanup of expired cache entries (every 30 minutes)
    if (!providerDiagnostics?.supportsCleanup) {
      emitStage({
        stage: 'cache_cleanup',
        state: 'unsupported',
        blocking: false,
        reason: 'cleanup_unsupported',
      });
    }

    const cleanupInterval = setInterval(async () => {
      try {
        const deleted = await unifiedCache.cleanupExpired();
        if (deleted > 0) {
          logger.info(`Periodic cleanup removed ${deleted} expired entries`);
        } else if (!getUnifiedCacheProviderDiagnostics().supportsCleanup) {
          const keys = await unifiedCache.keys();
          logger.debug(`Periodic cleanup check: ${keys.length} cached entries`);
        }
        emitStage({ stage: 'cache_cleanup', state: 'ready', blocking: false });
      } catch (error) {
        logger.warn('Periodic cache cleanup failed', error);
        emitStage({
          stage: 'cache_cleanup',
          state: 'degraded',
          blocking: false,
          reason: error instanceof Error ? error.message : 'cache_cleanup_failed',
        });
      }
    }, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupFlush?.();
      clearInterval(cleanupInterval);
    };
  }, [
    strategy,
    enableInterception,
    enablePrefetch,
    additionalPrefetchUrls,
    onCacheStage,
    providerDiagnostics,
  ]);

  return {
    providerDiagnostics,
  };
}

export default useCacheInit;
