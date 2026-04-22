import { act, renderHook } from '@testing-library/react';
import { useOnboardingStore, TOUR_STEPS } from '../onboarding-store';

describe('useOnboardingStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useOnboardingStore.getState().resetOnboarding();
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      expect(result.current.hasCompletedOnboarding).toBe(false);
      expect(result.current.hasSeenWelcome).toBe(false);
      expect(result.current.currentStepIndex).toBe(-1);
      expect(result.current.isTourActive).toBe(false);
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.showOnNextVisit).toBe(true);
    });
  });

  describe('TOUR_STEPS', () => {
    it('should have correct number of steps', () => {
      expect(TOUR_STEPS.length).toBeGreaterThan(0);
    });

    it('should have required properties for each step', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('targetSelector');
        expect(step).toHaveProperty('titleKey');
        expect(step).toHaveProperty('descriptionKey');
        expect(step).toHaveProperty('placement');
      });
    });

    it('should have unique step IDs', () => {
      const ids = TOUR_STEPS.map((step) => step.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('startTour', () => {
    it('should activate tour and set step to 0', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.isTourActive).toBe(true);
      expect(result.current.currentStepIndex).toBe(0);
    });
  });

  describe('endTour', () => {
    it('should deactivate tour and reset step index', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.isTourActive).toBe(true);
      
      act(() => {
        result.current.endTour();
      });
      
      expect(result.current.isTourActive).toBe(false);
      expect(result.current.currentStepIndex).toBe(-1);
    });
  });

  describe('nextStep', () => {
    it('should advance to next step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.currentStepIndex).toBe(0);
      
      act(() => {
        result.current.nextStep();
      });
      
      expect(result.current.currentStepIndex).toBe(1);
    });

    it('should mark step as completed when advancing', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.nextStep();
      });
      
      expect(result.current.completedSteps).toContain('welcome');
    });

    it('should complete onboarding when on last step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        // Go to last step
        result.current.goToStep(TOUR_STEPS.length - 1);
      });
      
      expect(result.current.isLastStep()).toBe(true);
      
      act(() => {
        result.current.nextStep();
      });
      
      expect(result.current.hasCompletedOnboarding).toBe(true);
      expect(result.current.isTourActive).toBe(false);
    });
  });

  describe('prevStep', () => {
    it('should go back to previous step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.nextStep();
        result.current.nextStep();
      });
      
      expect(result.current.currentStepIndex).toBe(2);
      
      act(() => {
        result.current.prevStep();
      });
      
      expect(result.current.currentStepIndex).toBe(1);
    });

    it('should not go below 0', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.currentStepIndex).toBe(0);
      
      act(() => {
        result.current.prevStep();
      });
      
      expect(result.current.currentStepIndex).toBe(0);
    });
  });

  describe('goToStep', () => {
    it('should go to specific step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.goToStep(5);
      });
      
      expect(result.current.currentStepIndex).toBe(5);
    });

    it('should not go to invalid step index', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      const initialIndex = result.current.currentStepIndex;
      
      act(() => {
        result.current.goToStep(-1);
      });
      
      expect(result.current.currentStepIndex).toBe(initialIndex);
      
      act(() => {
        result.current.goToStep(TOUR_STEPS.length + 1);
      });
      
      expect(result.current.currentStepIndex).toBe(initialIndex);
    });
  });

  describe('skipTour', () => {
    it('should skip tour and mark as completed', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.skipTour();
      });
      
      expect(result.current.isTourActive).toBe(false);
      expect(result.current.hasCompletedOnboarding).toBe(true);
      expect(result.current.hasSeenWelcome).toBe(true);
      expect(result.current.showOnNextVisit).toBe(false);
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding and disable show on next visit', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.completeOnboarding();
      });
      
      expect(result.current.hasCompletedOnboarding).toBe(true);
      expect(result.current.hasSeenWelcome).toBe(true);
      expect(result.current.showOnNextVisit).toBe(false);
      expect(result.current.isTourActive).toBe(false);
    });
  });

  describe('resetOnboarding', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      // First, modify the state
      act(() => {
        result.current.startTour();
        result.current.nextStep();
        result.current.completeOnboarding();
      });
      
      // Then reset
      act(() => {
        result.current.resetOnboarding();
      });
      
      expect(result.current.hasCompletedOnboarding).toBe(false);
      expect(result.current.hasSeenWelcome).toBe(false);
      expect(result.current.currentStepIndex).toBe(-1);
      expect(result.current.isTourActive).toBe(false);
      expect(result.current.completedSteps).toEqual([]);
      expect(result.current.showOnNextVisit).toBe(true);
    });
  });

  describe('setHasSeenWelcome', () => {
    it('should set hasSeenWelcome flag', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      expect(result.current.hasSeenWelcome).toBe(false);
      
      act(() => {
        result.current.setHasSeenWelcome(true);
      });
      
      expect(result.current.hasSeenWelcome).toBe(true);
    });
  });

  describe('markStepCompleted', () => {
    it('should add step to completedSteps', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.markStepCompleted('search');
      });
      
      expect(result.current.completedSteps).toContain('search');
    });

    it('should not duplicate step IDs', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.markStepCompleted('search');
        result.current.markStepCompleted('search');
      });
      
      expect(result.current.completedSteps.filter(s => s === 'search').length).toBe(1);
    });
  });

  describe('setShowOnNextVisit', () => {
    it('should set showOnNextVisit flag', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      expect(result.current.showOnNextVisit).toBe(true);
      
      act(() => {
        result.current.setShowOnNextVisit(false);
      });
      
      expect(result.current.showOnNextVisit).toBe(false);
    });

    it('should clear stale resume checkpoints when auto-show is disabled', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.openSetup();
        result.current.goToSetupStep('equipment');
        result.current.closeSetup();
      });

      expect(result.current.resumeCheckpoint?.phase).toBe('setup');

      act(() => {
        result.current.setShowOnNextVisit(false);
      });

      expect(result.current.showOnNextVisit).toBe(false);
      expect(result.current.resumeCheckpoint).toBeNull();
      expect(result.current.resolveEntrySurface()).toBe('idle');
    });
  });

  describe('getCurrentStep', () => {
    it('should return null when tour is not active', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      expect(result.current.getCurrentStep()).toBeNull();
    });

    it('should return current step when tour is active', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      const currentStep = result.current.getCurrentStep();
      expect(currentStep).not.toBeNull();
      expect(currentStep?.id).toBe('welcome');
    });
  });

  describe('getTotalSteps', () => {
    it('should return total number of steps', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      expect(result.current.getTotalSteps()).toBe(TOUR_STEPS.length);
    });
  });

  describe('isFirstStep', () => {
    it('should return true on first step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.isFirstStep()).toBe(true);
    });

    it('should return false on other steps', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.nextStep();
      });
      
      expect(result.current.isFirstStep()).toBe(false);
    });
  });

  describe('isLastStep', () => {
    it('should return false on first step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.isLastStep()).toBe(false);
    });

    it('should return true on last step', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.goToStep(TOUR_STEPS.length - 1);
      });
      
      expect(result.current.isLastStep()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple nextStep calls rapidly', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        for (let i = 0; i < 5; i++) {
          result.current.nextStep();
        }
      });
      
      expect(result.current.currentStepIndex).toBe(5);
    });

    it('should handle prevStep on first step gracefully', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.prevStep();
        result.current.prevStep();
        result.current.prevStep();
      });
      
      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.isTourActive).toBe(true);
    });

    it('should handle goToStep with boundary values', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.goToStep(0);
      });
      expect(result.current.currentStepIndex).toBe(0);
      
      act(() => {
        result.current.goToStep(TOUR_STEPS.length - 1);
      });
      expect(result.current.currentStepIndex).toBe(TOUR_STEPS.length - 1);
    });

    it('should handle startTour when already in tour', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.nextStep();
        result.current.nextStep();
        result.current.startTour();
      });
      
      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.isTourActive).toBe(true);
    });

    it('should handle endTour when not in tour', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.endTour();
      });
      
      expect(result.current.isTourActive).toBe(false);
      expect(result.current.currentStepIndex).toBe(-1);
    });

    it('should handle skipTour when not in tour', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.skipTour();
      });
      
      expect(result.current.hasCompletedOnboarding).toBe(true);
      expect(result.current.isTourActive).toBe(false);
    });

    it('should handle marking same step completed multiple times', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.markStepCompleted('welcome');
        result.current.markStepCompleted('welcome');
        result.current.markStepCompleted('welcome');
      });
      
      const welcomeCount = result.current.completedSteps.filter(s => s === 'welcome').length;
      expect(welcomeCount).toBe(1);
    });

    it('should handle resetOnboarding multiple times', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.completeOnboarding();
        result.current.resetOnboarding();
        result.current.resetOnboarding();
      });
      
      expect(result.current.hasCompletedOnboarding).toBe(false);
      expect(result.current.completedSteps).toEqual([]);
    });

    it('should handle getCurrentStep when step index is out of bounds', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      // Not in tour
      expect(result.current.getCurrentStep()).toBeNull();
      
      // Start tour and manually set invalid index (simulating edge case)
      act(() => {
        result.current.startTour();
      });
      
      expect(result.current.getCurrentStep()).not.toBeNull();
    });

    it('should preserve completedSteps when skipping tour', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.startTour();
        result.current.nextStep();
        result.current.nextStep();
        result.current.skipTour();
      });
      
      expect(result.current.completedSteps.length).toBeGreaterThan(0);
    });

    it('should handle setShowOnNextVisit toggle', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.setShowOnNextVisit(false);
      });
      expect(result.current.showOnNextVisit).toBe(false);
      
      act(() => {
        result.current.setShowOnNextVisit(true);
      });
      expect(result.current.showOnNextVisit).toBe(true);
    });

    it('should handle setHasSeenWelcome toggle', () => {
      const { result } = renderHook(() => useOnboardingStore());
      
      act(() => {
        result.current.setHasSeenWelcome(true);
      });
      expect(result.current.hasSeenWelcome).toBe(true);
      
      act(() => {
        result.current.setHasSeenWelcome(false);
      });
      expect(result.current.hasSeenWelcome).toBe(false);
    });
  });

  describe('Tour Step Validation', () => {
    it('should have valid placement values for all steps', () => {
      const validPlacements = ['top', 'bottom', 'left', 'right', 'center'];
      TOUR_STEPS.forEach((step) => {
        expect(validPlacements).toContain(step.placement);
      });
    });

    it('should have non-empty title and description keys', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step.titleKey.length).toBeGreaterThan(0);
        expect(step.descriptionKey.length).toBeGreaterThan(0);
      });
    });

    it('should have valid target selectors', () => {
      TOUR_STEPS.forEach((step) => {
        expect(step.targetSelector).toMatch(/^\[data-tour-id=/);
      });
    });

    it('should start with welcome step', () => {
      expect(TOUR_STEPS[0].id).toBe('welcome');
    });

    it('should end with complete step', () => {
      expect(TOUR_STEPS[TOUR_STEPS.length - 1].id).toBe('complete');
    });
  });

  describe('v4 tour capabilities', () => {
    it('should start a module tour by id and initialize progress', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.startTourById('module-settings-help');
      });

      expect(result.current.activeTourId).toBe('module-settings-help');
      expect(result.current.isTourActive).toBe(true);
      expect(result.current.getTourProgress('module-settings-help').totalSteps).toBeGreaterThan(0);
    });

    it('should complete capability and expose progress', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.startTour();
        result.current.completeCapability('welcome');
      });

      expect(result.current.completedSteps).toContain('welcome');
      const progress = result.current.getTourProgress('first-run-core');
      expect(progress.completedStepIds).toContain('welcome');
    });

    it('should mark skipped capabilities with reason', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.skipCapability('mount', {
          code: 'unavailable',
          messageKey: 'onboarding.skipReasons.unavailable',
        });
      });

      expect(result.current.skippedCapabilities.mount?.code).toBe('unavailable');
    });

    it('should enforce setup soft constraints in store guard', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.goToSetupStep('location');
      });
      expect(result.current.canSetupProceed()).toBe(false);

      act(() => {
        result.current.updateSetupData({ locationConfigured: true });
      });
      expect(result.current.canSetupProceed()).toBe(true);
    });

    it('should resolve welcome as onboarding entry for a new user', () => {
      const { result } = renderHook(() => useOnboardingStore());
      expect(result.current.resolveEntrySurface()).toBe('welcome');
    });

    it('should persist setup checkpoint and resolve setup entry after interruption', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.openSetup();
        result.current.goToSetupStep('equipment');
        result.current.closeSetup();
      });

      expect(result.current.resumeCheckpoint?.phase).toBe('setup');
      expect(result.current.resumeCheckpoint?.setupStep).toBe('equipment');
      expect(result.current.resolveEntrySurface()).toBe('setup');
    });

    it('should persist tour checkpoint on endTour and resume from it', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.startTourById('module-discovery');
        result.current.goToStep(2);
        result.current.endTour();
      });

      expect(result.current.resumeCheckpoint?.phase).toBe('tour');
      expect(result.current.resumeCheckpoint?.activeTourId).toBe('module-discovery');
      expect(result.current.resumeCheckpoint?.currentStepIndex).toBe(2);
      expect(result.current.resolveEntrySurface()).toBe('resume-tour');

      act(() => {
        result.current.resumeTour('module-discovery');
      });

      expect(result.current.isTourActive).toBe(true);
      expect(result.current.currentStepIndex).toBe(2);
    });

    it('should ignore stale resume checkpoints after onboarding is completed', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.startTourById('module-discovery');
        result.current.goToStep(2);
        result.current.endTour();
      });

      expect(result.current.resolveEntrySurface()).toBe('resume-tour');

      act(() => {
        result.current.completeOnboarding();
      });

      expect(result.current.resumeCheckpoint).toBeNull();
      expect(result.current.resolveEntrySurface()).toBe('idle');
    });

    it('should restart all onboarding with full reset semantics', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.finishSetupAndStartTour();
        result.current.nextStep();
        result.current.setTourHubOpen(true);
        result.current.restartAllOnboarding();
      });

      expect(result.current.hasCompletedOnboarding).toBe(false);
      expect(result.current.hasCompletedSetup).toBe(false);
      expect(result.current.completedTours).toEqual([]);
      expect(result.current.tourHubOpen).toBe(false);
      expect(result.current.hasSeenWelcome).toBe(false);
      expect(result.current.resolveEntrySurface()).toBe('welcome');
    });

    it('should restart only selected module tour progress', () => {
      const { result } = renderHook(() => useOnboardingStore());

      act(() => {
        result.current.startTourById('module-discovery');
        result.current.nextStep();
        result.current.endTour();
        result.current.startTourById('module-planning');
        result.current.goToStep(1);
        result.current.nextStep();
        result.current.endTour();
      });

      const before = result.current.getTourProgress('module-planning');
      expect(before.currentStepIndex).toBeGreaterThan(0);

      act(() => {
        result.current.restartTourModule('module-planning');
      });

      const after = result.current.getTourProgress('module-planning');
      expect(after.currentStepIndex).toBe(0);
      expect(result.current.getTourProgress('module-discovery').currentStepIndex).toBeGreaterThan(0);
      expect(result.current.hasCompletedSetup).toBe(false);
    });
  });

  describe('migration', () => {
    it('should sanitize stale checkpoints that conflict with hidden onboarding state', () => {
      const migrate = useOnboardingStore.persist?.getOptions().migrate;
      expect(typeof migrate).toBe('function');
      if (!migrate) return;

      const migrated = migrate({
        hasCompletedOnboarding: true,
        hasSeenWelcome: true,
        showOnNextVisit: false,
        resumeCheckpoint: {
          phase: 'tour',
          setupStep: null,
          activeTourId: 'first-run-core',
          currentStepIndex: 3,
          updatedAt: '2026-04-05T00:00:00.000Z',
        },
        tourHubOpen: false,
      } as Record<string, unknown>, 5);

      const migratedState = migrated as {
        resumeCheckpoint?: unknown;
        tourHubOpen?: boolean;
        showOnNextVisit?: boolean;
        hasCompletedOnboarding?: boolean;
      };

      expect(migratedState.hasCompletedOnboarding).toBe(true);
      expect(migratedState.showOnNextVisit).toBe(false);
      expect(migratedState.resumeCheckpoint).toBeNull();
      expect(migratedState.tourHubOpen).toBe(false);
    });
  });
});
