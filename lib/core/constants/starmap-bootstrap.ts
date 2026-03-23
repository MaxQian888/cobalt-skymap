import type { StarmapDataTier } from '@/lib/core/starmap-data-tier';

export type StarmapBootstrapOutcome =
  | 'idle'
  | 'bootstrapping'
  | 'ready'
  | 'degraded'
  | 'failed';

export type StarmapBootstrapResourceId =
  | 'engine_core'
  | 'settings_snapshot'
  | 'cache_index'
  | 'online_metadata';

export interface StarmapBootstrapResourceDefinition {
  id: StarmapBootstrapResourceId;
  label: string;
  description: string;
  tier: StarmapDataTier;
  critical: boolean;
  fallbackOrder: number;
}

export const STARMAP_BOOTSTRAP_RESOURCES: readonly StarmapBootstrapResourceDefinition[] = [
  {
    id: 'engine_core',
    label: 'Engine Core',
    description: 'Stellarium engine script and WASM runtime initialization.',
    tier: 'core',
    critical: true,
    fallbackOrder: 0,
  },
  {
    id: 'settings_snapshot',
    label: 'Settings Snapshot',
    description: 'Persisted starmap settings hydration before first interactive render.',
    tier: 'core',
    critical: true,
    fallbackOrder: 1,
  },
  {
    id: 'cache_index',
    label: 'Cache Index',
    description: 'Unified cache migration/index readiness for startup fetch interception.',
    tier: 'core',
    critical: true,
    fallbackOrder: 2,
  },
  {
    id: 'online_metadata',
    label: 'Online Metadata',
    description: 'Optional online resources that can be populated after first render.',
    tier: 'enrichment',
    critical: false,
    fallbackOrder: 3,
  },
] as const;

export const STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS = STARMAP_BOOTSTRAP_RESOURCES
  .filter((resource) => resource.critical)
  .map((resource) => resource.id);

export const STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS = 10_000;
