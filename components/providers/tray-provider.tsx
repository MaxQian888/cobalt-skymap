'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSettingsStore } from '@/lib/stores';
import { setCloseToTray, updateTrayMenu } from '@/lib/tauri/app-control-api';

/**
 * Keeps the native system tray in sync with the frontend:
 *  - rebuilds the tray context menu with localized labels for the active locale
 *  - mirrors the "hide to tray on close" preference into the Rust backend
 *
 * All calls no-op outside the Tauri desktop runtime.
 */
export function TrayProvider() {
  const t = useTranslations('tray');
  const closeToTray = useSettingsStore((state) => state.preferences.closeToTray);

  // `t` changes identity when the active locale changes, so this re-runs and
  // relabels the menu on language switches.
  useEffect(() => {
    void updateTrayMenu({
      show: t('show'),
      starmap: t('starmap'),
      search: t('search'),
      settings: t('settings'),
      sessionPlanner: t('sessionPlanner'),
      plateSolver: t('plateSolver'),
      quit: t('quit'),
    });
  }, [t]);

  useEffect(() => {
    void setCloseToTray(closeToTray);
  }, [closeToTray]);

  return null;
}

export default TrayProvider;
