import {
  buildTargetDisplayModel,
  formatAngle,
  getCalculationSourceLabelKey,
  getCalculationStateLabelKey,
  getSelectionFallbackLabelKey,
  getSelectionSourceLabelKey,
  formatMagnitude,
  formatMoonDistance,
  formatTargetTimestamp,
  getCalculationQualityState,
  getAltitudeVisibilityState,
  getMoonInterferenceLevel,
  TARGET_DISPLAY_THRESHOLDS,
} from '../target-display-model';
import type { SelectedObjectData, TargetVisibility, ImagingFeasibility } from '@/lib/core/types';

const mockSelectedObject: SelectedObjectData = {
  names: ['M31', 'Andromeda Galaxy', 'NGC 224'],
  ra: '00h 42m 44s',
  dec: '+41deg 16m 09s',
  raDeg: 10.6847,
  decDeg: 41.2689,
  type: 'Galaxy',
  magnitude: 3.4,
  size: "3.2' x 1.0'",
  constellation: 'Andromeda',
};

const mockVisibility: TargetVisibility = {
  riseTime: new Date('2026-03-09T12:00:00Z'),
  setTime: new Date('2026-03-10T02:00:00Z'),
  transitTime: new Date('2026-03-09T20:00:00Z'),
  transitAltitude: 75.4,
  isCurrentlyVisible: true,
  isCircumpolar: false,
  neverRises: false,
  imagingWindowStart: new Date('2026-03-09T13:00:00Z'),
  imagingWindowEnd: new Date('2026-03-10T01:00:00Z'),
  imagingHours: 8,
  darkImagingStart: new Date('2026-03-09T14:00:00Z'),
  darkImagingEnd: new Date('2026-03-10T00:00:00Z'),
  darkImagingHours: 6,
};

const mockFeasibility: ImagingFeasibility = {
  score: 82,
  moonScore: 90,
  altitudeScore: 80,
  durationScore: 78,
  twilightScore: 86,
  recommendation: 'good',
  warnings: [],
  tips: [],
};

describe('target-display-model', () => {
  describe('format helpers', () => {
    it('formats angle values with degree symbol', () => {
      expect(formatAngle(45.126)).toBe('45.1deg'.replace('deg', '°'));
    });

    it('formats magnitude values with one decimal', () => {
      expect(formatMagnitude(3.444)).toBe('3.4');
      expect(formatMagnitude(undefined)).toBeNull();
    });

    it('formats moon distance with integer precision by default', () => {
      expect(formatMoonDistance(59.6)).toBe('60deg'.replace('deg', '°'));
    });

    it('formats timestamps and handles invalid input', () => {
      expect(formatTargetTimestamp('2026-03-09T20:10:12Z')).not.toBeNull();
      expect(formatTargetTimestamp('bad-input')).toBeNull();
      expect(formatTargetTimestamp(undefined)).toBeNull();
    });
  });

  describe('status thresholds', () => {
    it('categorizes altitude visibility state', () => {
      expect(getAltitudeVisibilityState(-1)).toBe('below_horizon');
      expect(getAltitudeVisibilityState(TARGET_DISPLAY_THRESHOLDS.altitude.observableAboveHorizonDeg + 0.1)).toBe('observable');
      expect(getAltitudeVisibilityState(TARGET_DISPLAY_THRESHOLDS.altitude.optimalImagingDeg)).toBe('optimal');
    });

    it('categorizes moon interference level', () => {
      expect(getMoonInterferenceLevel(20)).toBe('high');
      expect(getMoonInterferenceLevel(40)).toBe('moderate');
      expect(getMoonInterferenceLevel(80)).toBe('low');
    });
  });

  describe('model builder', () => {
    it('builds canonical sections from selected object and astro data', () => {
      const model = buildTargetDisplayModel({
        selectedObject: mockSelectedObject,
        translatedPrimaryName: 'M31',
        translatedSecondaryNames: ['Andromeda Galaxy'],
        targetData: {
          altitude: 41.3,
          azimuth: 182.1,
          moonDistance: 62.4,
          visibility: mockVisibility,
          feasibility: mockFeasibility,
          frame: 'OBSERVED',
          timeScale: 'UT1',
          qualityFlag: 'precise',
          dataFreshness: 'fresh',
          updatedAt: '2026-03-09T20:10:12Z',
          calculationSource: 'calculation',
          calculationDegraded: false,
          calculationTimestamp: '2026-03-09T20:10:12Z',
          riskHints: ['low-feasibility'],
        },
      });

      expect(model).not.toBeNull();
      expect(model?.sections.identity.primaryName).toBe('M31');
      expect(model?.sections.identity.aliases).toEqual(['Andromeda Galaxy']);
      expect(model?.sections.identity.coordinates.ra).toBe(mockSelectedObject.ra);
      expect(model?.sections.liveStatus?.altitude).toBe('41.3deg'.replace('deg', '°'));
      expect(model?.sections.liveStatus?.moonInterferenceLevel).toBe('low');
      expect(model?.sections.planningMetrics?.moonDistance).toBe('62deg'.replace('deg', '°'));
      expect(model?.sections.planningMetrics?.feasibilityScore).toBe(82);
      expect(model?.sections.advancedMetadata?.frame).toBe('OBSERVED');
      expect(model?.sections.liveStatus?.calculationState).toBe('normal');
      expect(model?.sections.advancedMetadata?.calculationSource).toBe('calculation');
      expect(model?.sections.advancedMetadata?.calculationState).toBe('normal');
    });

    it('returns null when no selected object is provided', () => {
      expect(buildTargetDisplayModel({ selectedObject: null })).toBeNull();
    });

    it('builds selection metadata for coordinate fallback selections without astro data', () => {
      const model = buildTargetDisplayModel({
        selectedObject: {
          ...mockSelectedObject,
          names: ['00h 42m 44s +41° 16\' 09"'],
          selectionSource: 'coordinate',
          selectionFallback: 'coordinate_fallback',
          sourceCatalog: null,
          selectionTimestamp: '2026-03-09T20:10:12Z',
        },
      });

      expect(model?.sections.selectionMetadata).toEqual(
        expect.objectContaining({
          selectionSource: 'coordinate',
          selectionFallback: 'coordinate_fallback',
        })
      );
      expect(model?.sections.advancedMetadata).toBeNull();
    });

    it('preserves enriched selection metadata when astro data is available', () => {
      const model = buildTargetDisplayModel({
        selectedObject: {
          ...mockSelectedObject,
          selectionSource: 'enriched',
          selectionFallback: 'resolved',
          sourceCatalog: 'SIMBAD',
          selectionTimestamp: '2026-03-09T20:10:12Z',
        },
        targetData: {
          altitude: 41.3,
          azimuth: 182.1,
          moonDistance: 62.4,
          visibility: mockVisibility,
          feasibility: mockFeasibility,
          frame: 'OBSERVED',
          timeScale: 'UT1',
          qualityFlag: 'precise',
          dataFreshness: 'fresh',
          updatedAt: '2026-03-09T20:10:12Z',
          calculationSource: 'calculation',
          calculationDegraded: false,
          calculationTimestamp: '2026-03-09T20:10:12Z',
          riskHints: [],
        },
      });

      expect(model?.sections.selectionMetadata).toEqual(
        expect.objectContaining({
          selectionSource: 'enriched',
          selectionFallback: 'resolved',
          sourceCatalog: 'SIMBAD',
        })
      );
    });
  });

  describe('calculation quality state', () => {
    it('marks fallback-quality data as degraded', () => {
      expect(getCalculationQualityState('fallback', 'fresh')).toBe('degraded');
      expect(getCalculationQualityState('precise', 'fallback')).toBe('degraded');
      expect(getCalculationQualityState('precise', 'fresh', true)).toBe('degraded');
    });

    it('marks non-fallback data as normal', () => {
      expect(getCalculationQualityState('precise', 'fresh')).toBe('normal');
    });
  });

  describe('presentation semantics helpers', () => {
    it('maps calculation state to localization keys', () => {
      expect(getCalculationStateLabelKey('normal')).toBe('objectDetail.calculationState.normal');
      expect(getCalculationStateLabelKey('degraded')).toBe('objectDetail.calculationState.degraded');
    });

    it('maps calculation source to localization keys', () => {
      expect(getCalculationSourceLabelKey('tauri')).toBe('objectDetail.calculationSource.tauri');
      expect(getCalculationSourceLabelKey('engine')).toBe('objectDetail.calculationSource.engine');
      expect(getCalculationSourceLabelKey('fallback')).toBe('objectDetail.calculationSource.fallback');
      expect(getCalculationSourceLabelKey('calculation')).toBe('objectDetail.calculationSource.calculation');
    });

    it('maps selection source and fallback states to localization keys', () => {
      expect(getSelectionSourceLabelKey('coordinate')).toBe('objectDetail.selectionSource.coordinate');
      expect(getSelectionSourceLabelKey('enriched')).toBe('objectDetail.selectionSource.enriched');
      expect(getSelectionFallbackLabelKey('coordinate_fallback')).toBe('objectDetail.selectionFallback.coordinate_fallback');
      expect(getSelectionFallbackLabelKey('resolved')).toBe('objectDetail.selectionFallback.resolved');
    });
  });
});
