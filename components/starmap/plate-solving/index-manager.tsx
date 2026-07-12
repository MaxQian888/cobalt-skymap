'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { appDataDir, join } from '@tauri-apps/api/path';
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { usePlateSolverStore, selectActiveSolver } from '@/lib/stores/plate-solver-store';
import type { IndexManagerProps, DownloadState } from '@/types/starmap/plate-solving';
import type { IndexInfo, DownloadableIndex, AstapDatabaseInfo } from '@/lib/tauri/plate-solver-api';
import {
  formatFileSize,
  getSolverDisplayName,
  getAvailableIndexes,
  getInstalledIndexes,
  deleteIndex,
  downloadIndex,
  getDefaultIndexPath,
} from '@/lib/tauri/plate-solver-api';
import { isTauri } from '@/lib/tauri/app-control-api';
import { isDesktop as isDesktopDevice } from '@/lib/storage/platform';

// Re-export types for backward compatibility
export type { IndexManagerProps, DownloadState } from '@/types/starmap/plate-solving';

const MAX_CONCURRENT_DOWNLOADS = 2;

// ============================================================================
// Component
// ============================================================================

export function IndexManager({ solverType, trigger, className }: IndexManagerProps) {
  const t = useTranslations();
  const {
    config,
    detectSolvers,
    astapDatabases,
    loadAstapDatabases,
    downloadAstapDatabase,
    setConfig,
    saveConfig,
  } = usePlateSolverStore();
  usePlateSolverStore(selectActiveSolver);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [installedIndexes, setInstalledIndexes] = useState<IndexInfo[]>([]);
  const [availableIndexes, setAvailableIndexes] = useState<DownloadableIndex[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloads, setDownloads] = useState<Map<string, DownloadState>>(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<IndexInfo | null>(null);

  const currentSolverType = solverType || config.solver_type;
  // Index/database management talks to #[cfg(desktop)] commands only.
  const isDesktop = isTauri() && isDesktopDevice();

  // Load indexes
  const loadIndexes = useCallback(async () => {
    if (currentSolverType === 'astrometry_net_online') return;

    setIsLoading(true);
    setError(null);

    try {
      const [installed, available] = await Promise.all([
        getInstalledIndexes(currentSolverType, config.index_path ?? undefined),
        getAvailableIndexes(currentSolverType),
      ]);
      setInstalledIndexes(installed);
      setAvailableIndexes(available);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('plateSolving.failedToLoadIndexes'));
    } finally {
      setIsLoading(false);
    }
  }, [currentSolverType, config.index_path, t]);

  useEffect(() => {
    if (!open || !isDesktop) return;

    let unlisten: UnlistenFn | null = null;

    (async () => {
      try {
        unlisten = await listen<{
          index_name: string;
          downloaded: number;
          total: number;
          percent: number;
        }>('index-download-progress', (event) => {
          const payload = event.payload;
          setDownloads((prev) => {
            const next = new Map(prev);
            const prevState = next.get(payload.index_name);
            next.set(payload.index_name, {
              fileName: payload.index_name,
              progress: payload.percent,
              status: prevState?.status === 'error' ? 'error' : 'downloading',
              error: prevState?.error,
            });
            return next;
          });
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [open, isDesktop]);

  const activeDownloadCount = Array.from(downloads.values()).filter(
    (d) => d.status === 'downloading'
  ).length;

  const handleDownload = useCallback(async (index: DownloadableIndex) => {
    if (!isDesktop) {
      window.open(index.download_url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Concurrency guard using functional state access to avoid stale closure
    let blocked = false;
    setDownloads((prev) => {
      const activeCount = Array.from(prev.values()).filter(
        (d) => d.status === 'downloading'
      ).length;
      if (activeCount >= MAX_CONCURRENT_DOWNLOADS) {
        blocked = true;
        return prev;
      }
      const next = new Map(prev);
      next.set(index.name, {
        fileName: index.file_name,
        progress: 0,
        status: 'downloading',
      });
      return next;
    });
    if (blocked) return;

    setError(null);

    try {
      const basePath = config.index_path ?? (await getDefaultIndexPath(currentSolverType));
      if (!basePath) {
        throw new Error(t('plateSolving.indexPathNotAvailable'));
      }

      const destPath = await join(basePath, index.file_name);
      const sizeMb = Math.max(1, Math.ceil(index.size_bytes / (1024 * 1024)));

      await downloadIndex(
        {
          name: index.name,
          url: index.download_url,
          scale_low: index.scale_range.min_arcmin,
          scale_high: index.scale_range.max_arcmin,
          size_mb: sizeMb,
          description: index.description,
        },
        destPath
      );

      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(index.name, {
          fileName: index.file_name,
          progress: 100,
          status: 'complete',
        });
        return next;
      });

      await loadIndexes();
      await detectSolvers();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('plateSolving.downloadFailed');
      setDownloads((prev) => {
        const next = new Map(prev);
        next.set(index.name, {
          fileName: index.file_name,
          progress: 0,
          status: 'error',
          error: message,
        });
        return next;
      });
      setError(message);
    }
  }, [isDesktop, config.index_path, currentSolverType, loadIndexes, detectSolvers, t]);

  // Load on open
  useEffect(() => {
    if (open) {
      // Async data fetch triggered by dialog open; defer past the effect body so the
      // loading-state set inside doesn't run synchronously during the effect.
      queueMicrotask(() => {
        loadIndexes();
      });
    }
  }, [open, loadIndexes]);

  // ASTAP databases live in a separate catalog (not the astrometry index list).
  useEffect(() => {
    if (open && currentSolverType === 'astap') {
      loadAstapDatabases();
    }
  }, [open, currentSolverType, loadAstapDatabases]);

  // Download + install an ASTAP star database into the app's astap_data dir.
  const handleDownloadDb = useCallback(
    async (db: AstapDatabaseInfo) => {
      // Databases that ship only as .exe/.pkg point users to the ASTAP website.
      if (!db.download_url) {
        window.open('https://www.hnsky.org/astap.htm', '_blank', 'noopener,noreferrer');
        return;
      }
      if (!isDesktop) {
        window.open(db.download_url, '_blank', 'noopener,noreferrer');
        return;
      }

      let blocked = false;
      setDownloads((prev) => {
        const activeCount = Array.from(prev.values()).filter(
          (d) => d.status === 'downloading'
        ).length;
        if (activeCount >= MAX_CONCURRENT_DOWNLOADS) {
          blocked = true;
          return prev;
        }
        const next = new Map(prev);
        next.set(db.name, { fileName: db.name, progress: 0, status: 'downloading' });
        return next;
      });
      if (blocked) return;

      setError(null);

      try {
        const destDir = await join(await appDataDir(), 'astap_data');
        await downloadAstapDatabase(db, destDir);

        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(db.name, { fileName: db.name, progress: 100, status: 'complete' });
          return next;
        });

        // Point the solver at the downloaded database directory.
        setConfig({ index_path: destDir });
        await saveConfig();
        await loadIndexes();
        await detectSolvers();
      } catch (err) {
        const message = err instanceof Error ? err.message : t('plateSolving.downloadFailed');
        setDownloads((prev) => {
          const next = new Map(prev);
          next.set(db.name, {
            fileName: db.name,
            progress: 0,
            status: 'error',
            error: message,
          });
          return next;
        });
        setError(message);
      }
    },
    [isDesktop, downloadAstapDatabase, setConfig, saveConfig, loadIndexes, detectSolvers, t]
  );


  // Delete an index
  const handleDelete = useCallback(async (index: IndexInfo) => {
    try {
      await deleteIndex(index.path);
      await loadIndexes();
      await detectSolvers();
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('plateSolving.failedToDeleteIndex'));
    }
  }, [loadIndexes, detectSolvers, t]);

  // Check if an index is installed
  const isIndexInstalled = useCallback(
    (name: string) => installedIndexes.some((idx) => idx.name === name),
    [installedIndexes]
  );

  // Get download state for an index
  const getDownloadState = useCallback(
    (name: string) => downloads.get(name),
    [downloads]
  );

  // Render installed index item
  const renderInstalledIndex = (index: IndexInfo) => (
    <div
      key={index.path}
      className="flex items-center justify-between p-3 rounded-lg border bg-card"
    >
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-medium">{index.name}</div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(index.size_bytes)}
            {index.scale_range && (
              <span className="ml-2">
                ({index.scale_range.min_arcmin.toFixed(0)}-
                {index.scale_range.max_arcmin.toFixed(0)} arcmin)
              </span>
            )}
          </div>
          {index.description && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {index.description}
            </div>
          )}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteConfirm(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('plateSolving.deleteIndex') || 'Delete Index'}</TooltipContent>
      </Tooltip>
    </div>
  );

  // Render available index item
  const renderAvailableIndex = (index: DownloadableIndex & { _recommended?: boolean }) => {
    const installed = isIndexInstalled(index.name);
    const downloadState = getDownloadState(index.name);

    return (
      <div
        key={index.name}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border',
          installed ? 'bg-muted/50' : 'bg-card',
          index._recommended && !installed && 'border-primary'
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Database className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{index.name}</span>
              {installed && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('plateSolving.installed') || 'Installed'}
                </Badge>
              )}
              {index._recommended && !installed && (
                <Badge variant="default" className="text-xs">
                  {t('plateSolving.recommended') || 'Recommended'}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(index.size_bytes)}
              <span className="ml-2">
                ({index.scale_range.min_arcmin.toFixed(0)}-
                {index.scale_range.max_arcmin.toFixed(0)} arcmin)
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {index.description}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          {downloadState ? (
            <div className="w-32">
              {downloadState.status === 'downloading' && (
                <div className="space-y-1">
                  <Progress value={downloadState.progress} className="h-2" />
                  <div className="text-xs text-center text-muted-foreground">
                    {downloadState.progress.toFixed(0)}%
                  </div>
                </div>
              )}
              {downloadState.status === 'complete' && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('plateSolving.complete') || 'Complete'}
                </Badge>
              )}
              {downloadState.status === 'error' && (
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {t('plateSolving.error') || 'Error'}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{downloadState.error}</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : installed ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(index)}
              disabled={activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.download') || 'Download'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Render an ASTAP star database item (separate catalog from astrometry indexes)
  const renderAstapDatabase = (db: AstapDatabaseInfo) => {
    const installed = db.installed;
    const downloadState = getDownloadState(db.name);
    const websiteOnly = !db.download_url;

    return (
      <div
        key={db.abbreviation}
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border',
          installed ? 'bg-muted/50' : 'bg-card'
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Database className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{db.name}</span>
              {installed && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t('plateSolving.installed') || 'Installed'}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(db.size_mb * 1024 * 1024)}
              <span className="ml-2">
                (FOV {db.fov_min_deg}–{db.fov_max_deg}°)
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{db.description}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          {downloadState && downloadState.status === 'downloading' ? (
            <div className="w-32 space-y-1">
              <Progress value={downloadState.progress} className="h-2" />
              <div className="text-xs text-center text-muted-foreground">
                {downloadState.progress.toFixed(0)}%
              </div>
            </div>
          ) : installed ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : websiteOnly ? (
            <a
              href="https://www.hnsky.org/astap.htm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t('plateSolving.databaseWebsiteOnly') || 'Website'}
            </a>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownloadDb(db)}
              disabled={activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS}
            >
              <Download className="h-4 w-4 mr-1" />
              {t('common.download') || 'Download'}
            </Button>
          )}
          {downloadState && downloadState.status === 'error' && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('plateSolving.error') || 'Error'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{downloadState.error}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  };

  if (currentSolverType === 'astrometry_net_online') {
    return null;
  }

  return (
    <>
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="complex-editor">
      <ResponsiveDialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={className}>
            <Database className="h-4 w-4 mr-2" />
            {t('plateSolving.manageIndexes') || 'Manage Indexes'}
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[600px]" desktopClassName="max-h-[80vh] max-h-[80dvh]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('plateSolving.indexManager') || 'Index Manager'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t('plateSolving.indexManagerDesc') ||
              `Manage star database index files for ${getSolverDisplayName(currentSolverType)}`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'installed' | 'available')}>
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="installed">
                {t('plateSolving.installed') || 'Installed'}
                <Badge variant="secondary" className="ml-2">
                  {installedIndexes.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="available">
                {t('plateSolving.available') || 'Available'}
              </TabsTrigger>
            </TabsList>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadIndexes}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <TabsContent value="installed" className="mt-0">
            <ScrollArea className="h-[400px] pr-4">
              {installedIndexes.length > 0 ? (
                <div className="space-y-2">
                  {installedIndexes.map(renderInstalledIndex)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px]">
                  <EmptyState
                    icon={Database}
                    message={t('plateSolving.noIndexesInstalled') || 'No index files installed'}
                    iconClassName="h-12 w-12 mb-4"
                  />
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setActiveTab('available')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('plateSolving.downloadIndexes') || 'Download Indexes'}
                  </Button>
                </div>
              )}
            </ScrollArea>

            {installedIndexes.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {t('plateSolving.totalSize') || 'Total size'}:{' '}
                    {formatFileSize(
                      installedIndexes.reduce((sum, idx) => sum + idx.size_bytes, 0)
                    )}
                  </span>
                  <span>
                    {installedIndexes.length}{' '}
                    {t('plateSolving.files') || 'files'}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="mt-0">
            <div className="mb-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {currentSolverType === 'astap'
                    ? t('plateSolving.astapIndexHint') ||
                      'ASTAP uses star databases. D50 is recommended for most setups.'
                    : t('plateSolving.astrometryIndexHint') ||
                      'Download indexes matching your image scale (FOV).'}
                </AlertDescription>
              </Alert>
            </div>

            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {currentSolverType === 'astap'
                  ? astapDatabases.map(renderAstapDatabase)
                  : availableIndexes.map((idx) =>
                      renderAvailableIndex(idx as DownloadableIndex & { _recommended?: boolean })
                    )}
              </div>
            </ScrollArea>

            {currentSolverType === 'astap' && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href="https://www.hnsky.org/astap.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('plateSolving.astapWebsite') || 'ASTAP Website'}
                </a>
              </div>
            )}

            {currentSolverType === 'astrometry_net' && (
              <div className="mt-4 pt-4 border-t">
                <a
                  href="http://data.astrometry.net/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('plateSolving.astrometryIndexes') || 'Astrometry.net Index Files'}
                </a>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>

    </ResponsiveDialog>

    {/* Delete Confirmation AlertDialog */}
    <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('plateSolving.deleteIndex') || 'Delete Index'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('plateSolving.deleteIndexConfirm') ||
              `Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('common.cancel') || 'Cancel'}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
          >
            {t('common.delete') || 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

export default IndexManager;
