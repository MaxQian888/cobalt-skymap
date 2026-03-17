'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  X, ChevronDown, ChevronUp, Crosshair, Plus,
  Compass, TrendingUp, ArrowUp, Info, Sun, Ruler, ShieldAlert, Clock3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';

import { AltitudeChartCompact } from './altitude-chart-compact';
import { RiseTransitSetGrid } from './rise-transit-set-grid';
import { FeasibilityBadge } from '../planning/feasibility-badge';
import { SlewConfirmDialog } from '../mount/slew-confirm-dialog';
import { useMountStore } from '@/lib/stores';
import { useCelestialName, useCelestialNames, useAdaptivePosition, useAstroEnvironment, useTargetAstroData, useObjectActions } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { getObjectTypeIcon, getObjectTypeColor } from '@/lib/astronomy/object-type-utils';
import {
  buildTargetDisplayModel,
  getAltitudeStateTextClass,
  getMoonInterferenceTextClass,
} from '@/lib/astronomy/target-display-model';
import type { InfoPanelProps } from '@/types/starmap/objects';

export const InfoPanel = memo(function InfoPanel({
  selectedObject,
  onClose,
  onSetFramingCoordinates,
  onViewDetails,
  className,
  clickPosition,
  containerBounds,
}: InfoPanelProps) {
  const t = useTranslations();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [objectExpanded, setObjectExpanded] = useState(true);
  const [chartExpanded, setChartExpanded] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const profileInfo = useMountStore((state) => state.profileInfo);
  
  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;

  // Shared object actions
  const {
    handleSlew,
    handleAddToList,
    mountConnected,
    slewDialogOpen,
    slewDialogTarget,
    setSlewDialogOpen,
    handleTargetActionStarted,
  } = useObjectActions({
    selectedObject,
    onSetFramingCoordinates,
  });

  // Translate celestial object names
  const primaryName = useCelestialName(selectedObject?.names[0]);
  const secondaryNames = useCelestialNames(selectedObject?.names.slice(1, 3));

  // Calculate adaptive position using shared hook
  const position = useAdaptivePosition(
    panelRef,
    clickPosition,
    containerBounds,
    [selectedObject, objectExpanded, chartExpanded],
  );

  // Update time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Escape key to close panel
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Native event listeners to prevent Stellarium WASM engine from receiving
  // mouse events that originate in the info panel. The engine sets
  // document.onmouseup inside a canvas mousedown handler, which persists and
  // fires on ALL subsequent mouseup events — including clicks on InfoPanel
  // buttons. This causes the WASM core to process a "sky click" that
  // deselects the object, unmounting the panel before the button action fires.
  // React's synthetic stopPropagation (above) fires via delegation at the root
  // and cannot prevent native handlers on ancestor elements from executing.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('mousedown', stop);
    el.addEventListener('mouseup', stop);
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);

    return () => {
      el.removeEventListener('mousedown', stop);
      el.removeEventListener('mouseup', stop);
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('pointerup', stop);
    };
  }, []);

  // Calculate astronomical data using shared hooks
  const astroData = useAstroEnvironment(latitude, longitude, currentTime);
  const targetData = useTargetAstroData(selectedObject, latitude, longitude, astroData.moonRa, astroData.moonDec, currentTime);
  const displayModel = buildTargetDisplayModel({
    selectedObject,
    targetData,
    translatedPrimaryName: primaryName,
    translatedSecondaryNames: secondaryNames,
  });
  const identitySection = displayModel?.sections.identity;
  const liveStatusSection = displayModel?.sections.liveStatus;
  const planningSection = displayModel?.sections.planningMetrics;
  const advancedMetadataSection = displayModel?.sections.advancedMetadata;

  const getRiskHintLabel = (risk: string) => {
    const riskHintKeyMap: Record<string, string> = {
      'never-rises': 'objectDetail.riskHintsMap.never-rises',
      'moon-interference': 'objectDetail.riskHintsMap.moon-interference',
      'low-feasibility': 'objectDetail.riskHintsMap.low-feasibility',
    };
    const key = riskHintKeyMap[risk];
    return key ? t(key) : risk;
  };


  const hasCustomPosition = clickPosition && containerBounds;

  return (
    <TooltipProvider>
      <Card 
        ref={panelRef}
        data-starmap-ui-control="true"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className={cn(
          'bg-card/95 backdrop-blur-md border-border/60 shadow-2xl',
          'transition-all duration-300 ease-out',
          'animate-in fade-in zoom-in-95 slide-in-from-bottom-2',
          hasCustomPosition ? 'fixed z-50 w-[280px] sm:w-[300px]' : 'w-full',
          className
        )}
        style={hasCustomPosition ? {
          left: position.left,
          top: position.top,
          maxHeight: 'min(calc(100vh - 80px), calc(100dvh - 80px))',
        } : undefined}
      >
        <ScrollArea className="max-h-[calc(100vh-140px)] max-h-[calc(100dvh-140px)] sm:max-h-[calc(100vh-100px)] sm:max-h-[calc(100dvh-100px)]">
          <div className="p-3 space-y-2">
            {/* Selected Object Section */}
            {selectedObject && (
              <Collapsible open={objectExpanded} onOpenChange={setObjectExpanded}>
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors flex-1 min-w-0">
                    {(() => {
                      const TypeIcon = getObjectTypeIcon(identitySection?.type ?? selectedObject.type);
                      const typeColor = getObjectTypeColor(identitySection?.type ?? selectedObject.type);
                      return <TypeIcon className={cn('h-4 w-4 shrink-0', typeColor)} />;
                    })()}
                    <span className="text-sm font-medium truncate">{identitySection?.primaryName ?? selectedObject.names[0]}</span>
                    {objectExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </CollapsibleTrigger>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 sm:h-6 sm:w-6 text-muted-foreground hover:text-foreground shrink-0 touch-target"
                        onClick={onClose}
                        aria-label={t('common.close')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('common.close')}</TooltipContent>
                  </Tooltip>
                </div>
                
                <CollapsibleContent className="mt-2 space-y-2">
                  <div data-testid="info-panel-section-identity" className="space-y-2">
                    {/* Names and Type Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {identitySection?.type && (
                        <Badge variant="outline" className={cn('text-[10px]', getObjectTypeColor(identitySection.type))}>
                          {identitySection.type}
                        </Badge>
                      )}
                      {(identitySection?.aliases.length ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground truncate">
                          {identitySection?.aliases.join(' · ')}
                        </span>
                      )}
                    </div>

                    {/* Magnitude and Size */}
                    {(identitySection?.magnitude || identitySection?.size) && (
                      <div className="flex items-center gap-3 text-xs">
                        {identitySection?.magnitude && (
                          <div className="flex items-center gap-1">
                            <Sun className="h-3 w-3 text-yellow-400" />
                            <span className="text-muted-foreground">{t('objectDetail.mag')}:</span>
                            <span className="font-mono text-foreground">{identitySection.magnitude}</span>
                          </div>
                        )}
                        {identitySection?.size && (
                          <div className="flex items-center gap-1">
                            <Ruler className="h-3 w-3 text-muted-foreground" />
                            <span className="font-mono text-foreground">{identitySection.size}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Constellation */}
                    {identitySection?.constellation && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">{t('coordinates.constellation')}: </span>
                        <span className="text-foreground">{identitySection.constellation}</span>
                      </div>
                    )}

                    {/* Coordinates */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('coordinates.ra')}: </span>
                        <span className="font-mono text-foreground">{identitySection?.coordinates.ra ?? selectedObject.ra}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('coordinates.dec')}: </span>
                        <span className="font-mono text-foreground">{identitySection?.coordinates.dec ?? selectedObject.dec}</span>
                      </div>
                    </div>
                  </div>

                  {targetData && liveStatusSection && planningSection && (
                    <>
                      <div data-testid="info-panel-section-live-status" className="space-y-2">
                        {/* Current Position */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <ArrowUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{t('coordinates.alt')}:</span>
                            <span className={cn(getAltitudeStateTextClass(liveStatusSection.altitudeState))}>
                              {liveStatusSection.altitude}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Compass className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{t('coordinates.az')}:</span>
                            <span className="text-foreground">{liveStatusSection.azimuth}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {t(`objectDetail.altitudeState.${liveStatusSection.altitudeState}`)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', getMoonInterferenceTextClass(liveStatusSection.moonInterferenceLevel))}
                          >
                            {t(`objectDetail.moonInterference.${liveStatusSection.moonInterferenceLevel}`)}
                          </Badge>
                          {liveStatusSection.calculationState === 'degraded' && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                              degraded
                            </Badge>
                          )}
                        </div>

                        {(liveStatusSection.riskHints.length ?? 0) > 0 && (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-[11px]">
                            <div className="flex items-center gap-1 text-amber-300 mb-1">
                              <ShieldAlert className="h-3 w-3" />
                              <span>{t('objectDetail.riskHints')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(liveStatusSection.riskHints ?? []).map((risk) => (
                                <Badge key={risk} variant="outline" className="text-[10px] border-amber-500/40 text-amber-200">
                                  {getRiskHintLabel(risk)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div data-testid="info-panel-section-planning-metrics" className="space-y-2">
                        {/* Rise/Transit/Set */}
                        <RiseTransitSetGrid visibility={planningSection.visibility} variant="compact" />

                        {/* Moon distance & Max alt */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('session.moonDistance')}</span>
                            <span className={getMoonInterferenceTextClass(liveStatusSection.moonInterferenceLevel)}>
                              {planningSection.moonDistance}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('session.maxAltitude')}</span>
                            <span className="text-foreground">{planningSection.maxAltitude}</span>
                          </div>
                        </div>

                        {/* Feasibility Score */}
                        <FeasibilityBadge feasibility={planningSection.feasibility} variant="inline" tooltipSide="right" />
                      </div>

                      {/* Coordinate metadata */}
                      {advancedMetadataSection && (
                        <div
                          data-testid="info-panel-section-advanced-metadata"
                          className="hidden sm:block rounded-md border border-border/70 bg-muted/30 p-2 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.frameTimeScale')}</span>
                            <span className="font-mono text-foreground">{advancedMetadataSection.frame} / {advancedMetadataSection.timeScale}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.qualityEop')}</span>
                            <span className="font-mono text-foreground">{advancedMetadataSection.qualityFlag} / {advancedMetadataSection.dataFreshness}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Calc</span>
                            <span className="font-mono text-foreground">{advancedMetadataSection.calculationSource} / {advancedMetadataSection.calculationState}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Clock3 className="h-3 w-3" /> {t('objectDetail.timestamp')}</span>
                            <span className="font-mono text-foreground">{advancedMetadataSection.calculationTimestamp ?? advancedMetadataSection.updatedAt}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-1.5 sm:gap-2">
                    {mountConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 sm:h-7 text-xs border-primary text-primary hover:bg-primary/20 touch-target"
                        onClick={handleSlew}
                      >
                        <Crosshair className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">{t('actions.slewToObject')}</span>
                        <span className="sm:hidden">{t('actions.slew')}</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 sm:h-7 text-xs touch-target"
                      onClick={handleAddToList}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t('common.add')}
                    </Button>
                  </div>

                  {/* View Details Button */}
                  {onViewDetails && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-8 sm:h-7 text-xs mt-2 touch-target"
                      onClick={onViewDetails}
                    >
                      <Info className="h-3 w-3 mr-1" />
                      {t('objectDetail.viewDetails')}
                    </Button>
                  )}
                </CollapsibleContent>
                
                <Separator className="mt-2 bg-border" />
              </Collapsible>
            )}


            {/* Altitude Chart Section */}
            {selectedObject && (
              <Collapsible open={chartExpanded} onOpenChange={setChartExpanded}>
                <CollapsibleTrigger className="flex items-center justify-between w-full hover:text-primary transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t('info.altitude')}</span>
                  </div>
                  {chartExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-2">
                  <div className="-mx-1">
                    <AltitudeChartCompact
                      ra={selectedObject.raDeg}
                      dec={selectedObject.decDeg}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </Card>
      {slewDialogTarget && (
        <SlewConfirmDialog
          open={slewDialogOpen}
          onOpenChange={setSlewDialogOpen}
          targetName={slewDialogTarget.name}
          targetRa={slewDialogTarget.ra}
          targetDec={slewDialogTarget.dec}
          onSlewStarted={handleTargetActionStarted}
        />
      )}
    </TooltipProvider>
  );
});
