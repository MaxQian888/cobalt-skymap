/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

// Mock stores
let mountState: {
  mountInfo: {
    Connected: boolean;
    Coordinates: { RADegrees: number; Dec: number };
    Tracking?: boolean;
    Slewing?: boolean;
    Parked?: boolean;
    PierSide?: string;
    TrackMode?: string;
    SlewRateIndex?: number;
    AtHome?: boolean;
  };
  profileInfo: { AstrometrySettings: { Latitude: number; Longitude: number; Elevation: number } };
  capabilities: {
    canSlew: boolean;
    canSlewAsync: boolean;
    canSync: boolean;
    canPark: boolean;
    canUnpark: boolean;
    canSetTracking: boolean;
    canMoveAxis: boolean;
    canPulseGuide: boolean;
    alignmentMode: string;
    equatorialSystem: string;
  };
  actionAvailability?: {
    park?: boolean;
    tracking?: boolean;
    trackingRate?: boolean;
    abortSlew?: boolean;
  };
  selectedDevice?: {
    id: string;
    name: string;
  } | null;
  connectionConfig: {
    protocol: string;
    host: string;
    port: number;
    deviceId: number;
    selectedDeviceId?: string | null;
  };
} = {
  mountInfo: {
    Connected: false,
    Coordinates: {
      RADegrees: 0,
      Dec: 0,
    },
  },
  profileInfo: {
    AstrometrySettings: {
      Latitude: 0,
      Longitude: 0,
      Elevation: 0,
    },
  },
  capabilities: {
    canSlew: false,
    canSlewAsync: false,
    canSync: false,
    canPark: false,
    canUnpark: false,
    canSetTracking: false,
    canMoveAxis: false,
    canPulseGuide: false,
    alignmentMode: '',
    equatorialSystem: '',
  },
  actionAvailability: {},
  selectedDevice: null,
  connectionConfig: {
    protocol: 'simulator',
    host: 'localhost',
    port: 11111,
    deviceId: 0,
    selectedDeviceId: 'simulator://builtin',
  },
};

const mockUseMountStore = jest.fn((selector) => {
  return selector ? selector(mountState) : mountState;
});

const mockUseStellariumStore = jest.fn((selector) => {
  const stellariumState = { stel: null, isReady: true };
  return selector ? selector(stellariumState) : stellariumState;
});

jest.mock('@/lib/stores', () => {
  const store = (selector: (state: unknown) => unknown) => mockUseMountStore(selector);
  store.getState = () => mountState;
  return {
    useMountStore: store,
    useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  };
});

// Mock hooks
jest.mock('@/lib/hooks/use-mount-polling', () => ({
  useMountPolling: jest.fn(),
}));

const mockToggleAutoSync = jest.fn();
const mockSyncViewToMount = jest.fn();
const mountOverlayReturn = {
  connected: false,
  raDegree: 0,
  decDegree: 0,
  effectiveAutoSync: false,
  toggleAutoSync: mockToggleAutoSync,
  syncViewToMount: mockSyncViewToMount,
  altAz: null as { alt: number; az: number } | null,
  tracking: false,
  slewing: false,
  parked: false,
  pierSide: undefined as 'east' | 'west' | 'unknown' | undefined,
};

jest.mock('@/lib/hooks/use-mount-overlay', () => ({
  useMountOverlay: () => mountOverlayReturn,
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: jest.fn(() => '00h 00m 00s'),
  degreesToDMS: jest.fn(() => '+00° 00\' 00"'),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => <div role="menuitem" onClick={onClick} className={className}>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

const mockSetTracking = jest.fn().mockResolvedValue(undefined);
const mockPark = jest.fn().mockResolvedValue(undefined);
const mockUnpark = jest.fn().mockResolvedValue(undefined);
const mockAbortSlew = jest.fn().mockResolvedValue(undefined);
const mockSetTrackingRate = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/tauri/mount-api', () => ({
  mountApi: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    getState: jest.fn(),
    getCapabilities: jest.fn(),
    setTracking: (...args: unknown[]) => mockSetTracking(...args),
    park: (...args: unknown[]) => mockPark(...args),
    unpark: (...args: unknown[]) => mockUnpark(...args),
    abortSlew: (...args: unknown[]) => mockAbortSlew(...args),
    moveAxis: jest.fn(),
    stopAxis: jest.fn(),
    setSlewRate: jest.fn(),
    discover: jest.fn(),
    slewTo: jest.fn(),
    syncTo: jest.fn(),
    setTrackingRate: (...args: unknown[]) => mockSetTrackingRate(...args),
  },
  SLEW_RATE_PRESETS: [
    { label: '1x', value: 1 },
    { label: '16x', value: 16 },
  ],
}));

const mockIsTauri = jest.fn(() => false);
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import { StellariumMount } from '../stellarium-mount';

describe('StellariumMount', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mountState = {
      mountInfo: {
        Connected: false,
        Coordinates: {
          RADegrees: 0,
          Dec: 0,
        },
      },
      profileInfo: {
        AstrometrySettings: {
          Latitude: 0,
          Longitude: 0,
          Elevation: 0,
        },
      },
      capabilities: {
        canSlew: false,
        canSlewAsync: false,
        canSync: false,
        canPark: false,
        canUnpark: false,
        canSetTracking: false,
        canMoveAxis: false,
        canPulseGuide: false,
        alignmentMode: '',
        equatorialSystem: '',
      },
      actionAvailability: {},
      selectedDevice: null,
      connectionConfig: {
        protocol: 'simulator',
        host: 'localhost',
        port: 11111,
        deviceId: 0,
        selectedDeviceId: 'simulator://builtin',
      },
    };

    // Reset mountOverlayReturn
    mountOverlayReturn.connected = false;
    mountOverlayReturn.raDegree = 0;
    mountOverlayReturn.decDegree = 0;
    mountOverlayReturn.effectiveAutoSync = false;
    mountOverlayReturn.altAz = null;
    mountOverlayReturn.tracking = false;
    mountOverlayReturn.slewing = false;
    mountOverlayReturn.parked = false;
    mountOverlayReturn.pierSide = undefined;

    mockIsTauri.mockReturnValue(false);
  });

  it('renders disconnected state when mount is not connected', () => {
    const { container } = render(<StellariumMount />);
    // useTranslations('mount') returns key without 'mount.' prefix
    expect(container.textContent).toContain('disconnected');
  });

  it('returns null in compact mode when disconnected', () => {
    const { container } = render(<StellariumMount compact />);
    expect(container.innerHTML).toBe('');
  });

  it('renders in compact mode with popover when connected', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Coordinates.RADegrees = 45;
    mountState.mountInfo.Coordinates.Dec = 30;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.raDegree = 45;
    mountOverlayReturn.decDegree = 30;

    const { container, getAllByRole } = render(<StellariumMount compact />);
    const buttons = getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    // useTranslations('mount') returns key without 'mount.' prefix
    expect(container.textContent).toContain('mount');
  });

  it('displays coordinates when connected', () => {
    mountState.mountInfo.Connected = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.raDegree = 90;
    mountOverlayReturn.decDegree = 45;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('00h 00m 00s');
    expect(container.textContent).toContain('+00° 00\' 00"');
  });

  it('shows selected device name in the connected header', () => {
    mountState.mountInfo.Connected = true;
    mountState.selectedDevice = {
      id: 'alpaca://192.168.1.10:11111/telescope/0',
      name: 'Rooftop Mount',
    };
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('Rooftop Mount');
  });

  it('shows tracking badge when tracking is active', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'sidereal';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('rate.sidereal');
  });

  it('renders static tracking badge when tracking-rate change is explicitly unavailable', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'solar';
    mountState.actionAvailability = { trackingRate: false };
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { container, queryAllByRole } = render(<StellariumMount />);
    expect(container.textContent).toContain('rate.solar');
    expect(queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('falls back to sidereal label when track mode is missing and tracking rate cannot change', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = undefined;
    mountState.actionAvailability = { trackingRate: false };
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('rate.sidereal');
  });

  it('uses sidereal fallback in tracking-rate menu when track mode is missing', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = undefined;
    mountState.actionAvailability = { trackingRate: true };
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { container, getAllByRole } = render(<StellariumMount />);
    expect(container.textContent).toContain('rate.sidereal');
    expect(getAllByRole('menuitem').length).toBeGreaterThan(0);
  });

  it('shows slewing badge when slewing', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('slewing');
  });

  it('shows parked badge when parked', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('parked');
  });

  it('shows pier side badge when pier side is known', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.PierSide = 'east';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.pierSide = 'east';

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('pier.east');
  });

  it('does not show pier side badge for unknown', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.PierSide = 'unknown';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.pierSide = 'unknown';

    const { container } = render(<StellariumMount />);
    expect(container.textContent).not.toContain('pier.unknown');
  });

  it('shows tracking toggle button when canSetTracking is true', () => {
    mountState.mountInfo.Connected = true;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    // Should have startTracking or stopTracking tooltip text
    expect(container.textContent).toContain('startTracking');
  });

  it('shows stopTracking text when tracking is already active', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('stopTracking');
  });

  it('hides tracking toggle button when canSetTracking is false', () => {
    mountState.mountInfo.Connected = true;
    mountState.capabilities.canSetTracking = false;
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).not.toContain('startTracking');
    expect(container.textContent).not.toContain('stopTracking');
  });

  it('shows park button when canPark is true', () => {
    mountState.mountInfo.Connected = true;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('park');
  });

  it('hides park button when canPark is false', () => {
    mountState.mountInfo.Connected = true;
    mountState.capabilities.canPark = false;
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    // Should not have park/unpark text (except in other areas like parked badge)
    const text = container.textContent || '';
    expect(text).not.toContain('unpark');
  });

  it('hides park control when action availability blocks parking', () => {
    mountState.mountInfo.Connected = true;
    mountState.capabilities.canPark = true;
    mountState.actionAvailability = { park: false };
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).not.toContain('park');
    expect(container.textContent).not.toContain('unpark');
  });

  it('shows abort button when slewing', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('abortSlew');
  });

  it('hides abort button when not slewing', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = false;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = false;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).not.toContain('abortSlew');
  });

  it('handleToggleTracking calls mountApi.setTracking when isTauri', async () => {
    mockIsTauri.mockReturnValue(true);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = false;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    // Find button whose next sibling span says 'startTracking'
    const trackingBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'startTracking';
    });

    expect(trackingBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(trackingBtn!);
    });
    expect(mockSetTracking).toHaveBeenCalledWith(true);
  });

  it('handlePark calls mountApi.park when not parked and isTauri', async () => {
    mockIsTauri.mockReturnValue(true);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = false;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const parkBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'park';
    });

    expect(parkBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(parkBtn!);
    });
    expect(mockPark).toHaveBeenCalled();
  });

  it('handlePark calls mountApi.unpark when parked and isTauri', async () => {
    mockIsTauri.mockReturnValue(true);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = true;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = true;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const unparkBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'unpark';
    });

    expect(unparkBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(unparkBtn!);
    });
    expect(mockUnpark).toHaveBeenCalled();
  });

  it('handleAbort calls mountApi.abortSlew when slewing and isTauri', async () => {
    mockIsTauri.mockReturnValue(true);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const abortBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'abortSlew';
    });

    expect(abortBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(abortBtn!);
    });
    expect(mockAbortSlew).toHaveBeenCalled();
  });

  it('handleToggleTracking error shows toast', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSetTracking.mockRejectedValueOnce(new Error('Tracking error'));
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = false;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const trackingBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'startTracking';
    });

    expect(trackingBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(trackingBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('handleToggleTracking converts non-Error failures to string', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSetTracking.mockRejectedValueOnce('tracking-string-error');
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = false;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const trackingBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'startTracking';
    });

    await act(async () => {
      fireEvent.click(trackingBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalledWith('operationFailed', expect.objectContaining({
      description: 'tracking-string-error',
    }));
  });

  it('handlePark error shows toast', async () => {
    mockIsTauri.mockReturnValue(true);
    mockPark.mockRejectedValueOnce(new Error('Park error'));
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = false;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const parkBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'park';
    });

    expect(parkBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(parkBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('handlePark converts non-Error failures to string', async () => {
    mockIsTauri.mockReturnValue(true);
    mockPark.mockRejectedValueOnce('park-string-error');
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = false;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const parkBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'park';
    });

    await act(async () => {
      fireEvent.click(parkBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalledWith('operationFailed', expect.objectContaining({
      description: 'park-string-error',
    }));
  });

  it('handleAbort error shows toast', async () => {
    mockIsTauri.mockReturnValue(true);
    mockAbortSlew.mockRejectedValueOnce(new Error('Abort error'));
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const abortBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'abortSlew';
    });

    expect(abortBtn).toBeTruthy();
    await act(async () => {
      fireEvent.click(abortBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('handleAbort converts non-Error failures to string', async () => {
    mockIsTauri.mockReturnValue(true);
    mockAbortSlew.mockRejectedValueOnce('abort-string-error');
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const abortBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'abortSlew';
    });

    await act(async () => {
      fireEvent.click(abortBtn!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalledWith('operationFailed', expect.objectContaining({
      description: 'abort-string-error',
    }));
  });

  it('handleTrackingRate calls mountApi.setTrackingRate', async () => {
    mockIsTauri.mockReturnValue(true);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'sidereal';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { getAllByRole } = render(<StellariumMount />);
    // Find the 'lunar' rate menu item via role=menuitem
    const menuItems = getAllByRole('menuitem');
    const lunarItem = menuItems.find((el) => el.textContent?.includes('rate.lunar'));

    expect(lunarItem).toBeTruthy();
    await act(async () => {
      fireEvent.click(lunarItem!);
    });
    expect(mockSetTrackingRate).toHaveBeenCalledWith('lunar');
  });

  it('handleTrackingRate error shows toast', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSetTrackingRate.mockRejectedValueOnce(new Error('Rate error'));
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'sidereal';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { getAllByRole } = render(<StellariumMount />);
    const menuItems = getAllByRole('menuitem');
    const lunarItem = menuItems.find((el) => el.textContent?.includes('rate.lunar'));

    expect(lunarItem).toBeTruthy();
    await act(async () => {
      fireEvent.click(lunarItem!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('handleTrackingRate converts non-Error failures to string', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSetTrackingRate.mockRejectedValueOnce('rate-string-error');
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'sidereal';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { getAllByRole } = render(<StellariumMount />);
    const menuItems = getAllByRole('menuitem');
    const solarItem = menuItems.find((el) => el.textContent?.includes('rate.solar'));

    await act(async () => {
      fireEvent.click(solarItem!);
    });

    const { toast } = jest.requireMock('sonner');
    expect(toast.error).toHaveBeenCalledWith('operationFailed', expect.objectContaining({
      description: 'rate-string-error',
    }));
  });

  it('handleToggleTracking does nothing when isTauri is false', async () => {
    mockIsTauri.mockReturnValue(false);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = false;
    mountState.capabilities.canSetTracking = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const trackingBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'startTracking';
    });

    if (trackingBtn) {
      await act(async () => {
        fireEvent.click(trackingBtn);
      });
    }
    expect(mockSetTracking).not.toHaveBeenCalled();
  });

  it('handlePark does nothing when isTauri is false', async () => {
    mockIsTauri.mockReturnValue(false);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Parked = false;
    mountState.capabilities.canPark = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.parked = false;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const parkBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'park';
    });

    if (parkBtn) {
      await act(async () => {
        fireEvent.click(parkBtn);
      });
    }
    expect(mockPark).not.toHaveBeenCalled();
  });

  it('handleAbort does nothing when isTauri is false', async () => {
    mockIsTauri.mockReturnValue(false);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { getAllByRole } = render(<StellariumMount />);
    const buttons = getAllByRole('button');
    const abortBtn = buttons.find((btn) => {
      const nextSpan = btn.nextElementSibling;
      return nextSpan?.textContent === 'abortSlew';
    });

    if (abortBtn) {
      await act(async () => {
        fireEvent.click(abortBtn);
      });
    }
    expect(mockAbortSlew).not.toHaveBeenCalled();
  });

  it('handleTrackingRate does nothing when isTauri is false', async () => {
    mockIsTauri.mockReturnValue(false);
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = true;
    mountState.mountInfo.TrackMode = 'sidereal';
    mountOverlayReturn.connected = true;
    mountOverlayReturn.tracking = true;

    const { getAllByRole } = render(<StellariumMount />);
    const menuItems = getAllByRole('menuitem');
    const lunarItem = menuItems.find((el) => el.textContent?.includes('rate.lunar'));

    if (lunarItem) {
      await act(async () => {
        fireEvent.click(lunarItem);
      });
    }
    expect(mockSetTrackingRate).not.toHaveBeenCalled();
  });

  it('shows altAz when available', () => {
    mountState.mountInfo.Connected = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.altAz = { alt: 45.5, az: 180.2 };

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('altitude');
    expect(container.textContent).toContain('azimuth');
  });

  it('does not show altAz when null', () => {
    mountState.mountInfo.Connected = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.altAz = null;

    const { container } = render(<StellariumMount />);
    // No altitude/azimuth labels when altAz is null
    expect(container.textContent).not.toContain('altitude');
  });

  it('auto-sync button shows correct state', () => {
    mountState.mountInfo.Connected = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.effectiveAutoSync = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('disableAutoSync');
  });

  it('sync view to mount button is present when connected', () => {
    mountState.mountInfo.Connected = true;
    mountOverlayReturn.connected = true;

    const { container } = render(<StellariumMount />);
    expect(container.textContent).toContain('goToMountPosition');
  });

  it('shows compact slewing trigger with pulse class when mount is slewing', () => {
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Slewing = true;
    mountOverlayReturn.connected = true;
    mountOverlayReturn.slewing = true;

    const { getAllByRole } = render(<StellariumMount compact />);
    const buttons = getAllByRole('button');
    const compactTrigger = buttons[0];
    expect(compactTrigger.className).toContain('animate-pulse');
  });
});
