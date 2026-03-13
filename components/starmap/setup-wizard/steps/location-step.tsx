'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Navigation, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useMountStore } from '@/lib/stores/mount-store';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';
import type { ObserverLocation } from '@/types/starmap/setup-wizard';
import { isValidLocation } from '@/lib/utils/observer-location';
import {
  detectObservationStepLocation,
  loadObservationStepLocation,
  saveObservationStepLocation,
} from '@/lib/services/observation-location-entry';
import { useCanonicalObservationLocationState } from '@/lib/hooks/use-canonical-observation-location';

export function LocationStep() {
  const t = useTranslations();
  const updateSetupData = useSetupWizardStore((state) => state.updateSetupData);
  const setProfileInfo = useMountStore((state) => state.setProfileInfo);
  const {
    currentLocation,
    hasSavedLocation,
    loading: canonicalLocationLoading,
  } = useCanonicalObservationLocationState();

  const [location, setLocationState] = useState<ObserverLocation | null>(null);

  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualLat, setManualLat] = useState(location?.latitude?.toString() || '');
  const [manualLon, setManualLon] = useState(location?.longitude?.toString() || '');
  const [manualAlt, setManualAlt] = useState(location?.altitude?.toString() || '0');

  const setLocation = useCallback(async (loc: ObserverLocation) => {
    const resolvedLocation = await saveObservationStepLocation(loc) ?? loc;
    setLocationState(resolvedLocation);

    const currentProfile = useMountStore.getState().profileInfo;
    setProfileInfo({
      AstrometrySettings: {
        ...currentProfile.AstrometrySettings,
        Latitude: resolvedLocation.latitude,
        Longitude: resolvedLocation.longitude,
        Elevation: resolvedLocation.altitude,
      },
    });
  }, [setProfileInfo]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const stored = await loadObservationStepLocation();
      if (!active || !stored) {
        return;
      }

      setLocationState(stored);
      setManualLat(stored.latitude.toString());
      setManualLon(stored.longitude.toString());
      setManualAlt(stored.altitude.toString());

      const currentProfile = useMountStore.getState().profileInfo;
      setProfileInfo({
        AstrometrySettings: {
          ...currentProfile.AstrometrySettings,
          Latitude: stored.latitude,
          Longitude: stored.longitude,
          Elevation: stored.altitude,
        },
      });
    })();

    return () => {
      active = false;
    };
  }, [setProfileInfo]);

  const hasLocation = isValidLocation(location);

  useEffect(() => {
    updateSetupData({ locationConfigured: hasLocation });
  }, [hasLocation, updateSetupData]);

  const handleGetGPSLocation = async () => {
    setIsGettingLocation(true);
    setGpsError(null);

    const result = await detectObservationStepLocation();
    if (result.errorKey) {
      setGpsError(t(result.errorKey));
      setIsGettingLocation(false);
      return;
    }

    if (result.location) {
      await setLocation(result.location);
      setManualLat(result.location.latitude.toString());
      setManualLon(result.location.longitude.toString());
      setManualAlt(result.location.altitude.toString());
    }

    setIsGettingLocation(false);
  };

  const isManualValid = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  };

  const handleManualSubmit = async () => {
    if (!isManualValid()) return;
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    const alt = parseFloat(manualAlt);

    await setLocation({
      latitude: lat,
      longitude: lon,
      altitude: !isNaN(alt) && alt >= 0 ? alt : 0,
    });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-sm text-muted-foreground">
        {t('setupWizard.steps.location.description')}
      </p>

      {!canonicalLocationLoading && (
        <p className="text-xs text-muted-foreground">
          {hasSavedLocation
            ? (
              t('setupWizard.steps.location.currentSiteHint', {
                name: currentLocation?.name ?? (t('locations.title') || 'Current site'),
              })
              || `Applying coordinates will update the active observation site: ${currentLocation?.name ?? 'Current site'}.`
            )
            : (
              t('setupWizard.steps.location.createFirstSiteHint')
              || 'Applying coordinates will create your first saved observation site.'
            )}
        </p>
      )}

      {/* Mode selection with Tabs */}
      <Tabs defaultValue="gps" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gps" className="gap-2">
            <Navigation className="w-4 h-4" />
            {t('setupWizard.steps.location.useGPS')}
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Globe className="w-4 h-4" />
            {t('setupWizard.steps.location.enterManually')}
          </TabsTrigger>
        </TabsList>

        {/* GPS mode */}
        <TabsContent value="gps" className="space-y-4">
          <Button
            onClick={handleGetGPSLocation}
            disabled={isGettingLocation}
            className="w-full gap-2"
            variant="outline"
          >
            {isGettingLocation ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t('setupWizard.steps.location.detecting')}
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                {t('setupWizard.steps.location.detectLocation')}
              </>
            )}
          </Button>

          {gpsError && (
            <Alert variant="destructive">
              <AlertDescription>{gpsError}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Manual mode */}
        <TabsContent value="manual" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">{t('setupWizard.steps.location.latitude')}</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder={t('setupWizard.steps.location.latitudePlaceholder')}
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">{t('setupWizard.steps.location.longitude')}</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder={t('setupWizard.steps.location.longitudePlaceholder')}
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="altitude">{t('setupWizard.steps.location.altitude')}</Label>
            <Input
              id="altitude"
              type="number"
              step="any"
              min="0"
              placeholder={t('setupWizard.steps.location.altitudePlaceholder')}
              value={manualAlt}
              onChange={(e) => setManualAlt(e.target.value)}
            />
          </div>

          <Button
            onClick={handleManualSubmit}
            disabled={!isManualValid()}
            className="w-full"
            variant="outline"
          >
            {t('setupWizard.steps.location.setLocation')}
          </Button>
        </TabsContent>
      </Tabs>

      {/* Current location display */}
      {hasLocation && (
        <Alert className="bg-green-500/10 border-green-500/30">
          <Check className="h-4 w-4 text-green-500" />
          <AlertTitle>{t('setupWizard.steps.location.locationSet')}</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°{location.altitude > 0 ? `, ${location.altitude.toFixed(0)}m` : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Skip note */}
      <p className="text-xs text-muted-foreground text-center">
        {t('setupWizard.steps.location.skipNote')}
      </p>
    </div>
  );
}
