/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useAladinEvents } from '../use-aladin-events';
import { searchOnlineByCoordinates } from '@/lib/services/online-search-service';

// Mock the online search service to avoid real network calls
jest.mock('@/lib/services/online-search-service', () => ({
  searchOnlineByCoordinates: jest.fn().mockResolvedValue({ results: [], sources: [], totalCount: 0, searchTimeMs: 0 }),
}));

describe('useAladinEvents', () => {
  const mockSearchOnlineByCoordinates = searchOnlineByCoordinates as jest.MockedFunction<typeof searchOnlineByCoordinates>;

  const createMockAladin = () => ({
    on: jest.fn(),
    pix2world: jest.fn(() => [180, 45] as [number, number]),
    getRaDec: jest.fn(() => [180, 45] as [number, number]),
    getFoV: jest.fn(() => [60, 60] as [number, number]),
    getFov: jest.fn(() => [60, 60] as [number, number]),
    getSize: jest.fn(() => [800, 600] as [number, number]),
  });

  const createContainer = () => {
    const div = document.createElement('div');
    div.getBoundingClientRect = jest.fn(() => ({
      left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}),
    }));
    return div;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchOnlineByCoordinates.mockResolvedValue({
      results: [],
      sources: [],
      totalCount: 0,
      searchTimeMs: 0,
    });
  });

  it('should not register events when engine is not ready', () => {
    const mockAladin = createMockAladin();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: false,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    expect(mockAladin.on).not.toHaveBeenCalled();
  });

  it('should register objectClicked event when engine is ready', () => {
    const mockAladin = createMockAladin();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    expect(mockAladin.on).toHaveBeenCalledWith('objectClicked', expect.any(Function));
  });

  it('should register click event for position resolution', () => {
    const mockAladin = createMockAladin();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    const clickCalls = mockAladin.on.mock.calls.filter(
      (c: [string, unknown]) => c[0] === 'click'
    );
    expect(clickCalls.length).toBe(1);
  });

  it('should create coordinate selection when clicking sky with ra/dec', () => {
    const mockAladin = createMockAladin();
    const onSelectionChange = jest.fn();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;
    expect(clickHandler).toBeDefined();

    // Click with ra/dec → coordinate selection (not deselect)
    clickHandler({ ra: 180, dec: 45, x: 400, y: 300 });
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        raDeg: 180,
        decDeg: 45,
        selectionSource: 'coordinate',
        selectionFallback: 'coordinate_fallback',
      })
    );
  });

  it('should compute adaptive SIMBAD search radius from FoV and viewport size', () => {
    const mockAladin = createMockAladin();
    mockAladin.getFoV.mockReturnValue([1, 1]);
    mockAladin.getSize.mockReturnValue([2400, 1200]);

    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;

    clickHandler({ ra: 180, dec: 45 });

    expect(mockSearchOnlineByCoordinates).toHaveBeenCalled();
    const [coords] = mockSearchOnlineByCoordinates.mock.calls[0];
    expect(coords.radius).toBeCloseTo(0.005, 3);
  });

  it('should abort previous SIMBAD lookup when a new click arrives', () => {
    const mockAladin = createMockAladin();
    mockSearchOnlineByCoordinates.mockImplementation(() => new Promise(() => {}));

    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;

    clickHandler({ ra: 180, dec: 45 });
    clickHandler({ ra: 181, dec: 46 });

    expect(mockSearchOnlineByCoordinates).toHaveBeenCalledTimes(2);
    const firstOptions = mockSearchOnlineByCoordinates.mock.calls[0]?.[1];
    const secondOptions = mockSearchOnlineByCoordinates.mock.calls[1]?.[1];
    expect(firstOptions?.signal).toBeDefined();
    expect(secondOptions?.signal).toBeDefined();
    expect((firstOptions!.signal as AbortSignal).aborted).toBe(true);
    expect((secondOptions!.signal as AbortSignal).aborted).toBe(false);
  });

  it('should ignore drag clicks (isDragging=true)', () => {
    const mockAladin = createMockAladin();
    const onSelectionChange = jest.fn();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;

    clickHandler({ ra: 180, dec: 45, isDragging: true });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('should call onSelectionChange(null) when click has no coordinates', () => {
    const mockAladin = createMockAladin();
    mockAladin.pix2world.mockReturnValue(null as unknown as [number, number]);
    const onSelectionChange = jest.fn();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;

    // Click with no ra/dec and pix2world returns null
    clickHandler({ someOtherProp: true });
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('should parse object data on objectClicked', () => {
    const mockAladin = createMockAladin();
    const onSelectionChange = jest.fn();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const objectClickedHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'objectClicked'
    )?.[1] as (obj: unknown) => void;
    expect(objectClickedHandler).toBeDefined();

    // Simulate object click
    objectClickedHandler({
      ra: 83.633,
      dec: 22.0145,
      data: { name: 'M1', type: 'nebula', mag: 8.4 },
    });

    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        names: ['M1'],
        raDeg: 83.633,
        decDeg: 22.0145,
        type: 'nebula',
        magnitude: 8.4,
        selectionSource: 'catalog',
      })
    );
  });

  it('should publish enriched selection metadata when SIMBAD resolves a clicked coordinate', async () => {
    const mockAladin = createMockAladin();
    const onSelectionChange = jest.fn();
    mockSearchOnlineByCoordinates.mockResolvedValue({
      results: [
        {
          id: 'm42',
          name: 'M42',
          canonicalId: 'M42',
          identifiers: ['M42', 'NGC 1976'],
          confidence: 0.99,
          alternateNames: ['NGC 1976'],
          ra: 180,
          dec: 45,
          raString: '12h 00m 00s',
          decString: '+45° 00\' 00"',
          type: 'Nebula',
          category: 'nebula',
          magnitude: 4,
          source: 'simbad',
        },
      ],
      sources: ['simbad'],
      totalCount: 1,
      searchTimeMs: 12,
    });

    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const clickHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'click'
    )?.[1] as (event: unknown) => void;

    clickHandler({ ra: 180, dec: 45, x: 400, y: 300 });
    await Promise.resolve();
    await Promise.resolve();

    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        names: ['M42', 'NGC 1976'],
        selectionSource: 'enriched',
        selectionFallback: 'resolved',
        sourceCatalog: 'SIMBAD',
      })
    );
  });

  it('should call onSelectionChange(null) when objectClicked with null', () => {
    const mockAladin = createMockAladin();
    const onSelectionChange = jest.fn();
    renderHook(() =>
      useAladinEvents({
        containerRef: { current: createContainer() },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange,
        onContextMenu: jest.fn(),
      })
    );

    const objectClickedHandler = mockAladin.on.mock.calls.find(
      (c: [string, unknown]) => c[0] === 'objectClicked'
    )?.[1] as (obj: unknown) => void;

    objectClickedHandler(null);
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('should register contextmenu DOM listener on container', () => {
    const container = createContainer();
    const addSpy = jest.spyOn(container, 'addEventListener');
    const mockAladin = createMockAladin();

    renderHook(() =>
      useAladinEvents({
        containerRef: { current: container },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    expect(addSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
  });

  it('should register touch event listeners for long-press', () => {
    const container = createContainer();
    const addSpy = jest.spyOn(container, 'addEventListener');
    const mockAladin = createMockAladin();

    renderHook(() =>
      useAladinEvents({
        containerRef: { current: container },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    const eventNames = addSpy.mock.calls.map(c => c[0]);
    expect(eventNames).toContain('touchstart');
    expect(eventNames).toContain('touchmove');
    expect(eventNames).toContain('touchend');
  });

  it('should cleanup event listeners on unmount', () => {
    const container = createContainer();
    const removeSpy = jest.spyOn(container, 'removeEventListener');
    const mockAladin = createMockAladin();

    const { unmount } = renderHook(() =>
      useAladinEvents({
        containerRef: { current: container },
        aladinRef: { current: mockAladin as never },
        engineReady: true,
        onSelectionChange: jest.fn(),
        onContextMenu: jest.fn(),
      })
    );

    unmount();

    const removedEvents = removeSpy.mock.calls.map(c => c[0]);
    expect(removedEvents).toContain('contextmenu');
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('touchmove');
    expect(removedEvents).toContain('touchend');
  });
});
