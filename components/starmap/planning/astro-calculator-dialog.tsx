'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { STARMAP_DIALOG_ICON_TRIGGER_CLASS } from '@/components/starmap/dialogs/dialog-layout';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  MapPin,
  Moon,
  Crosshair,
  Sunrise,
  Table2,
  CalendarDays,
  Sparkles,
  Compass,
  Clock,
  Orbit,
  type LucideIcon,
} from 'lucide-react';
import { useMountStore, useStellariumStore } from '@/lib/stores';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { useCanonicalObservationLocationState } from '@/lib/hooks/use-canonical-observation-location';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  PositionsTab,
  WUTTab,
  RTSTab,
  EphemerisTab,
  AlmanacTab,
  PhenomenaTab,
  CoordinateTab,
  TimeTab,
  SolarSystemTab,
  ASTRO_CALCULATOR_CAPABILITY_MATRIX,
  ASTRO_CALCULATOR_TAB_ORDER,
  buildAstroCalculatorObserverContext,
  DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS,
  type AstroCalculatorTabId,
} from './astro-calculator';

// ============================================================================
// Tab presentation (icons + short labels kept local so the capability matrix
// stays pure data; the visible tab bar is a single horizontally-scrolling row).
// ============================================================================

const TAB_ICONS: Record<AstroCalculatorTabId, LucideIcon> = {
  wut: Moon,
  positions: Crosshair,
  rts: Sunrise,
  ephemeris: Table2,
  almanac: CalendarDays,
  phenomena: Sparkles,
  coordinate: Compass,
  time: Clock,
  'solar-system': Orbit,
};

const TAB_SHORT_LABEL_KEY: Record<AstroCalculatorTabId, string> = {
  wut: 'astroCalc.tabShort.wut',
  positions: 'astroCalc.tabShort.positions',
  rts: 'astroCalc.tabShort.rts',
  ephemeris: 'astroCalc.tabShort.ephemeris',
  almanac: 'astroCalc.tabShort.almanac',
  phenomena: 'astroCalc.tabShort.phenomena',
  coordinate: 'astroCalc.tabShort.coordinate',
  time: 'astroCalc.tabShort.time',
  'solar-system': 'astroCalc.tabShort.solarSystem',
};

// ============================================================================
// Main Component
// ============================================================================

export function AstroCalculatorDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('wut');
  // Lazy-mount + keep-alive: a tab is mounted on first visit and stays mounted
  // (rendered hidden) afterwards, so re-visiting it is instant — no recompute of
  // its memos and no loss of in-tab selections. Tabs never opened stay unmounted,
  // so opening the dialog does not eagerly run all 9 tabs' calculations.
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(['wut']));
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    setMountedTabs((prev) => {
      if (prev.has(value)) return prev;
      const next = new Set(prev);
      next.add(value);
      return next;
    });
  }, []);
  // Keep the active trigger visible in the single-row scrollable tab bar.
  const tabNavRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const active = tabNavRef.current?.querySelector<HTMLElement>(
      `[data-capability-tab="${activeTab}"]`,
    );
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [activeTab]);
  const [sharedDate, setSharedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [sharedTime, setSharedTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const sharedConstraints = DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS;

  const profileInfo = useMountStore((state) => state.profileInfo);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const addTarget = useTargetListStore((state) => state.addTarget);
  const { currentLocation } = useCanonicalObservationLocationState();

  const observerContext = useMemo(() => buildAstroCalculatorObserverContext({
    currentLocation,
    profileInfo,
    sharedDate,
    sharedTime,
    constraints: sharedConstraints,
  }), [currentLocation, profileInfo, sharedDate, sharedTime, sharedConstraints]);

  const latitude = observerContext.latitude;
  const longitude = observerContext.longitude;

  // Close the dialog after slewing: the modal covers the sky view, so keeping
  // it open would make the "select object" action invisible to the user.
  const handleSelectObject = useCallback((ra: number, dec: number) => {
    if (setViewDirection) {
      setViewDirection(ra, dec);
    }
    setOpen(false);
  }, [setViewDirection]);

  const handleAddToList = useCallback((name: string, ra: number, dec: number) => {
    addTarget({
      name,
      ra,
      dec,
      raString: degreesToHMS(ra),
      decString: degreesToDMS(dec),
      priority: 'medium',
    });
  }, [addTarget]);

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="complex-editor">
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={STARMAP_DIALOG_ICON_TRIGGER_CLASS}
              aria-label={t('astroCalc.title')}
            >
              <Calculator className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('astroCalc.title')}</p>
        </TooltipContent>
      </Tooltip>

      {/* Width needs the sm: prefix: the DialogContent base class carries
          sm:max-w-lg, which an unprefixed max-w-* cannot override in the
          cascade. Fixed height keeps the dialog from resizing between
          table tabs (fill) and card tabs (content-sized). */}
      {/* mobileClassName: the drawer base's data-[vaul-drawer-direction=bottom]
          variants outrank the complex-editor tier's plain max-h/rounded classes,
          silently capping the "full-screen" tier at 80vh — the ! marks restore
          the intended full-screen sheet so the results table keeps its space. */}
      <ResponsiveDialogContent
        className="overflow-hidden flex flex-col"
        desktopClassName="sm:max-w-4xl xl:max-w-5xl h-[88vh] supports-[height:1dvh]:h-[88dvh]"
        mobileClassName="max-h-[100dvh]! rounded-none!"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              {t('astroCalc.title')}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary" className="font-normal text-xs">
                {observerContext.locationName}
              </Badge>
              <Badge variant="secondary" className="font-normal text-xs hidden sm:inline-flex">
                {observerContext.timezone}
              </Badge>
              <Badge variant="outline" className="font-normal text-xs gap-1.5">
                <MapPin className="h-3 w-3" />
                {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
              </Badge>
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Single-row, horizontally scrollable tab bar. Icons keep triggers
              compact so all 9 tabs sit on one row on desktop; a right-edge fade
              signals overflow on narrow widths. */}
          <div className="relative shrink-0">
            <div
              ref={tabNavRef}
              className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-testid="astro-calculator-tab-nav"
            >
              <TabsList className="flex w-max min-w-full h-auto flex-nowrap justify-start gap-1 p-1">
                {ASTRO_CALCULATOR_TAB_ORDER.map((tabId) => {
                  const Icon = TAB_ICONS[tabId];
                  const fullLabel = t(ASTRO_CALCULATOR_CAPABILITY_MATRIX[tabId].labelKey);
                  return (
                    <TabsTrigger
                      key={tabId}
                      value={tabId}
                      data-capability-tab={tabId}
                      title={fullLabel}
                      aria-label={fullLabel}
                      className="shrink-0 gap-1.5 text-xs max-sm:py-2"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{t(TAB_SHORT_LABEL_KEY[tabId])}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
              aria-hidden="true"
            />
          </div>

          <div className="flex-1 mt-3 min-h-0 overflow-hidden flex flex-col">
            <TabsContent value="wut" forceMount={mountedTabs.has('wut') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <WUTTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="positions" forceMount={mountedTabs.has('positions') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <PositionsTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="rts" forceMount={mountedTabs.has('rts') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <RTSTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                onSharedDateChange={setSharedDate}
              />
            </TabsContent>

            <TabsContent value="ephemeris" forceMount={mountedTabs.has('ephemeris') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <EphemerisTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                onSharedDateChange={setSharedDate}
              />
            </TabsContent>

            <TabsContent value="almanac" forceMount={mountedTabs.has('almanac') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <AlmanacTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                sharedTime={sharedTime}
                onSharedDateChange={setSharedDate}
                onSharedTimeChange={setSharedTime}
              />
            </TabsContent>

            <TabsContent value="phenomena" forceMount={mountedTabs.has('phenomena') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <PhenomenaTab latitude={latitude} longitude={longitude} observerContext={observerContext} />
            </TabsContent>

            <TabsContent value="coordinate" forceMount={mountedTabs.has('coordinate') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <CoordinateTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                sharedTime={sharedTime}
                onSharedDateChange={setSharedDate}
                onSharedTimeChange={setSharedTime}
              />
            </TabsContent>

            <TabsContent value="time" forceMount={mountedTabs.has('time') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <TimeTab
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                sharedTime={sharedTime}
                onSharedDateChange={setSharedDate}
                onSharedTimeChange={setSharedTime}
              />
            </TabsContent>

            <TabsContent value="solar-system" forceMount={mountedTabs.has('solar-system') || undefined} className="mt-0 flex-1 min-h-0 overflow-hidden flex flex-col data-[state=inactive]:hidden">
              <SolarSystemTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                sharedTime={sharedTime}
                onSharedDateChange={setSharedDate}
                onSharedTimeChange={setSharedTime}
              />
            </TabsContent>
          </div>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
