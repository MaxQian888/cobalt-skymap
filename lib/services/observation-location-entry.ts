import { acquireCurrentLocation } from './location-acquisition';
import {
  applyCanonicalObservationLocation,
  migrateLegacyObserverLocation,
  resolveCanonicalObservationLocation,
} from './observation-location-controller';
import type { ObserverLocation } from '@/types/starmap/onboarding';

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
} as const;

export async function loadObservationStepLocation(): Promise<ObserverLocation | null> {
  await migrateLegacyObserverLocation();
  const canonicalLocation = await resolveCanonicalObservationLocation();
  if (!canonicalLocation) {
    return null;
  }

  return {
    latitude: canonicalLocation.latitude,
    longitude: canonicalLocation.longitude,
    altitude: canonicalLocation.altitude,
  };
}

export async function saveObservationStepLocation(
  location: ObserverLocation,
): Promise<ObserverLocation | null> {
  const canonicalLocation = await applyCanonicalObservationLocation({
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.altitude,
  });

  if (!canonicalLocation) {
    return null;
  }

  return {
    latitude: canonicalLocation.latitude,
    longitude: canonicalLocation.longitude,
    altitude: canonicalLocation.altitude,
  };
}

export async function detectObservationStepLocation(): Promise<{
  location?: ObserverLocation;
  errorKey?: string;
}> {
  const result = await acquireCurrentLocation(LOCATION_OPTIONS);

  if (result.status === 'success') {
    return {
      location: {
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        altitude: result.location.altitude ?? 0,
      },
    };
  }

  switch (result.status) {
    case 'permission_denied':
      return { errorKey: 'setupWizard.steps.location.permissionDenied' };
    case 'unavailable':
      return {
        errorKey: result.message.toLowerCase().includes('not available')
          || result.message.toLowerCase().includes('not supported')
          ? 'setupWizard.steps.location.gpsNotSupported'
          : 'setupWizard.steps.location.positionUnavailable',
      };
    case 'timeout':
      return { errorKey: 'setupWizard.steps.location.timeout' };
    case 'failed':
    default:
      return { errorKey: 'setupWizard.steps.location.unknownError' };
  }
}
