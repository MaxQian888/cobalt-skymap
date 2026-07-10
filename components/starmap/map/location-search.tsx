'use client';

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, MapPin, Loader2, X, Clock, Star, Navigation2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { geocodingService } from '@/lib/services/geocoding-service';
import type { SearchCapabilities } from '@/lib/services/geocoding-service';
import { acquireCurrentLocation, type LocationAcquisitionStatus } from '@/lib/services/location-acquisition';
import type { GeocodingResult } from '@/lib/services/map-providers/base-map-provider';
import type { Coordinates, LocationResult, SearchHistory } from '@/types/starmap/map';
import {
  LOCATION_SEARCH_STORAGE_KEY,
  LOCATION_SEARCH_MAX_HISTORY,
  LOCATION_SEARCH_HISTORY_EXPIRY_DAYS,
} from '@/lib/constants/map';
import { createLogger } from '@/lib/logger';

const logger = createLogger('location-search');

interface LocationSearchProps {
  onLocationSelect: (location: LocationResult) => void;
  placeholder?: string;
  className?: string;
  showRecentSearches?: boolean;
  showCurrentLocation?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  initialValue?: string;
}


function LocationSearchComponent({
  onLocationSelect,
  placeholder,
  className,
  showRecentSearches = true,
  showCurrentLocation = true,
  disabled = false,
  autoFocus = false,
  initialValue = '',
}: LocationSearchProps) {
  const t = useTranslations();
  const locale = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [query, setQuery] = useState(initialValue);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [searchCapabilities, setSearchCapabilities] = useState<SearchCapabilities>(() =>
    geocodingService.getSearchCapabilities()
  );
  const [currentLocationErrorStatus, setCurrentLocationErrorStatus] =
    useState<Exclude<LocationAcquisitionStatus, 'success'> | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>('');

  // Load search history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCATION_SEARCH_STORAGE_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        const expiryTime = Date.now() - LOCATION_SEARCH_HISTORY_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const filteredHistory = history.filter((item: SearchHistory) =>
          item.timestamp > expiryTime
        );
        // localStorage is only available client-side; reading it during a lazy useState
        // initializer would crash SSR/static export, so this must stay in an effect.
        // Genuine false positive for set-state-in-effect: the read is synchronous and
        // the history must be applied before paint so it renders on first frame.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSearchHistory(filteredHistory.slice(0, LOCATION_SEARCH_MAX_HISTORY));
      }
    } catch (error) {
      logger.warn('Failed to load search history', error);
    }
  }, []);

  const saveSearchHistory = useCallback((newHistory: SearchHistory[]) => {
    try {
      localStorage.setItem(LOCATION_SEARCH_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (error) {
      logger.warn('Failed to save search history', error);
    }
  }, []);

  const addToHistory = useCallback((searchQuery: string, result: GeocodingResult) => {
    const newItem: SearchHistory = {
      query: searchQuery,
      result,
      timestamp: Date.now(),
    };

    setSearchHistory(prev => {
      const filtered = prev.filter(item => 
        item.query !== searchQuery || 
        Math.abs(item.result.coordinates.latitude - result.coordinates.latitude) > 0.001 ||
        Math.abs(item.result.coordinates.longitude - result.coordinates.longitude) > 0.001
      );
      const newHistory = [newItem, ...filtered].slice(0, LOCATION_SEARCH_MAX_HISTORY);
      saveSearchHistory(newHistory);
      return newHistory;
    });
  }, [saveSearchHistory]);

  const refreshSearchCapabilities = useCallback(() => {
    const capabilities = geocodingService.getSearchCapabilities();
    setSearchCapabilities(capabilities);
    return capabilities;
  }, []);

  const performSearch = useCallback(async (searchQuery: string, preferredProvider?: 'openstreetmap' | 'google' | 'mapbox') => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    const controller = new AbortController();
    abortControllerRef.current = controller;
    latestQueryRef.current = searchQuery;

    setIsSearching(true);
    try {
      const searchResults = await geocodingService.geocode(searchQuery, {
        limit: 8,
        language: locale,
        fallback: true,
        provider: preferredProvider,
      });
      
      // Only update if this is still the latest query
      if (latestQueryRef.current === searchQuery && !controller.signal.aborted) {
        setResults(searchResults);
        setSelectedIndex(-1);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      logger.error('Search failed', error);
      if (latestQueryRef.current === searchQuery) {
        setResults([]);
      }
    } finally {
      if (latestQueryRef.current === searchQuery) {
        setIsSearching(false);
      }
    }
  }, [locale]);

  const getCurrentLocationErrorMessage = useCallback((status: Exclude<LocationAcquisitionStatus, 'success'>): string => {
    switch (status) {
      case 'permission_denied':
        return t('map.locationPermissionDenied') || 'Location permission denied';
      case 'timeout':
        return t('map.locationTimedOut') || 'Location request timed out';
      case 'unavailable':
        return t('map.geolocationNotSupported') || 'Geolocation not supported';
      case 'failed':
      default:
        return t('map.locationRequestFailed') || 'Failed to get current location';
    }
  }, [t]);

  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    setIsOpen(true);
    const capabilities = refreshSearchCapabilities();

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setResults([]);
      return;
    }

    switch (capabilities.mode) {
      case 'online-autocomplete': {
        const preferredProvider = capabilities.providers[0];
        searchTimeoutRef.current = setTimeout(() => {
          performSearch(value, preferredProvider);
        }, 300);
        break;
      }
      case 'submit-search':
      case 'offline-cache':
      case 'disabled':
      default:
        setResults([]);
        setSelectedIndex(-1);
        break;
    }
  }, [performSearch, refreshSearchCapabilities]);

  const handleLocationSelect = useCallback((result: GeocodingResult, fromHistory = false) => {
    const location: LocationResult = {
      coordinates: result.coordinates,
      address: result.address,
      displayName: result.displayName,
    };

    onLocationSelect(location);
    
    if (!fromHistory) {
      addToHistory(query, result);
    }
    
    setQuery(result.displayName);
    setIsOpen(false);
    setResults([]);
  }, [onLocationSelect, query, addToHistory]);

  const handleCurrentLocation = useCallback(() => {
    setCurrentLocationErrorStatus(null);
    setIsGettingLocation(true);
    acquireCurrentLocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
      .then(async (result) => {
        if (result.status !== 'success') {
          setCurrentLocationErrorStatus(result.status);
          logger.warn('Current location request failed', result.message);
          return;
        }

        const coords: Coordinates = {
          latitude: result.location.latitude,
          longitude: result.location.longitude,
        };

        try {
          const reverseResult = await geocodingService.reverseGeocode(coords);
          onLocationSelect({
            coordinates: coords,
            address: reverseResult.address,
            displayName: reverseResult.displayName,
          });
          setQuery(reverseResult.displayName);
        } catch {
          const coordsString = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
          onLocationSelect({
            coordinates: coords,
            address: coordsString,
            displayName: coordsString,
          });
          setQuery(coordsString);
        }

        setIsOpen(false);
      })
      .catch((error) => {
        logger.error('Failed to process current location', error);
        setCurrentLocationErrorStatus('failed');
      })
      .finally(() => {
        setIsGettingLocation(false);
      });
  }, [onLocationSelect]);

  // Memoize total items for keyboard navigation - must be defined before handleKeyDown
  const totalItems = useMemo(() => 
    results.length + (showRecentSearches ? searchHistory.length : 0) + (showCurrentLocation ? 1 : 0),
    [results.length, showRecentSearches, searchHistory.length, showCurrentLocation]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        if (totalItems === 0) return;
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        if (totalItems === 0) return;
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            handleLocationSelect(results[selectedIndex]);
          } else if (showCurrentLocation && selectedIndex === results.length) {
            handleCurrentLocation();
          } else if (showRecentSearches) {
            const historyIndex = selectedIndex - results.length - (showCurrentLocation ? 1 : 0);
            if (historyIndex >= 0 && historyIndex < searchHistory.length) {
              handleLocationSelect(searchHistory[historyIndex].result, true);
            }
          }
        } else if (query.trim() && searchCapabilities.mode === 'submit-search') {
          performSearch(query);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }, [isOpen, results, showRecentSearches, showCurrentLocation, searchHistory, selectedIndex, handleLocationSelect, handleCurrentLocation, totalItems, query, searchCapabilities.mode, performSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // Re-query capabilities on the client after mount: the initial lazy useState value
    // may have been computed during SSR/static export where env-dependent capability
    // detection (e.g. API key availability) can differ from the client. Synchronous
    // client-only re-sync; genuine false positive for set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSearchCapabilities();
  }, [refreshSearchCapabilities]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Memoize dropdown visibility check
  const shouldShowDropdown = useMemo(() => 
    isOpen
    && (
      results.length > 0
      || isSearching
      || (showRecentSearches && searchHistory.length > 0)
      || !query.trim()
      || (query.trim().length > 0 && searchCapabilities.mode !== 'online-autocomplete')
    ),
    [isOpen, results.length, isSearching, showRecentSearches, searchHistory.length, query, searchCapabilities.mode]
  );

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={shouldShowDropdown}
          aria-haspopup="listbox"
          aria-controls="location-search-listbox"
          aria-activedescendant={selectedIndex >= 0 ? `location-option-${selectedIndex}` : undefined}
          aria-autocomplete="list"
          placeholder={placeholder || t('map.searchPlaceholder') || 'Search for a location...'}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            refreshSearchCapabilities();
            setIsOpen(true);
          }}
          className="pl-9 pr-10"
          disabled={disabled}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {shouldShowDropdown && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg border">
          <CardContent className="p-0">
            <ScrollArea className="max-h-80">
              <div role="listbox" id="location-search-listbox" className="py-1">
                {showCurrentLocation && !query.trim() && (
                  <>
                    <div
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                        selectedIndex === results.length ? 'bg-muted' : 'hover:bg-muted/50'
                      )}
                      onClick={handleCurrentLocation}
                    >
                      {isGettingLocation ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Navigation2 className="h-4 w-4 text-primary" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {t('map.currentLocation') || 'Current Location'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t('map.useGpsLocation') || 'Use GPS to detect your location'}
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

                {results.map((result, index) => (
                  <div
                    key={`${result.coordinates.latitude}-${result.coordinates.longitude}`}
                    id={`location-option-${index}`}
                    role="option"
                    aria-selected={selectedIndex === index}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                      selectedIndex === index ? 'bg-muted' : 'hover:bg-muted/50'
                    )}
                    onClick={() => handleLocationSelect(result)}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {result.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {result.coordinates.latitude.toFixed(6)}, {result.coordinates.longitude.toFixed(6)}
                      </div>
                    </div>
                    {result.type && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {result.type}
                      </Badge>
                    )}
                  </div>
                ))}

                {isSearching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      {t('map.searching') || 'Searching...'}
                    </span>
                  </div>
                )}

                {!isSearching && query.trim() && results.length === 0 && (
                  <div className="flex items-center justify-center py-4">
                    <span className="text-sm text-muted-foreground">
                      {searchCapabilities.mode === 'submit-search'
                        ? (t('map.submitToSearch') || 'Press Enter to search')
                        : searchCapabilities.mode === 'offline-cache'
                          ? (t('map.offlineSearchRestricted') || 'Offline mode: online search disabled')
                          : searchCapabilities.mode === 'disabled'
                            ? (t('map.searchDisabled') || 'Search is disabled by policy')
                            : (t('map.noResults') || 'No locations found')}
                    </span>
                  </div>
                )}

                {showCurrentLocation && !query.trim() && currentLocationErrorStatus && (
                  <div className="px-3 py-2 text-xs text-destructive">
                    {getCurrentLocationErrorMessage(currentLocationErrorStatus)}
                  </div>
                )}

                {showRecentSearches && searchHistory.length > 0 && !query.trim() && (
                  <>
                    {(results.length > 0 || showCurrentLocation) && <Separator />}
                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {t('map.recentSearches') || 'Recent Searches'}
                      </div>
                    </div>
                    {searchHistory.map((item, index) => {
                      const itemIndex = results.length + (showCurrentLocation ? 1 : 0) + index;
                      return (
                        <div
                          key={`history-${item.timestamp}`}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors',
                            selectedIndex === itemIndex ? 'bg-muted' : 'hover:bg-muted/50'
                          )}
                          onClick={() => handleLocationSelect(item.result, true)}
                        >
                          <Star className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {item.result.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const LocationSearch = memo(LocationSearchComponent);
