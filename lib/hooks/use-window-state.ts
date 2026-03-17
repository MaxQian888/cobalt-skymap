/**
 * Window State Management Hook
 * 
 * Handles window state persistence and restoration for Tauri desktop app.
 */

import { useEffect, useRef } from 'react';
import {
  isTauri,
  restoreWindowState,
} from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-window-state');

/**
 * Hook to manage window state persistence
 * - Restores window position/size on mount using the official Tauri plugin
 */
export function useWindowState() {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    if (restoredRef.current) return;
    restoredRef.current = true;
    restoreWindowState().catch(err => logger.error('Failed to restore window state', err));
  }, []);
}

export default useWindowState;
