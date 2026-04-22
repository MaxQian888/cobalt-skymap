'use client';

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import type A from 'aladin-lite';
import { setMocStyleCompat } from '@/lib/aladin/aladin-compat';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useAladinStore, type AladinMOCLayer } from '@/lib/stores/aladin-store';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;
type AladinMOC = ReturnType<typeof A.MOCFromURL>;

const logger = createLogger('aladin-moc');

export type MOCLayer = AladinMOCLayer;

export const WELL_KNOWN_MOCS: { name: string; url: string; color: string }[] = [
  {
    name: 'SDSS DR16',
    url: 'https://alasky.cds.unistra.fr/footprints/tables/vizier/V_154_sdss16/MOC',
    color: '#2196f3',
  },
  {
    name: 'Gaia DR3',
    url: 'https://alasky.cds.unistra.fr/footprints/tables/vizier/I_355_gaiadr3/MOC',
    color: '#ff9800',
  },
  {
    name: '2MASS',
    url: 'https://alasky.cds.unistra.fr/footprints/tables/vizier/II_246_out/MOC',
    color: '#f44336',
  },
  {
    name: 'WISE AllSky',
    url: 'https://alasky.cds.unistra.fr/footprints/tables/vizier/II_328_allwise/MOC',
    color: '#4caf50',
  },
];

interface UseAladinMOCOptions {
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
}

interface UseAladinMOCReturn {
  mocLayers: MOCLayer[];
  addMOC: (url: string, name: string, color?: string) => void;
  removeMOC: (mocId: string) => void;
  toggleMOC: (mocId: string) => void;
  setMOCOpacity: (mocId: string, opacity: number) => void;
}

interface MocHandle {
  moc: AladinMOC;
  sourceKey: string;
}

function sourceKey(layer: MOCLayer): string {
  return layer.url ? `url:${layer.url}` : `json:${JSON.stringify(layer.json ?? {})}`;
}

export function useAladinMOC({
  aladinRef,
  engineReady,
}: UseAladinMOCOptions): UseAladinMOCReturn {
  const skyEngine = useSettingsStore((state) => state.skyEngine);

  const mocLayers = useAladinStore((state) => state.mocLayers);
  const addMocLayer = useAladinStore((state) => state.addMocLayer);
  const removeMocLayer = useAladinStore((state) => state.removeMocLayer);
  const toggleMocLayer = useAladinStore((state) => state.toggleMocLayer);
  const updateMocLayer = useAladinStore((state) => state.updateMocLayer);

  const mocInstancesRef = useRef<Map<string, MocHandle>>(new Map());
  const aladinStaticRef = useRef<typeof A | null>(null);
  const [staticApiReady, setStaticApiReady] = useState(false);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;
    import('aladin-lite').then((m) => {
      aladinStaticRef.current = m.default;
      setStaticApiReady(true);
    }).catch((err) => {
      logger.warn('Failed to load aladin-lite static API for MOC', err);
    });
  }, [engineReady, skyEngine]);

  useEffect(() => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!aladin || !AStatic || !engineReady || skyEngine !== 'aladin' || !staticApiReady) return;

    const active = mocInstancesRef.current;

    for (const layer of mocLayers) {
      const key = sourceKey(layer);
      const existing = active.get(layer.id);

      if (!layer.visible) {
        if (existing) {
          try { existing.moc.hide(); } catch { /* ignore */ }
          active.delete(layer.id);
        }
        continue;
      }

      if (existing && existing.sourceKey !== key) {
        try { existing.moc.hide(); } catch { /* ignore */ }
        active.delete(layer.id);
      }

      const current = active.get(layer.id);
      const moc = current?.moc ?? (() => {
        try {
          const created = layer.url
            ? AStatic.MOCFromURL(layer.url, {
              name: layer.name,
              color: layer.color,
              opacity: layer.opacity,
              lineWidth: layer.lineWidth,
              adaptativeDisplay: true,
            })
            : AStatic.MOCFromJSON(layer.json ?? {}, {
              name: layer.name,
              color: layer.color,
              opacity: layer.opacity,
              lineWidth: layer.lineWidth,
              adaptativeDisplay: true,
            });
          aladin.addMOC(created);
          active.set(layer.id, { moc: created, sourceKey: key });
          return created;
        } catch (error) {
          logger.warn(`Failed to add MOC: ${layer.name}`, error);
          if (layer.visible) {
            updateMocLayer(layer.id, { visible: false });
          }
          return null;
        }
      })();

      if (!moc) continue;

      setMocStyleCompat(moc, {
        visible: layer.visible,
        opacity: layer.opacity,
        color: layer.color,
        lineWidth: layer.lineWidth,
      });
    }

    for (const [id, handle] of active) {
      if (mocLayers.some((layer) => layer.id === id)) continue;
      try { handle.moc.hide(); } catch { /* ignore */ }
      active.delete(id);
    }
  }, [aladinRef, engineReady, mocLayers, skyEngine, staticApiReady, updateMocLayer]);

  const addMOC = useCallback((url: string, name: string, color = '#3b82f6') => {
    addMocLayer({
      name,
      url,
      color,
      opacity: 0.3,
      lineWidth: 1,
      visible: true,
    });
  }, [addMocLayer]);

  const removeMOC = useCallback((mocId: string) => {
    removeMocLayer(mocId);
  }, [removeMocLayer]);

  const toggleMOC = useCallback((mocId: string) => {
    toggleMocLayer(mocId);
  }, [toggleMocLayer]);

  const setMOCOpacity = useCallback((mocId: string, opacity: number) => {
    updateMocLayer(mocId, { opacity });
  }, [updateMocLayer]);

  useEffect(() => {
    const mocInstances = mocInstancesRef.current;
    return () => {
      for (const [, handle] of mocInstances) {
        try { handle.moc.hide(); } catch { /* ignore */ }
      }
      mocInstances.clear();
    };
  }, []);

  return {
    mocLayers,
    addMOC,
    removeMOC,
    toggleMOC,
    setMOCOpacity,
  };
}
