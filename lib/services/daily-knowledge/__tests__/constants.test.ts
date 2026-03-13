/**
 * @jest-environment node
 */

import {
  APOD_REQUEST_TIMEOUT_MS,
  APOD_TTL_MS,
  DAILY_KNOWLEDGE_AGGREGATED_TTL_FALLBACK_MS,
  DAILY_KNOWLEDGE_ALL_MONTHS,
  DAILY_KNOWLEDGE_APOD_URL,
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS,
  DAILY_KNOWLEDGE_MIN_EVENT_MONTH_COVERAGE,
  DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS,
  DAILY_KNOWLEDGE_SOURCE_FETCH_CONCURRENCY,
  DAILY_KNOWLEDGE_USER_AGENT,
  DAILY_KNOWLEDGE_WIKI_BASE_URLS,
  DAILY_KNOWLEDGE_WIKI_PAGE_PATH,
  DAILY_KNOWLEDGE_WIKI_SEARCH_PATH,
  ESA_SCIENCE_FEED_URL,
  ESA_SCIENCE_FRESHNESS_WINDOW_MS,
  ESA_SCIENCE_REQUEST_TIMEOUT_MS,
  ESA_SCIENCE_TTL_MS,
  HISTORY_LIMIT,
  NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS,
  NASA_IMAGE_LIBRARY_SEARCH_URL,
  NASA_IMAGE_LIBRARY_TTL_MS,
  NASA_PHOTOJOURNAL_FEED_URL,
  NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS,
  NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS,
  NASA_PHOTOJOURNAL_TTL_MS,
  RETRY_DELAYS_MS,
  WIKIMEDIA_MIN_REQUEST_INTERVAL_MS,
  WIKIMEDIA_REQUEST_TIMEOUT_MS,
  WIKIMEDIA_TTL_MS,
} from '../constants';

describe('daily-knowledge/constants', () => {
  it('defines the expected source endpoints and wiki paths', () => {
    expect(DAILY_KNOWLEDGE_APOD_URL).toBe('https://api.nasa.gov/planetary/apod');
    expect(NASA_IMAGE_LIBRARY_SEARCH_URL).toBe('https://images-api.nasa.gov/search');
    expect(NASA_PHOTOJOURNAL_FEED_URL).toContain('science.nasa.gov/feed/photojournal');
    expect(ESA_SCIENCE_FEED_URL).toContain('esa.int/rssfeed');
    expect(DAILY_KNOWLEDGE_WIKI_BASE_URLS).toEqual({
      en: 'https://en.wikipedia.org',
      zh: 'https://zh.wikipedia.org',
    });
    expect(DAILY_KNOWLEDGE_WIKI_SEARCH_PATH).toBe('/w/rest.php/v1/search/page');
    expect(DAILY_KNOWLEDGE_WIKI_PAGE_PATH).toBe('/w/rest.php/v1/page');
  });

  it('keeps cache timing, retry, and request limits in a sane range', () => {
    expect(APOD_TTL_MS).toBe(24 * 60 * 60 * 1000);
    expect(WIKIMEDIA_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(NASA_IMAGE_LIBRARY_TTL_MS).toBe(12 * 60 * 60 * 1000);
    expect(NASA_PHOTOJOURNAL_TTL_MS).toBe(6 * 60 * 60 * 1000);
    expect(ESA_SCIENCE_TTL_MS).toBe(6 * 60 * 60 * 1000);
    expect(DAILY_KNOWLEDGE_AGGREGATED_TTL_FALLBACK_MS).toBe(24 * 60 * 60 * 1000);
    expect(RETRY_DELAYS_MS).toEqual([1000, 2000, 4000]);
    expect(WIKIMEDIA_MIN_REQUEST_INTERVAL_MS).toBe(250);
    expect(APOD_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(WIKIMEDIA_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(ESA_SCIENCE_REQUEST_TIMEOUT_MS).toBe(10_000);
    expect(NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS).toBe(365 * 24 * 60 * 60 * 1000);
    expect(ESA_SCIENCE_FRESHNESS_WINDOW_MS).toBe(365 * 24 * 60 * 60 * 1000);
    expect(DAILY_KNOWLEDGE_SOURCE_FETCH_CONCURRENCY).toBe(2);
  });

  it('exposes the content-selection constants used by the service layer', () => {
    expect(HISTORY_LIMIT).toBe(120);
    expect(DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS).toBe(7);
    expect(DAILY_KNOWLEDGE_MIN_EVENT_MONTH_COVERAGE).toBe(12);
    expect(DAILY_KNOWLEDGE_ALL_MONTHS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(DAILY_KNOWLEDGE_DIFFICULTY_LEVELS).toEqual([
      'beginner',
      'intermediate',
      'advanced',
    ]);
    expect(DAILY_KNOWLEDGE_USER_AGENT).toContain('daily-knowledge');
    expect(DAILY_KNOWLEDGE_USER_AGENT).toContain('SkyMap/0.1.0');
  });
});
