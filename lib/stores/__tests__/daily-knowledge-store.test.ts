/**
 * @jest-environment jsdom
 */

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/lib/services/daily-knowledge', () => ({
  getDailyKnowledge: jest.fn(),
}));

jest.mock('@/lib/services/online-search-service', () => ({
  resolveObjectName: jest.fn(),
}));

import { useDailyKnowledgeStore, getLocalDateKey } from '../daily-knowledge-store';
import { useSettingsStore } from '../settings-store';
import { useStellariumStore } from '../stellarium-store';
import { getDailyKnowledge } from '@/lib/services/daily-knowledge';
import { resolveObjectName } from '@/lib/services/online-search-service';

const mockGetDailyKnowledge = getDailyKnowledge as jest.MockedFunction<typeof getDailyKnowledge>;
const mockResolveObjectName = resolveObjectName as jest.MockedFunction<typeof resolveObjectName>;

const baseResult = {
  requestedDateKey: '2026-02-20',
  items: [
    {
      id: 'curated-andromeda-distance',
      dateKey: '2026-02-20',
      source: 'curated' as const,
      title: 'Andromeda Is A Time Machine',
      summary: 'summary',
      body: 'body',
      contentLanguage: 'en',
      categories: ['object' as const],
      tags: ['M31'],
      relatedObjects: [{ name: 'M31', ra: 10.6847, dec: 41.2687 }],
      attribution: { sourceName: 'Curated' },
      isDateEvent: false,
      factSources: [{ title: 'SEDS M31', url: 'https://messier.seds.org/m/m031.html', publisher: 'SEDS' }],
      difficulty: 'intermediate' as const,
      bestViewingMonths: [1, 2, 3, 10, 11, 12],
      observationTips: ['Tip A', 'Tip B'],
      languageStatus: 'native' as const,
      fetchedAt: Date.now(),
    },
  ],
  selected: {
    id: 'curated-andromeda-distance',
    dateKey: '2026-02-20',
    source: 'curated' as const,
    title: 'Andromeda Is A Time Machine',
    summary: 'summary',
    body: 'body',
    contentLanguage: 'en',
    categories: ['object' as const],
    tags: ['M31'],
    relatedObjects: [{ name: 'M31', ra: 10.6847, dec: 41.2687 }],
    attribution: { sourceName: 'Curated' },
    isDateEvent: false,
    factSources: [{ title: 'SEDS M31', url: 'https://messier.seds.org/m/m031.html', publisher: 'SEDS' }],
    difficulty: 'intermediate' as const,
    bestViewingMonths: [1, 2, 3, 10, 11, 12],
    observationTips: ['Tip A', 'Tip B'],
    languageStatus: 'native' as const,
    fetchedAt: Date.now(),
  },
  sourceStatuses: [
    {
      source: 'nasa-image-library' as const,
      transport: 'api' as const,
      state: 'healthy' as const,
      reason: 'success' as const,
      itemCount: 1,
    },
  ],
  usedCuratedFallback: false,
  fallbackReason: null,
  resolutionMode: 'fresh-online' as const,
};

function resetDailyStore() {
  useDailyKnowledgeStore.setState({
    favorites: [],
    history: [],
    lastShownDate: null,
    snoozedDate: null,
    lastSeenItemId: null,
    viewMode: 'pager',
    wheelPagingEnabled: false,
    open: false,
    activeDateKey: getLocalDateKey(),
    loading: false,
    error: null,
    currentItem: null,
    items: [],
    sourceStatuses: [],
    usedCuratedFallback: false,
    fallbackReason: null,
    resolutionMode: 'curated-fallback',
    filters: {
      query: '',
      category: 'all',
      source: 'all',
      favoritesOnly: false,
    },
  });
}

describe('daily-knowledge-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDailyStore();
    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeEnabled: true,
        dailyKnowledgeAutoShow: true,
        dailyKnowledgeOnlineEnhancement: true,
      },
    }));
    useStellariumStore.setState({
      setViewDirection: jest.fn(),
    });
    mockGetDailyKnowledge.mockResolvedValue(baseResult);
  });

  it('toggles favorites', () => {
    const store = useDailyKnowledgeStore.getState();

    store.toggleFavorite('curated-andromeda-distance');
    expect(useDailyKnowledgeStore.getState().favorites).toHaveLength(1);

    store.toggleFavorite('curated-andromeda-distance');
    expect(useDailyKnowledgeStore.getState().favorites).toHaveLength(0);
  });

  it('persists reader UI preferences', () => {
    const store = useDailyKnowledgeStore.getState();
    expect(store.viewMode).toBe('pager');
    expect(store.wheelPagingEnabled).toBe(false);

    store.setViewMode('feed');
    store.setWheelPagingEnabled(true);

    const next = useDailyKnowledgeStore.getState();
    expect(next.viewMode).toBe('feed');
    expect(next.wheelPagingEnabled).toBe(true);
  });

  it('caps history to 120 entries', () => {
    const store = useDailyKnowledgeStore.getState();
    for (let i = 0; i < 140; i += 1) {
      store.recordHistory(`item-${i}`, 'manual', '2026-02-20');
    }

    const history = useDailyKnowledgeStore.getState().history;
    expect(history).toHaveLength(120);
    expect(history[0].itemId).toBe('item-139');
  });

  it('marks do-not-show-today and blocks auto-show', () => {
    const store = useDailyKnowledgeStore.getState();

    expect(store.shouldAutoShowToday()).toBe(true);
    store.markDontShowToday();

    expect(useDailyKnowledgeStore.getState().snoozedDate).toBe(getLocalDateKey());
    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);
  });

  it('honors settings-based auto-show gating', () => {
    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeAutoShow: false,
      },
    }));
    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);

    useSettingsStore.setState((state) => ({
      preferences: {
        ...state.preferences,
        dailyKnowledgeAutoShow: true,
      },
    }));
    useDailyKnowledgeStore.setState({ lastShownDate: getLocalDateKey() });

    expect(useDailyKnowledgeStore.getState().shouldAutoShowToday()).toBe(false);
  });

  it('loads daily content and updates startup state for auto entry', async () => {
    await useDailyKnowledgeStore.getState().loadDaily('auto');

    const state = useDailyKnowledgeStore.getState();
    expect(state.currentItem?.id).toBe('curated-andromeda-distance');
    expect(state.lastShownDate).toBe(getLocalDateKey());
    expect(state.history[0].entry).toBe('auto');
    expect(state.sourceStatuses).toEqual(baseResult.sourceStatuses);
  });

  it('passes recent history IDs for repeat-avoidance selection', async () => {
    const now = Date.now();
    useDailyKnowledgeStore.setState({
      history: [
        { itemId: 'recent-item', shownAt: now - 2 * 24 * 60 * 60 * 1000, entry: 'manual', dateKey: '2026-02-18' },
        { itemId: 'old-item', shownAt: now - 12 * 24 * 60 * 60 * 1000, entry: 'manual', dateKey: '2026-02-08' },
      ],
    });

    await useDailyKnowledgeStore.getState().loadByDate('2026-02-20', 'manual');

    expect(mockGetDailyKnowledge).toHaveBeenCalledWith(
      '2026-02-20',
      'en',
      expect.objectContaining({
        recentHistoryItemIds: ['recent-item'],
        repeatWindowDays: 7,
      })
    );
  });

  it('refreshes stale cached items when opening dialog on a new date', async () => {
    useDailyKnowledgeStore.setState({
      items: [
        {
          ...baseResult.items[0],
          id: 'yesterday-item',
          dateKey: '2026-02-19',
        },
      ],
      currentItem: {
        ...baseResult.items[0],
        id: 'yesterday-item',
        dateKey: '2026-02-19',
      },
    });

    await useDailyKnowledgeStore.getState().openDialog('manual');

    expect(mockGetDailyKnowledge).toHaveBeenCalled();
    expect(useDailyKnowledgeStore.getState().currentItem?.id).toBe('curated-andromeda-distance');
  });

  it('refreshes the active date without resetting filters or view mode and preserves current item when available', async () => {
    const preservedItem = {
      ...baseResult.selected,
      id: 'preserved-item',
      title: 'Preserved Item',
    };
    const freshSelected = {
      ...baseResult.selected,
      id: 'fresh-selected',
      title: 'Fresh Selected',
    };

    mockGetDailyKnowledge.mockResolvedValue({
      ...baseResult,
      items: [freshSelected, preservedItem],
      selected: freshSelected,
      resolutionMode: 'fresh-online',
    });

    useDailyKnowledgeStore.setState({
      items: [preservedItem],
      currentItem: preservedItem,
      activeDateKey: '2026-02-20',
      filters: {
        query: 'm31',
        category: 'all',
        source: 'all',
        favoritesOnly: false,
      },
      viewMode: 'feed',
    });

    await useDailyKnowledgeStore.getState().refreshCurrentDate();

    const state = useDailyKnowledgeStore.getState();
    expect(mockGetDailyKnowledge).toHaveBeenCalledWith(
      '2026-02-20',
      'en',
      expect.objectContaining({ onlineEnhancement: true })
    );
    expect(state.currentItem?.id).toBe('preserved-item');
    expect(state.filters.query).toBe('m31');
    expect(state.viewMode).toBe('feed');
    expect(state.resolutionMode).toBe('fresh-online');
  });

  it('tracks active date and can browse adjacent dates without resetting interaction state', async () => {
    mockGetDailyKnowledge
      .mockResolvedValueOnce({
        ...baseResult,
        requestedDateKey: '2026-02-20',
      })
      .mockResolvedValueOnce({
        ...baseResult,
        requestedDateKey: '2026-02-21',
        items: [
          {
            ...baseResult.selected,
            id: 'next-day-item',
            dateKey: '2026-02-21',
            title: 'Next Day Item',
          },
        ],
        selected: {
          ...baseResult.selected,
          id: 'next-day-item',
          dateKey: '2026-02-21',
          title: 'Next Day Item',
        },
      });

    useDailyKnowledgeStore.setState({
      activeDateKey: '2026-02-20',
      filters: {
        query: 'm31',
        category: 'all',
        source: 'all',
        favoritesOnly: false,
      },
      viewMode: 'feed',
    });

    await useDailyKnowledgeStore.getState().loadByDate('2026-02-20', 'manual');
    await useDailyKnowledgeStore.getState().browseNextDate();

    const state = useDailyKnowledgeStore.getState();
    expect(mockGetDailyKnowledge).toHaveBeenLastCalledWith(
      '2026-02-21',
      'en',
      expect.objectContaining({ onlineEnhancement: true })
    );
    expect(state.activeDateKey).toBe('2026-02-21');
    expect(state.currentItem?.dateKey).toBe('2026-02-21');
    expect(state.filters.query).toBe('m31');
    expect(state.viewMode).toBe('feed');
  });

  it('returns to today after browsing another date', async () => {
    useDailyKnowledgeStore.setState({
      activeDateKey: '2026-02-18',
    });

    mockGetDailyKnowledge.mockResolvedValue({
      ...baseResult,
      requestedDateKey: getLocalDateKey(),
      items: [
        {
          ...baseResult.selected,
          id: 'today-item',
          dateKey: getLocalDateKey(),
        },
      ],
      selected: {
        ...baseResult.selected,
        id: 'today-item',
        dateKey: getLocalDateKey(),
      },
    });

    await useDailyKnowledgeStore.getState().goToToday('manual');

    expect(mockGetDailyKnowledge).toHaveBeenCalledWith(
      getLocalDateKey(),
      'en',
      expect.objectContaining({ onlineEnhancement: true })
    );
    expect(useDailyKnowledgeStore.getState().activeDateKey).toBe(getLocalDateKey());
  });

  it('falls back to the refreshed selected item when the previous current item disappears', async () => {
    const missingItem = {
      ...baseResult.selected,
      id: 'missing-item',
      title: 'Missing Item',
    };
    const refreshedSelected = {
      ...baseResult.selected,
      id: 'refreshed-selected',
      title: 'Refreshed Selected',
    };

    mockGetDailyKnowledge.mockResolvedValue({
      ...baseResult,
      items: [refreshedSelected],
      selected: refreshedSelected,
      resolutionMode: 'stale-cache',
    });

    useDailyKnowledgeStore.setState({
      items: [missingItem],
      currentItem: missingItem,
    });

    await useDailyKnowledgeStore.getState().refreshCurrentDate();

    const state = useDailyKnowledgeStore.getState();
    expect(state.currentItem?.id).toBe('refreshed-selected');
    expect(state.resolutionMode).toBe('stale-cache');
  });

  it('jumps using embedded coordinates before name resolution', async () => {
    const setViewDirection = jest.fn();
    useStellariumStore.setState({ setViewDirection });

    await useDailyKnowledgeStore.getState().goToRelatedObject({
      name: 'M31',
      ra: 10.6847,
      dec: 41.2687,
    });

    expect(setViewDirection).toHaveBeenCalledWith(10.6847, 41.2687);
    expect(mockResolveObjectName).not.toHaveBeenCalled();
  });

  it('resolves object name when coordinates are not provided', async () => {
    const setViewDirection = jest.fn();
    useStellariumStore.setState({ setViewDirection });
    mockResolveObjectName.mockResolvedValue({
      id: 'm42',
      name: 'M42',
      canonicalId: 'M42',
      identifiers: ['M42'],
      confidence: 0.9,
      category: 'nebula',
      type: 'Nebula',
      ra: 83.8221,
      dec: -5.3911,
      source: 'sesame',
    });

    await useDailyKnowledgeStore.getState().goToRelatedObject({ name: 'M42' });

    expect(mockResolveObjectName).toHaveBeenCalledWith('M42');
    expect(setViewDirection).toHaveBeenCalledWith(83.8221, -5.3911);
  });
});
