'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Download,
  Upload,
  Trash2,
  FolderOpen,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { storage, isTauri, readFileAsText } from '@/lib/storage';
import { storageApi } from '@/lib/tauri';
import type { StorageStats, ImportResult } from '@/lib/storage';
import { createLogger } from '@/lib/logger';
import { formatBytes } from '@/lib/offline';
import type { DataManagerProps } from '@/types/starmap/management';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';

const logger = createLogger('data-manager');

export function DataManager({ trigger }: DataManagerProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDesktop = isTauri();

  // Load storage stats when dialog opens
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setLoading(true);
      try {
        // Use Tauri storage API if available, otherwise fallback to web storage
        const storageStats = isDesktop && storageApi.isAvailable()
          ? await storageApi.getStorageStats()
          : await storage.getStorageStats();
        setStats(storageStats);
      } catch (error) {
        logger.error('Failed to load storage stats', error);
      } finally {
        setLoading(false);
      }
    }
  };

  // Export data
  const handleExport = async () => {
    setExporting(true);
    try {
      if (isDesktop && storageApi.isAvailable()) {
        // Use Tauri storage API for desktop
        if (typeof window !== 'undefined') {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const filePath = await save({
            defaultPath: `skymap-export-${new Date().toISOString().split('T')[0]}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }]
          });
          if (!filePath) {
            return; // User cancelled
          }
          await storageApi.exportAllData(filePath);
        }
      } else {
        // Use web storage for browser
        await storage.exportAllData();
      }
      toast.success(t('dataManager.exportSuccess') || 'Data exported successfully');
    } catch (error) {
      if ((error as Error).message === 'Export cancelled') {
        return;
      }
      toast.error(t('dataManager.exportError') || 'Failed to export data');
      logger.error('Export error', error);
    } finally {
      setExporting(false);
    }
  };

  // Import data (Web)
  const handleImportWeb = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const jsonData = await readFileAsText(file);
      const result: ImportResult = await storage.importAllData(jsonData);

      if (result.errors.length > 0) {
        toast.warning(
          t('dataManager.importPartial') || 'Some items failed to import',
          {
            description: `${result.imported_count} imported, ${result.skipped_count} skipped`,
          }
        );
      } else {
        toast.success(t('dataManager.importSuccess') || 'Data imported successfully', {
          description: `${result.imported_count} items imported`,
        });
      }

      // Prompt user to reload to apply imported data
      toast.info(t('dataManager.reloadRequired') || 'Reload required to apply changes', {
        duration: Infinity,
        action: {
          label: t('dataManager.reloadNow') || 'Reload now',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      toast.error(t('dataManager.importError') || 'Failed to import data');
      logger.error('Import error', error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Import data (Tauri)
  const handleImportTauri = async () => {
    setImporting(true);
    try {
      let result: ImportResult;
      
      if (isDesktop && storageApi.isAvailable()) {
        // Use Tauri storage API for desktop
        if (typeof window !== 'undefined') {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({
            filters: [{ name: 'JSON', extensions: ['json'] }]
          });
          if (selected && typeof selected === 'string') {
            result = await storageApi.importAllData(selected);
          } else {
            return; // User cancelled
          }
        } else {
          return;
        }
      } else {
        // Fallback to web storage
        result = await storage.importAllData();
      }

      if (result.errors.length > 0) {
        toast.warning(
          t('dataManager.importPartial') || 'Some items failed to import',
          {
            description: `${result.imported_count} imported, ${result.skipped_count} skipped`,
          }
        );
      } else {
        toast.success(t('dataManager.importSuccess') || 'Data imported successfully', {
          description: `${result.imported_count} items imported`,
        });
      }

      // Prompt user to reload to apply imported data
      toast.info(t('dataManager.reloadRequired') || 'Reload required to apply changes', {
        duration: Infinity,
        action: {
          label: t('dataManager.reloadNow') || 'Reload now',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      if ((error as Error).message === 'Import cancelled') {
        return;
      }
      toast.error(t('dataManager.importError') || 'Failed to import data');
      logger.error('Import error', error);
    } finally {
      setImporting(false);
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    try {
      const count = isDesktop && storageApi.isAvailable()
        ? await storageApi.clearAllData()
        : await storage.clearAllData();
      
      toast.success(t('dataManager.clearSuccess') || 'All data cleared', {
        description: `${count} stores deleted`,
      });

      // Prompt user to reload to apply cleared state
      toast.info(t('dataManager.reloadRequired') || 'Reload required to apply changes', {
        duration: Infinity,
        action: {
          label: t('dataManager.reloadNow') || 'Reload now',
          onClick: () => window.location.reload(),
        },
      });
    } catch (error) {
      toast.error(t('dataManager.clearError') || 'Failed to clear data');
      logger.error('Clear error', error);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} tier="standard-form">
      <ResponsiveDialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <HardDrive className="h-4 w-4 mr-2" />
            {t('dataManager.title') || 'Data Manager'}
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            {t('dataManager.title') || 'Data Manager'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isDesktop
              ? t('dataManager.descriptionDesktop') ||
                'Manage your locally stored data'
              : t('dataManager.descriptionWeb') ||
                'Manage your browser stored data'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Storage Stats */}
          <Card className="py-3">
            <CardHeader className="px-4 py-0">
              <CardTitle className="text-sm">
                {t('dataManager.storageInfo') || 'Storage Information'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 py-0">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading') || 'Loading...'}
                </div>
              ) : stats ? (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium">
                      {t('dataManager.totalSize') || 'Total Size'}:
                    </span>{' '}
                    {formatBytes(stats.total_size)}
                  </p>
                  <p>
                    <span className="font-medium">
                      {t('dataManager.storeCount') || 'Stores'}:
                    </span>{' '}
                    {stats.store_count}
                  </p>
                  {isDesktop && (
                    <p className="text-xs truncate" title={stats.directory}>
                      <span className="font-medium">
                        {t('dataManager.location') || 'Location'}:
                      </span>{' '}
                      {stats.directory}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('dataManager.noData') || 'No data available'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            {/* Export */}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting || !stats?.store_count}
              className="w-full"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {t('dataManager.export') || 'Export'}
            </Button>

            {/* Import */}
            {isDesktop ? (
              <Button
                variant="outline"
                onClick={handleImportTauri}
                disabled={importing}
                className="w-full"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {t('dataManager.import') || 'Import'}
              </Button>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportWeb}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {t('dataManager.import') || 'Import'}
                </Button>
              </>
            )}
          </div>

          {/* Show Data Directory (Desktop only) */}
          {isDesktop && (
            <Button
              variant="outline"
              onClick={async () => {
                const dir = await storage.getDataDirectory();
                // Copy to clipboard and show toast
                const copied = await copyTextWithFeedback({
                  text: dir,
                  successMessage: t('dataManager.directoryCopied') || 'Directory path copied',
                  errorMessage: 'Failed to copy directory path',
                  successDescription: dir,
                });
                if (!copied) {
                  toast.info(t('dataManager.directoryPath') || 'Data directory', {
                    description: dir,
                  });
                }
              }}
              className="w-full"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('dataManager.copyDirectory') || 'Copy Data Directory Path'}
            </Button>
          )}

          {/* Clear All Data */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!stats?.store_count}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('dataManager.clearAll') || 'Clear All Data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {t('dataManager.clearConfirmTitle') || 'Clear All Data?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('dataManager.clearConfirmDescription') ||
                    'This will permanently delete all your saved targets, markers, and settings. This action cannot be undone.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t('common.cancel') || 'Cancel'}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('dataManager.clearConfirm') || 'Yes, Clear All'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <ResponsiveDialogFooter className="sm:justify-start">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isDesktop ? (
              <>
                <CheckCircle className="h-3 w-3 text-green-500" />
                {t('dataManager.desktopMode') || 'Desktop Mode (Local Files)'}
              </>
            ) : (
              <>
                <CheckCircle className="h-3 w-3 text-blue-500" />
                {t('dataManager.webMode') || 'Web Mode (Browser Storage)'}
              </>
            )}
          </div>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
