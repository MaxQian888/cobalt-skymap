export const STARMAP_DATA_TIER_ORDER = [
  'core',
  'catalog',
  'survey',
  'enrichment',
] as const;

export type StarmapDataTier = (typeof STARMAP_DATA_TIER_ORDER)[number];
export type StarmapTierReadiness = 'ready' | 'degraded' | 'blocked';
export type StarmapSourceFallbackRole = 'primary' | 'fallback' | 'supplemental';
export type StarmapResourceState = 'pending' | 'loading' | 'ready' | 'failed';

export interface StarmapTierCandidate {
  id: string;
  tier: StarmapDataTier;
  enabled: boolean;
  priority: number;
  fallbackRole: StarmapSourceFallbackRole;
  available?: boolean;
}

export interface StarmapTierResourceSnapshot {
  id: string;
  tier: StarmapDataTier;
  critical: boolean;
  state: StarmapResourceState;
}

export interface StarmapTierPlanEntry {
  tier: StarmapDataTier;
  state: StarmapTierReadiness;
  candidates: StarmapTierCandidate[];
  activeCandidateIds: string[];
  blockedCandidateIds: string[];
}

export type StarmapTierSourcePlan = Record<StarmapDataTier, StarmapTierPlanEntry>;

const FALLBACK_ROLE_PRIORITY: Record<StarmapSourceFallbackRole, number> = {
  primary: 0,
  fallback: 1,
  supplemental: 2,
};

export function sortStarmapTierCandidates<T extends StarmapTierCandidate>(candidates: T[]): T[] {
  return [...candidates].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    const fallbackDelta =
      FALLBACK_ROLE_PRIORITY[left.fallbackRole] - FALLBACK_ROLE_PRIORITY[right.fallbackRole];
    if (fallbackDelta !== 0) {
      return fallbackDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function createEmptyTierPlanEntry(tier: StarmapDataTier): StarmapTierPlanEntry {
  return {
    tier,
    state: 'blocked',
    candidates: [],
    activeCandidateIds: [],
    blockedCandidateIds: [],
  };
}

export function createStarmapTierSourcePlan(
  candidates: StarmapTierCandidate[]
): StarmapTierSourcePlan {
  const grouped = Object.fromEntries(
    STARMAP_DATA_TIER_ORDER.map((tier) => [tier, createEmptyTierPlanEntry(tier)])
  ) as StarmapTierSourcePlan;

  for (const tier of STARMAP_DATA_TIER_ORDER) {
    const tierCandidates = sortStarmapTierCandidates(
      candidates.filter((candidate) => candidate.tier === tier && candidate.enabled)
    );
    const activeCandidates = tierCandidates.filter((candidate) => candidate.available !== false);
    const blockedCandidates = tierCandidates.filter((candidate) => candidate.available === false);

    grouped[tier] = {
      tier,
      state:
        activeCandidates.length > 0
          ? blockedCandidates.length > 0
            ? 'degraded'
            : 'ready'
          : blockedCandidates.length > 0
            ? 'blocked'
            : 'blocked',
      candidates: tierCandidates,
      activeCandidateIds: activeCandidates.map((candidate) => candidate.id),
      blockedCandidateIds: blockedCandidates.map((candidate) => candidate.id),
    };
  }

  return grouped;
}

export function deriveStarmapTierReadiness(
  resources: StarmapTierResourceSnapshot[]
): Record<StarmapDataTier, StarmapTierReadiness> {
  return Object.fromEntries(
    STARMAP_DATA_TIER_ORDER.map((tier) => {
      const tierResources = resources.filter((resource) => resource.tier === tier);
      if (tierResources.length === 0) {
        return [tier, 'blocked'];
      }

      const allReady = tierResources.every((resource) => resource.state === 'ready');
      if (allReady) {
        return [tier, 'ready'];
      }

      const hasReady = tierResources.some((resource) => resource.state === 'ready');
      const hasLoading = tierResources.some(
        (resource) => resource.state === 'loading' || resource.state === 'pending'
      );
      const hasFailure = tierResources.some((resource) => resource.state === 'failed');

      if (hasReady || hasLoading) {
        return [tier, 'degraded'];
      }

      if (hasFailure) {
        return [tier, 'blocked'];
      }

      return [tier, 'blocked'];
    })
  ) as Record<StarmapDataTier, StarmapTierReadiness>;
}
