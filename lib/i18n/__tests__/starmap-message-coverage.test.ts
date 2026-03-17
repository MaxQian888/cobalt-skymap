import fs from 'fs';
import path from 'path';

import enMessages from '@/i18n/messages/en.json';
import zhMessages from '@/i18n/messages/zh.json';

const COMPONENT_PATHS = [
  path.join(process.cwd(), 'components/common/log-panel.tsx'),
  path.join(process.cwd(), 'components/common/log-viewer.tsx'),
  path.join(process.cwd(), 'components/starmap/management/location-manager.tsx'),
  path.join(process.cwd(), 'components/starmap/map/map-provider-settings.tsx'),
];

const TRANSLATION_HOOK_PATTERN = /\bconst\s+(\w+)\s*=\s*useTranslations(?:\('([^']+)'\))?/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTranslationKeys(filePath: string): string[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const translators = [...source.matchAll(TRANSLATION_HOOK_PATTERN)].map((match) => ({
    variableName: match[1],
    namespace: match[2],
  }));

  return translators.flatMap(({ variableName, namespace }) => {
    const translationCallPattern = new RegExp(`\\b${escapeRegExp(variableName)}\\('([^']+)'`, 'g');

    return [...source.matchAll(translationCallPattern)].map((match) =>
      namespace ? `${namespace}.${match[1]}` : match[1]
    );
  });
}

function getMessageValue(messages: Record<string, unknown>, dottedKey: string): unknown {
  return dottedKey.split('.').reduce<unknown>((currentValue, segment) => {
    if (currentValue && typeof currentValue === 'object' && segment in currentValue) {
      return (currentValue as Record<string, unknown>)[segment];
    }

    return undefined;
  }, messages);
}

describe('starmap locale messages', () => {
  const requiredKeys = [...new Set(COMPONENT_PATHS.flatMap(extractTranslationKeys))];

  it.each([
    ['en', enMessages],
    ['zh', zhMessages],
  ])('contains all message keys used by covered components for %s', (_locale, messages) => {
    const missingKeys = requiredKeys.filter((key) => getMessageValue(messages as Record<string, unknown>, key) === undefined);

    expect(missingKeys).toEqual([]);
  });
});
