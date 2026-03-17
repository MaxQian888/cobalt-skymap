/**
 * @jest-environment jsdom
 */

import { act } from '@testing-library/react';
import {
  getResolvedComponentStyleTokens,
  getThemeContrastWarnings,
  getThemePreviewData,
  migrateThemeStoreState,
  themePresets,
  useThemeStore,
} from '../theme-store';

describe('theme workbench helpers', () => {
  const originalRAF = global.requestAnimationFrame;
  const originalCAF = global.cancelAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    global.cancelAnimationFrame = jest.fn();
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCAF;
  });

  beforeEach(() => {
    act(() => {
      useThemeStore.getState().resetCustomization();
      useThemeStore.setState({ userPresets: [] });
    });
  });

  it('starts with an empty user preset library', () => {
    expect(useThemeStore.getState().userPresets).toEqual([]);
  });

  it('saves the current effective palette as a reusable custom preset', () => {
    act(() => {
      useThemeStore.getState().setActivePreset('ocean');
      useThemeStore.getState().setCustomColor('light', 'primary', '#123456');
      useThemeStore.getState().setCustomColor('dark', 'accent', '#654321');
      useThemeStore.getState().saveCurrentAsPreset('My Night');
    });

    const { userPresets, customization } = useThemeStore.getState();

    expect(userPresets).toHaveLength(1);
    expect(userPresets[0].name).toBe('My Night');
    expect(userPresets[0].colors.light.primary).toBe('#123456');
    expect(userPresets[0].colors.light.secondary).toBe(
      themePresets.find((preset) => preset.id === 'ocean')?.colors.light.secondary,
    );
    expect(userPresets[0].colors.dark.accent).toBe('#654321');
    expect(customization.activePreset).toBe(userPresets[0].id);
  });

  it('duplicates an existing preset into a new custom preset without mutating the source', () => {
    act(() => {
      useThemeStore.getState().duplicatePreset('ocean', 'Ocean Copy');
    });

    const { userPresets } = useThemeStore.getState();

    expect(userPresets).toHaveLength(1);
    expect(userPresets[0].id).not.toBe('ocean');
    expect(userPresets[0].name).toBe('Ocean Copy');
    expect(userPresets[0].colors).toEqual(themePresets.find((preset) => preset.id === 'ocean')?.colors);
    expect(themePresets.find((preset) => preset.id === 'ocean')?.name).toBe('Ocean');
  });

  it('renames and overwrites a custom preset while keeping its stable identity', () => {
    let presetId = '';

    act(() => {
      presetId = useThemeStore.getState().saveCurrentAsPreset('Alpha') ?? '';
      useThemeStore.getState().setCustomColor('light', 'primary', '#abcdef');
      useThemeStore.getState().saveCurrentToUserPreset(presetId);
      useThemeStore.getState().renameUserPreset(presetId, 'Beta');
    });

    const preset = useThemeStore.getState().userPresets[0];

    expect(preset.id).toBe(presetId);
    expect(preset.name).toBe('Beta');
    expect(preset.colors.light.primary).toBe('#abcdef');
  });

  it('deletes the active custom preset and clears an invalid active preset reference', () => {
    let presetId = '';

    act(() => {
      presetId = useThemeStore.getState().saveCurrentAsPreset('Disposable') ?? '';
      useThemeStore.getState().deleteUserPreset(presetId);
    });

    expect(useThemeStore.getState().userPresets).toEqual([]);
    expect(useThemeStore.getState().customization.activePreset).toBeNull();
  });

  it('builds mode-aware preview data without forcing the app theme to switch', () => {
    act(() => {
      useThemeStore.getState().setActivePreset('ocean');
      useThemeStore.getState().setCustomColor('light', 'primary', '#123456');
    });

    const lightPreview = getThemePreviewData(useThemeStore.getState().customization, 'light');
    const darkPreview = getThemePreviewData(useThemeStore.getState().customization, 'dark');

    expect(lightPreview.mode).toBe('light');
    expect(lightPreview.tokens.primary).toBe('#123456');
    expect(darkPreview.mode).toBe('dark');
    expect(darkPreview.tokens.primary).toBe(
      themePresets.find((preset) => preset.id === 'ocean')?.colors.dark.primary,
    );
  });

  it('reports low-contrast warnings for curated token pairs and clears them when fixed', () => {
    act(() => {
      useThemeStore.getState().setCustomColor('light', 'background', '#111111');
      useThemeStore.getState().setCustomColor('light', 'foreground', '#161616');
    });

    const warnings = getThemeContrastWarnings(useThemeStore.getState().customization, 'light');

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pairId: 'foreground/background', mode: 'light' }),
      ]),
    );

    act(() => {
      useThemeStore.getState().setCustomColor('light', 'foreground', '#ffffff');
      useThemeStore.getState().setCustomColor('light', 'card', '#111111');
      useThemeStore.getState().setCustomColor('light', 'muted', '#111111');
    });

    expect(getThemeContrastWarnings(useThemeStore.getState().customization, 'light')).toEqual([]);
  });

  it('migrates legacy persisted theme state to include custom presets and sanitize invalid active preset ids', () => {
    const migrated = migrateThemeStoreState(
      {
        customization: {
          radius: 0.75,
          fontFamily: 'mono',
          fontSize: 'large',
          animationsEnabled: false,
          activePreset: 'missing-preset',
          customColors: {
            light: { primary: '#123456' },
            dark: {},
          },
        },
      },
      1,
    );

    expect(migrated.userPresets).toEqual([]);
    expect(migrated.customization.activePreset).toBeNull();
    expect(migrated.customization.customColors.light.primary).toBe('#123456');
    expect(migrated.customization.componentStyle).toEqual({
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    });
  });

  it('resolves component surface tokens and applies them to the DOM when component styles change', () => {
    act(() => {
      useThemeStore.getState().setCustomization({
        componentStyle: {
          preset: 'floating',
          density: 'compact',
          transparency: 'high',
          border: 'strong',
          elevation: 'floating',
        },
      });
    });

    const tokens = getResolvedComponentStyleTokens(useThemeStore.getState().customization);

    expect(tokens).toEqual(expect.objectContaining({
      densityGap: '0.25rem',
      densityPadding: '0.25rem',
      controlHeight: '2rem',
      surfaceBlur: '18px',
    }));
    expect(document.documentElement.style.getPropertyValue('--component-density-gap')).toBe('0.25rem');
    expect(document.documentElement.style.getPropertyValue('--component-surface-blur')).toBe('18px');
    expect(document.documentElement.style.getPropertyValue('--component-surface-shadow')).not.toBe('');
  });

  it('resets component style customization back to defaults', () => {
    act(() => {
      useThemeStore.getState().setCustomization({
        componentStyle: {
          preset: 'observatory',
          density: 'compact',
          transparency: 'solid',
          border: 'strong',
          elevation: 'flat',
        },
      });
      useThemeStore.getState().resetCustomization();
    });

    expect(useThemeStore.getState().customization.componentStyle).toEqual({
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    });
    expect(document.documentElement.style.getPropertyValue('--component-density-gap')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--component-surface-blur')).toBe('');
  });
});
