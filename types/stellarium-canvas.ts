// ============================================================================
// Stellarium Canvas Types
// ============================================================================

import type { StarmapDataTier, StarmapTierReadiness } from '@/lib/core/starmap-data-tier';
import type { ClickCoords } from '@/lib/core/types';
import type { SkyMapCanvasRef, SkyMapCanvasProps } from '@/lib/core/types/sky-engine';

// Re-export ClickCoords as ClickCoordinates for backward compatibility
export type ClickCoordinates = ClickCoords;

// StellariumCanvasRef is identical to SkyMapCanvasRef.
// Using a type alias ensures type compatibility when used as a ref target
// in the SkyMapCanvas engine-switching wrapper.
export type StellariumCanvasRef = SkyMapCanvasRef;

// StellariumCanvasProps is identical to SkyMapCanvasProps.
export type StellariumCanvasProps = SkyMapCanvasProps;

// Re-export from canonical location to avoid duplicate interface definitions
export type { EngineStatus } from '@/lib/core/types/sky-engine';

export type LoadingPhase =
  | 'idle'
  | 'preparing'
  | 'loading_script'
  | 'initializing_engine'
  | 'ready'
  | 'retrying'
  | 'degraded'
  | 'failed'
  | 'timed_out';

export type LoadingErrorCode =
  | 'container_not_ready'
  | 'script_timeout'
  | 'script_failed'
  | 'engine_timeout'
  | 'engine_init_failed'
  | 'overall_timeout'
  | 'unknown';

export interface LoadingState {
  isLoading: boolean;
  loadingStatus: string;
  errorMessage: string | null;
  startTime: number | null;
  /** 0-100 progress percentage for the loading bar */
  progress: number;
  phase?: LoadingPhase;
  errorCode?: LoadingErrorCode | null;
  retryCount?: number;
  tierReadiness?: Partial<Record<StarmapDataTier, StarmapTierReadiness>>;
}

export interface ViewDirection {
  ra: number;
  dec: number;
  alt: number;
  az: number;
}
