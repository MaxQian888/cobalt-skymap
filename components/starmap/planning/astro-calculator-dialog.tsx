'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
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
} from './astro-calculator';

// ============================================================================
// Main Component
// ============================================================================

export function AstroCalculatorDialog() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('wut');
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
  const [sharedConstraints] = useState(DEFAULT_ASTRO_CALCULATOR_OBSERVER_CONSTRAINTS);

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

  const handleSelectObject = useCallback((ra: number, dec: number) => {
    if (setViewDirection) {
      setViewDirection(ra, dec);
    }
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
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Calculator className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('astroCalc.title')}</p>
        </TooltipContent>
      </Tooltip>

      <ResponsiveDialogContent className="max-w-4xl max-h-[100vh] max-h-[100dvh] overflow-hidden flex flex-col">
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
              <Badge variant="secondary" className="font-normal text-xs">
                {observerContext.timezone}
              </Badge>
              <Badge variant="outline" className="font-normal text-xs gap-1.5">
                <MapPin className="h-3 w-3" />
                {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
              </Badge>
            </div>
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="overflow-x-auto pb-1" data-testid="astro-calculator-tab-nav">
            <TabsList className="inline-flex w-max min-w-full h-auto flex-nowrap gap-1 p-1 sm:grid sm:w-full sm:grid-cols-3 sm:grid-rows-3 lg:grid-cols-5 lg:grid-rows-2">
              {ASTRO_CALCULATOR_TAB_ORDER.map((tabId) => (
                <TabsTrigger
                  key={tabId}
                  value={tabId}
                  data-capability-tab={tabId}
                  className="text-xs min-w-[110px] sm:min-w-0"
                >
                  {t(ASTRO_CALCULATOR_CAPABILITY_MATRIX[tabId].labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 mt-3 min-h-0 overflow-hidden">
            <TabsContent value="wut" className="mt-0 h-full overflow-hidden">
              <WUTTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="positions" className="mt-0 h-full overflow-hidden">
              <PositionsTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                onSelectObject={handleSelectObject}
                onAddToList={handleAddToList}
              />
            </TabsContent>

            <TabsContent value="rts" className="mt-0 h-full overflow-hidden">
              <RTSTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                onSharedDateChange={setSharedDate}
              />
            </TabsContent>

            <TabsContent value="ephemeris" className="mt-0 h-full overflow-hidden">
              <EphemerisTab
                latitude={latitude}
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                onSharedDateChange={setSharedDate}
              />
            </TabsContent>

            <TabsContent value="almanac" className="mt-0 h-full overflow-hidden">
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

            <TabsContent value="phenomena" className="mt-0 h-full overflow-hidden">
              <PhenomenaTab latitude={latitude} longitude={longitude} observerContext={observerContext} />
            </TabsContent>

            <TabsContent value="coordinate" className="mt-0 h-full overflow-hidden">
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

            <TabsContent value="time" className="mt-0 h-full overflow-hidden">
              <TimeTab
                longitude={longitude}
                observerContext={observerContext}
                sharedDate={sharedDate}
                sharedTime={sharedTime}
                onSharedDateChange={setSharedDate}
                onSharedTimeChange={setSharedTime}
              />
            </TabsContent>

            <TabsContent value="solar-system" className="mt-0 h-full overflow-hidden">
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
