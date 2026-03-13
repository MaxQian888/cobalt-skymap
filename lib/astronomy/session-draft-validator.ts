import type {
  ManualScheduleItem,
  SessionDraftV2,
  SessionConstraintSet,
  SessionWeatherSnapshot,
} from '@/types/starmap/session-planner-v2';
import type { MessierMarathonPlannerContext, MessierMarathonStageId } from '@/lib/messier-marathon';
import type { OptimizationStrategy } from '@/types/starmap/planning';

export const DEFAULT_SESSION_CONSTRAINTS: SessionConstraintSet = {
  minAltitude: 30,
  minImagingTime: 30,
  minMoonDistance: 20,
  useExposurePlanDuration: true,
  weatherLimits: {
    maxCloudCover: 70,
    maxHumidity: 90,
    maxWindSpeed: 25,
  },
  safetyLimits: {
    enforceMountSafety: false,
    avoidMeridianFlipWindow: false,
  },
};

const VALID_STRATEGIES = new Set<OptimizationStrategy>([
  'altitude',
  'transit',
  'moon',
  'duration',
  'balanced',
]);

export type DraftValidationCode =
  | 'draft-invalid'
  | 'session-window'
  | 'manual-edit'
  | 'target-resolution';

export interface DraftValidationIssue {
  code: DraftValidationCode;
  severity: 'blocking' | 'warning';
  message: string;
  targetId?: string;
}

export interface DraftValidationResult {
  draft: SessionDraftV2;
  issues: DraftValidationIssue[];
  blockingIssues: DraftValidationIssue[];
  warningIssues: DraftValidationIssue[];
}

interface NormalizeDraftOptions {
  fallbackDate?: Date;
  knownTargetIds?: Set<string>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isValidHhMm(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeSessionWindow(
  input: Partial<SessionConstraintSet>['sessionWindow'],
  issues: DraftValidationIssue[],
): SessionConstraintSet['sessionWindow'] {
  if (!input) return undefined;

  const start = typeof input.startTime === 'string' ? input.startTime.trim() : '';
  const end = typeof input.endTime === 'string' ? input.endTime.trim() : '';
  if (!start && !end) return undefined;

  if (!start || !end) {
    issues.push({
      code: 'session-window',
      severity: 'blocking',
      message: 'Session window requires both start and end time.',
    });
    return undefined;
  }
  if (!isValidHhMm(start) || !isValidHhMm(end)) {
    issues.push({
      code: 'session-window',
      severity: 'blocking',
      message: 'Session window time must be in HH:mm format.',
    });
    return undefined;
  }
  if (start === end) {
    issues.push({
      code: 'session-window',
      severity: 'blocking',
      message: 'Session window start and end cannot be equal.',
    });
    return undefined;
  }

  return {
    startTime: start,
    endTime: end,
  };
}

export function normalizeSessionConstraints(
  input: Partial<SessionConstraintSet> | undefined,
  issues?: DraftValidationIssue[],
): SessionConstraintSet {
  const minAltitude = isFiniteNumber(input?.minAltitude)
    ? clamp(Math.round(input.minAltitude), 0, 90)
    : DEFAULT_SESSION_CONSTRAINTS.minAltitude;
  const minImagingTime = isFiniteNumber(input?.minImagingTime)
    ? Math.max(1, Math.round(input.minImagingTime))
    : DEFAULT_SESSION_CONSTRAINTS.minImagingTime;
  const minMoonDistance = isFiniteNumber(input?.minMoonDistance)
    ? clamp(Math.round(input.minMoonDistance), 0, 180)
    : DEFAULT_SESSION_CONSTRAINTS.minMoonDistance;
  const useExposurePlanDuration =
    typeof input?.useExposurePlanDuration === 'boolean'
      ? input.useExposurePlanDuration
      : DEFAULT_SESSION_CONSTRAINTS.useExposurePlanDuration;

  const weatherLimits = {
    maxCloudCover: isFiniteNumber(input?.weatherLimits?.maxCloudCover)
      ? clamp(Math.round(input.weatherLimits.maxCloudCover), 0, 100)
      : DEFAULT_SESSION_CONSTRAINTS.weatherLimits?.maxCloudCover,
    maxHumidity: isFiniteNumber(input?.weatherLimits?.maxHumidity)
      ? clamp(Math.round(input.weatherLimits.maxHumidity), 0, 100)
      : DEFAULT_SESSION_CONSTRAINTS.weatherLimits?.maxHumidity,
    maxWindSpeed: isFiniteNumber(input?.weatherLimits?.maxWindSpeed)
      ? Math.max(0, Math.round(input.weatherLimits.maxWindSpeed))
      : DEFAULT_SESSION_CONSTRAINTS.weatherLimits?.maxWindSpeed,
  };

  const enforceMountSafety = Boolean(input?.safetyLimits?.enforceMountSafety);
  const safetyLimits = {
    enforceMountSafety,
    avoidMeridianFlipWindow: enforceMountSafety && Boolean(input?.safetyLimits?.avoidMeridianFlipWindow),
  };

  return {
    minAltitude,
    minImagingTime,
    minMoonDistance,
    useExposurePlanDuration,
    sessionWindow: normalizeSessionWindow(input?.sessionWindow, issues ?? []),
    weatherLimits,
    safetyLimits,
  };
}

function normalizeWeatherSnapshot(snapshot: unknown): SessionWeatherSnapshot | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined;
  const weather = snapshot as Partial<SessionWeatherSnapshot>;
  const source = weather.source === 'device' || weather.source === 'manual' || weather.source === 'none'
    ? weather.source
    : 'none';
  const capturedAtRaw = typeof weather.capturedAt === 'string' ? weather.capturedAt : '';
  const capturedAtDate = new Date(capturedAtRaw);
  const capturedAt = Number.isFinite(capturedAtDate.getTime())
    ? capturedAtDate.toISOString()
    : new Date().toISOString();
  const cloudCover = isFiniteNumber(weather.cloudCover) ? clamp(weather.cloudCover, 0, 100) : undefined;
  const humidity = isFiniteNumber(weather.humidity) ? clamp(weather.humidity, 0, 100) : undefined;
  const windSpeed = isFiniteNumber(weather.windSpeed) ? Math.max(0, weather.windSpeed) : undefined;
  const dewPoint = isFiniteNumber(weather.dewPoint) ? weather.dewPoint : undefined;
  return {
    source,
    capturedAt,
    cloudCover,
    humidity,
    windSpeed,
    dewPoint,
  };
}

function normalizeGuideContext(value: unknown): MessierMarathonPlannerContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<MessierMarathonPlannerContext>;
  if (raw.kind !== 'messier-marathon' || typeof raw.sessionId !== 'string') {
    return undefined;
  }

  const checkpointOrder = Array.isArray(raw.checkpointOrder)
    ? raw.checkpointOrder.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const criticalCheckpointIds = Array.isArray(raw.criticalCheckpointIds)
    ? raw.criticalCheckpointIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const stageByTargetId = raw.stageByTargetId && typeof raw.stageByTargetId === 'object'
    ? Object.entries(raw.stageByTargetId).reduce<Record<string, MessierMarathonStageId>>((accumulator, [targetId, stageId]) => {
      if (
        typeof targetId === 'string'
        && typeof stageId === 'string'
        && ['dusk', 'early-evening', 'prime-night', 'pre-dawn', 'final-window'].includes(stageId)
      ) {
        accumulator[targetId] = stageId as MessierMarathonStageId;
      }
      return accumulator;
    }, {})
    : {};
  const normalizeStringRecord = (input: unknown): Record<string, string> | undefined => {
    if (!input || typeof input !== 'object') return undefined;
    const entries = Object.entries(input).filter(
      ([key, nestedValue]) =>
        typeof key === 'string'
        && key.trim().length > 0
        && typeof nestedValue === 'string'
        && nestedValue.trim().length > 0,
    );
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  };

  return {
    kind: 'messier-marathon',
    sessionId: raw.sessionId,
    readiness:
      raw.readiness === 'recommended'
      || raw.readiness === 'limited'
      || raw.readiness === 'not_recommended'
        ? raw.readiness
        : 'limited',
    mode: raw.mode === 'full' || raw.mode === 'best_effort' ? raw.mode : 'best_effort',
    checkpointOrder,
    criticalCheckpointIds,
    stageByTargetId,
    plannerTargetIdByCatalogId: normalizeStringRecord(raw.plannerTargetIdByCatalogId),
    catalogIdByPlannerTargetId: normalizeStringRecord(raw.catalogIdByPlannerTargetId),
    sourceListId: typeof raw.sourceListId === 'string' ? raw.sourceListId : undefined,
    sourcePlanId: typeof raw.sourcePlanId === 'string' ? raw.sourcePlanId : undefined,
    sourceExecutionId: typeof raw.sourceExecutionId === 'string' ? raw.sourceExecutionId : undefined,
  };
}

function normalizeManualEdit(
  value: unknown,
  knownTargetIds: Set<string> | undefined,
  issues: DraftValidationIssue[],
): ManualScheduleItem | null {
  if (!value || typeof value !== 'object') {
    issues.push({
      code: 'manual-edit',
      severity: 'warning',
      message: 'Ignored malformed manual edit entry.',
    });
    return null;
  }

  const edit = value as Partial<ManualScheduleItem>;
  const targetId = typeof edit.targetId === 'string' ? edit.targetId.trim() : '';
  if (!targetId) {
    issues.push({
      code: 'manual-edit',
      severity: 'warning',
      message: 'Ignored manual edit without target id.',
    });
    return null;
  }

  if (knownTargetIds && !knownTargetIds.has(targetId)) {
    issues.push({
      code: 'target-resolution',
      severity: 'warning',
      targetId,
      message: `Target '${targetId}' does not exist in current target list.`,
    });
    return null;
  }

  const next: ManualScheduleItem = {
    targetId,
    locked: Boolean(edit.locked),
  };

  if (typeof edit.startTime === 'string' && edit.startTime.trim().length > 0) {
    const valueStart = edit.startTime.trim();
    if (!isValidHhMm(valueStart)) {
      issues.push({
        code: 'manual-edit',
        severity: 'blocking',
        targetId,
        message: `Invalid start time '${valueStart}' for target '${targetId}'.`,
      });
      return null;
    }
    next.startTime = valueStart;
  }

  if (typeof edit.endTime === 'string' && edit.endTime.trim().length > 0) {
    const valueEnd = edit.endTime.trim();
    if (!isValidHhMm(valueEnd)) {
      issues.push({
        code: 'manual-edit',
        severity: 'blocking',
        targetId,
        message: `Invalid end time '${valueEnd}' for target '${targetId}'.`,
      });
      return null;
    }
    next.endTime = valueEnd;
  }

  if (isFiniteNumber(edit.durationMinutes)) {
    if (edit.durationMinutes <= 0) {
      issues.push({
        code: 'manual-edit',
        severity: 'blocking',
        targetId,
        message: `Duration must be positive for target '${targetId}'.`,
      });
      return null;
    }
    next.durationMinutes = Math.max(1, Math.round(edit.durationMinutes));
  }

  if (!next.startTime && !next.endTime && !next.durationMinutes) {
    issues.push({
      code: 'manual-edit',
      severity: 'warning',
      targetId,
      message: `Ignored manual edit without scheduling data for target '${targetId}'.`,
    });
    return null;
  }

  if (typeof edit.reason === 'string') {
    next.reason = edit.reason;
  }

  return next;
}

export function normalizeSessionDraft(
  value: unknown,
  options: NormalizeDraftOptions = {},
): SessionDraftV2 {
  return validateSessionDraft(value, options).draft;
}

export function validateSessionDraft(
  value: unknown,
  options: NormalizeDraftOptions = {},
): DraftValidationResult {
  const issues: DraftValidationIssue[] = [];
  const fallbackDate = options.fallbackDate ?? new Date();

  const raw = (value && typeof value === 'object' ? value : {}) as Partial<SessionDraftV2>;

  const planDateRaw = typeof raw.planDate === 'string' ? raw.planDate : '';
  const parsedPlanDate = new Date(planDateRaw);
  const planDate = Number.isFinite(parsedPlanDate.getTime())
    ? parsedPlanDate.toISOString()
    : fallbackDate.toISOString();
  if (!Number.isFinite(parsedPlanDate.getTime())) {
    issues.push({
      code: 'draft-invalid',
      severity: 'warning',
      message: 'Invalid plan date. Fallback date was applied.',
    });
  }

  const strategyCandidate = raw.strategy;
  const strategy: OptimizationStrategy = (
    typeof strategyCandidate === 'string' && VALID_STRATEGIES.has(strategyCandidate as OptimizationStrategy)
      ? (strategyCandidate as OptimizationStrategy)
      : 'balanced'
  );
  if (strategyCandidate && strategyCandidate !== strategy) {
    issues.push({
      code: 'draft-invalid',
      severity: 'warning',
      message: `Unsupported strategy '${String(strategyCandidate)}'. Fallback strategy was applied.`,
    });
  }

  const constraints = normalizeSessionConstraints(raw.constraints, issues);

  const knownTargetIds = options.knownTargetIds;
  const excludedTargetIds = Array.isArray(raw.excludedTargetIds)
    ? Array.from(new Set(
      raw.excludedTargetIds
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .filter((item) => !knownTargetIds || knownTargetIds.has(item)),
    ))
    : [];

  const manualEdits = Array.isArray(raw.manualEdits)
    ? raw.manualEdits
      .map((edit) => normalizeManualEdit(edit, knownTargetIds, issues))
      .filter((edit): edit is ManualScheduleItem => Boolean(edit))
    : [];

  const notes = typeof raw.notes === 'string' ? raw.notes : undefined;

  const weatherSnapshot = normalizeWeatherSnapshot(raw.weatherSnapshot);
  const guideContext = normalizeGuideContext(raw.guideContext);

  const draft: SessionDraftV2 = {
    planDate,
    strategy,
    constraints,
    excludedTargetIds,
    manualEdits,
    notes,
    weatherSnapshot,
    guideContext,
    exportMeta: raw.exportMeta && typeof raw.exportMeta === 'object'
      ? {
        lastFormat: raw.exportMeta.lastFormat,
        lastExportedAt: raw.exportMeta.lastExportedAt,
      }
      : undefined,
  };

  return {
    draft,
    issues,
    blockingIssues: issues.filter((issue) => issue.severity === 'blocking'),
    warningIssues: issues.filter((issue) => issue.severity === 'warning'),
  };
}
