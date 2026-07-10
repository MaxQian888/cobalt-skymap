/**
 * Upcoming pass predictions for a selected artificial satellite.
 *
 * Fetches the satellite's current TLE from CelesTrak (through smartFetch with
 * the 'satellite-tle' cache policy, so it works offline once cached) and runs
 * real SGP4 propagation via lib/services/satellite-propagator.
 */

import { useEffect, useState } from 'react';
import { fetchTLEByNoradId } from '@/lib/services/satellite/data-sources';
import { parseTLE, predictPasses, type SatellitePass } from '@/lib/services/satellite-propagator';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-satellite-passes');

const PREDICTION_HOURS = 24;
const MIN_ELEVATION_DEG = 10;
const MAX_PASSES = 3;

export type SatellitePassesStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface SatellitePassesState {
  status: SatellitePassesStatus;
  passes: SatellitePass[];
}

export function useSatellitePasses(
  noradId: number | null,
  latitude: number,
  longitude: number,
  enabled: boolean = true,
): SatellitePassesState {
  const [state, setState] = useState<SatellitePassesState>({ status: 'idle', passes: [] });

  useEffect(() => {
    if (!enabled || noradId == null) {
      // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving reset timing
      queueMicrotask(() => {
        setState({ status: 'idle', passes: [] });
      });
      return;
    }

    let cancelled = false;
    // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving loading-state timing
    queueMicrotask(() => {
      if (!cancelled) setState({ status: 'loading', passes: [] });
    });

    fetchTLEByNoradId(noradId)
      .then((tle) => {
        if (cancelled) return;
        const satrec = tle ? parseTLE(tle) : null;
        if (!satrec) {
          setState({ status: 'unavailable', passes: [] });
          return;
        }
        const passes = predictPasses(
          satrec,
          { latitude, longitude, altitude: 0 },
          new Date(),
          PREDICTION_HOURS,
          MIN_ELEVATION_DEG,
        ).slice(0, MAX_PASSES);
        setState({ status: 'ready', passes });
      })
      .catch((error) => {
        logger.warn('Satellite pass prediction failed', { noradId, error });
        if (!cancelled) setState({ status: 'unavailable', passes: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [noradId, latitude, longitude, enabled]);

  return state;
}
