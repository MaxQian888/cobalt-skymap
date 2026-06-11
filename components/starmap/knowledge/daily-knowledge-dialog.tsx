'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Heart,
  History,
  RefreshCw,
  SearchX,
  Shuffle,
  Share2,
  Star,
  Telescope,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchInput } from '@/components/ui/search-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  DailyKnowledgeCategory,
  DailyKnowledgeDifficulty,
  DailyKnowledgeItem,
  DailyKnowledgeSource,
} from '@/lib/services/daily-knowledge';
import { useDailyKnowledgeStore } from '@/lib/stores';
import { isMobile } from '@/lib/storage/platform';
import { cn } from '@/lib/utils';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';

const CATEGORY_OPTIONS: Array<{ value: DailyKnowledgeCategory | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'dailyKnowledge.categoryAll' },
  { value: 'object', labelKey: 'dailyKnowledge.categoryObject' },
  { value: 'event', labelKey: 'dailyKnowledge.categoryEvent' },
  { value: 'history', labelKey: 'dailyKnowledge.categoryHistory' },
  { value: 'mission', labelKey: 'dailyKnowledge.categoryMission' },
  { value: 'technique', labelKey: 'dailyKnowledge.categoryTechnique' },
  { value: 'culture', labelKey: 'dailyKnowledge.categoryCulture' },
];

const SOURCE_OPTIONS: Array<{ value: DailyKnowledgeSource | 'all'; labelKey: string }> = [
  { value: 'all', labelKey: 'dailyKnowledge.sourceAll' },
  { value: 'curated', labelKey: 'dailyKnowledge.sourceCurated' },
  { value: 'nasa-apod', labelKey: 'dailyKnowledge.sourceApod' },
  { value: 'wikimedia', labelKey: 'dailyKnowledge.sourceWikimedia' },
  { value: 'nasa-image-library', labelKey: 'dailyKnowledge.sourceNasaImageLibrary' },
  { value: 'nasa-photojournal', labelKey: 'dailyKnowledge.sourceNasaPhotojournal' },
  { value: 'esa-science', labelKey: 'dailyKnowledge.sourceEsaScience' },
];

type TranslateFn = ReturnType<typeof useTranslations>;

function normalizeMonths(months: number[] | undefined): number[] {
  return Array.from(
    new Set(
      (months ?? [])
        .map((value) => Math.trunc(value))
        .filter((value) => value >= 1 && value <= 12)
    )
  ).sort((a, b) => a - b);
}

function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBestViewingMonths(
  months: number[] | undefined,
  t: TranslateFn,
  monthFormatter: Intl.DateTimeFormat
): string {
  const normalized = normalizeMonths(months);
  if (normalized.length === 0 || normalized.length >= 12) {
    return t('dailyKnowledge.allYear');
  }
  return normalized
    .map((month) => monthFormatter.format(new Date(Date.UTC(2020, month - 1, 1))))
    .join(', ');
}

function formatDifficultyLabel(
  difficulty: DailyKnowledgeDifficulty | undefined,
  t: TranslateFn
): string {
  return t(`dailyKnowledge.difficultyBadge.${difficulty ?? 'intermediate'}`);
}

/**
 * Memoized feed-mode card. Stable props (`item`/`onSelect`/`monthFormatter`) +
 * `React.memo` keep non-current cards from re-rendering when the active item
 * changes — only the previously- and newly-current cards update.
 */
const KnowledgeFeedCard = memo(function KnowledgeFeedCard({
  item,
  isCurrent,
  monthFormatter,
  onSelect,
}: {
  item: DailyKnowledgeItem;
  isCurrent: boolean;
  monthFormatter: Intl.DateTimeFormat;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations();
  const itemTips = (item.observationTips ?? []).slice(0, 2);
  return (
    <Card className={cn(isCurrent && 'border-primary')} data-current={isCurrent}>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className="text-left text-base font-semibold hover:underline"
        >
          {item.title}
        </button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <p className="text-sm text-muted-foreground">{item.summary}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{t(`dailyKnowledge.sourceBadge.${item.source}`)}</Badge>
          <Badge variant="outline">{formatDifficultyLabel(item.difficulty, t)}</Badge>
          <Badge variant="outline">
            {t('dailyKnowledge.bestViewingMonthsLabel')}: {formatBestViewingMonths(item.bestViewingMonths, t, monthFormatter)}
          </Badge>
          {item.categories.map((category) => (
            <Badge key={`${item.id}-${category}`} variant="outline">
              {t(`dailyKnowledge.categoryBadge.${category}`)}
            </Badge>
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('dailyKnowledge.observationTips')}</p>
          {itemTips.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('dailyKnowledge.noObservationTips')}</p>
          )}
          {itemTips.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {itemTips.map((tip, index) => (
                <li key={`${item.id}-tip-${index}`} className="leading-5">
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export function DailyKnowledgeDialog() {
  const WHEEL_THROTTLE_MS = 300;
  const t = useTranslations();
  const open = useDailyKnowledgeStore((state) => state.open);
  const activeDateKey = useDailyKnowledgeStore((state) => state.activeDateKey);
  const loading = useDailyKnowledgeStore((state) => state.loading);
  const error = useDailyKnowledgeStore((state) => state.error);
  const items = useDailyKnowledgeStore((state) => state.items);
  const currentItem = useDailyKnowledgeStore((state) => state.currentItem);
  const favorites = useDailyKnowledgeStore((state) => state.favorites);
  const history = useDailyKnowledgeStore((state) => state.history);
  const sourceStatuses = useDailyKnowledgeStore((state) => state.sourceStatuses);
  const usedCuratedFallback = useDailyKnowledgeStore((state) => state.usedCuratedFallback);
  const resolutionMode = useDailyKnowledgeStore((state) => state.resolutionMode);
  const filters = useDailyKnowledgeStore((state) => state.filters);
  const closeDialog = useDailyKnowledgeStore((state) => state.closeDialog);
  const loadDaily = useDailyKnowledgeStore((state) => state.loadDaily);
  const refreshCurrentDate = useDailyKnowledgeStore((state) => state.refreshCurrentDate);
  const browsePreviousDate = useDailyKnowledgeStore((state) => state.browsePreviousDate);
  const browseNextDate = useDailyKnowledgeStore((state) => state.browseNextDate);
  const goToToday = useDailyKnowledgeStore((state) => state.goToToday);
  const next = useDailyKnowledgeStore((state) => state.next);
  const prev = useDailyKnowledgeStore((state) => state.prev);
  const random = useDailyKnowledgeStore((state) => state.random);
  const toggleFavorite = useDailyKnowledgeStore((state) => state.toggleFavorite);
  const setFilters = useDailyKnowledgeStore((state) => state.setFilters);
  const setCurrentItemById = useDailyKnowledgeStore((state) => state.setCurrentItemById);
  const markDontShowToday = useDailyKnowledgeStore((state) => state.markDontShowToday);
  const goToRelatedObject = useDailyKnowledgeStore((state) => state.goToRelatedObject);
  const recordHistory = useDailyKnowledgeStore((state) => state.recordHistory);
  const viewMode = useDailyKnowledgeStore((state) => state.viewMode);
  const setViewMode = useDailyKnowledgeStore((state) => state.setViewMode);
  const wheelPagingEnabled = useDailyKnowledgeStore((state) => state.wheelPagingEnabled);
  const setWheelPagingEnabled = useDailyKnowledgeStore((state) => state.setWheelPagingEnabled);
  const isMobileDevice = useMemo(() => isMobile(), []);
  const monthFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
      }),
    []
  );
  const activeDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );
  const lastWheelAtRef = useRef(0);

  function formatActiveDate(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map((segment) => Number.parseInt(segment, 10));
    return activeDateFormatter.format(new Date(year, (month || 1) - 1, day || 1));
  }

  useEffect(() => {
    if (open && items.length === 0) {
      void loadDaily('manual');
    }
  }, [items.length, loadDaily, open]);

  useEffect(() => {
    if (!open || loading || viewMode !== 'pager') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowLeft') {
        prev();
      } else if (event.key === 'ArrowRight') {
        next();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, next, open, prev, viewMode]);

  useEffect(() => {
    if (!open || loading || viewMode !== 'pager' || isMobileDevice || !wheelPagingEnabled) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 24) return;
      const now = Date.now();
      if (now - lastWheelAtRef.current < WHEEL_THROTTLE_MS) return;
      lastWheelAtRef.current = now;
      if (event.deltaY > 0) {
        next();
      } else {
        prev();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [isMobileDevice, loading, next, open, prev, viewMode, wheelPagingEnabled]);

  const favoriteIds = useMemo(() => new Set(favorites.map((entry) => entry.itemId)), [favorites]);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const lastSearchHistoryKeyRef = useRef<string | null>(null);
  const degradedSourceStatuses = useMemo(
    () => sourceStatuses.filter((status) => status.state !== 'healthy' && status.reason !== 'success'),
    [sourceStatuses]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filters.category !== 'all' && !item.categories.includes(filters.category)) return false;
      if (filters.source !== 'all' && item.source !== filters.source) return false;
      if (filters.favoritesOnly && !favoriteIds.has(item.id)) return false;
      if (!filters.query.trim()) return true;
      const q = filters.query.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [favoriteIds, filters, items]);

  const effectiveItem = useMemo(() => {
    if (!currentItem) return filteredItems[0] ?? null;
    if (filteredItems.some((item) => item.id === currentItem.id)) return currentItem;
    return filteredItems[0] ?? null;
  }, [currentItem, filteredItems]);

  useEffect(() => {
    if (effectiveItem && currentItem?.id !== effectiveItem.id) {
      setCurrentItemById(effectiveItem.id);
    }
  }, [currentItem?.id, effectiveItem, setCurrentItemById]);

  useEffect(() => {
    if (!effectiveItem) return;
    const query = filters.query.trim();
    if (!query) {
      lastSearchHistoryKeyRef.current = null;
      return;
    }
    const historyKey = `${effectiveItem.id}:${query.toLowerCase()}`;
    if (lastSearchHistoryKeyRef.current === historyKey) return;
    lastSearchHistoryKeyRef.current = historyKey;
    recordHistory(effectiveItem.id, 'search', effectiveItem.dateKey);
  }, [effectiveItem, filters.query, recordHistory]);

  function buildShareText() {
    if (!effectiveItem) return '';
    const copyrightLine = effectiveItem.attribution.copyright
      ? `${effectiveItem.attribution.copyright}`
      : '';
    const licenseLine = effectiveItem.attribution.licenseName
      ? effectiveItem.attribution.licenseUrl
        ? `${effectiveItem.attribution.licenseName} (${effectiveItem.attribution.licenseUrl})`
        : effectiveItem.attribution.licenseName
      : '';
    return [
      effectiveItem.title,
      effectiveItem.summary,
      effectiveItem.externalUrl ?? effectiveItem.attribution.sourceUrl ?? '',
      [copyrightLine, licenseLine].filter(Boolean).join(' | '),
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function handleShare(): Promise<void> {
    if (!effectiveItem) return;
    const text = buildShareText();

    try {
      if (navigator.share && typeof navigator.share === 'function') {
        await navigator.share({
          title: effectiveItem.title,
          text: effectiveItem.summary,
          url: effectiveItem.externalUrl,
        });
        return;
      }
    } catch {
      // fallback to clipboard
    }

    await copyTextWithFeedback({
      text,
      successMessage: t('dailyKnowledge.copySuccess'),
      errorMessage: t('dailyKnowledge.shareFailed'),
    });
  }

  async function handleCopy(): Promise<void> {
    if (!effectiveItem) return;
    const payload = buildShareText();
    await copyTextWithFeedback({
      text: payload,
      successMessage: t('dailyKnowledge.copySuccess'),
      errorMessage: t('dailyKnowledge.copyFailed'),
    });
  }

  const isFavorite = effectiveItem ? favoriteIds.has(effectiveItem.id) : false;
  const formattedActiveDate = formatActiveDate(activeDateKey);
  const isViewingToday = activeDateKey === getTodayDateKey();

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && closeDialog()}
      tier="complex-editor"
    >
      <ResponsiveDialogContent className="max-w-4xl overflow-hidden flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t('dailyKnowledge.title')}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t('dailyKnowledge.subtitle')}</ResponsiveDialogDescription>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{t('dailyKnowledge.activeDateLabel', { date: formattedActiveDate })}</Badge>
            {!isViewingToday && (
              <Badge variant="secondary">{t('dailyKnowledge.browsingDate')}</Badge>
            )}
          </div>
        </ResponsiveDialogHeader>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <SearchInput
            value={filters.query}
            onChange={(value) => setFilters({ query: value })}
            placeholder={t('dailyKnowledge.searchPlaceholder')}
          />
          <div className="flex items-center gap-1 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void browsePreviousDate('manual')}
              aria-label={t('dailyKnowledge.previousDate')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void goToToday('manual')}
              disabled={loading || isViewingToday}
              aria-label={t('dailyKnowledge.goToToday')}
            >
              {t('dailyKnowledge.goToToday')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => void browseNextDate('manual')}
              aria-label={t('dailyKnowledge.nextDate')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select
            value={filters.category}
            onValueChange={(value) => setFilters({ category: value as DailyKnowledgeCategory | 'all' })}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.source}
            onValueChange={(value) => setFilters({ source: value as DailyKnowledgeSource | 'all' })}
          >
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Toggle
            variant="outline"
            pressed={filters.favoritesOnly}
            onPressedChange={() => setFilters({ favoritesOnly: !filters.favoritesOnly })}
            aria-label={t('dailyKnowledge.favorites')}
          >
            <Heart className={cn('h-4 w-4', filters.favoritesOnly && 'fill-current')} />
            {t('dailyKnowledge.favorites')}
          </Toggle>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshCurrentDate('manual')}
            disabled={loading}
            aria-label={t('dailyKnowledge.refreshCurrentDate')}
          >
            <RefreshCw className="h-4 w-4" />
            {t('dailyKnowledge.refreshCurrentDate')}
          </Button>
          <div className="flex items-center gap-1 md:justify-self-end" role="group" aria-label="view-mode">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'pager' ? 'default' : 'outline'}
              onClick={() => setViewMode('pager')}
              data-testid="daily-knowledge-mode-pager"
            >
              {t('dailyKnowledge.viewModePager')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'feed' ? 'default' : 'outline'}
              onClick={() => setViewMode('feed')}
              data-testid="daily-knowledge-mode-feed"
            >
              {t('dailyKnowledge.viewModeFeed')}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={prev}
                disabled={loading || !effectiveItem}
                aria-label={t('dailyKnowledge.prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{t('dailyKnowledge.prev')}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={next}
                disabled={loading || !effectiveItem}
                aria-label={t('dailyKnowledge.next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{t('dailyKnowledge.next')}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={random}
                disabled={loading || filteredItems.length === 0}
                aria-label={t('dailyKnowledge.random')}
              >
                <Shuffle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>{t('dailyKnowledge.random')}</p></TooltipContent>
          </Tooltip>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <History className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent><p>{t('dailyKnowledge.history')}</p></TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <ScrollArea className="h-52">
                <div className="space-y-2">
                  {history.slice(0, 30).map((entry) => (
                    <Button
                      key={`${entry.itemId}-${entry.shownAt}`}
                      variant="ghost"
                      className="w-full justify-between"
                      onClick={() => setCurrentItemById(entry.itemId)}
                    >
                      <span className="truncate text-left">
                        {itemById.get(entry.itemId)?.title ?? entry.itemId}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.entry}</span>
                    </Button>
                  ))}
                  {history.length === 0 && <p className="text-xs text-muted-foreground">{t('dailyKnowledge.noHistory')}</p>}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          {viewMode === 'pager' && !isMobileDevice && (
            <Toggle
              variant="outline"
              pressed={wheelPagingEnabled}
              onPressedChange={(pressed) => setWheelPagingEnabled(pressed)}
              aria-label={t('dailyKnowledge.wheelPaging')}
            >
              {t('dailyKnowledge.wheelPaging')}
            </Toggle>
          )}
          <Badge variant="outline">{t(`dailyKnowledge.freshness.${resolutionMode}`)}</Badge>
          <div className="ml-auto text-xs text-muted-foreground">
            {t('dailyKnowledge.resultCount', { count: filteredItems.length })}
          </div>
        </div>

        <Separator />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {!loading && !error && (usedCuratedFallback || degradedSourceStatuses.length > 0) && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-1 text-xs">
              <p>{t('dailyKnowledge.sourceStatusForDate', { date: formattedActiveDate })}</p>
              {usedCuratedFallback && <p>{t('dailyKnowledge.curatedFallbackNotice')}</p>}
              {degradedSourceStatuses.map((status) => (
                <p key={`${status.source}-${status.reason}`}>
                  {t(`dailyKnowledge.sourceStatus.${status.source}.${status.reason}`)}
                </p>
              ))}
            </AlertDescription>
          </Alert>
        )}
        {loading && (
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-64 w-full rounded-md" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-md" />
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
        )}
        {!loading && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t(error)}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && !effectiveItem && (
          <EmptyState icon={SearchX} message={t('dailyKnowledge.noResults')} />
        )}

        {!loading && !error && effectiveItem && viewMode === 'feed' && (
          <ScrollArea className="h-[28rem] pr-2" data-testid="daily-knowledge-view-feed">
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <KnowledgeFeedCard
                  key={item.id}
                  item={item}
                  isCurrent={currentItem?.id === item.id}
                  monthFormatter={monthFormatter}
                  onSelect={setCurrentItemById}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {!loading && !error && effectiveItem && viewMode === 'pager' && (
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]" data-testid="daily-knowledge-view-pager">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start gap-2">
                <h3 className="text-xl font-semibold">{effectiveItem.title}</h3>
                <Badge variant="secondary">{t(`dailyKnowledge.sourceBadge.${effectiveItem.source}`)}</Badge>
                {effectiveItem.isDateEvent && (
                  <Badge>{t('dailyKnowledge.eventOfToday')}</Badge>
                )}
                <Badge variant={effectiveItem.languageStatus === 'native' ? 'outline' : 'default'}>
                  {t(`dailyKnowledge.languageStatus.${effectiveItem.languageStatus}`)}
                </Badge>
                {effectiveItem.categories.map((category) => (
                  <Badge key={category} variant="outline">
                    {t(`dailyKnowledge.categoryBadge.${category}`)}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{effectiveItem.summary}</p>
              {effectiveItem.languageStatus === 'fallback' && (
                <p className="text-xs text-muted-foreground">{t('dailyKnowledge.fallbackNotice')}</p>
              )}
              <Card className="py-3 gap-2">
                <CardHeader className="px-3 py-0">
                  <CardTitle className="text-sm">{t('dailyKnowledge.practicalInsights')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-0 text-sm space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">{formatDifficultyLabel(effectiveItem.difficulty, t)}</Badge>
                    <Badge variant="outline">
                      {t('dailyKnowledge.bestViewingMonthsLabel')}: {formatBestViewingMonths(effectiveItem.bestViewingMonths, t, monthFormatter)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">{t('dailyKnowledge.observationTips')}</p>
                    {(effectiveItem.observationTips ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('dailyKnowledge.noObservationTips')}</p>
                    )}
                    {(effectiveItem.observationTips ?? []).length > 0 && (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {(effectiveItem.observationTips ?? []).slice(0, 4).map((tip, index) => (
                          <li key={`${effectiveItem.id}-observation-tip-${index}`} className="leading-5">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
              <ScrollArea className="h-64 rounded-md border p-3">
                <p className="text-sm leading-6 whitespace-pre-wrap">{effectiveItem.body}</p>
              </ScrollArea>
              <div className="flex flex-wrap gap-2">
                {effectiveItem.relatedObjects.map((object) => (
                  <Button
                    key={`${effectiveItem.id}-${object.name}`}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void goToRelatedObject(object);
                    }}
                  >
                    <Telescope className="h-3.5 w-3.5" />
                    {object.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {effectiveItem.image && (
                <div className="overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={effectiveItem.image.thumbnailUrl ?? effectiveItem.image.url}
                    alt={effectiveItem.title}
                    className="h-56 w-full object-cover"
                    loading="lazy"
                    width={960}
                    height={540}
                    unoptimized
                  />
                  {effectiveItem.image.type === 'video' && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      {t('dailyKnowledge.videoEntry')}
                    </p>
                  )}
                </div>
              )}
              <Card className="py-3 gap-2">
                <CardHeader className="px-3 py-0">
                  <CardTitle className="text-sm">{t('dailyKnowledge.attribution')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-0 text-sm text-muted-foreground space-y-0.5">
                  <p>{effectiveItem.attribution.sourceName}</p>
                  {effectiveItem.attribution.sourceUrl && (
                    <a
                      href={effectiveItem.attribution.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {t('dailyKnowledge.sourceReference')}
                    </a>
                  )}
                  {effectiveItem.attribution.copyright && (
                    <p>{effectiveItem.attribution.copyright}</p>
                  )}
                  {effectiveItem.attribution.licenseName && (
                    <p>{effectiveItem.attribution.licenseName}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="py-3 gap-2">
                <CardHeader className="px-3 py-0">
                  <CardTitle className="text-sm">{t('dailyKnowledge.factSources')}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 py-0 text-sm">
                  {effectiveItem.factSources.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('dailyKnowledge.noFactSources')}</p>
                  )}
                  {effectiveItem.factSources.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {effectiveItem.factSources.map((source, index) => (
                        <li key={`${effectiveItem.id}-source-${index}`} className="leading-5">
                          <span>{source.publisher}: </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2"
                          >
                            {source.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={isFavorite ? 'default' : 'outline'}
                  onClick={() => toggleFavorite(effectiveItem.id)}
                >
                  <Star className={cn('h-4 w-4', isFavorite && 'fill-current')} />
                  {isFavorite ? t('dailyKnowledge.favorited') : t('dailyKnowledge.favorite')}
                </Button>
                <Button variant="outline" onClick={() => void handleCopy()}>
                  <Copy className="h-4 w-4" />
                  {t('dailyKnowledge.copy')}
                </Button>
                <Button variant="outline" onClick={() => void handleShare()}>
                  <Share2 className="h-4 w-4" />
                  {t('dailyKnowledge.share')}
                </Button>
                {effectiveItem.externalUrl && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(effectiveItem.externalUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('dailyKnowledge.openSource')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        </div>

        <ResponsiveDialogFooter stickyOnMobile className="justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              markDontShowToday();
              closeDialog();
            }}
          >
            {t('dailyKnowledge.dontShowToday')}
          </Button>
          <Button variant="outline" onClick={closeDialog}>
            {t('common.close')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
