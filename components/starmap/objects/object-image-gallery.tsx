'use client';

import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2,
  ExternalLink,
  ImageOff,
  Loader2,
  RotateCw,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { ObjectImageGalleryProps, ImageState } from '@/types/starmap/objects';

/** Dots pagination indicator */
function DotsPagination({
  count,
  currentIndex,
  onSelect,
  variant = 'default',
  className,
}: {
  count: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  variant?: 'default' | 'fullscreen';
  className?: string;
}) {
  const t = useTranslations();
  if (count <= 1) return null;

  return (
    <div className={cn('absolute left-1/2 -translate-x-1/2 flex gap-2', variant === 'default' && 'shell-desktop:gap-1.5', className)}>
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          aria-label={t('objectDetail.goToImage', { index: index + 1 })}
          className={cn(
            'rounded-full transition-all',
            variant === 'default' ? 'w-3 h-3 shell-desktop:w-2 shell-desktop:h-2 touch-target' : 'w-3 h-3',
            index === currentIndex
              ? 'bg-white scale-110'
              : variant === 'default' ? 'bg-white/50 hover:bg-white/70' : 'bg-white/40 hover:bg-white/60',
          )}
          onClick={(e) => { e.stopPropagation(); onSelect(index); }}
        />
      ))}
    </div>
  );
}

/** Navigation arrows for image gallery */
function NavigationArrows({
  onPrev,
  onNext,
  variant = 'default',
}: {
  onPrev: () => void;
  onNext: () => void;
  variant?: 'default' | 'fullscreen';
}) {
  const t = useTranslations();
  const isFullscreen = variant === 'fullscreen';
  const buttonClass = isFullscreen
    ? 'absolute top-1/2 -translate-y-1/2 z-10 h-12 w-12 bg-black/50 hover:bg-black/70 text-white'
    : 'absolute top-1/2 -translate-y-1/2 h-10 w-10 shell-desktop:h-8 shell-desktop:w-8 bg-black/50 hover:bg-black/70 text-white shell-desktop:opacity-0 shell-desktop:group-hover:opacity-100 transition-opacity touch-target';
  const iconClass = isFullscreen ? 'h-8 w-8' : 'h-6 w-6 shell-desktop:h-5 shell-desktop:w-5';
  const leftPos = isFullscreen ? 'left-2' : 'left-1';
  const rightPos = isFullscreen ? 'right-2' : 'right-1';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(buttonClass, leftPos)}
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label={t('objectDetail.previousImage')}
      >
        <ChevronLeft className={iconClass} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(buttonClass, rightPos)}
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label={t('objectDetail.nextImage')}
      >
        <ChevronRight className={iconClass} />
      </Button>
    </>
  );
}

export const ObjectImageGallery = memo(function ObjectImageGallery({
  images,
  objectName,
  className,
}: ObjectImageGalleryProps) {
  const t = useTranslations();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageStates, setImageStates] = useState<Record<number, ImageState>>({});
  // Per-image retry counter — bumping it cache-busts the <img> src to force a
  // fresh load attempt after a failure.
  const [retryKeys, setRetryKeys] = useState<Record<number, number>>({});
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentImage = images[currentIndex];
  
  // Create a stable key from images array to detect changes
  const imagesKey = useMemo(() => images.map(img => img.url).join('|'), [images]);
  
  // Track previous images key to reset state when images change
  const prevImagesKeyRef = useRef(imagesKey);
  
  // Reset state when images array changes
  // Using queueMicrotask to satisfy react-hooks/set-state-in-effect lint rule
  useEffect(() => {
    if (prevImagesKeyRef.current !== imagesKey) {
      prevImagesKeyRef.current = imagesKey;
      queueMicrotask(() => {
        setCurrentIndex(0);
        setImageStates({});
        setRetryKeys({});
      });
    }
  }, [imagesKey]);

  const handleImageLoad = useCallback((index: number) => {
    setImageStates(prev => ({
      ...prev,
      [index]: { loaded: true, error: false }
    }));
  }, []);

  const handleImageError = useCallback((index: number) => {
    setImageStates(prev => ({
      ...prev,
      [index]: { loaded: true, error: true }
    }));
  }, []);

  const handleRetry = useCallback((index: number) => {
    // Reset to the loading state and bump the retry key so the src changes.
    setImageStates(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setRetryKeys(prev => ({ ...prev, [index]: (prev[index] ?? 0) + 1 }));
  }, []);

  // Cache-busted src for a given image when a retry has been requested.
  const srcFor = useCallback((index: number, url: string) => {
    const retry = retryKeys[index];
    if (!retry) return url;
    return url + (url.includes('?') ? '&' : '?') + `retry=${retry}`;
  }, [retryKeys]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Touch/mouse drag handlers
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setTranslateX(0);
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    const diff = clientX - startX;
    setTranslateX(diff);
  }, [isDragging, startX]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const threshold = 50;
    if (translateX > threshold) {
      goToPrev();
    } else if (translateX < -threshold) {
      goToNext();
    }
    setTranslateX(0);
  }, [isDragging, translateX, goToPrev, goToNext]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      handleDragEnd();
    }
  }, [isDragging, handleDragEnd]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Preload adjacent images for smoother switching
  useEffect(() => {
    if (!images.length) return;
    const preloadIndices = [currentIndex - 1, currentIndex + 1]
      .filter(i => i >= 0 && i < images.length);
    const preloadImages = preloadIndices.map(i => {
      const img = new Image();
      img.src = images[i].url;
      return img;
    });
    return () => {
      preloadImages.forEach(img => { img.src = ''; });
    };
  }, [currentIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    if (!fullscreenOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'Escape') {
        setFullscreenOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenOpen, goToPrev, goToNext]);

  if (!images.length) {
    return (
      <EmptyState
        icon={ImageOff}
        message={t('objectDetail.noImages')}
        className={cn('h-48 rounded-lg bg-muted/30', className)}
      />
    );
  }

  const imageState = imageStates[currentIndex];
  const isLoading = !imageState?.loaded;
  const hasError = imageState?.error;
  const availabilityLabel =
    currentImage.availability === 'unsupported'
      ? t('objectDetail.unsupportedSourceState')
      : currentImage.availability === 'degraded'
        ? t('objectDetail.degradedSourceState')
        : currentImage.availability === 'unavailable'
          ? t('objectDetail.remoteUnavailable')
          : null;

  return (
    <>
      <div className={cn('space-y-2', className)}>
        {/* Main Image Container */}
        <Card data-testid="object-image-gallery-frame" className="relative group gap-0 overflow-hidden border-border/70 bg-black/50 py-0 shadow-none">
          <CardContent className="p-0">
            <div
              ref={containerRef}
              className="relative h-48 cursor-grab select-none overflow-hidden rounded-lg active:cursor-grabbing touch-pan-x shell-desktop:h-64 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={0}
              role="group"
              aria-roledescription="carousel"
              aria-label={t('objectDetail.imageGalleryLabel', { name: objectName })}
              onKeyDown={(e) => {
                if (images.length <= 1) return;
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  goToPrev();
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  goToNext();
                }
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Image */}
              <div 
                className="absolute inset-0 flex items-center justify-center transition-transform duration-100"
                style={{ 
                  transform: isDragging ? `translateX(${translateX}px)` : 'translateX(0)',
                }}
              >
                {isLoading && !hasError && (
                  <Skeleton className="absolute inset-0 rounded-lg" />
                )}

                {hasError ? (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageOff className="mb-2 h-12 w-12 opacity-50" />
                    <p className="text-xs">{t('objectDetail.imageLoadError')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleRetry(currentIndex); }}
                    >
                      <RotateCw className="mr-1 h-3 w-3" />
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={srcFor(currentIndex, currentImage.url)}
                    alt={currentImage.title || objectName}
                    className={cn(
                      'max-h-full max-w-full object-contain transition-opacity duration-300',
                      isLoading ? 'opacity-0' : 'opacity-100'
                    )}
                    onLoad={() => handleImageLoad(currentIndex)}
                    onError={() => handleImageError(currentIndex)}
                    draggable={false}
                  />
                )}
              </div>

              {/* Navigation Arrows - Always visible on mobile, hover on desktop */}
              {images.length > 1 && (
                <NavigationArrows onPrev={goToPrev} onNext={goToNext} variant="default" />
              )}

              {/* Fullscreen Button - Always visible on mobile */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-9 w-9 bg-black/50 text-white transition-opacity hover:bg-black/70 touch-target shell-desktop:h-7 shell-desktop:w-7 shell-desktop:opacity-0 shell-desktop:group-hover:opacity-100"
                    onClick={() => setFullscreenOpen(true)}
                  >
                    <Maximize2 className="h-5 w-5 shell-desktop:h-4 shell-desktop:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('objectDetail.fullscreen')}</TooltipContent>
              </Tooltip>

              {/* Dots Indicator - Larger on mobile */}
              <DotsPagination count={images.length} currentIndex={currentIndex} onSelect={setCurrentIndex} variant="default" className="bottom-2" />
            </div>
          </CardContent>
        </Card>

        {/* Image Info */}
        <Card data-testid="object-image-gallery-meta" className="gap-0 border-border/70 bg-muted/20 py-0 shadow-none">
          <CardContent className="space-y-1 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="mr-2 flex-1 truncate text-muted-foreground">
                {currentImage.source}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
            {currentImage.title && (
              <p className="truncate text-xs font-medium text-foreground" data-testid="object-image-title">
                {currentImage.title}
              </p>
            )}
            {currentImage.width && currentImage.height && (
              <p className="text-[10px] text-muted-foreground/70" data-testid="object-image-dimensions">
                {currentImage.width} × {currentImage.height} px
              </p>
            )}
            {currentImage.credit && (
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                {currentImage.credit}
              </p>
            )}
            {availabilityLabel && (
              <p className="mt-0.5 truncate text-[10px] text-amber-400/90" data-testid="object-image-availability">
                {availabilityLabel}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] max-h-[95dvh] p-0 bg-black border-0">
          <DialogTitle className="sr-only">{currentImage?.title || objectName}</DialogTitle>
          <div className="relative w-full h-[90vh] h-[90dvh] flex items-center justify-center">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-[calc(0.5rem+var(--safe-area-top))] right-[calc(0.5rem+var(--safe-area-right))] z-10 h-10 w-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {/* Navigation Arrows */}
            {images.length > 1 && (
              <NavigationArrows onPrev={goToPrev} onNext={goToNext} variant="fullscreen" />
            )}

            {/* Image */}
            {hasError ? (
              <div className="flex flex-col items-center text-white/70">
                <ImageOff className="h-16 w-16 mb-4" />
                <p>{t('objectDetail.imageLoadError')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 border-white/30 bg-white/10 text-white hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); handleRetry(currentIndex); }}
                >
                  <RotateCw className="mr-1 h-4 w-4" />
                  {t('common.retry')}
                </Button>
              </div>
            ) : (
              <>
                {/* Show loading spinner until image loads in fullscreen */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-white/70 animate-spin" />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={srcFor(currentIndex, currentImage.url)}
                  alt={currentImage.title || objectName}
                  className={cn(
                    "max-w-full max-h-full object-contain transition-opacity",
                    isLoading ? "opacity-0" : "opacity-100"
                  )}
                  onLoad={() => handleImageLoad(currentIndex)}
                  onError={() => handleImageError(currentIndex)}
                />
              </>
            )}

            {/* Info Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 pb-[calc(1rem+var(--safe-area-bottom))]">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="font-medium">{currentImage.title || objectName}</p>
                  <p className="text-sm text-white/70">{currentImage.credit}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/70">
                    {currentIndex + 1} / {images.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-white/10 text-white" asChild>
                    <a
                      href={currentImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Dots Indicator */}
            <DotsPagination count={images.length} currentIndex={currentIndex} onSelect={setCurrentIndex} variant="fullscreen" className="bottom-[calc(5rem+var(--safe-area-bottom))]" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});


