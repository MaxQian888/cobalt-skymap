/**
 * @jest-environment jsdom
 */

const mockStellariumSearch = { name: 'StellariumSearch' };
const mockAdvancedSearchDialog = { name: 'AdvancedSearchDialog' };
const mockSearchResultItemRow = { name: 'SearchResultItemRow' };
const mockGetResultId = jest.fn();
const mockFavoritesQuickAccess = { name: 'FavoritesQuickAccess' };
const mockFavoriteObjectItem = { name: 'FavoriteObjectItem' };
const mockMultiSelectToolbar = { name: 'MultiSelectToolbar' };
const mockGroupedResultsList = { name: 'GroupedResultsList' };
const mockOnlineSearchSettings = { name: 'OnlineSearchSettings' };
const mockSourceBadge = { name: 'SourceBadge' };
const mockOnlineStatusIndicator = { name: 'OnlineStatusIndicator' };
const mockGetTypeIcon = jest.fn();
const mockGetCategoryIcon = jest.fn();

jest.mock('../stellarium-search', () => ({
  StellariumSearch: mockStellariumSearch,
}));

jest.mock('../advanced-search-dialog', () => ({
  AdvancedSearchDialog: mockAdvancedSearchDialog,
}));

jest.mock('../search-result-item', () => ({
  SearchResultItemRow: mockSearchResultItemRow,
  getResultId: mockGetResultId,
}));

jest.mock('../favorites-quick-access', () => ({
  FavoritesQuickAccess: mockFavoritesQuickAccess,
}));

jest.mock('../favorite-object-item', () => ({
  FavoriteObjectItem: mockFavoriteObjectItem,
}));

jest.mock('../multi-select-toolbar', () => ({
  MultiSelectToolbar: mockMultiSelectToolbar,
}));

jest.mock('../grouped-results-list', () => ({
  GroupedResultsList: mockGroupedResultsList,
}));

jest.mock('../online-search-settings', () => ({
  OnlineSearchSettings: mockOnlineSearchSettings,
  SourceBadge: mockSourceBadge,
  OnlineStatusIndicator: mockOnlineStatusIndicator,
}));

jest.mock('../search-utils', () => ({
  getTypeIcon: mockGetTypeIcon,
  getCategoryIcon: mockGetCategoryIcon,
}));

describe('search index exports', () => {
  it('re-exports the canonical search modules', async () => {
    const searchExports = await import('../index');

    expect(searchExports.StellariumSearch).toBe(mockStellariumSearch);
    expect(searchExports.AdvancedSearchDialog).toBe(mockAdvancedSearchDialog);
    expect(searchExports.SearchResultItemRow).toBe(mockSearchResultItemRow);
    expect(searchExports.getResultId).toBe(mockGetResultId);
    expect(searchExports.FavoritesQuickAccess).toBe(mockFavoritesQuickAccess);
    expect(searchExports.FavoriteObjectItem).toBe(mockFavoriteObjectItem);
    expect(searchExports.MultiSelectToolbar).toBe(mockMultiSelectToolbar);
    expect(searchExports.GroupedResultsList).toBe(mockGroupedResultsList);
    expect(searchExports.OnlineSearchSettings).toBe(mockOnlineSearchSettings);
    expect(searchExports.SourceBadge).toBe(mockSourceBadge);
    expect(searchExports.OnlineStatusIndicator).toBe(mockOnlineStatusIndicator);
    expect(searchExports.getTypeIcon).toBe(mockGetTypeIcon);
    expect(searchExports.getCategoryIcon).toBe(mockGetCategoryIcon);
  });
});
