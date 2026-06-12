/**
 * Minor Planet Center orbital-element refresh API.
 *
 * Wraps the Rust `refresh_orbital_data` / `get_orbital_override_path` commands,
 * which download + (for asteroids) gunzip and magnitude-filter MPC data into an
 * app-data override directory the Stellarium engine can re-fetch.
 */

import { isTauri } from '@/lib/storage/platform';

export type MpcDataset = 'comets' | 'asteroids';

export interface OrbitalDataInfo {
  dataset: MpcDataset;
  /** Absolute path to the written override file. */
  path: string;
  /** Records written (asteroids kept after H filtering; comet lines otherwise). */
  count: number;
  size_bytes: number;
  /** Unix milliseconds when the refresh completed. */
  fetched_at: number;
}

async function getInvoke() {
  if (!isTauri()) {
    throw new Error('MPC orbital data API is only available in the desktop app');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

export const mpcApi = {
  /** Download + process the latest MPC orbital elements for a dataset. */
  async refreshOrbitalData(dataset: MpcDataset, maxH?: number): Promise<OrbitalDataInfo> {
    const invoke = await getInvoke();
    return invoke('refresh_orbital_data', { dataset, maxH });
  },

  /** Path to a previously-refreshed override file, or null if none exists. */
  async getOverridePath(dataset: MpcDataset): Promise<string | null> {
    const invoke = await getInvoke();
    return invoke('get_orbital_override_path', { dataset });
  },

  isAvailable: isTauri,
};
