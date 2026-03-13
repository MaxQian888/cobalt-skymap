/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock leaflet and react-leaflet before importing component
jest.mock('leaflet', () => ({
  Icon: { Default: { mergeOptions: jest.fn() } },
  control: { zoom: jest.fn(() => ({ addTo: jest.fn() })) },
}));

jest.mock('react-leaflet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const mockMap = {
    getZoom: jest.fn(() => 9),
    setView: jest.fn(),
    dragging: { enable: jest.fn(), disable: jest.fn() },
    touchZoom: { enable: jest.fn(), disable: jest.fn() },
    scrollWheelZoom: { enable: jest.fn(), disable: jest.fn() },
    doubleClickZoom: { enable: jest.fn(), disable: jest.fn() },
    zoomControl: { remove: jest.fn() },
  };
  const markerInstance = {
    setOpacity: jest.fn(),
    getLatLng: jest.fn(() => ({ lat: 35.6895, lng: 139.6917 })),
  };
  let mapEventHandlers: Record<string, (...args: unknown[]) => void> = {};
  const markerEventHandlersRef: { current: Record<string, () => void> } = { current: {} };

  const useMap = jest.fn(() => mockMap);
  const useMapEvents = jest.fn((handlers: Record<string, (...args: unknown[]) => void>) => {
    mapEventHandlers = handlers;
  });

  const Marker = React.forwardRef(function MockMarker(
    props: {
      draggable?: boolean;
      eventHandlers?: Record<string, () => void>;
    },
    ref: React.Ref<typeof markerInstance>
  ) {
    React.useEffect(() => {
      markerEventHandlersRef.current = props.eventHandlers ?? {};
    }, [props.eventHandlers]);

    React.useEffect(() => {
      if (typeof ref === 'function') {
        ref(markerInstance);
      } else if (ref) {
        ref.current = markerInstance;
      }
    }, [ref]);

    return <div data-testid="marker" data-draggable={String(Boolean(props.draggable))} />;
  });

  return {
    MapContainer: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
      <div data-testid="map-container" className={className}>{children}</div>
    ),
    TileLayer: ({
      url,
      eventHandlers,
    }: {
      url: string;
      eventHandlers?: { tileerror?: () => void };
    }) => (
      <div data-testid="tile-layer" data-url={url}>
        <button
          type="button"
          data-testid="tile-error-trigger"
          onClick={() => eventHandlers?.tileerror?.()}
        >
          trigger tileerror
        </button>
      </div>
    ),
    Marker,
    useMap,
    useMapEvents,
    __mock: {
      mockMap,
      markerInstance,
      getMapEventHandlers: () => mapEventHandlers,
      getMarkerEventHandlers: () => markerEventHandlersRef.current,
      reset: () => {
        mapEventHandlers = {};
        markerEventHandlersRef.current = {};
        markerInstance.setOpacity.mockClear();
        markerInstance.getLatLng.mockReset();
        markerInstance.getLatLng.mockReturnValue({ lat: 35.6895, lng: 139.6917 });
        mockMap.getZoom.mockReset();
        mockMap.getZoom.mockReturnValue(9);
        mockMap.setView.mockClear();
        mockMap.dragging.enable.mockClear();
        mockMap.dragging.disable.mockClear();
        mockMap.touchZoom.enable.mockClear();
        mockMap.touchZoom.disable.mockClear();
        mockMap.scrollWheelZoom.enable.mockClear();
        mockMap.scrollWheelZoom.disable.mockClear();
        mockMap.doubleClickZoom.enable.mockClear();
        mockMap.doubleClickZoom.disable.mockClear();
        mockMap.zoomControl.remove.mockClear();
      },
    },
  };
});

jest.mock('@/lib/constants/map', () => ({
  TILE_LAYER_CONFIGS: {
    openstreetmap: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    },
    esri_topo: {
      url: 'https://esri.example.com/{z}/{x}/{y}.png',
      attribution: '© Esri',
      maxZoom: 18,
    },
  },
  LIGHT_POLLUTION_OVERLAY: {
    url: 'https://example.com/light/{z}/{x}/{y}.png',
    attribution: '© Light',
    maxZoom: 15,
  },
}));

import { LeafletMap } from '../leaflet-map';

describe('LeafletMap', () => {
  const defaultCenter = { latitude: 40.0, longitude: -74.0 };
  const getReactLeafletMock = () => jest.requireMock('react-leaflet') as {
    useMap: jest.Mock;
    useMapEvents: jest.Mock;
    __mock: {
      mockMap: {
        getZoom: jest.Mock;
        setView: jest.Mock;
        dragging: { enable: jest.Mock; disable: jest.Mock };
        touchZoom: { enable: jest.Mock; disable: jest.Mock };
        scrollWheelZoom: { enable: jest.Mock; disable: jest.Mock };
        doubleClickZoom: { enable: jest.Mock; disable: jest.Mock };
        zoomControl: { remove: jest.Mock };
      };
      markerInstance: {
        setOpacity: jest.Mock;
        getLatLng: jest.Mock;
      };
      getMapEventHandlers: () => Record<string, (...args: unknown[]) => void>;
      getMarkerEventHandlers: () => Record<string, () => void>;
      reset: () => void;
    };
  };
  const getLeafletMock = () => jest.requireMock('leaflet') as {
    control: {
      zoom: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    getReactLeafletMock().__mock.reset();
  });

  it('renders the map container', () => {
    render(<LeafletMap center={defaultCenter} />);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders with role="application"', () => {
    render(<LeafletMap center={defaultCenter} />);
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('renders a tile layer', () => {
    render(<LeafletMap center={defaultCenter} />);
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('renders marker by default', () => {
    render(<LeafletMap center={defaultCenter} />);
    expect(screen.getByTestId('marker')).toBeInTheDocument();
  });

  it('hides marker when showMarker is false', () => {
    render(<LeafletMap center={defaultCenter} showMarker={false} />);
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument();
  });

  it('applies disabled styling', () => {
    render(<LeafletMap center={defaultCenter} disabled />);
    const app = screen.getByRole('application');
    expect(app.className).toContain('opacity-50');
  });

  it('applies custom className', () => {
    render(<LeafletMap center={defaultCenter} className="my-map" />);
    const app = screen.getByRole('application');
    expect(app.className).toContain('my-map');
  });

  it('applies custom height as number', () => {
    render(<LeafletMap center={defaultCenter} height={300} />);
    const app = screen.getByRole('application');
    expect(app.style.height).toBe('300px');
  });

  it('applies custom height as string', () => {
    render(<LeafletMap center={defaultCenter} height="50vh" />);
    const app = screen.getByRole('application');
    expect(app.style.height).toBe('50vh');
  });

  it('renders light pollution overlay when showLightPollution is true', () => {
    render(<LeafletMap center={defaultCenter} showLightPollution />);
    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(tileLayers.length).toBe(2);
  });

  it('does not render light pollution overlay by default', () => {
    render(<LeafletMap center={defaultCenter} />);
    const tileLayers = screen.getAllByTestId('tile-layer');
    expect(tileLayers.length).toBe(1);
  });

  it('sets aria-disabled when disabled', () => {
    render(<LeafletMap center={defaultCenter} disabled />);
    const app = screen.getByRole('application');
    expect(app.getAttribute('aria-disabled')).toBe('true');
  });

  it('does not set aria-disabled when not disabled', () => {
    render(<LeafletMap center={defaultCenter} />);
    const app = screen.getByRole('application');
    expect(app.getAttribute('aria-disabled')).toBeNull();
  });

  it('applies pointer-events-none when disabled', () => {
    render(<LeafletMap center={defaultCenter} disabled />);
    const app = screen.getByRole('application');
    expect(app.className).toContain('pointer-events-none');
  });

  it('renders with default props', () => {
    render(<LeafletMap center={defaultCenter} />);
    const container = screen.getByTestId('map-container');
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('marker')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('calls useMapEvents hook', () => {
    render(<LeafletMap center={defaultCenter} onClick={jest.fn()} />);
    expect(getReactLeafletMock().useMapEvents).toHaveBeenCalled();
  });

  it('calls useMap hook for MapController', () => {
    render(<LeafletMap center={defaultCenter} />);
    expect(getReactLeafletMock().useMap).toHaveBeenCalled();
  });

  it('disables map interactions when disabled', () => {
    render(<LeafletMap center={defaultCenter} disabled />);

    const { mockMap } = getReactLeafletMock().__mock;
    expect(mockMap.dragging.disable).toHaveBeenCalled();
    expect(mockMap.touchZoom.disable).toHaveBeenCalled();
    expect(mockMap.scrollWheelZoom.disable).toHaveBeenCalled();
    expect(mockMap.doubleClickZoom.disable).toHaveBeenCalled();
    expect(mockMap.zoomControl.remove).toHaveBeenCalled();
  });

  it('adds zoom control when enabled and no zoom control exists in the DOM', () => {
    render(<LeafletMap center={defaultCenter} />);

    const leaflet = getLeafletMock();
    const { mockMap } = getReactLeafletMock().__mock;
    expect(mockMap.dragging.enable).toHaveBeenCalled();
    expect(mockMap.touchZoom.enable).toHaveBeenCalled();
    expect(mockMap.scrollWheelZoom.enable).toHaveBeenCalled();
    expect(mockMap.doubleClickZoom.enable).toHaveBeenCalled();
    expect(leaflet.control.zoom).toHaveBeenCalledTimes(1);
  });

  it('does not add a duplicate zoom control when one already exists', () => {
    document.body.innerHTML = '<div class="leaflet-control-zoom"></div>';

    render(<LeafletMap center={defaultCenter} />);

    expect(getLeafletMock().control.zoom).not.toHaveBeenCalled();
  });

  it('updates the map view when the center changes', () => {
    const { rerender } = render(<LeafletMap center={defaultCenter} zoom={10} />);
    const { mockMap } = getReactLeafletMock().__mock;
    expect(mockMap.setView).not.toHaveBeenCalled();

    rerender(
      <LeafletMap
        center={{ latitude: 41.0, longitude: -73.5 }}
        zoom={10}
      />
    );

    expect(mockMap.setView).toHaveBeenCalledWith([41.0, -73.5], 10, { animate: true });
  });

  it('invokes onClick when the map is clicked while enabled', () => {
    const onClick = jest.fn();
    render(<LeafletMap center={defaultCenter} onClick={onClick} />);

    getReactLeafletMock().__mock.getMapEventHandlers().click({
      latlng: { lat: 35.0, lng: 139.0 },
    });

    expect(onClick).toHaveBeenCalledWith({ latitude: 35.0, longitude: 139.0 });
  });

  it('does not invoke onClick when the map is disabled', () => {
    const onClick = jest.fn();
    render(<LeafletMap center={defaultCenter} onClick={onClick} disabled />);

    getReactLeafletMock().__mock.getMapEventHandlers().click({
      latlng: { lat: 35.0, lng: 139.0 },
    });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('invokes onZoomChange when the map zoom changes', () => {
    const onZoomChange = jest.fn();
    render(<LeafletMap center={defaultCenter} onZoomChange={onZoomChange} />);

    getReactLeafletMock().__mock.getMapEventHandlers().zoomend();

    expect(onZoomChange).toHaveBeenCalledWith(9);
  });

  it('emits location changes after marker drag when enabled', () => {
    const onLocationChange = jest.fn();
    render(
      <LeafletMap
        center={defaultCenter}
        onLocationChange={onLocationChange}
      />
    );

    const { getMarkerEventHandlers, markerInstance } = getReactLeafletMock().__mock;
    markerInstance.getLatLng.mockReturnValue({ lat: 48.8566, lng: 2.3522 });

    getMarkerEventHandlers().dragstart();
    getMarkerEventHandlers().dragend();

    expect(markerInstance.setOpacity).toHaveBeenNthCalledWith(1, 0.6);
    expect(markerInstance.setOpacity).toHaveBeenNthCalledWith(2, 1);
    expect(onLocationChange).toHaveBeenCalledWith({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('does not emit marker drag updates when dragging is disabled', () => {
    const onLocationChange = jest.fn();
    render(
      <LeafletMap
        center={defaultCenter}
        draggableMarker={false}
        onLocationChange={onLocationChange}
      />
    );

    const { getMarkerEventHandlers } = getReactLeafletMock().__mock;
    getMarkerEventHandlers().dragend();

    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it('does not emit fallback events when the active layer is already the fallback layer', () => {
    const onTileLayerFallback = jest.fn();
    render(
      <LeafletMap
        center={defaultCenter}
        tileLayer="openstreetmap"
        fallbackTileLayer="openstreetmap"
        tileErrorThreshold={1}
        onTileLayerFallback={onTileLayerFallback}
      />
    );

    fireEvent.click(screen.getByTestId('tile-error-trigger'));

    expect(onTileLayerFallback).not.toHaveBeenCalled();
  });

  it('emits fallback event after tile-error threshold', () => {
    const onTileLayerFallback = jest.fn();
    render(
      <LeafletMap
        center={defaultCenter}
        tileLayer="esri_topo"
        tileErrorThreshold={2}
        onTileLayerFallback={onTileLayerFallback}
      />
    );

    const triggers = screen.getAllByTestId('tile-error-trigger');
    fireEvent.click(triggers[0]);
    fireEvent.click(triggers[0]);

    expect(onTileLayerFallback).toHaveBeenCalledWith({
      failedLayer: 'esri_topo',
      fallbackLayer: 'openstreetmap',
      errorCount: 2,
    });
  });

  it('keeps unavailable layer in fallback on reselection', () => {
    const onTileLayerFallback = jest.fn();
    const { rerender } = render(
      <LeafletMap
        center={defaultCenter}
        tileLayer="esri_topo"
        tileErrorThreshold={1}
        onTileLayerFallback={onTileLayerFallback}
      />
    );

    const triggers = screen.getAllByTestId('tile-error-trigger');
    fireEvent.click(triggers[0]);
    fireEvent.click(screen.getByTestId('tile-error-trigger'));
    expect(onTileLayerFallback).toHaveBeenCalledTimes(2);

    rerender(
      <LeafletMap
        center={defaultCenter}
        tileLayer="openstreetmap"
        tileErrorThreshold={1}
        onTileLayerFallback={onTileLayerFallback}
      />
    );

    rerender(
      <LeafletMap
        center={defaultCenter}
        tileLayer="esri_topo"
        tileErrorThreshold={1}
        onTileLayerFallback={onTileLayerFallback}
      />
    );

    expect(onTileLayerFallback).toHaveBeenCalledTimes(3);
    expect(onTileLayerFallback).toHaveBeenLastCalledWith({
      failedLayer: 'esri_topo',
      fallbackLayer: 'openstreetmap',
      errorCount: 0,
    });
  });

  it('normalizes invalid tile layers to openstreetmap', () => {
    render(
      <LeafletMap
        center={defaultCenter}
        tileLayer={'invalid-layer' as never}
        fallbackTileLayer={'also-invalid' as never}
      />
    );

    expect(screen.getByTestId('tile-layer')).toHaveAttribute(
      'data-url',
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    );
  });
});
