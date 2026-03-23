'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Trash2,
  Loader2,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { formatBytes, unifiedCache } from '@/lib/offline';
import { getCacheDiagnosticsSummary, getCacheIntegrationDiagnostics, getCacheProviderDiagnostics } from '@/lib/cache';
import { EmptyState } from '@/components/ui/empty-state';
import { unifiedCacheApi } from '@/lib/tauri';
import { isTauri } from '@/lib/storage/platform';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('cache-unified-tab');

interface CacheUnifiedTabProps {
  isActive: boolean;
}

type UnifiedCacheStatsShape = {
  total_entries: number;
  total_size: number;
  hit_rate: number;
};

type RuntimeCacheMode = 'tauri' | 'web' | 'none';

function getProviderLabel(providerId: string, t: ReturnType<typeof useTranslations>) {
  if (providerId === 'tauri-unified-cache') return t('cache.providerDesktop');
  if (providerId === 'browser-cache-api') return t('cache.providerBrowser');
  return t('cache.providerUnavailable');
}

function getModeLabel(mode: 'persistent-shared' | 'local-only' | 'uncached', t: ReturnType<typeof useTranslations>) {
  if (mode === 'persistent-shared') return t('cache.persistentShared');
  if (mode === 'local-only') return t('cache.localOnly');
  return t('cache.uncachedByDesign');
}

function getStatusLabel(status: 'active' | 'degraded' | 'mismatch' | 'local-only' | 'uncached-by-design', t: ReturnType<typeof useTranslations>) {
  if (status === 'active') return t('cache.statusActive');
  if (status === 'degraded') return t('cache.statusDegraded');
  if (status === 'mismatch') return t('cache.statusMismatch');
  if (status === 'local-only') return t('cache.statusLocalOnly');
  return t('cache.statusUncachedByDesign');
}

function getEnvironmentLabel(environment: 'web' | 'tauri', t: ReturnType<typeof useTranslations>) {
  return environment === 'tauri' ? t('cache.environmentTauri') : t('cache.environmentWeb');
}

function getRuntimeCacheMode(
  providerId: string,
  supportsPersistent: boolean
): RuntimeCacheMode {
  if (isTauri() && unifiedCacheApi.isAvailable()) return 'tauri';
  if (!isTauri() && providerId === 'browser-cache-api' && supportsPersistent) return 'web';
  return 'none';
}

function getCapabilityStateLabel(
  supported: boolean,
  providerAvailable: boolean
): 'supported' | 'degraded' | 'unsupported' {
  if (supported) return 'supported';
  return providerAvailable ? 'degraded' : 'unsupported';
}

export function CacheUnifiedTab({ isActive }: CacheUnifiedTabProps) {
  const t = useTranslations();
  const [unifiedCacheStats, setUnifiedCacheStats] = useState<UnifiedCacheStatsShape | null>(null);
  const [unifiedCacheKeys, setUnifiedCacheKeys] = useState<string[]>([]);
  const [loadingUnified, setLoadingUnified] = useState(false);
  const providerDiagnostics = getCacheProviderDiagnostics();
  const integrationDiagnostics = getCacheIntegrationDiagnostics();
  const diagnosticsSummary = getCacheDiagnosticsSummary();
  const runtimeCacheMode = getRuntimeCacheMode(
    providerDiagnostics.providerId,
    providerDiagnostics.supportsPersistent
  );

  const refreshUnifiedCache = useCallback(async () => {
    if (runtimeCacheMode === 'none') return;

    setLoadingUnified(true);
    try {
      if (runtimeCacheMode === 'tauri') {
        const [stats, keys] = await Promise.all([
          unifiedCacheApi.getStats(),
          unifiedCacheApi.listKeys(),
        ]);
        setUnifiedCacheStats(stats);
        setUnifiedCacheKeys(keys);
      } else {
        const [size, keys, webStats] = await Promise.all([
          unifiedCache.getSize(),
          unifiedCache.keys(),
          Promise.resolve(unifiedCache.getCacheStats()),
        ]);
        setUnifiedCacheStats({
          total_entries: keys.length,
          total_size: size,
          hit_rate: webStats.hitRate ?? 0,
        });
        setUnifiedCacheKeys(keys);
      }
    } catch (error) {
      logger.error('Failed to load unified cache', error);
      toast.error(t('cache.loadFailed'));
    } finally {
      setLoadingUnified(false);
    }
  }, [runtimeCacheMode, t]);

  const handleClearUnifiedCache = useCallback(async () => {
    if (runtimeCacheMode === 'none') return;

    try {
      let deletedCount = 0;
      if (runtimeCacheMode === 'tauri') {
        deletedCount = await unifiedCacheApi.clearCache();
      } else {
        const existing = await unifiedCache.keys();
        deletedCount = existing.length;
        await unifiedCache.clear();
      }
      toast.success(t('cache.cleared'), {
        description: t('cache.entriesRemoved', { count: deletedCount }),
      });
      await refreshUnifiedCache();
    } catch (error) {
      toast.error(t('cache.clearFailed'));
      logger.error('Failed to clear unified cache', error);
    }
  }, [runtimeCacheMode, t, refreshUnifiedCache]);

  const handleCleanupUnifiedCache = useCallback(async () => {
    if (runtimeCacheMode === 'none') return;

    try {
      const deletedCount = runtimeCacheMode === 'tauri'
        ? await unifiedCacheApi.cleanup()
        : await unifiedCache.cleanupExpired();
      toast.success(t('cache.cleanupComplete'), {
        description: t('cache.expiredEntriesRemoved', { count: deletedCount }),
      });
      await refreshUnifiedCache();
    } catch (error) {
      toast.error(t('cache.cleanupFailed'));
      logger.error('Failed to cleanup unified cache', error);
    }
  }, [runtimeCacheMode, t, refreshUnifiedCache]);

  const handleFlushUnifiedCache = useCallback(async () => {
    if (runtimeCacheMode === 'none' || !providerDiagnostics.supportsFlush) return;

    try {
      if (runtimeCacheMode === 'tauri') {
        await unifiedCacheApi.flush();
      } else {
        await unifiedCache.flush();
      }
      toast.success(t('cache.flushComplete'));
      await refreshUnifiedCache();
    } catch (error) {
      toast.error(t('cache.flushFailed'));
      logger.error('Failed to flush unified cache', error);
    }
  }, [providerDiagnostics.supportsFlush, refreshUnifiedCache, runtimeCacheMode, t]);

  useEffect(() => {
    if (isActive && runtimeCacheMode !== 'none') {
      refreshUnifiedCache();
    }
  }, [isActive, refreshUnifiedCache, runtimeCacheMode]);

  return (
    <div className="space-y-3">
      {loadingUnified ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">{t('cache.loadingUnifiedCache')}</span>
        </div>
      ) : unifiedCacheStats ? (
        <>
          <div className="space-y-2 rounded border border-border/60 bg-muted/20 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('cache.provider')}</span>
              <Badge variant="outline">{getProviderLabel(providerDiagnostics.providerId, t)}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-background/60 p-2">
                <div className="text-[11px] text-muted-foreground">{t('cache.clearAll')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsClear, providerDiagnostics.available)}
                </div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="text-[11px] text-muted-foreground">{t('cache.cleanup')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsCleanup, providerDiagnostics.available)}
                </div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="text-[11px] text-muted-foreground">{t('cache.flush')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsFlush, providerDiagnostics.available)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.total}</div>
                <div className="text-muted-foreground">{t('cache.integrationAudit')}</div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.persistentShared}</div>
                <div className="text-muted-foreground">{t('cache.persistentShared')}</div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.localOnly}</div>
                <div className="text-muted-foreground">{t('cache.localOnly')}</div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.uncached}</div>
                <div className="text-muted-foreground">{t('cache.uncachedByDesign')}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.active}</div>
                <div className="text-muted-foreground">{t('cache.statusActive')}</div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.degraded}</div>
                <div className="text-muted-foreground">{t('cache.statusDegraded')}</div>
              </div>
              <div className="rounded bg-background/60 p-2">
                <div className="font-medium">{diagnosticsSummary.mismatch}</div>
                <div className="text-muted-foreground">{t('cache.statusMismatch')}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium">{unifiedCacheStats.total_entries}</div>
              <div className="text-xs text-muted-foreground">{t('cache.entries')}</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium">{formatBytes(unifiedCacheStats.total_size)}</div>
              <div className="text-xs text-muted-foreground">{t('cache.size')}</div>
            </div>
            <div className="text-center p-2 bg-muted/30 rounded">
              <div className="font-medium">{(unifiedCacheStats.hit_rate * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">{t('cache.hitRate')}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupUnifiedCache}
              className="flex-1"
              disabled={!providerDiagnostics.supportsCleanup}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('cache.cleanup')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFlushUnifiedCache}
              className="flex-1"
              disabled={!providerDiagnostics.supportsFlush}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('cache.flush')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={unifiedCacheStats.total_entries === 0 || !providerDiagnostics.supportsClear}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('cache.clearAll')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cache.clearUnifiedCache')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('cache.clearUnifiedCacheDescription', {
                      count: unifiedCacheStats.total_entries,
                      size: formatBytes(unifiedCacheStats.total_size),
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearUnifiedCache}>
                    {t('cache.clearAll')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {unifiedCacheKeys.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                {t('cache.cachedItems')} ({unifiedCacheKeys.length})
              </h4>
              <ScrollArea className="h-[160px]">
                <div className="space-y-1 pr-2">
                  {unifiedCacheKeys.slice(0, 20).map((key) => (
                    <div
                      key={key}
                      className="text-xs p-2 bg-muted/30 rounded truncate"
                      title={key}
                    >
                      {key}
                    </div>
                  ))}
                  {unifiedCacheKeys.length > 20 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      {t('cache.moreItems', { count: unifiedCacheKeys.length - 20 })}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-medium">{t('cache.integrationAudit')}</h4>
            <div className="space-y-1">
              {integrationDiagnostics.map((integration) => (
                <div key={integration.id} className="rounded bg-muted/30 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{integration.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {t('cache.modulePath')}: {integration.modulePath}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline">{getStatusLabel(integration.status, t)}</Badge>
                      <Badge variant="outline">{getModeLabel(integration.cacheMode, t)}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      {t('cache.currentEnvironment')}: {getEnvironmentLabel(integration.runtimeEnvironment, t)}
                    </span>
                    <span>
                      {t('cache.environmentCoverage')}:{' '}
                      {integration.environments.map((environment) => getEnvironmentLabel(environment, t)).join(' / ')}
                    </span>
                  </div>
                  {integration.statusReason ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {t('cache.integrationReason')}: {integration.statusReason}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={HardDrive}
          message={t('cache.unifiedCacheEmpty')}
          iconClassName="h-12 w-12 mb-3"
        />
      )}
    </div>
  );
}
