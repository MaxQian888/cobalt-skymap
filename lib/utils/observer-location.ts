/**
 * Legacy observer-location utilities
 *
 * Legacy localStorage helpers used for migration of older setup/onboarding
 * location data into the canonical observation-site workflow.
 */

import type { ObserverLocation } from '@/types/starmap/setup-wizard';
import { LOCATION_STORAGE_KEY } from '@/lib/constants/setup-wizard';

/**
 * Load stored observer location from localStorage
 */
export function loadStoredLocation(): ObserverLocation | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save observer location to localStorage
 */
export function saveLocation(location: ObserverLocation): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear legacy observer location storage after migration.
 */
export function clearStoredLocation(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Validate that a location object has valid coordinates
 */
export function isValidLocation(location: ObserverLocation | null): location is ObserverLocation {
  if (!location) return false;
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}
