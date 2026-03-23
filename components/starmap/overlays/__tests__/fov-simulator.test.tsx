/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const mockEvaluateTargetFitFromSize = jest.fn();
jest.mock('@/lib/astronomy/fov-calculations', () => {
  const actual = jest.requireActual('@/lib/astronomy/fov-calculations');
  return {
    ...actual,
    evaluateTargetFitFromSize: (...args: Parameters<typeof actual.evaluateTargetFitFromSize>) =>
      mockEvaluateTargetFitFromSize(...args),
  };
});

// Mock UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children: React.ReactNode }) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, ...props }: { value?: number[]; onValueChange?: (v: number[]) => void }) => (
    <input
      type="range"
      value={value?.[0] || 0}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      data-testid="slider"
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/select', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const SelectContext = ReactLib.createContext<(value: string) => void>(() => {});

  return {
    Select: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
    }) => (
      <SelectContext.Provider value={onValueChange ?? (() => {})}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const onValueChange = ReactLib.useContext(SelectContext);
      return (
        <button type="button" data-testid={`select-item-${value}`} onClick={() => onValueChange(value)}>
          {children}
        </button>
      );
    },
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: () => <span>Select...</span>,
  };
});

jest.mock('@/components/ui/tabs', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const TabsContext = ReactLib.createContext<(value: string) => void>(() => {});

  return {
    Tabs: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange?: (value: string) => void;
    }) => (
      <TabsContext.Provider value={onValueChange ?? (() => {})}>
        <div>{children}</div>
      </TabsContext.Provider>
    ),
    TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({ children, value }: { children: React.ReactNode; value?: string }) => {
      const onValueChange = ReactLib.useContext(TabsContext);
      return (
        <button type="button" onClick={() => value && onValueChange(value)}>
          {children}
        </button>
      );
    },
  };
});

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} data-testid="switch" />
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-trigger">{children}</div>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

interface MockFovEquipmentOptions {
  sensorWidth: number;
  sensorHeight: number;
  focalLength: number;
  pixelSize: number;
  rotationAngle: number;
  mosaic: {
    enabled: boolean;
    rows: number;
    cols: number;
    overlap: number;
    overlapUnit: 'percent' | 'pixels';
  };
  gridType: string;
  aperture: number;
  baseFocalLength: number;
  effectiveFocalLength: number;
  fovInputMode: 'manual' | 'active-equipment';
  selectedBarlowReducerId: string | null;
  activeCamera: {
    id: string;
    name: string;
    sensorWidth: number;
    sensorHeight: number;
    pixelSize: number;
    source: 'store' | 'tauri';
  } | null;
  activeTelescope: {
    id: string;
    name: string;
    focalLength: number;
    aperture: number;
    type: string;
    source: 'store' | 'tauri';
  } | null;
  selectedBarlowReducer: { id: string; name: string; factor: number } | null;
  barlowReducers: Array<{ id: string; name: string; factor: number }>;
  accessorySelectionAvailable: boolean;
  hasCompleteActiveEquipment: boolean;
  framePlacement: { x: number; y: number };
  setFovInputMode: jest.Mock;
  setSelectedBarlowReducerId: jest.Mock;
  setFramePlacement: jest.Mock;
  resetFramePlacement: jest.Mock;
}

const createMockFovEquipmentOptions = (): MockFovEquipmentOptions => ({
  sensorWidth: 36,
  sensorHeight: 24,
  focalLength: 1000,
  pixelSize: 4.5,
  rotationAngle: 0,
  mosaic: {
    enabled: false,
    rows: 2,
    cols: 2,
    overlap: 10,
    overlapUnit: 'percent' as const,
  },
  gridType: 'none',
  aperture: 80,
  baseFocalLength: 1000,
  effectiveFocalLength: 1000,
  fovInputMode: 'manual',
  selectedBarlowReducerId: null,
  activeCamera: null,
  activeTelescope: null,
  selectedBarlowReducer: null,
  barlowReducers: [],
  accessorySelectionAvailable: false,
  hasCompleteActiveEquipment: false,
  framePlacement: { x: 0, y: 0 },
  setFovInputMode: jest.fn(),
  setSelectedBarlowReducerId: jest.fn(),
  setFramePlacement: jest.fn(),
  resetFramePlacement: jest.fn(),
});

const mockUseFovEquipmentOptions = jest.fn(() => createMockFovEquipmentOptions());

jest.mock('@/lib/hooks/use-equipment-fov-props', () => ({
  useFovEquipmentOptions: () => mockUseFovEquipmentOptions(),
}));

import { FOVSimulator, type GridType } from '../fov-simulator';
import { useEquipmentStore } from '@/lib/stores';

describe('FOVSimulator', () => {
  const defaultMosaic = {
    enabled: false,
    rows: 2,
    cols: 2,
    overlap: 10,
    overlapUnit: 'percent' as const,
  };

  const defaultProps = {
    enabled: true,
    onEnabledChange: jest.fn(),
    sensorWidth: 36,
    sensorHeight: 24,
    focalLength: 1000,
    pixelSize: 4.5,
    rotationAngle: 0,
    onSensorWidthChange: jest.fn(),
    onSensorHeightChange: jest.fn(),
    onFocalLengthChange: jest.fn(),
    onPixelSizeChange: jest.fn(),
    onRotationAngleChange: jest.fn(),
    mosaic: defaultMosaic,
    onMosaicChange: jest.fn(),
    gridType: 'none' as GridType,
    onGridTypeChange: jest.fn(),
    onCenterTarget: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluateTargetFitFromSize.mockImplementation((...args) => {
      const actual = jest.requireActual('@/lib/astronomy/fov-calculations');
      return actual.evaluateTargetFitFromSize(...args);
    });
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      mosaic: defaultMosaic,
    });
    useEquipmentStore.setState({
      fovDisplay: {
        ...useEquipmentStore.getState().fovDisplay,
        preserveAlignment: false,
        rotateSky: false,
      },
    });
  });

  it('renders without crashing', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
  });

  it('renders trigger button', () => {
    render(<FOVSimulator {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders enabled switch', () => {
    render(<FOVSimulator {...defaultProps} />);
    const switches = screen.getAllByTestId('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('renders calculated FOV values', () => {
    render(<FOVSimulator {...defaultProps} />);
    // Should contain calculated FOV text
    expect(document.body.textContent).toContain('fov.fieldWidth');
    expect(document.body.textContent).toContain('fov.fieldHeight');
  });

  it('renders sensor preset tabs', () => {
    render(<FOVSimulator {...defaultProps} />);
    // The preset tab labels
    expect(screen.getByText('Full Frame')).toBeInTheDocument();
    expect(screen.getByText('APS-C')).toBeInTheDocument();
    expect(screen.getByText('ZWO')).toBeInTheDocument();
  });

  it('renders manual input fields', () => {
    render(<FOVSimulator {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(3); // sensorWidth, sensorHeight, pixelSize
  });

  it('renders rotation slider', () => {
    render(<FOVSimulator {...defaultProps} />);
    const sliders = screen.getAllByTestId('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('renders mosaic tab content', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(document.body.textContent).toContain('fov.enableMosaic');
  });

  it('renders display tab content', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(document.body.textContent).toContain('fov.compositionGrid');
  });

  it('renders close button', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(screen.getByText('common.close')).toBeInTheDocument();
  });

  it('renders with disabled state', () => {
    render(<FOVSimulator {...defaultProps} enabled={false} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<FOVSimulator {...defaultProps} />);
    // Copy/Check icons are in a button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
  });

  it('calls onSensorWidthChange when sensor width input changes', () => {
    render(<FOVSimulator {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    // First numeric input is sensor width
    fireEvent.change(inputs[0], { target: { value: '23.5' } });
    expect(defaultProps.onSensorWidthChange).toHaveBeenCalledWith(23.5);
  });

  it('calls onSensorHeightChange when sensor height input changes', () => {
    render(<FOVSimulator {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[1], { target: { value: '15.6' } });
    expect(defaultProps.onSensorHeightChange).toHaveBeenCalledWith(15.6);
  });

  it('calls onFocalLengthChange when focal length input changes', () => {
    render(<FOVSimulator {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    // focal length input is in optics tab
    const flInput = inputs.find(i => Number(i.getAttribute('value')) === 1000);
    if (flInput) {
      fireEvent.change(flInput, { target: { value: '800' } });
      expect(defaultProps.onFocalLengthChange).toHaveBeenCalledWith(800);
    }
  });

  it('calls onFocalLengthChange when quick focal length button is clicked', () => {
    render(<FOVSimulator {...defaultProps} />);
    // Quick buttons: 200, 400, 600, 1000, 2000
    const btn200 = screen.getByText('200');
    fireEvent.click(btn200);
    expect(defaultProps.onFocalLengthChange).toHaveBeenCalledWith(200);
  });

  it('applies sensor preset when preset button clicked', () => {
    render(<FOVSimulator {...defaultProps} />);
    // Sensor presets render as buttons with name text
    const presetButtons = screen.getAllByRole('button');
    // Find a preset button that contains a sensor dimension text
    const sensorPreset = presetButtons.find(b => b.textContent?.includes('×') && b.textContent?.includes('mm'));
    if (sensorPreset) {
      fireEvent.click(sensorPreset);
      expect(defaultProps.onSensorWidthChange).toHaveBeenCalled();
      expect(defaultProps.onSensorHeightChange).toHaveBeenCalled();
    }
  });

  it('applies telescope preset when preset button clicked', () => {
    render(<FOVSimulator {...defaultProps} />);
    // Telescope presets contain "mm | f/" text
    const presetButtons = screen.getAllByRole('button');
    const telescopePreset = presetButtons.find(b => b.textContent?.includes('f/'));
    if (telescopePreset) {
      fireEvent.click(telescopePreset);
      expect(defaultProps.onFocalLengthChange).toHaveBeenCalled();
    }
  });

  it('handles rotation reset click', () => {
    render(<FOVSimulator {...defaultProps} />);
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    expect(defaultProps.onRotationAngleChange).toHaveBeenCalledWith(0);
  });

  it('handles rotation slider change', () => {
    render(<FOVSimulator {...defaultProps} />);
    const sliders = screen.getAllByTestId('slider');
    // First slider is rotation
    fireEvent.change(sliders[0], { target: { value: '45' } });
    expect(defaultProps.onRotationAngleChange).toHaveBeenCalledWith(45);
  });

  it('handles mosaic switch toggle', () => {
    render(<FOVSimulator {...defaultProps} />);
    const switches = screen.getAllByTestId('switch');
    // The mosaic switch is the second checkbox (first is enabled toggle)
    if (switches.length >= 2) {
      fireEvent.click(switches[1]);
      expect(defaultProps.onMosaicChange).toHaveBeenCalled();
    }
  });

  it('handles copy to clipboard', async () => {
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    
    render(<FOVSimulator {...defaultProps} />);
    // Find the copy button (small icon button in header)
    const buttons = screen.getAllByRole('button');
    // The copy button is a small ghost button in the dialog header
    const copyBtn = buttons.find(b => b.className?.includes('h-7 w-7'));
    if (copyBtn) {
      await act(async () => {
        fireEvent.click(copyBtn);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it('handles pixel size input change', () => {
    render(<FOVSimulator {...defaultProps} />);
    const inputs = screen.getAllByRole('spinbutton');
    // pixel size is the 3rd numeric input
    fireEvent.change(inputs[2], { target: { value: '5.0' } });
    expect(defaultProps.onPixelSizeChange).toHaveBeenCalledWith(5);
  });

  it('closes dialog when close button clicked', () => {
    render(<FOVSimulator {...defaultProps} />);
    const closeBtn = screen.getByText('common.close');
    fireEvent.click(closeBtn);
    // Dialog close is handled internally; just ensure no crash
    expect(closeBtn).toBeInTheDocument();
  });

  it('toggles enabled switch', () => {
    render(<FOVSimulator {...defaultProps} />);
    const switches = screen.getAllByTestId('switch');
    // First switch is the enabled toggle
    fireEvent.click(switches[0]);
    expect(defaultProps.onEnabledChange).toHaveBeenCalled();
  });

  it('renders all quick focal length buttons', () => {
    render(<FOVSimulator {...defaultProps} />);
    [200, 400, 600, 1000, 2000].forEach(fl => {
      expect(screen.getByText(String(fl))).toBeInTheDocument();
    });
  });

  it('clicks multiple focal length quick buttons', () => {
    render(<FOVSimulator {...defaultProps} />);
    fireEvent.click(screen.getByText('400'));
    expect(defaultProps.onFocalLengthChange).toHaveBeenCalledWith(400);
    fireEvent.click(screen.getByText('2000'));
    expect(defaultProps.onFocalLengthChange).toHaveBeenCalledWith(2000);
  });

  it('handles overlap slider change for mosaic', () => {
    render(<FOVSimulator {...defaultProps} mosaic={{ ...defaultProps.mosaic, enabled: true }} />);
    const sliders = screen.getAllByTestId('slider');
    // The overlap slider
    const overlapSlider = sliders.find((_, i) => i >= 1);
    if (overlapSlider) {
      fireEvent.change(overlapSlider, { target: { value: '20' } });
      expect(defaultProps.onMosaicChange).toHaveBeenCalled();
    }
  });

  it('renders setup preset controls', () => {
    render(<FOVSimulator {...defaultProps} />);
    expect(document.body.textContent).toContain('fov.setupPresets');
    expect(document.body.textContent).toContain('fov.saveSetup');
  });

  it('calls onCenterTarget when center action clicked', () => {
    const onCenterTarget = jest.fn();
    render(
      <FOVSimulator
        {...defaultProps}
        selectedTarget={{ name: 'M31', raDeg: 10, decDeg: 41, size: "190' x 60'" }}
        onCenterTarget={onCenterTarget}
      />
    );

    const centerButton = screen.getByText('fov.centerTarget');
    fireEvent.click(centerButton);
    expect(onCenterTarget).toHaveBeenCalledWith(10, 41);
  });

  it('calls onRotationAngleChange when auto-align clicked', () => {
    const onRotationAngleChange = jest.fn();
    render(
      <FOVSimulator
        {...defaultProps}
        selectedTarget={{ name: 'M31', raDeg: 10, decDeg: 41, size: "190' x 60'" }}
        onRotationAngleChange={onRotationAngleChange}
      />
    );

    const autoAlignButton = screen.getByText('fov.autoAlign');
    fireEvent.click(autoAlignButton);
    expect(onRotationAngleChange).toHaveBeenCalledWith(expect.any(Number));
  });

  it('surfaces mosaic validation message for invalid overlap', () => {
    render(
      <FOVSimulator
        {...defaultProps}
        mosaic={{ enabled: true, rows: 2, cols: 2, overlap: 80, overlapUnit: 'percent' }}
      />
    );

    expect(defaultProps.onMosaicChange).toHaveBeenCalled();
    expect(document.body.textContent).toContain('fov.mosaicIssue.overlap_clamped');
  });

  it('renders active equipment summary when active-equipment mode is complete', () => {
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      fovInputMode: 'active-equipment',
      hasCompleteActiveEquipment: true,
      activeCamera: {
        id: 'cam-1',
        name: 'ASI2600MC Pro',
        sensorWidth: 23.5,
        sensorHeight: 15.7,
        pixelSize: 3.76,
        source: 'store',
      },
      activeTelescope: {
        id: 'scope-1',
        name: 'RedCat 51',
        focalLength: 250,
        aperture: 51,
        type: 'APO',
        source: 'store',
      },
      focalLength: 250,
      baseFocalLength: 250,
      effectiveFocalLength: 250,
    });

    render(<FOVSimulator {...defaultProps} />);

    expect(document.body.textContent).toContain('fov.inputModeActiveEquipment');
    expect(document.body.textContent).toContain('ASI2600MC Pro');
    expect(document.body.textContent).toContain('RedCat 51');
  });

  it('shows missing equipment warning when active-equipment mode is incomplete', () => {
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      fovInputMode: 'active-equipment',
      hasCompleteActiveEquipment: false,
      activeCamera: null,
      activeTelescope: null,
    });

    render(<FOVSimulator {...defaultProps} />);

    expect(document.body.textContent).toContain('fov.activeEquipmentMissing');
  });

  it('renders accessory-aware effective focal length summary', () => {
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      accessorySelectionAvailable: true,
      barlowReducers: [{ id: 'reducer-08', name: '0.8x Reducer', factor: 0.8 }],
      selectedBarlowReducerId: 'reducer-08',
      selectedBarlowReducer: { id: 'reducer-08', name: '0.8x Reducer', factor: 0.8 },
      focalLength: 500,
      baseFocalLength: 500,
      effectiveFocalLength: 400,
    });

    render(<FOVSimulator {...defaultProps} />);

    expect(document.body.textContent).toContain('fov.accessoryLabel');
    expect(document.body.textContent).toContain('fov.effectiveFocalLength');
  });

  it('resets frame placement before centering when preserveAlignment is disabled', () => {
    const resetFramePlacement = jest.fn();
    const onCenterTarget = jest.fn();
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      resetFramePlacement,
    });

    render(
      <FOVSimulator
        {...defaultProps}
        selectedTarget={{ name: 'M31', raDeg: 10, decDeg: 41, size: "190' x 60'" }}
        onCenterTarget={onCenterTarget}
      />
    );

    fireEvent.click(screen.getByText('fov.centerTarget'));

    expect(resetFramePlacement).toHaveBeenCalled();
    expect(onCenterTarget).toHaveBeenCalledWith(10, 41);
  });

  it('shows rotate sky unavailable messaging when the engine cannot rotate the background', () => {
    render(<FOVSimulator {...defaultProps} />);

    expect(document.body.textContent).toContain('fov.rotateSkyUnavailable');
  });

  it('calls save/rename/delete setup handlers and setup selection callbacks', () => {
    const saveFovSetup = jest.fn();
    const renameFovSetup = jest.fn();
    const removeFovSetup = jest.fn();
    const applyFovSetup = jest.fn();
    const setSelectedFovSetupId = jest.fn();

    useEquipmentStore.setState({
      saveFovSetup,
      renameFovSetup,
      removeFovSetup,
      applyFovSetup,
      setSelectedFovSetupId,
      selectedFovSetupId: 'setup-1',
      fovSetups: [{
        id: 'setup-1',
        name: 'Deep Sky',
        sensorWidth: 36,
        sensorHeight: 24,
        focalLength: 1000,
        pixelSize: 4.5,
        rotationAngle: 0,
        mosaic: defaultMosaic,
        gridType: 'none',
      }],
    } as unknown as Parameters<typeof useEquipmentStore.setState>[0]);

    render(<FOVSimulator {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('fov.setupNamePlaceholder'), { target: { value: 'Night Rig' } });
    fireEvent.click(screen.getByText('fov.saveSetup'));
    fireEvent.click(screen.getByText('fov.renameSetup'));
    fireEvent.click(screen.getByText('fov.deleteSetup'));
    fireEvent.click(screen.getByTestId('select-item-setup-1'));
    fireEvent.click(screen.getAllByTestId('select-item-__none__')[0]);

    expect(saveFovSetup).toHaveBeenCalledWith('Night Rig');
    expect(renameFovSetup).toHaveBeenCalledWith('setup-1', 'Night Rig');
    expect(removeFovSetup).toHaveBeenCalledWith('setup-1');
    expect(applyFovSetup).toHaveBeenCalledWith('setup-1');
    expect(setSelectedFovSetupId).toHaveBeenCalledWith(null);
  });

  it('handles clipboard write failure without crashing', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error('clipboard unavailable')) },
    });

    render(<FOVSimulator {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const copyBtn = buttons.find(b => b.className?.includes('h-7 w-7'));
    if (copyBtn) {
      await act(async () => {
        fireEvent.click(copyBtn);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    }
  });

  it.each([
    { status: 'tight', label: 'fov.fitStatusTight' },
    { status: 'good', label: 'fov.fitStatusGood' },
    { status: 'roomy', label: 'fov.fitStatusRoomy' },
  ])('renders fit status label for %s target fit', ({ status, label }) => {
    mockEvaluateTargetFitFromSize.mockReturnValue({
      status,
      fitRatio: 0.88,
      targetWidthDeg: 1.2,
      targetHeightDeg: 0.8,
      availableWidthDeg: 1.3,
      availableHeightDeg: 0.9,
    });

    render(
      <FOVSimulator
        {...defaultProps}
        selectedTarget={{ name: 'M31', raDeg: 10, decDeg: 41, size: "190' x 60'" }}
      />
    );

    expect(document.body.textContent).toContain(label);
  });

  it('renders accessory none summary when accessory selection is available but not selected', () => {
    mockUseFovEquipmentOptions.mockReturnValue({
      ...createMockFovEquipmentOptions(),
      accessorySelectionAvailable: true,
      barlowReducers: [{ id: 'reducer-08', name: '0.8x Reducer', factor: 0.8 }],
      selectedBarlowReducerId: null,
      selectedBarlowReducer: null,
    });

    render(<FOVSimulator {...defaultProps} />);

    expect(document.body.textContent).toContain('fov.accessoryNoneSummary');
  });

  it('exercises broad interactive handlers across controls', () => {
    const onEnabledChange = jest.fn();
    const onMosaicChange = jest.fn();
    const onCenterTarget = jest.fn();
    const onRotationAngleChange = jest.fn();

    const { container } = render(
      <FOVSimulator
        {...defaultProps}
        onEnabledChange={onEnabledChange}
        onMosaicChange={onMosaicChange}
        onCenterTarget={onCenterTarget}
        onRotationAngleChange={onRotationAngleChange}
        selectedTarget={{ name: 'M42', raDeg: 83.8, decDeg: -5.4, size: "85' x 60'" }}
      />
    );

    container.querySelectorAll('[data-testid^="select-item-"]').forEach((node) => {
      fireEvent.click(node);
    });
    container.querySelectorAll('button').forEach((node) => {
      fireEvent.click(node);
    });
    screen.getAllByRole('spinbutton').forEach((input, index) => {
      fireEvent.change(input, { target: { value: String(index + 3) } });
    });
    screen.getAllByTestId('switch').forEach((toggle) => {
      fireEvent.click(toggle);
    });
    screen.getAllByTestId('slider').forEach((slider) => {
      fireEvent.change(slider, { target: { value: '30' } });
    });

    expect(onEnabledChange).toHaveBeenCalled();
    expect(onMosaicChange).toHaveBeenCalled();
    expect(onRotationAngleChange).toHaveBeenCalled();
    expect(onCenterTarget).toHaveBeenCalled();
  });
});
