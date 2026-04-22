import { act, renderHook } from '@testing-library/react';
import {
  useBookmarksStore,
  BOOKMARK_COLORS,
  BOOKMARK_ICONS,
  DEFAULT_BOOKMARKS,
} from '../bookmarks-store';

// Mock zustand storage
jest.mock('@/lib/storage', () => ({
  getZustandStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

describe('useBookmarksStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useBookmarksStore());
    act(() => {
      // Clear all bookmarks
      result.current.bookmarks.forEach((b) => {
        result.current.removeBookmark(b.id);
      });
    });
  });

  describe('initial state', () => {
    it('should have empty bookmarks array initially', () => {
      const { result } = renderHook(() => useBookmarksStore());
      expect(result.current.bookmarks).toEqual([]);
    });
  });

  describe('addBookmark', () => {
    it('should add a bookmark and return its id', () => {
      const { result } = renderHook(() => useBookmarksStore());
      
      let bookmarkId: string;
      act(() => {
        bookmarkId = result.current.addBookmark({
          name: 'Test Bookmark',
          ra: 180,
          dec: 45,
          fov: 60,
        });
      });

      expect(bookmarkId!).toBeDefined();
      expect(bookmarkId!).toMatch(/^bm_/);
      expect(result.current.bookmarks).toHaveLength(1);
      expect(result.current.bookmarks[0].name).toBe('Test Bookmark');
      expect(result.current.bookmarks[0].ra).toBe(180);
      expect(result.current.bookmarks[0].dec).toBe(45);
    });

    it('should set createdAt and updatedAt timestamps', () => {
      const { result } = renderHook(() => useBookmarksStore());
      const beforeTime = Date.now();

      act(() => {
        result.current.addBookmark({
          name: 'Test Bookmark',
          ra: 0,
          dec: 0,
          fov: 60,
        });
      });

      const afterTime = Date.now();
      const bookmark = result.current.bookmarks[0];
      
      expect(bookmark.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(bookmark.createdAt).toBeLessThanOrEqual(afterTime);
      expect(bookmark.updatedAt).toBe(bookmark.createdAt);
    });

    it('should support optional fields', () => {
      const { result } = renderHook(() => useBookmarksStore());

      act(() => {
        result.current.addBookmark({
          name: 'Full Bookmark',
          ra: 90,
          dec: -30,
          fov: 45,
          description: 'A test description',
          color: '#ef4444',
          icon: 'star',
        });
      });

      const bookmark = result.current.bookmarks[0];
      expect(bookmark.description).toBe('A test description');
      expect(bookmark.color).toBe('#ef4444');
      expect(bookmark.icon).toBe('star');
    });
  });

  describe('updateBookmark', () => {
    it('should update bookmark properties', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let bookmarkId: string;
      act(() => {
        bookmarkId = result.current.addBookmark({
          name: 'Original Name',
          ra: 0,
          dec: 0,
          fov: 60,
        });
      });

      act(() => {
        result.current.updateBookmark(bookmarkId!, { name: 'Updated Name' });
      });

      expect(result.current.bookmarks[0].name).toBe('Updated Name');
    });

    it('should update updatedAt timestamp on update', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let bookmarkId: string;
      act(() => {
        bookmarkId = result.current.addBookmark({
          name: 'Test',
          ra: 0,
          dec: 0,
          fov: 60,
        });
      });

      const originalUpdatedAt = result.current.bookmarks[0].updatedAt;

      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(originalUpdatedAt + 10);

      act(() => {
        result.current.updateBookmark(bookmarkId!, { name: 'Updated' });
      });

      expect(result.current.bookmarks[0].updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
      nowSpy.mockRestore();
    });
  });

  describe('removeBookmark', () => {
    it('should remove a bookmark by id', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let bookmarkId: string;
      act(() => {
        bookmarkId = result.current.addBookmark({
          name: 'To Remove',
          ra: 0,
          dec: 0,
          fov: 60,
        });
      });

      expect(result.current.bookmarks).toHaveLength(1);

      act(() => {
        result.current.removeBookmark(bookmarkId!);
      });

      expect(result.current.bookmarks).toHaveLength(0);
    });

    it('should not affect other bookmarks', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let id1: string, id2: string;
      act(() => {
        id1 = result.current.addBookmark({ name: 'First', ra: 0, dec: 0, fov: 60 });
        id2 = result.current.addBookmark({ name: 'Second', ra: 90, dec: 0, fov: 60 });
      });

      act(() => {
        result.current.removeBookmark(id1!);
      });

      expect(result.current.bookmarks).toHaveLength(1);
      expect(result.current.bookmarks[0].id).toBe(id2!);
    });
  });

  describe('getBookmark', () => {
    it('should return bookmark by id', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let bookmarkId: string;
      act(() => {
        bookmarkId = result.current.addBookmark({
          name: 'Find Me',
          ra: 123,
          dec: 45,
          fov: 30,
        });
      });

      const found = result.current.getBookmark(bookmarkId!);
      expect(found).toBeDefined();
      expect(found?.name).toBe('Find Me');
      expect(found?.ra).toBe(123);
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useBookmarksStore());
      const found = result.current.getBookmark('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('reorderBookmarks', () => {
    it('should reorder bookmarks', () => {
      const { result } = renderHook(() => useBookmarksStore());

      act(() => {
        result.current.addBookmark({ name: 'First', ra: 0, dec: 0, fov: 60 });
        result.current.addBookmark({ name: 'Second', ra: 90, dec: 0, fov: 60 });
        result.current.addBookmark({ name: 'Third', ra: 180, dec: 0, fov: 60 });
      });

      act(() => {
        result.current.reorderBookmarks(2, 0); // Move Third to first position
      });

      expect(result.current.bookmarks[0].name).toBe('Third');
      expect(result.current.bookmarks[1].name).toBe('First');
      expect(result.current.bookmarks[2].name).toBe('Second');
    });
  });

  describe('duplicateBookmark', () => {
    it('should duplicate a bookmark with default suffix', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let originalId: string;
      act(() => {
        originalId = result.current.addBookmark({
          name: 'Original',
          ra: 180,
          dec: 45,
          fov: 60,
          description: 'Test description',
          color: '#ef4444',
          icon: 'star',
        });
      });

      let duplicateId: string | null = null;
      act(() => {
        duplicateId = result.current.duplicateBookmark(originalId!);
      });

      expect(duplicateId).toBeDefined();
      expect(duplicateId).not.toBe(originalId!);
      expect(result.current.bookmarks).toHaveLength(2);

      const duplicate = result.current.getBookmark(duplicateId!);
      expect(duplicate?.name).toBe('Original (Copy)');
      expect(duplicate?.ra).toBe(180);
      expect(duplicate?.dec).toBe(45);
      expect(duplicate?.fov).toBe(60);
      expect(duplicate?.description).toBe('Test description');
      expect(duplicate?.color).toBe('#ef4444');
      expect(duplicate?.icon).toBe('star');
    });

    it('should duplicate a bookmark with custom suffix (i18n support)', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let originalId: string;
      act(() => {
        originalId = result.current.addBookmark({
          name: 'Original',
          ra: 180,
          dec: 45,
          fov: 60,
        });
      });

      let duplicateId: string | null = null;
      act(() => {
        duplicateId = result.current.duplicateBookmark(originalId!, '（副本）');
      });

      const duplicate = result.current.getBookmark(duplicateId!);
      expect(duplicate?.name).toBe('Original （副本）');
    });

    it('should support various i18n suffixes', () => {
      const { result } = renderHook(() => useBookmarksStore());

      const suffixes = [
        '(Copy)',      // English
        '（副本）',    // Chinese
        '(Kopie)',     // German
        '(コピー)',    // Japanese
        '(복사)',      // Korean
      ];

      for (const suffix of suffixes) {
        let originalId: string;
        act(() => {
          originalId = result.current.addBookmark({
            name: 'Test',
            ra: 0,
            dec: 0,
            fov: 60,
          });
        });

        let duplicateId: string | null;
        act(() => {
          duplicateId = result.current.duplicateBookmark(originalId!, suffix);
        });

        const duplicate = result.current.getBookmark(duplicateId!);
        expect(duplicate?.name).toBe(`Test ${suffix}`);

        // Cleanup
        act(() => {
          result.current.removeBookmark(originalId!);
          result.current.removeBookmark(duplicateId!);
        });
      }
    });

    it('should return null for non-existent bookmark', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let duplicateId: string | null = null;
      act(() => {
        duplicateId = result.current.duplicateBookmark('non-existent-id');
      });

      expect(duplicateId).toBeNull();
    });

    it('should set new timestamps for duplicated bookmark', () => {
      const { result } = renderHook(() => useBookmarksStore());

      let originalId: string;
      act(() => {
        originalId = result.current.addBookmark({
          name: 'Original',
          ra: 0,
          dec: 0,
          fov: 60,
        });
      });

      const original = result.current.getBookmark(originalId!);

      let duplicateId: string | null;
      act(() => {
        duplicateId = result.current.duplicateBookmark(originalId!);
      });

      const duplicate = result.current.getBookmark(duplicateId!);
      expect(duplicate?.createdAt).toBeGreaterThanOrEqual(original!.createdAt);
      expect(duplicate?.updatedAt).toBeGreaterThanOrEqual(original!.updatedAt);
    });
  });
});

describe('BOOKMARK_COLORS', () => {
  it('should have 8 predefined colors', () => {
    expect(BOOKMARK_COLORS).toHaveLength(8);
  });

  it('should have valid hex color format', () => {
    BOOKMARK_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('BOOKMARK_ICONS', () => {
  it('should have 7 predefined icons', () => {
    expect(BOOKMARK_ICONS).toHaveLength(7);
  });

  it('should include expected icon types', () => {
    expect(BOOKMARK_ICONS).toContain('star');
    expect(BOOKMARK_ICONS).toContain('heart');
    expect(BOOKMARK_ICONS).toContain('telescope');
  });
});

describe('DEFAULT_BOOKMARKS', () => {
  it('should have predefined bookmarks', () => {
    expect(DEFAULT_BOOKMARKS.length).toBeGreaterThan(0);
  });

  it('should have valid bookmark structure', () => {
    DEFAULT_BOOKMARKS.forEach((bookmark) => {
      expect(bookmark.name).toBeDefined();
      expect(typeof bookmark.ra).toBe('number');
      expect(typeof bookmark.dec).toBe('number');
      expect(typeof bookmark.fov).toBe('number');
      expect(bookmark.ra).toBeGreaterThanOrEqual(0);
      expect(bookmark.ra).toBeLessThanOrEqual(360);
      expect(bookmark.dec).toBeGreaterThanOrEqual(-90);
      expect(bookmark.dec).toBeLessThanOrEqual(90);
    });
  });
});
