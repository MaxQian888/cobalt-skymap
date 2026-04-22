/**
 * @jest-environment jsdom
 */
import {
  ASTRO_CALCULATOR_CAPABILITY_MATRIX,
  ASTRO_CALCULATOR_TAB_ORDER,
} from '../capability-matrix';

describe('astro calculator capability matrix', () => {
  it('covers all nine tabs with non-empty operation and action contracts', () => {
    expect(ASTRO_CALCULATOR_TAB_ORDER).toHaveLength(9);

    const capabilityEntries = ASTRO_CALCULATOR_TAB_ORDER.map((tabId) => ASTRO_CALCULATOR_CAPABILITY_MATRIX[tabId]);
    expect(capabilityEntries).toHaveLength(9);

    capabilityEntries.forEach((entry) => {
      expect(entry.tabId).toBeTruthy();
      expect(entry.labelKey).toMatch(/^astroCalc\./);
      expect(entry.operations.length).toBeGreaterThan(0);
      expect(entry.actions.length).toBeGreaterThan(0);
    });
  });

  it('keeps tab order unique and aligned with matrix keys', () => {
    const uniqueOrder = new Set(ASTRO_CALCULATOR_TAB_ORDER);
    expect(uniqueOrder.size).toBe(ASTRO_CALCULATOR_TAB_ORDER.length);

    const matrixKeys = Object.keys(ASTRO_CALCULATOR_CAPABILITY_MATRIX).sort();
    const orderedKeys = [...ASTRO_CALCULATOR_TAB_ORDER].sort();
    expect(matrixKeys).toEqual(orderedKeys);
  });

  it('keeps observer-context actions explicit across the nine-tab matrix', () => {
    expect(ASTRO_CALCULATOR_CAPABILITY_MATRIX.wut.actions).toContain('reviewObserverContext');
    expect(ASTRO_CALCULATOR_CAPABILITY_MATRIX.positions.actions).toContain('reviewObserverContext');

    ['rts', 'ephemeris', 'almanac', 'phenomena', 'coordinate', 'time', 'solar-system'].forEach((tabId) => {
      expect(ASTRO_CALCULATOR_CAPABILITY_MATRIX[tabId as keyof typeof ASTRO_CALCULATOR_CAPABILITY_MATRIX].actions).toContain('reuseObserverContext');
    });
  });
});
