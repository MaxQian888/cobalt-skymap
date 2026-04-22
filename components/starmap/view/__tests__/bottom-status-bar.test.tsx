/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';

jest.useFakeTimers();
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

// IMPORTANT: stable references to avoid infinite re-render loops
const MOCK_STEL_STATE: Record<string, unknown> = { stel: null, activeEngine: 'stellarium', getCurrentViewDirection: null, viewDirection: null };
const MOCK_MOUNT_STATE = { profileInfo: { AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 0 } } };
jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn((sel: (s: Record<string, unknown>) => unknown) => sel(MOCK_STEL_STATE)),
  useMountStore: jest.fn((sel: (s: Record<string, unknown>) => unknown) => sel(MOCK_MOUNT_STATE)),
}));
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  rad2deg: jest.fn((v: number) => v),
  degreesToHMS: jest.fn(() => '12h 00m'),
  degreesToDMS: jest.fn(() => "+40° 00'"),
}));
jest.mock('@/lib/astronomy/time/sidereal', () => ({
  getLST: jest.fn(() => 0),
  lstToHours: jest.fn(() => 0),
}));
jest.mock('@/lib/astronomy/time-scales', () => ({
  getEopSnapshot: jest.fn(() => ({ freshness: 'fallback' })),
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
}));
jest.mock('@/components/common/system-status-indicator', () => ({
  SystemStatusIndicator: () => <div data-testid="system-status" />,
}));

import { BottomStatusBar, ViewCenterDisplay, LocationTimeDisplay } from '../bottom-status-bar';

describe('BottomStatusBar', () => {
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<BottomStatusBar currentFov={60} />);
    expect(container).toBeTruthy();
  });

  it('displays FOV value', () => {
    render(<BottomStatusBar currentFov={60} />);
    expect(screen.getByText('60.0°')).toBeInTheDocument();
  });

  it('formats FOV with extra precision when < 1', () => {
    render(<BottomStatusBar currentFov={0.5} />);
    expect(screen.getByText('0.50°')).toBeInTheDocument();
  });

  it('renders system status indicator', () => {
    render(<BottomStatusBar currentFov={60} />);
    expect(screen.getByTestId('system-status')).toBeInTheDocument();
  });

  it('renders FOV label', () => {
    const { container } = render(<BottomStatusBar currentFov={45} />);
    expect(container.textContent).toContain('fov.label');
  });
});

describe('ViewCenterDisplay', () => {
  it('returns null when viewDirection is null', () => {
    const { container } = render(<ViewCenterDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders equatorial coords when viewDirection is set', () => {
    MOCK_STEL_STATE.viewDirection = { ra: 1.5, dec: 0.7, alt: 0.3, az: 2.1, frame: 'ICRF', timeScale: 'UTC', qualityFlag: 'fresh', dataFreshness: 'fresh' };
    const { container } = render(<ViewCenterDisplay />);
    expect(container.textContent).toContain('coordinates.ra');
    expect(container.textContent).toContain('coordinates.dec');
    MOCK_STEL_STATE.viewDirection = null;
  });

  it('toggles between equatorial and observed display mode', () => {
    MOCK_STEL_STATE.viewDirection = { ra: 1.5, dec: 0.7, alt: 0.3, az: 2.1 };
    const { container } = render(<ViewCenterDisplay />);
    // Default is equatorial (ICRF button visible)
    const toggleBtn = screen.getByText('ICRF');
    expect(toggleBtn).toBeInTheDocument();

    // Click to switch to observed
    fireEvent.click(toggleBtn);
    expect(screen.getByText('OBS')).toBeInTheDocument();
    expect(container.textContent).toContain('coordinates.alt');
    expect(container.textContent).toContain('coordinates.az');

    // Click back to equatorial
    fireEvent.click(screen.getByText('OBS'));
    expect(screen.getByText('ICRF')).toBeInTheDocument();

    MOCK_STEL_STATE.viewDirection = null;
  });
});

describe('LocationTimeDisplay', () => {
  it('renders location coordinates', () => {
    const { container } = render(<LocationTimeDisplay />);
    expect(container.textContent).toContain('40.00°');
    expect(container.textContent).toContain('-74.00°');
  });

  it('renders current time', () => {
    const { container } = render(<LocationTimeDisplay />);
    act(() => {
      jest.advanceTimersByTime(1100);
    });
    // Should contain some time text
    expect(container.textContent).toBeTruthy();
  });
});
