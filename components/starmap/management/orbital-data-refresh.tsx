'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mpcApi, type MpcDataset } from '@/lib/tauri/mpc-api';
import { isTauri } from '@/lib/storage/platform';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('orbital-data-refresh');

/**
 * Desktop-only action to refresh comet / bright-asteroid orbital elements from
 * the Minor Planet Center. Writes an override file the Stellarium engine prefers
 * on next load (or reload).
 */
export function OrbitalDataRefresh() {
  const t = useTranslations();
  const [busy, setBusy] = useState<MpcDataset | null>(null);

  if (!isTauri()) return null;

  const refresh = async (dataset: MpcDataset) => {
    setBusy(dataset);
    try {
      const info = await mpcApi.refreshOrbitalData(dataset);
      toast.success(t('cache.orbitalRefreshDone'), {
        description: t('cache.orbitalRecords', { count: info.count }),
      });
    } catch (error) {
      logger.error('Orbital data refresh failed', error);
      toast.error(t('cache.orbitalRefreshFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 rounded border border-border/60 bg-muted/20 p-3">
      <div className="text-xs font-medium">{t('cache.orbitalData')}</div>
      <p className="text-[11px] text-muted-foreground">{t('cache.orbitalDataHint')}</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={busy !== null}
          onClick={() => refresh('comets')}
        >
          {busy === 'comets' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          {t('cache.orbitalComets')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={busy !== null}
          onClick={() => refresh('asteroids')}
        >
          {busy === 'asteroids' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1" />
          )}
          {t('cache.orbitalAsteroids')}
        </Button>
      </div>
    </div>
  );
}
