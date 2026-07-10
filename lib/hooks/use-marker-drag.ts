'use client';

/**
 * Drag-through for sky-marker hit areas.
 *
 * Marker divs are pointer-events:auto, so a drag that starts on a marker never
 * reaches the engine canvas and the sky cannot be panned from that spot. This
 * hook watches pointer movement after a pointerdown on a marker; once it
 * exceeds MARKER_DRAG_FORWARD_THRESHOLD the gesture is handed to the engine:
 *
 * - Mouse: ONE synthetic `mousedown` on the canvas is enough — the engine's
 *   own handler installs document-level mousemove/mouseup listeners that pick
 *   up the rest of the real gesture regardless of the element under the cursor.
 * - Touch: touch events are implicitly captured by the element the touch
 *   started on, so the whole stream (touchstart/move/end) is relayed as
 *   synthetic TouchEvents carrying the same identifier.
 *
 * Below the threshold nothing is forwarded and click/tooltip/context-menu
 * behave exactly as before. After a forward, the trailing click is swallowed.
 */

import { useCallback, useRef } from 'react';
import { useStellariumStore } from '@/lib/stores';
import { MARKER_DRAG_FORWARD_THRESHOLD } from '@/lib/core/constants/stellarium-canvas';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-marker-drag');

type DragPhase = 'idle' | 'pending' | 'forwarded';

interface DragState {
  phase: DragPhase;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
}

export interface MarkerDragHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onClickCapture: (e: React.MouseEvent) => void;
}

export interface UseMarkerDragOptions {
  /** Disable forwarding entirely (Aladin engine has different listeners). */
  enabled?: boolean;
  /** Alt+mouse-drag accelerator — when it returns true, forwarding is skipped. */
  onAltDragStart?: () => boolean;
}

const canRelayTouch = () =>
  typeof Touch === 'function' && typeof TouchEvent === 'function';

function makeTouch(e: React.PointerEvent, target: EventTarget): Touch {
  return new Touch({
    identifier: e.pointerId,
    target,
    clientX: e.clientX,
    clientY: e.clientY,
    pageX: e.pageX,
    pageY: e.pageY,
  });
}

export function useMarkerDrag({ enabled = true, onAltDragStart }: UseMarkerDragOptions = {}) {
  const stateRef = useRef<DragState>({ phase: 'idle', pointerId: -1, pointerType: '', startX: 0, startY: 0 });
  const suppressClickRef = useRef(false);

  const forwardTouch = useCallback((type: 'touchstart' | 'touchmove' | 'touchend', e: React.PointerEvent) => {
    const canvasEl = useStellariumStore.getState().canvasEl;
    if (!canvasEl || !canRelayTouch()) return false;
    try {
      const touch = makeTouch(e, canvasEl);
      canvasEl.dispatchEvent(new TouchEvent(type, {
        changedTouches: [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
        touches: type === 'touchend' ? [] : [touch],
        bubbles: true,
        cancelable: true,
      }));
      return true;
    } catch (error) {
      logger.warn('Touch relay unsupported in this WebView', error);
      return false;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    const isPrimaryMouse = e.pointerType === 'mouse' && e.button === 0;
    const isTouch = e.pointerType === 'touch' && e.isPrimary;
    if (!isPrimaryMouse && !isTouch) return;

    if (e.altKey && e.pointerType === 'mouse' && onAltDragStart?.()) {
      // Alt+drag entered marker-move mode — no pan forwarding for this gesture.
      stateRef.current.phase = 'idle';
      return;
    }

    stateRef.current = {
      phase: 'pending',
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, [enabled, onAltDragStart]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current;
    if (e.pointerId !== state.pointerId) return;

    if (state.phase === 'forwarded') {
      if (state.pointerType === 'touch') {
        forwardTouch('touchmove', e);
      }
      return;
    }
    if (state.phase !== 'pending') return;

    const distance = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
    if (distance <= MARKER_DRAG_FORWARD_THRESHOLD) return;

    const canvasEl = useStellariumStore.getState().canvasEl;
    if (!canvasEl) {
      state.phase = 'idle';
      return;
    }

    if (state.pointerType === 'mouse') {
      // One synthetic mousedown; the engine's document-level move/up handlers
      // track the rest of the real gesture.
      canvasEl.dispatchEvent(new MouseEvent('mousedown', {
        clientX: state.startX,
        clientY: state.startY,
        button: 0,
        buttons: 1,
        bubbles: true,
        cancelable: true,
      }));
      state.phase = 'forwarded';
      suppressClickRef.current = true;
      return;
    }

    // Touch: relay the whole stream from the gesture's start point.
    const started = forwardTouch('touchstart', {
      ...e,
      clientX: state.startX,
      clientY: state.startY,
      pageX: e.pageX - (e.clientX - state.startX),
      pageY: e.pageY - (e.clientY - state.startY),
    } as React.PointerEvent);
    if (!started) {
      // Relay unavailable — keep today's behavior (no pan from markers).
      state.phase = 'idle';
      return;
    }
    forwardTouch('touchmove', e);
    state.phase = 'forwarded';
    suppressClickRef.current = true;
  }, [forwardTouch]);

  const endGesture = useCallback((e: React.PointerEvent) => {
    const state = stateRef.current;
    if (e.pointerId !== state.pointerId) return;
    if (state.phase === 'forwarded' && state.pointerType === 'touch') {
      forwardTouch('touchend', e);
    }
    // Mouse forwarding needs no synthetic mouseup: the engine listens on the
    // document and receives the real one.
    stateRef.current = { phase: 'idle', pointerId: -1, pointerType: '', startX: 0, startY: 0 };
  }, [forwardTouch]);

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endGesture,
    onPointerCancel: endGesture,
    onClickCapture,
  } satisfies MarkerDragHandlers;
}
