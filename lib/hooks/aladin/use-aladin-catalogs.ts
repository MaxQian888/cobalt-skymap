'use client';

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import type A from 'aladin-lite';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useStellariumStore } from '@/lib/stores/stellarium-store';
import { useAladinStore, type AladinCatalogLayer } from '@/lib/stores/aladin-store';
import { getFoVCompat } from '@/lib/aladin/aladin-compat';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;
type AladinCatalog = ReturnType<typeof A.catalog>;

const logger = createLogger('aladin-catalogs');

export type CatalogSourceType = 'simbad' | 'vizier' | 'ned';
export type CatalogLayerConfig = AladinCatalogLayer;

export const DEFAULT_CATALOG_LAYERS: CatalogLayerConfig[] = [
  {
    id: 'simbad',
    type: 'simbad',
    name: 'SIMBAD',
    enabled: false,
    color: '#ff9800',
    radius: 0.5,
    limit: 1000,
  },
  {
    id: 'ned',
    type: 'ned',
    name: 'NED',
    enabled: false,
    color: '#4caf50',
    radius: 0.5,
    limit: 500,
  },
  {
    id: 'vizier-tycho2',
    type: 'vizier',
    name: 'Tycho-2',
    enabled: false,
    color: '#2196f3',
    vizierCatId: 'I/259/tyc2',
    radius: 0.25,
    limit: 5000,
  },
  {
    id: 'vizier-ucac4',
    type: 'vizier',
    name: 'UCAC4',
    enabled: false,
    color: '#9c27b0',
    vizierCatId: 'I/322A/out',
    radius: 0.1,
    limit: 5000,
  },
];

interface UseAladinCatalogsOptions {
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
}

interface UseAladinCatalogsReturn {
  catalogLayers: CatalogLayerConfig[];
  toggleCatalog: (catalogId: string) => void;
  refreshCatalogs: () => void;
}

const AUTO_SIMBAD_PAN_THRESHOLD_DEG = 2;
const AUTO_SIMBAD_DEBOUNCE_MS = 1500;
const AUTO_SIMBAD_RADIUS_FACTOR = 0.35;
const AUTO_SIMBAD_LIMIT = 500;

function signatureForLayer(layer: CatalogLayerConfig): string {
  return [layer.enabled, layer.type, layer.name, layer.color, layer.radius, layer.limit, layer.vizierCatId ?? '']
    .join('|');
}

export function useAladinCatalogs({
  aladinRef,
  engineReady,
}: UseAladinCatalogsOptions): UseAladinCatalogsReturn {
  const skyEngine = useSettingsStore((state) => state.skyEngine);

  const catalogLayers = useAladinStore((state) => state.catalogLayers);
  const toggleCatalogLayer = useAladinStore((state) => state.toggleCatalogLayer);
  const updateCatalogLayer = useAladinStore((state) => state.updateCatalogLayer);

  const activeCatalogsRef = useRef<Map<string, AladinCatalog>>(new Map());
  const signatureMapRef = useRef<Map<string, string>>(new Map());

  const aladinStaticRef = useRef<typeof A | null>(null);
  const [staticApiReady, setStaticApiReady] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const autoSimbadRef = useRef<AladinCatalog | null>(null);
  const autoSimbadCenterRef = useRef<{ ra: number; dec: number } | null>(null);
  const autoSimbadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;

    import('aladin-lite').then((m) => {
      aladinStaticRef.current = m.default;
      setStaticApiReady(true);
    }).catch((err) => {
      logger.warn('Failed to load aladin-lite static API for catalogs', err);
    });
  }, [engineReady, skyEngine]);

  const createCatalog = useCallback((layer: CatalogLayerConfig): AladinCatalog | null => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!aladin || !AStatic || !layer.enabled) return null;

    const [ra, dec] = aladin.getRaDec();
    const target = `${ra} ${dec}`;

    const opts = {
      name: layer.name,
      color: layer.color,
      sourceSize: 8,
      limit: layer.limit,
      onClick: 'showPopup' as const,
    };

    if (layer.type === 'simbad') {
      const factory = AStatic.catalogFromSimbad ?? AStatic.catalogFromSIMBAD;
      return factory({ ra, dec }, layer.radius, opts);
    }

    if (layer.type === 'ned') {
      return AStatic.catalogFromNED(target, layer.radius, opts);
    }

    if (layer.type === 'vizier' && layer.vizierCatId) {
      return AStatic.catalogFromVizieR(layer.vizierCatId, target, layer.radius, opts);
    }

    return null;
  }, [aladinRef]);

  useEffect(() => {
    const aladin = aladinRef.current;
    if (!engineReady || skyEngine !== 'aladin' || !staticApiReady || !aladin) return;

    const active = activeCatalogsRef.current;
    const signatures = signatureMapRef.current;

    // Create/update enabled catalogs.
    for (const layer of catalogLayers) {
      const nextSignature = signatureForLayer(layer);
      const prevSignature = signatures.get(layer.id);
      const existing = active.get(layer.id);

      if (!layer.enabled) {
        if (existing) {
          try { existing.hide(); } catch { /* ignore */ }
          active.delete(layer.id);
        }
        signatures.delete(layer.id);
        continue;
      }

      if (existing && prevSignature === nextSignature) {
        continue;
      }

      if (existing) {
        try { existing.hide(); } catch { /* ignore */ }
        active.delete(layer.id);
      }

      const catalog = createCatalog(layer);
      if (!catalog) continue;

      try {
        aladin.addCatalog(catalog);
        active.set(layer.id, catalog);
        signatures.set(layer.id, nextSignature);
      } catch (error) {
        logger.warn(`Failed to apply catalog layer ${layer.name}`, error);
        updateCatalogLayer(layer.id, { enabled: false });
      }
    }

    // Remove stale instances that no longer exist in store.
    for (const [id, catalog] of active) {
      if (catalogLayers.some((layer) => layer.id === id)) continue;
      try { catalog.hide(); } catch { /* ignore */ }
      active.delete(id);
      signatures.delete(id);
    }
  }, [aladinRef, catalogLayers, createCatalog, engineReady, refreshTick, skyEngine, staticApiReady, updateCatalogLayer]);

  const loadAutoSimbad = useCallback((ra: number, dec: number) => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!aladin || !AStatic) return;

    if (autoSimbadRef.current) {
      try { autoSimbadRef.current.hide(); } catch { /* ignore */ }
      autoSimbadRef.current = null;
    }

    try {
      const currentFov = getFoVCompat(aladin) ?? 60;
      const radius = Math.max(0.2, Math.min(5, currentFov * AUTO_SIMBAD_RADIUS_FACTOR));

      const factory = AStatic.catalogFromSimbad ?? AStatic.catalogFromSIMBAD;
      const catalog = factory(
        { ra, dec },
        radius,
        {
          name: '_auto_simbad',
          color: '#ffffff',
          sourceSize: 0,
          limit: AUTO_SIMBAD_LIMIT,
          onClick: 'showPopup',
        }
      );

      aladin.addCatalog(catalog);
      autoSimbadRef.current = catalog;
      autoSimbadCenterRef.current = { ra, dec };
    } catch (error) {
      logger.debug('Auto-SIMBAD load failed', error);
    }
  }, [aladinRef]);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin' || !staticApiReady) return;

    const aladin = aladinRef.current;
    if (!aladin) return;

    const [ra, dec] = aladin.getRaDec();
    loadAutoSimbad(ra, dec);
  }, [aladinRef, engineReady, loadAutoSimbad, skyEngine, staticApiReady]);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;

    const unsubscribe = useStellariumStore.subscribe((state) => {
      const vd = state.viewDirection;
      if (!vd || !autoSimbadCenterRef.current) return;

      const raDeg = (vd.ra * 180) / Math.PI;
      const decDeg = (vd.dec * 180) / Math.PI;
      const prev = autoSimbadCenterRef.current;

      const dRa = Math.abs(raDeg - prev.ra) * Math.cos((decDeg * Math.PI) / 180);
      const dDec = Math.abs(decDeg - prev.dec);
      const dist = Math.sqrt(dRa * dRa + dDec * dDec);

      if (dist < AUTO_SIMBAD_PAN_THRESHOLD_DEG) return;

      if (autoSimbadTimerRef.current) clearTimeout(autoSimbadTimerRef.current);
      autoSimbadTimerRef.current = setTimeout(() => {
        autoSimbadTimerRef.current = null;
        const aladin = aladinRef.current;
        if (!aladin || !aladinStaticRef.current) return;
        const [newRa, newDec] = aladin.getRaDec();
        loadAutoSimbad(newRa, newDec);
      }, AUTO_SIMBAD_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (autoSimbadTimerRef.current) {
        clearTimeout(autoSimbadTimerRef.current);
        autoSimbadTimerRef.current = null;
      }
    };
  }, [aladinRef, engineReady, loadAutoSimbad, skyEngine]);

  const cleanupCatalogs = useCallback(() => {
    for (const [, catalog] of activeCatalogsRef.current) {
      try { catalog.hide(); } catch { /* ignore */ }
    }
    activeCatalogsRef.current.clear();
    signatureMapRef.current.clear();

    if (autoSimbadRef.current) {
      try { autoSimbadRef.current.hide(); } catch { /* ignore */ }
      autoSimbadRef.current = null;
    }
    autoSimbadCenterRef.current = null;
  }, []);

  useEffect(() => {
    if (skyEngine === 'aladin' && engineReady) return;
    cleanupCatalogs();
  }, [cleanupCatalogs, engineReady, skyEngine]);

  const toggleCatalog = useCallback((catalogId: string) => {
    toggleCatalogLayer(catalogId);
  }, [toggleCatalogLayer]);

  const refreshCatalogs = useCallback(() => {
    cleanupCatalogs();
    setRefreshTick((prev) => prev + 1);
  }, [cleanupCatalogs]);

  return {
    catalogLayers,
    toggleCatalog,
    refreshCatalogs,
  };
}
