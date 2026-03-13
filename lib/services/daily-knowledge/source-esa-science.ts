import { smartFetch } from '@/lib/services/http-fetch';
import {
  ESA_SCIENCE_FEED_URL,
  ESA_SCIENCE_FRESHNESS_WINDOW_MS,
  ESA_SCIENCE_REQUEST_TIMEOUT_MS,
  ESA_SCIENCE_TTL_MS,
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

export async function fetchEsaScienceItems(
  dateKey: string,
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<DailyKnowledgeItem[]> {
  const { signal, cleanup } = createRequestSignal(ESA_SCIENCE_REQUEST_TIMEOUT_MS, options.signal);

  try {
    const response = await withRetry(
      async () => {
        const res = await smartFetch(ESA_SCIENCE_FEED_URL, {
          signal,
          headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
          cachePolicy: 'daily-knowledge-esa-science',
          cacheStrategy: 'network-first',
          cacheTtl: ESA_SCIENCE_TTL_MS,
        });
        if (!res.ok) {
          throw new HttpStatusError(
            res.status,
            parseRetryAfterMs(new Headers(res.headers).get('Retry-After')),
            `ESA science request failed with status ${res.status}`
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
      .filter((entry) => isFreshEntry(entry.pubDate, dateKey, ESA_SCIENCE_FRESHNESS_WINDOW_MS))
      .filter((entry) => matchesQueryText(`${entry.title} ${stripHtmlToText(entry.description)}`, query))
      .slice(0, 3)
      .map((entry) =>
        buildItem({
          id: `esa-science-${sanitizeIdFragment(entry.guid || entry.link)}`,
          dateKey,
          source: 'esa-science',
          title: entry.title,
          summary: stripHtmlToText(entry.description).slice(0, 240),
          body: stripHtmlToText(entry.description),
          contentLanguage: 'en',
          categories: ['history', 'mission'],
          tags: ['esa', 'space-science'],
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
            sourceName: 'ESA Space Science',
            sourceUrl: entry.link,
          },
          factSources: [
            {
              title: entry.title,
              url: entry.link,
              publisher: 'European Space Agency',
            },
          ],
          fetchedAt: Date.now(),
        })
      );
  } finally {
    cleanup();
  }
}
