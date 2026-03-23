'use client';

import { useCallback, useEffect, useState } from 'react';
import { StellariumView, SplashScreen } from '@/components/starmap';
import { LogPanel } from '@/components/common';
import { useCacheInit, useWindowState } from '@/lib/hooks';
import { STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS } from '@/lib/core/constants/starmap-bootstrap';
import { useSettingsStore, useStarmapBootstrapStore } from '@/lib/stores';
import { isTauri } from '@/lib/storage/platform';
import type { ProxyMode } from '@/lib/stores/settings-store';

interface PersistApiLike {
  hasHydrated?: () => boolean;
  onFinishHydration?: (listener: () => void) => () => void;
  rehydrate?: () => Promise<void>;
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error';
}

export default function StarmapPage() {
  const showSplashPreference = useSettingsStore((state) => state.preferences.showSplash);
  const proxySettings = useSettingsStore((state) => state.proxy);
  const bootstrapOutcome = useStarmapBootstrapStore((state) => state.outcome);
  const beginSession = useStarmapBootstrapStore((state) => state.beginSession);
  const markResourceLoading = useStarmapBootstrapStore((state) => state.markResourceLoading);
  const markResourceReady = useStarmapBootstrapStore((state) => state.markResourceReady);
  const markResourceFailed = useStarmapBootstrapStore((state) => state.markResourceFailed);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const showSplash = showSplashPreference && !splashDismissed;
  const bootstrapReady = bootstrapOutcome === 'ready' || bootstrapOutcome === 'degraded';

  useEffect(() => {
    beginSession();
  }, [beginSession]);

  useEffect(() => {
    beginSession();
    markResourceLoading('settings_snapshot');

    const settingsStoreWithPersist = useSettingsStore as typeof useSettingsStore & { persist?: PersistApiLike };
    const persistApi = settingsStoreWithPersist.persist;
    if (!persistApi) {
      markResourceReady('settings_snapshot');
      return;
    }

    if (persistApi.hasHydrated?.()) {
      markResourceReady('settings_snapshot');
      return;
    }

    const timeout = window.setTimeout(() => {
      markResourceFailed('settings_snapshot', 'settings_snapshot_timeout');
    }, STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS);

    const unsubscribe = persistApi.onFinishHydration?.(() => {
      window.clearTimeout(timeout);
      markResourceReady('settings_snapshot');
    });

    const rehydrateResult = persistApi.rehydrate?.();
    if (rehydrateResult && typeof (rehydrateResult as Promise<void>).catch === 'function') {
      (rehydrateResult as Promise<void>).catch((error: unknown) => {
        window.clearTimeout(timeout);
        markResourceFailed('settings_snapshot', normalizeErrorMessage(error));
      });
    }

    return () => {
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [beginSession, markResourceFailed, markResourceLoading, markResourceReady]);

  const handleCacheIndexStart = useCallback(() => {
    beginSession();
    markResourceLoading('cache_index');
  }, [beginSession, markResourceLoading]);

  const handleCacheIndexReady = useCallback(() => {
    markResourceReady('cache_index');
  }, [markResourceReady]);

  const handleCacheIndexError = useCallback((error: unknown) => {
    markResourceFailed('cache_index', normalizeErrorMessage(error));
  }, [markResourceFailed]);

  // Initialize unified cache system
  useCacheInit({
    strategy: 'cache-first',
    enableInterception: true,
    onCacheIndexStart: handleCacheIndexStart,
    onCacheIndexReady: handleCacheIndexReady,
    onCacheIndexError: handleCacheIndexError,
  });
  
  // Restore desktop window state through the official Tauri plugin
  useWindowState();

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let cancelled = false;
    const manualProxyUrl = proxySettings.manualUrl.trim();

    void (async () => {
      try {
        const { httpApi } = await import('@/lib/tauri/http-api');
        await httpApi.setConfig({
          proxy_mode: proxySettings.mode as ProxyMode,
          manual_proxy_url: manualProxyUrl || null,
          proxy_url: manualProxyUrl || null,
          fallback_to_direct_on_failure: proxySettings.fallbackToDirectOnFailure,
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('[starmap] failed to sync HTTP proxy settings', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    proxySettings.fallbackToDirectOnFailure,
    proxySettings.manualUrl,
    proxySettings.mode,
  ]);

  return (
    <main className="relative w-screen h-screen h-dvh min-h-screen min-h-dvh bg-black overflow-hidden">
      {showSplash && (
        <SplashScreen
          onComplete={() => setSplashDismissed(true)}
          isReady={bootstrapReady}
        />
      )}
      <StellariumView showSplash={showSplash} />
      <LogPanel />
    </main>
  );
}
