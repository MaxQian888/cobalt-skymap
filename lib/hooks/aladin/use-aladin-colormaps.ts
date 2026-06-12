'use client';

import { useMemo } from 'react';
import { useStellariumStore } from '@/lib/stores/stellarium-store';

/**
 * Curated fallback colormaps (matches the AladinColormap union) used when no
 * live Aladin instance is available to enumerate the real list.
 */
const FALLBACK_COLORMAPS: string[] = [
  'native',
  'grayscale',
  'viridis',
  'plasma',
  'inferno',
  'magma',
  'cubehelix',
  'rainbow',
  'rdbu',
  'blues',
  'cividis',
  'eosb',
  'parula',
  'rdyibu',
  'redtemperature',
];

/**
 * Returns the list of colormap names available in Aladin Lite, sourced from the
 * live engine when present (the method name differs across v3 builds, so both
 * `getListOfColormaps` and `getAvailableListOfColormaps` are tried), with a
 * curated fallback. `native` is always listed first.
 */
export function useAladinColormaps(): string[] {
  const aladin = useStellariumStore((s) => s.aladin);

  return useMemo(() => {
    if (!aladin) return FALLBACK_COLORMAPS;
    try {
      const inst = aladin as unknown as {
        getListOfColormaps?: () => string[];
        getAvailableListOfColormaps?: () => string[];
      };
      const live = inst.getListOfColormaps?.() ?? inst.getAvailableListOfColormaps?.();
      if (Array.isArray(live) && live.length > 0) {
        return ['native', ...live.filter((m) => m !== 'native')];
      }
    } catch {
      // keep fallback
    }
    return FALLBACK_COLORMAPS;
  }, [aladin]);
}
