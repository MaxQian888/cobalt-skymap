/**
 * @jest-environment jsdom
 */

import { fetchNasaImageLibraryItems } from '../source-nasa-image-library';

const mockFetch = jest.fn();

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    fetch: (...args: unknown[]) => mockFetch(...args),
  },
}));

jest.mock('../constants', () => ({
  DAILY_KNOWLEDGE_ALL_MONTHS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const,
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'] as const,
  NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS: 5000,
  NASA_IMAGE_LIBRARY_SEARCH_URL: 'https://images-api.nasa.gov/search',
  NASA_IMAGE_LIBRARY_TTL_MS: 43200000,
  RETRY_DELAYS_MS: [10, 20, 40] as const,
  WIKIMEDIA_MIN_REQUEST_INTERVAL_MS: 0,
}));

function makeJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

describe('daily-knowledge/source-nasa-image-library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes NASA image library results into daily knowledge items', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        collection: {
          items: [
            {
              href: 'https://images-assets.nasa.gov/image/PIA20970/collection.json',
              data: [
                {
                  title: 'Pulsar Candidate in Andromeda',
                  description: 'NuSTAR identified a candidate pulsar in Andromeda.',
                  date_created: '2017-03-23T15:50:41Z',
                  nasa_id: 'PIA20970',
                  secondary_creator: 'NASA/JPL-Caltech',
                  keywords: ['Andromeda galaxy', 'NuSTAR'],
                },
              ],
              links: [
                {
                  href: 'https://images-assets.nasa.gov/image/PIA20970/PIA20970~thumb.jpg',
                  rel: 'preview',
                  render: 'image',
                },
                {
                  href: 'https://images-assets.nasa.gov/image/PIA20970/PIA20970~orig.jpg',
                  rel: 'canonical',
                  render: 'image',
                },
              ],
            },
          ],
        },
      })
    );

    const items = await fetchNasaImageLibraryItems('2026-03-13', 'Andromeda');

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('nasa-image-library-pia20970');
    expect(items[0].source).toBe('nasa-image-library');
    expect(items[0].title).toBe('Pulsar Candidate in Andromeda');
    expect(items[0].image?.url).toContain('PIA20970~orig.jpg');
    expect(items[0].image?.thumbnailUrl).toContain('PIA20970~thumb.jpg');
    expect(items[0].externalUrl).toBe('https://images-assets.nasa.gov/image/PIA20970/collection.json');
    expect(items[0].attribution.sourceName).toBe('NASA Image and Video Library');
    expect(items[0].factSources[0]?.publisher).toBe('NASA');
  });

  it('filters out items without required title or description', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        collection: {
          items: [
            {
              href: 'https://images-assets.nasa.gov/image/BAD/collection.json',
              data: [{ title: '', description: '', nasa_id: 'BAD' }],
              links: [],
            },
          ],
        },
      })
    );

    const items = await fetchNasaImageLibraryItems('2026-03-13', 'Andromeda');
    expect(items).toEqual([]);
  });

  it('passes query and image media_type to the API', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ collection: { items: [] } }));

    await fetchNasaImageLibraryItems('2026-03-13', 'Andromeda');

    const requestUrl = mockFetch.mock.calls[0][0] as string;
    expect(requestUrl).toContain('q=Andromeda');
    expect(requestUrl).toContain('media_type=image');
  });
});
