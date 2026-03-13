/**
 * @jest-environment node
 */

import { parseQuery } from '../parse-query';

describe('parseQuery', () => {
  it('classifies coordinate queries and emits a stable coordinate canonical id', () => {
    const result = parseQuery('00:42:44 +41:16:09');

    expect(result.kind).toBe('coordinate');
    expect(result.explicitMinor).toBe(false);
    expect(result.coordinate).toEqual({
      ra: expect.any(Number),
      dec: expect.any(Number),
      format: 'sexagesimal',
    });
    expect(result.canonicalId).toBe('COORD:10.6833333,41.2691667');
  });

  it('classifies explicit minor-body identifiers before catalog parsing', () => {
    const result = parseQuery('2007 TA418');

    expect(result.kind).toBe('minor');
    expect(result.explicitMinor).toBe(true);
    expect(result.minor?.kind).toBe('provisional');
    expect(result.canonicalId).toBe('2007 TA418');
  });

  it('preserves catalog parsing and attaches derived coordinates when available', () => {
    const result = parseQuery('2MASS 06495091-0737408');

    expect(result.kind).toBe('catalog');
    expect(result.catalog?.catalog).toBe('2MASS');
    expect(result.coordinate?.format).toBe('jname');
    expect(result.canonicalId).toBe('2MASS J06495091-0737408');
  });

  it('prioritizes direct coordinate parsing ahead of catalog classification', () => {
    const result = parseQuery('2MASS J06495091-0737408');

    expect(result.kind).toBe('coordinate');
    expect(result.coordinate?.format).toBe('jname');
    expect(result.canonicalId).toBe('COORD:102.4621250,-7.6280000');
  });

  it('falls back to canonicalized free-text names', () => {
    const result = parseQuery('  Andromeda   Galaxy  ');

    expect(result.kind).toBe('name');
    expect(result.normalizedInput).toBe('Andromeda Galaxy');
    expect(result.canonicalId).toBe('ANDROMEDA GALAXY');
    expect(result.explicitMinor).toBe(false);
  });
});
