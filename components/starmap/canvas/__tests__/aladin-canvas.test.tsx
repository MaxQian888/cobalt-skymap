/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import type { SkyMapCanvasRef } from '@/lib/core/types/sky-engine';

// Mock stores
const mockSetAladin = jest.fn();
const mockSetActiveEngine = jest.fn();
const mockSetHelpers = jest.fn();
const mockClearSavedViewState = jest.fn();

let mockStoreGetState: () => Record<string, unknown> = () => ({
  setHelpers: mockSetHelpers,
  savedViewState: null,
  clearSavedViewState: mockClearSavedViewState,
});

jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn((selector) => {
      const state = {
        setAladin: mockSetAladin,
        setActiveEngine: mockSetActiveEngine,
        setHelpers: mockSetHelpers,
      };
      return selector(state);
    }),
    {
      getState: () => mockStoreGetState(),
    }
  ),
}));

// Capture aladinRef from useAladinEvents to inject mock aladin instance
let capturedAladinRef: React.MutableRefObject<unknown> | null = null;
let capturedOnHoverChange: ((object: unknown) => void) | null = null;

const mockLoadingState = { isLoading: false, errorMessage: null, progress: 100, startTime: null, loadingStatus: '' };
const mockStartLoading = jest.fn();
const mockHandleRetry = jest.fn();
const mockReloadEngine = jest.fn();

jest.mock('@/lib/hooks/aladin', () => ({
  useAladinLoader: jest.fn(() => ({
    loadingState: mockLoadingState,
    engineReady: true,
    startLoading: mockStartLoading,
    handleRetry: mockHandleRetry,
    reloadEngine: mockReloadEngine,
  })),
  useAladinEvents: jest.fn((opts) => {
    capturedAladinRef = opts.aladinRef;
    capturedOnHoverChange = opts.onHoverChange;
  }),
  useAladinSettingsSync: jest.fn(),
  useAladinCatalogs: jest.fn(),
  useAladinCatalogHips: jest.fn(),
  useAladinLayers: jest.fn(),
  useAladinFits: jest.fn(),
  useAladinMOC: jest.fn(),
  useAladinOverlays: jest.fn(),
}));

// Mock aladin compat
const mockGetFoVCompat = jest.fn((..._args: unknown[]) => 60);
const mockSetFoVCompat = jest.fn((..._args: unknown[]) => {});
const mockExportViewCompat = jest.fn((..._args: unknown[]) => 'data:image/png;base64,abc');
const mockDestroyAladinCompat = jest.fn((..._args: unknown[]) => {});

jest.mock('@/lib/aladin/aladin-compat', () => ({
  destroyAladinCompat: (...args: unknown[]) => mockDestroyAladinCompat(...args),
  exportViewCompat: (...args: unknown[]) => mockExportViewCompat(...args),
  getFoVCompat: (...args: unknown[]) => mockGetFoVCompat(...args),
  setFoVCompat: (...args: unknown[]) => mockSetFoVCompat(...args),
}));

// Mock constants
jest.mock('@/lib/core/constants/fov', () => ({
  DEFAULT_FOV: 60,
  MIN_FOV: 0.1,
  MAX_FOV: 180,
}));

jest.mock('@/lib/core/constants/aladin-canvas', () => ({
  ALADIN_ZOOM_IN_FACTOR: 0.5,
  ALADIN_ZOOM_OUT_FACTOR: 2,
}));

const mockBuildClickCoords = jest.fn((..._args: unknown[]) => ({ ra: 10, dec: 20, raStr: '0h40m', decStr: '+20°00' }));
jest.mock('@/lib/astronomy/coordinates/format-coords', () => ({
  buildClickCoords: (...args: unknown[]) => mockBuildClickCoords(...args),
}));

// Mock LoadingOverlay
jest.mock('../components', () => ({
  LoadingOverlay: ({ loadingState }: { loadingState: { isLoading: boolean } }) => (
    <div data-testid="loading-overlay">{loadingState.isLoading ? 'Loading' : 'Ready'}</div>
  ),
  HoverObjectLabel: ({ name }: { name: string }) => <div>{name}</div>,
}));

import { AladinCanvas } from '../aladin-canvas';

// Helper: create a mock aladin instance
function createMockAladin() {
  return {
    world2pix: jest.fn(() => [100, 200]),
    pix2world: jest.fn(() => [10, 20]),
    gotoObject: jest.fn(),
    gotoRaDec: jest.fn(),
    adjustFovForObject: jest.fn(),
  };
}

// Helper: render with ref and inject mock aladin
function renderWithAladin(props: Record<string, unknown> = {}) {
  const ref = React.createRef<SkyMapCanvasRef>();
  const mockAladin = createMockAladin();
  const result = render(<AladinCanvas ref={ref} {...props} />);

  // Inject mock aladin into the captured ref
  if (capturedAladinRef) {
    capturedAladinRef.current = mockAladin;
  }

  // Re-render to pick up the ref update for useImperativeHandle
  result.rerender(<AladinCanvas ref={ref} {...props} />);

  return { ref, mockAladin, ...result };
}

describe('AladinCanvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAladinRef = null;
    capturedOnHoverChange = null;
    mockStoreGetState = () => ({
      setHelpers: mockSetHelpers,
      savedViewState: null,
      clearSavedViewState: mockClearSavedViewState,
    });
  });

  it('renders the container div', () => {
    render(<AladinCanvas />);
    const container = document.getElementById('aladin-lite-container');
    expect(container).toBeInTheDocument();
  });

  it('renders the loading overlay', () => {
    render(<AladinCanvas />);
    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('sets active engine on mount', () => {
    render(<AladinCanvas />);
    expect(mockSetActiveEngine).toHaveBeenCalledWith('aladin');
  });

  it('exposes ref methods via useImperativeHandle', () => {
    const ref = React.createRef<SkyMapCanvasRef>();
    render(<AladinCanvas ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(typeof ref.current!.zoomIn).toBe('function');
    expect(typeof ref.current!.zoomOut).toBe('function');
    expect(typeof ref.current!.setFov).toBe('function');
    expect(typeof ref.current!.getFov).toBe('function');
    expect(typeof ref.current!.getClickCoordinates).toBe('function');
    expect(typeof ref.current!.reloadEngine).toBe('function');
    expect(typeof ref.current!.getEngineStatus).toBe('function');
    expect(typeof ref.current!.exportImage).toBe('function');
    expect(typeof ref.current!.gotoObject).toBe('function');
  });

  describe('Ref Methods', () => {
    it('zoomIn calls setFoVCompat with decreased FOV', () => {
      const onFovChange = jest.fn();
      const { ref } = renderWithAladin({ onFovChange });

      act(() => { ref.current!.zoomIn(); });

      // FOV = 60 * 0.5 = 30, clamped by Math.max(0.1, 30) = 30
      expect(mockSetFoVCompat).toHaveBeenCalledWith(expect.anything(), 30);
      expect(onFovChange).toHaveBeenCalledWith(30);
    });

    it('zoomOut calls setFoVCompat with increased FOV', () => {
      const onFovChange = jest.fn();
      const { ref } = renderWithAladin({ onFovChange });

      act(() => { ref.current!.zoomOut(); });

      // FOV = 60 * 2 = 120, clamped by Math.min(180, 120) = 120
      expect(mockSetFoVCompat).toHaveBeenCalledWith(expect.anything(), 120);
      expect(onFovChange).toHaveBeenCalledWith(120);
    });

    it('zoomIn does nothing when aladin is null', () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      // aladinRef.current is null by default
      act(() => { ref.current!.zoomIn(); });
      expect(mockSetFoVCompat).not.toHaveBeenCalled();
    });

    it('zoomOut does nothing when aladin is null', () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      act(() => { ref.current!.zoomOut(); });
      expect(mockSetFoVCompat).not.toHaveBeenCalled();
    });

    it('setFov clamps and sets FOV', () => {
      const onFovChange = jest.fn();
      const { ref } = renderWithAladin({ onFovChange });

      act(() => { ref.current!.setFov(90); });

      expect(mockSetFoVCompat).toHaveBeenCalledWith(expect.anything(), 90);
      expect(onFovChange).toHaveBeenCalledWith(90);
    });

    it('setFov clamps to MIN_FOV', () => {
      const onFovChange = jest.fn();
      const { ref } = renderWithAladin({ onFovChange });

      act(() => { ref.current!.setFov(0.01); });

      expect(mockSetFoVCompat).toHaveBeenCalledWith(expect.anything(), 0.1);
      expect(onFovChange).toHaveBeenCalledWith(0.1);
    });

    it('setFov clamps to MAX_FOV', () => {
      const onFovChange = jest.fn();
      const { ref } = renderWithAladin({ onFovChange });

      act(() => { ref.current!.setFov(999); });

      expect(mockSetFoVCompat).toHaveBeenCalledWith(expect.anything(), 180);
      expect(onFovChange).toHaveBeenCalledWith(180);
    });

    it('setFov does nothing when aladin is null', () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      act(() => { ref.current!.setFov(45); });
      expect(mockSetFoVCompat).not.toHaveBeenCalled();
    });

    it('getFov returns FOV from getFoVCompat', () => {
      const { ref } = renderWithAladin();
      const fov = ref.current!.getFov();
      expect(fov).toBe(60);
    });

    it('getFov returns DEFAULT_FOV when getFoVCompat returns null', () => {
      mockGetFoVCompat.mockReturnValueOnce(null as unknown as number);
      const { ref } = renderWithAladin();
      const fov = ref.current!.getFov();
      expect(fov).toBe(60);
    });

    it('getEngineStatus returns correct status', () => {
      const { ref } = renderWithAladin();
      const status = ref.current!.getEngineStatus();
      expect(status).toEqual({
        isLoading: false,
        hasError: false,
        isReady: true,
      });
    });

    it('getClickCoordinates returns coords when aladin is available', () => {
      const { ref } = renderWithAladin();
      const coords = ref.current!.getClickCoordinates(400, 300);
      expect(coords).toEqual({ ra: 10, dec: 20, raStr: '0h40m', decStr: '+20°00' });
      expect(mockBuildClickCoords).toHaveBeenCalledWith(10, 20);
    });

    it('getClickCoordinates returns null when aladin is null', () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      const coords = ref.current!.getClickCoordinates(400, 300);
      expect(coords).toBeNull();
    });

    it('getClickCoordinates returns null when pix2world returns null', () => {
      const { ref, mockAladin } = renderWithAladin();
      mockAladin.pix2world.mockReturnValueOnce(null as unknown as number[]);
      const coords = ref.current!.getClickCoordinates(400, 300);
      expect(coords).toBeNull();
    });

    it('exportImage calls exportViewCompat', async () => {
      const { ref } = renderWithAladin();
      const result = await ref.current!.exportImage!();
      expect(result).toBe('data:image/png;base64,abc');
      expect(mockExportViewCompat).toHaveBeenCalled();
    });

    it('exportImage returns null when aladin is null', async () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      const result = await ref.current!.exportImage!();
      expect(result).toBeNull();
    });

    it('gotoObject calls aladin.gotoObject', () => {
      const { ref, mockAladin } = renderWithAladin();
      act(() => { ref.current!.gotoObject!('M31'); });
      expect(mockAladin.gotoObject).toHaveBeenCalledWith('M31', expect.objectContaining({
        success: expect.any(Function),
      }));
    });

    it('gotoObject success callback calls adjustFovForObject', () => {
      const { ref, mockAladin } = renderWithAladin();
      act(() => { ref.current!.gotoObject!('M42'); });

      const call = mockAladin.gotoObject.mock.calls[0];
      const successCb = call[1].success;
      successCb();

      expect(mockAladin.adjustFovForObject).toHaveBeenCalledWith('M42');
    });

    it('gotoObject does nothing when aladin is null', () => {
      const ref = React.createRef<SkyMapCanvasRef>();
      render(<AladinCanvas ref={ref} />);
      act(() => { ref.current!.gotoObject!('M31'); });
      // No error thrown
    });

    it('gotoObject does nothing when gotoObject is not a function', () => {
      const { ref, mockAladin } = renderWithAladin();
      mockAladin.gotoObject = 'not-a-function' as unknown as jest.Mock;
      // Re-render to pick up
      act(() => { ref.current!.gotoObject!('M31'); });
      // No error thrown
    });
  });

  describe('Hover Handler', () => {
    it('sets hover info when object has name and aladin is available', () => {
      renderWithAladin();
      expect(capturedOnHoverChange).toBeDefined();

      act(() => {
        capturedOnHoverChange!({
          ra: 10,
          dec: 20,
          data: { name: 'Sirius' },
        });
      });

      // Hover tooltip should appear
      expect(screen.getByText('Sirius')).toBeInTheDocument();
    });

    it('clears hover info when object is null', () => {
      renderWithAladin();

      act(() => {
        capturedOnHoverChange!({
          ra: 10, dec: 20,
          data: { name: 'Sirius' },
        });
      });
      expect(screen.getByText('Sirius')).toBeInTheDocument();

      act(() => {
        capturedOnHoverChange!(null);
      });
      expect(screen.queryByText('Sirius')).not.toBeInTheDocument();
    });

    it('clears hover info when object has no name', () => {
      renderWithAladin();

      act(() => {
        capturedOnHoverChange!({ ra: 10, dec: 20, data: {} });
      });
      // No tooltip should appear
      expect(screen.queryByText('Sirius')).not.toBeInTheDocument();
    });

    it('clears hover info when object is not an object', () => {
      renderWithAladin();

      act(() => {
        capturedOnHoverChange!('not-an-object');
      });
      // No error
    });

    it('does not render hover label when world2pix returns null', () => {
      const { mockAladin } = renderWithAladin();
      mockAladin.world2pix.mockReturnValueOnce(null as unknown as number[]);

      act(() => {
        capturedOnHoverChange!({
          ra: 10,
          dec: 20,
          data: { name: 'Sirius' },
        });
      });

      expect(screen.queryByText('Sirius')).not.toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('calls destroyAladinCompat and clears store on unmount', () => {
      const { unmount } = renderWithAladin();
      unmount();
      expect(mockDestroyAladinCompat).toHaveBeenCalled();
      expect(mockSetAladin).toHaveBeenCalledWith(null);
      expect(mockSetHelpers).toHaveBeenCalledWith({
        getCurrentViewDirection: null,
        setViewDirection: null,
      });
    });
  });
});
