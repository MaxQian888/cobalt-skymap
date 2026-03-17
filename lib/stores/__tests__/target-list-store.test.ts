import { act, renderHook } from '@testing-library/react';
import { useTargetListStore, type TargetInput } from '../target-list-store';

// Mock Tauri platform check
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

// Mock target list API
jest.mock('@/lib/tauri/target-list-api', () => ({
  targetListApi: {
    addTarget: jest.fn().mockResolvedValue(undefined),
    removeTarget: jest.fn().mockResolvedValue(undefined),
    updateTarget: jest.fn().mockResolvedValue(undefined),
    getTargets: jest.fn().mockResolvedValue([]),
    setActiveTarget: jest.fn().mockResolvedValue(undefined),
    toggleFavorite: jest.fn().mockResolvedValue(undefined),
    toggleArchive: jest.fn().mockResolvedValue(undefined),
    archiveCompleted: jest.fn().mockResolvedValue(undefined),
    clearCompleted: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
    addTargetsBatch: jest.fn().mockResolvedValue(undefined),
    removeTargetsBatch: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(null),
  },
}));

// Mock zustand storage
jest.mock('@/lib/storage', () => ({
  getZustandStorage: jest.fn(() => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  })),
}));

describe('useTargetListStore', () => {
  const mockTarget: TargetInput = {
    name: 'M31 - Andromeda Galaxy',
    ra: 10.684,
    dec: 41.269,
    raString: '00h 42m 44s',
    decString: '+41° 16\' 09"',
    priority: 'high',
  };

  beforeEach(() => {
    const { result } = renderHook(() => useTargetListStore());
    act(() => {
      result.current.clearAll();
      result.current.setSearchQuery('');
      result.current.setFilterStatus('all');
      result.current.setFilterPriority('all');
      result.current.setFilterTags([]);
      result.current.setSortBy('manual');
      result.current.setSortOrder('asc');
      result.current.setScoreProfile('imaging');
      result.current.setScoreVersion('v2');
      result.current.setScoreBreakdownVisibility('collapsed');
      result.current.setShowArchived(false);
    });
  });

  describe('initial state', () => {
    it('should have empty targets array', () => {
      const { result } = renderHook(() => useTargetListStore());
      expect(result.current.targets).toEqual([]);
    });

    it('exposes multi-list target-management state', () => {
      const { result } = renderHook(() => useTargetListStore());

      expect(Array.isArray(result.current.targetLists)).toBe(true);
      expect(Array.isArray(result.current.targetEntries)).toBe(true);
      expect(typeof result.current.activeListId).toBe('string');
      expect(result.current.plannerSelection).toEqual({
        mode: 'active',
        selectedListIds: [],
      });
      expect(result.current.targetLists).toHaveLength(1);
    });

    it('should have no active target', () => {
      const { result } = renderHook(() => useTargetListStore());
      expect(result.current.activeTargetId).toBeNull();
    });

    it('should have showArchived disabled', () => {
      const { result } = renderHook(() => useTargetListStore());
      expect(result.current.showArchived).toBe(false);
    });

    it('should have groupBy set to none', () => {
      const { result } = renderHook(() => useTargetListStore());
      expect(result.current.groupBy).toBe('none');
    });
  });

  describe('addTarget', () => {
    it('should add a new target', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      expect(result.current.targets).toHaveLength(1);
      expect(result.current.targets[0].name).toBe('M31 - Andromeda Galaxy');
    });

    it('should set default status to planned', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      expect(result.current.targets[0].status).toBe('planned');
    });

    it('should set default isFavorite to false', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      expect(result.current.targets[0].isFavorite).toBe(false);
    });

    it('should set default isArchived to false', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      expect(result.current.targets[0].isArchived).toBe(false);
    });
  });

  describe('removeTarget', () => {
    it('should remove a target by id', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.removeTarget(targetId);
      });

      expect(result.current.targets).toHaveLength(0);
    });

    it('should clear activeTargetId if removed target was active', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.setActiveTarget(targetId);
      });

      expect(result.current.activeTargetId).toBe(targetId);

      act(() => {
        result.current.removeTarget(targetId);
      });

      expect(result.current.activeTargetId).toBeNull();
    });
  });

  describe('updateTarget', () => {
    it('should update target properties', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.updateTarget(targetId, { 
          notes: 'Great imaging target',
          priority: 'medium',
        });
      });

      expect(result.current.targets[0].notes).toBe('Great imaging target');
      expect(result.current.targets[0].priority).toBe('medium');
    });

    it('should update target status', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.updateTarget(targetId, { status: 'in_progress' });
      });

      expect(result.current.targets[0].status).toBe('in_progress');
    });
  });

  describe('setActiveTarget', () => {
    it('should set active target id', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.setActiveTarget(targetId);
      });

      expect(result.current.activeTargetId).toBe(targetId);
    });

    it('should allow setting to null', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      act(() => {
        result.current.setActiveTarget(result.current.targets[0].id);
      });

      act(() => {
        result.current.setActiveTarget(null);
      });

      expect(result.current.activeTargetId).toBeNull();
    });
  });

  describe('batch operations', () => {
    it('should add multiple targets at once', () => {
      const { result } = renderHook(() => useTargetListStore());

      const batchTargets = [
        { name: 'M31', ra: 10.684, dec: 41.269, raString: '00h 42m', decString: '+41°' },
        { name: 'M42', ra: 83.822, dec: -5.391, raString: '05h 35m', decString: '-05°' },
        { name: 'M45', ra: 56.601, dec: 24.105, raString: '03h 47m', decString: '+24°' },
      ];

      act(() => {
        result.current.addTargetsBatch(batchTargets);
      });

      expect(result.current.targets).toHaveLength(3);
    });

    it('should remove multiple targets at once', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Target 1' });
        result.current.addTarget({ ...mockTarget, name: 'Target 2' });
        result.current.addTarget({ ...mockTarget, name: 'Target 3' });
      });

      const ids = result.current.targets.slice(0, 2).map(t => t.id);

      act(() => {
        result.current.removeTargetsBatch(ids);
      });

      expect(result.current.targets).toHaveLength(1);
      expect(result.current.targets[0].name).toBe('Target 3');
    });

    it('should update status for multiple targets', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Target 1' });
        result.current.addTarget({ ...mockTarget, name: 'Target 2' });
      });

      const ids = result.current.targets.map(t => t.id);

      act(() => {
        result.current.setStatusBatch(ids, 'completed');
      });

      expect(result.current.targets.every(t => t.status === 'completed')).toBe(true);
    });

    it('should update priority for multiple targets', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Target 1' });
        result.current.addTarget({ ...mockTarget, name: 'Target 2' });
      });

      const ids = result.current.targets.map(t => t.id);

      act(() => {
        result.current.setPriorityBatch(ids, 'low');
      });

      expect(result.current.targets.every(t => t.priority === 'low')).toBe(true);
    });
  });

  describe('tag management', () => {
    it('should add tag to target', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.addTagBatch([targetId], 'galaxy');
      });

      expect(result.current.targets[0].tags).toContain('galaxy');
    });

    it('should remove tag from target', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, tags: ['galaxy', 'priority'] });
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.removeTagBatch([targetId], 'priority');
      });

      expect(result.current.targets[0].tags).not.toContain('priority');
      expect(result.current.targets[0].tags).toContain('galaxy');
    });
  });

  describe('favorite and archive', () => {
    it('should toggle favorite status', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.toggleFavorite(targetId);
      });

      expect(result.current.targets[0].isFavorite).toBe(true);

      act(() => {
        result.current.toggleFavorite(targetId);
      });

      expect(result.current.targets[0].isFavorite).toBe(false);
    });

    it('should toggle archive status', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget(mockTarget);
      });

      const targetId = result.current.targets[0].id;

      act(() => {
        result.current.toggleArchive(targetId);
      });

      expect(result.current.targets[0].isArchived).toBe(true);
    });
  });

  describe('multi-list operations', () => {
    it('creates a default replacement list when the last list is deleted', () => {
      const { result } = renderHook(() => useTargetListStore());
      const listId = result.current.activeListId;

      act(() => {
        result.current.deleteList(listId);
      });

      expect(result.current.targetLists).toHaveLength(1);
      expect(result.current.activeListId).toBe(result.current.targetLists[0].id);
    });

    it('keeps target state independent across lists', () => {
      const { result } = renderHook(() => useTargetListStore());
      const listA = result.current.activeListId;
      let listB = '';

      act(() => {
        listB = result.current.createList({ name: 'Widefield' });
        result.current.addEntryToList(listA, mockTarget);
        result.current.addEntryToList(listB, mockTarget);
      });

      const entryA = result.current.getEntriesForList(listA)[0];
      const entryB = result.current.getEntriesForList(listB)[0];

      act(() => {
        result.current.updateEntry(entryA.id, { status: 'completed', notes: 'done' });
      });

      expect(result.current.getEntryById(entryA.id)?.status).toBe('completed');
      expect(result.current.getEntryById(entryA.id)?.notes).toBe('done');
      expect(result.current.getEntryById(entryB.id)?.status).toBe('planned');
      expect(result.current.getEntryById(entryB.id)?.notes).toBeUndefined();
    });

    it('aggregates entries across selected planner lists', () => {
      const { result } = renderHook(() => useTargetListStore());
      let wideId = '';
      let narrowId = '';

      act(() => {
        wideId = result.current.createList({ name: 'Wide' });
        narrowId = result.current.createList({ name: 'Narrow' });
        result.current.addEntryToList(wideId, mockTarget);
        result.current.addEntryToList(narrowId, {
          ...mockTarget,
          name: 'NGC 7000',
          ra: 312.5,
          dec: 44.3,
          raString: '20h 50m',
          decString: '+44° 18\'',
        });
        result.current.setPlannerSelection({
          mode: 'selected',
          selectedListIds: [wideId, narrowId],
        });
      });

      expect(result.current.getPlannerEntries()).toHaveLength(2);
    });
  });

  describe('filtering', () => {
    it('should set filter tags', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.setFilterTags(['galaxy', 'nebula']);
      });

      expect(result.current.filterTags).toEqual(['galaxy', 'nebula']);
    });

    it('should toggle showArchived', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.setShowArchived(true);
      });

      expect(result.current.showArchived).toBe(true);
    });

    it('should set groupBy option', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.setGroupBy('priority');
      });

      expect(result.current.groupBy).toBe('priority');
    });
  });

  describe('getters', () => {
    it('should get non-archived targets', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Active Target' });
        result.current.addTarget({ ...mockTarget, name: 'Archived Target' });
      });

      const archivedId = result.current.targets[1].id;

      act(() => {
        result.current.toggleArchive(archivedId);
      });

      const activeTargets = result.current.targets.filter(t => !t.isArchived);
      expect(activeTargets).toHaveLength(1);
      expect(activeTargets[0].name).toBe('Active Target');
    });

    it('should get favorite targets', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Regular Target' });
        result.current.addTarget({ ...mockTarget, name: 'Favorite Target' });
      });

      const favoriteId = result.current.targets[1].id;

      act(() => {
        result.current.toggleFavorite(favoriteId);
      });

      const favorites = result.current.targets.filter(t => t.isFavorite);
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe('Favorite Target');
    });
  });

  describe('search and filter state', () => {
    it('should have default search/filter/sort state', () => {
      const { result } = renderHook(() => useTargetListStore());
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filterStatus).toBe('all');
      expect(result.current.filterPriority).toBe('all');
      expect(result.current.sortBy).toBe('manual');
      expect(result.current.sortOrder).toBe('asc');
    });

    it('should set search query', () => {
      const { result } = renderHook(() => useTargetListStore());
      act(() => { result.current.setSearchQuery('andromeda'); });
      expect(result.current.searchQuery).toBe('andromeda');
    });

    it('should set filter status', () => {
      const { result } = renderHook(() => useTargetListStore());
      act(() => { result.current.setFilterStatus('completed'); });
      expect(result.current.filterStatus).toBe('completed');
    });

    it('should set filter priority', () => {
      const { result } = renderHook(() => useTargetListStore());
      act(() => { result.current.setFilterPriority('high'); });
      expect(result.current.filterPriority).toBe('high');
    });

    it('should set sort by', () => {
      const { result } = renderHook(() => useTargetListStore());
      act(() => { result.current.setSortBy('name'); });
      expect(result.current.sortBy).toBe('name');
    });

    it('should set sort order', () => {
      const { result } = renderHook(() => useTargetListStore());
      act(() => { result.current.setSortOrder('desc'); });
      expect(result.current.sortOrder).toBe('desc');
    });
  });

  describe('getFilteredTargets', () => {
    it('should filter by search query (name)', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'M31 - Andromeda Galaxy' });
        result.current.addTarget({ ...mockTarget, name: 'M42 - Orion Nebula' });
        result.current.addTarget({ ...mockTarget, name: 'M45 - Pleiades' });
      });

      act(() => { result.current.setSearchQuery('orion'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('M42 - Orion Nebula');
    });

    it('should filter by search query (tags)', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Target A', tags: ['galaxy'] });
        result.current.addTarget({ ...mockTarget, name: 'Target B', tags: ['nebula'] });
      });

      act(() => { result.current.setSearchQuery('galaxy'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Target A');
    });

    it('should filter by search query (notes)', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Target A' });
        result.current.addTarget({ ...mockTarget, name: 'Target B' });
      });

      const idB = result.current.targets[1].id;
      act(() => { result.current.updateTarget(idB, { notes: 'best in winter' }); });
      act(() => { result.current.setSearchQuery('winter'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Target B');
    });

    it('should filter by status', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Planned' });
        result.current.addTarget({ ...mockTarget, name: 'Done' });
      });

      const doneId = result.current.targets[1].id;
      act(() => { result.current.updateTarget(doneId, { status: 'completed' }); });
      act(() => { result.current.setFilterStatus('completed'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Done');
    });

    it('should filter by priority', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'High', priority: 'high' });
        result.current.addTarget({ ...mockTarget, name: 'Low', priority: 'low' });
      });

      act(() => { result.current.setFilterPriority('low'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Low');
    });

    it('should combine search and filter', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'M31', priority: 'high' });
        result.current.addTarget({ ...mockTarget, name: 'M42', priority: 'high' });
        result.current.addTarget({ ...mockTarget, name: 'M45', priority: 'low' });
      });

      act(() => {
        result.current.setSearchQuery('M4');
        result.current.setFilterPriority('high');
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('M42');
    });

    it('should exclude archived targets by default', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Active' });
        result.current.addTarget({ ...mockTarget, name: 'Archived' });
      });

      const archivedId = result.current.targets[1].id;
      act(() => { result.current.toggleArchive(archivedId); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Active');
    });

    it('should include archived targets when showArchived is true', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Active' });
        result.current.addTarget({ ...mockTarget, name: 'Archived' });
      });

      const archivedId = result.current.targets[1].id;
      act(() => {
        result.current.toggleArchive(archivedId);
        result.current.setShowArchived(true);
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered).toHaveLength(2);
    });
  });

  describe('sorting via getFilteredTargets', () => {
    it('should sort by name ascending', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Zeta' });
        result.current.addTarget({ ...mockTarget, name: 'Alpha' });
        result.current.addTarget({ ...mockTarget, name: 'Mu' });
      });

      act(() => {
        result.current.setSortBy('name');
        result.current.setSortOrder('asc');
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered.map(t => t.name)).toEqual(['Alpha', 'Mu', 'Zeta']);
    });

    it('should sort by name descending', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Zeta' });
        result.current.addTarget({ ...mockTarget, name: 'Alpha' });
      });

      act(() => {
        result.current.setSortBy('name');
        result.current.setSortOrder('desc');
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered.map(t => t.name)).toEqual(['Zeta', 'Alpha']);
    });

    it('should sort by priority', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Low', priority: 'low' });
        result.current.addTarget({ ...mockTarget, name: 'High', priority: 'high' });
        result.current.addTarget({ ...mockTarget, name: 'Med', priority: 'medium' });
      });

      act(() => {
        result.current.setSortBy('priority');
        result.current.setSortOrder('asc');
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered.map(t => t.name)).toEqual(['High', 'Med', 'Low']);
    });

    it('should sort by status', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Done' });
        result.current.addTarget({ ...mockTarget, name: 'Planned' });
        result.current.addTarget({ ...mockTarget, name: 'InProg' });
      });

      const doneId = result.current.targets[0].id;
      const inProgId = result.current.targets[2].id;
      act(() => {
        result.current.updateTarget(doneId, { status: 'completed' });
        result.current.updateTarget(inProgId, { status: 'in_progress' });
      });

      act(() => {
        result.current.setSortBy('status');
        result.current.setSortOrder('asc');
      });

      const filtered = result.current.getFilteredTargets();
      expect(filtered.map(t => t.name)).toEqual(['Planned', 'InProg', 'Done']);
    });

    it('should not sort when sortBy is manual', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'B' });
        result.current.addTarget({ ...mockTarget, name: 'A' });
        result.current.addTarget({ ...mockTarget, name: 'C' });
      });

      act(() => { result.current.setSortBy('manual'); });

      const filtered = result.current.getFilteredTargets();
      expect(filtered.map(t => t.name)).toEqual(['B', 'A', 'C']);
    });

    it('should sort feasibility ascending and descending consistently', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'Short Window' });
        result.current.addTarget({ ...mockTarget, name: 'Long Window' });
      });

      const shortId = result.current.targets.find((t) => t.name === 'Short Window')!.id;
      const longId = result.current.targets.find((t) => t.name === 'Long Window')!.id;

      act(() => {
        result.current.updateObservableWindow(shortId, {
          start: new Date('2026-01-01T20:00:00Z'),
          end: new Date('2026-01-01T21:00:00Z'),
          maxAltitude: 35,
          transitTime: new Date('2026-01-01T20:30:00Z'),
          isCircumpolar: false,
        });
        result.current.updateObservableWindow(longId, {
          start: new Date('2026-01-01T20:00:00Z'),
          end: new Date('2026-01-02T02:00:00Z'),
          maxAltitude: 75,
          transitTime: new Date('2026-01-01T23:00:00Z'),
          isCircumpolar: true,
        });
        result.current.setSortBy('feasibility');
        result.current.setSortOrder('asc');
      });

      let filtered = result.current.getFilteredTargets();
      expect(filtered[0].name).toBe('Short Window');
      expect(filtered[1].name).toBe('Long Window');

      act(() => {
        result.current.setSortOrder('desc');
      });

      filtered = result.current.getFilteredTargets();
      expect(filtered[0].name).toBe('Long Window');
      expect(filtered[1].name).toBe('Short Window');
    });
  });

  describe('checkDuplicate', () => {
    it('should find duplicate by exact name match (case-insensitive)', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'M31' });
      });

      const dup = result.current.checkDuplicate('m31', 0, 0);
      expect(dup).toBeDefined();
      expect(dup!.name).toBe('M31');
    });

    it('should find duplicate by close coordinates', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'M31', ra: 10.684, dec: 41.269 });
      });

      const dup = result.current.checkDuplicate('Different Name', 10.685, 41.268);
      expect(dup).toBeDefined();
    });

    it('should return undefined when no duplicate', () => {
      const { result } = renderHook(() => useTargetListStore());

      act(() => {
        result.current.addTarget({ ...mockTarget, name: 'M31', ra: 10.684, dec: 41.269 });
      });

      const dup = result.current.checkDuplicate('M42', 83.822, -5.391);
      expect(dup).toBeUndefined();
    });
  });
});

describe('target-list additional coverage', () => {
  const mockTarget = {
    name: 'T1',
    ra: 10.684,
    dec: 41.269,
    raString: '00h 42m 44s',
    decString: '+41d 16m 09s',
    priority: 'high' as const,
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { result } = require('@testing-library/react').renderHook(() => useTargetListStore());
    act(() => {
      result.current.clearAll();
      result.current.setSearchQuery('');
      result.current.setFilterStatus('all');
      result.current.setFilterPriority('all');
      result.current.setFilterTags([]);
      result.current.setSortBy('manual');
      result.current.setSortOrder('asc');
      result.current.setShowArchived(false);
    });
  });

  describe('selection management', () => {
    it('should toggle selection', () => {
      const store = useTargetListStore.getState();
      act(() => { store.addTarget(mockTarget); });
      const id = useTargetListStore.getState().targets[0].id;
      act(() => { useTargetListStore.getState().toggleSelection(id); });
      expect(useTargetListStore.getState().selectedIds.has(id)).toBe(true);
      act(() => { useTargetListStore.getState().toggleSelection(id); });
      expect(useTargetListStore.getState().selectedIds.has(id)).toBe(false);
    });

    it('should select all targets', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
        useTargetListStore.getState().selectAll();
      });
      expect(useTargetListStore.getState().selectedIds.size).toBe(2);
    });

    it('should clear selection', () => {
      act(() => {
        useTargetListStore.getState().addTarget(mockTarget);
        useTargetListStore.getState().selectAll();
        useTargetListStore.getState().clearSelection();
      });
      expect(useTargetListStore.getState().selectedIds.size).toBe(0);
    });

    it('should select by status', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
      });
      const idB = useTargetListStore.getState().targets[1].id;
      act(() => {
        useTargetListStore.getState().updateTarget(idB, { status: 'completed' });
        useTargetListStore.getState().selectByStatus('completed');
      });
      expect(useTargetListStore.getState().selectedIds.size).toBe(1);
      expect(useTargetListStore.getState().selectedIds.has(idB)).toBe(true);
    });

    it('should select by priority', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'H', priority: 'high' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'L', priority: 'low' });
        useTargetListStore.getState().selectByPriority('low');
      });
      expect(useTargetListStore.getState().selectedIds.size).toBe(1);
    });

    it('should get selected targets', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
      });
      const idA = useTargetListStore.getState().targets[0].id;
      act(() => { useTargetListStore.getState().toggleSelection(idA); });
      const selected = useTargetListStore.getState().getSelectedTargets();
      expect(selected).toHaveLength(1);
      expect(selected[0].name).toBe('A');
    });
  });

  describe('reorderTargets', () => {
    it('should move a target from one position to another', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'C' });
        useTargetListStore.getState().reorderTargets(2, 0);
      });
      const names = useTargetListStore.getState().targets.map(t => t.name);
      expect(names).toEqual(['C', 'A', 'B']);
    });
  });

  describe('updateTargetsBatch', () => {
    it('should update multiple targets at once', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
      });
      const ids = useTargetListStore.getState().targets.map(t => t.id);
      act(() => {
        useTargetListStore.getState().updateTargetsBatch(ids, { notes: 'batch note' });
      });
      expect(useTargetListStore.getState().targets.every(t => t.notes === 'batch note')).toBe(true);
    });
  });

  describe('clearCompleted', () => {
    it('should remove only completed targets', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Planned' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Done' });
      });
      const doneId = useTargetListStore.getState().targets[1].id;
      act(() => {
        useTargetListStore.getState().updateTarget(doneId, { status: 'completed' });
        useTargetListStore.getState().clearCompleted();
      });
      expect(useTargetListStore.getState().targets).toHaveLength(1);
      expect(useTargetListStore.getState().targets[0].name).toBe('Planned');
    });
  });

  describe('archiveCompleted', () => {
    it('should archive all completed targets', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Done' });
      });
      const id = useTargetListStore.getState().targets[0].id;
      act(() => {
        useTargetListStore.getState().updateTarget(id, { status: 'completed' });
        useTargetListStore.getState().archiveCompleted();
      });
      expect(useTargetListStore.getState().targets[0].isArchived).toBe(true);
    });
  });

  describe('tag management (available tags)', () => {
    it('should add a new available tag', () => {
      act(() => { useTargetListStore.getState().addTag('custom-tag'); });
      expect(useTargetListStore.getState().availableTags).toContain('custom-tag');
    });

    it('should remove an available tag', () => {
      act(() => { useTargetListStore.getState().removeTag('galaxy'); });
      expect(useTargetListStore.getState().availableTags).not.toContain('galaxy');
    });
  });

  describe('getGroupedTargets', () => {
    it('should group by priority', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'H', priority: 'high' });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'L', priority: 'low' });
        useTargetListStore.getState().setGroupBy('priority');
      });
      const grouped = useTargetListStore.getState().getGroupedTargets();
      expect(grouped.size).toBeGreaterThanOrEqual(2);
    });

    it('should group by status', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'P' });
        useTargetListStore.getState().setGroupBy('status');
      });
      const grouped = useTargetListStore.getState().getGroupedTargets();
      expect(grouped.has('planned')).toBe(true);
    });

    it('should return single group when groupBy is none', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
        useTargetListStore.getState().setGroupBy('none');
      });
      const grouped = useTargetListStore.getState().getGroupedTargets();
      expect(grouped.size).toBe(1);
    });
  });

  describe('filter by tags', () => {
    it('should filter targets by tag', () => {
      act(() => {
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A', tags: ['galaxy'] });
        useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B', tags: ['nebula'] });
        useTargetListStore.getState().setFilterTags(['galaxy']);
      });
      const filtered = useTargetListStore.getState().getFilteredTargets();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('A');
    });
  });

  describe('updateObservableWindow', () => {
    it('should update observable window for a target', () => {
      act(() => { useTargetListStore.getState().addTarget(mockTarget); });
      const id = useTargetListStore.getState().targets[0].id;
      const window = {
        start: new Date('2026-01-01T20:00:00Z'),
        end: new Date('2026-01-01T23:00:00Z'),
        maxAltitude: 65,
        transitTime: new Date('2026-01-01T21:30:00Z'),
        isCircumpolar: false,
      };
      act(() => { useTargetListStore.getState().updateObservableWindow(id, window); });
      expect(useTargetListStore.getState().targets[0].observableWindow?.maxAltitude).toBe(65);
    });
  });

  describe('score settings', () => {
    it('should set score profile', () => {
      act(() => { useTargetListStore.getState().setScoreProfile('visual'); });
      expect(useTargetListStore.getState().scoreProfile).toBe('visual');
    });

    it('should set score version', () => {
      act(() => { useTargetListStore.getState().setScoreVersion('v1'); });
      expect(useTargetListStore.getState().scoreVersion).toBe('v1');
    });

    it('should set score breakdown visibility', () => {
      act(() => { useTargetListStore.getState().setScoreBreakdownVisibility('expanded'); });
      expect(useTargetListStore.getState().scoreBreakdownVisibility).toBe('expanded');
    });
  });
});

describe('target-list groupBy tag and sort addedAt', () => {
  const mockTarget = {
    name: 'T1',
    ra: 10.684,
    dec: 41.269,
    raString: '00h 42m 44s',
    decString: '+41d 16m 09s',
    priority: 'high' as const,
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { result } = require('@testing-library/react').renderHook(() => useTargetListStore());
    act(() => {
      result.current.clearAll();
      result.current.setSearchQuery('');
      result.current.setFilterStatus('all');
      result.current.setFilterPriority('all');
      result.current.setFilterTags([]);
      result.current.setSortBy('manual');
      result.current.setSortOrder('asc');
      result.current.setShowArchived(false);
    });
  });

  it('should group by tag (including untagged)', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Tagged', tags: ['galaxy'] });
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Untagged' });
      useTargetListStore.getState().setGroupBy('tag');
    });
    const grouped = useTargetListStore.getState().getGroupedTargets();
    expect(grouped.has('galaxy')).toBe(true);
    expect(grouped.has('untagged')).toBe(true);
  });

  it('should group by tag with multi-tag targets', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Multi', tags: ['galaxy', 'nebula'] });
      useTargetListStore.getState().setGroupBy('tag');
    });
    const grouped = useTargetListStore.getState().getGroupedTargets();
    expect(grouped.get('galaxy')?.length).toBe(1);
    expect(grouped.get('nebula')?.length).toBe(1);
  });

  it('should sort by addedAt ascending', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'First' });
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Second' });
      useTargetListStore.getState().setSortBy('addedAt');
      useTargetListStore.getState().setSortOrder('asc');
    });
    const filtered = useTargetListStore.getState().getFilteredTargets();
    expect(filtered[0].name).toBe('First');
    expect(filtered[1].name).toBe('Second');
  });

  it('should sort by addedAt descending', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'First' });
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Second' });
    });
    // Ensure different addedAt timestamps
    const ids = useTargetListStore.getState().targets.map(t => t.id);
    act(() => {
      useTargetListStore.getState().updateTarget(ids[0], { addedAt: 1000 } as never);
      useTargetListStore.getState().updateTarget(ids[1], { addedAt: 2000 } as never);
      useTargetListStore.getState().setSortBy('addedAt');
      useTargetListStore.getState().setSortOrder('desc');
    });
    const filtered = useTargetListStore.getState().getFilteredTargets();
    expect(filtered[0].name).toBe('Second');
    expect(filtered[1].name).toBe('First');
  });

  it('removeTag should also remove tag from targets and filterTags', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A', tags: ['galaxy', 'nebula'] });
      useTargetListStore.getState().setFilterTags(['galaxy']);
      useTargetListStore.getState().removeTag('galaxy');
    });
    const s = useTargetListStore.getState();
    expect(s.targets[0].tags).toEqual(['nebula']);
    expect(s.filterTags).not.toContain('galaxy');
    expect(s.availableTags).not.toContain('galaxy');
  });

  it('addTargetsBatch should apply defaultSettings', () => {
    act(() => {
      useTargetListStore.getState().addTargetsBatch(
        [
          { name: 'A', ra: 1, dec: 2, raString: '1', decString: '2' },
          { name: 'B', ra: 3, dec: 4, raString: '3', decString: '4' },
        ],
        { priority: 'low', tags: ['tonight'] }
      );
    });
    const targets = useTargetListStore.getState().targets;
    expect(targets).toHaveLength(2);
    expect(targets[0].priority).toBe('low');
    expect(targets[0].tags).toContain('tonight');
  });

  it('removeTargetsBatch should clear selection and activeTarget', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'B' });
    });
    const ids = useTargetListStore.getState().targets.map(t => t.id);
    act(() => {
      useTargetListStore.getState().setActiveTarget(ids[0]);
      useTargetListStore.getState().toggleSelection(ids[0]);
      useTargetListStore.getState().removeTargetsBatch([ids[0]]);
    });
    expect(useTargetListStore.getState().activeTargetId).toBeNull();
    expect(useTargetListStore.getState().selectedIds.has(ids[0])).toBe(false);
  });

  it('addTagBatch should add new tag to availableTags', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'A' });
    });
    const id = useTargetListStore.getState().targets[0].id;
    act(() => {
      useTargetListStore.getState().addTagBatch([id], 'custom-new-tag');
    });
    expect(useTargetListStore.getState().availableTags).toContain('custom-new-tag');
    expect(useTargetListStore.getState().targets[0].tags).toContain('custom-new-tag');
  });

  it('clearCompleted should also clean selection', () => {
    act(() => {
      useTargetListStore.getState().addTarget({ ...mockTarget, name: 'Done' });
    });
    const id = useTargetListStore.getState().targets[0].id;
    act(() => {
      useTargetListStore.getState().updateTarget(id, { status: 'completed' });
      useTargetListStore.getState().toggleSelection(id);
      useTargetListStore.getState().clearCompleted();
    });
    expect(useTargetListStore.getState().targets).toHaveLength(0);
    expect(useTargetListStore.getState().selectedIds.size).toBe(0);
  });
});

describe('target-list Tauri paths', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isTauri } = require('@/lib/storage/platform');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { targetListApi } = require('@/lib/tauri/target-list-api');
  const mockTarget = {
    name: 'T1',
    ra: 10.684,
    dec: 41.269,
    raString: '00h 42m 44s',
    decString: '+41d 16m 09s',
    priority: 'high' as const,
  };

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { result } = require('@testing-library/react').renderHook(() => useTargetListStore());
    act(() => { result.current.clearAll(); });
    jest.clearAllMocks();
    (isTauri as jest.Mock).mockReturnValue(false);
  });

  afterAll(() => {
    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri addTarget when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.addTarget.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    expect(targetListApi.addTarget).toHaveBeenCalled();
    const arg = targetListApi.addTarget.mock.calls[0][0];
    expect(arg.name).toBe('T1');
    expect(arg.ra_string).toBe('00h 42m 44s');
  });

  it('should call Tauri addTarget with exposurePlan conversion', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.addTarget.mockResolvedValue(undefined);

    act(() => {
      useTargetListStore.getState().addTarget({
        ...mockTarget,
        exposurePlan: {
          singleExposure: 120,
          totalExposure: 60,
          subFrames: 30,
          filter: 'L',
          advanced: {
            sqm: 20.5,
            filterBandwidthNm: 7,
            readNoiseLimitPercent: 5,
            gainStrategy: 'unity',
            recommendedGain: 100,
            recommendedExposureSec: 120,
            skyFluxPerPixel: 0.5,
            targetSignalPerPixelPerSec: 0.1,
            dynamicRangeScore: 0.8,
            dynamicRangeStops: 12,
            readNoiseUsed: 3.5,
            darkCurrentUsed: 0.01,
            noiseFractions: { read: 0.3, sky: 0.5, dark: 0.2 },
            stackEstimate: {
              recommendedFrameCount: 30,
              estimatedTotalMinutes: 60,
              framesForTargetSNR: 25,
              framesForTimeNoise: 20,
              targetSNR: 50,
              targetTimeNoiseRatio: 0.1,
            },
          },
        },
      });
    });

    expect(targetListApi.addTarget).toHaveBeenCalled();
    const arg = targetListApi.addTarget.mock.calls[0][0];
    expect(arg.exposure_plan).toBeDefined();
    expect(arg.exposure_plan.single_exposure).toBe(120);
    expect(arg.exposure_plan.advanced.sqm).toBe(20.5);
    expect(arg.exposure_plan.advanced.noise_fractions.read).toBe(0.3);
    expect(arg.exposure_plan.advanced.stack_estimate.target_snr).toBe(50);
  });

  it('should call Tauri removeTarget when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.removeTarget.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().removeTarget(id); });
    expect(targetListApi.removeTarget).toHaveBeenCalledWith(id);
  });

  it('should call Tauri updateTarget when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.updateTarget.mockResolvedValue(undefined);

    act(() => {
      useTargetListStore.getState().updateTarget(id, {
        name: 'Updated',
        ra: 20,
        dec: 30,
        raString: '01h',
        decString: '+30d',
        priority: 'low',
        status: 'in_progress',
        notes: 'note',
        tags: ['x'],
        isFavorite: true,
        isArchived: false,
        exposurePlan: { singleExposure: 60, totalExposure: 30, subFrames: 15 },
      });
    });
    expect(targetListApi.updateTarget).toHaveBeenCalled();
  });

  it('should call Tauri toggleFavorite when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.toggleFavorite.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().toggleFavorite(id); });
    expect(targetListApi.toggleFavorite).toHaveBeenCalledWith(id);
  });

  it('should call Tauri toggleArchive when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.toggleArchive.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().toggleArchive(id); });
    expect(targetListApi.toggleArchive).toHaveBeenCalledWith(id);
  });

  it('should call Tauri archiveCompleted when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.archiveCompleted.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().archiveCompleted(); });
    expect(targetListApi.archiveCompleted).toHaveBeenCalled();
  });

  it('should call Tauri clearCompleted when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.clearCompleted.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().clearCompleted(); });
    expect(targetListApi.clearCompleted).toHaveBeenCalled();
  });

  it('should call Tauri clearAll when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.clearAll.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().clearAll(); });
    expect(targetListApi.clearAll).toHaveBeenCalled();
  });

  it('should call Tauri setActiveTarget when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.setActiveTarget.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().setActiveTarget(id); });
    expect(targetListApi.setActiveTarget).toHaveBeenCalledWith(id);
  });

  it('should call Tauri addTargetsBatch when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.addTargetsBatch.mockResolvedValue(undefined);

    act(() => {
      useTargetListStore.getState().addTargetsBatch([
        { name: 'A', ra: 1, dec: 2, raString: '1', decString: '2' },
      ]);
    });
    expect(targetListApi.addTargetsBatch).toHaveBeenCalled();
  });

  it('should call Tauri removeTargetsBatch when isTauri is true', () => {
    act(() => { useTargetListStore.getState().addTarget(mockTarget); });
    const id = useTargetListStore.getState().targets[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.removeTargetsBatch.mockResolvedValue(undefined);

    act(() => { useTargetListStore.getState().removeTargetsBatch([id]); });
    expect(targetListApi.removeTargetsBatch).toHaveBeenCalledWith([id]);
  });

  it('syncWithTauri keeps only supported mosaic warning codes', async () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    targetListApi.load.mockResolvedValue({
      targets: [{
        id: 'target-1',
        name: 'M31',
        ra: 10.684,
        dec: 41.269,
        ra_string: '00h 42m 44s',
        dec_string: '+41d 16m 09s',
        added_at: 1,
        priority: 'high',
        status: 'planned',
        tags: [],
        is_favorite: false,
        is_archived: false,
        mosaic_plan: {
          layout_mode: 'rectangular',
          panel_order: 'row-major',
          total_panels: 4,
          width: 2,
          height: 2,
          overlap_factor: 0.9,
          estimated_panel_minutes: 30,
          estimated_total_minutes: 120,
          panels: [{
            id: 'panel-r1-c1',
            row: 0,
            col: 0,
            x: 0,
            y: 0,
            center_offset_x: 0,
            center_offset_y: 0,
            sequence: 1,
            is_center: true,
          }],
          warnings: [
            { code: 'panel_count_high', severity: 'warning', actual: 20, max: 16 },
            { code: 'unsupported_warning', severity: 'warning', actual: 1 },
          ],
        },
      }],
      available_tags: [],
      active_target_id: 'target-1',
    });

    await act(async () => {
      await useTargetListStore.getState().syncWithTauri();
    });

    expect(useTargetListStore.getState().targets[0].mosaicPlan?.warnings).toEqual([
      expect.objectContaining({
        code: 'panel_count_high',
        severity: 'warning',
      }),
    ]);
  });
});
