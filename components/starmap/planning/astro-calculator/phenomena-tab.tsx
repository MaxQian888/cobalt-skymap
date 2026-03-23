'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type PhenomenaEvent } from '@/lib/astronomy/engine';
import { runCalculatorPhenomena, type CalculatorMetaSummary } from './orchestrator';

interface PhenomenaTabProps {
  latitude: number;
  longitude: number;
}

function getEventIcon(type: PhenomenaEvent['type']): string {
  switch (type) {
    case 'conjunction':
      return '☌';
    case 'opposition':
      return '☍';
    case 'elongation':
      return '◐';
    case 'moon_phase':
      return '◑';
    case 'close_approach':
      return '↔';
    default:
      return '•';
  }
}

function getImportanceColor(importance: PhenomenaEvent['importance']): string {
  switch (importance) {
    case 'high':
      return 'text-amber-500';
    case 'medium':
      return 'text-blue-400';
    default:
      return 'text-muted-foreground';
  }
}

export function PhenomenaTab({ latitude, longitude }: PhenomenaTabProps) {
  const t = useTranslations();
  const [daysAhead, setDaysAhead] = useState(30);
  const [showMinor, setShowMinor] = useState(false);
  const [events, setEvents] = useState<PhenomenaEvent[]>([]);
  const [metaSummary, setMetaSummary] = useState<CalculatorMetaSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + daysAhead);
    return { startDate, endDate };
  }, [daysAhead]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await runCalculatorPhenomena({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          observer: { latitude, longitude },
          includeMinor: showMinor,
        });

        if (!cancelled) {
          setEvents(result.response.events);
          setMetaSummary({
            total: 1,
            sourceCounts: {
              tauri: result.meta.source === 'tauri' ? 1 : 0,
              fallback: result.meta.source === 'fallback' ? 1 : 0,
            },
            cacheHits: result.meta.cache === 'hit' ? 1 : 0,
            cacheMisses: result.meta.cache === 'miss' ? 1 : 0,
            degradedCount: result.meta.degraded ? 1 : 0,
            warningsCount: result.meta.warnings?.length ?? 0,
            latestComputedAt: result.meta.computedAt,
          });
        }
      } catch (runError) {
        if (!cancelled) {
          setEvents([]);
          setMetaSummary(null);
          setError(runError instanceof Error ? runError.message : t('astroCalc.calculationFailed'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [dateRange.endDate, dateRange.startDate, latitude, longitude, showMinor, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('astroCalc.daysAhead')}</Label>
            <Select value={daysAhead.toString()} onValueChange={(value) => setDaysAhead(Number.parseInt(value, 10))}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t('astroCalc.daysRange.7d')}</SelectItem>
                <SelectItem value="14">{t('astroCalc.daysRange.14d')}</SelectItem>
                <SelectItem value="30">{t('astroCalc.daysRange.30d')}</SelectItem>
                <SelectItem value="60">{t('astroCalc.daysRange.60d')}</SelectItem>
                <SelectItem value="90">{t('astroCalc.daysRange.90d')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="showMinor" checked={showMinor} onCheckedChange={setShowMinor} />
            <Label htmlFor="showMinor" className="text-xs">{t('astroCalc.showMinorEvents')}</Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {metaSummary && (
            <Badge variant="secondary" className="text-[10px]" data-testid="phenomena-meta">
              {`src:${metaSummary.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${metaSummary.cacheHits}/${metaSummary.total}`}
            </Badge>
          )}
          {isLoading && <Badge variant="secondary">{t('astroCalc.calculating')}</Badge>}
          <Badge variant="outline">{events.length} {t('astroCalc.events')}</Badge>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <ScrollArea className="h-[390px] border rounded-lg">
        {events.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <Sparkles className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noPhenomena')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={`${event.type}-${event.date.toISOString()}-${event.details}`} className="p-3 hover:bg-muted/50">
                <div className="flex items-start gap-3">
                  <span className={cn('text-xl', getImportanceColor(event.importance))}>
                    {getEventIcon(event.type)}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{event.details}</span>
                      <Badge variant={event.importance === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                        {t(`astroCalc.eventType.${event.type}`)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {event.date.toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {event.separation !== undefined && ` • ${event.separation.toFixed(2)}° ${t('astroCalc.separation')}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] gap-1 font-normal">☌ {t('astroCalc.conjunction')}</Badge>
        <Badge variant="outline" className="text-[10px] gap-1 font-normal">☍ {t('astroCalc.opposition')}</Badge>
        <Badge variant="outline" className="text-[10px] gap-1 font-normal">◐ {t('astroCalc.elongation')}</Badge>
        <Badge variant="outline" className="text-[10px] gap-1 font-normal">◑ {t('astroCalc.moonPhase')}</Badge>
        <Badge variant="outline" className="text-[10px] gap-1 font-normal">↔ {t('astroCalc.closeApproach')}</Badge>
      </div>
    </div>
  );
}
