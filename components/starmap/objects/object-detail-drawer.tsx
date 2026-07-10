'use client';

import { useState, useEffect, useCallback, useMemo, memo, createElement } from 'react';
import { useTranslations } from 'next-intl';
import {
  X,
  ExternalLink,
  Crosshair,
  Plus,
  Loader2,
  MapPin,
  Ruler,
  Sun,
  Moon,
  Clock,
  TrendingUp,
  Info,
  Database,
  Compass,
  ArrowUp,
  Copy,
  Check,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMobileShell } from '../view/use-mobile-shell';
import { formatRA, formatDec } from '@/lib/astronomy/coordinates/formats';

import { ObjectImageGallery } from './object-image-gallery';
import { RiseTransitSetGrid } from './rise-transit-set-grid';
import { SatelliteInfoNotice } from './satellite-info-notice';
import { FeasibilityBadge } from '../planning/feasibility-badge';
import { AltitudeChartCompact } from './altitude-chart-compact';
import { SlewConfirmDialog } from '../mount/slew-confirm-dialog';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { useMountStore } from '@/lib/stores';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';
import { useCelestialName, useAstroEnvironment, useTargetAstroData, useObjectActions, useHorizonsEphemeris } from '@/lib/hooks';
import { findHorizonsBody } from '@/lib/services/horizons/service';
import {
  getCachedObjectInfo,
  enhanceObjectInfo,
  updateCachedObjectInfo,
  type ObjectDetailedInfo,
} from '@/lib/services/object-info-service';
import { cn } from '@/lib/utils';
import { getObjectTypeIcon, getObjectTypeColor, getObjectTypeBadgeColor, getFeasibilityColor } from '@/lib/astronomy/object-type-utils';
import {
  buildTargetDisplayModel,
  getAltitudeStateTextClass,
  getCalculationSourceLabelKey,
  getCalculationStateLabelKey,
  getMoonInterferenceTextClass,
  getSelectionFallbackLabelKey,
  getSelectionSourceLabelKey,
} from '@/lib/astronomy/target-display-model';
import { createLogger } from '@/lib/logger';
import type { ObjectDetailDrawerProps } from '@/types/starmap/objects';
import { clipboardService } from '@/lib/services/clipboard-service';

const logger = createLogger('object-detail-drawer');

/**
 * Mobile bottom-sheet detents: open at a half-screen peek (header + key facts,
 * sky still visible and interactive above), drag up for the full sheet.
 * Module-level constant so vaul sees a stable array identity.
 */
const MOBILE_SNAP_POINTS: (number | string)[] = [0.45, 1];

/** Object type icon display component using shared utilities */
const ObjectTypeIconDisplay = memo(function ObjectTypeIconDisplay({ category }: { category?: string }) {
  const Icon = getObjectTypeIcon(category);
  const color = getObjectTypeColor(category);
  return createElement(Icon, { className: cn('h-5 w-5 shrink-0', color) });
});

export const ObjectDetailDrawer = memo(function ObjectDetailDrawer({
  open,
  onOpenChange,
  selectedObject,
  onSetFramingCoordinates,
}: ObjectDetailDrawerProps) {
  const t = useTranslations();
  const [objectInfo, setObjectInfo] = useState<ObjectDetailedInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [copied, setCopied] = useState(false);

  // Desktop docks the drawer to the right edge (keeps the sky map visible);
  // the mobile shell keeps the bottom sheet. Single source of truth = 900px
  // shell decision (useMobileShell), matching the rest of the starmap layout.
  const { isMobileShell } = useMobileShell();
  const drawerDirection = isMobileShell ? 'bottom' : 'right';

  // Mobile snap state — reopen always starts at the peek detent.
  const [activeSnap, setActiveSnap] = useState<number | string | null>(MOBILE_SNAP_POINTS[0]);
  useEffect(() => {
    if (open) setActiveSnap(MOBILE_SNAP_POINTS[0]);
  }, [open]);
  const isPeeking = isMobileShell && activeSnap !== 1;

  const profileInfo = useMountStore((state) => state.profileInfo);
  const siteContext = useMapInteractionStore((state) => state.siteContext);
  const targetContext = useMapInteractionStore((state) => state.targetContext);

  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;

  // Translate celestial object name
  const translatedName = useCelestialName(selectedObject?.names[0]);

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
    onAfterSlew: () => onOpenChange(false),
  });

  // Auto-close drawer when selectedObject becomes null
  useEffect(() => {
    if (open && !selectedObject) {
      onOpenChange(false);
    }
  }, [open, selectedObject, onOpenChange]);

  // Load object info when drawer opens
  useEffect(() => {
    if (!open || !selectedObject) {
      return;
    }

    const controller = new AbortController();

    async function loadInfo() {
      setIsLoading(true);
      setLoadError(false);
      try {
        const info = await getCachedObjectInfo(
          selectedObject!.names,
          selectedObject!.raDeg,
          selectedObject!.decDeg,
          selectedObject!.ra,
          selectedObject!.dec,
          {
            type: selectedObject!.type,
            magnitude: selectedObject!.magnitude,
            size: selectedObject!.size,
            constellation: selectedObject!.constellation,
          }
        );

        if (!controller.signal.aborted) {
          setObjectInfo(info);
          setIsLoading(false);

          // Try to enhance with external data
          setIsEnhancing(true);
          const enhanced = await enhanceObjectInfo(info, controller.signal);
          if (!controller.signal.aborted) {
            setObjectInfo(enhanced);
            updateCachedObjectInfo(enhanced);
            setIsEnhancing(false);
          }
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.error('Failed to load object info', error);
        setLoadError(true);
        setIsLoading(false);
        setIsEnhancing(false);
      }
    }

    loadInfo();

    return () => {
      controller.abort();
      // Reset state when effect cleans up (drawer closes or object changes)
      setObjectInfo(null);
      setIsLoading(false);
      setIsEnhancing(false);
      setLoadError(false);
    };
  }, [open, selectedObject, retryToken]);

  // Update time periodically
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [open]);

  // Calculate current astronomical data using shared hooks. currentTime lives in
  // state and is advanced only by the 30s interval, so an unrelated re-render no
  // longer mints a fresh Date and force-recomputes the astro hooks every render.
  const astroEnv = useAstroEnvironment(latitude, longitude, currentTime);
  const astroData = useTargetAstroData(
    selectedObject,
    latitude,
    longitude,
    astroEnv.moonRa,
    astroEnv.moonDec,
    currentTime,
    objectInfo?.typeCategory,
  );
  const isSatellite = astroData?.targetKind === 'satellite';

  // High-precision JPL Horizons reference position for major solar-system
  // bodies (parity with the compact InfoPanel).
  const horizonsBody = selectedObject ? findHorizonsBody(selectedObject.names) : null;
  const horizons = useHorizonsEphemeris(horizonsBody, open && Boolean(horizonsBody));

  const copyCoordinates = useCallback(async (text: string) => {
    try {
      await clipboardService.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      logger.warn('Failed to copy coordinates', error);
    }
  }, []);

  // Multiple copy formats derived from the precise degree values
  // (selectedObject.ra/dec are pre-formatted strings; raDeg/decDeg are exact).
  const coordinateFormats = useMemo(() => {
    if (!selectedObject) return null;
    const { raDeg, decDeg } = selectedObject;
    const hmsRa = formatRA(raDeg);
    const hmsDec = formatDec(decDeg);
    const degRa = `${raDeg.toFixed(5)}°`;
    const degDec = `${decDeg.toFixed(5)}°`;
    return {
      hms: { ra: hmsRa, dec: hmsDec, combined: `RA: ${hmsRa}\nDec: ${hmsDec}` },
      degrees: { ra: degRa, dec: degDec, combined: `RA: ${degRa}\nDec: ${degDec}` },
      // Bare space-separated decimal pair — convenient for plate-solving /
      // planetarium input fields.
      decimalPair: `${raDeg.toFixed(6)} ${decDeg.toFixed(6)}`,
    };
  }, [selectedObject]);



  const currentAstro = astroData;
  const displayModel = buildTargetDisplayModel({
    selectedObject,
    targetData: currentAstro,
    objectInfo,
    translatedPrimaryName: translatedName,
    translatedSecondaryNames: selectedObject?.names.slice(1, 4) ?? [],
  });
  const identitySection = displayModel?.sections.identity;
  const liveStatusSection = displayModel?.sections.liveStatus;
  const planningSection = displayModel?.sections.planningMetrics;
  const selectionMetadataSection = displayModel?.sections.selectionMetadata;
  const advancedMetadataSection = displayModel?.sections.advancedMetadata;
  const displayName = identitySection?.primaryName || translatedName || selectedObject?.names[0] || t('common.unknown');
  const descriptionProvenance = objectInfo?.provenance.description;
  const imageDiagnostics = objectInfo?.diagnostics.filter((diagnostic) => diagnostic.fieldGroup === 'images') ?? [];
  const unsupportedDiagnostics = objectInfo?.diagnostics.filter((diagnostic) => diagnostic.status === 'unsupported') ?? [];
  const degradedDiagnostics = objectInfo?.diagnostics.filter((diagnostic) => diagnostic.status === 'error' || diagnostic.status === 'empty') ?? [];

  return (
    <Drawer
      // Clean remount if the 900px shell boundary is crossed while open —
      // vaul cannot swap direction/snap configuration on a live drawer.
      key={drawerDirection}
      open={open}
      onOpenChange={onOpenChange}
      direction={drawerDirection}
      {...(isMobileShell
        ? {
            snapPoints: MOBILE_SNAP_POINTS,
            activeSnapPoint: activeSnap,
            setActiveSnapPoint: setActiveSnap,
            // Keep the sky interactive above the peek detent; vaul disables
            // the overlay automatically in non-modal mode.
            modal: false,
            // A hard fling from full lands on peek instead of dismissing.
            snapToSequentialPoint: true,
          }
        : {})}
    >
      <DrawerContent
        data-starmap-ui-control="true"
        // Re-expose the shell decision on the portaled drawer root so the
        // shell-desktop:/shell-mobile: variants inside resolve correctly (vaul
        // portals this outside the [data-shell] view root).
        data-shell={isMobileShell ? 'mobile' : 'desktop'}
        data-peeking={isPeeking ? 'true' : undefined}
        className={cn(
          'flex flex-col bg-background/95 backdrop-blur-md',
          drawerDirection === 'bottom'
            // With snap points vaul positions the sheet via transform, so the
            // content must be full-height; the visible fraction is the snap.
            ? 'h-full w-full min-h-0 max-h-[calc(100dvh-var(--safe-area-top)-0.5rem)]'
            // Right-docked side panel on desktop: full height, comfortable width.
            : 'h-full w-full sm:max-w-md',
        )}
      >
        {/* Drag handle — only the bottom sheet needs the pull affordance */}
        {drawerDirection === 'bottom' && (
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted" />
        )}

        <DrawerHeader className="mx-auto w-full max-w-2xl pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <DrawerTitle className="text-xl font-bold truncate flex items-center gap-2">
                <ObjectTypeIconDisplay category={objectInfo?.typeCategory} />
                {displayName}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                {t('objectDetail.drawerDescription', { name: displayName })}
              </DrawerDescription>
              {selectedObject && selectedObject.names.length > 1 && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {selectedObject.names.slice(1, 4).join(' · ')}
                </p>
              )}
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>

          {/* Type Badge and Quick Stats */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {identitySection?.type && (
              <Badge variant="outline" className={cn('text-xs', getObjectTypeBadgeColor(identitySection.type))}>
                {identitySection.type}
              </Badge>
            )}
            {identitySection?.magnitude && (
              <Badge variant="outline" className="text-xs">
                <Sun className="h-3 w-3 mr-1" />
                {t('objectDetail.mag')} {identitySection.magnitude}
              </Badge>
            )}
            {identitySection?.size && (
              <Badge variant="outline" className="text-xs">
                <Ruler className="h-3 w-3 mr-1" />
                {identitySection.size}
              </Badge>
            )}
            {planningSection && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  getFeasibilityColor(planningSection.feasibility.recommendation, 'full')
                )}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                {planningSection.feasibilityScore}/100
              </Badge>
            )}
            {isEnhancing && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
        </DrawerHeader>

        <ScrollArea
          className={cn(
            'min-h-0 flex-1 overscroll-contain px-4 pb-3',
            // vaul's scroll-inside-snap pattern: while peeking, inner scroll is
            // locked so a drag on the content moves the sheet between detents;
            // scrolling unlocks at the full detent.
            isPeeking && '[&_[data-slot=scroll-area-viewport]]:!overflow-hidden',
          )}
        >
          <div className="mx-auto w-full max-w-2xl">
          {/* Load failure banner — the astro sections below still work from
              the selection itself, so the drawer degrades instead of going
              silently blank. */}
          {loadError && (
            <Card
              data-testid="object-drawer-load-error"
              className="mb-3 border-destructive/40 bg-destructive/10 py-2 shadow-none"
            >
              <CardContent className="flex items-center justify-between gap-2 px-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  {t('objectDetail.loadError')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => setRetryToken((n) => n + 1)}
                >
                  <RotateCw className="mr-1 h-3 w-3" />
                  {t('common.retry')}
                </Button>
              </CardContent>
            </Card>
          )}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-lg" />
                <Skeleton className="h-16 rounded-lg" />
              </div>
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="overview" className="text-xs">
                  {t('objectDetail.overview')}
                </TabsTrigger>
                <TabsTrigger value="images" className="text-xs">
                  {t('objectDetail.images')}
                </TabsTrigger>
                <TabsTrigger value="observation" className="text-xs">
                  {t('objectDetail.observation')}
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-0">
                {(siteContext?.displayName || targetContext?.siteName) && (
                  <div
                    data-testid="object-drawer-continuity-context"
                    className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs"
                  >
                    <span className="text-muted-foreground">{t('starmap.context.activeSite') || 'Active site'}: </span>
                    <span className="text-foreground">{targetContext?.siteName ?? siteContext?.displayName}</span>
                  </div>
                )}
                {/* Description */}
                {objectInfo?.description && (
                  <Card className="gap-2 border-border/70 bg-muted/30 py-3 shadow-none" data-testid="object-drawer-summary-card">
                    <CardContent className="space-y-2 px-3">
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {objectInfo.description}
                      </p>
                      {descriptionProvenance && (
                        <div className="space-y-1 text-[11px] text-muted-foreground" data-testid="object-drawer-source-provenance">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{t('objectDetail.acceptedSource')}</span>
                            <span className="font-medium text-foreground/80">{descriptionProvenance.acceptedSource}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{t(`objectDetail.sourceAuthority.${descriptionProvenance.authorityLevel}`)}</span>
                            {descriptionProvenance.contributors.length > 1 && (
                              <span className="font-mono text-[10px]">
                                {t('objectDetail.fallbackSource')}: {descriptionProvenance.contributors.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Coordinates */}
                <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-section-identity">
                  <CardHeader className="flex flex-row items-center justify-between px-3 py-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {t('coordinates.title')}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs touch-target"
                          disabled={!coordinateFormats}
                          aria-label={t('coordinates.copyAs')}
                        >
                          {copied ? (
                            <><Check className="h-3 w-3 mr-1 text-green-400" />{t('common.copied')}</>
                          ) : (
                            <><Copy className="h-3 w-3 mr-1" />{t('common.copy')}</>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      {coordinateFormats && (
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel>{t('coordinates.copyAs')}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => copyCoordinates(coordinateFormats.hms.combined)}>
                            <span className="flex-1">{t('coordinates.formatHms')}</span>
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{coordinateFormats.hms.ra}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyCoordinates(coordinateFormats.degrees.combined)}>
                            <span className="flex-1">{t('coordinates.formatDegrees')}</span>
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{coordinateFormats.degrees.ra}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => copyCoordinates(coordinateFormats.decimalPair)}>
                            <span className="flex-1">{t('coordinates.formatDecimalPair')}</span>
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">{coordinateFormats.decimalPair}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      )}
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{t('coordinates.ra')}</span>
                        </div>
                        <p className="font-mono text-sm">{identitySection?.coordinates.ra ?? selectedObject?.ra}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="text-xs font-medium">{t('coordinates.dec')}</span>
                        </div>
                        <p className="font-mono text-sm">{identitySection?.coordinates.dec ?? selectedObject?.dec}</p>
                      </div>
                    </div>
                    {/* JPL Horizons high-precision reference position */}
                    {horizons.row && (
                      <div className="flex items-center gap-1.5 text-xs" data-testid="object-drawer-horizons-position">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {t('coordinates.jplHorizons')}
                        </Badge>
                        <span className="font-mono text-muted-foreground">
                          {horizons.row.raDeg.toFixed(4)}°, {horizons.row.decDeg.toFixed(4)}°
                        </span>
                      </div>
                    )}

                    {/* How positions evolve for this object */}
                    {astroData?.targetKind === 'solar_system' && (
                      <p className="text-[11px] text-muted-foreground/80" data-testid="object-drawer-position-recomputed">
                        {t('objectDetail.positionRecomputed')}
                      </p>
                    )}
                    {astroData?.targetKind === 'minor_body' && (
                      <p className="text-[11px] text-amber-400/80" data-testid="object-drawer-position-snapshot">
                        {t('objectDetail.positionSnapshot')}
                      </p>
                    )}

                    {selectionMetadataSection && (
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t(getSelectionSourceLabelKey(selectionMetadataSection.selectionSource))}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t(getSelectionFallbackLabelKey(selectionMetadataSection.selectionFallback))}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Satellites: fixed-RA/Dec forecasts are meaningless — replace
                    the position/planning cards with pass predictions. */}
                {isSatellite && astroData && (
                  <SatelliteInfoNotice
                    noradId={astroData.noradId}
                    latitude={latitude}
                    longitude={longitude}
                  />
                )}

                {/* Current Position */}
                {liveStatusSection && !isSatellite && (
                  <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-section-live-status">
                    <CardHeader className="px-3 py-0">
                      <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                        <ArrowUp className="h-4 w-4 text-muted-foreground" />
                        {t('objectDetail.observation')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-muted/30 p-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                            <ArrowUp className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{t('coordinates.alt')}</span>
                          </div>
                          <p className={cn(
                            'font-mono text-sm font-medium',
                            getAltitudeStateTextClass(liveStatusSection.altitudeState)
                          )}>
                            {liveStatusSection.altitude}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                            <Compass className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{t('coordinates.az')}</span>
                          </div>
                          <p className="font-mono text-sm">{liveStatusSection.azimuth}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {t(`objectDetail.altitudeState.${liveStatusSection.altitudeState}`)}
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs', getMoonInterferenceTextClass(liveStatusSection.moonInterferenceLevel))}>
                          {t(`objectDetail.moonInterference.${liveStatusSection.moonInterferenceLevel}`)}
                        </Badge>
                        {liveStatusSection.calculationState === 'degraded' && (
                          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-300">
                            {t(getCalculationStateLabelKey(liveStatusSection.calculationState))}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {planningSection && (
                  <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-section-planning">
                    <CardHeader className="px-3 py-0">
                      <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        {t('objectDetail.tonightSummary')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3">
                      <div className="rounded-lg bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{t('session.moonDistance')}</span>
                          <span className={cn('text-xs font-medium', getMoonInterferenceTextClass(liveStatusSection?.moonInterferenceLevel ?? 'moderate'))}>
                            {planningSection.moonDistance}
                          </span>
                        </div>
                        <FeasibilityBadge feasibility={planningSection.feasibility} variant="inline" tooltipSide="top" className="rounded-lg bg-muted/30 p-2.5" />
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{t('session.maxAltitude')}</span>
                          <span className="font-mono text-sm font-medium">{planningSection.maxAltitude}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(advancedMetadataSection || selectionMetadataSection) && (
                  <Card className="gap-3 border-border/70 bg-muted/20 py-3 text-xs shadow-none" data-testid="object-drawer-section-advanced-metadata">
                    <CardHeader className="px-3 py-0">
                      <CardTitle className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                        <Database className="h-3.5 w-3.5" />
                        <span>{t('objectDetail.systemMetadata')}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('objectDetail.frameTimeScale')}</span>
                        <span className="font-mono">{advancedMetadataSection ? `${advancedMetadataSection.frame} / ${advancedMetadataSection.timeScale}` : '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('objectDetail.qualityEop')}</span>
                        <span className="font-mono">{advancedMetadataSection ? `${advancedMetadataSection.qualityFlag} / ${advancedMetadataSection.dataFreshness}` : '--'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">{t('objectDetail.calculationSummary')}</span>
                        <span className="font-mono">
                          {advancedMetadataSection
                            ? `${t(getCalculationSourceLabelKey(advancedMetadataSection.calculationSource))} / ${t(getCalculationStateLabelKey(advancedMetadataSection.calculationState))}`
                            : '--'}
                        </span>
                      </div>
                      {selectionMetadataSection && (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{t('objectDetail.selectionSourceLabel')}</span>
                            <span className="font-mono">{t(getSelectionSourceLabelKey(selectionMetadataSection.selectionSource))}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-muted-foreground">{t('objectDetail.selectionFallbackLabel')}</span>
                            <span className="font-mono">{t(getSelectionFallbackLabelKey(selectionMetadataSection.selectionFallback))}</span>
                          </div>
                        </>
                      )}
                      {selectionMetadataSection?.sourceCatalog && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{t('objectDetail.sourceCatalog')}</span>
                          <span className="font-mono">{selectionMetadataSection.sourceCatalog}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t('objectDetail.timestamp')}</span>
                        <span className="font-mono">
                          {advancedMetadataSection?.calculationTimestamp
                            ?? advancedMetadataSection?.updatedAt
                            ?? selectionMetadataSection?.selectionTimestamp
                            ?? '--'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Physical Properties */}
                {objectInfo && (objectInfo.distance || objectInfo.morphologicalType || objectInfo.spectralType || objectInfo.redshift != null || objectInfo.discoverer || objectInfo.discoveryYear) && (
                  <>
                    <Separator className="my-3" />
                    <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-section-properties">
                      <CardHeader className="px-3 py-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                          <Info className="h-4 w-4 text-muted-foreground" />
                          {t('objectDetail.properties')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2 px-3 text-sm">
                        {objectInfo.morphologicalType && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.morphology')}</span>
                            <span>{objectInfo.morphologicalType}</span>
                          </div>
                        )}
                        {objectInfo.spectralType && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.spectralType')}</span>
                            <span>{objectInfo.spectralType}</span>
                          </div>
                        )}
                        {objectInfo.distance && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-muted-foreground">{t('objectDetail.distance')}</span>
                            <span>{objectInfo.distance}</span>
                          </div>
                        )}
                        {objectInfo.redshift != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.redshift')}</span>
                            <span>z = {objectInfo.redshift.toFixed(4)}</span>
                          </div>
                        )}
                        {objectInfo.radialVelocity != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('objectDetail.radialVelocity')}</span>
                            <span>{objectInfo.radialVelocity.toFixed(0)} km/s</span>
                          </div>
                        )}
                        {(objectInfo.discoverer || objectInfo.discoveryYear) && (
                          <div className="flex justify-between col-span-2">
                            <span className="text-muted-foreground">{t('objectDetail.discovery')}</span>
                            <span>
                              {objectInfo.discoverer}{objectInfo.discoverer && objectInfo.discoveryYear ? ', ' : ''}{objectInfo.discoveryYear}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {/* External Links */}
                <Separator className="my-3" />
                <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-section-links">
                  <CardHeader className="px-3 py-0">
                    <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      {t('objectDetail.dataSources')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3">
                    <div className="flex flex-wrap gap-2">
                      {objectInfo?.simbadUrl && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs gap-1.5"
                          onClick={() => openExternalUrl(objectInfo.simbadUrl!)}
                        >
                          <Database className="h-3.5 w-3.5" />
                          SIMBAD
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      {objectInfo?.wikipediaUrl && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs gap-1.5"
                          onClick={() => openExternalUrl(objectInfo.wikipediaUrl!)}
                        >
                          <Info className="h-3.5 w-3.5" />
                          Wikipedia
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {objectInfo?.sources && objectInfo.sources.length > 0 && (
                      <div className="space-y-1 text-[10px] text-muted-foreground/60">
                        <p>
                          {t('objectDetail.dataSources')}: {objectInfo.sources.join(', ')}
                        </p>
                        {unsupportedDiagnostics.length > 0 && (
                          <p data-testid="object-drawer-unsupported-source-state">
                            {t('objectDetail.unsupportedSourceState')}
                          </p>
                        )}
                        {(degradedDiagnostics.length > 0 || imageDiagnostics.some((diagnostic) => diagnostic.status !== 'success')) && (
                          <p data-testid="object-drawer-degraded-source-state">
                            {t('objectDetail.degradedSourceState')}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Images Tab — three-state: gallery / error / loading */}
              <TabsContent value="images" className="mt-0">
                {objectInfo ? (
                  <ObjectImageGallery
                    images={objectInfo.images}
                    objectName={displayName}
                  />
                ) : loadError ? (
                  <div
                    data-testid="object-drawer-images-error"
                    className="flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-muted/20 py-8 text-xs text-muted-foreground"
                  >
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <span>{t('objectDetail.loadError')}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRetryToken((n) => n + 1)}>
                      <RotateCw className="mr-1 h-3 w-3" />
                      {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2" aria-busy="true" data-testid="object-drawer-images-skeleton">
                    <span className="sr-only">{t('objectDetail.imagesLoading')}</span>
                    <Skeleton className="h-48 w-full rounded-lg shell-desktop:h-64" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                )}
              </TabsContent>

              {/* Observation Tab */}
              <TabsContent value="observation" className="space-y-3 mt-0" data-testid="object-drawer-observation-tab">
                {isSatellite && currentAstro && (
                  <SatelliteInfoNotice
                    noradId={currentAstro.noradId}
                    latitude={latitude}
                    longitude={longitude}
                  />
                )}
                {currentAstro && planningSection && (
                  <>
                    {/* Rise/Transit/Set */}
                    <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-observation-visibility-card">
                      <CardHeader className="px-3 py-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {t('objectDetail.observation')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3">
                        <RiseTransitSetGrid visibility={planningSection.visibility} variant="full" />
                      </CardContent>
                    </Card>

                    {/* Moon Distance & Max Altitude */}
                    <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-observation-summary-card">
                      <CardHeader className="px-3 py-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                          <Moon className="h-4 w-4 text-muted-foreground" />
                          {t('objectDetail.tonightSummary')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-2 px-3">
                        <div className="rounded-lg bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                            <Moon className="h-3.5 w-3.5 text-yellow-400/70" />
                            <span className="text-xs font-medium">{t('session.moonDistance')}</span>
                          </div>
                          <p className={cn(
                            'font-mono text-sm font-medium',
                            getMoonInterferenceTextClass(liveStatusSection?.moonInterferenceLevel ?? 'moderate')
                          )}>
                            {planningSection.moonDistance}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
                            <TrendingUp className="h-3.5 w-3.5 text-primary/70" />
                            <span className="text-xs font-medium">{t('session.maxAltitude')}</span>
                          </div>
                          <p className="font-mono text-sm font-medium">
                            {planningSection.maxAltitude}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Imaging Feasibility + auxiliary indicators */}
                    <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-observation-feasibility-card">
                      <CardHeader className="px-3 py-0">
                        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          {t('objectDetail.tonightSummary')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 px-3">
                        <FeasibilityBadge feasibility={planningSection.feasibility} variant="inline" tooltipSide="top" className="p-2.5 rounded-lg bg-muted/30" />
                        <div className="flex flex-wrap items-center gap-2">
                          {planningSection.visibility.darkImagingHours > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-green-400">
                              <Clock className="h-3.5 w-3.5" />
                              {t('info.darkImagingWindow', {
                                hours: planningSection.visibility.darkImagingHours.toFixed(1)
                              })}
                            </div>
                          )}
                          {planningSection.visibility.isCircumpolar && (
                            <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                              {t('session.circumpolar')}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Altitude Chart - responsive */}
                    {selectedObject && (
                      <Card className="gap-3 border-border/70 bg-muted/20 py-3 shadow-none" data-testid="object-drawer-observation-chart-card">
                        <CardHeader className="px-3 py-0">
                          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                            <ArrowUp className="h-4 w-4 text-muted-foreground" />
                            {t('session.maxAltitude')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-3">
                          <div className="rounded-lg bg-muted/20 border border-border/50">
                            <AltitudeChartCompact
                              ra={selectedObject.raDeg}
                              dec={selectedObject.decDeg}
                              positionAt={currentAstro.targetKind === 'solar_system' ? currentAstro.positionAt : undefined}
                              visibility={currentAstro.targetKind === 'solar_system' ? currentAstro.visibility : undefined}
                              isSnapshot={currentAstro.positionIsSnapshot}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
          </div>
        </ScrollArea>

        {/* Action Buttons - with safe area for mobile */}
        <DrawerFooter className="sticky bottom-0 border-t bg-background/95 p-4 pt-2 pb-[calc(var(--safe-area-bottom)+0.75rem)] backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 shell-desktop:flex-row">
            {mountConnected && (
              <Button
                variant="outline"
                className="h-11 w-full border-primary text-primary hover:bg-primary/20 touch-target shell-desktop:h-10 shell-desktop:flex-1"
                onClick={handleSlew}
              >
                <Crosshair className="h-4 w-4 mr-2" />
                {t('actions.slewToObject')}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 w-full touch-target shell-desktop:h-10 shell-desktop:flex-1"
              onClick={handleAddToList}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('actions.addToTargetList')}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
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
    </Drawer>
  );
});


