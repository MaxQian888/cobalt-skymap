/**
 * Type definitions for starmap feedback components
 * Extracted from components/starmap/feedback/ for architectural separation
 */

// ============================================================================
// LoadingSkeleton
// ============================================================================

export interface LoadingSkeletonProps {
  className?: string;
  variant?: 'card' | 'panel' | 'list' | 'chart' | 'toolbar';
}

/** Pre-computed star position for loading skeleton background */
export interface StarPosition {
  left: number;
  top: number;
  delay: number;
}

// ============================================================================
// SplashScreen
// ============================================================================

export interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
  /** When true, splash will begin its fade-out sequence regardless of minDuration */
  isReady?: boolean;
  /** Optional non-blocking readiness hint shown before splash dismisses */
  completionHint?: string | null;
}

/** Generated star data for splash screen star field */
export interface GeneratedStar {
  id: number;
  size: number;
  left: number;
  top: number;
  duration: number;
  delay: number;
  brightness: number;
}

/** Shooting star data for splash screen animation */
export interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  delay: number;
  duration: number;
}
