import type { DailyKnowledgeFactSource } from './types';

export interface ParsedFeedEntry {
  title: string;
  link: string;
  guid: string;
  description: string;
  pubDate: string;
}

function parseHtml(html: string, type: DOMParserSupportedType): Document | null {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(html, type);
  }
  return null;
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNodeText(parent: Element, selector: string): string {
  const node = parent.querySelector(selector);
  return node?.textContent?.trim() ?? '';
}

export function parseRssFeedEntries(xmlText: string): ParsedFeedEntry[] {
  const xml = parseHtml(xmlText, 'application/xml');
  if (!xml) return [];
  if (xml.querySelector('parsererror')) return [];

  return Array.from(xml.querySelectorAll('item')).map((item) => ({
    title: getNodeText(item, 'title'),
    link: getNodeText(item, 'link'),
    guid: getNodeText(item, 'guid') || getNodeText(item, 'link'),
    description: getNodeText(item, 'description'),
    pubDate: getNodeText(item, 'pubDate'),
  }));
}

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  const doc = parseHtml(html, 'text/html');
  if (doc?.body?.textContent) {
    return doc.body.textContent.replace(/\s+/g, ' ').trim();
  }
  return stripTags(html);
}

export function extractFirstImageUrl(html: string): string | undefined {
  if (!html) return undefined;
  const doc = parseHtml(html, 'text/html');
  const domSrc = doc?.querySelector('img')?.getAttribute('src')?.trim();
  if (domSrc) return domSrc;
  const regexMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return regexMatch?.[1];
}

export function sanitizeIdFragment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function matchesQueryText(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/[\s,/]+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3);

  if (terms.length === 0) return true;
  return terms.some((term) => haystack.includes(term));
}

export function isFreshEntry(
  pubDate: string,
  referenceDateKey: string,
  freshnessWindowMs: number
): boolean {
  const publishedAt = Date.parse(pubDate);
  const referenceAt = Date.parse(`${referenceDateKey}T23:59:59Z`);
  if (!Number.isFinite(publishedAt) || !Number.isFinite(referenceAt)) return true;
  return publishedAt >= referenceAt - freshnessWindowMs;
}

export function buildFactSource(
  title: string,
  url: string,
  publisher: string
): DailyKnowledgeFactSource[] {
  if (!title || !url || !publisher) return [];
  return [{ title, url, publisher }];
}
