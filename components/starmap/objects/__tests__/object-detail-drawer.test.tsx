/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Mock services
jest.mock('@/lib/services/object-info-service', () => ({
  getCachedObjectInfo: jest.fn(),
  enhanceObjectInfo: jest.fn(),
  updateCachedObjectInfo: jest.fn(),
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  openExternalUrl: jest.fn(),
}));

import { getCachedObjectInfo, enhanceObjectInfo, updateCachedObjectInfo } from '@/lib/services/object-info-service';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { clipboardService } from '@/lib/services/clipboard-service';

const mockGetCachedObjectInfo = getCachedObjectInfo as jest.Mock;
const mockEnhanceObjectInfo = enhanceObjectInfo as jest.Mock;
const mockUpdateCachedObjectInfo = updateCachedObjectInfo as jest.Mock;
const mockOpenExternalUrl = openExternalUrl as jest.Mock;

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
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    open ? (
      <div data-testid="drawer" data-open={open}>
        <button data-testid="drawer-close-btn" onClick={() => onOpenChange?.(false)}>
          Close
        </button>
        {children}
      </div>
    ) : null
  ),
  DrawerContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-content" className={className}>{children}</div>
  ),
  DrawerHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="drawer-header" className={className}>{children}</div>
  ),
  DrawerTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="drawer-title" className={className}>{children}</h2>
  ),
  DrawerClose: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="drawer-close">{children}</div>
  ),
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
  }: {
    children: React.ReactNode;
    value: string;
  }) => <div data-testid={`tabs-content-${value}`}>{children}</div>,
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

import { ObjectDetailDrawer } from '../object-detail-drawer';
import type { SelectedObjectData } from '@/lib/core/types';

const mockSelectedObject: SelectedObjectData = {
  names: ['M31', 'NGC 224', 'Andromeda Galaxy'],
  ra: '00h 42m 44.3s',
  dec: '+41° 16\' 09"',
  raDeg: 10.685,
  decDeg: 41.269,
  type: 'galaxy',
  magnitude: 3.4,
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
  images: [{ url: 'https://example.com/m31.jpg', source: 'NASA' }],
  sources: ['SIMBAD', 'Wikipedia'],
};

describe('ObjectDetailDrawer', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSetFramingCoordinates = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
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
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
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
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
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
        expect(screen.getByText('SIMBAD')).toBeInTheDocument();
        expect(screen.getByText('Wikipedia')).toBeInTheDocument();
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
        expect(screen.getByText('SIMBAD')).toBeInTheDocument();
        expect(screen.getByText('Wikipedia')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('SIMBAD'));
        fireEvent.click(screen.getByText('Wikipedia'));
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
      const planning = screen.getByTestId('object-drawer-section-planning-metrics');
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

      expect(screen.getByText('objectDetail.frameTimeScale')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.qualityEop')).toBeInTheDocument();
      expect(screen.getByText('objectDetail.timestamp')).toBeInTheDocument();
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

      await act(async () => {
        fireEvent.click(screen.getByText('common.copy'));
      });

      expect(writeTextSpy).toHaveBeenCalledWith(
        `RA: ${mockSelectedObject.ra}\nDec: ${mockSelectedObject.dec}`
      );

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
        fireEvent.click(screen.getByText('common.copy'));
      });

      expect(writeTextSpy).toHaveBeenCalled();
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
});
