/**
 * Unit tests for app-control-api.ts
 * Tests application control functionality including restart, quit, and reload
 */

import {
  isTauri,
  restartApp,
  quitApp,
  reloadWebview,
  isDevMode,
  closeWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  saveWindowState,
  restoreWindowState,
  startWindowDragging,
} from '../app-control-api';

type TauriGlobal = typeof globalThis & { __TAURI__?: unknown };
const tauriGlobal = globalThis as TauriGlobal;

// Mock Tauri API
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock Tauri window API
const mockMinimize = jest.fn();
const mockClose = jest.fn();
const mockToggleMaximize = jest.fn();
const mockIsMaximized = jest.fn();
const mockStartDragging = jest.fn();
const mockPluginSaveWindowState = jest.fn();
const mockRestoreStateCurrent = jest.fn();

jest.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    minimize: mockMinimize,
    close: mockClose,
    toggleMaximize: mockToggleMaximize,
    isMaximized: mockIsMaximized,
    startDragging: mockStartDragging,
  }),
}));

jest.mock('@tauri-apps/plugin-window-state', () => ({
  StateFlags: {
    ALL: 'all',
  },
  saveWindowState: (...args: unknown[]) => mockPluginSaveWindowState(...args),
  restoreStateCurrent: (...args: unknown[]) => mockRestoreStateCurrent(...args),
}));

describe('app-control-api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tauriGlobal.__TAURI__ = {};
  });

  afterEach(() => {
    delete tauriGlobal.__TAURI__;
  });

  describe('isTauri', () => {
    it('should return true when __TAURI__ is present in window', () => {
      expect(isTauri()).toBe(true);
    });

    it('should return false when __TAURI__ is not present', () => {
      delete tauriGlobal.__TAURI__;
      expect(isTauri()).toBe(false);
    });

    it('should return false when not in Tauri mode', () => {
      delete tauriGlobal.__TAURI__;
      expect(isTauri()).toBe(false);
    });
  });

  describe('restartApp', () => {
    it('should call invoke with restart_app command in Tauri environment', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await restartApp();

      expect(mockInvoke).toHaveBeenCalledWith('restart_app');
    });

    it('should not call invoke in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      await restartApp();

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should handle invoke errors gracefully', async () => {
      const error = new Error('Restart failed');
      mockInvoke.mockRejectedValueOnce(error);

      await expect(restartApp()).rejects.toThrow('Restart failed');
    });
  });

  describe('quitApp', () => {
    it('should call invoke with quit_app command and default exit code', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await quitApp();

      expect(mockInvoke).toHaveBeenCalledWith('quit_app', { exitCode: undefined });
    });

    it('should call invoke with specified exit code', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await quitApp(1);

      expect(mockInvoke).toHaveBeenCalledWith('quit_app', { exitCode: 1 });
    });

    it('should not call invoke in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      await quitApp();

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('reloadWebview', () => {
    it('should call invoke with reload_webview command in Tauri environment', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await reloadWebview();

      expect(mockInvoke).toHaveBeenCalledWith('reload_webview');
    });

    it('should reload window.location in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      await reloadWebview();

      expect(mockInvoke).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('isDevMode', () => {
    it('should call invoke with is_dev_mode command in Tauri environment', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      const result = await isDevMode();

      expect(mockInvoke).toHaveBeenCalledWith('is_dev_mode');
      expect(result).toBe(true);
    });

    it('should return true for localhost in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      const result = await isDevMode();

      expect(result).toBe(true);
    });

    it('should return a boolean in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      const result = await isDevMode();

      expect(typeof result).toBe('boolean');
    });
  });

  describe('closeWindow', () => {
    it('should call window.close() in Tauri environment', async () => {
      mockClose.mockResolvedValueOnce(undefined);

      await closeWindow();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should not call close in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      await closeWindow();

      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe('minimizeWindow', () => {
    it('should call window.minimize() in Tauri environment', async () => {
      mockMinimize.mockResolvedValueOnce(undefined);

      await minimizeWindow();

      expect(mockMinimize).toHaveBeenCalled();
    });

    it('should not call minimize in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      await minimizeWindow();

      expect(mockMinimize).not.toHaveBeenCalled();
    });
  });

  describe('toggleMaximizeWindow', () => {
    it('should call window.toggleMaximize() in Tauri environment', async () => {
      mockToggleMaximize.mockResolvedValueOnce(undefined);

      await toggleMaximizeWindow();

      expect(mockToggleMaximize).toHaveBeenCalled();
    });

    it('should not call toggleMaximize in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      await toggleMaximizeWindow();

      expect(mockToggleMaximize).not.toHaveBeenCalled();
    });
  });

  describe('isWindowMaximized', () => {
    it('should return maximized state in Tauri environment', async () => {
      mockIsMaximized.mockResolvedValueOnce(true);

      const result = await isWindowMaximized();

      expect(mockIsMaximized).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when window is not maximized', async () => {
      mockIsMaximized.mockResolvedValueOnce(false);

      const result = await isWindowMaximized();

      expect(result).toBe(false);
    });

    it('should return false in non-Tauri environment', async () => {
      delete tauriGlobal.__TAURI__;

      const result = await isWindowMaximized();

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle invoke errors for restartApp', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Restart failed'));

      await expect(restartApp()).rejects.toThrow('Restart failed');
    });

    it('should handle invoke errors for quitApp', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Quit failed'));

      await expect(quitApp()).rejects.toThrow('Quit failed');
    });

    it('should handle window API errors for closeWindow', async () => {
      mockClose.mockRejectedValueOnce(new Error('Close failed'));

      await expect(closeWindow()).rejects.toThrow('Close failed');
    });

    it('should handle window API errors for minimizeWindow', async () => {
      mockMinimize.mockRejectedValueOnce(new Error('Minimize failed'));

      await expect(minimizeWindow()).rejects.toThrow('Minimize failed');
    });

    it('should handle window API errors for toggleMaximizeWindow', async () => {
      mockToggleMaximize.mockRejectedValueOnce(new Error('Toggle failed'));

      await expect(toggleMaximizeWindow()).rejects.toThrow('Toggle failed');
    });

    it('should handle window API errors for isWindowMaximized', async () => {
      mockIsMaximized.mockRejectedValueOnce(new Error('Check failed'));

      await expect(isWindowMaximized()).rejects.toThrow('Check failed');
    });
  });

  describe('window state plugin integration', () => {
    it('should save window state through plugin-window-state', async () => {
      mockPluginSaveWindowState.mockResolvedValueOnce(undefined);

      await saveWindowState();

      expect(mockPluginSaveWindowState).toHaveBeenCalledWith('all');
    });

    it('should restore window state through plugin-window-state', async () => {
      mockRestoreStateCurrent.mockResolvedValueOnce(undefined);

      await restoreWindowState();

      expect(mockRestoreStateCurrent).toHaveBeenCalledWith('all');
    });

    it('should start dragging through the Tauri window API', async () => {
      mockStartDragging.mockResolvedValueOnce(undefined);

      await startWindowDragging();

      expect(mockStartDragging).toHaveBeenCalled();
    });
  });
});
