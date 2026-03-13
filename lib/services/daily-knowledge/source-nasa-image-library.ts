import { smartFetch } from '@/lib/services/http-fetch';
import {
  NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS,
  NASA_IMAGE_LIBRARY_SEARCH_URL,
  NASA_IMAGE_LIBRARY_TTL_MS,
} from './constants';
import { buildItem } from './normalizers';
import { createRequestSignal, isAbortLikeError, isRetryableStatus, parseRetryAfterMs, withRetry } from './policy';
import type { DailyKnowledgeItem } from './types';

interface NasaLibraryAsset {
  href?: string;
  rel?: string;
  render?: string;
}

interface NasaLibraryData {
  title?: string;
  description?: string;
  date_created?: string;
  nasa_id?: string;
  keywords?: string[];
  secondary_creator?: string;
  center?: string;
}

interface NasaLibraryEntry {
  href?: string;
  data?: NasaLibraryData[];
  links?: NasaLibraryAsset[];
}

interface NasaLibraryResponse {
  collection?: {
    items?: NasaLibraryEntry[];
  };
}

class HttpStatusError extends Error {
  status: number;
  retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null, message: string) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function getPrimaryData(entry: NasaLibraryEntry): NasaLibraryData | null {
  return entry.data?.find((item) => Boolean(item.title || item.description)) ?? null;
}

function getImageUrls(entry: NasaLibraryEntry): { url?: string; thumbnailUrl?: string } {
  const links = entry.links ?? [];
  const canonical = links.find((link) => link.rel === 'canonical' && link.render === 'image')?.href;
  const preview =
    links.find((link) => link.rel === 'preview' && link.render === 'image')?.href ??
    links.find((link) => link.rel === 'alternate' && link.render === 'image')?.href;

  return {
    url: canonical ?? preview,
    thumbnailUrl: preview ?? canonical,
  };
}

export async function fetchNasaImageLibraryItems(
  dateKey: string,
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<DailyKnowledgeItem[]> {
  if (!query.trim()) return [];

  const searchParams = new URLSearchParams({
    q: query,
    media_type: 'image',
  });
  const url = `${NASA_IMAGE_LIBRARY_SEARCH_URL}?${searchParams.toString()}`;
  const { signal, cleanup } = createRequestSignal(NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS, options.signal);

  try {
    const response = await withRetry(
      async () => {
        const res = await smartFetch(url, {
          signal,
          cachePolicy: 'daily-knowledge-nasa-library',
          cacheStrategy: 'network-first',
          cacheTtl: NASA_IMAGE_LIBRARY_TTL_MS,
        });
        if (!res.ok) {
          throw new HttpStatusError(
            res.status,
            parseRetryAfterMs(new Headers(res.headers).get('Retry-After')),
            `NASA image library request failed with status ${res.status}`
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

    const payload = (await response.json()) as NasaLibraryResponse;
    return (payload.collection?.items ?? [])
      .slice(0, 4)
      .map((entry) => {
        const data = getPrimaryData(entry);
        if (!data?.title?.trim() || !data.description?.trim() || !data.nasa_id?.trim()) {
          return null;
        }
        const images = getImageUrls(entry);
        return buildItem({
          id: `nasa-image-library-${data.nasa_id.toLowerCase()}`,
          dateKey,
          source: 'nasa-image-library',
          title: data.title.trim(),
          summary: data.description.trim().slice(0, 240),
          body: data.description.trim(),
          contentLanguage: 'en',
          categories: ['object', 'mission'],
          tags: ['nasa', 'image-library', ...(data.keywords ?? []).flatMap((keyword) => keyword.split(','))].map(
            (tag) => tag.trim()
          ).filter(Boolean),
          image: images.url
            ? {
                url: images.url,
                thumbnailUrl: images.thumbnailUrl,
                type: 'image',
              }
            : undefined,
          externalUrl: entry.href,
          relatedObjects: [{ name: query }],
          attribution: {
            sourceName: 'NASA Image and Video Library',
            sourceUrl: entry.href,
            copyright: data.secondary_creator ?? data.center,
          },
          factSources: entry.href
            ? [
                {
                  title: data.title.trim(),
                  url: entry.href,
                  publisher: 'NASA',
                },
              ]
            : [],
          fetchedAt: Date.now(),
        });
      })
      .filter((item): item is DailyKnowledgeItem => Boolean(item));
  } finally {
    cleanup();
  }
}
