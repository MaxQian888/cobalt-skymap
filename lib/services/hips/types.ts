/**
 * HiPS survey types
 */

// ============================================================================
// Survey Types
// ============================================================================

export type HiPSCategory = 
  | 'optical'
  | 'infrared'
  | 'radio'
  | 'uv'
  | 'xray'
  | 'gamma'
  | 'other';

export interface HiPSSurvey {
  id: string;
  name: string;
  url: string;
  category: HiPSCategory;
  description?: string;
  maxOrder?: number;
  tileFormat?: 'jpg' | 'png' | 'webp';
  frame?: 'equatorial' | 'galactic';
  isDefault?: boolean;
  /** Image survey (sky imagery) vs progressive catalog HiPS. Defaults to 'image'. */
  kind?: 'image' | 'catalog';
  /** For catalog HiPS: the HiPSCatService base URL fed to A.catalogHiPS(). */
  catalogServiceUrl?: string;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface HiPSRegistryEntry {
  ID: string;
  obs_title: string;
  hips_service_url: string;
  hips_order?: string;
  hips_tile_format?: string;
  obs_regime?: string;
  client_category?: string;
  dataproduct_type?: string;
}

export interface HiPSRegistry {
  surveys: HiPSSurvey[];
  lastUpdated: Date;
}

// ============================================================================
// Tile Types
// ============================================================================

export interface HiPSTile {
  order: number;
  pixelIndex: number;
  url: string;
}

export interface HiPSTileCache {
  tiles: Map<string, Blob>;
  size: number;
  maxSize: number;
}
