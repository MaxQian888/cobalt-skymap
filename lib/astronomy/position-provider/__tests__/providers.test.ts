import { createTargetPositionModel } from '../providers';
import { getAltitudeOverTime } from '../../visibility/altitude';

const OBSERVER = { latitude: 40, longitude: -74 };

describe('createTargetPositionModel', () => {
  it('returns a constant position for fixed targets', () => {
    const model = createTargetPositionModel(
      { names: ['M 31'], raDeg: 10.6847, decDeg: 41.269 },
      OBSERVER,
    );

    expect(model.kind).toBe('fixed');
    expect(model.isSnapshot).toBe(false);
    const now = model.positionAt(new Date('2026-07-10T00:00:00Z'));
    const later = model.positionAt(new Date('2026-07-10T12:00:00Z'));
    expect(now).toEqual({ raDeg: 10.6847, decDeg: 41.269 });
    expect(later).toEqual(now);
  });

  it('recomputes the Moon position over time (RA drifts > 5° in 12h)', () => {
    const model = createTargetPositionModel(
      { names: ['NAME Moon'], raDeg: 0, decDeg: 0 },
      OBSERVER,
    );

    expect(model.kind).toBe('solar_system');
    expect(model.body).toBe('Moon');
    expect(model.isSnapshot).toBe(false);

    const t0 = new Date('2026-07-10T00:00:00Z');
    const t1 = new Date('2026-07-10T12:00:00Z');
    const p0 = model.positionAt(t0);
    const p1 = model.positionAt(t1);

    // The Moon moves ~13.2°/day in RA — over 12h expect > 5° drift.
    const raDrift = Math.abs(p1.raDeg - p0.raDeg);
    const wrapped = Math.min(raDrift, 360 - raDrift);
    expect(wrapped).toBeGreaterThan(5);

    expect(p0.raDeg).toBeGreaterThanOrEqual(0);
    expect(p0.raDeg).toBeLessThan(360);
    expect(Math.abs(p0.decDeg)).toBeLessThanOrEqual(90);
  });

  it('keeps snapshots for comets and satellites', () => {
    const comet = createTargetPositionModel(
      { names: ['NAME C/2020 F3 (NEOWISE)'], raDeg: 120, decDeg: 30 },
      OBSERVER,
    );
    expect(comet.kind).toBe('minor_body');
    expect(comet.isSnapshot).toBe(true);
    expect(comet.positionAt(new Date('2030-01-01T00:00:00Z'))).toEqual({ raDeg: 120, decDeg: 30 });

    const satellite = createTargetPositionModel(
      { names: ['NORAD 25544'], raDeg: 200, decDeg: -10 },
      OBSERVER,
    );
    expect(satellite.kind).toBe('satellite');
    expect(satellite.noradId).toBe(25544);
    expect(satellite.isSnapshot).toBe(true);
  });
});

describe('getAltitudeOverTime with a position provider', () => {
  it('produces a different curve for the Moon than the frozen snapshot', () => {
    const model = createTargetPositionModel(
      { names: ['NAME Moon'], raDeg: 0, decDeg: 0 },
      OBSERVER,
    );
    const snapshot = model.positionAt(new Date());

    const moving = getAltitudeOverTime(
      snapshot.raDeg, snapshot.decDeg, OBSERVER.latitude, OBSERVER.longitude, 24, 60, model.positionAt,
    );
    const frozen = getAltitudeOverTime(
      snapshot.raDeg, snapshot.decDeg, OBSERVER.latitude, OBSERVER.longitude, 24, 60,
    );

    expect(moving).toHaveLength(frozen.length);
    // At the 12h sample the Moon has drifted several degrees — the altitude
    // difference must exceed 1°.
    const idx = 12;
    expect(Math.abs(moving[idx].altitude - frozen[idx].altitude)).toBeGreaterThan(1);
    // The hour-0 samples agree (provider returns ~the snapshot at "now").
    expect(Math.abs(moving[0].altitude - frozen[0].altitude)).toBeLessThan(0.5);
  });
});
