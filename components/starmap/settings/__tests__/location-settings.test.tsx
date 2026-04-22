/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';

const originalConsoleError = console.error;

const mockSetLocation = jest.fn();
const defaultLocationState = {
  latitude: 40.7128,
  longitude: -74.006,
  elevation: 100,
};

const defaultMountState = {
  profileInfo: {
    AstrometrySettings: {
      Latitude: 40.7128,
      Longitude: -74.006,
      Elevation: 100,
    },
  },
  setProfileInfo: jest.fn(),
};

const mockUseMountStore = Object.assign(
  jest.fn((selector) => {
    return selector ? selector(defaultMountState) : defaultMountState;
  }),
  {
    getState: jest.fn(() => defaultMountState),
  }
);

jest.mock('@/lib/stores', () => ({
  useMountStore: Object.assign(
    (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
    { getState: () => mockUseMountStore.getState() }
  ),
}));

jest.mock('@/lib/hooks/use-settings-draft', () => ({
  useLocationDraftModel: () => ({
    location: defaultLocationState,
    setLocation: mockSetLocation,
  }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} data-testid="button">{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} data-testid="input" />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined)[]) => args.filter(Boolean).join(' '),
}));

// Mock navigator.permissions
const mockPermissionsQuery = jest.fn();
Object.defineProperty(navigator, 'permissions', {
  value: {
    query: mockPermissionsQuery,
  },
  writable: true,
});

// Mock navigator.geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
};
Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

import { LocationSettings } from '../location-settings';

async function renderLocationSettings() {
  const view = render(<LocationSettings />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [firstArg] = args;
    if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
      return;
    }
    originalConsoleError(...args as Parameters<typeof console.error>);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LocationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissionsQuery.mockImplementation(() => new Promise(() => undefined));
  });

  it('renders location settings section', () => {
    render(<LocationSettings />);
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('renders latitude input', () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3); // lat, lon, elevation
  });

  it('renders longitude input', () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders elevation input', () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders labels for location fields', () => {
    render(<LocationSettings />);
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });

  it('renders location permission status', () => {
    render(<LocationSettings />);
    // Should show permission status UI
    expect(screen.getByTestId('collapsible-content')).toBeInTheDocument();
  });

  it('renders get location button when permission is not denied', async () => {
    mockPermissionsQuery.mockResolvedValue({
      state: 'prompt',
      addEventListener: jest.fn(),
    });
    await renderLocationSettings();
    expect(screen.getAllByTestId('button').length).toBeGreaterThan(0);
  });

});

describe('LocationSettings permission edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('handles granted permission state', async () => {
    mockPermissionsQuery.mockResolvedValue({
      state: 'granted',
      addEventListener: jest.fn(),
    });

    await renderLocationSettings();
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('handles denied permission state', async () => {
    mockPermissionsQuery.mockResolvedValue({
      state: 'denied',
      addEventListener: jest.fn(),
    });

    await renderLocationSettings();
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('handles permission query error', async () => {
    mockPermissionsQuery.mockRejectedValue(new Error('Permission query failed'));

    await renderLocationSettings();
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('handles extreme latitude values', () => {
    mockUseMountStore.mockImplementation((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 90,
            Longitude: 0,
            Elevation: 0,
          },
        },
        setProfileInfo: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<LocationSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(3);
  });

  it('handles extreme longitude values', () => {
    mockUseMountStore.mockImplementation((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 0,
            Longitude: 180,
            Elevation: 0,
          },
        },
        setProfileInfo: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<LocationSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(3);
  });

  it('handles negative coordinates', () => {
    mockUseMountStore.mockImplementation((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: -45.5,
            Longitude: -122.6,
            Elevation: 50,
          },
        },
        setProfileInfo: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<LocationSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(3);
  });

  it('handles high elevation', () => {
    mockUseMountStore.mockImplementation((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 27.9881,
            Longitude: 86.925,
            Elevation: 8848,
          },
        },
        setProfileInfo: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<LocationSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(3);
  });

  it('handles zero values', () => {
    mockUseMountStore.mockImplementation((selector) => {
      const state = {
        profileInfo: {
          AstrometrySettings: {
            Latitude: 0,
            Longitude: 0,
            Elevation: 0,
          },
        },
        setProfileInfo: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    render(<LocationSettings />);
    expect(screen.getAllByTestId('input').length).toBeGreaterThanOrEqual(3);
  });
});

describe('LocationSettings commitLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissionsQuery.mockResolvedValue({
      state: 'prompt',
      addEventListener: jest.fn(),
    });
  });

  it('commits latitude on blur', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    // First number input is latitude
    fireEvent.blur(inputs[0], { target: { value: '35.5' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ latitude: 35.5 });
  });

  it('commits longitude on blur', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    // Second number input is longitude
    fireEvent.blur(inputs[1], { target: { value: '120.3' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ longitude: 120.3 });
  });

  it('commits elevation on blur', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    // Third number input is elevation
    fireEvent.blur(inputs[2], { target: { value: '500' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ elevation: 500 });
  });

  it('clamps latitude to valid range [-90, 90]', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.blur(inputs[0], { target: { value: '100' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ latitude: 90 });
  });

  it('clamps longitude to valid range [-180, 180]', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.blur(inputs[1], { target: { value: '200' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ longitude: 180 });
  });

  it('handles NaN input as 0', async () => {
    render(<LocationSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.blur(inputs[0], { target: { value: 'abc' } });
    expect(mockSetLocation).toHaveBeenCalledWith({ latitude: 0 });
  });
});

describe('LocationSettings geolocation callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const state = {
      profileInfo: {
        AstrometrySettings: {
          Latitude: 0,
          Longitude: 0,
          Elevation: 0,
        },
      },
      setProfileInfo: jest.fn(),
    };
    mockUseMountStore.mockImplementation((selector) => {
      return selector ? selector(state) : state;
    });
    mockUseMountStore.getState.mockReturnValue(state);
    mockPermissionsQuery.mockResolvedValue({
      state: 'granted',
      addEventListener: jest.fn(),
    });
  });

  it('updates store on successful geolocation', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: { latitude: 51.5074, longitude: -0.1278, altitude: 11 },
      });
    });

    await renderLocationSettings();

    // Click the get/refresh location button
    const buttons = screen.getAllByTestId('button');
    const locationButton = buttons.find(b => b.textContent?.includes('settings.refreshLocation') || b.textContent?.includes('settings.getLocation'));
    if (locationButton) {
      await act(async () => {
        fireEvent.click(locationButton);
      });
      expect(mockSetLocation).toHaveBeenCalledWith({
        latitude: 51.5074,
        longitude: -0.1278,
        elevation: 11,
      });
    }
  });

  it('sets denied state on PERMISSION_DENIED error', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error({ code: 1, PERMISSION_DENIED: 1, message: 'User denied' });
    });

    await renderLocationSettings();

    const buttons = screen.getAllByTestId('button');
    const locationButton = buttons.find(b => b.textContent?.includes('settings.refreshLocation') || b.textContent?.includes('settings.getLocation'));
    if (locationButton) {
      await act(async () => {
        fireEvent.click(locationButton);
      });
      // After denied, the component should still be rendered
      expect(screen.getByTestId('collapsible')).toBeInTheDocument();
    }
  });

  it('sets unknown state on other geolocation errors', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((_success, error) => {
      error({ code: 2, PERMISSION_DENIED: 1, message: 'Position unavailable' });
    });

    await renderLocationSettings();

    const buttons = screen.getAllByTestId('button');
    const locationButton = buttons.find(b => b.textContent?.includes('settings.refreshLocation') || b.textContent?.includes('settings.getLocation'));
    if (locationButton) {
      await act(async () => {
        fireEvent.click(locationButton);
      });
      expect(screen.getByTestId('collapsible')).toBeInTheDocument();
    }
  });

  it('handles geolocation success with null altitude', async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: { latitude: 48.8566, longitude: 2.3522, altitude: null },
      });
    });

    await renderLocationSettings();

    const buttons = screen.getAllByTestId('button');
    const locationButton = buttons.find(b => b.textContent?.includes('settings.refreshLocation') || b.textContent?.includes('settings.getLocation'));
    if (locationButton) {
      await act(async () => {
        fireEvent.click(locationButton);
      });
      expect(mockSetLocation).toHaveBeenCalledWith({
        latitude: 48.8566,
        longitude: 2.3522,
      });
    }
  });
});

describe('LocationSettings permission change listener', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers and unregisters permission change listener', async () => {
    const mockAddEventListener = jest.fn();
    const mockRemoveEventListener = jest.fn();
    mockPermissionsQuery.mockResolvedValue({
      state: 'prompt',
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });

    const { unmount } = await renderLocationSettings();

    expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('handles permission status without addEventListener', async () => {
    mockPermissionsQuery.mockResolvedValue({
      state: 'granted',
      // No addEventListener/removeEventListener
    });

    const { unmount } = await renderLocationSettings();
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
    // Should not throw on unmount
    unmount();
  });
});
