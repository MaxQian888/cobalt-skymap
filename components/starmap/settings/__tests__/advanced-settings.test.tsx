/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const setObservationProfile = jest.fn();
const setPrecisionMode = jest.fn();
const setEopUpdatePolicy = jest.fn();

const storeState = {
  observationProfile: 'imaging',
  setObservationProfile,
  precisionMode: 'core_high_precision',
  setPrecisionMode,
  eopUpdatePolicy: 'auto_with_offline_fallback',
  setEopUpdatePolicy,
};

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));
jest.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => (
    <label {...p}>{children}</label>
  ),
}));
jest.mock('@/components/ui/select', () => ({
  Select: ({
    value,
    onValueChange,
    'data-fieldid': _id,
    children: _children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    'data-fieldid'?: string;
    children?: React.ReactNode;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value={value}>{value}</option>
      <option value="visual">visual</option>
      <option value="realtime_lightweight">realtime_lightweight</option>
      <option value="strict_offline">strict_offline</option>
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
}));

import { AdvancedSettings } from '../advanced-settings';

describe('AdvancedSettings', () => {
  beforeEach(() => {
    setObservationProfile.mockClear();
    setPrecisionMode.mockClear();
    setEopUpdatePolicy.mockClear();
  });

  it('renders the three advanced sections', () => {
    render(<AdvancedSettings />);
    // Each section uses the same key for its header and field label, so both appear.
    expect(screen.getAllByText('settingsNew.advanced.observationProfile').length).toBeGreaterThan(0);
    expect(screen.getAllByText('settingsNew.advanced.precisionMode').length).toBeGreaterThan(0);
    expect(screen.getAllByText('settingsNew.advanced.eopUpdatePolicy').length).toBeGreaterThan(0);
  });

  it('wires each select to its store setter', () => {
    render(<AdvancedSettings />);
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    fireEvent.change(selects[0], { target: { value: 'visual' } });
    fireEvent.change(selects[1], { target: { value: 'realtime_lightweight' } });
    fireEvent.change(selects[2], { target: { value: 'strict_offline' } });
    expect(setObservationProfile).toHaveBeenCalledWith('visual');
    expect(setPrecisionMode).toHaveBeenCalledWith('realtime_lightweight');
    expect(setEopUpdatePolicy).toHaveBeenCalledWith('strict_offline');
  });
});
