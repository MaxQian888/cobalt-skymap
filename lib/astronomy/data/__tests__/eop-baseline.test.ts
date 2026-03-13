/**
 * @jest-environment node
 */

import {
  EOP_BASELINE_DATA,
  EOP_BASELINE_UPDATED_AT,
  EOP_BASELINE_VERSION,
} from '../eop-baseline';

describe('eop-baseline', () => {
  it('exposes a versioned offline snapshot', () => {
    expect(EOP_BASELINE_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(new Date(EOP_BASELINE_UPDATED_AT).toISOString()).toBe(EOP_BASELINE_UPDATED_AT);
  });

  it('contains monotonically increasing MJD anchors with finite corrections', () => {
    expect(EOP_BASELINE_DATA.length).toBeGreaterThan(1);

    for (let i = 0; i < EOP_BASELINE_DATA.length; i += 1) {
      const entry = EOP_BASELINE_DATA[i];
      expect(Number.isFinite(entry.mjd)).toBe(true);
      expect(Number.isFinite(entry.dut1)).toBe(true);

      if (entry.xp !== undefined) {
        expect(Number.isFinite(entry.xp)).toBe(true);
      }
      if (entry.yp !== undefined) {
        expect(Number.isFinite(entry.yp)).toBe(true);
      }

      if (i > 0) {
        expect(entry.mjd).toBeGreaterThan(EOP_BASELINE_DATA[i - 1].mjd);
      }
    }
  });

  it('provides anchors on both sides of DUT1 zero crossing for offline interpolation', () => {
    const dut1Values = EOP_BASELINE_DATA.map((entry) => entry.dut1);
    expect(dut1Values.some((value) => value > 0)).toBe(true);
    expect(dut1Values.some((value) => value < 0)).toBe(true);
  });
});
