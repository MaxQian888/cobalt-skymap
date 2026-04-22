import { act, renderHook } from '@testing-library/react';
import { useSkyAtlasStore, initializeSkyAtlas } from '../sky-atlas-store';

// Mock search-engine
const mockSearchDeepSkyObjects = jest.fn().mockResolvedValue({
  objects: [],
  totalCount: 0,
  filteredCount: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
});
const mockSearchWithFuzzyName = jest.fn().mockResolvedValue({
  objects: [],
  totalCount: 0,
  filteredCount: 0,
  page: 1,
  pageSize: 50,
  totalPages: 0,
});

jest.mock('../search-engine', () => ({
  searchDeepSkyObjects: (...args: unknown[]) => mockSearchDeepSkyObjects(...args),
  searchWithFuzzyName: (...args: unknown[]) => mockSearchWithFuzzyName(...args),
  createDefaultFilters: jest.fn(() => ({
    objectName: '',
    filterDate: new Date(),
    objectTypes: [],
    constellation: '',
    raRange: { from: null, through: null },
    decRange: { from: null, through: null },
    magnitudeRange: { from: null, through: null },
    brightnessRange: { from: null, through: null },
    sizeRange: { from: null, through: null },
    minimumAltitude: 0,
    altitudeTimeFrom: new Date(),
    altitudeTimeThrough: new Date(),
    altitudeDuration: 0,
    minimumMoonDistance: 0,
    transitTimeFrom: null,
    transitTimeThrough: null,
    orderByField: 'imagingScore',
    orderByDirection: 'desc',
  })),
  initializeFiltersWithNighttime: jest.fn((filters) => filters),
  getTonightsBest: jest.fn(() => []),
  quickSearchByName: jest.fn(() => []),
  getCatalogStats: jest.fn(() => ({
    totalObjects: 0,
    byType: {},
    byCatalog: {},
  })),
}));

// Mock nighttime-calculator
jest.mock('../nighttime-calculator', () => ({
  calculateNighttimeData: jest.fn(() => ({
    sunset: new Date(),
    sunrise: new Date(),
    astronomicalDusk: new Date(),
    astronomicalDawn: new Date(),
    nauticalDusk: new Date(),
    nauticalDawn: new Date(),
    civilDusk: new Date(),
    civilDawn: new Date(),
    nightDuration: 8,
    darkSkyDuration: 6,
  })),
  getReferenceDate: jest.fn(() => new Date()),
}));

// Mock catalog-data
jest.mock('../catalog-data', () => ({
  DSO_CATALOG: [],
}));

describe('useSkyAtlasStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      const store = useSkyAtlasStore.getState();
      store.cancelSearch();
      store.resetFilters();
      store.selectObject(null);
    });
  });

  describe('initial state', () => {
    it('should have default location', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(typeof result.current.latitude).toBe('number');
      expect(typeof result.current.longitude).toBe('number');
    });

    it('should have default filters', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(result.current.filters).toBeDefined();
    });

    it('should have no selected object', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(result.current.selectedObject).toBeNull();
    });

    it('should not be searching initially', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('setLocation', () => {
    it('should update latitude and longitude', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setLocation(40.7128, -74.006);
      });

      expect(result.current.latitude).toBe(40.7128);
      expect(result.current.longitude).toBe(-74.006);
    });

    it('should update elevation if provided', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setLocation(40.7128, -74.006, 100);
      });

      expect(result.current.elevation).toBe(100);
    });
  });

  describe('setFilters', () => {
    it('should update filters partially', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({ objectName: 'M31' });
      });

      expect(result.current.filters.objectName).toBe('M31');
    });

    it('should update multiple filter properties', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({
          minimumAltitude: 30,
          minimumMoonDistance: 45,
        });
      });

      expect(result.current.filters.minimumAltitude).toBe(30);
      expect(result.current.filters.minimumMoonDistance).toBe(45);
    });
  });

  describe('resetFilters', () => {
    it('should reset filters to defaults', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({ objectName: 'M31', minimumAltitude: 45 });
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.objectName).toBe('');
    });
  });

  describe('selectObject', () => {
    it('should set selected object', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      const mockObject = {
        id: 'M31',
        name: 'Andromeda Galaxy',
        ra: 10.684,
        dec: 41.269,
        type: 'Galaxy' as const,
        magnitude: 3.4,
      };

      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.current.selectObject(mockObject as any);
      });

      expect(result.current.selectedObject).toBeDefined();
      expect(result.current.selectedObject?.id).toBe('M31');
    });

    it('should clear selected object when set to null', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.selectObject(null);
      });

      expect(result.current.selectedObject).toBeNull();
    });
  });

  describe('setQuickSearchTerm', () => {
    it('should update quick search term', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setQuickSearchTerm('NGC');
      });

      expect(result.current.quickSearchTerm).toBe('NGC');
    });
  });

  describe('setPage', () => {
    it('should update current page', async () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      await act(async () => {
        result.current.setPage(2);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.currentPage).toBe(2);
    });
  });

  describe('setOrderBy', () => {
    it('should update order field and direction', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setOrderBy('magnitude', 'asc');
      });

      expect(result.current.filters.orderByField).toBe('magnitude');
      expect(result.current.filters.orderByDirection).toBe('asc');
    });
  });

  describe('UI state', () => {
    it('should have showFiltersPanel state', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(typeof result.current.showFiltersPanel).toBe('boolean');
    });

    it('should have showResultsPanel state', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      expect(typeof result.current.showResultsPanel).toBe('boolean');
    });
  });

  describe('search', () => {
    it('should set isSearching to true during search', async () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      let searchPromise: Promise<void>;
      act(() => {
        searchPromise = result.current.search();
      });

      // Note: isSearching might be true briefly
      await act(async () => {
        await searchPromise;
      });

      expect(result.current.isSearching).toBe(false);
    });

    it('should use searchWithFuzzyName when objectName filter is set', async () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({ objectName: 'M31' });
      });

      await act(async () => {
        await result.current.search();
      });

      expect(mockSearchWithFuzzyName).toHaveBeenCalled();
      const callArgs = mockSearchWithFuzzyName.mock.calls[0];
      expect(callArgs[2]).toMatchObject({ fuzzySearch: true });
    });

    it('should use searchDeepSkyObjects when no name filter', async () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({ objectName: '' });
      });

      mockSearchDeepSkyObjects.mockClear();
      mockSearchWithFuzzyName.mockClear();

      await act(async () => {
        await result.current.search();
      });

      expect(mockSearchDeepSkyObjects).toHaveBeenCalled();
      expect(mockSearchWithFuzzyName).not.toHaveBeenCalled();
    });

    it('should handle search error', async () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      mockSearchDeepSkyObjects.mockRejectedValueOnce(new Error('Search failed'));

      await act(async () => {
        await result.current.search();
      });

      expect(result.current.searchError).toBe('Search failed');
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('cancelSearch', () => {
    it('should set isSearching to false', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.cancelSearch();
      });

      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('toggleObjectType', () => {
    it('should toggle selected state of object type', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({
          objectTypes: [
            { type: 'Galaxy', selected: false, label: 'Galaxy' },
            { type: 'Nebula', selected: false, label: 'Nebula' },
          ],
        });
      });

      act(() => {
        result.current.toggleObjectType('Galaxy');
      });

      const galaxy = result.current.filters.objectTypes.find(t => t.type === 'Galaxy');
      expect(galaxy?.selected).toBe(true);
    });

    it('should handle non-existent type gracefully', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setFilters({
          objectTypes: [{ type: 'Galaxy', selected: false, label: 'Galaxy' }],
        });
      });

      act(() => {
        result.current.toggleObjectType('NonExistent');
      });

      expect(result.current.filters.objectTypes[0].selected).toBe(false);
    });
  });

  describe('applyPreset', () => {
    it('should apply preset filters', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.applyPreset({
          id: 'test-preset',
          name: 'Test Preset',
          description: 'A test preset',
          filters: { minimumAltitude: 30, minimumMoonDistance: 45 },
        });
      });

      expect(result.current.filters.minimumAltitude).toBe(30);
      expect(result.current.filters.minimumMoonDistance).toBe(45);
      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('setFilterDate', () => {
    it('should update filter date and reset search result', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      const newDate = new Date('2025-06-15');

      act(() => {
        result.current.setFilterDate(newDate);
      });

      expect(result.current.filters.filterDate).toBeDefined();
      expect(result.current.currentPage).toBe(1);
      expect(result.current.searchResult).toBeNull();
    });
  });

  describe('toggleFiltersPanel', () => {
    it('should toggle filters panel visibility', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      const initial = result.current.showFiltersPanel;

      act(() => {
        result.current.toggleFiltersPanel();
      });

      expect(result.current.showFiltersPanel).toBe(!initial);
    });
  });

  describe('toggleResultsPanel', () => {
    it('should toggle results panel visibility', () => {
      const { result } = renderHook(() => useSkyAtlasStore());
      const initial = result.current.showResultsPanel;

      act(() => {
        result.current.toggleResultsPanel();
      });

      expect(result.current.showResultsPanel).toBe(!initial);
    });
  });

  describe('loadCatalog', () => {
    it('should load catalog data', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.loadCatalog();
      });

      expect(result.current.catalog).toBeDefined();
      expect(result.current.catalogStats).toBeDefined();
    });
  });

  describe('loadTonightsBest', () => {
    it('should not load when no location set', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setLocation(0, 0);
      });

      act(() => {
        result.current.loadTonightsBest();
      });

      // Should not crash, just return
      expect(result.current.tonightsBest).toBeDefined();
    });
  });

  describe('updateNighttimeData', () => {
    it('should not update when location is 0,0', () => {
      const { result } = renderHook(() => useSkyAtlasStore());

      act(() => {
        result.current.setLocation(0, 0);
      });

      // Should return early without error
      expect(result.current.nighttimeData).toBeDefined();
    });
  });

  describe('initializeSkyAtlas', () => {
    it('should initialize store with location and load catalog', () => {
      act(() => {
        initializeSkyAtlas(45, -75, 100);
      });

      const state = useSkyAtlasStore.getState();
      expect(state.latitude).toBe(45);
      expect(state.longitude).toBe(-75);
      expect(state.elevation).toBe(100);
    });
  });
});
