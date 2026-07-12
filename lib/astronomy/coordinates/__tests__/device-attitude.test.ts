/**
 * @jest-environment node
 */
import {
  createQuaternionFromEulerZXY,
  deviceEulerToSkyDirection,
  deviceEulerToForwardVector,
  normalizeAngle360,
  normalizeAngleSigned180,
} from '../device-attitude';

function legacyForwardVector(alphaDeg: number, betaDeg: number, gammaDeg: number) {
  const alpha = (alphaDeg * Math.PI) / 180;
  const beta = (betaDeg * Math.PI) / 180;
  const gamma = (gammaDeg * Math.PI) / 180;

  const cA = Math.cos(alpha);
  const sA = Math.sin(alpha);
  const cB = Math.cos(beta);
  const sB = Math.sin(beta);
  const cG = Math.cos(gamma);
  const sG = Math.sin(gamma);

  return {
    x: -cA * sG - sA * sB * cG,
    y: -sA * sG + cA * sB * cG,
    z: -cB * cG,
  };
}

describe('device attitude conversions', () => {
  it('creates normalized quaternion from euler angles', () => {
    const quaternion = createQuaternionFromEulerZXY({
      alphaDeg: 45,
      betaDeg: 30,
      gammaDeg: 15,
    });
    const norm = Math.sqrt(
      quaternion.x ** 2 + quaternion.y ** 2 + quaternion.z ** 2 + quaternion.w ** 2
    );
    expect(norm).toBeCloseTo(1, 6);
  });

  it('matches legacy forward-vector math with no screen compensation', () => {
    const euler = { alphaDeg: 120, betaDeg: 45, gammaDeg: 20 };
    const vector = deviceEulerToForwardVector(euler, 0);
    const legacy = legacyForwardVector(euler.alphaDeg, euler.betaDeg, euler.gammaDeg);
    expect(vector.x).toBeCloseTo(legacy.x, 10);
    expect(vector.y).toBeCloseTo(legacy.y, 10);
    expect(vector.z).toBeCloseTo(legacy.z, 10);
  });

  it('applies screen orientation compensation', () => {
    const euler = { alphaDeg: 0, betaDeg: 90, gammaDeg: 0 };
    const portrait = deviceEulerToSkyDirection(euler, 0);
    const landscape = deviceEulerToSkyDirection(euler, 90);
    expect(portrait.azimuth).toBeCloseTo(0, 5);
    expect(landscape.azimuth).toBeCloseTo(90, 5);
  });

  it('returns finite sky direction in edge orientation cases', () => {
    const direction = deviceEulerToSkyDirection(
      { alphaDeg: 275, betaDeg: -179.9, gammaDeg: 89.9 },
      270
    );
    expect(Number.isFinite(direction.azimuth)).toBe(true);
    expect(Number.isFinite(direction.altitude)).toBe(true);
    expect(direction.azimuth).toBeGreaterThanOrEqual(0);
    expect(direction.azimuth).toBeLessThan(360);
    expect(direction.altitude).toBeGreaterThanOrEqual(-90);
    expect(direction.altitude).toBeLessThanOrEqual(90);
  });

  it('flips the forward vector for a front-facing camera', () => {
    const euler = { alphaDeg: 120, betaDeg: 45, gammaDeg: 20 };
    const rear = deviceEulerToForwardVector(euler, 0, 'environment');
    const front = deviceEulerToForwardVector(euler, 0, 'user');
    expect(front.x).toBeCloseTo(-rear.x, 10);
    expect(front.y).toBeCloseTo(-rear.y, 10);
    expect(front.z).toBeCloseTo(-rear.z, 10);
  });

  it('points the front camera at the antipode of the rear camera', () => {
    const euler = { alphaDeg: 275, betaDeg: 30, gammaDeg: -15 };
    const rear = deviceEulerToSkyDirection(euler, 90, 'environment');
    const front = deviceEulerToSkyDirection(euler, 90, 'user');
    expect(front.azimuth).toBeCloseTo(normalizeAngle360(rear.azimuth + 180), 5);
    expect(front.altitude).toBeCloseTo(-rear.altitude, 5);
  });

  it('defaults to the rear-camera forward vector', () => {
    const euler = { alphaDeg: 42, betaDeg: 60, gammaDeg: 5 };
    const implicit = deviceEulerToSkyDirection(euler, 0);
    const explicit = deviceEulerToSkyDirection(euler, 0, 'environment');
    expect(implicit.azimuth).toBeCloseTo(explicit.azimuth, 10);
    expect(implicit.altitude).toBeCloseTo(explicit.altitude, 10);
  });

  it('normalizes angular values correctly', () => {
    expect(normalizeAngle360(370)).toBe(10);
    expect(normalizeAngle360(-30)).toBe(330);
    expect(normalizeAngleSigned180(190)).toBe(-170);
    expect(normalizeAngleSigned180(-200)).toBe(160);
  });
});

