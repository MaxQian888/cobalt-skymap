'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Rocket, MapPin, Telescope, Settings2, ArrowRight } from 'lucide-react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { WELCOME_FEATURES } from '@/lib/constants/onboarding';
import { cn } from '@/lib/utils';
import type { WelcomeDialogProps, OnboardingRestartButtonProps } from '@/types/starmap/onboarding';

const SETUP_FEATURES = [
  { icon: MapPin, key: 'location' },
  { icon: Telescope, key: 'equipment' },
  { icon: Settings2, key: 'preferences' },
] as const;

export function WelcomeDialog({ onStartTour, onSkip }: WelcomeDialogProps) {
  const t = useTranslations();
  const hasSeenWelcome = useOnboardingStore((state) => state.hasSeenWelcome);
  const hasCompletedOnboarding = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const hasCompletedSetup = useOnboardingStore((state) => state.hasCompletedSetup);
  const showOnNextVisit = useOnboardingStore((state) => state.showOnNextVisit);
  const isTourActive = useOnboardingStore((state) => state.isTourActive);
  const isSetupOpen = useOnboardingStore((state) => state.isSetupOpen);
  const setHasSeenWelcome = useOnboardingStore((state) => state.setHasSeenWelcome);
  const setShowOnNextVisit = useOnboardingStore((state) => state.setShowOnNextVisit);
  const openSetup = useOnboardingStore((state) => state.openSetup);
  const skipSetupStartTour = useOnboardingStore((state) => state.skipSetupStartTour);

  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Show dialog only for first-time users
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasSeenWelcome && showOnNextVisit && !hasCompletedOnboarding && !isTourActive && !isSetupOpen) {
        setIsOpen(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [hasSeenWelcome, showOnNextVisit, hasCompletedOnboarding, isTourActive, isSetupOpen]);

  const handleStartSetup = () => {
    setHasSeenWelcome(true);
    if (dontShowAgain) {
      setShowOnNextVisit(false);
    }
    setIsOpen(false);
    openSetup();
    onStartTour?.();
  };

  const handleSkipToTour = () => {
    setHasSeenWelcome(true);
    if (dontShowAgain) {
      setShowOnNextVisit(false);
    }
    setIsOpen(false);
    skipSetupStartTour();
    onStartTour?.();
  };

  const handleSkip = () => {
    setHasSeenWelcome(true);
    if (dontShowAgain) {
      setShowOnNextVisit(false);
    }
    setIsOpen(false);
    onSkip?.();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleSkip();
    }
    setIsOpen(open);
  };

  if (hasCompletedOnboarding || !showOnNextVisit) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="sm:max-w-lg bg-card/95 backdrop-blur-md border-border text-card-foreground overflow-hidden"
        showCloseButton={false}
      >
        {/* Animated background stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full tour-welcome-star"
              style={{
                left: `${(i * 13.7) % 100}%`,
                top: `${(i * 17.3) % 100}%`,
                animationDelay: `${(i * 0.2) % 3}s`,
                opacity: 0.3 + (i % 4) * 0.2,
              }}
            />
          ))}
        </div>

        <DialogHeader className="relative z-10">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
          </div>
          <DialogTitle className="text-2xl text-center text-foreground">
            {t('onboarding.welcome.title')}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-base">
            {t('onboarding.welcome.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* App features grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 py-3">
          {WELCOME_FEATURES.map(({ icon: Icon, key }, index) => (
            <Card
              key={key}
              className={cn(
                'tour-feature-card gap-0 bg-muted/50 py-0 transition-colors',
                'hover:bg-muted hover:border-primary/30'
              )}
              style={{
                animationDelay: `${index * 100}ms`,
              }}
            >
              <CardContent className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm">
                    {t(`onboarding.welcome.features.${key}.title`)}
                  </CardTitle>
                  <CardDescription className="truncate text-xs">
                    {t(`onboarding.welcome.features.${key}.description`)}
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Setup configuration preview */}
        {!hasCompletedSetup && (
          <Card className="relative z-10 gap-0 border-dashed bg-muted/30 py-0 shadow-none">
            <CardHeader className="px-4 py-3">
              <CardDescription className="text-xs">
                {t('setupWizard.steps.welcome.whatWellConfigure')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 px-4 pb-3">
              {SETUP_FEATURES.map(({ icon: Icon, key }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary/70" />
                  <span>{t(`setupWizard.steps.welcome.features.${key}.title`)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Don't show again checkbox */}
        <div className="relative z-10 flex items-center space-x-2 py-2">
          <Checkbox
            id="dont-show"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            className="border-border data-[state=checked]:bg-primary"
          />
          <Label
            htmlFor="dont-show"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            {t('onboarding.welcome.dontShowAgain')}
          </Label>
        </div>

        <DialogFooter className="relative z-10 flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            {t('onboarding.welcome.skipTour')}
          </Button>
          {!hasCompletedSetup ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSkipToTour}
                className="gap-1"
              >
                <ArrowRight className="w-4 h-4" />
                {t('onboarding.welcome.skipToTour')}
              </Button>
              <Button
                onClick={handleStartSetup}
                className="bg-primary hover:bg-primary/90 text-white gap-2"
              >
                <Rocket className="w-4 h-4" />
                {t('onboarding.welcome.startSetup')}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleSkipToTour}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Rocket className="w-4 h-4" />
              {t('onboarding.welcome.startTour')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingRestartButton({
  variant = 'outline',
  size = 'sm',
  className,
}: OnboardingRestartButtonProps) {
  const t = useTranslations();
  const restartAllOnboarding = useOnboardingStore((state) => state.restartAllOnboarding);

  const handleRestart = () => {
    restartAllOnboarding();
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleRestart}
      className={cn('gap-2', className)}
    >
      <Sparkles className="w-4 h-4" />
      {t('onboarding.restartAll')}
    </Button>
  );
}

/**
 * @deprecated Use OnboardingRestartButton instead.
 */
export const TourRestartButton = OnboardingRestartButton;
