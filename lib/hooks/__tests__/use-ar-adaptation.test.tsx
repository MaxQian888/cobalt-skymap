/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useARAdaptation } from '../use-ar-adaptation';

let mockIsTauri = false;

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri,
}));

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
}

describe('useARAdaptation', () => {
  beforeEach(() => {
    mockIsTauri = false;
    useARRuntimeStore.getState().resetRecoveryState();
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        isSupported: true,
        capabilityMap: null,
      },
      sensor: {
        ...state.sensor,
        isSupported: true,
        isPermissionGranted: true,
        status: 'active',
      },
    }));
    document.documentElement.style.setProperty('--safe-area-top', '24px');
    document.documentElement.style.setProperty('--safe-area-right', '0px');
    document.documentElement.style.setProperty('--safe-area-bottom', '34px');
    document.documentElement.style.setProperty('--safe-area-left', '0px');
  });

  it('derives compact phone context from viewport and safe-area values', () => {
    setViewport(390, 844);

    const { result } = renderHook(() => useARAdaptation());

    expect(result.current.layoutTier).toBe('phone-compact');
    expect(result.current.safeAreaInsets.top).toBe(24);
    expect(result.current.safeAreaInsets.bottom).toBe(34);
    expect(result.current.sensorPath).toBe('sensor-primary');
    expect(result.current.operatingMode).toBe('sensor-first');
  });

  it('switches to camera-first desktop context in tauri runtime', () => {
    mockIsTauri = true;
    setViewport(1440, 900);
    useARRuntimeStore.setState((state) => ({
      sensor: {
        ...state.sensor,
        isSupported: false,
        isPermissionGranted: false,
        status: 'unsupported',
      },
    }));

    const { result } = renderHook(() => useARAdaptation());

    expect(result.current.runtimeClass).toBe('tauri-desktop');
    expect(result.current.sensorPath).toBe('camera-primary');
    expect(result.current.operatingMode).toBe('camera-first');
  });

  it('recomputes when viewport shrinks to compact landscape', () => {
    setViewport(1180, 820);
    const { result } = renderHook(() => useARAdaptation());

    expect(result.current.layoutTier).toBe('tablet');

    act(() => {
      setViewport(844, 360);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.layoutTier).toBe('phone-compact');
    expect(result.current.isViewportReduced).toBe(true);
  });

  it('avoids hydration mismatch when tauri becomes available on the client', async () => {
    function RuntimeProbe() {
      const adaptation = useARAdaptation();
      return <div data-testid="runtime-probe" data-runtime-class={adaptation.runtimeClass} />;
    }

    setViewport(1440, 900);
    mockIsTauri = false;

    const serverHtml = renderToString(<RuntimeProbe />);
    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockIsTauri = true;

    await act(async () => {
      hydrateRoot(container, <RuntimeProbe />);
      await Promise.resolve();
    });

    expect(container.firstElementChild).toHaveAttribute('data-runtime-class', 'tauri-desktop');
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    container.remove();
  });
});
