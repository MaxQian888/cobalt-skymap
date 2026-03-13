import { DAILY_KNOWLEDGE_SOURCE_FETCH_CONCURRENCY, ESA_SCIENCE_FRESHNESS_WINDOW_MS, NASA_IMAGE_LIBRARY_TTL_MS, NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS } from './constants';
import { fetchEsaScienceItems } from './source-esa-science';
import { fetchNasaImageLibraryItems } from './source-nasa-image-library';
import { fetchNasaPhotojournalItems } from './source-nasa-photojournal';
import type {
  DailyKnowledgeRegistryResult,
  DailyKnowledgeSourceAdapter,
  DailyKnowledgeSourceFetchContext,
  DailyKnowledgeSourceStatus,
} from './types';

function isValidRegistryItem(item: { title: string; summary: string; body: string; attribution: { sourceName?: string; sourceUrl?: string }; externalUrl?: string }): boolean {
  return Boolean(
    item.title.trim() &&
      item.summary.trim() &&
      item.body.trim() &&
      item.attribution.sourceName?.trim() &&
      (item.externalUrl?.trim() || item.attribution.sourceUrl?.trim())
  );
}

async function mapWithConcurrency<TInput, TResult>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput) => Promise<TResult>
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(runners);
  return results;
}

export const DAILY_KNOWLEDGE_SOURCE_ADAPTERS: DailyKnowledgeSourceAdapter[] = [
  {
    source: 'nasa-image-library',
    transport: 'api',
    supportsLocales: ['en', 'zh'],
    cachePolicyId: 'daily-knowledge-nasa-library',
    freshnessWindowMs: NASA_IMAGE_LIBRARY_TTL_MS,
    fetchItems: ({ dateKey, query, signal }) => fetchNasaImageLibraryItems(dateKey, query, { signal }),
  },
  {
    source: 'nasa-photojournal',
    transport: 'rss',
    supportsLocales: ['en', 'zh'],
    cachePolicyId: 'daily-knowledge-nasa-photojournal',
    freshnessWindowMs: NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS,
    fetchItems: ({ dateKey, query, signal }) => fetchNasaPhotojournalItems(dateKey, query, { signal }),
  },
  {
    source: 'esa-science',
    transport: 'rss',
    supportsLocales: ['en', 'zh'],
    cachePolicyId: 'daily-knowledge-esa-science',
    freshnessWindowMs: ESA_SCIENCE_FRESHNESS_WINDOW_MS,
    fetchItems: ({ dateKey, query, signal }) => fetchEsaScienceItems(dateKey, query, { signal }),
  },
];

export async function fetchDailyKnowledgeRegistryItems(
  context: DailyKnowledgeSourceFetchContext,
  adapters: DailyKnowledgeSourceAdapter[] = DAILY_KNOWLEDGE_SOURCE_ADAPTERS
): Promise<DailyKnowledgeRegistryResult> {
  const settled = await mapWithConcurrency(
    adapters.filter((adapter) => adapter.supportsLocales.includes(context.locale)),
    DAILY_KNOWLEDGE_SOURCE_FETCH_CONCURRENCY,
    async (adapter) => {
      try {
        const items = (await adapter.fetchItems(context)).filter(isValidRegistryItem);
        const status: DailyKnowledgeSourceStatus =
          items.length > 0
            ? {
                source: adapter.source,
                transport: adapter.transport,
                state: 'ready',
                reason: 'success',
                itemCount: items.length,
              }
            : {
                source: adapter.source,
                transport: adapter.transport,
                state: 'skipped',
                reason: 'empty',
                itemCount: 0,
              };
        return { items, status };
      } catch (error) {
        return {
          items: [],
          status: {
            source: adapter.source,
            transport: adapter.transport,
            state: 'failed',
            reason: 'error',
            itemCount: 0,
            message: error instanceof Error ? error.message : String(error),
          } as DailyKnowledgeSourceStatus,
        };
      }
    }
  );

  return {
    items: settled.flatMap((entry) => entry.items),
    sourceStatuses: settled.map((entry) => entry.status),
  };
}
