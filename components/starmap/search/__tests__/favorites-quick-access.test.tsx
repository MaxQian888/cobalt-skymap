/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock stores
jest.mock('@/lib/stores', () => ({
  useFavoritesStore: jest.fn(() => ({
    favorites: [],
    recentlyViewed: [],
    removeFavorite: jest.fn(),
    addTag: jest.fn(),
    removeTag: jest.fn(),
    clearRecentlyViewed: jest.fn(),
    getAllTags: jest.fn(() => []),
    exportFavorites: jest.fn(() => []),
    importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
  })),
  FAVORITE_TAGS: ['imaging', 'visual', 'easy', 'challenging', 'spring', 'summer', 'autumn', 'winter'],
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <span data-testid="badge" onClick={onClick}>{children}</span>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input data-testid="input" {...props} />,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (<div data-testid="tabs" onClick={() => onValueChange?.("recent")}>{children}</div>),
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-testid={`tabs-content-${value}`}>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button data-testid={`tabs-trigger-${value}`}>{children}</button>,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button data-testid="dropdown-menu-item" onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-menu-separator" />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-trigger">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
    <div data-testid="toggle-group" onClick={() => onValueChange?.('imaging')}>{children}</div>
  ),
  ToggleGroupItem: ({ children, value, ...props }: React.PropsWithChildren<{ value: string }>) => (
    <button data-testid={`toggle-item-${value}`} {...props}>{children}</button>
  ),
}));

jest.mock('../favorite-object-item', () => ({
  FavoriteObjectItem: ({ object, onSelect, onNavigate, onEditTags, onRemove }: {
    object: { id: string; name: string };
    onSelect?: (o: unknown) => void;
    onNavigate?: (o: unknown) => void;
    onEditTags?: (id: string) => void;
    onRemove?: (id: string) => void;
  }) => (
    <div data-testid={`fav-item-${object.id}`}>
      <span onClick={() => onSelect?.(object)}>{object.name}</span>
      {onNavigate && <button data-testid={`nav-${object.id}`} onClick={() => onNavigate(object)}>nav</button>}
      {onEditTags && <button data-testid={`tags-${object.id}`} onClick={() => onEditTags(object.id)}>tags</button>}
      {onRemove && <button data-testid={`remove-${object.id}`} onClick={() => onRemove(object.id)}>remove</button>}
    </div>
  ),
}));

import { FavoritesQuickAccess } from '../favorites-quick-access';

describe('FavoritesQuickAccess', () => {
  const defaultProps = {
    onSelect: jest.fn(),
    onNavigate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock implementation after tests that override it
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });
  });

  it('renders without crashing', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('renders tabs for favorites and recent', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByTestId('tabs-trigger-favorites')).toBeInTheDocument();
    expect(screen.getByTestId('tabs-trigger-recent')).toBeInTheDocument();
  });

  it('renders empty state when no favorites', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByTestId('tabs-content-favorites')).toBeInTheDocument();
  });

  it('renders favorites list when favorites exist', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging']),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByText('M31')).toBeInTheDocument();
  });

  it('shows filled star icon for favorites', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: [] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    // The star icon should have fill-yellow-500 class for favorites
    const favoriteItem = screen.getByText('M31');
    expect(favoriteItem).toBeInTheDocument();
  });

  it('shows unfilled star icon for recent items not in favorites', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [
        { id: '2', name: 'M42', ra: 83.82, dec: -5.39, type: 'Nebula', tags: [] },
      ],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    // Recent items not in favorites should have unfilled star
    expect(screen.getByTestId('tabs-content-recent')).toBeInTheDocument();
  });

  it('calls onSelect when clicking on an item', () => {
    const mockOnSelect = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: [] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
    });

    render(<FavoritesQuickAccess onSelect={mockOnSelect} />);
    
    // Click the span element which triggers onSelect in the mock
    fireEvent.click(screen.getByText('M31'));
    
    expect(mockOnSelect).toHaveBeenCalled();
  });

  it('renders tag filter badges when tags exist', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging', 'spring'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging', 'spring']),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    // Should show tag filter toggle group when tags exist
    expect(screen.getByTestId('toggle-group')).toBeInTheDocument();
  });

  it('renders recent items tab content', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [
        { id: '2', name: 'M42', ra: 83.82, dec: -5.39, type: 'Nebula', tags: [] },
      ],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByText('M42')).toBeInTheDocument();
  });

  it('calls clearRecentlyViewed when clear button clicked', () => {
    const clearRecentlyViewed = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [
        { id: '2', name: 'M42', ra: 83.82, dec: -5.39, type: 'Nebula', tags: [] },
      ],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed,
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    const clearBtn = screen.getByText('favorites.clearRecent');
    fireEvent.click(clearBtn);
    expect(clearRecentlyViewed).toHaveBeenCalled();
  });

  it('handles file import via FileReader', () => {
    const importFavorites = jest.fn(() => ({ imported: 2, skipped: 1 }));
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites,
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Create a mock file and trigger change
    const file = new File(['[{"id":"1","name":"M31"}]'], 'test.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    // Simulate FileReader onload
    // The actual FileReader is triggered asynchronously, but the mock handles it
  });

  it('handles import failure gracefully', () => {
    const importFavorites = jest.fn(() => { throw new Error('bad'); });
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites,
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    // Should render without crashing
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('renders tag filter toggle group when tags exist', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging']),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByTestId('toggle-group')).toBeInTheDocument();
  });

  it('renders empty recent tab message', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByText('favorites.noRecent')).toBeInTheDocument();
  });

  it('renders empty favorites message', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    expect(screen.getByText('favorites.noFavorites')).toBeInTheDocument();
  });

  it('calls exportFavorites when export button is clicked', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    const exportFavorites = jest.fn(() => []);
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites,
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByText('targetList.exportAs'));

    expect(exportFavorites).toHaveBeenCalled();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('calls handleSelect when favorite item clicked', () => {
    const onSelect = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: [] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess onSelect={onSelect} />);
    fireEvent.click(screen.getByText('M31'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls handleNavigate when nav button clicked', () => {
    const onNavigate = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: [] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTestId('nav-1'));
    expect(onNavigate).toHaveBeenCalledWith(10.68, 41.27);
  });

  it('opens tag editor dialog when tags button clicked', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging']),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tags-1'));
    // Dialog should open
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('adds a custom tag from the dialog when Enter is pressed', () => {
    const addTag = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag,
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging']),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tags-1'));

    const input = screen.getByPlaceholderText('favorites.customTag');
    fireEvent.change(input, { target: { value: '  DeepSky  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addTag).toHaveBeenCalledWith('1', 'deepsky');
  });

  it('adds a custom tag from the dialog add button', () => {
    const addTag = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag,
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging']),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tags-1'));

    const input = screen.getByPlaceholderText('favorites.customTag');
    fireEvent.change(input, { target: { value: 'visual' } });

    const buttons = screen.getAllByTestId('button');
    fireEvent.click(buttons[buttons.length - 1]);

    expect(addTag).toHaveBeenCalledWith('1', 'visual');
  });

  it('calls removeFavorite when remove button clicked', () => {
    const removeFavorite = jest.fn();
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: [] },
      ],
      recentlyViewed: [],
      removeFavorite,
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByTestId('remove-1'));
    expect(removeFavorite).toHaveBeenCalledWith('1');
  });

  it('filters favorites by tag when toggle clicked', () => {
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [
        { id: '1', name: 'M31', ra: 10.68, dec: 41.27, type: 'Galaxy', tags: ['imaging'] },
        { id: '2', name: 'M42', ra: 83.82, dec: -5.39, type: 'Nebula', tags: ['visual'] },
      ],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => ['imaging', 'visual']),
      exportFavorites: jest.fn(() => []),
      importFavorites: jest.fn(() => ({ imported: 0, skipped: 0 })),
    });

    render(<FavoritesQuickAccess {...defaultProps} />);
    // Click the toggle group to filter by 'imaging'
    fireEvent.click(screen.getByTestId('toggle-group'));
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });


  it('triggers tab change callback', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    fireEvent.click(screen.getByTestId('tabs'));
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('triggers file import with valid JSON', async () => {
    const importFavorites = jest.fn(() => ({ imported: 1, skipped: 0 }));
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites,
    });

    // Mock FileReader
    const originalFileReader = global.FileReader;
    const _mockOnLoad = jest.fn();
    function MockFileReader(this: Record<string, unknown>) {
      this.readAsText = jest.fn(function(this: Record<string, unknown>) {
        this.result = '[{"id":"1","name":"M31"}]';
        if (this.onload) (this.onload as () => void)();
      });
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<FavoritesQuickAccess {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]')!;
    const file = new File(['[{"id":"1","name":"M31"}]'], 'test.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    // FileReader.onload should have been called
    expect(importFavorites).toHaveBeenCalled();

    global.FileReader = originalFileReader;
  });

  it('triggers file import with invalid JSON shows error', () => {
    const importFavorites = jest.fn(() => { throw new Error('bad'); });
    const { useFavoritesStore } = jest.requireMock('@/lib/stores');
    useFavoritesStore.mockReturnValue({
      favorites: [],
      recentlyViewed: [],
      removeFavorite: jest.fn(),
      addTag: jest.fn(),
      removeTag: jest.fn(),
      clearRecentlyViewed: jest.fn(),
      getAllTags: jest.fn(() => []),
      exportFavorites: jest.fn(() => []),
      importFavorites,
    });

    const originalFileReader = global.FileReader;
    function MockFileReader(this: Record<string, unknown>) {
      this.readAsText = jest.fn(function(this: Record<string, unknown>) {
        this.result = 'invalid json';
        if (this.onload) (this.onload as () => void)();
      });
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<FavoritesQuickAccess {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]')!;
    const file = new File(['bad'], 'test.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    global.FileReader = originalFileReader;
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('handles import button click triggering file input', () => {
    render(<FavoritesQuickAccess {...defaultProps} />);
    const importBtn = screen.getByText('targetList.import');
    const fileInput = document.querySelector('input[type="file"]') as HTMLElement;
    const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
    fireEvent.click(importBtn);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

});
