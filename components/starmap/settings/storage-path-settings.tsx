'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  FolderOpen,
  FolderSync,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  HardDrive,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { toast } from 'sonner';
import { pathConfigApi } from '@/lib/tauri/path-config-api';
import type { PathInfo } from '@/lib/tauri/path-config-api';
import { formatBytes } from '@/lib/offline';
import { createLogger } from '@/lib/logger';
import { SettingsSection } from './settings-shared';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';

const logger = createLogger('storage-path-settings');

export function StoragePathSettings() {
  const t = useTranslations();
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState<'data' | 'cache' | null>(null);

  const loadPathInfo = useCallback(async () => {
    try {
      setLoading(true);
      const info = await pathConfigApi.getPathConfig();
      setPathInfo(info);
    } catch (error) {
      logger.error('Failed to load path config', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async data fetch from the Tauri backend on mount; defer past the effect body so
    // the loading-state set inside doesn't run synchronously during the effect.
    queueMicrotask(() => {
      loadPathInfo();
    });
  }, [loadPathInfo]);

  const handlePickDirectory = async (type: 'data' | 'cache') => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (!selected || typeof selected !== 'string') return;

      // Validate the directory
      const validation = await pathConfigApi.validateDirectory(selected);
      if (!validation.valid) {
        toast.error(t('storagePaths.invalidDirectory'), {
          description: validation.error || undefined,
        });
        return;
      }

      if (validation.available_bytes !== null && validation.available_bytes < 100 * 1024 * 1024) {
        toast.warning(t('storagePaths.insufficientSpace'), {
          description: `${formatBytes(validation.available_bytes)} ${t('cache.available')}`,
        });
      }

      // Ask whether to migrate
      if (type === 'data') {
        await handleMigrateData(selected);
      } else {
        await handleMigrateCache(selected);
      }
    } catch (error) {
      logger.error(`Failed to pick ${type} directory`, error);
      toast.error(t('storagePaths.changeError'));
    }
  };

  const handleMigrateData = async (targetDir: string) => {
    setMigrating('data');
    try {
      const result = await pathConfigApi.migrateDataDir(targetDir);
      if (result.success) {
        toast.success(t('storagePaths.migrateSuccess'), {
          description: `${result.files_copied} ${t('storagePaths.filesCopied')}, ${formatBytes(result.bytes_copied)}`,
        });
        toast.info(t('storagePaths.restartRequired'), { duration: 8000 });
        await loadPathInfo();
      } else {
        toast.error(t('storagePaths.migrateError'), {
          description: result.error || undefined,
        });
      }
    } catch (error) {
      toast.error(t('storagePaths.migrateError'));
      logger.error('Data migration failed', error);
    } finally {
      setMigrating(null);
    }
  };

  const handleMigrateCache = async (targetDir: string) => {
    setMigrating('cache');
    try {
      const result = await pathConfigApi.migrateCacheDir(targetDir);
      if (result.success) {
        toast.success(t('storagePaths.migrateSuccess'), {
          description: `${result.files_copied} ${t('storagePaths.filesCopied')}, ${formatBytes(result.bytes_copied)}`,
        });
        toast.info(t('storagePaths.restartRequired'), { duration: 8000 });
        await loadPathInfo();
      } else {
        toast.error(t('storagePaths.migrateError'), {
          description: result.error || undefined,
        });
      }
    } catch (error) {
      toast.error(t('storagePaths.migrateError'));
      logger.error('Cache migration failed', error);
    } finally {
      setMigrating(null);
    }
  };

  const handleResetPaths = async () => {
    try {
      await pathConfigApi.resetPathsToDefault();
      toast.success(t('storagePaths.pathResetSuccess'));
      toast.info(t('storagePaths.restartRequired'), { duration: 8000 });
      await loadPathInfo();
    } catch (error) {
      logger.error('Failed to reset paths', error);
      toast.error(t('storagePaths.resetError'));
    }
  };

  const handleOpenInExplorer = async (path: string) => {
    try {
      const { appSettingsApi } = await import('@/lib/tauri/api');
      await appSettingsApi.revealInFileManager(path);
    } catch (_revealErr) {
      // Fallback: copy path to clipboard
      const copied = await copyTextWithFeedback({
        text: path,
        successMessage: t('dataManager.directoryCopied'),
        errorMessage: 'Failed to copy path',
        successDescription: path,
      });
      if (!copied) {
        toast.info(path);
      }
    }
  };

  if (loading) {
    return (
      <SettingsSection
        title={t('storagePaths.title')}
        icon={<FolderOpen className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title={t('storagePaths.title')}
      icon={<FolderOpen className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Migrating indicator */}
        {migrating && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-primary">
              {t('storagePaths.migrating')}
            </span>
            <Progress className="flex-1 h-1.5" />
          </div>
        )}

        {/* Data Directory */}
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">
                {t('storagePaths.dataDirectory')}
              </Label>
            </div>
            {pathInfo?.has_custom_data_dir && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {t('storagePaths.custom')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate" title={pathInfo?.data_dir}>
            {pathInfo?.data_dir}
          </p>
          {pathInfo?.has_custom_data_dir && (
            <p className="text-[10px] text-muted-foreground">
              {t('storagePaths.defaultPath')}: {pathInfo.default_data_dir}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => handlePickDirectory('data')}
              disabled={migrating !== null}
            >
              <FolderSync className="h-3.5 w-3.5 mr-1" />
              {t('storagePaths.changePath')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => pathInfo && handleOpenInExplorer(pathInfo.data_dir)}
              title={t('storagePaths.openInExplorer')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Cache Directory */}
        <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">
                {t('storagePaths.cacheDirectory')}
              </Label>
            </div>
            {pathInfo?.has_custom_cache_dir && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {t('storagePaths.custom')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate" title={pathInfo?.cache_dir}>
            {pathInfo?.cache_dir}
          </p>
          {pathInfo?.has_custom_cache_dir && (
            <p className="text-[10px] text-muted-foreground">
              {t('storagePaths.defaultPath')}: {pathInfo.default_cache_dir}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => handlePickDirectory('cache')}
              disabled={migrating !== null}
            >
              <FolderSync className="h-3.5 w-3.5 mr-1" />
              {t('storagePaths.changePath')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => pathInfo && handleOpenInExplorer(pathInfo.cache_dir)}
              title={t('storagePaths.openInExplorer')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Reset to Default */}
        {(pathInfo?.has_custom_data_dir || pathInfo?.has_custom_cache_dir) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs"
                disabled={migrating !== null}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                {t('storagePaths.resetToDefault')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  {t('storagePaths.resetConfirmTitle')}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('storagePaths.resetConfirmDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetPaths}>
                  {t('storagePaths.resetToDefault')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Info text */}
        <div className="flex items-start gap-2 p-2 bg-muted/20 rounded-lg">
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t('storagePaths.description')}
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}
