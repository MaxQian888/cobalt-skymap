/**
 * @jest-environment jsdom
 */

import { fetchWikimediaItem } from '../source-wikimedia';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

const mockFetch = jest.fn();

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    fetch: (...args: unknown[]) => mockFetch(...args),
  },
}));

jest.mock('../constants', () => ({
  DAILY_KNOWLEDGE_USER_AGENT: 'CobaltSkymap/test',
  DAILY_KNOWLEDGE_WIKI_BASE_URLS: {
    en: 'https://en.wikipedia.org',
    zh: 'https://zh.wikipedia.org',
  },
  DAILY_KNOWLEDGE_WIKI_PAGE_PATH: '/w/rest.php/v1/page',
  DAILY_KNOWLEDGE_WIKI_SEARCH_PATH: '/w/rest.php/v1/search/page',
  WIKIMEDIA_REQUEST_TIMEOUT_MS: 5000,
  WIKIMEDIA_TTL_MS: 604800000,
  RETRY_DELAYS_MS: [10, 20, 40] as const,
  WIKIMEDIA_MIN_REQUEST_INTERVAL_MS: 0,
  DAILY_KNOWLEDGE_ALL_MONTHS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'] as const,
}));

function makeJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

function makeErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    headers: new Headers(),
  } as unknown as Response;
}

function setupSuccessfulSearch(locale: 'en' | 'zh' = 'en') {
  // search → bare → with_html
  mockFetch
    .mockResolvedValueOnce(
      makeJsonResponse({
        pages: [
          {
            key: 'Andromeda_Galaxy',
            title: 'Andromeda Galaxy',
            description: 'Spiral galaxy nearest to the Milky Way',
            excerpt: 'The <b>Andromeda Galaxy</b> is a barred spiral galaxy.',
            thumbnail: { url: '//upload.wikimedia.org/thumb/andromeda.jpg' },
          },
        ],
      })
    )
    .mockResolvedValueOnce(
      makeJsonResponse({
        title: 'Andromeda Galaxy',
        html_url: `https://${locale}.wikipedia.org/wiki/Andromeda_Galaxy`,
        license: { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
      })
    )
    .mockResolvedValueOnce(
      makeJsonResponse({
        html: '<p>The Andromeda Galaxy is approximately 2.5 million light-years from Earth.</p>',
      })
    );
}

describe('daily-knowledge/source-wikimedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for empty query', async () => {
    const result = await fetchWikimediaItem('2026-02-20', '');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns null for whitespace-only query', async () => {
    const result = await fetchWikimediaItem('2026-02-20', '   ');
    expect(result).toBeNull();
  });

  it('fetches and builds a complete DailyKnowledgeItem', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');

    expect(item).not.toBeNull();
    expect(item!.id).toBe('wikimedia-en-andromeda_galaxy');
    expect(item!.source).toBe('wikimedia');
    expect(item!.title).toBe('Andromeda Galaxy');
    expect(item!.contentLanguage).toBe('en');
    expect(item!.categories).toEqual(['history', 'culture']);
    expect(item!.tags).toContain('wikipedia');
    expect(item!.tags).toContain('wikimedia');
  });

  it('strips HTML tags from body text', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');
    expect(item!.body).not.toContain('<p>');
    expect(item!.body).not.toContain('</p>');
    expect(item!.body).toContain('Andromeda Galaxy');
  });

  it('prepends https: to protocol-relative thumbnail URLs', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');
    expect(item!.image?.url).toBe('https://upload.wikimedia.org/thumb/andromeda.jpg');
  });

  it('preserves absolute thumbnail URLs', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeJsonResponse({
          pages: [
            {
              key: 'Test',
              title: 'Test',
              thumbnail: { url: 'https://example.com/thumb.jpg' },
            },
          ],
        })
      )
      .mockResolvedValueOnce(makeJsonResponse({ title: 'Test' }))
      .mockResolvedValueOnce(makeJsonResponse({ html: '<p>Test body</p>' }));

    const item = await fetchWikimediaItem('2026-02-20', 'Test');
    expect(item!.image?.url).toBe('https://example.com/thumb.jpg');
  });

  it('sets image to undefined when no thumbnail', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeJsonResponse({
          pages: [{ key: 'NoImage', title: 'No Image' }],
        })
      )
      .mockResolvedValueOnce(makeJsonResponse({ title: 'No Image' }))
      .mockResolvedValueOnce(makeJsonResponse({ html: '<p>Content</p>' }));

    const item = await fetchWikimediaItem('2026-02-20', 'No Image');
    expect(item!.image).toBeUndefined();
  });

  it('includes license info in attribution', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');
    expect(item!.attribution.sourceName).toBe('Wikimedia / Wikipedia');
    expect(item!.attribution.licenseName).toBe('CC BY-SA 3.0');
    expect(item!.attribution.licenseUrl).toBe('https://creativecommons.org/licenses/by-sa/3.0/');
  });

  it('returns null when search yields no pages', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ pages: [] }));

    const item = await fetchWikimediaItem('2026-02-20', 'NonexistentTopic');
    expect(item).toBeNull();
  });

  it('returns null when search result has no key', async () => {
    mockFetch.mockResolvedValueOnce(
      makeJsonResponse({ pages: [{ title: 'Untitled' }] })
    );

    const item = await fetchWikimediaItem('2026-02-20', 'Untitled');
    expect(item).toBeNull();
  });

  it('tries zh locale first when locale is zh, then falls back to en', async () => {
    // zh search returns no results
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ pages: [] }));
    // en search succeeds
    setupSuccessfulSearch('en');

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy', { locale: 'zh' });

    expect(item).not.toBeNull();
    // First call should be to zh endpoint
    const firstUrl = mockFetch.mock.calls[0][0] as string;
    expect(firstUrl).toContain('zh.wikipedia.org');
    // Subsequent calls should be to en endpoint
    const secondUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondUrl).toContain('en.wikipedia.org');
  });

  it('rethrows abort errors without fallback', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValue(abortError);

    await expect(
      fetchWikimediaItem('2026-02-20', 'Test', { locale: 'en' })
    ).rejects.toThrow();
  });

  it('throws last error if all locales fail with non-abort errors', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(500));

    await expect(
      fetchWikimediaItem('2026-02-20', 'Test', { locale: 'zh' })
    ).rejects.toThrow();
  });

  it('populates factSources with Wikipedia reference', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');
    expect(item!.factSources).toHaveLength(1);
    expect(item!.factSources[0].publisher).toBe('Wikimedia Foundation');
    expect(item!.factSources[0].title).toContain('Andromeda Galaxy');
  });

  it('includes related objects from search hit title', async () => {
    setupSuccessfulSearch();

    const item = await fetchWikimediaItem('2026-02-20', 'Andromeda Galaxy');
    expect(item!.relatedObjects).toHaveLength(1);
    expect(item!.relatedObjects[0].name).toBe('Andromeda Galaxy');
  });
});
