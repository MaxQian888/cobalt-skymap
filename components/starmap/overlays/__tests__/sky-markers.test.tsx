/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SkyMarkers } from '../sky-markers';

// jsdom has no PointerEvent — polyfill so fireEvent.pointer* carries
// pointerId/pointerType/coordinates through to the handlers.
class MockPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;

  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.pointerId = props.pointerId ?? 0;
    this.pointerType = props.pointerType ?? '';
    this.isPrimary = props.isPrimary ?? true;
  }
}
(window as unknown as { PointerEvent: typeof MockPointerEvent }).PointerEvent = MockPointerEvent;

const marker = {
  id: 'm1',
  name: 'Marker 1',
  description: 'test',
  ra: 10,
  dec: 20,
  raString: '00h 40m 00s',
  decString: '+20 00 00',
  color: '#ff0000',
  icon: 'star' as const,
  createdAt: 1000,
  updatedAt: 1000,
  visible: true,
};

const mockSetActiveMarker = jest.fn();
const mockToggleMarkerVisibility = jest.fn();
const mockRemoveMarker = jest.fn();
const mockSetMovingMarker = jest.fn();
const mockUpdateMarker = jest.fn();
let mockMovingMarkerId: string | null = null;
let mockCanvasEl: HTMLCanvasElement | null = null;
let mockStel: unknown = null;
let mockShowOffscreenIndicators = false;
let mockProjected: Array<{
  item: typeof marker;
  x: number;
  y: number;
  visible: boolean;
  dir?: { dx: number; dy: number; angDist: number };
}> = [{ item: marker, x: 100, y: 120, visible: true }];

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('sonner', () => ({
  toast: { info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

jest.mock('@/lib/stores', () => ({
  useMarkerStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      markers: [marker],
      groupVisibility: { Default: true },
      showMarkers: true,
      showLabels: true,
      globalMarkerSize: 20,
      activeMarkerId: null,
      setActiveMarker: mockSetActiveMarker,
      toggleMarkerVisibility: mockToggleMarkerVisibility,
      removeMarker: mockRemoveMarker,
      movingMarkerId: mockMovingMarkerId,
      setMovingMarker: mockSetMovingMarker,
      updateMarker: mockUpdateMarker,
      showOffscreenIndicators: mockShowOffscreenIndicators,
    }),
  useStellariumStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ stel: mockStel, canvasEl: mockCanvasEl }),
    { getState: () => ({ stel: mockStel, canvasEl: mockCanvasEl }) },
  ),
}));

jest.mock('@/lib/hooks', () => ({
  useBatchProjection: () => mockProjected,
}));

jest.mock('@/lib/constants/marker-icons', () => ({
  MarkerIconDisplay: {
    star: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="marker-icon" {...props} />,
  },
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button onClick={onSelect}>{children}</button>
  ),
  ContextMenuSeparator: () => null,
  ContextMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ContextMenuLabel: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('SkyMarkers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowOffscreenIndicators = false;
    mockProjected = [{ item: marker, x: 100, y: 120, visible: true }];
  });

  it('renders visual marker icon in default mode', () => {
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
      />
    );

    expect(screen.getByTestId('marker-icon')).toBeInTheDocument();
    expect(screen.getAllByText('Marker 1').length).toBeGreaterThan(0);
  });

  it('does not render icon in interactionOnly mode', () => {
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        interactionOnly
      />
    );

    expect(screen.queryByTestId('marker-icon')).not.toBeInTheDocument();
    expect(screen.getAllByText('Marker 1').length).toBeGreaterThan(0);
  });

  it('keeps interactions in interactionOnly mode', () => {
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        interactionOnly
      />
    );

    const clickable = document.querySelector('.cursor-pointer') as HTMLElement;
    fireEvent.click(clickable);
    expect(mockSetActiveMarker).toHaveBeenCalledWith('m1');
  });

  it('triggers onDoubleClick handler', () => {
    const onDoubleClick = jest.fn();
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        onMarkerDoubleClick={onDoubleClick}
      />
    );

    const clickable = document.querySelector('.cursor-pointer') as HTMLElement;
    fireEvent.doubleClick(clickable);
    expect(onDoubleClick).toHaveBeenCalledWith(marker);
  });

  it('triggers context menu edit action', () => {
    const onEdit = jest.fn();
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        onMarkerEdit={onEdit}
      />
    );

    // Context menu items are mocked as buttons
    fireEvent.click(screen.getByText('common.edit'));
    expect(onEdit).toHaveBeenCalledWith(marker);
  });

  it('triggers context menu delete action via callback', () => {
    const onDelete = jest.fn();
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        onMarkerDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByText('common.delete'));
    expect(onDelete).toHaveBeenCalledWith(marker);
  });

  it('falls back to removeMarker from store when no onMarkerDelete', () => {
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
      />
    );

    fireEvent.click(screen.getByText('common.delete'));
    expect(mockRemoveMarker).toHaveBeenCalledWith('m1');
  });

  it('triggers context menu navigate action', () => {
    const onNavigate = jest.fn();
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        onMarkerNavigate={onNavigate}
      />
    );

    fireEvent.click(screen.getByText('markers.goTo'));
    expect(mockSetActiveMarker).toHaveBeenCalledWith('m1');
    expect(onNavigate).toHaveBeenCalledWith(marker);
  });

  it('triggers context menu toggle visibility action', () => {
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
      />
    );

    // marker is visible, so clicking should show "hide"
    fireEvent.click(screen.getByText('markers.hide'));
    expect(mockToggleMarkerVisibility).toHaveBeenCalledWith('m1');
  });

  it('triggers onClick callback', () => {
    const onClick = jest.fn();
    render(
      <SkyMarkers
        containerWidth={800}
        containerHeight={600}
        onMarkerClick={onClick}
      />
    );

    const clickable = document.querySelector('.cursor-pointer') as HTMLElement;
    fireEvent.click(clickable);
    expect(onClick).toHaveBeenCalledWith(marker);
  });

  it('layers the overlay above the canvas but below panels (z-10)', () => {
    const { container } = render(
      <SkyMarkers containerWidth={800} containerHeight={600} />
    );
    expect(container.firstElementChild).toHaveClass('z-10');
  });

  describe('drag forwarding to the engine canvas', () => {
    beforeEach(() => {
      mockCanvasEl = document.createElement('canvas');
      jest.spyOn(mockCanvasEl, 'dispatchEvent');
    });

    afterEach(() => {
      mockCanvasEl = null;
    });

    it('forwards a mouse drag past the threshold as a synthetic canvas mousedown', () => {
      const onClick = jest.fn();
      render(<SkyMarkers containerWidth={800} containerHeight={600} onMarkerClick={onClick} />);

      const markerEl = document.querySelector('.cursor-pointer') as HTMLElement;
      fireEvent.pointerDown(markerEl, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 120 });
      fireEvent.pointerMove(markerEl, { pointerId: 1, pointerType: 'mouse', clientX: 108, clientY: 120 });

      expect(mockCanvasEl!.dispatchEvent).toHaveBeenCalledTimes(1);
      const forwarded = (mockCanvasEl!.dispatchEvent as jest.Mock).mock.calls[0][0] as MouseEvent;
      expect(forwarded.type).toBe('mousedown');
      expect(forwarded.clientX).toBe(100);
      expect(forwarded.clientY).toBe(120);
      expect(forwarded.button).toBe(0);

      // The trailing click after a forwarded drag is swallowed.
      fireEvent.pointerUp(markerEl, { pointerId: 1, pointerType: 'mouse', clientX: 108, clientY: 120 });
      fireEvent.click(markerEl, { clientX: 108, clientY: 120 });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does not forward below the threshold and keeps the click', () => {
      const onClick = jest.fn();
      render(<SkyMarkers containerWidth={800} containerHeight={600} onMarkerClick={onClick} />);

      const markerEl = document.querySelector('.cursor-pointer') as HTMLElement;
      fireEvent.pointerDown(markerEl, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 100, clientY: 120 });
      fireEvent.pointerMove(markerEl, { pointerId: 1, pointerType: 'mouse', clientX: 103, clientY: 120 });
      fireEvent.pointerUp(markerEl, { pointerId: 1, pointerType: 'mouse', clientX: 103, clientY: 120 });
      fireEvent.click(markerEl);

      expect(mockCanvasEl!.dispatchEvent).not.toHaveBeenCalled();
      expect(onClick).toHaveBeenCalledWith(marker);
    });
  });

  describe('off-screen indicators', () => {
    it('renders an edge chevron for an off-screen marker when the toggle is on', () => {
      mockShowOffscreenIndicators = true;
      mockProjected = [
        { item: marker, x: 0, y: 0, visible: false, dir: { dx: 1, dy: 0, angDist: 0.5 } },
      ];

      const onNavigate = jest.fn();
      render(<SkyMarkers containerWidth={800} containerHeight={600} onMarkerNavigate={onNavigate} />);

      const chevron = screen.getByTestId('marker-offscreen-indicator');
      expect(chevron).toBeInTheDocument();
      // Right edge, inset 28px, vertically centered.
      expect(chevron.style.left).toBe('772px');
      expect(chevron.style.top).toBe('300px');

      fireEvent.click(chevron);
      expect(mockSetActiveMarker).toHaveBeenCalledWith('m1');
      expect(onNavigate).toHaveBeenCalledWith(marker);
    });

    it('caps the indicators at the 8 angularly-nearest markers', () => {
      mockShowOffscreenIndicators = true;
      mockProjected = Array.from({ length: 12 }, (_, i) => ({
        item: { ...marker, id: `m${i}`, name: `Marker ${i}` },
        x: 0,
        y: 0,
        visible: false,
        dir: { dx: 1, dy: 0, angDist: i * 0.1 },
      }));

      render(<SkyMarkers containerWidth={800} containerHeight={600} />);
      expect(screen.getAllByTestId('marker-offscreen-indicator')).toHaveLength(8);
    });

    it('renders no indicators when the toggle is off', () => {
      mockShowOffscreenIndicators = false;
      mockProjected = [
        { item: marker, x: 0, y: 0, visible: false, dir: { dx: 1, dy: 0, angDist: 0.5 } },
      ];

      const { container } = render(<SkyMarkers containerWidth={800} containerHeight={600} />);
      expect(screen.queryByTestId('marker-offscreen-indicator')).not.toBeInTheDocument();
      // With nothing visible and no indicators, nothing renders at all.
      expect(container.firstChild).toBeNull();
    });
  });

  describe('move mode', () => {
    beforeEach(() => {
      mockMovingMarkerId = 'm1';
      mockStel = {
        core: { fov: Math.PI / 3 },
        observer: {},
        convertFrame: () => [0, 0, -1],
        c2s: () => [0.5, 0.3],
        anp: (x: number) => x,
      };
    });

    afterEach(() => {
      mockMovingMarkerId = null;
      mockStel = null;
    });

    it('shows the "move marker" context action and enters move mode', () => {
      mockMovingMarkerId = null;
      render(<SkyMarkers containerWidth={800} containerHeight={600} />);
      fireEvent.click(screen.getByText('markers.moveMarker'));
      expect(mockSetMovingMarker).toHaveBeenCalledWith('m1');
    });

    it('commits the move on pointer-up via screen unprojection', () => {
      render(<SkyMarkers containerWidth={800} containerHeight={600} />);

      const layer = screen.getByTestId('marker-move-layer');
      layer.getBoundingClientRect = jest.fn(() => ({
        left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}),
      })) as never;

      fireEvent.pointerUp(layer, { clientX: 400, clientY: 300 });

      expect(mockUpdateMarker).toHaveBeenCalledWith('m1', expect.objectContaining({
        ra: expect.any(Number),
        dec: expect.any(Number),
        raString: expect.any(String),
        decString: expect.any(String),
      }));
      expect(mockSetMovingMarker).toHaveBeenCalledWith(null);
    });

    it('cancels move mode on Escape', () => {
      render(<SkyMarkers containerWidth={800} containerHeight={600} />);
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockSetMovingMarker).toHaveBeenCalledWith(null);
      expect(mockUpdateMarker).not.toHaveBeenCalled();
    });
  });
});
