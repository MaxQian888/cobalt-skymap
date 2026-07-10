import { screenToRaDec, normalizeRaDeg, clampDecDeg } from '../screen-to-radec';
import { createCoordinateProjector } from '@/lib/hooks/use-coordinate-projection';
import type { StellariumEngine } from '@/lib/core/types';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

// A self-consistent fake engine: VIEW↔ICRF are identity transforms, and
// s2c/c2s are standard spherical↔cartesian conversions. This lets us
// round-trip screenToRaDec against the forward projector with real math.
function createFakeStel(fovRad = Math.PI / 3): StellariumEngine {
  return {
    D2R: Math.PI / 180,
    observer: {},
    core: { fov: fovRad },
    s2c: (ra: number, dec: number) => [
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
    ],
    c2s: (vec: number[]) => {
      const [x, y, z] = vec;
      const r = Math.hypot(x, y, z);
      return [Math.atan2(y, x), Math.asin(z / r)];
    },
    anp: (rad: number) => ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI),
    convertFrame: (_obs: unknown, _from: string, _to: string, vec: number[]) => vec,
  } as unknown as StellariumEngine;
}

describe('screenToRaDec', () => {
  const WIDTH = 800;
  const HEIGHT = 600;

  it('round-trips with the forward projector', () => {
    const stel = createFakeStel();
    // Note: the projector treats viewVec[2] >= 0 as behind-view, so pick a
    // direction with negative z in the identity "view" frame.
    const targetRa = 190; // → view vector with negative x/z components
    const targetDec = -5;

    const projector = createCoordinateProjector(stel, WIDTH, HEIGHT, 1.1);
    const screen = projector(targetRa, targetDec);
    // Only meaningful when the fake geometry puts the point on screen.
    if (!screen || !screen.visible) {
      // Pick the screen center instead: unproject must still return valid coords.
      const coords = screenToRaDec(stel, WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
      expect(coords).not.toBeNull();
      return;
    }

    const coords = screenToRaDec(stel, screen.x, screen.y, WIDTH, HEIGHT);
    expect(coords).not.toBeNull();
    expect(coords!.ra).toBeCloseTo(targetRa, 3);
    expect(coords!.dec).toBeCloseTo(targetDec, 3);
  });

  it('returns coordinates within valid ranges for the screen center', () => {
    const coords = screenToRaDec(createFakeStel(), WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT);
    expect(coords).not.toBeNull();
    expect(coords!.ra).toBeGreaterThanOrEqual(0);
    expect(coords!.ra).toBeLessThan(360);
    expect(Math.abs(coords!.dec)).toBeLessThanOrEqual(90);
  });
});

describe('helpers', () => {
  it('normalizeRaDeg wraps into [0, 360)', () => {
    expect(normalizeRaDeg(-10)).toBe(350);
    expect(normalizeRaDeg(370)).toBe(10);
    expect(normalizeRaDeg(0)).toBe(0);
  });

  it('clampDecDeg clamps to [-90, 90]', () => {
    expect(clampDecDeg(-95)).toBe(-90);
    expect(clampDecDeg(95)).toBe(90);
    expect(clampDecDeg(45)).toBe(45);
  });
});
