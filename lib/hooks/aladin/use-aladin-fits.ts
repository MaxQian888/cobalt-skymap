'use client';

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import type A from 'aladin-lite';
import { removeImageLayerCompat } from '@/lib/aladin/aladin-compat';
import { getSurveyById } from '@/lib/core/constants/sky-surveys';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useAladinStore, type AladinFitsLayer, type AladinFitsMode } from '@/lib/stores/aladin-store';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;
type HpxImageSurvey = ReturnType<typeof A.imageHiPS>;

const logger = createLogger('aladin-fits');

interface UseAladinFitsOptions {
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
}

interface UseAladinFitsReturn {
  fitsLayers: AladinFitsLayer[];
  addFitsLayer: (layer: Omit<AladinFitsLayer, 'id'> & { id?: string }) => string;
  removeFitsLayer: (id: string) => void;
  toggleFitsLayer: (id: string) => void;
  setFitsOpacity: (id: string, opacity: number) => void;
  setFitsMode: (id: string, mode: AladinFitsMode) => void;
}

interface FitsHandle {
  survey: HpxImageSurvey;
  mode: AladinFitsMode;
}

export function useAladinFits({
  aladinRef,
  engineReady,
}: UseAladinFitsOptions): UseAladinFitsReturn {
  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const surveyId = useSettingsStore((state) => state.stellarium.surveyId);
  const surveyEnabled = useSettingsStore((state) => state.stellarium.surveyEnabled);

  const fitsLayers = useAladinStore((state) => state.fitsLayers);
  const addFitsLayer = useAladinStore((state) => state.addFitsLayer);
  const removeFitsLayer = useAladinStore((state) => state.removeFitsLayer);
  const toggleFitsLayer = useAladinStore((state) => state.toggleFitsLayer);
  const updateFitsLayer = useAladinStore((state) => state.updateFitsLayer);

  const aladinStaticRef = useRef<typeof A | null>(null);
  const fitsInstancesRef = useRef<Map<string, FitsHandle>>(new Map());
  const [staticApiReady, setStaticApiReady] = useState(false);

  const restoreBaseSurvey = useCallback((aladin: AladinInstance) => {
    if (!surveyEnabled) return;

    const surveyDef = getSurveyById(surveyId);
    const surveyUrl = surveyDef?.url;
    if (!surveyUrl) return;

    try {
      const survey = aladin.newImageSurvey(surveyUrl);
      aladin.setBaseImageLayer(survey);
    } catch (error) {
      logger.warn('Failed to restore base survey after FITS removal', error);
    }
  }, [surveyEnabled, surveyId]);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;
    import('aladin-lite').then((m) => {
      aladinStaticRef.current = m.default;
      setStaticApiReady(true);
    }).catch((err) => {
      logger.warn('Failed to load aladin-lite static API for FITS layers', err);
    });
  }, [engineReady, skyEngine]);

  useEffect(() => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!aladin || !AStatic || !engineReady || skyEngine !== 'aladin' || !staticApiReady) return;

    const active = fitsInstancesRef.current;

    for (const layer of fitsLayers) {
      const existing = active.get(layer.id);
      const needsRecreate = existing && existing.mode !== layer.mode;

      if (!layer.enabled) {
        if (existing) {
          if (existing.mode === 'overlay') {
            try { removeImageLayerCompat(aladin, layer.id); } catch { /* ignore */ }
          } else {
            restoreBaseSurvey(aladin);
          }
          active.delete(layer.id);
        }
        continue;
      }

      if (needsRecreate && existing) {
        if (existing.mode === 'overlay') {
          try { removeImageLayerCompat(aladin, layer.id); } catch { /* ignore */ }
        }
        active.delete(layer.id);
      }

      const handle = active.get(layer.id);
      const survey = handle?.survey ?? AStatic.imageHiPS(layer.url, {
        name: layer.name,
        imgFormat: 'fits',
      });

      if (!handle) {
        try {
          if (layer.mode === 'base') {
            aladin.setBaseImageLayer(survey);
          } else {
            aladin.setOverlayImageLayer(survey, layer.id);
          }
          active.set(layer.id, { survey, mode: layer.mode });
        } catch (error) {
          logger.warn(`Failed to add FITS layer: ${layer.name}`, error);
          updateFitsLayer(layer.id, { enabled: false });
          continue;
        }
      }

      try {
        survey.setOpacity(layer.opacity);
      } catch {
        survey.setAlpha?.(layer.opacity);
      }
    }

    for (const [id, handle] of active) {
      if (fitsLayers.some((layer) => layer.id === id && layer.enabled)) continue;
      if (handle.mode === 'overlay') {
        try { removeImageLayerCompat(aladin, id); } catch { /* ignore */ }
      }
      active.delete(id);
    }
  }, [aladinRef, engineReady, fitsLayers, restoreBaseSurvey, skyEngine, staticApiReady, updateFitsLayer]);

  useEffect(() => {
    const fitsInstances = fitsInstancesRef.current;
    const aladin = aladinRef.current;
    return () => {
      if (!aladin) return;

      for (const [id, handle] of fitsInstances) {
        if (handle.mode === 'overlay') {
          try { removeImageLayerCompat(aladin, id); } catch { /* ignore */ }
        }
      }
      fitsInstances.clear();
    };
  }, [aladinRef]);

  const setFitsOpacity = useCallback((id: string, opacity: number) => {
    updateFitsLayer(id, { opacity });
  }, [updateFitsLayer]);

  const setFitsMode = useCallback((id: string, mode: AladinFitsMode) => {
    updateFitsLayer(id, { mode });
  }, [updateFitsLayer]);

  return {
    fitsLayers,
    addFitsLayer,
    removeFitsLayer,
    toggleFitsLayer,
    setFitsOpacity,
    setFitsMode,
  };
}
