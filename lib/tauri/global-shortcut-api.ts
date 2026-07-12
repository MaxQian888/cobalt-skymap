/**
 * Global Shortcut API (desktop only)
 *
 * Safe wrapper around @tauri-apps/plugin-global-shortcut with no-op fallback
 * outside Tauri desktop runtime.
 */

import { createLogger } from '@/lib/logger';
import { isDesktop, isTauri } from '@/lib/storage/platform';

const logger = createLogger('global-shortcut-api');

// The global-shortcut plugin is only registered in the desktop Rust build.
function isDesktopTauri(): boolean {
  return isTauri() && isDesktop();
}

export interface GlobalShortcutEvent {
  shortcut: string;
  id: number;
  state: 'Released' | 'Pressed';
}

export type GlobalShortcutHandler = (event: GlobalShortcutEvent) => void;

type ShortcutPlugin = typeof import('@tauri-apps/plugin-global-shortcut');

async function getShortcutPlugin(): Promise<ShortcutPlugin | null> {
  if (!isDesktopTauri()) {
    return null;
  }
  return await import('@tauri-apps/plugin-global-shortcut');
}

export const globalShortcutApi = {
  isAvailable(): boolean {
    return isDesktopTauri();
  },

  async register(shortcut: string, handler: GlobalShortcutHandler): Promise<boolean> {
    const plugin = await getShortcutPlugin();
    if (!plugin) {
      logger.debug('Skipping global shortcut registration outside Tauri', { shortcut });
      return false;
    }
    await plugin.register(shortcut, handler);
    return true;
  },

  async listen(shortcut: string, handler: GlobalShortcutHandler): Promise<boolean> {
    return this.register(shortcut, handler);
  },

  async unregister(shortcut: string): Promise<boolean> {
    const plugin = await getShortcutPlugin();
    if (!plugin) {
      logger.debug('Skipping global shortcut unregister outside Tauri', { shortcut });
      return false;
    }
    await plugin.unregister(shortcut);
    return true;
  },

  async unregisterAll(): Promise<boolean> {
    const plugin = await getShortcutPlugin();
    if (!plugin) {
      logger.debug('Skipping global shortcut unregisterAll outside Tauri');
      return false;
    }
    await plugin.unregisterAll();
    return true;
  },

  async isRegistered(shortcut: string): Promise<boolean> {
    const plugin = await getShortcutPlugin();
    if (!plugin) {
      return false;
    }
    return await plugin.isRegistered(shortcut);
  },
};

export default globalShortcutApi;

