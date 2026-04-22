'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { SkyMapLogo } from '@/components/icons';
import { usePrefersReducedMotion } from '@/lib/hooks/use-prefers-reduced-motion';
import { SPLASH_STARS, SPLASH_SHOOTING_STARS } from '@/lib/constants';
import type { SplashScreenProps } from '@/types';

export function SplashScreen({ 
  onComplete, 
  minDuration = 2500,
  isReady = false,
  completionHint = null,
}: SplashScreenProps) {
  const t = useTranslations();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<'init' | 'stars' | 'logo' | 'loading' | 'fadeout'>(
    prefersReducedMotion ? 'loading' : 'init'
  );
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Stable loading messages ref to avoid re-triggering effect on locale changes
  const messagesRef = useRef<string[]>([]);
  useEffect(() => {
    messagesRef.current = [
      t('splash.loading'),
      t('splash.loadingStars'),
      t('splash.loadingEngine'),
    ];
    setLoadingMessage(messagesRef.current[0]);
  }, [t]);

  // Skip handler — allows user to dismiss splash early
  const handleSkip = useCallback(() => {
    setPhase('fadeout');
    setTimeout(() => onCompleteRef.current?.(), prefersReducedMotion ? 0 : 400);
  }, [prefersReducedMotion]);

  // Keyboard skip (Escape / Enter / Space)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSkip]);

  // React to external isReady signal
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);
  useEffect(() => {
    if (!isReady || phase === 'fadeout') return;
    // Defer state update to next microtask to avoid sync setState in effect
    const id = requestAnimationFrame(() => {
      if (!isReadyRef.current) return;
      if (completionHint) {
        setTimeout(() => {
          if (isReadyRef.current) {
            handleSkip();
          }
        }, prefersReducedMotion ? 0 : 600);
        return;
      }
      handleSkip();
    });
    return () => cancelAnimationFrame(id);
  }, [isReady, phase, handleSkip, completionHint, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      // Reduced motion: skip animation phases, just show loading then complete
      const timer = setTimeout(() => {
        onCompleteRef.current?.();
      }, Math.min(minDuration, 1000));
      return () => clearTimeout(timer);
    }

    // Phase 0: Initial state (0-100ms)
    const timer0 = setTimeout(() => setPhase('stars'), 100);
    
    // Phase 1: Stars appear (100-600ms)
    const timer1 = setTimeout(() => setPhase('logo'), 600);
    
    // Phase 2: Logo appears (600-1400ms)
    const timer2 = setTimeout(() => setPhase('loading'), 1400);
    
    // Phase 3: Loading progress with messages
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      const msgs = messagesRef.current;
      if (msgs.length > 0) {
        messageIndex = (messageIndex + 1) % msgs.length;
        setLoadingMessage(msgs[messageIndex]);
      }
    }, 600);
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        // Smoother progress with easing
        const remaining = 100 - prev;
        const increment = Math.max(2, remaining * 0.15 + Math.random() * 5);
        return Math.min(prev + increment, 100);
      });
    }, 80);
    
    // Phase 4: Fade out
    const timer3 = setTimeout(() => {
      setPhase('fadeout');
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    }, minDuration - 300);
    
    // Complete
    const timer4 = setTimeout(() => {
      onCompleteRef.current?.();
    }, minDuration);
    
    return () => {
      clearTimeout(timer0);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [minDuration, prefersReducedMotion]);

  const showContent = phase !== 'init';
  const showLogo = phase === 'logo' || phase === 'loading' || phase === 'fadeout';
  const showLoading = phase === 'loading';
  const isBusy = phase !== 'fadeout';

  return (
    <div 
      role="status"
      aria-live="polite"
      aria-busy={isBusy}
      aria-label={isBusy ? loadingMessage : undefined}
      data-testid="splash-screen"
      onClick={handleSkip}
      className={cn(
        'fixed inset-0 z-[100] bg-gradient-to-b from-slate-950 via-slate-900 to-black',
        'flex flex-col items-center justify-center overflow-hidden safe-area-inset cursor-pointer',
        phase === 'fadeout' && 'splash-fade-out pointer-events-none'
      )}
    >
      <span className="sr-only">
        {isBusy ? loadingMessage : t('splash.tagline')}
      </span>
      {/* Animated Star Field Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Stars layer with GPU-accelerated animations */}
        <div 
          className={cn(
            'absolute inset-0 transition-opacity duration-700',
            showContent ? 'opacity-100' : 'opacity-0'
          )}
        >
          {SPLASH_STARS.map((star) => (
            <div
              key={`star-${star.id}`}
              className="absolute rounded-full bg-white splash-star"
              style={{
                width: `${star.size}px`,
                height: `${star.size}px`,
                left: `${star.left}%`,
                top: `${star.top}%`,
                '--twinkle-duration': `${star.duration}s`,
                '--twinkle-delay': `${star.delay}s`,
                opacity: star.brightness,
              } as React.CSSProperties}
            />
          ))}
        </div>
        
        {/* Shooting stars with smooth animation */}
        <div className="absolute inset-0 pointer-events-none">
          {SPLASH_SHOOTING_STARS.map((star) => (
            <div
              key={`shooting-${star.id}`}
              className={cn(
                'absolute h-px bg-gradient-to-r from-transparent via-white to-transparent',
                'splash-shooting-star'
              )}
              style={{
                width: '120px',
                left: `${star.startX}%`,
                top: `${star.startY}%`,
                transform: 'rotate(-45deg)',
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
              }}
            />
          ))}
        </div>
        
        {/* Nebula glow effect */}
        <div 
          className={cn(
            'absolute w-[500px] h-[500px] rounded-full splash-nebula-glow',
            'transition-opacity duration-1000',
            showContent ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            left: '50%',
            top: '35%',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(60px)',
            background: 'radial-gradient(circle, oklch(0.55 0.25 290 / 0.2), oklch(0.55 0.25 250 / 0.1), transparent)',
          }}
        />
        
        {/* Secondary nebula */}
        <div 
          className={cn(
            'absolute w-[300px] h-[300px] rounded-full',
            'transition-opacity duration-1000 delay-300',
            showContent ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            right: '10%',
            bottom: '20%',
            filter: 'blur(50px)',
            background: 'radial-gradient(circle, oklch(0.7 0.15 200 / 0.15), transparent)',
          }}
        />
      </div>
      
      {/* Logo Container */}
      <div 
        className={cn(
          'relative z-10 flex flex-col items-center px-4',
          showLogo ? 'splash-logo-enter' : 'opacity-0'
        )}
      >
        {/* Animated Logo Icon */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 mb-6 sm:mb-8">
          {/* Pulsing ring effects */}
          <div className="absolute inset-0 rounded-full border border-primary/30 splash-ring-pulse" />
          <div 
            className="absolute inset-0 rounded-full border border-primary/20 splash-ring-pulse"
            style={{ animationDelay: '0.5s' }}
          />
          
          {/* Outer rotating ring */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            style={{ 
              animation: 'spin 12s linear infinite',
              borderStyle: 'dashed',
            }}
          />
          
          {/* Inner glow ring */}
          <div 
            className="absolute inset-3 rounded-full border border-primary/50 animate-pulse-subtle"
          />
          
          {/* Center star icon with glow */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <SkyMapLogo 
                className="w-12 h-12 sm:w-14 sm:h-14 text-primary splash-star-spin"
                strokeWidth={1.5}
              />
              {/* Star glow */}
              <div 
                className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse-subtle"
              />
            </div>
          </div>
          
          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <div
              key={`orbit-${i}`}
              className="absolute w-2 h-2 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 splash-orbit-dot shadow-lg shadow-blue-400/50"
              style={{
                top: '50%',
                left: '50%',
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}
        </div>
        
        {/* App Name with reveal animation */}
        <h1 
          className={cn(
            'text-3xl sm:text-4xl font-bold text-white mb-2',
            showLogo && 'splash-text-enter'
          )}
          style={{ animationDelay: '0.2s' }}
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
            Sky
          </span>
          <span className="text-white">Map</span>
        </h1>
        
        <p 
          className={cn(
            'text-sm sm:text-base text-slate-400 mb-8 sm:mb-10 text-center opacity-0',
            showLogo && 'splash-text-enter'
          )}
          style={{ animationDelay: '0.4s' }}
        >
          {t('splash.tagline')}
        </p>
        
        {/* Loading Bar with glow effect */}
        <div 
          className={cn(
            'w-48 sm:w-56 transition-all duration-500',
            showLoading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          )}
        >
          <div className="relative">
            <Progress 
              value={Math.min(progress, 100)} 
              className="h-1.5 bg-slate-800/80 splash-progress-bar rounded-full overflow-hidden"
            />
            {/* Progress glow overlay */}
            <div 
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3) ${progress}%, transparent ${progress}%)`,
              }}
            />
          </div>
          
          {/* Loading percentage */}
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-slate-500 transition-opacity duration-300">
              {loadingMessage}
            </p>
            <p className="text-xs text-slate-600 tabular-nums">
              {Math.round(Math.min(progress, 100))}%
            </p>
          </div>
          {completionHint ? (
            <p className="mt-3 text-[11px] text-amber-300/90" data-testid="splash-completion-hint">
              {completionHint}
            </p>
          ) : null}
        </div>
      </div>
      
      {/* Version & Credits */}
      <div 
        className={cn(
          'absolute bottom-8 sm:bottom-10 text-center px-4 safe-area-bottom',
          'transition-all duration-700 delay-500',
          showLogo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        <p className="text-[11px] sm:text-xs text-slate-600">
          {t('splash.poweredBy')}
        </p>
      </div>

      {/* Skip hint */}
      <div 
        className={cn(
          'absolute bottom-20 sm:bottom-24 text-center safe-area-bottom',
          'transition-opacity duration-500 delay-1000',
          showLoading ? 'opacity-60' : 'opacity-0'
        )}
      >
        <p className="text-[10px] text-slate-500">
          {t('splash.skipHint')}
        </p>
      </div>
    </div>
  );
}
