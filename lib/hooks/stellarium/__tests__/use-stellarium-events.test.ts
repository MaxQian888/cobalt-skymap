/**
 * Tests for use-stellarium-events.ts
 * Right-click context menu and long press event handling
 */

import { renderHook } from '@testing-library/react';
import { useStellariumEvents } from '../use-stellarium-events';
import { useRef } from 'react';

describe('useStellariumEvents', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should not throw when containerRef is null', () => {
    expect(() => {
      renderHook(() => {
        const containerRef = useRef<HTMLDivElement | null>(null);
        useStellariumEvents({
          containerRef,
          getClickCoordinates: () => null,
        });
      });
    }).not.toThrow();
  });

  it('should attach event listeners when container exists', () => {
    const container = document.createElement('div');
    const addSpy = jest.spyOn(container, 'addEventListener');

    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => null,
      });
    });

    // Should have attached mousedown and other event listeners
    expect(addSpy).toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('triggers context menu callback for canvas right-click', () => {
    const container = document.createElement('div');
    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    container.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, clientX: 120, clientY: 240 }));
    container.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 120, clientY: 240 }));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not trigger context menu callback for UI controls', () => {
    const container = document.createElement('div');
    const uiButton = document.createElement('button');
    uiButton.setAttribute('data-starmap-ui-control', 'true');
    container.appendChild(uiButton);

    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    uiButton.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, clientX: 80, clientY: 80 }));
    uiButton.dispatchEvent(new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true, clientX: 80, clientY: 80 }));

    expect(callback).not.toHaveBeenCalled();
  });

  it('does not trigger long-press context menu when touch starts on UI control', () => {
    const container = document.createElement('div');
    const uiButton = document.createElement('button');
    uiButton.setAttribute('data-starmap-ui-control', 'true');
    container.appendChild(uiButton);

    const callback = jest.fn();
    renderHook(() => {
      const containerRef = useRef<HTMLDivElement | null>(container);
      useStellariumEvents({
        containerRef,
        getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
        onContextMenu: callback,
      });
    });

    const startEvent = new Event('touchstart', { bubbles: true, cancelable: true }) as TouchEvent;
    Object.defineProperty(startEvent, 'touches', {
      value: [{ clientX: 64, clientY: 96 }],
      configurable: true,
    });
    uiButton.dispatchEvent(startEvent);
    jest.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });

  describe('long-press progress feedback', () => {
    function makeTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>) {
      const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
      Object.defineProperty(event, 'touches', { value: touches, configurable: true });
      return event;
    }

    function setup() {
      const container = document.createElement('div');
      container.getBoundingClientRect = jest.fn(() => ({
        left: 10, top: 20, width: 800, height: 600, right: 810, bottom: 620, x: 10, y: 20, toJSON: () => ({}),
      })) as never;
      const onContextMenu = jest.fn();
      const onLongPressStateChange = jest.fn();

      renderHook(() => {
        const containerRef = useRef<HTMLDivElement | null>(container);
        useStellariumEvents({
          containerRef,
          getClickCoordinates: () => ({ ra: 1, dec: 2, raStr: '00h', decStr: '+00d' }),
          onContextMenu,
          onLongPressStateChange,
        });
      });

      return { container, onContextMenu, onLongPressStateChange };
    }

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (navigator as any).vibrate;
    });

    it('reports the container-relative press point, then null when the press fires', () => {
      const { container, onContextMenu, onLongPressStateChange } = setup();

      container.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 110, clientY: 220 }]));
      expect(onLongPressStateChange).toHaveBeenCalledWith({ x: 100, y: 200 });

      jest.advanceTimersByTime(600);
      expect(onLongPressStateChange).toHaveBeenLastCalledWith(null);
      expect(onContextMenu).toHaveBeenCalledTimes(1);
    });

    it('clears the indicator when the touch moves too far (press cancelled)', () => {
      const { container, onContextMenu, onLongPressStateChange } = setup();

      container.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 110, clientY: 220 }]));
      container.dispatchEvent(makeTouchEvent('touchmove', [{ clientX: 140, clientY: 220 }]));

      expect(onLongPressStateChange).toHaveBeenLastCalledWith(null);
      jest.advanceTimersByTime(1000);
      expect(onContextMenu).not.toHaveBeenCalled();
    });

    it('clears the indicator on touch end before the timer', () => {
      const { container, onLongPressStateChange } = setup();

      container.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 110, clientY: 220 }]));
      container.dispatchEvent(makeTouchEvent('touchend', []));

      expect(onLongPressStateChange).toHaveBeenLastCalledWith(null);
    });

    it('vibrates when the long press fires and the API exists', () => {
      const vibrate = jest.fn();
      Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
      const { container } = setup();

      container.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 110, clientY: 220 }]));
      jest.advanceTimersByTime(600);

      expect(vibrate).toHaveBeenCalledWith(50);
    });

    it('does not crash when the vibrate API is absent', () => {
      const { container, onContextMenu } = setup();
      container.dispatchEvent(makeTouchEvent('touchstart', [{ clientX: 110, clientY: 220 }]));
      expect(() => jest.advanceTimersByTime(600)).not.toThrow();
      expect(onContextMenu).toHaveBeenCalled();
    });
  });
});
