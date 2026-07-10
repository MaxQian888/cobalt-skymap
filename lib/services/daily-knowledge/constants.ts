export const DAILY_KNOWLEDGE_APOD_URL = 'https://api.nasa.gov/planetary/apod';
export const NASA_IMAGE_LIBRARY_SEARCH_URL = 'https://images-api.nasa.gov/search';
export const NASA_PHOTOJOURNAL_FEED_URL = 'https://science.nasa.gov/feed/photojournal/gallery/universe/';
export const ESA_SCIENCE_FEED_URL = 'https://www.esa.int/rssfeed/Our_Activities/Space_Science';
export const DAILY_KNOWLEDGE_WIKI_BASE_URLS = {
  en: 'https://en.wikipedia.org',
  zh: 'https://zh.wikipedia.org',
} as const;
export const DAILY_KNOWLEDGE_WIKI_SEARCH_PATH = '/w/rest.php/v1/search/page';
export const DAILY_KNOWLEDGE_WIKI_PAGE_PATH = '/w/rest.php/v1/page';

export const APOD_TTL_MS = 24 * 60 * 60 * 1000;
export const WIKIMEDIA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NASA_IMAGE_LIBRARY_TTL_MS = 12 * 60 * 60 * 1000;
export const NASA_PHOTOJOURNAL_TTL_MS = 6 * 60 * 60 * 1000;
export const ESA_SCIENCE_TTL_MS = 6 * 60 * 60 * 1000;
export const DAILY_KNOWLEDGE_AGGREGATED_TTL_FALLBACK_MS = 24 * 60 * 60 * 1000;
export const HISTORY_LIMIT = 120;
export const DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS = 7;
export const DAILY_KNOWLEDGE_MIN_EVENT_MONTH_COVERAGE = 12;
export const DAILY_KNOWLEDGE_ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const DAILY_KNOWLEDGE_DIFFICULTY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

export const RETRY_DELAYS_MS = [1000, 2000, 4000] as const;
export const WIKIMEDIA_MIN_REQUEST_INTERVAL_MS = 250;
export const DAILY_KNOWLEDGE_USER_AGENT = 'CobaltSkymap/0.1.0 (daily-knowledge; contact: cobalt-skymap-app)';
export const APOD_REQUEST_TIMEOUT_MS = 10_000;
export const WIKIMEDIA_REQUEST_TIMEOUT_MS = 10_000;
export const NASA_IMAGE_LIBRARY_REQUEST_TIMEOUT_MS = 10_000;
export const NASA_PHOTOJOURNAL_REQUEST_TIMEOUT_MS = 10_000;
export const ESA_SCIENCE_REQUEST_TIMEOUT_MS = 10_000;
export const NASA_PHOTOJOURNAL_FRESHNESS_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
export const ESA_SCIENCE_FRESHNESS_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;
export const DAILY_KNOWLEDGE_SOURCE_FETCH_CONCURRENCY = 2;
