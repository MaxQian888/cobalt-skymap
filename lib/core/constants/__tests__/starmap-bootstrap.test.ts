/**
 * Tests for starmap-bootstrap.ts
 * Bootstrap resource inventory, critical resource selection, and timing constants
 */

import {
  STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS,
  STARMAP_BOOTSTRAP_RESOURCES,
  STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS,
} from '../starmap-bootstrap';

describe('STARMAP_BOOTSTRAP_RESOURCES', () => {
  it('defines the expected startup resources in fallback order', () => {
    expect(STARMAP_BOOTSTRAP_RESOURCES).toHaveLength(4);
    expect(STARMAP_BOOTSTRAP_RESOURCES.map((resource) => resource.id)).toEqual([
      'engine_core',
      'settings_snapshot',
      'cache_index',
      'online_metadata',
    ]);
    expect(STARMAP_BOOTSTRAP_RESOURCES.map((resource) => resource.fallbackOrder)).toEqual([0, 1, 2, 3]);
  });

  it('keeps resource ids unique and metadata populated', () => {
    const ids = STARMAP_BOOTSTRAP_RESOURCES.map((resource) => resource.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const resource of STARMAP_BOOTSTRAP_RESOURCES) {
      expect(typeof resource.label).toBe('string');
      expect(resource.label.length).toBeGreaterThan(0);
      expect(typeof resource.description).toBe('string');
      expect(resource.description.length).toBeGreaterThan(0);
    }
  });

  it('separates critical core resources from optional enrichment resources', () => {
    const criticalResources = STARMAP_BOOTSTRAP_RESOURCES.filter((resource) => resource.critical);
    const optionalResources = STARMAP_BOOTSTRAP_RESOURCES.filter((resource) => !resource.critical);

    expect(criticalResources).toHaveLength(3);
    expect(criticalResources.every((resource) => resource.tier === 'core')).toBe(true);
    expect(optionalResources).toHaveLength(1);
    expect(optionalResources[0]).toMatchObject({
      id: 'online_metadata',
      tier: 'enrichment',
      critical: false,
      fallbackOrder: 3,
    });
  });
});

describe('STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS', () => {
  it('matches the critical subset from the resource inventory', () => {
    const expectedCriticalIds = STARMAP_BOOTSTRAP_RESOURCES
      .filter((resource) => resource.critical)
      .map((resource) => resource.id);

    expect(STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS).toEqual(expectedCriticalIds);
    expect(STARMAP_BOOTSTRAP_CRITICAL_RESOURCE_IDS).not.toContain('online_metadata');
  });
});

describe('STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS', () => {
  it('uses a 10 second settings hydration timeout', () => {
    expect(STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS).toBe(10_000);
    expect(STARMAP_BOOTSTRAP_SETTINGS_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
