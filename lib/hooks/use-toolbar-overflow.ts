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
 * Content-measuring priority+ overflow for an icon toolbar laid out as a
 * `justify-between` row. The naive `scrollWidth > clientWidth` check is
 * unreliable here — with slack, `justify-between` spreads the row's children so
 * `scrollWidth === clientWidth`. Instead we sum the row's direct children's
 * intrinsic widths (`justify-between` grows the gaps, not the children), add the
 * cached width of any currently-folded group back, subtract the overflow
 * trigger, and add horizontal padding — reconstructing the viewport-independent
 * "all inline" content width on every tick. That makes folding/un-folding stable
 * and loop-free (the row is full-width, so folding never resizes the observed
 * element — only a real viewport resize re-runs the measurement).
 *
 * `rowRef` is the `justify-between` row; attach `registerGroup(id)` to each
 * foldable group wrapper inside it. `groups` MUST be referentially stable
 * (memoize it at the call site).
 */
export function useToolbarOverflow(
  rowRef: RefObject<HTMLElement | null>,
  groups: ToolbarOverflowGroup[],
  options: { moreButtonWidth?: number; enabled?: boolean } = {},
): UseToolbarOverflowResult {
  const { moreButtonWidth = 44, enabled = true } = options;
  const [overflowIds, setOverflowIds] = useState<Set<string>>(() => new Set());
  const overflowRef = useRef(overflowIds);
  useEffect(() => {
    overflowRef.current = overflowIds;
  }, [overflowIds]);
  const groupElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const widthCacheRef = useRef<Map<string, number>>(new Map());
  const paddingRef = useRef<number | null>(null);
  const refCbCacheRef = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map());

  // Stable per-id ref callback so attaching it does not thrash on every render.
  const registerGroup = useCallback((id: string) => {
    let cb = refCbCacheRef.current.get(id);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) groupElsRef.current.set(id, el);
        else groupElsRef.current.delete(id);
      };
      refCbCacheRef.current.set(id, cb);
    }
    return cb;
  }, []);

  const recompute = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    if (!enabled) {
      setOverflowIds((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    const available = row.clientWidth;
    if (available <= 0) return; // not laid out yet

    // Cache the width of every currently-inline foldable group (fixed-width
    // icon buttons → a measured width stays valid once folded into the menu).
    for (const g of groups) {
      const el = groupElsRef.current.get(g.id);
      if (el) {
        const w = el.getBoundingClientRect().width;
        if (w > 0) widthCacheRef.current.set(g.id, w);
      }
    }

    if (paddingRef.current === null) {
      const cs = getComputedStyle(row);
      const p = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight);
      if (Number.isFinite(p)) paddingRef.current = p;
    }
    const paddingX = paddingRef.current ?? 0;

    // Reconstruct the viewport-independent "all inline" content width.
    let childrenSum = 0;
    for (const child of Array.from(row.children)) {
      childrenSum += (child as HTMLElement).getBoundingClientRect().width;
    }
    const current = overflowRef.current;
    let foldedWidth = 0;
    for (const id of current) foldedWidth += widthCacheRef.current.get(id) ?? 0;
    const moreShownWidth = current.size > 0 ? moreButtonWidth : 0;
    const fullContentWidth = childrenSum + foldedWidth - moreShownWidth + paddingX;

    const sumFoldable = groups.reduce(
      (s, g) => s + (widthCacheRef.current.get(g.id) ?? 0),
      0,
    );
    const baseWidth = fullContentWidth - sumFoldable;

    const next = computeToolbarOverflow(
      available,
      widthCacheRef.current,
      groups,
      baseWidth,
      moreButtonWidth,
    );
    setOverflowIds((prev) => (setsEqual(prev, next) ? prev : next));
  }, [rowRef, enabled, groups, moreButtonWidth]);

  useEffect(() => {
    const row = rowRef.current;
    // No measurement off the main browser layout path (SSR / jsdom): overflow
    // stays empty (everything renders inline), which is the correct fallback.
    if (!row || typeof ResizeObserver === 'undefined') return;

    let raf = 0;
    const schedule = () => {
      if (typeof requestAnimationFrame === 'undefined') {
        recompute();
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recompute);
    };
    // ResizeObserver fires its callback once on observe(), giving the initial
    // measurement without a synchronous setState inside the effect.
    const observer = new ResizeObserver(schedule);
    observer.observe(row);
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [rowRef, recompute]);

  return { overflowIds, registerGroup };
}
