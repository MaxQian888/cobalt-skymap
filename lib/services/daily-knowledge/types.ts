export type DailyKnowledgeSource =
  | 'curated'
  | 'nasa-apod'
  | 'wikimedia'
  | 'nasa-image-library'
  | 'nasa-photojournal'
  | 'esa-science';

export type DailyKnowledgeOnlineSource = Exclude<DailyKnowledgeSource, 'curated'>;

export type DailyKnowledgeSourceTransport = 'api' | 'rss' | 'html';

export type DailyKnowledgeSourceStatusState =
  | 'healthy'
  | 'degraded'
  | 'skipped'
  | 'failed'
  | 'stale';

export type DailyKnowledgeSourceStatusReason =
  | 'success'
  | 'empty'
  | 'error'
  | 'invalid'
  | 'offline'
  | 'disabled';

export type DailyKnowledgeFallbackReason = 'offline' | 'source-failure' | 'quality-threshold' | null;

export type DailyKnowledgeResolutionMode =
  | 'fresh-online'
  | 'stale-cache'
  | 'curated-fallback';

export interface DailyKnowledgeFactSource {
  title: string;
  url: string;
  publisher: string;
  accessedAt?: string;
}

export type DailyKnowledgeLanguageStatus = 'native' | 'fallback';

export type DailyKnowledgeCategory =
  | 'object'
  | 'event'
  | 'history'
  | 'mission'
  | 'technique'
  | 'culture';

export type DailyKnowledgeDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface DailyKnowledgeImage {
  url: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
}

export interface DailyKnowledgeAttribution {
  sourceName: string;
  sourceUrl?: string;
  copyright?: string;
  licenseName?: string;
  licenseUrl?: string;
}

export interface DailyKnowledgeRelatedObject {
  name: string;
  ra?: number;
  dec?: number;
}

export interface DailyKnowledgeItem {
  id: string;
  dateKey: string;
  source: DailyKnowledgeSource;
  title: string;
  summary: string;
  body: string;
  contentLanguage: string;
  categories: DailyKnowledgeCategory[];
  tags: string[];
  image?: DailyKnowledgeImage;
  externalUrl?: string;
  relatedObjects: DailyKnowledgeRelatedObject[];
  attribution: DailyKnowledgeAttribution;
  isDateEvent: boolean;
  eventMonthDay?: string;
  factSources: DailyKnowledgeFactSource[];
  difficulty: DailyKnowledgeDifficulty;
  bestViewingMonths: number[];
  observationTips: string[];
  languageStatus: DailyKnowledgeLanguageStatus;
  fetchedAt: number;
}

export interface DailyKnowledgeFavorite {
  itemId: string;
  createdAt: number;
}

export type DailyKnowledgeHistoryEntry = 'auto' | 'manual' | 'random' | 'search';

export interface DailyKnowledgeHistory {
  itemId: string;
  shownAt: number;
  entry: DailyKnowledgeHistoryEntry;
  dateKey: string;
}

export interface DailyKnowledgeStartupState {
  lastShownDate: string | null;
  snoozedDate: string | null;
  lastSeenItemId: string | null;
}

export interface DailyKnowledgeFilters {
  query: string;
  category: DailyKnowledgeCategory | 'all';
  source: DailyKnowledgeSource | 'all';
  favoritesOnly: boolean;
}

export interface DailyKnowledgeSourceStatus {
  source: DailyKnowledgeOnlineSource;
  transport: DailyKnowledgeSourceTransport;
  state: DailyKnowledgeSourceStatusState;
  reason: DailyKnowledgeSourceStatusReason;
  itemCount: number;
  message?: string;
}

export interface DailyKnowledgeSourceFetchContext {
  dateKey: string;
  locale: 'en' | 'zh';
  query: string;
  anchorItem: DailyKnowledgeItem;
  signal?: AbortSignal;
}

export interface DailyKnowledgeSourceAdapter {
  source: DailyKnowledgeOnlineSource;
  transport: DailyKnowledgeSourceTransport;
  supportsLocales: Array<'en' | 'zh'>;
  cachePolicyId: string;
  freshnessWindowMs: number;
  fetchItems: (context: DailyKnowledgeSourceFetchContext) => Promise<DailyKnowledgeItem[]>;
}

export interface DailyKnowledgeRegistryResult {
  items: DailyKnowledgeItem[];
  sourceStatuses: DailyKnowledgeSourceStatus[];
}

export interface DailyKnowledgeOptions {
  locale: 'en' | 'zh';
  onlineEnhancement: boolean;
  recentHistoryItemIds: string[];
  repeatWindowDays: number;
  signal?: AbortSignal;
}

export interface DailyKnowledgeServiceResult {
  items: DailyKnowledgeItem[];
  selected: DailyKnowledgeItem;
  sourceStatuses: DailyKnowledgeSourceStatus[];
  usedCuratedFallback: boolean;
  fallbackReason: DailyKnowledgeFallbackReason;
  resolutionMode: DailyKnowledgeResolutionMode;
}
