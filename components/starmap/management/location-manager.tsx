'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import {
  MapPin,
  Plus,
  Trash2,
  Star,
  Loader2,
  Navigation,
  Check,
  Map,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useLocations, tauriApi } from '@/lib/tauri';
import { MapLocationPicker, MapProviderSettings } from '@/components/starmap/map';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { findPotentialDuplicateLocation, validateLocationForm } from '@/lib/core/management-validators';
import { buildContinuityActions, useMapInteractionStore } from '@/lib/stores/map-interaction-store';
import { useWebLocationStore } from '@/lib/stores/web-location-store';
import { useShallow } from 'zustand/react/shallow';
import { acquireCurrentLocation } from '@/lib/services/location-acquisition';
import {
  createPendingLocationDraftMetadata,
  LocationDraftMetadataResolver,
  type LocationDraftFieldSource,
  type LocationDraftFieldStatus,
  type LocationDraftMetadataState,
  type ResolveLocationDraftMetadataInput,
} from '@/lib/services/location-draft-metadata';
import { syncObservationLocationToMountProfile } from '@/lib/services/observation-location-controller';
import type { LocationManagerProps } from '@/types/starmap/management';

interface LocationLike {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
  is_current?: boolean;
  is_default?: boolean;
}

interface FieldTouchState {
  name: boolean;
  altitude: boolean;
  timezone: boolean;
  notes: boolean;
}

interface LocationPayload {
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  timezone?: string;
  notes?: string;
  bortle_class?: number;
}

interface DuplicateLocationState {
  candidateId: string;
  candidateName: string;
  payload: LocationPayload;
}

type DraftTrackedField = 'name' | 'altitude' | 'timezone' | 'notes' | 'bortle_class';

interface DraftFieldMeta {
  source: LocationDraftFieldSource;
  status: LocationDraftFieldStatus;
  message?: string;
}

interface DraftFieldMetaState {
  name: DraftFieldMeta;
  altitude: DraftFieldMeta;
  timezone: DraftFieldMeta;
  notes: DraftFieldMeta;
  bortle_class: DraftFieldMeta;
}

function createDraftFieldMeta(
  source: LocationDraftFieldSource = 'unresolved',
  status: LocationDraftFieldStatus = 'idle',
  message?: string
): DraftFieldMeta {
  return { source, status, message };
}

function createEmptyDraftFieldMetaState(): DraftFieldMetaState {
  return {
    name: createDraftFieldMeta(),
    altitude: createDraftFieldMeta(),
    timezone: createDraftFieldMeta(),
    notes: createDraftFieldMeta(),
    bortle_class: createDraftFieldMeta(),
  };
}

function createDraftFieldMetaStateFromLocation(location: LocationLike): DraftFieldMetaState {
  return {
    name: createDraftFieldMeta(location.name ? 'persisted' : 'unresolved', location.name ? 'ready' : 'idle'),
    altitude: createDraftFieldMeta(Number.isFinite(location.altitude) ? 'persisted' : 'unresolved', 'ready'),
    timezone: createDraftFieldMeta(location.timezone ? 'persisted' : 'unresolved', location.timezone ? 'ready' : 'idle'),
    notes: createDraftFieldMeta(location.notes ? 'persisted' : 'unresolved', location.notes ? 'ready' : 'idle'),
    bortle_class: createDraftFieldMeta(location.bortle_class ? 'persisted' : 'unresolved', location.bortle_class ? 'ready' : 'idle'),
  };
}

function createLoadingDraftFieldMeta(previous: DraftFieldMeta, touched: boolean): DraftFieldMeta {
  if (touched) {
    return previous;
  }

  return createDraftFieldMeta('unresolved', 'loading');
}

function pickDeterministicCurrent<T extends LocationLike>(
  locations: T[],
  preferredId?: string
): T | null {
  if (!locations.length) return null;
  if (preferredId) {
    const preferred = locations.find((loc) => loc.id === preferredId);
    if (preferred) return preferred;
  }
  return (
    locations.find((loc) => loc.is_current)
    ?? locations.find((loc) => loc.is_default)
    ?? locations[0]
  );
}

function pickDeterministicDefault<T extends LocationLike>(
  locations: T[],
  preferredId?: string
): T | null {
  if (!locations.length) return null;
  if (preferredId) {
    const preferred = locations.find((loc) => loc.id === preferredId);
    if (preferred) return preferred;
  }
  return locations.find((loc) => loc.is_default) ?? locations[0];
}

function sortLocationsForDisplay<T extends LocationLike>(locations: T[]): T[] {
  return [...locations].sort((a, b) => {
    if (!!a.is_current !== !!b.is_current) {
      return a.is_current ? -1 : 1;
    }
    if (!!a.is_default !== !!b.is_default) {
      return a.is_default ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function BortleClassSelect({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (key: string) => string }) {
  return (
    <div>
      <Label>{t('locations.bortleClass') || 'Bortle Class'}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={t('locations.bortlePlaceholder') || 'Select...'} />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
            <SelectItem key={b} value={b.toString()}>
              {b} - {t(`locations.bortle${b}`) || `Class ${b}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function LocationManager({ trigger, onLocationChange }: LocationManagerProps) {
  const t = useTranslations();
  const { locations, currentLocation, loading, refresh, setCurrent, isAvailable: isTauriAvailable } = useLocations();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputMethod, setInputMethod] = useState<'manual' | 'map'>('manual');
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<DuplicateLocationState | null>(null);
  
  // Hydration-safe mounting detection using useSyncExternalStore
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  
  // Web locations from Zustand persist store (replaces raw localStorage)
  const webLocations = useWebLocationStore(useShallow((s) => s.locations));
  const {
    addLocation: addWebLocation,
    updateLocation: updateWebLocation,
    removeLocation: removeWebLocation,
    setCurrent: setWebCurrent,
    setDefault: setWebDefault,
  } = useWebLocationStore.getState();

  // Form state
  const [form, setForm] = useState({
    name: '',
    latitude: '',
    longitude: '',
    altitude: '',
    timezone: '',
    notes: '',
    bortle_class: '',
  });
  const [fieldTouched, setFieldTouched] = useState<FieldTouchState>({
    name: false,
    altitude: false,
    timezone: false,
    notes: false,
  });
  const fieldTouchedRef = useRef(fieldTouched);
  const draftMetadataResolverRef = useRef(new LocationDraftMetadataResolver());
  const lastDraftSelectionRef = useRef<ResolveLocationDraftMetadataInput | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<LocationDraftMetadataState | null>(null);
  const [draftFieldMeta, setDraftFieldMeta] = useState<DraftFieldMetaState>(createEmptyDraftFieldMetaState());
  const setSiteContext = useMapInteractionStore((state) => state.setSiteContext);
  const clearSiteContext = useMapInteractionStore((state) => state.clearSiteContext);

  useEffect(() => {
    fieldTouchedRef.current = fieldTouched;
  }, [fieldTouched]);

  const normalizedWebCurrent = pickDeterministicCurrent(webLocations);

  // Determine which data source to use
  const locationList = useMemo<LocationLike[]>(
    () => (isTauriAvailable ? (locations?.locations ?? []) : webLocations),
    [isTauriAvailable, locations?.locations, webLocations]
  );
  const activeLocation = isTauriAvailable ? currentLocation : normalizedWebCurrent;
  const filteredAndSortedLocations = useMemo(() => {
    const sorted = sortLocationsForDisplay(locationList);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sorted;

    return sorted.filter((loc) => {
      const name = loc.name.toLowerCase();
      const timezone = loc.timezone?.toLowerCase() ?? '';
      const notes = loc.notes?.toLowerCase() ?? '';
      return name.includes(query) || timezone.includes(query) || notes.includes(query);
    });
  }, [locationList, searchQuery]);

  useEffect(() => {
    if (isTauriAvailable || webLocations.length === 0) return;

    const currentCount = webLocations.filter((loc) => loc.is_current).length;
    const defaultCount = webLocations.filter((loc) => loc.is_default).length;
    const preferredCurrent = pickDeterministicCurrent(webLocations);
    const preferredDefault = pickDeterministicDefault(webLocations);

    if (preferredCurrent && (currentCount !== 1 || !preferredCurrent.is_current)) {
      setWebCurrent(preferredCurrent.id);
    }
    if (preferredDefault && (defaultCount !== 1 || !preferredDefault.is_default)) {
      setWebDefault(preferredDefault.id);
    }
  }, [isTauriAvailable, setWebCurrent, setWebDefault, webLocations]);

  if (!mounted) {
    return null;
  }

  // Validate location form
  const validateLocation = (): string | null => {
    const errorKey = validateLocationForm(form);
    return errorKey ? (t(errorKey) || errorKey) : null;
  };

  // Start editing a location
  const handleStartEdit = (loc: LocationLike) => {
    setForm({
      name: loc.name,
      latitude: loc.latitude.toString(),
      longitude: loc.longitude.toString(),
      altitude: loc.altitude.toString(),
      timezone: loc.timezone || '',
      notes: loc.notes || '',
      bortle_class: loc.bortle_class?.toString() || '',
    });
    setFieldTouched({ name: false, altitude: false, timezone: false, notes: false });
    setDraftFieldMeta(createDraftFieldMetaStateFromLocation(loc));
    setDraftMetadata(null);
    lastDraftSelectionRef.current = {
      coordinates: {
        latitude: loc.latitude,
        longitude: loc.longitude,
      },
      source: 'existing-record',
    };
    setEditingId(loc.id);
    setAdding(true);
    setInputMethod('manual');
  };

  const setDraftFieldManual = (field: DraftTrackedField) => {
    setDraftFieldMeta(prev => ({
      ...prev,
      [field]: createDraftFieldMeta('manual', 'ready'),
    }));
  };

  const applyResolvedDraftMetadata = (
    result: LocationDraftMetadataState,
    options: {
      fallbackName?: string;
      fallbackElevation?: number | null;
    } = {}
  ) => {
    const { fallbackName, fallbackElevation } = options;
    const hasDerivedName = result.fields.name.status === 'ready' && !!result.fields.name.value;
    const effectiveName = hasDerivedName ? result.fields.name.value : (fallbackName || null);
    const effectiveNameMeta = effectiveName
      ? createDraftFieldMeta('derived', 'ready')
      : createDraftFieldMeta('unresolved', 'error', result.fields.name.message);
    const effectiveAltitude = result.fields.elevation.status === 'ready'
      ? result.fields.elevation.value
      : fallbackElevation;
    const effectiveAltitudeMeta = typeof effectiveAltitude === 'number'
      ? createDraftFieldMeta('derived', 'ready')
      : createDraftFieldMeta('unresolved', 'error', result.fields.elevation.message);

    setDraftMetadata({
      ...result,
      displayName: effectiveName ?? result.displayName,
    });
    setDraftFieldMeta(prev => ({
      ...prev,
      name: fieldTouchedRef.current.name ? prev.name : effectiveNameMeta,
      timezone: fieldTouchedRef.current.timezone
        ? prev.timezone
        : (
          result.fields.timezone.status === 'ready'
            ? createDraftFieldMeta('derived', 'ready')
            : createDraftFieldMeta('unresolved', 'error', result.fields.timezone.message)
        ),
      altitude: fieldTouchedRef.current.altitude ? prev.altitude : effectiveAltitudeMeta,
    }));
    setForm(prev => ({
      ...prev,
      latitude: result.coordinates.latitude.toFixed(6),
      longitude: result.coordinates.longitude.toFixed(6),
      name: fieldTouchedRef.current.name
        ? prev.name
        : (effectiveName ?? prev.name),
      timezone: fieldTouchedRef.current.timezone
        ? prev.timezone
        : (result.fields.timezone.status === 'ready' && result.fields.timezone.value
          ? result.fields.timezone.value
          : prev.timezone),
      altitude: fieldTouchedRef.current.altitude
        ? prev.altitude
        : (typeof effectiveAltitude === 'number'
          ? Math.round(effectiveAltitude).toString()
          : prev.altitude),
    }));

    setSiteContext({
      kind: 'draft',
      sourceSurface: 'location-manager',
      coordinates: result.coordinates,
      summaryStatus: result.summaryStatus,
      displayName: effectiveName ?? result.displayName ?? undefined,
      issues: result.issues.map((issue) => issue.message),
      actions: buildContinuityActions({
        sourceSurface: 'location-manager',
        hasDraftSite: true,
        hasRecoverableMetadata: result.summaryStatus === 'partial' || result.summaryStatus === 'error',
        hasTarget: false,
        arStatus: 'idle',
      }),
    });
  };

  const resolveDraftSelection = async (
    input: ResolveLocationDraftMetadataInput,
    options: {
      fallbackName?: string;
      fallbackElevation?: number | null;
    } = {}
  ) => {
    lastDraftSelectionRef.current = input;
    setForm(prev => ({
      ...prev,
      latitude: input.coordinates.latitude.toFixed(6),
      longitude: input.coordinates.longitude.toFixed(6),
    }));
    setDraftMetadata(createPendingLocationDraftMetadata(input));
    setDraftFieldMeta(prev => ({
      ...prev,
      name: createLoadingDraftFieldMeta(prev.name, fieldTouchedRef.current.name),
      timezone: createLoadingDraftFieldMeta(prev.timezone, fieldTouchedRef.current.timezone),
      altitude: createLoadingDraftFieldMeta(prev.altitude, fieldTouchedRef.current.altitude),
    }));

    setSiteContext({
      kind: 'draft',
      sourceSurface: 'location-manager',
      coordinates: input.coordinates,
      summaryStatus: 'loading',
      actions: buildContinuityActions({
        sourceSurface: 'location-manager',
        hasDraftSite: true,
        hasRecoverableMetadata: false,
        hasTarget: false,
        arStatus: 'idle',
      }),
    });

    const result = await draftMetadataResolverRef.current.resolve(input);
    if (result.stale) {
      return;
    }

    applyResolvedDraftMetadata(result, options);
  };

  const retryDraftMetadata = async () => {
    if (!lastDraftSelectionRef.current) {
      return;
    }

    await resolveDraftSelection(lastDraftSelectionRef.current);
  };

  const toLocationPayload = (): LocationPayload => ({
    name: form.name.trim(),
    latitude: parseFloat(form.latitude),
    longitude: parseFloat(form.longitude),
    altitude: parseFloat(form.altitude) || 0,
    timezone: form.timezone.trim() || undefined,
    notes: form.notes.trim() || undefined,
    bortle_class: form.bortle_class ? parseInt(form.bortle_class) : undefined,
  });

  const commitLocation = async (
    payload: LocationPayload,
    targetId?: string
  ): Promise<void> => {
    if (isTauriAvailable) {
      if (targetId) {
        const existing = locations?.locations.find((loc) => loc.id === targetId);
        if (!existing) return;

        await tauriApi.locations.update({
          ...existing,
          ...payload,
        });

        if (existing.is_current) {
          syncObservationLocationToMountProfile(payload);
        }
        if (existing.is_current && onLocationChange) {
          onLocationChange(payload.latitude, payload.longitude, payload.altitude);
        }
        toast.success(t('locations.updated') || 'Location updated');
      } else {
        await tauriApi.locations.add({
          ...payload,
          is_default: !locations?.locations.length,
          is_current: !locations?.locations.length,
        });
        toast.success(t('locations.added') || 'Location added');
        if (!locations?.locations.length && onLocationChange) {
          onLocationChange(payload.latitude, payload.longitude, payload.altitude);
        }
        if (!locations?.locations.length) {
          syncObservationLocationToMountProfile(payload);
        }
      }

      await refresh();
      return;
    }

    if (targetId) {
      updateWebLocation(targetId, payload);
      const existing = webLocations.find((loc) => loc.id === targetId);
      if (existing?.is_current) {
        syncObservationLocationToMountProfile(payload);
      }
      if (existing?.is_current && onLocationChange) {
        onLocationChange(payload.latitude, payload.longitude, payload.altitude);
      }
      toast.success(t('locations.updated') || 'Location updated');
      return;
    }

    const isFirst = webLocations.length === 0;
    addWebLocation({
      ...payload,
      is_default: isFirst,
      is_current: isFirst,
    });
    toast.success(t('locations.added') || 'Location added');
    if (isFirst) {
      syncObservationLocationToMountProfile(payload);
    }
    if (isFirst && onLocationChange) {
      onLocationChange(payload.latitude, payload.longitude, payload.altitude);
    }
  };

  const afterSave = () => {
    resetForm();
    setAdding(false);
    setEditingId(null);
    setDuplicateTarget(null);
  };

  const handleAdd = async () => {
    const validationError = validateLocation();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const payload = toLocationPayload();
    if (!editingId) {
      const duplicate = findPotentialDuplicateLocation(
        locationList,
        payload.name,
        payload.latitude,
        payload.longitude
      );
      if (duplicate) {
        setDuplicateTarget({
          candidateId: duplicate.id,
          candidateName: duplicate.name,
          payload,
        });
        return;
      }
    }

    try {
      await commitLocation(payload, editingId ?? undefined);
      afterSave();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDuplicateUpdate = async () => {
    if (!duplicateTarget) return;
    try {
      await commitLocation(duplicateTarget.payload, duplicateTarget.candidateId);
      afterSave();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDuplicateKeepBoth = async () => {
    if (!duplicateTarget) return;
    try {
      await commitLocation(duplicateTarget.payload);
      afterSave();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (isTauriAvailable) {
      try {
        const removedWasCurrent = (locations?.locations ?? []).some(loc => loc.id === id && loc.is_current);
        const nextLocations = await tauriApi.locations.delete(id);
        const nextCurrent = pickDeterministicCurrent(nextLocations.locations, nextLocations.current_location_id);

        if (nextCurrent && onLocationChange && removedWasCurrent) {
          onLocationChange(nextCurrent.latitude, nextCurrent.longitude, nextCurrent.altitude);
        }
        if (nextCurrent && removedWasCurrent) {
          syncObservationLocationToMountProfile(nextCurrent);
        }
        toast.success(t('locations.deleted') || 'Location deleted');
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else {
      const removedWasCurrent = webLocations.some(loc => loc.id === id && loc.is_current);

      removeWebLocation(id);
      const remaining = useWebLocationStore.getState().locations;
      const nextCurrent = pickDeterministicCurrent(remaining);

      if (nextCurrent && onLocationChange && removedWasCurrent) {
        onLocationChange(nextCurrent.latitude, nextCurrent.longitude, nextCurrent.altitude);
      }
      if (nextCurrent && removedWasCurrent) {
        syncObservationLocationToMountProfile(nextCurrent);
      }

      toast.success(t('locations.deleted') || 'Location deleted');
    }
  };

  const handleSetCurrent = async (id: string) => {
    if (isTauriAvailable) {
      try {
        await setCurrent(id);
        const loc = locations?.locations.find(l => l.id === id);
        if (loc && onLocationChange) {
          onLocationChange(loc.latitude, loc.longitude, loc.altitude);
        }
        if (loc) {
          syncObservationLocationToMountProfile(loc);
        }
        toast.success(t('locations.setCurrent') || 'Location set as current');
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else {
      setWebCurrent(id);
      const loc = webLocations.find(l => l.id === id);
      if (loc && onLocationChange) {
        onLocationChange(loc.latitude, loc.longitude, loc.altitude);
      }
      if (loc) {
        syncObservationLocationToMountProfile(loc);
      }
      toast.success(t('locations.setCurrent') || 'Location set as current');
    }
  };

  const handleSetDefault = async (id: string) => {
    if (isTauriAvailable) {
      try {
        await tauriApi.locations.setDefault(id);
        toast.success(t('locations.setDefault') || 'Location set as default');
        await refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else {
      setWebDefault(id);
      toast.success(t('locations.setDefault') || 'Location set as default');
    }
  };

  const handleUseGPS = async () => {
    const result = await acquireCurrentLocation({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    if (result.status !== 'success') {
      switch (result.status) {
        case 'permission_denied':
          toast.error(t('locations.locationPermissionDenied') || 'Location permission denied');
          break;
        case 'unavailable':
          toast.error(t('locations.locationUnavailable') || 'Location service unavailable');
          break;
        case 'timeout':
          toast.error(t('locations.locationTimedOut') || 'Location request timed out');
          break;
        case 'failed':
        default:
          toast.error(t('locations.locationFailed') || result.message || 'Failed to get current location');
          break;
      }
      return;
    }

    const { latitude, longitude, altitude } = result.location;
    await resolveDraftSelection(
      {
        coordinates: { latitude, longitude },
        source: 'gps',
      },
      {
        fallbackElevation: altitude,
      }
    );

    toast.success(t('locations.gpsAcquired') || 'GPS location acquired');
  };

  const handleMapLocationSelect = async (location: {
    coordinates: { latitude: number; longitude: number };
    address?: string;
    displayName?: string;
  }) => {
    const suggestedName = location.displayName
      || location.address
      || `Location ${location.coordinates.latitude.toFixed(4)}, ${location.coordinates.longitude.toFixed(4)}`;

    await resolveDraftSelection(
      {
        coordinates: location.coordinates,
        source: location.displayName || location.address ? 'search' : 'map-click',
      },
      {
        fallbackName: suggestedName,
      }
    );
  };

  const resetForm = () => {
    draftMetadataResolverRef.current.invalidatePending();
    setForm({
      name: '',
      latitude: '',
      longitude: '',
      altitude: '',
      timezone: '',
      notes: '',
      bortle_class: '',
    });
    setFieldTouched({ name: false, altitude: false, timezone: false, notes: false });
    setDraftFieldMeta(createEmptyDraftFieldMetaState());
    setDraftMetadata(null);
    lastDraftSelectionRef.current = null;
    setInputMethod('manual');
    setEditingId(null);
    setDuplicateTarget(null);
    clearSiteContext();
  };

  const getDraftMetaLabel = (meta: DraftFieldMeta): string => {
    if (meta.status === 'loading') {
      return t('locations.metadataLoading') || 'Refreshing...';
    }

    switch (meta.source) {
      case 'manual':
        return t('locations.metadataManual') || 'Manual';
      case 'derived':
        return t('locations.metadataDerived') || 'Derived';
      case 'persisted':
        return t('locations.metadataPersisted') || 'Saved';
      case 'unresolved':
      default:
        return t('locations.metadataUnresolved') || 'Unresolved';
    }
  };

  const hasRetryableDraftMetadata = draftMetadata?.summaryStatus === 'partial'
    || draftMetadata?.summaryStatus === 'error';
  const pickerDraftMetadataState = draftMetadata
    && draftMetadata.summaryStatus !== 'idle'
    ? {
      coordinates: draftMetadata.coordinates,
      summaryStatus: draftMetadata.summaryStatus,
      issues: draftMetadata.issues,
    }
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MapPin className="h-4 w-4 mr-2" />
            {activeLocation?.name || t('locations.title') || 'Location'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {t('locations.title') || 'Observation Locations'}
          </DialogTitle>
          <DialogDescription>
            {t('locations.description') || 'Manage your observation sites'}
          </DialogDescription>
        </DialogHeader>

        {isTauriAvailable && loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
            <div>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('locations.searchPlaceholder') || 'Search locations...'}
              />
            </div>
            <ScrollArea className="max-h-40">
              {locationList.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  message={t('locations.noLocations') || 'No locations added'}
                  iconClassName="h-10 w-10 mb-3"
                />
              ) : filteredAndSortedLocations.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  message={t('locations.noSearchResults') || 'No locations match your search'}
                  iconClassName="h-10 w-10 mb-3"
                />
              ) : (
                <div className="space-y-2">
                  {filteredAndSortedLocations.map((loc) => (
                    <div 
                      key={loc.id} 
                      data-testid={`location-row-${loc.id}`}
                      className={cn(
                        'flex items-center justify-between p-2 border rounded',
                        loc.is_current && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{loc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {loc.latitude.toFixed(4)}°, {loc.longitude.toFixed(4)}°
                            {loc.timezone && ` • ${loc.timezone}`}
                            {loc.bortle_class && ` • Bortle ${loc.bortle_class}`}
                          </p>
                        </div>
                        {loc.is_default && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                        {loc.is_current && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                      </div>
                      <div className="flex gap-1">
                        {!loc.is_current && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                data-testid={`set-current-${loc.id}`}
                                onClick={() => handleSetCurrent(loc.id)}
                              >
                                <Navigation className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('locations.setAsCurrent') || 'Set as current'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!loc.is_default && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`set-default-${loc.id}`}
                                onClick={() => handleSetDefault(loc.id)}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t('locations.setAsDefault') || 'Set as default'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`edit-location-${loc.id}`} onClick={() => handleStartEdit(loc)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('common.edit') || 'Edit'}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`delete-location-${loc.id}`} onClick={() => setDeleteTarget({ id: loc.id, name: loc.name })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('common.delete') || 'Delete'}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {adding ? (
              <div className="space-y-3 border rounded p-3">
                <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'manual' | 'map')} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center gap-2">
                      <Navigation className="h-4 w-4" />
                      {t('locations.manualInput') || 'Manual Input'}
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex items-center gap-2">
                      <Map className="h-4 w-4" />
                      {t('locations.mapSelection') || 'Map Selection'}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manual" className="space-y-3 mt-3">
                    <div>
                      <Label>{t('locations.name') || 'Name'}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => {
                          setFieldTouched(prev => ({ ...prev, name: true }));
                          setDraftFieldManual('name');
                          setForm(prev => ({ ...prev, name: e.target.value }));
                        }}
                        placeholder={t('locations.namePlaceholder') || 'e.g. Backyard, Dark Site'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>{t('locations.latitude') || 'Latitude'}</Label>
                        <Input
                          type="number"
                          step="any"
                          value={form.latitude}
                          onChange={(e) => setForm(prev => ({ ...prev, latitude: e.target.value }))}
                          placeholder="39.9042"
                        />
                      </div>
                      <div>
                        <Label>{t('locations.longitude') || 'Longitude'}</Label>
                        <Input
                          type="number"
                          step="any"
                          value={form.longitude}
                          onChange={(e) => setForm(prev => ({ ...prev, longitude: e.target.value }))}
                          placeholder="116.4074"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>{t('locations.altitude') || 'Altitude (m)'}</Label>
                        <Input
                          type="number"
                          value={form.altitude}
                          onChange={(e) => {
                            setFieldTouched(prev => ({ ...prev, altitude: true }));
                            setDraftFieldManual('altitude');
                            setForm(prev => ({ ...prev, altitude: e.target.value }));
                          }}
                          placeholder="100"
                        />
                      </div>
                      <BortleClassSelect
                        value={form.bortle_class}
                        onChange={(v) => {
                          setDraftFieldManual('bortle_class');
                          setForm(prev => ({ ...prev, bortle_class: v }));
                        }}
                        t={t}
                      />
                    </div>
                    <div>
                      <Label>{t('locations.timezone') || 'Timezone'}</Label>
                      <Input
                        value={form.timezone}
                        onChange={(e) => {
                          setFieldTouched(prev => ({ ...prev, timezone: true }));
                          setDraftFieldManual('timezone');
                          setForm(prev => ({ ...prev, timezone: e.target.value }));
                        }}
                        placeholder={t('locations.timezonePlaceholder') || 'e.g. Asia/Shanghai'}
                      />
                    </div>
                    <div>
                      <Label>{t('locations.notes') || 'Notes'}</Label>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => {
                          setFieldTouched(prev => ({ ...prev, notes: true }));
                          setDraftFieldManual('notes');
                          setForm(prev => ({ ...prev, notes: e.target.value }));
                        }}
                        placeholder={t('locations.notesPlaceholder') || 'Optional notes for this observing site'}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUseGPS}>
                        <Navigation className="h-4 w-4 mr-1" />
                        {t('locations.useGPS') || 'Use GPS'}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="map" className="mt-3">
                    <div className="space-y-3">
                      <div>
                        <Label>{t('locations.name') || 'Name'}</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => {
                          setFieldTouched(prev => ({ ...prev, name: true }));
                          setDraftFieldManual('name');
                          setForm(prev => ({ ...prev, name: e.target.value }));
                        }}
                          placeholder={t('locations.namePlaceholder') || 'e.g. Backyard, Dark Site'}
                        />
                      </div>
                      
                      <MapLocationPicker
                        initialLocation={{
                          latitude: parseFloat(form.latitude) || 39.9042,
                          longitude: parseFloat(form.longitude) || 116.4074,
                        }}
                        onLocationChange={(coords: { latitude: number; longitude: number }) => {
                          void resolveDraftSelection({
                            coordinates: coords,
                            source: 'map-click',
                          });
                        }}
                        onLocationSelect={handleMapLocationSelect}
                        height={220}
                        showSearch={true}
                        showControls={true}
                        commitMode="staged"
                        compact
                        draftMetadataState={pickerDraftMetadataState}
                        onRetryMetadata={() => void retryDraftMetadata()}
                        onOpenProviderSettings={() => setMapSettingsOpen(true)}
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>{t('locations.altitude') || 'Altitude (m)'}</Label>
                        <Input
                          type="number"
                          value={form.altitude}
                          onChange={(e) => {
                            setFieldTouched(prev => ({ ...prev, altitude: true }));
                            setDraftFieldManual('altitude');
                            setForm(prev => ({ ...prev, altitude: e.target.value }));
                          }}
                          placeholder="100"
                        />
                        </div>
                        <BortleClassSelect
                          value={form.bortle_class}
                          onChange={(v) => {
                            setDraftFieldManual('bortle_class');
                            setForm(prev => ({ ...prev, bortle_class: v }));
                          }}
                          t={t}
                        />
                      </div>
                      <div>
                        <Label>{t('locations.timezone') || 'Timezone'}</Label>
                        <Input
                          value={form.timezone}
                          onChange={(e) => {
                            setFieldTouched(prev => ({ ...prev, timezone: true }));
                            setDraftFieldManual('timezone');
                            setForm(prev => ({ ...prev, timezone: e.target.value }));
                          }}
                          placeholder={t('locations.timezonePlaceholder') || 'e.g. Asia/Shanghai'}
                        />
                      </div>
                      <div>
                        <Label>{t('locations.notes') || 'Notes'}</Label>
                        <Textarea
                          value={form.notes}
                          onChange={(e) => {
                            setFieldTouched(prev => ({ ...prev, notes: true }));
                            setDraftFieldManual('notes');
                            setForm(prev => ({ ...prev, notes: e.target.value }));
                          }}
                          placeholder={t('locations.notesPlaceholder') || 'Optional notes for this observing site'}
                          rows={3}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="rounded-md border bg-muted/30 p-3 space-y-2" data-testid="location-draft-metadata">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium">
                      {t('locations.metadataStatusTitle') || 'Draft metadata'}
                    </p>
                    {hasRetryableDraftMetadata && (
                      <Button size="sm" variant="outline" onClick={() => void retryDraftMetadata()}>
                        {t('common.retry') || 'Retry'}
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('locations.name') || 'Name'}</span>
                      <span>{getDraftMetaLabel(draftFieldMeta.name)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('locations.timezone') || 'Timezone'}</span>
                      <span>{getDraftMetaLabel(draftFieldMeta.timezone)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('locations.altitude') || 'Altitude (m)'}</span>
                      <span>{getDraftMetaLabel(draftFieldMeta.altitude)}</span>
                    </div>
                  </div>
                  {draftMetadata?.issues.length ? (
                    <div className="space-y-1">
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('locations.metadataNeedsAttention') || 'Some metadata could not be resolved. Review or enter it manually.'}
                      </p>
                      {draftMetadata.issues.map((issue) => (
                        <p key={`${issue.field}-${issue.reason}`} className="text-[11px] text-muted-foreground">
                          {issue.message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 pt-3 border-t">
                  <Button size="sm" onClick={handleAdd}>
                    {editingId ? (t('common.update') || 'Update') : (t('common.save') || 'Save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setAdding(false);
                    resetForm();
                  }}>
                    {t('common.cancel') || 'Cancel'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('locations.addLocation') || 'Add Location'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('locations.deleteConfirmTitle') || 'Delete Location?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('locations.deleteConfirmDescription', { name: deleteTarget?.name ?? '' }) ||
                `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  handleDelete(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {t('common.delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Location Confirmation Dialog */}
      <AlertDialog open={!!duplicateTarget} onOpenChange={(isOpen) => !isOpen && setDuplicateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('locations.duplicateTitle') || 'Possible duplicate location'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('locations.duplicateDescription', { name: duplicateTarget?.candidateName ?? '' })
                || `A similar location "${duplicateTarget?.candidateName}" already exists. Update it or keep both?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <Button size="sm" variant="outline" onClick={handleDuplicateKeepBoth}>
              {t('locations.keepBoth') || 'Keep both'}
            </Button>
            <AlertDialogAction onClick={handleDuplicateUpdate}>
              {t('locations.updateExisting') || 'Update existing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MapProviderSettings
        open={mapSettingsOpen}
        onOpenChange={setMapSettingsOpen}
        trigger={<button type="button" className="hidden" aria-hidden="true" tabIndex={-1} />}
      />
    </Dialog>
  );
}
