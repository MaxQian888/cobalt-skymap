/**
 * @jest-environment node
 */

import {
  AstronomyEngineValidationError,
  buildNormalizedContext,
  normalizeAlmanacRequest,
  normalizeCoordinateComputationInput,
  normalizeEphemerisRequest,
  normalizePhenomenaRequest,
  normalizeRiseTransitSetRequest,
} from '../normalization';

describe('AstronomyEngineValidationError', () => {
  it('formats messages differently for single and multiple issues', () => {
    const single = new AstronomyEngineValidationError([
      {
        code: 'invalid_date',
        field: 'date',
        message: 'date must be a valid Date',
      },
    ]);
    const multiple = new AstronomyEngineValidationError([
      {
        code: 'invalid_date',
        field: 'date',
        message: 'date must be a valid Date',
      },
      {
        code: 'invalid_ra',
        field: 'coordinate.ra',
        message: 'coordinate.ra must be a finite number',
      },
    ]);

    expect(single.message).toBe('date must be a valid Date');
    expect(multiple.message).toBe('Astronomy input validation failed with 2 issues');
  });
});

describe('normalizeCoordinateComputationInput', () => {
  it('normalizes coordinates, observer values and time precision', () => {
    const result = normalizeCoordinateComputationInput({
      coordinate: { ra: -0.1234567, dec: -45.9876543 },
      observer: {
        latitude: 39.1234567,
        longitude: 181.2345678,
        elevation: 12.3456,
      },
      date: new Date('2026-03-01T10:20:30.999Z'),
      refraction: 'none',
    });

    expect(result.coordinate).toEqual({
      ra: 359.876543,
      dec: -45.987654,
    });
    expect(result.observer).toEqual({
      latitude: 39.123457,
      longitude: -178.765432,
      elevation: 12.35,
    });
    expect(result.date.toISOString()).toBe('2026-03-01T10:20:30.000Z');
  });

  it('throws aggregated validation issues for invalid inputs', () => {
    expect(() =>
      normalizeCoordinateComputationInput({
        coordinate: { ra: Number.POSITIVE_INFINITY, dec: 91 },
        observer: {
          latitude: 91,
          longitude: Number.NaN,
          elevation: Number.NaN,
        },
        date: new Date('invalid'),
      }),
    ).toThrow(AstronomyEngineValidationError);

    try {
      normalizeCoordinateComputationInput({
        coordinate: { ra: Number.POSITIVE_INFINITY, dec: 91 },
        observer: {
          latitude: 91,
          longitude: Number.NaN,
          elevation: Number.NaN,
        },
        date: new Date('invalid'),
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AstronomyEngineValidationError);
      const issues = (error as AstronomyEngineValidationError).issues.map((issue) => issue.code);
      expect(issues).toEqual(expect.arrayContaining([
        'invalid_date',
        'invalid_latitude',
        'invalid_longitude',
        'invalid_elevation',
        'invalid_ra',
        'invalid_dec',
      ]));
    }
  });
});

describe('normalizeEphemerisRequest', () => {
  it('normalizes observer and custom coordinate values', () => {
    const result = normalizeEphemerisRequest({
      body: 'Custom',
      observer: { latitude: -20.1234567, longitude: 190.5, elevation: 100.987 },
      startDate: new Date('2026-03-02T00:00:00.777Z'),
      stepHours: 1.5,
      steps: 3,
      customCoordinate: { ra: 721.5, dec: 10.9876543 },
    });

    expect(result.startDate.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(result.observer).toEqual({
      latitude: -20.123457,
      longitude: -169.5,
      elevation: 100.99,
    });
    expect(result.customCoordinate).toEqual({
      ra: 1.5,
      dec: 10.987654,
    });
  });

  it('rejects invalid steps and step hours', () => {
    expect(() =>
      normalizeEphemerisRequest({
        body: 'Mars',
        observer: { latitude: 40, longitude: -70 },
        startDate: new Date('2026-03-02T00:00:00Z'),
        stepHours: 0,
        steps: 1.5,
      }),
    ).toThrow(AstronomyEngineValidationError);
  });
});

describe('normalizeRiseTransitSetRequest', () => {
  it('rounds minAltitude and custom coordinates', () => {
    const result = normalizeRiseTransitSetRequest({
      body: 'Custom',
      observer: { latitude: 35.5, longitude: 120.1234567 },
      date: new Date('2026-03-03T06:07:08.999Z'),
      minAltitude: 12.3456789,
      customCoordinate: { ra: -15, dec: 22.9876543 },
    });

    expect(result.date.toISOString()).toBe('2026-03-03T06:07:08.000Z');
    expect(result.minAltitude).toBe(12.345679);
    expect(result.customCoordinate).toEqual({
      ra: 345,
      dec: 22.987654,
    });
  });

  it('rejects out-of-range minAltitude', () => {
    expect(() =>
      normalizeRiseTransitSetRequest({
        body: 'Sun',
        observer: { latitude: 35.5, longitude: 120.1 },
        date: new Date('2026-03-03T06:07:08.000Z'),
        minAltitude: 120,
      }),
    ).toThrow(AstronomyEngineValidationError);
  });
});

describe('normalizePhenomenaRequest', () => {
  it('rejects reversed date ranges', () => {
    expect(() =>
      normalizePhenomenaRequest({
        startDate: new Date('2026-03-10T00:00:00Z'),
        endDate: new Date('2026-03-09T00:00:00Z'),
        observer: { latitude: 40, longitude: -75 },
      }),
    ).toThrow(AstronomyEngineValidationError);
  });
});

describe('normalizeAlmanacRequest', () => {
  it('defaults elevation and truncates the request date', () => {
    const result = normalizeAlmanacRequest({
      observer: { latitude: 51.5, longitude: -0.1 },
      date: new Date('2026-03-04T01:02:03.456Z'),
      refraction: 'normal',
    });

    expect(result.observer).toEqual({
      latitude: 51.5,
      longitude: -0.1,
      elevation: 0,
    });
    expect(result.date.toISOString()).toBe('2026-03-04T01:02:03.000Z');
  });
});

describe('buildNormalizedContext', () => {
  it('creates stable keys for point-in-time requests', () => {
    const context = buildNormalizedContext(
      { latitude: 39.9, longitude: 116.4, elevation: 50 },
      new Date('2026-03-05T08:09:10.999Z'),
      'coordinates:42',
    );

    expect(context).toEqual({
      observerKey: '39.9000|116.4000|50.0',
      timeWindowKey: '2026-03-05T08',
      requestKey: 'coordinates:42',
    });
  });

  it('creates day buckets for ranged requests', () => {
    const context = buildNormalizedContext(
      { latitude: 39.9, longitude: 116.4, elevation: 50 },
      {
        startDate: new Date('2026-03-05T08:09:10.999Z'),
        endDate: new Date('2026-03-07T12:30:00.001Z'),
      },
      'phenomena:false',
    );

    expect(context.timeWindowKey).toBe('2026-03-05..2026-03-07');
  });
});
