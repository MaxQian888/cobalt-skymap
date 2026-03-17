/**
 * Window Controls Hook
 * 
 * Shared hook for window state management and control actions.
 * Eliminates duplication across app-control-menu, titlebar, and window-controls components.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/lib/logger';
import {
  closeWindow,
  focusWindow,
  getDesktopShell,
  minimizeWindow,
  toggleMaximizeWindow,
  isWindowMaximized,
  toggleFullscreen,
  restartApp,
  quitApp,
  reloadWebview,
  isTauri,
  setAlwaysOnTop,
  isAlwaysOnTop,
  isTrayPositioningReady,
  listenForTrayActivation,
  saveWindowState,
  startWindowDragging,
  showWindow,
  centerWindow,
  unminimizeWindow,
} from '@/lib/tauri/app-control-api';
import {
  positionerApi,
  TRAY_REVEAL_PRESET,
  type WindowPositionPreset,
} from '@/lib/tauri/positioner-api';
import { resolveDesktopShell, type DesktopShell } from '@/lib/tauri/window-shell';

const logger = createLogger('use-window-controls');

export interface WindowControlsState {
  isTauriEnv: boolean;
  isMaximized: boolean;
  isFullscreen: boolean;
  isPinned: boolean;
  isTrayReady: boolean;
  shell: DesktopShell;
}

export interface WindowControlsActions {
  handleMinimize: () => Promise<void>;
  handleMaximize: () => Promise<void>;
  handleClose: () => Promise<void>;
  handleCloseWithSave: () => Promise<void>;
  handleRestart: () => Promise<void>;
  handleQuit: () => Promise<void>;
  handleQuitWithSave: () => Promise<void>;
  handleReload: () => Promise<void>;
  handleToggleFullscreen: () => Promise<void>;
  handleTogglePin: () => Promise<void>;
  handleCenterWindow: () => Promise<void>;
  handleMoveWindow: (preset: WindowPositionPreset) => Promise<void>;
  handleRevealFromTray: () => Promise<void>;
  handleStartWindowDrag: () => Promise<void>;
  handleWebReload: () => void;
}

export type UseWindowControlsReturn = WindowControlsState & WindowControlsActions;

/**
 * Hook to manage Tauri window controls and state.
 * Tracks isTauriEnv, isMaximized, isFullscreen, isPinned states
 * and provides handler functions for all window operations.
 */
export function useWindowControls(): UseWindowControlsReturn {
  const [isTauriEnv, setIsTauriEnv] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isTrayReady, setIsTrayReady] = useState(false);
  const [shell, setShell] = useState<DesktopShell>(() => resolveDesktopShell(undefined, false));
  const isPinnedRef = useRef(false);
  useEffect(() => { isPinnedRef.current = isPinned; }, [isPinned]);

  // Check Tauri environment and initial window state
  useEffect(() => {
    const checkTauri = async () => {
      if (isTauri()) {
        setIsTauriEnv(true);
        try {
          const [maximized, pinned, trayReady, desktopShell] = await Promise.all([
            isWindowMaximized(),
            isAlwaysOnTop(),
            isTrayPositioningReady(),
            getDesktopShell(),
          ]);
          setIsMaximized(maximized);
          setIsPinned(pinned);
          setIsTrayReady(trayReady);
          setShell(desktopShell);
        } catch (error) {
          logger.error('Failed to get window state', error);
        }
      }
    };
    checkTauri();

    // Check fullscreen state for web environment
    const checkFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', checkFullscreen);
    checkFullscreen();

    return () => {
      document.removeEventListener('fullscreenchange', checkFullscreen);
    };
  }, []);

  // Track maximize state on resize
  useEffect(() => {
    if (!isTauriEnv) return;

    const handleResize = async () => {
      try {
        const maximized = await isWindowMaximized();
        setIsMaximized(maximized);
      } catch (error) {
        logger.error('Failed to check maximized state', error);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isTauriEnv]);

  const handleMinimize = useCallback(async () => {
    try {
      await minimizeWindow();
    } catch (error) {
      logger.error('Failed to minimize', error);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      await toggleMaximizeWindow();
      setIsMaximized((prev) => !prev);
    } catch (error) {
      logger.error('Failed to toggle maximize', error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await closeWindow();
    } catch (error) {
      logger.error('Failed to close', error);
    }
  }, []);

  const persistWindowState = useCallback(async (reason: 'close' | 'quit' | 'restart') => {
    try {
      await saveWindowState();
    } catch (error) {
      logger.error(`Failed to save window state before ${reason}`, error);
    }
  }, []);

  const handleCloseWithSave = useCallback(async () => {
    try {
      await persistWindowState('close');
      await closeWindow();
    } catch (error) {
      logger.error('Failed to close', error);
    }
  }, [persistWindowState]);

  const handleRestart = useCallback(async () => {
    try {
      await persistWindowState('restart');
      await restartApp();
    } catch (error) {
      logger.error('Failed to restart', error);
    }
  }, [persistWindowState]);

  const handleQuit = useCallback(async () => {
    try {
      await quitApp();
    } catch (error) {
      logger.error('Failed to quit', error);
    }
  }, []);

  const handleQuitWithSave = useCallback(async () => {
    try {
      await persistWindowState('quit');
      await quitApp();
    } catch (error) {
      logger.error('Failed to quit', error);
    }
  }, [persistWindowState]);

  const handleTogglePin = useCallback(async () => {
    try {
      const newPinned = !isPinnedRef.current;
      await setAlwaysOnTop(newPinned);
      setIsPinned(newPinned);
    } catch (error) {
      logger.error('Failed to toggle always on top', error);
    }
  }, []);

  const handleMoveWindow = useCallback(async (preset: WindowPositionPreset) => {
    try {
      const result = await positionerApi.moveToPreset(preset);
      if (!result.moved && (preset === 'Center' || positionerApi.isTrayPositionPreset(preset))) {
        await centerWindow();
      }
    } catch (error) {
      logger.error(`Failed to move window to ${preset}`, error);
    }
  }, []);

  const handleRevealFromTray = useCallback(async () => {
    try {
      await Promise.allSettled([showWindow(), unminimizeWindow()]);

      const result = await positionerApi.moveToPreset(TRAY_REVEAL_PRESET);
      if (!result.moved) {
        await centerWindow();
      }

      await focusWindow();
    } catch (error) {
      logger.error('Failed to reveal window from tray activation', error);

      try {
        await centerWindow();
        await focusWindow();
      } catch (fallbackError) {
        logger.error('Failed to apply tray reveal fallback', fallbackError);
      }
    }
  }, []);

  const handleCenterWindow = useCallback(async () => {
    await handleMoveWindow('Center');
  }, [handleMoveWindow]);

  const handleStartWindowDrag = useCallback(async () => {
    if (!shell.supportsManualDragging) {
      return;
    }

    try {
      await startWindowDragging();
    } catch (error) {
      logger.error('Failed to start window dragging', error);
    }
  }, [shell.supportsManualDragging]);

  useEffect(() => {
    if (!isTauriEnv) return;

    let unlisten: (() => void) | undefined;
    let disposed = false;

    const register = async () => {
      try {
        const trayReady = await isTrayPositioningReady();
        if (!disposed) {
          setIsTrayReady(trayReady);
        }

        unlisten = await listenForTrayActivation(async () => {
          await handleRevealFromTray();
        });
      } catch (error) {
        logger.error('Failed to register tray activation listener', error);
      }
    };

    void register();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [handleRevealFromTray, isTauriEnv]);

  const handleReload = useCallback(async () => {
    try {
      await reloadWebview();
    } catch (error) {
      logger.error('Failed to reload', error);
    }
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      await toggleFullscreen();
      setIsFullscreen((prev) => !prev);
    } catch (error) {
      logger.error('Failed to toggle fullscreen', error);
    }
  }, []);

  const handleWebReload = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    isTauriEnv,
    isMaximized,
    isFullscreen,
    isPinned,
    isTrayReady,
    shell,
    handleMinimize,
    handleMaximize,
    handleClose,
    handleCloseWithSave,
    handleRestart,
    handleQuit,
    handleQuitWithSave,
    handleReload,
    handleToggleFullscreen,
    handleTogglePin,
    handleCenterWindow,
    handleMoveWindow,
    handleRevealFromTray,
    handleStartWindowDrag,
    handleWebReload,
  };
}
