/**
 * @jest-environment node
 */

import * as parser from '../index';
import {
  buildCanonicalId,
  normalizeWhitespace,
  parseCatalogIdentifier,
  parseCoordinateQuery,
  parseMinorIdentifier,
  parseQuery,
} from '../index';

describe('parser index exports', () => {
  it('re-exports the main parser entry points', () => {
    expect(parser.parseCatalogIdentifier).toBe(parseCatalogIdentifier);
    expect(parser.parseCoordinateQuery).toBe(parseCoordinateQuery);
    expect(parser.parseMinorIdentifier).toBe(parseMinorIdentifier);
    expect(parser.parseQuery).toBe(parseQuery);
    expect(parser.normalizeWhitespace).toBe(normalizeWhitespace);
    expect(parser.buildCanonicalId).toBe(buildCanonicalId);
  });

  it('lets callers combine low-level helpers from a single import surface', () => {
    const normalized = parser.normalizeWhitespace('  ngc   7000  ');
    const catalog = parser.parseCatalogIdentifier(normalized);
    const coordinate = parser.parseCoordinateQuery('00:42:44 +41:16:09');
    const query = parser.parseQuery('2007 TA418');

    expect(catalog?.normalized).toBe('NGC7000');
    expect(coordinate?.format).toBe('sexagesimal');
    expect(query.kind).toBe('minor');
  });
});
