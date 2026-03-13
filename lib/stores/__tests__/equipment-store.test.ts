/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useEquipmentStore, BUILTIN_CAMERA_PRESETS, BUILTIN_TELESCOPE_PRESETS } from '../equipment-store';

describe('useEquipmentStore', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    // Also clear custom presets since resetToDefaults doesn't clear them
    act(() => {
      useEquipmentStore.setState({
        activeCameraId: null,
        activeTelescopeId: null,
        customCameras: [],
        customTelescopes: [],
        customEyepieces: [],
        customBarlows: [],
        customOcularTelescopes: [],
        fovSetups: [],
        selectedFovSetupId: null,
        fovSimulatorLastTab: 'camera',
        fovInputMode: 'manual',
        selectedBarlowReducerId: null,
        framePlacement: { x: 0, y: 0 },
        ocularDisplay: {
          enabled: false,
          opacity: 70,
          showCrosshair: true,
          appliedFov: null,
        },
        selectedOcularTelescopeId: 't1',
        selectedEyepieceId: 'e1',
        selectedBarlowId: 'b0',
      });
      useEquipmentStore.getState().resetToDefaults();
    });
  });

  describe('initial state', () => {
    it('should have default values', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.activeCameraId).toBeNull();
      expect(state.activeTelescopeId).toBeNull();
      expect(state.sensorWidth).toBe(23.5);
      expect(state.sensorHeight).toBe(15.6);
      expect(state.focalLength).toBe(400);
      expect(state.pixelSize).toBe(3.76);
      expect(state.aperture).toBe(80);
      expect(state.rotationAngle).toBe(0);
    });

    it('should have default mosaic settings', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.mosaic.enabled).toBe(false);
      expect(state.mosaic.rows).toBe(2);
      expect(state.mosaic.cols).toBe(2);
      expect(state.mosaic.overlap).toBe(20);
      expect(state.mosaic.overlapUnit).toBe('percent');
    });

    it('should have default FOV display settings', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.fovDisplay.enabled).toBe(false);
      expect(state.fovDisplay.gridType).toBe('crosshair');
      expect(state.fovDisplay.showCoordinateGrid).toBe(true);
    });

    it('should have empty custom presets', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.customCameras).toEqual([]);
      expect(state.customTelescopes).toEqual([]);
      expect(state.customEyepieces).toEqual([]);
      expect(state.customBarlows).toEqual([]);
      expect(state.customOcularTelescopes).toEqual([]);
    });

    it('should have default ocular selection', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.selectedOcularTelescopeId).toBe('t1');
      expect(state.selectedEyepieceId).toBe('e1');
      expect(state.selectedBarlowId).toBe('b0');
    });

    it('should have default FOV workflow state', () => {
      const state = useEquipmentStore.getState() as ReturnType<typeof useEquipmentStore.getState> & {
        fovInputMode?: string;
        selectedBarlowReducerId?: string | null;
        framePlacement?: { x: number; y: number };
      };

      expect(state.fovInputMode).toBe('manual');
      expect(state.selectedBarlowReducerId).toBeNull();
      expect(state.framePlacement).toEqual({ x: 0, y: 0 });
    });
  });

  describe('equipment selection', () => {
    it('should set active camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setActiveCamera('camera-1');
      });
      
      expect(result.current.activeCameraId).toBe('camera-1');
    });

    it('should set active telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setActiveTelescope('telescope-1');
      });
      
      expect(result.current.activeTelescopeId).toBe('telescope-1');
    });
  });

  describe('manual settings', () => {
    it('should update sensor width and clear active camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setActiveCamera('camera-1');
        result.current.setSensorWidth(36);
      });
      
      expect(result.current.sensorWidth).toBe(36);
      expect(result.current.activeCameraId).toBeNull();
    });

    it('should update sensor height', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setSensorHeight(24);
      });
      
      expect(result.current.sensorHeight).toBe(24);
    });

    it('should update focal length and clear active telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setActiveTelescope('telescope-1');
        result.current.setFocalLength(1000);
      });
      
      expect(result.current.focalLength).toBe(1000);
      expect(result.current.activeTelescopeId).toBeNull();
    });

    it('should update pixel size', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setPixelSize(4.5);
      });
      
      expect(result.current.pixelSize).toBe(4.5);
    });

    it('should update aperture', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setAperture(200);
      });
      
      expect(result.current.aperture).toBe(200);
    });

    it('should update rotation angle', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setRotationAngle(45);
      });
      
      expect(result.current.rotationAngle).toBe(45);
    });
  });

  describe('batch updates', () => {
    it('should update camera settings', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setCameraSettings({
          sensorWidth: 36,
          sensorHeight: 24,
          pixelSize: 4.5,
        });
      });
      
      expect(result.current.sensorWidth).toBe(36);
      expect(result.current.sensorHeight).toBe(24);
      expect(result.current.pixelSize).toBe(4.5);
    });

    it('should update telescope settings', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setTelescopeSettings({
          focalLength: 1000,
          aperture: 200,
        });
      });
      
      expect(result.current.focalLength).toBe(1000);
      expect(result.current.aperture).toBe(200);
    });
  });

  describe('mosaic settings', () => {
    it('should update entire mosaic settings', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setMosaic({
          enabled: true,
          rows: 3,
          cols: 4,
          overlap: 30,
          overlapUnit: 'percent',
        });
      });
      
      expect(result.current.mosaic.enabled).toBe(true);
      expect(result.current.mosaic.rows).toBe(3);
      expect(result.current.mosaic.cols).toBe(4);
    });

    it('should toggle mosaic enabled', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setMosaicEnabled(true);
      });
      
      expect(result.current.mosaic.enabled).toBe(true);
    });

    it('should update mosaic grid', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setMosaicGrid(3, 4);
      });
      
      expect(result.current.mosaic.rows).toBe(3);
      expect(result.current.mosaic.cols).toBe(4);
    });

    it('should update mosaic overlap', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setMosaicOverlap(25, 'pixels');
      });
      
      expect(result.current.mosaic.overlap).toBe(25);
      expect(result.current.mosaic.overlapUnit).toBe('pixels');
    });
  });

  describe('FOV display settings', () => {
    it('should update FOV display settings', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setFOVDisplay({
          enabled: true,
          gridType: 'golden',
          frameColor: '#00ff00',
        });
      });
      
      expect(result.current.fovDisplay.enabled).toBe(true);
      expect(result.current.fovDisplay.gridType).toBe('golden');
      expect(result.current.fovDisplay.frameColor).toBe('#00ff00');
    });

    it('should toggle FOV enabled', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setFOVEnabled(true);
      });
      
      expect(result.current.fovDisplay.enabled).toBe(true);
    });

    it('should set grid type', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setGridType('thirds');
      });
      
      expect(result.current.fovDisplay.gridType).toBe('thirds');
    });

    it('should update ocular display settings', () => {
      const { result } = renderHook(() => useEquipmentStore());

      act(() => {
        result.current.setOcularDisplay({
          enabled: true,
          opacity: 85,
          appliedFov: 1.25,
          showCrosshair: false,
        });
      });

      expect(result.current.ocularDisplay.enabled).toBe(true);
      expect(result.current.ocularDisplay.opacity).toBe(85);
      expect(result.current.ocularDisplay.appliedFov).toBe(1.25);
      expect(result.current.ocularDisplay.showCrosshair).toBe(false);
    });
  });

  describe('fov setup workflow', () => {
    it('should update workflow mode, accessory selection, and frame placement', () => {
      const { result } = renderHook(() => useEquipmentStore()) as {
        result: { current: ReturnType<typeof useEquipmentStore.getState> & {
          setFovInputMode?: (mode: 'manual' | 'active-equipment') => void;
          setSelectedBarlowReducerId?: (id: string | null) => void;
          setFramePlacement?: (placement: { x: number; y: number }) => void;
          resetFramePlacement?: () => void;
          fovInputMode?: string;
          selectedBarlowReducerId?: string | null;
          framePlacement?: { x: number; y: number };
        } };
      };

      act(() => {
        result.current.setFovInputMode?.('active-equipment');
        result.current.setSelectedBarlowReducerId?.('barlow-2x');
        result.current.setFramePlacement?.({ x: 0.35, y: -0.2 });
      });

      expect(result.current.fovInputMode).toBe('active-equipment');
      expect(result.current.selectedBarlowReducerId).toBe('barlow-2x');
      expect(result.current.framePlacement).toEqual({ x: 0.35, y: -0.2 });

      act(() => {
        result.current.resetFramePlacement?.();
      });

      expect(result.current.framePlacement).toEqual({ x: 0, y: 0 });
    });

    it('should save setup snapshot and select it', () => {
      const { result } = renderHook(() => useEquipmentStore());

      act(() => {
        result.current.setSensorWidth(30);
        result.current.setSensorHeight(20);
        result.current.setFocalLength(800);
        result.current.setPixelSize(2.4);
        result.current.setRotationAngle(25);
        result.current.setMosaic({
          enabled: true,
          rows: 3,
          cols: 2,
          overlap: 20,
          overlapUnit: 'percent',
        });
        result.current.setFOVDisplay({
          enabled: true,
          gridType: 'thirds',
          frameColor: '#00ff00',
          frameStyle: 'dashed',
        });
      });

      let savedId: string | null = null;
      act(() => {
        savedId = result.current.saveFovSetup('Widefield');
      });

      expect(savedId).toBeTruthy();
      expect(result.current.fovSetups).toHaveLength(1);
      expect(result.current.fovSetups[0].name).toBe('Widefield');
      expect(result.current.selectedFovSetupId).toBe(savedId);
      expect(result.current.fovSetups[0].sensorWidth).toBe(30);
      expect(result.current.fovSetups[0].mosaic.rows).toBe(3);
      expect(result.current.fovSetups[0].fovDisplay.gridType).toBe('thirds');
    });

    it('should apply setup values', () => {
      const { result } = renderHook(() => useEquipmentStore()) as {
        result: { current: ReturnType<typeof useEquipmentStore.getState> & {
          setFovInputMode?: (mode: 'manual' | 'active-equipment') => void;
          setSelectedBarlowReducerId?: (id: string | null) => void;
          fovInputMode?: string;
          selectedBarlowReducerId?: string | null;
        } };
      };

      let savedId: string | null = null;
      act(() => {
        result.current.setSensorWidth(36);
        result.current.setSensorHeight(24);
        result.current.setFocalLength(400);
        result.current.setPixelSize(3.76);
        result.current.setRotationAngle(0);
        savedId = result.current.saveFovSetup('Base');
      });

      act(() => {
        result.current.setSensorWidth(10);
        result.current.setSensorHeight(10);
        result.current.setFocalLength(1200);
        result.current.setPixelSize(1.5);
        result.current.setRotationAngle(55);
        result.current.setFovInputMode?.('active-equipment');
        result.current.setSelectedBarlowReducerId?.('barlow-2x');
      });

      act(() => {
        if (savedId) {
          result.current.applyFovSetup(savedId);
        }
      });

      expect(result.current.sensorWidth).toBe(36);
      expect(result.current.sensorHeight).toBe(24);
      expect(result.current.focalLength).toBe(400);
      expect(result.current.pixelSize).toBe(3.76);
      expect(result.current.rotationAngle).toBe(0);
      expect(result.current.selectedFovSetupId).toBe(savedId);
      expect(result.current.fovInputMode).toBe('manual');
      expect(result.current.selectedBarlowReducerId).toBeNull();
    });

    it('should rename and remove setup', () => {
      const { result } = renderHook(() => useEquipmentStore());

      let savedId: string | null = null;
      act(() => {
        savedId = result.current.saveFovSetup('Old Name');
      });

      act(() => {
        if (savedId) {
          result.current.renameFovSetup(savedId, 'New Name');
        }
      });

      expect(result.current.fovSetups[0].name).toBe('New Name');

      act(() => {
        if (savedId) {
          result.current.removeFovSetup(savedId);
        }
      });

      expect(result.current.fovSetups).toHaveLength(0);
      expect(result.current.selectedFovSetupId).toBeNull();
    });

    it('should persist simulator tab selection', () => {
      const { result } = renderHook(() => useEquipmentStore());

      act(() => {
        result.current.setFovSimulatorLastTab('mosaic');
      });

      expect(result.current.fovSimulatorLastTab).toBe('mosaic');
    });

    it('migration should inject defaults for fov workflow fields', () => {
      const migrate = useEquipmentStore.persist?.getOptions().migrate;
      expect(typeof migrate).toBe('function');
      if (!migrate) return;

      const migrated = migrate({
        exposureDefaults: { exposureTime: 240 },
        ocularDisplay: { enabled: true },
      } as Record<string, unknown>, 3);

      const migratedState = migrated as Record<string, unknown>;
      expect(Array.isArray(migratedState.fovSetups)).toBe(true);
      expect(migratedState.selectedFovSetupId).toBeNull();
      expect(migratedState.fovSimulatorLastTab).toBe('camera');
      expect(migratedState.fovInputMode).toBe('manual');
      expect(migratedState.selectedBarlowReducerId).toBeNull();
      expect(migratedState.framePlacement).toEqual({ x: 0, y: 0 });
    });

    it('migration should clear invalid workflow references and clamp frame placement', () => {
      const migrate = useEquipmentStore.persist?.getOptions().migrate;
      expect(typeof migrate).toBe('function');
      if (!migrate) return;

      const migrated = migrate({
        fovInputMode: 'active-equipment',
        selectedBarlowReducerId: 123,
        framePlacement: { x: 2.4, y: -3.1 },
      } as Record<string, unknown>, 4);

      const migratedState = migrated as Record<string, unknown> & {
        selectedBarlowReducerId?: string | null;
        framePlacement?: { x: number; y: number };
      };

      expect(migratedState.selectedBarlowReducerId).toBeNull();
      expect(migratedState.framePlacement).toEqual({ x: 1, y: -1 });
    });
  });

  describe('exposure defaults', () => {
    it('should update exposure defaults', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setExposureDefaults({
          exposureTime: 300,
          gain: 150,
          binning: '2x2',
        });
      });
      
      expect(result.current.exposureDefaults.exposureTime).toBe(300);
      expect(result.current.exposureDefaults.gain).toBe(150);
      expect(result.current.exposureDefaults.binning).toBe('2x2');
    });
  });

  describe('custom presets', () => {
    it('should add custom camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomCamera({
          name: 'My Camera',
          sensorWidth: 36,
          sensorHeight: 24,
          pixelSize: 4.5,
        });
      });
      
      expect(result.current.customCameras).toHaveLength(1);
      expect(result.current.customCameras[0].name).toBe('My Camera');
      expect(result.current.customCameras[0].isCustom).toBe(true);
    });

    it('should remove custom camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      // First add the camera
      act(() => {
        result.current.addCustomCamera({
          name: 'My Camera',
          sensorWidth: 36,
          sensorHeight: 24,
          pixelSize: 4.5,
        });
      });
      
      expect(result.current.customCameras).toHaveLength(1);
      const cameraId = result.current.customCameras[0].id;
      
      // Then remove it
      act(() => {
        result.current.removeCustomCamera(cameraId);
      });
      
      expect(result.current.customCameras).toHaveLength(0);
    });

    it('should clear active camera when removing active custom camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomCamera({
          name: 'My Camera',
          sensorWidth: 36,
          sensorHeight: 24,
          pixelSize: 4.5,
        });
      });
      
      const cameraId = result.current.customCameras[0].id;
      
      act(() => {
        result.current.setActiveCamera(cameraId);
        result.current.removeCustomCamera(cameraId);
      });
      
      expect(result.current.activeCameraId).toBeNull();
    });

    it('should update custom camera', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomCamera({
          name: 'My Camera',
          sensorWidth: 36,
          sensorHeight: 24,
          pixelSize: 4.5,
        });
      });
      
      const cameraId = result.current.customCameras[0].id;
      
      act(() => {
        result.current.updateCustomCamera(cameraId, { name: 'Updated Camera' });
      });
      
      expect(result.current.customCameras[0].name).toBe('Updated Camera');
    });

    it('should add custom telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomTelescope({
          name: 'My Telescope',
          focalLength: 1000,
          aperture: 200,
          type: 'Newtonian',
        });
      });
      
      expect(result.current.customTelescopes).toHaveLength(1);
      expect(result.current.customTelescopes[0].name).toBe('My Telescope');
    });

    it('should remove custom telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      // First add the telescope
      act(() => {
        result.current.addCustomTelescope({
          name: 'My Telescope',
          focalLength: 1000,
          aperture: 200,
          type: 'Newtonian',
        });
      });
      
      expect(result.current.customTelescopes).toHaveLength(1);
      const telescopeId = result.current.customTelescopes[0].id;
      
      // Then remove it
      act(() => {
        result.current.removeCustomTelescope(telescopeId);
      });
      
      expect(result.current.customTelescopes).toHaveLength(0);
    });

    it('should update custom telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomTelescope({
          name: 'My Telescope',
          focalLength: 1000,
          aperture: 200,
          type: 'Newtonian',
        });
      });
      
      const telescopeId = result.current.customTelescopes[0].id;
      
      act(() => {
        result.current.updateCustomTelescope(telescopeId, { focalLength: 1200 });
      });
      
      expect(result.current.customTelescopes[0].focalLength).toBe(1200);
    });
  });

  describe('apply preset', () => {
    it('should apply camera preset', () => {
      const { result } = renderHook(() => useEquipmentStore());
      const preset = BUILTIN_CAMERA_PRESETS[0];
      
      act(() => {
        result.current.applyCamera(preset);
      });
      
      expect(result.current.activeCameraId).toBe(preset.id);
      expect(result.current.sensorWidth).toBe(preset.sensorWidth);
      expect(result.current.sensorHeight).toBe(preset.sensorHeight);
      expect(result.current.pixelSize).toBe(preset.pixelSize);
    });

    it('should apply telescope preset', () => {
      const { result } = renderHook(() => useEquipmentStore());
      const preset = BUILTIN_TELESCOPE_PRESETS[0];
      
      act(() => {
        result.current.applyTelescope(preset);
      });
      
      expect(result.current.activeTelescopeId).toBe(preset.id);
      expect(result.current.focalLength).toBe(preset.focalLength);
      expect(result.current.aperture).toBe(preset.aperture);
    });
  });

  describe('computed values', () => {
    it('should calculate FOV width', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      // With default values: sensorWidth=23.5, focalLength=400
      const fovWidth = result.current.getFOVWidth();
      
      expect(fovWidth).toBeGreaterThan(0);
      expect(fovWidth).toBeLessThan(10); // Reasonable FOV
    });

    it('should calculate FOV height', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      const fovHeight = result.current.getFOVHeight();
      
      expect(fovHeight).toBeGreaterThan(0);
      expect(fovHeight).toBeLessThan(10);
    });

    it('should calculate image scale', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      // Image scale in arcsec/pixel
      const imageScale = result.current.getImageScale();
      
      expect(imageScale).toBeGreaterThan(0);
      expect(imageScale).toBeLessThan(10); // Reasonable scale
    });

    it('should calculate f-ratio', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      // focalLength/aperture = 400/80 = 5
      const fRatio = result.current.getFRatio();
      
      expect(fRatio).toBe(5);
    });

    it('should handle zero aperture in f-ratio', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setAperture(0);
      });
      
      const fRatio = result.current.getFRatio();
      
      expect(fRatio).toBe(0);
    });

    it('should calculate resolution', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      const resolution = result.current.getResolution();
      
      expect(resolution.width).toBeGreaterThan(0);
      expect(resolution.height).toBeGreaterThan(0);
    });

    it('should return null mosaic coverage when disabled', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      const coverage = result.current.getMosaicCoverage();
      
      expect(coverage).toBeNull();
    });

    it('should calculate mosaic coverage when enabled', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setMosaicEnabled(true);
        result.current.setMosaicGrid(2, 3);
      });
      
      const coverage = result.current.getMosaicCoverage();
      
      expect(coverage).not.toBeNull();
      expect(coverage?.totalPanels).toBe(6);
      expect(coverage?.width).toBeGreaterThan(0);
      expect(coverage?.height).toBeGreaterThan(0);
    });
  });

  describe('ocular simulator selection state', () => {
    it('should have default ocular selection IDs', () => {
      const state = useEquipmentStore.getState();
      
      expect(state.selectedOcularTelescopeId).toBe('t1');
      expect(state.selectedEyepieceId).toBe('e1');
      expect(state.selectedBarlowId).toBe('b0');
    });

    it('should set selected ocular telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setSelectedOcularTelescopeId('t3');
      });
      
      expect(result.current.selectedOcularTelescopeId).toBe('t3');
    });

    it('should set selected eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setSelectedEyepieceId('e5');
      });
      
      expect(result.current.selectedEyepieceId).toBe('e5');
    });

    it('should set selected barlow', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setSelectedBarlowId('b2');
      });
      
      expect(result.current.selectedBarlowId).toBe('b2');
    });
  });

  describe('custom ocular equipment', () => {
    it('should add custom eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomEyepiece({
          name: 'My Eyepiece',
          focalLength: 12,
          afov: 68,
          fieldStop: 13.5,
        });
      });
      
      expect(result.current.customEyepieces).toHaveLength(1);
      expect(result.current.customEyepieces[0].name).toBe('My Eyepiece');
      expect(result.current.customEyepieces[0].focalLength).toBe(12);
      expect(result.current.customEyepieces[0].afov).toBe(68);
      expect(result.current.customEyepieces[0].fieldStop).toBe(13.5);
      expect(result.current.customEyepieces[0].isCustom).toBe(true);
      expect(result.current.customEyepieces[0].id).toContain('eyepiece-');
    });

    it('should remove custom eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomEyepiece({ name: 'EP1', focalLength: 10, afov: 52 });
      });
      
      const id = result.current.customEyepieces[0].id;
      
      act(() => {
        result.current.removeCustomEyepiece(id);
      });
      
      expect(result.current.customEyepieces).toHaveLength(0);
    });

    it('should reset eyepiece selection when removing selected custom eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomEyepiece({ name: 'EP1', focalLength: 10, afov: 52 });
      });
      
      const id = result.current.customEyepieces[0].id;
      
      act(() => {
        result.current.setSelectedEyepieceId(id);
      });
      
      expect(result.current.selectedEyepieceId).toBe(id);
      
      act(() => {
        result.current.removeCustomEyepiece(id);
      });
      
      expect(result.current.selectedEyepieceId).toBe('e1');
    });

    it('should update custom eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomEyepiece({ name: 'EP1', focalLength: 10, afov: 52 });
      });
      
      const id = result.current.customEyepieces[0].id;
      
      act(() => {
        result.current.updateCustomEyepiece(id, { name: 'Updated EP', afov: 68 });
      });
      
      expect(result.current.customEyepieces[0].name).toBe('Updated EP');
      expect(result.current.customEyepieces[0].afov).toBe(68);
      expect(result.current.customEyepieces[0].focalLength).toBe(10);
    });

    it('should add custom barlow', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomBarlow({ name: 'My 1.5x', magnification: 1.5 });
      });
      
      expect(result.current.customBarlows).toHaveLength(1);
      expect(result.current.customBarlows[0].name).toBe('My 1.5x');
      expect(result.current.customBarlows[0].magnification).toBe(1.5);
      expect(result.current.customBarlows[0].isCustom).toBe(true);
    });

    it('should remove custom barlow and reset selection', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomBarlow({ name: 'B1', magnification: 1.5 });
      });
      
      const id = result.current.customBarlows[0].id;
      
      act(() => {
        result.current.setSelectedBarlowId(id);
        result.current.removeCustomBarlow(id);
      });
      
      expect(result.current.customBarlows).toHaveLength(0);
      expect(result.current.selectedBarlowId).toBe('b0');
    });

    it('should update custom barlow', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomBarlow({ name: 'B1', magnification: 1.5 });
      });
      
      const id = result.current.customBarlows[0].id;
      
      act(() => {
        result.current.updateCustomBarlow(id, { magnification: 1.8 });
      });
      
      expect(result.current.customBarlows[0].magnification).toBe(1.8);
    });

    it('should add custom ocular telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomOcularTelescope({
          name: 'My SCT',
          focalLength: 2032,
          aperture: 203,
          type: 'catadioptric',
        });
      });
      
      expect(result.current.customOcularTelescopes).toHaveLength(1);
      expect(result.current.customOcularTelescopes[0].name).toBe('My SCT');
      expect(result.current.customOcularTelescopes[0].type).toBe('catadioptric');
      expect(result.current.customOcularTelescopes[0].isCustom).toBe(true);
    });

    it('should remove custom ocular telescope and reset selection', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomOcularTelescope({
          name: 'OT1', focalLength: 1000, aperture: 200, type: 'reflector',
        });
      });
      
      const id = result.current.customOcularTelescopes[0].id;
      
      act(() => {
        result.current.setSelectedOcularTelescopeId(id);
        result.current.removeCustomOcularTelescope(id);
      });
      
      expect(result.current.customOcularTelescopes).toHaveLength(0);
      expect(result.current.selectedOcularTelescopeId).toBe('t1');
    });

    it('should update custom ocular telescope', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomOcularTelescope({
          name: 'OT1', focalLength: 1000, aperture: 200, type: 'reflector',
        });
      });
      
      const id = result.current.customOcularTelescopes[0].id;
      
      act(() => {
        result.current.updateCustomOcularTelescope(id, { name: 'Updated OT', aperture: 250 });
      });
      
      expect(result.current.customOcularTelescopes[0].name).toBe('Updated OT');
      expect(result.current.customOcularTelescopes[0].aperture).toBe(250);
      expect(result.current.customOcularTelescopes[0].focalLength).toBe(1000);
    });

    it('should not reset selection when removing non-selected custom eyepiece', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.addCustomEyepiece({ name: 'EP1', focalLength: 10, afov: 52 });
        result.current.addCustomEyepiece({ name: 'EP2', focalLength: 15, afov: 60 });
      });
      
      const id1 = result.current.customEyepieces[0].id;
      const id2 = result.current.customEyepieces[1].id;
      
      act(() => {
        result.current.setSelectedEyepieceId(id2);
        result.current.removeCustomEyepiece(id1);
      });
      
      expect(result.current.selectedEyepieceId).toBe(id2);
      expect(result.current.customEyepieces).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should reset to defaults', () => {
      const { result } = renderHook(() => useEquipmentStore());
      
      act(() => {
        result.current.setSensorWidth(50);
        result.current.setFocalLength(2000);
        result.current.setMosaicEnabled(true);
        result.current.resetToDefaults();
      });
      
      expect(result.current.sensorWidth).toBe(23.5);
      expect(result.current.focalLength).toBe(400);
      expect(result.current.mosaic.enabled).toBe(false);
      expect(result.current.ocularDisplay.enabled).toBe(false);
      expect(result.current.ocularDisplay.appliedFov).toBeNull();
    });
  });

  describe('builtin presets', () => {
    it('should have camera presets', () => {
      expect(BUILTIN_CAMERA_PRESETS.length).toBeGreaterThan(0);
      
      BUILTIN_CAMERA_PRESETS.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.sensorWidth).toBeGreaterThan(0);
        expect(preset.sensorHeight).toBeGreaterThan(0);
        expect(preset.pixelSize).toBeGreaterThan(0);
      });
    });

    it('should have telescope presets', () => {
      expect(BUILTIN_TELESCOPE_PRESETS.length).toBeGreaterThan(0);
      
      BUILTIN_TELESCOPE_PRESETS.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.focalLength).toBeGreaterThan(0);
        expect(preset.aperture).toBeGreaterThan(0);
      });
    });
  });
});
