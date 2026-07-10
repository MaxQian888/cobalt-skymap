'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBatchProjection } from '@/lib/hooks/use-coordinate-projection';
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion';
import { useMobileShell } from '../view/use-mobile-shell';
import type { SelectedObjectData } from '@/lib/core/types';

export interface SelectionPulseProps {
  selectedObject: SelectedObjectData | null;
  containerWidth: number;
  containerHeight: number;
}

/**
 * One-shot expanding ring played at the selected object's screen position —
 * an immediate acknowledgement that the tap/click landed (the engine's own
 * reticle is subtle and easy to miss). The ring is projected per frame, so it
 * stays glued to the object if the view pans mid-animation, and unsubscribes
 * from the animation loop once the animation ends (zero idle cost).
 */
export function SelectionPulse({ selectedObject, containerWidth, containerHeight }: SelectionPulseProps) {
  const [active, setActive] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { isMobileShell } = useMobileShell();

  // Identity of the current selection — a new object (or re-selection with a
  // fresh coordinate timestamp) replays the pulse.
  const pulseKey = selectedObject
    ? `${selectedObject.names.join('|')}@${selectedObject.coordinateTimestamp ?? ''}`
    : null;

  useEffect(() => {
    if (!pulseKey) {
      setActive(false);
      return;
    }
    setActive(true);
    // Light haptic acknowledgement on touch devices (guarded — iOS Safari has
    // no vibrate API).
    if (isMobileShell && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Vibration is best-effort feedback only.
      }
    }
  // Replay strictly on selection identity change, not shell resize.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  const items = useMemo(
    () => (active && selectedObject ? [selectedObject] : []),
    [active, selectedObject],
  );

  const projected = useBatchProjection({
    containerWidth,
    containerHeight,
    items,
    getRa: (o) => o.raDeg,
    getDec: (o) => o.decDeg,
    enabled: active && !prefersReducedMotion,
    intervalMs: 16,
    loopId: 'selection-pulse',
  });

  if (!active || prefersReducedMotion || projected.length === 0) return null;

  const { x, y } = projected[0];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-testid="selection-pulse">
      <div
        key={pulseKey}
        className="selection-pulse-ring absolute rounded-full border-2 border-primary"
        style={{ left: x, top: y, width: 16, height: 16, transform: 'translate(-50%, -50%)' }}
        onAnimationEnd={() => setActive(false)}
      />
    </div>
  );
}
