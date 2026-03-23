/**
 * @jest-environment jsdom
 */
import * as stellariumHooks from '../index';

describe('stellarium hooks index', () => {
  it.each([
    'useClickCoordinates',
    'useStellariumZoom',
    'useStellariumEvents',
    'useObserverSync',
    'useSettingsSync',
    'useStellariumLoader',
    'useStellariumCalendar',
    'useStellariumFonts',
    'useStellariumLayerApi',
    'useStellariumValueWatch',
  ])('exports %s', (exportName) => {
    expect(stellariumHooks).toHaveProperty(exportName);
    expect(typeof (stellariumHooks as Record<string, unknown>)[exportName]).toBe('function');
  });
});
