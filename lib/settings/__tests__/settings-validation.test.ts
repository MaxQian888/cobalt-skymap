/**
 * @jest-environment jsdom
 */
import {
  createDefaultSettingsDraft,
} from '../settings-draft';
import {
  getCategoryValidationStatus,
  validateSettingsDraft,
} from '../settings-validation';

describe('settings-validation', () => {
  it('accepts the default draft', () => {
    const draft = createDefaultSettingsDraft();
    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects invalid numeric ranges', () => {
    const draft = createDefaultSettingsDraft();
    draft.performance.maxStarsRendered = 200000;

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['performance.maxStarsRendered']).toBeDefined();
  });

  it('rejects invalid enum values', () => {
    const draft = createDefaultSettingsDraft();
    draft.preferences.locale = 'jp' as 'en';

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['preferences.locale']).toBeDefined();
  });

  it('enforces cross-field dependency rules', () => {
    const draft = createDefaultSettingsDraft();
    draft.preferences.dailyKnowledgeEnabled = false;
    draft.preferences.dailyKnowledgeAutoShow = true;

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['preferences.dailyKnowledgeAutoShow']).toBeDefined();
  });

  it('reports invalid values across connection, preference, search, and location categories', () => {
    const draft = createDefaultSettingsDraft();
    draft.backendProtocol = 'ftp' as 'http';
    draft.connection.ip = ' ';
    draft.connection.port = '70000';
    draft.proxy.mode = 'invalid' as 'auto';
    draft.proxy.manualUrl = 'proxy.local:3128';
    draft.preferences.timeFormat = '11h' as '24h';
    draft.preferences.dateFormat = 'lunar' as 'iso';
    draft.preferences.coordinateFormat = 'xyz' as 'dms';
    draft.preferences.distanceUnit = 'miles' as 'metric';
    draft.preferences.temperatureUnit = 'kelvin' as 'celsius';
    draft.preferences.startupView = 'mars' as 'last';
    draft.preferences.launchOnStartup = 'yes' as never;
    draft.performance.renderQuality = 'extreme' as 'high';
    draft.notifications.toastDuration = 250;
    draft.search.autoSearchDelay = 50;
    draft.search.maxSearchResults = 5;
    draft.search.rememberSearchHistory = false;
    draft.search.maxHistoryItems = 10;
    draft.location.latitude = 120;
    draft.location.longitude = 200;
    draft.location.elevation = Number.NaN;

    const result = validateSettingsDraft(draft);

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['backendProtocol']).toBeDefined();
    expect(result.fieldErrors['connection.ip']).toBeDefined();
    expect(result.fieldErrors['connection.port']).toBeDefined();
    expect(result.fieldErrors['proxy.mode']).toBeDefined();
    expect(result.fieldErrors['proxy.manualUrl']).toBeDefined();
    expect(result.fieldErrors['preferences.timeFormat']).toBeDefined();
    expect(result.fieldErrors['preferences.dateFormat']).toBeDefined();
    expect(result.fieldErrors['preferences.coordinateFormat']).toBeDefined();
    expect(result.fieldErrors['preferences.distanceUnit']).toBeDefined();
    expect(result.fieldErrors['preferences.temperatureUnit']).toBeDefined();
    expect(result.fieldErrors['preferences.startupView']).toBeDefined();
    expect(result.fieldErrors['preferences.launchOnStartup']).toBeDefined();
    expect(result.fieldErrors['performance.renderQuality']).toBeDefined();
    expect(result.fieldErrors['notifications.toastDuration']).toBeDefined();
    expect(result.fieldErrors['search.autoSearchDelay']).toBeDefined();
    expect(result.fieldErrors['search.maxSearchResults']).toBeDefined();
    expect(result.fieldErrors['search.maxHistoryItems']).toBeDefined();
    expect(result.fieldErrors['location.latitude']).toBeDefined();
    expect(result.fieldErrors['location.longitude']).toBeDefined();
    expect(result.fieldErrors['location.elevation']).toBeDefined();
    expect(getCategoryValidationStatus(result, 'search')).toBe('invalid');
    expect(getCategoryValidationStatus(result, 'accessibility')).toBe('valid');
  });

  it('requires a manual proxy URL when proxy mode is manual', () => {
    const draft = createDefaultSettingsDraft();
    draft.proxy.mode = 'manual';
    draft.proxy.manualUrl = '';

    const result = validateSettingsDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors['proxy.manualUrl']).toBeDefined();
  });
});
