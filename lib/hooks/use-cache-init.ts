'use client';

import { useEffect, useRef } from 'react';
import { installFetchInterceptor, unifiedCache, getUnifiedCacheProviderDiagnostics, type CacheStrategy, type UnifiedCacheProviderDiagnostics } from '@/lib/offline';
import { PREFETCH_RESOURCES, CACHE_CONFIG } from '@/lib/cache/config';
import { resolveCachePolicyForPrefetchResource } from '@/lib/cache/integration-policy';
import { initializeCacheSystem } from '@/lib/cache/migration';
import { smartFetch } from '@/lib/services/http-fetch';
import { isTauri } from '@/lib/storage/platform';
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
  /** Called when cache-index bootstrap starts */
  onCacheIndexStart?: () => void;
  /** Called when cache-index bootstrap succeeds */
  onCacheIndexReady?: () => void;
  /** Called when cache-index bootstrap fails */
  onCacheIndexError?: (error: unknown) => void;
}

/**
 * Prefetch critical resources for better cold-start performance
 */
async function prefetchCriticalResources(additionalUrls: string[] = []): Promise<void> {
  const urlsToPrefetch = Array.from(new Set([...PREFETCH_RESOURCES, ...additionalUrls]));
  if (urlsToPrefetch.length === 0) return;
  
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
    return;
  }

  logger.info(`Prefetched ${successCount}/${urlsToPrefetch.length} resources`);
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
    onCacheIndexStart,
    onCacheIndexReady,
    onCacheIndexError,
  } = options;
  const initialized = useRef(false);
  const providerDiagnostics: UnifiedCacheProviderDiagnostics | null = getUnifiedCacheProviderDiagnostics();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Run cache migrations on startup
    onCacheIndexStart?.();
    initializeCacheSystem().then((result) => {
      if (result.migratedItems > 0 || result.deletedItems > 0) {
        logger.info('Cache migration completed', result);
      }
      onCacheIndexReady?.();
    }).catch((error) => {
      logger.warn('Cache migration failed', error);
      onCacheIndexError?.(error);
    });

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
      const startPrefetch = () => prefetchCriticalResources(additionalPrefetchUrls);
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
    const cleanupInterval = setInterval(async () => {
      try {
        const deleted = await unifiedCache.cleanupExpired();
        if (deleted > 0) {
          logger.info(`Periodic cleanup removed ${deleted} expired entries`);
        } else if (!getUnifiedCacheProviderDiagnostics().supportsCleanup) {
          const keys = await unifiedCache.keys();
          logger.debug(`Periodic cleanup check: ${keys.length} cached entries`);
        }
      } catch (error) {
        logger.warn('Periodic cache cleanup failed', error);
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
    onCacheIndexStart,
    onCacheIndexReady,
    onCacheIndexError,
  ]);

  return {
    providerDiagnostics,
  };
}

export default useCacheInit;
