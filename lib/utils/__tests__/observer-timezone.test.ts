/**
 * @jest-environment jsdom
 */

import {
  guessTimezoneFromLongitude,
  isValidTimezone,
  resolveTimezoneFromCoordinates,
} from '../observer-timezone';

const mockTzLookup = jest.fn();

jest.mock('tz-lookup', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockTzLookup(...args),
}));

describe('observer-timezone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts valid IANA timezones', () => {
    expect(isValidTimezone('Asia/Shanghai')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Mars/OlympusMons')).toBe(false);
  });

  it('resolves explicit timezone before coordinate lookup', () => {
    const timezone = resolveTimezoneFromCoordinates(
      { latitude: 31.2304, longitude: 121.4737 },
      {
        explicitTimezone: 'Asia/Shanghai',
        systemTimezone: 'Etc/UTC',
      }
    );

    expect(timezone).toBe('Asia/Shanghai');
    expect(mockTzLookup).not.toHaveBeenCalled();
  });

  it('uses tz-lookup result when coordinates are valid', () => {
    mockTzLookup.mockReturnValue('America/New_York');

    const timezone = resolveTimezoneFromCoordinates(
      { latitude: 40.7128, longitude: -74.006 },
      {
        systemTimezone: 'Etc/UTC',
      }
    );

    expect(mockTzLookup).toHaveBeenCalledWith(40.7128, -74.006);
    expect(timezone).toBe('America/New_York');
  });

  it('falls back to longitude approximation when coordinate lookup fails', () => {
    mockTzLookup.mockImplementation(() => {
      throw new Error('lookup failed');
    });

    const timezone = resolveTimezoneFromCoordinates(
      { latitude: 0, longitude: 120 },
      {
        systemTimezone: 'Etc/UTC',
      }
    );

    expect(timezone).toBe('Etc/GMT-8');
  });

  it('falls back to provided system timezone when lookup and longitude guess are unavailable', () => {
    mockTzLookup.mockImplementation(() => {
      throw new Error('lookup failed');
    });

    const timezone = resolveTimezoneFromCoordinates(
      { latitude: Number.NaN, longitude: Number.NaN },
      {
        systemTimezone: 'Europe/London',
      }
    );

    expect(timezone).toBe('Europe/London');
  });

  it('returns null for invalid longitude guesses', () => {
    expect(guessTimezoneFromLongitude(Number.NaN)).toBeNull();
    expect(guessTimezoneFromLongitude(999)).toBeNull();
  });
});
