/**
 * Unified Cache Manager
 * Provides a consistent caching interface for both Web (Cache API) and Tauri (file system)
 * Implements cache-first strategy with network fallback
 */

import { isTauri } from '@/lib/storage/platform';
import { validateUrl, SecurityError } from '../security/url-validator';
import { CACHE_CONFIG, CACHEABLE_URL_PATTERNS } from '@/lib/cache/config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('unified-cache');

// ============================================================================
// Types
// ============================================================================

export interface CacheEntry {
  url: string;
  data: ArrayBuffer | Blob;
  contentType: string;
  timestamp: number;
  expiresAt?: number;
  etag?: string;
  size: number;
}

export interface CacheConfig {
  /** Cache name/namespace */
  name: string;
  /** Maximum cache size in bytes (0 = unlimited) */
  maxSize?: number;
  /** Default TTL in milliseconds (0 = never expires) */
  defaultTTL?: number;
  /** URL patterns to cache (regex strings) */
  urlPatterns?: string[];
  /** Whether to cache failed requests */
  cacheFailures?: boolean;
}

export interface FetchOptions extends RequestInit {
  /** Force network fetch, bypassing cache */
  forceNetwork?: boolean;
  /** Force cache, don't fetch from network */
  forceCache?: boolean;
  /** Custom TTL for this request */
  ttl?: number;
  /** Cache key override */
  cacheKey?: string;
  /** Force persistent caching even when URL interceptor patterns do not match */
  cacheable?: boolean;
  /** Custom network fetcher used by shared request utilities */
  networkFetcher?: (url: string, init: RequestInit) => Promise<Response>;
}

export type CacheStrategy = 
  | 'cache-first'      // Try cache, fallback to network
  | 'network-first'    // Try network, fallback to cache
  | 'cache-only'       // Only use cache
  | 'network-only'     // Only use network
  | 'stale-while-revalidate'; // Return cache, update in background

export type UnifiedCacheProviderId = 'browser-cache-api' | 'tauri-unified-cache' | 'unavailable';

export interface UnifiedCacheProviderDiagnostics {
  providerId: UnifiedCacheProviderId;
  available: boolean;
  supportsPersistent: boolean;
  supportsClear: boolean;
  supportsCleanup: boolean;
  supportsFlush: boolean;
  supportsInterception: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CacheConfig = {
  name: CACHE_CONFIG.unified.cacheName,
  maxSize: CACHE_CONFIG.unified.maxSize,
  defaultTTL: CACHE_CONFIG.unified.defaultTTL,
  urlPatterns: [...CACHEABLE_URL_PATTERNS],
  cacheFailures: false,
};

// ============================================================================
// Web Cache Implementation (Cache API)
// ============================================================================

class WebCacheProvider {
  private cacheName: string;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cacheName = `${config.name}-v1`;
  }

  async isAvailable(): Promise<boolean> {
    return 'caches' in window;
  }

  async get(url: string): Promise<Response | null> {
    if (!await this.isAvailable()) return null;
    
    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(url);
      
      if (response) {
        // Check if expired
        const cachedAt = response.headers.get('x-cached-at');
        const ttl = response.headers.get('x-cache-ttl');
        
        if (cachedAt && ttl) {
          const expiresAt = parseInt(cachedAt) + parseInt(ttl);
          if (Date.now() > expiresAt) {
            // Expired, delete and return null
            await cache.delete(url);
            return null;
          }
        }
        
        return response;
      }
      
      return null;
    } catch (error) {
      logger.warn('WebCache get error', error);
      return null;
    }
  }

  async put(url: string, response: Response, ttl?: number): Promise<void> {
    if (!await this.isAvailable()) return;
    
    try {
      const cache = await caches.open(this.cacheName);
      
      // Clone response and add cache metadata headers
      const headers = new Headers(response.headers);
      headers.set('x-cached-at', Date.now().toString());
      headers.set('x-cache-ttl', (ttl || this.config.defaultTTL || 0).toString());
      
      const cachedResponse = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      
      await cache.put(url, cachedResponse);
    } catch (error) {
      logger.warn('WebCache put error', error);
    }
  }

  async delete(url: string): Promise<boolean> {
    if (!await this.isAvailable()) return false;
    
    try {
      const cache = await caches.open(this.cacheName);
      return await cache.delete(url);
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!await this.isAvailable()) return;
    
    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      logger.warn('WebCache clear error', error);
    }
  }

  async getSize(): Promise<number> {
    if (!await this.isAvailable()) return 0;
    
    try {
      const cache = await caches.open(this.cacheName);
      const requests = await cache.keys();
      let totalSize = 0;
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.clone().blob();
          totalSize += blob.size;
        }
      }
      
      return totalSize;
    } catch {
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    if (!await this.isAvailable()) return [];
    
    try {
      const cache = await caches.open(this.cacheName);
      const requests = await cache.keys();
      return requests.map(r => r.url);
    } catch {
      return [];
    }
  }

  async cleanup(): Promise<number> {
    if (!await this.isAvailable()) return 0;

    try {
      const cache = await caches.open(this.cacheName);
      const requests = await cache.keys();
      let deleted = 0;

      for (const request of requests) {
        const response = await cache.match(request);
        if (!response) continue;

        const cachedAt = response.headers.get('x-cached-at');
        const ttl = response.headers.get('x-cache-ttl');
        if (!cachedAt || !ttl) continue;

        const expiresAt = parseInt(cachedAt, 10) + parseInt(ttl, 10);
        if (Date.now() > expiresAt && await cache.delete(request)) {
          deleted += 1;
        }
      }

      return deleted;
    } catch (error) {
      logger.warn('WebCache cleanup error', error);
      return 0;
    }
  }

  async flush(): Promise<void> {
    return Promise.resolve();
  }
}

// ============================================================================
// Tauri Cache Implementation (File System)
// ============================================================================

class TauriCacheProvider {
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return isTauri();
  }

  private async getInvoke() {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  }

  private urlToKey(url: string): string {
    // Convert URL to safe filename
    return url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 200);
  }

  async get(url: string): Promise<Response | null> {
    if (!await this.isAvailable()) return null;
    
    try {
      const invoke = await this.getInvoke();
      const key = this.urlToKey(url);
      
      const result = await invoke<{ data: number[]; content_type: string; timestamp: number; ttl: number } | null>(
        'get_unified_cache_entry',
        { key }
      );
      
      if (!result) return null;
      
      // Check expiration
      if (result.ttl > 0 && Date.now() > result.timestamp + result.ttl) {
        await this.delete(url);
        return null;
      }
      
      const blob = new Blob([new Uint8Array(result.data)], { type: result.content_type });
      return new Response(blob, {
        headers: {
          'Content-Type': result.content_type,
          'x-cached-at': result.timestamp.toString(),
          'x-cache-ttl': result.ttl.toString(),
        },
      });
    } catch (error) {
      logger.warn('TauriCache get error', error);
      return null;
    }
  }

  async put(url: string, response: Response, ttl?: number): Promise<void> {
    if (!await this.isAvailable()) return;
    
    try {
      const invoke = await this.getInvoke();
      const key = this.urlToKey(url);
      const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
      const blob = await response.clone().blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      await invoke('put_unified_cache_entry', {
        key,
        data: Array.from(new Uint8Array(arrayBuffer)),
        contentType,
        ttl: ttl || this.config.defaultTTL || 0,
      });
    } catch (error) {
      logger.warn('TauriCache put error', error);
    }
  }

  async delete(url: string): Promise<boolean> {
    if (!await this.isAvailable()) return false;
    
    try {
      const invoke = await this.getInvoke();
      const key = this.urlToKey(url);
      await invoke('delete_unified_cache_entry', { key });
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!await this.isAvailable()) return;
    
    try {
      const invoke = await this.getInvoke();
      await invoke('clear_unified_cache');
    } catch (error) {
      logger.warn('TauriCache clear error', error);
    }
  }

  async getSize(): Promise<number> {
    if (!await this.isAvailable()) return 0;
    
    try {
      const invoke = await this.getInvoke();
      return await invoke<number>('get_unified_cache_size');
    } catch {
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    if (!await this.isAvailable()) return [];
    
    try {
      const invoke = await this.getInvoke();
      return await invoke<string[]>('list_unified_cache_keys');
    } catch {
      return [];
    }
  }

  async cleanup(): Promise<number> {
    if (!await this.isAvailable()) return 0;

    try {
      const invoke = await this.getInvoke();
      return await invoke<number>('cleanup_unified_cache');
    } catch (error) {
      logger.warn('TauriCache cleanup error', error);
      return 0;
    }
  }

  async flush(): Promise<void> {
    if (!await this.isAvailable()) return;

    try {
      const invoke = await this.getInvoke();
      await invoke('flush_unified_cache');
    } catch (error) {
      logger.warn('TauriCache flush error', error);
    }
  }
}

// ============================================================================
// Unified Cache Manager
// ============================================================================

class UnifiedCacheManager {
  private webCache: WebCacheProvider;
  private tauriCache: TauriCacheProvider;
  private config: CacheConfig;
  private pendingRequests: Map<string, Promise<Response>> = new Map();
  private domainPatterns: Set<string> = new Set();
  private pathPatterns: string[] = [];
  private cacheStats = { hits: 0, misses: 0, errors: 0 };

  constructor(config: CacheConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.webCache = new WebCacheProvider(this.config);
    this.tauriCache = new TauriCacheProvider(this.config);
    
    // Separate domain patterns from path patterns for faster matching
    this.compilePatterns(this.config.urlPatterns || []);
  }

  /**
   * Compile URL patterns into optimized data structures
   * Separates domain patterns (for Set lookup) from path patterns (for string matching)
   */
  private compilePatterns(patterns: string[]): void {
    this.domainPatterns.clear();
    this.pathPatterns = [];
    
    for (const pattern of patterns) {
      // Path patterns start with /
      if (pattern.startsWith('/')) {
        this.pathPatterns.push(pattern);
      } else {
        // Domain patterns - extract just the domain part
        this.domainPatterns.add(pattern.toLowerCase());
      }
    }
  }

  /**
   * Check if a URL should be cached (optimized matching)
   */
  shouldCache(url: string): boolean {
    // If no patterns configured, cache everything
    if (this.domainPatterns.size === 0 && this.pathPatterns.length === 0) {
      return true;
    }
    
    // Check path patterns first (for relative URLs)
    for (const pattern of this.pathPatterns) {
      if (url.includes(pattern)) {
        return true;
      }
    }
    
    // Check domain patterns (for absolute URLs)
    try {
      const urlObj = new URL(url, 'http://localhost');
      const hostname = urlObj.hostname.toLowerCase();
      
      // Direct domain match
      if (this.domainPatterns.has(hostname)) {
        return true;
      }
      
      // Subdomain match (e.g., 'alasky.u-strasbg.fr' matches 'cds.unistra.fr')
      for (const domain of this.domainPatterns) {
        if (hostname.endsWith(domain) || hostname.includes(domain)) {
          return true;
        }
      }
    } catch {
      // Invalid URL, check if any pattern appears in the string
      const lowerUrl = url.toLowerCase();
      for (const domain of this.domainPatterns) {
        if (lowerUrl.includes(domain)) {
          return true;
        }
      }
    }
    
    return false;
  }

  getProviderDiagnostics(): UnifiedCacheProviderDiagnostics {
    if (isTauri()) {
      return {
        providerId: 'tauri-unified-cache',
        available: true,
        supportsPersistent: true,
        supportsClear: true,
        supportsCleanup: true,
        supportsFlush: true,
        supportsInterception: typeof window !== 'undefined',
      };
    }

    if (typeof globalThis !== 'undefined' && 'caches' in globalThis) {
      return {
        providerId: 'browser-cache-api',
        available: true,
        supportsPersistent: true,
        supportsClear: true,
        supportsCleanup: true,
        supportsFlush: false,
        supportsInterception: typeof window !== 'undefined',
      };
    }

    return {
      providerId: 'unavailable',
      available: false,
      supportsPersistent: false,
      supportsClear: false,
      supportsCleanup: false,
      supportsFlush: false,
      supportsInterception: false,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return {
      ...this.cacheStats,
      hitRate: total > 0 ? this.cacheStats.hits / total : undefined,
      pendingRequests: this.pendingRequests.size,
    };
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.cacheStats = { hits: 0, misses: 0, errors: 0 };
  }

  /**
   * Get the appropriate cache provider
   */
  private async getProvider(): Promise<WebCacheProvider | TauriCacheProvider> {
    if (isTauri() && await this.tauriCache.isAvailable()) {
      return this.tauriCache;
    }
    return this.webCache;
  }

  private getNetworkFetcher(options: FetchOptions): (url: string, init: RequestInit) => Promise<Response> {
    if (options.networkFetcher) {
      return options.networkFetcher;
    }

    return async (url: string, init: RequestInit) => {
      const fetchFn = typeof window !== 'undefined' && (window as unknown as { __originalFetch?: typeof fetch }).__originalFetch
        ? (window as unknown as { __originalFetch: typeof fetch }).__originalFetch
        : fetch;

      return fetchFn(url, init);
    };
  }

  /**
   * Fetch with caching support
   */
  async fetch(
    url: string,
    options: FetchOptions = {},
    strategy: CacheStrategy = 'cache-first'
  ): Promise<Response> {
    // SECURITY: Validate URL to prevent SSRF attacks
    // Skip validation for relative URLs (local resources) - they don't need SSRF protection
    const isRelativeUrl = url.startsWith('/') && !url.startsWith('//');
    if (!isRelativeUrl) {
      try {
        validateUrl(url, { allowHttp: false });
      } catch (error) {
        if (error instanceof SecurityError) {
          logger.error('URL validation failed', { message: error.message });
          throw new Error(`URL validation failed: ${error.message}`);
        }
        throw error;
      }
    }

    const cacheKey = options.cacheKey || url;
    const provider = await this.getProvider();

    // Handle different strategies
    switch (strategy) {
      case 'cache-only':
        return this.cacheOnly(cacheKey, provider);
      
      case 'network-only':
        return this.networkOnly(url, options);
      
      case 'network-first':
        return this.networkFirst(url, cacheKey, options, provider);
      
      case 'stale-while-revalidate':
        return this.staleWhileRevalidate(url, cacheKey, options, provider);
      
      case 'cache-first':
      default:
        return this.cacheFirst(url, cacheKey, options, provider);
    }
  }

  /**
   * Cache-first strategy
   */
  private async cacheFirst(
    url: string,
    cacheKey: string,
    options: FetchOptions,
    provider: WebCacheProvider | TauriCacheProvider
  ): Promise<Response> {
    // Skip cache if forced network
    if (!options.forceNetwork) {
      const cached = await provider.get(cacheKey);
      if (cached) {
        this.cacheStats.hits++;
        return cached;
      }
      this.cacheStats.misses++;
    }

    // Fetch from network
    return this.fetchAndCache(url, cacheKey, options, provider);
  }

  /**
   * Network-first strategy
   */
  private async networkFirst(
    url: string,
    cacheKey: string,
    options: FetchOptions,
    provider: WebCacheProvider | TauriCacheProvider
  ): Promise<Response> {
    try {
      return await this.fetchAndCache(url, cacheKey, options, provider);
    } catch (error) {
      // Network failed, try cache
      const cached = await provider.get(cacheKey);
      if (cached) {
        this.cacheStats.hits++;
        return cached;
      }
      this.cacheStats.errors++;
      throw error;
    }
  }

  /**
   * Cache-only strategy
   */
  private async cacheOnly(
    cacheKey: string,
    provider: WebCacheProvider | TauriCacheProvider
  ): Promise<Response> {
    const cached = await provider.get(cacheKey);
    if (cached) {
      this.cacheStats.hits++;
      return cached;
    }
    this.cacheStats.misses++;
    throw new Error(`Cache miss for ${cacheKey}`);
  }

  /**
   * Network-only strategy
   */
  private async networkOnly(url: string, options: FetchOptions): Promise<Response> {
    const { forceNetwork: _fn, forceCache: _fc, ttl: _ttl, cacheKey: _ck, cacheable: _ca, networkFetcher: _nf, ...fetchOptions } = options;
    void _fn; void _fc; void _ttl; void _ck; void _ca; void _nf;
    return this.getNetworkFetcher(options)(url, fetchOptions);
  }

  /**
   * Stale-while-revalidate strategy
   */
  private async staleWhileRevalidate(
    url: string,
    cacheKey: string,
    options: FetchOptions,
    provider: WebCacheProvider | TauriCacheProvider
  ): Promise<Response> {
    const cached = await provider.get(cacheKey);
    
    if (cached) {
      // Return stale cache immediately, revalidate in background
      this.fetchAndCache(url, cacheKey, options, provider).catch(() => {
        // Ignore background fetch errors
      });
      this.cacheStats.hits++;
      return cached;
    }

    // No cache, wait for network (single request, no background fetch)
    this.cacheStats.misses++;
    return this.fetchAndCache(url, cacheKey, options, provider);
  }

  /**
   * Fetch from network and cache the response
   */
  private async fetchAndCache(
    url: string,
    cacheKey: string,
    options: FetchOptions,
    provider: WebCacheProvider | TauriCacheProvider
  ): Promise<Response> {
    // Deduplicate concurrent requests
    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending.then(r => r.clone());
    }

    const { forceNetwork: _fn, forceCache: _fc, cacheKey: _ck, ttl, cacheable, networkFetcher: _nf, ...fetchOptions } = options;
    void _fn; void _fc; void _ck; void _nf;
    
    const fetchPromise = (async () => {
      try {
        const response = await this.getNetworkFetcher(options)(url, fetchOptions);
        
        if (response.ok && (cacheable || this.shouldCache(url))) {
          await provider.put(cacheKey, response.clone(), ttl);
        }
        
        return response;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Prefetch and cache a URL
   */
  async prefetch(url: string, ttl?: number): Promise<boolean> {
    try {
      await this.fetch(url, { ttl }, 'network-first');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Prefetch multiple URLs
   */
  async prefetchAll(urls: string[], ttl?: number, concurrency = 5): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(url => this.prefetch(url, ttl))
      );
      
      batch.forEach((url, index) => {
        const result = batchResults[index];
        results.set(url, result.status === 'fulfilled' && result.value);
      });
    }
    
    return results;
  }

  /**
   * Clear a specific cache entry
   */
  async delete(url: string): Promise<boolean> {
    const provider = await this.getProvider();
    return provider.delete(url);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    const provider = await this.getProvider();
    await provider.clear();
  }

  /**
   * Get cache size
   */
  async getSize(): Promise<number> {
    const provider = await this.getProvider();
    return provider.getSize();
  }

  /**
   * Get all cached URLs
   */
  async keys(): Promise<string[]> {
    const provider = await this.getProvider();
    return provider.keys();
  }

  async cleanupExpired(): Promise<number> {
    const provider = await this.getProvider();
    return provider.cleanup();
  }

  async flush(): Promise<void> {
    const provider = await this.getProvider();
    await provider.flush();
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const unifiedCache = new UnifiedCacheManager();

export function getUnifiedCacheProviderDiagnostics(): UnifiedCacheProviderDiagnostics {
  return unifiedCache.getProviderDiagnostics();
}

// ============================================================================
// Fetch Interceptor
// ============================================================================

// Store the original fetch before any interception
let originalFetch: typeof fetch | null = null;

/**
 * Get the original fetch function (before interception)
 */
export function getOriginalFetch(): typeof fetch {
  return originalFetch || fetch;
}

/**
 * Create a cached fetch function
 */
export function createCachedFetch(
  strategy: CacheStrategy = 'cache-first',
  config?: Partial<CacheConfig>
): typeof fetch {
  const cache = config ? new UnifiedCacheManager({ ...DEFAULT_CONFIG, ...config }) : unifiedCache;
  
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Only cache GET requests
    const method = init?.method?.toUpperCase() || 'GET';
    if (method !== 'GET' || !cache.shouldCache(url)) {
      // Use original fetch to avoid recursion
      return getOriginalFetch()(input, init);
    }
    
    return cache.fetch(url, init as FetchOptions, strategy);
  };
}

/**
 * Install global fetch interceptor
 */
export function installFetchInterceptor(strategy: CacheStrategy = 'cache-first'): void {
  if (typeof window === 'undefined') return;
  
  // Store original fetch only once
  if (!originalFetch) {
    originalFetch = window.fetch.bind(window);
    // Also store on window for internal use by UnifiedCacheManager
    (window as unknown as { __originalFetch: typeof fetch }).__originalFetch = originalFetch;
  }
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Never intercept .wasm files — WebAssembly.instantiateStreaming requires
    // a genuine fetch Response with correct Content-Type. Cached/cloned responses
    // break streaming compilation and can cause the WASM init to hang.
    if (url.endsWith('.wasm')) {
      return getOriginalFetch()(input, init);
    }

    // Only intercept cacheable URLs
    if (unifiedCache.shouldCache(url)) {
      const cache = unifiedCache;
      const method = init?.method?.toUpperCase() || 'GET';
      
      // Only cache GET requests
      if (method === 'GET') {
        return cache.fetch(url, init as FetchOptions, strategy);
      }
    }
    
    return getOriginalFetch()(input, init);
  };
}

export default unifiedCache;
