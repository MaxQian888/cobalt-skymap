'use client';

import { useEffect, useRef, RefObject } from 'react';
import { useMountStore } from '@/lib/stores';
import type { StellariumEngine } from '@/lib/core/types';
import {
  migrateLegacyObserverLocation,
  resolveCanonicalObservationLocation,
} from '@/lib/services/observation-location-controller';

/**
 * Hook for syncing observer location from profile to Stellarium engine
 */
export function useObserverSync(stelRef: RefObject<StellariumEngine | null>) {
  const profileInfo = useMountStore((state) => state.profileInfo);
  const setProfileInfo = useMountStore((state) => state.setProfileInfo);
  const bootstrapped = useRef(false);

  // One-time bootstrap: if profileInfo is at default (0,0,0) but web-location-store
  // has a current location, restore it. Handles migration for existing users whose
  // profileInfo was not previously persisted.
  // We wait for Zustand persist rehydration via onRehydrateStorage before checking,
  // so we don't accidentally overwrite a persisted location with web-location-store.
  useEffect(() => {
    if (bootstrapped.current) return;

    const runBootstrap = () => {
      if (bootstrapped.current) return;
      bootstrapped.current = true;

      void (async () => {
        await migrateLegacyObserverLocation();
        const canonicalLocation = await resolveCanonicalObservationLocation();
        if (!canonicalLocation) return;

        const hydrated = useMountStore.getState().profileInfo;
        const { Latitude, Longitude, Elevation } = hydrated.AstrometrySettings;
        if (
          Latitude === canonicalLocation.latitude
          && Longitude === canonicalLocation.longitude
          && Elevation === canonicalLocation.altitude
        ) {
          return;
        }

        setProfileInfo({
          AstrometrySettings: {
            ...hydrated.AstrometrySettings,
            Latitude: canonicalLocation.latitude,
            Longitude: canonicalLocation.longitude,
            Elevation: canonicalLocation.altitude,
          },
        });
      })();
    };

    const persistApi = (
      useMountStore as typeof useMountStore & {
        persist?: {
          onFinishHydration?: (cb: () => void) => (() => void) | void;
          hasHydrated?: () => boolean;
        };
      }
    ).persist;

    // Test mocks may not include persist middleware API.
    if (!persistApi?.onFinishHydration || !persistApi?.hasHydrated) {
      runBootstrap();
      return;
    }

    const unsub = persistApi.onFinishHydration(runBootstrap);
    if (persistApi.hasHydrated()) {
      runBootstrap();
      if (typeof unsub === 'function') {
        unsub();
      }
    }

    return typeof unsub === 'function' ? unsub : undefined;
  }, [setProfileInfo]);

  useEffect(() => {
    if (!stelRef.current) return;
    const stel = stelRef.current;

    try {
      const lat = profileInfo.AstrometrySettings.Latitude || 0;
      const lon = profileInfo.AstrometrySettings.Longitude || 0;
      const elev = profileInfo.AstrometrySettings.Elevation || 0;

      stel.core.observer.latitude = lat * stel.D2R;
      stel.core.observer.longitude = lon * stel.D2R;
      stel.core.observer.elevation = elev;
    } catch (e) {
      void e;
    }
  }, [
    stelRef,
    profileInfo.AstrometrySettings.Latitude,
    profileInfo.AstrometrySettings.Longitude,
    profileInfo.AstrometrySettings.Elevation,
  ]);

  return { profileInfo };
}
