/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
  Slider: ({ value, onValueChange, ...props }: { value: number[]; onValueChange: (v: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
      data-testid="slider"
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-testid={`select-item-${value}`}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

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

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-trigger">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} data-testid="switch" />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock equipment store
const mockUseEquipmentStore = jest.fn(() => ({
  focalLength: 400,
  aperture: 80,
  pixelSize: 3.76,
  sensorWidth: 23.5,
  sensorHeight: 15.6,
  getResolution: () => ({
    width: Math.round((23.5 * 1000) / 3.76),
    height: Math.round((15.6 * 1000) / 3.76),
  }),
  exposureDefaults: {
    exposureTime: 120,
    gain: 100,
    offset: 30,
    binning: '1x1',
    filter: 'L',
    frameCount: 30,
    ditherEnabled: true,
    ditherEvery: 3,
    tracking: 'guided',
    targetType: 'nebula',
    bortle: 5,
    sqmOverride: undefined,
    filterBandwidthNm: 300,
    readNoiseLimitPercent: 5,
    gainStrategy: 'unity',
    manualGain: 100,
    manualReadNoiseEnabled: false,
    manualReadNoise: 1.8,
    manualDarkCurrent: 0.002,
    manualFullWell: 50000,
    manualQE: 0.8,
    manualEPeraDu: 1,
    targetSurfaceBrightness: 22,
    targetSignalRate: 0,
  },
}));

jest.mock('@/lib/stores', () => ({
  useEquipmentStore: () => mockUseEquipmentStore(),
}));

import { ExposureCalculator } from '../exposure-calculator';

describe('ExposureCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<ExposureCalculator />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger', () => {
    render(<ExposureCalculator />);
    expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
  });

  it('renders trigger button', () => {
    render(<ExposureCalculator />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders professional parameter section', () => {
    render(<ExposureCalculator />);
    expect(screen.getByText('exposure.professionalParameters')).toBeInTheDocument();
    expect(screen.getByText('exposure.professionalRecommendation')).toBeInTheDocument();
  });

  it('keeps quick plan fields unchanged when applying', () => {
    const onExposurePlanChange = jest.fn();
    render(<ExposureCalculator onExposurePlanChange={onExposurePlanChange} />);

    fireEvent.click(screen.getByText('exposure.applyToTarget'));
    expect(onExposurePlanChange).toHaveBeenCalledTimes(1);

    const appliedPlan = onExposurePlanChange.mock.calls[0][0];
    expect(appliedPlan.settings.exposureTime).toBe(120);
    expect(appliedPlan.settings.gain).toBe(100);
    expect(appliedPlan.totalFrames).toBe(30);
    expect(appliedPlan.advanced).toBeDefined();
  });
});

