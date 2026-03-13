import { smartFetch } from '@/lib/services/http-fetch';
import {
  NASA_PHOTOJOURNAL_FEED_URL,
  NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS,
  NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS,
  NASA_PHOTOJOURNAL_TTL_MS,
} from './constants';
import { extractFirstImageUrl, isFreshEntry, matchesQueryText, parseRssFeedEntries, sanitizeIdFragment, stripHtmlToText } from './feed-utils';
import { buildItem } from './normalizers';
import { createRequestSignal, isAbortLikeError, isRetryableStatus, parseRetryAfterMs, withRetry } from './policy';
import type { DailyKnowledgeItem } from './types';

class HttpStatusError extends Error {
  status: number;
  retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null, message: string) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function fetchNasaPhotojournalItems(
  dateKey: string,
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<DailyKnowledgeItem[]> {
  const { signal, cleanup } = createRequestSignal(NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS, options.signal);

  try {
    const response = await withRetry(
      async () => {
        const res = await smartFetch(NASA_PHOTOJOURNAL_FEED_URL, {
          signal,
          headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
          cachePolicy: 'daily-knowledge-nasa-photojournal',
          cacheStrategy: 'network-first',
          cacheTtl: NASA_PHOTOJOURNAL_TTL_MS,
        });
        if (!res.ok) {
          throw new HttpStatusError(
            res.status,
            parseRetryAfterMs(new Headers(res.headers).get('Retry-After')),
            `NASA photojournal request failed with status ${res.status}`
          );
        }
        return res;
      },
      (error) => {
        if (isAbortLikeError(error)) return false;
        if (!(error instanceof HttpStatusError)) return true;
        return isRetryableStatus(error.status);
      }
    );

    const xml = await response.text();
    return parseRssFeedEntries(xml)
      .filter((entry) => entry.title && entry.link)
      .filter((entry) => isFreshEntry(entry.pubDate, dateKey, NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS))
      .filter((entry) => matchesQueryText(`${entry.title} ${stripHtmlToText(entry.description)}`, query))
      .slice(0, 3)
      .map((entry) =>
        buildItem({
          id: `nasa-photojournal-${sanitizeIdFragment(entry.guid || entry.link)}`,
          dateKey,
          source: 'nasa-photojournal',
          title: entry.title,
          summary: stripHtmlToText(entry.description).slice(0, 240),
          body: stripHtmlToText(entry.description),
          contentLanguage: 'en',
          categories: ['history', 'mission'],
          tags: ['nasa', 'photojournal', 'science'],
          image: extractFirstImageUrl(entry.description)
            ? {
                url: extractFirstImageUrl(entry.description)!,
                thumbnailUrl: extractFirstImageUrl(entry.description)!,
                type: 'image',
              }
            : undefined,
          externalUrl: entry.link,
          relatedObjects: [{ name: query }],
          attribution: {
            sourceName: 'NASA Science Photojournal',
            sourceUrl: entry.link,
          },
          factSources: [
            {
              title: entry.title,
              url: entry.link,
              publisher: 'NASA',
            },
          ],
          fetchedAt: Date.now(),
        })
      );
  } finally {
    cleanup();
  }
}
