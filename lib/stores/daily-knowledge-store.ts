import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';
import { getZustandStorage } from '@/lib/storage';
import { getDailyKnowledge } from '@/lib/services/daily-knowledge';
import {
  DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS,
  HISTORY_LIMIT,
} from '@/lib/services/daily-knowledge/constants';
import type {
  DailyKnowledgeFallbackReason,
  DailyKnowledgeFilters,
  DailyKnowledgeHistory,
  DailyKnowledgeHistoryEntry,
  DailyKnowledgeItem,
  DailyKnowledgeFavorite,
  DailyKnowledgeResolutionMode,
  DailyKnowledgeSourceStatus,
} from '@/lib/services/daily-knowledge/types';
import { useSettingsStore } from './settings-store';
import { useStellariumStore } from './stellarium-store';
import { resolveObjectName } from '@/lib/services/online-search-service';
import { isMobile } from '@/lib/storage/platform';

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DEFAULT_FILTERS: DailyKnowledgeFilters = {
  query: '',
  category: 'all',
  source: 'all',
  favoritesOnly: false,
};

interface DailyKnowledgePersistedState {
  favorites: DailyKnowledgeFavorite[];
  history: DailyKnowledgeHistory[];
  lastShownDate: string | null;
  snoozedDate: string | null;
  lastSeenItemId: string | null;
  viewMode: 'pager' | 'feed';
  wheelPagingEnabled: boolean;
}

interface DailyKnowledgeState extends DailyKnowledgePersistedState {
  open: boolean;
  loading: boolean;
  error: string | null;
  currentItem: DailyKnowledgeItem | null;
  items: DailyKnowledgeItem[];
  sourceStatuses: DailyKnowledgeSourceStatus[];
  usedCuratedFallback: boolean;
  fallbackReason: DailyKnowledgeFallbackReason;
  resolutionMode: DailyKnowledgeResolutionMode;
  filters: DailyKnowledgeFilters;

  openDialog: (entry?: DailyKnowledgeHistoryEntry) => Promise<void>;
  closeDialog: () => void;
  loadDaily: (entry?: DailyKnowledgeHistoryEntry) => Promise<void>;
  loadByDate: (dateKey: string, entry?: DailyKnowledgeHistoryEntry) => Promise<void>;
  refreshCurrentDate: (entry?: DailyKnowledgeHistoryEntry) => Promise<void>;
  next: () => void;
  prev: () => void;
  random: () => void;
  toggleFavorite: (itemId: string) => void;
  markDontShowToday: () => void;
  clearSnooze: () => void;
  recordHistory: (itemId: string, entry: DailyKnowledgeHistoryEntry, dateKey: string) => void;
  goToRelatedObject: (related: { name: string; ra?: number; dec?: number }) => Promise<void>;
  setFilters: (filters: Partial<DailyKnowledgeFilters>) => void;
  setCurrentItemById: (itemId: string) => void;
  setViewMode: (mode: 'pager' | 'feed') => void;
  setWheelPagingEnabled: (enabled: boolean) => void;
  shouldAutoShowToday: () => boolean;
  hydrateFromImport: (state: Partial<DailyKnowledgePersistedState>) => void;
}

function trimHistory(history: DailyKnowledgeHistory[]): DailyKnowledgeHistory[] {
  return history
    .sort((a, b) => b.shownAt - a.shownAt)
    .slice(0, HISTORY_LIMIT);
}

function getRecentHistoryItemIds(
  history: DailyKnowledgeHistory[],
  repeatWindowDays: number,
  nowMs = Date.now()
): string[] {
  if (repeatWindowDays <= 0) return [];
  const cutoff = nowMs - repeatWindowDays * 24 * 60 * 60 * 1000;
  const recent = history.filter((entry) => entry.shownAt >= cutoff).map((entry) => entry.itemId);
  return Array.from(new Set(recent));
}

export const useDailyKnowledgeStore = create<DailyKnowledgeState>()(
  persist(
    (set, get) => ({
      favorites: [],
      history: [],
      lastShownDate: null,
      snoozedDate: null,
      lastSeenItemId: null,
      viewMode: isMobile() ? 'feed' : 'pager',
      wheelPagingEnabled: false,
      open: false,
      loading: false,
      error: null,
      currentItem: null,
      items: [],
      sourceStatuses: [],
      usedCuratedFallback: false,
      fallbackReason: null,
      resolutionMode: 'curated-fallback',
      filters: DEFAULT_FILTERS,

      openDialog: async (entry = 'manual') => {
        if (!useSettingsStore.getState().preferences.dailyKnowledgeEnabled) return;
        set({ open: true });
        const state = get();
        const today = getLocalDateKey();
        const shouldRefreshForToday =
          state.items.length === 0 || state.items[0]?.dateKey !== today;

        if (shouldRefreshForToday) {
          await get().loadDaily(entry);
        } else if (state.currentItem) {
          const current = state.currentItem;
          get().recordHistory(current.id, entry, current.dateKey);
        }
      },

      closeDialog: () => set({ open: false }),

      loadDaily: async (entry = 'manual') => {
        const dateKey = getLocalDateKey();
        await get().loadByDate(dateKey, entry);
      },

      refreshCurrentDate: async (entry = 'manual') => {
        const activeDateKey =
          get().currentItem?.dateKey ?? get().items[0]?.dateKey ?? getLocalDateKey();
        await get().loadByDate(activeDateKey, entry);
      },

      loadByDate: async (dateKey, entry = 'manual') => {
        const settings = useSettingsStore.getState();
        const locale = settings.preferences.locale;
        const recentHistoryItemIds = getRecentHistoryItemIds(
          get().history,
          DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS
        );
        const previousCurrentItemId =
          get().currentItem?.dateKey === dateKey ? get().currentItem?.id : null;
        set({ loading: true, error: null });
        try {
          const result = await getDailyKnowledge(dateKey, locale, {
            locale,
            onlineEnhancement: settings.preferences.dailyKnowledgeOnlineEnhancement,
            recentHistoryItemIds,
            repeatWindowDays: DAILY_KNOWLEDGE_REPEAT_WINDOW_DAYS,
          });
          const nextCurrentItem =
            (previousCurrentItemId
              ? result.items.find((item) => item.id === previousCurrentItemId) ?? null
              : null) ?? result.selected;
          set({
            loading: false,
            items: result.items,
            currentItem: nextCurrentItem,
            sourceStatuses: result.sourceStatuses,
            usedCuratedFallback: result.usedCuratedFallback,
            fallbackReason: result.fallbackReason,
            resolutionMode: result.resolutionMode,
            lastSeenItemId: nextCurrentItem.id,
            lastShownDate: entry === 'auto' ? dateKey : get().lastShownDate,
          });
          get().recordHistory(nextCurrentItem.id, entry, dateKey);
        } catch {
          set({
            loading: false,
            error: 'dailyKnowledge.loadFailed',
            sourceStatuses: [],
            usedCuratedFallback: false,
            fallbackReason: null,
            resolutionMode: get().resolutionMode,
          });
        }
      },

      next: () => {
        const { items, currentItem } = get();
        if (!currentItem || items.length === 0) return;
        const idx = items.findIndex((item) => item.id === currentItem.id);
        const nextItem = items[(idx + 1 + items.length) % items.length];
        set({ currentItem: nextItem, lastSeenItemId: nextItem.id });
        get().recordHistory(nextItem.id, 'manual', nextItem.dateKey);
      },

      prev: () => {
        const { items, currentItem } = get();
        if (!currentItem || items.length === 0) return;
        const idx = items.findIndex((item) => item.id === currentItem.id);
        const prevItem = items[(idx - 1 + items.length) % items.length];
        set({ currentItem: prevItem, lastSeenItemId: prevItem.id });
        get().recordHistory(prevItem.id, 'manual', prevItem.dateKey);
      },

      random: () => {
        const { items } = get();
        if (items.length === 0) return;
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];
        set({ currentItem: randomItem, lastSeenItemId: randomItem.id });
        get().recordHistory(randomItem.id, 'random', randomItem.dateKey);
      },

      toggleFavorite: (itemId) => {
        set((state) => {
          const existing = state.favorites.find((fav) => fav.itemId === itemId);
          if (existing) {
            return {
              favorites: state.favorites.filter((fav) => fav.itemId !== itemId),
            };
          }
          return {
            favorites: [...state.favorites, { itemId, createdAt: Date.now() }],
          };
        });
      },

      markDontShowToday: () => {
        const today = getLocalDateKey();
        set({ snoozedDate: today });
      },

      clearSnooze: () => set({ snoozedDate: null }),

      recordHistory: (itemId, entry, dateKey) => {
        set((state) => ({
          history: trimHistory([
            {
              itemId,
              entry,
              dateKey,
              shownAt: Date.now(),
            },
            ...state.history,
          ]),
        }));
      },

      goToRelatedObject: async (related) => {
        const setViewDirection = useStellariumStore.getState().setViewDirection;
        if (!setViewDirection) {
          toast.error('Sky engine is not ready');
          return;
        }

        if (typeof related.ra === 'number' && typeof related.dec === 'number') {
          setViewDirection(related.ra, related.dec);
          return;
        }

        try {
          const resolved = await resolveObjectName(related.name);
          if (resolved) {
            setViewDirection(resolved.ra, resolved.dec);
            return;
          }
        } catch {
          // fall through to toast
        }
        toast.error(`Unable to locate ${related.name}`);
      },

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      setCurrentItemById: (itemId) => {
        const item = get().items.find((entry) => entry.id === itemId);
        if (!item) return;
        set({ currentItem: item, lastSeenItemId: item.id });
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      setWheelPagingEnabled: (enabled) => set({ wheelPagingEnabled: enabled }),

      shouldAutoShowToday: () => {
        const settings = useSettingsStore.getState().preferences;
        if (!settings.dailyKnowledgeEnabled || !settings.dailyKnowledgeAutoShow) return false;
        const today = getLocalDateKey();
        const state = get();
        if (state.snoozedDate === today) return false;
        return state.lastShownDate !== today;
      },

      hydrateFromImport: (state) =>
        set((prev) => ({
          favorites: state.favorites ?? prev.favorites,
          history: state.history ? trimHistory(state.history) : prev.history,
          lastShownDate: state.lastShownDate ?? prev.lastShownDate,
          snoozedDate: state.snoozedDate ?? prev.snoozedDate,
          lastSeenItemId: state.lastSeenItemId ?? prev.lastSeenItemId,
          viewMode: state.viewMode ?? prev.viewMode,
          wheelPagingEnabled: state.wheelPagingEnabled ?? prev.wheelPagingEnabled,
        })),
    }),
    {
      name: 'starmap-daily-knowledge',
      storage: getZustandStorage(),
      version: 1,
      partialize: (state) => ({
        favorites: state.favorites,
        history: state.history,
        lastShownDate: state.lastShownDate,
        snoozedDate: state.snoozedDate,
        lastSeenItemId: state.lastSeenItemId,
        viewMode: state.viewMode,
        wheelPagingEnabled: state.wheelPagingEnabled,
      }),
    }
  )
);
