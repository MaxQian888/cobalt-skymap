/**
 * @jest-environment jsdom
 */

import type { DailyKnowledgeItem } from '../types';
import { getDailyKnowledge, __clearDailyKnowledgeServiceCacheForTests } from '../service';
import { withRetry } from '../policy';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('../source-apod', () => ({
  fetchApodItem: jest.fn(),
}));

jest.mock('../source-curated', () => ({
  getCuratedDailyItem: jest.fn(),
  getCuratedItems: jest.fn(),
}));

jest.mock('../source-wikimedia', () => ({
  fetchWikimediaItem: jest.fn(),
}));

jest.mock('../source-registry', () => ({
  fetchDailyKnowledgeRegistryItems: jest.fn(),
}));

import { fetchApodItem } from '../source-apod';
import { getCuratedDailyItem, getCuratedItems } from '../source-curated';
import { fetchDailyKnowledgeRegistryItems } from '../source-registry';
import { fetchWikimediaItem } from '../source-wikimedia';

const mockFetchApodItem = fetchApodItem as jest.MockedFunction<typeof fetchApodItem>;
const mockGetCuratedDailyItem = getCuratedDailyItem as jest.MockedFunction<typeof getCuratedDailyItem>;
const mockGetCuratedItems = getCuratedItems as jest.MockedFunction<typeof getCuratedItems>;
const mockFetchDailyKnowledgeRegistryItems =
  fetchDailyKnowledgeRegistryItems as jest.MockedFunction<typeof fetchDailyKnowledgeRegistryItems>;
const mockFetchWikimediaItem = fetchWikimediaItem as jest.MockedFunction<typeof fetchWikimediaItem>;

function makeItem(partial: Partial<DailyKnowledgeItem> & Pick<DailyKnowledgeItem, 'id' | 'source'>): DailyKnowledgeItem {
  return {
    id: partial.id,
    dateKey: partial.dateKey ?? '2026-02-20',
    source: partial.source,
    title: partial.title ?? partial.id,
    summary: partial.summary ?? 'summary',
    body: partial.body ?? 'body',
    contentLanguage: partial.contentLanguage ?? 'en',
    categories: partial.categories ?? ['culture'],
    tags: partial.tags ?? [],
    image: partial.image,
    externalUrl: partial.externalUrl,
    relatedObjects: partial.relatedObjects ?? [],
    attribution: partial.attribution ?? { sourceName: 'test' },
    isDateEvent: partial.isDateEvent ?? false,
    eventMonthDay: partial.eventMonthDay,
    factSources: partial.factSources ?? [{ title: 'source', url: 'https://example.com', publisher: 'test' }],
    difficulty: partial.difficulty ?? 'intermediate',
    bestViewingMonths: partial.bestViewingMonths ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    observationTips: partial.observationTips ?? ['Tip 1', 'Tip 2'],
    languageStatus: partial.languageStatus ?? 'native',
    fetchedAt: partial.fetchedAt ?? Date.now(),
  };
}

describe('daily-knowledge/service', () => {
  const curatedDaily = makeItem({
    id: 'curated-daily',
    source: 'curated',
    title: 'Curated Daily',
    relatedObjects: [{ name: 'M31', ra: 10.68, dec: 41.26 }],
    attribution: { sourceName: 'Curated Source' },
  });

  const curatedPool = [
    curatedDaily,
    makeItem({ id: 'curated-2', source: 'curated', title: 'Curated 2' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    __clearDailyKnowledgeServiceCacheForTests();
    mockGetCuratedDailyItem.mockReturnValue(curatedDaily);
    mockGetCuratedItems.mockReturnValue(curatedPool);
    mockFetchApodItem.mockResolvedValue(null);
    mockFetchWikimediaItem.mockResolvedValue(null);
    mockFetchDailyKnowledgeRegistryItems.mockResolvedValue({
      items: [],
      sourceStatuses: [],
    });
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('returns APOD as selected item when APOD succeeds', async () => {
    const apod = makeItem({
      id: 'apod-2026-02-20',
      source: 'nasa-apod',
      title: 'APOD',
      summary: 'APOD summary',
    });
    mockFetchApodItem.mockResolvedValue(apod);

    const result = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(result.selected.id).toBe('apod-2026-02-20');
    expect(result.resolutionMode).toBe('fresh-online');
    expect(result.items.some((item) => item.id === 'apod-2026-02-20')).toBe(true);
    expect(mockFetchApodItem).toHaveBeenCalledTimes(1);
  });

  it('falls back to curated content when APOD returns 429/failed', async () => {
    const rateLimitError = new Error('APOD request failed with status 429');
    mockFetchApodItem.mockRejectedValue(rateLimitError);

    const result = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(result.selected.id).toBe('curated-daily');
    expect(result.items.some((item) => item.id === 'curated-daily')).toBe(true);
  });

  it('enriches selected item with Wikimedia metadata', async () => {
    const apod = makeItem({
      id: 'apod-2026-02-20',
      source: 'nasa-apod',
      title: 'APOD',
      image: undefined,
      attribution: { sourceName: 'NASA APOD' },
      relatedObjects: [],
    });
    const wiki = makeItem({
      id: 'wikimedia-apod',
      source: 'wikimedia',
      image: { url: 'https://upload.wikimedia.org/example.jpg', type: 'image' },
      relatedObjects: [{ name: 'M42' }],
      attribution: {
        sourceName: 'Wikimedia',
        licenseName: 'CC BY-SA',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      },
    });

    mockFetchApodItem.mockResolvedValue(apod);
    mockFetchWikimediaItem.mockResolvedValue(wiki);

    const result = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(result.selected.image?.url).toBe('https://upload.wikimedia.org/example.jpg');
    expect(result.selected.attribution.licenseName).toBe('CC BY-SA');
    expect(result.selected.relatedObjects[0]?.name).toBe('M42');
  });

  it('hits aggregated cache for repeated requests on same date/locale/options', async () => {
    const apod = makeItem({ id: 'apod-cache', source: 'nasa-apod' });
    mockFetchApodItem.mockResolvedValue(apod);

    const first = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });
    const second = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(first.selected.id).toBe('apod-cache');
    expect(second.selected.id).toBe('apod-cache');
    expect(mockFetchApodItem).toHaveBeenCalledTimes(1);
    expect(mockFetchWikimediaItem).toHaveBeenCalledTimes(1);
  });

  it('prefers native content for zh locale and marks English fallback', async () => {
    const curatedZh = makeItem({
      id: 'curated-zh',
      source: 'curated',
      contentLanguage: 'zh',
      title: '中文条目',
    });
    const apodEn = makeItem({
      id: 'apod-en',
      source: 'nasa-apod',
      contentLanguage: 'en',
    });
    const wikiEn = makeItem({
      id: 'wiki-en',
      source: 'wikimedia',
      contentLanguage: 'en',
    });

    mockGetCuratedDailyItem.mockReturnValue(curatedZh);
    mockGetCuratedItems.mockReturnValue([curatedZh]);
    mockFetchApodItem.mockResolvedValue(apodEn);
    mockFetchWikimediaItem.mockResolvedValue(wikiEn);

    const result = await getDailyKnowledge('2026-02-20', 'zh', { onlineEnhancement: true });

    expect(result.selected.id).toBe('curated-zh');
    expect(result.selected.languageStatus).toBe('native');
    expect(result.items.find((item) => item.id === 'apod-en')?.languageStatus).toBe('fallback');
    expect(mockFetchWikimediaItem).toHaveBeenCalledWith(
      '2026-02-20',
      expect.any(String),
      expect.objectContaining({ locale: 'zh' })
    );
  });

  it('passes AbortSignal to online sources', async () => {
    const signal = new AbortController().signal;

    await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true, signal });

    expect(mockFetchApodItem).toHaveBeenCalledWith(
      '2026-02-20',
      expect.any(String),
      expect.objectContaining({ signal })
    );
    expect(mockFetchWikimediaItem).toHaveBeenCalledWith(
      '2026-02-20',
      expect.any(String),
      expect.objectContaining({ signal, locale: 'en' })
    );
  });

  it('includes registry items and source statuses in the aggregated result', async () => {
    mockFetchDailyKnowledgeRegistryItems.mockResolvedValue({
      items: [
        makeItem({
          id: 'nasa-lib-item',
          source: 'nasa-image-library',
          title: 'NASA Library Item',
          externalUrl: 'https://images.nasa.gov/details-test',
        }),
      ],
      sourceStatuses: [
        {
          source: 'nasa-image-library',
          transport: 'api',
          state: 'healthy',
          reason: 'success',
          itemCount: 1,
        },
      ],
    });

    const result = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(result.items.some((item) => item.id === 'nasa-lib-item')).toBe(true);
    expect(result.resolutionMode).toBe('fresh-online');
    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'nasa-image-library', state: 'healthy' }),
        expect.objectContaining({ source: 'nasa-apod' }),
        expect.objectContaining({ source: 'wikimedia' }),
      ])
    );
  });

  it('marks curated fallback when online sources fail or return nothing', async () => {
    mockFetchApodItem.mockRejectedValue(new Error('apod failed'));
    mockFetchDailyKnowledgeRegistryItems.mockResolvedValue({
      items: [],
      sourceStatuses: [
        {
          source: 'esa-science',
          transport: 'rss',
          state: 'failed',
          reason: 'error',
          itemCount: 0,
        },
      ],
    });

    const result = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(result.selected.id).toBe('curated-daily');
    expect(result.usedCuratedFallback).toBe(true);
    expect(result.resolutionMode).toBe('curated-fallback');
    expect(result.sourceStatuses).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'esa-science', state: 'failed' })])
    );
  });

  it('uses stale cache when an expired fresh online result exists and current sources degrade', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

    const apod = makeItem({
      id: 'apod-stale-cache',
      source: 'nasa-apod',
      title: 'APOD Fresh',
    });

    mockFetchApodItem
      .mockResolvedValueOnce(apod)
      .mockRejectedValueOnce(new Error('apod failed'));
    mockFetchDailyKnowledgeRegistryItems.mockResolvedValue({
      items: [],
      sourceStatuses: [
        {
          source: 'esa-science',
          transport: 'rss',
          state: 'degraded',
          reason: 'empty',
          itemCount: 0,
        },
      ],
    });

    const first = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });
    expect(first.selected.id).toBe('apod-stale-cache');
    expect(first.resolutionMode).toBe('fresh-online');

    jest.setSystemTime(new Date('2026-02-21T00:01:00.000Z'));

    const second = await getDailyKnowledge('2026-02-20', 'en', { onlineEnhancement: true });

    expect(second.selected.id).toBe('apod-stale-cache');
    expect(second.usedCuratedFallback).toBe(false);
    expect(second.resolutionMode).toBe('stale-cache');
    expect(second.sourceStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'nasa-apod', state: 'stale' }),
        expect.objectContaining({ source: 'esa-science', state: 'degraded' }),
      ])
    );

    jest.useRealTimers();
  });

  it('passes recent history options to curated daily selector', async () => {
    await getDailyKnowledge('2026-02-20', 'en', {
      onlineEnhancement: false,
      recentHistoryItemIds: ['curated-2'],
      repeatWindowDays: 7,
    });

    expect(mockGetCuratedDailyItem).toHaveBeenCalledWith(
      '2026-02-20',
      'en',
      expect.objectContaining({
        recentItemIds: ['curated-2'],
        repeatWindowDays: 7,
      })
    );
  });

  it('retries with exponential backoff sequence', async () => {
    jest.useFakeTimers();
    const fn = jest
      .fn<Promise<string>, [number]>()
      .mockRejectedValueOnce({ retryAfterMs: 0 })
      .mockRejectedValueOnce({ retryAfterMs: 0 })
      .mockResolvedValue('ok');

    const task = withRetry(fn, () => true);

    await jest.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(2000);
    await Promise.resolve();

    const result = await task;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });
});
