import { detectTargetKind } from '../detect';

describe('detectTargetKind', () => {
  describe('satellites', () => {
    it('detects NORAD designations with the catalog id', () => {
      expect(detectTargetKind(['NAME ISS (ZARYA)', 'NORAD 25544'])).toEqual({
        kind: 'satellite',
        body: null,
        noradId: 25544,
      });
    });

    it('detects satellites from typeCategory without a NORAD id', () => {
      expect(detectTargetKind(['NAME Some Bird'], undefined, 'artificial')).toEqual({
        kind: 'satellite',
        body: null,
        noradId: null,
      });
    });

    it('detects satellites from the SWE otype hint', () => {
      expect(detectTargetKind(['NAME Starlink C'], 'Asa')).toMatchObject({ kind: 'satellite' });
    });
  });

  describe('solar-system bodies', () => {
    it.each([
      ['NAME Jupiter', 'Jupiter'],
      ['NAME Moon', 'Moon'],
      ['NAME Sun', 'Sun'],
      ['NAME Pluto', 'Pluto'],
      ['Mars', 'Mars'],
    ])('maps %s to EngineBody %s', (designation, body) => {
      expect(detectTargetKind([designation])).toEqual({
        kind: 'solar_system',
        body,
        noradId: null,
      });
    });

    it('finds the planet among several designations', () => {
      expect(detectTargetKind(['HIP something', 'NAME Saturn'])).toMatchObject({
        kind: 'solar_system',
        body: 'Saturn',
      });
    });
  });

  describe('minor bodies', () => {
    it('detects comet provisional designations', () => {
      expect(detectTargetKind(['NAME C/2020 F3 (NEOWISE)'])).toMatchObject({ kind: 'minor_body' });
    });

    it('detects numbered periodic comets', () => {
      expect(detectTargetKind(['1P'])).toMatchObject({ kind: 'minor_body' });
    });

    it('detects parenthesized asteroid numbers', () => {
      expect(detectTargetKind(['(1)'])).toMatchObject({ kind: 'minor_body' });
    });

    it('detects minor bodies from typeCategory', () => {
      expect(detectTargetKind(['NAME Ceres-like'], undefined, 'asteroid')).toMatchObject({ kind: 'minor_body' });
      expect(detectTargetKind(['NAME Something'], undefined, 'comet')).toMatchObject({ kind: 'minor_body' });
    });

    it('does NOT treat bare numeric designations as asteroids', () => {
      expect(detectTargetKind(['25544'])).toMatchObject({ kind: 'fixed' });
    });
  });

  describe('fixed targets (fail-safe default)', () => {
    it.each([
      [['M 31', 'NGC 224', 'NAME Andromeda Galaxy']],
      [['HIP 11767', 'NAME Polaris']],
      [['Gaia DR3 12345']],
      [[]],
    ])('classifies %j as fixed', (names) => {
      expect(detectTargetKind(names)).toEqual({ kind: 'fixed', body: null, noradId: null });
    });

    it('stays fixed for a DSO even with a star typeCategory', () => {
      expect(detectTargetKind(['M 42'], 'Nebula', 'nebula')).toMatchObject({ kind: 'fixed' });
    });
  });
});
