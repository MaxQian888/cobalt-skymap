'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StarField } from './star-field';
import { Rocket, BookOpen, ChevronDown, Sparkles } from 'lucide-react';
import { WindowsIcon, AppleIcon, LinuxIcon } from '@/components/icons';

function PlatformIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground/60">
      {children}
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function HeroSection() {
  const t = useTranslations('landing');

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen min-h-dvh flex items-center justify-center overflow-hidden bg-background">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
      
      {/* Nebula glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] splash-nebula-glow" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-secondary/15 rounded-full blur-[100px] splash-nebula-glow" style={{ animationDelay: '2s' }} />
      
      {/* Star field */}
      <StarField />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <Badge 
          variant="outline" 
          className="mb-8 px-4 py-2 glass-light border-border/50 animate-fade-in"
        >
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
          </span>
          <Sparkles className="h-3.5 w-3.5 mr-1.5 text-secondary" />
          {t('hero.badge')}
        </Badge>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground mb-6 splash-logo-enter">
          <span className="bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
            SkyMap
          </span>
        </h1>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl md:text-3xl text-muted-foreground mb-4 splash-text-enter" style={{ animationDelay: '0.2s' }}>
          {t('hero.tagline')}
        </p>

        {/* Description */}
        <p className="text-base sm:text-lg text-muted-foreground/80 max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          {t('hero.description')}
        </p>

        {/* CTA Buttons */}
        <TooltipProvider>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/starmap">
                  <Button size="lg" className="min-w-[180px] font-medium group">
                    <Rocket className="mr-2 h-5 w-5 group-hover:animate-float" />
                    {t('hero.launchButton')}
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('hero.launchTooltip')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-[180px] font-medium glass-light border-border/50"
                  onClick={scrollToFeatures}
                >
                  <BookOpen className="mr-2 h-5 w-5" />
                  {t('hero.learnMore')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('hero.learnMoreTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Platform support */}
        <div className="mt-10 flex items-center justify-center gap-6 animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <PlatformIcon label="Windows">
            <WindowsIcon className="h-4 w-4" />
          </PlatformIcon>
          <PlatformIcon label="macOS">
            <AppleIcon className="h-4 w-4" />
          </PlatformIcon>
          <PlatformIcon label="Linux">
            <LinuxIcon className="h-4 w-4" />
          </PlatformIcon>
        </div>
        <p className="mt-3 text-xs text-muted-foreground/40 animate-fade-in" style={{ animationDelay: '0.9s' }}>
          {t('hero.openSourceFree')}
        </p>
      </div>

      {/* Scroll indicator */}
      <Button
        variant="ghost"
        size="icon"
        onClick={scrollToFeatures}
        className="touch-target absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground/50 hover:text-muted-foreground animate-float"
        aria-label={t('hero.scrollToFeatures')}
      >
        <ChevronDown className="h-8 w-8" />
      </Button>
    </section>
  );
}
