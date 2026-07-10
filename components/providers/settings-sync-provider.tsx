'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useLocaleStore } from '@/lib/i18n/locale-store';
import { useSettingsStore } from '@/lib/stores/settings-store';

interface SettingsSyncProviderProps {
  children: ReactNode;
}

export function SettingsSyncProvider({ children }: SettingsSyncProviderProps) {
  const settingsLocale = useSettingsStore((state) => state.preferences.locale);

  const highContrast = useSettingsStore((state) => state.accessibility.highContrast);
  const fontScale = useSettingsStore((state) => state.accessibility.fontScale);
  const colorBlindMode = useSettingsStore((state) => state.accessibility.colorBlindMode);
  const screenReaderOptimized = useSettingsStore((state) => state.accessibility.screenReaderOptimized);
  const reduceTransparency = useSettingsStore((state) => state.accessibility.reduceTransparency);
  const focusIndicators = useSettingsStore((state) => state.accessibility.focusIndicators);

  const reducedMotion = useSettingsStore((state) => state.performance.reducedMotion);
  const enableAnimations = useSettingsStore((state) => state.performance.enableAnimations);
  const setPreference = useSettingsStore((state) => state.setPreference);

  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const localeSyncResolvedRef = useRef(false);
  const safeSettingsLocale = settingsLocale === 'zh' ? 'zh' : 'en';
  const safeLocale = locale === 'zh' ? 'zh' : 'en';

  useEffect(() => {
    if (safeLocale === safeSettingsLocale) {
      localeSyncResolvedRef.current = true;
      return;
    }

    // One-time migration path:
    // if settings locale is still default "en" but locale-store has a non-default value,
    // keep the user's existing locale-store choice and backfill settings.
    if (!localeSyncResolvedRef.current) {
      localeSyncResolvedRef.current = true;
      if (safeSettingsLocale === 'en' && safeLocale !== 'en') {
        setPreference('locale', safeLocale);
        return;
      }
    }

    setLocale(safeSettingsLocale);
  }, [safeLocale, safeSettingsLocale, setLocale, setPreference]);

  useEffect(() => {
    const root = document.documentElement;
    const shouldReduceMotion = reducedMotion || !enableAnimations;
    const safeFontScale = Number.isFinite(fontScale) ? Math.min(2, Math.max(0.9, fontScale)) : 1;

    root.classList.toggle('settings-high-contrast', highContrast);
    root.classList.toggle('settings-reduce-transparency', reduceTransparency);
    root.classList.toggle('settings-hide-focus-indicators', !focusIndicators);
    root.classList.toggle('settings-reduce-motion', shouldReduceMotion);
    // Expose the scale as a CSS var and apply it as an inline root font-size.
    // Inline wins the cascade reliably (a stylesheet :root rule can be lost to
    // Tailwind's layered base reset), scaling the whole rem-based UI.
    root.style.setProperty('--a11y-font-scale', String(safeFontScale));
    if (safeFontScale === 1) {
      root.style.removeProperty('font-size');
    } else {
      root.style.fontSize = `calc(100% * ${safeFontScale})`;
    }
    root.setAttribute('data-color-blind-mode', colorBlindMode);
    root.setAttribute('data-screen-reader-optimized', screenReaderOptimized ? 'true' : 'false');

    return () => {
      root.classList.remove('settings-high-contrast');
      root.classList.remove('settings-reduce-transparency');
      root.classList.remove('settings-hide-focus-indicators');
      root.classList.remove('settings-reduce-motion');
      root.style.removeProperty('--a11y-font-scale');
      root.style.removeProperty('font-size');
      root.removeAttribute('data-color-blind-mode');
      root.removeAttribute('data-screen-reader-optimized');
    };
  }, [
    colorBlindMode,
    enableAnimations,
    focusIndicators,
    fontScale,
    highContrast,
    reduceTransparency,
    reducedMotion,
    screenReaderOptimized,
  ]);

  return <>{children}</>;
}
