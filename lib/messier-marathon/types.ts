export type MessierMarathonReadiness =
  | 'recommended'
  | 'limited'
  | 'not_recommended';

export type MessierMarathonStageId =
  | 'dusk'
  | 'early-evening'
  | 'prime-night'
  | 'pre-dawn'
  | 'final-window';

export type MessierMarathonCheckpointStatus =
  | 'pending'
  | 'completed'
  | 'skipped'
  | 'missed';

export type MessierMarathonRecoveryMode = 'full' | 'best_effort';

export type MessierMarathonLimitingFactorCode =
  | 'no-astronomical-night'
  | 'short-darkness'
  | 'low-visible-count'
  | 'critical-checkpoint-missed';

export interface MessierMarathonLimitingFactor {
  code: MessierMarathonLimitingFactorCode;
  messageKey: string;
  detail?: string;
}

export interface MessierMarathonCheckpoint {
  targetId: string;
  targetName: string;
  stageId: MessierMarathonStageId;
  order: number;
  critical: boolean;
  status: MessierMarathonCheckpointStatus;
  visibilityHours: number;
  transitAltitude: number;
  recommendedWindowStart: string;
  recommendedWindowEnd: string;
}

export interface MessierMarathonStageSummary {
  id: MessierMarathonStageId;
  labelKey: string;
  checkpointIds: string[];
  completedCount: number;
  criticalCount: number;
}

export interface MessierMarathonRecoveryState {
  mode: MessierMarathonRecoveryMode;
  reasonCode?: MessierMarathonLimitingFactorCode;
  nextCheckpointId: string | null;
  nextStageId: MessierMarathonStageId | null;
  catchUpTargetIds: string[];
  updatedAt: string;
}

export interface MessierMarathonGuideSession {
  sessionId: string;
  date: string;
  latitude: number;
  longitude: number;
  readiness: MessierMarathonReadiness;
  visibleTargetCount: number;
  totalMessierCount: number;
  darknessHours: number;
  limitingFactors: MessierMarathonLimitingFactor[];
  stages: MessierMarathonStageSummary[];
  checkpoints: MessierMarathonCheckpoint[];
  recovery: MessierMarathonRecoveryState;
  sourceListId?: string;
  sourcePlanId?: string;
  sourceExecutionId?: string;
  startedAt: string;
  updatedAt: string;
}

export interface EvaluateMessierMarathonOptions {
  date: Date;
  latitude: number;
  longitude: number;
  minAltitude?: number;
}

export interface MessierMarathonPlannerContext {
  kind: 'messier-marathon';
  sessionId: string;
  readiness: MessierMarathonReadiness;
  mode: MessierMarathonRecoveryMode;
  checkpointOrder: string[];
  criticalCheckpointIds: string[];
  stageByTargetId: Record<string, MessierMarathonStageId>;
  plannerTargetIdByCatalogId?: Record<string, string>;
  catalogIdByPlannerTargetId?: Record<string, string>;
  sourceListId?: string;
  sourcePlanId?: string;
  sourceExecutionId?: string;
}
