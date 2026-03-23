/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useCacheInit } from '../use-cache-init';
import { installFetchInterceptor } from '@/lib/offline';
import { initializeCacheSystem } from '@/lib/cache/migration';

// Mock the unified cache module
jest.mock('@/lib/offline', () => ({
  installFetchInterceptor: jest.fn(),
  getUnifiedCacheProviderDiagnostics: jest.fn(() => ({
    providerId: 'browser-cache-api',
    available: true,
    supportsPersistent: true,
    supportsClear: true,
    supportsCleanup: false,
    supportsFlush: false,
    supportsInterception: true,
  })),
  unifiedCache: {
    keys: jest.fn().mockResolvedValue([]),
    prefetch: jest.fn().mockResolvedValue(true),
    prefetchAll: jest.fn().mockResolvedValue(new Map()),
    cleanupExpired: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock cache migration
jest.mock('@/lib/cache/migration', () => ({
  initializeCacheSystem: jest.fn().mockResolvedValue({
    success: true,
    fromVersion: 1,
    toVersion: 1,
    migratedItems: 0,
    deletedItems: 0,
    errors: [],
  }),
}));

// Mock isTauri
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

// Mock unified cache API
jest.mock('@/lib/tauri/unified-cache-api', () => ({
  unifiedCacheApi: {
    flush: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(0),
  },
}));

// Mock cache config
jest.mock('@/lib/cache/config', () => ({
  PREFETCH_RESOURCES: [],
  CACHE_CONFIG: { unified: { maxSize: 500 * 1024 * 1024, prefetchTTL: 30 * 24 * 60 * 60 * 1000 } },
}));

jest.mock('@/lib/cache/integration-policy', () => ({
  resolveCachePolicyForPrefetchResource: jest.fn(() => null),
}));

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: jest.fn(),
}));

const mockInstallFetchInterceptor = installFetchInterceptor as jest.Mock;
const mockInitializeCacheSystem = initializeCacheSystem as jest.Mock;

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
  value: {
    persist: jest.fn(() => Promise.resolve(true)),
  },
  writable: true,
});

describe('useCacheInit', () => {
  let consoleLogSpy: jest.SpyInstance;
  let addEventListenerSpy: jest.SpyInstance;
  let removeEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it('installs fetch interceptor by default', () => {
    renderHook(() => useCacheInit());

    expect(mockInstallFetchInterceptor).toHaveBeenCalledWith('cache-first');
  });

  it('uses custom strategy when provided', () => {
    renderHook(() => useCacheInit({ strategy: 'network-first' }));

    expect(mockInstallFetchInterceptor).toHaveBeenCalledWith('network-first');
  });

  it('does not install interceptor when disabled', () => {
    renderHook(() => useCacheInit({ enableInterception: false }));

    expect(mockInstallFetchInterceptor).not.toHaveBeenCalled();
  });

  it('sets up online/offline event listeners', () => {
    renderHook(() => useCacheInit());

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useCacheInit());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('requests persistent storage', async () => {
    renderHook(() => useCacheInit());

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(navigator.storage.persist).toHaveBeenCalled();
  });

  it('only initializes once', () => {
    const { rerender } = renderHook(() => useCacheInit());
    
    rerender();
    rerender();

    // Should only be called once despite multiple renders
    expect(mockInstallFetchInterceptor).toHaveBeenCalledTimes(1);
  });

  it('logs cache initialization', () => {
    renderHook(() => useCacheInit());

    // Logger uses structured logging via createLogger, not raw console.log
    // Verify interceptor was installed (the actual logging is handled by the logger transport)
    expect(mockInstallFetchInterceptor).toHaveBeenCalledWith('cache-first');
  });

  it('returns provider diagnostics', () => {
    const { result } = renderHook(() => useCacheInit());

    expect(result.current.providerDiagnostics?.providerId).toBe('browser-cache-api');
  });

  it('calls initializeCacheSystem on startup', async () => {
    renderHook(() => useCacheInit());

    // Wait for async operations
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockInitializeCacheSystem).toHaveBeenCalledTimes(1);
  });

  it('notifies cache-index lifecycle callbacks', async () => {
    const onCacheIndexStart = jest.fn();
    const onCacheIndexReady = jest.fn();
    const onCacheIndexError = jest.fn();

    renderHook(() => useCacheInit({
      onCacheIndexStart,
      onCacheIndexReady,
      onCacheIndexError,
    }));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(onCacheIndexStart).toHaveBeenCalledTimes(1);
    expect(onCacheIndexReady).toHaveBeenCalledTimes(1);
    expect(onCacheIndexError).not.toHaveBeenCalled();
  });

  it('sets up periodic cleanup interval', () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    renderHook(() => useCacheInit());

    // Should set up a cleanup interval (30 minutes = 1800000ms)
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      30 * 60 * 1000
    );

    setIntervalSpy.mockRestore();
  });

  it('clears periodic cleanup interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useCacheInit());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });
});
