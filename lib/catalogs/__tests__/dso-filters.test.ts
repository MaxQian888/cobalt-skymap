/**
 * Unit tests for DSO Filters
 */

import {
  applyDSOFilters,
  checkAltitudeDuration,
  calculateTransitTime,
  enrichDSOWithCalculations,
  DEFAULT_DSO_FILTERS,
  ALTITUDE_ABOVE_HORIZON_FILTER,
  type DSOSearchFilters,
  type DSOFilterResult,
} from '../dso-filters';
import { CustomHorizon } from '../../astronomy/horizon/custom-horizon';

// Helper to create mock DSO results
function createMockDSO(overrides: Partial<DSOFilterResult> = {}): DSOFilterResult {
  return {
    id: 'M31',
    name: 'Andromeda Galaxy',
    type: 'Galaxy',
    constellation: 'And',
    ra: 10.68,
    dec: 41.27,
    magnitude: 3.4,
    sizeMax: 178,
    sizeMin: 63,
    surfaceBrightness: 13.5,
    altitude: 45,
    azimuth: 180,
    transitTime: new Date('2024-06-15T23:30:00'),
    transitAltitude: 86,
    moonDistance: 60,
    imagingScore: 85,
    isCircumpolar: false,
    neverRises: false,
    riseTime: new Date('2024-06-15T18:00:00'),
    setTime: new Date('2024-06-16T05:00:00'),
    altitudeData: [],
    horizonData: [],
    ...overrides,
  };
}

describe('DEFAULT_DSO_FILTERS', () => {
  it('should have reasonable default values', () => {
    expect(DEFAULT_DSO_FILTERS.objectName).toBe('');
    expect(DEFAULT_DSO_FILTERS.minimumAltitude).toBe(0);
    expect(DEFAULT_DSO_FILTERS.altitudeDuration).toBe(1);
    expect(DEFAULT_DSO_FILTERS.minimumMoonDistance).toBe(0);
    expect(DEFAULT_DSO_FILTERS.transitTimeFrom).toBeNull();
    expect(DEFAULT_DSO_FILTERS.transitTimeThrough).toBeNull();
  });
});

describe('calculateTransitTime', () => {
  const longitude = -75; // 75°W
  const referenceDate = new Date('2024-06-15T12:00:00');

  it('should return a valid Date', () => {
    const transitTime = calculateTransitTime(180, longitude, referenceDate);
    expect(transitTime).toBeInstanceOf(Date);
  });

  it('should be within 24 hours of reference date', () => {
    const transitTime = calculateTransitTime(180, longitude, referenceDate);
    const diffHours = Math.abs(transitTime.getTime() - referenceDate.getTime()) / 3600000;
    expect(diffHours).toBeLessThanOrEqual(24);
  });

  it('should return different times for different RAs', () => {
    const transit1 = calculateTransitTime(0, longitude, referenceDate);
    const transit2 = calculateTransitTime(180, longitude, referenceDate);
    
    expect(transit1.getTime()).not.toBe(transit2.getTime());
  });

  it('should account for longitude', () => {
    const transitEast = calculateTransitTime(180, 0, referenceDate);
    const transitWest = calculateTransitTime(180, -120, referenceDate);
    
    // Western longitude should have later transit
    expect(transitWest.getTime()).toBeGreaterThan(transitEast.getTime());
  });
});

describe('checkAltitudeDuration', () => {
  // Create altitude data that simulates 24 hours
  const createAltitudeData = (peakAltitude: number, hours: number = 24) => {
    const data = [];
    const baseTime = 45000; // Some arbitrary day number
    
    for (let i = 0; i < hours * 10; i++) { // 10 points per hour
      const hourAngle = (i / (hours * 10)) * 24 - 12; // -12 to +12 hours
      // Simple sinusoidal altitude pattern
      const altitude = peakAltitude * Math.cos(hourAngle * Math.PI / 12);
      data.push({
        x: baseTime + i / 240, // Days
        y: altitude,
      });
    }
    return data;
  };

  it('should return true when duration is 0', () => {
    const result = checkAltitudeDuration([], [], 30, 0, null, null, false);
    expect(result).toBe(true);
  });

  it('should return false for empty altitude data', () => {
    const result = checkAltitudeDuration([], [], 30, 1, null, null, false);
    expect(result).toBe(false);
  });

  it('should return true when object stays above threshold', () => {
    const altitudeData = createAltitudeData(60);
    const result = checkAltitudeDuration(altitudeData, [], 30, 2, null, null, false);
    expect(result).toBe(true);
  });

  it('should return false when object never reaches threshold', () => {
    const altitudeData = createAltitudeData(20); // Peak at 20°
    const result = checkAltitudeDuration(altitudeData, [], 30, 1, null, null, false);
    expect(result).toBe(false);
  });

  it('should check infinite duration (all points above)', () => {
    const altitudeData = [
      { x: 0, y: 50 },
      { x: 1, y: 55 },
      { x: 2, y: 60 },
    ];
    
    const resultPass = checkAltitudeDuration(altitudeData, [], 40, Infinity, null, null, false);
    expect(resultPass).toBe(true);
    
    const resultFail = checkAltitudeDuration(altitudeData, [], 52, Infinity, null, null, false);
    expect(resultFail).toBe(false);
  });

  describe('checkAltitudeDuration with custom horizon', () => {
    it('uses horizon data as threshold when useCustomHorizon is true', () => {
      const altData = [
        { x: 0, y: 15 },
        { x: 0.05, y: 20 },
        { x: 0.1, y: 8 },
      ];
      const horizonData = [
        { x: 0, y: 10 },
        { x: 0.05, y: 10 },
        { x: 0.1, y: 25 },
      ];

      const result = checkAltitudeDuration(altData, horizonData, 0, Infinity, null, null, true);
      expect(result).toBe(false);
    });

    it('passes when all points above custom horizon', () => {
      const altData = [
        { x: 0, y: 30 },
        { x: 0.05, y: 35 },
        { x: 0.1, y: 40 },
      ];
      const horizonData = [
        { x: 0, y: 10 },
        { x: 0.05, y: 10 },
        { x: 0.1, y: 10 },
      ];

      const result = checkAltitudeDuration(altData, horizonData, 0, Infinity, null, null, true);
      expect(result).toBe(true);
    });
  });
});

describe('applyDSOFilters', () => {
  const latitude = 45;
  const longitude = -75;
  const referenceDate = new Date('2024-06-15T12:00:00');

  const mockObjects: DSOFilterResult[] = [
    createMockDSO({ id: 'M31', name: 'Andromeda Galaxy', magnitude: 3.4, type: 'Galaxy', constellation: 'And' }),
    createMockDSO({ id: 'M42', name: 'Orion Nebula', magnitude: 4.0, type: 'Nebula', constellation: 'Ori' }),
    createMockDSO({ id: 'M13', name: 'Hercules Cluster', magnitude: 5.8, type: 'GlobularCluster', constellation: 'Her' }),
    createMockDSO({ id: 'NGC7000', name: 'North America Nebula', magnitude: 4.0, type: 'Nebula', constellation: 'Cyg' }),
  ];

  describe('name filter', () => {
    it('should filter by object name', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectName: 'Andromeda',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('M31');
    });

    it('should filter by object ID', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectName: 'NGC7000',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('North America Nebula');
    });

    it('should be case insensitive', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectName: 'ORION',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('M42');
    });

    it('should return all when name is empty', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectName: '',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(4);
    });
  });

  describe('object type filter', () => {
    it('should filter by selected types', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectTypes: [
          { type: 'Nebula', selected: true },
          { type: 'Galaxy', selected: false },
        ],
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(2); // M42 and NGC7000
      expect(result.every(o => o.type === 'Nebula')).toBe(true);
    });

    it('should return all when no types selected', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectTypes: [],
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(4);
    });
  });

  describe('constellation filter', () => {
    it('should filter by constellation', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        constellation: 'Ori',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('M42');
    });

    it('should return all when constellation is empty', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        constellation: '',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(4);
    });
  });

  describe('magnitude filter', () => {
    it('should filter by magnitude range', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        magnitudeRange: { from: 3, through: 4.5 },
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(3); // M31 (3.4), M42 (4.0), NGC7000 (4.0)
    });

    it('should handle null from/through values', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        magnitudeRange: { from: null, through: 4.5 },
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(3);
    });
  });

  describe('RA range filter', () => {
    it('should filter by RA from-only', () => {
      const objects = [
        createMockDSO({ id: 'A', ra: 30 }),
        createMockDSO({ id: 'B', ra: 150 }),
        createMockDSO({ id: 'C', ra: 300 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        raRange: { from: 8, through: null },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(2);
    });

    it('should filter by RA through-only', () => {
      const objects = [
        createMockDSO({ id: 'A', ra: 30 }),
        createMockDSO({ id: 'B', ra: 150 }),
        createMockDSO({ id: 'C', ra: 300 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        raRange: { from: null, through: 12 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(2);
    });

    it('should filter by RA from and through', () => {
      const objects = [
        createMockDSO({ id: 'A', ra: 30 }),
        createMockDSO({ id: 'B', ra: 150 }),
        createMockDSO({ id: 'C', ra: 300 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        raRange: { from: 5, through: 15 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('Dec range filter', () => {
    it('should filter by dec range', () => {
      const objects = [
        createMockDSO({ id: 'A', dec: -30 }),
        createMockDSO({ id: 'B', dec: 20 }),
        createMockDSO({ id: 'C', dec: 60 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        decRange: { from: -10, through: 50 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should handle reversed dec range (from > through)', () => {
      const objects = [
        createMockDSO({ id: 'A', dec: -30 }),
        createMockDSO({ id: 'B', dec: 20 }),
        createMockDSO({ id: 'C', dec: 60 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        decRange: { from: 50, through: -10 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by dec from-only', () => {
      const objects = [
        createMockDSO({ id: 'A', dec: -30 }),
        createMockDSO({ id: 'B', dec: 20 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        decRange: { from: 0, through: null },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by dec through-only', () => {
      const objects = [
        createMockDSO({ id: 'A', dec: -30 }),
        createMockDSO({ id: 'B', dec: 20 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        decRange: { from: null, through: 0 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('magnitude filter edge cases', () => {
    it('should include objects with null magnitude', () => {
      const objects = [
        createMockDSO({ id: 'A', magnitude: null }),
        createMockDSO({ id: 'B', magnitude: 5.0 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        magnitudeRange: { from: 3, through: 6 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(2);
    });

    it('should filter by magnitude from-only', () => {
      const objects = [
        createMockDSO({ id: 'A', magnitude: 2.0 }),
        createMockDSO({ id: 'B', magnitude: 5.0 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        magnitudeRange: { from: 3, through: null },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('size filter', () => {
    it('should include objects with null sizeMax', () => {
      const objects = [
        createMockDSO({ id: 'A', sizeMax: null }),
        createMockDSO({ id: 'B', sizeMax: 50 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        sizeRange: { from: 10, through: 100 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(2);
    });

    it('should filter by size from-only', () => {
      const objects = [
        createMockDSO({ id: 'A', sizeMax: 5 }),
        createMockDSO({ id: 'B', sizeMax: 50 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        sizeRange: { from: 10, through: null },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by size through-only', () => {
      const objects = [
        createMockDSO({ id: 'A', sizeMax: 5 }),
        createMockDSO({ id: 'B', sizeMax: 50 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        sizeRange: { from: null, through: 20 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('surface brightness filter', () => {
    it('should include objects with null surfaceBrightness', () => {
      const objects = [
        createMockDSO({ id: 'A', surfaceBrightness: null }),
        createMockDSO({ id: 'B', surfaceBrightness: 13.0 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        brightnessRange: { from: 12, through: 14 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(2);
    });

    it('should filter by brightness from-only', () => {
      const objects = [
        createMockDSO({ id: 'A', surfaceBrightness: 10.0 }),
        createMockDSO({ id: 'B', surfaceBrightness: 14.0 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        brightnessRange: { from: 12, through: null },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by brightness through-only', () => {
      const objects = [
        createMockDSO({ id: 'A', surfaceBrightness: 10.0 }),
        createMockDSO({ id: 'B', surfaceBrightness: 14.0 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        brightnessRange: { from: null, through: 12 },
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('altitude duration with custom horizon', () => {
    it('should use ALTITUDE_ABOVE_HORIZON_FILTER with useCustomHorizon', () => {
      const altData = [
        { x: 0, y: 15 },
        { x: 0.05, y: 20 },
        { x: 0.1, y: 25 },
        { x: 0.15, y: 30 },
        { x: 0.2, y: 35 },
      ];
      const horizonData = [
        { x: 0, y: 10 },
        { x: 0.05, y: 10 },
        { x: 0.1, y: 10 },
        { x: 0.15, y: 10 },
        { x: 0.2, y: 10 },
      ];
      const objects = [
        createMockDSO({ id: 'A', altitudeData: altData, horizonData }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        minimumAltitude: ALTITUDE_ABOVE_HORIZON_FILTER,
        altitudeDuration: 1,
        useCustomHorizon: true,
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('moon distance filter', () => {
    it('should filter by minimum moon distance', () => {
      const objects = [
        createMockDSO({ id: 'A', moonDistance: 30 }),
        createMockDSO({ id: 'B', moonDistance: 60 }),
        createMockDSO({ id: 'C', moonDistance: 90 }),
      ];
      
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        minimumMoonDistance: 50,
      };
      
      const result = applyDSOFilters(objects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(2);
      expect(result.every(o => o.moonDistance >= 50)).toBe(true);
    });

    it('should return all when minimum is 0', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        minimumMoonDistance: 0,
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(4);
    });
  });

  describe('transit time filter', () => {
    it('should filter by transit time range', () => {
      const objects = [
        createMockDSO({ id: 'A', transitTime: new Date('2024-06-15T20:00:00') }),
        createMockDSO({ id: 'B', transitTime: new Date('2024-06-15T23:00:00') }),
        createMockDSO({ id: 'C', transitTime: new Date('2024-06-16T02:00:00') }),
      ];
      
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        transitTimeFrom: new Date('2024-06-15T21:00:00'),
        transitTimeThrough: new Date('2024-06-16T01:00:00'),
      };
      
      const result = applyDSOFilters(objects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('B');
    });

    it('should return all when transit time not specified', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        transitTimeFrom: null,
        transitTimeThrough: null,
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(4);
    });
  });

  describe('transit time filter edge cases', () => {
    it('should exclude objects with null transitTime', () => {
      const objects = [
        createMockDSO({ id: 'A', transitTime: null }),
        createMockDSO({ id: 'B', transitTime: new Date('2024-06-15T23:00:00') }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        transitTimeFrom: new Date('2024-06-15T20:00:00'),
        transitTimeThrough: new Date('2024-06-16T02:00:00'),
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by transitTimeFrom-only', () => {
      const objects = [
        createMockDSO({ id: 'A', transitTime: new Date('2024-06-15T18:00:00') }),
        createMockDSO({ id: 'B', transitTime: new Date('2024-06-15T23:00:00') }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        transitTimeFrom: new Date('2024-06-15T20:00:00'),
        transitTimeThrough: null,
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });

    it('should filter by transitTimeThrough-only', () => {
      const objects = [
        createMockDSO({ id: 'A', transitTime: new Date('2024-06-15T18:00:00') }),
        createMockDSO({ id: 'B', transitTime: new Date('2024-06-15T23:00:00') }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        transitTimeFrom: null,
        transitTimeThrough: new Date('2024-06-15T20:00:00'),
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result.length).toBe(1);
    });
  });

  describe('sorting', () => {
    it('should sort by name ascending', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'name',
        orderByDirection: 'asc',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result[0].name).toBe('Andromeda Galaxy');
      expect(result[result.length - 1].name).toBe('Orion Nebula');
    });

    it('should sort by magnitude descending', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'magnitude',
        orderByDirection: 'desc',
      };
      
      const result = applyDSOFilters(mockObjects, filters, latitude, longitude, referenceDate);
      expect(result[0].magnitude).toBe(5.8); // Faintest first
    });

    it('should sort by imaging score', () => {
      const objects = [
        createMockDSO({ id: 'A', imagingScore: 50 }),
        createMockDSO({ id: 'B', imagingScore: 90 }),
        createMockDSO({ id: 'C', imagingScore: 70 }),
      ];
      
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'imagingScore',
        orderByDirection: 'desc',
      };
      
      const result = applyDSOFilters(objects, filters, latitude, longitude, referenceDate);
      expect(result[0].id).toBe('B');
      expect(result[1].id).toBe('C');
      expect(result[2].id).toBe('A');
    });
  });

  describe('additional sort fields', () => {
    it('should sort by ra', () => {
      const objects = [
        createMockDSO({ id: 'A', ra: 200 }),
        createMockDSO({ id: 'B', ra: 50 }),
        createMockDSO({ id: 'C', ra: 300 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'ra',
        orderByDirection: 'asc',
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result[0].id).toBe('B');
      expect(result[2].id).toBe('C');
    });

    it('should sort by dec', () => {
      const objects = [
        createMockDSO({ id: 'A', dec: 60 }),
        createMockDSO({ id: 'B', dec: -10 }),
        createMockDSO({ id: 'C', dec: 30 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'dec',
        orderByDirection: 'asc',
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result[0].id).toBe('B');
    });

    it('should sort by altitude', () => {
      const objects = [
        createMockDSO({ id: 'A', altitude: 30 }),
        createMockDSO({ id: 'B', altitude: 70 }),
        createMockDSO({ id: 'C', altitude: 50 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'altitude',
        orderByDirection: 'desc',
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result[0].id).toBe('B');
    });

    it('should sort by transitTime', () => {
      const objects = [
        createMockDSO({ id: 'A', transitTime: new Date('2024-06-16T02:00:00') }),
        createMockDSO({ id: 'B', transitTime: new Date('2024-06-15T20:00:00') }),
        createMockDSO({ id: 'C', transitTime: null }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'transitTime',
        orderByDirection: 'asc',
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result[0].id).toBe('C');
      expect(result[1].id).toBe('B');
    });

    it('should sort by moonDistance', () => {
      const objects = [
        createMockDSO({ id: 'A', moonDistance: 90 }),
        createMockDSO({ id: 'B', moonDistance: 30 }),
      ];
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        orderByField: 'moonDistance',
        orderByDirection: 'asc',
      };

      const result = applyDSOFilters(objects, filters, 45, -75, new Date('2024-06-15T12:00:00'));
      expect(result[0].id).toBe('B');
    });
  });

  describe('combined filters', () => {
    it('should apply multiple filters together', () => {
      const filters: DSOSearchFilters = {
        ...DEFAULT_DSO_FILTERS,
        objectTypes: [{ type: 'Nebula', selected: true }],
        magnitudeRange: { from: null, through: 4.5 },
        minimumMoonDistance: 50,
      };
      
      const objects = [
        createMockDSO({ id: 'A', type: 'Nebula', magnitude: 4.0, moonDistance: 60 }),
        createMockDSO({ id: 'B', type: 'Galaxy', magnitude: 4.0, moonDistance: 60 }),
        createMockDSO({ id: 'C', type: 'Nebula', magnitude: 6.0, moonDistance: 60 }),
        createMockDSO({ id: 'D', type: 'Nebula', magnitude: 4.0, moonDistance: 30 }),
      ];
      
      const result = applyDSOFilters(objects, filters, latitude, longitude, referenceDate);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('A');
    });
  });
});

describe('enrichDSOWithCalculations', () => {
  const latitude = 45;
  const longitude = -75;
  const referenceDate = new Date('2024-06-15T12:00:00');

  it('should add calculated properties to DSO', () => {
    const dso = {
      id: 'M31',
      name: 'Andromeda Galaxy',
      type: 'Galaxy',
      constellation: 'And',
      ra: 10.68,
      dec: 41.27,
      magnitude: 3.4,
      sizeMax: 178,
      sizeMin: 63,
      surfaceBrightness: 13.5,
    };
    
    const enriched = enrichDSOWithCalculations(dso, latitude, longitude, referenceDate);
    
    expect(enriched.altitude).toBeDefined();
    expect(enriched.transitTime).toBeDefined();
    expect(enriched.moonDistance).toBeGreaterThanOrEqual(0);
    expect(enriched.imagingScore).toBeGreaterThanOrEqual(0);
    expect(enriched.imagingScore).toBeLessThanOrEqual(100);
    expect(enriched.altitudeData).toBeDefined();
    expect(enriched.altitudeData.length).toBeGreaterThan(0);
  });

  it('should include visibility flags', () => {
    const dso = {
      id: 'TEST',
      name: 'Test Object',
      type: 'Galaxy',
      constellation: 'UMa',
      ra: 180,
      dec: 60,
      magnitude: null,
      sizeMax: null,
      sizeMin: null,
      surfaceBrightness: null,
    };
    
    const enriched = enrichDSOWithCalculations(dso, latitude, longitude, referenceDate);
    
    expect(typeof enriched.isCircumpolar).toBe('boolean');
    expect(typeof enriched.neverRises).toBe('boolean');
  });

  it('should include custom horizon data when provided', () => {
    const dso = {
      id: 'TEST',
      name: 'Test Object',
      type: 'Galaxy',
      constellation: 'UMa',
      ra: 180,
      dec: 30,
      magnitude: null,
      sizeMax: null,
      sizeMin: null,
      surfaceBrightness: null,
    };
    
    const horizon = new CustomHorizon();
    horizon.setPoints([
      { azimuth: 0, altitude: 10 },
      { azimuth: 90, altitude: 15 },
      { azimuth: 180, altitude: 20 },
      { azimuth: 270, altitude: 12 },
    ]);
    
    const enriched = enrichDSOWithCalculations(dso, latitude, longitude, referenceDate, horizon);
    
    expect(enriched.horizonData.length).toBeGreaterThan(0);
  });
});

describe('ALTITUDE_ABOVE_HORIZON_FILTER', () => {
  it('should be a special marker value', () => {
    expect(ALTITUDE_ABOVE_HORIZON_FILTER).toBe(999);
  });
});
