'use client';

import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { MapPin, Layers, Sun } from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { mapConfig } from '@/lib/services/map-config';
import { geocodingService } from '@/lib/services/geocoding-service';
import { TILE_LAYER_CONFIGS, type TileLayerType } from '@/lib/constants/map';
import { MapHealthMonitor } from './map-health-monitor';
import { LocationSearch } from './location-search';
import type { Coordinates, LocationResult } from '@/types/starmap/map';
import type { TileLayerFallbackEvent } from './leaflet-map';
import type { LocationDraftMetadataIssue, LocationDraftSummaryStatus } from '@/lib/services/location-draft-metadata';

// Lazy load LeafletMap to avoid SSR issues and improve initial load
const LeafletMap = dynamic(() => import('./leaflet-map').then(mod => ({ default: mod.LeafletMap })), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full" />,
});

const LOCATION_EPSILON = 0.000001;

interface MapLocationPickerProps {
  initialLocation?: Coordinates;
  onLocationChange: (location: Coordinates) => void;
  onLocationSelect?: (location: LocationResult) => void;
  className?: string;
  showSearch?: boolean;
  showControls?: boolean;
  height?: string | number;
  disabled?: boolean;
  tileLayer?: TileLayerType;
  compact?: boolean;
  commitMode?: 'immediate' | 'staged';
  draftMetadataState?: {
    coordinates: Coordinates;
    summaryStatus: Extract<LocationDraftSummaryStatus, 'loading' | 'partial' | 'error' | 'ready' | 'stale'>;
    issues: LocationDraftMetadataIssue[];
  } | null;
  onRetryMetadata?: () => void;
  onOpenProviderSettings?: () => void;
}

interface TileLayerDropdownProps {
  options: { value: TileLayerType; label: string }[];
  current: TileLayerType;
  onChange: (value: TileLayerType) => void;
  unavailableLayers: TileLayerType[];
  unavailableLabel: string;
  size?: 'sm' | 'default';
}

function areCoordinatesEqual(a: Coordinates, b: Coordinates): boolean {
  return (
    Math.abs(a.latitude - b.latitude) <= LOCATION_EPSILON
    && Math.abs(a.longitude - b.longitude) <= LOCATION_EPSILON
  );
}

function normalizeTileLayer(tileLayer: TileLayerType | undefined): TileLayerType {
  if (!tileLayer) return 'openstreetmap';
  return tileLayer in TILE_LAYER_CONFIGS ? tileLayer : 'openstreetmap';
}

function TileLayerDropdown({
  options,
  current,
  onChange,
  unavailableLayers,
  unavailableLabel,
  size = 'default',
}: TileLayerDropdownProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={btnSize}>
          <Layers className={iconSize} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => {
          const isUnavailable = unavailableLayers.includes(option.value);
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                current === option.value && 'bg-muted',
                isUnavailable && 'opacity-60'
              )}
            >
              <span>{option.label}</span>
              {isUnavailable && (
                <span className="ml-2 text-xs text-muted-foreground">({unavailableLabel})</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MapLocationPickerComponent({
  initialLocation = { latitude: 39.9042, longitude: 116.4074 },
  onLocationChange,
  onLocationSelect,
  className,
  showSearch = true,
  showControls = true,
  height = 400,
  disabled = false,
  tileLayer: initialTileLayer,
  compact = false,
  commitMode = 'immediate',
  draftMetadataState = null,
  onRetryMetadata,
  onOpenProviderSettings,
}: MapLocationPickerProps) {
  const t = useTranslations();

  const initialUiPreferences = useMemo(() => mapConfig.getUiPreferences(), []);
  const initialResolvedTileLayer = useMemo(
    () => normalizeTileLayer(initialTileLayer ?? initialUiPreferences.tileLayer),
    [initialTileLayer, initialUiPreferences.tileLayer]
  );

  // Dynamic tile layer options with i18n
  const tileLayerOptions = useMemo(() => [
    { value: 'openstreetmap' as TileLayerType, label: t('map.tileLayers.openstreetmap') },
    { value: 'cartodb_light' as TileLayerType, label: t('map.tileLayers.cartodbLight') },
    { value: 'cartodb_dark' as TileLayerType, label: t('map.tileLayers.cartodbDark') },
    { value: 'esri_satellite' as TileLayerType, label: t('map.tileLayers.satellite') },
    { value: 'esri_topo' as TileLayerType, label: t('map.tileLayers.topographic') },
  ], [t]);

  const [committedLocation, setCommittedLocation] = useState<Coordinates>(initialLocation);
  const [draftLocation, setDraftLocation] = useState<Coordinates>(initialLocation);
  const [zoom, setZoom] = useState(initialUiPreferences.zoom);
  const [tileLayer, setTileLayer] = useState<TileLayerType>(initialResolvedTileLayer);
  const [showLightPollution, setShowLightPollution] = useState(initialUiPreferences.showLightPollution);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [fallbackEvent, setFallbackEvent] = useState<TileLayerFallbackEvent | null>(null);
  const [unavailableLayers, setUnavailableLayers] = useState<TileLayerType[]>([]);
  const pendingSelectionRef = useRef<LocationResult | null>(null);
  const latInputRef = useRef<HTMLInputElement>(null);
  const lngInputRef = useRef<HTMLInputElement>(null);

  const currentLocation = commitMode === 'staged' ? draftLocation : committedLocation;
  const hasPendingChanges = commitMode === 'staged' && !areCoordinatesEqual(draftLocation, committedLocation);
  const searchCapabilities = geocodingService.getSearchCapabilities();

  // Sync ref input values when location changes from non-input sources (map click, search, sync)
  useEffect(() => {
    if (latInputRef.current && document.activeElement !== latInputRef.current) {
      latInputRef.current.value = String(currentLocation.latitude);
    }
    if (lngInputRef.current && document.activeElement !== lngInputRef.current) {
      lngInputRef.current.value = String(currentLocation.longitude);
    }
  }, [currentLocation.latitude, currentLocation.longitude]);

  // Sync with external initialLocation changes
  const initialLocationKey = `${initialLocation.latitude}:${initialLocation.longitude}`;
  const lastInitialLocationKeyRef = useRef(initialLocationKey);
  useEffect(() => {
    if (lastInitialLocationKeyRef.current === initialLocationKey) {
      return;
    }
    lastInitialLocationKeyRef.current = initialLocationKey;
    const timer = window.setTimeout(() => {
      setCommittedLocation(initialLocation);
      setDraftLocation(initialLocation);
      pendingSelectionRef.current = null;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLocation, initialLocationKey]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    mapConfig.setUiPreferences({
      tileLayer,
      zoom,
      showLightPollution,
    });
  }, [tileLayer, zoom, showLightPollution]);

  // Memoize map height style
  const mapHeight = useMemo(
    () => (typeof height === 'number' ? height - 40 : height), // Subtract space for controls
    [height]
  );

  const stageLocation = useCallback((location: Coordinates, result?: LocationResult) => {
    setDraftLocation(location);

    if (result) {
      pendingSelectionRef.current = result;
    } else {
      pendingSelectionRef.current = null;
    }

    if (commitMode === 'immediate') {
      setCommittedLocation(location);
      onLocationChange(location);
      if (result) {
        onLocationSelect?.(result);
      }
    }
  }, [commitMode, onLocationChange, onLocationSelect]);

  const handleLocationSearchSelect = useCallback((result: LocationResult) => {
    setZoom(14);
    stageLocation(result.coordinates, result);
  }, [stageLocation]);

  const handleMapLocationChange = useCallback((location: Coordinates) => {
    stageLocation(location);
  }, [stageLocation]);

  const handleMapClick = useCallback((location: Coordinates) => {
    setZoom(prev => Math.max(prev, 12));
    stageLocation(location);
  }, [stageLocation]);

  const commitCoordinateInput = useCallback(() => {
    const latVal = parseFloat(latInputRef.current?.value ?? '');
    const lngVal = parseFloat(lngInputRef.current?.value ?? '');
    if (isNaN(latVal) || isNaN(lngVal)) return;
    const newLocation = {
      latitude: Math.max(-90, Math.min(90, latVal)),
      longitude: Math.max(-180, Math.min(180, lngVal)),
    };
    stageLocation(newLocation);
  }, [stageLocation]);

  const handleCoordinateKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitCoordinateInput();
    }
  }, [commitCoordinateInput]);

  const applyDraftLocation = useCallback(() => {
    if (commitMode !== 'staged') {
      return;
    }
    setCommittedLocation(draftLocation);
    onLocationChange(draftLocation);
    if (pendingSelectionRef.current && areCoordinatesEqual(pendingSelectionRef.current.coordinates, draftLocation)) {
      onLocationSelect?.(pendingSelectionRef.current);
    }
    pendingSelectionRef.current = null;
  }, [commitMode, draftLocation, onLocationChange, onLocationSelect]);

  const discardDraftLocation = useCallback(() => {
    if (commitMode !== 'staged') {
      return;
    }
    setDraftLocation(committedLocation);
    pendingSelectionRef.current = null;
  }, [commitMode, committedLocation]);

  const handleTileLayerChange = useCallback((nextTileLayer: TileLayerType) => {
    const normalizedLayer = normalizeTileLayer(nextTileLayer);
    if (normalizedLayer !== 'openstreetmap' && unavailableLayers.includes(normalizedLayer)) {
      setFallbackEvent({
        failedLayer: normalizedLayer,
        fallbackLayer: 'openstreetmap',
        errorCount: 0,
      });
      setTileLayer('openstreetmap');
      return;
    }
    setTileLayer(normalizedLayer);
    setFallbackEvent(null);
  }, [unavailableLayers]);

  const handleTileLayerFallback = useCallback((event: TileLayerFallbackEvent) => {
    setUnavailableLayers(prev =>
      prev.includes(event.failedLayer) ? prev : [...prev, event.failedLayer]
    );
    setFallbackEvent(event);
    setTileLayer(event.fallbackLayer);
  }, []);

  const statusText = useMemo(() => {
    if (searchCapabilities.mode === 'online-autocomplete') {
      return t('map.autocompleteAvailable') || 'Autocomplete search is available.';
    }
    if (searchCapabilities.mode === 'submit-search') {
      return t('map.submitToSearch') || 'Press Enter to search';
    }
    if (searchCapabilities.mode === 'offline-cache') {
      return t('map.offlineSearchRestricted') || 'Offline mode: online search disabled';
    }
    return t('map.searchDisabled') || 'Search is disabled by policy';
  }, [searchCapabilities.mode, t]);

  const fallbackText = useMemo(() => {
    if (!fallbackEvent) return null;
    const failedLabel = tileLayerOptions.find(option => option.value === fallbackEvent.failedLayer)?.label
      || fallbackEvent.failedLayer;
    const fallbackLabel = tileLayerOptions.find(option => option.value === fallbackEvent.fallbackLayer)?.label
      || fallbackEvent.fallbackLayer;
    return (
      t('map.layerFallback', { failed: failedLabel, fallback: fallbackLabel })
      || `Layer ${failedLabel} is unavailable. Switched to ${fallbackLabel}.`
    );
  }, [fallbackEvent, tileLayerOptions, t]);

  const activeDraftMetadata = useMemo(() => {
    if (!draftMetadataState || draftMetadataState.summaryStatus === 'stale') {
      return null;
    }

    return areCoordinatesEqual(draftMetadataState.coordinates, currentLocation)
      ? draftMetadataState
      : null;
  }, [draftMetadataState, currentLocation]);

  const draftMetadataStatusText = useMemo(() => {
    if (!activeDraftMetadata) return null;
    if (activeDraftMetadata.summaryStatus === 'loading') {
      return t('map.metadataLoading') || 'Refreshing location metadata...';
    }
    if (activeDraftMetadata.summaryStatus === 'partial') {
      return t('map.metadataNeedsAttention') || 'Some location metadata could not be resolved automatically.';
    }
    if (activeDraftMetadata.summaryStatus === 'error') {
      return t('map.metadataResolveFailed') || 'Location metadata refresh failed. You can retry or continue manually.';
    }
    return null;
  }, [activeDraftMetadata, t]);

  const mapContent = (
    <>
      {showSearch && (
        <LocationSearch
          onLocationSelect={handleLocationSearchSelect}
          disabled={disabled}
          showCurrentLocation={true}
          showRecentSearches={true}
        />
      )}
      <div
        className="space-y-2"
        data-testid="map-capability-status"
      >
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {isOnline ? statusText : (t('map.offlineSearchRestricted') || 'Offline mode: online search disabled')}
        </div>
        {fallbackText && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            {fallbackText}
          </div>
        )}
        {activeDraftMetadata && draftMetadataStatusText && (
          <div
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            data-testid="map-draft-metadata-status"
          >
            <p>{draftMetadataStatusText}</p>
            {activeDraftMetadata.issues.map((issue) => (
              <p key={`${issue.field}-${issue.reason}`} className="mt-1">
                {issue.message}
              </p>
            ))}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MapHealthMonitor compact />
              {onRetryMetadata && (
                <Button type="button" size="sm" variant="outline" onClick={onRetryMetadata}>
                  {t('common.retry') || 'Retry'}
                </Button>
              )}
              {onOpenProviderSettings && (
                <Button type="button" size="sm" variant="outline" onClick={onOpenProviderSettings}>
                  {t('map.providerSettings') || 'Map Settings'}
                </Button>
              )}
            </div>
          </div>
        )}
        {commitMode === 'staged' && hasPendingChanges && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {t('map.stagedChangesPending') || 'Location changes are staged. Apply to commit.'}
          </div>
        )}
      </div>
      <div
        className={cn('relative border rounded-lg overflow-hidden bg-muted')}
        style={{ height: typeof height === 'number' ? `${mapHeight}px` : height }}
      >
        <LeafletMap
          center={currentLocation}
          zoom={zoom}
          onLocationChange={handleMapLocationChange}
          onClick={handleMapClick}
          onZoomChange={setZoom}
          onTileLayerFallback={handleTileLayerFallback}
          height={mapHeight}
          tileLayer={tileLayer}
          disabled={disabled}
          showMarker={true}
          draggableMarker={!disabled}
          showLightPollution={showLightPollution}
        />
      </div>
      {!compact && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('map.latitude') || 'Latitude'}</Label>
            <Input
              ref={latInputRef}
              type="number"
              step="any"
              min="-90"
              max="90"
              defaultValue={currentLocation.latitude}
              onBlur={commitCoordinateInput}
              onKeyDown={handleCoordinateKeyDown}
              disabled={disabled}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('map.longitude') || 'Longitude'}</Label>
            <Input
              ref={lngInputRef}
              type="number"
              step="any"
              min="-180"
              max="180"
              defaultValue={currentLocation.longitude}
              onBlur={commitCoordinateInput}
              onKeyDown={handleCoordinateKeyDown}
              disabled={disabled}
              className="font-mono text-sm"
            />
          </div>
        </div>
      )}
      {commitMode === 'staged' && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={discardDraftLocation}
            disabled={!hasPendingChanges || disabled}
            data-testid="map-discard-selection"
          >
            {t('map.discardSelection') || 'Discard'}
          </Button>
          <Button
            type="button"
            size={compact ? 'sm' : 'default'}
            onClick={applyDraftLocation}
            disabled={!hasPendingChanges || disabled}
            data-testid="map-apply-selection"
          >
            {t('map.applySelection') || 'Apply'}
          </Button>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <div className={cn('w-full space-y-3', className)}>
        {showControls && (
          <div className="flex justify-end gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={showLightPollution}
                  onPressedChange={setShowLightPollution}
                  aria-label={t('map.lightPollution') || 'Light Pollution'}
                  className="h-7 w-7"
                >
                  <Sun className="h-3.5 w-3.5" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {t('map.lightPollution') || 'Light Pollution'}
              </TooltipContent>
            </Tooltip>
            <TileLayerDropdown
              options={tileLayerOptions}
              current={tileLayer}
              onChange={handleTileLayerChange}
              unavailableLayers={unavailableLayers}
              unavailableLabel={t('map.layerUnavailableShort') || 'Unavailable'}
              size="sm"
            />
          </div>
        )}
        {mapContent}
      </div>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('map.locationPicker') || 'Location Picker'}
          </CardTitle>
          {showControls && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={showLightPollution}
                    onPressedChange={setShowLightPollution}
                    aria-label={t('map.lightPollution') || 'Light Pollution'}
                    className="h-8 w-8"
                  >
                    <Sun className="h-4 w-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>
                  {t('map.lightPollution') || 'Light Pollution'}
                </TooltipContent>
              </Tooltip>
              <TileLayerDropdown
                options={tileLayerOptions}
                current={tileLayer}
                onChange={handleTileLayerChange}
                unavailableLayers={unavailableLayers}
                unavailableLabel={t('map.layerUnavailableShort') || 'Unavailable'}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mapContent}
      </CardContent>
    </Card>
  );
}

export const MapLocationPicker = memo(MapLocationPickerComponent);
