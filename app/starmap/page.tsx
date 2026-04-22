'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { StellariumView, SplashScreen } from '@/components/starmap';
import { LogPanel } from '@/components/common';
import { useCacheInit, useWindowState, type CacheStartupStageEvent } from '@/lib/hooks';
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
  const t = useTranslations();
  const showSplashPreference = useSettingsStore((state) => state.preferences.showSplash);
  const proxySettings = useSettingsStore((state) => state.proxy);
  const bootstrapOutcome = useStarmapBootstrapStore((state) => state.outcome);
  const bootstrapSessionId = useStarmapBootstrapStore((state) => state.sessionId);
  const bootstrapResources = useStarmapBootstrapStore((state) => state.resources);
  const beginSession = useStarmapBootstrapStore((state) => state.beginSession);
  const markResourceLoading = useStarmapBootstrapStore((state) => state.markResourceLoading);
  const markResourceReady = useStarmapBootstrapStore((state) => state.markResourceReady);
  const markResourceFailed = useStarmapBootstrapStore((state) => state.markResourceFailed);
  const recordStageEvent = useStarmapBootstrapStore((state) => state.recordStageEvent);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const bootstrapSessionRef = useRef<string | null>(null);
  const showSplash = showSplashPreference && !splashDismissed;
  const bootstrapReady = bootstrapOutcome === 'ready' || bootstrapOutcome === 'degraded';
  const splashCompletionHint =
    bootstrapOutcome === 'degraded' && bootstrapResources.cache_index.state === 'failed'
      ? t('splash.cacheWarmupDeferred')
      : null;

  useEffect(() => {
    bootstrapSessionRef.current = beginSession();
  }, [beginSession]);

  useEffect(() => {
    if (bootstrapSessionId) {
      bootstrapSessionRef.current = bootstrapSessionId;
    }
  }, [bootstrapSessionId]);

  useEffect(() => {
    const activeSessionId = useStarmapBootstrapStore.getState().sessionId;
    const sessionId = activeSessionId ?? bootstrapSessionRef.current ?? beginSession();
    bootstrapSessionRef.current = sessionId;
    markResourceLoading('settings_snapshot', { sessionId });

    const settingsStoreWithPersist = useSettingsStore as typeof useSettingsStore & { persist?: PersistApiLike };
    const persistApi = settingsStoreWithPersist.persist;
    if (!persistApi) {
      markResourceReady('settings_snapshot', { sessionId });
      return;
    }

    if (persistApi.hasHydrated?.()) {
      markResourceReady('settings_snapshot', { sessionId });
      recordStageEvent('settings_snapshot.warm_reuse', 'complete', {
        sessionId,
        classification: 'blocking',
        reason: 'persist_already_hydrated',
      });
      return;
    }

    const timeout = window.setTimeout(() => {
      markResourceFailed('settings_snapshot', 'settings_snapshot_timeout', { sessionId });
    }, STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS);

    const unsubscribe = persistApi.onFinishHydration?.(() => {
      window.clearTimeout(timeout);
      markResourceReady('settings_snapshot', { sessionId });
    });

    const rehydrateResult = persistApi.rehydrate?.();
    if (rehydrateResult && typeof (rehydrateResult as Promise<void>).catch === 'function') {
      (rehydrateResult as Promise<void>).catch((error: unknown) => {
        window.clearTimeout(timeout);
        markResourceFailed('settings_snapshot', normalizeErrorMessage(error), { sessionId });
      });
    }

    return () => {
      window.clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [beginSession, markResourceFailed, markResourceLoading, markResourceReady, recordStageEvent]);

  const handleCacheStage = useCallback((event: CacheStartupStageEvent) => {
    const activeSessionId = useStarmapBootstrapStore.getState().sessionId;
    const sessionId = activeSessionId ?? bootstrapSessionRef.current ?? beginSession();
    bootstrapSessionRef.current = sessionId;

    if (event.stage === 'cache_index') {
      if (event.state === 'loading') {
        markResourceLoading('cache_index', { sessionId });
        return;
      }
      if (event.state === 'ready') {
        markResourceReady('cache_index', { sessionId });
        return;
      }

      markResourceFailed('cache_index', event.reason ?? `cache_index_${event.state}`, { sessionId });
      return;
    }

    recordStageEvent(`cache.${event.stage}`, event.state === 'loading' ? 'start' : event.state === 'ready' ? 'complete' : 'failed', {
      sessionId,
      classification: 'deferred',
      reason: event.reason ?? event.state,
    });
  }, [
    beginSession,
    markResourceFailed,
    markResourceLoading,
    markResourceReady,
    recordStageEvent,
  ]);

  // Initialize unified cache system
  useCacheInit({
    strategy: 'cache-first',
    enableInterception: true,
    onCacheStage: handleCacheStage,
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
          completionHint={splashCompletionHint}
        />
      )}
      <StellariumView showSplash={showSplash} />
      <LogPanel />
    </main>
  );
}
