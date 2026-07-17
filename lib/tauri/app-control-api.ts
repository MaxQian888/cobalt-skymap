/**
 * App Control API
 *
 * Provides functions to control the application lifecycle including
 * restart, quit, and reload functionality.
 */

import { invoke } from '@tauri-apps/api/core';
import type { Window as TauriWindow } from '@tauri-apps/api/window';
import { createLogger } from '@/lib/logger';
import { isDesktop, isTauri } from '@/lib/storage/platform';
import type { SystemInfo } from './types';
import { resolveDesktopShell, type DesktopShell } from './window-shell';

const logger = createLogger('app-control-api');

export const TRAY_ACTIVATED_EVENT = 'skymap-tray-activated';
let desktopShellCache: DesktopShell | null = null;

// Historical import site — the canonical definition lives in storage/platform.
export { isTauri } from '@/lib/storage/platform';

/**
 * True only on Tauri desktop. Commands that are #[cfg(desktop)] in Rust
 * (restart/quit/reload, dev-mode, system-info, tray) must use this instead of
 * isTauri(), which is also true on Tauri mobile.
 */
function isDesktopTauri(): boolean {
  return isTauri() && isDesktop();
}

/**
 * Resolve the current desktop shell contract for the active runtime.
 */
export async function getDesktopShell(forceRefresh: boolean = false): Promise<DesktopShell> {
  if (!isDesktopTauri()) {
    return resolveDesktopShell(undefined, false);
  }

  if (!forceRefresh && desktopShellCache) {
    return desktopShellCache;
  }

  try {
    const info = await invoke<SystemInfo>('get_system_info');
    desktopShellCache = resolveDesktopShell(info);
  } catch (error) {
    logger.warn('Failed to resolve desktop shell from system info, using safe fallback', error);
    desktopShellCache = resolveDesktopShell({ os: 'unknown', platform: 'unknown' });
  }

  return desktopShellCache;
}

/**
 * Restart the application
 *
 * This will save window state before restarting to preserve
 * window position and size across restarts.
 */
export async function restartApp(): Promise<void> {
  if (!isDesktopTauri()) {
    logger.warn('restartApp is only available in the Tauri desktop environment');
    return;
  }
  await invoke('restart_app');
}

/**
 * Quit the application gracefully
 *
 * This will save window state before quitting.
 *
 * @param exitCode - Optional exit code (defaults to 0)
 */
export async function quitApp(exitCode?: number): Promise<void> {
  if (!isDesktopTauri()) {
    logger.warn('quitApp is only available in the Tauri desktop environment');
    return;
  }
  await invoke('quit_app', { exitCode });
}

/**
 * Reload the webview (soft restart - just refreshes the frontend)
 *
 * This does not restart the Tauri backend, only reloads the webview.
 */
export async function reloadWebview(): Promise<void> {
  if (!isDesktopTauri()) {
    // In browser (and Tauri mobile), just reload the page
    window.location.reload();
    return;
  }
  await invoke('reload_webview');
}

/**
 * Check if running in development mode
 */
export async function isDevMode(): Promise<boolean> {
  if (!isDesktopTauri()) {
    // In browser (and Tauri mobile), assume development if localhost
    return window.location.hostname === 'localhost';
  }
  return await invoke<boolean>('is_dev_mode');
}

/**
 * Close the current window
 *
 * This uses the Tauri window API to close the current window.
 */
export async function closeWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('closeWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  await appWindow.close();
}

/**
 * Minimize the current window
 */
export async function minimizeWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('minimizeWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  await appWindow.minimize();
}

/**
 * Restore a minimized window.
 */
export async function unminimizeWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('unminimizeWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().unminimize();
}

/**
 * Show the current window.
 */
export async function showWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('showWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().show();
}

/**
 * Hide the current window.
 */
export async function hideWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('hideWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().hide();
}

/**
 * Focus the current window.
 */
export async function focusWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('focusWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setFocus();
}

/**
 * Start dragging the current window from an explicit shell drag surface.
 */
export async function startWindowDragging(): Promise<void> {
  if (!isTauri()) {
    logger.warn('startWindowDragging is only available in Tauri environment');
    return;
  }

  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startDragging();
}

/**
 * Resize-drag directions for frameless window edge/corner handles.
 * Mirrors Tauri's `ResizeDirection` enum keys.
 */
export type WindowResizeDirection =
  | 'North'
  | 'NorthEast'
  | 'East'
  | 'SouthEast'
  | 'South'
  | 'SouthWest'
  | 'West'
  | 'NorthWest';

/**
 * Begin an interactive OS-level resize drag from a frameless window edge/corner.
 * Frameless windows (`decorations: false`) lose the native resize border, so the
 * custom shell paints invisible handles that call this on mousedown.
 */
export async function startWindowResizeDragging(
  direction: WindowResizeDirection
): Promise<void> {
  if (!isTauri()) {
    logger.warn('startWindowResizeDragging is only available in Tauri environment');
    return;
  }

  // `ResizeDirection` is a string-literal union in @tauri-apps/api, so the
  // direction key is passed through directly.
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().startResizeDragging(direction);
}

/**
 * Check whether the current window is visible.
 */
export async function isWindowVisible(): Promise<boolean> {
  if (!isTauri()) {
    return true;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow().isVisible();
}

/**
 * Check whether the current window is minimized.
 */
export async function isWindowMinimized(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow().isMinimized();
}

/**
 * Check whether tray-relative positioning is ready for this runtime.
 */
export async function isTrayPositioningReady(): Promise<boolean> {
  if (!isDesktopTauri()) {
    return false;
  }

  try {
    return await invoke<boolean>('is_tray_positioning_ready');
  } catch (error) {
    logger.warn('Failed to read tray positioning readiness', error);
    return false;
  }
}

/**
 * Localized labels for the tray context menu. Keys mirror the Rust
 * `TrayMenuLabels` struct (camelCase over the IPC boundary).
 */
export interface TrayMenuLabels {
  show: string;
  starmap: string;
  search: string;
  settings: string;
  sessionPlanner: string;
  plateSolver: string;
  quit: string;
}

/**
 * Rebuild the native tray context menu with localized labels.
 *
 * No-op outside Tauri desktop; failures are logged but never thrown, since a
 * stale (English) menu is preferable to breaking startup.
 */
export async function updateTrayMenu(labels: TrayMenuLabels): Promise<void> {
  if (!isDesktopTauri()) {
    return;
  }
  try {
    await invoke('update_tray_menu', { labels });
  } catch (error) {
    logger.warn('Failed to update tray menu labels', error);
  }
}

/**
 * Set whether closing the window hides it to the tray instead of quitting.
 *
 * No-op outside Tauri desktop.
 */
export async function setCloseToTray(enabled: boolean): Promise<void> {
  if (!isDesktopTauri()) {
    return;
  }
  try {
    await invoke('set_close_to_tray', { enabled });
  } catch (error) {
    logger.warn('Failed to update close-to-tray behavior', error);
  }
}

/**
 * Listen for tray activation events emitted by the Rust backend.
 */
export async function listenForTrayActivation(
  handler: () => void | Promise<void>
): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }

  const { listen } = await import('@tauri-apps/api/event');
  return listen(TRAY_ACTIVATED_EVENT, () => {
    void handler();
  });
}

/**
 * Toggle maximize state of the current window
 */
export async function toggleMaximizeWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('toggleMaximizeWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  await appWindow.toggleMaximize();
}

/**
 * Detect a Windows runtime from the WebView2 user agent, which always
 * contains "Windows". Cheaper and more reliable than an IPC round-trip.
 */
function isWindowsRuntime(): boolean {
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows');
}

/**
 * A cheap, invisible bounds nudge. The main window is borderless
 * (`decorations: false`); when it leaves fullscreen, tao marks it
 * non-fullscreen but the Windows shell can fall back to its fullscreen
 * heuristics and keep the taskbar hidden. Changing the window bounds makes the
 * shell re-evaluate. The net size/position is unchanged, so this is a visual
 * no-op when the taskbar was already showing, and it resolves the common case.
 */
async function nudgeWindowBounds(appWindow: TauriWindow): Promise<void> {
  if (await appWindow.isMaximized()) {
    // setSize would clear the maximized state, so re-assert maximize instead.
    await appWindow.unmaximize();
    await appWindow.maximize();
    return;
  }

  const { PhysicalSize } = await import('@tauri-apps/api/dpi');
  const size = await appWindow.innerSize();
  await appWindow.setSize(new PhysicalSize(size.width, Math.max(1, size.height - 1)));
  await appWindow.setSize(new PhysicalSize(size.width, size.height));
}

/**
 * Force the Windows taskbar to reappear after leaving fullscreen.
 *
 * Runs two tiers because the shell's fullscreen heuristic can be stubborn on
 * some machines:
 *   1. A bounds nudge — invisible, fixes the common case.
 *   2. A strong fallback: minimize + unminimize forces a foreground/activation
 *      change so the shell definitively re-evaluates its fullscreen state.
 *      `unminimize` (SW_RESTORE) preserves the prior maximized/normal state, so
 *      the only visible cost is a brief minimize animation.
 */
async function refreshTaskbarAfterFullscreenExit(appWindow: TauriWindow): Promise<void> {
  if (!isWindowsRuntime()) return;

  try {
    await nudgeWindowBounds(appWindow);

    await appWindow.minimize();
    await appWindow.unminimize();
    await appWindow.setFocus();
  } catch (error) {
    logger.warn('Failed to refresh taskbar after exiting fullscreen', error);
  }
}

/**
 * Toggle fullscreen state of the current window
 */
export async function toggleFullscreen(): Promise<void> {
  if (!isTauri()) {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  const wasFullscreen = await appWindow.isFullscreen();
  await appWindow.setFullscreen(!wasFullscreen);

  if (wasFullscreen) {
    await refreshTaskbarAfterFullscreenExit(appWindow);
  }
}

/**
 * Check if the current window is maximized
 */
export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  return await appWindow.isMaximized();
}

/**
 * Check if the current window is fullscreen
 */
export async function isWindowFullscreen(): Promise<boolean> {
  if (!isTauri()) {
    return !!document.fullscreenElement;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  return await appWindow.isFullscreen();
}

/**
 * Set window always on top
 */
export async function setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
  if (!isTauri()) {
    logger.warn('setAlwaysOnTop is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  await appWindow.setAlwaysOnTop(alwaysOnTop);
}

/**
 * Check if window is always on top
 */
export async function isAlwaysOnTop(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  return await appWindow.isAlwaysOnTop();
}

/**
 * Set window size
 */
export async function setWindowSize(width: number, height: number): Promise<void> {
  if (!isTauri()) {
    logger.warn('setWindowSize is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const { LogicalSize } = await import('@tauri-apps/api/dpi');
  const appWindow = getCurrentWindow();
  await appWindow.setSize(new LogicalSize(width, height));
}

/**
 * Get window size
 */
export async function getWindowSize(): Promise<{ width: number; height: number }> {
  if (!isTauri()) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  const size = await appWindow.innerSize();
  return { width: size.width, height: size.height };
}

/**
 * Get window position
 */
export async function getWindowPosition(): Promise<{ x: number; y: number }> {
  if (!isTauri()) {
    return { x: window.screenX, y: window.screenY };
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  const position = await appWindow.outerPosition();
  return { x: position.x, y: position.y };
}

/**
 * Set window position
 */
export async function setWindowPosition(x: number, y: number): Promise<void> {
  if (!isTauri()) {
    logger.warn('setWindowPosition is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const { LogicalPosition } = await import('@tauri-apps/api/dpi');
  const appWindow = getCurrentWindow();
  await appWindow.setPosition(new LogicalPosition(x, y));
}

/**
 * Center the window on screen
 */
export async function centerWindow(): Promise<void> {
  if (!isTauri()) {
    logger.warn('centerWindow is only available in Tauri environment');
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const appWindow = getCurrentWindow();
  await appWindow.center();
}

/**
 * Window state interface for persistence
 */
export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
  isFullscreen: boolean;
  isAlwaysOnTop: boolean;
}

/**
 * Get complete window state
 */
export async function getWindowState(): Promise<WindowState> {
  const size = await getWindowSize();
  const position = await getWindowPosition();
  const maximized = await isWindowMaximized();
  const fullscreen = await isWindowFullscreen();
  const alwaysOnTop = await isAlwaysOnTop();
  
  return {
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y,
    isMaximized: maximized,
    isFullscreen: fullscreen,
    isAlwaysOnTop: alwaysOnTop,
  };
}

/**
 * Save window state through the official Tauri window-state plugin.
 */
export async function saveWindowState(): Promise<void> {
  if (!isTauri()) return;

  try {
    const plugin = await import('@tauri-apps/plugin-window-state');
    await plugin.saveWindowState(plugin.StateFlags.ALL);
  } catch (error) {
    logger.error('Failed to save window state', error);
  }
}

/**
 * Restore current window state from the official window-state plugin store.
 */
export async function restoreWindowState(): Promise<void> {
  if (!isTauri()) return;

  try {
    const plugin = await import('@tauri-apps/plugin-window-state');
    await plugin.restoreStateCurrent(plugin.StateFlags.ALL);
  } catch (error) {
    logger.error('Failed to restore window state', error);
  }
}

/**
 * Set window opacity (transparency)
 */
export async function setWindowOpacity(opacity: number): Promise<void> {
  if (!isTauri()) {
    document.body.style.opacity = String(opacity);
    return;
  }
  // Note: Window opacity requires platform-specific support
  logger.warn('Window opacity is not fully supported on all platforms');
}

/**
 * Open an external URL in the system browser (Tauri) or new tab (web)
 *
 * Uses @tauri-apps/plugin-opener in desktop mode, window.open in web mode.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauri()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (error) {
      logger.error('Failed to open external URL via Tauri opener plugin', error);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Get available monitors info
 */
export async function getMonitors(): Promise<Array<{ name: string | null; size: { width: number; height: number }; position: { x: number; y: number } }>> {
  if (!isTauri()) {
    return [{
      name: 'Primary',
      size: { width: window.screen.width, height: window.screen.height },
      position: { x: 0, y: 0 }
    }];
  }
  const { availableMonitors } = await import('@tauri-apps/api/window');
  const monitors = await availableMonitors();
  return monitors.map(m => ({
    name: m.name,
    size: { width: m.size.width, height: m.size.height },
    position: { x: m.position.x, y: m.position.y }
  }));
}
