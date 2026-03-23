export type AstroCalculatorTabId =
  | 'wut'
  | 'positions'
  | 'rts'
  | 'ephemeris'
  | 'almanac'
  | 'phenomena'
  | 'coordinate'
  | 'time'
  | 'solar-system';

export type AstroCalculatorOperation =
  | 'calculateTwilightTimes'
  | 'calculateTargetVisibility'
  | 'calculateImagingFeasibility'
  | 'computeCoordinates'
  | 'computeEphemeris'
  | 'computeRiseTransitSet'
  | 'computeAlmanac'
  | 'searchPhenomena'
  | 'raDecToAltAzAtTime'
  | 'raDecToGalactic'
  | 'raDecToEcliptic'
  | 'dateToJulianDate'
  | 'getGMSTForDate'
  | 'getLSTForDate'
  | 'getHourAngleAtTime';

export interface AstroCalculatorCapability {
  tabId: AstroCalculatorTabId;
  labelKey: string;
  operations: AstroCalculatorOperation[];
  actions: string[];
}

export const ASTRO_CALCULATOR_TAB_ORDER: AstroCalculatorTabId[] = [
  'wut',
  'positions',
  'rts',
  'ephemeris',
  'almanac',
  'phenomena',
  'coordinate',
  'time',
  'solar-system',
];

export const ASTRO_CALCULATOR_CAPABILITY_MATRIX: Record<AstroCalculatorTabId, AstroCalculatorCapability> = {
  wut: {
    tabId: 'wut',
    labelKey: 'astroCalc.wut',
    operations: ['calculateTwilightTimes', 'calculateTargetVisibility', 'calculateImagingFeasibility'],
    actions: ['selectObject', 'addToTargetList', 'filterCandidates'],
  },
  positions: {
    tabId: 'positions',
    labelKey: 'astroCalc.positions',
    operations: ['computeEphemeris', 'calculateTargetVisibility', 'raDecToAltAzAtTime', 'raDecToGalactic', 'raDecToEcliptic'],
    actions: ['searchCatalog', 'toggleCoordinateColumns', 'addToTargetList'],
  },
  rts: {
    tabId: 'rts',
    labelKey: 'astroCalc.rts',
    operations: ['computeRiseTransitSet'],
    actions: ['selectTargetMode', 'configureDateRange', 'inspectAltitudeWindow'],
  },
  ephemeris: {
    tabId: 'ephemeris',
    labelKey: 'astroCalc.ephemeris',
    operations: ['computeEphemeris'],
    actions: ['configureStepRange', 'switchCoordinateOutput'],
  },
  almanac: {
    tabId: 'almanac',
    labelKey: 'astroCalc.almanac',
    operations: ['computeAlmanac', 'computeRiseTransitSet'],
    actions: ['inspectSunMoonSummary', 'inspectTwilightTimeline'],
  },
  phenomena: {
    tabId: 'phenomena',
    labelKey: 'astroCalc.phenomena',
    operations: ['searchPhenomena'],
    actions: ['setDateWindow', 'toggleMinorEvents'],
  },
  coordinate: {
    tabId: 'coordinate',
    labelKey: 'astroCalc.coordinate',
    operations: ['computeCoordinates'],
    actions: ['convertCoordinateSystems', 'inspectRoundTripError'],
  },
  time: {
    tabId: 'time',
    labelKey: 'astroCalc.timeCalc',
    operations: ['dateToJulianDate', 'getGMSTForDate', 'getLSTForDate', 'getHourAngleAtTime'],
    actions: ['switchTimeInputMode', 'inspectTimeScaleOutput'],
  },
  'solar-system': {
    tabId: 'solar-system',
    labelKey: 'astroCalc.solarSystem',
    operations: ['computeEphemeris', 'computeRiseTransitSet'],
    actions: ['togglePluto', 'comparePlanetaryStatus'],
  },
};
