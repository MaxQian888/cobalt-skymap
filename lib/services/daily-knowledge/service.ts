import { createLogger } from '@/lib/logger';
import {
  DAILY_KNOWLEDGE_AGGREGATED_TTL_FALLBACK_MS,
  DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS,
} from './constants';
import { dedupeItems } from './normalizers';
import { fetchDailyKnowledgeRegistryItems } from './source-registry';
import { fetchApodItem } from './source-apod';
import { getCuratedDailyItem, getCuratedItems } from './source-curated';
import { fetchWikimediaItem } from './source-wikimedia';
import type {
  DailyKnowledgeFallbackReason,
  DailyKnowledgeFactSource,
  DailyKnowledgeItem,
  DailyKnowledgeLanguageStatus,
  DailyKnowledgeOptions,
  DailyKnowledgeOnlineSource,
  DailyKnowledgeResolutionMode,
  DailyKnowledgeServiceResult,
  DailyKnowledgeSourceStatus,
  DailyKnowledgeSourceStatusReason,
  DailyKnowledgeSourceTransport,
} from './types';

const logger = createLogger('daily-knowledge-service');
const aggregatedResultCache = new Map<
  string,
  { expiresAt: number; result: DailyKnowledgeServiceResult }
>();

function getNasaApiKey(): string {
  return process.env.NEXT_PUBLIC_NASA_API_KEY?.trim() || 'DEMO_KEY';
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

function getNextLocalMidnight(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const value = midnight.getTime();
  if (Number.isFinite(value) && value > Date.now()) {
    return value;
  }
  return Date.now() + DAILY_KNOWLEDGE_AGGREGATED_TTL_FALLBACK_MS;
}

const ONLINE_SOURCE_DEFINITIONS: Array<{
  source: DailyKnowledgeOnlineSource;
  transport: DailyKnowledgeSourceTransport;
}> = [
  { source: 'nasa-apod', transport: 'api' },
  { source: 'wikimedia', transport: 'api' },
  { source: 'nasa-image-library', transport: 'api' },
  { source: 'nasa-photojournal', transport: 'rss' },
  { source: 'esa-science', transport: 'rss' },
];

const SOURCE_PRIORITY: Record<DailyKnowledgeItem['source'], number> = {
  curated: 80,
  'nasa-apod': 110,
  wikimedia: 60,
  'nasa-image-library': 100,
  'nasa-photojournal': 92,
  'esa-science': 88,
};

function getCacheKey(
  dateKey: string,
  locale: 'en' | 'zh',
  onlineEnhancement: boolean,
  onlineAvailable: boolean,
  recentHistoryItemIds: string[],
  repeatWindowDays: number
): string {
  const recentSignature =
    recentHistoryItemIds.length > 0 ? recentHistoryItemIds.slice(0, 24).join('|') : 'none';
  return `${dateKey}:${locale}:${onlineEnhancement ? 'enhance' : 'local'}:${
    onlineAvailable ? 'online' : 'offline'
  }:${repeatWindowDays}:${recentSignature}`;
}

function makeSourceStatus(
  source: DailyKnowledgeOnlineSource,
  transport: DailyKnowledgeSourceTransport,
  state: DailyKnowledgeSourceStatus['state'],
  reason: DailyKnowledgeSourceStatusReason,
  itemCount: number,
  message?: string
): DailyKnowledgeSourceStatus {
  return { source, transport, state, reason, itemCount, message };
}

function makeSkippedStatuses(reason: 'offline' | 'disabled'): DailyKnowledgeSourceStatus[] {
  return ONLINE_SOURCE_DEFINITIONS.map(({ source, transport }) =>
    makeSourceStatus(source, transport, 'skipped', reason, 0)
  );
}

function getResolutionMode(
  selected: DailyKnowledgeItem,
  staleCacheUsed: boolean
): DailyKnowledgeResolutionMode {
  if (staleCacheUsed) return 'stale-cache';
  return selected.source === 'curated' ? 'curated-fallback' : 'fresh-online';
}

function markSelectedSourceAsStale(
  sourceStatuses: DailyKnowledgeSourceStatus[],
  selectedSource: DailyKnowledgeItem['source']
): DailyKnowledgeSourceStatus[] {
  if (selectedSource === 'curated') return sourceStatuses;
  return sourceStatuses.map((status) =>
    status.source === selectedSource
      ? {
          ...status,
          state: 'stale',
          reason: 'success',
          itemCount: Math.max(status.itemCount, 1),
        }
      : status
  );
}

function resolveStaleCacheResult(
  cachedResult: DailyKnowledgeServiceResult | undefined,
  sourceStatuses: DailyKnowledgeSourceStatus[]
): DailyKnowledgeServiceResult | null {
  if (!cachedResult || cachedResult.selected.source === 'curated') {
    return null;
  }

  return {
    ...cachedResult,
    requestedDateKey: cachedResult.requestedDateKey,
    sourceStatuses: markSelectedSourceAsStale(sourceStatuses, cachedResult.selected.source),
    usedCuratedFallback: false,
    fallbackReason: null,
    resolutionMode: 'stale-cache',
  };
}

function enrichItemWithWikimedia(
  baseItem: DailyKnowledgeItem,
  wikimediaItem: DailyKnowledgeItem | null
): DailyKnowledgeItem {
  if (!wikimediaItem) return baseItem;
  return {
    ...baseItem,
    summary: baseItem.summary || wikimediaItem.summary,
    image: baseItem.image ?? wikimediaItem.image,
    externalUrl: baseItem.externalUrl ?? wikimediaItem.externalUrl,
    relatedObjects:
      baseItem.relatedObjects.length > 0 ? baseItem.relatedObjects : wikimediaItem.relatedObjects,
    tags: Array.from(new Set([...baseItem.tags, ...wikimediaItem.tags])),
    factSources: mergeFactSources(baseItem.factSources, wikimediaItem.factSources),
    attribution: {
      ...baseItem.attribution,
      licenseName: baseItem.attribution.licenseName ?? wikimediaItem.attribution.licenseName,
      licenseUrl: baseItem.attribution.licenseUrl ?? wikimediaItem.attribution.licenseUrl,
      sourceUrl: baseItem.attribution.sourceUrl ?? wikimediaItem.attribution.sourceUrl,
    },
  };
}

function mergeFactSources(
  primary: DailyKnowledgeFactSource[],
  secondary: DailyKnowledgeFactSource[]
): DailyKnowledgeFactSource[] {
  const byUrl = new Map<string, DailyKnowledgeFactSource>();
  for (const source of [...primary, ...secondary]) {
    byUrl.set(source.url, source);
  }
  return Array.from(byUrl.values());
}

function normalizeIdentityValue(value: string): string {
  return value.trim().toLowerCase().replace(/[#?].*$/, '').replace(/\/+$/, '');
}

function getIdentityKeys(item: DailyKnowledgeItem): string[] {
  const keys = new Set<string>();
  if (item.externalUrl) {
    keys.add(`external:${normalizeIdentityValue(item.externalUrl)}`);
  }
  if (item.attribution.sourceUrl) {
    keys.add(`source:${normalizeIdentityValue(item.attribution.sourceUrl)}`);
  }
  if (keys.size === 0) {
    keys.add(`title:${item.title.trim().toLowerCase()}`);
  }
  return Array.from(keys);
}

function mergeItems(primary: DailyKnowledgeItem, secondary: DailyKnowledgeItem): DailyKnowledgeItem {
  return {
    ...primary,
    summary: primary.summary || secondary.summary,
    body: primary.body.length >= secondary.body.length ? primary.body : secondary.body,
    image: primary.image ?? secondary.image,
    externalUrl: primary.externalUrl ?? secondary.externalUrl,
    relatedObjects:
      primary.relatedObjects.length > 0
        ? primary.relatedObjects
        : secondary.relatedObjects,
    tags: Array.from(new Set([...primary.tags, ...secondary.tags])),
    categories: Array.from(new Set([...primary.categories, ...secondary.categories])),
    factSources: mergeFactSources(primary.factSources, secondary.factSources),
    attribution: {
      sourceName: primary.attribution.sourceName || secondary.attribution.sourceName,
      sourceUrl: primary.attribution.sourceUrl ?? secondary.attribution.sourceUrl,
      copyright: primary.attribution.copyright ?? secondary.attribution.copyright,
      licenseName: primary.attribution.licenseName ?? secondary.attribution.licenseName,
      licenseUrl: primary.attribution.licenseUrl ?? secondary.attribution.licenseUrl,
    },
    observationTips: Array.from(new Set([...primary.observationTips, ...secondary.observationTips])),
    bestViewingMonths: Array.from(new Set([...primary.bestViewingMonths, ...secondary.bestViewingMonths])).sort(
      (a, b) => a - b
    ),
  };
}

function dedupeMergedItems(items: DailyKnowledgeItem[]): DailyKnowledgeItem[] {
  const identityToIndex = new Map<string, number>();
  const result: DailyKnowledgeItem[] = [];

  for (const item of items) {
    const keys = getIdentityKeys(item);
    const existingIndex = keys
      .map((key) => identityToIndex.get(key))
      .find((value): value is number => typeof value === 'number');

    if (typeof existingIndex === 'number') {
      result[existingIndex] = mergeItems(result[existingIndex], item);
      for (const key of getIdentityKeys(result[existingIndex])) {
        identityToIndex.set(key, existingIndex);
      }
      continue;
    }

    const index = result.push(item) - 1;
    for (const key of keys) {
      identityToIndex.set(key, index);
    }
  }

  return result;
}

function scoreCandidate(
  item: DailyKnowledgeItem,
  locale: 'en' | 'zh',
  curatedAnchor: DailyKnowledgeItem,
  recentHistoryItemIds: string[]
): number {
  let score = SOURCE_PRIORITY[item.source] ?? 0;
  if (item.contentLanguage.toLowerCase().startsWith(locale)) score += 24;
  if (item.languageStatus === 'fallback') score -= 12;
  if (item.id === curatedAnchor.id) score += 12;
  if (item.isDateEvent && curatedAnchor.isDateEvent) score += 10;
  if (item.summary.trim()) score += 4;
  if (item.body.trim()) score += 4;
  if (item.image) score += 4;
  if (item.factSources.length > 0) score += 3;
  if (item.relatedObjects.some((object) => curatedAnchor.relatedObjects.some((anchor) => anchor.name === object.name))) {
    score += 6;
  }
  if (recentHistoryItemIds.includes(item.id)) score -= 8;
  if (locale === 'zh' && item.source === 'curated' && item.languageStatus === 'native') score += 10;
  return score;
}

function selectPrimaryItem(
  items: DailyKnowledgeItem[],
  locale: 'en' | 'zh',
  curatedAnchor: DailyKnowledgeItem,
  recentHistoryItemIds: string[]
): DailyKnowledgeItem {
  const ranked = [...items].sort((left, right) => {
    const scoreDelta =
      scoreCandidate(right, locale, curatedAnchor, recentHistoryItemIds) -
      scoreCandidate(left, locale, curatedAnchor, recentHistoryItemIds);
    if (scoreDelta !== 0) return scoreDelta;
    return left.id.localeCompare(right.id);
  });
  return ranked[0] ?? curatedAnchor;
}

function resolveLanguageStatus(
  item: DailyKnowledgeItem,
  locale: 'en' | 'zh'
): DailyKnowledgeLanguageStatus {
  return item.contentLanguage.toLowerCase().startsWith(locale) ? 'native' : 'fallback';
}

function applyLanguageStatus(
  items: DailyKnowledgeItem[],
  locale: 'en' | 'zh'
): DailyKnowledgeItem[] {
  return items.map((item) => ({
    ...item,
    languageStatus: resolveLanguageStatus(item, locale),
  }));
}

export function __clearDailyKnowledgeServiceCacheForTests(): void {
  aggregatedResultCache.clear();
}

async function fetchApodWithStatus(
  dateKey: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ item: DailyKnowledgeItem | null; status: DailyKnowledgeSourceStatus }> {
  try {
    const item = await fetchApodItem(dateKey, apiKey, { signal });
    return {
      item,
      status: makeSourceStatus(
        'nasa-apod',
        'api',
        item ? 'healthy' : 'degraded',
        item ? 'success' : 'empty',
        item ? 1 : 0
      ),
    };
  } catch (error) {
    logger.warn('APOD fetch failed, fallback to curated', error);
    return {
      item: null,
      status: makeSourceStatus(
        'nasa-apod',
        'api',
        'failed',
        'error',
        0,
        error instanceof Error ? error.message : String(error)
      ),
    };
  }
}

async function fetchWikimediaWithStatus(
  dateKey: string,
  query: string,
  locale: 'en' | 'zh',
  signal?: AbortSignal
): Promise<{ item: DailyKnowledgeItem | null; status: DailyKnowledgeSourceStatus }> {
  try {
    const item = await fetchWikimediaItem(dateKey, query, { locale, signal });
    return {
      item,
      status: makeSourceStatus(
        'wikimedia',
        'api',
        item ? 'healthy' : 'degraded',
        item ? 'success' : 'empty',
        item ? 1 : 0
      ),
    };
  } catch (error) {
    logger.warn('Wikimedia fetch failed, fallback to curated', error);
    return {
      item: null,
      status: makeSourceStatus(
        'wikimedia',
        'api',
        'failed',
        'error',
        0,
        error instanceof Error ? error.message : String(error)
      ),
    };
  }
}

function resolveFallbackState(
  selected: DailyKnowledgeItem,
  sourceStatuses: DailyKnowledgeSourceStatus[],
  onlineEnhancement: boolean,
  onlineAvailable: boolean
): { usedCuratedFallback: boolean; fallbackReason: DailyKnowledgeFallbackReason } {
  if (selected.source !== 'curated' || !onlineEnhancement) {
    return { usedCuratedFallback: false, fallbackReason: null };
  }
  if (!onlineAvailable) {
    return { usedCuratedFallback: true, fallbackReason: 'offline' };
  }
  if (sourceStatuses.some((status) => status.state === 'failed')) {
    return { usedCuratedFallback: true, fallbackReason: 'source-failure' };
  }
  if (sourceStatuses.every((status) => status.state !== 'healthy')) {
    return { usedCuratedFallback: true, fallbackReason: 'quality-threshold' };
  }
  return { usedCuratedFallback: false, fallbackReason: null };
}

export async function getDailyKnowledge(
  dateKey: string,
  locale: 'en' | 'zh',
  options?: Partial<DailyKnowledgeOptions>
): Promise<DailyKnowledgeServiceResult> {
  const onlineEnhancement = options?.onlineEnhancement ?? true;
  const repeatWindowDays = options?.repeatWindowDays ?? DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS;
  const recentHistoryItemIds = (options?.recentHistoryItemIds ?? []).filter(Boolean);
  const signal = options?.signal;
  const onlineAvailable = isOnline();
  const cacheKey = getCacheKey(
    dateKey,
    locale,
    onlineEnhancement,
    onlineAvailable,
    recentHistoryItemIds,
    repeatWindowDays
  );
  const cachedResult = aggregatedResultCache.get(cacheKey);
  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    return cachedResult.result;
  }
  const staleCachedResult = cachedResult?.result;

  const curatedDaily = getCuratedDailyItem(dateKey, locale, {
    recentItemIds: recentHistoryItemIds,
    repeatWindowDays,
  });
  const curatedItems = getCuratedItems(dateKey, locale);
  const offlineItems = [curatedDaily, ...curatedItems];

  if (!onlineEnhancement || !onlineAvailable) {
    const deduped = applyLanguageStatus(dedupeItems(offlineItems), locale);
    const selected = deduped[0];
    const result = {
      requestedDateKey: dateKey,
      items: deduped,
      selected,
      sourceStatuses: makeSkippedStatuses(!onlineEnhancement ? 'disabled' : 'offline'),
      resolutionMode: getResolutionMode(selected, false),
      ...resolveFallbackState(selected, makeSkippedStatuses(!onlineEnhancement ? 'disabled' : 'offline'), onlineEnhancement, onlineAvailable),
    };
    aggregatedResultCache.set(cacheKey, { result, expiresAt: getNextLocalMidnight() });
    return result;
  }

  const apiKey = getNasaApiKey();
  const registryQuery = curatedDaily.relatedObjects[0]?.name || curatedDaily.title;
  const [{ item: apodItem, status: apodStatus }, registryResult] = await Promise.all([
    fetchApodWithStatus(dateKey, apiKey, signal),
    fetchDailyKnowledgeRegistryItems(
      {
        dateKey,
        locale,
        query: registryQuery,
        anchorItem: curatedDaily,
        signal,
      }
    ),
  ]);

  const wikiQuery = apodItem?.title || registryResult.items[0]?.title || registryQuery;
  const { item: wikimediaItem, status: wikimediaStatus } = await fetchWikimediaWithStatus(
    dateKey,
    wikiQuery,
    locale,
    signal
  );
  const localizedWiki = wikimediaItem?.contentLanguage === locale ? wikimediaItem : null;
  const curatedWithWiki = enrichItemWithWikimedia(curatedDaily, localizedWiki);
  const apodWithWiki = apodItem ? enrichItemWithWikimedia(apodItem, wikimediaItem) : null;

  const mergedCandidates: DailyKnowledgeItem[] = [
    ...(apodWithWiki ? [apodWithWiki] : []),
    ...registryResult.items,
    curatedWithWiki,
    ...(localizedWiki ? [localizedWiki] : []),
    ...(wikimediaItem ? [wikimediaItem] : []),
    ...offlineItems,
  ];

  const merged = applyLanguageStatus(
    dedupeMergedItems(dedupeItems(mergedCandidates)),
    locale
  );
  const selected = selectPrimaryItem(merged, locale, curatedWithWiki, recentHistoryItemIds);
  const sourceStatuses = [apodStatus, wikimediaStatus, ...registryResult.sourceStatuses];
  const staleCacheResult =
    selected.source === 'curated'
      ? resolveStaleCacheResult(staleCachedResult, sourceStatuses)
      : null;

  if (staleCacheResult) {
    aggregatedResultCache.set(cacheKey, { result: staleCacheResult, expiresAt: getNextLocalMidnight() });
    return staleCacheResult;
  }

  const fallbackState = resolveFallbackState(selected, sourceStatuses, onlineEnhancement, onlineAvailable);
  const result = {
    requestedDateKey: dateKey,
    items: merged,
    selected,
    sourceStatuses,
    resolutionMode: getResolutionMode(selected, false),
    ...fallbackState,
  };
  aggregatedResultCache.set(cacheKey, { result, expiresAt: getNextLocalMidnight() });
  return result;
}
