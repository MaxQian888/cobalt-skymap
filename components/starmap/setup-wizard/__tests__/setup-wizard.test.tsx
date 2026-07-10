import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import * as setupWizardExports from '../index';
import * as setupWizardStepExports from '../steps';
import { SetupWizard } from '../setup-wizard';
import { SetupWizardButton } from '../setup-wizard-button';
import { CompleteStep } from '../steps/complete-step';
import { EquipmentStep } from '../steps/equipment-step';
import { LocationStep } from '../steps/location-step';
import { PreferencesStep } from '../steps/preferences-step';
import { WelcomeStep } from '../steps/welcome-step';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';

// Mock next-intl
const messages = {
  setupWizard: {
    back: 'Back',
    next: 'Next',
    skipSetup: 'Skip Setup',
    getStarted: 'Get Started',
    restartSetup: 'Restart Setup',
    steps: {
      welcome: {
        title: 'Welcome',
        subtitle: "Let's set up your Cobalt Skymap",
        description: 'Complete a few quick steps.',
        whatWellConfigure: "What we'll configure:",
        timeEstimate: 'Estimated time: ~2 minutes',
        features: {
          location: { title: 'Location', description: 'Set your location' },
          equipment: { title: 'Equipment', description: 'Configure equipment' },
          preferences: { title: 'Preferences', description: 'Set preferences' },
        },
      },
      location: {
        title: 'Location',
        subtitle: 'Set your location',
        description: 'Set your observation location.',
        useGPS: 'Use GPS',
        automatic: 'Automatic',
        enterManually: 'Enter Manually',
        coordinates: 'Coordinates',
        detectLocation: 'Detect Location',
        detecting: 'Detecting...',
        latitude: 'Latitude',
        latitudePlaceholder: '-90 to 90',
        longitude: 'Longitude',
        longitudePlaceholder: '-180 to 180',
        setLocation: 'Set Location',
        locationSet: 'Location Set',
        skipNote: 'You can skip this step.',
        gpsNotSupported: 'GPS not supported',
        permissionDenied: 'Permission denied',
        positionUnavailable: 'Position unavailable',
        timeout: 'Timeout',
        unknownError: 'Unknown error',
      },
      equipment: {
        title: 'Equipment',
        subtitle: 'Configure equipment',
        description: 'Set up your telescope and camera.',
        telescope: 'Telescope',
        camera: 'Camera',
        manualInput: 'Manual Input',
        focalLengthPlaceholder: 'e.g. 1000',
        aperturePlaceholder: 'e.g. 200',
        sensorWidthPlaceholder: 'e.g. 36',
        sensorHeightPlaceholder: 'e.g. 24',
        pixelSizePlaceholder: 'e.g. 3.76',
        configured: 'Configured',
        sensor: 'Sensor',
        skipNote: 'You can skip this step.',
      },
      preferences: {
        title: 'Preferences',
        subtitle: 'Customize your star map',
        description: 'Adjust display options.',
        objectLanguage: 'Object Language',
        objectLanguageDesc: 'Choose language for names',
        displayOptions: 'Display Options',
        constellationLines: 'Constellation Lines',
        constellationLinesDesc: 'Show constellation lines',
        deepSkyObjects: 'Deep Sky Objects',
        deepSkyObjectsDesc: 'Show DSOs',
        equatorialGrid: 'Equatorial Grid',
        equatorialGridDesc: 'Show grid',
        nightMode: 'Night Mode',
        nightModeDesc: 'Red filter',
        tipMessage: 'You can change these anytime.',
      },
      complete: {
        title: 'All Done',
        subtitle: "You're all set!",
        description: 'Setup complete.',
        readyToExplore: 'Ready to explore!',
        quickTips: 'Quick Tips',
        tip1: 'Drag to pan',
        tip2: 'Scroll to zoom',
        tip3: 'Click for details',
      },
    },
  },
  common: {
    cancel: 'Cancel',
    apply: 'Apply',
  },
  fov: {
    focalLength: 'Focal Length',
    sensorWidth: 'Sensor Width',
    sensorHeight: 'Sensor Height',
    pixelSize: 'Pixel Size',
  },
  equipment: {
    aperture: 'Aperture',
  },
  settings: {
    languageNative: 'Native',
    languageEnglish: 'English',
    languageChinese: 'Chinese',
  },
};

const renderWithIntl = (component: React.ReactNode) => {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>
  );
};

describe('SetupWizard', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();

    // Other test files in this suite may replace window.localStorage with custom mocks.
    // Ensure we start each test with a clean, predictable localStorage mock state.
    try {
      (window.localStorage?.clear as unknown as (() => void) | undefined)?.();
      (window.localStorage?.getItem as unknown as { mockReset?: () => void } | undefined)?.mockReset?.();
      (window.localStorage?.setItem as unknown as { mockReset?: () => void } | undefined)?.mockReset?.();
      (window.localStorage?.removeItem as unknown as { mockReset?: () => void } | undefined)?.mockReset?.();
      (window.localStorage?.clear as unknown as { mockReset?: () => void } | undefined)?.mockReset?.();
    } catch {
      // Ignore; localStorage may be a non-mock in some environments.
    }

    // Reset store state
    const store = useSetupWizardStore.getState();
    store.resetSetup();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('rendering', () => {
    it('should not render when closed', () => {
      renderWithIntl(<SetupWizard />);
      
      // Dialog should not be visible initially (unless auto-opened)
      // The wizard auto-opens for first-time users after a delay
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when opened programmatically', async () => {
      renderWithIntl(<SetupWizard />);
      
      // Open the wizard
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should display welcome step initially', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.title/i)).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to next step when clicking next', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.title/i)).toBeInTheDocument();
      });

      // Click next button
      const nextButton = screen.getByText(/setupWizard\.next/i).closest('button')!;
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('location');
      });
    });

    it('should navigate to previous step when clicking back', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.location\.title/i)).toBeInTheDocument();
      });

      // Click back button
      const backButton = screen.getByText(/setupWizard\.back/i).closest('button')!;
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
      });
    });

    it('should not show back button on first step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.title/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/setupWizard\.back/i)).not.toBeInTheDocument();
    });
  });

  describe('completion', () => {
    it('should complete setup when finishing last step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.title/i)).toBeInTheDocument();
      });

      // Click get started button
      const getStartedButton = screen.getByText(/setupWizard\.getStarted/i).closest('button')!;
      fireEvent.click(getStartedButton);

      await waitFor(() => {
        expect(useSetupWizardStore.getState().hasCompletedSetup).toBe(true);
        expect(useSetupWizardStore.getState().isOpen).toBe(false);
      });
    });

    it('should call onComplete callback when finishing', async () => {
      const onComplete = jest.fn();
      renderWithIntl(<SetupWizard onComplete={onComplete} />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.title/i)).toBeInTheDocument();
      });

      const getStartedButton = screen.getByText(/setupWizard\.getStarted/i).closest('button')!;
      fireEvent.click(getStartedButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('skip functionality', () => {
    it('should show skip button on middle steps', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(screen.getByText(/setupWizard\.skipSetup/i)).toBeInTheDocument();
      });
    });

    it('should complete setup when clicking skip', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.location\.title/i)).toBeInTheDocument();
      });

      const skipButton = screen.getByText(/setupWizard\.skipSetup/i).closest('button')!;
      fireEvent.click(skipButton);

      await waitFor(() => {
        expect(useSetupWizardStore.getState().hasCompletedSetup).toBe(true);
      });
    });
  });

  describe('close functionality', () => {
    it('should close when clicking close button', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find and click close button (X icon)
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(btn => btn.querySelector('svg.lucide-x'));
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      await waitFor(() => {
        expect(useSetupWizardStore.getState().isOpen).toBe(false);
      });
    });
  });
});

describe('SetupWizard - additional edge cases', () => {
  beforeEach(() => {
    const store = useSetupWizardStore.getState();
    store.resetSetup();
  });

  describe('step indicators', () => {
    it('should display all step indicators', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Should have 5 step indicators (welcome, location, equipment, preferences, complete)
      const stepIndicators = screen.getAllByRole('dialog')[0].querySelectorAll('.rounded-full.border-2');
      expect(stepIndicators.length).toBe(5);
    });

    it('should mark completed steps with check icon', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('equipment');
        useSetupWizardStore.getState().markStepCompleted('welcome');
        useSetupWizardStore.getState().markStepCompleted('location');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.equipment\.title/i)).toBeInTheDocument();
      });

      // Check that completed steps have check icons
      const checkIcons = screen.getAllByRole('dialog')[0].querySelectorAll('svg.lucide-check');
      expect(checkIcons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('progress bar', () => {
    it('should show progress bar when wizard is open', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('welcome step content', () => {
    it('should display welcome description', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.description/i)).toBeInTheDocument();
      });
    });

    it('should display what we will configure section', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.whatWellConfigure/i)).toBeInTheDocument();
      });
    });

    it('should display feature cards for location, equipment, preferences', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/features\.location\.description/i)).toBeInTheDocument();
        expect(screen.getByText(/features\.equipment\.description/i)).toBeInTheDocument();
        expect(screen.getByText(/features\.preferences\.description/i)).toBeInTheDocument();
      });
    });

    it('should display time estimate', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.timeEstimate/i)).toBeInTheDocument();
      });
    });
  });

  describe('complete step content', () => {
    it('should display completion description', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.description/i)).toBeInTheDocument();
      });
    });

    it('should display ready to explore message', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.readyToExplore/i)).toBeInTheDocument();
      });
    });

    it('should display quick tips', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.quickTips/i)).toBeInTheDocument();
        expect(screen.getByText(/steps\.complete\.tip1/i)).toBeInTheDocument();
        expect(screen.getByText(/steps\.complete\.tip2/i)).toBeInTheDocument();
        expect(screen.getByText(/steps\.complete\.tip3/i)).toBeInTheDocument();
      });
    });
  });

  describe('skip button visibility', () => {
    it('should not show skip button on welcome step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.title/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/setupWizard\.skipSetup/i)).not.toBeInTheDocument();
    });

    it('should not show skip button on complete step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.complete\.title/i)).toBeInTheDocument();
      });

      expect(screen.queryByText(/setupWizard\.skipSetup/i)).not.toBeInTheDocument();
    });

    it('should show skip button on equipment step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('equipment');
      });

      await waitFor(() => {
        expect(screen.getByText(/setupWizard\.skipSetup/i)).toBeInTheDocument();
      });
    });

    it('should show skip button on preferences step', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('preferences');
      });

      await waitFor(() => {
        expect(screen.getByText(/setupWizard\.skipSetup/i)).toBeInTheDocument();
      });
    });
  });

  describe('navigation through all steps', () => {
    it('should navigate through all steps sequentially', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      // Welcome step
      await waitFor(() => {
        expect(screen.getByText(/steps\.welcome\.title/i)).toBeInTheDocument();
      });

      // Go to location
      fireEvent.click(screen.getByText(/setupWizard\.next/i).closest('button')!);
      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('location');
      });

      // Go to equipment
      act(() => {
        useSetupWizardStore.getState().goToStep('equipment');
      });
      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('equipment');
      });

      // Go to preferences
      act(() => {
        useSetupWizardStore.getState().goToStep('preferences');
      });
      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('preferences');
      });

      // Go to complete
      act(() => {
        useSetupWizardStore.getState().goToStep('complete');
      });
      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('complete');
      });
    });
  });

  describe('onComplete callback', () => {
    it('should call onComplete when skipping setup', async () => {
      const onComplete = jest.fn();
      renderWithIntl(<SetupWizard onComplete={onComplete} />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(screen.getByText(/steps\.location\.title/i)).toBeInTheDocument();
      });

      const skipButton = screen.getByText(/setupWizard\.skipSetup/i).closest('button')!;
      fireEvent.click(skipButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate forward with ArrowRight', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      expect(useSetupWizardStore.getState().currentStep).toBe('welcome');

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('location');
      });
    });

    it('should navigate backward with ArrowLeft', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('location');
      });

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
      });
    });

    it('should not navigate with ArrowRight on last step', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().goToStep('complete');
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('complete');
      });

      fireEvent.keyDown(window, { key: 'ArrowRight' });

      expect(useSetupWizardStore.getState().currentStep).toBe('complete');
    });

    it('should not navigate with ArrowLeft on first step', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
      });

      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
    });

    it('should not navigate when focus is on an input element', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const inputEl = document.createElement('input');
      document.body.appendChild(inputEl);
      inputEl.focus();

      // Dispatch native KeyboardEvent from the input so the handler sees target.tagName === 'INPUT'
      act(() => {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      });

      expect(useSetupWizardStore.getState().currentStep).toBe('welcome');

      document.body.removeChild(inputEl);
    });
  });

  describe('step indicator click navigation', () => {
    it('should navigate to a completed step when clicking its indicator', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
        useSetupWizardStore.getState().markStepCompleted('welcome');
        useSetupWizardStore.getState().goToStep('location');
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('location');
      });

      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[0]);

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
      });
    });

    it('should not navigate to a future uncompleted step', async () => {
      renderWithIntl(<SetupWizard />);

      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
      });

      const tabs = screen.getAllByRole('tab');
      const lastTab = tabs[tabs.length - 1];
      fireEvent.click(lastTab);

      expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
    });
  });

  describe('auto-open behavior', () => {
    it('should auto-open for first-time users after delay', async () => {
      jest.useFakeTimers();

      renderWithIntl(<SetupWizard />);

      expect(useSetupWizardStore.getState().isOpen).toBe(false);

      act(() => {
        jest.advanceTimersByTime(900);
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().isOpen).toBe(true);
      });

      jest.useRealTimers();
    });

    it('should not auto-open if setup is already completed', async () => {
      jest.useFakeTimers();

      act(() => {
        useSetupWizardStore.getState().completeSetup();
      });

      renderWithIntl(<SetupWizard />);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(useSetupWizardStore.getState().isOpen).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('dialog open change', () => {
    it('should close wizard when dialog is closed externally', async () => {
      renderWithIntl(<SetupWizard />);
      
      act(() => {
        useSetupWizardStore.getState().openWizard();
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Simulate closing the dialog
      act(() => {
        useSetupWizardStore.getState().closeWizard();
      });

      await waitFor(() => {
        expect(useSetupWizardStore.getState().isOpen).toBe(false);
      });
    });
  });
});

describe('SetupWizardButton', () => {
  beforeEach(() => {
    const store = useSetupWizardStore.getState();
    store.resetSetup();
    store.completeSetup(); // Mark as completed so button shows reset functionality
  });

  it('should render the button', () => {
    renderWithIntl(<SetupWizardButton />);
    
    expect(screen.getByRole('button', { name: /restartSetup/i })).toBeInTheDocument();
  });

  it('should reset and open wizard when clicked', () => {
    renderWithIntl(<SetupWizardButton />);
    
    const button = screen.getByRole('button', { name: /restartSetup/i });
    fireEvent.click(button);

    expect(useSetupWizardStore.getState().hasCompletedSetup).toBe(false);
    expect(useSetupWizardStore.getState().isOpen).toBe(true);
  });

  it('should accept custom variant prop', () => {
    renderWithIntl(<SetupWizardButton variant="default" />);
    
    const button = screen.getByRole('button');
    // Button should render with default variant styling
    expect(button).toBeInTheDocument();
  });

  it('should accept custom className prop', () => {
    renderWithIntl(<SetupWizardButton className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should accept custom size prop', () => {
    renderWithIntl(<SetupWizardButton size="lg" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with icon', () => {
    renderWithIntl(<SetupWizardButton />);
    
    const button = screen.getByRole('button');
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should reset currentStep to welcome when clicked', () => {
    // Set to a different step first
    act(() => {
      useSetupWizardStore.getState().goToStep('equipment');
    });

    renderWithIntl(<SetupWizardButton />);
    
    const button = screen.getByRole('button', { name: /restartSetup/i });
    fireEvent.click(button);

    expect(useSetupWizardStore.getState().currentStep).toBe('welcome');
  });
});

describe('setup-wizard barrel exports', () => {
  it('re-exports the root setup wizard components', () => {
    expect(setupWizardExports.SetupWizard).toBe(SetupWizard);
    expect(setupWizardExports.SetupWizardButton).toBe(SetupWizardButton);
  });

  it('re-exports each setup wizard step component', () => {
    expect(setupWizardStepExports.WelcomeStep).toBe(WelcomeStep);
    expect(setupWizardStepExports.LocationStep).toBe(LocationStep);
    expect(setupWizardStepExports.EquipmentStep).toBe(EquipmentStep);
    expect(setupWizardStepExports.PreferencesStep).toBe(PreferencesStep);
    expect(setupWizardStepExports.CompleteStep).toBe(CompleteStep);
  });
});
