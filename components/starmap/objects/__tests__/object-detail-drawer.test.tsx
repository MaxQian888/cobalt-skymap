/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';

// Mock services
jest.mock('@/lib/services/object-info-service', () => ({
  getCachedObjectInfo: jest.fn(),
  enhanceObjectInfo: jest.fn(),
  updateCachedObjectInfo: jest.fn(),
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  openExternalUrl: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  __mockLogger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: jest.fn(() => {
    const loggerModule = jest.requireMock('@/lib/logger') as {
      __mockLogger: {
        warn: jest.Mock;
        error: jest.Mock;
        info: jest.Mock;
        debug: jest.Mock;
      };
    };
    return loggerModule.__mockLogger;
  }),
}));

import { getCachedObjectInfo, enhanceObjectInfo, updateCachedObjectInfo } from '@/lib/services/object-info-service';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { clipboardService } from '@/lib/services/clipboard-service';
import { createLogger } from '@/lib/logger';

const mockGetCachedObjectInfo = getCachedObjectInfo as jest.Mock;
const mockEnhanceObjectInfo = enhanceObjectInfo as jest.Mock;
const mockUpdateCachedObjectInfo = updateCachedObjectInfo as jest.Mock;
const mockOpenExternalUrl = openExternalUrl as jest.Mock;
const _mockCreateLogger = createLogger as jest.Mock;
const mockLoggerModule = jest.requireMock('@/lib/logger') as {
  __mockLogger: {
    warn: jest.Mock;
    error: jest.Mock;
    info: jest.Mock;
    debug: jest.Mock;
  };
};

function getDrawerLogger() {
  return mockLoggerModule.__mockLogger;
}

// Mock astronomy utils
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  raDecToAltAz: jest.fn(() => ({ altitude: 45, azimuth: 180 })),
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  getMoonPosition: jest.fn(() => ({ ra: 100, dec: 20 })),
  angularSeparation: jest.fn(() => 60),
  calculateTargetVisibility: jest.fn(() => ({
    isCircumpolar: false,
    riseTime: new Date(),
    transitTime: new Date(),
    setTime: new Date(),
    transitAltitude: 70,
    darkImagingHours: 4,
  })),
  calculateImagingFeasibility: jest.fn(() => ({
    score: 85,
    recommendation: 'good',
    moonScore: 90,
    altitudeScore: 80,
    durationScore: 85,
  })),
  formatTimeShort: jest.fn((date) => date ? '22:00' : '--:--'),
  getAltitudeOverTime: jest.fn(() => Array.from({ length: 24 }, (_, i) => ({ hour: i, altitude: 30 + Math.sin(i / 4) * 40 }))),
  getTransitTime: jest.fn(() => new Date()),
}));

// Mock hooks
jest.mock('@/lib/hooks', () => ({
  useCelestialName: jest.fn((name) => name),
  useAstroEnvironment: jest.fn(() => ({
    moonPhaseName: 'First Quarter',
    moonIllumination: 50,
    moonAltitude: 30,
    moonRa: 100,
    moonDec: 20,
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
    moonDistance: 60,
    visibility: {
      isCircumpolar: false,
      riseTime: new Date(),
      transitTime: new Date(),
      setTime: new Date(),
      transitAltitude: 70,
      darkImagingHours: 4,
    },
    feasibility: {
      score: 85,
      recommendation: 'good',
      moonScore: 90,
      altitudeScore: 80,
      durationScore: 85,
      twilightScore: 90,
      warnings: [],
    },
  })),
  useObjectActions: jest.fn(() => ({
    handleSlew: jest.fn(),
    handleAddToList: jest.fn(),
    mountConnected: false,
  })),
  useHorizonsEphemeris: jest.fn(() => ({ row: null, loading: false, error: null })),
}));

// Mock stores
jest.mock('@/lib/stores', () => ({
  useMountStore: jest.fn((selector) => {
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
  }),
  useTargetListStore: jest.fn((selector) => {
    const state = {
      addTarget: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

import { useMountStore, useTargetListStore } from '@/lib/stores';
import { useObjectActions } from '@/lib/hooks';

const mockUseMountStore = useMountStore as unknown as jest.Mock;
const mockUseTargetListStore = useTargetListStore as unknown as jest.Mock;
const mockUseObjectActions = useObjectActions as unknown as jest.Mock;

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({
    children,
    open,
    onOpenChange,
    direction,
    snapPoints,
    activeSnapPoint,
    modal,
    snapToSequentialPoint,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    direction?: string;
    snapPoints?: (number | string)[];
    activeSnapPoint?: number | string | null;
    modal?: boolean;
    snapToSequentialPoint?: boolean;
  }) => (
    open ? (
      <div
        data-testid="drawer"
        data-open={open}
        data-direction={direction}
        data-snap-points={snapPoints ? JSON.stringify(snapPoints) : undefined}
        data-active-snap={activeSnapPoint ?? undefined}
        data-modal={modal === undefined ? undefined : String(modal)}
        data-snap-sequential={snapToSequentialPoint ? 'true' : undefined}
      >
        <button data-testid="drawer-close-btn" onClick={() => onOpenChange?.(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null
  ),
  DrawerContent: ({ children, className, ...props }: { children: React.ReactNode; className?: string } & Record<string, unknown>) => (
    <div
      data-testid="drawer-content"
      className={className}
      data-shell={props['data-shell'] as string | undefined}
      data-peeking={props['data-peeking'] as string | undefined}
    >
      {children}
    </div>
  ),
  DrawerHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-header" className={className}>{children}</div>
  ),
  DrawerFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-footer" data-slot="drawer-footer" className={className}>{children}</div>
  ),
  DrawerTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="drawer-title" className={className}>{children}</h2>
  ),
  DrawerDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <p data-testid="drawer-description" className={className}>{children}</p>
  ),
  DrawerClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="drawer-close">{children}</div>
  ),
}));

// Controllable shell decision — defaults to the mobile (bottom-sheet) shell.
let mockIsMobileShell = true;
jest.mock('@/components/starmap/view/use-mobile-shell', () => ({
  useMobileShell: () => ({
    isMobileShell: mockIsMobileShell,
    isLandscape: false,
    viewportWidth: mockIsMobileShell ? 390 : 1440,
    viewportHeight: mockIsMobileShell ? 844 : 900,
  }),
}));

// Render the dropdown menu inline so its items are directly queryable.
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button data-testid="dropdown-item" onClick={() => onSelect?.()}>{children}</button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: ({ className }: { className?: string }) => <hr data-testid="separator" className={className} />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card" data-slot="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card-header" data-slot="card-header" className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card-title" data-slot="card-title" className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card-content" data-slot="card-content" className={className} {...props}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    children,
    defaultValue,
  }: {
    children: React.ReactNode;
    defaultValue?: string;
  }) => <div data-testid="tabs" data-default-value={defaultValue}>{children}</div>,
  TabsContent: ({
    children,
    value,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
  } & React.HTMLAttributes<HTMLDivElement>) => <div data-testid={`tabs-content-${value}`} {...props}>{children}</div>,
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="tabs-list" className={className}>{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
    className,
  }: {
    children: React.ReactNode;
    value: string;
    className?: string;
  }) => (
    <button data-testid={`tab-${value}`} className={className}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

// Mock ObjectImageGallery
jest.mock('../object-image-gallery', () => ({
  ObjectImageGallery: ({ images, objectName }: { images?: unknown[]; objectName: string }) => (
    <div data-testid="object-image-gallery" data-object-name={objectName}>
      {images?.length || 0} images
    </div>
  ),
}));

jest.mock('../altitude-chart-compact', () => ({
  AltitudeChartCompact: ({ ra, dec }: { ra: number; dec: number }) => (
    <div data-testid="altitude-chart-compact" data-ra={ra} data-dec={dec} />
  ),
}));

jest.mock('../satellite-info-notice', () => ({
  SatelliteInfoNotice: ({ noradId }: { noradId: number | null }) => (
    <div data-testid="satellite-info-notice" data-norad={noradId ?? ''} />
  ),
}));

import { ObjectDetailDrawer } from '../object-detail-drawer';
import type { SelectedObjectData } from '@/lib/core/types';
import { formatRA, formatDec } from '@/lib/astronomy/coordinates/formats';

const mockSelectedObject: SelectedObjectData = {
  names: ['M31', 'NGC 224', 'Andromeda Galaxy'],
  ra: '00h 42m 44.3s',
  dec: '+41° 16\' 09"',
  raDeg: 10.685,
  decDeg: 41.269,
  type: 'galaxy',
  magnitude: 3.4,
  selectionSource: 'enriched',
  selectionFallback: 'resolved',
  sourceCatalog: 'SIMBAD',
};

const mockObjectInfo = {
  names: ['M31', 'NGC 224'],
  type: 'Spiral Galaxy',
  typeCategory: 'galaxy',
  magnitude: 3.4,
  angularSize: "178' × 63'",
  description: 'The Andromeda Galaxy is a barred spiral galaxy.',
  distance: '2.537 million light-years',
  morphologicalType: 'SA(s)b',
  spectralType: null,
  simbadUrl: 'https://simbad.u-strasbg.fr/simbad/sim-id?Ident=M31',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Andromeda_Galaxy',
  images: [{ url: 'https://example.com/m31.jpg', source: 'NASA', availability: 'degraded', authorityLevel: 'reference' }],
  sources: ['SIMBAD', 'Wikipedia'],
  provenance: {
    description: {
      acceptedSource: 'Wikipedia',
      authorityLevel: 'reference',
      contributors: ['Local', 'Wikipedia'],
    },
    physical: {
      acceptedSource: 'SIMBAD',
      authorityLevel: 'authoritative',
      contributors: ['SIMBAD'],
    },
    images: {
      acceptedSource: 'NASA',
      authorityLevel: 'reference',
      contributors: ['NASA', 'Local'],
    },
  },
  diagnostics: [
    {
      providerId: 'sbdb',
      status: 'unsupported',
      fieldGroup: 'physical',
    },
    {
      providerId: 'dss',
      status: 'error',
      fieldGroup: 'images',
    },
  ],
};

describe('ObjectDetailDrawer', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSetFramingCoordinates = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobileShell = true;
    useMapInteractionStore.getState().reset();
    getDrawerLogger().warn.mockClear();
    getDrawerLogger().error.mockClear();
    getDrawerLogger().info.mockClear();
    getDrawerLogger().debug.mockClear();

    mockGetCachedObjectInfo.mockResolvedValue(mockObjectInfo);
    mockEnhanceObjectInfo.mockResolvedValue(mockObjectInfo);
    mockUpdateCachedObjectInfo.mockImplementation(() => {});
    mockOpenExternalUrl.mockImplementation(() => {});
    
    mockUseMountStore.mockImplementation((selector) => {
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
    
    const mockAddTarget = jest.fn();
    mockUseTargetListStore.mockImplementation((selector) => {
      const state = { addTarget: mockAddTarget };
      return selector ? selector(state) : state;
    });
  });

  describe('Rendering', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <ObjectDetailDrawer
          open={false}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders drawer when open', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    it('renders drawer content', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-content')).toBeInTheDocument();
    });

    it('renders drawer header', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-header')).toBeInTheDocument();
    });

    it('renders object name in title', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText('M31')).toBeInTheDocument();
    });

    it('renders alternate names', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/NGC 224/)).toBeInTheDocument();
    });

    it('renders tabs', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('tabs')).toBeInTheDocument();
      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-images')).toBeInTheDocument();
      expect(screen.getByTestId('tab-observation')).toBeInTheDocument();
    });

    it('uses a mobile-safe drawer content shell', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-content')).toHaveClass(
        'min-h-0',
        'w-full',
        'max-h-[calc(100dvh-var(--safe-area-top)-0.5rem)]'
      );
      expect(screen.getByTestId('scroll-area')).toHaveClass('min-h-0', 'overscroll-contain');
    });

    it('docks to the right as a side panel on the desktop shell', async () => {
      mockIsMobileShell = false;
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      // Right-docked side panel: full height + comfortable max width, not the
      // bottom-sheet max-height clamp.
      const content = screen.getByTestId('drawer-content');
      expect(content).toHaveClass('h-full', 'sm:max-w-md');
      expect(content).not.toHaveClass('max-h-[calc(100dvh-var(--safe-area-top)-0.5rem)]');

      // Desktop dock is modal with no snap points.
      const drawer = screen.getByTestId('drawer');
      expect(drawer).not.toHaveAttribute('data-snap-points');
      expect(drawer).not.toHaveAttribute('data-modal');
    });

    it('opens the mobile sheet at the peek detent with the sky interactive', async () => {
      mockIsMobileShell = true;
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const drawer = screen.getByTestId('drawer');
      expect(drawer).toHaveAttribute('data-snap-points', JSON.stringify([0.45, 1]));
      expect(drawer).toHaveAttribute('data-active-snap', '0.45');
      expect(drawer).toHaveAttribute('data-modal', 'false');
      expect(drawer).toHaveAttribute('data-snap-sequential', 'true');

      // While peeking, the inner scroll is locked so drags move the sheet.
      const content = screen.getByTestId('drawer-content');
      expect(content).toHaveAttribute('data-peeking', 'true');
      expect(content).toHaveClass('h-full');
    });
  });

  describe('Object Info Loading', () => {
    it('shows loading state initially', async () => {
      mockGetCachedObjectInfo.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockObjectInfo), 1000))
      );

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      // Loading spinner should be visible
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
    });

    it('loads object info when drawer opens', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalledWith(
          mockSelectedObject.names,
          mockSelectedObject.raDeg,
          mockSelectedObject.decDeg,
          mockSelectedObject.ra,
          mockSelectedObject.dec,
          {
            type: mockSelectedObject.type,
            magnitude: mockSelectedObject.magnitude,
            size: mockSelectedObject.size,
            constellation: mockSelectedObject.constellation,
          }
        );
      });
    });

    it('enhances object info after initial load', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockEnhanceObjectInfo).toHaveBeenCalledWith(mockObjectInfo, expect.any(AbortSignal));
      });
    });

    it('handles load error gracefully', async () => {
      mockGetCachedObjectInfo.mockRejectedValue(new Error('Load failed'));

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getDrawerLogger().error).toHaveBeenCalledWith('Failed to load object info', expect.any(Error));
      });
    });
  });

  describe('Object Info Display', () => {
    it('displays object type badge', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Spiral Galaxy')).toBeInTheDocument();
      });
    });

    it('displays magnitude badge', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/3\.4/)).toBeInTheDocument();
      });
    });

    it('displays angular size', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText("178' × 63'")).toBeInTheDocument();
      });
    });

    it('displays description', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/Andromeda Galaxy is a barred spiral galaxy/)).toBeInTheDocument();
      });
    });

    it('displays coordinates', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(mockSelectedObject.ra)).toBeInTheDocument();
      expect(screen.getByText(mockSelectedObject.dec)).toBeInTheDocument();
    });

    it('displays external links', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getAllByText('SIMBAD').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Wikipedia').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('opens external links when clicked', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('SIMBAD').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Wikipedia').length).toBeGreaterThanOrEqual(1);
      });

      const simbadButton = screen.getAllByRole('button').find((button) => button.textContent?.includes('SIMBAD'));
      const wikipediaButton = screen.getAllByRole('button').find((button) => button.textContent?.includes('Wikipedia'));

      await act(async () => {
        fireEvent.click(simbadButton!);
        fireEvent.click(wikipediaButton!);
      });

      expect(mockOpenExternalUrl).toHaveBeenCalledWith(mockObjectInfo.simbadUrl);
      expect(mockOpenExternalUrl).toHaveBeenCalledWith(mockObjectInfo.wikipediaUrl);
    });

    it('displays data sources', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText(/SIMBAD, Wikipedia/)).toBeInTheDocument();
      });
    });

    it('displays accepted source provenance for object information', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText('objectDetail.acceptedSource')).toBeInTheDocument();
      expect(screen.getAllByText('Wikipedia').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('objectDetail.sourceAuthority.reference')).toBeInTheDocument();
    });

    it('displays degraded and unsupported source diagnostics', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText('objectDetail.unsupportedSourceState')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.degradedSourceState')).toBeInTheDocument();
    });
  });

  describe('Astronomical Data', () => {
    it('displays current altitude', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/45\.0°/)).toBeInTheDocument();
    });

    it('displays azimuth', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/180\.0°/)).toBeInTheDocument();
    });

    it('displays feasibility score', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      // Multiple elements may have the score, just check at least one exists
      expect(screen.getAllByText(/85\/100/).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('section hierarchy and localization', () => {
    it('renders canonical section order in overview tab', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const identity = screen.getByTestId('object-drawer-section-identity');
      const live = screen.getByTestId('object-drawer-section-live-status');
      const planning = screen.getByTestId('object-drawer-section-planning');
      const advanced = screen.getByTestId('object-drawer-section-advanced-metadata');

      expect(identity.compareDocumentPosition(live) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(live.compareDocumentPosition(planning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(planning.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('uses localized keys for advanced metadata labels', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const advanced = screen.getByTestId('object-drawer-section-advanced-metadata');
      expect(screen.getByText('objectDetail.systemMetadata')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.frameTimeScale')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.qualityEop')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.calculationSummary')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.timestamp')).toBeInTheDocument();
      expect(advanced).toHaveTextContent('objectDetail.calculationSource.calculation');
      expect(advanced).toHaveTextContent('objectDetail.calculationState.normal');
    });

    it('renders selection source semantics for coordinate fallback objects', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={{
            ...mockSelectedObject,
            names: ['00h 42m 44.3s +41° 16\' 09"'],
            selectionSource: 'coordinate',
            selectionFallback: 'coordinate_fallback',
            sourceCatalog: null,
          }}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getAllByText('objectDetail.selectionSource.coordinate').length).toBeGreaterThan(0);
      expect(screen.getAllByText('objectDetail.selectionFallback.coordinate_fallback').length).toBeGreaterThan(0);
    });

    it('keeps shared core metrics formatted consistently across sections', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getAllByText('45.0°').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('180.0°').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('60°').length).toBeGreaterThanOrEqual(1);
    });

    it('separates overview summary from observation planning detail', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getAllByText('objectDetail.tonightSummary').length).toBeGreaterThan(0);
      expect(screen.getByTestId('object-drawer-observation-tab')).toHaveTextContent('session.moonDistance');
      expect(screen.getByTestId('object-drawer-observation-tab')).toHaveTextContent('session.maxAltitude');
    });

    it('renders overview information blocks with shadcn card surfaces', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('object-drawer-summary-card')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-identity')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-live-status')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-planning')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-advanced-metadata')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-properties')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-section-links')).toHaveAttribute('data-slot', 'card');
    });

    it('does not expose raw advanced metadata literals', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.queryByText('Calc')).not.toBeInTheDocument();
      expect(screen.queryByText('degraded')).not.toBeInTheDocument();
    });
  });

  describe('continuity context', () => {
    it('shows the active observing-site context in the detail drawer when continuity data exists', async () => {
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
        ra: '00h 42m 44.3s',
        dec: '+41° 16\' 09"',
        raDeg: 10.685,
        decDeg: 41.269,
        type: 'galaxy',
        sourceQuality: 'normal',
        siteName: 'Tokyo',
        siteCoordinates: { latitude: 35.6762, longitude: 139.6503 },
      });

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/starmap\.context\.activeSite/)).toBeInTheDocument();
      expect(screen.getByText(/Tokyo/)).toBeInTheDocument();
    });
  });

  describe('Images Tab', () => {
    it('renders image gallery component', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByTestId('object-image-gallery')).toBeInTheDocument();
      });
    });

    it('passes correct props to image gallery', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        const gallery = screen.getByTestId('object-image-gallery');
        expect(gallery).toHaveAttribute('data-object-name', 'M31');
      });
    });
  });

  describe('Action Buttons', () => {
    it('renders action area inside drawer footer surface', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-footer')).toHaveAttribute('data-slot', 'drawer-footer');
    });

    it('uses a stacked mobile footer layout with safe-area padding', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-footer')).toHaveClass(
        'sticky',
        'bottom-0',
        'pb-[calc(var(--safe-area-bottom)+0.75rem)]'
      );

      const addButton = screen.getByText(/actions\.addToTargetList/);
      expect(addButton).toHaveClass('w-full', 'shell-desktop:flex-1');
    });

    it('renders add to target list button', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/actions\.addToTargetList/)).toBeInTheDocument();
    });

    it('does not render slew button when mount not connected', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.queryByText(/actions\.slewToObject/)).not.toBeInTheDocument();
    });

    it('renders slew button when mount connected', async () => {
      mockUseObjectActions.mockReturnValue({
        handleSlew: jest.fn(),
        handleAddToList: jest.fn(),
        mountConnected: true,
      });

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByText(/actions\.slewToObject/)).toBeInTheDocument();
    });

    it('calls handleAddToList when add button clicked', async () => {
      const mockHandleAddToList = jest.fn();
      mockUseObjectActions.mockReturnValue({
        handleSlew: jest.fn(),
        handleAddToList: mockHandleAddToList,
        mountConnected: false,
      });

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const addButton = screen.getByText(/actions\.addToTargetList/);
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(mockHandleAddToList).toHaveBeenCalled();
    });

    it('calls handleSlew when slew button clicked', async () => {
      const mockHandleSlew = jest.fn();
      mockUseObjectActions.mockReturnValue({
        handleSlew: mockHandleSlew,
        handleAddToList: jest.fn(),
        mountConnected: true,
      });

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
          onSetFramingCoordinates={mockOnSetFramingCoordinates}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const slewButton = screen.getByText(/actions\.slewToObject/);
      await act(async () => {
        fireEvent.click(slewButton);
      });

      expect(mockHandleSlew).toHaveBeenCalled();
    });

    it('invokes onAfterSlew callback to close drawer', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockUseObjectActions).toHaveBeenCalled();
      });

      const options = mockUseObjectActions.mock.calls.at(-1)?.[0];
      expect(typeof options?.onAfterSlew).toBe('function');

      await act(async () => {
        options.onAfterSlew();
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Close Functionality', () => {
    it('calls onOpenChange when close button clicked', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const closeButton = screen.getByTestId('drawer-close-btn');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Copy Coordinates', () => {
    it('renders copy button', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('common.copy')).toBeInTheDocument();
      });
    });

    it('copies coordinates to clipboard', async () => {
      const writeTextSpy = jest.spyOn(clipboardService, 'writeText').mockResolvedValue(undefined);

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('common.copy')).toBeInTheDocument();
      });

      // Pick the sexagesimal (HMS/DMS) format from the copy menu.
      await act(async () => {
        fireEvent.click(screen.getByText('coordinates.formatHms'));
      });

      const expectedRa = formatRA(mockSelectedObject.raDeg);
      const expectedDec = formatDec(mockSelectedObject.decDeg);
      expect(writeTextSpy).toHaveBeenCalledWith(`RA: ${expectedRa}\nDec: ${expectedDec}`);

      writeTextSpy.mockRestore();
    });

    it('handles clipboard write failure without crashing', async () => {
      const writeTextSpy = jest.spyOn(clipboardService, 'writeText').mockRejectedValue(new Error('clipboard denied'));

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('coordinates.formatHms'));
      });

      expect(writeTextSpy).toHaveBeenCalled();
      expect(getDrawerLogger().warn).toHaveBeenCalledWith('Failed to copy coordinates', expect.any(Error));
      expect(screen.getByText('common.copy')).toBeInTheDocument();
      writeTextSpy.mockRestore();
    });
  });

  describe('Timer Updates', () => {
    it('updates periodically when drawer is open', async () => {
      jest.useFakeTimers();

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await act(async () => {
        jest.advanceTimersByTime(30000);
      });

      expect(screen.getByTestId('drawer')).toBeInTheDocument();
      jest.useRealTimers();
    });
  });

  describe('Physical Properties', () => {
    it('displays morphological type', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('SA(s)b')).toBeInTheDocument();
      });
    });

    it('displays distance', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('2.537 million light-years')).toBeInTheDocument();
      });
    });

    it('hides properties section when no properties available', async () => {
      const infoWithoutProps = {
        ...mockObjectInfo,
        distance: undefined,
        morphologicalType: undefined,
        spectralType: undefined,
      };
      mockGetCachedObjectInfo.mockResolvedValue(infoWithoutProps);
      mockEnhanceObjectInfo.mockResolvedValue(infoWithoutProps);

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      // Wait for enhanceObjectInfo to complete
      await waitFor(() => {
        expect(mockEnhanceObjectInfo).toHaveBeenCalled();
      });

      expect(screen.queryByText('objectDetail.properties')).not.toBeInTheDocument();
    });
  });

  describe('Observation Tab Data', () => {
    it('displays moon distance', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getAllByText('60°').length).toBeGreaterThanOrEqual(1);
    });

    it('renders observation tab metrics on shadcn card surfaces', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('object-drawer-observation-visibility-card')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-observation-summary-card')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-observation-feasibility-card')).toHaveAttribute('data-slot', 'card');
      expect(screen.getByTestId('object-drawer-observation-chart-card')).toHaveAttribute('data-slot', 'card');
    });
  });

  describe('Null Object Handling', () => {
    it('handles null selectedObject gracefully', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={null}
        />
      );

      // When selectedObject is null, getCachedObjectInfo should not be called
      expect(mockGetCachedObjectInfo).not.toHaveBeenCalled();

      expect(screen.getByTestId('drawer')).toBeInTheDocument();
      expect(screen.getByText('common.unknown')).toBeInTheDocument();
    });

    it('auto-closes drawer when open and selectedObject becomes null', async () => {
      const { rerender } = render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      // Initial render with valid object - should not close
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false);

      // Re-render with null selectedObject while still open
      rerender(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={null}
        />
      );

      // Should trigger auto-close
      await waitFor(() => {
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('does not trigger close when drawer is already closed', () => {
      render(
        <ObjectDetailDrawer
          open={false}
          onOpenChange={mockOnOpenChange}
          selectedObject={null}
        />
      );

      // Should not call onOpenChange when drawer is already closed
      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Load Errors and Images States', () => {
    it('surfaces a load-error banner and retries on demand', async () => {
      mockGetCachedObjectInfo.mockRejectedValueOnce(new Error('network down'));

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('object-drawer-load-error')).toBeInTheDocument();
      });
      expect(getDrawerLogger().error).toHaveBeenCalled();

      // Retry re-runs the load effect (fresh fetch).
      const initialCalls = mockGetCachedObjectInfo.mock.calls.length;
      const banner = screen.getByTestId('object-drawer-load-error');
      fireEvent.click(banner.querySelector('button')!);

      await waitFor(() => {
        expect(mockGetCachedObjectInfo.mock.calls.length).toBeGreaterThan(initialCalls);
      });
      await waitFor(() => {
        expect(screen.queryByTestId('object-drawer-load-error')).not.toBeInTheDocument();
      });
    });

    it('shows an error state with retry in the images tab when info failed', async () => {
      mockGetCachedObjectInfo.mockRejectedValueOnce(new Error('network down'));

      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('object-drawer-images-error')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('object-image-gallery')).not.toBeInTheDocument();
    });

    it('describes the object in the accessible drawer description', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={mockSelectedObject}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      expect(screen.getByTestId('drawer-description')).toHaveTextContent('objectDetail.drawerDescription');
    });
  });

  describe('Satellite Selections', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useTargetAstroData } = require('@/lib/hooks');
    const mockUseTargetAstroData = useTargetAstroData as jest.Mock;
    let originalImpl: (() => unknown) | undefined;

    beforeEach(() => {
      originalImpl = mockUseTargetAstroData.getMockImplementation();
      mockUseTargetAstroData.mockReturnValue({
        altitude: 45,
        azimuth: 180,
        moonDistance: 60,
        visibility: null,
        feasibility: null,
        targetKind: 'satellite',
        positionIsSnapshot: true,
        noradId: 25544,
        positionAt: () => ({ raDeg: 0, decDeg: 0 }),
        riskHints: [],
      });
    });

    afterEach(() => {
      mockUseTargetAstroData.mockImplementation(originalImpl);
    });

    it('replaces position/planning cards with the satellite notice', async () => {
      render(
        <ObjectDetailDrawer
          open={true}
          onOpenChange={mockOnOpenChange}
          selectedObject={{ ...mockSelectedObject, names: ['NORAD 25544', 'NAME ISS (ZARYA)'] }}
        />
      );

      await waitFor(() => {
        expect(mockGetCachedObjectInfo).toHaveBeenCalled();
      });

      const notices = screen.getAllByTestId('satellite-info-notice');
      expect(notices.length).toBeGreaterThan(0);
      expect(notices[0]).toHaveAttribute('data-norad', '25544');
      expect(screen.queryByTestId('object-drawer-section-live-status')).not.toBeInTheDocument();
      expect(screen.queryByTestId('object-drawer-section-planning')).not.toBeInTheDocument();
      expect(screen.queryByTestId('altitude-chart-compact')).not.toBeInTheDocument();
    });
  });
});
