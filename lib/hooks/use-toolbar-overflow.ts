'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export interface ToolbarOverflowGroup {
  id: string;
  /** Lower priority folds into the overflow menu first. */
  priority: number;
}

/**
 * Pure priority+ partition: given the available width, the measured width of
 * each foldable group, the non-foldable base width, and the overflow-trigger
 * width, return the set of group ids that must fold into the "More" menu.
 *
 * Stateless w.r.t. the current fold state — it always computes the ideal
 * partition from the "all inline" total, so widening the viewport un-folds
 * groups cleanly without hysteresis bookkeeping.
 */
export function computeToolbarOverflow(
  availableWidth: number,
  groupWidths: Map<string, number>,
  groups: ToolbarOverflowGroup[],
  baseWidth: number,
  moreButtonWidth: number,
): Set<string> {
  let total = baseWidth;
  for (const g of groups) total += groupWidths.get(g.id) ?? 0;
  if (total <= availableWidth) return new Set();

  // Showing the overflow trigger costs width.
  total += moreButtonWidth;
  const overflow = new Set<string>();
  const foldOrder = [...groups].sort((a, b) => a.priority - b.priority);
  for (const g of foldOrder) {
    if (total <= availableWidth) break;
    overflow.add(g.id);
    total -= groupWidths.get(g.id) ?? 0;
  }
  return overflow;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export interface UseToolbarOverflowResult {
  /** Group ids currently folded into the overflow menu. */
  overflowIds: Set<string>;
  /** Ref callback factory: attach `registerGroup(id)` to each foldable group wrapper. */
  registerGroup: (id: string) => (el: HTMLElement | null) => void;
}

/**
 * Content-measuring priority+ overflow for an icon toolbar. Observes the
 * container width via ResizeObserver, caches each foldable group's measured
 * width (icon buttons are fixed-width, so a one-time measure is stable across
 * locales), and folds the lowest-priority groups when the row would overflow.
 *
 * `groups` MUST be referentially stable (memoize it at the call site), since it
 * is a dependency of the measurement callback.
 */
export function useToolbarOverflow(
  containerRef: RefObject<HTMLElement | null>,
  groups: ToolbarOverflowGroup[],
  options: { moreButtonWidth?: number; enabled?: boolean } = {},
): UseToolbarOverflowResult {
  const { moreButtonWidth = 44, enabled = true } = options;
  const [overflowIds, setOverflowIds] = useState<Set<string>>(() => new Set());
  const groupElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const widthCacheRef = useRef<Map<string, number>>(new Map());
  const baseWidthRef = useRef<number | null>(null);

  const registerGroup = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) groupElsRef.current.set(id, el);
      else groupElsRef.current.delete(id);
    },
    [],
  );

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!enabled) {
      setOverflowIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    // Cache the width of every currently-inline foldable group.
    for (const g of groups) {
      const el = groupElsRef.current.get(g.id);
      if (el) {
        const w = el.getBoundingClientRect().width;
        if (w > 0) widthCacheRef.current.set(g.id, w);
      }
    }

    const sumFoldable = groups.reduce(
      (s, g) => s + (widthCacheRef.current.get(g.id) ?? 0),
      0,
    );

    // Capture the non-foldable base width once, on the first laid-out pass when
    // nothing is folded yet (scrollWidth then reflects the full content width).
    if (baseWidthRef.current === null) {
      const base = container.scrollWidth - sumFoldable;
      if (base > 0) baseWidthRef.current = base;
    }
    const baseWidth = baseWidthRef.current ?? container.clientWidth;
    const available = container.clientWidth;

    const next = computeToolbarOverflow(
      available,
      widthCacheRef.current,
      groups,
      baseWidth,
      moreButtonWidth,
    );
    setOverflowIds((prev) => (setsEqual(prev, next) ? prev : next));
  }, [containerRef, enabled, groups, moreButtonWidth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      recompute();
      return;
    }
    let raf = 0;
    const schedule = () => {
      if (typeof requestAnimationFrame === 'undefined') {
        recompute();
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    recompute();
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [containerRef, recompute]);

  return { overflowIds, registerGroup };
}
