/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanvasContextMenu } from '../canvas-context-menu';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === 'zoom.fovPreset' && values?.value) return `${values.value}°`;
    return key;
  },
}));

jest.mock('@/components/ui/dropdown-menu', () => {
  const Item = ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  );
  const CheckboxItem = ({
    children,
    onCheckedChange,
    disabled,
    ...props
  }: React.PropsWithChildren<{ onCheckedChange?: (checked: boolean) => void; disabled?: boolean }>) => (
    <button onClick={() => onCheckedChange?.(true)} disabled={disabled} {...props}>{children}</button>
  );
  const Wrapper = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return {
    DropdownMenu: Wrapper,
    DropdownMenuContent: Wrapper,
    DropdownMenuItem: Item,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: Wrapper,
    DropdownMenuSubContent: Wrapper,
    DropdownMenuSubTrigger: Item,
    DropdownMenuCheckboxItem: CheckboxItem,
    DropdownMenuShortcut: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
    DropdownMenuTrigger: Wrapper,
  };
});

const mockSetSkyEngine = jest.fn();
const mockToggleCatalogLayer = jest.fn();
const mockToggleImageOverlayLayer = jest.fn();
const mockToggleMocLayer = jest.fn();
const mockToggleFitsLayer = jest.fn();
const mockSetFovEnabled = jest.fn();
const mockSetRotationAngle = jest.fn();
const mockSetMosaic = jest.fn();
const mockClipboardWriteText = jest.fn();
const mockGetCurrentViewDirection = jest.fn(() => ({ ra: Math.PI / 6, dec: Math.PI / 12 }));
let mockSkyEngine: 'stellarium' | 'aladin' = 'aladin';
let mockFovSimEnabled = false;
let mockMosaic = { enabled: false };

jest.mock('@/lib/stores', () => ({
  useSettingsStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      skyEngine: mockSkyEngine,
      setSkyEngine: mockSetSkyEngine,
    })
  ),
  useAladinStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      catalogLayers: [
        { id: 'simbad', name: 'SIMBAD', enabled: true },
        { id: 'ned', name: 'NED', enabled: false },
      ],
      toggleCatalogLayer: mockToggleCatalogLayer,
      imageOverlayLayers: [
        { id: 'overlay-1', name: 'Overlay 1', enabled: true },
        { id: 'overlay-2', name: 'Overlay 2', enabled: false },
      ],
      toggleImageOverlayLayer: mockToggleImageOverlayLayer,
      mocLayers: [
        { id: 'moc-1', name: 'MOC 1', visible: true },
        { id: 'moc-2', name: 'MOC 2', visible: false },
      ],
      toggleMocLayer: mockToggleMocLayer,
      fitsLayers: [
        { id: 'fits-1', name: 'FITS 1', enabled: true },
        { id: 'fits-2', name: 'FITS 2', enabled: false },
      ],
      toggleFitsLayer: mockToggleFitsLayer,
    })
  ),
  useEquipmentStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setFOVEnabled: mockSetFovEnabled,
      setRotationAngle: mockSetRotationAngle,
      setMosaic: mockSetMosaic,
    })
  ),
  useStellariumStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        setViewDirection: jest.fn(),
      })
    ),
    {
      getState: jest.fn(() => ({
        getCurrentViewDirection: mockGetCurrentViewDirection,
      })),
    }
  ),
}));

jest.mock('@/lib/hooks/use-equipment-fov-props', () => ({
  useEquipmentFOVRead: jest.fn(() => ({
    fovSimEnabled: mockFovSimEnabled,
    mosaic: mockMosaic,
  })),
}));

jest.mock('@/lib/services/clipboard-service', () => ({
  clipboardService: {
    writeText: (...args: [string]) => mockClipboardWriteText(...args),
  },
}));

jest.mock('@/components/starmap/mount/slew-confirm-dialog', () => ({
  SlewConfirmDialog: ({
    open,
    targetName,
  }: {
    open: boolean;
    targetName: string;
  }) => open ? <div data-testid="mount-target-dialog">{targetName}</div> : null,
}));

const defaultSettings = {
  constellationsLinesVisible: false,
  equatorialLinesVisible: false,
  azimuthalLinesVisible: false,
  dsosVisible: false,
  surveyEnabled: false,
  atmosphereVisible: false,
};

function renderContextMenu(
  overrides: Partial<React.ComponentProps<typeof CanvasContextMenu>> = {},
) {
  return render(
    <CanvasContextMenu
      open={true}
      position={{ x: 10, y: 10 }}
      coords={null}
      selectedObject={null}
      mountConnected={false}
      stellariumSettings={defaultSettings}
      onOpenChange={jest.fn()}
      onAddToTargetList={jest.fn()}
      onNavigateToCoords={jest.fn()}
      onOpenGoToDialog={jest.fn()}
      onSetPendingMarkerCoords={jest.fn()}
      onSetFramingCoordinates={jest.fn()}
      onZoomIn={jest.fn()}
      onZoomOut={jest.fn()}
      onSetFov={jest.fn()}
      onToggleStellariumSetting={jest.fn()}
      onToggleSearch={jest.fn()}
      onResetView={jest.fn()}
      {...overrides}
    />
  );
}

describe('CanvasContextMenu (Aladin mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    mockFovSimEnabled = false;
    mockMosaic = { enabled: false };
  });

  it('renders full Aladin layer controls in display submenu and supports toggles', () => {
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={{ ra: 10, dec: 20, raStr: '00h40m', decStr: '+20d00m' }}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{
          constellationsLinesVisible: false,
          equatorialLinesVisible: false,
          azimuthalLinesVisible: false,
          dsosVisible: false,
          surveyEnabled: false,
          atmosphereVisible: false,
        }}
        onOpenChange={() => {}}
        onAddToTargetList={() => {}}
        onNavigateToCoords={() => {}}
        onOpenGoToDialog={() => {}}
        onSetPendingMarkerCoords={() => {}}
        onSetFramingCoordinates={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onSetFov={() => {}}
        onToggleStellariumSetting={() => {}}
        onToggleSearch={() => {}}
        onResetView={() => {}}
      />
    );

    fireEvent.click(screen.getByText('SIMBAD'));
    fireEvent.click(screen.getByText('MOC 1'));
    fireEvent.click(screen.getByText('Overlay 1'));
    fireEvent.click(screen.getByText('FITS 1'));

    expect(screen.getByText('NED')).toBeDefined();
    expect(screen.getByText('MOC 2')).toBeDefined();
    expect(screen.getByText('Overlay 2')).toBeDefined();
    expect(screen.getByText('FITS 2')).toBeDefined();
    expect(mockToggleCatalogLayer).toHaveBeenCalledWith('simbad');
    expect(mockToggleMocLayer).toHaveBeenCalledWith('moc-1');
    expect(mockToggleImageOverlayLayer).toHaveBeenCalledWith('overlay-1');
    expect(mockToggleFitsLayer).toHaveBeenCalledWith('fits-1');
  });

  it('shows explicit Stellarium-only fallback and one-click compensation', () => {
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{
          constellationsLinesVisible: false,
          equatorialLinesVisible: false,
          azimuthalLinesVisible: false,
          dsosVisible: false,
          surveyEnabled: false,
          atmosphereVisible: false,
        }}
        onOpenChange={() => {}}
        onAddToTargetList={() => {}}
        onNavigateToCoords={() => {}}
        onOpenGoToDialog={() => {}}
        onSetPendingMarkerCoords={() => {}}
        onSetFramingCoordinates={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onSetFov={() => {}}
        onToggleStellariumSetting={() => {}}
        onToggleSearch={() => {}}
        onResetView={() => {}}
      />
    );

    expect(screen.getAllByText('settings.stellariumFeatureUnavailable').length).toBeGreaterThan(0);

    const switchButtons = screen.getAllByText('settings.switchToStellarium');
    fireEvent.click(switchButtons[0]);
    expect(mockSetSkyEngine).toHaveBeenCalledWith('stellarium');
  });

  it('disables Add to Target List when no coords and no selectedObject', () => {
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    const addBtn = screen.getByText('actions.addToTargetList').closest('button');
    expect(addBtn).toBeDisabled();
  });

  it('calls onToggleSearch and onResetView', () => {
    const onToggleSearch = jest.fn();
    const onResetView = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={onOpenChange}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={onToggleSearch}
        onResetView={onResetView}
      />
    );
    fireEvent.click(screen.getByText('starmap.searchObjects'));
    expect(onToggleSearch).toHaveBeenCalled();

    fireEvent.click(screen.getByText('starmap.resetView'));
    expect(onResetView).toHaveBeenCalled();
  });

  it('calls onZoomIn and onZoomOut', () => {
    const onZoomIn = jest.fn();
    const onZoomOut = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('zoom.zoomIn'));
    expect(onZoomIn).toHaveBeenCalled();
    fireEvent.click(screen.getByText('zoom.zoomOut'));
    expect(onZoomOut).toHaveBeenCalled();
  });

  it('calls onSetFov with preset values', () => {
    const onSetFov = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={onSetFov}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('30°'));
    expect(onSetFov).toHaveBeenCalledWith(30);
  });

  it('copies click coordinates and closes the menu', () => {
    const onOpenChange = jest.fn();

    renderContextMenu({
      coords: { ra: 10, dec: 20, raStr: '00h40m', decStr: '+20d00m' },
      onOpenChange,
    });

    fireEvent.click(screen.getByText('coordinates.copyClickPosition'));

    expect(mockClipboardWriteText).toHaveBeenCalledWith('00h40m +20d00m');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('CanvasContextMenu (Stellarium mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'stellarium';
    mockFovSimEnabled = false;
    mockMosaic = { enabled: false };
  });

  it('renders Stellarium display settings toggles', () => {
    const onToggleStellariumSetting = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: true, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: true, surveyEnabled: false, atmosphereVisible: true }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={onToggleStellariumSetting}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('settings.constellationLines'));
    expect(onToggleStellariumSetting).toHaveBeenCalledWith('constellationsLinesVisible');
  });

  it('renders selected object actions when selectedObject is provided', () => {
    const onOpenChange = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={{ names: ['M31'], ra: '00h42m', dec: '+41d16m', raDeg: 10.68, decDeg: 41.27 } as never}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={onOpenChange}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    expect(screen.getByText('M31')).toBeInTheDocument();
    expect(screen.getByText('coordinates.copyObjectCoordinates')).toBeInTheDocument();
  });

  it('renders marker and center view actions when coords provided', () => {
    const onSetPendingMarkerCoords = jest.fn();
    const onNavigateToCoords = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={{ ra: 10, dec: 20, raStr: '00h40m', decStr: '+20d00m' }}
        selectedObject={null}
        mountConnected={false}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={onNavigateToCoords}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={onSetPendingMarkerCoords}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    expect(screen.getByText('markers.addMarkerHere')).toBeInTheDocument();
    expect(screen.getByText('actions.centerViewHere')).toBeInTheDocument();
    expect(screen.getByText('coordinates.clickPosition')).toBeInTheDocument();
  });

  it('shows slew button when mount is connected and object is selected', () => {
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={{ names: ['M42'], ra: '05h35m', dec: '-05d23m', raDeg: 83.82, decDeg: -5.39 } as never}
        mountConnected={true}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={jest.fn()}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );
    expect(screen.getByText('actions.slewToObject')).toBeInTheDocument();
  });

  it('does not immediately fall back to framing when a connected mount action is chosen', () => {
    const onSetFramingCoordinates = jest.fn();
    render(
      <CanvasContextMenu
        open={true}
        position={{ x: 10, y: 10 }}
        coords={null}
        selectedObject={{ names: ['M42'], ra: '05h35m', dec: '-05d23m', raDeg: 83.82, decDeg: -5.39 } as never}
        mountConnected={true}
        stellariumSettings={{ constellationsLinesVisible: false, equatorialLinesVisible: false, azimuthalLinesVisible: false, dsosVisible: false, surveyEnabled: false, atmosphereVisible: false }}
        onOpenChange={jest.fn()}
        onAddToTargetList={jest.fn()}
        onNavigateToCoords={jest.fn()}
        onOpenGoToDialog={jest.fn()}
        onSetPendingMarkerCoords={jest.fn()}
        onSetFramingCoordinates={onSetFramingCoordinates}
        onZoomIn={jest.fn()}
        onZoomOut={jest.fn()}
        onSetFov={jest.fn()}
        onToggleStellariumSetting={jest.fn()}
        onToggleSearch={jest.fn()}
        onResetView={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('actions.slewToObject'));
    expect(onSetFramingCoordinates).not.toHaveBeenCalled();
    expect(screen.getByTestId('mount-target-dialog')).toHaveTextContent('M42');
  });

  it('copies the current view center from the Stellarium store and closes the menu', () => {
    const onOpenChange = jest.fn();

    renderContextMenu({
      onOpenChange,
    });

    fireEvent.click(screen.getByText('coordinates.copyViewCenter'));

    expect(mockGetCurrentViewDirection).toHaveBeenCalledTimes(1);
    expect(mockClipboardWriteText).toHaveBeenCalledWith(expect.stringMatching(/^2:00:00\.0 \+14:59:60\.0$/));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('copies object coordinates and closes the menu', () => {
    const onOpenChange = jest.fn();

    renderContextMenu({
      onOpenChange,
      selectedObject: { names: ['M31'], ra: '00h42m', dec: '+41d16m', raDeg: 10.68, decDeg: 41.27 } as never,
    });

    fireEvent.click(screen.getByText('coordinates.copyObjectCoordinates'));

    expect(mockClipboardWriteText).toHaveBeenCalledWith('00h42m +41d16m');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('adds a marker, opens the go-to dialog, centers the view, and adds the target list entry', () => {
    const onOpenChange = jest.fn();
    const onSetPendingMarkerCoords = jest.fn();
    const onNavigateToCoords = jest.fn();
    const onOpenGoToDialog = jest.fn();
    const onAddToTargetList = jest.fn();

    renderContextMenu({
      coords: { ra: 10, dec: 20, raStr: '00h40m', decStr: '+20d00m' },
      onOpenChange,
      onSetPendingMarkerCoords,
      onNavigateToCoords,
      onOpenGoToDialog,
      onAddToTargetList,
    });

    fireEvent.click(screen.getByText('markers.addMarkerHere'));
    fireEvent.click(screen.getByText('actions.centerViewHere'));
    fireEvent.click(screen.getByText('coordinates.goToCoordinates'));
    fireEvent.click(screen.getByText('actions.addToTargetList'));

    expect(onSetPendingMarkerCoords).toHaveBeenCalledWith({
      ra: 10,
      dec: 20,
      raString: '00h40m',
      decString: '+20d00m',
    });
    expect(onNavigateToCoords).toHaveBeenCalledTimes(1);
    expect(onOpenGoToDialog).toHaveBeenCalledTimes(1);
    expect(onAddToTargetList).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggles the FOV overlay, resets rotation, and updates mosaic state in Stellarium mode', () => {
    mockFovSimEnabled = true;
    mockMosaic = { enabled: false };
    const onOpenChange = jest.fn();

    renderContextMenu({
      onOpenChange,
    });

    fireEvent.click(screen.getByText('fov.showFovOverlay'));
    fireEvent.click(screen.getByText('fov.resetRotation'));
    fireEvent.click(screen.getByText('fov.enableMosaic'));

    expect(mockSetFovEnabled).toHaveBeenCalledWith(true);
    expect(mockSetRotationAngle).toHaveBeenCalledWith(0);
    expect(mockSetMosaic).toHaveBeenCalledWith({ enabled: true });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
