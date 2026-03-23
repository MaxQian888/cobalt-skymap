import { DEFAULT_SEARCH } from '@/lib/stores/settings-store';
import type { SettingsDraft, SettingsDraftCategory, SettingsDraftPath } from './settings-draft';

export interface SettingsDraftValidationIssue {
  category: SettingsDraftCategory;
  path: SettingsDraftPath;
  message: string;
}

export interface SettingsDraftValidationResult {
  isValid: boolean;
  issues: SettingsDraftValidationIssue[];
  fieldErrors: Partial<Record<SettingsDraftPath, string>>;
  categoryErrors: Partial<Record<SettingsDraftCategory, string[]>>;
}

const APP_LOCALES = new Set(['en', 'zh']);
const TIME_FORMATS = new Set(['12h', '24h']);
const DATE_FORMATS = new Set(['iso', 'us', 'eu']);
const COORDINATE_FORMATS = new Set(['degrees', 'dms', 'hms']);
const DISTANCE_UNITS = new Set(['metric', 'imperial']);
const TEMPERATURE_UNITS = new Set(['celsius', 'fahrenheit']);
const STARTUP_VIEWS = new Set(['last', 'default', 'custom']);
const RENDER_QUALITIES = new Set(['low', 'medium', 'high', 'ultra']);
const BACKEND_PROTOCOLS = new Set(['http', 'https']);
const PROXY_MODES = new Set(['auto', 'manual', 'off']);

const EMPTY_VALIDATION_RESULT: SettingsDraftValidationResult = {
  isValid: true,
  issues: [],
  fieldErrors: {},
  categoryErrors: {},
};

export function validateSettingsDraft(draft: SettingsDraft): SettingsDraftValidationResult {
  const issues: SettingsDraftValidationIssue[] = [];

  const addIssue = (
    category: SettingsDraftCategory,
    path: SettingsDraftPath,
    message: string,
  ) => {
    issues.push({ category, path, message });
  };

  if (!BACKEND_PROTOCOLS.has(draft.backendProtocol)) {
    addIssue('connection', 'backendProtocol', 'Backend protocol must be http or https.');
  }

  if (!draft.connection.ip.trim()) {
    addIssue('connection', 'connection.ip', 'Connection IP/host is required.');
  }

  const parsedPort = Number.parseInt(draft.connection.port, 10);
  if (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    addIssue('connection', 'connection.port', 'Connection port must be between 1 and 65535.');
  }

  if (!PROXY_MODES.has(draft.proxy.mode)) {
    addIssue('connection', 'proxy.mode', 'Proxy mode must be auto, manual, or off.');
  }

  const manualProxyUrl = draft.proxy.manualUrl.trim();
  if (draft.proxy.mode === 'manual' && manualProxyUrl.length === 0) {
    addIssue(
      'connection',
      'proxy.manualUrl',
      'Manual proxy mode requires a proxy URL.',
    );
  }

  if (
    manualProxyUrl.length > 0
    && !/^(https?|socks5h?):\/\/\S+$/i.test(manualProxyUrl)
  ) {
    addIssue(
      'connection',
      'proxy.manualUrl',
      'Proxy URL must start with http://, https://, socks5://, or socks5h://.',
    );
  }

  if (!APP_LOCALES.has(draft.preferences.locale)) {
    addIssue('preferences', 'preferences.locale', 'Locale must be en or zh.');
  }
  if (!TIME_FORMATS.has(draft.preferences.timeFormat)) {
    addIssue('preferences', 'preferences.timeFormat', 'Time format must be 12h or 24h.');
  }
  if (!DATE_FORMATS.has(draft.preferences.dateFormat)) {
    addIssue('preferences', 'preferences.dateFormat', 'Date format is invalid.');
  }
  if (!COORDINATE_FORMATS.has(draft.preferences.coordinateFormat)) {
    addIssue('preferences', 'preferences.coordinateFormat', 'Coordinate format is invalid.');
  }
  if (!DISTANCE_UNITS.has(draft.preferences.distanceUnit)) {
    addIssue('preferences', 'preferences.distanceUnit', 'Distance unit is invalid.');
  }
  if (!TEMPERATURE_UNITS.has(draft.preferences.temperatureUnit)) {
    addIssue('preferences', 'preferences.temperatureUnit', 'Temperature unit is invalid.');
  }
  if (!STARTUP_VIEWS.has(draft.preferences.startupView)) {
    addIssue('preferences', 'preferences.startupView', 'Startup view is invalid.');
  }
  if (typeof draft.preferences.launchOnStartup !== 'boolean') {
    addIssue('preferences', 'preferences.launchOnStartup', 'Launch on startup must be a boolean.');
  }

  if (draft.preferences.dailyKnowledgeAutoShow && !draft.preferences.dailyKnowledgeEnabled) {
    addIssue(
      'preferences',
      'preferences.dailyKnowledgeAutoShow',
      'Daily knowledge auto-show requires daily knowledge to be enabled.',
    );
  }

  if (!RENDER_QUALITIES.has(draft.performance.renderQuality)) {
    addIssue('performance', 'performance.renderQuality', 'Render quality is invalid.');
  }
  if (!Number.isFinite(draft.performance.maxStarsRendered)
    || draft.performance.maxStarsRendered < 10000
    || draft.performance.maxStarsRendered > 100000) {
    addIssue(
      'performance',
      'performance.maxStarsRendered',
      'Max stars rendered must be between 10000 and 100000.',
    );
  }

  if (!Number.isFinite(draft.notifications.toastDuration)
    || draft.notifications.toastDuration < 1000
    || draft.notifications.toastDuration > 10000) {
    addIssue(
      'notifications',
      'notifications.toastDuration',
      'Toast duration must be between 1000 and 10000 ms.',
    );
  }

  if (!Number.isFinite(draft.search.autoSearchDelay)
    || draft.search.autoSearchDelay < 100
    || draft.search.autoSearchDelay > 1000) {
    addIssue(
      'search',
      'search.autoSearchDelay',
      'Auto search delay must be between 100 and 1000 ms.',
    );
  }
  if (!Number.isFinite(draft.search.maxSearchResults)
    || draft.search.maxSearchResults < 10
    || draft.search.maxSearchResults > 200) {
    addIssue(
      'search',
      'search.maxSearchResults',
      'Max search results must be between 10 and 200.',
    );
  }
  if (!Number.isFinite(draft.search.maxHistoryItems)
    || draft.search.maxHistoryItems < 5
    || draft.search.maxHistoryItems > 100) {
    addIssue(
      'search',
      'search.maxHistoryItems',
      'Max history items must be between 5 and 100.',
    );
  }
  if (!draft.search.rememberSearchHistory
    && draft.search.maxHistoryItems !== DEFAULT_SEARCH.maxHistoryItems) {
    addIssue(
      'search',
      'search.maxHistoryItems',
      'Max history items must stay at default when history is disabled.',
    );
  }

  if (!Number.isFinite(draft.location.latitude)
    || draft.location.latitude < -90
    || draft.location.latitude > 90) {
    addIssue('location', 'location.latitude', 'Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(draft.location.longitude)
    || draft.location.longitude < -180
    || draft.location.longitude > 180) {
    addIssue('location', 'location.longitude', 'Longitude must be between -180 and 180.');
  }
  if (!Number.isFinite(draft.location.elevation)) {
    addIssue('location', 'location.elevation', 'Elevation must be a finite number.');
  }

  if (issues.length === 0) {
    return EMPTY_VALIDATION_RESULT;
  }

  const fieldErrors: Partial<Record<SettingsDraftPath, string>> = {};
  const categoryErrors: Partial<Record<SettingsDraftCategory, string[]>> = {};

  for (const issue of issues) {
    fieldErrors[issue.path] = issue.message;
    const currentCategoryIssues = categoryErrors[issue.category] ?? [];
    currentCategoryIssues.push(issue.message);
    categoryErrors[issue.category] = currentCategoryIssues;
  }

  return {
    isValid: false,
    issues,
    fieldErrors,
    categoryErrors,
  };
}

export function getCategoryValidationStatus(
  validation: SettingsDraftValidationResult,
  category: SettingsDraftCategory,
): 'valid' | 'invalid' {
  return (validation.categoryErrors[category]?.length ?? 0) > 0 ? 'invalid' : 'valid';
}
