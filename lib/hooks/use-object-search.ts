'use client';

import { useState, useCallback, useRef, useMemo, useEffect, useTransition } from 'react';
import { useStellariumStore } from '@/lib/stores';
import type {
  SearchResultItem,
  SearchRunMessage,
  SearchRunOutcome,
  SearchProviderDiagnostic,
  SearchProgressStage,
} from '@/lib/core/types';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { useSearchStore } from '@/lib/stores/search-store';
import { checkOnlineSearchAvailability } from '@/lib/services/online-search-service';
import {
  searchUnified,
  createCoordinateSearchResult,
  type UnifiedSearchMode,
} from '@/lib/services/search/search-orchestrator';
import type { SearchRefinementHint } from '@/lib/services/search/search-intent';
import { parseSearchQuery } from '@/lib/services/search/query-parser';
import {
  CELESTIAL_BODIES,
  POPULAR_DSOS,
  MESSIER_CATALOG,
  CONSTELLATION_SEARCH_DATA,
  DSO_NAME_INDEX,
  getMatchScore,
  getDetailedSearchMatch,
  fuzzyMatch,
  DSO_CATALOG,
  getDSOById,
  getMessierObjects,
  parseCatalogId,
  quickSearch,
  calculateAltitude,
  calculateMoonDistance,
} from '@/lib/catalogs';
import { searchLocalCatalog } from '@/lib/services/local-resolve-service';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { createLogger } from '@/lib/logger';
import { getResultId } from '@/lib/core/search-utils';

const logger = createLogger('use-object-search');

// Re-export for backward compatibility
export const getDetailedMatch = getDetailedSearchMatch;
// ============================================================================
// Types
// ============================================================================

export type ObjectType = 'DSO' | 'Planet' | 'Star' | 'Moon' | 'Comet' | 'Asteroid' | 'TargetList' | 'Constellation';
export type SortOption = 'name' | 'type' | 'ra' | 'relevance' | 'magnitude' | 'altitude' | 'distance';
export type SearchMode = 'name' | 'coordinates' | 'catalog';

export interface SearchFilters {
  types: ObjectType[];
  includeTargetList: boolean;
  searchMode: SearchMode;
  minMagnitude?: number;
  maxMagnitude?: number;
  searchRadius?: number; // degrees for coordinate search
}

export interface SearchStats {
  totalResults: number;
  resultsByType: Record<string, number>;
  searchTimeMs: number;
}

export interface SearchState {
  query: string;
  results: SearchResultItem[];
  isSearching: boolean;
  isOnlineSearching: boolean;
  searchStage: SearchProgressStage;
  searchOutcome: SearchRunOutcome;
  searchMessages: SearchRunMessage[];
  refinementHints: SearchRefinementHint[];
  providerDiagnostics: SearchProviderDiagnostic[];
  usedCachedOnline: boolean;
  selectedIds: Set<string>;
  filters: SearchFilters;
  sortBy: SortOption;
  onlineAvailable: boolean;
}

export interface UseObjectSearchReturn {
  // State
  query: string;
  results: SearchResultItem[];
  groupedResults: Map<string, SearchResultItem[]>;
  isSearching: boolean;
  isOnlineSearching: boolean;
  searchStage: SearchProgressStage;
  searchOutcome: SearchRunOutcome;
  searchMessages: SearchRunMessage[];
  refinementHints: SearchRefinementHint[];
  providerDiagnostics: SearchProviderDiagnostic[];
  usedCachedOnline: boolean;
  selectedIds: Set<string>;
  filters: SearchFilters;
  sortBy: SortOption;
  recentSearches: string[];
  searchStats: SearchStats | null;
  onlineAvailable: boolean;

  // Actions
  setQuery: (query: string) => void;
  search: (query: string) => void;
  clearSearch: () => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setSortBy: (sort: SortOption) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // Helpers
  getSelectedItems: () => SearchResultItem[];
  isSelected: (id: string) => boolean;

  // Quick access
  popularObjects: SearchResultItem[];
  quickCategories: { label: string; items: SearchResultItem[] }[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

const MAX_RECENT = 8;
const FUZZY_THRESHOLD = 0.3; // Minimum score to include in results

function normalizeGroupLabel(groupBySource: boolean, item: SearchResultItem): string {
  if (groupBySource) {
    return item._onlineSource || 'local';
  }
  return item.Type || 'Unknown';
}

function sortResults(results: SearchResultItem[], sortBy: SortOption): SearchResultItem[] {
  return [...results].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.Name.localeCompare(b.Name);
      case 'type':
        return (a.Type || '').localeCompare(b.Type || '');
      case 'ra':
        return (a.RA || 0) - (b.RA || 0);
      case 'magnitude': {
        const ma = a.Magnitude ?? Number.POSITIVE_INFINITY;
        const mb = b.Magnitude ?? Number.POSITIVE_INFINITY;
        return ma - mb;
      }
      case 'altitude':
        return (b._currentAltitude ?? -999) - (a._currentAltitude ?? -999);
      case 'distance': {
        const da = a._angularSeparation ?? Number.POSITIVE_INFINITY;
        const db = b._angularSeparation ?? Number.POSITIVE_INFINITY;
        return da - db;
      }
      case 'relevance':
      default:
        return (b._fuzzyScore ?? 0) - (a._fuzzyScore ?? 0);
    }
  });
}

export function useObjectSearch(): UseObjectSearchReturn {
  const stel = useStellariumStore((state) => state.stel);
  const targets = useTargetListStore((state) => state.targets);

  // Search store — per-field selectors so the search hook only re-renders when
  // the reactive bits (mode/settings) change, not on any store mutation.
  // Actions/getters are stable Zustand refs.
  const currentSearchMode = useSearchStore((s) => s.currentSearchMode);
  const searchSettings = useSearchStore((s) => s.settings);
  const getEnabledSources = useSearchStore((s) => s.getEnabledSources);
  const addStoreRecentSearch = useSearchStore((s) => s.addRecentSearch);
  const getRecentSearches = useSearchStore((s) => s.getRecentSearches);
  const clearStoreRecentSearches = useSearchStore((s) => s.clearRecentSearches);
  const updateAllOnlineStatus = useSearchStore((s) => s.updateAllOnlineStatus);
  const cacheSearchResults = useSearchStore((s) => s.cacheSearchResults);
  const getCachedResults = useSearchStore((s) => s.getCachedResults);
  const setMaxRecentSearches = useSearchStore((s) => s.setMaxRecentSearches);

  const enableFuzzySearch = useSettingsStore((s) => s.search.enableFuzzySearch);
  const autoSearchDelay = useSettingsStore((s) => s.search.autoSearchDelay);
  const maxSearchResults = useSettingsStore((s) => s.search.maxSearchResults);
  const includeMinorObjects = useSettingsStore((s) => s.search.includeMinorObjects);
  const rememberSearchHistory = useSettingsStore((s) => s.search.rememberSearchHistory);
  const maxHistoryItems = useSettingsStore((s) => s.search.maxHistoryItems);

  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
    isOnlineSearching: false,
    searchStage: 'idle',
    searchOutcome: 'empty',
    searchMessages: [],
    refinementHints: [],
    providerDiagnostics: [],
    usedCachedOnline: false,
    selectedIds: new Set(),
    filters: {
      types: ['DSO', 'Planet', 'Star', 'Moon', 'Comet', 'Asteroid', 'TargetList', 'Constellation'],
      includeTargetList: true,
      searchMode: 'name',
      minMagnitude: undefined,
      maxMagnitude: undefined,
      searchRadius: 5,
    },
    sortBy: 'relevance',
    onlineAvailable: true,
  });

  const [searchStats, setSearchStats] = useState<SearchStats | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const [, startTransition] = useTransition();

  // Refs to avoid stale closure
  const searchModeRef = useRef(currentSearchMode);
  const filtersRef = useRef(state.filters);

  useEffect(() => { searchModeRef.current = currentSearchMode; }, [currentSearchMode]);
  useEffect(() => { filtersRef.current = state.filters; }, [state.filters]);

  // Sync max history setting into search store
  useEffect(() => {
    setMaxRecentSearches(maxHistoryItems);
  }, [maxHistoryItems, setMaxRecentSearches]);

  // Check online availability on mount (throttled: skip if checked within 5 min)
  const lastStatusCheck = useSearchStore((s) => s.lastStatusCheck);
  useEffect(() => {
    const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - lastStatusCheck < THROTTLE_MS) {
      const cachedStatus = useSearchStore.getState().onlineStatus;
      const anyOnline = Object.values(cachedStatus).some(v => v);
      setState(prev => ({ ...prev, onlineAvailable: anyOnline }));
      return;
    }

    const controller = new AbortController();
    checkOnlineSearchAvailability().then((status) => {
      if (!controller.signal.aborted) {
        updateAllOnlineStatus(status);
        const anyOnline = Object.values(status).some(v => v);
        setState(prev => ({ ...prev, onlineAvailable: anyOnline }));
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setState(prev => ({ ...prev, onlineAvailable: false }));
      }
    });

    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAllOnlineStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const performLocalSearch = useCallback(async (
    query: string,
    filters: SearchFilters
  ): Promise<SearchResultItem[]> => {
    const parsed = parseSearchQuery(query);
    const queryForMatching = parsed.catalogQuery || parsed.normalized || query.trim();
    const lowerQuery = queryForMatching.toLowerCase();
    const results: SearchResultItem[] = [];
    const addedKeys = new Set<string>();

    const passesMagnitudeFilter = (magnitude?: number): boolean => {
      if (magnitude === undefined) return true;
      if (filters.minMagnitude !== undefined && magnitude < filters.minMagnitude) return false;
      if (filters.maxMagnitude !== undefined && magnitude > filters.maxMagnitude) return false;
      return true;
    };

    const addResult = (item: SearchResultItem, score: number = 1) => {
      const key = `${item.Type || 'unknown'}-${item.Name.toLowerCase()}`;
      if (addedKeys.has(key)) return;
      if (!passesMagnitudeFilter(item.Magnitude)) return;
      addedKeys.add(key);
      results.push({ ...item, _fuzzyScore: score });
    };

    // 1. Search user's target list
    if (filters.includeTargetList && filters.types.includes('TargetList')) {
      for (const target of targets) {
        if (target.name.toLowerCase().includes(lowerQuery)) {
          addResult({
            Name: target.name,
            Type: 'DSO',
            RA: target.ra,
            Dec: target.dec,
            'Common names': 'From Target List',
          }, 1.4);
        }
      }
    }

    // 2. Coordinate query
    if (parsed.intent === 'coordinates' && parsed.coordinates) {
      addResult(createCoordinateSearchResult(parsed.coordinates.ra, parsed.coordinates.dec), 2.0);
    }

    // 3. DSO catalog search
    if (filters.types.includes('DSO')) {
      const catalogId = parseCatalogId(queryForMatching);
      if (catalogId) {
        const localObj = getDSOById(catalogId.normalized);
        if (localObj) {
          addResult({
            Name: localObj.name,
            Type: 'DSO',
            RA: localObj.ra,
            Dec: localObj.dec,
            Magnitude: localObj.magnitude,
            'Common names': localObj.alternateNames?.join(', '),
          }, 2.5);
        }
      }

      if (enableFuzzySearch) {
        const dsoResults = quickSearch(DSO_CATALOG, queryForMatching, Math.max(maxSearchResults, 20));
        for (const dso of dsoResults) {
          addResult({
            Name: dso.name,
            Type: 'DSO',
            RA: dso.ra,
            Dec: dso.dec,
            Magnitude: dso.magnitude,
            'Common names': dso.alternateNames?.join(', '),
          }, 1.5);
        }
      } else {
        const firstChar = queryForMatching[0]?.toUpperCase();
        if (firstChar && DSO_NAME_INDEX.has(firstChar)) {
          for (const dso of DSO_NAME_INDEX.get(firstChar)!) {
            const score = getMatchScore(dso, queryForMatching);
            if (score >= FUZZY_THRESHOLD) {
              addResult(dso, score);
            }
          }
        }
      }

      for (const dso of POPULAR_DSOS) {
        const score = getMatchScore(dso, queryForMatching);
        if (score >= FUZZY_THRESHOLD) {
          addResult(dso, score);
        }
      }

      for (const dso of MESSIER_CATALOG) {
        const score = getMatchScore(dso, queryForMatching);
        if (score >= FUZZY_THRESHOLD) {
          addResult(dso, score);
        }
      }
    }

    // 4. Search constellations
    if (filters.types.includes('Constellation')) {
      for (const constellation of CONSTELLATION_SEARCH_DATA) {
        const score = getMatchScore(constellation, queryForMatching);
        if (score >= FUZZY_THRESHOLD) {
          addResult(constellation, score);
        }
      }
    }

    // 5. Search planets/stars/moon/comets
    const allowComets = includeMinorObjects || parsed.explicitMinor;
    if (stel) {
      if (filters.types.includes('Planet') || filters.types.includes('Star') || filters.types.includes('Moon')) {
        for (const body of CELESTIAL_BODIES) {
          if (!filters.types.includes(body.Type as ObjectType)) continue;
          const score = fuzzyMatch(body.Name, queryForMatching);
          if (score >= FUZZY_THRESHOLD) {
            try {
              const obj = stel.getObj(`NAME ${body.Name}`);
              if (obj && obj.designations && obj.designations().length > 0) {
                addResult({ ...body, StellariumObj: obj }, score);
              } else {
                addResult(body, score);
              }
            } catch {
              addResult(body, score);
            }
          }
        }
      }

      if (allowComets && filters.types.includes('Comet')) {
        try {
          const comets = stel.core.comets;
          if (comets && comets.listObjs) {
            const cometList = comets.listObjs(stel.core.observer, 100, () => true);
            for (const comet of cometList) {
              if (comet.designations) {
                const designations = comet.designations();
                for (const designation of designations) {
                  const name = designation.replace(/^NAME /, '');
                  const score = fuzzyMatch(name, queryForMatching);
                  if (score >= FUZZY_THRESHOLD) {
                    addResult({
                      Name: name,
                      Type: 'Comet',
                      StellariumObj: comet,
                    }, score);
                    break;
                  }
                }
              }
              if (results.length >= maxSearchResults) break;
            }
          }
        } catch (error) {
          logger.debug('Comet search error', error);
        }
      }
    } else if (filters.types.includes('Planet') || filters.types.includes('Star') || filters.types.includes('Moon')) {
      for (const body of CELESTIAL_BODIES) {
        const score = fuzzyMatch(body.Name, queryForMatching);
        if (score >= FUZZY_THRESHOLD) {
          addResult(body, score);
        }
      }
    }

    // Local fallback deep catalog search if weak result
    if (results.length < 5 && queryForMatching.length >= 2) {
      const localFallback = searchLocalCatalog(queryForMatching, maxSearchResults);
      for (const item of localFallback) {
        addResult({
          Name: item.name,
          Type: 'DSO',
          RA: item.ra,
          Dec: item.dec,
          Magnitude: item.magnitude,
          Size: item.angularSize,
          'Common names': item.alternateNames?.join(', '),
          _onlineSource: 'local',
        }, 0.95);
      }
    }

    const sorted = sortResults(results, 'relevance').slice(0, maxSearchResults);

    // Enrich DSO results with altitude and moon distance
    let obsLat = 40;
    let obsLon = -74;
    if (stel?.core?.observer) {
      try {
        obsLat = stel.core.observer.latitude ?? 40;
        obsLon = stel.core.observer.longitude ?? -74;
      } catch {
        // noop
      }
    } else {
      try {
        const { useMountStore } = await import('@/lib/stores');
        const profile = useMountStore.getState().profileInfo;
        obsLat = profile.AstrometrySettings.Latitude || 40;
        obsLon = profile.AstrometrySettings.Longitude || -74;
      } catch {
        // noop
      }
    }

    const now = new Date();
    for (const result of sorted) {
      if (result.RA !== undefined && result.Dec !== undefined) {
        try {
          const alt = calculateAltitude(result.RA, result.Dec, obsLat, obsLon, now);
          result._currentAltitude = Math.round(alt * 10) / 10;
          result._isVisible = alt > 0;
          result._moonDistance = Math.round(calculateMoonDistance(result.RA, result.Dec, now) * 10) / 10;
        } catch {
          // noop
        }
      }
    }

    return sorted;
  }, [targets, enableFuzzySearch, maxSearchResults, stel, includeMinorObjects]);

  const performSearch = useCallback(async (query: string, filters: SearchFilters) => {
    const startTime = performance.now();
    searchRequestIdRef.current += 1;
    const requestId = searchRequestIdRef.current;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (!query.trim()) {
      setState(prev => ({
        ...prev,
        results: [],
        isSearching: false,
        isOnlineSearching: false,
        searchStage: 'idle',
        searchOutcome: 'empty',
        searchMessages: [],
        refinementHints: [],
        providerDiagnostics: [],
        usedCachedOnline: false,
      }));
      setSearchStats(null);
      return;
    }

    const mode = searchModeRef.current as UnifiedSearchMode;
    const parsed = parseSearchQuery(query);
    const normalizedCacheKey = (parsed.catalogQuery || parsed.normalized || query).toLowerCase();
    const cacheMaxAgeMs = (searchSettings.cacheFallbackMaxAgeMinutes ?? 30) * 60 * 1000;
    const cached = getCachedResults(normalizedCacheKey, { maxAgeMs: cacheMaxAgeMs });
    const enabledSources = getEnabledSources().filter(s => s !== 'local');

    setState(prev => ({
      ...prev,
      isSearching: true,
      isOnlineSearching: mode !== 'local' && state.onlineAvailable,
      searchStage: 'idle',
      searchMessages: [],
      refinementHints: [],
      providerDiagnostics: [],
      usedCachedOnline: false,
    }));

    try {
      const unified = await searchUnified({
        query,
        mode,
        onlineAvailable: state.onlineAvailable,
        enabledSources,
        timeout: searchSettings.timeout,
        maxResults: maxSearchResults,
        searchRadiusDeg: filters.searchRadius || 5,
        includeMinorObjects,
        signal,
        localSearch: ({ query: localQuery }) => performLocalSearch(localQuery, filters),
        cachedOnline: cached
          ? { results: cached.results, timestamp: cached.timestamp }
          : null,
        cacheMaxAgeMs,
        onProgress: (progress) => {
          if (signal.aborted || requestId !== searchRequestIdRef.current) return;

          const sorted = sortResults(progress.results, state.sortBy).slice(0, maxSearchResults);
          const displayResults = progress.outcome === 'success' || progress.outcome === 'partial_success'
            ? sorted
            : [];

          setState(prev => ({
            ...prev,
            results: displayResults,
            isSearching: progress.stage !== 'finalized',
            isOnlineSearching:
              progress.stage === 'local_ready' && mode !== 'local' && state.onlineAvailable,
            searchStage: progress.stage,
            searchOutcome: progress.outcome,
            searchMessages: progress.issues,
            refinementHints: progress.refinementHints,
            providerDiagnostics: progress.providerDiagnostics,
            usedCachedOnline: progress.usedCachedOnline,
          }));
        },
      });

      if (signal.aborted || requestId !== searchRequestIdRef.current) return;

      if (unified.onlineResponse?.results?.length) {
        cacheSearchResults(normalizedCacheKey, unified.onlineResponse.results, mode);
      }

      const sorted = sortResults(unified.results, state.sortBy).slice(0, maxSearchResults);
      const displayResults = unified.outcome === 'success' || unified.outcome === 'partial_success'
        ? sorted
        : [];
      const resultsByType: Record<string, number> = {};
      for (const result of displayResults) {
        const key = normalizeGroupLabel(searchSettings.groupBySource, result);
        resultsByType[key] = (resultsByType[key] || 0) + 1;
      }

      setState(prev => ({
        ...prev,
        results: displayResults,
        isSearching: false,
        isOnlineSearching: false,
        searchStage: unified.stage,
        searchOutcome: unified.outcome,
        searchMessages: unified.issues,
        refinementHints: unified.refinementHints,
        providerDiagnostics: unified.providerDiagnostics,
        usedCachedOnline: unified.usedCachedOnline,
      }));

      setSearchStats({
        totalResults: displayResults.length,
        resultsByType,
        searchTimeMs: Math.round(performance.now() - startTime),
      });

      if (rememberSearchHistory) {
        addStoreRecentSearch(query, displayResults.length, mode === 'local' ? 'local' : mode === 'online' ? 'online' : 'mixed');
      }
    } catch (error) {
      logger.warn('Search failed', error);
      if (!signal.aborted && requestId === searchRequestIdRef.current) {
        setState(prev => ({
          ...prev,
          results: [],
          isSearching: false,
          isOnlineSearching: false,
          searchStage: 'finalized',
          searchOutcome: 'error',
          searchMessages: [{
            source: 'search',
            level: 'error',
            code: 'SEARCH_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : 'Search failed',
          }],
          refinementHints: [],
          providerDiagnostics: [],
          usedCachedOnline: false,
        }));
      }
    }
  }, [
    addStoreRecentSearch,
    cacheSearchResults,
    getCachedResults,
    getEnabledSources,
    includeMinorObjects,
    maxSearchResults,
    performLocalSearch,
    rememberSearchHistory,
    searchSettings.groupBySource,
    searchSettings.cacheFallbackMaxAgeMinutes,
    searchSettings.timeout,
    state.onlineAvailable,
    state.sortBy,
  ]);

  const search = useCallback((query: string) => {
    setState(prev => ({ ...prev, query }));

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        performSearch(query, filtersRef.current);
      });
    }, autoSearchDelay);
  }, [performSearch, startTransition, autoSearchDelay]);

  const setQuery = useCallback((query: string) => {
    search(query);
  }, [search]);

  const clearSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      query: '',
      results: [],
      searchStage: 'idle',
      searchOutcome: 'empty',
      searchMessages: [],
      refinementHints: [],
      providerDiagnostics: [],
      usedCachedOnline: false,
      selectedIds: new Set(),
    }));
  }, []);

  // Selection management
  const toggleSelection = useCallback((id: string) => {
    setState(prev => {
      const next = new Set(prev.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, selectedIds: next };
    });
  }, []);

  const selectAll = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIds: new Set(prev.results.map(r => getResultId(r))),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedIds: new Set() }));
  }, []);

  const getSelectedItems = useCallback((): SearchResultItem[] => {
    return state.results.filter(r => state.selectedIds.has(getResultId(r)));
  }, [state.results, state.selectedIds]);

  const isSelected = useCallback((id: string): boolean => {
    return state.selectedIds.has(id);
  }, [state.selectedIds]);

  // Filters
  const setFilters = useCallback((updates: Partial<SearchFilters>) => {
    setState(prev => {
      const newFilters = { ...prev.filters, ...updates };
      if (prev.query) {
        performSearch(prev.query, newFilters);
      }
      return { ...prev, filters: newFilters };
    });
  }, [performSearch]);

  const setSortBy = useCallback((sort: SortOption) => {
    setState(prev => ({ ...prev, sortBy: sort }));
  }, []);

  // Recent searches via searchStore
  const addRecentSearch = useCallback((query: string) => {
    if (!query.trim() || !rememberSearchHistory) return;
    addStoreRecentSearch(query, 0, 'local');
  }, [addStoreRecentSearch, rememberSearchHistory]);

  const clearRecentSearches = useCallback(() => {
    clearStoreRecentSearches();
  }, [clearStoreRecentSearches]);

  const recentSearches = useMemo(() => {
    if (!rememberSearchHistory) return [];
    return getRecentSearches(MAX_RECENT).map(s => s.query);
  }, [getRecentSearches, rememberSearchHistory]);

  // Grouped results
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResultItem[]>();
    const sorted = sortResults(state.results, state.sortBy);

    for (const item of sorted) {
      const group = normalizeGroupLabel(searchSettings.groupBySource, item);
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(item);
    }
    return groups;
  }, [searchSettings.groupBySource, state.results, state.sortBy]);

  // Quick access data
  const popularObjects = useMemo(() => POPULAR_DSOS.slice(0, 10), []);

  const quickCategories = useMemo(() => {
    const messierItems: SearchResultItem[] = getMessierObjects().slice(0, 15).map(dso => ({
      Name: dso.name,
      Type: 'DSO' as const,
      RA: dso.ra,
      Dec: dso.dec,
      Magnitude: dso.magnitude,
      'Common names': dso.alternateNames?.join(', '),
    }));

    const galaxyTypes = new Set(['Galaxy', 'GalaxyPair', 'GalaxyTriplet', 'GalaxyCluster']);
    const nebulaTypes = new Set(['Nebula', 'PlanetaryNebula', 'EmissionNebula', 'ReflectionNebula', 'DarkNebula', 'HII', 'SupernovaRemnant']);
    const clusterTypes = new Set(['OpenCluster', 'GlobularCluster', 'StarCluster']);

    const toSearchItem = (dso: typeof DSO_CATALOG[number]): SearchResultItem => ({
      Name: dso.name,
      Type: 'DSO' as const,
      RA: dso.ra,
      Dec: dso.dec,
      Magnitude: dso.magnitude,
      'Common names': dso.alternateNames?.join(', '),
    });

    return [
      { label: 'messier', items: messierItems },
      { label: 'galaxies', items: DSO_CATALOG.filter(d => galaxyTypes.has(d.type) && d.magnitude !== undefined && d.magnitude <= 10).slice(0, 15).map(toSearchItem) },
      { label: 'nebulae', items: DSO_CATALOG.filter(d => nebulaTypes.has(d.type) && d.magnitude !== undefined && d.magnitude <= 10).slice(0, 15).map(toSearchItem) },
      { label: 'planets', items: CELESTIAL_BODIES.filter(b => b.Type === 'Planet') },
      { label: 'clusters', items: DSO_CATALOG.filter(d => clusterTypes.has(d.type) && d.magnitude !== undefined && d.magnitude <= 10).slice(0, 15).map(toSearchItem) },
    ];
  }, []);

  return {
    query: state.query,
    results: state.results,
    groupedResults,
    isSearching: state.isSearching,
    isOnlineSearching: state.isOnlineSearching,
    searchStage: state.searchStage,
    searchOutcome: state.searchOutcome,
    searchMessages: state.searchMessages,
    refinementHints: state.refinementHints,
    providerDiagnostics: state.providerDiagnostics,
    usedCachedOnline: state.usedCachedOnline,
    selectedIds: state.selectedIds,
    filters: state.filters,
    sortBy: state.sortBy,
    recentSearches,
    onlineAvailable: state.onlineAvailable,
    searchStats,
    setQuery,
    search,
    clearSearch,
    toggleSelection,
    selectAll,
    clearSelection,
    setFilters,
    setSortBy,
    addRecentSearch,
    clearRecentSearches,
    getSelectedItems,
    isSelected,
    popularObjects,
    quickCategories,
  };
}
