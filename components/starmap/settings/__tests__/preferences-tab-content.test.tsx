/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/starmap/settings/general-settings', () => ({
  GeneralSettings: () => <div data-testid="general-settings">GeneralSettings</div>,
}));

jest.mock('@/components/starmap/settings/appearance-settings', () => ({
  AppearanceSettings: () => <div data-testid="appearance-settings">AppearanceSettings</div>,
}));

jest.mock('@/components/starmap/settings/performance-settings', () => ({
  PerformanceSettings: () => <div data-testid="performance-settings">PerformanceSettings</div>,
}));

jest.mock('@/components/starmap/settings/notification-settings', () => ({
  NotificationSettings: () => <div data-testid="notification-settings">NotificationSettings</div>,
}));

jest.mock('@/components/starmap/settings/search-settings', () => ({
  SearchBehaviorSettings: () => <div data-testid="search-settings">SearchBehaviorSettings</div>,
}));

jest.mock('@/components/starmap/settings/accessibility-settings', () => ({
  AccessibilitySettings: () => <div data-testid="accessibility-settings">AccessibilitySettings</div>,
}));

jest.mock('@/components/starmap/settings/keyboard-settings', () => ({
  KeyboardSettings: () => <div data-testid="keyboard-settings">KeyboardSettings</div>,
}));

jest.mock('@/components/starmap/settings/global-shortcut-settings', () => ({
  GlobalShortcutSettings: () => (
    <div data-testid="global-shortcut-settings">GlobalShortcutSettings</div>
  ),
}));

jest.mock('@/components/starmap/settings/mobile-settings', () => ({
  MobileSettings: () => <div data-testid="mobile-settings">MobileSettings</div>,
}));

jest.mock('@/components/starmap/settings/advanced-settings', () => ({
  AdvancedSettings: () => <div data-testid="advanced-settings">AdvancedSettings</div>,
}));

import { PreferencesTabContent } from '../preferences-tab-content';

describe('PreferencesTabContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PreferencesTabContent />);
    expect(screen.getByTestId('scroll-area')).toBeInTheDocument();
  });

  it('renders all 10 settings sub-components', () => {
    render(<PreferencesTabContent />);
    expect(screen.getByTestId('general-settings')).toBeInTheDocument();
    expect(screen.getByTestId('appearance-settings')).toBeInTheDocument();
    expect(screen.getByTestId('performance-settings')).toBeInTheDocument();
    expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    expect(screen.getByTestId('search-settings')).toBeInTheDocument();
    expect(screen.getByTestId('accessibility-settings')).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-settings')).toBeInTheDocument();
    expect(screen.getByTestId('global-shortcut-settings')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-settings')).toBeInTheDocument();
    expect(screen.getByTestId('advanced-settings')).toBeInTheDocument();
  });

  it('renders separators between sections', () => {
    render(<PreferencesTabContent />);
    const separators = screen.getAllByTestId('separator');
    expect(separators.length).toBe(9);
  });

  it('does not render the removed in-tab secondary nav', () => {
    render(<PreferencesTabContent />);
    expect(screen.queryByTestId('pref-nav-select')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
