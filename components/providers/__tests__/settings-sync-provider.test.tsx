/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';

const mockSetLocale = jest.fn();

const settingsState = {
  preferences: { locale: 'zh' as 'en' | 'zh' },
  accessibility: {
    highContrast: true,
    fontScale: 1.5,
    colorBlindMode: 'deuteranopia' as const,
    screenReaderOptimized: true,
    reduceTransparency: true,
    focusIndicators: false,
  },
  performance: {
    reducedMotion: false,
    enableAnimations: false,
  },
  setPreference: jest.fn(),
};

const localeState = {
  locale: 'en' as 'en' | 'zh',
  setLocale: mockSetLocale,
};

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

jest.mock('@/lib/i18n/locale-store', () => ({
  useLocaleStore: (selector: (state: typeof localeState) => unknown) => selector(localeState),
}));

import { SettingsSyncProvider } from '../settings-sync-provider';

describe('SettingsSyncProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsState.preferences.locale = 'zh';
    localeState.locale = 'en';
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-screen-reader-optimized');
    document.documentElement.removeAttribute('data-color-blind-mode');
    document.documentElement.style.removeProperty('--a11y-font-scale');
    document.documentElement.style.removeProperty('font-size');
  });

  it('syncs locale from settings store to locale store', async () => {
    render(
      <SettingsSyncProvider>
        <div>content</div>
      </SettingsSyncProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSetLocale).toHaveBeenCalledWith('zh');
  });

  it('applies accessibility and performance classes to document root', () => {
    render(
      <SettingsSyncProvider>
        <div data-testid="content">content</div>
      </SettingsSyncProvider>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('settings-high-contrast')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--a11y-font-scale')).toBe('1.5');
    // Note: the inline root font-size is a calc() value the real browser computes
    // (verified live); jsdom does not parse calc font-size, so it is not asserted here.
    expect(document.documentElement.getAttribute('data-color-blind-mode')).toBe('deuteranopia');
    expect(document.documentElement.classList.contains('settings-reduce-transparency')).toBe(true);
    expect(document.documentElement.classList.contains('settings-hide-focus-indicators')).toBe(true);
    expect(document.documentElement.classList.contains('settings-reduce-motion')).toBe(true);
    expect(document.documentElement.getAttribute('data-screen-reader-optimized')).toBe('true');
  });

  it('cleans up root classes and attributes on unmount', () => {
    const { unmount } = render(
      <SettingsSyncProvider>
        <div>content</div>
      </SettingsSyncProvider>
    );

    expect(document.documentElement.classList.contains('settings-high-contrast')).toBe(true);
    expect(document.documentElement.getAttribute('data-screen-reader-optimized')).toBe('true');

    unmount();

    expect(document.documentElement.classList.contains('settings-high-contrast')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--a11y-font-scale')).toBe('');
    expect(document.documentElement.hasAttribute('data-color-blind-mode')).toBe(false);
    expect(document.documentElement.classList.contains('settings-reduce-transparency')).toBe(false);
    expect(document.documentElement.classList.contains('settings-hide-focus-indicators')).toBe(false);
    expect(document.documentElement.classList.contains('settings-reduce-motion')).toBe(false);
    expect(document.documentElement.hasAttribute('data-screen-reader-optimized')).toBe(false);
  });

  it('migrates legacy locale-store value into settings when settings is default en', async () => {
    settingsState.preferences.locale = 'en';
    localeState.locale = 'zh';

    render(
      <SettingsSyncProvider>
        <div>content</div>
      </SettingsSyncProvider>
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(settingsState.setPreference).toHaveBeenCalledWith('locale', 'zh');
    expect(mockSetLocale).not.toHaveBeenCalled();
  });
});
