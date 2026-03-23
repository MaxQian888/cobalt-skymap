import {
  STARMAP_DATA_TIER_ORDER,
  createStarmapTierSourcePlan,
  deriveStarmapTierReadiness,
  sortStarmapTierCandidates,
  type StarmapTierCandidate,
} from '../starmap-data-tier';

describe('starmap-data-tier', () => {
  it('keeps the canonical tier order stable', () => {
    expect(STARMAP_DATA_TIER_ORDER).toEqual([
      'core',
      'catalog',
      'survey',
      'enrichment',
    ]);
  });

  it('sorts tier candidates by priority, fallback role, then id', () => {
    const input: StarmapTierCandidate[] = [
      {
        id: 'secondary-survey',
        tier: 'survey',
        enabled: true,
        priority: 2,
        fallbackRole: 'fallback',
        available: true,
      },
      {
        id: 'primary-survey',
        tier: 'survey',
        enabled: true,
        priority: 1,
        fallbackRole: 'primary',
        available: true,
      },
      {
        id: 'supplemental-survey',
        tier: 'survey',
        enabled: true,
        priority: 1,
        fallbackRole: 'supplemental',
        available: true,
      },
    ];

    expect(sortStarmapTierCandidates(input).map((candidate) => candidate.id)).toEqual([
      'primary-survey',
      'supplemental-survey',
      'secondary-survey',
    ]);
  });

  it('creates a deterministic source plan and degrades tiers with unavailable candidates', () => {
    const plan = createStarmapTierSourcePlan([
      {
        id: 'local-catalog',
        tier: 'catalog',
        enabled: true,
        priority: 0,
        fallbackRole: 'primary',
        available: true,
      },
      {
        id: 'dss-primary',
        tier: 'survey',
        enabled: true,
        priority: 0,
        fallbackRole: 'primary',
        available: false,
      },
      {
        id: 'dss-fallback',
        tier: 'survey',
        enabled: true,
        priority: 1,
        fallbackRole: 'fallback',
        available: true,
      },
      {
        id: 'wikipedia-enrichment',
        tier: 'enrichment',
        enabled: true,
        priority: 0,
        fallbackRole: 'primary',
        available: false,
      },
    ]);

    expect(plan.catalog.state).toBe('ready');
    expect(plan.catalog.activeCandidateIds).toEqual(['local-catalog']);
    expect(plan.survey.state).toBe('degraded');
    expect(plan.survey.activeCandidateIds).toEqual(['dss-fallback']);
    expect(plan.survey.blockedCandidateIds).toEqual(['dss-primary']);
    expect(plan.enrichment.state).toBe('blocked');
    expect(plan.enrichment.activeCandidateIds).toEqual([]);
  });

  it('derives tier readiness from resource snapshots', () => {
    const readiness = deriveStarmapTierReadiness([
      { id: 'engine_core', tier: 'core', critical: true, state: 'ready' },
      { id: 'settings_snapshot', tier: 'core', critical: true, state: 'ready' },
      { id: 'cache_index', tier: 'core', critical: true, state: 'ready' },
      { id: 'catalog_index', tier: 'catalog', critical: false, state: 'loading' },
      { id: 'survey_index', tier: 'survey', critical: false, state: 'failed' },
      { id: 'online_metadata', tier: 'enrichment', critical: false, state: 'failed' },
    ]);

    expect(readiness.core).toBe('ready');
    expect(readiness.catalog).toBe('degraded');
    expect(readiness.survey).toBe('blocked');
    expect(readiness.enrichment).toBe('blocked');
  });
});
