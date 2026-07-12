/**
 * Tests for sky-quality.ts
 * Sky quality estimation and sky quality color mapping
 */

import { estimateSkyQuality, getSkyQualityColor } from '../sky-quality';

describe('estimateSkyQuality', () => {
  it('should return poor when sun is above -6°', () => {
    expect(estimateSkyQuality(-3, -10, 0)).toBe('poor');
    expect(estimateSkyQuality(0, -10, 0)).toBe('poor');
    expect(estimateSkyQuality(10, -10, 0)).toBe('poor');
  });

  it('should return fair during civil twilight (-6 to -12)', () => {
    expect(estimateSkyQuality(-8, -10, 0)).toBe('fair');
  });

  it('should return good during nautical twilight (-12 to -18)', () => {
    expect(estimateSkyQuality(-15, -10, 0)).toBe('good');
  });

  it('should return excellent in full astronomical darkness with no moon', () => {
    expect(estimateSkyQuality(-20, -10, 0)).toBe('excellent');
  });

  it('should return fair when bright moon is high', () => {
    // Sun well below, but moon is high and bright
    expect(estimateSkyQuality(-20, 40, 80)).toBe('fair');
  });

  it('should rate a low moon as low impact regardless of illumination', () => {
    // 75% moon at only 10° altitude — heavily attenuated near the horizon
    expect(estimateSkyQuality(-20, 10, 75)).toBe('excellent');
  });

  it('should return poor when a full moon is near zenith', () => {
    expect(estimateSkyQuality(-20, 70, 100)).toBe('poor');
  });

  it('should never rate a brighter or higher moon better', () => {
    const order = ['excellent', 'good', 'fair', 'poor'];
    const rank = (q: string) => order.indexOf(q);
    expect(rank(estimateSkyQuality(-20, 30, 90))).toBeGreaterThanOrEqual(
      rank(estimateSkyQuality(-20, 30, 50))
    );
    expect(rank(estimateSkyQuality(-20, 60, 80))).toBeGreaterThanOrEqual(
      rank(estimateSkyQuality(-20, 20, 80))
    );
  });
});

describe('getSkyQualityColor', () => {
  it('should return correct CSS classes', () => {
    expect(getSkyQualityColor('excellent')).toBe('text-green-400');
    expect(getSkyQualityColor('good')).toBe('text-emerald-400');
    expect(getSkyQualityColor('fair')).toBe('text-yellow-400');
    expect(getSkyQualityColor('poor')).toBe('text-red-400');
  });
});
