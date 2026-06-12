/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';

jest.mock('@/lib/services/object-info-service', () => ({
  getCachedObjectInfo: jest.fn(),
}));

// Mock stores
const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Latitude: 40.7128,
        Longitude: -74.006,
      },
    },
    mountInfo: {
      Connected: false,
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
  useStellariumStore: jest.fn(() => ({
    stel: null,
    isReady: true,
    selectedObject: null,
    skyCultureLanguage: 'native',
  })),
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
  useTargetListStore: (selector: (state: unknown) => unknown) => mockUseTargetListStore(selector),
}));

// Mock hooks
jest.mock('@/lib/hooks', () => ({
  useCelestialName: jest.fn((name: string) => name),
  useCelestialNames: jest.fn((names: string[]) => names || []),
  useAdaptivePosition: jest.fn(() => ({ left: 12, top: 64 })),
  useObjectActions: jest.fn(() => ({
    handleSlew: jest.fn(),
    handleAddToList: jest.fn(),
    mountConnected: false,
  })),
  useAstroEnvironment: jest.fn(() => ({
    moonPhaseName: 'First Quarter',
    moonIllumination: 50,
    moonAltitude: 30,
    moonRa: 0,
    moonDec: 0,
    sunAltitude: -20,
    lstString: '00h 00m 00s',
    twilight: {
      sunset: new Date(),
      sunrise: new Date(),
      astronomicalDusk: new Date(),
      astronomicalDawn: new Date(),
    },
  })),
  useTargetAstroData: jest.fn(() => ({
    altitude: 45,
    azimuth: 180,
    moonDistance: 90,
    visibility: {
      isVisible: true,
      isCircumpolar: false,
      transitAltitude: 75,
      riseTime: new Date(),
      setTime: new Date(),
      transitTime: new Date(),
      darkImagingHours: 6,
    },
    feasibility: {
      score: 80,
      recommendation: 'good',
      moonScore: 90,
      altitudeScore: 85,
      durationScore: 75,
      twilightScore: 90,
      warnings: [],
    },
  })),
  useHorizonsEphemeris: jest.fn(() => ({ row: null, loading: false, error: null })),
}));

// Mock astro-utils
jest.mock('@/lib/astronomy/astro-utils', () => ({
  getMoonPhase: jest.fn(() => 0.25),
  getMoonPhaseName: jest.fn(() => 'First Quarter'),
  getMoonIllumination: jest.fn(() => 50),
  getMoonPosition: jest.fn(() => ({ ra: 0, dec: 0 })),
  getSunPosition: jest.fn(() => ({ ra: 0, dec: 0 })),
  angularSeparation: jest.fn(() => 90),
  calculateTargetVisibility: jest.fn(() => ({
    isVisible: true,
    isCircumpolar: false,
    altitude: 45,
    transitAltitude: 75,
    riseTime: new Date(),
    setTime: new Date(),
    transitTime: new Date(),
    darkImagingHours: 6,
  })),
  calculateImagingFeasibility: jest.fn(() => ({
    score: 80,
    recommendation: 'good',
    moonScore: 90,
    altitudeScore: 85,
    durationScore: 75,
    factors: [],
    moonDistance: 90,
    moonIllumination: 50,
  })),
  calculateTwilightTimes: jest.fn(() => ({
    sunset: new Date(),
    sunrise: new Date(),
    astronomicalDusk: new Date(),
    astronomicalDawn: new Date(),
  })),
  formatTimeShort: jest.fn((date: Date) => date?.toLocaleTimeString() || '--:--'),
  getAltitudeOverTime: jest.fn(() => [
    { time: new Date(), altitude: 30 },
    { time: new Date(), altitude: 45 },
    { time: new Date(), altitude: 60 },
  ]),
  getTransitTime: jest.fn(() => new Date()),
}));

jest.mock('@/lib/astronomy/target-display-model', () => {
  const actual = jest.requireActual('@/lib/astronomy/target-display-model');
  return {
    ...actual,
    buildTargetDisplayModel: jest.fn(actual.buildTargetDisplayModel),
  };
});

// Mock utils
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  raDecToAltAz: jest.fn(() => ({ altitude: 45, azimuth: 180 })),
  getLST: jest.fn(() => 12),
  degreesToHMS: jest.fn(() => '00h 00m 00s'),
  degreesToDMS: jest.fn(() => '+00° 00\' 00"'),
}));

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => <div data-testid="card" data-slot="card" {...props}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-slot="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-slot="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3 data-slot="card-title">{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../altitude-chart-compact', () => ({
  AltitudeChartCompact: ({ ra, dec }: { ra: number; dec: number }) => (
    <div data-testid="altitude-chart-compact" data-ra={ra} data-dec={dec} />
  ),
}));

// Mock recharts
jest.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  ReferenceLine: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => <div />,
}));

import { useObjectActions } from '@/lib/hooks';
import * as targetDisplayModel from '@/lib/astronomy/target-display-model';
import type { SelectedObjectData } from '@/lib/core/types';
import { getCachedObjectInfo } from '@/lib/services/object-info-service';

const mockUseObjectActions = useObjectActions as jest.Mock;
const mockGetCachedObjectInfo = getCachedObjectInfo as jest.Mock;
const defaultCachedObjectInfo = {
  names: ['M31', 'NGC 224'],
  type: 'Galaxy',
  typeCategory: 'galaxy',
  ra: 10.6847,
  dec: 41.2689,
  raString: '00h 42m 44s',
  decString: '+41° 16\' 09"',
  images: [],
  sources: ['Local', 'Wikipedia'],
  provenance: {
    description: {
      acceptedSource: 'Wikipedia',
      authorityLevel: 'reference',
      contributors: ['Local', 'Wikipedia'],
    },
  },
  diagnostics: [
    {
      providerId: 'sbdb',
      status: 'unsupported',
      fieldGroup: 'physical',
    },
  ],
};

import { InfoPanel } from '../info-panel';

describe('InfoPanel', () => {
  const defaultProps = {
    selectedObject: null,
    onSetFramingCoordinates: jest.fn(),
  };

  const mockSelectedObject: SelectedObjectData = {
    names: ['M31', 'Andromeda Galaxy', 'NGC 224'],
    ra: '00h 42m 44s',
    dec: '+41° 16\' 09"',
    raDeg: 10.6847,
    decDeg: 41.2689,
    type: 'Galaxy',
    magnitude: 3.4,
    size: '3° x 1°',
    constellation: 'Andromeda',
    selectionSource: 'enriched',
    selectionFallback: 'resolved',
    sourceCatalog: 'SIMBAD',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useMapInteractionStore.getState().reset();
    mockGetCachedObjectInfo.mockImplementation(() => new Promise(() => undefined));
    // Reset useObjectActions to default (disconnected) state after each test
    mockUseObjectActions.mockReturnValue({
      handleSlew: jest.fn(),
      handleAddToList: jest.fn(),
      mountConnected: false,
    });
  });

  async function renderSelectedInfoPanel(
    overrideProps: Partial<React.ComponentProps<typeof InfoPanel>> = {}
  ) {
    mockGetCachedObjectInfo.mockResolvedValueOnce(defaultCachedObjectInfo);

    const view = render(
      <InfoPanel
        {...defaultProps}
        selectedObject={mockSelectedObject}
        {...overrideProps}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    return view;
  }

  it('renders without crashing when no object selected', () => {
    render(<InfoPanel {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders card container', () => {
    render(<InfoPanel {...defaultProps} />);
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  describe('with selected object', () => {
    it('displays object name', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('M31')).toBeInTheDocument();
    });

    it('displays object type badge', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('Galaxy')).toBeInTheDocument();
    });

    it('displays magnitude when available', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('3.4')).toBeInTheDocument();
    });

    it('displays size when available', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('3° x 1°')).toBeInTheDocument();
    });

    it('displays constellation when available', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('Andromeda')).toBeInTheDocument();
    });

    it('displays coordinates', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByText('00h 42m 44s')).toBeInTheDocument();
      expect(screen.getByText('+41° 16\' 09"')).toBeInTheDocument();
    });

    it('renders altitude chart', async () => {
      await renderSelectedInfoPanel();
      expect(screen.getByTestId('altitude-chart-compact')).toBeInTheDocument();
    });
  });

  describe('object type icons', () => {
    it('uses correct icon for galaxy type', () => {
      const galaxyObject = { ...mockSelectedObject, type: 'Galaxy' };
      render(<InfoPanel {...defaultProps} selectedObject={galaxyObject} />);
      expect(screen.getByText('Galaxy')).toBeInTheDocument();
    });

    it('uses correct icon for nebula type', () => {
      const nebulaObject = { ...mockSelectedObject, type: 'Nebula', names: ['M42'] };
      render(<InfoPanel {...defaultProps} selectedObject={nebulaObject} />);
      expect(screen.getByText('Nebula')).toBeInTheDocument();
    });

    it('uses correct icon for cluster type', () => {
      const clusterObject = { ...mockSelectedObject, type: 'Open Cluster', names: ['M45'] };
      render(<InfoPanel {...defaultProps} selectedObject={clusterObject} />);
      expect(screen.getByText('Open Cluster')).toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('renders close button when object is selected', () => {
      const onClose = jest.fn();
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} onClose={onClose} />);
      const closeButton = screen.getByLabelText('common.close');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} onClose={onClose} />);
      const closeButton = screen.getByLabelText('common.close');
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes panel on Escape key press', () => {
      const onClose = jest.fn();
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} onClose={onClose} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not crash on Escape when onClose is undefined', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      // Should not throw
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('mount connected actions', () => {
    it('shows slew button when mount is connected', () => {
      mockUseObjectActions.mockReturnValue({
        handleSlew: jest.fn(),
        handleAddToList: jest.fn(),
        mountConnected: true,
      });

      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('actions.slewToObject')).toBeInTheDocument();
    });

    it('does not show slew button when mount is disconnected', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.queryByText('actions.slewToObject')).not.toBeInTheDocument();
    });

    it('shows add to list button', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('common.add')).toBeInTheDocument();
    });

    it('calls handleAddToList when add button is clicked', () => {
      const mockHandleAddToList = jest.fn();
      mockUseObjectActions.mockReturnValue({
        handleSlew: jest.fn(),
        handleAddToList: mockHandleAddToList,
        mountConnected: false,
      });

      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      fireEvent.click(screen.getByText('common.add'));
      expect(mockHandleAddToList).toHaveBeenCalled();
    });
  });

  describe('view details button', () => {
    it('renders view details button when onViewDetails is provided', () => {
      const onViewDetails = jest.fn();
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} onViewDetails={onViewDetails} />);
      expect(screen.getByText('objectDetail.viewDetails')).toBeInTheDocument();
    });

    it('does not render view details button when onViewDetails is not provided', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.queryByText('objectDetail.viewDetails')).not.toBeInTheDocument();
    });

    it('calls onViewDetails when button is clicked', () => {
      const onViewDetails = jest.fn();
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} onViewDetails={onViewDetails} />);
      fireEvent.click(screen.getByText('objectDetail.viewDetails'));
      expect(onViewDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('astronomical data display', () => {
    it('displays current altitude', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('45.0°')).toBeInTheDocument();
    });

    it('displays azimuth', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('180.0°')).toBeInTheDocument();
    });

    it('displays moon distance', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('90°')).toBeInTheDocument();
    });

    it('displays max altitude (transit altitude)', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.getByText('75.0°')).toBeInTheDocument();
    });
  });

  describe('section hierarchy and localization', () => {
    it('renders canonical section order for target information', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      const identity = screen.getByTestId('info-panel-section-identity');
      const live = screen.getByTestId('info-panel-section-live-status');
      const planning = screen.getByTestId('info-panel-section-planning-metrics');
      const advanced = screen.getByTestId('info-panel-section-advanced-metadata');

      expect(identity.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(live.compareDocumentPosition(planning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(planning.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('uses localized keys for advanced metadata labels', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      const advanced = screen.getByTestId('info-panel-section-advanced-metadata');
      expect(screen.getByText('objectDetail.systemMetadata')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.frameTimeScale')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.qualityEop')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.calculationSummary')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.timestamp')).toBeInTheDocument();
      expect(advanced).toHaveTextContent('objectDetail.calculationSource.calculation');
      expect(advanced).toHaveTextContent('objectDetail.calculationState.normal');
    });

    it('renders selection source semantics for coordinate fallback objects', () => {
      const coordinateSelection: SelectedObjectData = {
        ...mockSelectedObject,
        names: ['00h 42m 44s +41° 16\' 09"'],
        selectionSource: 'coordinate',
        selectionFallback: 'coordinate_fallback',
        sourceCatalog: null,
      };

      render(<InfoPanel {...defaultProps} selectedObject={coordinateSelection} />);

      expect(screen.getAllByText('objectDetail.selectionSource.coordinate').length).toBeGreaterThan(0);
      expect(screen.getAllByText('objectDetail.selectionFallback.coordinate_fallback').length).toBeGreaterThan(0);
    });

    it('does not expose raw advanced metadata literals', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      expect(screen.queryByText('Calc')).not.toBeInTheDocument();
      expect(screen.queryByText('degraded')).not.toBeInTheDocument();
    });

    it('renders shared source semantics from cached object info', async () => {
      await renderSelectedInfoPanel();

      expect(await screen.findByText('objectDetail.acceptedSource')).toBeInTheDocument();
      expect(screen.getByText('Wikipedia')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.sourceAuthority.reference')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.unsupportedSourceState')).toBeInTheDocument();
    });

    it('renders target information blocks with shadcn card surfaces', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      expect(screen.getByTestId('info-panel-section-identity')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('info-panel-section-live-status')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('info-panel-section-planning-metrics')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('info-panel-section-advanced-metadata')).toHaveAttribute('data-slot', 'card');
    });
  });

  describe('continuity context', () => {
    it('shows active observing-site context when continuity store has a site and target summary', () => {
      useMapInteractionStore.getState().setSiteContext({
        kind: 'committed',
        sourceSurface: 'starmap',
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
        summaryStatus: 'ready',
        displayName: 'Tokyo',
        actions: ['open-target-details'],
      });
      useMapInteractionStore.getState().setTargetContext({
        objectName: 'M31',
        primaryName: 'M31',
        aliases: ['Andromeda Galaxy'],
        ra: '00h 42m 44s',
        dec: '+41° 16\' 09"',
        raDeg: 10.6847,
        decDeg: 41.2689,
        type: 'Galaxy',
        sourceQuality: 'normal',
        siteName: 'Tokyo',
        siteCoordinates: { latitude: 35.6762, longitude: 139.6503 },
      });

      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      expect(screen.getByText(/starmap\.context\.activeSite/)).toBeInTheDocument();
      expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
    });
  });

  describe('risk hint mapping', () => {
    it('maps known risk keys and falls back for unknown risk key', () => {
      const mockedBuildTargetDisplayModel = targetDisplayModel.buildTargetDisplayModel as unknown as jest.Mock;
      mockedBuildTargetDisplayModel.mockReturnValueOnce({
          sections: {
            identity: {
              primaryName: 'M31',
              aliases: ['NGC 224'],
              type: 'Galaxy',
              magnitude: '3.4',
              size: '3° x 1°',
              constellation: 'Andromeda',
              coordinates: {
                ra: '00h 42m 44s',
                dec: '+41° 16\' 09"',
              },
            },
            liveStatus: {
              altitude: '45.0°',
              azimuth: '180.0°',
              altitudeState: 'high',
              moonInterferenceLevel: 'moderate',
              calculationState: 'nominal',
              riskHints: ['never-rises', 'moon-interference', 'low-feasibility', 'custom-risk'],
            },
            planningMetrics: {
              visibility: {
                isVisible: true,
                isCircumpolar: false,
                transitAltitude: 75,
                riseTime: new Date(),
                setTime: new Date(),
                transitTime: new Date(),
                darkImagingHours: 6,
              },
              moonDistance: '90°',
              maxAltitude: '75.0°',
              feasibility: {
                score: 80,
                recommendation: 'good',
                moonScore: 90,
                altitudeScore: 85,
                durationScore: 75,
                twilightScore: 90,
                warnings: [],
              },
            },
            advancedMetadata: {
              frame: 'J2000',
              timeScale: 'UTC',
              qualityFlag: 'A',
              dataFreshness: 'fresh',
              calculationSource: 'engine',
              calculationState: 'nominal',
              updatedAt: '2026-03-19T12:00:00Z',
              calculationTimestamp: '2026-03-19T12:00:00Z',
            },
          },
        } as unknown as ReturnType<typeof targetDisplayModel.buildTargetDisplayModel>);

      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      expect(screen.getByText('objectDetail.riskHintsMap.never-rises')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.riskHintsMap.moon-interference')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.riskHintsMap.low-feasibility')).toBeInTheDocument();
      expect(screen.getByText('custom-risk')).toBeInTheDocument();
    });
  });

  describe('compact-priority behavior', () => {
    it('makes advanced metadata collapsible on every viewport while keeping critical actions visible', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      const advanced = screen.getByTestId('info-panel-section-advanced-metadata');
      // Advanced metadata is no longer width-hidden on small screens; it is a
      // de-prioritized collapsible (open by default, foldable to save space).
      expect(advanced.className).not.toContain('hidden');
      // The section title doubles as the collapsible toggle and stays present.
      expect(screen.getByText('objectDetail.systemMetadata')).toBeInTheDocument();
      expect(screen.getByText('common.add')).toBeInTheDocument();
    });
  });

  describe('timer and event handlers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('updates time every 30 seconds via interval', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);

      // Advance time by 30 seconds to trigger interval
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      // Component should still be rendered without errors
      expect(screen.getByText('M31')).toBeInTheDocument();
    });

    it('cleans up interval on unmount', () => {
      const { unmount } = render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      unmount();
      // No errors means cleanup worked
      jest.advanceTimersByTime(60000);
    });

    it('stops event propagation for mouse events on panel', () => {
      render(<InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />);
      const card = screen.getAllByTestId('card')[0];

      // Ensure all panel-level handlers execute (pointer/mouse/double-click/wheel)
      fireEvent.pointerDown(card);
      fireEvent.mouseDown(card);
      fireEvent.doubleClick(card);
      fireEvent.wheel(card);

      // No crash means handlers are wired and safe to invoke
      expect(card).toBeInTheDocument();
    });
  });

  describe('adaptive positioning', () => {
    it('uses fixed positioning when clickPosition and containerBounds are provided', () => {
      render(
        <InfoPanel
          {...defaultProps}
          selectedObject={mockSelectedObject}
          clickPosition={{ x: 100, y: 200 }}
          containerBounds={{ width: 800, height: 600 }}
        />
      );
      const card = screen.getAllByTestId('card')[0];
      expect(card.className).toContain('fixed');
    });

    it('does not use fixed positioning without clickPosition', () => {
      render(
        <InfoPanel {...defaultProps} selectedObject={mockSelectedObject} />
      );
      const card = screen.getAllByTestId('card')[0];
      expect(card.className).not.toContain('fixed');
    });
  });

  describe('object without optional fields', () => {
    it('renders without magnitude', () => {
      const obj = { ...mockSelectedObject, magnitude: undefined };
      render(<InfoPanel {...defaultProps} selectedObject={obj} />);
      expect(screen.getByText('M31')).toBeInTheDocument();
    });

    it('renders without size', () => {
      const obj = { ...mockSelectedObject, size: undefined };
      render(<InfoPanel {...defaultProps} selectedObject={obj} />);
      expect(screen.getByText('M31')).toBeInTheDocument();
    });

    it('renders without constellation', () => {
      const obj = { ...mockSelectedObject, constellation: undefined };
      render(<InfoPanel {...defaultProps} selectedObject={obj} />);
      expect(screen.queryByText('coordinates.constellation')).not.toBeInTheDocument();
    });

    it('renders with single name (no secondary names)', () => {
      const obj = { ...mockSelectedObject, names: ['M31'] };
      render(<InfoPanel {...defaultProps} selectedObject={obj} />);
      expect(screen.getByText('M31')).toBeInTheDocument();
    });
  });
});


