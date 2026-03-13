/**
 * @jest-environment node
 */

import { LOCATION_STORAGE_KEY } from '@/lib/constants/setup-wizard';
import {
  isValidLocation,
  loadStoredLocation,
  saveLocation,
} from '../observer-location';

type MockLocalStorage = Storage & {
  getItem: jest.Mock<string | null, [string]>;
  setItem: jest.Mock<void, [string, string]>;
  removeItem: jest.Mock<void, [string]>;
  clear: jest.Mock<void, []>;
  key: jest.Mock<string | null, [number]>;
};

const mockLocalStorage: MockLocalStorage = {
  getItem: jest.fn<string | null, [string]>(),
  setItem: jest.fn<void, [string, string]>(),
  removeItem: jest.fn<void, [string]>(),
  clear: jest.fn<void, []>(),
  key: jest.fn<string | null, [number]>(() => null),
  length: 0,
};

const originalWindow = global.window;
const originalLocalStorage = global.localStorage;
const browserWindow = { localStorage: mockLocalStorage } as unknown as Window & typeof globalThis;

function installBrowserStorage(windowValue: Window | undefined = browserWindow): void {
  Object.defineProperty(global, 'window', {
    configurable: true,
    writable: true,
    value: windowValue,
  });
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    writable: true,
    value: windowValue ? mockLocalStorage : undefined,
  });
}

describe('observer-location', () => {
  const validLocation = {
    latitude: 31.2304,
    longitude: 121.4737,
    altitude: 12,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    installBrowserStorage();
  });

  afterAll(() => {
    installBrowserStorage(originalWindow);
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      writable: true,
      value: originalLocalStorage,
    });
  });

  it('loads and parses a stored location', () => {
    mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(validLocation));

    expect(loadStoredLocation()).toEqual(validLocation);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCATION_STORAGE_KEY);
  });

  it('returns null when there is no stored location', () => {
    mockLocalStorage.getItem.mockReturnValueOnce(null);

    expect(loadStoredLocation()).toBeNull();
  });

  it('returns null when storage access throws or JSON is invalid', () => {
    mockLocalStorage.getItem.mockImplementationOnce(() => {
      throw new Error('storage unavailable');
    });
    expect(loadStoredLocation()).toBeNull();

    mockLocalStorage.getItem.mockReturnValueOnce('{invalid json');
    expect(loadStoredLocation()).toBeNull();
  });

  it('returns null when window is unavailable', () => {
    installBrowserStorage(undefined);

    try {
      expect(loadStoredLocation()).toBeNull();
    } finally {
      installBrowserStorage();
    }
  });

  it('saves a location to localStorage', () => {
    saveLocation(validLocation);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      LOCATION_STORAGE_KEY,
      JSON.stringify(validLocation)
    );
  });

  it('silently ignores save errors and missing window', () => {
    mockLocalStorage.setItem.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    expect(() => saveLocation(validLocation)).not.toThrow();

    installBrowserStorage(undefined);

    try {
      expect(() => saveLocation(validLocation)).not.toThrow();
    } finally {
      installBrowserStorage();
    }
  });

  it('accepts valid coordinate ranges', () => {
    expect(isValidLocation(validLocation)).toBe(true);
    expect(isValidLocation({ latitude: -90, longitude: -180, altitude: 0 })).toBe(true);
    expect(isValidLocation({ latitude: 90, longitude: 180, altitude: 0 })).toBe(true);
  });

  it('rejects null, non-finite, and out-of-range coordinates', () => {
    expect(isValidLocation(null)).toBe(false);
    expect(isValidLocation({ latitude: Number.NaN, longitude: 120, altitude: 0 })).toBe(false);
    expect(isValidLocation({ latitude: 30, longitude: Number.POSITIVE_INFINITY, altitude: 0 })).toBe(
      false
    );
    expect(isValidLocation({ latitude: -91, longitude: 120, altitude: 0 })).toBe(false);
    expect(isValidLocation({ latitude: 30, longitude: 181, altitude: 0 })).toBe(false);
  });
});
