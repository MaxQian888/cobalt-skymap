'use client';

import { useCallback, RefObject } from 'react';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import { createLogger } from '@/lib/logger';
import { screenToRaDec } from '@/lib/core/screen-to-radec';
import { dateToJulianDate } from '@/lib/astronomy/time/julian';
import type { StellariumEngine } from '@/lib/core/types';
import type { ClickCoordinates } from '@/types/stellarium-canvas';

const logger = createLogger('use-click-coordinates');

/** Hook for calculating celestial coordinates from click position across all Stellarium projections. */
export function useClickCoordinates(
  stelRef: RefObject<StellariumEngine | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const getClickCoordinates = useCallback((clientX: number, clientY: number): ClickCoordinates | null => {
    if (!stelRef.current || !canvasRef.current) return null;

    const stel = stelRef.current;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    try {
      // Delegate the unprojection math to the shared pure function.
      const coords = screenToRaDec(
        stel,
        clientX - rect.left,
        clientY - rect.top,
        rect.width,
        rect.height,
      );
      if (!coords) return null;

      const epochJd = dateToJulianDate(new Date());

      return {
        ra: coords.ra,
        dec: coords.dec,
        raStr: degreesToHMS(coords.ra),
        decStr: degreesToDMS(coords.dec),
        frame: 'ICRF',
        timeScale: 'UTC',
        qualityFlag: 'precise',
        dataFreshness: 'fallback',
        source: 'engine',
        epochJd,
      };
    } catch (error) {
      logger.error('Error calculating click coordinates', error);
      return null;
    }
  }, [stelRef, canvasRef]);

  return { getClickCoordinates };
}
