/**
 * Tauri API wrapper for target list management
 * Only available in Tauri desktop environment
 */

import { isTauri } from '@/lib/storage/platform';

// Lazy import to avoid errors in web environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error('Tauri API is only available in desktop environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

// ============================================================================
// Types
// ============================================================================

export type TargetPriority = 'low' | 'medium' | 'high';
export type TargetStatus = 'planned' | 'in_progress' | 'completed';

export interface MosaicSettings {
  enabled: boolean;
  rows: number;
  cols: number;
  overlap: number;
  overlap_unit?: 'percent' | 'pixels';
  layout_mode?: 'rectangular' | 'staggered';
  panel_order?: 'row-major' | 'serpentine' | 'center-out';
}

export interface MosaicPlanWarning {
  code: string;
  severity: 'error' | 'warning';
  actual?: number;
  min?: number;
  max?: number;
}

export interface MosaicPlanPanel {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  center_offset_x: number;
  center_offset_y: number;
  sequence: number;
  is_center: boolean;
}

export interface MosaicPlan {
  layout_mode: 'rectangular' | 'staggered';
  panel_order: 'row-major' | 'serpentine' | 'center-out';
  total_panels: number;
  width: number;
  height: number;
  overlap_factor: number;
  estimated_panel_minutes?: number | null;
  estimated_total_minutes?: number | null;
  panels: MosaicPlanPanel[];
  warnings: MosaicPlanWarning[];
}

export interface ExposurePlan {
  single_exposure: number;
  total_exposure: number;
  sub_frames: number;
  filter?: string;
  advanced?: {
    sqm?: number;
    filter_bandwidth_nm?: number;
    read_noise_limit_percent?: number;
    gain_strategy?: 'unity' | 'max_dynamic_range' | 'manual';
    recommended_gain?: number;
    recommended_exposure_sec?: number;
    sky_flux_per_pixel?: number;
    target_signal_per_pixel_per_sec?: number;
    dynamic_range_score?: number;
    dynamic_range_stops?: number;
    read_noise_used?: number;
    dark_current_used?: number;
    noise_fractions?: {
      read?: number;
      sky?: number;
      dark?: number;
    };
    stack_estimate?: {
      recommended_frame_count?: number;
      estimated_total_minutes?: number;
      frames_for_target_snr?: number;
      frames_for_time_noise?: number;
      target_snr?: number;
      target_time_noise_ratio?: number;
    };
  };
}

export interface ObservableWindow {
  start: string;
  end: string;
  max_altitude: number;
  transit_time: string;
  is_circumpolar: boolean;
}

export interface TargetItem {
  id: string;
  name: string;
  ra: number;
  dec: number;
  ra_string: string;
  dec_string: string;
  sensor_width?: number;
  sensor_height?: number;
  focal_length?: number;
  rotation_angle?: number;
  mosaic?: MosaicSettings;
  mosaic_plan?: MosaicPlan;
  exposure_plan?: ExposurePlan;
  notes?: string;
  added_at: number;
  priority: TargetPriority;
  status: TargetStatus;
  tags: string[];
  observable_window?: ObservableWindow;
  is_favorite: boolean;
  is_archived: boolean;
}

export interface TargetListData {
  targets: TargetItem[];
  available_tags: string[];
  active_target_id?: string;
}

export interface TargetInput {
  name: string;
  ra: number;
  dec: number;
  ra_string: string;
  dec_string: string;
  sensor_width?: number;
  sensor_height?: number;
  focal_length?: number;
  rotation_angle?: number;
  mosaic?: MosaicSettings;
  mosaic_plan?: MosaicPlan;
  exposure_plan?: ExposurePlan;
  notes?: string;
  priority?: TargetPriority;
  tags?: string[];
}

export interface BatchTargetInput {
  name: string;
  ra: number;
  dec: number;
  ra_string: string;
  dec_string: string;
}

export interface TargetStats {
  total: number;
  planned: number;
  in_progress: number;
  completed: number;
  favorites: number;
  archived: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  by_tag: [string, number][];
}

// ============================================================================
// Target List API
// ============================================================================

export const targetListApi = {
  async load(): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('load_target_list');
  },

  async save(targetList: TargetListData): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_target_list', { targetList });
  },

  async addTarget(target: TargetInput): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('add_target', { target });
  },

  async addTargetsBatch(
    targets: BatchTargetInput[],
    defaultPriority?: TargetPriority,
    defaultTags?: string[]
  ): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('add_targets_batch', { targets, defaultPriority, defaultTags });
  },

  async updateTarget(targetId: string, updates: Partial<TargetItem>): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('update_target', { targetId, updates });
  },

  async removeTarget(targetId: string): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('remove_target', { targetId });
  },

  async removeTargetsBatch(targetIds: string[]): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('remove_targets_batch', { targetIds });
  },

  async setActiveTarget(targetId: string | null): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('set_active_target', { targetId });
  },

  async toggleFavorite(targetId: string): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('toggle_target_favorite', { targetId });
  },

  async toggleArchive(targetId: string): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('toggle_target_archive', { targetId });
  },

  async setStatusBatch(targetIds: string[], status: TargetStatus): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('set_targets_status_batch', { targetIds, status });
  },

  async setPriorityBatch(targetIds: string[], priority: TargetPriority): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('set_targets_priority_batch', { targetIds, priority });
  },

  async addTagToTargets(targetIds: string[], tag: string): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('add_tag_to_targets', { targetIds, tag });
  },

  async removeTagFromTargets(targetIds: string[], tag: string): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('remove_tag_from_targets', { targetIds, tag });
  },

  async archiveCompleted(): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('archive_completed_targets');
  },

  async clearCompleted(): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('clear_completed_targets');
  },

  async clearAll(): Promise<TargetListData> {
    const invoke = await getInvoke();
    return invoke('clear_all_targets');
  },

  async search(query: string): Promise<TargetItem[]> {
    const invoke = await getInvoke();
    return invoke('search_targets', { query });
  },

  async getStats(): Promise<TargetStats> {
    const invoke = await getInvoke();
    return invoke('get_target_stats');
  },

  isAvailable: isTauri,
};

export default targetListApi;
