/**
 * @jest-environment jsdom
 */

import { LocationDraftMetadataResolver } from '../location-draft-metadata';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('LocationDraftMetadataResolver', () => {
  it('resolves reverse geocode, timezone, and elevation metadata', async () => {
    const reverseGeocode = jest.fn().mockResolvedValue({
      displayName: 'New York, NY, USA',
      address: 'New York, NY, USA',
    });
    const resolveTimezone = jest.fn().mockReturnValue('America/New_York');
    const fetchElevation = jest.fn().mockResolvedValue(12);

    const resolver = new LocationDraftMetadataResolver({
      reverseGeocode,
      resolveTimezone,
      fetchElevation,
    });

    const result = await resolver.resolve({
      coordinates: { latitude: 40.7128, longitude: -74.006 },
      source: 'search',
    });

    expect(result.stale).toBe(false);
    expect(result.summaryStatus).toBe('ready');
    expect(result.fields.name).toEqual({
      status: 'ready',
      source: 'derived',
      value: 'New York, NY, USA',
    });
    expect(result.fields.timezone).toEqual({
      status: 'ready',
      source: 'derived',
      value: 'America/New_York',
    });
    expect(result.fields.elevation).toEqual({
      status: 'ready',
      source: 'derived',
      value: 12,
    });
  });

  it('returns partial status when only some metadata sources succeed', async () => {
    const resolver = new LocationDraftMetadataResolver({
      reverseGeocode: jest.fn().mockRejectedValue(new Error('reverse failed')),
      resolveTimezone: jest.fn().mockReturnValue('Asia/Shanghai'),
      fetchElevation: jest.fn().mockResolvedValue(null),
    });

    const result = await resolver.resolve({
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
      source: 'map-click',
    });

    expect(result.stale).toBe(false);
    expect(result.summaryStatus).toBe('partial');
    expect(result.fields.name.status).toBe('error');
    expect(result.fields.timezone).toEqual({
      status: 'ready',
      source: 'derived',
      value: 'Asia/Shanghai',
    });
    expect(result.fields.elevation.status).toBe('error');
    expect(result.issues).toEqual([
      expect.objectContaining({ field: 'name', reason: 'reverse_geocode_failed' }),
      expect.objectContaining({ field: 'elevation', reason: 'elevation_unavailable' }),
    ]);
  });

  it('marks outdated responses as stale when a newer request finishes first', async () => {
    const firstReverse = createDeferred<{ displayName: string; address: string }>();
    const secondReverse = createDeferred<{ displayName: string; address: string }>();

    const reverseGeocode = jest
      .fn()
      .mockReturnValueOnce(firstReverse.promise)
      .mockReturnValueOnce(secondReverse.promise);

    const resolver = new LocationDraftMetadataResolver({
      reverseGeocode,
      resolveTimezone: jest.fn().mockReturnValue('Etc/UTC'),
      fetchElevation: jest.fn().mockResolvedValue(20),
    });

    const firstPromise = resolver.resolve({
      coordinates: { latitude: 10, longitude: 20 },
      source: 'map-click',
    });
    const secondPromise = resolver.resolve({
      coordinates: { latitude: 30, longitude: 40 },
      source: 'map-click',
    });

    secondReverse.resolve({
      displayName: 'Second Draft',
      address: 'Second Draft',
    });
    const secondResult = await secondPromise;

    firstReverse.resolve({
      displayName: 'First Draft',
      address: 'First Draft',
    });
    const firstResult = await firstPromise;

    expect(secondResult.stale).toBe(false);
    expect(secondResult.fields.name.value).toBe('Second Draft');
    expect(firstResult.stale).toBe(true);
    expect(firstResult.summaryStatus).toBe('stale');
  });
});
