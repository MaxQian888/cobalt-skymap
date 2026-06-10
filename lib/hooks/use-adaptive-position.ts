import { useState, useEffect, useMemo, type RefObject } from 'react';

export interface AdaptivePositionOptions {
  padding?: number;
  offset?: number;
  rightPanelWidth?: number;
  topBarHeight?: number;
  bottomBarHeight?: number;
  defaultPosition?: { left: number; top: number };
}

export interface AdaptivePositionResult {
  position: { left: number; top: number };
  panelRef: RefObject<HTMLDivElement | null>;
}

const DEFAULT_OPTIONS: Required<AdaptivePositionOptions> = {
  padding: 16,
  offset: 20,
  rightPanelWidth: 320,
  topBarHeight: 64,
  bottomBarHeight: 48,
  defaultPosition: { left: 12, top: 64 },
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
  const [panelSize, setPanelSize] = useState({ width: 300, height: 400 });

  // Measure panel size when deps change
  useEffect(() => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPanelSize({ width: rect.width, height: rect.height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const position = useMemo(() => {
    if (!clickPosition || !containerBounds) {
      return opts.defaultPosition;
    }

    const inferredRightPanelWidth =
      containerBounds.width < 1024
        ? 0
        : opts.rightPanelWidth;
    const availableWidth = containerBounds.width - inferredRightPanelWidth;

    let left = clickPosition.x + opts.offset;
    let top = clickPosition.y - panelSize.height / 2;

    // Check right edge
    if (left + panelSize.width + opts.padding > availableWidth) {
      left = clickPosition.x - panelSize.width - opts.offset;
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

    return { left, top };
  }, [clickPosition, containerBounds, panelSize, opts.padding, opts.offset, opts.rightPanelWidth, opts.topBarHeight, opts.bottomBarHeight, opts.defaultPosition]);

  return position;
}
