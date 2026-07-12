'use client';

/**
 * Minimal ASTAP star-database manager for mobile Tauri.
 * Lists the database catalog from `get_astap_databases_mobile` and downloads
 * zips into <app_data_dir>/astap_data via the shared Rust download command.
 * Desktop uses the full IndexManager instead.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  getAstapDatabasesMobile,
  getAstapDataDirMobile,
  downloadAstapDatabaseMobile,
  type AstapDatabaseInfo,
} from '@/lib/tauri/plate-solver-api';

interface MobileAstapDatabasesProps {
  onInstalledChange?: (installedCount: number) => void;
}

export function MobileAstapDatabases({ onInstalledChange }: MobileAstapDatabasesProps) {
  const t = useTranslations();
  const [databases, setDatabases] = useState<AstapDatabaseInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const dbs = await getAstapDatabasesMobile();
      setDatabases(dbs);
      onInstalledChange?.(dbs.filter((db) => db.installed).length);
    } catch {
      // Command unavailable (web/desktop) — leave list empty
    }
  }, [onInstalledChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- false positive: refresh() only sets state after awaiting the Tauri IPC call, never synchronously in the effect body.
    refresh();
  }, [refresh]);

  const handleDownload = useCallback(async (database: AstapDatabaseInfo) => {
    setDownloading(database.name);
    setProgress(0);
    setError(null);

    let unlisten: (() => void) | null = null;
    try {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{ index_name: string; percent: number }>(
        'index-download-progress',
        (event) => {
          if (event.payload.index_name === database.name) {
            setProgress(event.payload.percent);
          }
        }
      );

      const destDir = await getAstapDataDirMobile();
      await downloadAstapDatabaseMobile(database, destDir);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unlisten?.();
      setDownloading(null);
    }
  }, [refresh]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {t('plateSolving.starDatabases') || 'Star Databases'}
      </div>
      <div className="space-y-1">
        {databases.map((db) => (
          <div
            key={db.abbreviation}
            className="flex items-center justify-between gap-2 rounded border bg-muted/30 p-2 text-xs"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                {db.name}
                <span className="text-muted-foreground font-normal">{db.size_mb} MB</span>
              </div>
              <div className="text-muted-foreground truncate">{db.description}</div>
            </div>
            {db.installed ? (
              <Badge variant="default" className="bg-green-600 shrink-0 text-xs">
                <CheckCircle className="mr-1 h-3 w-3" />
                {t('plateSolving.installed') || 'Installed'}
              </Badge>
            ) : db.download_url ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0"
                disabled={downloading !== null}
                onClick={() => handleDownload(db)}
              >
                {downloading === db.name ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span className="ml-1">{t('plateSolving.download') || 'Download'}</span>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {downloading && (
        <div className="space-y-1">
          <Progress value={progress} />
          <p className="text-muted-foreground text-center text-xs">
            {t('plateSolving.downloadingDatabase') || 'Downloading database...'} {downloading}
          </p>
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export default MobileAstapDatabases;
