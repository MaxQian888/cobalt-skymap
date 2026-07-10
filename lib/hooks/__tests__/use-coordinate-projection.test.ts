/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { createCoordinateProjector, useBatchProjection } from '../use-coordinate-projection';
import { useGlobalAnimationLoop } from '../use-animation-frame';
import { useStellariumStore } from '@/lib/stores';
import { useSettingsStore } from '@/lib/stores/settings-store';

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock animation frame hook (not used in unit-tested functions)
jest.mock('../use-animation-frame', () => ({
  useGlobalAnimationLoop: jest.fn(),
}));

// Mock stores
jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn(),
    { getState: jest.fn(() => ({ stel: null, aladin: null, activeEngine: 'stellarium' })) }
  ),
}));

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: Object.assign(
    jest.fn(() => 'stellarium'),
    { getState: jest.fn(() => ({ skyEngine: 'stellarium' })) }
  ),
}));

describe('createCoordinateProjector', () => {
  describe('with no engine', () => {
    it('should return null projector when stel is null and no aladin', () => {
      const projector = createCoordinateProjector(null, 800, 600);
      const result = projector(180, 45);
      expect(result).toBeNull();
    });
  });

  describe('with Stellarium engine', () => {
    const createMockStel = () => ({
      D2R: Math.PI / 180,
      s2c: (ra: number, dec: number) => {
        const x = Math.cos(dec) * Math.cos(ra);
        const y = Math.cos(dec) * Math.sin(ra);
        const z = Math.sin(dec);
        return [x, y, z];
      },
      convertFrame: (_obs: unknown, _from: string, _to: string, vec: number[]) => vec,
      observer: {},
      core: { fov: Math.PI / 3 }, // 60deg FOV
    });

    it('should project coordinates within view to screen position', () => {
      const stel = createMockStel();
      // Mock convertFrame to return a point in front of viewer (z < 0)
      stel.convertFrame = (_obs, _from, _to, _vec) => [0, 0, -1];

      const projector = createCoordinateProjector(stel as never, 800, 600);
      const result = projector(0, 0);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(true);
      expect(result!.x).toBeCloseTo(400, 0); // center
      expect(result!.y).toBeCloseTo(300, 0); // center
    });

    it('should mark behind-viewer points as not visible', () => {
      const stel = createMockStel();
      // z > 0 means behind the viewer
      stel.convertFrame = (_obs, _from, _to, _vec) => [0, 0, 1];

      const projector = createCoordinateProjector(stel as never, 800, 600);
      const result = projector(0, 0);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
    });

    it('should mark out-of-margin points as not visible', () => {
      const stel = createMockStel();
      // Very far off-axis point
      stel.convertFrame = (_obs, _from, _to, _vec) => [10, 10, -1];

      const projector = createCoordinateProjector(stel as never, 800, 600, 1.1);
      const result = projector(0, 0);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
    });
  });

  describe('with Aladin engine', () => {
    const createMockAladin = (returnVal: [number, number] | null = [400, 300]) => ({
      world2pix: jest.fn(() => returnVal),
    });

    it('should use aladin world2pix when activeEngine is aladin', () => {
      const aladin = createMockAladin([200, 150]);
      const projector = createCoordinateProjector(
        null, 800, 600, 1.1,
        aladin as never, 'aladin'
      );
      const result = projector(180, 45);

      expect(aladin.world2pix).toHaveBeenCalledWith(180, 45);
      expect(result).not.toBeNull();
      expect(result!.x).toBe(200);
      expect(result!.y).toBe(150);
      expect(result!.visible).toBe(true);
    });

    it('should return not-visible when world2pix returns null', () => {
      const aladin = createMockAladin(null);
      const projector = createCoordinateProjector(
        null, 800, 600, 1.1,
        aladin as never, 'aladin'
      );
      const result = projector(180, 45);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
    });

    it('should mark out-of-bounds pixels as not visible', () => {
      // x=-200 is far outside containerWidth=800 with margin 1.1
      const aladin = createMockAladin([-200, 300]);
      const projector = createCoordinateProjector(
        null, 800, 600, 1.1,
        aladin as never, 'aladin'
      );
      const result = projector(180, 45);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(false);
    });

    it('should allow points within margin beyond canvas', () => {
      // x=850 is within margin (800 * 0.1 = 80, so 800+80=880 is the boundary)
      const aladin = createMockAladin([850, 300]);
      const projector = createCoordinateProjector(
        null, 800, 600, 1.1,
        aladin as never, 'aladin'
      );
      const result = projector(180, 45);

      expect(result).not.toBeNull();
      expect(result!.visible).toBe(true);
    });

    it('should fall back to stellarium when activeEngine is not aladin', () => {
      const aladin = createMockAladin([200, 150]);
      // With stel=null and activeEngine=stellarium, should return null
      const projector = createCoordinateProjector(
        null, 800, 600, 1.1,
        aladin as never, 'stellarium'
      );
      const result = projector(180, 45);

      expect(aladin.world2pix).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});

describe('useBatchProjection adaptive mode', () => {
  const mockUseGlobalAnimationLoop = useGlobalAnimationLoop as jest.Mock;
  const mockUseStellariumStore = useStellariumStore as unknown as jest.Mock;
  const mockUseSettingsStore = useSettingsStore as unknown as jest.Mock;

  // Distinguish item projections (ICRF→VIEW) from view probes (VIEW→ICRF).
  function createInstrumentedStel() {
    const calls = { itemProjection: 0, probe: 0 };
    const stel = {
      D2R: Math.PI / 180,
      observer: {},
      core: { fov: Math.PI / 3 },
      s2c: () => [0, 0, -1],
      convertFrame: (_obs: unknown, from: string, to: string, vec: number[]) => {
        if (from === 'VIEW' && to === 'ICRF') calls.probe += 1;
        else calls.itemProjection += 1;
        return from === 'VIEW' ? [0.1, 0.2, -0.97] : [0, 0, -1];
      },
    };
    return { stel, calls };
  }

  function renderAdaptive(stel: unknown) {
    mockUseStellariumStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ stel, aladin: null }),
    );
    mockUseSettingsStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ skyEngine: 'stellarium' }),
    );

    // Stable identity, like the memoized marker arrays in production — a new
    // array each render would legitimately force a reprojection.
    const items = [{ ra: 0, dec: 0 }];

    const hook = renderHook(() =>
      useBatchProjection({
        containerWidth: 800,
        containerHeight: 600,
        items,
        getRa: (i: { ra: number }) => i.ra,
        getDec: (i: { dec: number }) => i.dec,
        enabled: true,
        intervalMs: 0,
        adaptive: true,
        loopId: 'test-adaptive',
      }),
    );

    const tick = (timestamp: number) => {
      const cb = mockUseGlobalAnimationLoop.mock.calls.at(-1)![1] as (d: number, t: number) => void;
      act(() => cb(16, timestamp));
    };

    return { hook, tick };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips reprojection while the view is unchanged and recomputes on FOV change', () => {
    const { stel, calls } = createInstrumentedStel();
    const { hook, tick } = renderAdaptive(stel);

    tick(100);
    expect(calls.probe).toBe(1);
    expect(calls.itemProjection).toBe(1);
    expect(hook.result.current).toHaveLength(1);

    // Static view: probe runs every frame, item projection does not.
    tick(116);
    tick(132);
    expect(calls.probe).toBe(3);
    expect(calls.itemProjection).toBe(1);

    // View change (zoom) triggers a full reprojection.
    stel.core.fov = Math.PI / 4;
    tick(148);
    expect(calls.itemProjection).toBe(2);
  });
});
