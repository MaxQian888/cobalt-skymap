import type { ARSurfacePresentationMode } from '@/lib/core/ar-adaptation';

export type ARSurfaceLayoutKind = 'assistant' | 'recovery' | 'camera-controls';
export type ARSurfaceLayoutAlign = 'center' | 'stretch';

export interface ARSurfaceLayoutTokens {
  align: ARSurfaceLayoutAlign;
  topOffsetRem: number;
  sideInsetRem: number;
  maxWidthRem: number;
  gapRem: number;
  stickyActions: boolean;
}

const ASSISTANT_LAYOUTS: Record<ARSurfacePresentationMode, ARSurfaceLayoutTokens> = {
  'floating-card': {
    align: 'center',
    topOffsetRem: 0.5,
    sideInsetRem: 0.75,
    maxWidthRem: 40,
    gapRem: 0.75,
    stickyActions: false,
  },
  'edge-sheet': {
    align: 'stretch',
    topOffsetRem: 0.5,
    sideInsetRem: 0.5,
    maxWidthRem: 32,
    gapRem: 0.5,
    stickyActions: true,
  },
  'compact-strip': {
    align: 'stretch',
    topOffsetRem: 0.5,
    sideInsetRem: 0.5,
    maxWidthRem: 28,
    gapRem: 0.375,
    stickyActions: true,
  },
};

const RECOVERY_LAYOUTS: Record<ARSurfacePresentationMode, ARSurfaceLayoutTokens> = {
  'floating-card': {
    align: 'center',
    topOffsetRem: 0.5,
    sideInsetRem: 0.75,
    maxWidthRem: 36,
    gapRem: 0.5,
    stickyActions: false,
  },
  'edge-sheet': {
    align: 'stretch',
    topOffsetRem: 0.5,
    sideInsetRem: 0.5,
    maxWidthRem: 30,
    gapRem: 0.5,
    stickyActions: true,
  },
  'compact-strip': {
    align: 'stretch',
    topOffsetRem: 0.5,
    sideInsetRem: 0.5,
    maxWidthRem: 28,
    gapRem: 0.375,
    stickyActions: true,
  },
};

const CAMERA_CONTROL_LAYOUTS: Record<ARSurfacePresentationMode, ARSurfaceLayoutTokens> = {
  'floating-card': {
    align: 'stretch',
    topOffsetRem: 3.5,
    sideInsetRem: 0.75,
    maxWidthRem: 4,
    gapRem: 0.5,
    stickyActions: false,
  },
  'edge-sheet': {
    align: 'stretch',
    topOffsetRem: 3.25,
    sideInsetRem: 0.5,
    maxWidthRem: 4,
    gapRem: 0.5,
    stickyActions: false,
  },
  'compact-strip': {
    align: 'stretch',
    topOffsetRem: 3,
    sideInsetRem: 0.5,
    maxWidthRem: 4,
    gapRem: 0.375,
    stickyActions: false,
  },
};

export function getARSurfaceLayoutTokens(
  surface: ARSurfaceLayoutKind,
  mode: ARSurfacePresentationMode,
): ARSurfaceLayoutTokens {
  if (surface === 'assistant') {
    return ASSISTANT_LAYOUTS[mode];
  }
  if (surface === 'recovery') {
    return RECOVERY_LAYOUTS[mode];
  }
  return CAMERA_CONTROL_LAYOUTS[mode];
}

export function withSafeAreaInset(edge: 'top' | 'right' | 'bottom' | 'left', rem: number): string {
  return `calc(${rem}rem + var(--safe-area-${edge}))`;
}
