import { useEffect } from 'react';
import { useEquipment } from '@/lib/tauri';
import { resolveEffectiveFocalLength } from '@/lib/astronomy/fov-calculations';
import { useEquipmentStore, findCameraById, findTelescopeById } from '@/lib/stores';
import type { MosaicSettings, GridType, FOVInputMode } from '@/lib/stores/equipment-store';

/**
 * Shared hook for FOV-related equipment store subscriptions.
 * Used by RightControlPanel, MobileLayout, OverlaysContainer, and CanvasContextMenu
 * to avoid duplicating 12+ individual store selectors.
 */

export interface EquipmentFOVReadProps {
  fovSimEnabled: boolean;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  pixelSize: number;
  rotationAngle: number;
  mosaic: MosaicSettings;
  gridType: GridType;
}

export interface EquipmentFOVWriteProps {
  setFovSimEnabled: (enabled: boolean) => void;
  setSensorWidth: (width: number) => void;
  setSensorHeight: (height: number) => void;
  setFocalLength: (length: number) => void;
  setPixelSize: (size: number) => void;
  setMosaic: (mosaic: MosaicSettings) => void;
  setGridType: (type: GridType) => void;
  setRotationAngle: (angle: number) => void;
}

export type EquipmentFOVProps = EquipmentFOVReadProps & EquipmentFOVWriteProps;

export interface NormalizedFOVCamera {
  id: string;
  name: string;
  sensorWidth: number;
  sensorHeight: number;
  pixelSize: number;
  source: 'tauri' | 'store';
}

export interface NormalizedFOVTelescope {
  id: string;
  name: string;
  focalLength: number;
  aperture: number;
  type: string;
  source: 'tauri' | 'store';
}

export interface NormalizedFOVAccessory {
  id: string;
  name: string;
  factor: number;
}

export interface FOVEquipmentOptions extends EquipmentFOVReadProps {
  aperture: number;
  baseFocalLength: number;
  effectiveFocalLength: number;
  fovInputMode: FOVInputMode;
  selectedBarlowReducerId: string | null;
  activeCamera: NormalizedFOVCamera | null;
  activeTelescope: NormalizedFOVTelescope | null;
  selectedBarlowReducer: NormalizedFOVAccessory | null;
  barlowReducers: NormalizedFOVAccessory[];
  accessorySelectionAvailable: boolean;
  hasCompleteActiveEquipment: boolean;
  framePlacement: { x: number; y: number };
  setFovInputMode: (mode: FOVInputMode) => void;
  setSelectedBarlowReducerId: (id: string | null) => void;
  setFramePlacement: (placement: { x: number; y: number }) => void;
  resetFramePlacement: () => void;
}

/** Read-only FOV equipment values (for display-only components like OverlaysContainer) */
export function useEquipmentFOVRead(): EquipmentFOVReadProps {
  const fovSimEnabled = useEquipmentStore((s) => s.fovDisplay.enabled);
  const sensorWidth = useEquipmentStore((s) => s.sensorWidth);
  const sensorHeight = useEquipmentStore((s) => s.sensorHeight);
  const focalLength = useEquipmentStore((s) => s.focalLength);
  const pixelSize = useEquipmentStore((s) => s.pixelSize);
  const rotationAngle = useEquipmentStore((s) => s.rotationAngle);
  const mosaic = useEquipmentStore((s) => s.mosaic);
  const gridType = useEquipmentStore((s) => s.fovDisplay.gridType);

  return { fovSimEnabled, sensorWidth, sensorHeight, focalLength, pixelSize, rotationAngle, mosaic, gridType };
}

/** Full read+write FOV equipment values (for interactive components like FOVSimulator settings) */
export function useEquipmentFOVProps(): EquipmentFOVProps {
  const read = useEquipmentFOVRead();

  const setFovSimEnabled = useEquipmentStore((s) => s.setFOVEnabled);
  const setSensorWidth = useEquipmentStore((s) => s.setSensorWidth);
  const setSensorHeight = useEquipmentStore((s) => s.setSensorHeight);
  const setFocalLength = useEquipmentStore((s) => s.setFocalLength);
  const setPixelSize = useEquipmentStore((s) => s.setPixelSize);
  const setMosaic = useEquipmentStore((s) => s.setMosaic);
  const setGridType = useEquipmentStore((s) => s.setGridType);
  const setRotationAngle = useEquipmentStore((s) => s.setRotationAngle);

  return {
    ...read,
    setFovSimEnabled,
    setSensorWidth,
    setSensorHeight,
    setFocalLength,
    setPixelSize,
    setMosaic,
    setGridType,
    setRotationAngle,
  };
}

export function useFovEquipmentOptions(): FOVEquipmentOptions {
  const { equipment, isAvailable } = useEquipment();
  const rawRead = useEquipmentFOVRead();
  const aperture = useEquipmentStore((s) => s.aperture);
  const activeCameraId = useEquipmentStore((s) => s.activeCameraId);
  const activeTelescopeId = useEquipmentStore((s) => s.activeTelescopeId);
  const fovInputMode = useEquipmentStore((s) => s.fovInputMode);
  const selectedBarlowReducerId = useEquipmentStore((s) => s.selectedBarlowReducerId);
  const framePlacement = useEquipmentStore((s) => s.framePlacement);
  const setFovInputMode = useEquipmentStore((s) => s.setFovInputMode);
  const setSelectedBarlowReducerId = useEquipmentStore((s) => s.setSelectedBarlowReducerId);
  const setFramePlacement = useEquipmentStore((s) => s.setFramePlacement);
  const resetFramePlacement = useEquipmentStore((s) => s.resetFramePlacement);

  const activeCamera: NormalizedFOVCamera | null = (() => {
    if (activeCameraId && isAvailable && equipment?.cameras) {
      const tauriCamera = equipment.cameras.find((camera) => camera.id === activeCameraId);
      if (tauriCamera) {
        return {
          id: tauriCamera.id,
          name: tauriCamera.name,
          sensorWidth: tauriCamera.sensor_width,
          sensorHeight: tauriCamera.sensor_height,
          pixelSize: tauriCamera.pixel_size,
          source: 'tauri',
        };
      }
    }

    if (!activeCameraId) return null;
    const storeCamera = findCameraById(activeCameraId);
    if (!storeCamera) return null;

    return {
      id: storeCamera.id,
      name: storeCamera.name,
      sensorWidth: storeCamera.sensorWidth,
      sensorHeight: storeCamera.sensorHeight,
      pixelSize: storeCamera.pixelSize,
      source: 'store',
    };
  })();

  const activeTelescope: NormalizedFOVTelescope | null = (() => {
    if (activeTelescopeId && isAvailable && equipment?.telescopes) {
      const tauriTelescope = equipment.telescopes.find((telescope) => telescope.id === activeTelescopeId);
      if (tauriTelescope) {
        return {
          id: tauriTelescope.id,
          name: tauriTelescope.name,
          focalLength: tauriTelescope.focal_length,
          aperture: tauriTelescope.aperture,
          type: tauriTelescope.telescope_type,
          source: 'tauri',
        };
      }
    }

    if (!activeTelescopeId) return null;
    const storeTelescope = findTelescopeById(activeTelescopeId);
    if (!storeTelescope) return null;

    return {
      id: storeTelescope.id,
      name: storeTelescope.name,
      focalLength: storeTelescope.focalLength,
      aperture: storeTelescope.aperture,
      type: storeTelescope.type,
      source: 'store',
    };
  })();

  const barlowReducers: NormalizedFOVAccessory[] = (() => {
    if (!isAvailable || !equipment?.barlow_reducers) return [];
    return equipment.barlow_reducers.map((item) => ({
      id: item.id,
      name: item.name,
      factor: item.factor,
    }));
  })();

  const selectedBarlowReducer = barlowReducers.find((item) => item.id === selectedBarlowReducerId) ?? null;

  useEffect(() => {
    if (!selectedBarlowReducerId) return;
    if (barlowReducers.length === 0 || !selectedBarlowReducer) {
      setSelectedBarlowReducerId(null);
    }
  }, [barlowReducers.length, selectedBarlowReducer, selectedBarlowReducerId, setSelectedBarlowReducerId]);

  const hasCompleteActiveEquipment = fovInputMode === 'active-equipment' && !!activeCamera && !!activeTelescope;
  const sensorWidth = hasCompleteActiveEquipment ? activeCamera.sensorWidth : rawRead.sensorWidth;
  const sensorHeight = hasCompleteActiveEquipment ? activeCamera.sensorHeight : rawRead.sensorHeight;
  const pixelSize = hasCompleteActiveEquipment ? activeCamera.pixelSize : rawRead.pixelSize;
  const baseFocalLength = hasCompleteActiveEquipment ? activeTelescope.focalLength : rawRead.focalLength;
  const effectiveFocalLength = resolveEffectiveFocalLength(baseFocalLength, selectedBarlowReducer?.factor ?? null);
  const resolvedAperture = hasCompleteActiveEquipment ? activeTelescope.aperture : aperture;

  return {
    ...rawRead,
    sensorWidth,
    sensorHeight,
    pixelSize,
    focalLength: baseFocalLength,
    aperture: resolvedAperture,
    baseFocalLength,
    effectiveFocalLength,
    fovInputMode,
    selectedBarlowReducerId,
    activeCamera,
    activeTelescope,
    selectedBarlowReducer,
    barlowReducers,
    accessorySelectionAvailable: barlowReducers.length > 0,
    hasCompleteActiveEquipment,
    framePlacement,
    setFovInputMode,
    setSelectedBarlowReducerId,
    setFramePlacement,
    resetFramePlacement,
  };
}
