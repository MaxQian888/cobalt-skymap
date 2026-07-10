'use client';

import { LONG_PRESS_DURATION } from '@/lib/core/constants/stellarium-canvas';

const RING_SIZE = 40;
const STROKE_WIDTH = 3;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface LongPressIndicatorProps {
  /** Container-relative touch point, or null when no press is in progress. */
  position: { x: number; y: number } | null;
}

/**
 * Circular progress ring shown at the touch point while the long-press timer
 * runs (500ms) — feedback that holding will open the context menu. Pure CSS
 * animation (stroke-dashoffset), no per-frame JS. A short opacity fade-in
 * keeps quick taps from flashing the ring.
 */
export function LongPressIndicator({ position }: LongPressIndicatorProps) {
  if (!position) return null;

  return (
    <div
      className="long-press-indicator pointer-events-none absolute z-20"
      data-testid="long-press-indicator"
      aria-hidden
      style={{
        left: position.x,
        top: position.y,
        width: RING_SIZE,
        height: RING_SIZE,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          className="long-press-indicator-progress"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{ animationDuration: `${LONG_PRESS_DURATION}ms` }}
        />
      </svg>
    </div>
  );
}
