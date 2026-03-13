/**
 * @jest-environment node
 */

import {
  extractJNameCoordinates,
  parseCoordinateQuery,
  parseCoordinateScalar,
  parseDecCoordinate,
  parseRACoordinate,
} from '../coordinate-parser';

describe('parseRACoordinate', () => {
  it('parses decimal and sexagesimal right ascension', () => {
    expect(parseRACoordinate('10.6847')).toBeCloseTo(10.6847, 4);
    expect(parseRACoordinate('00:42:44')).toBeCloseTo(10.6833, 3);
    expect(parseRACoordinate('00h42m44s')).toBeCloseTo(10.6833, 3);
  });

  it('rejects values outside the supported range', () => {
    expect(parseRACoordinate('-1')).toBeNull();
    expect(parseRACoordinate('24:00:00')).toBeNull();
    expect(parseRACoordinate('12:60:00')).toBeNull();
  });
});

describe('parseDecCoordinate', () => {
  it('parses decimal and sexagesimal declination', () => {
    expect(parseDecCoordinate('+41.2689')).toBeCloseTo(41.2689, 4);
    expect(parseDecCoordinate('+41:16:09')).toBeCloseTo(41.2691, 3);
    expect(parseDecCoordinate(`-07°37'40"`)).toBeCloseTo(-7.6278, 3);
  });

  it('rejects declinations outside the pole range', () => {
    expect(parseDecCoordinate('+91')).toBeNull();
    expect(parseDecCoordinate('-90:00:60')).toBeNull();
  });
});

describe('parseCoordinateScalar', () => {
  it('accepts explicit decimals as-is and falls back to sexagesimal parsing', () => {
    expect(parseCoordinateScalar('361')).toBe(361);
    expect(parseCoordinateScalar('00:42:44')).toBeCloseTo(10.6833, 3);
    expect(parseCoordinateScalar('-07:37:40')).toBeCloseTo(-7.6278, 3);
  });

  it('returns null for empty or invalid scalar input', () => {
    expect(parseCoordinateScalar('   ')).toBeNull();
    expect(parseCoordinateScalar('not-a-coordinate')).toBeNull();
  });
});

describe('extractJNameCoordinates', () => {
  it('extracts coordinates from J-names with fractional seconds', () => {
    const parsed = extractJNameCoordinates('2MASS J06495091-0737408');
    expect(parsed?.ra).toBeCloseTo(102.4621, 3);
    expect(parsed?.dec).toBeCloseTo(-7.628, 3);
  });

  it('returns null when a J-name encodes impossible coordinates', () => {
    expect(extractJNameCoordinates('J246060+910000')).toBeNull();
  });
});

describe('parseCoordinateQuery', () => {
  it('parses comma-separated and whitespace-separated coordinate pairs', () => {
    expect(parseCoordinateQuery('10.6847, +41.2689')).toEqual({
      ra: 10.6847,
      dec: 41.2689,
      format: 'decimal',
    });

    const sexagesimal = parseCoordinateQuery('00:42:44 +41:16:09');
    expect(sexagesimal?.format).toBe('sexagesimal');
    expect(sexagesimal?.ra).toBeCloseTo(10.6833, 3);
    expect(sexagesimal?.dec).toBeCloseTo(41.2691, 3);
  });

  it('prefers J-name extraction when the input contains catalog-style coordinates', () => {
    const parsed = parseCoordinateQuery('2MASS J06495091-0737408');
    expect(parsed).toEqual({
      ra: expect.any(Number),
      dec: expect.any(Number),
      format: 'jname',
    });
  });

  it('returns null when it cannot split a coordinate pair', () => {
    expect(parseCoordinateQuery('M31')).toBeNull();
    expect(parseCoordinateQuery('10.6847 only')).toBeNull();
  });
});
