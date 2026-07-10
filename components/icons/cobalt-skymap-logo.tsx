/**
 * Cobalt Skymap brand logo icon
 * A stylized star with compass ring — representing astronomy + navigation
 */

import { cn } from '@/lib/utils';

interface CobaltSkymapLogoProps {
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

export function CobaltSkymapLogo({ className, style, strokeWidth = 1.5 }: CobaltSkymapLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4', className)}
      style={style}
      aria-hidden="true"
    >
      {/* Outer compass ring */}
      <circle cx="12" cy="12" r="10.5" strokeWidth={strokeWidth * 0.7} strokeDasharray="2 3" />

      {/* Cardinal ticks */}
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />

      {/* Central 4-point star */}
      <polygon
        points="12,4 13.8,9.5 19,9.8 15,13 16.2,18.5 12,15.5 7.8,18.5 9,13 5,9.8 10.2,9.5"
        fill="currentColor"
        stroke="none"
        opacity="0.9"
      />

      {/* Inner bright core */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
