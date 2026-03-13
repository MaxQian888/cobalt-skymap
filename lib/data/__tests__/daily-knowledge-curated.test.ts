import { DAILY_KNOWLEDGE_CURATED } from '../daily-knowledge-curated';
import {
  DAILY_KNOWLEDGE_DIFFICULTY_LEVELS,
  DAILY_KNOWLEDGE_MIN_EVENT_MONTH_COVERAGE,
} from '@/lib/services/daily-knowledge/constants';

const DAILY_KNOWLEDGE_VALID_CATEGORIES = [
  'object',
  'event',
  'history',
  'mission',
  'technique',
  'culture',
] as const;

describe('daily-knowledge curated dataset', () => {
  it('contains around 30 entries', () => {
    expect(DAILY_KNOWLEDGE_CURATED.length).toBeGreaterThanOrEqual(30);
  });

  it('uses unique kebab-case IDs', () => {
    const ids = DAILY_KNOWLEDGE_CURATED.map((entry) => entry.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('has complete bilingual content', () => {
    for (const entry of DAILY_KNOWLEDGE_CURATED) {
      expect(entry.localeContent.en.title.trim().length).toBeGreaterThan(0);
      expect(entry.localeContent.en.summary.trim().length).toBeGreaterThan(0);
      expect(entry.localeContent.en.body.trim().length).toBeGreaterThan(0);
      expect(entry.localeContent.zh.title.trim().length).toBeGreaterThan(0);
      expect(entry.localeContent.zh.summary.trim().length).toBeGreaterThan(0);
      expect(entry.localeContent.zh.body.trim().length).toBeGreaterThan(0);

      expect(DAILY_KNOWLEDGE_DIFFICULTY_LEVELS).toContain(entry.difficulty);
      expect(entry.bestViewingMonths.length).toBeGreaterThan(0);
      for (const month of entry.bestViewingMonths) {
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
      }

      expect(entry.observationTips.en.length).toBeGreaterThan(0);
      expect(entry.observationTips.zh.length).toBeGreaterThan(0);
      expect(entry.observationTips.en.length).toBe(entry.observationTips.zh.length);
      for (const tip of entry.observationTips.en) {
        expect(tip.trim().length).toBeGreaterThan(0);
      }
      for (const tip of entry.observationTips.zh) {
        expect(tip.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps categories, tags, related objects, and coordinates production-safe', () => {
    for (const entry of DAILY_KNOWLEDGE_CURATED) {
      expect(entry.categories.length).toBeGreaterThan(0);
      for (const category of entry.categories) {
        expect(DAILY_KNOWLEDGE_VALID_CATEGORIES).toContain(category);
      }

      expect(entry.tags.length).toBeGreaterThan(0);
      for (const tag of entry.tags) {
        expect(tag.trim().length).toBeGreaterThan(0);
      }

      expect(entry.relatedObjects.length).toBeGreaterThan(0);
      for (const object of entry.relatedObjects) {
        expect(object.name.trim().length).toBeGreaterThan(0);

        const hasRa = typeof object.ra === 'number';
        const hasDec = typeof object.dec === 'number';
        expect(hasRa).toBe(hasDec);

        if (hasRa && hasDec) {
          expect(object.ra).toBeGreaterThanOrEqual(0);
          expect(object.ra).toBeLessThanOrEqual(360);
          expect(object.dec).toBeGreaterThanOrEqual(-90);
          expect(object.dec).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('has at least one https fact source for each entry', () => {
    for (const entry of DAILY_KNOWLEDGE_CURATED) {
      expect(entry.factSources.length).toBeGreaterThan(0);
      for (const source of entry.factSources) {
        expect(source.title.trim().length).toBeGreaterThan(0);
        expect(source.publisher.trim().length).toBeGreaterThan(0);
        expect(source.url.startsWith('https://')).toBe(true);
      }
    }
  });

  it('uses valid month-day format for date-event entries', () => {
    const coveredMonths = new Set<number>();
    let datedEntryCount = 0;
    for (const entry of DAILY_KNOWLEDGE_CURATED) {
      if (!entry.eventMonthDay) continue;
      datedEntryCount += 1;
      expect(entry.eventMonthDay).toMatch(/^\d{2}-\d{2}$/);

      const month = Number(entry.eventMonthDay.slice(0, 2));
      const day = Number(entry.eventMonthDay.slice(3, 5));

      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);

      coveredMonths.add(month);
    }
    expect(datedEntryCount).toBeGreaterThanOrEqual(10);
    expect(coveredMonths.size).toBeGreaterThanOrEqual(DAILY_KNOWLEDGE_MIN_EVENT_MONTH_COVERAGE);
  });

  it('keeps optional media and external URLs well-formed', () => {
    for (const entry of DAILY_KNOWLEDGE_CURATED) {
      if (entry.externalUrl) {
        expect(entry.externalUrl.startsWith('https://')).toBe(true);
      }

      if (entry.imageUrl) {
        expect(entry.imageUrl.startsWith('https://')).toBe(true);
        expect(entry.attribution.sourceUrl).toBeTruthy();
        expect(entry.attribution.licenseName).toBeTruthy();
      } else {
        expect(entry.thumbnailUrl).toBeUndefined();
        expect(entry.imageType).toBeUndefined();
      }

      if (entry.thumbnailUrl) {
        expect(entry.thumbnailUrl.startsWith('https://')).toBe(true);
      }

      if (entry.attribution.sourceUrl) {
        expect(entry.attribution.sourceUrl.startsWith('https://')).toBe(true);
      }

      if (entry.attribution.licenseUrl) {
        expect(entry.attribution.licenseUrl.startsWith('https://')).toBe(true);
      }

      if (entry.imageType) {
        expect(entry.imageType).toMatch(/^(image|video)$/);
      }
    }
  });
});
