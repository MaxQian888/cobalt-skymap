/**
 * @jest-environment jsdom
 */

import { fetchDailyKnowledgeRegistryItems } from '../source-registry';
import type { DailyKnowledgeItem, DailyKnowledgeSourceAdapter } from '../types';

function makeItem(
  id: string,
  source: DailyKnowledgeItem['source']
): DailyKnowledgeItem {
  return {
    id,
    dateKey: '2026-03-13',
    source,
    title: id,
    summary: 'summary',
    body: 'body',
    contentLanguage: 'en',
    categories: ['culture'],
    tags: [],
    relatedObjects: [],
    attribution: { sourceName: 'test', sourceUrl: 'https://example.com' },
    isDateEvent: false,
    factSources: [{ title: 'test', url: 'https://example.com', publisher: 'test' }],
    difficulty: 'intermediate',
    bestViewingMonths: [1, 2, 3],
    observationTips: ['tip'],
    languageStatus: 'native',
    fetchedAt: 1,
  };
}

describe('daily-knowledge/source-registry', () => {
  it('collects items and source statuses from adapters', async () => {
    const adapters: DailyKnowledgeSourceAdapter[] = [
      {
        source: 'nasa-image-library',
        transport: 'api',
        supportsLocales: ['en', 'zh'],
        cachePolicyId: 'daily-knowledge-nasa-library',
        freshnessWindowMs: 1000,
        fetchItems: jest.fn().mockResolvedValue([makeItem('item-a', 'nasa-image-library')]),
      },
      {
        source: 'esa-science',
        transport: 'rss',
        supportsLocales: ['en', 'zh'],
        cachePolicyId: 'daily-knowledge-esa-science',
        freshnessWindowMs: 1000,
        fetchItems: jest.fn().mockResolvedValue([]),
      },
    ];

    const result = await fetchDailyKnowledgeRegistryItems(
      {
        dateKey: '2026-03-13',
        locale: 'en',
        query: 'Andromeda',
        anchorItem: makeItem('anchor', 'curated'),
      },
      adapters
    );

    expect(result.items).toHaveLength(1);
    expect(result.sourceStatuses).toEqual([
      expect.objectContaining({ source: 'nasa-image-library', state: 'healthy', itemCount: 1 }),
      expect.objectContaining({ source: 'esa-science', state: 'degraded', itemCount: 0, reason: 'empty' }),
    ]);
  });

  it('marks adapter failures without breaking the whole request', async () => {
    const adapters: DailyKnowledgeSourceAdapter[] = [
      {
        source: 'nasa-photojournal',
        transport: 'rss',
        supportsLocales: ['en', 'zh'],
        cachePolicyId: 'daily-knowledge-nasa-photojournal',
        freshnessWindowMs: 1000,
        fetchItems: jest.fn().mockRejectedValue(new Error('boom')),
      },
    ];

    const result = await fetchDailyKnowledgeRegistryItems(
      {
        dateKey: '2026-03-13',
        locale: 'en',
        query: 'Andromeda',
        anchorItem: makeItem('anchor', 'curated'),
      },
      adapters
    );

    expect(result.items).toEqual([]);
    expect(result.sourceStatuses).toEqual([
      expect.objectContaining({ source: 'nasa-photojournal', state: 'failed', itemCount: 0, reason: 'error' }),
    ]);
  });
});
