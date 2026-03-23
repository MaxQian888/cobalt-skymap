'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/common/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { LoadingState } from '@/types/stellarium-canvas';

const SLOW_LOADING_THRESHOLD = 15;
const ELAPSED_SHOW_THRESHOLD = 3;

interface LoadingOverlayProps {
  loadingState: LoadingState;
  onRetry: () => void;
}

/**
 * Loading overlay component for Stellarium canvas
 * Shows loading spinner, progress bar, status message, and retry button on error
 */
export function LoadingOverlay({ loadingState, onRetry }: LoadingOverlayProps) {
  const t = useTranslations('canvas');
  const { isLoading, loadingStatus, errorMessage, startTime, progress, phase } = loadingState;
  const [elapsed, setElapsed] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading || !startTime) {
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [isLoading, startTime]);

  // Smoothly animate progress towards the target value
  useEffect(() => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);

    const animate = () => {
      setSmoothProgress(prev => {
        const target = progress;
        if (prev >= target) return target;
        // Ease towards target: fast jump + slow approach
        const step = Math.max(0.5, (target - prev) * 0.15);
        const next = Math.min(prev + step, target);
        if (next < target) {
          animRef.current = requestAnimationFrame(animate);
        }
        return next;
      });
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, [progress]);

  const isSlow = isLoading && !errorMessage && elapsed >= SLOW_LOADING_THRESHOLD;
  const isFirstLoad = isLoading && !errorMessage && elapsed >= 5 && elapsed < SLOW_LOADING_THRESHOLD;
  const showTerminalRetry = !isLoading && (phase === 'timed_out' || phase === 'failed' || phase === 'degraded');
  const showRetry = isSlow || Boolean(errorMessage) || showTerminalRetry;
  const liveRole: 'status' | 'alert' = errorMessage || showTerminalRetry ? 'alert' : 'status';

  // Don't render if not loading and no terminal failure state
  if (!isLoading && !errorMessage && !showTerminalRetry) {
    return null;
  }

  return (
    <div
      data-testid="stellarium-loading-overlay"
      data-starmap-ui-control="true"
      role={liveRole}
      aria-live={liveRole === 'alert' ? 'assertive' : 'polite'}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/85 px-4"
    >
      <Card className="w-full max-w-80 border-border/70 bg-background/95 py-4 shadow-lg backdrop-blur-sm">
        <CardContent className="px-4">
          <div className="flex flex-col items-center text-center">
            {isLoading && !errorMessage && (
              <Spinner className="mb-3 h-8 w-8 text-primary" />
            )}

            {isLoading && !errorMessage && (
              <div className="mb-3 w-52 sm:w-60">
                <Progress
                  value={Math.round(smoothProgress)}
                  className="h-1.5 bg-muted/40"
                />
              </div>
            )}

            <p className="mb-2 text-sm text-muted-foreground">{loadingStatus}</p>

            {isLoading && !errorMessage && elapsed >= ELAPSED_SHOW_THRESHOLD && (
              <p className="mb-1 text-xs tabular-nums text-muted-foreground/70">
                {t('elapsedTime', { seconds: elapsed })}
              </p>
            )}

            {isFirstLoad && (
              <p className="mt-1 text-xs text-muted-foreground/50">{t('firstLoadHint')}</p>
            )}

            {isSlow && (
              <Alert className="mt-3 border-yellow-500/40 bg-yellow-500/15 py-2 text-yellow-100">
                <AlertDescription className="justify-items-center text-center text-xs text-inherit">
                  {t('loadingSlowHint')}
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="destructive" className="mt-3 w-full py-2">
                <AlertDescription className="justify-items-start text-left text-xs">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {showRetry && (
              <Button className="mt-3" size="sm" onClick={onRetry}>
                {t('retry')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
