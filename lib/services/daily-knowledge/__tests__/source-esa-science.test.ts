/**
 * @jest-environment jsdom
 */

import { fetchEsaScienceItems } from '../source-esa-science';

const mockFetch = jest.fn();

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    fetch: (...args: unknown[]) => mockFetch(...args),
  },
}));

jest.mock('../constants', () => ({
  DAILY_KNOWLEDGE_ALL_MONTHS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'] as const,
  ESA_SCIENCE_FEED_URL: 'https://www.esa.int/rssfeed/Our_Activities/Space_Science',
  ESA_SCIENCE_FRESHNESS_WINDOW_MS: 365 * 24 * 60 * 60 * 1000,
  ESA_SCIENCE_REQUEST_TIMEOUT_MS: 5000,
  ESA_SCIENCE_TTL_MS: 21600000,
  RETRY_DELAYS_MS: [10, 20, 40] as const,
  WIKIMEDIA_MIN_REQUEST_INTERVAL_MS: 0,
}));

function makeTextResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    headers: new Headers({ 'content-type': 'application/rss+xml' }),
  } as unknown as Response;
}

describe('daily-knowledge/source-esa-science', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes ESA science feed entries', async () => {
    mockFetch.mockResolvedValue(
      makeTextResponse(`<?xml version="1.0" encoding="utf-8" ?>
        <rss version="2.0">
          <channel>
            <item>
              <title>ESA observations of interstellar comet 3I/ATLAS</title>
              <description><![CDATA[<img src="https://www.esa.int/var/esa/storage/images/comet.jpg" />New ESA observations of comet 3I/ATLAS.]]></description>
              <link>https://www.esa.int/Science_Exploration/Space_Science/interstellar-comet</link>
              <pubDate>Wed, 03 Sep 2025 16:10:00 +0200</pubDate>
              <guid>https://www.esa.int/item-1</guid>
            </item>
          </channel>
        </rss>`)
    );

    const items = await fetchEsaScienceItems('2026-03-13', 'comet');

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('esa-science-https-www-esa-int-item-1');
    expect(items[0].source).toBe('esa-science');
    expect(items[0].title).toContain('interstellar comet');
    expect(items[0].image?.url).toContain('comet.jpg');
    expect(items[0].attribution.sourceName).toBe('ESA Space Science');
  });

  it('returns an empty array when no feed entries match the astronomy query', async () => {
    mockFetch.mockResolvedValue(
      makeTextResponse(`<?xml version="1.0" encoding="utf-8" ?>
        <rss version="2.0">
          <channel>
            <item>
              <title>ESA education event</title>
              <description><![CDATA[Public outreach event.]]></description>
              <link>https://www.esa.int/item-2</link>
              <pubDate>Wed, 03 Sep 2025 16:10:00 +0200</pubDate>
              <guid>https://www.esa.int/item-2</guid>
            </item>
          </channel>
        </rss>`)
    );

    const items = await fetchEsaScienceItems('2026-03-13', 'Andromeda');
    expect(items).toEqual([]);
  });
});
