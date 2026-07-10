/**
 * Tests for use-object-astro-data.ts
 * Astronomical data computation for selected objects
 */

import { renderHook } from '@testing-library/react';
import { useAstroEnvironment, useTargetAstroData } from '../use-object-astro-data';
import type { SelectedObjectData } from '@/lib/core/types';

describe('useAstroEnvironment', () => {
  it('should compute environment data', () => {
    const now = new Date();
    const { result } = renderHook(() =>
      useAstroEnvironment(40, -74, now)
    );
    const env = result.current;
    expect(typeof env.moonPhaseName).toBe('string');
    expect(typeof env.moonIllumination).toBe('number');
    expect(typeof env.sunAltitude).toBe('number');
    expect(typeof env.lstString).toBe('string');
  });

  it('should have moonIllumination between 0 and 100', () => {
    const now = new Date();
    const { result } = renderHook(() =>
      useAstroEnvironment(40, -74, now)
    );
    expect(result.current.moonIllumination).toBeGreaterThanOrEqual(0);
    expect(result.current.moonIllumination).toBeLessThanOrEqual(100);
  });
});

describe('useTargetAstroData', () => {
  const mockObject = {
    names: ['M31'],
    raDeg: 10.68,
    decDeg: 41.27,
    ra: '0h 42m 44s',
    dec: '+41° 16\' 09"',
    type: 'Galaxy',
    constellation: 'And',
    magnitude: 3.4,
  } as unknown as SelectedObjectData;

  it('should return null when no object selected', () => {
    const now = new Date();
    const { result } = renderHook(() =>
      useTargetAstroData(null, 40, -74, 0, 0, now)
    );
    expect(result.current).toBeNull();
  });

  it('should compute target data when object is selected', () => {
    const now = new Date();
    const { result } = renderHook(() =>
      useTargetAstroData(mockObject, 40, -74, 10, 30, now)
    );
    expect(result.current).not.toBeNull();
    expect(typeof result.current!.altitude).toBe('number');
    expect(typeof result.current!.azimuth).toBe('number');
    expect(typeof result.current!.moonDistance).toBe('number');
  });

  it('classifies fixed targets and keeps forecasts', () => {
    const now = new Date();
    const { result } = renderHook(() =>
      useTargetAstroData(mockObject, 40, -74, 10, 30, now)
    );
    expect(result.current!.targetKind).toBe('fixed');
    expect(result.current!.positionIsSnapshot).toBe(false);
    expect(result.current!.visibility).not.toBeNull();
    expect(result.current!.feasibility).not.toBeNull();
    expect(result.current!.positionAt(now)).toEqual({ raDeg: 10.68, decDeg: 41.27 });
  });

  it('nulls visibility/feasibility for satellites and reports the NORAD id', () => {
    const now = new Date();
    const satellite = {
      ...mockObject,
      names: ['NORAD 25544', 'NAME ISS (ZARYA)'],
      type: undefined,
    } as unknown as SelectedObjectData;

    const { result } = renderHook(() =>
      useTargetAstroData(satellite, 40, -74, 10, 30, now)
    );

    expect(result.current!.targetKind).toBe('satellite');
    expect(result.current!.noradId).toBe(25544);
    expect(result.current!.positionIsSnapshot).toBe(true);
    expect(result.current!.visibility).toBeNull();
    expect(result.current!.feasibility).toBeNull();
    expect(result.current!.riskHints).not.toContain('never-rises');
  });

  it('computes live positions from the ephemeris for solar-system bodies', () => {
    const now = new Date();
    const moon = {
      ...mockObject,
      names: ['NAME Moon'],
      raDeg: 0,
      decDeg: 0,
      type: undefined,
    } as unknown as SelectedObjectData;

    const { result } = renderHook(() =>
      useTargetAstroData(moon, 40, -74, 10, 30, now)
    );

    expect(result.current!.targetKind).toBe('solar_system');
    expect(result.current!.visibility).not.toBeNull();
    expect(result.current!.feasibility).not.toBeNull();
    // The live position comes from the ephemeris, not the stale snapshot (0,0).
    const live = result.current!.positionAt(now);
    expect(live.raDeg !== 0 || live.decDeg !== 0).toBe(true);
  });

  it('honors the typeCategory detection signal for comets', () => {
    const now = new Date();
    const comet = {
      ...mockObject,
      names: ['Weird Designation 42X'],
      type: undefined,
    } as unknown as SelectedObjectData;

    const { result } = renderHook(() =>
      useTargetAstroData(comet, 40, -74, 10, 30, now, 'comet')
    );

    expect(result.current!.targetKind).toBe('minor_body');
    expect(result.current!.positionIsSnapshot).toBe(true);
    expect(result.current!.visibility).not.toBeNull();
  });
});
