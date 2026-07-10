'use client';

import { useCallback, useEffect, useRef, RefObject } from 'react';
import {
  LONG_PRESS_DURATION,
  TOUCH_MOVE_THRESHOLD,
  RIGHT_CLICK_THRESHOLD,
  RIGHT_CLICK_TIME_THRESHOLD,
} from '@/lib/core/constants/stellarium-canvas';
import type { ClickCoordinates } from '@/types/stellarium-canvas';

interface UseStellariumEventsOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  getClickCoordinates: (clientX: number, clientY: number) => ClickCoordinates | null;
  onContextMenu?: (e: React.MouseEvent, coords: ClickCoordinates | null) => void;
  /**
   * Long-press progress feedback: called with the container-relative touch
   * point when the long-press timer starts, and with null when it is
   * cancelled (movement/touch-end) or fires.
   */
  onLongPressStateChange?: (state: { x: number; y: number } | null) => void;
}

export const UI_CONTROL_SELECTOR = [
  '[data-starmap-ui-control="true"]',
  '[data-starmap-scroll-surface="true"]',
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="dialog"]',
  '[data-slot="dialog-content"]',
  '[data-slot="drawer-content"]',
].join(', ');

/** True when the event target sits inside interactive starmap UI (panels, buttons…). */
export function isUiControlElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(UI_CONTROL_SELECTOR) !== null;
}

/**
 * Hook for handling right-click context menu and mobile long press events
 */
export function useStellariumEvents({
  containerRef,
  getClickCoordinates,
  onContextMenu,
  onLongPressStateChange,
}: UseStellariumEventsOptions) {
  const isUiControlTarget = useCallback((target: EventTarget | null) => isUiControlElement(target), []);

  // Long press handling for mobile devices
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartedOnUiControlRef = useRef(false);

  // Right-click drag detection - only show context menu on click, not drag
  const rightMouseDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Track right mouse button down
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Right button
        rightMouseDownPosRef.current = {
          x: e.clientX,
          y: e.clientY,
          time: Date.now(),
        };
      }
    };

    // Track mouse movement to detect drag
    const handleMouseMove = (e: MouseEvent) => {
      if (rightMouseDownPosRef.current && (e.buttons & 2)) { // Right button held
        const dx = e.clientX - rightMouseDownPosRef.current.x;
        const dy = e.clientY - rightMouseDownPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If moved too far, mark as drag (not a click)
        if (distance > RIGHT_CLICK_THRESHOLD) {
          rightMouseDownPosRef.current = null;
        }
      }
    };

    const handleContextMenu = (e: Event) => {
      const mouseEvent = e as MouseEvent;

      if (isUiControlTarget(mouseEvent.target)) {
        rightMouseDownPosRef.current = null;
        return;
      }
      
      // Check if this was a click (not a drag)
      const wasClick = rightMouseDownPosRef.current !== null && 
        (Date.now() - rightMouseDownPosRef.current.time) < RIGHT_CLICK_TIME_THRESHOLD;
      
      // Clear the tracking
      rightMouseDownPosRef.current = null;
      
      // If it was a drag, let Stellarium handle it (don't show context menu)
      if (!wasClick) {
        mouseEvent.preventDefault(); // Still prevent browser context menu
        return;
      }
      
      // Prevent default browser context menu
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      
      // Call the onContextMenu callback if provided
      if (onContextMenu) {
        const coords = getClickCoordinates(mouseEvent.clientX, mouseEvent.clientY);
        const syntheticEvent = {
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: mouseEvent,
        } as unknown as React.MouseEvent;
        onContextMenu(syntheticEvent, coords);
      }
    };

    // Long press handlers for mobile
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      touchStartedOnUiControlRef.current = isUiControlTarget(e.target);
      if (touchStartedOnUiControlRef.current) {
        if (longPressTimeoutRef.current) {
          clearTimeout(longPressTimeoutRef.current);
          longPressTimeoutRef.current = null;
        }
        touchStartPosRef.current = null;
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }
      
      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      // Progress-ring feedback at the (container-relative) touch point.
      const containerRect = container.getBoundingClientRect();
      onLongPressStateChange?.({
        x: touch.clientX - containerRect.left,
        y: touch.clientY - containerRect.top,
      });

      // Start long press timer
      longPressTimeoutRef.current = setTimeout(() => {
        if (!touchStartPosRef.current) return;

        onLongPressStateChange?.(null);
        // Haptic acknowledgement on platforms that support it.
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch {
            // Best-effort feedback only.
          }
        }

        // Call callback directly for long press (no need for synthetic event)
        if (onContextMenu) {
          const coords = getClickCoordinates(touchStartPosRef.current.x, touchStartPosRef.current.y);
          const syntheticEvent = {
            clientX: touchStartPosRef.current.x,
            clientY: touchStartPosRef.current.y,
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.MouseEvent;
          onContextMenu(syntheticEvent, coords);
        }

        touchStartPosRef.current = null;
      }, LONG_PRESS_DURATION);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartedOnUiControlRef.current) return;
      if (!touchStartPosRef.current || e.touches.length !== 1) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPosRef.current.x;
      const dy = touch.clientY - touchStartPosRef.current.y;

      // Cancel long press if moved too far
      if (Math.sqrt(dx * dx + dy * dy) > TOUCH_MOVE_THRESHOLD) {
        if (longPressTimeoutRef.current) {
          clearTimeout(longPressTimeoutRef.current);
          longPressTimeoutRef.current = null;
        }
        touchStartPosRef.current = null;
        onLongPressStateChange?.(null);
      }
    };

    const handleTouchEnd = () => {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      touchStartPosRef.current = null;
      touchStartedOnUiControlRef.current = false;
      onLongPressStateChange?.(null);
    };

    // Mouse event listeners for right-click detection
    container.addEventListener('mousedown', handleMouseDown, { capture: true });
    container.addEventListener('mousemove', handleMouseMove);
    // Use capture phase to intercept BEFORE Stellarium engine's handlers
    container.addEventListener('contextmenu', handleContextMenu, { capture: true });
    // Touch event listeners for mobile long press
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      container.removeEventListener('mousedown', handleMouseDown, { capture: true });
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
    };
  }, [containerRef, getClickCoordinates, isUiControlTarget, onContextMenu, onLongPressStateChange]);
}
