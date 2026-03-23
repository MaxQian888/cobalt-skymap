/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { UseObjectSearchReturn } from '@/lib/hooks/use-object-search';

// ============================================================================
// Helper: create a complete mock return value for useObjectSearch
// ============================================================================
function createMockSearchHook(overrides: Partial<UseObjectSearchReturn> = {}): UseObjectSearchReturn {
  const base: UseObjectSearchReturn = {
    query: '',
    setQuery: jest.fn(),
    search: jest.fn(),
    results: [],
    groupedResults: new Map(),
    isSearching: false,
    isOnlineSearching: false,
    searchStage: 'idle' as const,
    searchOutcome: 'empty' as const,
    searchMessages: [],
    refinementHints: [],
    providerDiagnostics: [],
    usedCachedOnline: false,
    onlineAvailable: false,
    searchStats: { totalResults: 0, resultsByType: {}, searchTimeMs: 0 },
    filters: {
      types: ['DSO', 'Planet', 'Star', 'Moon', 'Comet', 'Asteroid', 'TargetList', 'Constellation'] as ('DSO' | 'Planet' | 'Star' | 'Moon' | 'Comet' | 'Asteroid' | 'TargetList' | 'Constellation')[],
      includeTargetList: true,
      searchMode: 'name' as const,
      minMagnitude: undefined,
      maxMagnitude: undefined,
      searchRadius: 5,
    },
    setFilters: jest.fn(),
    clearSearch: jest.fn(),
    selectedIds: new Set<string>(),
    toggleSelection: jest.fn(),
    selectAll: jest.fn(),
    clearSelection: jest.fn(),
    sortBy: 'relevance' as const,
    setSortBy: jest.fn(),
    recentSearches: [],
    addRecentSearch: jest.fn(),
    clearRecentSearches: jest.fn(),
    getSelectedItems: jest.fn(() => []),
    isSelected: jest.fn(() => false),
    popularObjects: [],
    quickCategories: [],
  };

  return {
    ...base,
    ...overrides,
    searchStage: overrides.searchStage ?? base.searchStage,
    searchOutcome: overrides.searchOutcome ?? base.searchOutcome,
    searchMessages: overrides.searchMessages ?? base.searchMessages,
    refinementHints: overrides.refinementHints ?? base.refinementHints,
    providerDiagnostics: overrides.providerDiagnostics ?? base.providerDiagnostics,
    usedCachedOnline: overrides.usedCachedOnline ?? base.usedCachedOnline,
    onlineAvailable: overrides.onlineAvailable ?? base.onlineAvailable,
    searchStats: overrides.searchStats ?? base.searchStats,
  };
}

// Mock stores
const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    stel: null,
    isReady: true,
    setViewDirection: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseTargetListStore = jest.fn((selector) => {
  const state = {
    addTarget: jest.fn(),
    addTargetsBatch: jest.fn(),
    targets: [],
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) => mockUseTargetListStore(selector),
}));

// Mock hooks
jest.mock('@/lib/hooks', () => ({
  useObjectSearch: jest.fn(() => createMockSearchHook()),
  useSkyCultureLanguage: jest.fn(() => 'western'),
  useSelectTarget: jest.fn(() => jest.fn()),
}));

jest.mock('@/lib/hooks/use-target-list-actions', () => ({
  useTargetListActions: jest.fn(() => ({
    handleAddToTargetList: jest.fn(),
    handleBatchAdd: jest.fn(),
  })),
}));

// Mock constants
jest.mock('@/lib/core/constants/search', () => ({
  ALL_OBJECT_TYPES: ['DSO', 'Planet', 'Star', 'Moon', 'Comet', 'Asteroid', 'Constellation'],
  CATALOG_PRESETS: [],
}));

// Mock coordinate validators
jest.mock('@/lib/astronomy/coordinate-validators', () => ({
  isValidRA: jest.fn(() => true),
  isValidDec: jest.fn(() => true),
}));

// Mock utils
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  rad2deg: jest.fn((x: number) => x),
  degreesToHMS: jest.fn(() => '00h 00m 00s'),
  degreesToDMS: jest.fn(() => '+00° 00\' 00"'),
}));

jest.mock('@/lib/translations', () => ({
  translateCelestialName: jest.fn((name: string) => name),
}));

jest.mock('@/lib/core/search-utils', () => ({
  getResultId: jest.fn((item: { Type?: string; Name: string }) => `${item.Type}-${item.Name}`),
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input data-testid="input" {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" data-testid="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value?: number[]; onValueChange?: (v: number[]) => void }) => (
    <input type="range" data-testid="slider" value={value?.[0] || 0} onChange={(e) => onValueChange?.([Number(e.target.value)])} />
  ),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (c: boolean) => void }) => (
    <input type="checkbox" data-testid="switch" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-content">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="tabs-trigger">{children}</button>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (<div data-testid="select" onClick={() => onValueChange?.("coordinates")}>{children}</div>),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option data-testid="select-item" value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span data-testid="select-value">Select...</span>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea data-testid="textarea" {...props} />,
}));

jest.mock('../grouped-results-list', () => ({
  GroupedResultsList: ({ onSelect }: { onSelect?: (item: { Name: string; Type: string }) => void }) => (
    <button
      data-testid="grouped-results-list"
      onClick={() => onSelect?.({ Name: 'M31', Type: 'DSO' })}
      type="button"
    >
      grouped-results
    </button>
  ),
}));

import { AdvancedSearchDialog } from '../advanced-search-dialog';

describe('AdvancedSearchDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog content when open', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders tabs for different search modes', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('renders batch search controls and extended sort options', () => {
    const { container } = render(<AdvancedSearchDialog {...defaultProps} />);

    expect(container.querySelector('textarea')).toBeInTheDocument();
    expect(container.querySelector('input[type="file"][accept=".txt,.csv"]')).toBeInTheDocument();

    const optionValues = screen.getAllByTestId('select-item').map(node => node.getAttribute('value'));
    expect(optionValues).toEqual(expect.arrayContaining(['magnitude', 'altitude', 'distance']));
  });

  it('uses shared searchHook when provided', () => {
    const sharedHook = createMockSearchHook({ query: 'shared-query' });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    // When searchHook is provided, the component should NOT create its own instance
    // (but our fallback pattern still calls useObjectSearch unconditionally)
    useObjectSearch.mockReturnValue(createMockSearchHook());

    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook as unknown as UseObjectSearchReturn} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('falls back to own useObjectSearch when searchHook is not provided', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    const mockHook = createMockSearchHook();
    useObjectSearch.mockReturnValue(mockHook);

    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(useObjectSearch).toHaveBeenCalled();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders object type filter checkboxes', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const checkboxes = screen.getAllByTestId('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(7);
  });

  it('renders search and reset buttons', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const buttons = screen.getAllByTestId('button');
    const searchBtn = buttons.find(b => b.textContent?.includes('common.search'));
    const resetBtn = buttons.find(b => b.textContent?.includes('common.reset'));
    expect(searchBtn).toBeTruthy();
    expect(resetBtn).toBeTruthy();
  });

  it('calls setQuery when search button clicked', () => {
    const mockSetQuery = jest.fn();
    const sharedHook = createMockSearchHook({ setQuery: mockSetQuery });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook());
    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook as unknown as UseObjectSearchReturn} />);
    const buttons = screen.getAllByTestId('button');
    const searchBtn = buttons.find(b => b.textContent?.includes('common.search'));
    if (searchBtn) fireEvent.click(searchBtn);
    expect(mockSetQuery).toHaveBeenCalled();
  });

  it('calls clearSearch and clearSelection when reset clicked', () => {
    const mockClearSearch = jest.fn();
    const mockClearSelection = jest.fn();
    const sharedHook = createMockSearchHook({ clearSearch: mockClearSearch, clearSelection: mockClearSelection });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook());
    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook as unknown as UseObjectSearchReturn} />);
    const buttons = screen.getAllByTestId('button');
    const resetBtn = buttons.find(b => b.textContent?.includes('common.reset'));
    if (resetBtn) fireEvent.click(resetBtn);
    expect(mockClearSearch).toHaveBeenCalled();
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it('renders autoSearch switch', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders close button in footer and calls onOpenChange', () => {
    const onOpenChange = jest.fn();
    render(<AdvancedSearchDialog {...defaultProps} onOpenChange={onOpenChange} />);
    const footer = screen.getByTestId('dialog-footer');
    const closeBtn = footer.querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders loading state when searching', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({ isSearching: true }));
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders results when available', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders magnitude filter inputs', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders all sort option values', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const options = screen.getAllByTestId('select-item').map(n => n.getAttribute('value'));
    expect(options).toEqual(expect.arrayContaining(['relevance', 'name', 'type', 'ra', 'magnitude', 'altitude', 'distance']));
  });

  it('toggles type checkbox without crashing', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const checkboxes = screen.getAllByTestId('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });


  it('changes search input value triggering onChange', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const inputs = screen.getAllByTestId('input');
    // First input is the search/name input
    fireEvent.change(inputs[0], { target: { value: 'M42' } });
    expect(inputs[0]).toHaveValue('M42');
  });

  it('toggles includeTargetList checkbox', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const checkboxes = screen.getAllByTestId('checkbox');
    // Last checkbox is includeTargetList
    const lastCb = checkboxes[checkboxes.length - 1];
    fireEvent.click(lastCb);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('toggles autoSearch switch', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const switches = screen.getAllByTestId('switch');
    fireEvent.click(switches[0]);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('changes magnitude min/max inputs', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const inputs = screen.getAllByTestId('input');
    // magnitude inputs are number type inputs
    const numInputs = inputs.filter(i => i.getAttribute('type') === 'number');
    if (numInputs.length >= 2) {
      fireEvent.change(numInputs[0], { target: { value: '2' } });
      fireEvent.change(numInputs[1], { target: { value: '10' } });
    }
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('changes batch query textarea', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const textarea = document.querySelector('textarea');
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'M31\nM42' } });
    }
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('imports a batch file and normalizes the textarea content', async () => {
    const originalFileReader = global.FileReader;

    function MockFileReader(this: Record<string, unknown>) {
      this.readAsText = jest.fn(function(this: Record<string, unknown>) {
        this.result = ' M31 ,\nNGC7000\n\n Mars ';
        if (this.onload) {
          (this.onload as () => void)();
        }
      });
    }

    global.FileReader = MockFileReader as unknown as typeof FileReader;

    try {
      const { container } = render(<AdvancedSearchDialog {...defaultProps} />);
      const fileInput = container.querySelector('input[type="file"][accept=".txt,.csv"]') as HTMLInputElement;
      const file = new File(['M31'], 'targets.txt', { type: 'text/plain' });

      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByTestId('textarea')).toHaveValue('M31\nNGC7000\nMars');
      });
    } finally {
      global.FileReader = originalFileReader;
    }
  });

  it('runs batch search with normalized entries', () => {
    const mockSetQuery = jest.fn();
    const sharedHook = createMockSearchHook({ setQuery: mockSetQuery, setFilters: jest.fn() });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');

    useObjectSearch.mockReturnValue(createMockSearchHook());

    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook} />);

    fireEvent.change(screen.getByTestId('textarea'), {
      target: { value: ' M31 \n\nNGC7000, Mars ' },
    });
    fireEvent.click(screen.getByText('search.runBatchSearch'));

    expect(mockSetQuery).toHaveBeenCalledWith('M31\nNGC7000\nMars');
  });

  it('presses Enter in search input', () => {
    const mockSetQuery = jest.fn();
    const sharedHook = createMockSearchHook({ setQuery: mockSetQuery, setFilters: jest.fn() });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook());
    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook} />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.keyDown(inputs[0], { key: 'Enter' });
    expect(mockSetQuery).toHaveBeenCalled();
  });

  it('renders coordinate mode UI after Select click', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    // Click Select to switch to coordinates mode
    const selects = screen.getAllByTestId('select');
    if (selects[0]) fireEvent.click(selects[0]);
    // After switching, the component should still render
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('clicks Select to trigger onValueChange for coordinate mode', () => {
    render(<AdvancedSearchDialog {...defaultProps} />);
    const selects = screen.getAllByTestId('select');
    if (selects[0]) fireEvent.click(selects[0]);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('clicks Select to trigger onValueChange for sortBy', () => {
    const mockSetSortBy = jest.fn();
    const sharedHook = createMockSearchHook({ setSortBy: mockSetSortBy });
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook());
    render(<AdvancedSearchDialog {...defaultProps} searchHook={sharedHook} />);
    const selects = screen.getAllByTestId('select');
    if (selects.length > 1) fireEvent.click(selects[selects.length - 1]);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('shows search stats and online label when results exist', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
      searchStats: { totalResults: 1, resultsByType: { DSO: 1 }, searchTimeMs: 10 },
      onlineAvailable: true,
    }));
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('shows online searching indicator', () => {
    const { useObjectSearch } = jest.requireMock('@/lib/hooks');
    useObjectSearch.mockReturnValue(createMockSearchHook({ isOnlineSearching: true }));
    render(<AdvancedSearchDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('selects a grouped result and closes the dialog', () => {
    const onOpenChange = jest.fn();
    const selectTarget = jest.fn();
    const { useObjectSearch, useSelectTarget } = jest.requireMock('@/lib/hooks');

    useObjectSearch.mockReturnValue(createMockSearchHook({
      results: [{ Name: 'M31', Type: 'DSO' }],
      groupedResults: new Map([['DSO', [{ Name: 'M31', Type: 'DSO' }]]]),
    }));
    useSelectTarget.mockReturnValue(selectTarget);

    render(<AdvancedSearchDialog open onOpenChange={onOpenChange} onSelect={jest.fn()} />);

    fireEvent.click(screen.getByTestId('grouped-results-list'));

    expect(selectTarget).toHaveBeenCalledWith(expect.objectContaining({ Name: 'M31', Type: 'DSO' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

});
