/**
 * @jest-environment jsdom
 */

import {
  buildFactSource,
  extractFirstImageUrl,
  isFreshEntry,
  matchesQueryText,
  parseRssFeedEntries,
  sanitizeIdFragment,
  stripHtmlToText,
} from '../feed-utils';

describe('daily-knowledge/feed-utils', () => {
  const originalDOMParser = globalThis.DOMParser;

  afterEach(() => {
    Object.defineProperty(globalThis, 'DOMParser', {
      configurable: true,
      writable: true,
      value: originalDOMParser,
    });
  });

  it('parses RSS items and falls back to link when guid is missing', () => {
    const entries = parseRssFeedEntries(`
      <rss>
        <channel>
          <item>
            <title>First light</title>
            <link>https://example.com/first</link>
            <description><![CDATA[<p>Bright nebula</p>]]></description>
            <pubDate>Fri, 13 Mar 2026 10:00:00 GMT</pubDate>
          </item>
          <item>
            <title>Second light</title>
            <link>https://example.com/second</link>
            <guid>entry-2</guid>
            <description>Plain text</description>
            <pubDate>Sat, 14 Mar 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `);

    expect(entries).toEqual([
      {
        title: 'First light',
        link: 'https://example.com/first',
        guid: 'https://example.com/first',
        description: '<p>Bright nebula</p>',
        pubDate: 'Fri, 13 Mar 2026 10:00:00 GMT',
      },
      {
        title: 'Second light',
        link: 'https://example.com/second',
        guid: 'entry-2',
        description: 'Plain text',
        pubDate: 'Sat, 14 Mar 2026 10:00:00 GMT',
      },
    ]);
  });

  it('returns an empty list when the RSS payload is invalid', () => {
    expect(parseRssFeedEntries('<rss><channel><item></channel></rss>')).toEqual([]);
  });

  it('normalizes HTML to plain text and can fall back without DOMParser', () => {
    expect(stripHtmlToText('<p>Hello <strong>nebula</strong></p>')).toBe('Hello nebula');
    expect(stripHtmlToText('')).toBe('');

    Object.defineProperty(globalThis, 'DOMParser', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(stripHtmlToText('<p>Hello <strong>fallback</strong></p>')).toBe('Hello fallback');
  });

  it('extracts the first image URL from DOM or regex fallback', () => {
    expect(extractFirstImageUrl('<div><img src="https://example.com/first.jpg" /></div>')).toBe(
      'https://example.com/first.jpg'
    );

    Object.defineProperty(globalThis, 'DOMParser', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(
      extractFirstImageUrl('<figure><img alt="test" src="https://example.com/fallback.png"></figure>')
    ).toBe('https://example.com/fallback.png');
    expect(extractFirstImageUrl('')).toBeUndefined();
  });

  it('sanitizes ids and matches query text using meaningful search terms', () => {
    expect(sanitizeIdFragment(' Messier 42 / Orion Nebula ')).toBe('messier-42-orion-nebula');
    expect(matchesQueryText('The Orion Nebula is bright tonight', 'nebula/orion')).toBe(true);
    expect(matchesQueryText('The Orion Nebula is bright tonight', 'sun/galaxy')).toBe(false);
    expect(matchesQueryText('The Orion Nebula is bright tonight', 'm, ng')).toBe(true);
  });

  it('evaluates freshness windows and tolerates invalid dates', () => {
    expect(isFreshEntry('2026-03-10T12:00:00Z', '2026-03-13', 7 * 24 * 60 * 60 * 1000)).toBe(true);
    expect(isFreshEntry('2026-02-20T12:00:00Z', '2026-03-13', 7 * 24 * 60 * 60 * 1000)).toBe(false);
    expect(isFreshEntry('not-a-date', '2026-03-13', 7 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it('builds fact source arrays only when all required fields exist', () => {
    expect(buildFactSource('JWST update', 'https://example.com/jwst', 'NASA')).toEqual([
      {
        title: 'JWST update',
        url: 'https://example.com/jwst',
        publisher: 'NASA',
      },
    ]);
    expect(buildFactSource('', 'https://example.com/jwst', 'NASA')).toEqual([]);
    expect(buildFactSource('JWST update', '', 'NASA')).toEqual([]);
    expect(buildFactSource('JWST update', 'https://example.com/jwst', '')).toEqual([]);
  });
});
