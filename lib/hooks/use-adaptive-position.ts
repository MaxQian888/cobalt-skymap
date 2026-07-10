import { useState, useLayoutEffect, useMemo, type RefObject } from 'react';

export interface AdaptivePositionOptions {
  padding?: number;
  offset?: number;
  rightPanelWidth?: number;
  topBarHeight?: number;
  bottomBarHeight?: number;
  defaultPosition?: { left: number; top: number };
  /**
   * Radius (px) of a keep-out circle around the click/anchor point that the
   * panel must not cover — keeps the just-selected object (engine reticle +
   * selection pulse) visible next to the panel. 0 disables (legacy behavior).
   */
  keepOutRadius?: number;
}

/**
 * Default keep-out radius for the InfoPanel: clears the ~44px selection pulse
 * ring and the engine reticle around the selected object.
 */
export const DEFAULT_KEEP_OUT_RADIUS = 48;

/** True when a circle (center cx/cy, radius r) intersects an axis-aligned rect. */
export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rect: { left: number; top: number; width: number; height: number },
): boolean {
  const closestX = Math.max(rect.left, Math.min(cx, rect.left + rect.width));
  const closestY = Math.max(rect.top, Math.min(cy, rect.top + rect.height));
  return Math.hypot(cx - closestX, cy - closestY) < r;
}

export interface AdaptivePositionResult {
  position: { left: number; top: number; maxHeight?: number };
  panelRef: RefObject<HTMLDivElement | null>;
}

/**
 * Fixed render width of the InfoPanel (`w-[min(20rem,…)]` → 20rem = 320px).
 * Seeding panelSize.width with the real value avoids a first-frame horizontal
 * jump before the layout-effect measurement runs.
 */
const PANEL_WIDTH = 320;

/**
 * Width at/below which the app switches to the mobile shell (no right rail).
 * Mirrors MOBILE_SHELL_MAX_WIDTH in use-mobile-shell.ts / ar-adaptation.ts —
 * kept in sync so panel positioning reserves rail space on exactly the same
 * viewports the desktop rail actually renders on.
 */
const DESKTOP_SHELL_MIN_WIDTH = 900;

const DEFAULT_OPTIONS: Required<AdaptivePositionOptions> = {
  padding: 16,
  // Footprint of the desktop right rail (--rail-width 52px + --rail-gap 12px +
  // breathing room), not a full 320px panel — the floating tool panels open
  // separately, so the InfoPanel only needs to clear the slim rail.
  offset: 20,
  rightPanelWidth: 72,
  topBarHeight: 64,
  bottomBarHeight: 48,
  defaultPosition: { left: 12, top: 64 },
  keepOutRadius: 0,
};

/**
 * Hook to calculate adaptive panel position relative to a click point,
 * avoiding overlap with screen edges and reserved UI areas.
 */
export function useAdaptivePosition(
  panelRef: RefObject<HTMLDivElement | null>,
  clickPosition: { x: number; y: number } | undefined,
  containerBounds: { width: number; height: number } | undefined,
  deps: React.DependencyList = [],
  options: AdaptivePositionOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [panelSize, setPanelSize] = useState({ width: PANEL_WIDTH, height: 400 });

  // Measure panel size when deps change. useLayoutEffect runs before paint, so
  // the re-position happens in the same frame and is never visible to the user.
  useLayoutEffect(() => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPanelSize({ width: rect.width, height: rect.height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const position = useMemo(() => {
    if (!clickPosition || !containerBounds) {
      return { ...opts.defaultPosition, maxHeight: undefined as number | undefined };
    }

    const inferredRightPanelWidth =
      containerBounds.width <= DESKTOP_SHELL_MIN_WIDTH
        ? 0
        : opts.rightPanelWidth;
    const availableWidth = containerBounds.width - inferredRightPanelWidth;

    // Horizontal offset must clear the keep-out circle around the anchor.
    const clearance = Math.max(opts.offset, opts.keepOutRadius > 0 ? opts.keepOutRadius + 8 : 0);

    let left = clickPosition.x + clearance;
    let top = clickPosition.y - panelSize.height / 2;

    // Check right edge
    if (left + panelSize.width + opts.padding > availableWidth) {
      left = clickPosition.x - panelSize.width - clearance;
    }

    // Clamp to available area
    if (left + panelSize.width > availableWidth) {
      left = availableWidth - panelSize.width - opts.padding;
    }

    // Check left edge
    if (left < opts.padding) {
      left = opts.padding;
    }

    // Check top edge
    if (top < opts.topBarHeight + opts.padding) {
      top = opts.topBarHeight + opts.padding;
    }

    // Check bottom edge
    if (top + panelSize.height + opts.padding > containerBounds.height - opts.bottomBarHeight) {
      top = containerBounds.height - panelSize.height - opts.bottomBarHeight - opts.padding;
    }

    // Final top re-clamp: when the panel is taller than the available band, the
    // bottom-edge adjustment above can push `top` back above the top bar. The
    // top edge wins (a clipped bottom is preferable to hiding the panel header
    // under the toolbar).
    if (top < opts.topBarHeight + opts.padding) {
      top = opts.topBarHeight + opts.padding;
    }

    // Keep-out escape: the edge clamps above can push the panel back over the
    // anchor. If it now covers the keep-out circle, escape vertically to
    // whichever side of the anchor has room, then re-clamp. If it still
    // overlaps (degenerate small container), accept — panel visibility wins.
    if (
      opts.keepOutRadius > 0 &&
      circleIntersectsRect(clickPosition.x, clickPosition.y, opts.keepOutRadius, {
        left,
        top,
        width: panelSize.width,
        height: panelSize.height,
      })
    ) {
      const rectCenterY = top + panelSize.height / 2;
      if (clickPosition.y <= rectCenterY) {
        top = clickPosition.y + opts.keepOutRadius + opts.padding;
      } else {
        top = clickPosition.y - opts.keepOutRadius - opts.padding - panelSize.height;
      }
      if (top + panelSize.height + opts.padding > containerBounds.height - opts.bottomBarHeight) {
        top = containerBounds.height - panelSize.height - opts.bottomBarHeight - opts.padding;
      }
      if (top < opts.topBarHeight + opts.padding) {
        top = opts.topBarHeight + opts.padding;
      }
    }

    // Cap the panel height to the space actually available below its final
    // `top`, so the scrollable body shrinks instead of clipping off-screen when
    // the panel is pushed down near the bottom edge.
    const maxHeight =
      containerBounds.height - top - opts.bottomBarHeight - opts.padding;

    return { left, top, maxHeight };
  }, [clickPosition, containerBounds, panelSize, opts.padding, opts.offset, opts.rightPanelWidth, opts.topBarHeight, opts.bottomBarHeight, opts.defaultPosition, opts.keepOutRadius]);

  return position;
}
