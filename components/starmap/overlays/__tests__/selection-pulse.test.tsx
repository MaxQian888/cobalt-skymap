/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

let mockProjected: Array<{ item: unknown; x: number; y: number; visible: boolean }> = [];
const mockUseBatchProjection = jest.fn((_options?: unknown) => mockProjected);
jest.mock('@/lib/hooks/use-coordinate-projection', () => ({
  useBatchProjection: (options: unknown) => mockUseBatchProjection(options),
}));

let mockPrefersReducedMotion = false;
jest.mock('@/lib/hooks/use-prefers-reduced-motion', () => ({
  usePrefersReducedMotion: () => mockPrefersReducedMotion,
}));

let mockIsMobileShell = false;
jest.mock('../../view/use-mobile-shell', () => ({
  useMobileShell: () => ({ isMobileShell: mockIsMobileShell }),
}));

import { SelectionPulse } from '../selection-pulse';
import type { SelectedObjectData } from '@/lib/core/types';

const makeObject = (names: string[], ts = 'T0'): SelectedObjectData => ({
  names,
  ra: '00h 42m',
  dec: '+41°',
  raDeg: 10.68,
  decDeg: 41.27,
  coordinateTimestamp: ts,
});

describe('SelectionPulse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProjected = [{ item: {}, x: 320, y: 240, visible: true }];
    mockPrefersReducedMotion = false;
    mockIsMobileShell = false;
  });

  it('renders the ring at the projected position on selection', () => {
    render(
      <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
    );

    const overlay = screen.getByTestId('selection-pulse');
    const ring = overlay.firstElementChild as HTMLElement;
    expect(ring).toHaveClass('selection-pulse-ring');
    expect(ring.style.left).toBe('320px');
    expect(ring.style.top).toBe('240px');
  });

  it('unmounts the ring after the animation ends and unsubscribes the loop', () => {
    render(
      <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
    );

    const ring = screen.getByTestId('selection-pulse').firstElementChild as HTMLElement;
    fireEvent.animationEnd(ring);

    expect(screen.queryByTestId('selection-pulse')).not.toBeInTheDocument();
    const lastOptions = mockUseBatchProjection.mock.calls.at(-1)![0] as { enabled: boolean };
    expect(lastOptions.enabled).toBe(false);
  });

  it('replays the pulse when the selection identity changes', () => {
    const { rerender } = render(
      <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
    );
    fireEvent.animationEnd(screen.getByTestId('selection-pulse').firstElementChild!);
    expect(screen.queryByTestId('selection-pulse')).not.toBeInTheDocument();

    rerender(
      <SelectionPulse selectedObject={makeObject(['M42'])} containerWidth={800} containerHeight={600} />
    );
    expect(screen.getByTestId('selection-pulse')).toBeInTheDocument();
  });

  it('renders nothing without a selection', () => {
    render(<SelectionPulse selectedObject={null} containerWidth={800} containerHeight={600} />);
    expect(screen.queryByTestId('selection-pulse')).not.toBeInTheDocument();
  });

  it('is suppressed under prefers-reduced-motion', () => {
    mockPrefersReducedMotion = true;
    render(
      <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
    );
    expect(screen.queryByTestId('selection-pulse')).not.toBeInTheDocument();
  });

  describe('haptics', () => {
    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).vibrate;
    });

    it('vibrates on the mobile shell when the API exists', () => {
      mockIsMobileShell = true;
      const vibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

      render(
        <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
      );
      expect(vibrate).toHaveBeenCalledWith(15);
    });

    it('does not vibrate on the desktop shell', () => {
      mockIsMobileShell = false;
      const vibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

      render(
        <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
      );
      expect(vibrate).not.toHaveBeenCalled();
    });

    it('does not crash when the vibrate API is absent', () => {
      mockIsMobileShell = true;
      expect(() =>
        render(
          <SelectionPulse selectedObject={makeObject(['M31'])} containerWidth={800} containerHeight={600} />
        )
      ).not.toThrow();
    });
  });
});
