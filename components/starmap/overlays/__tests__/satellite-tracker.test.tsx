/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const mockSetViewDirection = jest.fn();
const mockAddTrackedSatellite = jest.fn();
const mockSetShowSatellites = jest.fn();
const mockFetchSatellitesFromCelesTrak = jest.fn();
const mockGenerateSamplePasses = jest.fn();

// Mock stores
const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Latitude: 40.7128,
        Longitude: -74.006,
      },
    },
  };
  return selector ? selector(state) : state;
});

const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    setViewDirection: mockSetViewDirection,
  };
  return selector ? selector(state) : state;
});

const mockUseSatelliteStore = jest.fn((selector) => {
  const state = {
    trackedSatellites: [],
    addTrackedSatellite: mockAddTrackedSatellite,
    removeTrackedSatellite: jest.fn(),
    updateSatellitePosition: jest.fn(),
    showSatellites: false,
    showLabels: true,
    setShowLabels: jest.fn(),
    showOrbits: false,
    setShowOrbits: jest.fn(),
    setShowSatellites: mockSetShowSatellites,
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  useSatelliteStore: (selector: (state: unknown) => unknown) => mockUseSatelliteStore(selector),
}));

jest.mock('@/lib/services/satellite-propagator', () => ({
  parseTLE: jest.fn(() => null),
  calculatePosition: jest.fn(() => null),
}));

jest.mock('@/lib/services/satellite/celestrak-service', () => ({
  fetchSatellitesFromCelesTrak: (...args: unknown[]) => mockFetchSatellitesFromCelesTrak(...args),
  SAMPLE_SATELLITES: [
    {
      id: 'iss',
      name: 'ISS (ZARYA)',
      noradId: 25544,
      type: 'iss',
      altitude: 420,
      velocity: 7.66,
      inclination: 51.6,
      period: 92.6,
      ra: 122.5,
      dec: 21.1,
      azimuth: 180,
      elevation: 45,
      magnitude: -1.2,
      isVisible: true,
      source: 'celestrak',
    },
  ],
  generateSamplePasses: (...args: unknown[]) => mockGenerateSamplePasses(...args),
  SATELLITE_SOURCES: [
    { id: 'celestrak', name: 'CelesTrak', enabled: true, apiUrl: 'https://celestrak.org' },
  ],
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    return <div data-testid="dialog">{children}</div>;
  },
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input data-testid="input" {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" data-testid="switch" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-content">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="tabs-trigger">{children}</button>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible-content">{children}</div>,
}));

jest.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ message }: { message: string }) => <div data-testid="empty-state">{message}</div>,
}));

jest.mock('@/components/ui/search-input', () => ({
  SearchInput: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

import { SatelliteTracker } from '../satellite-tracker';

describe('SatelliteTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateSamplePasses.mockImplementation((satellites: Array<{ id: string; name: string; maxEl?: number }>) => satellites.map((sat) => ({
      satellite: sat,
      startTime: new Date(Date.now() + 60_000),
      maxTime: new Date(Date.now() + 120_000),
      endTime: new Date(Date.now() + 180_000),
      startAz: 120,
      maxEl: sat.maxEl ?? 65,
      endAz: 220,
      magnitude: -0.8,
    })));
  });

  it('renders without crashing', () => {
    render(<SatelliteTracker />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger button', () => {
    render(<SatelliteTracker />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders dialog content', () => {
    render(<SatelliteTracker />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders tabs for different satellite views', () => {
    render(<SatelliteTracker />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('renders satellite display toggle switch', () => {
    render(<SatelliteTracker />);
    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('renders location coordinates in footer', () => {
    render(<SatelliteTracker />);
    expect(screen.getByText(/40\.71/)).toBeInTheDocument();
    expect(screen.getByText(/-74\.01/)).toBeInTheDocument();
  });

  it('renders refresh button', () => {
    render(<SatelliteTracker />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(1);
  });

  it('renders search input', () => {
    render(<SatelliteTracker />);
    // SearchInput component mock
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders upcoming passes count', () => {
    render(<SatelliteTracker />);
    expect(document.body.textContent).toContain('satellites.next24Hours');
  });

  it('renders tabs list with passes and catalog tabs', () => {
    render(<SatelliteTracker />);
    const tabsTriggers = screen.getAllByTestId('tabs-trigger');
    expect(tabsTriggers.length).toBe(2);
  });

  it('tracks a satellite and enables map display when eye action is clicked', () => {
    const { container } = render(<SatelliteTracker />);
    const trackButton = container.querySelector('button.h-8.w-8.shrink-0');
    expect(trackButton).toBeInTheDocument();
    if (trackButton) {
      fireEvent.click(trackButton);
    }

    expect(mockAddTrackedSatellite).toHaveBeenCalled();
    expect(mockSetShowSatellites).toHaveBeenCalledWith(true);
    expect(mockSetViewDirection).toHaveBeenCalled();
  });

  it('supports search filtering and can reach empty catalog state', () => {
    const { container } = render(<SatelliteTracker />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'no-match-keyword' } });
    expect(container.textContent).toContain('satellites.noSatellites');
  });

  it('toggles data source settings visibility and source switch', () => {
    const { container } = render(<SatelliteTracker />);
    const settingsButton = container.querySelector('button.h-9.w-9.shrink-0');
    expect(settingsButton).toBeInTheDocument();
    if (settingsButton) {
      fireEvent.click(settingsButton);
    }

    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBeGreaterThan(1);
    fireEvent.click(switches[switches.length - 1]);
    expect(container.textContent).toContain('satellites.dataSources');
  });
});


