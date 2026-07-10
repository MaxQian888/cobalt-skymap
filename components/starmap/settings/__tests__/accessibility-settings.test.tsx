/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const setAccessibilitySetting = jest.fn();
let accessibilityState = {
  highContrast: false,
  fontScale: 1.0,
  colorBlindMode: 'none' as const,
  screenReaderOptimized: false,
  reduceTransparency: false,
  focusIndicators: true,
};

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/hooks/use-settings-draft', () => ({
  useAccessibilityDraftModel: () => ({
    accessibility: accessibilityState,
    setAccessibilitySetting,
  }),
}));
jest.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => (
    <label {...p}>{children}</label>
  ),
}));
jest.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
  }: {
    value: number[];
    onValueChange: (v: number[]) => void;
  }) => (
    <input
      type="range"
      data-testid="font-scale-slider"
      value={value[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  ),
}));
jest.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
  }) => (
    <select
      data-testid="color-blind-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="none">none</option>
      <option value="protanopia">protanopia</option>
      <option value="deuteranopia">deuteranopia</option>
      <option value="tritanopia">tritanopia</option>
      <option value="achromatopsia">achromatopsia</option>
    </select>
  ),
  SelectTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('../settings-shared', () => ({
  SettingsSection: ({ children, title }: React.PropsWithChildren<{ title: string }>) => (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  ),
  ToggleItem: ({ label, checked }: { label: string; checked: boolean }) => (
    <div>
      {label}: {String(checked)}
    </div>
  ),
}));

import { AccessibilitySettings } from '../accessibility-settings';

describe('AccessibilitySettings', () => {
  beforeEach(() => {
    setAccessibilitySetting.mockClear();
    accessibilityState = {
      highContrast: false,
      fontScale: 1.0,
      colorBlindMode: 'none',
      screenReaderOptimized: false,
      reduceTransparency: false,
      focusIndicators: true,
    };
  });

  it('renders visual, text and color vision sections', () => {
    render(<AccessibilitySettings />);
    expect(screen.getByText('settingsNew.accessibility.visual')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.accessibility.fontScale')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.accessibility.colorVision')).toBeInTheDocument();
  });

  it('updates font scale via the slider', () => {
    render(<AccessibilitySettings />);
    fireEvent.change(screen.getByTestId('font-scale-slider'), { target: { value: '1.25' } });
    expect(setAccessibilitySetting).toHaveBeenCalledWith('fontScale', 1.25);
  });

  it('updates color blind mode via the select', () => {
    render(<AccessibilitySettings />);
    fireEvent.change(screen.getByTestId('color-blind-select'), {
      target: { value: 'deuteranopia' },
    });
    expect(setAccessibilitySetting).toHaveBeenCalledWith('colorBlindMode', 'deuteranopia');
  });
});
