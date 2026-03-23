/**
 * @jest-environment jsdom
 */

jest.mock('../fov-overlay', () => ({
  FOVOverlay: 'FOVOverlay',
}));

jest.mock('../fov-simulator', () => ({
  FOVSimulator: 'FOVSimulator',
}));

jest.mock('../ocular-simulator', () => ({
  OcularSimulator: 'OcularSimulator',
}));

jest.mock('../ocular-overlay', () => ({
  OcularOverlay: 'OcularOverlay',
}));

jest.mock('../satellite-tracker', () => ({
  SatelliteTracker: 'SatelliteTracker',
}));

jest.mock('../satellite-overlay', () => ({
  SatelliteOverlay: 'SatelliteOverlay',
}));

jest.mock('../sky-markers', () => ({
  SkyMarkers: 'SkyMarkers',
}));

jest.mock('../status-bar', () => ({
  StatusBar: 'StatusBar',
}));

jest.mock('../ar-camera-background', () => ({
  ARCameraBackground: 'ARCameraBackground',
}));

jest.mock('../ar-compass-overlay', () => ({
  ARCompassOverlay: 'ARCompassOverlay',
}));

import * as overlayExports from '../index';

describe('overlays barrel exports', () => {
  it('re-exports the overlay components', () => {
    expect(overlayExports.FOVOverlay).toBe('FOVOverlay');
    expect(overlayExports.FOVSimulator).toBe('FOVSimulator');
    expect(overlayExports.OcularSimulator).toBe('OcularSimulator');
    expect(overlayExports.OcularOverlay).toBe('OcularOverlay');
    expect(overlayExports.SatelliteTracker).toBe('SatelliteTracker');
    expect(overlayExports.SatelliteOverlay).toBe('SatelliteOverlay');
    expect(overlayExports.SkyMarkers).toBe('SkyMarkers');
    expect(overlayExports.StatusBar).toBe('StatusBar');
    expect(overlayExports.ARCameraBackground).toBe('ARCameraBackground');
    expect(overlayExports.ARCompassOverlay).toBe('ARCompassOverlay');
  });
});
