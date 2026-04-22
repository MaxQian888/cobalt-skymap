import type { SelectedObjectData } from '@/lib/core/types';
import {
  buildContinuityTargetSummary,
  buildContinuityActions,
  useMapInteractionStore,
} from '../map-interaction-store';

const selectedObject: SelectedObjectData = {
  names: ['M31', 'Andromeda Galaxy'],
  ra: '00h 42m 44s',
  dec: '+41° 16\' 09"',
  raDeg: 10.6847083,
  decDeg: 41.26875,
  type: 'Galaxy',
  magnitude: 3.4,
  size: '3° x 1°',
  constellation: 'Andromeda',
  coordinateSource: 'engine',
  coordinateTimestamp: '2026-04-05T00:00:00.000Z',
};

describe('map interaction continuity store', () => {
  beforeEach(() => {
    useMapInteractionStore.getState().reset();
  });

  it('tracks a draft observing-site preview with source-aware actions', () => {
    useMapInteractionStore.getState().setSiteContext({
      kind: 'draft',
      sourceSurface: 'map-picker',
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
      summaryStatus: 'partial',
      displayName: 'Shanghai Preview',
      issues: ['timezone unresolved'],
      actions: ['retry-metadata', 'open-provider-settings', 'save-location-draft'],
    });

    const state = useMapInteractionStore.getState();

    expect(state.siteContext).toEqual({
      kind: 'draft',
      sourceSurface: 'map-picker',
      coordinates: { latitude: 31.2304, longitude: 121.4737 },
      summaryStatus: 'partial',
      displayName: 'Shanghai Preview',
      issues: ['timezone unresolved'],
      actions: ['retry-metadata', 'open-provider-settings', 'save-location-draft'],
    });
    expect(state.lastUpdatedAt).toBeGreaterThan(0);
  });

  it('preserves the active site when a target summary is added', () => {
    useMapInteractionStore.getState().setSiteContext({
      kind: 'committed',
      sourceSurface: 'location-manager',
      coordinates: { latitude: 35.6762, longitude: 139.6503 },
      summaryStatus: 'ready',
      displayName: 'Tokyo',
      actions: ['open-target-details'],
    });

    useMapInteractionStore.getState().setTargetContext(
      buildContinuityTargetSummary(selectedObject, {
        siteName: 'Tokyo',
        siteCoordinates: { latitude: 35.6762, longitude: 139.6503 },
      })
    );

    const state = useMapInteractionStore.getState();

    expect(state.siteContext?.displayName).toBe('Tokyo');
    expect(state.targetContext).toMatchObject({
      primaryName: 'M31',
      type: 'Galaxy',
      sourceQuality: 'normal',
      siteName: 'Tokyo',
    });
  });

  it('clears only the requested slice without destroying the other continuity data', () => {
    useMapInteractionStore.getState().setSiteContext({
      kind: 'draft',
      sourceSurface: 'location-manager',
      coordinates: { latitude: 40.7128, longitude: -74.006 },
      summaryStatus: 'loading',
      actions: ['discard-location-draft'],
    });
    useMapInteractionStore.getState().setTargetContext(
      buildContinuityTargetSummary(selectedObject, {
        sourceQuality: 'degraded',
      })
    );

    useMapInteractionStore.getState().clearSiteContext();

    const state = useMapInteractionStore.getState();
    expect(state.siteContext).toBeNull();
    expect(state.targetContext?.primaryName).toBe('M31');

    useMapInteractionStore.getState().clearTargetContext();
    expect(useMapInteractionStore.getState().targetContext).toBeNull();
  });

  it('resets the entire continuity session state', () => {
    useMapInteractionStore.getState().setSiteContext({
      kind: 'committed',
      sourceSurface: 'starmap',
      coordinates: { latitude: 51.5074, longitude: -0.1278 },
      summaryStatus: 'ready',
      actions: ['open-target-details'],
    });
    useMapInteractionStore.getState().setTargetContext(buildContinuityTargetSummary(selectedObject));

    useMapInteractionStore.getState().reset();

    expect(useMapInteractionStore.getState()).toMatchObject({
      siteContext: null,
      targetContext: null,
      lastUpdatedAt: 0,
    });
  });
});

describe('map interaction continuity helpers', () => {
  it('builds a target summary from a selected object and site context', () => {
    expect(
      buildContinuityTargetSummary(selectedObject, {
        siteName: 'Shanghai Preview',
        siteCoordinates: { latitude: 31.2304, longitude: 121.4737 },
        sourceQuality: 'degraded',
      })
    ).toEqual({
      objectName: 'M31',
      primaryName: 'M31',
      aliases: ['Andromeda Galaxy'],
      ra: '00h 42m 44s',
      dec: '+41° 16\' 09"',
      raDeg: 10.6847083,
      decDeg: 41.26875,
      type: 'Galaxy',
      magnitude: 3.4,
      size: '3° x 1°',
      constellation: 'Andromeda',
      coordinateSource: 'engine',
      coordinateTimestamp: '2026-04-05T00:00:00.000Z',
      sourceQuality: 'degraded',
      siteName: 'Shanghai Preview',
      siteCoordinates: { latitude: 31.2304, longitude: 121.4737 },
    });
  });

  it('derives continuity-safe actions for draft site preview and AR recovery', () => {
    expect(
      buildContinuityActions({
        sourceSurface: 'location-manager',
        hasDraftSite: true,
        hasRecoverableMetadata: true,
        hasTarget: false,
        arStatus: 'idle',
      })
    ).toEqual(['retry-metadata', 'open-provider-settings', 'save-location-draft', 'discard-location-draft']);

    expect(
      buildContinuityActions({
        sourceSurface: 'ar',
        hasDraftSite: false,
        hasRecoverableMetadata: false,
        hasTarget: true,
        arStatus: 'blocked',
      })
    ).toEqual(['retry-ar', 'open-ar-settings', 'return-to-target']);
  });
});
