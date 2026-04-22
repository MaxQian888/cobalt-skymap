import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import { TOUR_STEPS, SETUP_WIZARD_STEPS } from '@/lib/constants/onboarding';
import { resolveTourSteps } from '@/lib/constants/onboarding-capabilities';
import { resolveOnboardingEntrySurface } from './onboarding-entry-resolver';
import type {
  OnboardingEntrySurface,
  OnboardingPhase,
  OnboardingResumeCheckpoint,
  SetupWizardMetadata,
  SetupWizardSetupData,
  SetupWizardStep,
  StepSkipReason,
  TourId,
  TourProgress,
  TourStep,
} from '@/types/starmap/onboarding';

// Re-export for backward compatibility
export type { TourStep, SetupWizardStep };
export { TOUR_STEPS, SETUP_WIZARD_STEPS };

type SetupSkippableStep = 'location' | 'equipment' | 'preferences';

interface OnboardingState {
  // Shared state
  hasCompletedOnboarding: boolean;
  hasSeenWelcome: boolean;
  showOnNextVisit: boolean;
  phase: OnboardingPhase;
  resumeCheckpoint: OnboardingResumeCheckpoint | null;
  tourHubOpen: boolean;

  // Setup wizard state
  hasCompletedSetup: boolean;
  setupStep: SetupWizardStep;
  setupCompletedSteps: SetupWizardStep[];
  isSetupOpen: boolean;
  setupData: SetupWizardSetupData;
  setupMetadata: SetupWizardMetadata;

  // Tour state
  currentStepIndex: number;
  isTourActive: boolean;
  completedSteps: string[];
  activeTourId: TourId | null;
  activeTourSteps: TourStep[];
  tourProgressById: Partial<Record<TourId, TourProgress>>;
  completedTours: TourId[];
  skippedCapabilities: Record<string, StepSkipReason>;
  lastCompletedAt: string | null;

  // Shared actions
  setHasSeenWelcome: (seen: boolean) => void;
  setShowOnNextVisit: (show: boolean) => void;
  setTourHubOpen: (open: boolean) => void;
  resolveEntrySurface: () => OnboardingEntrySurface;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  restartAllOnboarding: () => void;
  resetAll: () => void;

  // Setup wizard actions
  openSetup: () => void;
  closeSetup: () => void;
  setupNextStep: () => void;
  setupPrevStep: () => void;
  goToSetupStep: (step: SetupWizardStep) => void;
  markSetupStepCompleted: (step: SetupWizardStep) => void;
  completeSetup: () => void;
  resetSetup: () => void;
  updateSetupData: (data: Partial<SetupWizardSetupData>) => void;
  finishSetupAndStartTour: () => void;
  skipSetupStartTour: () => void;
  recordSetupSkip: (step: SetupSkippableStep, reason: string) => void;

  // Setup wizard getters
  getSetupStepIndex: () => number;
  getSetupTotalSteps: () => number;
  isSetupFirstStep: () => boolean;
  isSetupLastStep: () => boolean;
  canSetupProceed: () => boolean;

  // Tour actions
  setActiveTourSteps: (steps: TourStep[]) => void;
  startTour: () => void;
  startTourById: (tourId: TourId) => void;
  restartTourModule: (tourId: TourId) => void;
  resumeTour: (tourId: TourId) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTour: () => void;
  markStepCompleted: (stepId: string) => void;
  completeCapability: (capabilityId: string) => void;
  skipCapability: (capabilityId: string, reason: StepSkipReason) => void;

  // Tour getters
  getCurrentStep: () => TourStep | null;
  getTotalSteps: () => number;
  isLastStep: () => boolean;
  isFirstStep: () => boolean;
  getTourProgress: (tourId: TourId) => TourProgress;
}

const INITIAL_SETUP_DATA: SetupWizardSetupData = {
  locationConfigured: false,
  equipmentConfigured: false,
  preferencesConfigured: false,
};

const INITIAL_SETUP_METADATA: SetupWizardMetadata = {
  location: 'skipped',
  equipment: 'skipped',
  preferences: 'skipped',
  skipReasons: {},
  completedAt: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function checkpoint(
  value: Omit<OnboardingResumeCheckpoint, 'updatedAt'>,
): OnboardingResumeCheckpoint {
  return {
    ...value,
    updatedAt: nowIso(),
  };
}

function getDefaultTourSteps(tourId: TourId): TourStep[] {
  const resolved = resolveTourSteps(
    {
      isMobile: false,
      isTauri: false,
      skyEngine: 'stellarium',
      stelAvailable: true,
      featureVisibility: {},
    },
    tourId,
  ).steps;
  return resolved.length > 0 ? resolved : tourId === 'first-run-core' ? TOUR_STEPS : [];
}

function buildProgress(
  currentStepIndex: number,
  totalSteps: number,
  completedStepIds: string[],
  completed = false,
): TourProgress {
  return {
    currentStepIndex,
    totalSteps,
    completedStepIds,
    completed,
    updatedAt: nowIso(),
  };
}

function getPersistedLegacyState(storageKey: string): Record<string, unknown> | null {
  try {
    const zustandStorage = getZustandStorage();
    const stored = zustandStorage.getItem(storageKey);
    if (!stored || typeof stored !== 'object') return null;
    const maybeState = (stored as { state?: unknown }).state;
    if (!maybeState || typeof maybeState !== 'object') return null;
    return maybeState as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizePersistedOnboardingState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const hasCompletedOnboarding = state.hasCompletedOnboarding === true;
  const showOnNextVisit = state.showOnNextVisit !== false;

  if (hasCompletedOnboarding || !showOnNextVisit) {
    state.resumeCheckpoint = null;
    state.activeTourId = null;
  }

  return state;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Shared state
      hasCompletedOnboarding: false,
      hasSeenWelcome: false,
      showOnNextVisit: true,
      phase: 'idle',
      resumeCheckpoint: null,
      tourHubOpen: false,

      // Setup wizard state
      hasCompletedSetup: false,
      setupStep: 'welcome',
      setupCompletedSteps: [],
      isSetupOpen: false,
      setupData: { ...INITIAL_SETUP_DATA },
      setupMetadata: { ...INITIAL_SETUP_METADATA },

      // Tour state
      currentStepIndex: -1,
      isTourActive: false,
      completedSteps: [],
      activeTourId: null,
      activeTourSteps: [],
      tourProgressById: {},
      completedTours: [],
      skippedCapabilities: {},
      lastCompletedAt: null,

      // Shared actions
      setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),

      setShowOnNextVisit: (show) =>
        set((state) => ({
          showOnNextVisit: show,
          resumeCheckpoint: show ? state.resumeCheckpoint : null,
        })),

      setTourHubOpen: (open) => set({ tourHubOpen: open }),

      resolveEntrySurface: () => {
        const state = get();
        return resolveOnboardingEntrySurface({
          hasSeenWelcome: state.hasSeenWelcome,
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          showOnNextVisit: state.showOnNextVisit,
          isSetupOpen: state.isSetupOpen,
          isTourActive: state.isTourActive,
          tourHubOpen: state.tourHubOpen,
          resumeCheckpoint: state.resumeCheckpoint,
        });
      },

      completeOnboarding: () =>
        set((state) => ({
          hasCompletedOnboarding: true,
          hasSeenWelcome: true,
          showOnNextVisit: false,
          isTourActive: false,
          currentStepIndex: -1,
          activeTourSteps: [],
          phase: 'idle',
          resumeCheckpoint: null,
          tourHubOpen: false,
          completedTours:
            state.activeTourId === 'first-run-core' &&
            !state.completedTours.includes('first-run-core')
              ? [...state.completedTours, 'first-run-core']
              : state.completedTours,
          lastCompletedAt: nowIso(),
        })),

      resetOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          hasSeenWelcome: false,
          currentStepIndex: -1,
          isTourActive: false,
          completedSteps: [],
          activeTourId: null,
          activeTourSteps: [],
          showOnNextVisit: true,
          phase: 'idle',
          resumeCheckpoint: null,
          tourHubOpen: false,
          tourProgressById: {},
          completedTours: [],
          skippedCapabilities: {},
          lastCompletedAt: null,
        }),

      restartAllOnboarding: () =>
        set({
          hasCompletedOnboarding: false,
          hasSeenWelcome: false,
          showOnNextVisit: true,
          phase: 'idle',
          resumeCheckpoint: null,
          tourHubOpen: false,
          hasCompletedSetup: false,
          setupStep: 'welcome',
          setupCompletedSteps: [],
          isSetupOpen: false,
          setupData: { ...INITIAL_SETUP_DATA },
          setupMetadata: { ...INITIAL_SETUP_METADATA },
          currentStepIndex: -1,
          isTourActive: false,
          completedSteps: [],
          activeTourId: null,
          activeTourSteps: [],
          tourProgressById: {},
          completedTours: [],
          skippedCapabilities: {},
          lastCompletedAt: null,
        }),

      resetAll: () =>
        set({
          hasCompletedOnboarding: false,
          hasSeenWelcome: false,
          showOnNextVisit: true,
          phase: 'idle',
          resumeCheckpoint: null,
          tourHubOpen: false,
          hasCompletedSetup: false,
          setupStep: 'welcome',
          setupCompletedSteps: [],
          isSetupOpen: false,
          setupData: { ...INITIAL_SETUP_DATA },
          setupMetadata: { ...INITIAL_SETUP_METADATA },
          currentStepIndex: -1,
          isTourActive: false,
          completedSteps: [],
          activeTourId: null,
          activeTourSteps: [],
          tourProgressById: {},
          completedTours: [],
          skippedCapabilities: {},
          lastCompletedAt: null,
        }),

      // Setup wizard actions
      openSetup: () =>
        set((state) => {
          const nextStep = state.hasCompletedSetup
            ? 'location'
            : state.setupStep === 'welcome'
              ? 'location'
              : state.setupStep;
          return {
            isSetupOpen: true,
            phase: 'setup',
            setupStep: nextStep,
            tourHubOpen: false,
            resumeCheckpoint: checkpoint({
              phase: 'setup',
              setupStep: nextStep,
              activeTourId: null,
              currentStepIndex: -1,
            }),
          };
        }),

      closeSetup: () =>
        set((state) => ({
          isSetupOpen: false,
          phase: state.isTourActive ? 'tour' : 'idle',
          resumeCheckpoint: state.hasCompletedSetup
            ? null
            : checkpoint({
                phase: 'setup',
                setupStep: state.setupStep,
                activeTourId: null,
                currentStepIndex: -1,
              }),
        })),

      setupNextStep: () => {
        const { setupStep, setupCompletedSteps } = get();
        const currentIndex = SETUP_WIZARD_STEPS.indexOf(setupStep);

        if (currentIndex < SETUP_WIZARD_STEPS.length - 1) {
          const nextSetupStep = SETUP_WIZARD_STEPS[currentIndex + 1];
          set({
            setupStep: nextSetupStep,
            setupCompletedSteps: setupCompletedSteps.includes(setupStep)
              ? setupCompletedSteps
              : [...setupCompletedSteps, setupStep],
            resumeCheckpoint: checkpoint({
              phase: 'setup',
              setupStep: nextSetupStep,
              activeTourId: null,
              currentStepIndex: -1,
            }),
          });
          return;
        }

        get().completeSetup();
      },

      setupPrevStep: () => {
        const { setupStep } = get();
        const currentIndex = SETUP_WIZARD_STEPS.indexOf(setupStep);
        if (currentIndex > 0) {
          const prevStep = SETUP_WIZARD_STEPS[currentIndex - 1];
          set({
            setupStep: prevStep,
            resumeCheckpoint: checkpoint({
              phase: 'setup',
              setupStep: prevStep,
              activeTourId: null,
              currentStepIndex: -1,
            }),
          });
        }
      },

      goToSetupStep: (step) => {
        if (SETUP_WIZARD_STEPS.includes(step)) {
          set({
            setupStep: step,
            resumeCheckpoint: checkpoint({
              phase: 'setup',
              setupStep: step,
              activeTourId: null,
              currentStepIndex: -1,
            }),
          });
        }
      },

      markSetupStepCompleted: (step) =>
        set((state) => ({
          setupCompletedSteps: state.setupCompletedSteps.includes(step)
            ? state.setupCompletedSteps
            : [...state.setupCompletedSteps, step],
        })),

      completeSetup: () =>
        set((state) => {
          const metadata: SetupWizardMetadata = {
            location: state.setupData.locationConfigured ? 'configured' : 'skipped',
            equipment: state.setupData.equipmentConfigured ? 'configured' : 'skipped',
            preferences: state.setupData.preferencesConfigured ? 'configured' : 'skipped',
            skipReasons: state.setupMetadata.skipReasons,
            completedAt: nowIso(),
          };

          return {
            hasCompletedSetup: true,
            isSetupOpen: false,
            setupStep: 'welcome',
            setupCompletedSteps: [...SETUP_WIZARD_STEPS],
            setupMetadata: metadata,
            resumeCheckpoint: null,
          };
        }),

      resetSetup: () =>
        set({
          hasCompletedSetup: false,
          setupStep: 'welcome',
          isSetupOpen: false,
          setupCompletedSteps: [],
          setupData: { ...INITIAL_SETUP_DATA },
          setupMetadata: { ...INITIAL_SETUP_METADATA },
          resumeCheckpoint: null,
        }),

      updateSetupData: (data) =>
        set((state) => ({
          setupData: { ...state.setupData, ...data },
        })),

      finishSetupAndStartTour: () => {
        set({
          hasCompletedSetup: true,
          isSetupOpen: false,
          setupStep: 'welcome',
          setupCompletedSteps: [...SETUP_WIZARD_STEPS],
          hasSeenWelcome: true,
          resumeCheckpoint: null,
          tourHubOpen: false,
        });
        get().startTourById('first-run-core');
      },

      skipSetupStartTour: () => {
        set({
          isSetupOpen: false,
          hasSeenWelcome: true,
          resumeCheckpoint: null,
          tourHubOpen: false,
        });
        get().startTourById('first-run-core');
      },

      recordSetupSkip: (step, reason) =>
        set((state) => ({
          setupMetadata: {
            ...state.setupMetadata,
            skipReasons: {
              ...state.setupMetadata.skipReasons,
              [step]: reason,
            },
          },
        })),

      // Setup wizard getters
      getSetupStepIndex: () => SETUP_WIZARD_STEPS.indexOf(get().setupStep),
      getSetupTotalSteps: () => SETUP_WIZARD_STEPS.length,
      isSetupFirstStep: () => get().setupStep === SETUP_WIZARD_STEPS[0],
      isSetupLastStep: () =>
        get().setupStep === SETUP_WIZARD_STEPS[SETUP_WIZARD_STEPS.length - 1],
      canSetupProceed: () => {
        const { setupStep, setupData } = get();
        if (setupStep === 'location') return setupData.locationConfigured;
        if (setupStep === 'equipment') return setupData.equipmentConfigured;
        if (setupStep === 'preferences') return true;
        return true;
      },

      // Tour actions
      setActiveTourSteps: (steps) =>
        set((state) => {
          if (!state.activeTourId) return { activeTourSteps: steps };
          const previous = state.tourProgressById[state.activeTourId];
          const currentStepIndex = Math.min(
            state.currentStepIndex,
            Math.max(steps.length - 1, 0),
          );
          return {
            activeTourSteps: steps,
            resumeCheckpoint: checkpoint({
              phase: 'tour',
              setupStep: null,
              activeTourId: state.activeTourId,
              currentStepIndex,
            }),
            tourProgressById: {
              ...state.tourProgressById,
              [state.activeTourId]: buildProgress(
                currentStepIndex,
                steps.length,
                previous?.completedStepIds ?? [],
                previous?.completed ?? false,
              ),
            },
          };
        }),

      startTour: () => {
        get().startTourById('first-run-core');
      },

      startTourById: (tourId) => {
        const steps = getDefaultTourSteps(tourId);
        const nextStepIndex = steps.length > 0 ? 0 : -1;
        set((state) => ({
          activeTourId: tourId,
          activeTourSteps: steps,
          isTourActive: true,
          currentStepIndex: nextStepIndex,
          phase: 'tour',
          hasSeenWelcome: true,
          tourHubOpen: false,
          resumeCheckpoint: checkpoint({
            phase: 'tour',
            setupStep: null,
            activeTourId: tourId,
            currentStepIndex: nextStepIndex,
          }),
          tourProgressById: {
            ...state.tourProgressById,
            [tourId]: buildProgress(nextStepIndex, steps.length, []),
          },
        }));
      },

      restartTourModule: (tourId) => {
        const steps = getDefaultTourSteps(tourId);
        const nextStepIndex = steps.length > 0 ? 0 : -1;
        set((state) => ({
          activeTourId: tourId,
          activeTourSteps: steps,
          isTourActive: true,
          currentStepIndex: nextStepIndex,
          phase: 'tour',
          hasSeenWelcome: true,
          tourHubOpen: false,
          completedTours: state.completedTours.filter((id) => id !== tourId),
          resumeCheckpoint: checkpoint({
            phase: 'tour',
            setupStep: null,
            activeTourId: tourId,
            currentStepIndex: nextStepIndex,
          }),
          tourProgressById: {
            ...state.tourProgressById,
            [tourId]: buildProgress(nextStepIndex, steps.length, []),
          },
        }));
      },

      resumeTour: (tourId) => {
        const progress = get().tourProgressById[tourId];
        const steps = getDefaultTourSteps(tourId);
        const stepIndex = progress
          ? Math.min(progress.currentStepIndex, Math.max(steps.length - 1, 0))
          : 0;
        set((state) => ({
          activeTourId: tourId,
          activeTourSteps: steps,
          isTourActive: true,
          currentStepIndex: steps.length > 0 ? stepIndex : -1,
          phase: 'tour',
          hasSeenWelcome: true,
          tourHubOpen: false,
          completedSteps: progress?.completedStepIds ?? state.completedSteps,
          resumeCheckpoint: checkpoint({
            phase: 'tour',
            setupStep: null,
            activeTourId: tourId,
            currentStepIndex: steps.length > 0 ? stepIndex : -1,
          }),
          tourProgressById: {
            ...state.tourProgressById,
            [tourId]: buildProgress(
              steps.length > 0 ? stepIndex : -1,
              steps.length,
              progress?.completedStepIds ?? [],
              false,
            ),
          },
        }));
      },

      endTour: () =>
        set((state) => ({
          isTourActive: false,
          currentStepIndex: -1,
          phase: 'idle',
          activeTourSteps: [],
          resumeCheckpoint: state.activeTourId
            ? checkpoint({
                phase: 'tour',
                setupStep: null,
                activeTourId: state.activeTourId,
                currentStepIndex: Math.max(state.currentStepIndex, 0),
              })
            : state.resumeCheckpoint,
        })),

      nextStep: () => {
        const state = get();
        if (!state.isTourActive || state.currentStepIndex < 0) return;

        const totalSteps = state.activeTourSteps.length;
        const activeTourId = state.activeTourId;
        const currentStep = state.activeTourSteps[state.currentStepIndex];
        const currentCapabilityId = currentStep?.capabilityId;

        if (currentCapabilityId) {
          state.completeCapability(currentCapabilityId);
        } else if (currentStep?.id) {
          state.markStepCompleted(currentStep.id);
        }

        if (state.currentStepIndex < totalSteps - 1) {
          set((currentState) => {
            if (!currentState.activeTourId) {
              return {
                currentStepIndex: currentState.currentStepIndex + 1,
                resumeCheckpoint: checkpoint({
                  phase: 'tour',
                  setupStep: null,
                  activeTourId: null,
                  currentStepIndex: currentState.currentStepIndex + 1,
                }),
              };
            }
            const progress =
              currentState.tourProgressById[currentState.activeTourId] ??
              buildProgress(0, currentState.activeTourSteps.length, []);
            return {
              currentStepIndex: currentState.currentStepIndex + 1,
              resumeCheckpoint: checkpoint({
                phase: 'tour',
                setupStep: null,
                activeTourId: currentState.activeTourId,
                currentStepIndex: currentState.currentStepIndex + 1,
              }),
              tourProgressById: {
                ...currentState.tourProgressById,
                [currentState.activeTourId]: buildProgress(
                  currentState.currentStepIndex + 1,
                  currentState.activeTourSteps.length,
                  progress.completedStepIds,
                ),
              },
            };
          });
          return;
        }

        set((currentState) => {
          const completedAt = nowIso();
          const tourId = activeTourId;
          const completedTours =
            tourId && !currentState.completedTours.includes(tourId)
              ? [...currentState.completedTours, tourId]
              : currentState.completedTours;

          const nextState: Partial<OnboardingState> = {
            isTourActive: false,
            currentStepIndex: -1,
            phase: 'idle',
            activeTourSteps: [],
            completedTours,
            lastCompletedAt: completedAt,
            resumeCheckpoint: null,
          };

          if (tourId) {
            const progress = currentState.tourProgressById[tourId];
            nextState.tourProgressById = {
              ...currentState.tourProgressById,
              [tourId]: buildProgress(
                progress?.currentStepIndex ?? totalSteps - 1,
                totalSteps,
                progress?.completedStepIds ?? currentState.completedSteps,
                true,
              ),
            };
          }

          if (tourId === 'first-run-core') {
            nextState.hasCompletedOnboarding = true;
            nextState.hasSeenWelcome = true;
            nextState.showOnNextVisit = false;
            nextState.tourHubOpen = true;
          }

          return nextState as OnboardingState;
        });
      },

      prevStep: () => {
        const { currentStepIndex, activeTourId, activeTourSteps, tourProgressById } = get();
        if (currentStepIndex <= 0) return;

        set({
          currentStepIndex: currentStepIndex - 1,
          resumeCheckpoint: checkpoint({
            phase: 'tour',
            setupStep: null,
            activeTourId,
            currentStepIndex: currentStepIndex - 1,
          }),
          tourProgressById: activeTourId
            ? {
                ...tourProgressById,
                [activeTourId]: buildProgress(
                  currentStepIndex - 1,
                  activeTourSteps.length,
                  tourProgressById[activeTourId]?.completedStepIds ?? [],
                ),
              }
            : tourProgressById,
        });
      },

      goToStep: (index) => {
        const { activeTourSteps, activeTourId, tourProgressById } = get();
        if (index < 0 || index >= activeTourSteps.length) return;

        set({
          currentStepIndex: index,
          resumeCheckpoint: checkpoint({
            phase: 'tour',
            setupStep: null,
            activeTourId,
            currentStepIndex: index,
          }),
          tourProgressById: activeTourId
            ? {
                ...tourProgressById,
                [activeTourId]: buildProgress(
                  index,
                  activeTourSteps.length,
                  tourProgressById[activeTourId]?.completedStepIds ?? [],
                ),
              }
            : tourProgressById,
        });
      },

      skipTour: () =>
        set((state) => {
          const nextState: Partial<OnboardingState> = {
            isTourActive: false,
            currentStepIndex: -1,
            phase: 'idle',
            activeTourSteps: [],
            resumeCheckpoint: null,
            tourHubOpen: false,
          };

          if (!state.activeTourId || state.activeTourId === 'first-run-core') {
            nextState.hasCompletedOnboarding = true;
            nextState.hasSeenWelcome = true;
            nextState.showOnNextVisit = false;
          }

          return nextState as OnboardingState;
        }),

      markStepCompleted: (stepId) =>
        set((state) => ({
          completedSteps: state.completedSteps.includes(stepId)
            ? state.completedSteps
            : [...state.completedSteps, stepId],
        })),

      completeCapability: (capabilityId) =>
        set((state) => {
          const completedStepIds = state.completedSteps.includes(capabilityId)
            ? state.completedSteps
            : [...state.completedSteps, capabilityId];

          if (!state.activeTourId) {
            return { completedSteps: completedStepIds };
          }

          const progress =
            state.tourProgressById[state.activeTourId] ??
            buildProgress(state.currentStepIndex, state.activeTourSteps.length, []);
          const mergedProgressIds = progress.completedStepIds.includes(capabilityId)
            ? progress.completedStepIds
            : [...progress.completedStepIds, capabilityId];

          return {
            completedSteps: completedStepIds,
            resumeCheckpoint: checkpoint({
              phase: 'tour',
              setupStep: null,
              activeTourId: state.activeTourId,
              currentStepIndex: state.currentStepIndex,
            }),
            tourProgressById: {
              ...state.tourProgressById,
              [state.activeTourId]: buildProgress(
                state.currentStepIndex,
                state.activeTourSteps.length,
                mergedProgressIds,
                progress.completed,
              ),
            },
          };
        }),

      skipCapability: (capabilityId, reason) =>
        set((state) => {
          const activeTourId = state.activeTourId;
          if (!activeTourId) {
            return {
              skippedCapabilities: {
                ...state.skippedCapabilities,
                [capabilityId]: reason,
              },
            };
          }

          const progress =
            state.tourProgressById[activeTourId]
            ?? buildProgress(state.currentStepIndex, state.activeTourSteps.length, []);
          const updatedCompleted = progress.completedStepIds.includes(capabilityId)
            ? progress.completedStepIds
            : [...progress.completedStepIds, capabilityId];

          return {
            skippedCapabilities: {
              ...state.skippedCapabilities,
              [capabilityId]: reason,
            },
            resumeCheckpoint: checkpoint({
              phase: 'tour',
              setupStep: null,
              activeTourId,
              currentStepIndex: state.currentStepIndex,
            }),
            tourProgressById: {
              ...state.tourProgressById,
              [activeTourId]: buildProgress(
                state.currentStepIndex,
                state.activeTourSteps.length,
                updatedCompleted,
                progress.completed,
              ),
            },
          };
        }),

      // Tour getters
      getCurrentStep: () => {
        const { currentStepIndex, isTourActive, activeTourSteps } = get();
        if (
          !isTourActive ||
          currentStepIndex < 0 ||
          currentStepIndex >= activeTourSteps.length
        ) {
          return null;
        }
        return activeTourSteps[currentStepIndex] ?? null;
      },

      getTotalSteps: () => {
        const activeCount = get().activeTourSteps.length;
        return activeCount > 0 ? activeCount : TOUR_STEPS.length;
      },

      isLastStep: () => {
        const { currentStepIndex, activeTourSteps } = get();
        return currentStepIndex === activeTourSteps.length - 1 && activeTourSteps.length > 0;
      },

      isFirstStep: () => get().currentStepIndex === 0,

      getTourProgress: (tourId) => {
        const existing = get().tourProgressById[tourId];
        if (existing) return existing;
        const defaultSteps = getDefaultTourSteps(tourId);
        return buildProgress(0, defaultSteps.length, []);
      },
    }),
    {
      name: 'starmap-onboarding',
      storage: getZustandStorage(),
      version: 6,
      migrate: (persistedState, version) => {
        const state =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Record<string, unknown>)
            : {};

        if (version < 2) {
          if ('hasSeenWelcome' in state) {
            delete state.hasSeenWelcome;
          }
        }

        if (version < 3) {
          const wizardState = getPersistedLegacyState('starmap-setup-wizard');
          if (wizardState) {
            state.hasCompletedSetup =
              (wizardState.hasCompletedSetup as boolean) ?? false;
            state.setupCompletedSteps =
              (wizardState.completedSteps as string[]) ?? [];
            try {
              getZustandStorage().removeItem('starmap-setup-wizard');
            } catch {
              // noop
            }
          }
          if (!('hasCompletedSetup' in state)) state.hasCompletedSetup = false;
          if (!('setupCompletedSteps' in state)) state.setupCompletedSteps = [];
        }

        if (version < 4) {
          const legacyOnboardingState = getPersistedLegacyState('onboarding-storage');
          if (legacyOnboardingState) {
            if (!('hasCompletedOnboarding' in state) && 'hasCompletedOnboarding' in legacyOnboardingState) {
              state.hasCompletedOnboarding = legacyOnboardingState.hasCompletedOnboarding;
            }
            if (!('hasSeenWelcome' in state) && 'hasSeenWelcome' in legacyOnboardingState) {
              state.hasSeenWelcome = legacyOnboardingState.hasSeenWelcome;
            }
            if (!('showOnNextVisit' in state) && 'showOnNextVisit' in legacyOnboardingState) {
              state.showOnNextVisit = legacyOnboardingState.showOnNextVisit;
            }
          }

          if (!('activeTourId' in state)) state.activeTourId = null;
          if (!('tourProgressById' in state)) state.tourProgressById = {};
          if (!('completedTours' in state)) state.completedTours = [];
          if (!('skippedCapabilities' in state)) state.skippedCapabilities = {};
          if (!('lastCompletedAt' in state)) state.lastCompletedAt = null;
          if (!('setupData' in state)) state.setupData = { ...INITIAL_SETUP_DATA };
          if (!('setupMetadata' in state)) {
            state.setupMetadata = { ...INITIAL_SETUP_METADATA };
          }
        }

        if (version < 5) {
          if (!('resumeCheckpoint' in state)) state.resumeCheckpoint = null;
          if (!('tourHubOpen' in state)) state.tourHubOpen = false;
        }

        if (version < 6) {
          sanitizePersistedOnboardingState(state);
        }

        return state;
      },
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        hasSeenWelcome: state.hasSeenWelcome,
        hasCompletedSetup: state.hasCompletedSetup,
        completedSteps: state.completedSteps,
        setupCompletedSteps: state.setupCompletedSteps,
        showOnNextVisit: state.showOnNextVisit,
        setupData: state.setupData,
        setupMetadata: state.setupMetadata,
        activeTourId: state.activeTourId,
        tourProgressById: state.tourProgressById,
        completedTours: state.completedTours,
        skippedCapabilities: state.skippedCapabilities,
        lastCompletedAt: state.lastCompletedAt,
        resumeCheckpoint: state.resumeCheckpoint,
        tourHubOpen: state.tourHubOpen,
      }),
    },
  ),
);
