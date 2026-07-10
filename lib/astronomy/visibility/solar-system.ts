/**
 * Visibility calculation for major solar-system bodies (Sun, Moon, planets).
 *
 * The fixed-target calculator in ./target.ts assumes a constant RA/Dec and
 * derives rise/set from the hour angle at a single epoch — wrong for bodies
 * that move (the Moon's rise time shifts ~50 minutes/day). This variant uses
 * astronomy-engine's per-body searches, which propagate the body's motion.
 */

import { Equator, Horizon, Observer, SearchAltitude, SearchHourAngle, SearchRiseSet } from 'astronomy-engine';
import { bodyFromName } from '../engine/backend-fallback';
import { intersectDarkWindow } from './target';
import type { EngineBody } from '../engine/types';
import type { TargetVisibility } from '@/lib/core/types/astronomy';

/**
 * Calculate complete visibility data for a solar-system body.
 * Mirrors the shape returned by calculateTargetVisibility so panels and the
 * feasibility scorer consume both interchangeably.
 */
export function calculateSolarSystemVisibility(
  engineBody: EngineBody,
  latitude: number,
  longitude: number,
  minAltitude: number = 30,
  date: Date = new Date(),
): TargetVisibility {
  const observer = new Observer(latitude, longitude, 0);
  const body = bodyFromName(engineBody);

  const eqOfDate = Equator(body, date, observer, /* ofdate */ true, /* aberration */ true);
  const horizon = Horizon(date, observer, eqOfDate.ra, eqOfDate.dec, 'normal');
  const currentAltitude = horizon.altitude;
  const isCurrentlyVisible = currentAltitude > 0;

  const rise = SearchRiseSet(body, observer, +1, date, 2);
  const set = SearchRiseSet(body, observer, -1, date, 2);
  const riseTime = rise ? new Date(rise.date) : null;
  const setTime = set ? new Date(set.date) : null;

  const transit = SearchHourAngle(body, observer, 0, date, +1);
  const transitTime = new Date(transit.time.date);
  const transitAltitude = transit.hor.altitude;

  const isCircumpolar = !riseTime && !setTime && currentAltitude >= 0;
  const neverRises = !riseTime && !setTime && currentAltitude < 0;

  // Imaging window: the span the body stays above minAltitude. If it is
  // already above the threshold the window starts now; otherwise it starts at
  // the next upward crossing.
  let imagingWindowStart: Date | null = null;
  let imagingWindowEnd: Date | null = null;

  const aboveThresholdNow = currentAltitude >= minAltitude;
  if (aboveThresholdNow) {
    imagingWindowStart = date;
  } else {
    const ascent = SearchAltitude(body, observer, +1, date, 2, minAltitude);
    imagingWindowStart = ascent ? new Date(ascent.date) : null;
  }
  if (imagingWindowStart) {
    const descent = SearchAltitude(body, observer, -1, imagingWindowStart, 2, minAltitude);
    imagingWindowEnd = descent ? new Date(descent.date) : null;
    if (!imagingWindowEnd && isCircumpolar) {
      // Always above the threshold (high-latitude edge case): use a 24h window
      // centered on the calculation date so dark-window intersection works.
      imagingWindowStart = new Date(date.getTime() - 12 * 3600000);
      imagingWindowEnd = new Date(date.getTime() + 12 * 3600000);
    }
  }

  const imagingHours = imagingWindowStart && imagingWindowEnd
    ? (imagingWindowEnd.getTime() - imagingWindowStart.getTime()) / 3600000
    : 0;

  const { darkImagingStart, darkImagingEnd, darkImagingHours } = intersectDarkWindow(
    imagingWindowStart,
    imagingWindowEnd,
    latitude,
    longitude,
    date,
  );

  return {
    riseTime,
    setTime,
    transitTime,
    transitAltitude,
    isCurrentlyVisible,
    isCircumpolar,
    neverRises,
    imagingWindowStart,
    imagingWindowEnd,
    imagingHours,
    darkImagingStart,
    darkImagingEnd,
    darkImagingHours,
  };
}
