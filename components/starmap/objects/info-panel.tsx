'use client';

import { useState, useEffect, useRef, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  X, ChevronDown, ChevronUp, Crosshair, Plus,
  Compass, TrendingUp, ArrowUp, Info, Sun, Ruler, ShieldAlert, Clock3,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';
import { useCelestialName, useCelestialNames, useAdaptivePosition, useAstroEnvironment, useTargetAstroData, useObjectActions, useHorizonsEphemeris } from '@/lib/hooks';
import { findHorizonsBody } from '@/lib/services/horizons/service';
import { getCachedObjectInfo, type ObjectDetailedInfo } from '@/lib/services/object-info-service';
import { cn } from '@/lib/utils';
import { getObjectTypeIcon, getObjectTypeColor } from '@/lib/astronomy/object-type-utils';
import {
  buildTargetDisplayModel,
  getAltitudeStateTextClass,
  getCalculationSourceLabelKey,
  getCalculationStateLabelKey,
  getMoonInterferenceTextClass,
  getSelectionFallbackLabelKey,
  getSelectionSourceLabelKey,
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
  const [advancedExpanded, setAdvancedExpanded] = useState(true);
  const [cachedObjectInfo, setCachedObjectInfo] = useState<ObjectDetailedInfo | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const profileInfo = useMountStore((state) => state.profileInfo);
  const siteContext = useMapInteractionStore((state) => state.siteContext);
  const targetContext = useMapInteractionStore((state) => state.targetContext);
  
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
    [selectedObject, objectExpanded, chartExpanded, advancedExpanded],
  );

  // Update time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedObject) {
      return;
    }

    let cancelled = false;

    void getCachedObjectInfo(
      selectedObject.names,
      selectedObject.raDeg,
      selectedObject.decDeg,
      selectedObject.ra,
      selectedObject.dec,
      {
        type: selectedObject.type,
        magnitude: selectedObject.magnitude,
        size: selectedObject.size,
        constellation: selectedObject.constellation,
      }
    ).then((info) => {
      if (!cancelled) {
        setCachedObjectInfo(info);
      }
    }).catch(() => {
      void cancelled;
    });

    return () => {
      cancelled = true;
    };
  }, [selectedObject]);
  const objectInfo = selectedObject && cachedObjectInfo?.names.some((name) => selectedObject.names.includes(name))
    ? cachedObjectInfo
    : null;

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

  // High-precision JPL Horizons position for major solar-system bodies (network-backed).
  // findHorizonsBody returns a primitive (stable across renders), so no memo is needed.
  const horizonsBody = selectedObject ? findHorizonsBody(selectedObject.names) : null;
  const horizons = useHorizonsEphemeris(horizonsBody, Boolean(horizonsBody) && objectExpanded);
  const displayModel = buildTargetDisplayModel({
    selectedObject,
    targetData,
    objectInfo,
    translatedPrimaryName: primaryName,
    translatedSecondaryNames: secondaryNames,
  });
  const identitySection = displayModel?.sections.identity;
  const liveStatusSection = displayModel?.sections.liveStatus;
  const planningSection = displayModel?.sections.planningMetrics;
  const selectionMetadataSection = displayModel?.sections.selectionMetadata;
  const advancedMetadataSection = displayModel?.sections.advancedMetadata;
  const descriptionProvenance = objectInfo?.provenance.description;
  const unsupportedDiagnostics = objectInfo?.diagnostics.filter((diagnostic) => diagnostic.status === 'unsupported') ?? [];

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
          hasCustomPosition ? 'fixed z-50 w-[min(20rem,calc(100vw-1rem))]' : 'w-full',
          className
        )}
        style={hasCustomPosition ? {
          left: position.left,
          top: position.top,
          maxHeight: 'min(calc(100vh - 80px), calc(100dvh - 80px))',
        } : undefined}
      >
        {/* InfoPanel renders on the desktop shell only (see stellarium-view:
            `!isMobileShell` guard); the mobile shell uses ObjectDetailDrawer.
            Because the panel never mounts below 900px, sm:(640px) variants were
            always-on dead code — sizes/labels are written at their resolved
            desktop value instead (ui-audit #34). */}
        <ScrollArea className="max-h-[calc(100vh-100px)] max-h-[calc(100dvh-100px)]">
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
                        className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 touch-target"
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
                  <Card data-testid="info-panel-section-identity" className="gap-2 border-border/70 bg-muted/20 py-3 shadow-none">
                    <CardContent className="space-y-2 px-3">
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

                    {/* JPL Horizons high-precision position (major solar-system bodies) */}
                    {horizons.row && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {t('coordinates.jplHorizons')}
                        </Badge>
                        <span className="font-mono text-muted-foreground">
                          {horizons.row.raDeg.toFixed(4)}°, {horizons.row.decDeg.toFixed(4)}°
                        </span>
                      </div>
                    )}

                    {selectionMetadataSection && (
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        <Badge variant="outline" className="text-[10px]">
                          {t(getSelectionSourceLabelKey(selectionMetadataSection.selectionSource))}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {t(getSelectionFallbackLabelKey(selectionMetadataSection.selectionFallback))}
                        </Badge>
                      </div>
                    )}

                    {descriptionProvenance && (
                      <div className="rounded-md border border-border/70 bg-muted/30 p-2 text-[11px] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{t('objectDetail.acceptedSource')}</span>
                          <span className="text-foreground">{descriptionProvenance.acceptedSource}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{t(`objectDetail.sourceAuthority.${descriptionProvenance.authorityLevel}`)}</span>
                          {descriptionProvenance.contributors.length > 1 && (
                            <span className="font-mono text-foreground">
                              {descriptionProvenance.contributors.join(', ')}
                            </span>
                          )}
                        </div>
                        {unsupportedDiagnostics.length > 0 && (
                          <div className="text-amber-300">{t('objectDetail.unsupportedSourceState')}</div>
                        )}
                      </div>
                    )}
                    </CardContent>
                  </Card>

                  {targetData && liveStatusSection && planningSection && (
                    <>
                      {(siteContext?.displayName || targetContext?.siteName) && (
                        <div
                          data-testid="info-panel-continuity-context"
                          className="rounded-md border border-border/70 bg-muted/30 p-2 text-[11px]"
                        >
                          <span className="text-muted-foreground">{t('starmap.context.activeSite') || 'Active site'}: </span>
                          <span className="text-foreground">{targetContext?.siteName ?? siteContext?.displayName}</span>
                        </div>
                      )}
                      <Card data-testid="info-panel-section-live-status" className="gap-2 border-border/70 bg-muted/20 py-3 shadow-none">
                        <CardHeader className="px-3 py-0">
                          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            <ArrowUp className="h-4 w-4 text-muted-foreground" />
                            {t('objectDetail.observation')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 px-3">
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
                              {t(getCalculationStateLabelKey(liveStatusSection.calculationState))}
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
                        </CardContent>
                      </Card>

                      <Card data-testid="info-panel-section-planning-metrics" className="gap-2 border-border/70 bg-muted/20 py-3 shadow-none">
                        <CardHeader className="px-3 py-0">
                          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            {t('objectDetail.tonightSummary')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 px-3">
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
                        </CardContent>
                      </Card>

                      {/* Coordinate metadata */}
                      {(advancedMetadataSection || selectionMetadataSection) && (
                        <Card
                          data-testid="info-panel-section-advanced-metadata"
                          className="gap-2 border-border/70 bg-muted/20 py-3 text-[11px] shadow-none"
                        >
                          <Collapsible open={advancedExpanded} onOpenChange={setAdvancedExpanded}>
                          <CardHeader className="px-3 py-0">
                            <CollapsibleTrigger className="flex w-full items-center justify-between gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                              <span className="flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                <span>{t('objectDetail.systemMetadata')}</span>
                              </span>
                              {advancedExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                            </CollapsibleTrigger>
                          </CardHeader>
                          <CollapsibleContent>
                          <CardContent className="space-y-1 px-3">
                            <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.frameTimeScale')}</span>
                            <span className="font-mono text-foreground">
                              {advancedMetadataSection ? `${advancedMetadataSection.frame} / ${advancedMetadataSection.timeScale}` : '--'}
                            </span>
                            </div>
                            <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.qualityEop')}</span>
                            <span className="font-mono text-foreground">
                              {advancedMetadataSection ? `${advancedMetadataSection.qualityFlag} / ${advancedMetadataSection.dataFreshness}` : '--'}
                            </span>
                            </div>
                            <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.calculationSummary')}</span>
                            <span className="font-mono text-foreground">
                              {advancedMetadataSection
                                ? `${t(getCalculationSourceLabelKey(advancedMetadataSection.calculationSource))} / ${t(getCalculationStateLabelKey(advancedMetadataSection.calculationState))}`
                                : '--'}
                            </span>
                            </div>
                            {selectionMetadataSection && (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t('objectDetail.selectionSourceLabel')}</span>
                                <span className="font-mono text-foreground">{t(getSelectionSourceLabelKey(selectionMetadataSection.selectionSource))}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t('objectDetail.selectionFallbackLabel')}</span>
                                <span className="font-mono text-foreground">{t(getSelectionFallbackLabelKey(selectionMetadataSection.selectionFallback))}</span>
                              </div>
                            </>
                            )}
                            {selectionMetadataSection?.sourceCatalog && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">{t('objectDetail.sourceCatalog')}</span>
                              <span className="font-mono text-foreground">{selectionMetadataSection.sourceCatalog}</span>
                            </div>
                            )}
                            <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1"><Clock3 className="h-3 w-3" /> {t('objectDetail.timestamp')}</span>
                            <span className="font-mono text-foreground">
                              {advancedMetadataSection?.calculationTimestamp
                                ?? advancedMetadataSection?.updatedAt
                                ?? selectionMetadataSection?.selectionTimestamp
                                ?? '--'}
                            </span>
                            </div>
                          </CardContent>
                          </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      )}
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {mountConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs border-primary text-primary hover:bg-primary/20 touch-target"
                        onClick={handleSlew}
                      >
                        <Crosshair className="h-3 w-3 mr-1" />
                        {t('actions.slewToObject')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs touch-target"
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
                      className="w-full h-7 text-xs mt-2 touch-target"
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
