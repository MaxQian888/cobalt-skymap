import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { WelcomeDialog, OnboardingRestartButton, TourRestartButton } from '../welcome-dialog';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'onboarding.restartTour': 'Restart Guide',
      'onboarding.restartAll': 'Restart Guide',
      'onboarding.welcome.title': 'Welcome to Cobalt Skymap',
      'onboarding.welcome.subtitle': 'Your personal window to the universe',
      'onboarding.welcome.startTour': 'Start Tour',
      'onboarding.welcome.startSetup': 'Start Setup',
      'onboarding.welcome.skipToTour': 'Skip to Tour',
      'onboarding.welcome.skipTour': 'Skip for now',
      'onboarding.welcome.dontShowAgain': "Don't show this again",
      'onboarding.welcome.features.explore.title': 'Explore the Sky',
      'onboarding.welcome.features.explore.description': 'Navigate the night sky',
      'onboarding.welcome.features.objects.title': 'Discover Objects',
      'onboarding.welcome.features.objects.description': 'Find stars and galaxies',
      'onboarding.welcome.features.plan.title': 'Plan Sessions',
      'onboarding.welcome.features.plan.description': 'Create observation lists',
      'onboarding.welcome.features.track.title': 'Track Satellites',
      'onboarding.welcome.features.track.description': 'Follow ISS live',
      'setupWizard.steps.welcome.whatWellConfigure': "What we'll configure:",
      'setupWizard.steps.welcome.features.location.title': 'Location',
      'setupWizard.steps.welcome.features.equipment.title': 'Equipment',
      'setupWizard.steps.welcome.features.preferences.title': 'Preferences',
    };
    return translations[key] || key;
  },
}));

describe('WelcomeDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    act(() => {
      useOnboardingStore.getState().resetAll();
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show dialog for first-time users after delay', async () => {
    render(<WelcomeDialog />);
    
    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to Cobalt Skymap')).toBeInTheDocument();
    });
  });

  it('should not show dialog if user has seen welcome', async () => {
    act(() => {
      useOnboardingStore.getState().setHasSeenWelcome(true);
    });

    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
  });

  it('should not show dialog if showOnNextVisit is false', async () => {
    act(() => {
      useOnboardingStore.getState().setShowOnNextVisit(false);
    });

    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
  });

  it('should display all feature cards', async () => {
    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Explore the Sky')).toBeInTheDocument();
      expect(screen.getByText('Discover Objects')).toBeInTheDocument();
      expect(screen.getByText('Plan Sessions')).toBeInTheDocument();
      expect(screen.getByText('Track Satellites')).toBeInTheDocument();
    });
  });

  it('should show setup preview when setup not completed', async () => {
    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText("What we'll configure:")).toBeInTheDocument();
      expect(screen.getByText('Start Setup')).toBeInTheDocument();
      expect(screen.getByText('Skip to Tour')).toBeInTheDocument();
    });
  });

  it('should start setup when clicking Start Setup button', async () => {
    const onStartTour = jest.fn();
    
    render(<WelcomeDialog onStartTour={onStartTour} />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Start Setup')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Start Setup'));
    
    expect(onStartTour).toHaveBeenCalled();
    expect(useOnboardingStore.getState().isSetupOpen).toBe(true);
    expect(useOnboardingStore.getState().hasSeenWelcome).toBe(true);
  });

  it('should skip to tour when clicking Skip to Tour button', async () => {
    const onStartTour = jest.fn();
    
    render(<WelcomeDialog onStartTour={onStartTour} />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Skip to Tour')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Skip to Tour'));
    
    expect(onStartTour).toHaveBeenCalled();
    expect(useOnboardingStore.getState().isTourActive).toBe(true);
    expect(useOnboardingStore.getState().hasSeenWelcome).toBe(true);
  });

  it('should show Start Tour button when setup already completed', async () => {
    act(() => {
      useOnboardingStore.getState().completeSetup();
      // Reset welcome seen flag so dialog shows
      useOnboardingStore.setState({ hasSeenWelcome: false, hasCompletedOnboarding: false, showOnNextVisit: true });
    });

    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Start Tour')).toBeInTheDocument();
    });
    
    // Should not show setup preview
    expect(screen.queryByText("What we'll configure:")).not.toBeInTheDocument();
  });

  it('should skip tour when clicking Skip button', async () => {
    const onSkip = jest.fn();
    
    render(<WelcomeDialog onSkip={onSkip} />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Skip for now'));
    
    expect(onSkip).toHaveBeenCalled();
    expect(useOnboardingStore.getState().hasSeenWelcome).toBe(true);
  });

  it('should not reopen after skipping for now until onboarding is explicitly restarted', async () => {
    const { rerender } = render(<WelcomeDialog />);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(screen.getByText('Skip for now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Skip for now'));

    rerender(<WelcomeDialog />);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
  });

  it('should handle dont show again checkbox', async () => {
    render(<WelcomeDialog />);
    
    act(() => {
      jest.advanceTimersByTime(600);
    });
    
    await waitFor(() => {
      expect(screen.getByText("Don't show this again")).toBeInTheDocument();
    });
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    fireEvent.click(screen.getByText('Skip for now'));
    
    expect(useOnboardingStore.getState().showOnNextVisit).toBe(false);
  });

  it('should return null when hasCompletedOnboarding is true', () => {
    act(() => {
      useOnboardingStore.getState().completeOnboarding();
    });

    const { container } = render(<WelcomeDialog />);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(container.innerHTML).toBe('');
  });

  it('should not show dialog when isTourActive is true', async () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    render(<WelcomeDialog />);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
  });

  it('should not show dialog when isSetupOpen is true', async () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    render(<WelcomeDialog />);

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.queryByText('Welcome to Cobalt Skymap')).not.toBeInTheDocument();
  });
});

describe('OnboardingRestartButton', () => {
  beforeEach(() => {
    act(() => {
      useOnboardingStore.getState().resetAll();
      useOnboardingStore.getState().completeOnboarding();
    });
  });

  it('should render restart button', () => {
    render(<OnboardingRestartButton />);
    
    expect(screen.getByText('Restart Guide')).toBeInTheDocument();
  });

  it('should reset all state when clicked', () => {
    render(<OnboardingRestartButton />);
    
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(true);
    
    fireEvent.click(screen.getByText('Restart Guide'));
    
    expect(useOnboardingStore.getState().hasCompletedOnboarding).toBe(false);
    expect(useOnboardingStore.getState().hasCompletedSetup).toBe(false);
    expect(useOnboardingStore.getState().hasSeenWelcome).toBe(false);
  });

  it('should be aliased as TourRestartButton for backward compat', () => {
    expect(TourRestartButton).toBe(OnboardingRestartButton);
  });
});
