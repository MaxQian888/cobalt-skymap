import { renderHook, act } from '@testing-library/react';
import * as equipmentFovHooks from '../use-equipment-fov-props';
import { useEquipmentStore, BUILTIN_CAMERA_PRESETS, BUILTIN_TELESCOPE_PRESETS } from '@/lib/stores';
import type { EquipmentData } from '@/lib/tauri/types';

// Mock zustand storage
jest.mock('@/lib/storage', () => ({
  getZustandStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

type MockUseEquipmentResult = {
  equipment: EquipmentData | null;
  loading: boolean;
  error: string | null;
  refresh: jest.Mock;
  isAvailable: boolean;
};

const mockUseEquipment: jest.Mock<MockUseEquipmentResult, []> = jest.fn(() => ({
  equipment: null,
  loading: false,
  error: null,
  refresh: jest.fn(),
  isAvailable: false,
}));

jest.mock('@/lib/tauri', () => ({
  useEquipment: () => mockUseEquipment(),
}));

const { useEquipmentFOVRead, useEquipmentFOVProps } = equipmentFovHooks;

describe('useEquipmentFOVRead', () => {
  beforeEach(() => {
    mockUseEquipment.mockReturnValue({
      equipment: null,
      loading: false,
      error: null,
      refresh: jest.fn(),
      isAvailable: false,
    });

    act(() => {
      useEquipmentStore.setState({
        activeCameraId: null,
        activeTelescopeId: null,
        sensorWidth: 23.5,
        sensorHeight: 15.6,
        focalLength: 400,
        pixelSize: 3.76,
        aperture: 80,
        fovInputMode: 'manual',
        selectedBarlowReducerId: null,
      });
    });
  });

  it('returns current FOV-related read values from equipment store', () => {
    const { result } = renderHook(() => useEquipmentFOVRead());

    expect(result.current).toHaveProperty('fovSimEnabled');
    expect(result.current).toHaveProperty('sensorWidth');
    expect(result.current).toHaveProperty('sensorHeight');
    expect(result.current).toHaveProperty('focalLength');
    expect(result.current).toHaveProperty('pixelSize');
    expect(result.current).toHaveProperty('rotationAngle');
    expect(result.current).toHaveProperty('mosaic');
    expect(result.current).toHaveProperty('gridType');
  });

  it('reflects store default values', () => {
    const { result } = renderHook(() => useEquipmentFOVRead());
    const storeState = useEquipmentStore.getState();

    expect(result.current.fovSimEnabled).toBe(storeState.fovDisplay.enabled);
    expect(result.current.sensorWidth).toBe(storeState.sensorWidth);
    expect(result.current.sensorHeight).toBe(storeState.sensorHeight);
    expect(result.current.focalLength).toBe(storeState.focalLength);
    expect(result.current.pixelSize).toBe(storeState.pixelSize);
    expect(result.current.rotationAngle).toBe(storeState.rotationAngle);
    expect(result.current.gridType).toBe(storeState.fovDisplay.gridType);
  });

  it('updates when store values change', () => {
    const { result } = renderHook(() => useEquipmentFOVRead());

    act(() => {
      useEquipmentStore.getState().setSensorWidth(100);
    });

    expect(result.current.sensorWidth).toBe(100);
  });

  it('resolves active equipment values from store presets when input mode is active-equipment', () => {
    const hookFn = (equipmentFovHooks as Record<string, unknown>).useFovEquipmentOptions as
      | (() => {
        sensorWidth: number;
        sensorHeight: number;
        focalLength: number;
        pixelSize: number;
        hasCompleteActiveEquipment: boolean;
        fovInputMode: string;
      })
      | undefined;

    expect(hookFn).toBeDefined();

    act(() => {
      useEquipmentStore.setState({
        sensorWidth: 10,
        sensorHeight: 8,
        focalLength: 1500,
        pixelSize: 9,
        activeCameraId: BUILTIN_CAMERA_PRESETS[0].id,
        activeTelescopeId: BUILTIN_TELESCOPE_PRESETS[0].id,
        fovInputMode: 'active-equipment',
      });
    });

    const { result } = renderHook(() => hookFn?.());

    expect(result.current?.sensorWidth).toBe(BUILTIN_CAMERA_PRESETS[0].sensorWidth);
    expect(result.current?.sensorHeight).toBe(BUILTIN_CAMERA_PRESETS[0].sensorHeight);
    expect(result.current?.pixelSize).toBe(BUILTIN_CAMERA_PRESETS[0].pixelSize);
    expect(result.current?.focalLength).toBe(BUILTIN_TELESCOPE_PRESETS[0].focalLength);
    expect(result.current?.hasCompleteActiveEquipment).toBe(true);
    expect(result.current?.fovInputMode).toBe('active-equipment');
  });

  it('falls back to manual snapshot when active equipment is incomplete', () => {
    const hookFn = (equipmentFovHooks as Record<string, unknown>).useFovEquipmentOptions as
      | (() => {
        sensorWidth: number;
        focalLength: number;
        hasCompleteActiveEquipment: boolean;
      })
      | undefined;

    act(() => {
      useEquipmentStore.setState({
        sensorWidth: 31,
        sensorHeight: 21,
        focalLength: 777,
        pixelSize: 4.2,
        activeCameraId: BUILTIN_CAMERA_PRESETS[0].id,
        activeTelescopeId: null,
        fovInputMode: 'active-equipment',
      });
    });

    const { result } = renderHook(() => hookFn?.());

    expect(result.current?.sensorWidth).toBe(31);
    expect(result.current?.focalLength).toBe(777);
    expect(result.current?.hasCompleteActiveEquipment).toBe(false);
  });

  it('resolves tauri accessory factor into effective focal length', () => {
    const hookFn = (equipmentFovHooks as Record<string, unknown>).useFovEquipmentOptions as
      | (() => {
        effectiveFocalLength: number;
        selectedBarlowReducer: { id: string; factor: number } | null;
        accessorySelectionAvailable: boolean;
      })
      | undefined;

    mockUseEquipment.mockReturnValue({
      equipment: {
        cameras: [{
          id: 'cam-tauri',
          name: 'Tauri Cam',
          sensor_width: 20,
          sensor_height: 10,
          pixel_size: 3.8,
          resolution_x: 1000,
          resolution_y: 500,
          camera_type: 'cmos',
          has_cooler: true,
          is_default: false,
          created_at: '',
          updated_at: '',
        }],
        telescopes: [{
          id: 'scope-tauri',
          name: 'Tauri Scope',
          aperture: 80,
          focal_length: 500,
          focal_ratio: 6.25,
          telescope_type: 'refractor',
          is_default: false,
          created_at: '',
          updated_at: '',
        }],
        eyepieces: [],
        barlow_reducers: [{
          id: 'reducer-08',
          name: '0.8x Reducer',
          factor: 0.8,
          created_at: '',
          updated_at: '',
        }],
        filters: [],
      },
      loading: false,
      error: null,
      refresh: jest.fn(),
      isAvailable: true,
    });

    act(() => {
      useEquipmentStore.setState({
        activeCameraId: 'cam-tauri',
        activeTelescopeId: 'scope-tauri',
        fovInputMode: 'active-equipment',
        selectedBarlowReducerId: 'reducer-08',
      });
    });

    const { result } = renderHook(() => hookFn?.());

    expect(result.current?.selectedBarlowReducer).toEqual(expect.objectContaining({ id: 'reducer-08', factor: 0.8 }));
    expect(result.current?.effectiveFocalLength).toBeCloseTo(400);
    expect(result.current?.accessorySelectionAvailable).toBe(true);
  });
});

describe('useEquipmentFOVProps', () => {
  it('returns all read and write props', () => {
    const { result } = renderHook(() => useEquipmentFOVProps());

    // Read props
    expect(result.current).toHaveProperty('fovSimEnabled');
    expect(result.current).toHaveProperty('sensorWidth');
    expect(result.current).toHaveProperty('sensorHeight');
    expect(result.current).toHaveProperty('focalLength');
    expect(result.current).toHaveProperty('pixelSize');
    expect(result.current).toHaveProperty('rotationAngle');
    expect(result.current).toHaveProperty('mosaic');
    expect(result.current).toHaveProperty('gridType');

    // Write props
    expect(typeof result.current.setFovSimEnabled).toBe('function');
    expect(typeof result.current.setSensorWidth).toBe('function');
    expect(typeof result.current.setSensorHeight).toBe('function');
    expect(typeof result.current.setFocalLength).toBe('function');
    expect(typeof result.current.setPixelSize).toBe('function');
    expect(typeof result.current.setMosaic).toBe('function');
    expect(typeof result.current.setGridType).toBe('function');
    expect(typeof result.current.setRotationAngle).toBe('function');
  });

  it('setters update the store', () => {
    const { result } = renderHook(() => useEquipmentFOVProps());

    act(() => {
      result.current.setSensorWidth(200);
      result.current.setSensorHeight(150);
      result.current.setFocalLength(500);
    });

    expect(result.current.sensorWidth).toBe(200);
    expect(result.current.sensorHeight).toBe(150);
    expect(result.current.focalLength).toBe(500);
  });

  it('setFovSimEnabled toggles FOV simulation', () => {
    const { result } = renderHook(() => useEquipmentFOVProps());

    const initial = result.current.fovSimEnabled;
    act(() => {
      result.current.setFovSimEnabled(!initial);
    });

    expect(result.current.fovSimEnabled).toBe(!initial);
  });
});
