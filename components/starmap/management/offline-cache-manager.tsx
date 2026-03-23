'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Trash2,
  Cloud,
  CloudOff,
  Loader2,
  HardDrive,
  Package,
  RefreshCw,
  Telescope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useOfflineStore, formatBytes, STELLARIUM_LAYERS, offlineCacheManager, type StorageInfo } from '@/lib/offline';
import { toast } from 'sonner';
import { useCache } from '@/lib/tauri/hooks';
import { isTauri } from '@/lib/storage/platform';
import { createLogger } from '@/lib/logger';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { getCacheDiagnosticsSummary, getCacheProviderDiagnostics } from '@/lib/cache';

import { CacheLayersTab } from './cache-layers-tab';
import { CacheSurveysTab } from './cache-surveys-tab';
import { CacheUnifiedTab } from './cache-unified-tab';

const logger = createLogger('offline-cache-manager');

function getCapabilityStateLabel(supported: boolean, providerAvailable: boolean): 'supported' | 'degraded' | 'unsupported' {
  if (supported) return 'supported';
  return providerAvailable ? 'degraded' : 'unsupported';
}

export function OfflineCacheManager() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<'layers' | 'surveys' | 'unified'>('layers');
  const isClient = useIsClient();
  
  // Storage info state
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  
  // Tauri cache hook for desktop-specific cache management
  const tauriCache = useCache();
  
  const {
    isOnline,
    isInitialized,
    layerStatuses,
    isDownloading,
    autoDownloadOnWifi,
    initialize,
    refreshStatuses,
    downloadAllLayers,
    cancelAllDownloads,
    clearAllCache,
    setAutoDownloadOnWifi,
  } = useOfflineStore();

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [isInitialized, initialize]);

  // Fetch storage info - use Tauri stats when available
  const refreshStorageInfo = useCallback(async () => {
    try {
      if (tauriCache.isAvailable) {
        await tauriCache.refresh();
      }
      const info = await offlineCacheManager.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      logger.error('Failed to refresh storage info', error);
      toast.error(t('cache.loadFailed'));
    }
  }, [tauriCache, t]);

  // Refresh storage info on mount (once only)
  const storageInfoLoaded = useRef(false);
  useEffect(() => {
    if (storageInfoLoaded.current) return;
    storageInfoLoaded.current = true;

    let cancelled = false;
    (async () => {
      try {
        if (tauriCache.isAvailable) {
          await tauriCache.refresh();
        }
        const info = await offlineCacheManager.getStorageInfo();
        if (!cancelled) setStorageInfo(info);
      } catch (error) {
        logger.error('Failed to load initial storage info', error);
      }
    })();
    return () => { cancelled = true; };
  }, [tauriCache]);

  // Calculate total stats
  const totalSize = STELLARIUM_LAYERS.reduce((acc, l) => acc + l.size, 0);
  const cachedSize = layerStatuses.reduce((acc, s) => acc + s.cachedBytes, 0);
  const cachedLayers = layerStatuses.filter((s) => s.cached).length;
  const totalLayers = STELLARIUM_LAYERS.length;
  const overallProgress = totalSize > 0 ? (cachedSize / totalSize) * 100 : 0;
  const providerDiagnostics = getCacheProviderDiagnostics();
  const diagnosticsSummary = getCacheDiagnosticsSummary();

  return (
      <Card className="bg-card/95 backdrop-blur-sm border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t('cache.offlineCache')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isClient ? (
                isOnline ? (
                  <Badge variant="outline" className="text-green-500 border-green-500/50">
                    <Cloud className="h-3 w-3 mr-1" />
                    {t('common.online')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                    <CloudOff className="h-3 w-3 mr-1" />
                    {t('common.offline')}
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="text-green-500 border-green-500/50">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {t('common.loading')}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => refreshStatuses()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            {t('cache.layersCached', {
              cached: cachedLayers,
              total: totalLayers,
              size: formatBytes(cachedSize),
            })}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Storage Info */}
          {storageInfo && storageInfo.quota > 0 && (
            <div className="space-y-1 p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t('cache.storageUsed')}</span>
                <span className="text-foreground font-mono">
                  {formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}
                </span>
              </div>
              <Progress value={storageInfo.usagePercent} className="h-1.5" />
              <div className="text-xs text-muted-foreground">
                {formatBytes(storageInfo.available)} {t('cache.available')}
              </div>
            </div>
          )}

          <div className="space-y-1 p-2 bg-muted/30 rounded-lg text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('cache.provider')}</span>
              <span className="font-medium">
                {providerDiagnostics.providerId === 'tauri-unified-cache'
                  ? t('cache.providerDesktop')
                  : providerDiagnostics.providerId === 'browser-cache-api'
                    ? t('cache.providerBrowser')
                    : t('cache.providerUnavailable')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('cache.integrationAudit')}</span>
              <span className="font-mono">{diagnosticsSummary.total}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t('cache.persistentShared')}</span>
              <span>{diagnosticsSummary.persistentShared}</span>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1">
              <div className="rounded bg-background/60 p-1 text-center">
                <div className="text-[10px] text-muted-foreground">{t('cache.clearAll')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsClear, providerDiagnostics.available)}
                </div>
              </div>
              <div className="rounded bg-background/60 p-1 text-center">
                <div className="text-[10px] text-muted-foreground">{t('cache.cleanup')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsCleanup, providerDiagnostics.available)}
                </div>
              </div>
              <div className="rounded bg-background/60 p-1 text-center">
                <div className="text-[10px] text-muted-foreground">{t('cache.flush')}</div>
                <div className="font-medium">
                  {getCapabilityStateLabel(providerDiagnostics.supportsFlush, providerDiagnostics.available)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Tauri Desktop Cache Stats */}
          {isTauri() && tauriCache.stats && (
            <div className="space-y-1 p-2 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  {t('cache.desktopCache')}
                </span>
                <Badge variant="outline" className="text-[10px] h-4">{t('cache.desktopBadge')}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{tauriCache.stats.total_tiles} {t('cache.tiles')}</span>
                <span className="text-foreground font-mono">
                  {formatBytes(tauriCache.stats.total_size_bytes)}
                </span>
              </div>
              {tauriCache.regions.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {t('cache.cachedRegions', { count: tauriCache.regions.length })}
                </div>
              )}
            </div>
          )}

          {/* Overall progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('cache.cacheStatus')}</span>
              <span className="text-foreground">{overallProgress.toFixed(0)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadAllLayers()}
                  disabled={isDownloading || !isOnline}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4 mr-1" />
                  )}
                  {t('cache.downloadAll')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('cache.downloadAllDescription', { size: formatBytes(totalSize) })}</p>
              </TooltipContent>
            </Tooltip>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={cachedSize === 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cache.clearAllCache')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('cache.clearAllCacheDescription', { size: formatBytes(cachedSize) })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearAllCache()}>
                    {t('cache.clearAll')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Auto-download setting */}
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-download" className="text-xs text-muted-foreground">
              {t('cache.autoDownloadOnWifi')}
            </Label>
            <Switch
              id="auto-download"
              checked={autoDownloadOnWifi}
              onCheckedChange={setAutoDownloadOnWifi}
            />
          </div>

          {/* Tabbed content for layers, surveys, and unified cache */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'layers' | 'surveys' | 'unified')}>
            <TabsList className={`grid w-full ${isTauri() ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="layers" className="text-xs">
                <Package className="h-3.5 w-3.5 mr-1" />
                {t('cache.manageIndividualLayers')}
              </TabsTrigger>
              <TabsTrigger value="surveys" className="text-xs">
                <Telescope className="h-3.5 w-3.5 mr-1" />
                {t('settings.skySurveys')}
              </TabsTrigger>
              {isTauri() && (
                <TabsTrigger value="unified" className="text-xs">
                  <HardDrive className="h-3.5 w-3.5 mr-1" />
                  {t('cache.unifiedCache')}
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="layers" className="mt-2">
              <CacheLayersTab onStorageChanged={refreshStorageInfo} />
            </TabsContent>
            
            <TabsContent value="surveys" className="mt-2">
              <CacheSurveysTab isActive={activeTab === 'surveys'} />
            </TabsContent>
            
            {isTauri() && (
              <TabsContent value="unified" className="mt-2">
                <CacheUnifiedTab isActive={activeTab === 'unified'} />
              </TabsContent>
            )}
          </Tabs>

          {/* Cancel button when downloading */}
          {isDownloading && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => cancelAllDownloads()}
            >
              {t('cache.cancelDownloads')}
            </Button>
          )}
        </CardContent>
      </Card>
  );
}
