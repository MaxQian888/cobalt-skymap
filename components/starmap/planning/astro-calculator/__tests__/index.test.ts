/**
 * @jest-environment jsdom
 */

jest.mock('../positions-tab', () => ({
  PositionsTab: 'PositionsTabMock',
}));

jest.mock('../wut-tab', () => ({
  WUTTab: 'WUTTabMock',
}));

jest.mock('../rts-tab', () => ({
  RTSTab: 'RTSTabMock',
}));

jest.mock('../ephemeris-tab', () => ({
  EphemerisTab: 'EphemerisTabMock',
}));

jest.mock('../almanac-tab', () => ({
  AlmanacTab: 'AlmanacTabMock',
}));

jest.mock('../phenomena-tab', () => ({
  PhenomenaTab: 'PhenomenaTabMock',
}));

jest.mock('../coordinate-tab', () => ({
  CoordinateTab: 'CoordinateTabMock',
}));

jest.mock('../time-tab', () => ({
  TimeTab: 'TimeTabMock',
}));

jest.mock('../solar-system-tab', () => ({
  SolarSystemTab: 'SolarSystemTabMock',
}));

jest.mock('../sortable-header', () => ({
  SortableHeader: 'SortableHeaderMock',
}));

jest.mock('../capability-matrix', () => ({
  ASTRO_CALCULATOR_CAPABILITY_MATRIX: {
    positions: { labelKey: 'astroCalc.positions' },
  },
  ASTRO_CALCULATOR_TAB_ORDER: ['positions'],
}));

jest.mock('../orchestrator', () => ({
  runCalculatorAlmanac: jest.fn(),
  runCalculatorCoordinates: jest.fn(),
  runCalculatorEphemeris: jest.fn(),
  runCalculatorEphemerisBatch: jest.fn(),
  runCalculatorPhenomena: jest.fn(),
  runCalculatorRiseTransitSet: jest.fn(),
  runCalculatorRiseTransitSetBatch: jest.fn(),
  summarizeCalculatorMeta: jest.fn(),
}));

import * as astroCalculatorExports from '../index';

describe('astro-calculator barrel exports', () => {
  it('re-exports calculator tabs, shared contracts, and orchestrator helpers', () => {
    expect(astroCalculatorExports.PositionsTab).toBe('PositionsTabMock');
    expect(astroCalculatorExports.WUTTab).toBe('WUTTabMock');
    expect(astroCalculatorExports.RTSTab).toBe('RTSTabMock');
    expect(astroCalculatorExports.EphemerisTab).toBe('EphemerisTabMock');
    expect(astroCalculatorExports.AlmanacTab).toBe('AlmanacTabMock');
    expect(astroCalculatorExports.PhenomenaTab).toBe('PhenomenaTabMock');
    expect(astroCalculatorExports.CoordinateTab).toBe('CoordinateTabMock');
    expect(astroCalculatorExports.TimeTab).toBe('TimeTabMock');
    expect(astroCalculatorExports.SolarSystemTab).toBe('SolarSystemTabMock');
    expect(astroCalculatorExports.SortableHeader).toBe('SortableHeaderMock');

    expect(astroCalculatorExports.ASTRO_CALCULATOR_CAPABILITY_MATRIX).toEqual({
      positions: { labelKey: 'astroCalc.positions' },
    });
    expect(astroCalculatorExports.ASTRO_CALCULATOR_TAB_ORDER).toEqual(['positions']);

    expect(astroCalculatorExports.runCalculatorAlmanac).toBeDefined();
    expect(astroCalculatorExports.runCalculatorCoordinates).toBeDefined();
    expect(astroCalculatorExports.runCalculatorEphemeris).toBeDefined();
    expect(astroCalculatorExports.runCalculatorEphemerisBatch).toBeDefined();
    expect(astroCalculatorExports.runCalculatorPhenomena).toBeDefined();
    expect(astroCalculatorExports.runCalculatorRiseTransitSet).toBeDefined();
    expect(astroCalculatorExports.runCalculatorRiseTransitSetBatch).toBeDefined();
    expect(astroCalculatorExports.summarizeCalculatorMeta).toBeDefined();
  });
});
