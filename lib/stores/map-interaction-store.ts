import { create } from 'zustand';
import type { ARSessionStatus } from '@/lib/core/ar-session';
import type { SelectedObjectData } from '@/lib/core/types';

export type MapInteractionSourceSurface = 'location-manager' | 'map-picker' | 'starmap' | 'ar';
export type MapInteractionSummaryStatus = 'idle' | 'loading' | 'partial' | 'error' | 'ready' | 'stale';
export type MapInteractionAction =
  | 'retry-metadata'
  | 'open-provider-settings'
  | 'save-location-draft'
  | 'discard-location-draft'
  | 'open-target-details'
  | 'retry-ar'
  | 'open-ar-settings'
  | 'return-to-target';

export interface MapInteractionCoordinates {
  latitude: number;
  longitude: number;
}

export interface MapInteractionSiteContext {
  kind: 'draft' | 'committed';
  sourceSurface: MapInteractionSourceSurface;
  coordinates: MapInteractionCoordinates;
  summaryStatus: MapInteractionSummaryStatus;
  displayName?: string;
  issues?: string[];
  actions: MapInteractionAction[];
}

export interface MapInteractionTargetSummary {
  objectName: string;
  primaryName: string;
  aliases: string[];
  ra: string;
  dec: string;
  raDeg: number;
  decDeg: number;
  type?: string;
  magnitude?: number;
  size?: string;
  constellation?: string;
  coordinateSource?: SelectedObjectData['coordinateSource'];
  coordinateTimestamp?: string;
  sourceQuality: 'normal' | 'degraded';
  siteName?: string;
  siteCoordinates?: MapInteractionCoordinates;
}

interface MapInteractionStoreState {
  siteContext: MapInteractionSiteContext | null;
  targetContext: MapInteractionTargetSummary | null;
  lastUpdatedAt: number;
  setSiteContext: (siteContext: MapInteractionSiteContext) => void;
  setTargetContext: (targetContext: MapInteractionTargetSummary) => void;
  clearSiteContext: () => void;
  clearTargetContext: () => void;
  reset: () => void;
}

const initialState = {
  siteContext: null,
  targetContext: null,
  lastUpdatedAt: 0,
} satisfies Pick<MapInteractionStoreState, 'siteContext' | 'targetContext' | 'lastUpdatedAt'>;

export interface BuildContinuityTargetSummaryOptions {
  siteName?: string;
  siteCoordinates?: MapInteractionCoordinates;
  sourceQuality?: MapInteractionTargetSummary['sourceQuality'];
}

export function buildContinuityTargetSummary(
  selectedObject: SelectedObjectData,
  options: BuildContinuityTargetSummaryOptions = {}
): MapInteractionTargetSummary {
  const { siteName, siteCoordinates, sourceQuality = 'normal' } = options;

  return {
    objectName: selectedObject.names[0] ?? 'Unknown object',
    primaryName: selectedObject.names[0] ?? 'Unknown object',
    aliases: selectedObject.names.slice(1),
    ra: selectedObject.ra,
    dec: selectedObject.dec,
    raDeg: selectedObject.raDeg,
    decDeg: selectedObject.decDeg,
    type: selectedObject.type,
    magnitude: selectedObject.magnitude,
    size: selectedObject.size,
    constellation: selectedObject.constellation,
    coordinateSource: selectedObject.coordinateSource,
    coordinateTimestamp: selectedObject.coordinateTimestamp,
    sourceQuality,
    siteName,
    siteCoordinates,
  };
}

export interface BuildContinuityActionsInput {
  sourceSurface: MapInteractionSourceSurface;
  hasDraftSite: boolean;
  hasRecoverableMetadata: boolean;
  hasTarget: boolean;
  arStatus: ARSessionStatus;
}

export function buildContinuityActions(input: BuildContinuityActionsInput): MapInteractionAction[] {
  if (input.sourceSurface === 'ar' && input.hasTarget && input.arStatus !== 'ready' && input.arStatus !== 'idle') {
    return ['retry-ar', 'open-ar-settings', 'return-to-target'];
  }

  if (input.hasDraftSite) {
    const actions: MapInteractionAction[] = [];
    if (input.hasRecoverableMetadata) {
      actions.push('retry-metadata', 'open-provider-settings');
    }
    actions.push('save-location-draft', 'discard-location-draft');
    return actions;
  }

  if (input.hasTarget) {
    return ['open-target-details'];
  }

  return [];
}

export const useMapInteractionStore = create<MapInteractionStoreState>((set) => ({
  ...initialState,
  setSiteContext: (siteContext) => set(() => ({
    siteContext,
    lastUpdatedAt: Date.now(),
  })),
  setTargetContext: (targetContext) => set(() => ({
    targetContext,
    lastUpdatedAt: Date.now(),
  })),
  clearSiteContext: () => set((state) => ({
    siteContext: null,
    targetContext: state.targetContext,
    lastUpdatedAt: Date.now(),
  })),
  clearTargetContext: () => set((state) => ({
    siteContext: state.siteContext,
    targetContext: null,
    lastUpdatedAt: Date.now(),
  })),
  reset: () => set(() => ({ ...initialState })),
}));
