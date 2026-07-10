import {
  Body,
  DefineStar,
  Ecliptic,
  Elongation,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  NextMoonQuarter,
  Observer,
  RotateVector,
  Rotation_EQJ_GAL,
  SearchHourAngle,
  SearchMaxElongation,
  SearchMoonQuarter,
  SearchRelativeLongitude,
  SearchRiseSet,
  SiderealTime,
  SphereFromVector,
  Spherical,
  VectorFromSphere,
} from 'astronomy-engine';
import { calculateTwilightTimes } from '@/lib/astronomy/twilight/calculator';
import { angularSeparation } from '@/lib/astronomy/celestial/separation';
import type {
  AlmanacRequest,
  AlmanacResponse,
  AstronomyEngineBackend,
  CoordinateComputationInput,
  CoordinateComputationResult,
  EngineBody,
  EphemerisPoint,
  EphemerisRequest,
  EphemerisResponse,
  PhenomenaEvent,
  PhenomenaRequest,
  PhenomenaResponse,
  RiseTransitSetRequest,
  RiseTransitSetResponse,
} from './types';
import { createCalculationMeta } from './meta';

const STAR_DISTANCE_LIGHTYEARS = 1000;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function normalizeSignedDegrees(value: number): number {
  let normalized = normalizeDegrees(value);
  if (normalized > 180) normalized -= 360;
  return normalized;
}

export function bodyFromName(body: EngineBody): Body {
  switch (body) {
    case 'Sun':
      return Body.Sun;
    case 'Moon':
      return Body.Moon;
    case 'Mercury':
      return Body.Mercury;
    case 'Venus':
      return Body.Venus;
    case 'Mars':
      return Body.Mars;
    case 'Jupiter':
      return Body.Jupiter;
    case 'Saturn':
      return Body.Saturn;
    case 'Uranus':
      return Body.Uranus;
    case 'Neptune':
      return Body.Neptune;
    case 'Pluto':
      return Body.Pluto;
    case 'Custom':
      return Body.Star1;
    default:
      return Body.Sun;
  }
}

function toObserver(observer: { latitude: number; longitude: number; elevation?: number }): Observer {
  return new Observer(observer.latitude, observer.longitude, observer.elevation ?? 0);
}

function toDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

function moonQuarterLabel(quarter: number): string {
  switch (quarter % 4) {
    case 0:
      return 'New Moon';
    case 1:
      return 'First Quarter';
    case 2:
      return 'Full Moon';
    case 3:
      return 'Last Quarter';
    default:
      return 'Moon Quarter';
  }
}

function customOrBodyEquatorial(
  body: EngineBody,
  date: Date,
  observer: Observer,
  custom?: { ra: number; dec: number }
): { ra: number; dec: number; distanceAu?: number } {
  if (body === 'Custom') {
    if (!custom) throw new Error('Custom coordinate is required for custom body');
    return { ra: normalizeDegrees(custom.ra), dec: custom.dec };
  }

  const result = Equator(bodyFromName(body), date, observer, true, true);
  return {
    ra: normalizeDegrees(result.ra * 15),
    dec: result.dec,
    distanceAu: result.dist,
  };
}

function computeCoordinateInternal(input: CoordinateComputationInput): CoordinateComputationResult {
  const observer = toObserver(input.observer);
  const refraction = input.refraction === 'none' ? undefined : 'normal';
  const ra = normalizeDegrees(input.coordinate.ra);
  const dec = input.coordinate.dec;
  const raHours = ra / 15;

  const horizontal = Horizon(input.date, observer, raHours, dec, refraction);
  const eqjVector = VectorFromSphere(new Spherical(dec, ra, 1), input.date);
  const galVector = RotateVector(Rotation_EQJ_GAL(), eqjVector);
  const galSphere = SphereFromVector(galVector);
  const ecl = Ecliptic(eqjVector);

  const gmst = normalizeDegrees(SiderealTime(input.date) * 15);
  const lst = normalizeDegrees(gmst + input.observer.longitude);

  return {
    equatorial: { ra, dec },
    horizontal: {
      altitude: horizontal.altitude,
      azimuth: normalizeDegrees(horizontal.azimuth),
    },
    galactic: {
      l: normalizeDegrees(galSphere.lon),
      b: galSphere.lat,
    },
    ecliptic: {
      longitude: normalizeDegrees(ecl.elon),
      latitude: ecl.elat,
    },
    sidereal: {
      gmst,
      lst,
      hourAngle: normalizeSignedDegrees(lst - ra),
    },
    meta: createCalculationMeta('fallback', 'astronomy-engine-2.1.19'),
  };
}

function computeEphemerisPoints(request: EphemerisRequest): EphemerisPoint[] {
  const observer = toObserver(request.observer);
  const points: EphemerisPoint[] = [];

  for (let index = 0; index < request.steps; index += 1) {
    const date = new Date(request.startDate.getTime() + index * request.stepHours * 3600000);
    const eq = customOrBodyEquatorial(request.body, date, observer, request.customCoordinate);
    const coordinate = computeCoordinateInternal({
      coordinate: { ra: eq.ra, dec: eq.dec },
      date,
      observer: request.observer,
      refraction: request.refraction,
    });

    let magnitude: number | undefined;
    let phaseFraction: number | undefined;
    let distanceAu: number | undefined = eq.distanceAu;
    let elongation: number | undefined;

    if (request.body !== 'Custom') {
      const body = bodyFromName(request.body);
      try {
        const illumination = Illumination(body, date);
        magnitude = Number.isFinite(illumination.mag) ? illumination.mag : undefined;
        phaseFraction = Number.isFinite(illumination.phase_fraction) ? illumination.phase_fraction : undefined;
        distanceAu = Number.isFinite(illumination.geo_dist) ? illumination.geo_dist : distanceAu;
      } catch {
        magnitude = undefined;
      }

      if (request.body !== 'Sun') {
        try {
          elongation = Elongation(body, date).elongation;
        } catch {
          elongation = undefined;
        }
      }
    }

    points.push({
      date,
      ra: coordinate.equatorial.ra,
      dec: coordinate.equatorial.dec,
      altitude: coordinate.horizontal.altitude,
      azimuth: coordinate.horizontal.azimuth,
      galacticL: coordinate.galactic.l,
      galacticB: coordinate.galactic.b,
      eclipticLon: coordinate.ecliptic.longitude,
      eclipticLat: coordinate.ecliptic.latitude,
      magnitude,
      phaseFraction,
      distanceAu,
      elongation,
    });
  }

  return points;
}

function computeRiseTransitSetInternal(request: RiseTransitSetRequest): RiseTransitSetResponse {
  const observer = toObserver(request.observer);
  const date = request.date;

  const eq = customOrBodyEquatorial(request.body, date, observer, request.customCoordinate);
  const coordinate = computeCoordinateInternal({
    coordinate: { ra: eq.ra, dec: eq.dec },
    observer: request.observer,
    date,
    refraction: 'normal',
  });

  let body = bodyFromName(request.body);
  if (request.body === 'Custom' && request.customCoordinate) {
    DefineStar(
      Body.Star1,
      normalizeDegrees(request.customCoordinate.ra) / 15,
      request.customCoordinate.dec,
      STAR_DISTANCE_LIGHTYEARS
    );
    body = Body.Star1;
  }

  const rise = SearchRiseSet(body, observer, +1, date, 2);
  const set = SearchRiseSet(body, observer, -1, date, 2);
  const transit = SearchHourAngle(body, observer, 0, date, +1);

  const riseTime = toDate(rise?.date ?? null);
  const setTime = toDate(set?.date ?? null);
  const transitTime = toDate(transit.time.date);
  const transitAltitude = transit.hor.altitude;

  const isCircumpolar = !riseTime && !setTime && coordinate.horizontal.altitude >= 0;
  const neverRises = !riseTime && !setTime && coordinate.horizontal.altitude < 0;

  const twilight = calculateTwilightTimes(request.observer.latitude, request.observer.longitude, date);
  const minAltitude = request.minAltitude ?? 0;
  let darkImagingStart: Date | null = null;
  let darkImagingEnd: Date | null = null;
  let darkImagingHours = 0;

  if (twilight.astronomicalDusk && twilight.astronomicalDawn) {
    const ephemeris = computeEphemerisPoints({
      body: request.body,
      observer: request.observer,
      startDate: twilight.astronomicalDusk,
      stepHours: 0.25,
      steps: 60,
      customCoordinate: request.customCoordinate,
      refraction: 'none',
    });

    const visible = ephemeris.filter((point) => point.altitude >= minAltitude);
    if (visible.length > 0) {
      darkImagingStart = visible[0].date;
      darkImagingEnd = visible[visible.length - 1].date;
      darkImagingHours = Math.max(
        0,
        (darkImagingEnd.getTime() - darkImagingStart.getTime()) / 3600000
      );
    }
  }

  return {
    riseTime,
    transitTime,
    setTime,
    transitAltitude,
    currentAltitude: coordinate.horizontal.altitude,
    currentAzimuth: coordinate.horizontal.azimuth,
    isCircumpolar,
    neverRises,
    darkImagingStart,
    darkImagingEnd,
    darkImagingHours,
    meta: createCalculationMeta('fallback', 'astronomy-engine-2.1.19'),
  };
}

function buildPhenomenaEvents(request: PhenomenaRequest): PhenomenaEvent[] {
  const events: PhenomenaEvent[] = [];
  const start = request.startDate;
  const end = request.endDate;

  let moonQuarter = SearchMoonQuarter(start);
  while (moonQuarter.time.date <= end) {
    events.push({
      date: new Date(moonQuarter.time.date),
      type: 'moon_phase',
      object1: 'Moon',
      details: moonQuarterLabel(moonQuarter.quarter),
      importance: moonQuarter.quarter % 2 === 0 ? 'high' : 'medium',
      source: 'computed',
    });
    moonQuarter = NextMoonQuarter(moonQuarter);
  }

  const planets: EngineBody[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
  for (const planet of planets) {
    const body = bodyFromName(planet);
    let cursor = new Date(start);
    for (let guard = 0; guard < 64; guard += 1) {
      const oppositionLike = SearchRelativeLongitude(body, 0, cursor);
      if (!oppositionLike || oppositionLike.date > end) break;
      const type = (planet === 'Mercury' || planet === 'Venus') ? 'conjunction' : 'opposition';
      events.push({
        date: new Date(oppositionLike.date),
        type,
        object1: planet,
        details: type === 'opposition' ? `${planet} opposition` : `${planet} inferior conjunction`,
        importance: 'high',
        source: 'computed',
      });
      cursor = new Date(oppositionLike.date.getTime() + 2 * 86400000);
    }
  }

  for (const inner of ['Mercury', 'Venus'] as EngineBody[]) {
    const body = bodyFromName(inner);
    let cursor = new Date(start);
    for (let guard = 0; guard < 24; guard += 1) {
      try {
        const elongationEvent = SearchMaxElongation(body, cursor);
        if (!elongationEvent || elongationEvent.time.date > end) break;
        events.push({
          date: new Date(elongationEvent.time.date),
          type: 'elongation',
          object1: inner,
          separation: elongationEvent.elongation,
          details: `${inner} max elongation (${elongationEvent.visibility})`,
          importance: 'high',
          source: 'computed',
        });
        cursor = new Date(elongationEvent.time.date.getTime() + 7 * 86400000);
      } catch {
        break;
      }
    }
  }

  if (request.includeMinor) {
    const observer = toObserver(request.observer);
    const closenessTargets: EngineBody[] = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
    for (
      let cursor = new Date(start.getTime());
      cursor <= end;
      cursor = new Date(cursor.getTime() + 86400000)
    ) {
      const moonEq = customOrBodyEquatorial('Moon', cursor, observer);
      for (const target of closenessTargets) {
        const eq = customOrBodyEquatorial(target, cursor, observer);
        const separation = angularSeparation(moonEq.ra, moonEq.dec, eq.ra, eq.dec);
        if (separation <= 4) {
          events.push({
            date: new Date(cursor),
            type: 'close_approach',
            object1: 'Moon',
            object2: target,
            separation,
            details: `Moon close approach to ${target}`,
            importance: separation <= 2 ? 'high' : 'medium',
            source: 'computed',
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function computeAlmanacInternal(request: AlmanacRequest): AlmanacResponse {
  const observer = toObserver(request.observer);
  const date = request.date;
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  const twilight = calculateTwilightTimes(request.observer.latitude, request.observer.longitude, date);
  const sunEq = customOrBodyEquatorial('Sun', date, observer);
  const moonEq = customOrBodyEquatorial('Moon', date, observer);
  const sunCoordinates = computeCoordinateInternal({
    coordinate: { ra: sunEq.ra, dec: sunEq.dec },
    observer: request.observer,
    date,
    refraction: request.refraction,
  });
  const moonCoordinates = computeCoordinateInternal({
    coordinate: { ra: moonEq.ra, dec: moonEq.dec },
    observer: request.observer,
    date,
    refraction: request.refraction,
  });

  const moonPhaseDegrees = normalizeDegrees(MoonPhase(date));
  const moonIllumination = Illumination(Body.Moon, date).phase_fraction * 100;
  const moonRise = SearchRiseSet(Body.Moon, observer, +1, midnight, 2);
  const moonSet = SearchRiseSet(Body.Moon, observer, -1, midnight, 2);

  return {
    twilight,
    sun: {
      ra: sunCoordinates.equatorial.ra,
      dec: sunCoordinates.equatorial.dec,
      altitude: sunCoordinates.horizontal.altitude,
      azimuth: sunCoordinates.horizontal.azimuth,
    },
    moon: {
      ra: moonCoordinates.equatorial.ra,
      dec: moonCoordinates.equatorial.dec,
      altitude: moonCoordinates.horizontal.altitude,
      azimuth: moonCoordinates.horizontal.azimuth,
      phase: moonPhaseDegrees / 360,
      illumination: moonIllumination,
      riseTime: toDate(moonRise?.date ?? null),
      setTime: toDate(moonSet?.date ?? null),
    },
    meta: createCalculationMeta('fallback', 'astronomy-engine-2.1.19'),
  };
}

export const fallbackAstronomyBackend: AstronomyEngineBackend = {
  async computeCoordinates(input: CoordinateComputationInput): Promise<CoordinateComputationResult> {
    return computeCoordinateInternal(input);
  },

  async computeEphemeris(request: EphemerisRequest): Promise<EphemerisResponse> {
    return {
      body: request.body,
      points: computeEphemerisPoints(request),
      meta: createCalculationMeta('fallback', 'astronomy-engine-2.1.19'),
    };
  },

  async computeRiseTransitSet(request: RiseTransitSetRequest): Promise<RiseTransitSetResponse> {
    return computeRiseTransitSetInternal(request);
  },

  async searchPhenomena(request: PhenomenaRequest): Promise<PhenomenaResponse> {
    return {
      events: buildPhenomenaEvents(request),
      meta: createCalculationMeta('fallback', 'astronomy-engine-2.1.19'),
    };
  },

  async computeAlmanac(request: AlmanacRequest): Promise<AlmanacResponse> {
    return computeAlmanacInternal(request);
  },
};
