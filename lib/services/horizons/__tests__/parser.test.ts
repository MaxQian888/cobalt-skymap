import { parseHorizonsResult } from '../parser';

// Realistic JPL Horizons `result` text for an OBSERVER ephemeris requested with
// CSV_FORMAT=YES, ANG_FORMAT=DEG, QUANTITIES='1,4,9' (astrometric RA/Dec in
// degrees, apparent Az/El, visual magnitude + surface brightness).
const SAMPLE_RESULT = `*******************************************************************************
Ephemeris / API_USER Thu Jun 12 00:00:00 2026 Pasadena, USA / Horizons
*******************************************************************************
Target body name: Mars (499)
*******************************************************************************
 Date__(UT)__HR:MN, , , R.A._(ICRF), DEC_(ICRF), Azi____(a-app), Elev___(a-app), APmag, S-brt,
*******************************************************************************
$$SOE
 2026-Jun-12 00:00, , , 157.654321, 11.223344, 123.4567, 45.6789, -1.05, 2.30,
 2026-Jun-12 01:00, *, m, 158.123456, 11.198765, 130.0000, 50.0000, -1.06, 2.31,
$$EOE
*******************************************************************************
`;

describe('parseHorizonsResult', () => {
  it('extracts rows between $$SOE and $$EOE mapped by header columns', () => {
    const rows = parseHorizonsResult(SAMPLE_RESULT);
    expect(rows).toHaveLength(2);

    expect(rows[0].timeUtc).toBe('2026-Jun-12 00:00');
    expect(rows[0].raDeg).toBeCloseTo(157.654321, 5);
    expect(rows[0].decDeg).toBeCloseTo(11.223344, 5);
    expect(rows[0].azDeg).toBeCloseTo(123.4567, 3);
    expect(rows[0].elDeg).toBeCloseTo(45.6789, 3);
    expect(rows[0].vMag).toBeCloseTo(-1.05, 2);

    expect(rows[1].raDeg).toBeCloseTo(158.123456, 5);
  });

  it('returns an empty array when the SOE/EOE markers are missing', () => {
    expect(parseHorizonsResult('no markers here')).toEqual([]);
  });

  it('skips blank and malformed rows', () => {
    const result = `H, , , R.A._(ICRF), DEC_(ICRF), Azi, Elev, APmag,
$$SOE

 2026-Jun-12 00:00, , , 10.0, 20.0, 1.0, 2.0, 3.0,
 garbage row without numbers
$$EOE`;
    const rows = parseHorizonsResult(result);
    expect(rows).toHaveLength(1);
    expect(rows[0].raDeg).toBe(10);
  });
});
