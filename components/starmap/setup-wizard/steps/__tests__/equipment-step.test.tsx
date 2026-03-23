import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EquipmentStep } from '../equipment-step';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';
import { useEquipmentStore, BUILTIN_CAMERA_PRESETS, BUILTIN_TELESCOPE_PRESETS } from '@/lib/stores/equipment-store';

// Note: next-intl is globally mocked in jest.setup.ts to return translation keys

describe('EquipmentStep', () => {
  beforeEach(() => {
    // Reset stores
    useSetupWizardStore.getState().resetSetup();
    useEquipmentStore.getState().resetToDefaults();
  });

  describe('rendering', () => {
    it('should render the equipment step description', () => {
      render(<EquipmentStep />);
      
      expect(screen.getByText(/equipment\.description/i)).toBeInTheDocument();
    });

    it('should render telescope and camera sections', () => {
      render(<EquipmentStep />);
      
      expect(screen.getByText(/equipment\.telescope$/i)).toBeInTheDocument();
      expect(screen.getByText(/equipment\.camera$/i)).toBeInTheDocument();
    });

    it('should render skip note', () => {
      render(<EquipmentStep />);
      
      expect(screen.getByText(/equipment\.skipNote/i)).toBeInTheDocument();
    });

    it('should display preset telescopes', () => {
      render(<EquipmentStep />);
      
      // Check that at least some presets are displayed
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      expect(screen.getByText(firstTelescope.name)).toBeInTheDocument();
    });

    it('should display preset cameras', () => {
      render(<EquipmentStep />);
      
      // Check that at least some presets are displayed
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      expect(screen.getByText(firstCamera.name)).toBeInTheDocument();
    });
  });

  describe('telescope selection', () => {
    it('should select a telescope preset when clicked', async () => {
      render(<EquipmentStep />);
      
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.activeTelescopeId).toBe(firstTelescope.id);
        expect(store.focalLength).toBe(firstTelescope.focalLength);
        expect(store.aperture).toBe(firstTelescope.aperture);
      });
    });

    it('should show check mark when telescope is selected', async () => {
      render(<EquipmentStep />);
      
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        // The telescope section header should show a check mark
        const telescopeHeader = screen.getByText(/equipment\.telescope$/i).closest('button');
        expect(telescopeHeader?.querySelector('svg.lucide-check')).toBeInTheDocument();
      });
    });

    it('should show manual input form when clicking manual input button', () => {
      render(<EquipmentStep />);
      
      // Find the manual input button in telescope section
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]); // First one is for telescope

      // Use getAllByText since focalLength appears in multiple places (label and configured summary)
      const focalLengthElements = screen.getAllByText(/fov\.focalLength/i);
      expect(focalLengthElements.length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText(/focalLengthPlaceholder/i)).toBeInTheDocument();
    });

    it('should apply manual telescope settings', async () => {
      render(<EquipmentStep />);
      
      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);

      // Fill in values
      const focalLengthInput = screen.getByPlaceholderText(/focalLengthPlaceholder/i);
      const apertureInput = screen.getByPlaceholderText(/aperturePlaceholder/i);

      fireEvent.change(focalLengthInput, { target: { value: '800' } });
      fireEvent.change(apertureInput, { target: { value: '150' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.focalLength).toBe(800);
        expect(store.aperture).toBe(150);
      });
    });

    it('should cancel manual input when clicking cancel', () => {
      render(<EquipmentStep />);
      
      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);

      // Should show Cancel button now
      expect(screen.getByText(/common\.cancel/i)).toBeInTheDocument();

      // Click cancel
      fireEvent.click(screen.getByText(/common\.cancel/i));

      // Manual form should be hidden
      expect(screen.queryByPlaceholderText(/focalLengthPlaceholder/i)).not.toBeInTheDocument();
    });
  });

  describe('camera selection', () => {
    it('should select a camera preset when clicked', async () => {
      render(<EquipmentStep />);
      
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.activeCameraId).toBe(firstCamera.id);
        expect(store.sensorWidth).toBe(firstCamera.sensorWidth);
        expect(store.sensorHeight).toBe(firstCamera.sensorHeight);
        expect(store.pixelSize).toBe(firstCamera.pixelSize);
      });
    });

    it('should show check mark when camera is selected', async () => {
      render(<EquipmentStep />);
      
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      await waitFor(() => {
        // The camera section header should show a check mark
        const cameraHeader = screen.getByText(/equipment\.camera$/i).closest('button');
        expect(cameraHeader?.querySelector('svg.lucide-check')).toBeInTheDocument();
      });
    });

    it('should show manual camera input form', () => {
      render(<EquipmentStep />);
      
      // Find the manual input button in camera section
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]); // Second one is for camera

      // Check that manual input fields are shown by looking for placeholders
      expect(screen.getByPlaceholderText(/sensorWidthPlaceholder/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/sensorHeightPlaceholder/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/pixelSizePlaceholder/i)).toBeInTheDocument();
    });

    it('should apply manual camera settings', async () => {
      render(<EquipmentStep />);
      
      // Open manual input for camera
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]);

      // Fill in values
      const sensorWidthInput = screen.getByPlaceholderText(/sensorWidthPlaceholder/i);
      const sensorHeightInput = screen.getByPlaceholderText(/sensorHeightPlaceholder/i);
      const pixelSizeInput = screen.getByPlaceholderText(/pixelSizePlaceholder/i);

      fireEvent.change(sensorWidthInput, { target: { value: '23.5' } });
      fireEvent.change(sensorHeightInput, { target: { value: '15.6' } });
      fireEvent.change(pixelSizeInput, { target: { value: '4.5' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.sensorWidth).toBe(23.5);
        expect(store.sensorHeight).toBe(15.6);
        expect(store.pixelSize).toBe(4.5);
      });
    });
  });

  describe('collapsible sections', () => {
    it('should collapse telescope section when clicking header', async () => {
      render(<EquipmentStep />);
      
      const telescopeHeader = screen.getByText(/equipment\.telescope$/i).closest('button');
      
      // Initially, presets should be visible
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      expect(screen.getByText(firstTelescope.name)).toBeInTheDocument();

      // Click to collapse
      if (telescopeHeader) {
        fireEvent.click(telescopeHeader);
      }

      // Content should be hidden after collapse
      await waitFor(() => {
        expect(screen.queryByText(firstTelescope.name)).not.toBeInTheDocument();
      });
    });

    it('should collapse camera section when clicking header', async () => {
      render(<EquipmentStep />);
      
      const cameraHeader = screen.getByText(/equipment\.camera$/i).closest('button');
      
      // Initially, presets should be visible
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      expect(screen.getByText(firstCamera.name)).toBeInTheDocument();

      // Click to collapse
      if (cameraHeader) {
        fireEvent.click(cameraHeader);
      }

      // Content should be hidden after collapse
      await waitFor(() => {
        expect(screen.queryByText(firstCamera.name)).not.toBeInTheDocument();
      });
    });
  });

  describe('configured state', () => {
    it('should show configured summary when equipment is set', async () => {
      render(<EquipmentStep />);
      
      // Select a telescope
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        expect(screen.getByText(/equipment\.configured/i)).toBeInTheDocument();
      });
    });

    it('should display focal length in configured summary', async () => {
      render(<EquipmentStep />);
      
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        // The text contains translation key + actual value - use getAllByText since value may appear multiple times
        const matches = screen.getAllByText(new RegExp(`${firstTelescope.focalLength}mm`));
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('should display sensor dimensions in configured summary', async () => {
      render(<EquipmentStep />);
      
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      await waitFor(() => {
        // The text contains sensor dimensions - use getAllByText since value may appear multiple times
        const matches = screen.getAllByText(new RegExp(`${firstCamera.sensorWidth}×${firstCamera.sensorHeight}mm`));
        expect(matches.length).toBeGreaterThan(0);
      });
    });
  });

  describe('store integration', () => {
    it('should update setupData when equipment is configured', async () => {
      render(<EquipmentStep />);
      
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        const store = useSetupWizardStore.getState();
        expect(store.setupData.equipmentConfigured).toBe(true);
      });
    });

    it('should reflect store state when pre-configured', () => {
      // Pre-configure equipment
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      useEquipmentStore.getState().applyTelescope(firstTelescope);

      render(<EquipmentStep />);
      
      // Should show configured state
      expect(screen.getByText(/equipment\.configured/i)).toBeInTheDocument();
    });
  });

  describe('manual input validation', () => {
    it('should not apply telescope settings with invalid focal length', async () => {
      render(<EquipmentStep />);
      
      const initialFocalLength = useEquipmentStore.getState().focalLength;

      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);

      // Fill in invalid value
      const focalLengthInput = screen.getByPlaceholderText(/focalLengthPlaceholder/i);
      fireEvent.change(focalLengthInput, { target: { value: '0' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should not change focal length
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.focalLength).toBe(initialFocalLength);
      });
    });

    it('should not apply camera settings with invalid sensor dimensions', async () => {
      render(<EquipmentStep />);
      
      const initialSensorWidth = useEquipmentStore.getState().sensorWidth;

      // Open manual input for camera
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]);

      // Fill in invalid values
      const sensorWidthInput = screen.getByPlaceholderText(/sensorWidthPlaceholder/i);
      const sensorHeightInput = screen.getByPlaceholderText(/sensorHeightPlaceholder/i);

      fireEvent.change(sensorWidthInput, { target: { value: '-10' } });
      fireEvent.change(sensorHeightInput, { target: { value: '0' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should not change sensor width
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.sensorWidth).toBe(initialSensorWidth);
      });
    });

    it('should not apply telescope settings with NaN focal length', async () => {
      render(<EquipmentStep />);
      
      const initialFocalLength = useEquipmentStore.getState().focalLength;

      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);

      // Fill in NaN value
      const focalLengthInput = screen.getByPlaceholderText(/focalLengthPlaceholder/i);
      fireEvent.change(focalLengthInput, { target: { value: 'abc' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should not change focal length
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.focalLength).toBe(initialFocalLength);
      });
    });

    it('should apply telescope settings with valid focal length but invalid aperture', async () => {
      render(<EquipmentStep />);

      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);

      // Fill in valid focal length but invalid aperture
      const focalLengthInput = screen.getByPlaceholderText(/focalLengthPlaceholder/i);
      const apertureInput = screen.getByPlaceholderText(/aperturePlaceholder/i);

      fireEvent.change(focalLengthInput, { target: { value: '500' } });
      fireEvent.change(apertureInput, { target: { value: '-50' } }); // Invalid aperture

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should apply focal length, aperture should be undefined or unchanged
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.focalLength).toBe(500);
      });
    });

    it('should apply camera settings with valid dimensions but invalid pixel size', async () => {
      render(<EquipmentStep />);

      // Open manual input for camera
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]);

      // Fill in valid sensor dimensions but invalid pixel size
      const sensorWidthInput = screen.getByPlaceholderText(/sensorWidthPlaceholder/i);
      const sensorHeightInput = screen.getByPlaceholderText(/sensorHeightPlaceholder/i);
      const pixelSizeInput = screen.getByPlaceholderText(/pixelSizePlaceholder/i);

      fireEvent.change(sensorWidthInput, { target: { value: '22.5' } });
      fireEvent.change(sensorHeightInput, { target: { value: '15' } });
      fireEvent.change(pixelSizeInput, { target: { value: '-1' } }); // Invalid pixel size

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should apply sensor dimensions
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.sensorWidth).toBe(22.5);
        expect(store.sensorHeight).toBe(15);
      });
    });

    it('should not apply camera settings with NaN sensor width', async () => {
      render(<EquipmentStep />);
      
      const initialSensorWidth = useEquipmentStore.getState().sensorWidth;

      // Open manual input for camera
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]);

      // Fill in NaN values
      const sensorWidthInput = screen.getByPlaceholderText(/sensorWidthPlaceholder/i);
      const sensorHeightInput = screen.getByPlaceholderText(/sensorHeightPlaceholder/i);

      fireEvent.change(sensorWidthInput, { target: { value: 'not a number' } });
      fireEvent.change(sensorHeightInput, { target: { value: '24' } });

      // Click apply
      const applyButtons = screen.getAllByText(/common\.apply/i);
      fireEvent.click(applyButtons[0]);

      // Should not change sensor width
      await waitFor(() => {
        const store = useEquipmentStore.getState();
        expect(store.sensorWidth).toBe(initialSensorWidth);
      });
    });
  });

  describe('equipment summary display', () => {
    it('should show configured summary with focal length only', async () => {
      // Set only telescope settings
      useEquipmentStore.getState().setTelescopeSettings({ focalLength: 750 });

      render(<EquipmentStep />);

      await waitFor(() => {
        expect(screen.getByText(/equipment\.configured/i)).toBeInTheDocument();
        const matches = screen.getAllByText(/750mm/);
        expect(matches.length).toBeGreaterThan(0);
      });
    });

    it('should show configured summary with both telescope and camera', async () => {
      // Set both telescope and camera settings
      useEquipmentStore.getState().setTelescopeSettings({ focalLength: 600 });
      useEquipmentStore.getState().setCameraSettings({ sensorWidth: 30, sensorHeight: 20 });

      render(<EquipmentStep />);

      await waitFor(() => {
        expect(screen.getByText(/equipment\.configured/i)).toBeInTheDocument();
        const focalLengthMatches = screen.getAllByText(/600mm/);
        expect(focalLengthMatches.length).toBeGreaterThan(0);
        const sensorMatches = screen.getAllByText(/30×20mm/);
        expect(sensorMatches.length).toBeGreaterThan(0);
      });
    });

    it('should show equipment configured message based on hasEquipment condition', () => {
      // The component shows configured when activeCameraId, activeTelescopeId, or focalLength > 0
      // After resetToDefaults, focalLength may still be > 0 (default value), so configured shows
      render(<EquipmentStep />);

      expect(screen.queryByText(/equipment\.configured/i)).not.toBeInTheDocument();
    });
  });

  describe('preset selection styling', () => {
    it('should highlight selected telescope preset', async () => {
      render(<EquipmentStep />);
      
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      
      // Initially should not have selected styling
      expect(telescopeButton).toHaveClass('border-border');
      
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        // After selection, should have primary border
        const selectedButton = screen.getByText(firstTelescope.name).closest('button');
        expect(selectedButton).toHaveClass('border-primary');
      });
    });

    it('should highlight selected camera preset', async () => {
      render(<EquipmentStep />);
      
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      
      // Initially should not have selected styling
      expect(cameraButton).toHaveClass('border-border');
      
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      await waitFor(() => {
        // After selection, should have primary border
        const selectedButton = screen.getByText(firstCamera.name).closest('button');
        expect(selectedButton).toHaveClass('border-primary');
      });
    });
  });

  describe('check mark indicators', () => {
    it('should show check mark next to telescope header when telescope is selected', async () => {
      render(<EquipmentStep />);
      
      // Initially no check mark in telescope header
      const telescopeHeader = screen.getByText(/equipment\.telescope$/i).closest('button');
      expect(telescopeHeader?.querySelector('svg.lucide-check')).not.toBeInTheDocument();
      
      // Select a telescope
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      await waitFor(() => {
        const updatedHeader = screen.getByText(/equipment\.telescope$/i).closest('button');
        expect(updatedHeader?.querySelector('svg.lucide-check')).toBeInTheDocument();
      });
    });

    it('should show check mark next to camera header when camera is selected', async () => {
      render(<EquipmentStep />);
      
      // Initially no check mark in camera header
      const cameraHeader = screen.getByText(/equipment\.camera$/i).closest('button');
      expect(cameraHeader?.querySelector('svg.lucide-check')).not.toBeInTheDocument();
      
      // Select a camera
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      await waitFor(() => {
        const updatedHeader = screen.getByText(/equipment\.camera$/i).closest('button');
        expect(updatedHeader?.querySelector('svg.lucide-check')).toBeInTheDocument();
      });
    });
  });

  describe('manual input toggle behavior', () => {
    it('should hide manual telescope form when preset is selected', () => {
      render(<EquipmentStep />);
      
      // Open manual input
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[0]);
      
      // Verify manual form is visible
      expect(screen.getByPlaceholderText(/focalLengthPlaceholder/i)).toBeInTheDocument();
      
      // Select a preset telescope
      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      const telescopeButton = screen.getByText(firstTelescope.name).closest('button');
      if (telescopeButton) {
        fireEvent.click(telescopeButton);
      }

      expect(screen.queryByPlaceholderText(/focalLengthPlaceholder/i)).not.toBeInTheDocument();
    });

    it('should hide manual camera form when preset is selected', () => {
      render(<EquipmentStep />);
      
      // Open manual input for camera
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      fireEvent.click(manualButtons[1]);
      
      // Verify manual form is visible
      expect(screen.getByPlaceholderText(/sensorWidthPlaceholder/i)).toBeInTheDocument();
      
      // Select a preset camera
      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      const cameraButton = screen.getByText(firstCamera.name).closest('button');
      if (cameraButton) {
        fireEvent.click(cameraButton);
      }

      expect(screen.queryByPlaceholderText(/sensorWidthPlaceholder/i)).not.toBeInTheDocument();
    });

    it('should toggle manual telescope form visibility', () => {
      render(<EquipmentStep />);
      
      const manualButtons = screen.getAllByText(/equipment\.manualInput/i);
      
      // Initially hidden
      expect(screen.queryByPlaceholderText(/focalLengthPlaceholder/i)).not.toBeInTheDocument();
      
      // Click to show
      fireEvent.click(manualButtons[0]);
      expect(screen.getByPlaceholderText(/focalLengthPlaceholder/i)).toBeInTheDocument();
      
      // Button should now show "Cancel"
      expect(screen.getByText(/common\.cancel/i)).toBeInTheDocument();
      
      // Click to hide
      fireEvent.click(screen.getByText(/common\.cancel/i));
      expect(screen.queryByPlaceholderText(/focalLengthPlaceholder/i)).not.toBeInTheDocument();
    });
  });

  describe('search filtering', () => {
    it('should filter telescopes by search term', () => {
      render(<EquipmentStep />);

      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];
      expect(screen.getByText(firstTelescope.name)).toBeInTheDocument();

      // Type a search term that won't match any telescope
      const searchInputs = screen.getAllByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(searchInputs[0], { target: { value: 'zzz_no_match_zzz' } });

      // First telescope should be filtered out
      expect(screen.queryByText(firstTelescope.name)).not.toBeInTheDocument();
    });

    it('should filter cameras by search term', () => {
      render(<EquipmentStep />);

      const firstCamera = BUILTIN_CAMERA_PRESETS[0];
      expect(screen.getByText(firstCamera.name)).toBeInTheDocument();

      // Type a search term that won't match any camera
      const searchInputs = screen.getAllByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(searchInputs[1], { target: { value: 'zzz_no_match_zzz' } });

      // First camera should be filtered out
      expect(screen.queryByText(firstCamera.name)).not.toBeInTheDocument();
    });

    it('should show matching telescopes when search term matches', () => {
      render(<EquipmentStep />);

      const firstTelescope = BUILTIN_TELESCOPE_PRESETS[0];

      // Search by part of the first telescope name
      const searchInputs = screen.getAllByPlaceholderText(/searchPlaceholder/i);
      fireEvent.change(searchInputs[0], { target: { value: firstTelescope.name.substring(0, 3) } });

      expect(screen.getByText(firstTelescope.name)).toBeInTheDocument();
    });
  });
});
