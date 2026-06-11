/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { cssColorToHex, defaultComponentStyle, getResolvedComponentStyleTokens, getResolvedThemeColors, useThemeStore, themePresets } from '../theme-store';

describe('useThemeStore', () => {
  // Mock requestAnimationFrame to execute callbacks synchronously
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
    // Reset store to defaults before each test
    act(() => {
      useThemeStore.getState().resetCustomization();
    });
  });

  describe('initial state', () => {
    it('should have default customization values', () => {
      const state = useThemeStore.getState();
      
      expect(state.customization.radius).toBe(0.5);
      expect(state.customization.fontFamily).toBe('default');
      expect(state.customization.fontSize).toBe('default');
      expect(state.customization.animationsEnabled).toBe(true);
      expect(state.customization.activePreset).toBeNull();
    });

    it('should have empty custom colors', () => {
      const state = useThemeStore.getState();
      
      expect(state.customization.customColors.light).toEqual({});
      expect(state.customization.customColors.dark).toEqual({});
    });
  });

  describe('setRadius', () => {
    it('should update radius', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setRadius(0.75);
      });
      
      expect(result.current.customization.radius).toBe(0.75);
    });

    it('should apply customization to DOM', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setRadius(1.0);
      });
      
      expect(document.documentElement.style.getPropertyValue('--radius')).toBe('1rem');
    });
  });

  describe('setFontFamily', () => {
    it('should update font family', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setFontFamily('mono');
      });
      
      expect(result.current.customization.fontFamily).toBe('mono');
    });

    it('should apply font family to DOM', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setFontFamily('system');
      });
      
      expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('system-ui');
    });
  });

  describe('setFontSize', () => {
    it('should update font size', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setFontSize('large');
      });
      
      expect(result.current.customization.fontSize).toBe('large');
    });

    it('should apply font size scale to DOM', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setFontSize('small');
      });
      
      expect(document.documentElement.style.getPropertyValue('--font-size-scale')).toBe('0.875');
    });
  });

  describe('setAnimationsEnabled', () => {
    it('should update animations enabled', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setAnimationsEnabled(false);
      });
      
      expect(result.current.customization.animationsEnabled).toBe(false);
    });

    it('should add reduce-motion class when disabled', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setAnimationsEnabled(false);
      });
      
      expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    });

    it('should remove reduce-motion class when enabled', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setAnimationsEnabled(false);
        result.current.setAnimationsEnabled(true);
      });
      
      expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
    });
  });

  describe('setActivePreset', () => {
    it('should update active preset', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setActivePreset('ocean');
      });
      
      expect(result.current.customization.activePreset).toBe('ocean');
    });

    it('should clear active preset with null', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setActivePreset('ocean');
        result.current.setActivePreset(null);
      });
      
      expect(result.current.customization.activePreset).toBeNull();
    });
  });

  describe('setCustomColor', () => {
    it('should set custom light color', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setCustomColor('light', 'primary', '#ff0000');
      });
      
      expect(result.current.customization.customColors.light.primary).toBe('#ff0000');
    });

    it('should set custom dark color', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setCustomColor('dark', 'accent', '#00ff00');
      });
      
      expect(result.current.customization.customColors.dark.accent).toBe('#00ff00');
    });

    it('should preserve existing colors', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setCustomColor('light', 'primary', '#ff0000');
        result.current.setCustomColor('light', 'secondary', '#00ff00');
      });
      
      expect(result.current.customization.customColors.light.primary).toBe('#ff0000');
      expect(result.current.customization.customColors.light.secondary).toBe('#00ff00');
    });
  });

  describe('setCustomization', () => {
    it('should update multiple fields in one action', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setCustomization({
          radius: 0.8,
          fontFamily: 'mono',
          fontSize: 'large',
          animationsEnabled: false,
        });
      });

      expect(result.current.customization.radius).toBe(0.8);
      expect(result.current.customization.fontFamily).toBe('mono');
      expect(result.current.customization.fontSize).toBe('large');
      expect(result.current.customization.animationsEnabled).toBe(false);
      expect(document.documentElement.style.getPropertyValue('--radius')).toBe('0.8rem');
    });

    it('should sanitize invalid values and unsupported custom color keys', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setCustomization({
          radius: 9,
          fontFamily: 'invalid-font' as never,
          fontSize: 'invalid-size' as never,
          customColors: {
            light: {
              primary: '#ff0000',
              unknown: '#00ff00',
            } as never,
          } as never,
        });
      });

      expect(result.current.customization.radius).toBe(1);
      expect(result.current.customization.fontFamily).toBe('default');
      expect(result.current.customization.fontSize).toBe('default');
      expect(result.current.customization.customColors.light.primary).toBe('#ff0000');
      expect((result.current.customization.customColors.light as Record<string, string>).unknown).toBeUndefined();
    });
  });

  describe('clearCustomColor', () => {
    it('should remove only the selected color key', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setCustomColor('dark', 'primary', '#111111');
        result.current.setCustomColor('dark', 'accent', '#222222');
        result.current.clearCustomColor('dark', 'primary');
      });

      expect(result.current.customization.customColors.dark.primary).toBeUndefined();
      expect(result.current.customization.customColors.dark.accent).toBe('#222222');
    });
  });

  describe('resetCustomization', () => {
    it('should reset all customization to defaults', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setRadius(1.0);
        result.current.setFontFamily('mono');
        result.current.setFontSize('large');
        result.current.setAnimationsEnabled(false);
        result.current.setActivePreset('ocean');
        result.current.setCustomColor('light', 'primary', '#ff0000');
        result.current.resetCustomization();
      });
      
      expect(result.current.customization.radius).toBe(0.5);
      expect(result.current.customization.fontFamily).toBe('default');
      expect(result.current.customization.fontSize).toBe('default');
      expect(result.current.customization.animationsEnabled).toBe(true);
      expect(result.current.customization.activePreset).toBeNull();
      expect(result.current.customization.customColors.light).toEqual({});
    });

    it('should remove CSS variables from DOM', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setRadius(1.0);
        result.current.resetCustomization();
      });
      
      expect(document.documentElement.style.getPropertyValue('--radius')).toBe('');
    });
  });

  describe('applyCustomization', () => {
    it('should apply all settings to DOM', () => {
      const { result } = renderHook(() => useThemeStore());
      
      act(() => {
        result.current.setRadius(0.75);
        result.current.setFontFamily('serif');
        result.current.setFontSize('large');
      });
      
      // All should be applied
      expect(document.documentElement.style.getPropertyValue('--radius')).toBe('0.75rem');
      expect(document.documentElement.style.getPropertyValue('--font-sans')).toContain('serif');
    });
  });

  describe('themePresets', () => {
    it('should have multiple presets', () => {
      expect(themePresets.length).toBeGreaterThan(0);
    });

    it('should have required properties for each preset', () => {
      themePresets.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.colors.light).toBeDefined();
        expect(preset.colors.dark).toBeDefined();
      });
    });

    it('should have default preset', () => {
      const defaultPreset = themePresets.find(p => p.id === 'default');
      expect(defaultPreset).toBeDefined();
    });

    it('should have various themed presets', () => {
      const presetIds = themePresets.map(p => p.id);
      
      expect(presetIds).toContain('ocean');
      expect(presetIds).toContain('forest');
      expect(presetIds).toContain('sunset');
      expect(presetIds).toContain('cosmos');
    });

    it('should have primary color in each preset', () => {
      themePresets.forEach(preset => {
        expect(preset.colors.light.primary || preset.colors.dark.primary).toBeDefined();
      });
    });
  });

  describe('getResolvedThemeColors', () => {
    it('should merge preset colors with light-mode custom overrides', () => {
      const colors = getResolvedThemeColors(
        {
          radius: 0.5,
          fontFamily: 'default',
          fontSize: 'default',
          uiScale: 'default',
          letterSpacing: 'normal',
          lineHeight: 'normal',
          animationsEnabled: true,
          scrollbarAccent: null,
          activePreset: 'ocean',
          componentStyle: defaultComponentStyle,
          customColors: {
            light: {
              primary: '#123456',
            },
            dark: {},
          },
        },
        'light'
      );

      expect(colors.primary).toBe('#123456');
      expect(colors.secondary).toBe(themePresets.find((preset) => preset.id === 'ocean')?.colors.light.secondary);
    });

    it('should keep light and dark mode palettes independent', () => {
      const colors = getResolvedThemeColors(
        {
          radius: 0.5,
          fontFamily: 'default',
          fontSize: 'default',
          uiScale: 'default',
          letterSpacing: 'normal',
          lineHeight: 'normal',
          animationsEnabled: true,
          scrollbarAccent: null,
          activePreset: null,
          componentStyle: defaultComponentStyle,
          customColors: {
            light: {
              primary: '#abcdef',
            },
            dark: {
              primary: '#fedcba',
            },
          },
        },
        'dark'
      );

      expect(colors.primary).toBe('#fedcba');
      expect(colors.secondary).toBeUndefined();
    });
  });

  describe('setLetterSpacing / setLineHeight', () => {
    it('applies non-default letter spacing and line height to the root element', () => {
      act(() => {
        useThemeStore.getState().setLetterSpacing('wide');
        useThemeStore.getState().setLineHeight('relaxed');
      });

      expect(useThemeStore.getState().customization.letterSpacing).toBe('wide');
      expect(useThemeStore.getState().customization.lineHeight).toBe('relaxed');
      expect(document.documentElement.style.letterSpacing).toBe('0.04em');
      expect(document.documentElement.style.lineHeight).toBe('1.85');
    });

    it('removes the root overrides when reset to normal', () => {
      act(() => {
        useThemeStore.getState().setLetterSpacing('wide');
        useThemeStore.getState().setLineHeight('compact');
        useThemeStore.getState().setLetterSpacing('normal');
        useThemeStore.getState().setLineHeight('normal');
      });

      expect(document.documentElement.style.letterSpacing).toBe('');
      expect(document.documentElement.style.lineHeight).toBe('');
    });
  });

  describe('exportTheme / importTheme', () => {
    it('exports the current customization and user presets as JSON', () => {
      act(() => {
        useThemeStore.getState().setRadius(0.8);
        useThemeStore.getState().setCustomColor('dark', 'primary', '#abcdef');
      });

      const json = useThemeStore.getState().exportTheme();
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe(4);
      expect(parsed.customization.radius).toBe(0.8);
      expect(parsed.customization.customColors.dark.primary).toBe('#abcdef');
      expect(Array.isArray(parsed.userPresets)).toBe(true);
    });

    it('round-trips an exported theme back into the store', () => {
      act(() => {
        useThemeStore.getState().setFontSize('large');
        useThemeStore.getState().setCustomColor('light', 'accent', '#112233');
      });
      const json = useThemeStore.getState().exportTheme();

      act(() => {
        useThemeStore.getState().resetCustomization();
      });
      expect(useThemeStore.getState().customization.fontSize).toBe('default');

      let result = false;
      act(() => {
        result = useThemeStore.getState().importTheme(json);
      });

      expect(result).toBe(true);
      expect(useThemeStore.getState().customization.fontSize).toBe('large');
      expect(useThemeStore.getState().customization.customColors.light.accent).toBe('#112233');
    });

    it('rejects invalid JSON and unrelated objects', () => {
      let badJson = true;
      let unrelated = true;
      act(() => {
        badJson = useThemeStore.getState().importTheme('{not json');
        unrelated = useThemeStore.getState().importTheme('{"foo":1}');
      });

      expect(badJson).toBe(false);
      expect(unrelated).toBe(false);
    });
  });

  describe('cssColorToHex', () => {
    it('normalizes a full hex value', () => {
      expect(cssColorToHex('#123456')).toBe('#123456');
    });

    it('expands a shorthand hex value', () => {
      expect(cssColorToHex('#abc')).toBe('#aabbcc');
    });

    it('converts rgb() to hex', () => {
      expect(cssColorToHex('rgb(255, 0, 0)')).toBe('#ff0000');
    });

    it('converts an oklch() value to a 6-digit hex string', () => {
      const hex = cssColorToHex('oklch(0.4815 0.1178 263.3758)');
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('returns null for an unparseable value', () => {
      expect(cssColorToHex('not-a-color')).toBeNull();
      expect(cssColorToHex('')).toBeNull();
      expect(cssColorToHex('var(--primary)')).toBeNull();
    });
  });

  describe('uiScale', () => {
    it('defaults to "default" with a 1x scale', () => {
      expect(useThemeStore.getState().customization.uiScale).toBe('default');
    });

    it('updates the ui scale and applies the --ui-scale variable', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setUiScale('large');
      });

      expect(result.current.customization.uiScale).toBe('large');
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('1.1');
    });

    it('composes ui scale with font size into the root font-size', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setUiScale('xlarge'); // 1.25
        result.current.setFontSize('large'); // 1.125
      });

      // 1.25 * 1.125 * 16 = 22.5px
      expect(document.documentElement.style.fontSize).toBe('22.5px');
    });

    it('falls back to default for an invalid value', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setCustomization({ uiScale: 'enormous' as never });
      });

      expect(result.current.customization.uiScale).toBe('default');
    });

    it('is reset by resetCustomization', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setUiScale('compact');
        result.current.resetCustomization();
      });

      expect(result.current.customization.uiScale).toBe('default');
      expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe('');
    });
  });

  describe('focus ring color', () => {
    it('treats ring as a customizable color token', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setCustomColor('light', 'ring', '#ff8800');
      });

      expect(result.current.customization.customColors.light.ring).toBe('#ff8800');
      expect(getResolvedThemeColors(result.current.customization, 'light').ring).toBe('#ff8800');
      expect(document.documentElement.style.getPropertyValue('--ring')).toBe('#ff8800');
    });
  });

  describe('component style density', () => {
    it('supports a spacious density with larger tokens than comfortable', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setComponentStyleDensity('spacious');
      });

      expect(result.current.customization.componentStyle.density).toBe('spacious');

      const spacious = getResolvedComponentStyleTokens(result.current.customization);
      const comfortable = getResolvedComponentStyleTokens({
        componentStyle: { ...result.current.customization.componentStyle, density: 'comfortable' },
      });

      expect(parseFloat(spacious.controlHeight)).toBeGreaterThan(parseFloat(comfortable.controlHeight));
      expect(parseFloat(spacious.sectionPadding)).toBeGreaterThan(parseFloat(comfortable.sectionPadding));
    });
  });

  describe('scrollbar accent', () => {
    it('defaults to null and applies no override', () => {
      expect(useThemeStore.getState().customization.scrollbarAccent).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--scrollbar-accent')).toBe('');
    });

    it('applies the --scrollbar-accent variable when set', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setScrollbarAccent('#22ccff');
      });

      expect(result.current.customization.scrollbarAccent).toBe('#22ccff');
      expect(document.documentElement.style.getPropertyValue('--scrollbar-accent')).toBe('#22ccff');
    });

    it('removes the override when cleared', () => {
      const { result } = renderHook(() => useThemeStore());

      act(() => {
        result.current.setScrollbarAccent('#22ccff');
        result.current.setScrollbarAccent(null);
      });

      expect(result.current.customization.scrollbarAccent).toBeNull();
      expect(document.documentElement.style.getPropertyValue('--scrollbar-accent')).toBe('');
    });
  });
});
