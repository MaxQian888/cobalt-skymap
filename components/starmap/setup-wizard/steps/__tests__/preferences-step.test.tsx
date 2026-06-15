import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferencesStep } from '../preferences-step';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';
import { useSettingsStore } from '@/lib/stores/settings-store';

// Note: next-intl is globally mocked in jest.setup.ts to return translation keys

describe('PreferencesStep', () => {
  beforeEach(() => {
    // Reset stores
    useSetupWizardStore.getState().resetSetup();
    // Reset settings to defaults
    useSettingsStore.setState({
      stellarium: {
        constellationsLinesVisible: true,
        constellationArtVisible: false,
        constellationLabelsVisible: true,
        constellationBoundariesVisible: false,
        starLabelsVisible: true,
        planetLabelsVisible: true,
        azimuthalLinesVisible: false,
        equatorialLinesVisible: false,
        equatorialJnowLinesVisible: false,
        meridianLinesVisible: false,
        eclipticLinesVisible: false,
        horizonLinesVisible: false,
        galacticLinesVisible: false,
        atmosphereVisible: false,
        landscapesVisible: false,
        dsosVisible: true,
        milkyWayVisible: true,
        fogVisible: false,
        surveyEnabled: true,
        surveyId: 'dss',
        surveyUrl: undefined,
        skyCulture: 'western',
        skyCultureLanguage: 'native',
        nightMode: false,
        sensorControl: false,
        sensorAbsolutePreferred: true,
        sensorUseCompassHeading: true,
        sensorUpdateHz: 30,
        sensorDeadbandDeg: 0.35,
        sensorSmoothingFactor: 0.2,
        sensorCalibrationRequired: true,
        sensorCalibrationAzimuthOffsetDeg: 0,
        sensorCalibrationAltitudeOffsetDeg: 0,
        sensorCalibrationUpdatedAt: null,
        crosshairVisible: true,
        crosshairColor: 'rgba(255, 255, 255, 0.3)',
        projectionType: 'stereographic',
        bortleIndex: 3,
        starLinearScale: 0.8,
        starRelativeScale: 1.1,
        displayLimitMag: 99,
        flipViewVertical: false,
        flipViewHorizontal: false,
        exposureScale: 2,
        tonemapperP: 0.5,
        mountFrame: 5,
        viewYOffset: 0,
        arMode: false,
        arOpacity: 0.5,
        arShowCompass: true,
      },
    });
  });

  describe('rendering', () => {
    it('should render the preferences step description', () => {
      render(<PreferencesStep />);
      
      expect(screen.getByText(/preferences\.description/i)).toBeInTheDocument();
    });

    it('should render language selection section', () => {
      render(<PreferencesStep />);
      
      expect(screen.getByText(/preferences\.objectLanguage$/i)).toBeInTheDocument();
      expect(screen.getByText(/preferences\.objectLanguageDesc/i)).toBeInTheDocument();
    });

    it('should render display options section', () => {
      render(<PreferencesStep />);
      
      expect(screen.getByText(/preferences\.displayOptions/i)).toBeInTheDocument();
    });

    it('should render all display toggle options', () => {
      render(<PreferencesStep />);
      
      expect(screen.getByText(/preferences\.constellationLines$/i)).toBeInTheDocument();
      expect(screen.getByText(/preferences\.deepSkyObjects$/i)).toBeInTheDocument();
      expect(screen.getByText(/preferences\.equatorialGrid$/i)).toBeInTheDocument();
      expect(screen.getByText(/preferences\.nightMode$/i)).toBeInTheDocument();
    });

    it('should render tip message', () => {
      render(<PreferencesStep />);
      
      expect(screen.getByText(/preferences\.tipMessage/i)).toBeInTheDocument();
    });
  });

  describe('language selection', () => {
    it('should display current language selection', () => {
      render(<PreferencesStep />);
      
      // Default is 'native'
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should change language when selecting a different option', async () => {
      render(<PreferencesStep />);
      
      // Click on the select trigger
      const selectTrigger = screen.getByRole('combobox');
      fireEvent.click(selectTrigger);

      // Wait for options to appear and click English
      await waitFor(() => {
        const englishOption = screen.getByText(/settings\.languageEnglish/i);
        fireEvent.click(englishOption);
      });

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.skyCultureLanguage).toBe('en');
      });
    });

    it('should allow selecting Chinese language', async () => {
      render(<PreferencesStep />);
      
      const selectTrigger = screen.getByRole('combobox');
      fireEvent.click(selectTrigger);

      await waitFor(() => {
        const chineseOption = screen.getByText(/settings\.languageChinese/i);
        fireEvent.click(chineseOption);
      });

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.skyCultureLanguage).toBe('zh');
      });
    });
  });

  describe('display toggles', () => {
    it('should toggle constellation lines', async () => {
      render(<PreferencesStep />);
      
      const initialValue = useSettingsStore.getState().stellarium.constellationsLinesVisible;
      
      // Find the switch for constellation lines
      const switches = screen.getAllByRole('switch');
      const constellationSwitch = switches[0]; // First switch is constellation lines
      
      fireEvent.click(constellationSwitch);

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.constellationsLinesVisible).toBe(!initialValue);
      });
    });

    it('should toggle deep sky objects', async () => {
      render(<PreferencesStep />);
      
      const initialValue = useSettingsStore.getState().stellarium.dsosVisible;
      
      const switches = screen.getAllByRole('switch');
      const dsoSwitch = switches[1]; // Second switch is DSOs
      
      fireEvent.click(dsoSwitch);

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.dsosVisible).toBe(!initialValue);
      });
    });

    it('should toggle equatorial grid', async () => {
      render(<PreferencesStep />);
      
      const initialValue = useSettingsStore.getState().stellarium.equatorialLinesVisible;
      
      const switches = screen.getAllByRole('switch');
      const gridSwitch = switches[2]; // Third switch is equatorial grid
      
      fireEvent.click(gridSwitch);

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.equatorialLinesVisible).toBe(!initialValue);
      });
    });

    it('should toggle night mode', async () => {
      render(<PreferencesStep />);
      
      const initialValue = useSettingsStore.getState().stellarium.nightMode;
      
      const switches = screen.getAllByRole('switch');
      const nightModeSwitch = switches[3]; // Fourth switch is night mode
      
      fireEvent.click(nightModeSwitch);

      await waitFor(() => {
        const store = useSettingsStore.getState();
        expect(store.stellarium.nightMode).toBe(!initialValue);
      });
    });

    it('should reflect initial store state in switches', () => {
      // Set some values before rendering
      useSettingsStore.setState({
        stellarium: {
          ...useSettingsStore.getState().stellarium,
          constellationsLinesVisible: false,
          dsosVisible: false,
          equatorialLinesVisible: true,
          nightMode: true,
        },
      });

      render(<PreferencesStep />);
      
      const switches = screen.getAllByRole('switch');
      
      // Constellation lines should be unchecked
      expect(switches[0]).not.toBeChecked();
      // DSOs should be unchecked
      expect(switches[1]).not.toBeChecked();
      // Equatorial grid should be checked
      expect(switches[2]).toBeChecked();
      // Night mode should be checked
      expect(switches[3]).toBeChecked();
    });
  });

  describe('store integration', () => {
    it('should update setupData on mount', async () => {
      render(<PreferencesStep />);
      
      await waitFor(() => {
        const store = useSetupWizardStore.getState();
        expect(store.setupData.preferencesConfigured).toBe(true);
      });
    });

    it('should persist toggle changes to store', async () => {
      render(<PreferencesStep />);
      
      // Toggle all switches
      const switches = screen.getAllByRole('switch');
      
      for (const switchElement of switches) {
        fireEvent.click(switchElement);
      }

      await waitFor(() => {
        const store = useSettingsStore.getState();
        // All values should be toggled from their defaults
        expect(store.stellarium.constellationsLinesVisible).toBe(false); // Was true
        expect(store.stellarium.dsosVisible).toBe(false); // Was true
        expect(store.stellarium.equatorialLinesVisible).toBe(true); // Was false
        expect(store.stellarium.nightMode).toBe(true); // Was false
      });
    });
  });

  describe('visual styling', () => {
    it('should render toggle options with proper structure', () => {
      render(<PreferencesStep />);
      
      // Constellation lines toggle should exist
      const constellationText = screen.getByText(/preferences\.constellationLines$/i);
      expect(constellationText).toBeInTheDocument();
      // The toggle should be within a container element
      expect(constellationText.closest('div')).toBeInTheDocument();
    });

    it('should render all toggle options in containers', () => {
      render(<PreferencesStep />);
      
      // All toggle options should be properly contained
      const gridText = screen.getByText(/preferences\.equatorialGrid$/i);
      expect(gridText).toBeInTheDocument();
      expect(gridText.closest('div')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have accessible switch labels', () => {
      render(<PreferencesStep />);
      
      const switches = screen.getAllByRole('switch');
      
      // Each switch should be accessible
      expect(switches.length).toBe(4);
      switches.forEach((switchElement) => {
        expect(switchElement).toBeInTheDocument();
      });
    });

    it('should have accessible language select', () => {
      render(<PreferencesStep />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });
});
