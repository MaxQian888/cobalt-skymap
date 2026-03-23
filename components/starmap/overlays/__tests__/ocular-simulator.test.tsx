/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OcularSimulator } from '../ocular-simulator';

const mockSetOcularDisplay = jest.fn();
const mockUseEquipmentStore = jest.fn();
const mockUseOcularSimulation = jest.fn();
const mockAddCustomEyepiece = jest.fn();
const mockAddCustomBarlow = jest.fn();
const mockAddCustomOcularTelescope = jest.fn();
const mockRemoveCustomEyepiece = jest.fn();
const mockRemoveCustomBarlow = jest.fn();
const mockRemoveCustomOcularTelescope = jest.fn();
const mockSetSelectedOcularTelescopeId = jest.fn();
const mockSetSelectedEyepieceId = jest.fn();
const mockSetSelectedBarlowId = jest.fn();

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: (selector: (state: Record<string, unknown>) => unknown) => mockUseEquipmentStore(selector),
}));

jest.mock('@/lib/hooks/use-ocular-simulation', () => ({
  useOcularSimulation: () => mockUseOcularSimulation(),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
jest.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
  }: {
    value?: number[];
    onValueChange?: (value: number[]) => void;
  }) => (
    <input
      type="range"
      data-testid="slider"
      value={value?.[0] ?? 0}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
    />
  ),
}));
jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (value: boolean) => void }) => (
    <button onClick={() => onCheckedChange(!checked)}>{checked ? 'on' : 'off'}</button>
  ),
}));
jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const onValueChange = ReactLib.useContext(SelectContext);
      return (
        <button type="button" data-testid={`select-item-${value}`} onClick={() => onValueChange(value)}>
          {children}
        </button>
      );
    },
    SelectLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => <div>value</div>,
  };
});

describe('OcularSimulator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseEquipmentStore.mockImplementation((selector: (state: Record<string, unknown>) => unknown) => selector({
      addCustomEyepiece: mockAddCustomEyepiece,
      addCustomBarlow: mockAddCustomBarlow,
      addCustomOcularTelescope: mockAddCustomOcularTelescope,
      removeCustomEyepiece: mockRemoveCustomEyepiece,
      removeCustomBarlow: mockRemoveCustomBarlow,
      removeCustomOcularTelescope: mockRemoveCustomOcularTelescope,
      ocularDisplay: { enabled: false, opacity: 70, showCrosshair: true, appliedFov: null },
      setOcularDisplay: mockSetOcularDisplay,
    }));

    mockUseOcularSimulation.mockReturnValue({
      telescopes: [{ id: 't1', name: 'Scope', focalLength: 400, aperture: 80, type: 'refractor', source: 'builtin' }],
      eyepieces: [{ id: 'e1', name: 'EP', focalLength: 25, afov: 52, source: 'builtin' }],
      barlows: [{ id: 'b0', name: 'None', magnification: 1, source: 'builtin' }],
      selectedOcularTelescopeId: 't1',
      selectedEyepieceId: 'e1',
      selectedBarlowId: 'b0',
      selectedTelescope: { id: 't1', name: 'Scope', focalLength: 400, aperture: 80, type: 'refractor', source: 'builtin' },
      selectedEyepiece: { id: 'e1', name: 'EP', focalLength: 25, afov: 52, source: 'builtin' },
      selectedBarlow: { id: 'b0', name: 'None', magnification: 1, source: 'builtin' },
      setSelectedOcularTelescopeId: mockSetSelectedOcularTelescopeId,
      setSelectedEyepieceId: mockSetSelectedEyepieceId,
      setSelectedBarlowId: mockSetSelectedBarlowId,
      viewData: {
        magnification: 16,
        tfov: 1.23,
        exitPupil: 5,
        dawesLimit: 1.4,
        rayleighLimit: 1.7,
        maxUsefulMag: 160,
        minUsefulMag: 12,
        bestPlanetaryMag: 120,
        focalRatio: 5,
        lightGathering: 130,
        limitingMag: 11.5,
        surfaceBrightness: 0.5,
        isOverMagnified: false,
        isUnderMagnified: false,
        effectiveFocalLength: 400,
        observingSuggestion: 'allround',
      },
      hasDesktopSource: false,
    });
  });

  it('applies ocular tfov to map when apply button is clicked', () => {
    const onApplyFov = jest.fn();
    render(<OcularSimulator onApplyFov={onApplyFov} currentFov={4.2} />);

    fireEvent.click(screen.getByText('ocular.applyToMap'));

    expect(onApplyFov).toHaveBeenCalledWith(1.23);
    expect(mockSetOcularDisplay).toHaveBeenCalledWith({ enabled: true, appliedFov: 1.23 });
  });

  it('does not show delete button for non-custom selection', () => {
    render(<OcularSimulator />);
    expect(screen.queryByLabelText('ocular.deleteCustom')).not.toBeInTheDocument();
  });

  it('disables save button when custom input is invalid', () => {
    render(<OcularSimulator />);

    fireEvent.click(screen.getAllByText('ocular.addCustom')[0]);

    const saveButton = screen.getByText('common.save');
    expect(saveButton).toBeDisabled();
  });

  it('restores FOV after apply and restore', () => {
    const onApplyFov = jest.fn();
    render(<OcularSimulator onApplyFov={onApplyFov} currentFov={4.2} />);

    // Apply first
    fireEvent.click(screen.getByText('ocular.applyToMap'));
    expect(onApplyFov).toHaveBeenCalledWith(1.23);

    // Restore
    fireEvent.click(screen.getByText('ocular.restoreFov'));
    expect(onApplyFov).toHaveBeenCalledWith(4.2);
  });

  it('renders overlay enabled toggle', () => {
    render(<OcularSimulator />);
    expect(screen.getByText('ocular.overlayEnabled')).toBeInTheDocument();
  });

  it('renders overlay opacity slider', () => {
    render(<OcularSimulator />);
    expect(screen.getByTestId('slider')).toBeInTheDocument();
  });

  it('renders crosshair toggle', () => {
    render(<OcularSimulator />);
    expect(screen.getByText('ocular.overlayCrosshair')).toBeInTheDocument();
  });

  it('renders magnification stats', () => {
    render(<OcularSimulator />);
    expect(screen.getByText('16x')).toBeInTheDocument();
    expect(screen.getByText('ocular.magnification')).toBeInTheDocument();
  });

  it('shows over-magnified warning when applicable', () => {
    mockUseOcularSimulation.mockReturnValue({
      telescopes: [{ id: 't1', name: 'Scope', focalLength: 400, aperture: 80, type: 'refractor', source: 'builtin' }],
      eyepieces: [{ id: 'e1', name: 'EP', focalLength: 25, afov: 52, source: 'builtin' }],
      barlows: [{ id: 'b0', name: 'None', magnification: 1, source: 'builtin' }],
      selectedOcularTelescopeId: 't1',
      selectedEyepieceId: 'e1',
      selectedBarlowId: 'b0',
      selectedTelescope: null,
      selectedEyepiece: null,
      selectedBarlow: null,
      setSelectedOcularTelescopeId: mockSetSelectedOcularTelescopeId,
      setSelectedEyepieceId: mockSetSelectedEyepieceId,
      setSelectedBarlowId: mockSetSelectedBarlowId,
      viewData: {
        magnification: 500,
        tfov: 0.1,
        exitPupil: 0.5,
        dawesLimit: 1.4,
        rayleighLimit: 1.7,
        maxUsefulMag: 160,
        minUsefulMag: 12,
        bestPlanetaryMag: 120,
        focalRatio: 5,
        lightGathering: 130,
        limitingMag: 11.5,
        surfaceBrightness: 0.5,
        isOverMagnified: true,
        isUnderMagnified: false,
        effectiveFocalLength: 400,
        observingSuggestion: 'planetary',
      },
      hasDesktopSource: false,
    });

    render(<OcularSimulator />);
    expect(screen.getByText('ocular.overMagnifiedWarning')).toBeInTheDocument();
  });

  it('shows under-magnified warning when applicable', () => {
    mockUseOcularSimulation.mockReturnValue({
      telescopes: [{ id: 't1', name: 'Scope', focalLength: 400, aperture: 80, type: 'refractor', source: 'builtin' }],
      eyepieces: [{ id: 'e1', name: 'EP', focalLength: 25, afov: 52, source: 'builtin' }],
      barlows: [{ id: 'b0', name: 'None', magnification: 1, source: 'builtin' }],
      selectedOcularTelescopeId: 't1',
      selectedEyepieceId: 'e1',
      selectedBarlowId: 'b0',
      selectedTelescope: null,
      selectedEyepiece: null,
      selectedBarlow: null,
      setSelectedOcularTelescopeId: mockSetSelectedOcularTelescopeId,
      setSelectedEyepieceId: mockSetSelectedEyepieceId,
      setSelectedBarlowId: mockSetSelectedBarlowId,
      viewData: {
        magnification: 5,
        tfov: 10,
        exitPupil: 16,
        dawesLimit: 1.4,
        rayleighLimit: 1.7,
        maxUsefulMag: 160,
        minUsefulMag: 12,
        bestPlanetaryMag: 120,
        focalRatio: 5,
        lightGathering: 130,
        limitingMag: 11.5,
        surfaceBrightness: 0.5,
        isOverMagnified: false,
        isUnderMagnified: true,
        effectiveFocalLength: 400,
        observingSuggestion: 'widefield',
      },
      hasDesktopSource: false,
    });

    render(<OcularSimulator />);
    expect(screen.getByText('ocular.underMagnifiedWarning')).toBeInTheDocument();
  });

  it('renders without onApplyFov', () => {
    render(<OcularSimulator />);
    expect(screen.getByText('ocular.applyToMap')).toBeInTheDocument();
  });

  it('shows desktop merge hint when hasDesktopSource', () => {
    mockUseOcularSimulation.mockReturnValue({
      telescopes: [],
      eyepieces: [],
      barlows: [],
      selectedOcularTelescopeId: '',
      selectedEyepieceId: '',
      selectedBarlowId: '',
      selectedTelescope: null,
      selectedEyepiece: null,
      selectedBarlow: null,
      setSelectedOcularTelescopeId: mockSetSelectedOcularTelescopeId,
      setSelectedEyepieceId: mockSetSelectedEyepieceId,
      setSelectedBarlowId: mockSetSelectedBarlowId,
      viewData: {
        magnification: 16, tfov: 1.23, exitPupil: 5, dawesLimit: 1.4,
        rayleighLimit: 1.7, maxUsefulMag: 160, minUsefulMag: 12,
        bestPlanetaryMag: 120, focalRatio: 5, lightGathering: 130,
        limitingMag: 11.5, surfaceBrightness: 0.5, isOverMagnified: false,
        isUnderMagnified: false, effectiveFocalLength: 400, observingSuggestion: 'allround',
      },
      hasDesktopSource: true,
    });

    render(<OcularSimulator />);
    expect(screen.getByText('ocular.desktopMergeHint')).toBeInTheDocument();
  });

  it('adds custom telescope, eyepiece, and barlow when forms are valid', () => {
    render(<OcularSimulator />);

    fireEvent.click(screen.getAllByText('ocular.addCustom')[0]);
    fireEvent.change(screen.getByPlaceholderText('ocular.telescopeName'), { target: { value: 'Custom Scope' } });
    fireEvent.change(screen.getAllByDisplayValue('1000')[0], { target: { value: '800' } });
    fireEvent.change(screen.getAllByDisplayValue('200')[0], { target: { value: '120' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockAddCustomOcularTelescope).toHaveBeenCalledWith({
      name: 'Custom Scope',
      focalLength: 800,
      aperture: 120,
      type: 'reflector',
    });

    fireEvent.click(screen.getAllByText('ocular.addCustom')[1]);
    fireEvent.change(screen.getByPlaceholderText('ocular.eyepieceName'), { target: { value: 'Custom EP' } });
    fireEvent.change(screen.getAllByDisplayValue('10')[0], { target: { value: '12' } });
    fireEvent.change(screen.getByDisplayValue('68'), { target: { value: '72' } });
    fireEvent.click(screen.getAllByText('common.save')[0]);
    expect(mockAddCustomEyepiece).toHaveBeenCalledWith({
      name: 'Custom EP',
      focalLength: 12,
      afov: 72,
      fieldStop: undefined,
    });

    fireEvent.click(screen.getAllByText('ocular.addCustom')[2]);
    fireEvent.change(screen.getByPlaceholderText('ocular.barlowName'), { target: { value: 'Custom 2x' } });
    fireEvent.change(screen.getAllByDisplayValue('2')[0], { target: { value: '2.5' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockAddCustomBarlow).toHaveBeenCalledWith({
      name: 'Custom 2x',
      magnification: 2.5,
    });
  });

  it('updates selected telescope/eyepiece/barlow via selector items', () => {
    render(<OcularSimulator />);

    fireEvent.click(screen.getByTestId('select-item-t1'));
    fireEvent.click(screen.getByTestId('select-item-e1'));
    fireEvent.click(screen.getByTestId('select-item-b0'));

    expect(mockSetSelectedOcularTelescopeId).toHaveBeenCalledWith('t1');
    expect(mockSetSelectedEyepieceId).toHaveBeenCalledWith('e1');
    expect(mockSetSelectedBarlowId).toHaveBeenCalledWith('b0');
  });

  it('applies overlay toggles and opacity slider updates', () => {
    render(<OcularSimulator onApplyFov={jest.fn()} currentFov={2.5} />);

    fireEvent.click(screen.getByText('off'));
    fireEvent.change(screen.getByTestId('slider'), { target: { value: '55' } });
    fireEvent.click(screen.getByText('on'));

    expect(mockSetOcularDisplay).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockSetOcularDisplay).toHaveBeenCalledWith(expect.objectContaining({ opacity: 55 }));
    expect(mockSetOcularDisplay).toHaveBeenCalledWith(expect.objectContaining({ showCrosshair: false }));
  });
});
