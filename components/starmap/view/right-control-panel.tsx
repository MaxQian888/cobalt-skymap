'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

import { ZoomControls } from '../controls/zoom-controls';
import { FOVSimulator } from '../overlays/fov-simulator';
import { ExposureCalculator } from '../planning/exposure-calculator';
import { ShotList } from '../planning/shot-list';
import { ObservationLog } from '../planning/observation-log';
import { MarkerManager } from '../management/marker-manager';
import { LocationManager } from '../management/location-manager';
import { StellariumMount } from '../mount/stellarium-mount';
import { AstroSessionPanel } from '../planning/astro-session-panel';

import { buildSelectionData } from '@/lib/core/selection-utils';
import { useEquipmentFOVProps } from '@/lib/hooks/use-equipment-fov-props';
import { useEquipmentStore, useOnboardingBridgeStore } from '@/lib/stores';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { RightControlPanelProps } from '@/types/starmap/view';

export const RightControlPanel = memo(function RightControlPanel({
  stel,
  currentFov,
  selectedObject,
  showSessionPanel,
  contextMenuCoords,
  onZoomIn,
  onZoomOut,
  onFovSliderChange,
  onGoToCoordinates,
  onLocationChange,
}: RightControlPanelProps) {
  const t = useTranslations();
  const { currentSelection, observationSelection } = useMemo(
    () => buildSelectionData(selectedObject),
    [selectedObject],
  );

  // Equipment FOV props — shared hook avoids duplicating 12+ selectors
  const {
    fovSimEnabled, setFovSimEnabled,
    sensorWidth, setSensorWidth,
    sensorHeight, setSensorHeight,
    focalLength, setFocalLength,
    pixelSize, rotationAngle,
    mosaic, setMosaic,
    gridType, setGridType, setRotationAngle, setPixelSize,
  } = useEquipmentFOVProps();

  const aperture = useEquipmentStore((s) => s.aperture);

  // Persisted collapsed state — survives page refresh
  const collapsed = useSettingsStore((s) => s.preferences.rightPanelCollapsed);
  const setPreference = useSettingsStore((s) => s.setPreference);
  const skyEngine = useSettingsStore((s) => s.skyEngine);
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);
  const toggleCollapsed = useCallback(() => {
    setTransitionsEnabled(true);
    setPreference('rightPanelCollapsed', !collapsed);
  }, [collapsed, setPreference]);
  const expandRightPanelRequestId = useOnboardingBridgeStore((state) => state.expandRightPanelRequestId);
  const handledExpandRequestRef = useRef(0);

  useEffect(() => {
    if (
      expandRightPanelRequestId > 0 &&
      expandRightPanelRequestId !== handledExpandRequestRef.current
    ) {
      handledExpandRequestRef.current = expandRightPanelRequestId;
      if (collapsed) {
        setPreference('rightPanelCollapsed', false);
      }
    }
  }, [collapsed, expandRightPanelRequestId, setPreference]);

  return (
    <>
      {/* Right Side Controls - Desktop Only - Vertically Centered */}
      <div
        data-starmap-ui-control="true"
        className="flex items-center absolute right-[calc(var(--rail-gap)+var(--safe-area-right))] top-1/2 -translate-y-1/2 z-30 pointer-events-auto animate-fade-in"
      >
        {/* Collapse Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mr-1 bg-card/60 backdrop-blur-md border border-border/50 rounded-full shrink-0"
              onClick={toggleCollapsed}
              aria-label={collapsed ? t('sidePanel.expand') : t('sidePanel.collapse')}
            >
              {collapsed ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{collapsed ? t('sidePanel.expand') : t('sidePanel.collapse')}</p>
          </TooltipContent>
        </Tooltip>

        {/* Panel Content - slides right when collapsed */}
        <div
          data-testid="right-control-panel-content"
          data-state={collapsed ? 'collapsed' : 'expanded'}
          data-transition={transitionsEnabled ? 'enabled' : 'initial'}
          className={cn(
            'will-change-transform',
            transitionsEnabled
              ? 'transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0'
              : 'transition-none',
            collapsed && 'translate-x-[calc(100%+16px)] opacity-0 pointer-events-none'
          )}
          aria-hidden={collapsed}
          inert={collapsed || undefined}
        >
        <ScrollArea className="max-h-[calc(100dvh-160px)] overscroll-contain">
        <div className="flex flex-col items-center gap-1.5 py-1.5 w-[var(--rail-width)]">
          {/* Zoom Controls */}
          <div className="bg-card/80 backdrop-blur-md rounded-lg border border-border/50 w-full" data-tour-id="zoom">
            <div data-tour-id="zoom-controls">
              <ZoomControls
                fov={currentFov}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onFovChange={onFovSliderChange}
              />
            </div>
          </div>

          {/* Tool Buttons - Vertical */}
          <div className="flex flex-col items-center gap-0.5 bg-card/80 backdrop-blur-md rounded-lg border border-border/50 p-0.5 w-full">
            <div data-tour-id="markers">
              <MarkerManager initialCoords={contextMenuCoords} />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div data-tour-id="location">
                  <LocationManager
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground/80 hover:text-foreground hover:bg-accent h-8 w-8"
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    }
                    onLocationChange={onLocationChange}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{t('locations.title')}</p>
              </TooltipContent>
            </Tooltip>
            <div data-tour-id="fov">
              <div data-tour-id="fov-button">
                <FOVSimulator
                  enabled={fovSimEnabled}
                  onEnabledChange={setFovSimEnabled}
                  sensorWidth={sensorWidth}
                  sensorHeight={sensorHeight}
                  focalLength={focalLength}
                  pixelSize={pixelSize}
                  rotationAngle={rotationAngle}
                  selectedTarget={selectedObject ? {
                    name: selectedObject.names[0] || t('common.unknown'),
                    raDeg: selectedObject.raDeg,
                    decDeg: selectedObject.decDeg,
                    size: selectedObject.size,
                  } : null}
                  onSensorWidthChange={setSensorWidth}
                  onSensorHeightChange={setSensorHeight}
                  onFocalLengthChange={setFocalLength}
                  onPixelSizeChange={setPixelSize}
                  onRotationAngleChange={setRotationAngle}
                  onCenterTarget={onGoToCoordinates}
                  mosaic={mosaic}
                  onMosaicChange={setMosaic}
                  gridType={gridType}
                  onGridTypeChange={setGridType}
                />
              </div>
            </div>
            <div data-tour-id="exposure">
              <ExposureCalculator focalLength={focalLength} aperture={aperture} pixelSize={pixelSize} />
            </div>
            <div data-tour-id="shotlist">
              <div data-tour-id="shotlist-button">
                <ShotList currentSelection={currentSelection} />
              </div>
            </div>
            <div data-tour-id="observation-log">
              <ObservationLog currentSelection={observationSelection} />
            </div>
          </div>

          {/* Mount Controls */}
          {(stel || skyEngine === 'aladin') && (
            <div className="bg-card/80 backdrop-blur-md rounded-lg border border-border/50 w-full" data-tour-id="mount">
              <StellariumMount />
            </div>
          )}
        </div>
        </ScrollArea>
        </div>
      </div>

      {/* Floating Astro Session Panel - Show conditions for selected object */}
      {selectedObject && showSessionPanel && (
        <div className={cn(
          // Derived from the rail tokens so the panel tracks the rail AND
          // respects the right safe-area inset (previously hard-coded right-10 /
          // right-[72px] with no safe-area term, so it drifted off the rail on
          // devices with a right inset — ui-audit #21).
          "block absolute top-20 pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300",
          collapsed
            ? "right-[calc(var(--rail-gap)+1.75rem+var(--safe-area-right))]"
            : "right-[calc(var(--rail-gap)+var(--rail-width)+0.5rem+var(--safe-area-right))]"
        )}
          data-starmap-ui-control="true"
        >
          <ScrollArea className="max-h-[calc(100dvh-180px)]">
          <div className="bg-card/90 backdrop-blur-md rounded-lg border border-border/50 p-3 w-[300px] shadow-lg">
            <AstroSessionPanel
              selectedRa={selectedObject.raDeg}
              selectedDec={selectedObject.decDeg}
              selectedName={selectedObject.names[0]}
            />
          </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
});
RightControlPanel.displayName = 'RightControlPanel';
