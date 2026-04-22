'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Rocket, 
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';
import { SETUP_WIZARD_STEPS, STEP_ICONS } from '@/lib/constants/setup-wizard';
import type { SetupWizardStep, SetupWizardProps } from '@/types/starmap/setup-wizard';
import { WelcomeStep } from './steps/welcome-step';
import { LocationStep } from './steps/location-step';
import { EquipmentStep } from './steps/equipment-step';
import { PreferencesStep } from './steps/preferences-step';
import { CompleteStep } from './steps/complete-step';

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const t = useTranslations();
  const isOpen = useSetupWizardStore((state) => state.isOpen);
  const hasCompletedSetup = useSetupWizardStore((state) => state.hasCompletedSetup);
  const showOnNextVisit = useSetupWizardStore((state) => state.showOnNextVisit);
  const currentStep = useSetupWizardStore((state) => state.currentStep);
  const completedSteps = useSetupWizardStore((state) => state.completedSteps);
  const openWizard = useSetupWizardStore((state) => state.openWizard);
  const closeWizard = useSetupWizardStore((state) => state.closeWizard);
  const nextStep = useSetupWizardStore((state) => state.nextStep);
  const prevStep = useSetupWizardStore((state) => state.prevStep);
  const goToStep = useSetupWizardStore((state) => state.goToStep);
  const completeSetup = useSetupWizardStore((state) => state.completeSetup);
  const isFirstStep = useSetupWizardStore((state) => state.isFirstStep);
  const isLastStep = useSetupWizardStore((state) => state.isLastStep);
  const canProceed = useSetupWizardStore((state) => state.canProceed);
  const getCurrentStepIndex = useSetupWizardStore((state) => state.getCurrentStepIndex);

  const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
  // Track animation direction: 1 = forward, -1 = backward
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!mounted) setMounted(true);
  }, [mounted]);

  // Auto-open wizard for first-time users
  useEffect(() => {
    if (!mounted) return;
    
    const timer = setTimeout(() => {
      if (!hasCompletedSetup && showOnNextVisit) {
        openWizard();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [mounted, hasCompletedSetup, showOnNextVisit, openWizard]);

  const handleNext = () => {
    setDirection(1);
    if (isLastStep()) {
      completeSetup();
      onComplete?.();
    } else {
      nextStep();
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    prevStep();
  };

  const handleSkip = () => {
    completeSetup();
    onComplete?.();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeWizard();
    }
  };

  const handleStepClick = useCallback((step: SetupWizardStep, index: number) => {
    const currentIdx = useSetupWizardStore.getState().getCurrentStepIndex();
    const completed = useSetupWizardStore.getState().completedSteps;
    // Allow clicking completed steps or steps before current
    if (completed.includes(step) || index <= currentIdx) {
      setDirection(index > currentIdx ? 1 : -1);
      goToStep(step);
    }
  }, [goToStep]);

  // Keyboard navigation: ArrowLeft/ArrowRight when not in an input
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDirection(1);
        if (!isLastStep()) nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDirection(-1);
        if (!isFirstStep()) prevStep();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isLastStep, isFirstStep, nextStep, prevStep]);

  const currentIndex = getCurrentStepIndex();
  const progress = ((currentIndex + 1) / SETUP_WIZARD_STEPS.length) * 100;

  if (!mounted) return null;

  const stepContent = (() => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep />;
      case 'location':
        return <LocationStep />;
      case 'equipment':
        return <EquipmentStep />;
      case 'preferences':
        return <PreferencesStep />;
      case 'complete':
        return <CompleteStep />;
      default:
        return null;
    }
  })();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] max-h-[90dvh] overflow-hidden bg-card/95 backdrop-blur-md border-border p-0">
        {/* Visually hidden title for accessibility */}
        <DialogTitle className="sr-only">
          {t('setupWizard.title')}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t(`setupWizard.steps.${currentStep}.subtitle`)}
        </DialogDescription>
        {/* Header with progress */}
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          
          {/* Step indicators */}
          <div className="relative px-6 pt-10 pb-4">
            <div className="flex items-center justify-between mb-4" role="tablist" aria-label={t('setupWizard.title')}>
              {SETUP_WIZARD_STEPS.map((step, index) => {
                const Icon = STEP_ICONS[step];
                const isActive = step === currentStep;
                const isCompleted = completedSteps.includes(step);
                const isPast = index < currentIndex;
                const isClickable = isCompleted || index <= currentIndex;
                
                return (
                  <div key={step} className="flex items-center">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-current={isActive ? 'step' : undefined}
                      aria-label={t(`setupWizard.steps.${step}.title`)}
                      tabIndex={isActive ? 0 : -1}
                      disabled={!isClickable}
                      onClick={() => handleStepClick(step, index)}
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                        isActive && 'bg-primary border-primary text-primary-foreground scale-110',
                        isCompleted && !isActive && 'bg-primary/20 border-primary/50 text-primary',
                        isPast && !isCompleted && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                        !isActive && !isCompleted && !isPast && 'bg-muted/50 border-border text-muted-foreground',
                        isClickable && !isActive && 'cursor-pointer hover:scale-105',
                        !isClickable && 'cursor-default opacity-60'
                      )}
                    >
                      {isCompleted && !isActive ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </button>
                    {index < SETUP_WIZARD_STEPS.length - 1 && (
                      <div
                        className={cn(
                          'flex-1 min-w-6 h-0.5 mx-1 sm:mx-2 transition-colors duration-300',
                          index < currentIndex ? 'bg-primary/50' : 'bg-border'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Progress bar */}
            <Progress value={progress} className="h-1" />
            
            {/* Step title */}
            <div className="mt-4 text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {t(`setupWizard.steps.${currentStep}.title`)}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t(`setupWizard.steps.${currentStep}.subtitle`)}
              </p>
            </div>
          </div>
        </div>

        {/* Content area with step transition animation */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh] max-h-[50dvh]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -60 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {stepContent}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30">
          <div>
            {currentStep !== 'welcome' && currentStep !== 'complete' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleSkip}
              >
                {t('setupWizard.skipSetup')}
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isFirstStep() && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('setupWizard.back')}
              </Button>
            )}
            
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-1 bg-primary hover:bg-primary/90"
            >
              {isLastStep() ? (
                <>
                  {t('setupWizard.getStarted')}
                  <Rocket className="h-4 w-4" />
                </>
              ) : (
                <>
                  {t('setupWizard.next')}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
