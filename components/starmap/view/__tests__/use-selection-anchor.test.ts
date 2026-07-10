/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';

// Controllable projector: each call to the tick advances through this queue.
let projectorResults: Array<{ x: number; y: number; visible: boolean } | null> = [];
let projectorCallCount = 0;
const mockCreateCoordinateProjector = jest.fn(
  () => () => {
    const result = projectorResults[Math.min(projectorCallCount, projectorResults.length - 1)] ?? null;
    projectorCallCount += 1;
    return result;
  },
);
jest.mock('@/lib/hooks/use-coordinate-projection', () => ({
  createCoordinateProjector: (...args: unknown[]) => mockCreateCoordinateProjector(...args as []),
}));

// Capture the animation-loop callback so tests can drive ticks manually.
let loopCallback: ((delta: number, timestamp: number) => void) | null = null;
let loopEnabled = false;
jest.mock('@/lib/hooks/use-animation-frame', () => ({
  useGlobalAnimationLoop: (
    _id: string,
    cb: (delta: number, timestamp: number) => void,
    enabled: boolean,
  ) => {
    loopCallback = cb;
    loopEnabled = enabled;
  },
}));

jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({ stel: { ready: true }, aladin: null })),
  }),
}));

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({ skyEngine: 'stellarium' })),
  }),
}));

import { useSelectionAnchor } from '../use-selection-anchor';
import type { SelectedObjectData } from '@/lib/core/types';

const makeObject = (name: string): SelectedObjectData => ({
  names: [name],
  ra: '0h',
  dec: '0°',
  raDeg: 10,
  decDeg: 20,
});

const BOUNDS = { width: 800, height: 600 };

describe('useSelectionAnchor', () => {
  let nowValue = 10_000;

  beforeEach(() => {
    jest.clearAllMocks();
    loopCallback = null;
    loopEnabled = false;
    projectorResults = [];
    projectorCallCount = 0;
    nowValue = 10_000;
    jest.spyOn(performance, 'now').mockImplementation(() => nowValue);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderAnchor(initial: {
    selectedObject: SelectedObjectData | null;
    clickPosition?: { x: number; y: number };
    pointerDownAt: number;
  }) {
    const lastCanvasPointerDownAtRef = { current: initial.pointerDownAt };
    const hook = renderHook(
      (props: { selectedObject: SelectedObjectData | null; clickPosition?: { x: number; y: number } }) =>
        useSelectionAnchor({
          selectedObject: props.selectedObject,
          clickPosition: props.clickPosition,
          lastCanvasPointerDownAtRef,
          containerBounds: BOUNDS,
        }),
      { initialProps: { selectedObject: initial.selectedObject, clickPosition: initial.clickPosition } },
    );
    return { ...hook, lastCanvasPointerDownAtRef };
  }

  it('freezes the click position for click-driven selections', () => {
    const { result } = renderAnchor({
      selectedObject: makeObject('M31'),
      clickPosition: { x: 123, y: 456 },
      pointerDownAt: nowValue - 100, // recent canvas pointerdown
    });

    expect(result.current).toEqual({ x: 123, y: 456 });
    expect(loopEnabled).toBe(false);
  });

  it('projects and freezes after two stable samples for programmatic selections', () => {
    projectorResults = [
      { x: 400, y: 300, visible: true },
      { x: 402, y: 300, visible: true }, // still moving (2px)
      { x: 402.5, y: 300, visible: true }, // settled (< 2px from previous)
    ];

    const { result } = renderAnchor({
      selectedObject: makeObject('M42'),
      clickPosition: { x: 9, y: 9 },
      pointerDownAt: nowValue - 5_000, // stale click — programmatic path
    });

    expect(loopEnabled).toBe(true);
    expect(result.current).toBeUndefined();

    act(() => loopCallback!(16, 200));
    act(() => loopCallback!(16, 400));
    act(() => loopCallback!(16, 600));

    expect(result.current).toEqual({ x: 402.5, y: 300 });
    expect(loopEnabled).toBe(false);
  });

  it('freezes the last sample on settle timeout', () => {
    projectorResults = [{ x: 100, y: 100, visible: true }];

    const { result } = renderAnchor({
      selectedObject: makeObject('M42'),
      pointerDownAt: nowValue - 5_000,
    });

    act(() => loopCallback!(16, 200));
    expect(result.current).toBeUndefined();

    // Past the 1.5s settle timeout — projector keeps returning a moving
    // position, but the hook gives up and freezes it.
    nowValue += 2_000;
    projectorResults = [{ x: 130, y: 100, visible: true }];
    projectorCallCount = 0;
    act(() => loopCallback!(16, 600));

    expect(result.current).toEqual({ x: 130, y: 100 });
  });

  it('falls back to the container center when the object never becomes visible', () => {
    projectorResults = [{ x: 0, y: 0, visible: false }];

    const { result } = renderAnchor({
      selectedObject: makeObject('M42'),
      pointerDownAt: nowValue - 5_000,
    });

    act(() => loopCallback!(16, 200));
    nowValue += 2_000;
    act(() => loopCallback!(16, 600));

    expect(result.current).toEqual({ x: BOUNDS.width / 2, y: BOUNDS.height / 2 });
  });

  it('returns undefined once the selection clears', () => {
    const { result, rerender } = renderAnchor({
      selectedObject: makeObject('M31'),
      clickPosition: { x: 10, y: 10 },
      pointerDownAt: nowValue - 100,
    });
    expect(result.current).toBeDefined();

    rerender({ selectedObject: null, clickPosition: { x: 10, y: 10 } });
    expect(result.current).toBeUndefined();
  });
});
