/**
 * Tests for use-stellarium-zoom.ts
 * FOV/zoom control for Stellarium engine
 */

import { renderHook, act } from '@testing-library/react';
import { useStellariumZoom } from '../use-stellarium-zoom';
import { useRef } from 'react';
import { fovToRad, fovToDeg } from '@/lib/core/stellarium-canvas-utils';
import {
  MIN_FOV,
  MAX_FOV,
  WHEEL_ZOOM_DURATION,
  BUTTON_ZOOM_DURATION,
  SLIDER_ZOOM_DURATION,
} from '@/lib/core/constants/fov';

describe('useStellariumZoom', () => {
  it('should return zoom control functions', () => {
    const { result } = renderHook(() => {
      const stelRef = useRef(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      return useStellariumZoom({ stelRef, canvasRef });
    });
    expect(typeof result.current.zoomIn).toBe('function');
    expect(typeof result.current.zoomOut).toBe('function');
    expect(typeof result.current.setFov).toBe('function');
    expect(typeof result.current.getFov).toBe('function');
    expect(typeof result.current.setEngineFov).toBe('function');
  });

  it('should zoomIn reducing FOV', () => {
    const initialFov = fovToRad(60);
    const mockStel = {
      core: { fov: initialFov },
      zoomTo: jest.fn(),
    };
    const onFovChange = jest.fn();

    const { result } = renderHook(() => {
      const stelRef = useRef(mockStel);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      return useStellariumZoom({ stelRef: stelRef as never, canvasRef, onFovChange });
    });

    act(() => result.current.zoomIn());
    expect(onFovChange).toHaveBeenCalled();
    const newFov = onFovChange.mock.calls[0][0];
    expect(newFov).toBeLessThan(60);
  });

  it('should zoomOut increasing FOV', () => {
    const initialFov = fovToRad(60);
    const mockStel = {
      core: { fov: initialFov },
      zoomTo: jest.fn(),
    };
    const onFovChange = jest.fn();

    const { result } = renderHook(() => {
      const stelRef = useRef(mockStel);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      return useStellariumZoom({ stelRef: stelRef as never, canvasRef, onFovChange });
    });

    act(() => result.current.zoomOut());
    expect(onFovChange).toHaveBeenCalled();
    const newFov = onFovChange.mock.calls[0][0];
    expect(newFov).toBeGreaterThan(60);
  });

  it('should return current FOV from getFov', () => {
    const fov = fovToRad(45);
    const mockStel = { core: { fov } };

    const { result } = renderHook(() => {
      const stelRef = useRef(mockStel);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      return useStellariumZoom({ stelRef: stelRef as never, canvasRef });
    });

    expect(result.current.getFov()).toBeCloseTo(45, 1);
  });

  it('should return null FOV when stel is null', () => {
    const { result } = renderHook(() => {
      const stelRef = useRef(null);
      const canvasRef = useRef<HTMLCanvasElement | null>(null);
      return useStellariumZoom({ stelRef, canvasRef });
    });

    // Returns DEFAULT_FOV when stel is null
    expect(result.current.getFov()).toBe(60);
  });

  describe('smooth zoom (zoomTo everywhere)', () => {
    function setup(initialFovDeg = 60) {
      const mockStel = {
        core: { fov: fovToRad(initialFovDeg) },
        zoomTo: jest.fn(),
      };
      const onFovChange = jest.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);

      const hook = renderHook(() => {
        const stelRef = useRef(mockStel);
        const canvasRef = useRef<HTMLCanvasElement | null>(null);
        const containerRef = useRef<HTMLDivElement | null>(container);
        return useStellariumZoom({ stelRef: stelRef as never, canvasRef, containerRef, onFovChange });
      });

      return { mockStel, onFovChange, container, hook };
    }

    afterEach(() => {
      document.body.innerHTML = '';
      jest.useRealTimers();
    });

    it('buttons animate via zoomTo with the button duration', () => {
      const { mockStel, hook } = setup(60);

      act(() => hook.result.current.zoomIn());
      expect(mockStel.zoomTo).toHaveBeenCalledWith(fovToRad(48), BUTTON_ZOOM_DURATION);

      act(() => hook.result.current.setFov(30));
      expect(mockStel.zoomTo).toHaveBeenLastCalledWith(fovToRad(30), SLIDER_ZOOM_DURATION);
    });

    it('wheel zoom animates via zoomTo and compounds rapid notches', () => {
      jest.useFakeTimers();
      const { mockStel, onFovChange, container } = setup(60);

      const wheel = (deltaY: number) =>
        container.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));

      act(() => {
        wheel(100); // zoom out one notch: 60 * 1.1 = 66
      });
      expect(mockStel.zoomTo).toHaveBeenCalledWith(fovToRad(66), WHEEL_ZOOM_DURATION);
      expect(onFovChange).toHaveBeenLastCalledWith(66);

      act(() => {
        wheel(100); // second rapid notch compounds from the target, not core.fov
      });
      const lastFov = fovToDeg(mockStel.zoomTo.mock.calls.at(-1)![0] as number);
      expect(lastFov).toBeCloseTo(60 * 1.1 * 1.1, 5);
    });

    it('resets the accumulated target after the idle window', () => {
      jest.useFakeTimers();
      const { mockStel, container } = setup(60);

      act(() => {
        container.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      });
      act(() => {
        jest.advanceTimersByTime(400); // past ZOOM_TARGET_RESET_MS
      });
      // core.fov unchanged in the mock (no real animation) — after the reset
      // the next notch starts from core.fov (60), not the stale target (66).
      act(() => {
        container.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      });
      const lastFov = fovToDeg(mockStel.zoomTo.mock.calls.at(-1)![0] as number);
      expect(lastFov).toBeCloseTo(66, 5);
    });

    it('clamps wheel zoom to MIN/MAX FOV', () => {
      const { mockStel, container } = setup(179);

      act(() => {
        container.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      });
      expect(fovToDeg(mockStel.zoomTo.mock.calls.at(-1)![0] as number)).toBeCloseTo(MAX_FOV, 5);

      const zoomedIn = setup(MIN_FOV * 1.05);
      act(() => {
        zoomedIn.container.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      });
      expect(fovToDeg(zoomedIn.mockStel.zoomTo.mock.calls.at(-1)![0] as number)).toBeCloseTo(MIN_FOV, 5);
    });

    it('ignores wheel events over UI controls', () => {
      const { mockStel, container } = setup(60);
      const panel = document.createElement('div');
      panel.setAttribute('data-starmap-ui-control', 'true');
      const inner = document.createElement('span');
      panel.appendChild(inner);
      container.appendChild(panel);

      act(() => {
        inner.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
      });
      expect(mockStel.zoomTo).not.toHaveBeenCalled();
    });

    it('suppresses the engine legacy mousewheel zoom over the sky', () => {
      const { container } = setup(60);
      const event = new Event('mousewheel', { bubbles: true, cancelable: true });
      const stopPropagation = jest.spyOn(event, 'stopPropagation');

      act(() => {
        container.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(stopPropagation).toHaveBeenCalled();
    });
  });
});
