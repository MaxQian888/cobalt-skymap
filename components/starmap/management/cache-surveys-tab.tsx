'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Download,
  Trash2,
  Check,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
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

import { useOfflineStore, formatBytes, type HiPSCacheStatus } from '@/lib/offline';
import {
  getRustHiPSCacheStatus,
  downloadHiPSSurveyToRust,
  clearRustHiPSCache,
  clearAllRustHiPSCaches,
} from '@/lib/offline/hips-tile-cache';
import { SKY_SURVEYS } from '@/lib/core/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('cache-surveys-tab');

interface CacheSurveysTabProps {
  isActive: boolean;
}

export function CacheSurveysTab({ isActive }: CacheSurveysTabProps) {
  const t = useTranslations();
  const [surveyStatuses, setSurveyStatuses] = useState<Record<string, HiPSCacheStatus>>({});
  const [downloadingSurveys, setDownloadingSurveys] = useState<string[]>([]);

  const { isOnline } = useOfflineStore();

  const refreshSurveyStatuses = useCallback(async () => {
    try {
      const results = await Promise.all(
        SKY_SURVEYS.map(async (survey) => {
          const status = await getRustHiPSCacheStatus(survey);
          return [survey.id, status] as const;
        })
      );
      setSurveyStatuses(Object.fromEntries(results));
    } catch (error) {
      logger.error('Failed to refresh survey statuses', error);
      toast.error(t('cache.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (isActive) {
      refreshSurveyStatuses();
    }
  }, [isActive, refreshSurveyStatuses]);

  const handleDownloadSurvey = useCallback(async (surveyId: string) => {
    const survey = SKY_SURVEYS.find(s => s.id === surveyId);
    if (!survey || downloadingSurveys.includes(surveyId)) return;

    setDownloadingSurveys(prev => [...prev, surveyId]);

    try {
      toast.loading(t('survey.downloadingTiles'), { id: `survey-${surveyId}` });

      const success = await downloadHiPSSurveyToRust(
        survey,
        3,
        (progress) => {
          const percent = Math.round((progress.downloadedFiles / progress.totalFiles) * 100);
          toast.loading(`${t('survey.downloadingTiles')} ${percent}%`, { id: `survey-${surveyId}` });
        }
      );

      toast.dismiss(`survey-${surveyId}`);

      if (success) {
        toast.success(t('survey.downloadComplete'));
        await refreshSurveyStatuses();
      } else {
        toast.error(t('survey.downloadFailed'));
      }
    } catch (error) {
      toast.dismiss(`survey-${surveyId}`);
      toast.error(t('survey.downloadFailed'));
      logger.error('Error downloading survey', error);
    } finally {
      setDownloadingSurveys(prev => prev.filter(id => id !== surveyId));
    }
  }, [downloadingSurveys, t, refreshSurveyStatuses]);

  const handleClearSurveyCache = useCallback(async (surveyId: string) => {
    const success = await clearRustHiPSCache(surveyId);
    if (success) {
      toast.success(t('survey.cacheCleared'));
      await refreshSurveyStatuses();
    }
  }, [t, refreshSurveyStatuses]);

  const handleClearAllSurveyCaches = useCallback(async () => {
    const success = await clearAllRustHiPSCaches();
    if (success) {
      toast.success(t('survey.cacheCleared'));
      await refreshSurveyStatuses();
    }
  }, [t, refreshSurveyStatuses]);

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {t('survey.surveysCached', {
            cached: Object.values(surveyStatuses).filter(s => s.cached).length,
            total: SKY_SURVEYS.length,
          })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={refreshSurveyStatuses}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          {Object.values(surveyStatuses).some(s => s.cached) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('survey.clearAllCacheTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('survey.clearAllCacheDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAllSurveyCaches}>
                    {t('cache.clearAll')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <ScrollArea className="h-[220px]">
        <div className="space-y-2 pr-2">
          {SKY_SURVEYS.map((survey) => {
            const status = surveyStatuses[survey.id];
            const isSurveyDownloading = downloadingSurveys.includes(survey.id);
            const isCached = status?.cached ?? false;
            const progress = status
              ? (status.cachedTiles / Math.max(status.totalTiles, 1)) * 100
              : 0;

            return (
              <div
                key={survey.id}
                className={cn(
                  'p-2 rounded-lg border transition-colors',
                  isCached
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-border bg-muted/30'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{survey.name}</span>
                      {isCached && (
                        <Check className="h-3 w-3 text-green-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {survey.description}
                    </p>
                    {status && status.cachedTiles > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t('survey.tilesCachedWithSize', {
                          count: status.cachedTiles,
                          size: formatBytes(status.cachedBytes),
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSurveyDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : isCached ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleClearSurveyCache(survey.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDownloadSurvey(survey.id)}
                            disabled={!isOnline}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('survey.downloadForOffline')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {isSurveyDownloading && (
                  <Progress value={progress} className="h-1 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}
