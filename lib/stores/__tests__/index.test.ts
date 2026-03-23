/**
 * @jest-environment jsdom
 */
import * as stores from '../index';

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

// Mock storage
jest.mock('@/lib/storage', () => ({
  getZustandStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

describe('Stores Module Exports', () => {
  it('exports useStellariumStore', () => {
    expect(stores.useStellariumStore).toBeDefined();
  });

  it('exports useStarmapBootstrapStore', () => {
    expect(stores.useStarmapBootstrapStore).toBeDefined();
  });

  it('exports useSettingsStore', () => {
    expect(stores.useSettingsStore).toBeDefined();
  });

  it('exports useFramingStore', () => {
    expect(stores.useFramingStore).toBeDefined();
  });

  it('exports useMountStore', () => {
    expect(stores.useMountStore).toBeDefined();
  });

  it('exports useTargetListStore', () => {
    expect(stores.useTargetListStore).toBeDefined();
  });

  it('exports useMarkerStore', () => {
    expect(stores.useMarkerStore).toBeDefined();
  });

  it('exports marker constants', () => {
    expect(stores.MARKER_COLORS).toBeDefined();
    expect(stores.MARKER_ICONS).toBeDefined();
  });

  it('exports useSatelliteStore', () => {
    expect(stores.useSatelliteStore).toBeDefined();
  });

  it('exports useEquipmentStore', () => {
    expect(stores.useEquipmentStore).toBeDefined();
  });

  it('exports equipment presets', () => {
    expect(stores.BUILTIN_CAMERA_PRESETS).toBeDefined();
    expect(stores.BUILTIN_TELESCOPE_PRESETS).toBeDefined();
  });

  it('exports equipment helper functions', () => {
    expect(stores.getAllCameras).toBeDefined();
    expect(stores.getAllTelescopes).toBeDefined();
    expect(stores.findCameraById).toBeDefined();
    expect(stores.findTelescopeById).toBeDefined();
  });

  it('exports useEventSourcesStore', () => {
    expect(stores.useEventSourcesStore).toBeDefined();
  });
});
