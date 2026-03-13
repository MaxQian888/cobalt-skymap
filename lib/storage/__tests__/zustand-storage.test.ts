/**
 * Tests for zustand-storage.ts
 * Unified Zustand persist storage adapter
 */

const mockIsTauri = jest.fn().mockReturnValue(false);
const mockIsServer = jest.fn().mockReturnValue(false);
const mockInvoke = jest.fn();
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Default: web mode
jest.mock('../platform', () => ({
  isTauri: (...args: unknown[]) => mockIsTauri(...args),
  isServer: (...args: unknown[]) => mockIsServer(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => mockLogger,
}));

jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createZustandStorage, getZustandStorage } = require('../zustand-storage') as
  typeof import('../zustand-storage');

const mockGetItem = localStorage.getItem as jest.Mock;
const mockSetItem = localStorage.setItem as jest.Mock;
const mockRemoveItem = localStorage.removeItem as jest.Mock;

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

// ============================================================================
// Web mode
// ============================================================================
describe('createZustandStorage (web mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockIsServer.mockReturnValue(false);
  });

  it('should return storage with getItem, setItem, removeItem', () => {
    const storage = createZustandStorage();
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('should persist and retrieve data via localStorage', () => {
    const store = new Map<string, string>();
    mockSetItem.mockImplementation((k: string, v: string) => store.set(k, v));
    mockGetItem.mockImplementation((k: string) => store.get(k) ?? null);

    const storage = createZustandStorage<{ count: number }>();
    const value = { state: { count: 42 }, version: 0 };
    storage.setItem('test-store', value);
    const retrieved = storage.getItem('test-store');
    expect(retrieved).toEqual(value);
  });

  it('should return null for non-existent key', () => {
    mockGetItem.mockReturnValue(null);
    const storage = createZustandStorage();
    expect(storage.getItem('nonexistent')).toBeNull();
  });

  it('should return null for invalid JSON in localStorage', () => {
    mockGetItem.mockReturnValue('not-valid-json{{{');
    const storage = createZustandStorage();
    expect(storage.getItem('bad-json')).toBeNull();
  });

  it('should call removeItem on localStorage', () => {
    mockRemoveItem.mockImplementation(() => {});
    const storage = createZustandStorage();
    storage.removeItem('test');
    expect(mockRemoveItem).toHaveBeenCalledWith('test');
  });

  it('should not throw when setItem fails', () => {
    mockSetItem.mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const storage = createZustandStorage<{ count: number }>();
    // Should not throw
    expect(() => {
      storage.setItem('test', { state: { count: 1 }, version: 0 });
    }).not.toThrow();
  });

  it('should not throw when removeItem fails', () => {
    mockRemoveItem.mockImplementation(() => {
      throw new Error('Error');
    });
    const storage = createZustandStorage();
    expect(() => {
      storage.removeItem('test');
    }).not.toThrow();
  });
});

// ============================================================================
// Server mode
// ============================================================================
describe('createZustandStorage (server mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockIsServer.mockReturnValue(true);
  });

  afterEach(() => {
    mockIsServer.mockReturnValue(false);
  });

  it('should return no-op storage', () => {
    const storage = createZustandStorage();
    expect(storage.getItem('test')).toBeNull();
  });

  it('setItem should be a no-op', () => {
    const storage = createZustandStorage();
    // Should not throw or do anything
    expect(() => {
      storage.setItem('test', { state: {}, version: 0 });
    }).not.toThrow();
  });

  it('removeItem should be a no-op', () => {
    const storage = createZustandStorage();
    expect(() => {
      storage.removeItem('test');
    }).not.toThrow();
  });
});

// ============================================================================
// Tauri mode
// ============================================================================
describe('createZustandStorage (Tauri mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockIsServer.mockReturnValue(false);
    // Mock localStorage for migration testing
    mockGetItem.mockReturnValue(null);
    mockSetItem.mockImplementation(() => {});
    mockRemoveItem.mockImplementation(() => {});
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    mockIsTauri.mockReturnValue(false);
    jest.useRealTimers();
  });

  it('should ignore per-store initialization failures', async () => {
    mockInvoke.mockImplementation((command: string, payload?: { storeName?: string }) => {
      if (command === 'load_store_data' && payload?.storeName === 'starmap-target-list') {
        return Promise.reject(new Error('load failed'));
      }
      return Promise.resolve(null);
    });

    const storage = createZustandStorage();
    await flushAsyncWork();

    expect(mockInvoke).toHaveBeenCalledWith('load_store_data', {
      storeName: 'starmap-target-list',
    });
    expect(storage.getItem('starmap-target-list')).toBeNull();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return storage with all methods', () => {
    const storage = createZustandStorage();
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('getItem should return null when no cache and no localStorage data', () => {
    const storage = createZustandStorage();
    const result = storage.getItem('nonexistent');
    expect(result).toBeNull();
  });

  it('getItem should migrate from localStorage when data exists', () => {
    const localData = JSON.stringify({ state: { theme: 'dark' }, version: 1 });
    mockGetItem.mockReturnValue(localData);

    const storage = createZustandStorage<{ theme: string }>();
    const result = storage.getItem('starmap-settings');

    expect(result).toEqual({ state: { theme: 'dark' }, version: 1 });
    // Should remove from localStorage after migration
    expect(mockRemoveItem).toHaveBeenCalledWith('starmap-settings');
  });

  it('setItem should update cache immediately', () => {
    jest.useFakeTimers();
    const storage = createZustandStorage<{ count: number }>();
    const value = { state: { count: 42 }, version: 0 };

    storage.setItem('test-store', value);

    // Should be readable from cache immediately
    const retrieved = storage.getItem('test-store');
    expect(retrieved).toEqual(value);

    jest.useRealTimers();
  });

  it('removeItem should clear from cache', () => {
    jest.useFakeTimers();
    const storage = createZustandStorage<{ count: number }>();

    // Set then remove
    storage.setItem('test-store', { state: { count: 1 }, version: 0 });
    storage.removeItem('test-store');

    // localStorage migration returns null since we've set mockGetItem to return null
    const result = storage.getItem('test-store');
    expect(result).toBeNull();

    jest.useRealTimers();
  });

  it('getItem should handle invalid JSON in localStorage gracefully', () => {
    mockGetItem.mockReturnValue('not-valid-json');
    const storage = createZustandStorage();
    // Should not throw, should return null
    const result = storage.getItem('bad-json');
    expect(result).toBeNull();
  });

  it('setItem should persist debounced data to the Tauri backend', async () => {
    jest.useFakeTimers();

    const storage = createZustandStorage<{ count: number }>();
    const value = { state: { count: 7 }, version: 1 };

    storage.setItem('starmap-settings', value);
    await jest.advanceTimersByTimeAsync(100);

    expect(mockInvoke).toHaveBeenCalledWith('save_store_data', {
      storeName: 'starmap-settings',
      data: JSON.stringify(value),
    });
  });

  it('setItem should log when a Tauri save fails', async () => {
    jest.useFakeTimers();
    mockInvoke.mockRejectedValue(new Error('save failed'));

    const storage = createZustandStorage<{ count: number }>();
    storage.setItem('failed-store', { state: { count: 3 }, version: 0 });

    await jest.advanceTimersByTimeAsync(100);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to save failed-store to Tauri',
      expect.any(Error)
    );
  });

  it('setItem should log when a value cannot be serialized', async () => {
    jest.useFakeTimers();

    const storage = createZustandStorage<unknown>();
    storage.setItem('unserializable-store', undefined as never);

    await jest.advanceTimersByTimeAsync(100);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to serialize unserializable-store: value is undefined'
    );
  });

  it('removeItem should log when deleting from Tauri fails', async () => {
    mockInvoke.mockRejectedValue(new Error('delete failed'));

    const storage = createZustandStorage();
    storage.removeItem('starmap-settings');
    await flushAsyncWork();

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to delete starmap-settings from Tauri',
      expect.any(Error)
    );
  });
});

// ============================================================================
// getZustandStorage
// ============================================================================
describe('getZustandStorage', () => {
  beforeEach(() => {
    mockIsTauri.mockReturnValue(false);
    mockIsServer.mockReturnValue(false);
  });

  it('should return a cached storage instance', () => {
    const s1 = getZustandStorage();
    const s2 = getZustandStorage();
    expect(s1).toBe(s2);
  });

  it('should have all required methods', () => {
    const storage = getZustandStorage();
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });
});
