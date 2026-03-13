/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((selector) => {
    const state = { stel: null, activeEngine: 'stellarium' };
    return selector(state);
  }),
  useSettingsStore: jest.fn((selector) => {
    const state = { display: { showFovOverlay: false, showSatelliteOverlay: false, showSkyMarkers: false, showOcularOverlay: false } };
    return selector(state);
  }),
  useEquipmentStore: jest.fn((selector) => {
    const state = {
      fovDisplay: { enabled: false, frameColor: '#fff', frameStyle: 'solid', overlayOpacity: 0.5, dragToPosition: true },
      ocularDisplay: { enabled: false, appliedFov: 1, opacity: 0.5, showCrosshair: false },
      rotationAngle: 0,
      pixelSize: 3.76, sensorWidth: 23.5, sensorHeight: 15.6, focalLength: 400, aperture: 80,
      framePlacement: { x: 0, y: 0 },
      setFramePlacement: jest.fn(),
    };
    return selector(state);
  }),
}));
jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: jest.fn((selector) => {
    const state = { display: { showFovOverlay: false, showSatelliteOverlay: false, showSkyMarkers: false, showOcularOverlay: false }, skyEngine: 'stellarium' };
    return selector(state);
  }),
}));
jest.mock('@/lib/hooks/use-equipment-fov-props', () => ({
  useFovEquipmentOptions: jest.fn(() => ({
    fovSimEnabled: false, sensorWidth: 23.5, sensorHeight: 15.6, focalLength: 400,
    pixelSize: 3.76,
    mosaic: { enabled: false, rows: 1, cols: 1, overlap: 10 },
    gridType: 'none',
    framePlacement: { x: 0, y: 0 },
    effectiveFocalLength: 400,
    dragToPosition: true,
    setFramePlacement: jest.fn(),
  })),
}));
const mockFOVOverlay = jest.fn((_props?: Record<string, unknown>) => null);
const mockSkyMarkers = jest.fn((_props?: Record<string, unknown>) => null);
const mockSatelliteOverlay = jest.fn((_props?: Record<string, unknown>) => null);

jest.mock('@/components/starmap/overlays/fov-overlay', () => ({ FOVOverlay: (props: Record<string, unknown>) => { mockFOVOverlay(props); return null; } }));
jest.mock('@/components/starmap/overlays/ocular-overlay', () => ({ OcularOverlay: () => null }));
jest.mock('@/components/starmap/overlays/sky-markers', () => ({ SkyMarkers: (props: Record<string, unknown>) => { mockSkyMarkers(props); return null; } }));
jest.mock('@/components/starmap/overlays/satellite-overlay', () => ({ SatelliteOverlay: (props: Record<string, unknown>) => { mockSatelliteOverlay(props); return null; } }));

import { OverlaysContainer } from '../overlays-container';

beforeEach(() => {
  mockFOVOverlay.mockClear();
  mockSkyMarkers.mockClear();
  mockSatelliteOverlay.mockClear();
});

describe('OverlaysContainer', () => {
  it('renders without crashing with containerBounds', () => {
    render(
      <OverlaysContainer
        currentFov={60}
        containerBounds={{ width: 800, height: 600 }}
        onRotationChange={jest.fn()}
        onMarkerDoubleClick={jest.fn()}
        onMarkerEdit={jest.fn()}
        onMarkerNavigate={jest.fn()}
      />
    );
  });

  it('does not render SkyMarkers or SatelliteOverlay when containerBounds is undefined', () => {
    render(
      <OverlaysContainer
        currentFov={60}
        containerBounds={undefined}
        onRotationChange={jest.fn()}
        onMarkerDoubleClick={jest.fn()}
        onMarkerEdit={jest.fn()}
        onMarkerNavigate={jest.fn()}
      />
    );
    expect(mockSkyMarkers).not.toHaveBeenCalled();
    expect(mockSatelliteOverlay).not.toHaveBeenCalled();
  });

  it('renders SkyMarkers and SatelliteOverlay when containerBounds is provided', () => {
    render(
      <OverlaysContainer
        currentFov={60}
        containerBounds={{ width: 1024, height: 768 }}
        onRotationChange={jest.fn()}
        onMarkerDoubleClick={jest.fn()}
        onMarkerEdit={jest.fn()}
        onMarkerNavigate={jest.fn()}
      />
    );
    expect(mockSkyMarkers).toHaveBeenCalledWith(
      expect.objectContaining({ containerWidth: 1024, containerHeight: 768 })
    );
    expect(mockSatelliteOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ containerWidth: 1024, containerHeight: 768 })
    );
  });

  it('passes currentFov to FOVOverlay', () => {
    render(
      <OverlaysContainer
        currentFov={30}
        containerBounds={{ width: 800, height: 600 }}
        onRotationChange={jest.fn()}
        onMarkerDoubleClick={jest.fn()}
        onMarkerEdit={jest.fn()}
        onMarkerNavigate={jest.fn()}
      />
    );
    expect(mockFOVOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ currentFov: 30 })
    );
  });

  it('passes frame placement and drag state to FOVOverlay', () => {
    render(
      <OverlaysContainer
        currentFov={45}
        containerBounds={{ width: 800, height: 600 }}
        onRotationChange={jest.fn()}
        onMarkerDoubleClick={jest.fn()}
        onMarkerEdit={jest.fn()}
        onMarkerNavigate={jest.fn()}
      />
    );
    expect(mockFOVOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        framePlacement: { x: 0, y: 0 },
        dragToPosition: true,
      })
    );
  });
});
