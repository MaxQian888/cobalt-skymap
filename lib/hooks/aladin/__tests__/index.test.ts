/**
 * @jest-environment jsdom
 */
import * as aladinHooks from '../index';

describe('aladin hooks index', () => {
  it.each([
    'useAladinLoader',
    'useAladinEvents',
    'useAladinSettingsSync',
    'useAladinCatalogs',
    'useAladinOverlays',
    'useAladinLayers',
    'useAladinMOC',
    'useAladinFits',
  ])('exports %s', (exportName) => {
    expect(aladinHooks).toHaveProperty(exportName);
    expect(typeof (aladinHooks as Record<string, unknown>)[exportName]).toBe('function');
  });

  it('exports WELL_KNOWN_MOCS constants', () => {
    expect(aladinHooks.WELL_KNOWN_MOCS).toBeDefined();
  });
});
