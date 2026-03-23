/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

let mockProfileInfo = {
  AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 100 },
};

let mockGetCurrentViewDirection: (() => { ra: number; dec: number; alt: number; az: number }) | null = null;

let mockConditions = {
  moonPhase: 0.5,
  moonIllumination: 100,
  moonAltitude: 45,
  moonPhaseName: 'Full Moon',
  skyQuality: 'average',
  sunAltitude: -30,
  isTwilight: false,
  bortleClass: 5,
  limitingMagnitude: 5.0,
  lstString: '12:00:00',
  twilight: {
    sunset: new Date(),
    sunrise: new Date(),
    astronomicalDusk: new Date(),
    astronomicalDawn: new Date(),
  },
};

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/stores', () => ({
  useMountStore: jest.fn((selector) => {
    const state = { profileInfo: mockProfileInfo };
    return selector(state);
  }),
  useStellariumStore: jest.fn((selector) => {
    const state = { getCurrentViewDirection: mockGetCurrentViewDirection };
    return selector(state);
  }),
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  formatTimeShort: jest.fn(() => '12:00'),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  rad2deg: jest.fn((v: number) => v * 180 / Math.PI),
  degreesToHMS: jest.fn(() => '12h 00m 00s'),
}));

jest.mock('@/lib/astronomy/sky-quality', () => ({
  calculateAstroConditions: jest.fn(() => mockConditions),
  getSkyQualityColor: jest.fn(() => 'text-yellow-400'),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren) => <button {...props}>{children}</button>,
}));
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

import { StatusBar } from '../status-bar';

describe('StatusBar', () => {
  beforeEach(() => {
    mockProfileInfo = {
      AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 100 },
    };
    mockGetCurrentViewDirection = null;
    mockConditions = {
      moonPhase: 0.5,
      moonIllumination: 100,
      moonAltitude: 45,
      moonPhaseName: 'Full Moon',
      skyQuality: 'average',
      sunAltitude: -30,
      isTwilight: false,
      bortleClass: 5,
      limitingMagnitude: 5.0,
      lstString: '12:00:00',
      twilight: {
        sunset: new Date(),
        sunrise: new Date(),
        astronomicalDusk: new Date(),
        astronomicalDawn: new Date(),
      },
    };
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders without crashing', () => {
    render(<StatusBar currentFov={60} />);
  });

  it('renders location coordinates', () => {
    render(<StatusBar currentFov={60} />);
    expect(screen.getByText(/40\.0/)).toBeInTheDocument();
  });

  it('displays FOV >= 1 with 1 decimal', () => {
    render(<StatusBar currentFov={5.678} />);
    expect(screen.getByText('5.7°')).toBeInTheDocument();
  });

  it('displays FOV < 1 with 2 decimals', () => {
    render(<StatusBar currentFov={0.45} />);
    expect(screen.getByText('0.45°')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBar currentFov={60} className="my-custom" />);
    expect(container.querySelector('.my-custom')).toBeInTheDocument();
  });

  it('renders moon illumination in conditions popup', () => {
    render(<StatusBar currentFov={60} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders sky quality text', () => {
    render(<StatusBar currentFov={60} />);
    const matches = screen.getAllByText(/statusBar\.sky\.average/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders twilight times', () => {
    render(<StatusBar currentFov={60} />);
    // formatTimeShort is mocked to return '12:00'
    const times = screen.getAllByText('12:00');
    expect(times.length).toBeGreaterThanOrEqual(2); // sunset, sunrise, etc.
  });

  it('renders FOV icon label', () => {
    render(<StatusBar currentFov={60} />);
    expect(screen.getByText('zoom.fov')).toBeInTheDocument();
  });

  it('renders time display', () => {
    render(<StatusBar currentFov={60} />);
    // LocationTimeDisplay renders Clock icon + time
    expect(document.body.textContent).toContain('session.location');
  });

  it('renders online/offline status based on browser connectivity', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<StatusBar currentFov={60} />);
    expect(document.body.textContent).toContain('system.connectionOffline');
  });

  it('renders daylight and twilight labels for solar condition branches', () => {
    mockConditions = {
      ...mockConditions,
      sunAltitude: 12,
      isTwilight: false,
    };
    const first = render(<StatusBar currentFov={60} />);
    expect(document.body.textContent).toContain('statusBar.daylight');
    first.unmount();

    mockConditions = {
      ...mockConditions,
      sunAltitude: -6,
      isTwilight: true,
    };
    render(<StatusBar currentFov={60} />);
    expect(document.body.textContent).toContain('statusBar.twilight');
  });

  it('renders night label and view center values when Stellarium direction is available', () => {
    mockConditions = {
      ...mockConditions,
      sunAltitude: -25,
      isTwilight: false,
    };
    mockGetCurrentViewDirection = () => ({
      ra: Math.PI / 2,
      dec: Math.PI / 4,
      alt: Math.PI / 6,
      az: Math.PI / 3,
    });

    render(<StatusBar currentFov={0.8} />);

    expect(document.body.textContent).toContain('statusBar.night');
    expect(document.body.textContent).toContain('coordinates.ra');
    expect(document.body.textContent).toContain('12h 00m 00s');
    expect(document.body.textContent).toContain('30.0°');
  });

  it('swallows view-direction read errors and keeps rendering', () => {
    mockGetCurrentViewDirection = () => {
      throw new Error('direction unavailable');
    };

    render(<StatusBar currentFov={60} />);
    expect(screen.queryByText('coordinates.ra')).not.toBeInTheDocument();
  });
});
