import { act, renderHook } from '@testing-library/react';
import { useMarkerStore, MARKER_COLORS, MARKER_ICONS, MAX_MARKERS, type MarkerInput } from '../marker-store';

const originalConsoleError = console.error;

// Mock Tauri platform check
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

// Mock markers API
jest.mock('@/lib/tauri/markers-api', () => ({
  markersApi: {
    addMarker: jest.fn().mockResolvedValue(undefined),
    removeMarker: jest.fn().mockResolvedValue(undefined),
    updateMarker: jest.fn().mockResolvedValue(undefined),
    removeMarkersByGroup: jest.fn().mockResolvedValue(undefined),
    clearAll: jest.fn().mockResolvedValue(undefined),
    toggleVisibility: jest.fn().mockResolvedValue(undefined),
    setAllVisible: jest.fn().mockResolvedValue(undefined),
    setShowMarkers: jest.fn().mockResolvedValue(undefined),
    addGroup: jest.fn().mockResolvedValue(undefined),
    removeGroup: jest.fn().mockResolvedValue(undefined),
    renameGroup: jest.fn().mockResolvedValue(undefined),
    load: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
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

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const [firstArg] = args;
    if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
      return;
    }
    originalConsoleError(...args as Parameters<typeof console.error>);
  });

  const { result } = renderHook(() => useMarkerStore());
  act(() => {
    result.current.clearAllMarkers();
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMarkerStore', () => {
  describe('initial state', () => {
    it('should have empty markers array initially', () => {
      const { result } = renderHook(() => useMarkerStore());
      expect(result.current.markers).toEqual([]);
    });

    it('should have default group', () => {
      const { result } = renderHook(() => useMarkerStore());
      expect(result.current.groups).toContain('Default');
      expect(result.current.groupVisibility.Default).toBe(true);
    });

    it('should have showMarkers enabled by default', () => {
      const { result } = renderHook(() => useMarkerStore());
      expect(result.current.showMarkers).toBe(true);
    });

    it('should have no active marker', () => {
      const { result } = renderHook(() => useMarkerStore());
      expect(result.current.activeMarkerId).toBeNull();
    });
  });

  describe('addMarker', () => {
    it('should add a marker and return its id', () => {
      const { result } = renderHook(() => useMarkerStore());
      const markerInput: MarkerInput = {
        name: 'Test Marker',
        ra: 180,
        dec: 45,
        raString: '12h 00m 00s',
        decString: '+45° 00\' 00"',
        color: '#ef4444',
        icon: 'star',
      };

      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker(markerInput);
      });

      expect(markerId!).toBeDefined();
      expect(markerId!).toMatch(/^marker-/);
      expect(result.current.markers).toHaveLength(1);
      expect(result.current.markers[0].name).toBe('Test Marker');
    });

    it('should auto-add group if not exists', () => {
      const { result } = renderHook(() => useMarkerStore());
      const markerInput: MarkerInput = {
        name: 'Test Marker',
        ra: 180,
        dec: 45,
        raString: '12h 00m 00s',
        decString: '+45° 00\' 00"',
        color: '#ef4444',
        icon: 'star',
        group: 'NewGroup',
      };

      act(() => {
        result.current.addMarker(markerInput);
      });

      expect(result.current.groups).toContain('NewGroup');
    });
  });

  describe('removeMarker', () => {
    it('should remove a marker by id', () => {
      const { result } = renderHook(() => useMarkerStore());
      
      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker({
          name: 'Test Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
      });

      expect(result.current.markers).toHaveLength(1);

      act(() => {
        result.current.removeMarker(markerId!);
      });

      expect(result.current.markers).toHaveLength(0);
    });

    it('should clear active marker if removed', () => {
      const { result } = renderHook(() => useMarkerStore());
      
      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker({
          name: 'Test Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
        result.current.setActiveMarker(markerId);
      });

      expect(result.current.activeMarkerId).toBe(markerId!);

      act(() => {
        result.current.removeMarker(markerId!);
      });

      expect(result.current.activeMarkerId).toBeNull();
    });
  });

  describe('updateMarker', () => {
    it('should update marker properties', () => {
      const { result } = renderHook(() => useMarkerStore());
      
      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker({
          name: 'Test Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
      });

      act(() => {
        result.current.updateMarker(markerId!, { name: 'Updated Marker' });
      });

      expect(result.current.markers[0].name).toBe('Updated Marker');
    });

    it('should clear marker description when null is provided', () => {
      const { result } = renderHook(() => useMarkerStore());

      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker({
          name: 'Test Marker',
          description: 'to-clear',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
      });

      act(() => {
        result.current.updateMarker(markerId!, { description: null });
      });

      expect(result.current.markers[0].description).toBeUndefined();
    });
  });

  describe('visibility', () => {
    it('should toggle marker visibility', () => {
      const { result } = renderHook(() => useMarkerStore());
      
      let markerId: string | null;
      act(() => {
        markerId = result.current.addMarker({
          name: 'Test Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
      });

      expect(result.current.markers[0].visible).toBe(true);

      act(() => {
        result.current.toggleMarkerVisibility(markerId!);
      });

      expect(result.current.markers[0].visible).toBe(false);
    });

    it('should set show markers flag', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.setShowMarkers(false);
      });

      expect(result.current.showMarkers).toBe(false);
    });

    it('should hide markers when group visibility is disabled', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addMarker({
          name: 'Group Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
          group: 'GroupA',
        });
        result.current.setGroupVisibility('GroupA', false);
      });

      expect(result.current.getVisibleMarkers()).toHaveLength(0);
      expect(result.current.getVisibleMarkersByGroup('GroupA')).toHaveLength(0);
    });

    it('should preserve marker visibility intent through group toggles', () => {
      const { result } = renderHook(() => useMarkerStore());
      let markerId: string | null = null;

      act(() => {
        markerId = result.current.addMarker({
          name: 'Hidden Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
          group: 'GroupA',
        });
      });

      act(() => {
        result.current.toggleMarkerVisibility(markerId!); // hidden individually
        result.current.setGroupVisibility('GroupA', false);
        result.current.setGroupVisibility('GroupA', true);
      });

      const marker = result.current.markers.find((m) => m.id === markerId);
      expect(marker?.visible).toBe(false);
      expect(result.current.getVisibleMarkers()).toHaveLength(0);
    });
  });

  describe('group management', () => {
    it('should add a new group', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addGroup('Observation Targets');
      });

      expect(result.current.groups).toContain('Observation Targets');
    });

    it('should remove a group', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addGroup('ToRemove');
      });

      expect(result.current.groups).toContain('ToRemove');

      act(() => {
        result.current.removeGroup('ToRemove');
      });

      expect(result.current.groups).not.toContain('ToRemove');
    });

    it('should keep group visibility state when group is renamed', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addGroup('OldGroup');
        result.current.setGroupVisibility('OldGroup', false);
        result.current.renameGroup('OldGroup', 'NewGroup');
      });

      expect(result.current.groupVisibility.OldGroup).toBeUndefined();
      expect(result.current.groupVisibility.NewGroup).toBe(false);
    });
  });

  describe('getters', () => {
    it('should get markers by group', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addMarker({
          name: 'Marker 1',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
          group: 'GroupA',
        });
        result.current.addMarker({
          name: 'Marker 2',
          ra: 90,
          dec: 30,
          raString: '06h 00m 00s',
          decString: '+30° 00\' 00"',
          color: '#3b82f6',
          icon: 'circle',
          group: 'GroupB',
        });
      });

      const groupAMarkers = result.current.getMarkersByGroup('GroupA');
      expect(groupAMarkers).toHaveLength(1);
      expect(groupAMarkers[0].name).toBe('Marker 1');
    });

    it('should get visible markers only', () => {
      const { result } = renderHook(() => useMarkerStore());

      act(() => {
        result.current.addMarker({
          name: 'Visible Marker',
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          color: '#ef4444',
          icon: 'star',
        });
        result.current.addMarker({
          name: 'Hidden Marker',
          ra: 90,
          dec: 30,
          raString: '06h 00m 00s',
          decString: '+30° 00\' 00"',
          color: '#3b82f6',
          icon: 'circle',
          visible: false,
        });
      });

      const visibleMarkers = result.current.markers.filter(m => m.visible);
      expect(visibleMarkers).toHaveLength(1);
      expect(visibleMarkers[0].name).toBe('Visible Marker');
    });
  });
});

describe('MARKER_COLORS', () => {
  it('should have 9 colors', () => {
    expect(MARKER_COLORS).toHaveLength(9);
  });

  it('should all be valid hex colors', () => {
    MARKER_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('MARKER_ICONS', () => {
  it('should have 8 icons', () => {
    expect(MARKER_ICONS).toHaveLength(8);
  });

  it('should include common icon types', () => {
    expect(MARKER_ICONS).toContain('star');
    expect(MARKER_ICONS).toContain('circle');
    expect(MARKER_ICONS).toContain('crosshair');
    expect(MARKER_ICONS).toContain('pin');
  });
});

describe('MAX_MARKERS limit', () => {
  it('should export MAX_MARKERS constant', () => {
    expect(MAX_MARKERS).toBe(500);
  });

  it('should return null when marker limit is reached', () => {
    const { result } = renderHook(() => useMarkerStore());

    // Directly set markers to the max count
    act(() => {
      for (let i = 0; i < MAX_MARKERS; i++) {
        result.current.addMarker({
          name: `Marker ${i}`,
          ra: i,
          dec: i,
          raString: `${i}h`,
          decString: `${i}d`,
          color: '#ef4444',
          icon: 'star',
        });
      }
    });

    expect(result.current.markers).toHaveLength(MAX_MARKERS);

    let id: string | null;
    act(() => {
      id = result.current.addMarker({
        name: 'Over Limit',
        ra: 0,
        dec: 0,
        raString: '0h',
        decString: '0d',
        color: '#ef4444',
        icon: 'star',
      });
    });

    expect(id!).toBeNull();
    expect(result.current.markers).toHaveLength(MAX_MARKERS);

    // Cleanup
    act(() => {
      result.current.clearAllMarkers();
    });
  });
});

describe('display settings', () => {
  it('should have showLabels enabled by default', () => {
    const { result } = renderHook(() => useMarkerStore());
    expect(result.current.showLabels).toBe(true);
  });

  it('should toggle showLabels', () => {
    const { result } = renderHook(() => useMarkerStore());
    act(() => {
      result.current.setShowLabels(false);
    });
    expect(result.current.showLabels).toBe(false);
    act(() => {
      result.current.setShowLabels(true);
    });
    expect(result.current.showLabels).toBe(true);
  });

  it('should have default globalMarkerSize of 20', () => {
    const { result } = renderHook(() => useMarkerStore());
    expect(result.current.globalMarkerSize).toBe(20);
  });

  it('should clamp globalMarkerSize between 8 and 48', () => {
    const { result } = renderHook(() => useMarkerStore());
    act(() => {
      result.current.setGlobalMarkerSize(2);
    });
    expect(result.current.globalMarkerSize).toBe(8);
    act(() => {
      result.current.setGlobalMarkerSize(100);
    });
    expect(result.current.globalMarkerSize).toBe(48);
  });

  it('should have default sortBy as date', () => {
    const { result } = renderHook(() => useMarkerStore());
    expect(result.current.sortBy).toBe('date');
  });

  it('should change sortBy', () => {
    const { result } = renderHook(() => useMarkerStore());
    act(() => {
      result.current.setSortBy('name');
    });
    expect(result.current.sortBy).toBe('name');
    act(() => {
      result.current.setSortBy('ra');
    });
    expect(result.current.sortBy).toBe('ra');
  });
});

describe('import/export', () => {
  it('should export markers as JSON string', () => {
    const { result } = renderHook(() => useMarkerStore());

    act(() => {
      result.current.setShowMarkers(true);
      result.current.addMarker({
        name: 'Export Test',
        ra: 180,
        dec: 45,
        raString: '12h 00m 00s',
        decString: '+45° 00\' 00"',
        color: '#ef4444',
        icon: 'star',
        group: 'TestGroup',
      });
    });

    const json = result.current.exportMarkers();
    const data = JSON.parse(json);
    expect(data.version).toBe(3);
    expect(data.markers).toHaveLength(1);
    expect(data.markers[0].name).toBe('Export Test');
    expect(data.groups).toContain('TestGroup');
    expect(data.groupVisibility).toBeDefined();
    expect(data.groupVisibility.TestGroup).toBe(true);
    expect(data.showMarkers).toBe(true);
    expect(typeof data.showMarkersUpdatedAt).toBe('number');
  });

  it('should import markers from JSON string', () => {
    const { result } = renderHook(() => useMarkerStore());

    const importData = JSON.stringify({
      version: 1,
      markers: [
        {
          name: 'Imported Marker',
          ra: 90,
          dec: 30,
          raString: '06h 00m 00s',
          decString: '+30° 00\' 00"',
          color: '#3b82f6',
          icon: 'circle',
          group: 'ImportedGroup',
          visible: true,
        },
      ],
      groups: ['ImportedGroup'],
      groupVisibility: {
        ImportedGroup: false,
      },
    });

    let importResult: { count: number; requested: number; truncated: boolean };
    act(() => {
      importResult = result.current.importMarkers(importData);
    });

    expect(importResult!.count).toBe(1);
    expect(importResult!.requested).toBe(1);
    expect(importResult!.truncated).toBe(false);
    expect(result.current.markers.some(m => m.name === 'Imported Marker')).toBe(true);
    expect(result.current.groups).toContain('ImportedGroup');
    expect(result.current.groupVisibility.ImportedGroup).toBe(false);
  });

  it('should throw on invalid import data', () => {
    const { result } = renderHook(() => useMarkerStore());
    expect(() => {
      act(() => {
        result.current.importMarkers('not json');
      });
    }).toThrow();
  });
});

describe('marker-store additional coverage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { result } = require('@testing-library/react').renderHook(() => useMarkerStore());
    act(() => { result.current.clearAllMarkers(); });
  });

  describe('renameGroup', () => {
    it('should rename a group and update markers in that group', () => {
      const store = useMarkerStore.getState();
      act(() => {
        store.addGroup('OldGroup');
        store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star', group: 'OldGroup',
        });
        store.renameGroup('OldGroup', 'NewGroup');
      });
      const s = useMarkerStore.getState();
      expect(s.groups).toContain('NewGroup');
      expect(s.groups).not.toContain('OldGroup');
      expect(s.markers[0].group).toBe('NewGroup');
    });

    it('should no-op when renaming to same name', () => {
      act(() => { useMarkerStore.getState().addGroup('Same'); });
      const before = useMarkerStore.getState().groups.length;
      act(() => { useMarkerStore.getState().renameGroup('Same', 'Same'); });
      expect(useMarkerStore.getState().groups.length).toBe(before);
    });
  });

  describe('removeMarkersByGroup', () => {
    it('should remove all markers in a group', () => {
      const store = useMarkerStore.getState();
      act(() => {
        store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star', group: 'GroupA',
        });
        store.addMarker({
          name: 'M2', ra: 20, dec: 30, raString: '20', decString: '30',
          color: '#00ff00', icon: 'circle', group: 'GroupB',
        });
        store.removeMarkersByGroup('GroupA');
      });
      const s = useMarkerStore.getState();
      expect(s.markers).toHaveLength(1);
      expect(s.markers[0].name).toBe('M2');
    });

    it('should clear activeMarkerId if active marker is in removed group', () => {
      const store = useMarkerStore.getState();
      let id: string | null = null;
      act(() => {
        id = store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star', group: 'GroupA',
        });
        store.setActiveMarker(id);
      });
      expect(useMarkerStore.getState().activeMarkerId).toBe(id);
      act(() => { useMarkerStore.getState().removeMarkersByGroup('GroupA'); });
      expect(useMarkerStore.getState().activeMarkerId).toBeNull();
    });
  });

  describe('setAllMarkersVisible', () => {
    it('should set all markers to visible or hidden', () => {
      const store = useMarkerStore.getState();
      act(() => {
        store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star',
        });
        store.addMarker({
          name: 'M2', ra: 20, dec: 30, raString: '20', decString: '30',
          color: '#00ff00', icon: 'circle',
        });
        store.setAllMarkersVisible(false);
      });
      expect(useMarkerStore.getState().markers.every(m => !m.visible)).toBe(true);
      act(() => { useMarkerStore.getState().setAllMarkersVisible(true); });
      expect(useMarkerStore.getState().markers.every(m => m.visible)).toBe(true);
    });
  });

  describe('getVisibleMarkers', () => {
    it('should return empty when showMarkers is false', () => {
      const store = useMarkerStore.getState();
      act(() => {
        store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star',
        });
        store.setShowMarkers(false);
      });
      expect(useMarkerStore.getState().getVisibleMarkers()).toEqual([]);
    });

    it('should return only visible markers when showMarkers is true', () => {
      const store = useMarkerStore.getState();
      let id: string | null = null;
      act(() => {
        store.setShowMarkers(true);
        id = store.addMarker({
          name: 'M1', ra: 10, dec: 20, raString: '10', decString: '20',
          color: '#ff0000', icon: 'star',
        });
        store.addMarker({
          name: 'M2', ra: 20, dec: 30, raString: '20', decString: '30',
          color: '#00ff00', icon: 'circle',
        });
        store.toggleMarkerVisibility(id!);
      });
      const visible = useMarkerStore.getState().getVisibleMarkers();
      expect(visible).toHaveLength(1);
      expect(visible[0].name).toBe('M2');
    });
  });

  describe('setPendingCoords / setEditingMarkerId', () => {
    it('should set and clear pending coords', () => {
      act(() => { useMarkerStore.getState().setPendingCoords({ ra: 10, dec: 20, raString: '00h 40m 00s', decString: '+20d 00m 00s' }); });
      expect(useMarkerStore.getState().pendingCoords).toEqual({ ra: 10, dec: 20, raString: '00h 40m 00s', decString: '+20d 00m 00s' });
      act(() => { useMarkerStore.getState().setPendingCoords(null); });
      expect(useMarkerStore.getState().pendingCoords).toBeNull();
    });

    it('should set and clear editing marker id', () => {
      act(() => { useMarkerStore.getState().setEditingMarkerId('abc'); });
      expect(useMarkerStore.getState().editingMarkerId).toBe('abc');
      act(() => { useMarkerStore.getState().setEditingMarkerId(null); });
      expect(useMarkerStore.getState().editingMarkerId).toBeNull();
    });
  });

  describe('selectMarkerForNavigation', () => {
    it('should set active marker and return the selected marker', () => {
      let id: string | null = null;
      act(() => {
        id = useMarkerStore.getState().addMarker({
          name: 'NavTarget',
          ra: 10,
          dec: 20,
          raString: '10',
          decString: '20',
          color: '#ff0000',
          icon: 'star',
        });
      });

      let selected: unknown = null;
      act(() => {
        selected = useMarkerStore.getState().selectMarkerForNavigation(id);
      });

      expect(selected).not.toBeNull();
      expect(useMarkerStore.getState().activeMarkerId).toBe(id);
    });
  });

  describe('import edge cases', () => {
    it('should import array format (legacy)', () => {
      const data = JSON.stringify([
        { name: 'Legacy', ra: 10, dec: 20, raString: '10', decString: '20', color: '#ff0000', icon: 'star', visible: true },
      ]);
      let result: { count: number } = { count: 0 };
      act(() => { result = useMarkerStore.getState().importMarkers(data); });
      expect(result.count).toBe(1);
    });

    it('should throw on empty markers array', () => {
      const data = JSON.stringify({ version: 2, markers: [] });
      expect(() => {
        act(() => { useMarkerStore.getState().importMarkers(data); });
      }).toThrow('No markers found');
    });

    it('should import with showMarkers and groups', () => {
      const data = JSON.stringify({
        version: 2,
        markers: [{ name: 'X', ra: 1, dec: 2, raString: '1', decString: '2', color: '#000', icon: 'pin', visible: true }],
        groups: ['MyGroup'],
        showMarkers: false,
        showMarkersUpdatedAt: 999999,
      });
      act(() => { useMarkerStore.getState().importMarkers(data); });
      const s = useMarkerStore.getState();
      expect(s.showMarkers).toBe(false);
      expect(s.groups).toContain('MyGroup');
    });

    it('should respect MAX_MARKERS during import', () => {
      // Fill to near max
      act(() => {
        for (let i = 0; i < 498; i++) {
          useMarkerStore.getState().addMarker({
            name: `M${i}`, ra: i, dec: i, raString: `${i}`, decString: `${i}`,
            color: '#ff0000', icon: 'star',
          });
        }
      });
      const data = JSON.stringify({
        version: 2,
        markers: [
          { name: 'A', ra: 1, dec: 1, visible: true },
          { name: 'B', ra: 2, dec: 2, visible: true },
          { name: 'C', ra: 3, dec: 3, visible: true },
        ],
      });
      let result: { count: number } = { count: 0 };
      act(() => { result = useMarkerStore.getState().importMarkers(data); });
      expect(result.count).toBe(2); // only 2 slots left
    });
  });
});

describe('marker-store Tauri paths', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isTauri } = require('@/lib/storage/platform');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { markersApi } = require('@/lib/tauri/markers-api');

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { result } = require('@testing-library/react').renderHook(() => useMarkerStore());
    act(() => { result.current.clearAllMarkers(); });
    jest.clearAllMocks();
  });

  it('should call Tauri addMarker when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.addMarker.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: true,
      show_markers_updated_at: 0,
    });

    act(() => {
      useMarkerStore.getState().addMarker({
        name: 'TauriMarker', ra: 10, dec: 20, raString: '10', decString: '20',
        color: '#ff0000', icon: 'star',
      });
    });

    expect(markersApi.addMarker).toHaveBeenCalled();
    const callArg = markersApi.addMarker.mock.calls[0][0];
    expect(callArg.name).toBe('TauriMarker');
    expect(callArg.ra_string).toBe('10');
    expect(callArg.dec_string).toBe('20');

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri removeMarker when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(false);
    act(() => {
      useMarkerStore.getState().addMarker({
        name: 'ToRemove', ra: 10, dec: 20, raString: '10', decString: '20',
        color: '#ff0000', icon: 'star',
      });
    });
    const id = useMarkerStore.getState().markers[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.removeMarker.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: true,
      show_markers_updated_at: 0,
    });

    act(() => { useMarkerStore.getState().removeMarker(id); });
    expect(markersApi.removeMarker).toHaveBeenCalledWith(id);

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri updateMarker when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(false);
    act(() => {
      useMarkerStore.getState().addMarker({
        name: 'ToUpdate', ra: 10, dec: 20, raString: '10', decString: '20',
        color: '#ff0000', icon: 'star',
      });
    });
    const id = useMarkerStore.getState().markers[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.updateMarker.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: true,
      show_markers_updated_at: 0,
    });

    act(() => {
      useMarkerStore.getState().updateMarker(id, {
        name: 'Updated', color: '#00ff00', icon: 'circle',
        ra: 15, dec: 25, raString: '15', decString: '25',
        group: 'NewGroup', visible: false, description: 'desc',
      });
    });
    expect(markersApi.updateMarker).toHaveBeenCalled();

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri toggleVisibility when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(false);
    act(() => {
      useMarkerStore.getState().addMarker({
        name: 'Toggle', ra: 10, dec: 20, raString: '10', decString: '20',
        color: '#ff0000', icon: 'star',
      });
    });
    const id = useMarkerStore.getState().markers[0].id;

    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.toggleVisibility.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: true,
      show_markers_updated_at: 0,
    });

    act(() => { useMarkerStore.getState().toggleMarkerVisibility(id); });
    expect(markersApi.toggleVisibility).toHaveBeenCalledWith(id);

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri setAllVisible when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.setAllVisible.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: true,
      show_markers_updated_at: 0,
    });

    act(() => { useMarkerStore.getState().setAllMarkersVisible(false); });
    expect(markersApi.setAllVisible).toHaveBeenCalledWith(false);

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri setShowMarkers when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.setShowMarkers.mockResolvedValue({
      markers: [],
      groups: ['Default'],
      show_markers: false,
      show_markers_updated_at: 0,
    });

    act(() => { useMarkerStore.getState().setShowMarkers(false); });
    expect(markersApi.setShowMarkers).toHaveBeenCalledWith(false);

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri group operations when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.addGroup.mockResolvedValue({ markers: [], groups: ['Default', 'New'], show_markers: true, show_markers_updated_at: 0 });
    markersApi.removeGroup.mockResolvedValue({ markers: [], groups: ['Default'], show_markers: true, show_markers_updated_at: 0 });
    markersApi.renameGroup.mockResolvedValue({ markers: [], groups: ['Default', 'Renamed'], show_markers: true, show_markers_updated_at: 0 });

    act(() => { useMarkerStore.getState().addGroup('New'); });
    expect(markersApi.addGroup).toHaveBeenCalledWith('New');

    act(() => { useMarkerStore.getState().removeGroup('New'); });
    expect(markersApi.removeGroup).toHaveBeenCalledWith('New');

    act(() => {
      useMarkerStore.getState().addGroup('Old');
      useMarkerStore.getState().renameGroup('Old', 'Renamed');
    });
    expect(markersApi.renameGroup).toHaveBeenCalledWith('Old', 'Renamed');

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri removeMarkersByGroup when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(false);
    act(() => {
      useMarkerStore.getState().addMarker({
        name: 'G', ra: 10, dec: 20, raString: '10', decString: '20',
        color: '#ff0000', icon: 'star', group: 'TestGroup',
      });
    });

    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.removeMarkersByGroup.mockResolvedValue({ markers: [], groups: ['Default'], show_markers: true, show_markers_updated_at: 0 });

    act(() => { useMarkerStore.getState().removeMarkersByGroup('TestGroup'); });
    expect(markersApi.removeMarkersByGroup).toHaveBeenCalledWith('TestGroup');

    (isTauri as jest.Mock).mockReturnValue(false);
  });

  it('should call Tauri clearAll when isTauri is true', () => {
    (isTauri as jest.Mock).mockReturnValue(true);
    markersApi.clearAll.mockResolvedValue({ markers: [], groups: ['Default'], show_markers: true, show_markers_updated_at: 0 });

    act(() => { useMarkerStore.getState().clearAllMarkers(); });
    expect(markersApi.clearAll).toHaveBeenCalled();

    (isTauri as jest.Mock).mockReturnValue(false);
  });
});
