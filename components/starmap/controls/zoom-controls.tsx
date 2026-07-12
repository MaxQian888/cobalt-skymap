'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MIN_FOV, MAX_FOV } from '@/lib/core/constants/fov';
import { fovToSlider as fovToSliderUtil, sliderToFov as sliderToFovUtil, formatFov } from '@/lib/astronomy/fov-utils';
import type { ZoomControlsProps } from '@/types/starmap/controls';

export const ZoomControls = memo(function ZoomControls({ fov, onZoomIn, onZoomOut, onFovChange }: ZoomControlsProps) {
  const t = useTranslations();
  // Convert FOV to slider value (logarithmic scale, extracted to lib/astronomy/fov-utils)
  const sliderValue = fovToSliderUtil(fov, MIN_FOV, MAX_FOV);

  return (
      <div className="flex flex-col items-center gap-1 sm:gap-1.5 bg-background/80 backdrop-blur-sm rounded-lg p-1 sm:p-1.5 border border-border" role="group" aria-label={t('zoom.zoomControls')}>
        <ButtonGroup orientation="vertical" role="presentation" className="w-8 [&>*]:w-8 shell-mobile:w-11 shell-mobile:[&>*]:w-11">
          {/* Zoom In Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 touch-target toolbar-btn"
                onClick={onZoomIn}
                disabled={fov <= MIN_FOV}
                aria-label={t('zoom.zoomIn')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{t('zoom.zoomIn')}</p>
            </TooltipContent>
          </Tooltip>

          {/* Vertical Slider */}
          <div className="h-20 sm:h-28 shell-mobile:h-32 flex items-center justify-center border-x bg-background/40">
            <Slider
              orientation="vertical"
              value={[100 - sliderValue]}
              onValueChange={([v]) => onFovChange(sliderToFovUtil(100 - v, MIN_FOV, MAX_FOV))}
              max={100}
              step={1}
              // Track stays w-1.5; widening the root only enlarges the touch hit area.
              className="h-full data-[orientation=vertical]:w-3 shell-mobile:data-[orientation=vertical]:w-10"
              aria-label={t('zoom.fovSlider')}
              aria-valuemin={MIN_FOV}
              aria-valuemax={MAX_FOV}
              aria-valuenow={Math.round(fov * 10) / 10}
            />
          </div>

          {/* Zoom Out Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 touch-target toolbar-btn"
                onClick={onZoomOut}
                disabled={fov >= MAX_FOV}
                aria-label={t('zoom.zoomOut')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{t('zoom.zoomOut')}</p>
            </TooltipContent>
          </Tooltip>
        </ButtonGroup>

        {/* FOV Display */}
        <div className="text-[10px] sm:text-xs text-muted-foreground text-center font-mono" aria-live="polite" aria-atomic="true">
          {formatFov(fov)}°
        </div>
      </div>
  );
});
ZoomControls.displayName = 'ZoomControls';
