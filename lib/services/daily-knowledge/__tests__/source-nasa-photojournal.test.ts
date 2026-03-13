/**
 * @jest-environment jsdom
 */

import { fetchNasaPhotojournalItems } from '../source-nasa-photojournal';

const mockFetch = jest.fn();

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    fetch: (...args: unknown[]) => mockFetch(...args),
  },
}));

jest.mock('../constants', () => ({
  DAILY_KNOWLEDGE_ALL_MONTHS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'] as const,
  NASA_PHOTOJOURNAL_FEED_URL: 'https://science.nasa.gov/feed/photojournal/gallery/universe/',
  NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS: 365 * 24 * 60 * 60 * 1000,
  NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS: 5000,
  NASA_PHOTOJOURNAL_TTL_MS: 21600000,
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

describe('daily-knowledge/source-nasa-photojournal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses the feed and keeps astronomy-relevant items', async () => {
    mockFetch.mockResolvedValue(
      makeTextResponse(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Andromeda in X-ray Light</title>
              <link>https://science.nasa.gov/photojournal/andromeda-xray/</link>
              <pubDate>Thu, 26 Feb 2026 20:23:05 +0000</pubDate>
              <description><![CDATA[<img src="https://science.nasa.gov/img/andromeda.jpg" />A new Andromeda image from NASA.]]></description>
              <guid>https://science.nasa.gov/?p=123</guid>
            </item>
            <item>
              <title>Earth Lab Update</title>
              <link>https://science.nasa.gov/photojournal/earth-lab/</link>
              <pubDate>Thu, 26 Feb 2026 20:23:05 +0000</pubDate>
              <description><![CDATA[Testing Earth instruments.]]></description>
              <guid>https://science.nasa.gov/?p=456</guid>
            </item>
          </channel>
        </rss>`)
    );

    const items = await fetchNasaPhotojournalItems('2026-03-13', 'Andromeda');

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('nasa-photojournal-https-science-nasa-gov-p-123');
    expect(items[0].source).toBe('nasa-photojournal');
    expect(items[0].image?.url).toBe('https://science.nasa.gov/img/andromeda.jpg');
    expect(items[0].externalUrl).toBe('https://science.nasa.gov/photojournal/andromeda-xray/');
  });

  it('drops items outside the freshness window', async () => {
    mockFetch.mockResolvedValue(
      makeTextResponse(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>Old Andromeda Story</title>
              <link>https://science.nasa.gov/photojournal/old-andromeda/</link>
              <pubDate>Thu, 26 Feb 2020 20:23:05 +0000</pubDate>
              <description><![CDATA[Old archive item.]]></description>
              <guid>https://science.nasa.gov/?p=789</guid>
            </item>
          </channel>
        </rss>`)
    );

    const items = await fetchNasaPhotojournalItems('2026-03-13', 'Andromeda');
    expect(items).toEqual([]);
  });
});
