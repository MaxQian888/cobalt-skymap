import type { ImagingFeasibility } from '@/lib/core/types/astronomy';
import type { MessierMarathonPlannerContext } from '@/lib/messier-marathon';
import type { CalculationSourceMetadata, ScheduledTarget, SessionPlan } from './planning';

export type SessionExportFormat =
  | 'text'
  | 'markdown'
  | 'json'
  | 'nina-xml'
  | 'csv'
  | 'sgp-csv';

export interface SessionWeatherSnapshot {
  cloudCover?: number;
  humidity?: number;
  windSpeed?: number;
  dewPoint?: number;
  source: 'device' | 'manual' | 'none';
  capturedAt: string;
}

export interface ManualScheduleItem {
  targetId: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  locked?: boolean;
  reason?: string;
}

export interface SessionConstraintSet {
  minAltitude: number;
  minImagingTime: number;
  sessionWindow?: {
    /** Local HH:mm; end <= start means next day. */
    startTime: string;
    /** Local HH:mm; end <= start means next day. */
    endTime: string;
  };
  minMoonDistance?: number;
  /**
   * When true (default), use `TargetItem.exposurePlan.totalExposure` (minutes)
   * as the desired duration. Falls back to `minImagingTime` when missing.
   */
  useExposurePlanDuration?: boolean;
  weatherLimits?: {
    maxCloudCover?: number;
    maxHumidity?: number;
    maxWindSpeed?: number;
  };
  safetyLimits?: {
    enforceMountSafety?: boolean;
    avoidMeridianFlipWindow?: boolean;
  };
}

export type SessionConflictType =
  | 'overlap'
  | 'altitude'
  | 'moon-distance'
  | 'weather'
  | 'session-window'
  | 'insufficient-duration'
  | 'mount-safety'
  | 'manual-time';

export interface SessionConflict {
  type: SessionConflictType;
  targetId: string;
  reasonCode?: string;
  message: string;
  calculationMetadata?: CalculationSourceMetadata;
}

export interface SessionDraftV2 {
  name?: string;
  notes?: string;
  planDate: string;
  strategy: 'altitude' | 'transit' | 'moon' | 'duration' | 'balanced';
  constraints: SessionConstraintSet;
  excludedTargetIds: string[];
  manualEdits: ManualScheduleItem[];
  weatherSnapshot?: SessionWeatherSnapshot;
  guideContext?: MessierMarathonPlannerContext;
  exportMeta?: {
    lastFormat?: SessionExportFormat;
    lastExportedAt?: string;
  };
}

export interface SessionTemplate {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  draft: SessionDraftV2;
}

export type SessionExecutionStatus =
  | 'draft'
  | 'ready'
  | 'active'
  | 'completed'
  | 'archived'
  | 'cancelled';

export type ExecutionTargetStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'failed';

export interface ExecutionSummary {
  completedTargets: number;
  skippedTargets: number;
  failedTargets: number;
  totalTargets: number;
  totalObservations: number;
}

export interface PlannedSessionExecutionTarget {
  id: string;
  targetId: string;
  targetName: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledDurationMinutes: number;
  order: number;
  status: ExecutionTargetStatus;
  observationIds: string[];
  actualStart?: string;
  actualEnd?: string;
  resultNotes?: string;
  skipReason?: string;
  completionSummary?: string;
  unplanned?: boolean;
}

export interface PlannedSessionExecution {
  id: string;
  sourcePlanId: string;
  sourcePlanName: string;
  status: SessionExecutionStatus;
  planDate: string;
  locationId?: string;
  locationName?: string;
  notes?: string;
  weatherSnapshot?: SessionWeatherSnapshot;
  guideContext?: MessierMarathonPlannerContext;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  summary?: ExecutionSummary;
  targets: PlannedSessionExecutionTarget[];
}

export interface SessionPlanV2 extends SessionPlan {
  targets: ScheduledTargetWithLock[];
  conflicts: SessionConflict[];
  weatherSnapshot?: SessionWeatherSnapshot;
  draft?: SessionDraftV2;
}

export interface ScheduledTargetWithLock extends ScheduledTarget {
  locked?: boolean;
  manual?: boolean;
  /** Desired duration used during scheduling/export (minutes). */
  desiredDurationMinutes?: number;
  feasibility: ImagingFeasibility;
}
