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
