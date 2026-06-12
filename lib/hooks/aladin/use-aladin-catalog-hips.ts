'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type A from 'aladin-lite';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useHipsSurveyStore } from '@/lib/stores/hips-survey-store';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;
type AladinCatalog = ReturnType<typeof A.catalog>;

const logger = createLogger('aladin-catalog-hips');

interface UseAladinCatalogHipsOptions {
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
}

/**
 * Renders the selected progressive catalog HiPS (Gaia DR3, etc., discovered in
 * Phase 3 / D3) on the Aladin canvas via `A.catalogHiPS`. Selection lives in the
 * `hips-survey-store`; this hook adds the matching catalog and removes it when the
 * selection changes or clears.
 */
export function useAladinCatalogHips({ aladinRef, engineReady }: UseAladinCatalogHipsOptions): void {
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const selectedSurveyId = useHipsSurveyStore((state) => state.selectedSurveyId);
  const discoveredCatalogs = useHipsSurveyStore((state) => state.discoveredCatalogs);

  const aladinStaticRef = useRef<typeof A | null>(null);
  const [staticApiReady, setStaticApiReady] = useState(false);
  const activeRef = useRef<{ id: string; catalog: AladinCatalog } | null>(null);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;
    import('aladin-lite')
      .then((m) => {
        aladinStaticRef.current = m.default;
        setStaticApiReady(true);
      })
      .catch((err) => logger.warn('Failed to load aladin-lite static API for catalog HiPS', err));
  }, [engineReady, skyEngine]);

  const removeActive = useCallback(() => {
    if (activeRef.current) {
      try {
        activeRef.current.catalog.hide();
      } catch {
        /* ignore */
      }
      activeRef.current = null;
    }
  }, []);

  useEffect(() => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!engineReady || skyEngine !== 'aladin' || !staticApiReady || !aladin || !AStatic) return;

    // Already showing the right catalog.
    if (activeRef.current?.id === selectedSurveyId) return;

    removeActive();

    const selected = discoveredCatalogs.find(
      (c) => c.id === selectedSurveyId && c.kind === 'catalog' && c.catalogServiceUrl,
    );
    if (!selected || !selected.catalogServiceUrl) return;

    try {
      const catalog = AStatic.catalogHiPS(selected.catalogServiceUrl, {
        name: selected.name,
        onClick: 'showPopup',
      });
      aladin.addCatalog(catalog);
      activeRef.current = { id: selected.id, catalog };
    } catch (error) {
      logger.warn(`Failed to add catalog HiPS ${selected.name}`, error);
    }
  }, [aladinRef, discoveredCatalogs, engineReady, removeActive, selectedSurveyId, skyEngine, staticApiReady]);

  // Tear down when leaving the Aladin engine or unmounting.
  useEffect(() => {
    if (skyEngine === 'aladin' && engineReady) return;
    removeActive();
  }, [engineReady, removeActive, skyEngine]);

  useEffect(() => () => removeActive(), [removeActive]);
}
