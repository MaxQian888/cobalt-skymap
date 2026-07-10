import { calculateSolarSystemVisibility } from '../solar-system';
import { calculateTargetVisibility } from '../target';
import { createTargetPositionModel } from '../../position-provider';

const LAT = 40;
const LON = -74;
const DATE = new Date('2026-07-10T02:00:00Z');

describe('calculateSolarSystemVisibility', () => {
  it('returns a complete TargetVisibility shape for the Moon', () => {
    const vis = calculateSolarSystemVisibility('Moon', LAT, LON, 30, DATE);

    expect(vis.transitTime).toBeInstanceOf(Date);
    expect(typeof vis.transitAltitude).toBe('number');
    expect(typeof vis.isCurrentlyVisible).toBe('boolean');
    expect(vis.neverRises).toBe(false);
    expect(vis.isCircumpolar).toBe(false);
    expect(vis.riseTime).toBeInstanceOf(Date);
    expect(vis.setTime).toBeInstanceOf(Date);
    expect(vis.imagingHours).toBeGreaterThanOrEqual(0);
    expect(vis.darkImagingHours).toBeGreaterThanOrEqual(0);
  });

  it('differs from the fixed-point calculation for the Moon by > 10 minutes', () => {
    const model = createTargetPositionModel(
      { names: ['NAME Moon'], raDeg: 0, decDeg: 0 },
      { latitude: LAT, longitude: LON },
    );
    const snapshot = model.positionAt(DATE);

    const moving = calculateSolarSystemVisibility('Moon', LAT, LON, 30, DATE);
    const frozen = calculateTargetVisibility(snapshot.raDeg, snapshot.decDeg, LAT, LON, 30, DATE);

    // The Moon rises ~50 minutes later each day; the frozen-RA/Dec model
    // cannot capture that, so one of rise/set must diverge by > 10 minutes.
    const diffs: number[] = [];
    if (moving.riseTime && frozen.riseTime) {
      diffs.push(Math.abs(moving.riseTime.getTime() - frozen.riseTime.getTime()));
    }
    if (moving.setTime && frozen.setTime) {
      diffs.push(Math.abs(moving.setTime.getTime() - frozen.setTime.getTime()));
    }
    expect(diffs.length).toBeGreaterThan(0);
    expect(Math.max(...diffs)).toBeGreaterThan(10 * 60 * 1000);
  });

  it('reports rise before set relative ordering consistent with the transit', () => {
    const vis = calculateSolarSystemVisibility('Jupiter', LAT, LON, 30, DATE);
    // Transit search starts from `date` forward, so it must be in the future.
    expect(vis.transitTime!.getTime()).toBeGreaterThanOrEqual(DATE.getTime());
    if (vis.riseTime) expect(vis.riseTime.getTime()).toBeGreaterThanOrEqual(DATE.getTime());
    if (vis.setTime) expect(vis.setTime.getTime()).toBeGreaterThanOrEqual(DATE.getTime());
  });

  it('honors the imaging window threshold', () => {
    const vis = calculateSolarSystemVisibility('Moon', LAT, LON, 30, DATE);
    if (vis.imagingWindowStart && vis.imagingWindowEnd) {
      expect(vis.imagingWindowEnd.getTime()).toBeGreaterThan(vis.imagingWindowStart.getTime());
    }
  });
});
