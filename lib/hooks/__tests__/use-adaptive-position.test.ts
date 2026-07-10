/**
 * Tests for use-adaptive-position.ts
 * Adaptive panel positioning relative to click point
 */

import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useAdaptivePosition, circleIntersectsRect, DEFAULT_KEEP_OUT_RADIUS } from '../use-adaptive-position';

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

  it('returns a maxHeight bounded to the space below the panel top', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(ref, { x: 200, y: 200 }, { width: 1920, height: 1080 });
    });
    // maxHeight = containerHeight - top - bottomBarHeight(48) - padding(16),
    // so the panel body scrolls instead of clipping off the bottom edge.
    expect(result.current.maxHeight).toBe(1080 - result.current.top! - 48 - 16);
    expect(result.current.maxHeight).toBeGreaterThan(0);
  });

  it('omits maxHeight when there is no container to bound against', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useAdaptivePosition(ref, { x: 100, y: 100 }, undefined);
    });
    expect(result.current.maxHeight).toBeUndefined();
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

  describe('keep-out circle', () => {
    const CONTAINER = { width: 1920, height: 1080 };

    it('keepOutRadius: 0 reproduces the legacy positions exactly', () => {
      const legacy = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useAdaptivePosition(ref, { x: 200, y: 200 }, CONTAINER);
      });
      const explicitZero = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useAdaptivePosition(ref, { x: 200, y: 200 }, CONTAINER, [], { keepOutRadius: 0 });
      });
      expect(explicitZero.result.current).toEqual(legacy.result.current);
    });

    it('keeps the panel left edge clear of the keep-out circle', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useAdaptivePosition(ref, { x: 200, y: 400 }, CONTAINER, [], {
          keepOutRadius: DEFAULT_KEEP_OUT_RADIUS,
        });
      });
      expect(result.current.left).toBeGreaterThanOrEqual(200 + DEFAULT_KEEP_OUT_RADIUS);
    });

    it('flips to the left side near the right edge with keep-out clearance', () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useAdaptivePosition(ref, { x: 1700, y: 400 }, CONTAINER, [], {
          keepOutRadius: DEFAULT_KEEP_OUT_RADIUS,
        });
      });
      // Panel sits fully left of the anchor with clearance.
      expect(result.current.left + 320).toBeLessThanOrEqual(1700 - DEFAULT_KEEP_OUT_RADIUS);
    });

    it('escapes vertically when clamps push the panel back over the anchor', () => {
      // Narrow container: horizontal clamps force the panel onto the anchor
      // column, so the keep-out escape must move it above/below the anchor.
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useAdaptivePosition(ref, { x: 200, y: 700 }, { width: 400, height: 1400 }, [], {
          keepOutRadius: DEFAULT_KEEP_OUT_RADIUS,
        });
      });
      const rect = { left: result.current.left, top: result.current.top, width: 320, height: 400 };
      expect(circleIntersectsRect(200, 700, DEFAULT_KEEP_OUT_RADIUS, rect)).toBe(false);
    });
  });

  describe('circleIntersectsRect', () => {
    const rect = { left: 100, top: 100, width: 200, height: 100 };

    it('detects circle overlapping a rect edge', () => {
      expect(circleIntersectsRect(90, 150, 20, rect)).toBe(true);
    });

    it('detects circle overlapping a rect corner', () => {
      expect(circleIntersectsRect(90, 90, 20, rect)).toBe(true);
      // Just out of reach of the corner (distance ≈ 21.2 > 15).
      expect(circleIntersectsRect(85, 85, 15, rect)).toBe(false);
    });

    it('detects circle center inside the rect', () => {
      expect(circleIntersectsRect(200, 150, 5, rect)).toBe(true);
    });

    it('returns false for a distant circle', () => {
      expect(circleIntersectsRect(500, 500, 48, rect)).toBe(false);
    });
  });
});
