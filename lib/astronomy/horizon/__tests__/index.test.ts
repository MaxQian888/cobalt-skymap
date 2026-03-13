/**
 * @jest-environment node
 */

import * as horizon from '../index';
import {
  CustomHorizon,
  createFlatHorizon,
  createSampleHorizon,
  exportHorizonFile,
  parseHorizonFile,
} from '../custom-horizon';

describe('horizon index exports', () => {
  it('re-exports the horizon surface from custom-horizon', () => {
    expect(horizon.CustomHorizon).toBe(CustomHorizon);
    expect(horizon.createFlatHorizon).toBe(createFlatHorizon);
    expect(horizon.createSampleHorizon).toBe(createSampleHorizon);
    expect(horizon.parseHorizonFile).toBe(parseHorizonFile);
    expect(horizon.exportHorizonFile).toBe(exportHorizonFile);
  });

  it('keeps the re-exported helpers interoperable', () => {
    const flat = horizon.createFlatHorizon(12);
    const content = horizon.exportHorizonFile(flat);
    const parsed = horizon.parseHorizonFile(content);
    const sample = horizon.createSampleHorizon();

    expect(flat).toBeInstanceOf(CustomHorizon);
    expect(parsed[0]).toEqual({ azimuth: 0, altitude: 12 });
    expect(sample.pointCount).toBeGreaterThan(0);
  });
});
