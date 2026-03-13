import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { type GridType, type EyepiecePreset, type BarlowPreset, type OcularTelescopePreset } from '@/lib/constants/equipment-presets';
import { clampFramePlacement, type FramePlacement } from '@/lib/astronomy/fov-calculations';

// Re-export GridType for backward compatibility
export type { GridType } from '@/lib/constants/equipment-presets';

// ============================================================================
// Types
// ============================================================================
export type BinningType = '1x1' | '2x2' | '3x3' | '4x4';
export type TrackingType = 'none' | 'basic' | 'guided';
export type TargetType = 'galaxy' | 'nebula' | 'cluster' | 'planetary';
export type GainStrategy = 'unity' | 'max_dynamic_range' | 'manual';

export interface MosaicSettings {
  enabled: boolean;
  rows: number;
  cols: number;
  overlap: number;
  overlapUnit: 'percent' | 'pixels';
}

export interface CameraPreset {
  id: string;
  name: string;
  sensorWidth: number;
  sensorHeight: number;
  pixelSize: number;
  resolutionX?: number;
  resolutionY?: number;
  isCustom: boolean;
}

export interface TelescopePreset {
  id: string;
  name: string;
  focalLength: number;
  aperture: number;
  type: string;
  isCustom: boolean;
}

export interface ExposureDefaults {
  exposureTime: number;
  gain: number;
  offset: number;
  binning: BinningType;
  filter: string;
  frameCount: number;
  ditherEnabled: boolean;
  ditherEvery: number;
  tracking: TrackingType;
  targetType: TargetType;
  bortle: number;
  sqmOverride?: number;
  filterBandwidthNm: number;
  readNoiseLimitPercent: number;
  gainStrategy: GainStrategy;
  manualGain: number;
  manualReadNoiseEnabled: boolean;
  manualReadNoise: number;
  manualDarkCurrent: number;
  manualFullWell: number;
  manualQE: number;
  manualEPeraDu: number;
  targetSurfaceBrightness: number;
  targetSignalRate: number;
}

export interface FOVDisplaySettings {
  enabled: boolean;
  gridType: GridType;
  showCoordinateGrid: boolean;
  showConstellations: boolean;
  showConstellationBoundaries: boolean;
  showDSOLabels: boolean;
  overlayOpacity: number;
  frameColor: string;
  // NINA-style Framing Assistant enhancements
  rotateSky: boolean;           // Rotate sky background instead of rectangle
  preserveAlignment: boolean;   // Adjust rotation for field curvature compensation
  dragToPosition: boolean;      // Enable drag to reposition FOV rectangle
  frameStyle: 'solid' | 'dashed' | 'dotted';
}

export interface OcularDisplaySettings {
  enabled: boolean;
  opacity: number;
  showCrosshair: boolean;
  appliedFov: number | null;
}

export type FOVSimulatorTab = 'camera' | 'optics' | 'mosaic' | 'display';
export type FOVInputMode = 'manual' | 'active-equipment';

export interface FOVSetup {
  id: string;
  name: string;
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  pixelSize: number;
  rotationAngle: number;
  mosaic: MosaicSettings;
  fovDisplay: FOVDisplaySettings;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Store State
// ============================================================================

interface EquipmentState {
  // Active equipment
  activeCameraId: string | null;
  activeTelescopeId: string | null;
  
  // Current settings (can be from preset or manual)
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  pixelSize: number;
  aperture: number;
  rotationAngle: number;
  
  // Mosaic settings
  mosaic: MosaicSettings;
  
  // FOV display settings
  fovDisplay: FOVDisplaySettings;
  ocularDisplay: OcularDisplaySettings;
  
  // Exposure defaults
  exposureDefaults: ExposureDefaults;
  
  // Custom presets (user-defined, not from Tauri)
  customCameras: CameraPreset[];
  customTelescopes: TelescopePreset[];
  
  // Ocular simulator custom equipment
  customEyepieces: EyepiecePreset[];
  customBarlows: BarlowPreset[];
  customOcularTelescopes: OcularTelescopePreset[];

  // FOV simulator workflow state
  fovSetups: FOVSetup[];
  selectedFovSetupId: string | null;
  fovSimulatorLastTab: FOVSimulatorTab;
  fovInputMode: FOVInputMode;
  selectedBarlowReducerId: string | null;
  framePlacement: FramePlacement;
  
  // Actions - Equipment selection
  setActiveCamera: (id: string | null) => void;
  setActiveTelescope: (id: string | null) => void;
  
  // Actions - Manual settings
  setSensorWidth: (width: number) => void;
  setSensorHeight: (height: number) => void;
  setFocalLength: (length: number) => void;
  setPixelSize: (size: number) => void;
  setAperture: (aperture: number) => void;
  setRotationAngle: (angle: number) => void;
  
  // Actions - Batch update
  setCameraSettings: (settings: {
    sensorWidth?: number;
    sensorHeight?: number;
    pixelSize?: number;
  }) => void;
  setTelescopeSettings: (settings: {
    focalLength?: number;
    aperture?: number;
  }) => void;
  
  // Actions - Mosaic
  setMosaic: (mosaic: MosaicSettings) => void;
  setMosaicEnabled: (enabled: boolean) => void;
  setMosaicGrid: (rows: number, cols: number) => void;
  setMosaicOverlap: (overlap: number, unit?: 'percent' | 'pixels') => void;
  
  // Actions - FOV Display
  setFOVDisplay: (settings: Partial<FOVDisplaySettings>) => void;
  setFOVEnabled: (enabled: boolean) => void;
  setGridType: (type: GridType) => void;
  setOcularDisplay: (settings: Partial<OcularDisplaySettings>) => void;

  // Actions - FOV setup workflow
  saveFovSetup: (name: string) => string | null;
  applyFovSetup: (id: string) => void;
  renameFovSetup: (id: string, name: string) => void;
  removeFovSetup: (id: string) => void;
  setSelectedFovSetupId: (id: string | null) => void;
  setFovSimulatorLastTab: (tab: FOVSimulatorTab) => void;
  setFovInputMode: (mode: FOVInputMode) => void;
  setSelectedBarlowReducerId: (id: string | null) => void;
  setFramePlacement: (placement: FramePlacement) => void;
  resetFramePlacement: () => void;
  
  // Actions - Exposure Defaults
  setExposureDefaults: (defaults: Partial<ExposureDefaults>) => void;
  
  // Actions - Custom Presets
  addCustomCamera: (camera: Omit<CameraPreset, 'id' | 'isCustom'>) => void;
  removeCustomCamera: (id: string) => void;
  updateCustomCamera: (id: string, updates: Partial<CameraPreset>) => void;
  addCustomTelescope: (telescope: Omit<TelescopePreset, 'id' | 'isCustom'>) => void;
  removeCustomTelescope: (id: string) => void;
  updateCustomTelescope: (id: string, updates: Partial<TelescopePreset>) => void;
  
  // Actions - Apply preset
  applyCamera: (camera: CameraPreset) => void;
  applyTelescope: (telescope: TelescopePreset) => void;
  
  // Ocular simulator selection state (persisted)
  selectedOcularTelescopeId: string;
  selectedEyepieceId: string;
  selectedBarlowId: string;
  setSelectedOcularTelescopeId: (id: string) => void;
  setSelectedEyepieceId: (id: string) => void;
  setSelectedBarlowId: (id: string) => void;
  
  // Actions - Ocular equipment
  addCustomEyepiece: (eyepiece: Omit<EyepiecePreset, 'id' | 'isCustom'>) => void;
  removeCustomEyepiece: (id: string) => void;
  updateCustomEyepiece: (id: string, updates: Partial<EyepiecePreset>) => void;
  addCustomBarlow: (barlow: Omit<BarlowPreset, 'id' | 'isCustom'>) => void;
  removeCustomBarlow: (id: string) => void;
  updateCustomBarlow: (id: string, updates: Partial<BarlowPreset>) => void;
  addCustomOcularTelescope: (telescope: Omit<OcularTelescopePreset, 'id' | 'isCustom'>) => void;
  removeCustomOcularTelescope: (id: string) => void;
  updateCustomOcularTelescope: (id: string, updates: Partial<OcularTelescopePreset>) => void;
  
  // Actions - Reset
  resetToDefaults: () => void;
  
  // Computed values (as getters)
  getFOVWidth: () => number;
  getFOVHeight: () => number;
  getImageScale: () => number;
  getFRatio: () => number;
  getResolution: () => { width: number; height: number };
  getMosaicCoverage: () => { width: number; height: number; totalPanels: number } | null;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_MOSAIC: MosaicSettings = {
  enabled: false,
  rows: 2,
  cols: 2,
  overlap: 20,
  overlapUnit: 'percent',
};

const DEFAULT_FOV_DISPLAY: FOVDisplaySettings = {
  enabled: false,
  gridType: 'crosshair',
  showCoordinateGrid: true,
  showConstellations: false,
  showConstellationBoundaries: false,
  showDSOLabels: true,
  overlayOpacity: 80,
  frameColor: '#ef4444',
  // NINA-style defaults
  rotateSky: false,
  preserveAlignment: false,
  dragToPosition: true,
  frameStyle: 'solid',
};

const DEFAULT_OCULAR_DISPLAY: OcularDisplaySettings = {
  enabled: false,
  opacity: 70,
  showCrosshair: true,
  appliedFov: null,
};

const DEFAULT_FOV_SIMULATOR_TAB: FOVSimulatorTab = 'camera';
const DEFAULT_FOV_INPUT_MODE: FOVInputMode = 'manual';
const DEFAULT_FRAME_PLACEMENT: FramePlacement = { x: 0, y: 0 };

const DEFAULT_EXPOSURE: ExposureDefaults = {
  exposureTime: 120,
  gain: 100,
  offset: 30,
  binning: '1x1',
  filter: 'L',
  frameCount: 30,
  ditherEnabled: true,
  ditherEvery: 3,
  tracking: 'guided',
  targetType: 'nebula',
  bortle: 5,
  filterBandwidthNm: 300,
  readNoiseLimitPercent: 5,
  gainStrategy: 'unity',
  manualGain: 100,
  manualReadNoiseEnabled: false,
  manualReadNoise: 1.8,
  manualDarkCurrent: 0.002,
  manualFullWell: 50000,
  manualQE: 0.8,
  manualEPeraDu: 1,
  targetSurfaceBrightness: 22,
  targetSignalRate: 0,
};

// ============================================================================
// Store
// ============================================================================

export const useEquipmentStore = create<EquipmentState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeCameraId: null,
      activeTelescopeId: null,
      
      sensorWidth: 23.5,
      sensorHeight: 15.6,
      focalLength: 400,
      pixelSize: 3.76,
      aperture: 80,
      rotationAngle: 0,
      
      mosaic: DEFAULT_MOSAIC,
      fovDisplay: DEFAULT_FOV_DISPLAY,
      ocularDisplay: DEFAULT_OCULAR_DISPLAY,
      exposureDefaults: DEFAULT_EXPOSURE,
      
      customCameras: [],
      customTelescopes: [],
      customEyepieces: [],
      customBarlows: [],
      customOcularTelescopes: [],
      fovSetups: [],
      selectedFovSetupId: null,
      fovSimulatorLastTab: DEFAULT_FOV_SIMULATOR_TAB,
      fovInputMode: DEFAULT_FOV_INPUT_MODE,
      selectedBarlowReducerId: null,
      framePlacement: DEFAULT_FRAME_PLACEMENT,
      
      // Ocular simulator selection (persisted)
      selectedOcularTelescopeId: 't1',
      selectedEyepieceId: 'e1',
      selectedBarlowId: 'b0',
      setSelectedOcularTelescopeId: (id) => set({ selectedOcularTelescopeId: id }),
      setSelectedEyepieceId: (id) => set({ selectedEyepieceId: id }),
      setSelectedBarlowId: (id) => set({ selectedBarlowId: id }),
      
      // Equipment selection
      setActiveCamera: (id) => set({ activeCameraId: id }),
      setActiveTelescope: (id) => set({ activeTelescopeId: id }),
      
      // Manual settings
      setSensorWidth: (sensorWidth) => set({ sensorWidth, activeCameraId: null, fovInputMode: DEFAULT_FOV_INPUT_MODE }),
      setSensorHeight: (sensorHeight) => set({ sensorHeight, activeCameraId: null, fovInputMode: DEFAULT_FOV_INPUT_MODE }),
      setFocalLength: (focalLength) => set({ focalLength, activeTelescopeId: null, fovInputMode: DEFAULT_FOV_INPUT_MODE }),
      setPixelSize: (pixelSize) => set({ pixelSize, activeCameraId: null, fovInputMode: DEFAULT_FOV_INPUT_MODE }),
      setAperture: (aperture) => set({ aperture, activeTelescopeId: null, fovInputMode: DEFAULT_FOV_INPUT_MODE }),
      setRotationAngle: (rotationAngle) => set({ rotationAngle }),
      
      // Batch update
      setCameraSettings: (settings) => set((state) => ({
        sensorWidth: settings.sensorWidth ?? state.sensorWidth,
        sensorHeight: settings.sensorHeight ?? state.sensorHeight,
        pixelSize: settings.pixelSize ?? state.pixelSize,
        activeCameraId: null,
        fovInputMode: DEFAULT_FOV_INPUT_MODE,
      })),
      
      setTelescopeSettings: (settings) => set((state) => ({
        focalLength: settings.focalLength ?? state.focalLength,
        aperture: settings.aperture ?? state.aperture,
        activeTelescopeId: null,
        fovInputMode: DEFAULT_FOV_INPUT_MODE,
      })),
      
      // Mosaic
      setMosaic: (mosaic) => set({ mosaic }),
      setMosaicEnabled: (enabled) => set((state) => ({
        mosaic: { ...state.mosaic, enabled },
      })),
      setMosaicGrid: (rows, cols) => set((state) => ({
        mosaic: { ...state.mosaic, rows, cols },
      })),
      setMosaicOverlap: (overlap, unit) => set((state) => ({
        mosaic: {
          ...state.mosaic,
          overlap,
          overlapUnit: unit ?? state.mosaic.overlapUnit,
        },
      })),
      
      // FOV Display
      setFOVDisplay: (settings) => set((state) => ({
        fovDisplay: { ...state.fovDisplay, ...settings },
      })),
      setFOVEnabled: (enabled) => set((state) => ({
        fovDisplay: { ...state.fovDisplay, enabled },
      })),
      setGridType: (gridType) => set((state) => ({
        fovDisplay: { ...state.fovDisplay, gridType },
      })),
      setOcularDisplay: (settings) => set((state) => ({
        ocularDisplay: { ...state.ocularDisplay, ...settings },
      })),
      saveFovSetup: (name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return null;

        const now = Date.now();
        const id = `fov-setup-${now}-${Math.random().toString(36).slice(2, 9)}`;

        set((state) => {
          const setup: FOVSetup = {
            id,
            name: trimmedName,
            sensorWidth: state.sensorWidth,
            sensorHeight: state.sensorHeight,
            focalLength: state.focalLength,
            pixelSize: state.pixelSize,
            rotationAngle: state.rotationAngle,
            mosaic: { ...state.mosaic },
            fovDisplay: { ...state.fovDisplay },
            createdAt: now,
            updatedAt: now,
          };

          return {
            fovSetups: [...state.fovSetups, setup],
            selectedFovSetupId: id,
          };
        });

        return id;
      },
      applyFovSetup: (id) => set((state) => {
        const setup = state.fovSetups.find((item) => item.id === id);
        if (!setup) return {};

        return {
          selectedFovSetupId: id,
          sensorWidth: setup.sensorWidth,
          sensorHeight: setup.sensorHeight,
          focalLength: setup.focalLength,
          pixelSize: setup.pixelSize,
          rotationAngle: setup.rotationAngle,
          mosaic: { ...setup.mosaic },
          fovDisplay: { ...setup.fovDisplay },
          fovInputMode: DEFAULT_FOV_INPUT_MODE,
          selectedBarlowReducerId: null,
        };
      }),
      renameFovSetup: (id, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        set((state) => ({
          fovSetups: state.fovSetups.map((setup) =>
            setup.id === id
              ? { ...setup, name: trimmedName, updatedAt: Date.now() }
              : setup
          ),
        }));
      },
      removeFovSetup: (id) => set((state) => ({
        fovSetups: state.fovSetups.filter((setup) => setup.id !== id),
        selectedFovSetupId: state.selectedFovSetupId === id ? null : state.selectedFovSetupId,
      })),
      setSelectedFovSetupId: (id) => set({ selectedFovSetupId: id }),
      setFovSimulatorLastTab: (fovSimulatorLastTab) => set({ fovSimulatorLastTab }),
      setFovInputMode: (fovInputMode) => set({ fovInputMode }),
      setSelectedBarlowReducerId: (selectedBarlowReducerId) => set({ selectedBarlowReducerId }),
      setFramePlacement: (framePlacement) => set({ framePlacement: clampFramePlacement(framePlacement) }),
      resetFramePlacement: () => set({ framePlacement: DEFAULT_FRAME_PLACEMENT }),
      
      // Exposure Defaults
      setExposureDefaults: (defaults) => set((state) => ({
        exposureDefaults: { ...state.exposureDefaults, ...defaults },
      })),
      
      // Custom Cameras
      addCustomCamera: (camera) => {
        const id = `camera-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          customCameras: [...state.customCameras, { ...camera, id, isCustom: true }],
        }));
      },
      
      removeCustomCamera: (id) => set((state) => ({
        customCameras: state.customCameras.filter((c) => c.id !== id),
        activeCameraId: state.activeCameraId === id ? null : state.activeCameraId,
      })),
      
      updateCustomCamera: (id, updates) => set((state) => ({
        customCameras: state.customCameras.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      })),
      
      // Custom Telescopes
      addCustomTelescope: (telescope) => {
        const id = `telescope-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          customTelescopes: [...state.customTelescopes, { ...telescope, id, isCustom: true }],
        }));
      },
      
      removeCustomTelescope: (id) => set((state) => ({
        customTelescopes: state.customTelescopes.filter((t) => t.id !== id),
        activeTelescopeId: state.activeTelescopeId === id ? null : state.activeTelescopeId,
      })),
      
      updateCustomTelescope: (id, updates) => set((state) => ({
        customTelescopes: state.customTelescopes.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),
      
      // Apply preset
      applyCamera: (camera) => set({
        activeCameraId: camera.id,
        sensorWidth: camera.sensorWidth,
        sensorHeight: camera.sensorHeight,
        pixelSize: camera.pixelSize,
      }),
      
      applyTelescope: (telescope) => set({
        activeTelescopeId: telescope.id,
        focalLength: telescope.focalLength,
        aperture: telescope.aperture,
      }),
      
      // Ocular equipment
      addCustomEyepiece: (eyepiece) => {
        const id = `eyepiece-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          customEyepieces: [...state.customEyepieces, { ...eyepiece, id, isCustom: true }],
        }));
      },
      removeCustomEyepiece: (id) => set((state) => ({
        customEyepieces: state.customEyepieces.filter((e) => e.id !== id),
        selectedEyepieceId: state.selectedEyepieceId === id ? 'e1' : state.selectedEyepieceId,
      })),
      updateCustomEyepiece: (id, updates) => set((state) => ({
        customEyepieces: state.customEyepieces.map((e) =>
          e.id === id ? { ...e, ...updates } : e
        ),
      })),
      addCustomBarlow: (barlow) => {
        const id = `barlow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          customBarlows: [...state.customBarlows, { ...barlow, id, isCustom: true }],
        }));
      },
      removeCustomBarlow: (id) => set((state) => ({
        customBarlows: state.customBarlows.filter((b) => b.id !== id),
        selectedBarlowId: state.selectedBarlowId === id ? 'b0' : state.selectedBarlowId,
      })),
      updateCustomBarlow: (id, updates) => set((state) => ({
        customBarlows: state.customBarlows.map((b) =>
          b.id === id ? { ...b, ...updates } : b
        ),
      })),
      addCustomOcularTelescope: (telescope) => {
        const id = `ocular-scope-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        set((state) => ({
          customOcularTelescopes: [...state.customOcularTelescopes, { ...telescope, id, isCustom: true }],
        }));
      },
      removeCustomOcularTelescope: (id) => set((state) => ({
        customOcularTelescopes: state.customOcularTelescopes.filter((t) => t.id !== id),
        selectedOcularTelescopeId: state.selectedOcularTelescopeId === id ? 't1' : state.selectedOcularTelescopeId,
      })),
      updateCustomOcularTelescope: (id, updates) => set((state) => ({
        customOcularTelescopes: state.customOcularTelescopes.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      })),
      
      // Reset
      resetToDefaults: () => set({
        activeCameraId: null,
        activeTelescopeId: null,
        sensorWidth: 23.5,
        sensorHeight: 15.6,
        focalLength: 400,
        pixelSize: 3.76,
        aperture: 80,
        rotationAngle: 0,
        mosaic: DEFAULT_MOSAIC,
        fovDisplay: DEFAULT_FOV_DISPLAY,
        ocularDisplay: DEFAULT_OCULAR_DISPLAY,
        exposureDefaults: DEFAULT_EXPOSURE,
        selectedFovSetupId: null,
        fovSimulatorLastTab: DEFAULT_FOV_SIMULATOR_TAB,
        fovInputMode: DEFAULT_FOV_INPUT_MODE,
        selectedBarlowReducerId: null,
        framePlacement: DEFAULT_FRAME_PLACEMENT,
      }),
      
      // Computed values
      getFOVWidth: () => {
        const { sensorWidth, focalLength } = get();
        return (2 * Math.atan(sensorWidth / (2 * focalLength)) * 180) / Math.PI;
      },
      
      getFOVHeight: () => {
        const { sensorHeight, focalLength } = get();
        return (2 * Math.atan(sensorHeight / (2 * focalLength)) * 180) / Math.PI;
      },
      
      getImageScale: () => {
        const { pixelSize, focalLength } = get();
        return (206.265 * pixelSize) / focalLength;
      },
      
      getFRatio: () => {
        const { focalLength, aperture } = get();
        return aperture > 0 ? focalLength / aperture : 0;
      },
      
      getResolution: () => {
        const { sensorWidth, sensorHeight, pixelSize } = get();
        return {
          width: Math.round((sensorWidth * 1000) / pixelSize),
          height: Math.round((sensorHeight * 1000) / pixelSize),
        };
      },
      
      getMosaicCoverage: () => {
        const { mosaic } = get();
        if (!mosaic.enabled) return null;
        
        const fovWidth = get().getFOVWidth();
        const fovHeight = get().getFOVHeight();
        const resolution = get().getResolution();
        
        const overlapFactor = mosaic.overlapUnit === 'percent'
          ? (1 - mosaic.overlap / 100)
          : (1 - mosaic.overlap / (resolution.width / mosaic.cols));
        
        return {
          width: fovWidth * mosaic.cols * overlapFactor + fovWidth * (1 - overlapFactor),
          height: fovHeight * mosaic.rows * overlapFactor + fovHeight * (1 - overlapFactor),
          totalPanels: mosaic.rows * mosaic.cols,
        };
      },
    }),
    {
      name: 'starmap-equipment',
      storage: getZustandStorage(),
      version: 5,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState;
        }

        const state = persistedState as Record<string, unknown>;
        const persistedExposureDefaults = state.exposureDefaults as Partial<ExposureDefaults> | undefined;
        const persistedOcularDisplay = state.ocularDisplay as Partial<OcularDisplaySettings> | undefined;
        const persistedFovSetups = Array.isArray(state.fovSetups)
          ? (state.fovSetups as Array<Record<string, unknown>>)
          : [];
        const selectedFovSetupId = typeof state.selectedFovSetupId === 'string'
          ? state.selectedFovSetupId
          : null;
        const fovSimulatorLastTab = (
          state.fovSimulatorLastTab === 'camera' ||
          state.fovSimulatorLastTab === 'optics' ||
          state.fovSimulatorLastTab === 'mosaic' ||
          state.fovSimulatorLastTab === 'display'
        )
          ? state.fovSimulatorLastTab
          : DEFAULT_FOV_SIMULATOR_TAB;
        const fovInputMode = state.fovInputMode === 'active-equipment'
          ? 'active-equipment'
          : DEFAULT_FOV_INPUT_MODE;
        const selectedBarlowReducerId = typeof state.selectedBarlowReducerId === 'string'
          ? state.selectedBarlowReducerId
          : null;
        const rawFramePlacement = (state.framePlacement && typeof state.framePlacement === 'object')
          ? (state.framePlacement as Partial<FramePlacement>)
          : DEFAULT_FRAME_PLACEMENT;
        const framePlacement = clampFramePlacement({
          x: typeof rawFramePlacement.x === 'number' ? rawFramePlacement.x : DEFAULT_FRAME_PLACEMENT.x,
          y: typeof rawFramePlacement.y === 'number' ? rawFramePlacement.y : DEFAULT_FRAME_PLACEMENT.y,
        });

        const normalizedFovSetups: FOVSetup[] = persistedFovSetups
          .filter((item): item is Record<string, unknown> =>
            !!item &&
            typeof item === 'object' &&
            typeof item.id === 'string' &&
            typeof item.name === 'string'
          )
          .map((item) => {
            const mosaic = (item.mosaic && typeof item.mosaic === 'object')
              ? (item.mosaic as Partial<MosaicSettings>)
              : {};
            const fovDisplay = (item.fovDisplay && typeof item.fovDisplay === 'object')
              ? (item.fovDisplay as Partial<FOVDisplaySettings>)
              : {};
            return {
              id: item.id as string,
              name: item.name as string,
              sensorWidth: typeof item.sensorWidth === 'number' ? item.sensorWidth : 23.5,
              sensorHeight: typeof item.sensorHeight === 'number' ? item.sensorHeight : 15.6,
              focalLength: typeof item.focalLength === 'number' ? item.focalLength : 400,
              pixelSize: typeof item.pixelSize === 'number' ? item.pixelSize : 3.76,
              rotationAngle: typeof item.rotationAngle === 'number' ? item.rotationAngle : 0,
              mosaic: {
                ...DEFAULT_MOSAIC,
                ...mosaic,
              },
              fovDisplay: {
                ...DEFAULT_FOV_DISPLAY,
                ...fovDisplay,
              },
              createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
              updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
            };
          });

        const hasSelectedSetup = selectedFovSetupId
          ? normalizedFovSetups.some((setup) => setup.id === selectedFovSetupId)
          : false;

        return {
          ...state,
          exposureDefaults: {
            ...DEFAULT_EXPOSURE,
            ...(persistedExposureDefaults ?? {}),
          },
          ocularDisplay: {
            ...DEFAULT_OCULAR_DISPLAY,
            ...(persistedOcularDisplay ?? {}),
          },
          fovSetups: normalizedFovSetups,
          selectedFovSetupId: hasSelectedSetup ? selectedFovSetupId : null,
          fovSimulatorLastTab,
          fovInputMode,
          selectedBarlowReducerId,
          framePlacement,
        };
      },
      partialize: (state) => ({
        activeCameraId: state.activeCameraId,
        activeTelescopeId: state.activeTelescopeId,
        sensorWidth: state.sensorWidth,
        sensorHeight: state.sensorHeight,
        focalLength: state.focalLength,
        pixelSize: state.pixelSize,
        aperture: state.aperture,
        rotationAngle: state.rotationAngle,
        mosaic: state.mosaic,
        fovDisplay: state.fovDisplay,
        ocularDisplay: state.ocularDisplay,
        exposureDefaults: state.exposureDefaults,
        customCameras: state.customCameras,
        customTelescopes: state.customTelescopes,
        customEyepieces: state.customEyepieces,
        customBarlows: state.customBarlows,
        customOcularTelescopes: state.customOcularTelescopes,
        fovSetups: state.fovSetups,
        selectedFovSetupId: state.selectedFovSetupId,
        fovSimulatorLastTab: state.fovSimulatorLastTab,
        fovInputMode: state.fovInputMode,
        selectedBarlowReducerId: state.selectedBarlowReducerId,
        framePlacement: state.framePlacement,
        selectedOcularTelescopeId: state.selectedOcularTelescopeId,
        selectedEyepieceId: state.selectedEyepieceId,
        selectedBarlowId: state.selectedBarlowId,
      }),
    }
  )
);

// ============================================================================
// Built-in Presets
// ============================================================================

export const BUILTIN_CAMERA_PRESETS: CameraPreset[] = [
  // ==================== Full Frame DSLR/Mirrorless ====================
  { id: 'ff-35mm', name: 'Full Frame 35mm (Generic)', sensorWidth: 36, sensorHeight: 24, pixelSize: 4.5, isCustom: false },
  // Sony Full Frame
  { id: 'sony-a7r4', name: 'Sony A7R IV', sensorWidth: 35.7, sensorHeight: 23.8, pixelSize: 3.76, isCustom: false },
  { id: 'sony-a7r5', name: 'Sony A7R V', sensorWidth: 35.7, sensorHeight: 23.8, pixelSize: 3.76, isCustom: false },
  { id: 'sony-a7s3', name: 'Sony A7S III', sensorWidth: 35.6, sensorHeight: 23.8, pixelSize: 8.4, isCustom: false },
  { id: 'sony-a7c', name: 'Sony A7C', sensorWidth: 35.6, sensorHeight: 23.8, pixelSize: 5.9, isCustom: false },
  { id: 'sony-a7m4', name: 'Sony A7 IV', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 5.14, isCustom: false },
  // Canon Full Frame
  { id: 'canon-r5', name: 'Canon EOS R5', sensorWidth: 36, sensorHeight: 24, pixelSize: 4.39, isCustom: false },
  { id: 'canon-r6', name: 'Canon EOS R6', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 7.3, isCustom: false },
  { id: 'canon-r6m2', name: 'Canon EOS R6 II', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 7.3, isCustom: false },
  { id: 'canon-r8', name: 'Canon EOS R8', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 7.3, isCustom: false },
  { id: 'canon-ra', name: 'Canon EOS Ra (Astro)', sensorWidth: 36, sensorHeight: 24, pixelSize: 5.36, isCustom: false },
  { id: 'canon-6d2', name: 'Canon EOS 6D II', sensorWidth: 35.9, sensorHeight: 24, pixelSize: 5.72, isCustom: false },
  { id: 'canon-5d4', name: 'Canon EOS 5D IV', sensorWidth: 36, sensorHeight: 24, pixelSize: 5.36, isCustom: false },
  // Nikon Full Frame
  { id: 'nikon-z7', name: 'Nikon Z7 II', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 4.34, isCustom: false },
  { id: 'nikon-z6', name: 'Nikon Z6 II', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 5.9, isCustom: false },
  { id: 'nikon-z5', name: 'Nikon Z5', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 5.9, isCustom: false },
  { id: 'nikon-z8', name: 'Nikon Z8', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 4.34, isCustom: false },
  { id: 'nikon-d850', name: 'Nikon D850', sensorWidth: 35.9, sensorHeight: 23.9, pixelSize: 4.34, isCustom: false },
  { id: 'nikon-d810a', name: 'Nikon D810A (Astro)', sensorWidth: 35.9, sensorHeight: 24, pixelSize: 4.88, isCustom: false },
  
  // ==================== APS-C / Crop Sensor ====================
  { id: 'apsc-canon', name: 'APS-C Canon (Generic)', sensorWidth: 22.3, sensorHeight: 14.9, pixelSize: 4.3, isCustom: false },
  { id: 'apsc-sony', name: 'APS-C Sony/Nikon (Generic)', sensorWidth: 23.5, sensorHeight: 15.6, pixelSize: 3.9, isCustom: false },
  { id: 'canon-r7', name: 'Canon EOS R7', sensorWidth: 22.3, sensorHeight: 14.8, pixelSize: 3.2, isCustom: false },
  { id: 'canon-r10', name: 'Canon EOS R10', sensorWidth: 22.3, sensorHeight: 14.8, pixelSize: 4.0, isCustom: false },
  { id: 'sony-a6700', name: 'Sony A6700', sensorWidth: 23.5, sensorHeight: 15.6, pixelSize: 3.9, isCustom: false },
  { id: 'sony-a6400', name: 'Sony A6400', sensorWidth: 23.5, sensorHeight: 15.6, pixelSize: 3.9, isCustom: false },
  { id: 'nikon-z50', name: 'Nikon Z50', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 4.22, isCustom: false },
  { id: 'fuji-xt5', name: 'Fujifilm X-T5', sensorWidth: 23.5, sensorHeight: 15.6, pixelSize: 3.9, isCustom: false },
  
  // ==================== Micro Four Thirds ====================
  { id: 'm43', name: 'Micro 4/3 (Generic)', sensorWidth: 17.3, sensorHeight: 13, pixelSize: 3.75, isCustom: false },
  { id: 'olympus-em1m3', name: 'OM System OM-1', sensorWidth: 17.4, sensorHeight: 13.0, pixelSize: 3.3, isCustom: false },
  { id: 'panasonic-gh6', name: 'Panasonic GH6', sensorWidth: 17.3, sensorHeight: 13.0, pixelSize: 3.3, isCustom: false },
  
  // ==================== ZWO ASI Cameras ====================
  // Full Frame
  { id: 'asi6200', name: 'ZWO ASI6200MC Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  { id: 'asi6200mm', name: 'ZWO ASI6200MM Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  { id: 'asi2400', name: 'ZWO ASI2400MC Pro', sensorWidth: 36, sensorHeight: 24, pixelSize: 5.94, isCustom: false },
  // APS-C
  { id: 'asi2600', name: 'ZWO ASI2600MC Pro', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'asi2600mm', name: 'ZWO ASI2600MM Pro', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'asi2600duo', name: 'ZWO ASI2600MC Duo', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'asi071', name: 'ZWO ASI071MC Pro', sensorWidth: 23.6, sensorHeight: 15.6, pixelSize: 4.78, isCustom: false },
  // 4/3 Format
  { id: 'asi294', name: 'ZWO ASI294MC Pro', sensorWidth: 19.1, sensorHeight: 13, pixelSize: 4.63, isCustom: false },
  { id: 'asi294mm', name: 'ZWO ASI294MM Pro', sensorWidth: 19.1, sensorHeight: 13, pixelSize: 4.63, isCustom: false },
  { id: 'asi1600', name: 'ZWO ASI1600MM Pro', sensorWidth: 17.7, sensorHeight: 13.4, pixelSize: 3.8, isCustom: false },
  { id: 'asi1600mc', name: 'ZWO ASI1600MC Pro', sensorWidth: 17.7, sensorHeight: 13.4, pixelSize: 3.8, isCustom: false },
  // 1-inch Format
  { id: 'asi533', name: 'ZWO ASI533MC Pro', sensorWidth: 11.31, sensorHeight: 11.31, pixelSize: 3.76, isCustom: false },
  { id: 'asi533mm', name: 'ZWO ASI533MM Pro', sensorWidth: 11.31, sensorHeight: 11.31, pixelSize: 3.76, isCustom: false },
  { id: 'asi183', name: 'ZWO ASI183MC Pro', sensorWidth: 13.2, sensorHeight: 8.8, pixelSize: 2.4, isCustom: false },
  { id: 'asi183mm', name: 'ZWO ASI183MM Pro', sensorWidth: 13.2, sensorHeight: 8.8, pixelSize: 2.4, isCustom: false },
  // Planetary / Guide
  { id: 'asi290', name: 'ZWO ASI290MM Mini', sensorWidth: 5.6, sensorHeight: 3.2, pixelSize: 2.9, isCustom: false },
  { id: 'asi224', name: 'ZWO ASI224MC', sensorWidth: 4.9, sensorHeight: 3.7, pixelSize: 3.75, isCustom: false },
  { id: 'asi174', name: 'ZWO ASI174MM Mini', sensorWidth: 11.3, sensorHeight: 7.1, pixelSize: 5.86, isCustom: false },
  { id: 'asi120', name: 'ZWO ASI120MM Mini', sensorWidth: 4.8, sensorHeight: 3.6, pixelSize: 3.75, isCustom: false },
  { id: 'asi462', name: 'ZWO ASI462MC', sensorWidth: 5.6, sensorHeight: 3.2, pixelSize: 2.9, isCustom: false },
  { id: 'asi585', name: 'ZWO ASI585MC', sensorWidth: 12.84, sensorHeight: 9.6, pixelSize: 2.9, isCustom: false },
  
  // ==================== QHY Cameras ====================
  // Full Frame
  { id: 'qhy600', name: 'QHY600M', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  { id: 'qhy600c', name: 'QHY600C', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  { id: 'qhy411', name: 'QHY411M', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  // APS-C
  { id: 'qhy268', name: 'QHY268M', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'qhy268c', name: 'QHY268C', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'qhy410c', name: 'QHY410C', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  // 4/3 Format
  { id: 'qhy294', name: 'QHY294M Pro', sensorWidth: 19.1, sensorHeight: 13, pixelSize: 4.63, isCustom: false },
  { id: 'qhy163', name: 'QHY163M', sensorWidth: 17.7, sensorHeight: 13.4, pixelSize: 3.8, isCustom: false },
  // 1-inch Format
  { id: 'qhy533', name: 'QHY533M', sensorWidth: 11.31, sensorHeight: 11.31, pixelSize: 3.76, isCustom: false },
  { id: 'qhy183', name: 'QHY183M', sensorWidth: 13.2, sensorHeight: 8.8, pixelSize: 2.4, isCustom: false },
  { id: 'qhy5iii', name: 'QHY5III678M', sensorWidth: 7.7, sensorHeight: 4.3, pixelSize: 2.0, isCustom: false },
  
  // ==================== Player One Cameras ====================
  { id: 'poseidon-c', name: 'Player One Poseidon-C Pro', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'poseidon-m', name: 'Player One Poseidon-M Pro', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'ares-c', name: 'Player One Ares-C Pro', sensorWidth: 19.1, sensorHeight: 13, pixelSize: 4.63, isCustom: false },
  { id: 'ares-m', name: 'Player One Ares-M Pro', sensorWidth: 19.1, sensorHeight: 13, pixelSize: 4.63, isCustom: false },
  { id: 'neptune-c', name: 'Player One Neptune-C', sensorWidth: 11.31, sensorHeight: 11.31, pixelSize: 3.76, isCustom: false },
  { id: 'neptune-m', name: 'Player One Neptune-M', sensorWidth: 11.31, sensorHeight: 11.31, pixelSize: 3.76, isCustom: false },
  { id: 'uranus-c', name: 'Player One Uranus-C', sensorWidth: 7.9, sensorHeight: 6.3, pixelSize: 2.9, isCustom: false },
  { id: 'mars-c', name: 'Player One Mars-C', sensorWidth: 6.46, sensorHeight: 4.84, pixelSize: 2.9, isCustom: false },
  
  // ==================== Atik Cameras ====================
  { id: 'atik-16200', name: 'Atik 16200', sensorWidth: 27.0, sensorHeight: 21.6, pixelSize: 6.0, isCustom: false },
  { id: 'atik-horizon', name: 'Atik Horizon', sensorWidth: 23.2, sensorHeight: 15.5, pixelSize: 3.8, isCustom: false },
  { id: 'atik-apx60', name: 'Atik ACIS APX60', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  
  // ==================== SBIG Cameras ====================
  { id: 'sbig-stf8300', name: 'SBIG STF-8300M', sensorWidth: 17.96, sensorHeight: 13.52, pixelSize: 5.4, isCustom: false },
  { id: 'sbig-stx16803', name: 'SBIG STX-16803', sensorWidth: 36.8, sensorHeight: 36.8, pixelSize: 9.0, isCustom: false },
  { id: 'sbig-aluma', name: 'SBIG Aluma AC4040', sensorWidth: 36.2, sensorHeight: 36.2, pixelSize: 9.0, isCustom: false },
  
  // ==================== FLI Cameras ====================
  { id: 'fli-kepler4040', name: 'FLI Kepler KL4040', sensorWidth: 36.2, sensorHeight: 36.2, pixelSize: 9.0, isCustom: false },
  { id: 'fli-kepler400', name: 'FLI Kepler KL400', sensorWidth: 22.5, sensorHeight: 22.5, pixelSize: 5.5, isCustom: false },
  
  // ==================== Moravian Cameras ====================
  { id: 'moravian-c3-61000', name: 'Moravian C3-61000', sensorWidth: 36, sensorHeight: 24, pixelSize: 3.76, isCustom: false },
  { id: 'moravian-c3-26000', name: 'Moravian C3-26000', sensorWidth: 23.5, sensorHeight: 15.7, pixelSize: 3.76, isCustom: false },
  { id: 'moravian-g4-16000', name: 'Moravian G4-16000', sensorWidth: 36.0, sensorHeight: 24.0, pixelSize: 6.0, isCustom: false },
];

export const BUILTIN_TELESCOPE_PRESETS: TelescopePreset[] = [
  // ==================== Camera Lenses ====================
  { id: 'samyang-85', name: 'Samyang 85mm f/1.4', focalLength: 85, aperture: 60.7, type: 'Lens', isCustom: false },
  { id: 'samyang-135', name: 'Samyang 135mm f/2', focalLength: 135, aperture: 67.5, type: 'Lens', isCustom: false },
  { id: 'sigma-105', name: 'Sigma 105mm f/1.4', focalLength: 105, aperture: 75, type: 'Lens', isCustom: false },
  { id: 'canon-200', name: 'Canon EF 200mm f/2.8L', focalLength: 200, aperture: 71.4, type: 'Lens', isCustom: false },
  { id: 'sony-200', name: 'Sony FE 200-600mm (200mm)', focalLength: 200, aperture: 35.7, type: 'Lens', isCustom: false },
  { id: 'nikkor-180', name: 'Nikkor 180mm f/2.8', focalLength: 180, aperture: 64.3, type: 'Lens', isCustom: false },
  { id: 'canon-400', name: 'Canon EF 400mm f/5.6L', focalLength: 400, aperture: 71.4, type: 'Lens', isCustom: false },
  
  // ==================== Wide Field APO Refractors ====================
  // William Optics
  { id: 'redcat-51', name: 'William Optics RedCat 51', focalLength: 250, aperture: 51, type: 'APO', isCustom: false },
  { id: 'wo-z61', name: 'William Optics Z61', focalLength: 360, aperture: 61, type: 'APO', isCustom: false },
  { id: 'wo-gt71', name: 'William Optics GT71', focalLength: 420, aperture: 71, type: 'APO', isCustom: false },
  { id: 'wo-flt91', name: 'William Optics FLT91', focalLength: 540, aperture: 91, type: 'APO', isCustom: false },
  { id: 'wo-flt132', name: 'William Optics FLT132', focalLength: 925, aperture: 132, type: 'APO', isCustom: false },
  // Sharpstar
  { id: 'sharpstar-61edph', name: 'Sharpstar 61EDPH II', focalLength: 275, aperture: 61, type: 'APO', isCustom: false },
  { id: 'sharpstar-76edph', name: 'Sharpstar 76EDPH', focalLength: 418, aperture: 76, type: 'APO', isCustom: false },
  { id: 'sharpstar-94edph', name: 'Sharpstar 94EDPH', focalLength: 517, aperture: 94, type: 'APO', isCustom: false },
  // Askar
  { id: 'askar-fra300', name: 'Askar FRA300 Pro', focalLength: 300, aperture: 60, type: 'APO', isCustom: false },
  { id: 'askar-fra400', name: 'Askar FRA400', focalLength: 400, aperture: 72, type: 'APO', isCustom: false },
  { id: 'askar-fra600', name: 'Askar FRA600', focalLength: 600, aperture: 108, type: 'APO', isCustom: false },
  { id: 'askar-80phq', name: 'Askar 80PHQ', focalLength: 400, aperture: 80, type: 'APO', isCustom: false },
  { id: 'askar-103apo', name: 'Askar 103APO', focalLength: 618, aperture: 103, type: 'APO', isCustom: false },
  { id: 'askar-151phq', name: 'Askar 151PHQ', focalLength: 1057, aperture: 151, type: 'APO', isCustom: false },
  // Radian / Starizona
  { id: 'radian-61', name: 'Starizona Radian 61', focalLength: 275, aperture: 61, type: 'APO', isCustom: false },
  { id: 'radian-75', name: 'Starizona Radian 75', focalLength: 300, aperture: 75, type: 'APO', isCustom: false },
  
  // ==================== Premium APO Refractors ====================
  // Sky-Watcher Esprit
  { id: 'esprit-80', name: 'Sky-Watcher Esprit 80ED', focalLength: 400, aperture: 80, type: 'APO', isCustom: false },
  { id: 'esprit-100', name: 'Sky-Watcher Esprit 100ED', focalLength: 550, aperture: 100, type: 'APO', isCustom: false },
  { id: 'esprit-120', name: 'Sky-Watcher Esprit 120ED', focalLength: 840, aperture: 120, type: 'APO', isCustom: false },
  { id: 'esprit-150', name: 'Sky-Watcher Esprit 150ED', focalLength: 1050, aperture: 150, type: 'APO', isCustom: false },
  // Takahashi
  { id: 'fsq-85', name: 'Takahashi FSQ-85ED', focalLength: 450, aperture: 85, type: 'APO', isCustom: false },
  { id: 'fsq-106', name: 'Takahashi FSQ-106ED', focalLength: 530, aperture: 106, type: 'APO', isCustom: false },
  { id: 'toa-130', name: 'Takahashi TOA-130NFB', focalLength: 1000, aperture: 130, type: 'APO', isCustom: false },
  { id: 'toa-150', name: 'Takahashi TOA-150', focalLength: 1100, aperture: 150, type: 'APO', isCustom: false },
  { id: 'fc-76', name: 'Takahashi FC-76DCU', focalLength: 570, aperture: 76, type: 'APO', isCustom: false },
  { id: 'fc-100', name: 'Takahashi FC-100DZ', focalLength: 800, aperture: 100, type: 'APO', isCustom: false },
  // TeleVue
  { id: 'tv-np101', name: 'TeleVue NP101is', focalLength: 540, aperture: 101, type: 'APO', isCustom: false },
  { id: 'tv-np127', name: 'TeleVue NP127fli', focalLength: 660, aperture: 127, type: 'APO', isCustom: false },
  { id: 'tv-85', name: 'TeleVue TV-85', focalLength: 600, aperture: 85, type: 'APO', isCustom: false },
  // APM / LZOS
  { id: 'apm-107', name: 'APM 107/700 LZOS', focalLength: 700, aperture: 107, type: 'APO', isCustom: false },
  { id: 'apm-130', name: 'APM 130/780 LZOS', focalLength: 780, aperture: 130, type: 'APO', isCustom: false },
  { id: 'apm-152', name: 'APM 152/1200 LZOS', focalLength: 1200, aperture: 152, type: 'APO', isCustom: false },
  
  // ==================== Newtonian Reflectors ====================
  { id: 'newton-6', name: 'Newtonian 6" f/4', focalLength: 610, aperture: 150, type: 'Newtonian', isCustom: false },
  { id: 'newton-8', name: 'Newtonian 8" f/4', focalLength: 800, aperture: 200, type: 'Newtonian', isCustom: false },
  { id: 'newton-10', name: 'Newtonian 10" f/4', focalLength: 1000, aperture: 254, type: 'Newtonian', isCustom: false },
  { id: 'newton-12', name: 'Newtonian 12" f/4', focalLength: 1200, aperture: 305, type: 'Newtonian', isCustom: false },
  { id: 'sw-pds150', name: 'Sky-Watcher PDS 150/750', focalLength: 750, aperture: 150, type: 'Newtonian', isCustom: false },
  { id: 'sw-pds200', name: 'Sky-Watcher PDS 200/1000', focalLength: 1000, aperture: 200, type: 'Newtonian', isCustom: false },
  { id: 'sw-quattro8', name: 'Sky-Watcher Quattro 8"', focalLength: 800, aperture: 200, type: 'Newtonian', isCustom: false },
  { id: 'sw-quattro10', name: 'Sky-Watcher Quattro 10"', focalLength: 1000, aperture: 254, type: 'Newtonian', isCustom: false },
  { id: 'sw-quattro12', name: 'Sky-Watcher Quattro 12"', focalLength: 1200, aperture: 305, type: 'Newtonian', isCustom: false },
  
  // ==================== Schmidt-Cassegrain (SCT) ====================
  // Celestron EdgeHD
  { id: 'edge-8', name: 'Celestron EdgeHD 8"', focalLength: 2032, aperture: 203, type: 'SCT', isCustom: false },
  { id: 'edge-925', name: 'Celestron EdgeHD 9.25"', focalLength: 2350, aperture: 235, type: 'SCT', isCustom: false },
  { id: 'edge-11', name: 'Celestron EdgeHD 11"', focalLength: 2800, aperture: 280, type: 'SCT', isCustom: false },
  { id: 'edge-14', name: 'Celestron EdgeHD 14"', focalLength: 3910, aperture: 356, type: 'SCT', isCustom: false },
  // Celestron Standard SCT
  { id: 'c6', name: 'Celestron C6', focalLength: 1500, aperture: 150, type: 'SCT', isCustom: false },
  { id: 'c8', name: 'Celestron C8', focalLength: 2032, aperture: 203, type: 'SCT', isCustom: false },
  { id: 'c925', name: 'Celestron C9.25', focalLength: 2350, aperture: 235, type: 'SCT', isCustom: false },
  { id: 'c11', name: 'Celestron C11', focalLength: 2800, aperture: 280, type: 'SCT', isCustom: false },
  { id: 'c14', name: 'Celestron C14', focalLength: 3910, aperture: 356, type: 'SCT', isCustom: false },
  // Meade ACF
  { id: 'meade-8acf', name: 'Meade 8" ACF', focalLength: 2000, aperture: 203, type: 'SCT', isCustom: false },
  { id: 'meade-10acf', name: 'Meade 10" ACF', focalLength: 2500, aperture: 254, type: 'SCT', isCustom: false },
  { id: 'meade-12acf', name: 'Meade 12" ACF', focalLength: 3048, aperture: 305, type: 'SCT', isCustom: false },
  { id: 'meade-14acf', name: 'Meade 14" ACF', focalLength: 3556, aperture: 356, type: 'SCT', isCustom: false },
  { id: 'meade-16acf', name: 'Meade 16" ACF', focalLength: 4064, aperture: 406, type: 'SCT', isCustom: false },
  
  // ==================== Ritchey-Chrétien (RC) ====================
  { id: 'gso-rc6', name: 'GSO RC 6"', focalLength: 1370, aperture: 152, type: 'RC', isCustom: false },
  { id: 'gso-rc8', name: 'GSO RC 8"', focalLength: 1624, aperture: 203, type: 'RC', isCustom: false },
  { id: 'gso-rc10', name: 'GSO RC 10"', focalLength: 2000, aperture: 254, type: 'RC', isCustom: false },
  { id: 'gso-rc12', name: 'GSO RC 12"', focalLength: 2432, aperture: 305, type: 'RC', isCustom: false },
  { id: 'gso-rc14', name: 'GSO RC 14"', focalLength: 2736, aperture: 356, type: 'RC', isCustom: false },
  { id: 'gso-rc16', name: 'GSO RC 16"', focalLength: 3200, aperture: 406, type: 'RC', isCustom: false },
  { id: 'officina-rc10', name: 'Officina Stellare RC 10"', focalLength: 2000, aperture: 254, type: 'RC', isCustom: false },
  { id: 'officina-rc12', name: 'Officina Stellare RC 12"', focalLength: 2432, aperture: 305, type: 'RC', isCustom: false },
  
  // ==================== Hyperstar / RASA ====================
  { id: 'rasa-8', name: 'Celestron RASA 8"', focalLength: 400, aperture: 203, type: 'RASA', isCustom: false },
  { id: 'rasa-11', name: 'Celestron RASA 11"', focalLength: 620, aperture: 279, type: 'RASA', isCustom: false },
  { id: 'rasa-36', name: 'Celestron RASA 36cm', focalLength: 790, aperture: 360, type: 'RASA', isCustom: false },
  { id: 'hyperstar-8', name: 'Starizona HyperStar C8', focalLength: 406, aperture: 203, type: 'RASA', isCustom: false },
  { id: 'hyperstar-11', name: 'Starizona HyperStar C11', focalLength: 560, aperture: 280, type: 'RASA', isCustom: false },
  { id: 'hyperstar-14', name: 'Starizona HyperStar C14', focalLength: 675, aperture: 356, type: 'RASA', isCustom: false },
  
  // ==================== Maksutov-Cassegrain ====================
  { id: 'mak-90', name: 'Maksutov 90mm', focalLength: 1250, aperture: 90, type: 'Mak', isCustom: false },
  { id: 'mak-127', name: 'Maksutov 127mm', focalLength: 1500, aperture: 127, type: 'Mak', isCustom: false },
  { id: 'mak-150', name: 'Maksutov 150mm', focalLength: 1800, aperture: 150, type: 'Mak', isCustom: false },
  { id: 'mak-180', name: 'Maksutov 180mm', focalLength: 2700, aperture: 180, type: 'Mak', isCustom: false },
  { id: 'sw-mak127', name: 'Sky-Watcher Skymax 127', focalLength: 1500, aperture: 127, type: 'Mak', isCustom: false },
  { id: 'sw-mak180', name: 'Sky-Watcher Skymax 180 Pro', focalLength: 2700, aperture: 180, type: 'Mak', isCustom: false },
];

// Helper function to get all cameras (built-in + custom)
export function getAllCameras(): CameraPreset[] {
  const customCameras = useEquipmentStore.getState().customCameras;
  return [...BUILTIN_CAMERA_PRESETS, ...customCameras];
}

// Helper function to get all telescopes (built-in + custom)
export function getAllTelescopes(): TelescopePreset[] {
  const customTelescopes = useEquipmentStore.getState().customTelescopes;
  return [...BUILTIN_TELESCOPE_PRESETS, ...customTelescopes];
}

// Helper function to find camera by id
export function findCameraById(id: string): CameraPreset | undefined {
  return getAllCameras().find((c) => c.id === id);
}

// Helper function to find telescope by id
export function findTelescopeById(id: string): TelescopePreset | undefined {
  return getAllTelescopes().find((t) => t.id === id);
}
