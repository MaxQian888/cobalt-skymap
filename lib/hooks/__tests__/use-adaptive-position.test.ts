/**
 * Tests for use-adaptive-position.ts
 * Adaptive panel positioning relative to click point
 */

import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useAdaptivePosition } from '../use-adaptive-position';

describe('useAdaptivePosition', () => {
  it('should return default position when no click position', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(ref, undefined, undefined);
    });
    expect(result.current).toEqual({ left: 12, top: 64 });
  });

  it('should return default position when no container bounds', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(ref, { x: 100, y: 100 }, undefined);
    });
    expect(result.current).toEqual({ left: 12, top: 64 });
  });

  it('should compute position from click point and container', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(
        ref,
        { x: 200, y: 200 },
        { width: 1920, height: 1080 }
      );
    });
    expect(result.current.left).toBeGreaterThan(0);
    expect(result.current.top).toBeGreaterThan(0);
  });

  it('never positions a panel under the top bar, even when taller than the container', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      // Container shorter than the default 400px panel height: the bottom-edge
      // clamp would push `top` negative (under the top bar) without a final
      // re-clamp.
      return useAdaptivePosition(ref, { x: 500, y: 200 }, { width: 1000, height: 400 });
    });
    // topBarHeight (64) + padding (16) = 80
    expect(result.current.top).toBeGreaterThanOrEqual(80);
  });

  it('reserves right-rail space on the desktop shell so the panel clears the rail', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      // Desktop shell (width > 900): a click near the right edge must keep the
      // panel clear of the right rail footprint (default reserve 72px).
      return useAdaptivePosition(ref, { x: 1290, y: 400 }, { width: 1300, height: 900 });
    });
    // Default measured panel width in jsdom is 300 (ref is null).
    expect(result.current.left + 300).toBeLessThanOrEqual(1300 - 72);
  });

  it('reserves no right-rail space below the desktop shell breakpoint', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      // Mobile shell (width <= 900): the right rail is absent, so the panel may
      // use the full width up to the padding.
      return useAdaptivePosition(ref, { x: 890, y: 400 }, { width: 900, height: 900 });
    });
    // The panel extends into the region a desktop rail would have reserved,
    // proving no reservation is applied on the mobile shell.
    expect(result.current.left + 300).toBeGreaterThan(900 - 72);
  });

  it('should accept custom options', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(
        ref,
        { x: 100, y: 100 },
        { width: 800, height: 600 },
        [],
        { defaultPosition: { left: 50, top: 50 } }
      );
    });
    expect(result.current).toBeDefined();
  });
});
