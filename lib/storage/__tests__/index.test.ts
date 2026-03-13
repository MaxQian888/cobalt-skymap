/**
 * @jest-environment jsdom
 */
import {
  getStorageAdapter,
  storage,
} from '../index';
import { WebStorageAdapter } from '../web-storage';
import { TauriStorageAdapter } from '../tauri-storage';
import type { ImportResult } from '../types';

// Mock Tauri APIs (needed when tauriStorageAdapter is loaded)
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));
jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: jest.fn(),
  open: jest.fn(),
}));

// Mock platform detection
jest.mock('../platform', () => ({
  isTauri: jest.fn().mockReturnValue(false),
  isServer: jest.fn().mockReturnValue(false),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const platformMock = require('../platform') as {
  isTauri: jest.Mock;
  isServer: jest.Mock;
};

const mockSetItem = localStorage.setItem as jest.Mock;
const mockRemoveItem = localStorage.removeItem as jest.Mock;

describe('Storage Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformMock.isTauri.mockReturnValue(false);
    platformMock.isServer.mockReturnValue(false);
    mockSetItem.mockImplementation(() => {});
    mockRemoveItem.mockImplementation(() => {});
  });

  // ============================================================================
  // getStorageAdapter — web
  // ============================================================================
  describe('getStorageAdapter (web)', () => {
    it('returns a web storage adapter', () => {
      const adapter = getStorageAdapter();
      expect(adapter).toBeDefined();
      expect(adapter).toBeInstanceOf(WebStorageAdapter);
    });

    it('adapter implements all StorageAdapter methods', () => {
      const adapter = getStorageAdapter();
      const methods = [
        'isAvailable', 'saveStore', 'loadStore', 'deleteStore',
        'listStores', 'exportAllData', 'importAllData',
        'getStorageStats', 'getDataDirectory', 'clearAllData',
      ];
      for (const method of methods) {
        expect(typeof (adapter as unknown as Record<string, unknown>)[method]).toBe('function');
      }
    });
  });

  // ============================================================================
  // getStorageAdapter — Tauri
  // ============================================================================
  describe('getStorageAdapter (Tauri)', () => {
    it('returns a Tauri storage adapter', () => {
      platformMock.isTauri.mockReturnValue(true);
      const adapter = getStorageAdapter();
      expect(adapter).toBeInstanceOf(TauriStorageAdapter);
    });
  });

  // ============================================================================
  // getStorageAdapter — SSR
  // ============================================================================
  describe('getStorageAdapter (SSR)', () => {
    beforeEach(() => {
      platformMock.isServer.mockReturnValue(true);
    });

    it('returns a no-op adapter', () => {
      const adapter = getStorageAdapter();
      expect(adapter.isAvailable()).toBe(false);
    });

    it('saveStore is a no-op', async () => {
      const adapter = getStorageAdapter();
      await expect(adapter.saveStore('test', 'data')).resolves.toBeUndefined();
    });

    it('loadStore returns null', async () => {
      const adapter = getStorageAdapter();
      const result = await adapter.loadStore('test');
      expect(result).toBeNull();
    });

    it('deleteStore returns false', async () => {
      const adapter = getStorageAdapter();
      const result = await adapter.deleteStore('test');
      expect(result).toBe(false);
    });

    it('listStores returns empty array', async () => {
      const adapter = getStorageAdapter();
      const stores = await adapter.listStores();
      expect(stores).toEqual([]);
    });

    it('exportAllData is a no-op', async () => {
      const adapter = getStorageAdapter();
      await expect(adapter.exportAllData()).resolves.toBeUndefined();
    });

    it('importAllData returns error result', async () => {
      const adapter = getStorageAdapter();
      const result = await adapter.importAllData();
      expect(result.imported_count).toBe(0);
      expect(result.skipped_count).toBe(0);
      expect(result.errors).toContain('Not available on server');
      expect(result.metadata.version).toBe('0');
    });

    it('getStorageStats returns empty stats', async () => {
      const adapter = getStorageAdapter();
      const stats = await adapter.getStorageStats();
      expect(stats.total_size).toBe(0);
      expect(stats.store_count).toBe(0);
      expect(stats.stores).toEqual([]);
      expect(stats.directory).toBe('');
    });

    it('getDataDirectory returns empty string', async () => {
      const adapter = getStorageAdapter();
      const dir = await adapter.getDataDirectory();
      expect(dir).toBe('');
    });

    it('clearAllData returns 0', async () => {
      const adapter = getStorageAdapter();
      const count = await adapter.clearAllData();
      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // storage unified API — method presence
  // ============================================================================
  describe('storage unified API', () => {
    it('has all expected methods', () => {
      const methods = [
        'isAvailable', 'saveStore', 'loadStore', 'deleteStore',
        'listStores', 'exportAllData', 'importAllData',
        'getStorageStats', 'getDataDirectory', 'clearAllData',
      ];
      for (const method of methods) {
        expect(typeof (storage as unknown as Record<string, unknown>)[method]).toBe('function');
      }
    });
  });

  // ============================================================================
  // storage unified API — delegation
  // ============================================================================
  describe('storage delegation (web)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('isAvailable returns boolean', () => {
      expect(typeof storage.isAvailable()).toBe('boolean');
    });

    it('saveStore delegates to adapter', async () => {
      await storage.saveStore('test-store', '{"key":"value"}');
      expect(mockSetItem).toHaveBeenCalledWith('test-store', '{"key":"value"}');
    });

    it('loadStore delegates to adapter', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('{"data":1}');
      const result = await storage.loadStore('test-store');
      expect(result).toBe('{"data":1}');
    });

    it('deleteStore delegates to adapter', async () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      const result = await storage.deleteStore('non-existent');
      expect(typeof result).toBe('boolean');
    });

    it('listStores delegates to adapter', async () => {
      const stores = await storage.listStores();
      expect(Array.isArray(stores)).toBe(true);
    });

    it('exportAllData delegates path to the adapter', async () => {
      const exportSpy = jest
        .spyOn(WebStorageAdapter.prototype, 'exportAllData')
        .mockResolvedValue(undefined);

      await storage.exportAllData('/tmp/skymap-backup.json');

      expect(exportSpy).toHaveBeenCalledWith('/tmp/skymap-backup.json');
    });

    it('importAllData delegates payload to the adapter', async () => {
      const importResult: ImportResult = {
        imported_count: 1,
        skipped_count: 0,
        errors: [],
        metadata: {
          version: '1.0',
          exported_at: '2026-03-13T00:00:00.000Z',
          app_version: '0.1.0',
          store_count: 1,
        },
      };
      const importSpy = jest
        .spyOn(WebStorageAdapter.prototype, 'importAllData')
        .mockResolvedValue(importResult);

      const result = await storage.importAllData('{"stores":{}}');

      expect(importSpy).toHaveBeenCalledWith('{"stores":{}}');
      expect(result).toEqual(importResult);
    });

    it('getStorageStats delegates to adapter', async () => {
      Object.defineProperty(localStorage, 'length', { value: 0, configurable: true });
      const stats = await storage.getStorageStats();
      expect(stats).toHaveProperty('total_size');
      expect(stats).toHaveProperty('store_count');
      expect(stats).toHaveProperty('stores');
      expect(stats).toHaveProperty('directory');
    });

    it('getDataDirectory delegates to adapter', async () => {
      const dir = await storage.getDataDirectory();
      expect(dir).toBe('localStorage');
    });

    it('clearAllData delegates to adapter', async () => {
      Object.defineProperty(localStorage, 'length', { value: 0, configurable: true });
      const count = await storage.clearAllData();
      expect(typeof count).toBe('number');
    });
  });
});
