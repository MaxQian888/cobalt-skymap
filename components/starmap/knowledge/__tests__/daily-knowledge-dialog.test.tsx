/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DailyKnowledgeDialog } from '../daily-knowledge-dialog';
import { isMobile } from '@/lib/storage/platform';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockCopyTextWithFeedback = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/lib/storage/platform', () => ({
  isMobile: jest.fn(() => false),
}));

jest.mock('@/lib/utils/clipboard-feedback', () => ({
  copyTextWithFeedback: (...args: unknown[]) => mockCopyTextWithFeedback(...args),
}));

const itemA = {
  id: 'item-a',
  dateKey: '2026-02-20',
  source: 'curated' as const,
  title: 'Item A',
  summary: 'Summary A',
  body: 'Body A',
  contentLanguage: 'en',
  categories: ['object' as const],
  tags: ['m31'],
  relatedObjects: [{ name: 'M31', ra: 10.68, dec: 41.26 }],
  isDateEvent: true,
  eventMonthDay: '02-20',
  factSources: [{ title: 'SEDS M31', url: 'https://messier.seds.org/m/m031.html', publisher: 'SEDS' }],
  difficulty: 'intermediate' as const,
  bestViewingMonths: [2, 10, 11],
  observationTips: ['Use stable seeing windows first.', 'Log capture settings for comparison.'],
  languageStatus: 'fallback' as const,
  attribution: {
    sourceName: 'Curated',
    licenseName: 'CC BY-SA',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  externalUrl: 'https://example.com/a',
  fetchedAt: 1,
};

const itemB = {
  ...itemA,
  id: 'item-b',
  title: 'Item B',
  summary: 'Summary B',
  tags: ['m42'],
  relatedObjects: [{ name: 'M42' }],
  fetchedAt: 2,
};

const mockStore: {
  open: boolean;
  loading: boolean;
  error: string | null;
  items: Array<Record<string, unknown>>;
  currentItem: Record<string, unknown> | null;
  favorites: Array<{ itemId: string; createdAt: number }>;
  history: Array<{ itemId: string; shownAt: number; entry: string; dateKey: string }>;
  filters: { query: string; category: string; source: string; favoritesOnly: boolean };
  sourceStatuses: Array<{ source: string; state: string; reason: string; itemCount: number; transport: string }>;
  usedCuratedFallback: boolean;
  closeDialog: jest.Mock;
  loadDaily: jest.Mock;
  next: jest.Mock;
  prev: jest.Mock;
  random: jest.Mock;
  toggleFavorite: jest.Mock;
  setFilters: jest.Mock;
  setCurrentItemById: jest.Mock;
  markDontShowToday: jest.Mock;
  goToRelatedObject: jest.Mock;
  recordHistory: jest.Mock;
  viewMode: 'pager' | 'feed';
  setViewMode: jest.Mock;
  wheelPagingEnabled: boolean;
  setWheelPagingEnabled: jest.Mock;
} = {
  open: true,
  loading: false,
  error: null,
  items: [itemA, itemB],
  currentItem: itemA,
  favorites: [],
  history: [{ itemId: 'item-a', shownAt: Date.now(), entry: 'manual', dateKey: '2026-02-20' }],
  filters: {
    query: '',
    category: 'all',
    source: 'all',
    favoritesOnly: false,
  },
  sourceStatuses: [
    {
      source: 'nasa-image-library',
      state: 'failed',
      reason: 'error',
      itemCount: 0,
      transport: 'api',
    },
  ],
  usedCuratedFallback: true,
  closeDialog: jest.fn(),
  loadDaily: jest.fn(),
  next: jest.fn(),
  prev: jest.fn(),
  random: jest.fn(),
  toggleFavorite: jest.fn(),
  setFilters: jest.fn(),
  setCurrentItemById: jest.fn(),
  markDontShowToday: jest.fn(),
  goToRelatedObject: jest.fn(),
  recordHistory: jest.fn(),
  viewMode: 'pager',
  setViewMode: jest.fn(),
  wheelPagingEnabled: false,
  setWheelPagingEnabled: jest.fn(),
};

jest.mock('@/lib/stores', () => ({
  useDailyKnowledgeStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}));

function findButtonByIcon(iconClass: string): HTMLButtonElement {
  const iconName = iconClass.replace(/^lucide-/, '');
  const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.querySelector(`svg.${iconClass}, svg[data-lucide="${iconName}"]`)
  );
  if (!button) {
    throw new Error(`Button not found for ${iconClass}`);
  }
  return button as HTMLButtonElement;
}

describe('daily-knowledge-dialog', () => {
  const mockIsMobile = isMobile as jest.MockedFunction<typeof isMobile>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile.mockReturnValue(false);
    mockStore.open = true;
    mockStore.loading = false;
    mockStore.error = null;
    mockStore.items = [itemA, itemB];
    mockStore.currentItem = itemA;
    mockStore.favorites = [];
    mockStore.history = [{ itemId: 'item-a', shownAt: Date.now(), entry: 'manual', dateKey: '2026-02-20' }];
    mockStore.filters = {
      query: '',
      category: 'all',
      source: 'all',
      favoritesOnly: false,
    };
    mockStore.sourceStatuses = [
      {
        source: 'nasa-image-library',
        state: 'failed',
        reason: 'error',
        itemCount: 0,
        transport: 'api',
      },
    ];
    mockStore.usedCuratedFallback = true;
    mockStore.viewMode = 'pager';
    mockStore.wheelPagingEnabled = false;
    mockCopyTextWithFeedback.mockResolvedValue(true);

    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(new Error('share-failed')),
    });
    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('supports search/filter controls and navigation buttons', () => {
    render(<DailyKnowledgeDialog />);

    fireEvent.change(screen.getByPlaceholderText('dailyKnowledge.searchPlaceholder'), {
      target: { value: 'M31' },
    });
    expect(mockStore.setFilters).toHaveBeenCalledWith({ query: 'M31' });

    fireEvent.click(findButtonByIcon('lucide-chevron-left'));
    fireEvent.click(findButtonByIcon('lucide-chevron-right'));
    fireEvent.click(findButtonByIcon('lucide-shuffle'));

    expect(mockStore.prev).toHaveBeenCalled();
    expect(mockStore.next).toHaveBeenCalled();
    expect(mockStore.random).toHaveBeenCalled();
  });

  it('supports pager/feed mode switch controls', () => {
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.viewModeFeed' }));
    expect(mockStore.setViewMode).toHaveBeenCalledWith('feed');
  });

  it('renders event badge, language status, and fact source link', () => {
    render(<DailyKnowledgeDialog />);

    expect(screen.getByText('dailyKnowledge.eventOfToday')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.languageStatus.fallback')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.fallbackNotice')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.factSources')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.practicalInsights')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.observationTips')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.difficultyBadge.intermediate')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.curatedFallbackNotice')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.sourceStatus.nasa-image-library.error')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /SEDS M31/ })).toHaveAttribute(
      'href',
      'https://messier.seds.org/m/m031.html'
    );
  });

  it('supports favorite/history and related-object jump', () => {
    render(<DailyKnowledgeDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.favorite' }));
    expect(mockStore.toggleFavorite).toHaveBeenCalledWith('item-a');

    fireEvent.click(findButtonByIcon('lucide-history'));
    fireEvent.click(screen.getByRole('button', { name: /Item A/ }));
    expect(mockStore.setCurrentItemById).toHaveBeenCalledWith('item-a');

    fireEvent.click(screen.getByRole('button', { name: /M31/ }));
    expect(mockStore.goToRelatedObject).toHaveBeenCalledWith({ name: 'M31', ra: 10.68, dec: 41.26 });
  });

  it('handles ArrowLeft/ArrowRight in pager mode', () => {
    mockStore.viewMode = 'pager';
    render(<DailyKnowledgeDialog />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(mockStore.prev).toHaveBeenCalledTimes(1);
    expect(mockStore.next).toHaveBeenCalledTimes(1);
  });

  it('does not bind keyboard handler in feed mode', () => {
    mockStore.viewMode = 'feed';
    render(<DailyKnowledgeDialog />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(mockStore.next).not.toHaveBeenCalled();
  });

  it('does not page on wheel when toggle is disabled', () => {
    mockStore.viewMode = 'pager';
    mockStore.wheelPagingEnabled = false;
    render(<DailyKnowledgeDialog />);
    fireEvent.wheel(window, { deltaY: 100 });
    expect(mockStore.next).not.toHaveBeenCalled();
  });

  it('pages once per throttle window when wheel paging is enabled', () => {
    jest.useFakeTimers();
    mockStore.viewMode = 'pager';
    mockStore.wheelPagingEnabled = true;
    render(<DailyKnowledgeDialog />);
    fireEvent.wheel(window, { deltaY: 120 });
    fireEvent.wheel(window, { deltaY: 120 });
    expect(mockStore.next).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(320);
    fireEvent.wheel(window, { deltaY: 120 });
    expect(mockStore.next).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('renders feed cards and sets current item on card click', () => {
    mockStore.viewMode = 'feed';
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Item B' }));
    expect(mockStore.setCurrentItemById).toHaveBeenCalledWith('item-b');
    expect(screen.getAllByText('dailyKnowledge.observationTips').length).toBeGreaterThan(0);
  });

  it('uses share->clipboard fallback and supports copy action', async () => {
    render(<DailyKnowledgeDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.share' }));
    await Promise.resolve();

    const shareMock = global.navigator.share as jest.Mock;
    expect(shareMock).toHaveBeenCalled();
    expect(mockCopyTextWithFeedback).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.copy' }));
    await Promise.resolve();
    expect(mockCopyTextWithFeedback).toHaveBeenCalledTimes(2);
  });

  it('shows loading state', () => {
    mockStore.loading = true;
    mockStore.currentItem = null;
    render(<DailyKnowledgeDialog />);
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Item A')).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    mockStore.error = 'dailyKnowledge.loadFailed';
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.loadFailed')).toBeInTheDocument();
  });

  it('shows no results when items list is empty', () => {
    mockStore.items = [];
    mockStore.currentItem = null;
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.noResults')).toBeInTheDocument();
  });

  it('calls markDontShowToday and closeDialog on dont-show-today button', () => {
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.dontShowToday' }));
    expect(mockStore.markDontShowToday).toHaveBeenCalled();
    expect(mockStore.closeDialog).toHaveBeenCalled();
  });

  it('calls closeDialog on close button', () => {
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(mockStore.closeDialog).toHaveBeenCalled();
  });

  it('opens external url in new window', () => {
    const windowOpenSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.openSource' }));
    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com/a', '_blank', 'noopener,noreferrer');
    windowOpenSpy.mockRestore();
  });

  it('hides external link button when no externalUrl', () => {
    const itemNoExternal = { ...itemA, externalUrl: undefined as string | undefined };
    mockStore.items = [itemNoExternal];
    mockStore.currentItem = itemNoExternal;
    render(<DailyKnowledgeDialog />);
    expect(screen.queryByRole('button', { name: 'dailyKnowledge.openSource' })).not.toBeInTheDocument();
  });

  it('renders image with thumbnailUrl and shows video hint', () => {
    const itemWithVideo = {
      ...itemA,
      image: { url: 'https://img.com/full.jpg', thumbnailUrl: 'https://img.com/thumb.jpg', type: 'video' as const },
    };
    mockStore.items = [itemWithVideo];
    mockStore.currentItem = itemWithVideo;
    render(<DailyKnowledgeDialog />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://img.com/thumb.jpg');
    expect(screen.getByText('dailyKnowledge.videoEntry')).toBeInTheDocument();
  });

  it('renders image url when no thumbnailUrl', () => {
    const itemWithImage = {
      ...itemA,
      image: { url: 'https://img.com/full.jpg', type: 'image' as const },
    };
    mockStore.items = [itemWithImage];
    mockStore.currentItem = itemWithImage;
    render(<DailyKnowledgeDialog />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://img.com/full.jpg');
    expect(screen.queryByText('dailyKnowledge.videoEntry')).not.toBeInTheDocument();
  });

  it('renders attribution copyright and license', () => {
    const itemWithCopyright = {
      ...itemA,
      attribution: {
        sourceName: 'NASA',
        copyright: '© NASA 2026',
        licenseName: 'Public Domain',
        licenseUrl: undefined as string | undefined,
      },
    };
    mockStore.items = [itemWithCopyright];
    mockStore.currentItem = itemWithCopyright;
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('NASA')).toBeInTheDocument();
    expect(screen.getByText('© NASA 2026')).toBeInTheDocument();
    expect(screen.getByText('Public Domain')).toBeInTheDocument();
  });

  it('shows noFactSources when factSources is empty', () => {
    const itemNoFacts = { ...itemA, factSources: [] };
    mockStore.items = [itemNoFacts];
    mockStore.currentItem = itemNoFacts;
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.noFactSources')).toBeInTheDocument();
  });

  it('renders favorited state when item is in favorites', () => {
    mockStore.favorites = [{ itemId: 'item-a', createdAt: Date.now() }];
    render(<DailyKnowledgeDialog />);
    expect(screen.getByRole('button', { name: 'dailyKnowledge.favorited' })).toBeInTheDocument();
  });

  it('shows empty history message', () => {
    mockStore.history = [];
    render(<DailyKnowledgeDialog />);
    fireEvent.click(findButtonByIcon('lucide-history'));
    expect(screen.getByText('dailyKnowledge.noHistory')).toBeInTheDocument();
  });

  it('shows toast error when clipboard write fails on copy', async () => {
    mockCopyTextWithFeedback.mockResolvedValueOnce(false);
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.copy' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: 'dailyKnowledge.copyFailed' })
    );
  });

  it('does not fallback to clipboard when share succeeds', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.share' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCopyTextWithFeedback).not.toHaveBeenCalled();
  });

  it('renders native language status badge', () => {
    const nativeItem = { ...itemA, languageStatus: 'native' as 'native' | 'fallback' };
    mockStore.items = [nativeItem];
    mockStore.currentItem = nativeItem;
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.languageStatus.native')).toBeInTheDocument();
    expect(screen.queryByText('dailyKnowledge.fallbackNotice')).not.toBeInTheDocument();
  });

  it('displays result count', () => {
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.resultCount')).toBeInTheDocument();
  });

  it('renders favorites toggle button and calls setFilters', () => {
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.favorites' }));
    expect(mockStore.setFilters).toHaveBeenCalledWith({ favoritesOnly: true });
  });

  it('filters items by query text matching title/summary/tags', () => {
    mockStore.filters = { query: 'm31', category: 'all', source: 'all', favoritesOnly: false };
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('Item A')).toBeInTheDocument();
  });

  it('falls back to first filtered item when currentItem not in filtered list', () => {
    mockStore.filters = { query: 'Item B', category: 'all', source: 'all', favoritesOnly: false };
    mockStore.currentItem = itemA;
    render(<DailyKnowledgeDialog />);
    expect(mockStore.setCurrentItemById).toHaveBeenCalledWith('item-b');
  });

  it('records search history when query is present', () => {
    mockStore.filters = { query: 'test-search', category: 'all', source: 'all', favoritesOnly: false };
    mockStore.items = [{ ...itemA, title: 'test-search item', summary: 'test-search' }];
    mockStore.currentItem = { ...itemA, title: 'test-search item', summary: 'test-search' };
    render(<DailyKnowledgeDialog />);
    expect(mockStore.recordHistory).toHaveBeenCalledWith('item-a', 'search', '2026-02-20');
  });

  it('buildShareText includes copyright and license without URL', async () => {
    const itemCopyrightNoUrl = {
      ...itemA,
      attribution: {
        sourceName: 'Test',
        copyright: 'Test Copyright',
        licenseName: 'MIT',
      },
    };
    mockStore.items = [itemCopyrightNoUrl];
    mockStore.currentItem = itemCopyrightNoUrl;
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.copy' }));
    await Promise.resolve();
    const text = mockCopyTextWithFeedback.mock.calls[0][0].text as string;
    expect(text).toContain('Test Copyright');
    expect(text).toContain('MIT');
  });

  it('shows share failed toast when clipboard also fails in share fallback', async () => {
    Object.defineProperty(global.navigator, 'share', {
      configurable: true,
      value: jest.fn().mockRejectedValue(new Error('share-err')),
    });
    mockCopyTextWithFeedback.mockResolvedValueOnce(false);
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'dailyKnowledge.share' }));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: 'dailyKnowledge.shareFailed' })
    );
  });

  it('filters items by category', () => {
    mockStore.filters = { query: '', category: 'event', source: 'all', favoritesOnly: false };
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.noResults')).toBeInTheDocument();
  });

  it('filters items by source', () => {
    mockStore.filters = { query: '', category: 'all', source: 'nasa-apod', favoritesOnly: false };
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.noResults')).toBeInTheDocument();
  });

  it('renders new source filters for additional upstreams', () => {
    render(<DailyKnowledgeDialog />);
    fireEvent.click(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('dailyKnowledge.sourceNasaImageLibrary')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.sourceNasaPhotojournal')).toBeInTheDocument();
    expect(screen.getByText('dailyKnowledge.sourceEsaScience')).toBeInTheDocument();
  });

  it('filters items by favoritesOnly', () => {
    mockStore.filters = { query: '', category: 'all', source: 'all', favoritesOnly: true };
    render(<DailyKnowledgeDialog />);
    expect(screen.getByText('dailyKnowledge.noResults')).toBeInTheDocument();
  });
});
