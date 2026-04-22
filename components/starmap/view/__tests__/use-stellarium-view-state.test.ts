/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';

const mockRouterPush = jest.fn();
const mockNavigationPush = jest.fn();
const mockSetRotationAngle = jest.fn();
const mockSetProfileInfo = jest.fn();
const mockSetShowFramingModal = jest.fn();
const mockSetCoordinates = jest.fn();
const mockSetSelectedItem = jest.fn();
const mockSetPendingCoords = jest.fn();
const mockSetEditingMarkerId = jest.fn();
const mockAddTarget = jest.fn();
const mockSetPreference = jest.fn();
const mockToggleStellariumSetting = jest.fn();
const mockUpdateViewDirection = jest.fn();
const mockSetViewDirectionRaw = jest.fn();

let mockViewDirection = { ra: Math.PI, dec: Math.PI / 6 };
let mockStel: { ready: boolean } | null = { ready: true };
let mockMountConnected = false;
let mockSkyEngine = 'stellarium';
let mockSkipCloseConfirmation = false;
let mockProfileInfo = {
  AstrometrySettings: {
    Latitude: 35,
    Longitude: 139,
    Elevation: 42,
  },
};
let mockEquipmentSnapshot = {
  sensorWidth: 36,
  sensorHeight: 24,
  focalLength: 600,
  rotationAngle: 15,
  mosaic: {
    enabled: true,
    rows: 2,
    cols: 2,
  },
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { coords?: string }) =>
    values?.coords ? `${key}:${values.coords}` : key,
}));

jest.mock('@/lib/stores', () => ({
  useStellariumStore: jest.fn(
    (selector: (state: {
      stel: typeof mockStel;
      setViewDirection: typeof mockSetViewDirectionRaw;
      viewDirection: typeof mockViewDirection;
      updateViewDirection: typeof mockUpdateViewDirection;
    }) => unknown) =>
      selector({
        stel: mockStel,
        setViewDirection: mockSetViewDirectionRaw,
        viewDirection: mockViewDirection,
        updateViewDirection: mockUpdateViewDirection,
      }),
  ),
  useFramingStore: jest.fn(
    (selector: (state: {
      setShowFramingModal: typeof mockSetShowFramingModal;
      setCoordinates: typeof mockSetCoordinates;
      setSelectedItem: typeof mockSetSelectedItem;
    }) => unknown) =>
      selector({
        setShowFramingModal: mockSetShowFramingModal,
        setCoordinates: mockSetCoordinates,
        setSelectedItem: mockSetSelectedItem,
      }),
  ),
  useMountStore: Object.assign(
    jest.fn((selector: (state: { mountInfo: { Connected: boolean }; setProfileInfo: typeof mockSetProfileInfo }) => unknown) =>
      selector({
        mountInfo: { Connected: mockMountConnected },
        setProfileInfo: mockSetProfileInfo,
      })),
    {
      getState: jest.fn(() => ({
        profileInfo: mockProfileInfo,
      })),
    },
  ),
  useEquipmentStore: Object.assign(
    jest.fn((selector: (state: { setRotationAngle: typeof mockSetRotationAngle }) => unknown) =>
      selector({
        setRotationAngle: mockSetRotationAngle,
      })),
    {
      getState: jest.fn(() => mockEquipmentSnapshot),
    },
  ),
  useMarkerStore: jest.fn(
    (selector: (state: {
      setPendingCoords: typeof mockSetPendingCoords;
      setEditingMarkerId: typeof mockSetEditingMarkerId;
    }) => unknown) =>
      selector({
        setPendingCoords: mockSetPendingCoords,
        setEditingMarkerId: mockSetEditingMarkerId,
      }),
  ),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: jest.fn((selector: (state: { addTarget: typeof mockAddTarget }) => unknown) =>
    selector({
      addTarget: mockAddTarget,
    })),
}));

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: jest.fn(
    (selector: (state: {
      stellarium: { constellationsLinesVisible: boolean };
      toggleStellariumSetting: typeof mockToggleStellariumSetting;
      skyEngine: string;
      preferences: { skipCloseConfirmation: boolean };
      setPreference: typeof mockSetPreference;
    }) => unknown) =>
      selector({
        stellarium: {
          constellationsLinesVisible: true,
        },
        toggleStellariumSetting: mockToggleStellariumSetting,
        skyEngine: mockSkyEngine,
        preferences: {
          skipCloseConfirmation: mockSkipCloseConfirmation,
        },
        setPreference: mockSetPreference,
      }),
  ),
}));

jest.mock('@/lib/hooks', () => ({
  useNavigationHistoryStore: jest.fn((selector: (state: { push: typeof mockNavigationPush }) => unknown) =>
    selector({
      push: mockNavigationPush,
    })),
}));

import {
  dialogReducer,
  initialDialogState,
  type DialogAction,
  type DialogState,
  useStellariumViewState,
} from '../use-stellarium-view-state';

const createSelectedObject = () =>
  ({
    names: ['M42'],
    raDeg: 83.8221,
    decDeg: -5.3911,
    ra: '05h 35m 17s',
    dec: '-05° 23′ 28″',
    size: '66×60',
  }) as const;

describe('dialogReducer', () => {
  it('handles all supported action types and preserves unrelated state', () => {
    const actions: DialogAction[] = [
      { type: 'SET_CONTEXT_MENU', open: true },
      { type: 'OPEN_CONTEXT_MENU', position: { x: 100, y: 200 } },
      { type: 'SET_GO_TO_DIALOG', open: true },
      { type: 'SET_DETAIL_DRAWER', open: true },
      { type: 'SET_CLOSE_CONFIRM', open: true },
      { type: 'SET_CONTEXT_MENU', open: false },
    ];

    let state: DialogState = initialDialogState;
    for (const action of actions) {
      state = dialogReducer(state, action);
    }

    expect(state.contextMenuOpen).toBe(false);
    expect(state.contextMenuPosition).toEqual({ x: 100, y: 200 });
    expect(state.goToDialogOpen).toBe(true);
    expect(state.detailDrawerOpen).toBe(true);
    expect(state.closeConfirmDialogOpen).toBe(true);
  });

  it('returns the same state reference for unknown actions', () => {
    const result = dialogReducer(initialDialogState, { type: 'UNKNOWN' } as unknown as DialogAction);
    expect(result).toBe(initialDialogState);
  });
});

describe('useStellariumViewState', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    useMapInteractionStore.getState().reset();

    mockViewDirection = { ra: Math.PI, dec: Math.PI / 6 };
    mockStel = { ready: true };
    mockMountConnected = false;
    mockSkyEngine = 'stellarium';
    mockSkipCloseConfirmation = false;
    mockProfileInfo = {
      AstrometrySettings: {
        Latitude: 35,
        Longitude: 139,
        Elevation: 42,
      },
    };
    mockEquipmentSnapshot = {
      sensorWidth: 36,
      sensorHeight: 24,
      focalLength: 600,
      rotationAngle: 15,
      mosaic: {
        enabled: true,
        rows: 2,
        cols: 2,
      },
    };

    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      callback(16);
      return 1;
    });
    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('polls view direction and exposes derived defaults', () => {
    const { result, unmount } = renderHook(() => useStellariumViewState());

    expect(mockUpdateViewDirection).toHaveBeenCalledTimes(1);
    expect(result.current.currentFov).toBe(60);
    expect(result.current.stel).toEqual({ ready: true });
    expect(result.current.skyEngine).toBe('stellarium');
    expect(result.current.viewCenterRaDec.ra).toBeCloseTo(180, 8);
    expect(result.current.viewCenterRaDec.dec).toBeCloseTo(30, 8);
    expect(result.current.mountConnected).toBe(false);
    expect(result.current.contextMenuOpen).toBe(false);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockUpdateViewDirection).toHaveBeenCalledTimes(2);

    unmount();
  });

  it('updates selection flow, toggles search, and forwards framing coordinates', () => {
    const { result } = renderHook(() => useStellariumViewState());
    const focusSearchInput = jest.fn();
    const selectedObject = createSelectedObject();

    act(() => {
      result.current.searchRef.current = { focusSearchInput } as never;
    });

    act(() => {
      result.current.toggleSearch();
    });

    expect(result.current.isSearchOpen).toBe(true);
    expect(focusSearchInput).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSelectionChange(selectedObject as never);
    });

    expect(result.current.isSearchOpen).toBe(false);
    expect(result.current.selectedObject).toEqual(selectedObject);
    expect(mockNavigationPush).toHaveBeenCalledWith({
      ra: selectedObject.raDeg,
      dec: selectedObject.decDeg,
      fov: 60,
      name: 'M42',
    });
    expect(useMapInteractionStore.getState().targetContext).toMatchObject({
      primaryName: 'M42',
      siteCoordinates: { latitude: 35, longitude: 139 },
    });

    act(() => {
      result.current.handleSelectionChange(null);
    });

    expect(useMapInteractionStore.getState().targetContext).toBeNull();

    act(() => {
      result.current.handleSetFramingCoordinates({
        ra: 12.34,
        dec: 56.78,
        raString: '00h 49m',
        decString: '+56° 46′',
        name: 'NGC 281',
      });
    });

    expect(mockSetCoordinates).toHaveBeenCalledWith({
      ra: 12.34,
      dec: 56.78,
      raString: '00h 49m',
      decString: '+56° 46′',
    });
    expect(mockSetSelectedItem).toHaveBeenCalledWith({
      Name: 'NGC 281',
      RA: 12.34,
      Dec: 56.78,
    });
    expect(mockSetShowFramingModal).toHaveBeenCalledWith(true);
  });

  it('drives canvas, navigation, and context-menu handlers', () => {
    const { result } = renderHook(() => useStellariumViewState());
    const zoomIn = jest.fn();
    const zoomOut = jest.fn();
    const setFov = jest.fn();
    const preventDefault = jest.fn();

    act(() => {
      result.current.canvasRef.current = { zoomIn, zoomOut, setFov } as never;
    });

    act(() => {
      result.current.handleFovChange(33);
    });

    expect(result.current.currentFov).toBe(33);

    act(() => {
      result.current.handleZoomIn();
      result.current.handleZoomOut();
      result.current.handleSetFov(28);
      result.current.handleResetView();
      result.current.handleNavigate(10, 20, 40);
      result.current.handleGoToCoordinates(22, 33);
    });

    expect(zoomIn).toHaveBeenCalledTimes(1);
    expect(zoomOut).toHaveBeenCalledTimes(1);
    expect(setFov).toHaveBeenNthCalledWith(1, 28);
    expect(setFov).toHaveBeenNthCalledWith(2, 60);
    expect(setFov).toHaveBeenNthCalledWith(3, 40);
    expect(mockSetRotationAngle).toHaveBeenCalledWith(0);
    expect(mockSetViewDirectionRaw).toHaveBeenNthCalledWith(1, 10, 20);
    expect(mockSetViewDirectionRaw).toHaveBeenNthCalledWith(2, 22, 33);

    act(() => {
      result.current.handleContextMenuCapture(
        {
          preventDefault,
          clientX: 120,
          clientY: 240,
        } as never,
        {
          ra: 11,
          dec: 22,
          raStr: '00h 44m',
          decStr: '+22° 00′',
        },
      );
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.contextMenuCoords).toEqual({
      ra: 11,
      dec: 22,
      raStr: '00h 44m',
      decStr: '+22° 00′',
    });
    expect(result.current.contextMenuOpen).toBe(true);
    expect(result.current.contextMenuPosition).toEqual({ x: 120, y: 240 });

    act(() => {
      result.current.handleNavigateToCoords();
    });

    expect(mockSetViewDirectionRaw).toHaveBeenNthCalledWith(3, 11, 22);
    expect(result.current.contextMenuOpen).toBe(false);

    act(() => {
      result.current.openGoToDialog();
    });

    expect(result.current.goToDialogOpen).toBe(true);
  });

  it('adds targets, updates location, edits markers, and handles close confirmation flows', () => {
    const hook = renderHook(() => useStellariumViewState());
    const selectedObject = createSelectedObject();

    act(() => {
      hook.result.current.handleContextMenuCapture(
        {
          preventDefault: jest.fn(),
          clientX: 10,
          clientY: 10,
        } as never,
        {
          ra: 77,
          dec: -12,
          raStr: '05h 08m',
          decStr: '-12° 00′',
        },
      );
    });

    act(() => {
      hook.result.current.handleAddToTargetList();
    });

    expect(mockAddTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'actions.defaultTargetName:05h 08m',
        ra: 77,
        dec: -12,
        raString: '05h 08m',
        decString: '-12° 00′',
        sensorWidth: 36,
        sensorHeight: 24,
        focalLength: 600,
        rotationAngle: 15,
        mosaic: mockEquipmentSnapshot.mosaic,
        priority: 'medium',
      }),
    );

    act(() => {
      hook.result.current.handleContextMenuCapture(
        {
          preventDefault: jest.fn(),
          clientX: 20,
          clientY: 20,
        } as never,
        null,
      );
      hook.result.current.setSelectedObject(selectedObject as never);
    });

    act(() => {
      hook.result.current.handleAddToTargetList();
    });

    expect(mockAddTarget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'M42',
        ra: selectedObject.raDeg,
        dec: selectedObject.decDeg,
        raString: selectedObject.ra,
        decString: selectedObject.dec,
      }),
    );

    act(() => {
      hook.result.current.handleLocationChange(48.85, 2.35, 64);
    });

    expect(mockSetProfileInfo).toHaveBeenCalledWith({
      AstrometrySettings: {
        Latitude: 48.85,
        Longitude: 2.35,
        Elevation: 64,
      },
    });

    act(() => {
      hook.result.current.handleMarkerNavigate({ ra: 15, dec: 25 });
      hook.result.current.handleMarkerEdit({ id: 'marker-1' });
    });

    expect(mockSetViewDirectionRaw).toHaveBeenCalledWith(15, 25);
    expect(mockSetEditingMarkerId).toHaveBeenCalledWith('marker-1');

    act(() => {
      hook.result.current.handleCloseStarmapClick();
    });

    expect(hook.result.current.closeConfirmDialogOpen).toBe(true);

    mockSkipCloseConfirmation = true;
    hook.rerender();

    act(() => {
      hook.result.current.handleCloseStarmapClick();
      hook.result.current.handleConfirmClose(true);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/');
    expect(mockSetPreference).toHaveBeenCalledWith('skipCloseConfirmation', true);
    expect(hook.result.current.closeConfirmDialogOpen).toBe(false);
  });
});
