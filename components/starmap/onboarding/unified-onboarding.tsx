'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Rocket,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useMessierMarathonStore } from '@/lib/stores/messier-marathon-store';
import { SETUP_WIZARD_STEPS, STEP_ICONS } from '@/lib/constants/onboarding';
import { TOUR_DEFINITIONS } from '@/lib/constants/onboarding-capabilities';
import type {
  SetupWizardStep,
  TourId,
  UnifiedOnboardingProps,
} from '@/types/starmap/onboarding';
import { LocationStep } from './steps/location-step';
import { EquipmentStep } from './steps/equipment-step';
import { PreferencesStep } from './steps/preferences-step';
import { WelcomeDialog } from './welcome-dialog';
import { OnboardingTour } from './onboarding-tour';

const SOFT_GUARD_STEPS: SetupWizardStep[] = ['location', 'equipment'];

export function UnifiedOnboarding({
  onComplete,
  initialTourId,
  onTourCompleted,
}: UnifiedOnboardingProps) {
  const t = useTranslations();
  const phase = useOnboardingStore((state) => state.phase);
  const resumeCheckpoint = useOnboardingStore((state) => state.resumeCheckpoint);
  const tourHubOpen = useOnboardingStore((state) => state.tourHubOpen);
  const isSetupOpen = useOnboardingStore((state) => state.isSetupOpen);
  const isTourActive = useOnboardingStore((state) => state.isTourActive);
  const openSetup = useOnboardingStore((state) => state.openSetup);
  const setupStep = useOnboardingStore((state) => state.setupStep);
  const setupCompletedSteps = useOnboardingStore((state) => state.setupCompletedSteps);
  const setupNextStep = useOnboardingStore((state) => state.setupNextStep);
  const setupPrevStep = useOnboardingStore((state) => state.setupPrevStep);
  const goToSetupStep = useOnboardingStore((state) => state.goToSetupStep);
  const closeSetup = useOnboardingStore((state) => state.closeSetup);
  const completeSetup = useOnboardingStore((state) => state.completeSetup);
  const finishSetupAndStartTour = useOnboardingStore((state) => state.finishSetupAndStartTour);
  const isSetupFirstStep = useOnboardingStore((state) => state.isSetupFirstStep);
  const isSetupLastStep = useOnboardingStore((state) => state.isSetupLastStep);
  const canSetupProceed = useOnboardingStore((state) => state.canSetupProceed);
  const getSetupStepIndex = useOnboardingStore((state) => state.getSetupStepIndex);
  const recordSetupSkip = useOnboardingStore((state) => state.recordSetupSkip);
  const startTourById = useOnboardingStore((state) => state.startTourById);
  const restartTourModule = useOnboardingStore((state) => state.restartTourModule);
  const resumeTour = useOnboardingStore((state) => state.resumeTour);
  const getTourProgress = useOnboardingStore((state) => state.getTourProgress);
  const completedTours = useOnboardingStore((state) => state.completedTours);
  const setTourHubOpen = useOnboardingStore((state) => state.setTourHubOpen);
  const resolveEntrySurface = useOnboardingStore((state) => state.resolveEntrySurface);
  const openMessierMarathonGuide = usePlanningUiStore((state) => state.openMessierMarathonGuide);
  const activeMessierSession = useMessierMarathonStore((state) => state.activeSession);

  const [direction, setDirection] = useState(1);
  const [showSetupSkipConfirm, setShowSetupSkipConfirm] = useState(false);
  const [pendingSetupSkipStep, setPendingSetupSkipStep] =
    useState<'location' | 'equipment' | null>(null);

  useEffect(() => {
    if (!initialTourId) return;
    const timer = window.setTimeout(() => {
      startTourById(initialTourId);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [initialTourId, startTourById]);

  useEffect(() => {
    if (initialTourId) return;
    const entry = resolveEntrySurface();

    if (entry === 'setup' && !isSetupOpen && phase !== 'tour') {
      openSetup();
      return;
    }

    if (entry === 'tour-hub' && !tourHubOpen) {
      setTourHubOpen(true);
      return;
    }

    if (
      entry === 'resume-tour'
      && !isTourActive
      && resumeCheckpoint?.phase === 'tour'
      && resumeCheckpoint.activeTourId
    ) {
      resumeTour(resumeCheckpoint.activeTourId);
    }
  }, [
    initialTourId,
    isSetupOpen,
    isTourActive,
    openSetup,
    phase,
    resolveEntrySurface,
    resumeCheckpoint,
    resumeTour,
    setTourHubOpen,
    tourHubOpen,
  ]);

  const handleAdvanceSetup = useCallback(() => {
    setDirection(1);
    if (isSetupLastStep()) {
      finishSetupAndStartTour();
    } else {
      setupNextStep();
    }
  }, [finishSetupAndStartTour, isSetupLastStep, setupNextStep]);

  const handleNext = useCallback(() => {
    if (!canSetupProceed() && SOFT_GUARD_STEPS.includes(setupStep)) {
      setPendingSetupSkipStep(setupStep as 'location' | 'equipment');
      setShowSetupSkipConfirm(true);
      return;
    }
    handleAdvanceSetup();
  }, [canSetupProceed, handleAdvanceSetup, setupStep]);

  const handleConfirmSkipStep = () => {
    if (pendingSetupSkipStep) {
      recordSetupSkip(pendingSetupSkipStep, 'user-confirmed-soft-skip');
    }
    setPendingSetupSkipStep(null);
    setShowSetupSkipConfirm(false);
    handleAdvanceSetup();
  };

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setupPrevStep();
  }, [setupPrevStep]);

  const handleSkip = () => {
    completeSetup();
    onComplete?.();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeSetup();
    }
  };

  const handleStepClick = useCallback(
    (step: SetupWizardStep, index: number) => {
      const currentIdx = useOnboardingStore.getState().getSetupStepIndex();
      const completed = useOnboardingStore.getState().setupCompletedSteps;
      if (completed.includes(step) || index <= currentIdx) {
        setDirection(index > currentIdx ? 1 : -1);
        goToSetupStep(step);
      }
    },
    [goToSetupStep],
  );

  useEffect(() => {
    if (!isSetupOpen) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (!isSetupFirstStep()) {
          handlePrev();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleNext, handlePrev, isSetupFirstStep, isSetupOpen]);

  const currentIndex = getSetupStepIndex();
  const progress = ((currentIndex + 1) / SETUP_WIZARD_STEPS.length) * 100;

  const configSteps: SetupWizardStep[] = ['location', 'equipment', 'preferences'];
  const isConfigStep = configSteps.includes(setupStep);

  const moduleTours = useMemo(
    () => TOUR_DEFINITIONS.filter((tour) => !tour.isCore),
    [],
  );
  const showMessierMarathonCard = useMemo(() => {
    if (activeMessierSession) return true;
    const month = new Date().getMonth();
    return month >= 1 && month <= 4;
  }, [activeMessierSession]);

  const stepContent = (() => {
    switch (setupStep) {
      case 'welcome':
        return null;
      case 'location':
        return <LocationStep />;
      case 'equipment':
        return <EquipmentStep />;
      case 'preferences':
        return <PreferencesStep />;
      case 'complete':
        return <SetupCompleteTransition onStartTour={finishSetupAndStartTour} onSkip={handleSkip} />;
      default:
        return null;
    }
  })();

  const handleTourCompleted = (tourId: TourId) => {
    if (tourId === 'first-run-core') {
      setTourHubOpen(true);
      onComplete?.();
    }
    onTourCompleted?.(tourId);
  };

  return (
    <>
      <WelcomeDialog />

      {isSetupOpen && isConfigStep && (
        <Dialog open={isSetupOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] max-h-[90dvh] overflow-hidden bg-card/95 backdrop-blur-md border-border p-0">
            <DialogTitle className="sr-only">{t('setupWizard.title')}</DialogTitle>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />

              <div className="relative px-6 pt-10 pb-4">
                <div
                  className="flex items-center justify-between mb-4"
                  role="tablist"
                  aria-label={t('setupWizard.title')}
                >
                  {SETUP_WIZARD_STEPS.filter((s) => s !== 'welcome').map((step, index) => {
                    const Icon = STEP_ICONS[step];
                    const isActive = step === setupStep;
                    const isCompleted = setupCompletedSteps.includes(step);
                    const realIndex = SETUP_WIZARD_STEPS.indexOf(step);
                    const isPast = realIndex < SETUP_WIZARD_STEPS.indexOf(setupStep);
                    const isClickable =
                      isCompleted || realIndex <= SETUP_WIZARD_STEPS.indexOf(setupStep);

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
                          onClick={() => handleStepClick(step, realIndex)}
                          className={cn(
                            'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                            isActive && 'bg-primary border-primary text-primary-foreground scale-110',
                            isCompleted &&
                              !isActive &&
                              'bg-primary/20 border-primary/50 text-primary',
                            isPast &&
                              !isCompleted &&
                              'bg-muted border-muted-foreground/30 text-muted-foreground',
                            !isActive &&
                              !isCompleted &&
                              !isPast &&
                              'bg-muted/50 border-border text-muted-foreground',
                            isClickable && !isActive && 'cursor-pointer hover:scale-105',
                            !isClickable && 'cursor-default opacity-60',
                          )}
                        >
                          {isCompleted && !isActive ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </button>
                        {index < SETUP_WIZARD_STEPS.filter((s) => s !== 'welcome').length - 1 && (
                          <div
                            className={cn(
                              'flex-1 min-w-6 h-0.5 mx-1 sm:mx-2 transition-colors duration-300',
                              isPast || isCompleted ? 'bg-primary/50' : 'bg-border',
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <Progress value={progress} className="h-1" />

                <div className="mt-4 text-center">
                  <h2 className="text-xl font-semibold text-foreground">
                    {t(`setupWizard.steps.${setupStep}.title`)}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(`setupWizard.steps.${setupStep}.subtitle`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 overflow-y-auto max-h-[50vh] max-h-[50dvh]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={setupStep}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {stepContent}
                </motion.div>
              </AnimatePresence>
            </div>

            <Separator />
            <div className="flex items-center justify-between px-6 py-4 bg-muted/30">
              <div>
                {setupStep !== 'complete' && (
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
                {!isSetupFirstStep() && setupStep !== 'welcome' && (
                  <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1">
                    <ChevronLeft className="h-4 w-4" />
                    {t('setupWizard.back')}
                  </Button>
                )}

                <Button size="sm" onClick={handleNext} className="gap-1 bg-primary hover:bg-primary/90">
                  {isSetupLastStep() ? (
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
      )}

      {isSetupOpen && setupStep === 'complete' && (
        <Dialog open={true} onOpenChange={() => handleSkip()}>
          <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-md border-border">
            <DialogTitle className="sr-only">{t('setupWizard.steps.complete.title')}</DialogTitle>
            <SetupCompleteTransition onStartTour={finishSetupAndStartTour} onSkip={handleSkip} />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showSetupSkipConfirm} onOpenChange={setShowSetupSkipConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('setupWizard.softGuard.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSetupSkipStep === 'location'
                ? t('setupWizard.softGuard.locationImpact')
                : t('setupWizard.softGuard.equipmentImpact')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSkipStep}>
              {t('setupWizard.softGuard.continueAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={tourHubOpen} onOpenChange={setTourHubOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              {t('onboarding.hub.title')}
            </DialogTitle>
            <DialogDescription>{t('onboarding.hub.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[45vh] max-h-[45dvh] overflow-y-auto pr-1">
            {showMessierMarathonCard && (
              <Card className="py-3 gap-0 border-primary/30 bg-primary/5">
                <CardContent className="flex items-center justify-between gap-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t('messierMarathon.title')}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeMessierSession
                        ? t('onboarding.hub.messierMarathonResumeDescription')
                        : t('onboarding.hub.messierMarathonDescription')}
                    </p>
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {activeMessierSession
                        ? t(`messierMarathon.readiness.${activeMessierSession.readiness}`)
                        : t('onboarding.hub.seasonalGuide')}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={activeMessierSession ? 'secondary' : 'default'}
                    onClick={() => {
                      setTourHubOpen(false);
                      openMessierMarathonGuide();
                    }}
                  >
                    {activeMessierSession
                      ? t('onboarding.hub.resumeMarathon')
                      : t('onboarding.hub.startMarathon')}
                  </Button>
                </CardContent>
              </Card>
            )}
            {moduleTours.map((tour) => {
              const progress = getTourProgress(tour.id);
              const done = completedTours.includes(tour.id);
              return (
                <Card key={tour.id} className="py-3 gap-0">
                  <CardContent className="flex items-center justify-between gap-3 px-4">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{t(tour.titleKey)}</p>
                      <p className="text-xs text-muted-foreground">{t(tour.descriptionKey)}</p>
                      <Badge
                        variant={done ? 'secondary' : 'outline'}
                        className="mt-1.5 text-xs"
                      >
                        {done
                          ? t('onboarding.hub.completed')
                          : t('onboarding.hub.progress', {
                              current: Math.max(progress.currentStepIndex + 1, 0),
                              total: progress.totalSteps,
                            })}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant={done ? 'outline' : 'default'}
                      onClick={() => {
                        setTourHubOpen(false);
                        if (done) {
                          restartTourModule(tour.id);
                          return;
                        }
                        if (progress.currentStepIndex > 0 && !progress.completed) {
                          resumeTour(tour.id);
                          return;
                        }
                        startTourById(tour.id);
                      }}
                    >
                      {done
                        ? t('onboarding.hub.restart')
                        : progress.currentStepIndex > 0 && !progress.completed
                          ? t('onboarding.hub.resume')
                          : t('onboarding.hub.start')}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTourHubOpen(false)}>
              {t('onboarding.hub.finishLater')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {phase === 'tour' && <OnboardingTour onTourCompleted={handleTourCompleted} />}
    </>
  );
}

function SetupCompleteTransition({
  onStartTour,
  onSkip,
}: {
  onStartTour: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations();

  return (
    <div className="text-center space-y-6 py-4">
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/30 to-green-500/10 flex items-center justify-center">
            <Check className="w-12 h-12 text-green-500" />
          </div>
          <div
            className="absolute -inset-2 rounded-full border-2 border-green-500/30 animate-ping"
            style={{ animationDuration: '2s' }}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">{t('setupWizard.steps.complete.title')}</h3>
        <p className="text-muted-foreground text-sm">{t('onboarding.transition.description')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={onStartTour} className="w-full bg-primary hover:bg-primary/90 text-white gap-2">
          <ArrowRight className="w-4 h-4" />
          {t('onboarding.transition.startTour')}
        </Button>
        <Button variant="ghost" onClick={onSkip} className="w-full text-muted-foreground hover:text-foreground">
          {t('onboarding.transition.skipTour')}
        </Button>
      </div>
    </div>
  );
}
