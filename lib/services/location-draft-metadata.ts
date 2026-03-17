import { geocodingService } from '@/lib/services/geocoding-service';
import type { Coordinates, ReverseGeocodingResult } from '@/lib/services/map-providers/base-map-provider';
import { fetchElevation } from '@/lib/utils/map-utils';
import { resolveTimezoneFromCoordinates } from '@/lib/utils/observer-timezone';

export type DraftCoordinateSource =
  | 'map-click'
  | 'search'
  | 'gps'
  | 'manual-input'
  | 'existing-record';

export type LocationDraftFieldStatus = 'idle' | 'loading' | 'ready' | 'error';
export type LocationDraftFieldSource = 'manual' | 'derived' | 'persisted' | 'unresolved';
export type LocationDraftSummaryStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'error' | 'stale';

export type LocationDraftMetadataFieldName = 'name' | 'timezone' | 'elevation';

export interface LocationDraftMetadataField<T> {
  status: LocationDraftFieldStatus;
  source: LocationDraftFieldSource;
  value: T | null;
  message?: string;
}

export interface LocationDraftMetadataIssue {
  field: LocationDraftMetadataFieldName;
  reason:
    | 'reverse_geocode_failed'
    | 'timezone_failed'
    | 'timezone_unavailable'
    | 'elevation_failed'
    | 'elevation_unavailable';
  message: string;
}

export interface LocationDraftMetadataState {
  requestId: number;
  stale: boolean;
  summaryStatus: LocationDraftSummaryStatus;
  coordinates: Coordinates;
  source: DraftCoordinateSource;
  displayName: string | null;
  address: string | null;
  fields: {
    name: LocationDraftMetadataField<string>;
    timezone: LocationDraftMetadataField<string>;
    elevation: LocationDraftMetadataField<number>;
  };
  issues: LocationDraftMetadataIssue[];
}

export interface ResolveLocationDraftMetadataInput {
  coordinates: Coordinates;
  source: DraftCoordinateSource;
}

interface LocationDraftMetadataDependencies {
  reverseGeocode: (coordinates: Coordinates) => Promise<Pick<ReverseGeocodingResult, 'displayName' | 'address'>>;
  resolveTimezone: (coordinates: Coordinates) => string | null | Promise<string | null>;
  fetchElevation: (latitude: number, longitude: number) => Promise<number | null>;
}

function createErrorField<T>(message: string): LocationDraftMetadataField<T> {
  return {
    status: 'error',
    source: 'unresolved',
    value: null,
    message,
  };
}

export function createPendingLocationDraftMetadata(
  input: ResolveLocationDraftMetadataInput,
  requestId = 0
): LocationDraftMetadataState {
  return {
    requestId,
    stale: false,
    summaryStatus: 'loading',
    coordinates: input.coordinates,
    source: input.source,
    displayName: null,
    address: null,
    fields: {
      name: { status: 'loading', source: 'unresolved', value: null },
      timezone: { status: 'loading', source: 'unresolved', value: null },
      elevation: { status: 'loading', source: 'unresolved', value: null },
    },
    issues: [],
  };
}

export class LocationDraftMetadataResolver {
  private requestId = 0;
  private readonly deps: LocationDraftMetadataDependencies;

  constructor(deps?: Partial<LocationDraftMetadataDependencies>) {
    this.deps = {
      reverseGeocode: (coordinates) => geocodingService.reverseGeocode(coordinates),
      resolveTimezone: (coordinates) => resolveTimezoneFromCoordinates(coordinates),
      fetchElevation: (latitude, longitude) => fetchElevation(latitude, longitude),
      ...deps,
    };
  }

  invalidatePending(): void {
    this.requestId += 1;
  }

  async resolve(input: ResolveLocationDraftMetadataInput): Promise<LocationDraftMetadataState> {
    const currentRequestId = ++this.requestId;

    const [reverseResult, timezoneResult, elevationResult] = await Promise.allSettled([
      this.deps.reverseGeocode(input.coordinates),
      Promise.resolve(this.deps.resolveTimezone(input.coordinates)),
      this.deps.fetchElevation(input.coordinates.latitude, input.coordinates.longitude),
    ]);

    if (currentRequestId !== this.requestId) {
      return {
        ...createPendingLocationDraftMetadata(input, currentRequestId),
        stale: true,
        summaryStatus: 'stale',
      };
    }

    const issues: LocationDraftMetadataIssue[] = [];

    const nameField: LocationDraftMetadataField<string> = reverseResult.status === 'fulfilled'
      && reverseResult.value.displayName.trim()
      ? {
        status: 'ready',
        source: 'derived',
        value: reverseResult.value.displayName,
      }
      : (() => {
        const message = reverseResult.status === 'rejected'
          ? (reverseResult.reason instanceof Error ? reverseResult.reason.message : 'Failed to reverse geocode location')
          : 'No place name available for the selected coordinates';
        issues.push({
          field: 'name',
          reason: 'reverse_geocode_failed',
          message,
        });
        return createErrorField<string>(message);
      })();

    const timezoneField: LocationDraftMetadataField<string> = timezoneResult.status === 'fulfilled'
      && timezoneResult.value
      ? {
        status: 'ready',
        source: 'derived',
        value: timezoneResult.value,
      }
      : (() => {
        const reason = timezoneResult.status === 'rejected' ? 'timezone_failed' : 'timezone_unavailable';
        const message = timezoneResult.status === 'rejected'
          ? (timezoneResult.reason instanceof Error ? timezoneResult.reason.message : 'Failed to resolve timezone')
          : 'No timezone available for the selected coordinates';
        issues.push({
          field: 'timezone',
          reason,
          message,
        });
        return createErrorField<string>(message);
      })();

    const elevationField: LocationDraftMetadataField<number> = elevationResult.status === 'fulfilled'
      && typeof elevationResult.value === 'number'
      ? {
        status: 'ready',
        source: 'derived',
        value: elevationResult.value,
      }
      : (() => {
        const reason = elevationResult.status === 'rejected' ? 'elevation_failed' : 'elevation_unavailable';
        const message = elevationResult.status === 'rejected'
          ? (elevationResult.reason instanceof Error ? elevationResult.reason.message : 'Failed to resolve elevation')
          : 'No elevation available for the selected coordinates';
        issues.push({
          field: 'elevation',
          reason,
          message,
        });
        return createErrorField<number>(message);
      })();

    const readyCount = [nameField, timezoneField, elevationField].filter(
      (field) => field.status === 'ready'
    ).length;

    const summaryStatus: LocationDraftSummaryStatus = readyCount === 3
      ? 'ready'
      : readyCount > 0
        ? 'partial'
        : 'error';

    return {
      requestId: currentRequestId,
      stale: false,
      summaryStatus,
      coordinates: input.coordinates,
      source: input.source,
      displayName: reverseResult.status === 'fulfilled' ? reverseResult.value.displayName : null,
      address: reverseResult.status === 'fulfilled' ? reverseResult.value.address : null,
      fields: {
        name: nameField,
        timezone: timezoneField,
        elevation: elevationField,
      },
      issues,
    };
  }
}
