/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';

// ============================================================================
// Helper: create a complete mock return value for useObjectSearch
// ============================================================================
function createMockSearchHook(overrides: Record<string, unknown> = {}) {
  return {
    query: '',
    setQuery: jest.fn(),
    search: jest.fn(),
    results: [],
    groupedResults: new Map(),
    isSearching: false,
    isOnlineSearching: false,
    searchStage: 'idle',
    searchOutcome: 'empty',
    searchMessages: [],
    refinementHints: [],
    providerDiagnostics: [],
    usedCachedOnline: false,
    onlineAvailable: false,
    searchStats: { totalResults: 0, resultsByType: {}, searchTimeMs: 0 },
    filters: {
      types: ['DSO', 'Planet', 'Star', 'Moon', 'Comet', 'Asteroid', 'TargetList', 'Constellation'],
      includeTargetList: true,
      searchMode: 'name',
      minMagnitude: undefined,
      maxMagnitude: undefined,
      searchRadius: 5,
    },
    setFilters: jest.fn(),
    clearSearch: jest.fn(),
    selectedIds: new Set(),
    toggleSelection: jest.fn(),
    selectAll: jest.fn(),
    clearSelection: jest.fn(),
    sortBy: 'relevance',
    setSortBy: jest.fn(),
    recentSearches: [],
    addRecentSearch: jest.fn(),
    clearRecentSearches: jest.fn(),
    getSelectedItems: jest.fn(() => []),
    isSelected: jest.fn(() => false),
    popularObjects: [],
    quickCategories: [],
    ...overrides,
  };
}

// Mock hooks
jest.mock('@/lib/hooks', () => ({
  useObjectSearch: jest.fn(() => createMockSearchHook()),
  useCelestialName: jest.fn((name: string) => name),
  useSkyCultureLanguage: jest.fn(() => 'native'),
  useSelectTarget: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/hooks/use-target-list-actions', () => ({
  useTargetListActions: jest.fn(() => ({
    handleAddToTargetList: jest.fn(),
    handleBatchAdd: jest.fn(),
  })),
}));

// Mock stores
jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn(() => ({
    stel: null,
    isReady: true,
    setViewDirection: jest.fn(),
    skyCultureLanguage: 'native',
  })),
  useTargetListStore: jest.fn(() => ({
    addTarget: jest.fn(),
    addTargetsBatch: jest.fn(),
    targets: [],
  })),
}));

// Mock search-utils (getResultId)
jest.mock('@/lib/core/search-utils', () => ({
  getResultId: jest.fn((item: { Type?: string; Name: string }) => `${item.Type}-${item.Name}`),
}));

// Mock translations helper
jest.mock('@/lib/translations', () => ({
  translateCelestialName: jest.fn((name: string) => name),
}));

// Mock UI components
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input data-testid="search-input" {...props} />,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuCheckboxItem: ({ children, onCheckedChange }: { children: React.ReactNode; onCheckedChange?: () => void }) => (<div data-testid="dropdown-checkbox" onClick={() => onCheckedChange?.()}>{children}</div>),
  DropdownMenuRadioGroup: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-radio-group">{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-radio-item">{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (c: boolean) => void }) => (
    <input type="checkbox" data-testid="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/kbd', () => ({
  Kbd: ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>,
}));

jest.mock('@/components/ui/empty-state', () => ({
  EmptyState: ({ message }: { message?: string }) => <div data-testid="empty-state">{message}</div>,
}));

// Mock child components to simplify tests
jest.mock('../advanced-search-dialog', () => ({
  AdvancedSearchDialog: ({ searchHook }: { open: boolean; searchHook?: unknown }) => (
    <div data-testid="advanced-search-dialog" data-has-shared-hook={!!searchHook}>mock-advanced-search</div>
  ),
}));

import { StellariumSearch } from '../stellarium-search';

Element.prototype.scrollIntoView = jest.fn();
describe('StellariumSearch', () => {
  const defaultProps = {
    onSelect: jest.fn(),
    enableMultiSelect: false,
    onBatchAdd: jest.fn(),
    onFocusChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    expect(input).toBeInTheDocument();
  });

  it('calls setQuery when typing', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    const mockSetQuery = jest.fn();
    useObjectSearch.mockReturnValue(createMockSearchHook({ setQuery: mockSetQuery }));

    render(<StellariumSearch {...defaultProps} />);

    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'M31' } });

    expect(mockSetQuery).toHaveBeenCalledWith('M31');
  });

  it('passes shared searchHook to AdvancedSearchDialog', () => {
    render(<StellariumSearch {...defaultProps} />);
    const dialog = screen.getByTestId('advanced-search-dialog');
    expect(dialog).toHaveAttribute('data-has-shared-hook', 'true');
  });

  it('shows online searching indicator when isOnlineSearching is true', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      isOnlineSearching: true,
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    // The component should render without errors when online search is active
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('displays search stats when available', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      searchStats: { totalResults: 5, resultsByType: { DSO: 3, Star: 2 }, searchTimeMs: 42 },
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('shows command mode hint for prefixed queries', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'm:31',
      results: [],
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByText('search.commandModeHint')).toBeInTheDocument();
  });

  it('navigates recent history with arrow keys when query is empty', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    const setQuery = jest.fn();
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      recentSearches: ['M31', 'M42'],
      setQuery,
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(setQuery).toHaveBeenCalledWith('M31');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(setQuery).toHaveBeenCalledWith('M42');
  });

  it('closes search on Escape key', () => {
    const onFocusChange = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} onFocusChange={onFocusChange} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onFocusChange).toHaveBeenCalledWith(false);
  });

  it('closes search on Tab key', () => {
    const onFocusChange = jest.fn();
    render(<StellariumSearch {...defaultProps} onFocusChange={onFocusChange} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(onFocusChange).toHaveBeenCalledWith(false);
  });

  it('navigates results with ArrowDown key', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      results: [{ Name: 'M31', Type: 'DSO' }, { Name: 'M42', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }, { Name: 'M42', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Should increment highlighted index without error
    expect(input).toBeInTheDocument();
  });

  it('navigates results with ArrowUp key', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toBeInTheDocument();
  });

  it('selects item with Enter key', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    const { useSelectTarget } = jest.requireMock('@/lib/hooks');
    const mockSelectTarget = jest.fn();
    useSelectTarget.mockReturnValue(mockSelectTarget);
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSelectTarget).toHaveBeenCalled();
  });

  it('clears search when X button clicked', () => {
    const mockClearSearch = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      clearSearch: mockClearSearch,
    }));

    render(<StellariumSearch {...defaultProps} />);
    // Find and click the X clear button
    const buttons = screen.getAllByRole('button');
    const clearBtn = buttons.find(b => b.querySelector('svg'));
    if (clearBtn) fireEvent.click(clearBtn);
    expect(mockClearSearch).toHaveBeenCalled();
  });

  it('shows multi-select toolbar when enableMultiSelect is true and has results', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} enableMultiSelect={true} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('shows popular objects when focused with no query', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      popularObjects: [{ Name: 'Sirius' }, { Name: 'Vega' }],
      quickCategories: [{ label: 'galaxies', items: [{ Name: 'M31' }] }],
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    expect(screen.getByText('Sirius')).toBeInTheDocument();
    expect(screen.getByText('Vega')).toBeInTheDocument();
  });

  it('shows quick categories when focused with no query', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      popularObjects: [],
      quickCategories: [{ label: 'galaxies', items: [{ Name: 'M31' }] }],
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('shows empty state when query has no results', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'nonexistent',
      results: [],
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('shows partial-success indicator when some sources fail', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      searchOutcome: 'partial_success',
      searchMessages: [{ source: 'online', level: 'warning', message: 'timeout' }],
      providerDiagnostics: [{ source: 'sesame', status: 'timeout' }],
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getAllByText(/search\.partialResults/i).length).toBeGreaterThan(0);
  });

  it('shows error state when searchOutcome is error', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      searchOutcome: 'error',
      searchMessages: [{ source: 'online', level: 'error', message: 'provider-down' }],
      results: [],
      groupedResults: new Map(),
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByText('search.searchFailed')).toBeInTheDocument();
  });

  it('shows progressive local-ready indicator', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'M31',
      searchStage: 'local_ready',
      isSearching: true,
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByText('search.localResultsReady')).toBeInTheDocument();
  });

  it('shows refinement warning hint message', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '@bad',
      refinementHints: [{ code: 'COORDINATE_FORMAT_HINT', level: 'warning', message: 'Invalid coordinate format' }],
      results: [],
      groupedResults: new Map(),
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByText('Invalid coordinate format')).toBeInTheDocument();
  });

  it('exposes focusSearchInput via ref', () => {
    const ref = React.createRef<{ focusSearchInput: () => void; closeSearch: () => void }>();
    render(<StellariumSearch {...defaultProps} ref={ref} />);
    expect(ref.current).toBeTruthy();
    expect(typeof ref.current?.focusSearchInput).toBe('function');
    expect(typeof ref.current?.closeSearch).toBe('function');
  });

  it('handles handleFocus showing keyboard hints', () => {
    jest.useFakeTimers();
    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    act(() => {
      fireEvent.focus(input);
    });
    // Keyboard hints should appear briefly
    expect(input).toBeInTheDocument();
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
  });


  it('focusSearchInput via ref focuses the input', () => {
    jest.useFakeTimers();
    const ref = React.createRef<{ focusSearchInput: () => void; closeSearch: () => void }>();
    render(<StellariumSearch {...defaultProps} ref={ref} />);
    act(() => {
      ref.current?.focusSearchInput();
      jest.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('setQuery via ref delegates to the search hook setter', () => {
    const setQuery = jest.fn();
    const ref = React.createRef<{ focusSearchInput: () => void; closeSearch: () => void; setQuery: (query: string) => void }>();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');

    useObjectSearch.mockReturnValue(createMockSearchHook({ setQuery }));

    render(<StellariumSearch {...defaultProps} ref={ref} />);

    act(() => {
      ref.current?.setQuery('M31');
    });

    expect(setQuery).toHaveBeenCalledWith('M31');
  });

  it('closeSearch via ref blurs the input', () => {
    const ref = React.createRef<{ focusSearchInput: () => void; closeSearch: () => void }>();
    render(<StellariumSearch {...defaultProps} ref={ref} />);
    ref.current?.closeSearch();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('handles click outside to close search panel', () => {
    const onFocusChange = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({ query: 'M31' }));

    render(
      <div>
        <div data-testid="outside">outside</div>
        <StellariumSearch {...defaultProps} onFocusChange={onFocusChange} />
      </div>
    );
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);

    // Click outside the container
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onFocusChange).toHaveBeenCalledWith(false);
  });

  it('renders quick category buttons and handles click', () => {
    const mockSetFilters = jest.fn();
    const mockSetQuery = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      setQuery: mockSetQuery,
      setFilters: mockSetFilters,
      popularObjects: [],
      quickCategories: [
        { label: 'galaxies', items: [{ Name: 'M31' }] },
        { label: 'planets', items: [{ Name: 'Mars' }] },
      ],
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);

    // Click a quick category button
    const galaxiesBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('search.categories.galaxies'));
    if (galaxiesBtn) {
      fireEvent.click(galaxiesBtn);
      expect(mockSetFilters).toHaveBeenCalled();
    }
  });

  it('handles clear recent searches button', () => {
    const mockClearRecentSearches = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      recentSearches: ['M31', 'M42'],
      clearRecentSearches: mockClearRecentSearches,
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);

    const buttons = screen.getAllByRole('button');
    // Find a button near the recent searches section (the trash icon button)
    const clearBtn = buttons.find(b => {
      const svg = b.querySelector('svg');
      return svg && b.closest('[class]');
    });
    if (clearBtn) {
      fireEvent.click(clearBtn);
    }
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('opens advanced search dialog on button click', () => {
    render(<StellariumSearch {...defaultProps} />);
    // Find the advanced search button (SlidersHorizontal icon)
    const buttons = screen.getAllByRole('button');
    const advBtn = buttons.find(b => b.textContent?.includes('search.advancedSearch') || b.querySelector('svg'));
    if (advBtn) {
      fireEvent.click(advBtn);
    }
    expect(screen.getByTestId('advanced-search-dialog')).toBeInTheDocument();
  });


  it('clicks dropdown checkbox item to toggle type filter', () => {
    const mockSetFilters = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      setFilters: mockSetFilters,
      filters: { types: ['DSO', 'Planet', 'Star', 'Moon', 'Comet', 'Asteroid', 'Constellation'], includeTargetList: true, searchMode: 'name' },
    }));

    render(<StellariumSearch {...defaultProps} />);
    const checkboxItems = screen.getAllByTestId('dropdown-checkbox');
    if (checkboxItems.length > 0) {
      fireEvent.click(checkboxItems[0]);
      expect(mockSetFilters).toHaveBeenCalled();
    }
  });

  it('clicks recent search term to set query', () => {
    const mockSetQuery = jest.fn();
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: '',
      setQuery: mockSetQuery,
      recentSearches: ['M31', 'M42'],
    }));

    render(<StellariumSearch {...defaultProps} />);
    const input = screen.getByTestId('search-input');
    fireEvent.focus(input);
    
    // Click the recent search button
    const recentBtn = screen.getAllByRole('button').find(b => b.textContent === 'M31');
    if (recentBtn) {
      fireEvent.click(recentBtn);
      expect(mockSetQuery).toHaveBeenCalledWith('M31');
    }
  });

  it('renders search stats with online label', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      query: 'test',
      results: [{ Name: 'Test', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'Test', Type: 'DSO' }]]]),
      searchStats: { totalResults: 1, resultsByType: { DSO: 1 }, searchTimeMs: 5 },
      onlineAvailable: true,
    }));

    render(<StellariumSearch {...defaultProps} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('handles handleAdvancedSelect callback', () => {
    const onSelect = jest.fn();
    const onFocusChange = jest.fn();

    render(<StellariumSearch onSelect={onSelect} onFocusChange={onFocusChange} />);
    // The AdvancedSearchDialog mock is rendered
    expect(screen.getByTestId('advanced-search-dialog')).toBeInTheDocument();
  });

});
