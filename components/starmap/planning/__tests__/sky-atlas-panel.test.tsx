/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock stores with selector pattern
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

const mockUseTargetListStore = jest.fn((selector) => {
  const state = {
    addTarget: jest.fn(),
    targets: [],
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) => mockUseTargetListStore(selector),
}));

jest.mock('@/lib/catalogs', () => ({
  useSkyAtlasStore: jest.fn(() => ({
    catalog: [],
    objects: [],
    filteredObjects: [],
    tonightsBest: [],
    searchResult: null,
    isLoading: false,
    error: null,
    filters: {
      types: [],
      objectTypes: [],
      minMagnitude: 0,
      maxMagnitude: 15,
      magnitudeRange: { from: null, to: null },
      constellation: null,
      search: '',
      minAltitude: 30,
      sortBy: 'score',
      sortOrder: 'desc',
    },
    setFilters: jest.fn(),
    sortBy: 'name',
    setSortBy: jest.fn(),
    sortOrder: 'asc',
    setSortOrder: jest.fn(),
    setSearchQuery: jest.fn(),
    searchQuery: '',
    setLocation: jest.fn(),
    location: { latitude: 40.7128, longitude: -74.006 },
  })),
  initializeSkyAtlas: jest.fn(),
  DSO_CATALOG: [],
  MOON_PHASE_NAMES: {
    new: 'New Moon',
    waxingCrescent: 'Waxing Crescent',
    firstQuarter: 'First Quarter',
    waxingGibbous: 'Waxing Gibbous',
    full: 'Full Moon',
    waningGibbous: 'Waning Gibbous',
    lastQuarter: 'Last Quarter',
    waningCrescent: 'Waning Crescent',
  },
  DSO_TYPE_LABELS: {
    galaxy: 'Galaxy',
    nebula: 'Nebula',
    cluster: 'Cluster',
  },
  CONSTELLATIONS: ['And', 'Ori'],
  CONSTELLATION_NAMES: {
    And: 'Andromeda',
    Ori: 'Orion',
  },
}));

// Mock utils
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: jest.fn(() => '00h 00m 00s'),
  degreesToDMS: jest.fn(() => '+00° 00\' 00"'),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock TranslatedName
jest.mock('../../objects/translated-name', () => ({
  TranslatedName: ({ name }: { name: string }) => <span data-testid="translated-name">{name}</span>,
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>Select...</span>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer">{children}</div>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-content">{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DrawerTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="drawer-trigger">{children}</div>,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (v: number[]) => void }) => (
    <input type="range" value={value?.[0] || 0} onChange={(e) => onValueChange?.([Number(e.target.value)])} data-testid="slider" />
  ),
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} data-testid="checkbox" />
  ),
}));

jest.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  ReferenceLine: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
}));

import { SkyAtlasPanel } from '../sky-atlas-panel';

describe('SkyAtlasPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<SkyAtlasPanel />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders drawer component', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByTestId('drawer')).toBeInTheDocument();
  });

  it('renders drawer trigger', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByTestId('drawer-trigger')).toBeInTheDocument();
  });

  it('renders drawer content', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
  });

  it('renders sky atlas title', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByText('skyAtlas.title')).toBeInTheDocument();
  });

  it('renders observer location', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByText('40.71°, -74.01°')).toBeInTheDocument();
  });

  it('renders search area', () => {
    render(<SkyAtlasPanel />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(0);
  });

  it('renders filter section', () => {
    render(<SkyAtlasPanel />);
    expect(screen.getByText('skyAtlas.filters')).toBeInTheDocument();
  });

  it('renders a dedicated scroll surface for the drawer body', () => {
    render(<SkyAtlasPanel />);

    const scrollSurface = screen.getByTestId('sky-atlas-panel-scroll-area');
    expect(scrollSurface).toHaveAttribute('data-starmap-scroll-surface', 'true');
    expect(scrollSurface).toHaveClass('flex-1');
    expect(scrollSurface).toHaveClass('min-h-0');
    expect(scrollSurface).toHaveTextContent('skyAtlas.filters');
  });
});


