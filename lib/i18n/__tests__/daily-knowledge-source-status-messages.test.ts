import enMessages from '@/i18n/messages/en.json';
import zhMessages from '@/i18n/messages/zh.json';

const ONLINE_DAILY_KNOWLEDGE_SOURCES = [
  'nasa-apod',
  'wikimedia',
  'nasa-image-library',
  'nasa-photojournal',
  'esa-science',
] as const;

const DEGRADED_SOURCE_STATUS_REASONS = [
  'empty',
  'error',
  'invalid',
  'offline',
  'disabled',
] as const;

const DAILY_KNOWLEDGE_UI_KEYS = [
  'dailyKnowledge.refreshCurrentDate',
  'dailyKnowledge.freshness.fresh-online',
  'dailyKnowledge.freshness.stale-cache',
  'dailyKnowledge.freshness.curated-fallback',
] as const;

function getMessageValue(messages: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>((currentValue, segment) => {
    if (currentValue && typeof currentValue === 'object' && segment in currentValue) {
      return (currentValue as Record<string, unknown>)[segment];
    }

    return undefined;
  }, messages);
}

describe('daily knowledge source status messages', () => {
  const requiredKeys = ONLINE_DAILY_KNOWLEDGE_SOURCES.flatMap((source) =>
    DEGRADED_SOURCE_STATUS_REASONS.map((reason) => `dailyKnowledge.sourceStatus.${source}.${reason}`)
  );

  it.each([
    ['en', enMessages],
    ['zh', zhMessages],
  ])('contains degraded source status messages for %s', (_locale, messages) => {
    const missingKeys = requiredKeys.filter(
      (key) => getMessageValue(messages as Record<string, unknown>, key) === undefined
    );

    expect(missingKeys).toEqual([]);
  });

  it.each([
    ['en', enMessages],
    ['zh', zhMessages],
  ])('contains refresh and freshness copy for %s', (_locale, messages) => {
    const missingKeys = DAILY_KNOWLEDGE_UI_KEYS.filter(
      (key) => getMessageValue(messages as Record<string, unknown>, key) === undefined
    );

    expect(missingKeys).toEqual([]);
  });
});
