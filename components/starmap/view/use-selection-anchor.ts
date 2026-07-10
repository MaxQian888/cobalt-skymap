'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStellariumStore } from '@/lib/stores';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useGlobalAnimationLoop } from '@/lib/hooks/use-animation-frame';
import { createCoordinateProjector } from '@/lib/hooks/use-coordinate-projection';
import type { SelectedObjectData } from '@/lib/core/types';

/** A selection within this window of a canvas pointerdown is click-driven. */
const CLICK_ANCHOR_WINDOW_MS = 750;
/** Projection sampling cadence while waiting for the view to settle. */
const SAMPLE_INTERVAL_MS = 150;
/** Two consecutive samples closer than this mean the view has settled. */
const SETTLE_EPSILON_PX = 2;
/** Give up waiting for settle and freeze the last sample after this long. */
const SETTLE_TIMEOUT_MS = 1500;

export interface UseSelectionAnchorArgs {
  selectedObject: SelectedObjectData | null;
  clickPosition: { x: number; y: number } | undefined;
  /** performance.now() of the last pointerdown that hit the sky canvas. */
  lastCanvasPointerDownAtRef: RefObject<number>;
  containerBounds: { width: number; height: number } | undefined;
}

/**
 * Anchor point for the floating InfoPanel.
 *
 * Click-driven selections freeze the actual click position (previous
 * behavior). Programmatic selections (search, toolbar, CLI) used to reuse a
 * stale click position; instead the selected object's RA/Dec is projected to
 * screen space until the view settles after pointAndLock, then frozen — the
 * panel must not chase the sky afterwards.
 */
export function useSelectionAnchor({
  selectedObject,
  clickPosition,
  lastCanvasPointerDownAtRef,
  containerBounds,
}: UseSelectionAnchorArgs): { x: number; y: number } | undefined {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
  const [sampling, setSampling] = useState(false);

  const selectionKey = selectedObject
    ? `${selectedObject.names.join('|')}@${selectedObject.coordinateTimestamp ?? ''}`
    : null;

  // Refs so the sampling callback never closes over stale values. Synced via
  // effects (not during render) — these effects run in declaration order
  // before the selection effect below, so the refs are current by the time
  // it reads them.
  const selectedRef = useRef(selectedObject);
  useEffect(() => {
    selectedRef.current = selectedObject;
  }, [selectedObject]);
  const boundsRef = useRef(containerBounds);
  useEffect(() => {
    boundsRef.current = containerBounds;
  }, [containerBounds]);
  const clickPositionRef = useRef(clickPosition);
  useEffect(() => {
    clickPositionRef.current = clickPosition;
  }, [clickPosition]);

  const samplingStateRef = useRef<{ lastSample: { x: number; y: number } | null; startedAt: number } | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!selectionKey) {
      samplingStateRef.current = null;
      // This effect drives an imperative sampling process (starts/stops the
      // animation-loop sampler), not a pure derived value; the reset below is the
      // terminal step of that process. Deferred past the effect body so it doesn't
      // run synchronously during the effect.
      queueMicrotask(() => {
        setSampling(false);
        setAnchor(undefined);
      });
      return;
    }

    const clickDriven =
      performance.now() - (lastCanvasPointerDownAtRef.current ?? 0) < CLICK_ANCHOR_WINDOW_MS;
    if (clickDriven && clickPositionRef.current) {
      samplingStateRef.current = null;
      setSampling(false);
      setAnchor(clickPositionRef.current);
      return;
    }

    // Programmatic selection: sample the object's projected position until
    // the view settles (pointAndLock animation finishes), then freeze.
    samplingStateRef.current = { lastSample: null, startedAt: performance.now() };
    lastTickRef.current = 0;
    setSampling(true);
  // Freeze semantics: re-anchor only when the selection identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const sampleTick = useCallback((_delta: number, timestamp: number) => {
    const state = samplingStateRef.current;
    const selected = selectedRef.current;
    const bounds = boundsRef.current;
    if (!state || !selected || !bounds) return;
    if (timestamp - lastTickRef.current < SAMPLE_INTERVAL_MS) return;
    lastTickRef.current = timestamp;

    const freeze = (point: { x: number; y: number }) => {
      samplingStateRef.current = null;
      setSampling(false);
      setAnchor(point);
    };

    const timedOut = performance.now() - state.startedAt > SETTLE_TIMEOUT_MS;
    const { stel, aladin } = useStellariumStore.getState();
    const skyEngine = useSettingsStore.getState().skyEngine;
    const projector = createCoordinateProjector(stel, bounds.width, bounds.height, 1.1, aladin, skyEngine);
    const pos = projector(selected.raDeg, selected.decDeg);

    if (!pos || !pos.visible) {
      if (timedOut) {
        // Never became visible — fall back to the container center.
        freeze(state.lastSample ?? { x: bounds.width / 2, y: bounds.height / 2 });
      }
      return;
    }

    const last = state.lastSample;
    if (last && Math.hypot(pos.x - last.x, pos.y - last.y) < SETTLE_EPSILON_PX) {
      freeze({ x: pos.x, y: pos.y });
      return;
    }
    state.lastSample = { x: pos.x, y: pos.y };
    if (timedOut) {
      freeze(state.lastSample);
    }
  }, []);

  useGlobalAnimationLoop('selection-anchor', sampleTick, sampling);

  return selectedObject ? anchor : undefined;
}
