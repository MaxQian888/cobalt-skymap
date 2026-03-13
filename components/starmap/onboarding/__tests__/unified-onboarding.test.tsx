/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useMessierMarathonStore } from '@/lib/stores/messier-marathon-store';

// Mock framer-motion to pass through
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: (() => {
      const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
        function MotionDiv(props, ref) {
          const { children, ...rest } = props;
          const htmlProps: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(rest)) {
            if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap'].includes(key)) {
              htmlProps[key] = value;
            }
          }
          return <div ref={ref} {...htmlProps}>{children}</div>;
        },
      );
      return MotionDiv;
    })(),
  },
}));

// Mock child components to simplify
jest.mock('../welcome-dialog', () => ({
  WelcomeDialog: () => <div data-testid="welcome-dialog" />,
}));

jest.mock('../onboarding-tour', () => ({
  OnboardingTour: ({ onTourCompleted }: { onTourCompleted?: (id: string) => void }) => (
    <div data-testid="onboarding-tour">
      <button data-testid="complete-tour" onClick={() => onTourCompleted?.('first-run-core')}>
        Complete
      </button>
    </div>
  ),
}));

jest.mock('../steps/location-step', () => ({
  LocationStep: () => <div data-testid="location-step" />,
}));
jest.mock('../steps/equipment-step', () => ({
  EquipmentStep: () => <div data-testid="equipment-step" />,
}));
jest.mock('../steps/preferences-step', () => ({
  PreferencesStep: () => <div data-testid="preferences-step" />,
}));

// Mock onboarding-capabilities TOUR_DEFINITIONS
jest.mock('@/lib/constants/onboarding-capabilities', () => ({
  TOUR_DEFINITIONS: [
    { id: 'first-run-core', titleKey: 'onboarding.tours.first-run-core.title', descriptionKey: 'onboarding.tours.first-run-core.description', capabilityIds: [], order: 0, isCore: true },
    { id: 'module-discovery', titleKey: 'onboarding.tours.module-discovery.title', descriptionKey: 'onboarding.tours.module-discovery.description', capabilityIds: [], order: 1 },
  ],
  resolveTourSteps: jest.fn(() => ({ steps: [], skipped: [] })),
}));

import { UnifiedOnboarding } from '../unified-onboarding';

describe('UnifiedOnboarding', () => {
  beforeEach(() => {
    act(() => {
      useOnboardingStore.getState().resetAll();
      usePlanningUiStore.setState({
        sessionPlannerOpen: false,
        shotListOpen: false,
        tonightRecommendationsOpen: false,
        messierMarathonGuideOpen: false,
        plannerDraftSeed: null,
        plannerDraftSeedRequestId: 0,
      });
      useMessierMarathonStore.setState({
        activeSession: null,
        lastCompletedSessionId: null,
      });
    });
  });

  it('renders WelcomeDialog', () => {
    render(<UnifiedOnboarding />);
    expect(screen.getByTestId('welcome-dialog')).toBeInTheDocument();
  });

  it('does not render setup dialog when isSetupOpen is false', () => {
    render(<UnifiedOnboarding />);
    expect(screen.queryByTestId('location-step')).not.toBeInTheDocument();
  });

  it('renders setup dialog with location step when setup is opened', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByTestId('location-step')).toBeInTheDocument();
  });

  it('navigates from location to equipment step', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      // Mark location as configured so Next can proceed
      useOnboardingStore.getState().updateSetupData({ locationConfigured: true });
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByTestId('location-step')).toBeInTheDocument();

    // Click Next
    const nextBtn = screen.getByText('setupWizard.next');
    fireEvent.click(nextBtn);

    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();
  });

  it('shows soft guard dialog when proceeding without configuring location', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    render(<UnifiedOnboarding />);

    // Click Next without configuring location
    const nextBtn = screen.getByText('setupWizard.next');
    fireEvent.click(nextBtn);

    // Should show the soft guard confirmation
    expect(screen.getByText('setupWizard.softGuard.title')).toBeInTheDocument();
    expect(screen.getByText('setupWizard.softGuard.locationImpact')).toBeInTheDocument();
  });

  it('cancels soft guard and stays on current step', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    render(<UnifiedOnboarding />);
    fireEvent.click(screen.getByText('setupWizard.next'));

    // Cancel
    fireEvent.click(screen.getByText('common.cancel'));

    // Still on location step
    expect(screen.getByTestId('location-step')).toBeInTheDocument();
  });

  it('confirms soft guard skip and advances to next step', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    render(<UnifiedOnboarding />);
    fireEvent.click(screen.getByText('setupWizard.next'));

    // Confirm skip
    fireEvent.click(screen.getByText('setupWizard.softGuard.continueAnyway'));

    // Should advance to equipment step
    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();
  });

  it('navigates back with Prev button', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().updateSetupData({ locationConfigured: true });
    });

    render(<UnifiedOnboarding />);

    // Navigate to equipment
    fireEvent.click(screen.getByText('setupWizard.next'));
    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();

    // Navigate back
    fireEvent.click(screen.getByText('setupWizard.back'));
    expect(screen.getByTestId('location-step')).toBeInTheDocument();
  });

  it('skips setup when skip button is clicked', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
    });

    const onComplete = jest.fn();
    render(<UnifiedOnboarding onComplete={onComplete} />);

    fireEvent.click(screen.getByText('setupWizard.skipSetup'));

    expect(useOnboardingStore.getState().hasCompletedSetup).toBe(true);
    expect(onComplete).toHaveBeenCalled();
  });

  it('renders OnboardingTour when phase is tour', () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByTestId('onboarding-tour')).toBeInTheDocument();
  });

  it('calls onTourCompleted callback when tour completes', () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    const onTourCompleted = jest.fn();
    render(<UnifiedOnboarding onTourCompleted={onTourCompleted} />);

    fireEvent.click(screen.getByTestId('complete-tour'));
    expect(onTourCompleted).toHaveBeenCalledWith('first-run-core');
  });

  it('shows tour hub after first-run-core tour completes', () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    const onComplete = jest.fn();
    render(<UnifiedOnboarding onComplete={onComplete} />);

    fireEvent.click(screen.getByTestId('complete-tour'));

    // Tour hub should appear
    expect(screen.getByText('onboarding.hub.title')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalled();
  });

  it('renders module tours in tour hub (excludes core tours)', () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    render(<UnifiedOnboarding />);
    fireEvent.click(screen.getByTestId('complete-tour'));

    // Should show module-discovery tour, not first-run-core
    expect(screen.getByText('onboarding.tours.module-discovery.title')).toBeInTheDocument();
  });

  it('navigates through all config steps to preferences', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().updateSetupData({
        locationConfigured: true,
        equipmentConfigured: true,
        preferencesConfigured: true,
      });
    });

    render(<UnifiedOnboarding />);

    // location → equipment → preferences
    fireEvent.click(screen.getByText('setupWizard.next'));
    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();

    fireEvent.click(screen.getByText('setupWizard.next'));
    expect(screen.getByTestId('preferences-step')).toBeInTheDocument();
  });

  it('shows complete transition from preferences step via getStarted', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().updateSetupData({
        locationConfigured: true,
        equipmentConfigured: true,
        preferencesConfigured: true,
      });
      // Navigate to the 'complete' step directly
      useOnboardingStore.getState().goToSetupStep('complete');
    });

    render(<UnifiedOnboarding />);

    // Complete step shows SetupCompleteTransition in its own dialog
    expect(screen.getAllByText('setupWizard.steps.complete.title').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('onboarding.transition.startTour')).toBeInTheDocument();
    expect(screen.getByText('onboarding.transition.skipTour')).toBeInTheDocument();
  });

  it('handles keyboard ArrowRight navigation in setup wizard', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().updateSetupData({ locationConfigured: true });
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByTestId('location-step')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();
  });

  it('handles keyboard ArrowLeft navigation in setup wizard', () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().updateSetupData({ locationConfigured: true });
    });

    render(<UnifiedOnboarding />);

    // Move to equipment first
    fireEvent.click(screen.getByText('setupWizard.next'));
    expect(screen.getByTestId('equipment-step')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('location-step')).toBeInTheDocument();
  });

  it('dismisses tour hub with finish later button', () => {
    act(() => {
      useOnboardingStore.getState().startTour();
    });

    render(<UnifiedOnboarding />);
    fireEvent.click(screen.getByTestId('complete-tour'));

    // Tour hub should be visible
    expect(screen.getByText('onboarding.hub.title')).toBeInTheDocument();

    // Click finish later
    fireEvent.click(screen.getByText('onboarding.hub.finishLater'));

    // Tour hub should be dismissed
    expect(screen.queryByText('onboarding.hub.title')).not.toBeInTheDocument();
  });

  it('re-enters setup from persisted setup checkpoint', async () => {
    act(() => {
      useOnboardingStore.getState().openSetup();
      useOnboardingStore.getState().goToSetupStep('equipment');
      useOnboardingStore.getState().closeSetup();
    });

    render(<UnifiedOnboarding />);

    await waitFor(() => {
      expect(screen.getByTestId('equipment-step')).toBeInTheDocument();
    });
  });

  it('restores tour hub visibility from persisted state', () => {
    act(() => {
      useOnboardingStore.getState().setTourHubOpen(true);
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByText('onboarding.hub.title')).toBeInTheDocument();
  });

  it('shows messier marathon resume entry when an active guide session exists', () => {
    act(() => {
      useOnboardingStore.getState().setTourHubOpen(true);
      useMessierMarathonStore.setState({
        activeSession: {
          sessionId: 'session-1',
          date: '2026-03-21T12:00:00.000Z',
          latitude: 35,
          longitude: -105,
          readiness: 'recommended',
          visibleTargetCount: 2,
          totalMessierCount: 110,
          darknessHours: 9.5,
          limitingFactors: [],
          stages: [],
          checkpoints: [],
          recovery: {
            mode: 'full',
            nextCheckpointId: 'M74',
            nextStageId: 'dusk',
            catchUpTargetIds: ['M74'],
            updatedAt: '2026-03-21T12:00:00.000Z',
          },
          startedAt: '2026-03-21T12:00:00.000Z',
          updatedAt: '2026-03-21T12:00:00.000Z',
        },
      });
    });

    render(<UnifiedOnboarding />);
    expect(screen.getByText('messierMarathon.title')).toBeInTheDocument();
    expect(screen.getByText('onboarding.hub.resumeMarathon')).toBeInTheDocument();
  });

  it('opens the messier marathon guide from the hub without resetting onboarding progress', () => {
    act(() => {
      useOnboardingStore.getState().setTourHubOpen(true);
      useMessierMarathonStore.setState({
        activeSession: {
          sessionId: 'session-1',
          date: '2026-03-21T12:00:00.000Z',
          latitude: 35,
          longitude: -105,
          readiness: 'recommended',
          visibleTargetCount: 2,
          totalMessierCount: 110,
          darknessHours: 9.5,
          limitingFactors: [],
          stages: [],
          checkpoints: [],
          recovery: {
            mode: 'full',
            nextCheckpointId: 'M74',
            nextStageId: 'dusk',
            catchUpTargetIds: ['M74'],
            updatedAt: '2026-03-21T12:00:00.000Z',
          },
          startedAt: '2026-03-21T12:00:00.000Z',
          updatedAt: '2026-03-21T12:00:00.000Z',
        },
      });
    });

    render(<UnifiedOnboarding />);
    fireEvent.click(screen.getByText('onboarding.hub.resumeMarathon'));

    expect(usePlanningUiStore.getState().messierMarathonGuideOpen).toBe(true);
    expect(useOnboardingStore.getState().tourHubOpen).toBe(false);
    expect(useOnboardingStore.getState().phase).toBe('idle');
  });
});
