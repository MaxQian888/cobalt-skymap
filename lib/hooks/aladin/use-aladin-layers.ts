'use client';

import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import type A from 'aladin-lite';
import { getSurveyById } from '@/lib/core/constants/sky-surveys';
import { removeImageLayerCompat } from '@/lib/aladin/aladin-compat';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { useAladinStore, type AladinImageOverlayLayer } from '@/lib/stores/aladin-store';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;
type HpxImageSurvey = ReturnType<typeof A.imageHiPS>;

const logger = createLogger('aladin-layers');

function setSurveyOpacity(survey: HpxImageSurvey, opacity: number): void {
  if (typeof survey.setOpacity === 'function') {
    survey.setOpacity(opacity);
    return;
  }
  survey.setAlpha?.(opacity);
}

export type OverlayLayer = AladinImageOverlayLayer;

interface UseAladinLayersOptions {
  aladinRef: RefObject<AladinInstance | null>;
  engineReady: boolean;
}

interface UseAladinLayersReturn {
  overlayLayers: OverlayLayer[];
  addOverlayLayer: (surveyId: string, name: string) => void;
  removeOverlayLayer: (layerId: string) => void;
  setOverlayOpacity: (layerId: string, opacity: number) => void;
  setOverlayBlending: (layerId: string, additive: boolean) => void;
}

export function useAladinLayers({
  aladinRef,
  engineReady,
}: UseAladinLayersOptions): UseAladinLayersReturn {
  const skyEngine = useSettingsStore((state) => state.skyEngine);

  const overlayLayers = useAladinStore((state) => state.imageOverlayLayers);
  const addImageOverlayLayer = useAladinStore((state) => state.addImageOverlayLayer);
  const updateImageOverlayLayer = useAladinStore((state) => state.updateImageOverlayLayer);
  const removeImageOverlayLayer = useAladinStore((state) => state.removeImageOverlayLayer);

  const surveyInstancesRef = useRef<Map<string, HpxImageSurvey>>(new Map());
  const aladinStaticRef = useRef<typeof A | null>(null);
  const [staticApiReady, setStaticApiReady] = useState(false);

  useEffect(() => {
    if (!engineReady || skyEngine !== 'aladin') return;
    import('aladin-lite').then((m) => {
      aladinStaticRef.current = m.default;
      setStaticApiReady(true);
    }).catch((err) => {
      logger.warn('Failed to load aladin-lite static API for layers', err);
    });
  }, [engineReady, skyEngine]);

  useEffect(() => {
    const aladin = aladinRef.current;
    const AStatic = aladinStaticRef.current;
    if (!aladin || !AStatic || !engineReady || skyEngine !== 'aladin' || !staticApiReady) return;

    const active = surveyInstancesRef.current;

    for (const layer of overlayLayers) {
      const existing = active.get(layer.id);

      if (!layer.enabled) {
        if (existing) {
          try { removeImageLayerCompat(aladin, layer.id); } catch { /* ignore */ }
          active.delete(layer.id);
        }
        continue;
      }

      const surveySource = layer.surveyUrl ?? layer.surveyId;
      const survey = existing ?? AStatic.imageHiPS(surveySource, { name: layer.name });

      if (!existing) {
        try {
          aladin.setOverlayImageLayer(survey, layer.id);
          active.set(layer.id, survey);
        } catch (error) {
          logger.warn(`Failed to add overlay layer: ${layer.name}`, error);
          updateImageOverlayLayer(layer.id, { enabled: false });
          continue;
        }
      }

      try {
        setSurveyOpacity(survey, layer.opacity);
        survey.setBlendingConfig(layer.additive);
      } catch (error) {
        logger.warn(`Failed to update overlay layer: ${layer.name}`, error);
        updateImageOverlayLayer(layer.id, { enabled: false });
      }
    }

    for (const [layerId] of active) {
      if (overlayLayers.some((layer) => layer.id === layerId && layer.enabled)) continue;
      try { removeImageLayerCompat(aladin, layerId); } catch { /* ignore */ }
      active.delete(layerId);
    }
  }, [aladinRef, engineReady, overlayLayers, skyEngine, staticApiReady, updateImageOverlayLayer]);

  const addOverlayLayer = useCallback((surveyId: string, name: string) => {
    const survey = getSurveyById(surveyId);
    addImageOverlayLayer({
      name,
      surveyId,
      surveyUrl: survey?.url ?? surveyId,
      enabled: true,
      opacity: 0.5,
      additive: false,
    });
  }, [addImageOverlayLayer]);

  const removeOverlayLayer = useCallback((layerId: string) => {
    removeImageOverlayLayer(layerId);
  }, [removeImageOverlayLayer]);

  const setOverlayOpacity = useCallback((layerId: string, opacity: number) => {
    updateImageOverlayLayer(layerId, { opacity });
  }, [updateImageOverlayLayer]);

  const setOverlayBlending = useCallback((layerId: string, additive: boolean) => {
    updateImageOverlayLayer(layerId, { additive });
  }, [updateImageOverlayLayer]);

  useEffect(() => {
    const surveyInstances = surveyInstancesRef.current;
    const aladin = aladinRef.current;
    return () => {
      if (aladin) {
        for (const [layerId] of surveyInstances) {
          try { removeImageLayerCompat(aladin, layerId); } catch { /* ignore */ }
        }
      }
      surveyInstances.clear();
    };
  }, [aladinRef]);

  return {
    overlayLayers,
    addOverlayLayer,
    removeOverlayLayer,
    setOverlayOpacity,
    setOverlayBlending,
  };
}
