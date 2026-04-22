/**
 * @jest-environment jsdom
 */
import {
  DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS,
  buildAstroCalculatorObserverContext,
} from '../observer-context';

jest.mock('@/lib/astronomy/engine', () => ({
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

const mockResolveTimezoneFromCoordinates = jest.fn((_args: unknown) => 'Etc/UTC');

jest.mock('@/lib/utils/observer-timezone', () => ({
  resolveTimezoneFromCoordinates: (args: unknown) => mockResolveTimezoneFromCoordinates(args),
}));

describe('buildAstroCalculatorObserverContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers saved observing site data and merges shared constraints', () => {
    const context = buildAstroCalculatorObserverContext({
      currentLocation: {
        id: 'site-1',
        name: 'Mountain Base',
        latitude: 35.1234,
        longitude: 117.9876,
        altitude: 1250,
        timezone: 'America/Los_Angeles',
      },
      profileInfo: {
        AstrometrySettings: {
          Latitude: 40,
          Longitude: -74,
          Elevation: 20,
        },
      },
      sharedDate: '2025-01-01',
      sharedTime: '22:00',
      constraints: {
        minAltitude: 15,
        moonInterference: 'moderate',
      },
    });

    expect(context).toEqual(expect.objectContaining({
      locationId: 'site-1',
      locationName: 'Mountain Base',
      latitude: 35.1234,
      longitude: 117.9876,
      elevation: 1250,
      timezone: 'America/Los_Angeles',
      sharedDate: '2025-01-01',
      sharedTime: '22:00',
      source: 'saved-location',
      constraints: {
        minAltitude: 15,
        moonInterference: 'moderate',
        horizonProfileId: null,
      },
    }));
    expect(mockResolveTimezoneFromCoordinates).not.toHaveBeenCalled();
  });

  it('falls back to mount profile coordinates and resolver timezone when no saved site exists', () => {
    const context = buildAstroCalculatorObserverContext({
      profileInfo: {
        AstrometrySettings: {
          Latitude: 51.5,
          Longitude: -0.12,
          Elevation: 45,
        },
      },
      sharedDate: '2025-03-20',
      sharedTime: '20:30',
    });

    expect(mockResolveTimezoneFromCoordinates).toHaveBeenCalledWith({
      latitude: 51.5,
      longitude: -0.12,
    });
    expect(context).toEqual(expect.objectContaining({
      locationId: undefined,
      locationName: 'Current site',
      latitude: 51.5,
      longitude: -0.12,
      elevation: 45,
      timezone: 'Etc/UTC',
      source: 'profile',
      constraints: DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS,
    }));
  });

  it('changes contextKey when shared context or constraints change', () => {
    const baseContext = buildAstroCalculatorObserverContext({
      sharedDate: '2025-03-20',
      sharedTime: '20:30',
      constraints: { minAltitude: 10 },
    });
    const changedDate = buildAstroCalculatorObserverContext({
      sharedDate: '2025-03-21',
      sharedTime: '20:30',
      constraints: { minAltitude: 10 },
    });
    const changedConstraint = buildAstroCalculatorObserverContext({
      sharedDate: '2025-03-20',
      sharedTime: '20:30',
      constraints: { minAltitude: 25 },
    });

    expect(baseContext.contextKey).not.toBe(changedDate.contextKey);
    expect(baseContext.contextKey).not.toBe(changedConstraint.contextKey);
  });
});
