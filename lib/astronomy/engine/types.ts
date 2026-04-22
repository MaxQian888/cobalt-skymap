import type { TwilightTimes } from '@/lib/core/types/astronomy';

export type EngineBody =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'
  | 'Custom';

export type RefractionMode = 'none' | 'normal';

export type EngineBackend = 'tauri' | 'fallback';
export type CalculationCacheState = 'hit' | 'miss';

export interface ObserverLocation {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export interface EquatorialCoordinate {
  ra: number;
  dec: number;
}

export interface HorizontalCoordinate {
  altitude: number;
  azimuth: number;
}

export interface GalacticCoordinate {
  l: number;
  b: number;
}

export interface EclipticCoordinate {
  longitude: number;
  latitude: number;
}

export interface CoordinateComputationInput {
  coordinate: EquatorialCoordinate;
  observer: ObserverLocation;
  date: Date;
  refraction?: RefractionMode;
  contextKey?: string;
}

export interface CoordinateComputationResult {
  equatorial: EquatorialCoordinate;
  horizontal: HorizontalCoordinate;
  galactic: GalacticCoordinate;
  ecliptic: EclipticCoordinate;
  sidereal: {
    gmst: number;
    lst: number;
    hourAngle: number;
  };
  meta: CalculationMeta;
}

export interface EphemerisPoint {
  date: Date;
  ra: number;
  dec: number;
  altitude: number;
  azimuth: number;
  galacticL: number;
  galacticB: number;
  eclipticLon: number;
  eclipticLat: number;
  magnitude?: number;
  phaseFraction?: number;
  distanceAu?: number;
  elongation?: number;
}

export interface EphemerisRequest {
  body: EngineBody;
  observer: ObserverLocation;
  startDate: Date;
  stepHours: number;
  steps: number;
  refraction?: RefractionMode;
  customCoordinate?: EquatorialCoordinate;
  contextKey?: string;
}

export interface EphemerisResponse {
  body: EngineBody;
  points: EphemerisPoint[];
  meta: CalculationMeta;
}

export interface RiseTransitSetRequest {
  body: EngineBody;
  observer: ObserverLocation;
  date: Date;
  minAltitude?: number;
  customCoordinate?: EquatorialCoordinate;
  contextKey?: string;
}

export interface RiseTransitSetResponse {
  riseTime: Date | null;
  transitTime: Date | null;
  setTime: Date | null;
  transitAltitude: number;
  currentAltitude: number;
  currentAzimuth: number;
  isCircumpolar: boolean;
  neverRises: boolean;
  darkImagingStart: Date | null;
  darkImagingEnd: Date | null;
  darkImagingHours: number;
  meta: CalculationMeta;
}

export type PhenomenaType = 'conjunction' | 'opposition' | 'elongation' | 'moon_phase' | 'close_approach';
export type PhenomenaImportance = 'high' | 'medium' | 'low';

export interface PhenomenaEvent {
  date: Date;
  type: PhenomenaType;
  object1: string;
  object2?: string;
  separation?: number;
  details: string;
  importance: PhenomenaImportance;
  source: 'computed' | 'tauri-events';
}

export interface PhenomenaRequest {
  startDate: Date;
  endDate: Date;
  observer: ObserverLocation;
  includeMinor?: boolean;
  contextKey?: string;
}

export interface PhenomenaResponse {
  events: PhenomenaEvent[];
  meta: CalculationMeta;
}

export interface AlmanacRequest {
  date: Date;
  observer: ObserverLocation;
  refraction?: RefractionMode;
  contextKey?: string;
}

export interface AlmanacResponse {
  twilight: TwilightTimes;
  sun: {
    ra: number;
    dec: number;
    altitude: number;
    azimuth: number;
  };
  moon: {
    ra: number;
    dec: number;
    altitude: number;
    azimuth: number;
    phase: number;
    illumination: number;
    riseTime: Date | null;
    setTime: Date | null;
  };
  meta: CalculationMeta;
}

export interface CalculationMeta {
  backend: EngineBackend;
  model: string;
  source: EngineBackend;
  degraded: boolean;
  computedAt: string;
  cache: CalculationCacheState;
  warnings?: string[];
}

export interface NormalizedObserverLocation {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface NormalizedEquatorialCoordinate {
  ra: number;
  dec: number;
}

export interface NormalizedCoordinateComputationInput extends Omit<CoordinateComputationInput, 'coordinate' | 'observer' | 'date'> {
  coordinate: NormalizedEquatorialCoordinate;
  observer: NormalizedObserverLocation;
  date: Date;
}

export interface NormalizedEphemerisRequest extends Omit<EphemerisRequest, 'observer' | 'startDate' | 'customCoordinate'> {
  observer: NormalizedObserverLocation;
  startDate: Date;
  customCoordinate?: NormalizedEquatorialCoordinate;
}

export interface NormalizedRiseTransitSetRequest extends Omit<RiseTransitSetRequest, 'observer' | 'date' | 'customCoordinate'> {
  observer: NormalizedObserverLocation;
  date: Date;
  customCoordinate?: NormalizedEquatorialCoordinate;
}

export interface NormalizedPhenomenaRequest extends Omit<PhenomenaRequest, 'observer' | 'startDate' | 'endDate'> {
  observer: NormalizedObserverLocation;
  startDate: Date;
  endDate: Date;
}

export interface NormalizedAlmanacRequest extends Omit<AlmanacRequest, 'observer' | 'date'> {
  observer: NormalizedObserverLocation;
  date: Date;
}

export type CalculationValidationErrorCode =
  | 'invalid_date'
  | 'invalid_latitude'
  | 'invalid_longitude'
  | 'invalid_elevation'
  | 'invalid_ra'
  | 'invalid_dec'
  | 'invalid_steps'
  | 'invalid_step_hours'
  | 'invalid_date_range'
  | 'invalid_min_altitude';

export interface CalculationValidationIssue {
  code: CalculationValidationErrorCode;
  field: string;
  message: string;
}

export interface NormalizedCalculationContext {
  observerKey: string;
  timeWindowKey: string;
  requestKey: string;
}

export interface AstronomyEngineBackend {
  computeCoordinates(input: CoordinateComputationInput): Promise<CoordinateComputationResult>;
  computeEphemeris(request: EphemerisRequest): Promise<EphemerisResponse>;
  computeRiseTransitSet(request: RiseTransitSetRequest): Promise<RiseTransitSetResponse>;
  searchPhenomena(request: PhenomenaRequest): Promise<PhenomenaResponse>;
  computeAlmanac(request: AlmanacRequest): Promise<AlmanacResponse>;
}
