import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { isTauri } from '@/lib/storage/platform';
import {
  targetListApi,
  type ExposurePlan as TauriExposurePlan,
  type MosaicSettings as TauriMosaicSettings,
  type MosaicPlan as TauriMosaicPlan,
} from '@/lib/tauri/target-list-api';
import { createLogger } from '@/lib/logger';
import type { RecommendationProfile } from '@/lib/core/types';
import {
  validateMosaicSettings,
  type MosaicSettings,
  type MosaicValidationIssue,
  type MosaicValidationIssueCode,
  type ResolvedMosaicPlan,
} from '@/lib/astronomy/fov-calculations';
import type {
  CreateTargetListInput,
  MergeTargetListsInput,
  PlannerSelectionState,
  TargetListRecord,
  TargetSortBy,
  TargetSortOrder,
} from '@/types/starmap/target-management';

const logger = createLogger('target-list-store');

export interface ObservableWindow {
  start: Date;
  end: Date;
  maxAltitude: number;
  transitTime: Date;
  isCircumpolar: boolean;
}

export interface ExposurePlanAdvanced {
  sqm?: number;
  filterBandwidthNm?: number;
  readNoiseLimitPercent?: number;
  gainStrategy?: 'unity' | 'max_dynamic_range' | 'manual';
  recommendedGain?: number;
  recommendedExposureSec?: number;
  skyFluxPerPixel?: number;
  targetSignalPerPixelPerSec?: number;
  dynamicRangeScore?: number;
  dynamicRangeStops?: number;
  readNoiseUsed?: number;
  darkCurrentUsed?: number;
  noiseFractions?: {
    read?: number;
    sky?: number;
    dark?: number;
  };
  stackEstimate?: {
    recommendedFrameCount?: number;
    estimatedTotalMinutes?: number;
    framesForTargetSNR?: number;
    framesForTimeNoise?: number;
    targetSNR?: number;
    targetTimeNoiseRatio?: number;
  };
}

export interface TargetExposurePlan {
  singleExposure: number;
  totalExposure: number;
  subFrames: number;
  filter?: string;
  advanced?: ExposurePlanAdvanced;
}

export interface TargetItem {
  id: string;
  name: string;
  ra: number;
  dec: number;
  raString: string;
  decString: string;
  sensorWidth?: number;
  sensorHeight?: number;
  focalLength?: number;
  rotationAngle?: number;
  mosaic?: MosaicSettings;
  mosaicPlan?: ResolvedMosaicPlan;
  exposurePlan?: TargetExposurePlan;
  notes?: string;
  addedAt: number;
  priority: 'low' | 'medium' | 'high';
  status: 'planned' | 'in_progress' | 'completed';
  tags: string[];
  observableWindow?: ObservableWindow;
  isFavorite: boolean;
  isArchived: boolean;
}

export interface TargetEntry extends TargetItem {
  listId: string;
}

export type TargetInput = Omit<
  TargetItem,
  'id' | 'addedAt' | 'status' | 'tags' | 'isFavorite' | 'isArchived'
> & {
  tags?: string[];
};

export interface BatchTargetInput {
  name: string;
  ra: number;
  dec: number;
  raString: string;
  decString: string;
}

interface TargetListState {
  targetLists: TargetListRecord[];
  targetEntries: TargetEntry[];
  activeListId: string;
  activeEntryId: string | null;
  plannerSelection: PlannerSelectionState;
  targets: TargetItem[];
  activeTargetId: string | null;
  selectedIds: Set<string>;
  availableTags: string[];
  filterTags: string[];
  showArchived: boolean;
  groupBy: 'none' | 'priority' | 'status' | 'tag';
  searchQuery: string;
  filterStatus: 'all' | TargetItem['status'];
  filterPriority: 'all' | TargetItem['priority'];
  sortBy: TargetSortBy;
  sortOrder: TargetSortOrder;
  scoreProfile: RecommendationProfile;
  scoreVersion: 'v1' | 'v2';
  scoreBreakdownVisibility: 'collapsed' | 'expanded';
  createList: (input: CreateTargetListInput) => string;
  renameList: (listId: string, name: string) => void;
  archiveList: (listId: string) => void;
  deleteList: (listId: string) => void;
  duplicateList: (listId: string) => string | null;
  setActiveList: (listId: string) => void;
  addEntryToList: (listId: string, target: TargetInput) => TargetEntry;
  updateEntry: (id: string, updates: Partial<TargetItem>) => void;
  removeEntry: (id: string) => void;
  getEntriesForList: (listId: string) => TargetEntry[];
  getEntryById: (id: string) => TargetEntry | undefined;
  copyEntriesToList: (ids: string[], destinationListId: string) => string[];
  moveEntriesToList: (ids: string[], destinationListId: string) => void;
  mergeLists: (input: MergeTargetListsInput) => string;
  setPlannerSelection: (selection: PlannerSelectionState) => void;
  getPlannerEntries: () => TargetEntry[];
  getAggregateEntries: (listIds: string[]) => TargetEntry[];
  addTarget: (target: TargetInput) => void;
  removeTarget: (id: string) => void;
  updateTarget: (id: string, updates: Partial<TargetItem>) => void;
  setActiveTarget: (id: string | null) => void;
  reorderTargets: (fromIndex: number, toIndex: number) => void;
  addTargetsBatch: (targets: BatchTargetInput[], defaultSettings?: Partial<TargetInput>) => void;
  removeTargetsBatch: (ids: string[]) => void;
  updateTargetsBatch: (ids: string[], updates: Partial<TargetItem>) => void;
  setStatusBatch: (ids: string[], status: TargetItem['status']) => void;
  setPriorityBatch: (ids: string[], priority: TargetItem['priority']) => void;
  addTagBatch: (ids: string[], tag: string) => void;
  removeTagBatch: (ids: string[], tag: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  selectByStatus: (status: TargetItem['status']) => void;
  selectByPriority: (priority: TargetItem['priority']) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setFilterTags: (tags: string[]) => void;
  setGroupBy: (groupBy: TargetListState['groupBy']) => void;
  setShowArchived: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: TargetListState['filterStatus']) => void;
  setFilterPriority: (priority: TargetListState['filterPriority']) => void;
  setSortBy: (sortBy: TargetListState['sortBy']) => void;
  setSortOrder: (order: TargetListState['sortOrder']) => void;
  setScoreProfile: (profile: RecommendationProfile) => void;
  setScoreVersion: (version: TargetListState['scoreVersion']) => void;
  setScoreBreakdownVisibility: (visibility: TargetListState['scoreBreakdownVisibility']) => void;
  toggleFavorite: (id: string) => void;
  toggleArchive: (id: string) => void;
  archiveCompleted: () => void;
  clearCompleted: () => void;
  clearAll: () => void;
  updateObservableWindow: (id: string, window: ObservableWindow) => void;
  syncWithTauri: () => Promise<void>;
  _tauriInitialized: boolean;
  getFilteredTargets: () => TargetItem[];
  getGroupedTargets: () => Map<string, TargetItem[]>;
  getSelectedTargets: () => TargetItem[];
  checkDuplicate: (name: string, ra: number, dec: number) => TargetItem | undefined;
}

const DEFAULT_AVAILABLE_TAGS = ['galaxy', 'nebula', 'cluster', 'planetary', 'tonight', 'priority'];
const generateId = (prefix = 'target') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const findDuplicate = (targets: TargetItem[], name: string, ra: number, dec: number): TargetItem | undefined =>
  targets.find((target) =>
    target.name.toLowerCase() === name.toLowerCase() ||
    (Math.abs(target.ra - ra) < 0.01 && Math.abs(target.dec - dec) < 0.01)
  );

const createDefaultList = (overrides: Partial<TargetListRecord> = {}): TargetListRecord => {
  const now = Date.now();
  return {
    id: overrides.id ?? generateId('list'),
    name: overrides.name ?? 'My Targets',
    description: overrides.description,
    color: overrides.color ?? '#6366f1',
    defaultSortBy: overrides.defaultSortBy ?? 'manual',
    defaultSortOrder: overrides.defaultSortOrder ?? 'asc',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    isArchived: overrides.isArchived ?? false,
  };
};

const toTargetItem = (entry: TargetEntry): TargetItem => {
  const { listId: _listId, ...target } = entry;
  return target;
};

const toTargetEntry = (listId: string, target: TargetInput, addedAt = Date.now()): TargetEntry => ({
  ...target,
  mosaic: target.mosaic ? validateMosaicSettings(target.mosaic).sanitized : undefined,
  id: generateId(),
  listId,
  addedAt,
  status: 'planned',
  tags: target.tags ?? [],
  isFavorite: false,
  isArchived: false,
});

const cloneEntry = (entry: TargetEntry, listId: string, addedAt = Date.now()): TargetEntry => ({
  ...entry,
  id: generateId(),
  listId,
  addedAt,
});

type DerivedInput = Pick<
  TargetListState,
  'targetLists' | 'targetEntries' | 'activeListId' | 'activeEntryId' | 'selectedIds' | 'availableTags'
>;

const deriveCompatState = (input: DerivedInput) => {
  const targetLists = input.targetLists.length > 0 ? input.targetLists : [createDefaultList()];
  const activeListId = targetLists.some((list) => list.id === input.activeListId) ? input.activeListId : targetLists[0].id;
  const validListIds = new Set(targetLists.map((list) => list.id));
  const targetEntries = input.targetEntries.filter((entry) => validListIds.has(entry.listId));
  const activeEntries = targetEntries.filter((entry) => entry.listId === activeListId);
  const activeEntryIds = new Set(activeEntries.map((entry) => entry.id));
  const activeEntryId = input.activeEntryId && activeEntryIds.has(input.activeEntryId) ? input.activeEntryId : null;
  const selectedIds = new Set(Array.from(input.selectedIds).filter((id) => activeEntryIds.has(id)));
  const availableTags = Array.from(new Set([...input.availableTags, ...targetEntries.flatMap((entry) => entry.tags ?? [])]));

  return {
    targetLists,
    targetEntries,
    activeListId,
    activeEntryId,
    activeTargetId: activeEntryId,
    selectedIds,
    targets: activeEntries.map(toTargetItem),
    availableTags,
  };
};

function toTauriExposurePlan(exposurePlan?: TargetExposurePlan): TauriExposurePlan | undefined {
  if (!exposurePlan) return undefined;

  return {
    single_exposure: exposurePlan.singleExposure,
    total_exposure: exposurePlan.totalExposure,
    sub_frames: exposurePlan.subFrames,
    filter: exposurePlan.filter,
    advanced: exposurePlan.advanced
      ? {
          sqm: exposurePlan.advanced.sqm,
          filter_bandwidth_nm: exposurePlan.advanced.filterBandwidthNm,
          read_noise_limit_percent: exposurePlan.advanced.readNoiseLimitPercent,
          gain_strategy: exposurePlan.advanced.gainStrategy,
          recommended_gain: exposurePlan.advanced.recommendedGain,
          recommended_exposure_sec: exposurePlan.advanced.recommendedExposureSec,
          sky_flux_per_pixel: exposurePlan.advanced.skyFluxPerPixel,
          target_signal_per_pixel_per_sec: exposurePlan.advanced.targetSignalPerPixelPerSec,
          dynamic_range_score: exposurePlan.advanced.dynamicRangeScore,
          dynamic_range_stops: exposurePlan.advanced.dynamicRangeStops,
          read_noise_used: exposurePlan.advanced.readNoiseUsed,
          dark_current_used: exposurePlan.advanced.darkCurrentUsed,
          noise_fractions: exposurePlan.advanced.noiseFractions
            ? {
                read: exposurePlan.advanced.noiseFractions.read,
                sky: exposurePlan.advanced.noiseFractions.sky,
                dark: exposurePlan.advanced.noiseFractions.dark,
              }
            : undefined,
          stack_estimate: exposurePlan.advanced.stackEstimate
            ? {
                recommended_frame_count: exposurePlan.advanced.stackEstimate.recommendedFrameCount,
                estimated_total_minutes: exposurePlan.advanced.stackEstimate.estimatedTotalMinutes,
                frames_for_target_snr: exposurePlan.advanced.stackEstimate.framesForTargetSNR,
                frames_for_time_noise: exposurePlan.advanced.stackEstimate.framesForTimeNoise,
                target_snr: exposurePlan.advanced.stackEstimate.targetSNR,
                target_time_noise_ratio: exposurePlan.advanced.stackEstimate.targetTimeNoiseRatio,
              }
            : undefined,
        }
      : undefined,
  };
}

function toTauriMosaicSettings(mosaic?: MosaicSettings): TauriMosaicSettings | undefined {
  if (!mosaic) return undefined;

  const normalized = validateMosaicSettings(mosaic).sanitized;
  return {
    enabled: normalized.enabled,
    rows: normalized.rows,
    cols: normalized.cols,
    overlap: normalized.overlap,
    overlap_unit: normalized.overlapUnit,
    layout_mode: normalized.layoutMode,
    panel_order: normalized.panelOrder,
  };
}

function fromTauriMosaicSettings(mosaic?: TauriMosaicSettings): MosaicSettings | undefined {
  if (!mosaic) return undefined;

  return validateMosaicSettings({
    enabled: mosaic.enabled,
    rows: mosaic.rows,
    cols: mosaic.cols,
    overlap: mosaic.overlap,
    overlapUnit: mosaic.overlap_unit,
    layoutMode: mosaic.layout_mode,
    panelOrder: mosaic.panel_order,
  }).sanitized;
}

const MOSAIC_VALIDATION_ISSUE_CODES = [
  'rows_clamped',
  'cols_clamped',
  'overlap_clamped',
  'panel_count_high',
  'panel_count_extreme',
  'overlap_high',
  'estimated_time_high',
  'estimated_time_extreme',
] as const satisfies readonly MosaicValidationIssueCode[];

function isMosaicValidationIssueCode(value: string): value is MosaicValidationIssueCode {
  return (MOSAIC_VALIDATION_ISSUE_CODES as readonly string[]).includes(value);
}

function fromTauriMosaicWarnings(
  warnings: TauriMosaicPlan['warnings'] | undefined,
): MosaicValidationIssue[] {
  return (warnings ?? []).flatMap((warning) => (
    isMosaicValidationIssueCode(warning.code)
      ? [{
          code: warning.code,
          severity: warning.severity,
          actual: warning.actual,
          min: warning.min,
          max: warning.max,
        }]
      : []
  ));
}

function toTauriMosaicPlan(plan?: ResolvedMosaicPlan): TauriMosaicPlan | undefined {
  if (!plan) return undefined;

  return {
    layout_mode: plan.layoutMode,
    panel_order: plan.panelOrder,
    total_panels: plan.totalPanels,
    width: plan.width,
    height: plan.height,
    overlap_factor: plan.overlapFactor,
    estimated_panel_minutes: plan.estimatedPanelMinutes,
    estimated_total_minutes: plan.estimatedTotalMinutes,
    panels: plan.panels.map((panel) => ({
      id: panel.id,
      row: panel.row,
      col: panel.col,
      x: panel.x,
      y: panel.y,
      center_offset_x: panel.centerOffsetX,
      center_offset_y: panel.centerOffsetY,
      sequence: panel.sequence,
      is_center: panel.isCenter,
    })),
    warnings: plan.warnings.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      actual: warning.actual,
      min: warning.min,
      max: warning.max,
    })),
  };
}

function fromTauriMosaicPlan(plan?: TauriMosaicPlan): ResolvedMosaicPlan | undefined {
  if (!plan) return undefined;

  return {
    layoutMode: plan.layout_mode,
    panelOrder: plan.panel_order,
    totalPanels: plan.total_panels,
    width: plan.width,
    height: plan.height,
    overlapFactor: plan.overlap_factor,
    estimatedPanelMinutes: plan.estimated_panel_minutes ?? null,
    estimatedTotalMinutes: plan.estimated_total_minutes ?? null,
    panels: plan.panels.map((panel) => ({
      id: panel.id,
      row: panel.row,
      col: panel.col,
      x: panel.x,
      y: panel.y,
      centerOffsetX: panel.center_offset_x,
      centerOffsetY: panel.center_offset_y,
      sequence: panel.sequence,
      isCenter: panel.is_center,
    })),
    warnings: fromTauriMosaicWarnings(plan.warnings),
  };
}

function fromTauriExposurePlan(exposurePlan?: TauriExposurePlan): TargetExposurePlan | undefined {
  if (!exposurePlan) return undefined;

  return {
    singleExposure: exposurePlan.single_exposure,
    totalExposure: exposurePlan.total_exposure,
    subFrames: exposurePlan.sub_frames,
    filter: exposurePlan.filter,
    advanced: exposurePlan.advanced
      ? {
          sqm: exposurePlan.advanced.sqm,
          filterBandwidthNm: exposurePlan.advanced.filter_bandwidth_nm,
          readNoiseLimitPercent: exposurePlan.advanced.read_noise_limit_percent,
          gainStrategy: exposurePlan.advanced.gain_strategy,
          recommendedGain: exposurePlan.advanced.recommended_gain,
          recommendedExposureSec: exposurePlan.advanced.recommended_exposure_sec,
          skyFluxPerPixel: exposurePlan.advanced.sky_flux_per_pixel,
          targetSignalPerPixelPerSec: exposurePlan.advanced.target_signal_per_pixel_per_sec,
          dynamicRangeScore: exposurePlan.advanced.dynamic_range_score,
          dynamicRangeStops: exposurePlan.advanced.dynamic_range_stops,
          readNoiseUsed: exposurePlan.advanced.read_noise_used,
          darkCurrentUsed: exposurePlan.advanced.dark_current_used,
          noiseFractions: exposurePlan.advanced.noise_fractions
            ? {
                read: exposurePlan.advanced.noise_fractions.read,
                sky: exposurePlan.advanced.noise_fractions.sky,
                dark: exposurePlan.advanced.noise_fractions.dark,
              }
            : undefined,
          stackEstimate: exposurePlan.advanced.stack_estimate
            ? {
                recommendedFrameCount: exposurePlan.advanced.stack_estimate.recommended_frame_count,
                estimatedTotalMinutes: exposurePlan.advanced.stack_estimate.estimated_total_minutes,
                framesForTargetSNR: exposurePlan.advanced.stack_estimate.frames_for_target_snr,
                framesForTimeNoise: exposurePlan.advanced.stack_estimate.frames_for_time_noise,
                targetSNR: exposurePlan.advanced.stack_estimate.target_snr,
                targetTimeNoiseRatio: exposurePlan.advanced.stack_estimate.target_time_noise_ratio,
              }
            : undefined,
        }
      : undefined,
  };
}

const mapLegacyTauriTarget = (entry: Record<string, unknown>, listId: string): TargetEntry => ({
  id: String(entry.id),
  listId,
  name: String(entry.name),
  ra: Number(entry.ra),
  dec: Number(entry.dec),
  raString: String(entry.ra_string ?? ''),
  decString: String(entry.dec_string ?? ''),
  sensorWidth: entry.sensor_width as number | undefined,
  sensorHeight: entry.sensor_height as number | undefined,
  focalLength: entry.focal_length as number | undefined,
  rotationAngle: entry.rotation_angle as number | undefined,
  mosaic: fromTauriMosaicSettings(entry.mosaic as TauriMosaicSettings | undefined),
  mosaicPlan: fromTauriMosaicPlan(entry.mosaic_plan as TauriMosaicPlan | undefined),
  exposurePlan: fromTauriExposurePlan(entry.exposure_plan as TauriExposurePlan | undefined),
  notes: entry.notes as string | undefined,
  addedAt: Number(entry.added_at ?? Date.now()),
  priority: entry.priority as TargetEntry['priority'],
  status: entry.status as TargetEntry['status'],
  tags: Array.isArray(entry.tags) ? (entry.tags as string[]) : [],
  observableWindow: entry.observable_window
    ? {
        start: new Date((entry.observable_window as Record<string, unknown>).start as string),
        end: new Date((entry.observable_window as Record<string, unknown>).end as string),
        maxAltitude: Number((entry.observable_window as Record<string, unknown>).max_altitude),
        transitTime: new Date((entry.observable_window as Record<string, unknown>).transit_time as string),
        isCircumpolar: Boolean((entry.observable_window as Record<string, unknown>).is_circumpolar),
      }
    : undefined,
  isFavorite: Boolean(entry.is_favorite),
  isArchived: Boolean(entry.is_archived),
});

export const useTargetListStore = create<TargetListState>()(
  persist(
    (set, get) => {
      const defaultList = createDefaultList();

      return {
        targetLists: [defaultList],
        targetEntries: [],
        activeListId: defaultList.id,
        activeEntryId: null,
        plannerSelection: {
          mode: 'active',
          selectedListIds: [],
        },
        targets: [],
        activeTargetId: null,
        selectedIds: new Set<string>(),
        availableTags: [...DEFAULT_AVAILABLE_TAGS],
        filterTags: [],
        showArchived: false,
        groupBy: 'none',
        searchQuery: '',
        filterStatus: 'all',
        filterPriority: 'all',
        sortBy: 'manual',
        sortOrder: 'asc',
        scoreProfile: 'imaging',
        scoreVersion: 'v2',
        scoreBreakdownVisibility: 'collapsed',

        createList: (input) => {
          const listId = generateId('list');
          set((state) => ({
            ...deriveCompatState({
              targetLists: [
                ...state.targetLists,
                createDefaultList({
                  id: listId,
                  name: input.name,
                  description: input.description,
                  color: input.color,
                  defaultSortBy: input.defaultSortBy,
                  defaultSortOrder: input.defaultSortOrder,
                }),
              ],
              targetEntries: state.targetEntries,
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));
          return listId;
        },

        renameList: (listId, name) => set((state) => ({
          targetLists: state.targetLists.map((list) =>
            list.id === listId ? { ...list, name, updatedAt: Date.now() } : list
          ),
        })),

        archiveList: (listId) => set((state) => ({
          targetLists: state.targetLists.map((list) =>
            list.id === listId ? { ...list, isArchived: !list.isArchived, updatedAt: Date.now() } : list
          ),
        })),

        deleteList: (listId) => set((state) => ({
          ...deriveCompatState({
            targetLists: state.targetLists.filter((list) => list.id !== listId),
            targetEntries: state.targetEntries.filter((entry) => entry.listId !== listId),
            activeListId: state.activeListId === listId ? '' : state.activeListId,
            activeEntryId: state.activeEntryId,
            selectedIds: state.selectedIds,
            availableTags: state.availableTags,
          }),
        })),

        duplicateList: (listId) => {
          const sourceList = get().targetLists.find((list) => list.id === listId);
          if (!sourceList) return null;

          const duplicateListId = generateId('list');
          const baseTime = Date.now();
          const duplicatedEntries = get()
            .targetEntries
            .filter((entry) => entry.listId === listId)
            .map((entry, index) => cloneEntry(entry, duplicateListId, baseTime + index));

          set((state) => ({
            ...deriveCompatState({
              targetLists: [
                ...state.targetLists,
                {
                  ...sourceList,
                  id: duplicateListId,
                  name: `${sourceList.name} Copy`,
                  createdAt: baseTime,
                  updatedAt: baseTime,
                  isArchived: false,
                },
              ],
              targetEntries: [...state.targetEntries, ...duplicatedEntries],
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          return duplicateListId;
        },

        setActiveList: (listId) => set((state) => ({
          ...deriveCompatState({
            targetLists: state.targetLists,
            targetEntries: state.targetEntries,
            activeListId: listId,
            activeEntryId: state.activeEntryId,
            selectedIds: new Set<string>(),
            availableTags: state.availableTags,
          }),
        })),

        addEntryToList: (listId, target) => {
          const entry = toTargetEntry(listId, target);

          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: [...state.targetEntries, entry],
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.addTarget({
              name: entry.name,
              ra: entry.ra,
              dec: entry.dec,
              ra_string: entry.raString || '',
              dec_string: entry.decString || '',
              priority: entry.priority,
              notes: entry.notes,
              tags: entry.tags ?? [],
              sensor_width: entry.sensorWidth,
              sensor_height: entry.sensorHeight,
              focal_length: entry.focalLength,
              rotation_angle: entry.rotationAngle,
              mosaic: toTauriMosaicSettings(entry.mosaic),
              mosaic_plan: toTauriMosaicPlan(entry.mosaicPlan),
              exposure_plan: toTauriExposurePlan(entry.exposurePlan),
            }).catch((error) => logger.error('Failed to add target entry to Tauri', error));
          }

          return entry;
        },

        updateEntry: (id, updates) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries.map((entry) =>
                entry.id === id ? { ...entry, ...updates } : entry
              ),
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            const tauriUpdates: Record<string, unknown> = {};
            if (updates.name !== undefined) tauriUpdates.name = updates.name;
            if (updates.ra !== undefined) tauriUpdates.ra = updates.ra;
            if (updates.dec !== undefined) tauriUpdates.dec = updates.dec;
            if (updates.raString !== undefined) tauriUpdates.ra_string = updates.raString;
            if (updates.decString !== undefined) tauriUpdates.dec_string = updates.decString;
            if (updates.priority !== undefined) tauriUpdates.priority = updates.priority;
            if (updates.status !== undefined) tauriUpdates.status = updates.status;
            if (updates.notes !== undefined) tauriUpdates.notes = updates.notes;
            if (updates.tags !== undefined) tauriUpdates.tags = updates.tags;
            if (updates.isFavorite !== undefined) tauriUpdates.is_favorite = updates.isFavorite;
            if (updates.isArchived !== undefined) tauriUpdates.is_archived = updates.isArchived;
            if (updates.mosaic !== undefined) tauriUpdates.mosaic = toTauriMosaicSettings(updates.mosaic);
            if (updates.mosaicPlan !== undefined) tauriUpdates.mosaic_plan = toTauriMosaicPlan(updates.mosaicPlan);
            if (updates.exposurePlan !== undefined) {
              tauriUpdates.exposure_plan = toTauriExposurePlan(updates.exposurePlan);
            }
            targetListApi.updateTarget(id, tauriUpdates as never)
              .catch((error) => logger.error('Failed to update target entry in Tauri', error));
          }
        },

        removeEntry: (id) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries.filter((entry) => entry.id !== id),
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId === id ? null : state.activeEntryId,
              selectedIds: new Set(Array.from(state.selectedIds).filter((selectedId) => selectedId !== id)),
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.removeTarget(id)
              .catch((error) => logger.error('Failed to remove target entry from Tauri', error));
          }
        },

        getEntriesForList: (listId) => get().targetEntries.filter((entry) => entry.listId === listId),
        getEntryById: (id) => get().targetEntries.find((entry) => entry.id === id),

        copyEntriesToList: (ids, destinationListId) => {
          const sourceEntries = get().targetEntries.filter((entry) => ids.includes(entry.id));
          const baseTime = Date.now();
          const copies = sourceEntries.map((entry, index) => cloneEntry(entry, destinationListId, baseTime + index));

          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: [...state.targetEntries, ...copies],
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          return copies.map((entry) => entry.id);
        },

        moveEntriesToList: (ids, destinationListId) => set((state) => ({
          ...deriveCompatState({
            targetLists: state.targetLists,
            targetEntries: state.targetEntries.map((entry) =>
              ids.includes(entry.id) ? { ...entry, listId: destinationListId } : entry
            ),
            activeListId: state.activeListId,
            activeEntryId: state.activeEntryId,
            selectedIds: state.selectedIds,
            availableTags: state.availableTags,
          }),
        })),

        mergeLists: ({ sourceListIds, destinationListId, duplicatePolicy = 'keep_all' }) => {
          const destinationEntries = get().targetEntries.filter((entry) => entry.listId === destinationListId);
          const mergedEntries: TargetEntry[] = [];

          for (const entry of get().targetEntries.filter((item) => sourceListIds.includes(item.listId))) {
            const duplicate = findDuplicate(
              [...destinationEntries, ...mergedEntries].map(toTargetItem),
              entry.name,
              entry.ra,
              entry.dec
            );
            if (duplicate && duplicatePolicy !== 'keep_all') continue;
            mergedEntries.push(cloneEntry(entry, destinationListId, Date.now() + mergedEntries.length));
          }

          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: [...state.targetEntries, ...mergedEntries],
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          return destinationListId;
        },

        setPlannerSelection: (plannerSelection) => set({ plannerSelection }),

        getPlannerEntries: () => {
          const state = get();
          let listIds: string[];
          switch (state.plannerSelection.mode) {
            case 'selected':
              listIds = state.plannerSelection.selectedListIds;
              break;
            case 'all_open':
              listIds = state.targetLists.filter((list) => !list.isArchived).map((list) => list.id);
              break;
            case 'active':
            default:
              listIds = [state.activeListId];
              break;
          }
          return state.targetEntries.filter((entry) => listIds.includes(entry.listId) && !entry.isArchived);
        },

        getAggregateEntries: (listIds) => get().targetEntries.filter((entry) => listIds.includes(entry.listId)),

        addTarget: (target) => {
          get().addEntryToList(get().activeListId, target);
        },

        removeTarget: (id) => {
          get().removeEntry(id);
        },

        updateTarget: (id, updates) => {
          get().updateEntry(id, updates);
        },

        setActiveTarget: (id) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries,
              activeListId: state.activeListId,
              activeEntryId: id,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.setActiveTarget(id)
              .catch((error) => logger.error('Failed to set active target in Tauri', error));
          }
        },

        reorderTargets: (fromIndex, toIndex) => set((state) => {
          const activeEntries = state.targetEntries.filter((entry) => entry.listId === state.activeListId);
          if (fromIndex < 0 || toIndex < 0 || fromIndex >= activeEntries.length || toIndex >= activeEntries.length) {
            return {};
          }

          const reorderedActiveEntries = [...activeEntries];
          const [removed] = reorderedActiveEntries.splice(fromIndex, 1);
          reorderedActiveEntries.splice(toIndex, 0, removed);

          let activeCursor = 0;
          const targetEntries = state.targetEntries.map((entry) => (
            entry.listId === state.activeListId ? reorderedActiveEntries[activeCursor++] : entry
          ));

          return {
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries,
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          };
        }),

        addTargetsBatch: (targets, defaultSettings = {}) => {
          const baseTime = Date.now();
          const targetEntries = targets.map((target, index) =>
            toTargetEntry(get().activeListId, {
              ...defaultSettings,
              ...target,
              priority: defaultSettings.priority ?? 'medium',
            } as TargetInput, baseTime + index)
          );

          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: [...state.targetEntries, ...targetEntries],
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.addTargetsBatch(
              targets.map((target) => ({
                name: target.name,
                ra: target.ra,
                dec: target.dec,
                ra_string: target.raString || '',
                dec_string: target.decString || '',
              })),
              defaultSettings.priority ?? 'medium',
              defaultSettings.tags
            ).catch((error) => logger.error('Failed to add batch targets to Tauri', error));
          }
        },

        removeTargetsBatch: (ids) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries.filter((entry) => !ids.includes(entry.id)),
              activeListId: state.activeListId,
              activeEntryId: ids.includes(state.activeEntryId ?? '') ? null : state.activeEntryId,
              selectedIds: new Set(Array.from(state.selectedIds).filter((id) => !ids.includes(id))),
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.removeTargetsBatch(ids)
              .catch((error) => logger.error('Failed to remove batch targets from Tauri', error));
          }
        },

        updateTargetsBatch: (ids, updates) => set((state) => ({
          ...deriveCompatState({
            targetLists: state.targetLists,
            targetEntries: state.targetEntries.map((entry) =>
              ids.includes(entry.id) ? { ...entry, ...updates } : entry
            ),
            activeListId: state.activeListId,
            activeEntryId: state.activeEntryId,
            selectedIds: state.selectedIds,
            availableTags: state.availableTags,
          }),
        })),

        setStatusBatch: (ids, status) => {
          get().updateTargetsBatch(ids, { status });
          if (isTauri()) {
            targetListApi.setStatusBatch(ids, status)
              .catch((error) => logger.error('Failed to batch update target status', error));
          }
        },

        setPriorityBatch: (ids, priority) => {
          get().updateTargetsBatch(ids, { priority });
          if (isTauri()) {
            targetListApi.setPriorityBatch(ids, priority)
              .catch((error) => logger.error('Failed to batch update target priority', error));
          }
        },

        addTagBatch: (ids, tag) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries.map((entry) =>
                ids.includes(entry.id)
                  ? { ...entry, tags: entry.tags.includes(tag) ? entry.tags : [...entry.tags, tag] }
                  : entry
              ),
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: [...state.availableTags, tag],
            }),
          }));

          if (isTauri()) {
            targetListApi.addTagToTargets(ids, tag)
              .catch((error) => logger.error('Failed to batch add tag to targets', error));
          }
        },

        removeTagBatch: (ids, tag) => {
          set((state) => ({
            ...deriveCompatState({
              targetLists: state.targetLists,
              targetEntries: state.targetEntries.map((entry) =>
                ids.includes(entry.id)
                  ? { ...entry, tags: entry.tags.filter((item) => item !== tag) }
                  : entry
              ),
              activeListId: state.activeListId,
              activeEntryId: state.activeEntryId,
              selectedIds: state.selectedIds,
              availableTags: state.availableTags,
            }),
          }));

          if (isTauri()) {
            targetListApi.removeTagFromTargets(ids, tag)
              .catch((error) => logger.error('Failed to batch remove tag from targets', error));
          }
        },

        toggleSelection: (id) => set((state) => {
          const selectedIds = new Set(state.selectedIds);
          if (selectedIds.has(id)) selectedIds.delete(id);
          else selectedIds.add(id);
          return { selectedIds };
        }),

        selectAll: () => set((state) => ({ selectedIds: new Set(state.targets.map((target) => target.id)) })),
        clearSelection: () => set({ selectedIds: new Set<string>() }),
        selectByStatus: (status) => set((state) => ({
          selectedIds: new Set(state.targets.filter((target) => target.status === status).map((target) => target.id)),
        })),
        selectByPriority: (priority) => set((state) => ({
          selectedIds: new Set(state.targets.filter((target) => target.priority === priority).map((target) => target.id)),
        })),

        addTag: (tag) => set((state) => ({
          availableTags: state.availableTags.includes(tag) ? state.availableTags : [...state.availableTags, tag],
        })),

        removeTag: (tag) => set((state) => ({
          ...deriveCompatState({
            targetLists: state.targetLists,
            targetEntries: state.targetEntries.map((entry) => ({
              ...entry,
              tags: entry.tags.filter((item) => item !== tag),
            })),
            activeListId: state.activeListId,
            activeEntryId: state.activeEntryId,
            selectedIds: state.selectedIds,
            availableTags: state.availableTags.filter((item) => item !== tag),
          }),
          filterTags: state.filterTags.filter((item) => item !== tag),
        })),

        setFilterTags: (filterTags) => set({ filterTags }),
        setGroupBy: (groupBy) => set({ groupBy }),
        setShowArchived: (showArchived) => set({ showArchived }),
        setSearchQuery: (searchQuery) => set({ searchQuery }),
        setFilterStatus: (filterStatus) => set({ filterStatus }),
        setFilterPriority: (filterPriority) => set({ filterPriority }),
        setSortBy: (sortBy) => set({ sortBy }),
        setSortOrder: (sortOrder) => set({ sortOrder }),
        setScoreProfile: (scoreProfile) => set({ scoreProfile }),
        setScoreVersion: (scoreVersion) => set({ scoreVersion }),
        setScoreBreakdownVisibility: (scoreBreakdownVisibility) => set({ scoreBreakdownVisibility }),

        toggleFavorite: (id) => {
          const entry = get().getEntryById(id);
          if (!entry) return;
          get().updateEntry(id, { isFavorite: !entry.isFavorite });
          if (isTauri()) {
            targetListApi.toggleFavorite(id)
              .catch((error) => logger.error('Failed to toggle target favorite in Tauri', error));
          }
        },

        toggleArchive: (id) => {
          const entry = get().getEntryById(id);
          if (!entry) return;
          get().updateEntry(id, { isArchived: !entry.isArchived });
          if (isTauri()) {
            targetListApi.toggleArchive(id)
              .catch((error) => logger.error('Failed to toggle target archive in Tauri', error));
          }
        },

        archiveCompleted: () => {
          const completedIds = get().targets.filter((target) => target.status === 'completed').map((target) => target.id);
          get().updateTargetsBatch(completedIds, { isArchived: true });
          if (isTauri()) {
            targetListApi.archiveCompleted()
              .catch((error) => logger.error('Failed to archive completed targets in Tauri', error));
          }
        },

        clearCompleted: () => {
          const completedIds = get().targets.filter((target) => target.status === 'completed').map((target) => target.id);
          get().removeTargetsBatch(completedIds);
          if (isTauri()) {
            targetListApi.clearCompleted()
              .catch((error) => logger.error('Failed to clear completed targets in Tauri', error));
          }
        },

        clearAll: () => {
          const ids = get().targets.map((target) => target.id);
          get().removeTargetsBatch(ids);
          if (isTauri()) {
            targetListApi.clearAll()
              .catch((error) => logger.error('Failed to clear all targets in Tauri', error));
          }
        },

        updateObservableWindow: (id, window) => {
          get().updateEntry(id, { observableWindow: window });
        },

        _tauriInitialized: false,

        syncWithTauri: async () => {
          if (!isTauri() || get()._tauriInitialized) return;

          try {
            const data = await targetListApi.load();
            if (!data || typeof data !== 'object') {
              set({ _tauriInitialized: true });
              return;
            }

            const rawData = data as unknown as Record<string, unknown>;

            if (Array.isArray(rawData.target_lists) && Array.isArray(rawData.target_entries)) {
              const targetLists = (rawData.target_lists as Record<string, unknown>[]).map((list) => ({
                id: String(list.id),
                name: String(list.name),
                description: list.description as string | undefined,
                color: list.color as string | undefined,
                defaultSortBy: (list.default_sort_by as TargetSortBy | undefined) ?? 'manual',
                defaultSortOrder: (list.default_sort_order as TargetSortOrder | undefined) ?? 'asc',
                createdAt: Number(list.created_at ?? Date.now()),
                updatedAt: Number(list.updated_at ?? Date.now()),
                isArchived: Boolean(list.is_archived),
              }));

              const targetEntries = (rawData.target_entries as Record<string, unknown>[]).map((entry) => ({
                ...mapLegacyTauriTarget(entry, String(entry.list_id)),
              }));

              const plannerSelection = rawData.planner_selection as Record<string, unknown> | undefined;

              set((state) => ({
                ...deriveCompatState({
                  targetLists,
                  targetEntries,
                  activeListId: String(rawData.active_list_id ?? targetLists[0]?.id ?? state.activeListId),
                  activeEntryId: rawData.active_entry_id ? String(rawData.active_entry_id) : null,
                  selectedIds: new Set<string>(),
                  availableTags: Array.isArray(rawData.available_tags)
                    ? (rawData.available_tags as string[])
                    : state.availableTags,
                }),
                plannerSelection: plannerSelection
                  ? {
                      mode: (plannerSelection.mode as PlannerSelectionState['mode']) ?? 'active',
                      selectedListIds: Array.isArray(plannerSelection.selected_list_ids)
                        ? (plannerSelection.selected_list_ids as string[])
                        : [],
                    }
                  : state.plannerSelection,
                _tauriInitialized: true,
              }));
              return;
            }

            const importedList = createDefaultList({ name: 'Imported Targets' });
            const targetEntries = Array.isArray(rawData.targets)
              ? (rawData.targets as Record<string, unknown>[]).map((entry) =>
                  mapLegacyTauriTarget(entry, importedList.id)
                )
              : [];

            set((state) => ({
              ...deriveCompatState({
                targetLists: [importedList],
                targetEntries,
                activeListId: importedList.id,
                activeEntryId: rawData.active_target_id ? String(rawData.active_target_id) : null,
                selectedIds: new Set<string>(),
                availableTags: Array.isArray(rawData.available_tags)
                  ? (rawData.available_tags as string[])
                  : state.availableTags,
              }),
              _tauriInitialized: true,
            }));
          } catch (error) {
            logger.error('Failed to sync with Tauri', error);
          }
        },

        getFilteredTargets: () => {
          const state = get();
          let filtered = state.targets;

          if (!state.showArchived) {
            filtered = filtered.filter((target) => !target.isArchived);
          }

          if (state.searchQuery.trim()) {
            const query = state.searchQuery.trim().toLowerCase();
            filtered = filtered.filter((target) =>
              target.name.toLowerCase().includes(query) ||
              target.tags.some((tag) => tag.toLowerCase().includes(query)) ||
              target.notes?.toLowerCase().includes(query)
            );
          }

          if (state.filterStatus !== 'all') {
            filtered = filtered.filter((target) => target.status === state.filterStatus);
          }

          if (state.filterPriority !== 'all') {
            filtered = filtered.filter((target) => target.priority === state.filterPriority);
          }

          if (state.filterTags.length > 0) {
            filtered = filtered.filter((target) =>
              state.filterTags.some((tag) => target.tags.includes(tag))
            );
          }

          if (state.sortBy !== 'manual') {
            const dir = state.sortOrder === 'asc' ? 1 : -1;
            filtered = [...filtered].sort((a, b) => {
              switch (state.sortBy) {
                case 'name':
                  return dir * a.name.localeCompare(b.name);
                case 'priority': {
                  const order = { high: 0, medium: 1, low: 2 };
                  return dir * (order[a.priority] - order[b.priority]);
                }
                case 'status': {
                  const order = { planned: 0, in_progress: 1, completed: 2 };
                  return dir * (order[a.status] - order[b.status]);
                }
                case 'addedAt':
                  return dir * (a.addedAt - b.addedAt);
                case 'feasibility': {
                  const getScore = (target: TargetItem) => {
                    const window = target.observableWindow;
                    if (!window) return 0;
                    const durationHours = (window.end.getTime() - window.start.getTime()) / 3600000;
                    const altitudeScore = window.maxAltitude / 90;
                    const circumpolarBonus = window.isCircumpolar ? 0.2 : 0;
                    return durationHours * 0.5 + altitudeScore * 0.3 + circumpolarBonus;
                  };
                  return dir * (getScore(a) - getScore(b));
                }
                default:
                  return 0;
              }
            });
          }

          return filtered;
        },

        getGroupedTargets: () => {
          const state = get();
          const filtered = state.getFilteredTargets();
          const groups = new Map<string, TargetItem[]>();

          if (state.groupBy === 'none') {
            groups.set('all', filtered);
            return groups;
          }

          for (const target of filtered) {
            let key: string;
            switch (state.groupBy) {
              case 'priority':
                key = target.priority;
                break;
              case 'status':
                key = target.status;
                break;
              case 'tag':
                if (target.tags.length === 0) {
                  key = 'untagged';
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(target);
                } else {
                  for (const tag of target.tags) {
                    if (!groups.has(tag)) groups.set(tag, []);
                    groups.get(tag)!.push(target);
                  }
                }
                continue;
              default:
                key = 'all';
                break;
            }

            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(target);
          }

          return groups;
        },

        getSelectedTargets: () => {
          const state = get();
          return state.targets.filter((target) => state.selectedIds.has(target.id));
        },

        checkDuplicate: (name, ra, dec) => findDuplicate(get().targets, name, ra, dec),
      };
    },
    {
      name: 'starmap-target-management-v2',
      storage: getZustandStorage(),
      partialize: (state) => ({
        targetLists: state.targetLists,
        targetEntries: state.targetEntries,
        activeListId: state.activeListId,
        activeEntryId: state.activeEntryId,
        plannerSelection: state.plannerSelection,
        availableTags: state.availableTags,
        groupBy: state.groupBy,
        showArchived: state.showArchived,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        scoreProfile: state.scoreProfile,
        scoreVersion: state.scoreVersion,
        scoreBreakdownVisibility: state.scoreBreakdownVisibility,
      }),
    }
  )
);
