'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type A from 'aladin-lite';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { STELLARIUM_TO_ALADIN_PROJECTION } from '@/lib/core/constants/aladin-canvas';
import { getSurveyById } from '@/lib/core/constants/sky-surveys';
import { updateReticleCompat } from '@/lib/aladin/aladin-compat';
import { toHipsCacheBase } from '@/lib/offline/tile-protocol-url';
import { isTauri } from '@/lib/storage/platform';
import { createLogger } from '@/lib/logger';

type AladinInstance = ReturnType<typeof A.aladin>;

const logger = createLogger('aladin-settings-sync');

/**
 * Syncs relevant settings from the settings store to the Aladin Lite instance.
 * Handles both shared settings (projection, survey) and Aladin-specific settings
 * (coordinate grid, reticle, coordinate frame, image adjustments).
 */
export function useAladinSettingsSync(
  aladinRef: RefObject<AladinInstance | null>,
  engineReady: boolean
): void {
  // Shared settings
  const projectionType = useSettingsStore((state) => state.stellarium.projectionType);
  const surveyId = useSettingsStore((state) => state.stellarium.surveyId);
  const surveyEnabled = useSettingsStore((state) => state.stellarium.surveyEnabled);
  const skyEngine = useSettingsStore((state) => state.skyEngine);

  // Aladin-specific display settings
  const aladinDisplay = useSettingsStore((state) => state.aladinDisplay);

  // Track previous values to avoid redundant API calls.
  const prevProjectionRef = useRef<string | null>(null);
  const prevSurveyRef = useRef<string | null>(null);

  // Sync projection type
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;

    const aladinProj = STELLARIUM_TO_ALADIN_PROJECTION[projectionType];
    if (aladinProj && projectionType !== prevProjectionRef.current) {
      try {
        aladin.setProjection(aladinProj);
        logger.debug(`Projection synced: ${projectionType} → ${aladinProj}`);
      } catch (error) {
        logger.warn('Failed to set Aladin projection', error);
      }
      prevProjectionRef.current = projectionType;
    }
  }, [aladinRef, engineReady, skyEngine, projectionType]);

  // Sync HiPS survey
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;
    if (!surveyEnabled) return;

    if (surveyId !== prevSurveyRef.current) {
      try {
        // Resolve the app-local survey ID to a HiPS URL that aladin-lite can load.
        // aladin.newImageSurvey() expects a CDS registry ID or full URL, not our
        // local IDs like 'dss', 'panstarrs', etc.
        const surveyDef = getSurveyById(surveyId);
        if (!surveyDef) {
          logger.warn(`Unknown survey ID: ${surveyId}, skipping`);
          prevSurveyRef.current = surveyId;
          return;
        }
        // On desktop, always route the base survey through the local cache
        // protocol so tiles flow through the Rust offline cache transparently
        // (the offlineTileMode setting only controls whether a cache miss hits
        // the network). On web there is no protocol, so use the CDS URL.
        const surveyUrl = isTauri() ? toHipsCacheBase(surveyDef.id) : surveyDef.url;
        const survey = aladin.newImageSurvey(surveyUrl);
        aladin.setBaseImageLayer(survey);
        logger.debug(`Survey synced: ${surveyId} → ${surveyUrl}`);
      } catch (error) {
        logger.warn('Failed to set Aladin survey', error);
      }
      prevSurveyRef.current = surveyId;
    }
  }, [aladinRef, engineReady, skyEngine, surveyId, surveyEnabled]);

  // Sync coordinate grid
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;

    try {
      if (aladinDisplay.showCooGrid) {
        aladin.setCooGrid({
          enabled: true,
          color: aladinDisplay.cooGridColor,
          opacity: aladinDisplay.cooGridOpacity,
          labelSize: aladinDisplay.cooGridLabelSize,
          showLabels: true,
        });
      } else {
        aladin.setCooGrid({ enabled: false });
      }
      logger.debug(`Coordinate grid synced: ${aladinDisplay.showCooGrid}`);
    } catch (error) {
      logger.warn('Failed to sync coordinate grid', error);
    }
  }, [aladinRef, engineReady, skyEngine, aladinDisplay.showCooGrid, aladinDisplay.cooGridColor, aladinDisplay.cooGridOpacity, aladinDisplay.cooGridLabelSize]);

  // Sync reticle
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;

    try {
      updateReticleCompat(aladin, {
        show: aladinDisplay.showReticle,
        color: aladinDisplay.reticleColor,
        size: aladinDisplay.reticleSize,
      });
      logger.debug(`Reticle synced: ${aladinDisplay.showReticle}`);
    } catch (error) {
      logger.warn('Failed to sync reticle', error);
    }
  }, [aladinRef, engineReady, skyEngine, aladinDisplay.showReticle, aladinDisplay.reticleColor, aladinDisplay.reticleSize]);

  // Sync coordinate frame
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;

    try {
      aladin.setFrame(aladinDisplay.cooFrame);
      logger.debug(`Coordinate frame synced: ${aladinDisplay.cooFrame}`);
    } catch (error) {
      logger.warn('Failed to sync coordinate frame', error);
    }
  }, [aladinRef, engineReady, skyEngine, aladinDisplay.cooFrame]);

  // Sync image adjustments (colormap, brightness, contrast, saturation, gamma)
  useEffect(() => {
    const aladin = aladinRef.current;
    if (!aladin || !engineReady || skyEngine !== 'aladin') return;

    try {
      const baseLayer = aladin.getBaseImageLayer();
      if (!baseLayer) return;

      // Colormap
      if (aladinDisplay.colormap !== 'native') {
        baseLayer.setColormap(aladinDisplay.colormap, {
          reversed: aladinDisplay.colormapReversed,
        });
      }

      // Image adjustments
      baseLayer.setBrightness(aladinDisplay.brightness);
      baseLayer.setContrast(aladinDisplay.contrast);
      baseLayer.setSaturation(aladinDisplay.saturation);
      baseLayer.setGamma(aladinDisplay.gamma);

      logger.debug('Image adjustments synced');
    } catch (error) {
      logger.warn('Failed to sync image adjustments', error);
    }
  }, [aladinRef, engineReady, skyEngine, aladinDisplay.colormap, aladinDisplay.colormapReversed, aladinDisplay.brightness, aladinDisplay.contrast, aladinDisplay.saturation, aladinDisplay.gamma]);
}
