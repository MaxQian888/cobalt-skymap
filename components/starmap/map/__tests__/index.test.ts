/**
 * @jest-environment jsdom
 */

jest.mock('../location-search', () => ({
  LocationSearch: 'LocationSearch',
}));

jest.mock('../map-location-picker', () => ({
  MapLocationPicker: 'MapLocationPicker',
}));

jest.mock('../map-provider-settings', () => ({
  MapProviderSettings: 'MapProviderSettings',
}));

jest.mock('../map-health-monitor', () => ({
  MapHealthMonitor: 'MapHealthMonitor',
}));

jest.mock('../map-api-key-manager', () => ({
  MapApiKeyManager: 'MapApiKeyManager',
}));

jest.mock('@/lib/constants/map', () => ({
  TILE_LAYER_CONFIGS: {
    openstreetmap: {
      url: 'https://tiles.example/{z}/{x}/{y}.png',
      attribution: 'Example',
      maxZoom: 19,
    },
  },
  LIGHT_POLLUTION_OVERLAY: {
    url: 'https://overlay.example/{z}/{x}/{y}.png',
    attribution: 'Overlay',
    maxZoom: 12,
  },
}));

import * as mapExports from '../index';

describe('map barrel exports', () => {
  it('re-exports the map components and constants', () => {
    expect(mapExports.LocationSearch).toBe('LocationSearch');
    expect(mapExports.MapLocationPicker).toBe('MapLocationPicker');
    expect(mapExports.MapProviderSettings).toBe('MapProviderSettings');
    expect(mapExports.MapHealthMonitor).toBe('MapHealthMonitor');
    expect(mapExports.MapApiKeyManager).toBe('MapApiKeyManager');
    expect(mapExports.TILE_LAYER_CONFIGS).toEqual({
      openstreetmap: {
        url: 'https://tiles.example/{z}/{x}/{y}.png',
        attribution: 'Example',
        maxZoom: 19,
      },
    });
    expect(mapExports.LIGHT_POLLUTION_OVERLAY).toEqual({
      url: 'https://overlay.example/{z}/{x}/{y}.png',
      attribution: 'Overlay',
      maxZoom: 12,
    });
  });
});
