/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock stores
const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    stel: null,
    isReady: true,
    viewDirection: { ra: 0, dec: 0 },
    fov: 60,
  };
  return selector ? selector(state) : state;
});

const mockUseSatelliteStore = jest.fn((selector) => {
  const state = {
    satellites: [],
    trackedSatellites: [],
    showLabels: true,
    showOrbits: false,
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  useSatelliteStore: (selector: (state: unknown) => unknown) => mockUseSatelliteStore(selector),
}));

jest.mock('@/lib/services/celestial-icons', () => ({
  getSatelliteColor: jest.fn(() => '#ffffff'),
}));

// Mock UI components
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

import { SatelliteOverlay, SatelliteTrail } from '../satellite-overlay';

// Mock useBatchProjection
let mockPositions: Array<{ item: { id: string; name: string; noradId: number; type: string; altitude: number; velocity: number; ra: number; dec: number; isVisible: boolean }; x: number; y: number; visible: boolean }> = [];
jest.mock('@/lib/hooks', () => ({
  useBatchProjection: () => mockPositions,
}));

describe('SatelliteOverlay', () => {
  const defaultProps = {
    containerWidth: 800,
    containerHeight: 600,
    onSatelliteClick: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPositions = [];
    mockUseSatelliteStore.mockImplementation((selector) => {
      const state = {
        satellites: [],
        trackedSatellites: [],
        showSatellites: true,
        showLabels: true,
        showOrbits: false,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<SatelliteOverlay {...defaultProps} />);
    expect(container).toBeInTheDocument();
  });

  it('returns null when showSatellites is false', () => {
    mockUseSatelliteStore.mockImplementation((selector) => {
      const state = {
        satellites: [],
        trackedSatellites: [],
        showSatellites: false,
        showLabels: true,
        showOrbits: false,
      };
      return selector ? selector(state) : state;
    });
    const { container } = render(<SatelliteOverlay {...defaultProps} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('returns null when no positions', () => {
    mockPositions = [];
    const { container } = render(<SatelliteOverlay {...defaultProps} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders SVG with markers when positions exist', () => {
    mockPositions = [{
      item: { id: 'sat1', name: 'ISS', noradId: 25544, type: 'iss', altitude: 400, velocity: 7.66, ra: 10, dec: 20, isVisible: true },
      x: 100, y: 200, visible: true,
    }];
    const { container } = render(<SatelliteOverlay {...defaultProps} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('.satellite-marker')).toBeInTheDocument();
  });

  it('calls onSatelliteClick when marker is clicked', () => {
    const onSatelliteClick = jest.fn();
    mockPositions = [{
      item: { id: 'sat1', name: 'ISS', noradId: 25544, type: 'iss', altitude: 400, velocity: 7.66, ra: 10, dec: 20, isVisible: true },
      x: 100, y: 200, visible: true,
    }];

    const { container } = render(
      <SatelliteOverlay containerWidth={800} containerHeight={600} onSatelliteClick={onSatelliteClick} />
    );

    const marker = container.querySelector('.satellite-marker');
    expect(marker).toBeInTheDocument();
    if (marker) {
      fireEvent.click(marker);
    }

    expect(onSatelliteClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'sat1' }));
  });

  it('truncates long satellite labels in marker text', () => {
    mockPositions = [{
      item: {
        id: 'sat-long',
        name: 'VERY-LONG-SATELLITE-NAME-12345',
        noradId: 99999,
        type: 'communication',
        altitude: 500,
        velocity: 7.1,
        ra: 10,
        dec: 20,
        isVisible: false,
      },
      x: 80,
      y: 140,
      visible: true,
    }];

    render(<SatelliteOverlay containerWidth={800} containerHeight={600} />);
    expect(screen.getByText('VERY-LONG-SATEL...')).toBeInTheDocument();
  });

  it('renders with different container sizes', () => {
    const { container } = render(
      <SatelliteOverlay {...defaultProps} containerWidth={1920} containerHeight={1080} />
    );
    expect(container).toBeInTheDocument();
  });

  it('renders without onSatelliteClick callback', () => {
    const { container } = render(
      <SatelliteOverlay containerWidth={800} containerHeight={600} />
    );
    expect(container).toBeInTheDocument();
  });
});

describe('SatelliteTrail', () => {
  it('returns null when fewer than 2 points', () => {
    const { container } = render(
      <SatelliteTrail points={[{ x: 10, y: 10 }]} color="#ff0000" containerWidth={800} containerHeight={600} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('returns null when 0 points', () => {
    const { container } = render(
      <SatelliteTrail points={[]} color="#ff0000" containerWidth={800} containerHeight={600} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders path when 2+ points', () => {
    const { container } = render(
      <SatelliteTrail
        points={[{ x: 10, y: 10 }, { x: 50, y: 50 }, { x: 100, y: 30 }]}
        color="#ff0000"
        containerWidth={800}
        containerHeight={600}
      />
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    const path = svg?.querySelector('path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toContain('M 10 10');
    expect(path?.getAttribute('d')).toContain('L 50 50');
    expect(path?.getAttribute('d')).toContain('L 100 30');
  });
});


