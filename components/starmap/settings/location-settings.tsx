'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  MapPinOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocationDraftModel } from '@/lib/hooks/use-settings-draft';
import { useCanonicalObservationLocationState } from '@/lib/hooks/use-canonical-observation-location';
import { cn } from '@/lib/utils';
import { SettingsSection } from './settings-shared';

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown' | 'checking';

function LocationPermissionStatus() {
  const t = useTranslations();
  const [permissionState, setPermissionState] = useState<PermissionState>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);
  const { setLocation } = useLocationDraftModel();

  useEffect(() => {
    let permissionStatus: PermissionStatus | null = null;
    const handleChange = () => {
      if (permissionStatus) {
        setPermissionState(permissionStatus.state as PermissionState);
      }
    };

    const checkPermission = async () => {
      setPermissionState('checking');
      try {
        if ('permissions' in navigator) {
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionState(permissionStatus.state as PermissionState);
          if (typeof permissionStatus.addEventListener === 'function') {
            permissionStatus.addEventListener('change', handleChange);
          }
        } else {
          setPermissionState('unknown');
        }
      } catch {
        setPermissionState('unknown');
      }
    };
    
    checkPermission();

    return () => {
      if (permissionStatus && typeof permissionStatus.removeEventListener === 'function') {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, []);
  
  const handleRequestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setPermissionState('denied');
      return;
    }
    
    setIsRequesting(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionState('granted');
        setIsRequesting(false);

        const nextLocation: Parameters<typeof setLocation>[0] = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (position.coords.altitude !== null && Number.isFinite(position.coords.altitude)) {
          nextLocation.elevation = position.coords.altitude;
        }

        setLocation(nextLocation);
      },
      (error) => {
        setIsRequesting(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
        } else {
          setPermissionState('unknown');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [setLocation]);
  
  const getStatusIcon = () => {
    switch (permissionState) {
      case 'granted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'prompt':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
      default:
        return <MapPinOff className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getStatusText = () => {
    switch (permissionState) {
      case 'granted':
        return t('settings.locationGranted');
      case 'denied':
        return t('settings.locationDenied');
      case 'prompt':
        return t('settings.locationPrompt');
      case 'checking':
        return t('settings.locationChecking');
      default:
        return t('settings.locationUnknown');
    }
  };
  
  const getStatusColor = () => {
    switch (permissionState) {
      case 'granted':
        return 'bg-green-500/10 border-green-500/30';
      case 'denied':
        return 'bg-red-500/10 border-red-500/30';
      case 'prompt':
        return 'bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'bg-muted/50 border-border';
    }
  };
  
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border",
      getStatusColor()
    )}>
      <div className="flex items-center gap-2 min-w-0">
        {getStatusIcon()}
        <div className="min-w-0">
          <span className="text-sm font-medium">{t('settings.locationPermission')}</span>
          <p className="text-xs text-muted-foreground truncate">{getStatusText()}</p>
        </div>
      </div>
      
      {(permissionState === 'prompt' || permissionState === 'unknown' || permissionState === 'granted') && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 ml-2"
          onClick={handleRequestLocation}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 hidden sm:inline">
            {permissionState === 'granted' ? t('settings.refreshLocation') : t('settings.getLocation')}
          </span>
        </Button>
      )}
    </div>
  );
}

export function LocationSettings() {
  const t = useTranslations();
  const { location, setLocation } = useLocationDraftModel();
  const {
    currentLocation,
    hasSavedLocation,
    loading: canonicalLocationLoading,
  } = useCanonicalObservationLocationState();

  const commitLocation = useCallback((field: 'Latitude' | 'Longitude' | 'Elevation', rawValue: string) => {
    const val = parseFloat(rawValue) || 0;
    let clamped = val;
    if (field === 'Latitude') clamped = Math.max(-90, Math.min(90, val));
    if (field === 'Longitude') clamped = Math.max(-180, Math.min(180, val));
    if (field === 'Latitude') {
      setLocation({ latitude: clamped });
      return;
    }
    if (field === 'Longitude') {
      setLocation({ longitude: clamped });
      return;
    }
    setLocation({ elevation: clamped });
  }, [setLocation]);

  // Key forces re-mount of inputs when store values change externally (e.g. GPS)
  const storeKey = `${location.latitude}-${location.longitude}-${location.elevation}`;

  return (
    <SettingsSection
      title={t('settings.location')}
      icon={<MapPin className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        {/* Instant effect hint */}
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded">
          {t('settings.locationInstantHint')}
        </p>

        {!canonicalLocationLoading && (
          <p className="text-xs text-muted-foreground">
            {hasSavedLocation
              ? (
                t('settings.currentSiteSyncHint', {
                  name: currentLocation?.name ?? (t('locations.title') || 'Current site'),
                })
                || `Saving these coordinates updates the active observation site: ${currentLocation?.name ?? 'Current site'}.`
              )
              : (
                t('settings.createFirstSiteHint')
                || 'Saving these coordinates will create your first saved observation site.'
              )}
          </p>
        )}
        
        <LocationPermissionStatus />
        
        {/* Manual Location Input — commits to store only on blur */}
        <div className="space-y-2" key={storeKey}>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{t('settings.manualLocation')}</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{t('settings.latitude')}</Label>
              <Input
                type="number"
                step="0.0001"
                min={-90}
                max={90}
                defaultValue={location.latitude || 0}
                onBlur={(e) => commitLocation('Latitude', e.target.value)}
                placeholder={t('settings.latitudePlaceholder')}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">{t('settings.longitude')}</Label>
              <Input
                type="number"
                step="0.0001"
                min={-180}
                max={180}
                defaultValue={location.longitude || 0}
                onBlur={(e) => commitLocation('Longitude', e.target.value)}
                placeholder={t('settings.longitudePlaceholder')}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{t('settings.elevation')} (m)</Label>
            <Input
              type="number"
              step="1"
              defaultValue={location.elevation || 0}
              onBlur={(e) => commitLocation('Elevation', e.target.value)}
              placeholder={t('settings.elevationPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
