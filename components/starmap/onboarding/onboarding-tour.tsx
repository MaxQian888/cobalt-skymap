'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { useOnboardingBridgeStore, useSettingsStore, useStellariumStore } from '@/lib/stores';
import { resolveTourSteps } from '@/lib/constants/onboarding-capabilities';
import type {
  OnboardingTourProps,
  StepSkipReason,
  TourBeforeEnterAction,
  TourStep,
} from '@/types/starmap/onboarding';
import { isTauri } from '@/lib/tauri/app-control-api';
import { useMobileShell } from '@/components/starmap/view/use-mobile-shell';
import { TourSpotlight } from './tour-spotlight';
import { TourTooltip } from './tour-tooltip';

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function resolveStepTarget(
  selector: string,
  retries = 4,
  retryDelayMs = 90,
): Promise<Element | null> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const target = document.querySelector(selector);
    if (target) return target;
    if (attempt < retries) {
      // Wait for transient UI updates (drawer/panel animations) before retrying.
      await wait(retryDelayMs);
    }
  }
  return null;
}

export function OnboardingTour({
  onTourStart,
  onTourEnd,
  onStepChange,
  onTourCompleted,
}: OnboardingTourProps) {
  const isTourActive = useOnboardingStore((state) => state.isTourActive);
  const activeTourId = useOnboardingStore((state) => state.activeTourId);
  const activeTourSteps = useOnboardingStore((state) => state.activeTourSteps);
  const currentStepIndex = useOnboardingStore((state) => state.currentStepIndex);
  const currentStep = useOnboardingStore((state) => state.getCurrentStep());
  const setActiveTourSteps = useOnboardingStore((state) => state.setActiveTourSteps);
  const nextStep = useOnboardingStore((state) => state.nextStep);
  const prevStep = useOnboardingStore((state) => state.prevStep);
  const skipTour = useOnboardingStore((state) => state.skipTour);
  const endTour = useOnboardingStore((state) => state.endTour);
  const isFirstStep = useOnboardingStore((state) => state.isFirstStep);
  const isLastStep = useOnboardingStore((state) => state.isLastStep);
  const goToStep = useOnboardingStore((state) => state.goToStep);
  const skipCapability = useOnboardingStore((state) => state.skipCapability);

  const skyEngine = useSettingsStore((state) => state.skyEngine);
  const stelAvailable = useStellariumStore((state) => Boolean(state.stel));

  // Follow the shell SSOT (900px + landscape rules) so tour steps match the
  // layout actually rendered — between 640-900px the shell is already mobile.
  const { isMobileShell: isMobile } = useMobileShell();

  const wasTourActiveRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const stepCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isTourActive || !activeTourId) return;

    const { steps, skipped } = resolveTourSteps(
      {
        isMobile,
        isTauri: isTauri(),
        skyEngine,
        stelAvailable,
        featureVisibility: {},
      },
      activeTourId,
    );

    setActiveTourSteps(steps);
    for (const skippedStep of skipped) {
      skipCapability(skippedStep.capabilityId, skippedStep.reason);
    }

    if (steps.length === 0) {
      endTour();
      return;
    }

    if (currentStepIndex >= steps.length) {
      goToStep(steps.length - 1);
    }
  }, [
    activeTourId,
    currentStepIndex,
    endTour,
    goToStep,
    isMobile,
    isTourActive,
    setActiveTourSteps,
    skipCapability,
    skyEngine,
    stelAvailable,
  ]);

  const runBeforeEnterActions = useCallback(
    async (step: TourStep) => {
      const actions = step.beforeEnterAction
        ? Array.isArray(step.beforeEnterAction)
          ? step.beforeEnterAction
          : [step.beforeEnterAction]
        : [];

      if (actions.length === 0) {
        return null;
      }

      const cleanups: Array<() => void> = [];
      const bridge = useOnboardingBridgeStore.getState();

      for (const action of actions) {
        switch ((action as TourBeforeEnterAction).type) {
          case 'expandRightPanel': {
            const wasCollapsed =
              useSettingsStore.getState().preferences.rightPanelCollapsed;
            bridge.expandRightPanel();
            if (wasCollapsed) {
              cleanups.push(() =>
                useSettingsStore
                  .getState()
                  .setPreference('rightPanelCollapsed', true),
              );
            }
            break;
          }
          case 'openSettingsDrawer':
            bridge.closeTransientPanels();
            bridge.openSettingsDrawer(action.tab);
            break;
          case 'openSearch':
            bridge.closeTransientPanels();
            bridge.openSearch();
            break;
          case 'openMobileDrawer':
            bridge.closeTransientPanels();
            bridge.openMobileDrawer(action.section);
            break;
          case 'openToolbarOverflow':
            // Desktop: reveal the folded toolbar group by opening the "More"
            // overflow menu (no-op when nothing is folded). Closed on step exit.
            bridge.openToolbarOverflow();
            cleanups.push(() => bridge.closeToolbarOverflow());
            break;
          case 'openDailyKnowledge':
            bridge.closeTransientPanels();
            bridge.openDailyKnowledge();
            break;
          case 'closeTransientPanels':
            bridge.closeTransientPanels();
            break;
        }
      }

      await wait(160);
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },
    [],
  );

  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    let cancelled = false;
    stepCleanupRef.current?.();
    stepCleanupRef.current = null;

    const execute = async () => {
      const cleanup = await runBeforeEnterActions(currentStep);
      if (cancelled) {
        cleanup?.();
        return;
      }
      stepCleanupRef.current = cleanup ?? null;
      const target = await resolveStepTarget(currentStep.targetSelector);
      if (cancelled || target) return;

      if (
        currentStep.fallbackMode === 'skip'
        && currentStep.placement !== 'center'
        && currentStep.capabilityId
      ) {
        const reason: StepSkipReason = {
          code: 'missing-selector',
          messageKey: 'onboarding.skipReasons.missing-selector',
          details: currentStep.targetSelector,
        };
        skipCapability(currentStep.capabilityId, reason);
        nextStep();
      }
    };

    execute();

    return () => {
      cancelled = true;
    };
  }, [currentStep, isTourActive, nextStep, runBeforeEnterActions, skipCapability]);

  // Notify callbacks and manage focus
  useEffect(() => {
    const wasActive = wasTourActiveRef.current;
    if (!wasActive && isTourActive) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      onTourStart?.();
    }
    if (wasActive && !isTourActive) {
      stepCleanupRef.current?.();
      stepCleanupRef.current = null;
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
      onTourEnd?.();
    }
    wasTourActiveRef.current = isTourActive;
  }, [isTourActive, onTourStart, onTourEnd]);

  useEffect(() => {
    if (isTourActive && currentStepIndex >= 0) {
      onStepChange?.(currentStepIndex);
    }
  }, [isTourActive, currentStepIndex, onStepChange]);

  const handleNext = useCallback(() => {
    const finishing = isLastStep();
    const tourId = activeTourId;
    nextStep();
    if (finishing && tourId) {
      onTourCompleted?.(tourId);
    }
  }, [activeTourId, isLastStep, nextStep, onTourCompleted]);

  // Keyboard navigation
  useEffect(() => {
    if (!isTourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          endTour();
          break;
        case 'ArrowRight':
        case 'Enter':
          handleNext();
          break;
        case 'ArrowLeft':
          if (!isFirstStep()) {
            prevStep();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [endTour, handleNext, isFirstStep, isTourActive, prevStep]);

  if (!isTourActive || !currentStep) {
    return null;
  }

  return (
    <>
      <TourSpotlight
        targetSelector={currentStep.targetSelector}
        padding={currentStep.highlightPadding}
        isActive={isTourActive}
        spotlightRadius={currentStep.spotlightRadius}
      />

      <TourTooltip
        step={currentStep}
        currentIndex={currentStepIndex}
        totalSteps={activeTourSteps.length}
        onNext={handleNext}
        onPrev={prevStep}
        onSkip={skipTour}
        onClose={endTour}
        isFirst={isFirstStep()}
        isLast={isLastStep()}
      />
    </>
  );
}
