/**
 * Tauri Storage Adapter
 * Uses Rust backend for file-based persistent storage in desktop applications
 */

import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { StorageAdapter, ImportResult, StorageStats } from './types';
import { isTauri } from './platform';

/**
 * Tauri storage adapter using Rust backend
 */
export class TauriStorageAdapter implements StorageAdapter {
  isAvailable(): boolean {
    return isTauri();
  }

  async saveStore(storeName: string, data: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Tauri is not available');
    }
    await invoke('save_store_data', { storeName, data });
  }

  async loadStore(storeName: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }
    return invoke<string | null>('load_store_data', { storeName });
  }

  async deleteStore(storeName: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return invoke<boolean>('delete_store_data', { storeName });
  }

  async listStores(): Promise<string[]> {
    if (!this.isAvailable()) {
      return [];
    }
    return invoke<string[]>('list_stores');
  }

  async exportAllData(path?: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Tauri is not available');
    }

    let exportPath = path;

    if (!exportPath) {
      // Open save dialog
      const selectedPath = await save({
        title: 'Export Cobalt Skymap Data',
        defaultPath: `skymap-backup-${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      });

      if (!selectedPath) {
        throw new Error('Export cancelled');
      }
      exportPath = selectedPath;
    }

    await invoke('export_all_data', { exportPath });
  }

  async importAllData(path?: string): Promise<ImportResult> {
    if (!this.isAvailable()) {
      throw new Error('Tauri is not available');
    }

    let importPath = path;

    if (!importPath) {
      // Open file dialog
      const selectedPath = await open({
        title: 'Import Cobalt Skymap Data',
        multiple: false,
        filters: [
          {
            name: 'JSON',
            extensions: ['json'],
          },
        ],
      });

      if (!selectedPath) {
        throw new Error('Import cancelled');
      }
      importPath = selectedPath as string;
    }

    return invoke<ImportResult>('import_all_data', { importPath });
  }

  async getStorageStats(): Promise<StorageStats> {
    if (!this.isAvailable()) {
      return {
        total_size: 0,
        store_count: 0,
        stores: [],
        directory: '',
      };
    }
    return invoke<StorageStats>('get_storage_stats');
  }

  async getDataDirectory(): Promise<string> {
    if (!this.isAvailable()) {
      return '';
    }
    return invoke<string>('get_data_directory');
  }

  async clearAllData(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }
    return invoke<number>('clear_all_data');
  }
}

/**
 * Singleton instance
 */
export const tauriStorageAdapter = new TauriStorageAdapter();
