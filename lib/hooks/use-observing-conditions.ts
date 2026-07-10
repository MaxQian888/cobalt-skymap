/**
 * Hook for calculating current astronomical observing conditions
 * Extracted from quick-actions-panel for reuse
 */

import { useState, useEffect, useMemo } from 'react';
import {
  getMoonPhase,
  getMoonPhaseName,
  getMoonIllumination,
  getSunPosition,
  calculateTwilightTimes,
} from '@/lib/astronomy/astro-utils';
import { raDecToAltAz } from '@/lib/astronomy/starmap-utils';
import type { ObservingConditions } from '@/types/starmap/controls';

export interface UseObservingConditionsOptions {
  /** Whether to enable periodic refresh (default: true) */
  enabled?: boolean;
  /** Refresh interval in milliseconds (default: 60000 = 1 minute) */
  refreshInterval?: number;
}

/**
 * Calculate current observing conditions based on observer location
 *
 * @param latitude - Observer latitude in degrees
 * @param longitude - Observer longitude in degrees
 * @param options - Configuration options
 * @returns Current observing conditions
 */
export function useObservingConditions(
  latitude: number,
  longitude: number,
  options: UseObservingConditionsOptions = {},
): ObservingConditions {
  const { enabled = true, refreshInterval = 60000 } = options;

  // Refresh trigger for periodic updates
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    // Initial calculation already happens on first render via useMemo below;
    // this interval only triggers periodic recalculation.
    const interval = setInterval(() => {
      setRefreshTick((prev) => prev + 1);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [enabled, refreshInterval]);

  const conditions = useMemo<ObservingConditions>(() => {
    const moonPhase = getMoonPhase();
    const moonPhaseName = getMoonPhaseName(moonPhase);
    const moonIllumination = getMoonIllumination(moonPhase);
    const sunPos = getSunPosition();
    const sunAltAz = raDecToAltAz(sunPos.ra, sunPos.dec, latitude, longitude);
    const twilight = calculateTwilightTimes(latitude, longitude, new Date());

    const isDark = sunAltAz.altitude < -18;
    const isTwilight = sunAltAz.altitude >= -18 && sunAltAz.altitude < 0;
    const isDay = sunAltAz.altitude >= 0;

    return {
      moonPhaseName,
      moonIllumination: Math.round(moonIllumination),
      sunAltitude: sunAltAz.altitude,
      isDark,
      isTwilight,
      isDay,
      twilight: {
        civilDusk: twilight.civilDusk ?? undefined,
        nauticalDusk: twilight.nauticalDusk ?? undefined,
        astronomicalDusk: twilight.astronomicalDusk ?? undefined,
        civilDawn: twilight.civilDawn ?? undefined,
        nauticalDawn: twilight.nauticalDawn ?? undefined,
        astronomicalDawn: twilight.astronomicalDawn ?? undefined,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, refreshTick]);

  return conditions;
}
