import { calculateTargetVisibility, calculateTwilightTimes } from '@/lib/astronomy/astro-utils';
import { getMessierObjects } from '@/lib/catalogs';
import type {
  EvaluateMessierMarathonOptions,
  MessierMarathonCheckpoint,
  MessierMarathonCheckpointStatus,
  MessierMarathonGuideSession,
  MessierMarathonLimitingFactor,
  MessierMarathonRecoveryState,
  MessierMarathonStageId,
  MessierMarathonStageSummary,
} from './types';

const STAGE_ORDER: MessierMarathonStageId[] = [
  'dusk',
  'early-evening',
  'prime-night',
  'pre-dawn',
  'final-window',
];

const STAGE_LABEL_KEYS: Record<MessierMarathonStageId, string> = {
  dusk: 'messierMarathon.stages.dusk',
  'early-evening': 'messierMarathon.stages.early-evening',
  'prime-night': 'messierMarathon.stages.prime-night',
  'pre-dawn': 'messierMarathon.stages.pre-dawn',
  'final-window': 'messierMarathon.stages.final-window',
};

function toIso(value: Date): string {
  return value.toISOString();
}

function buildSessionId(dateIso: string, latitude: number, longitude: number): string {
  return `messier-marathon:${dateIso}:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
}

function resolveStageId(
  midpointMs: number,
  nightStartMs: number,
  nightEndMs: number,
): MessierMarathonStageId {
  const ratio = (midpointMs - nightStartMs) / Math.max(nightEndMs - nightStartMs, 1);
  if (ratio < 0.12) return 'dusk';
  if (ratio < 0.35) return 'early-evening';
  if (ratio < 0.75) return 'prime-night';
  if (ratio < 0.92) return 'pre-dawn';
  return 'final-window';
}

function isCriticalWindow(
  startMs: number,
  endMs: number,
  nightStartMs: number,
  nightEndMs: number,
  visibilityHours: number,
): boolean {
  const nearStart = startMs - nightStartMs <= 45 * 60 * 1000;
  const nearEnd = nightEndMs - endMs <= 45 * 60 * 1000;
  return nearStart || nearEnd || visibilityHours < 0.75;
}

function buildRecovery(checkpoints: MessierMarathonCheckpoint[]): MessierMarathonRecoveryState {
  const now = new Date().toISOString();
  const nextCheckpoint = checkpoints.find((checkpoint) => checkpoint.status === 'pending') ?? null;
  const missedCritical = checkpoints.find(
    (checkpoint) => checkpoint.critical && (checkpoint.status === 'skipped' || checkpoint.status === 'missed'),
  );

  return {
    mode: missedCritical ? 'best_effort' : 'full',
    reasonCode: missedCritical ? 'critical-checkpoint-missed' : undefined,
    nextCheckpointId: nextCheckpoint?.targetId ?? null,
    nextStageId: nextCheckpoint?.stageId ?? null,
    catchUpTargetIds: checkpoints
      .filter((checkpoint) => checkpoint.status === 'pending')
      .slice(0, 3)
      .map((checkpoint) => checkpoint.targetId),
    updatedAt: now,
  };
}

function buildStages(checkpoints: MessierMarathonCheckpoint[]): MessierMarathonStageSummary[] {
  return STAGE_ORDER
    .map((stageId) => {
      const stageCheckpoints = checkpoints.filter((checkpoint) => checkpoint.stageId === stageId);
      if (stageCheckpoints.length === 0) return null;
      return {
        id: stageId,
        labelKey: STAGE_LABEL_KEYS[stageId],
        checkpointIds: stageCheckpoints.map((checkpoint) => checkpoint.targetId),
        completedCount: stageCheckpoints.filter((checkpoint) => checkpoint.status === 'completed').length,
        criticalCount: stageCheckpoints.filter((checkpoint) => checkpoint.critical).length,
      } satisfies MessierMarathonStageSummary;
    })
    .filter((stage): stage is MessierMarathonStageSummary => Boolean(stage));
}

function buildLimitingFactors(
  checkpoints: MessierMarathonCheckpoint[],
  darknessHours: number,
  hasAstronomicalNight: boolean,
  totalMessierCount: number,
): MessierMarathonLimitingFactor[] {
  const factors: MessierMarathonLimitingFactor[] = [];
  if (!hasAstronomicalNight) {
    factors.push({
      code: 'no-astronomical-night',
      messageKey: 'messierMarathon.limitingFactors.no-astronomical-night',
    });
    return factors;
  }
  if (darknessHours < 6) {
    factors.push({
      code: 'short-darkness',
      messageKey: 'messierMarathon.limitingFactors.short-darkness',
      detail: `${darknessHours.toFixed(1)}h`,
    });
  }
  if (checkpoints.length < Math.ceil(totalMessierCount * 0.65)) {
    factors.push({
      code: 'low-visible-count',
      messageKey: 'messierMarathon.limitingFactors.low-visible-count',
      detail: `${checkpoints.length}/${totalMessierCount}`,
    });
  }
  return factors;
}

function resolveReadiness(
  limitingFactors: MessierMarathonLimitingFactor[],
  checkpoints: MessierMarathonCheckpoint[],
  totalMessierCount: number,
): MessierMarathonGuideSession['readiness'] {
  if (limitingFactors.some((factor) => factor.code === 'no-astronomical-night')) {
    return 'not_recommended';
  }
  const visibilityRatio = checkpoints.length / Math.max(totalMessierCount, 1);
  if (visibilityRatio >= 0.75 && limitingFactors.length === 0) {
    return 'recommended';
  }
  if (checkpoints.length > 0) {
    return 'limited';
  }
  return 'not_recommended';
}

export function evaluateMessierMarathonSession(
  options: EvaluateMessierMarathonOptions,
): MessierMarathonGuideSession {
  const { date, latitude, longitude, minAltitude = 20 } = options;
  const twilight = calculateTwilightTimes(latitude, longitude, date);
  const hasAstronomicalNight = Boolean(twilight.astronomicalDusk && twilight.astronomicalDawn);
  const darknessHours = twilight.darknessDuration ?? 0;
  const totalMessierCount = getMessierObjects().length;
  const dateIso = toIso(date);

  if (!hasAstronomicalNight) {
    const checkpoints: MessierMarathonCheckpoint[] = [];
    return {
      sessionId: buildSessionId(dateIso, latitude, longitude),
      date: dateIso,
      latitude,
      longitude,
      readiness: 'not_recommended',
      visibleTargetCount: 0,
      totalMessierCount,
      darknessHours,
      limitingFactors: buildLimitingFactors(checkpoints, darknessHours, false, totalMessierCount),
      stages: [],
      checkpoints,
      recovery: buildRecovery(checkpoints),
      startedAt: dateIso,
      updatedAt: new Date().toISOString(),
    };
  }

  const nightStartMs = twilight.astronomicalDusk!.getTime();
  const nightEndMs = twilight.astronomicalDawn!.getTime();

  const checkpoints: MessierMarathonCheckpoint[] = getMessierObjects()
    .map<MessierMarathonCheckpoint | null>((target) => {
      const visibility = calculateTargetVisibility(
        target.ra,
        target.dec,
        latitude,
        longitude,
        minAltitude,
        date,
      );
      if (!visibility.darkImagingStart || !visibility.darkImagingEnd || visibility.darkImagingHours <= 0) {
        return null;
      }

      const startMs = visibility.darkImagingStart.getTime();
      const endMs = visibility.darkImagingEnd.getTime();
      const midpointMs = startMs + ((endMs - startMs) / 2);
      const stageId = resolveStageId(midpointMs, nightStartMs, nightEndMs);

      const checkpoint: MessierMarathonCheckpoint = {
        targetId: target.id,
        targetName: target.name,
        stageId,
        order: 0,
        critical: isCriticalWindow(
          startMs,
          endMs,
          nightStartMs,
          nightEndMs,
          visibility.darkImagingHours,
        ),
        status: 'pending',
        visibilityHours: visibility.darkImagingHours,
        transitAltitude: visibility.transitAltitude,
        recommendedWindowStart: toIso(visibility.darkImagingStart),
        recommendedWindowEnd: toIso(visibility.darkImagingEnd),
      };
      return checkpoint;
    })
    .filter((checkpoint): checkpoint is MessierMarathonCheckpoint => checkpoint !== null)
    .sort((left, right) =>
      new Date(left.recommendedWindowStart).getTime()
      - new Date(right.recommendedWindowStart).getTime(),
    )
    .map((checkpoint, index) => ({
      ...checkpoint,
      order: index + 1,
    }));

  const limitingFactors = buildLimitingFactors(
    checkpoints,
    darknessHours,
    true,
    totalMessierCount,
  );

  return {
    sessionId: buildSessionId(dateIso, latitude, longitude),
    date: dateIso,
    latitude,
    longitude,
    readiness: resolveReadiness(limitingFactors, checkpoints, totalMessierCount),
    visibleTargetCount: checkpoints.length,
    totalMessierCount,
    darknessHours,
    limitingFactors,
    stages: buildStages(checkpoints),
    checkpoints,
    recovery: buildRecovery(checkpoints),
    startedAt: dateIso,
    updatedAt: new Date().toISOString(),
  };
}

export function updateMessierMarathonCheckpointStatus(
  session: MessierMarathonGuideSession,
  targetId: string,
  status: MessierMarathonCheckpointStatus,
): MessierMarathonGuideSession {
  const checkpoints = session.checkpoints.map((checkpoint) =>
    checkpoint.targetId === targetId
      ? {
          ...checkpoint,
          status,
        }
      : checkpoint,
  );

  return {
    ...session,
    checkpoints,
    stages: buildStages(checkpoints),
    recovery: buildRecovery(checkpoints),
    updatedAt: new Date().toISOString(),
  };
}
