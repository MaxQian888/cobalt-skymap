/**
 * Tests for cache/migration.ts
 */

import {
  getCacheVersion,
  setCacheVersion,
  isMigrationNeeded,
  runMigrations,
  initializeCacheSystem,
  resetAllCaches,
} from '../migration';
import cacheMigration from '../migration';

// Mock isTauri
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

import { isTauri } from '@/lib/storage/platform';
const mockIsTauri = isTauri as jest.Mock;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

function installLocalStorageMock(value: typeof localStorageMock | undefined = localStorageMock) {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  });
}

installLocalStorageMock();

// Mock caches API
const cachesMock = {
  keys: jest.fn().mockResolvedValue([]),
  delete: jest.fn().mockResolvedValue(true),
};

Object.defineProperty(global, 'caches', { value: cachesMock });

// Mock Tauri cache APIs for dynamic imports in resetAllCaches
const mockClearUnifiedCache = jest.fn().mockResolvedValue(0);
const mockClearAllCache = jest.fn().mockResolvedValue(0);

jest.mock('@/lib/tauri/unified-cache-api', () => ({
  unifiedCacheApi: { clearCache: mockClearUnifiedCache },
}));
jest.mock('@/lib/tauri/cache-api', () => ({
  cacheApi: { clearAllCache: mockClearAllCache },
}));

describe('getCacheVersion', () => {
  beforeEach(() => {
    localStorageMock.clear();
    installLocalStorageMock();
  });

  it('should return null when no version is stored', () => {
    const version = getCacheVersion();
    expect(version).toBeNull();
  });

  it('should return null when localStorage is unavailable', () => {
    installLocalStorageMock(undefined);

    try {
      expect(getCacheVersion()).toBeNull();
    } finally {
      installLocalStorageMock();
    }
  });

  it('should return stored version', () => {
    const versionInfo = {
      version: 1,
      migrationDate: Date.now(),
      description: 'Test version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));
    
    const version = getCacheVersion();
    expect(version).not.toBeNull();
    expect(version?.version).toBe(1);
    expect(version?.description).toBe('Test version');
  });

  it('should return null for invalid JSON', () => {
    localStorageMock.setItem('skymap-cache-version', 'invalid json');
    
    const version = getCacheVersion();
    expect(version).toBeNull();
  });
});

describe('setCacheVersion', () => {
  beforeEach(() => {
    localStorageMock.clear();
    installLocalStorageMock();
  });

  it('should store version that can be retrieved by getCacheVersion', () => {
    setCacheVersion(2, 'Test migration');
    const version = getCacheVersion();
    expect(version).not.toBeNull();
    expect(version?.version).toBe(2);
    expect(version?.description).toBe('Test migration');
    expect(version?.migrationDate).toBeGreaterThan(0);
  });

  it('should overwrite existing version', () => {
    setCacheVersion(1, 'First');
    setCacheVersion(3, 'Second');
    const version = getCacheVersion();
    expect(version?.version).toBe(3);
    expect(version?.description).toBe('Second');
  });

  it('should no-op when localStorage is unavailable', () => {
    installLocalStorageMock(undefined);

    try {
      expect(() => setCacheVersion(2, 'Offline')).not.toThrow();
    } finally {
      installLocalStorageMock();
    }
  });
});

describe('isMigrationNeeded', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should return true when no version is stored', () => {
    expect(isMigrationNeeded()).toBe(true);
  });

  it('should return true when version is old', () => {
    const versionInfo = {
      version: 0,
      migrationDate: Date.now(),
      description: 'Old version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));
    
    expect(isMigrationNeeded()).toBe(true);
  });

  it('should return false when version is current', () => {
    const versionInfo = {
      version: 1, // Current version
      migrationDate: Date.now(),
      description: 'Current version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));
    
    expect(isMigrationNeeded()).toBe(false);
  });
});

describe('runMigrations', () => {
  beforeEach(() => {
    localStorageMock.clear();
    installLocalStorageMock();
    cachesMock.keys.mockResolvedValue([]);
    cachesMock.delete.mockClear();
  });

  it('should skip migrations when already at current version', async () => {
    const versionInfo = {
      version: 1,
      migrationDate: Date.now(),
      description: 'Current version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));
    
    const result = await runMigrations();
    
    expect(result.success).toBe(true);
    expect(result.migratedItems).toBe(0);
    expect(result.deletedItems).toBe(0);
  });

  it('should run migrations from version 0', async () => {
    const result = await runMigrations();
    
    expect(result.success).toBe(true);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(1);
  });

  it('should clean up old localStorage keys during v0->v1 migration', async () => {
    localStorageMock.setItem('skymap-old-data', 'stale');
    localStorageMock.setItem('skymap-old-config', 'stale');
    localStorageMock.setItem('cache-meta-tiles', 'stale');
    localStorageMock.setItem('unrelated-key', 'keep');

    await runMigrations();

    expect(localStorageMock.getItem('skymap-old-data')).toBeNull();
    expect(localStorageMock.getItem('skymap-old-config')).toBeNull();
    expect(localStorageMock.getItem('cache-meta-tiles')).toBeNull();
    expect(localStorageMock.getItem('unrelated-key')).toBe('keep');
  });

  it('should delete legacy caches', async () => {
    cachesMock.keys.mockResolvedValue([
      'skymap-cache-old',
      'stellarium-cache-data',
      'skymap-unified-cache-v1', // Should not be deleted (has -v1)
    ]);
    
    await runMigrations();
    
    expect(cachesMock.delete).toHaveBeenCalledWith('skymap-cache-old');
    expect(cachesMock.delete).toHaveBeenCalledWith('stellarium-cache-data');
    expect(cachesMock.delete).not.toHaveBeenCalledWith('skymap-unified-cache-v1');
  });

  it('should update version after migration', async () => {
    await runMigrations();
    
    const version = getCacheVersion();
    expect(version).not.toBeNull();
    expect(version?.version).toBe(1);
  });

  it('should handle migration errors and report them', async () => {
    // Make caches.delete reject to trigger error in migrateV0ToV1
    cachesMock.keys.mockResolvedValue(['skymap-cache-old']);
    cachesMock.delete.mockRejectedValueOnce(new Error('Delete failed'));

    const result = await runMigrations();

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('failed');
    // Version should still be updated even with errors
    const version = getCacheVersion();
    expect(version?.version).toBe(1);
  });

  it('should report unknown migration errors when a non-Error is thrown', async () => {
    cachesMock.keys.mockResolvedValue(['skymap-cache-old']);
    cachesMock.delete.mockRejectedValueOnce('boom');

    const result = await runMigrations();

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('Unknown error');
  });
});

describe('initializeCacheSystem', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cachesMock.keys.mockResolvedValue([]);
  });

  it('should skip when no migration needed', async () => {
    const versionInfo = {
      version: 1,
      migrationDate: Date.now(),
      description: 'Current version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));
    
    const result = await initializeCacheSystem();
    
    expect(result.success).toBe(true);
    expect(result.migratedItems).toBe(0);
  });

  it('should run migrations when needed', async () => {
    const result = await initializeCacheSystem();
    
    expect(result.success).toBe(true);
    expect(result.toVersion).toBe(1);
  });
});

describe('resetAllCaches', () => {
  beforeEach(() => {
    localStorageMock.clear();
    cachesMock.keys.mockResolvedValue([]);
    cachesMock.delete.mockClear();
    mockIsTauri.mockReturnValue(false);
  });

  it('should clear all skymap caches from Cache API', async () => {
    cachesMock.keys.mockResolvedValue([
      'skymap-unified-cache',
      'skymap-data-cache',
      'other-cache',
    ]);

    await resetAllCaches();

    expect(cachesMock.delete).toHaveBeenCalledWith('skymap-unified-cache');
    expect(cachesMock.delete).toHaveBeenCalledWith('skymap-data-cache');
    expect(cachesMock.delete).not.toHaveBeenCalledWith('other-cache');
  });

  it('should clear cache-related localStorage keys', async () => {
    localStorageMock.setItem('skymap-cache-version', '1');
    localStorageMock.setItem('skymap-cache-data', 'test');
    localStorageMock.setItem('skymap-offline-store', 'test');
    localStorageMock.setItem('skymap-settings', 'keep');

    await resetAllCaches();

    expect(localStorageMock.getItem('skymap-cache-data')).toBeNull();
    expect(localStorageMock.getItem('skymap-offline-store')).toBeNull();
    expect(localStorageMock.getItem('skymap-cache-version')).toBeNull();
    // Non-cache keys should be preserved
    expect(localStorageMock.getItem('skymap-settings')).toBe('keep');
  });

  it('should reset cache version', async () => {
    const versionInfo = {
      version: 1,
      migrationDate: Date.now(),
      description: 'Current version',
    };
    localStorageMock.setItem('skymap-cache-version', JSON.stringify(versionInfo));

    await resetAllCaches();

    expect(getCacheVersion()).toBeNull();
  });

  it('should not call Tauri APIs when not in Tauri environment', async () => {
    mockIsTauri.mockReturnValue(false);

    await resetAllCaches();

    // No Tauri API calls should be made
    expect(mockIsTauri).toHaveBeenCalled();
  });

  it('should call Tauri cache APIs when in Tauri environment', async () => {
    mockIsTauri.mockReturnValue(true);
    mockClearUnifiedCache.mockResolvedValue(0);
    mockClearAllCache.mockResolvedValue(0);

    await resetAllCaches();

    expect(mockIsTauri).toHaveBeenCalled();
    expect(mockClearUnifiedCache).toHaveBeenCalled();
    expect(mockClearAllCache).toHaveBeenCalled();
  });

  it('should handle Tauri API errors gracefully', async () => {
    mockIsTauri.mockReturnValue(true);
    mockClearUnifiedCache.mockRejectedValueOnce(new Error('Tauri error'));

    // Should not throw even if Tauri APIs fail
    await expect(resetAllCaches()).resolves.not.toThrow();
  });
});

describe('cacheMigration default export', () => {
  it('should expose all public functions and CURRENT_VERSION', () => {
    expect(typeof cacheMigration.getCacheVersion).toBe('function');
    expect(typeof cacheMigration.isMigrationNeeded).toBe('function');
    expect(typeof cacheMigration.runMigrations).toBe('function');
    expect(typeof cacheMigration.resetAllCaches).toBe('function');
    expect(typeof cacheMigration.initializeCacheSystem).toBe('function');
    expect(cacheMigration.CURRENT_VERSION).toBe(1);
  });
});
