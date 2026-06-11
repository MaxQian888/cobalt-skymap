'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  card: string;
  border: string;
  destructive: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  colors: {
    light: Partial<ThemeColors>;
    dark: Partial<ThemeColors>;
  };
}

export type ComponentStylePreset = 'default' | 'observatory' | 'floating';
export type ComponentStyleDensity = 'comfortable' | 'compact';
export type ComponentStyleTransparency = 'solid' | 'balanced' | 'high';
export type ComponentStyleBorder = 'soft' | 'medium' | 'strong';
export type ComponentStyleElevation = 'flat' | 'raised' | 'floating';

export interface ThemeComponentStyle {
  preset: ComponentStylePreset;
  density: ComponentStyleDensity;
  transparency: ComponentStyleTransparency;
  border: ComponentStyleBorder;
  elevation: ComponentStyleElevation;
}

export interface ThemeCustomization {
  radius: number;
  fontFamily: 'default' | 'serif' | 'mono' | 'system';
  fontSize: 'small' | 'default' | 'large';
  animationsEnabled: boolean;
  activePreset: string | null;
  componentStyle: ThemeComponentStyle;
  customColors: {
    light: Partial<ThemeColors>;
    dark: Partial<ThemeColors>;
  };
}

export type ThemeMode = 'light' | 'dark';

export interface ThemePreviewData {
  mode: ThemeMode;
  tokens: ThemeColors;
}

export interface ThemeContrastWarning {
  pairId: string;
  mode: ThemeMode;
  foregroundToken: keyof ThemeColors;
  backgroundToken: keyof ThemeColors;
  ratio: number;
  threshold: number;
}

export interface ResolvedComponentStyleTokens {
  densityGap: string;
  densityPadding: string;
  sectionPadding: string;
  controlHeight: string;
  surfaceBackground: string;
  surfaceStrongBackground: string;
  surfaceBorder: string;
  surfaceShadow: string;
  surfaceBlur: string;
}

export interface ComponentStylePreviewData {
  mode: ThemeMode;
  themeTokens: ThemeColors;
  surfaceTokens: ResolvedComponentStyleTokens;
  componentStyle: ThemeComponentStyle;
}

export interface ThemeStorePersistedState {
  customization: ThemeCustomization;
  userPresets: ThemePreset[];
}

interface ThemeStore extends ThemeStorePersistedState {
  setCustomization: (customization: Partial<ThemeCustomization>) => void;
  setComponentStylePreset: (preset: ComponentStylePreset) => void;
  setComponentStyleDensity: (density: ComponentStyleDensity) => void;
  setComponentStyleTransparency: (transparency: ComponentStyleTransparency) => void;
  setComponentStyleBorder: (border: ComponentStyleBorder) => void;
  setComponentStyleElevation: (elevation: ComponentStyleElevation) => void;
  setRadius: (radius: number) => void;
  setFontFamily: (font: ThemeCustomization['fontFamily']) => void;
  setFontSize: (size: ThemeCustomization['fontSize']) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setActivePreset: (presetId: string | null) => void;
  setCustomColor: (mode: ThemeMode, key: keyof ThemeColors, value: string) => void;
  clearCustomColor: (mode: ThemeMode, key: keyof ThemeColors) => void;
  replaceUserPresets: (userPresets: ThemePreset[]) => void;
  saveCurrentAsPreset: (name: string) => string | null;
  duplicatePreset: (presetId: string, name: string) => string | null;
  renameUserPreset: (presetId: string, name: string) => void;
  saveCurrentToUserPreset: (presetId: string) => void;
  deleteUserPreset: (presetId: string) => void;
  resetCustomization: () => void;
  applyCustomization: () => void;
  exportTheme: () => string;
  importTheme: (raw: string) => boolean;
}

export const THEME_EXPORT_VERSION = 3;

export interface ThemeExportPayload {
  version: number;
  customization: ThemeCustomization;
  userPresets: ThemePreset[];
}

export const defaultComponentStyle: ThemeComponentStyle = {
  preset: 'default',
  density: 'comfortable',
  transparency: 'balanced',
  border: 'medium',
  elevation: 'raised',
};

const defaultCustomization: ThemeCustomization = {
  radius: 0.5,
  fontFamily: 'default',
  fontSize: 'default',
  animationsEnabled: true,
  activePreset: null,
  componentStyle: defaultComponentStyle,
  customColors: {
    light: {},
    dark: {},
  },
};

const componentStylePresetOptions = ['default', 'observatory', 'floating'] as const;
const componentStyleDensityOptions = ['comfortable', 'compact'] as const;
const componentStyleTransparencyOptions = ['solid', 'balanced', 'high'] as const;
const componentStyleBorderOptions = ['soft', 'medium', 'strong'] as const;
const componentStyleElevationOptions = ['flat', 'raised', 'floating'] as const;
const fontFamilyOptions = ['default', 'serif', 'mono', 'system'] as const;
const fontSizeOptions = ['small', 'default', 'large'] as const;
const themeColorKeys: (keyof ThemeColors)[] = [
  'primary',
  'secondary',
  'accent',
  'background',
  'foreground',
  'muted',
  'card',
  'border',
  'destructive',
];

const previewContrastPairs: Array<{
  pairId: string;
  foregroundToken: keyof ThemeColors;
  backgroundToken: keyof ThemeColors;
}> = [
  { pairId: 'foreground/background', foregroundToken: 'foreground', backgroundToken: 'background' },
  { pairId: 'foreground/card', foregroundToken: 'foreground', backgroundToken: 'card' },
  { pairId: 'foreground/muted', foregroundToken: 'foreground', backgroundToken: 'muted' },
];

const contrastThreshold = 4.5;

const defaultThemeTokens: Record<ThemeMode, ThemeColors> = {
  light: {
    background: 'oklch(0.9755 0.0045 258.3245)',
    foreground: 'oklch(0.2558 0.0433 268.0662)',
    card: 'oklch(0.9341 0.0132 251.5628)',
    primary: 'oklch(0.4815 0.1178 263.3758)',
    secondary: 'oklch(0.8567 0.1164 81.0092)',
    muted: 'oklch(0.9202 0.0080 106.5563)',
    accent: 'oklch(0.6896 0.0714 234.0387)',
    destructive: 'oklch(0.2611 0.0376 322.5267)',
    border: 'oklch(0.7791 0.0156 251.1926)',
  },
  dark: {
    background: 'oklch(0.2204 0.0198 275.8439)',
    foreground: 'oklch(0.9366 0.0129 266.6974)',
    card: 'oklch(0.2703 0.0407 281.3036)',
    primary: 'oklch(0.4815 0.1178 263.3758)',
    secondary: 'oklch(0.9097 0.1440 95.1120)',
    muted: 'oklch(0.2424 0.0324 281.0890)',
    accent: 'oklch(0.8469 0.0524 264.7751)',
    destructive: 'oklch(0.5280 0.1200 357.1130)',
    border: 'oklch(0.3072 0.0287 281.7681)',
  },
};

const componentStylePresetDefaults: Record<ComponentStylePreset, ThemeComponentStyle> = {
  default: defaultComponentStyle,
  observatory: {
    preset: 'observatory',
    density: 'comfortable',
    transparency: 'solid',
    border: 'strong',
    elevation: 'flat',
  },
  floating: {
    preset: 'floating',
    density: 'compact',
    transparency: 'high',
    border: 'soft',
    elevation: 'floating',
  },
};

const componentDensityTokens: Record<ComponentStyleDensity, Pick<ResolvedComponentStyleTokens, 'densityGap' | 'densityPadding' | 'sectionPadding' | 'controlHeight'>> = {
  comfortable: {
    densityGap: '0.375rem',
    densityPadding: '0.375rem',
    sectionPadding: '0.75rem',
    controlHeight: '2.25rem',
  },
  compact: {
    densityGap: '0.25rem',
    densityPadding: '0.25rem',
    sectionPadding: '0.625rem',
    controlHeight: '2rem',
  },
};

const componentTransparencyTokens: Record<ComponentStyleTransparency, Pick<ResolvedComponentStyleTokens, 'surfaceBackground' | 'surfaceStrongBackground' | 'surfaceBlur'>> = {
  solid: {
    surfaceBackground: 'color-mix(in oklch, var(--card) 96%, transparent)',
    surfaceStrongBackground: 'color-mix(in oklch, var(--card) 98%, transparent)',
    surfaceBlur: '0px',
  },
  balanced: {
    surfaceBackground: 'color-mix(in oklch, var(--card) 84%, transparent)',
    surfaceStrongBackground: 'color-mix(in oklch, var(--card) 90%, transparent)',
    surfaceBlur: '12px',
  },
  high: {
    surfaceBackground: 'color-mix(in oklch, var(--card) 72%, transparent)',
    surfaceStrongBackground: 'color-mix(in oklch, var(--card) 80%, transparent)',
    surfaceBlur: '18px',
  },
};

const componentBorderTokens: Record<ComponentStyleBorder, Pick<ResolvedComponentStyleTokens, 'surfaceBorder'>> = {
  soft: {
    surfaceBorder: 'color-mix(in oklch, var(--border) 28%, transparent)',
  },
  medium: {
    surfaceBorder: 'color-mix(in oklch, var(--border) 46%, transparent)',
  },
  strong: {
    surfaceBorder: 'color-mix(in oklch, var(--border) 68%, transparent)',
  },
};

const componentElevationTokens: Record<ComponentStyleElevation, Pick<ResolvedComponentStyleTokens, 'surfaceShadow'>> = {
  flat: {
    surfaceShadow: 'none',
  },
  raised: {
    surfaceShadow: '0 12px 28px -16px rgb(15 23 42 / 0.35)',
  },
  floating: {
    surfaceShadow: '0 20px 44px -18px rgb(15 23 42 / 0.4)',
  },
};

export const customizableThemeColorKeys = [...themeColorKeys] as const;
export const componentStylePresets = [...componentStylePresetOptions] as const;
export const componentStyleDensityValues = [...componentStyleDensityOptions] as const;
export const componentStyleTransparencyValues = [...componentStyleTransparencyOptions] as const;
export const componentStyleBorderValues = [...componentStyleBorderOptions] as const;
export const componentStyleElevationValues = [...componentStyleElevationOptions] as const;

export const themePresets: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    colors: {
      light: {
        primary: 'oklch(0.4815 0.1178 263.3758)',
        secondary: 'oklch(0.8567 0.1164 81.0092)',
        accent: 'oklch(0.6896 0.0714 234.0387)',
      },
      dark: {
        primary: 'oklch(0.4815 0.1178 263.3758)',
        secondary: 'oklch(0.9097 0.1440 95.1120)',
        accent: 'oklch(0.8469 0.0524 264.7751)',
      },
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      light: {
        primary: 'oklch(0.45 0.15 220)',
        secondary: 'oklch(0.75 0.12 200)',
        accent: 'oklch(0.60 0.18 180)',
      },
      dark: {
        primary: 'oklch(0.55 0.18 220)',
        secondary: 'oklch(0.70 0.15 200)',
        accent: 'oklch(0.65 0.20 180)',
      },
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    colors: {
      light: {
        primary: 'oklch(0.45 0.12 145)',
        secondary: 'oklch(0.70 0.10 130)',
        accent: 'oklch(0.55 0.15 160)',
      },
      dark: {
        primary: 'oklch(0.55 0.15 145)',
        secondary: 'oklch(0.65 0.12 130)',
        accent: 'oklch(0.60 0.18 160)',
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: {
      light: {
        primary: 'oklch(0.55 0.18 30)',
        secondary: 'oklch(0.75 0.15 50)',
        accent: 'oklch(0.65 0.20 15)',
      },
      dark: {
        primary: 'oklch(0.60 0.20 30)',
        secondary: 'oklch(0.70 0.18 50)',
        accent: 'oklch(0.65 0.22 15)',
      },
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    colors: {
      light: {
        primary: 'oklch(0.55 0.15 300)',
        secondary: 'oklch(0.80 0.10 290)',
        accent: 'oklch(0.65 0.18 320)',
      },
      dark: {
        primary: 'oklch(0.60 0.18 300)',
        secondary: 'oklch(0.75 0.12 290)',
        accent: 'oklch(0.70 0.20 320)',
      },
    },
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    colors: {
      light: {
        primary: 'oklch(0.40 0.20 280)',
        secondary: 'oklch(0.70 0.15 260)',
        accent: 'oklch(0.55 0.25 300)',
      },
      dark: {
        primary: 'oklch(0.50 0.25 280)',
        secondary: 'oklch(0.65 0.18 260)',
        accent: 'oklch(0.60 0.28 300)',
      },
    },
  },
];

const fontFamilyMap: Record<ThemeCustomization['fontFamily'], string> = {
  default: 'Libre Baskerville, serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const fontSizeScale: Record<ThemeCustomization['fontSize'], number> = {
  small: 0.875,
  default: 1,
  large: 1.125,
};

function hasOwn<T extends object>(obj: T, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function clampRadius(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sanitizeModeColors(value: unknown): Partial<ThemeColors> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const raw = value as Partial<Record<keyof ThemeColors, unknown>>;
  const next: Partial<ThemeColors> = {};

  for (const key of themeColorKeys) {
    const color = raw[key];
    if (typeof color === 'string' && color.trim()) {
      next[key] = color.trim();
    }
  }

  return next;
}

export function sanitizeThemeComponentStyle(
  value: unknown,
  base: ThemeComponentStyle = defaultComponentStyle,
): ThemeComponentStyle {
  if (!value || typeof value !== 'object') {
    return base;
  }

  const raw = value as Partial<Record<keyof ThemeComponentStyle, unknown>>;

  return {
    preset: componentStylePresetOptions.includes(raw.preset as ComponentStylePreset)
      ? raw.preset as ComponentStylePreset
      : base.preset,
    density: componentStyleDensityOptions.includes(raw.density as ComponentStyleDensity)
      ? raw.density as ComponentStyleDensity
      : defaultComponentStyle.density,
    transparency: componentStyleTransparencyOptions.includes(raw.transparency as ComponentStyleTransparency)
      ? raw.transparency as ComponentStyleTransparency
      : defaultComponentStyle.transparency,
    border: componentStyleBorderOptions.includes(raw.border as ComponentStyleBorder)
      ? raw.border as ComponentStyleBorder
      : defaultComponentStyle.border,
    elevation: componentStyleElevationOptions.includes(raw.elevation as ComponentStyleElevation)
      ? raw.elevation as ComponentStyleElevation
      : defaultComponentStyle.elevation,
  };
}

function cloneThemePreset(preset: ThemePreset): ThemePreset {
  return {
    id: preset.id,
    name: preset.name,
    colors: {
      light: { ...preset.colors.light },
      dark: { ...preset.colors.dark },
    },
  };
}

export function sanitizeThemePresets(input: unknown): ThemePreset[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const builtInIds = new Set(themePresets.map((preset) => preset.id));
  const seenIds = new Set<string>();
  const sanitized: ThemePreset[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const raw = item as Partial<ThemePreset>;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    const colors = raw.colors;

    if (!id || !name || builtInIds.has(id) || seenIds.has(id) || !colors || typeof colors !== 'object') {
      continue;
    }

    sanitized.push({
      id,
      name,
      colors: {
        light: sanitizeModeColors((colors as ThemePreset['colors']).light),
        dark: sanitizeModeColors((colors as ThemePreset['colors']).dark),
      },
    });
    seenIds.add(id);
  }

  return sanitized;
}

export function getAvailableThemePresets(userPresets: ThemePreset[] = []): ThemePreset[] {
  return [...themePresets, ...userPresets.map(cloneThemePreset)];
}

export function getResolvedComponentStyleTokens(
  customization: Pick<ThemeCustomization, 'componentStyle'>,
): ResolvedComponentStyleTokens {
  const componentStyle = sanitizeThemeComponentStyle(customization.componentStyle, defaultComponentStyle);

  return {
    ...componentDensityTokens[componentStyle.density],
    ...componentTransparencyTokens[componentStyle.transparency],
    ...componentBorderTokens[componentStyle.border],
    ...componentElevationTokens[componentStyle.elevation],
  };
}

function findThemePreset(presetId: string | null | undefined, userPresets: ThemePreset[] = []): ThemePreset | undefined {
  if (!presetId) {
    return undefined;
  }
  return getAvailableThemePresets(userPresets).find((preset) => preset.id === presetId);
}

function createPresetId(name: string, existingIds: Set<string>): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-theme';

  let candidate = `custom-${base}`;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `custom-${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function sanitizeActivePreset(
  value: unknown,
  fallback: string | null,
  userPresets: ThemePreset[] = [],
): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' && findThemePreset(value, userPresets)) {
    return value;
  }
  return fallback && findThemePreset(fallback, userPresets) ? fallback : null;
}

function sanitizeThemeCustomization(
  incoming: Partial<ThemeCustomization> | undefined,
  base: ThemeCustomization,
  userPresets: ThemePreset[] = [],
): ThemeCustomization {
  const source = incoming ?? {};

  const radius = hasOwn(source, 'radius')
    ? (typeof source.radius === 'number' && Number.isFinite(source.radius)
      ? clampRadius(source.radius)
      : defaultCustomization.radius)
    : base.radius;

  const fontFamily = hasOwn(source, 'fontFamily')
    ? (fontFamilyOptions.includes(source.fontFamily as ThemeCustomization['fontFamily'])
      ? source.fontFamily as ThemeCustomization['fontFamily']
      : defaultCustomization.fontFamily)
    : base.fontFamily;

  const fontSize = hasOwn(source, 'fontSize')
    ? (fontSizeOptions.includes(source.fontSize as ThemeCustomization['fontSize'])
      ? source.fontSize as ThemeCustomization['fontSize']
      : defaultCustomization.fontSize)
    : base.fontSize;

  const animationsEnabled = hasOwn(source, 'animationsEnabled')
    ? (typeof source.animationsEnabled === 'boolean'
      ? source.animationsEnabled
      : defaultCustomization.animationsEnabled)
    : base.animationsEnabled;

  const activePreset = hasOwn(source, 'activePreset')
    ? sanitizeActivePreset(source.activePreset, null, userPresets)
    : sanitizeActivePreset(base.activePreset, null, userPresets);

  let lightColors = base.customColors.light;
  let darkColors = base.customColors.dark;
  let componentStyle = base.componentStyle;

  if (hasOwn(source, 'componentStyle')) {
    componentStyle = sanitizeThemeComponentStyle(source.componentStyle, base.componentStyle);
  }

  if (hasOwn(source, 'customColors')) {
    const incomingColors = source.customColors;
    if (incomingColors && typeof incomingColors === 'object') {
      if (hasOwn(incomingColors, 'light')) {
        lightColors = sanitizeModeColors(incomingColors.light);
      }
      if (hasOwn(incomingColors, 'dark')) {
        darkColors = sanitizeModeColors(incomingColors.dark);
      }
    } else {
      lightColors = {};
      darkColors = {};
    }
  }

  return {
    radius,
    fontFamily,
    fontSize,
    animationsEnabled,
    activePreset,
    componentStyle,
    customColors: {
      light: lightColors,
      dark: darkColors,
    },
  };
}

export function migrateThemeStoreState(
  persistedState: unknown,
  _version: number,
): ThemeStorePersistedState {
  const raw = persistedState as
    | ThemeStorePersistedState
    | { customization?: Partial<ThemeCustomization>; userPresets?: ThemePreset[] }
    | Partial<ThemeCustomization>
    | undefined;

  const userPresets = raw && typeof raw === 'object' && hasOwn(raw, 'userPresets')
    ? sanitizeThemePresets((raw as { userPresets?: ThemePreset[] }).userPresets)
    : [];

  const customization = raw && typeof raw === 'object' && hasOwn(raw, 'customization')
    ? (raw as { customization?: Partial<ThemeCustomization> }).customization
    : raw as Partial<ThemeCustomization> | undefined;

  return {
    customization: sanitizeThemeCustomization(customization, defaultCustomization, userPresets),
    userPresets,
  };
}

export function getPresetThemeColors(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): Partial<ThemeColors> {
  const activePreset = findThemePreset(customization.activePreset, userPresets);
  return activePreset ? activePreset.colors[mode] : {};
}

export function getResolvedThemeColors(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): Partial<ThemeColors> {
  return {
    ...getPresetThemeColors(customization, mode, userPresets),
    ...customization.customColors[mode],
  };
}

export function getEffectiveThemeColors(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): ThemeColors {
  return {
    ...defaultThemeTokens[mode],
    ...getResolvedThemeColors(customization, mode, userPresets),
  };
}

export function getThemePreviewData(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): ThemePreviewData {
  return {
    mode,
    tokens: getEffectiveThemeColors(customization, mode, userPresets),
  };
}

export function getComponentStylePreviewData(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): ComponentStylePreviewData {
  return {
    mode,
    themeTokens: getEffectiveThemeColors(customization, mode, userPresets),
    surfaceTokens: getResolvedComponentStyleTokens(customization),
    componentStyle: sanitizeThemeComponentStyle(customization.componentStyle, defaultComponentStyle),
  };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function linearToSrgb(value: number): number {
  const clamped = clampUnit(value);
  if (clamped <= 0.0031308) {
    return 12.92 * clamped;
  }
  return 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.replace('#', '').trim();
  if (![3, 6].includes(hex.length) || /[^0-9a-f]/i.test(hex)) {
    return null;
  }
  const normalized = hex.length === 3
    ? hex.split('').map((item) => `${item}${item}`).join('')
    : hex;

  return [
    parseInt(normalized.slice(0, 2), 16) / 255,
    parseInt(normalized.slice(2, 4), 16) / 255,
    parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function parseRgbChannel(value: string): number | null {
  if (value.endsWith('%')) {
    const percent = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(percent) ? clampUnit(percent / 100) : null;
  }
  const channel = Number.parseFloat(value);
  return Number.isFinite(channel) ? clampUnit(channel / 255) : null;
}

function parseRgbColor(value: string): [number, number, number] | null {
  const match = value.match(/^rgba?\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const red = parseRgbChannel(parts[0]);
  const green = parseRgbChannel(parts[1]);
  const blue = parseRgbChannel(parts[2]);
  return red === null || green === null || blue === null ? null : [red, green, blue];
}

function hueToRgb(p: number, q: number, t: number): number {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function parseHslColor(value: string): [number, number, number] | null {
  const match = value.match(/^hsla?\((.+)\)$/i);
  if (!match) {
    return null;
  }
  const parts = match[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const hue = Number.parseFloat(parts[0]);
  const saturation = Number.parseFloat(parts[1].replace('%', '')) / 100;
  const lightness = Number.parseFloat(parts[2].replace('%', '')) / 100;
  if (![hue, saturation, lightness].every(Number.isFinite)) {
    return null;
  }

  const normalizedHue = ((hue % 360) + 360) % 360 / 360;
  if (saturation === 0) {
    return [lightness, lightness, lightness];
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return [
    hueToRgb(p, q, normalizedHue + 1 / 3),
    hueToRgb(p, q, normalizedHue),
    hueToRgb(p, q, normalizedHue - 1 / 3),
  ];
}

function parseOklchColor(value: string): [number, number, number] | null {
  const match = value.match(/^oklch\((.+)\)$/i);
  if (!match) {
    return null;
  }

  const parts = match[1].trim().split(/[\s\/]+/).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  const lightness = Number.parseFloat(parts[0]);
  const chroma = Number.parseFloat(parts[1]);
  const hue = Number.parseFloat(parts[2]);
  if (![lightness, chroma, hue].every(Number.isFinite)) {
    return null;
  }

  const hueRadians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);

  const lValue = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mValue = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sValue = lightness - 0.0894841775 * a - 1.291485548 * b;

  const lCube = lValue ** 3;
  const mCube = mValue ** 3;
  const sCube = sValue ** 3;

  const red = linearToSrgb(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube);
  const green = linearToSrgb(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube);
  const blue = linearToSrgb(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube);
  return [red, green, blue];
}

function parseCssColor(value: string): [number, number, number] | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return parseHexColor(normalized)
    ?? parseRgbColor(normalized)
    ?? parseHslColor(normalized)
    ?? parseOklchColor(normalized)
    ?? (() => {
      if (typeof document === 'undefined') {
        return null;
      }

      const element = document.createElement('span');
      element.style.color = '';
      element.style.color = normalized;
      if (!element.style.color) {
        return null;
      }

      document.body.appendChild(element);
      const computed = getComputedStyle(element).color;
      element.remove();
      return computed && computed !== normalized ? parseCssColor(computed) : null;
    })();
}

function channelToHex(channel: number): string {
  return Math.round(clampUnit(channel) * 255).toString(16).padStart(2, '0');
}

/**
 * Converts any CSS color string (hex/rgb/hsl/oklch/named) to a `#rrggbb`
 * hex string, suitable for seeding a native `<input type="color">`.
 * Returns null when the value cannot be parsed.
 */
export function cssColorToHex(value: string): string | null {
  const rgb = parseCssColor(value);
  if (!rgb) {
    return null;
  }
  return `#${channelToHex(rgb[0])}${channelToHex(rgb[1])}${channelToHex(rgb[2])}`;
}

function toRelativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((channel) => (
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function getContrastRatio(foreground: string, background: string): number | null {
  const foregroundRgb = parseCssColor(foreground);
  const backgroundRgb = parseCssColor(background);
  if (!foregroundRgb || !backgroundRgb) {
    return null;
  }
  const lighter = Math.max(toRelativeLuminance(foregroundRgb), toRelativeLuminance(backgroundRgb));
  const darker = Math.min(toRelativeLuminance(foregroundRgb), toRelativeLuminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

export function getThemeContrastWarnings(
  customization: ThemeCustomization,
  mode: ThemeMode,
  userPresets: ThemePreset[] = [],
): ThemeContrastWarning[] {
  const tokens = getEffectiveThemeColors(customization, mode, userPresets);

  return previewContrastPairs.flatMap(({ pairId, foregroundToken, backgroundToken }) => {
    const ratio = getContrastRatio(tokens[foregroundToken], tokens[backgroundToken]);
    if (ratio === null || ratio >= contrastThreshold) {
      return [];
    }

    return [{
      pairId,
      mode,
      foregroundToken,
      backgroundToken,
      ratio,
      threshold: contrastThreshold,
    } satisfies ThemeContrastWarning];
  });
}

export function isValidThemeColorValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  if (typeof window !== 'undefined' && window.CSS && typeof window.CSS.supports === 'function') {
    return window.CSS.supports('color', normalized);
  }

  if (typeof document !== 'undefined') {
    const tester = document.createElement('span').style;
    tester.color = '';
    tester.color = normalized;
    return tester.color !== '';
  }

  return true;
}

// Batch DOM updates for better performance
let pendingUpdate: number | null = null;
const componentStyleVariableNames = [
  '--component-density-gap',
  '--component-density-padding',
  '--component-section-padding',
  '--component-control-height',
  '--component-surface-bg',
  '--component-surface-strong-bg',
  '--component-surface-border',
  '--component-surface-shadow',
  '--component-surface-blur',
] as const;

function applyThemeToDOM(customization: ThemeCustomization, userPresets: ThemePreset[]) {
  if (pendingUpdate !== null) {
    cancelAnimationFrame(pendingUpdate);
  }

  pendingUpdate = requestAnimationFrame(() => {
    pendingUpdate = null;
    const root = document.documentElement;
    const styleUpdates: [string, string][] = [];

    styleUpdates.push(['--radius', `${customization.radius}rem`]);
    styleUpdates.push(['--font-sans', fontFamilyMap[customization.fontFamily]]);
    styleUpdates.push(['--font-size-scale', String(fontSizeScale[customization.fontSize])]);

    themeColorKeys.forEach((key) => {
      root.style.removeProperty(`--${key}`);
    });
    componentStyleVariableNames.forEach((key) => {
      root.style.removeProperty(key);
    });

    const isDark = root.classList.contains('dark');
    const mergedColors = getResolvedThemeColors(customization, isDark ? 'dark' : 'light', userPresets);
    const componentStyleTokens = getResolvedComponentStyleTokens(customization);

    Object.entries(mergedColors).forEach(([key, value]) => {
      if (value) {
        styleUpdates.push([`--${key}`, value]);
      }
    });

    styleUpdates.push(['--component-density-gap', componentStyleTokens.densityGap]);
    styleUpdates.push(['--component-density-padding', componentStyleTokens.densityPadding]);
    styleUpdates.push(['--component-section-padding', componentStyleTokens.sectionPadding]);
    styleUpdates.push(['--component-control-height', componentStyleTokens.controlHeight]);
    styleUpdates.push(['--component-surface-bg', componentStyleTokens.surfaceBackground]);
    styleUpdates.push(['--component-surface-strong-bg', componentStyleTokens.surfaceStrongBackground]);
    styleUpdates.push(['--component-surface-border', componentStyleTokens.surfaceBorder]);
    styleUpdates.push(['--component-surface-shadow', componentStyleTokens.surfaceShadow]);
    styleUpdates.push(['--component-surface-blur', componentStyleTokens.surfaceBlur]);

    styleUpdates.forEach(([prop, value]) => {
      root.style.setProperty(prop, value);
    });

    root.style.fontSize = `${fontSizeScale[customization.fontSize] * 16}px`;

    if (!customization.animationsEnabled) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
  });
}

export function getFontPreview(font: ThemeCustomization['fontFamily']): string {
  return fontFamilyMap[font];
}

function buildPresetFromCurrentState(
  presetId: string,
  name: string,
  customization: ThemeCustomization,
  userPresets: ThemePreset[],
): ThemePreset {
  return {
    id: presetId,
    name,
    colors: {
      light: getEffectiveThemeColors(customization, 'light', userPresets),
      dark: getEffectiveThemeColors(customization, 'dark', userPresets),
    },
  };
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      customization: defaultCustomization,
      userPresets: [],

      setCustomization: (customization) => {
        set((state) => ({
          customization: sanitizeThemeCustomization(customization, state.customization, state.userPresets),
        }));
        get().applyCustomization();
      },

      setComponentStylePreset: (preset) => {
        get().setCustomization({
          componentStyle: componentStylePresetDefaults[preset],
        });
      },

      setComponentStyleDensity: (density) => {
        const current = get().customization.componentStyle;
        get().setCustomization({
          componentStyle: { ...current, density },
        });
      },

      setComponentStyleTransparency: (transparency) => {
        const current = get().customization.componentStyle;
        get().setCustomization({
          componentStyle: { ...current, transparency },
        });
      },

      setComponentStyleBorder: (border) => {
        const current = get().customization.componentStyle;
        get().setCustomization({
          componentStyle: { ...current, border },
        });
      },

      setComponentStyleElevation: (elevation) => {
        const current = get().customization.componentStyle;
        get().setCustomization({
          componentStyle: { ...current, elevation },
        });
      },

      setRadius: (radius) => {
        get().setCustomization({ radius });
      },

      setFontFamily: (fontFamily) => {
        get().setCustomization({ fontFamily });
      },

      setFontSize: (fontSize) => {
        get().setCustomization({ fontSize });
      },

      setAnimationsEnabled: (animationsEnabled) => {
        get().setCustomization({ animationsEnabled });
      },

      setActivePreset: (activePreset) => {
        const validPresetId = sanitizeActivePreset(activePreset, null, get().userPresets);
        get().setCustomization({ activePreset: validPresetId });
      },

      setCustomColor: (mode, key, value) => {
        const current = get().customization;
        const modeColors = { ...current.customColors[mode], [key]: value };
        get().setCustomization({
          customColors: {
            ...current.customColors,
            [mode]: modeColors,
          },
        });
      },

      clearCustomColor: (mode, key) => {
        const current = get().customization;
        const modeColors = { ...current.customColors[mode] };
        delete modeColors[key];
        get().setCustomization({
          customColors: {
            ...current.customColors,
            [mode]: modeColors,
          },
        });
      },

      replaceUserPresets: (userPresets) => {
        const sanitized = sanitizeThemePresets(userPresets);
        set((state) => ({
          userPresets: sanitized,
          customization: sanitizeThemeCustomization(state.customization, state.customization, sanitized),
        }));
        get().applyCustomization();
      },

      saveCurrentAsPreset: (name) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return null;
        }

        const state = get();
        const existingIds = new Set(getAvailableThemePresets(state.userPresets).map((preset) => preset.id));
        const presetId = createPresetId(trimmedName, existingIds);
        const preset = buildPresetFromCurrentState(presetId, trimmedName, state.customization, state.userPresets);

        set({
          userPresets: [...state.userPresets, preset],
          customization: {
            ...state.customization,
            activePreset: preset.id,
          },
        });
        get().applyCustomization();
        return preset.id;
      },

      duplicatePreset: (presetId, name) => {
        const trimmedName = name.trim();
        const sourcePreset = findThemePreset(presetId, get().userPresets);
        if (!trimmedName || !sourcePreset) {
          return null;
        }

        const existingIds = new Set(getAvailableThemePresets(get().userPresets).map((preset) => preset.id));
        const nextId = createPresetId(trimmedName, existingIds);
        const nextPreset: ThemePreset = {
          id: nextId,
          name: trimmedName,
          colors: {
            light: { ...sourcePreset.colors.light },
            dark: { ...sourcePreset.colors.dark },
          },
        };

        set((state) => ({
          userPresets: [...state.userPresets, nextPreset],
          customization: {
            ...state.customization,
            activePreset: nextId,
          },
        }));
        get().applyCustomization();
        return nextId;
      },

      renameUserPreset: (presetId, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return;
        }

        set((state) => ({
          userPresets: state.userPresets.map((preset) => (
            preset.id === presetId ? { ...preset, name: trimmedName } : preset
          )),
        }));
      },

      saveCurrentToUserPreset: (presetId) => {
        const state = get();
        const preset = state.userPresets.find((item) => item.id === presetId);
        if (!preset) {
          return;
        }

        const nextPreset = buildPresetFromCurrentState(preset.id, preset.name, state.customization, state.userPresets);
        set({
          userPresets: state.userPresets.map((item) => item.id === presetId ? nextPreset : item),
        });
        get().applyCustomization();
      },

      deleteUserPreset: (presetId) => {
        set((state) => {
          const nextUserPresets = state.userPresets.filter((preset) => preset.id !== presetId);
          const nextActivePreset = state.customization.activePreset === presetId ? null : state.customization.activePreset;
          return {
            userPresets: nextUserPresets,
            customization: sanitizeThemeCustomization(
              { ...state.customization, activePreset: nextActivePreset },
              state.customization,
              nextUserPresets,
            ),
          };
        });
        get().applyCustomization();
      },

      resetCustomization: () => {
        set((state) => ({
          customization: sanitizeThemeCustomization(
            { ...defaultCustomization, customColors: { light: {}, dark: {} } },
            defaultCustomization,
            state.userPresets,
          ),
        }));

        const root = document.documentElement;
        root.style.removeProperty('--radius');
        root.style.removeProperty('--font-sans');
        root.style.removeProperty('--font-size-scale');
        root.style.fontSize = '';
        root.classList.remove('reduce-motion');
        componentStyleVariableNames.forEach((key) => {
          root.style.removeProperty(key);
        });
        themeColorKeys.forEach((key) => {
          root.style.removeProperty(`--${key}`);
        });
      },

      applyCustomization: () => {
        if (typeof window !== 'undefined') {
          applyThemeToDOM(get().customization, get().userPresets);
        }
      },

      exportTheme: () => {
        const state = get();
        const payload: ThemeExportPayload = {
          version: THEME_EXPORT_VERSION,
          customization: state.customization,
          userPresets: state.userPresets,
        };
        return JSON.stringify(payload, null, 2);
      },

      importTheme: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return false;
        }

        if (!parsed || typeof parsed !== 'object') {
          return false;
        }

        // Require at least one recognizable theme field so importing an
        // unrelated JSON object does not silently wipe the user's theme.
        if (!hasOwn(parsed, 'customization') && !hasOwn(parsed, 'userPresets')) {
          return false;
        }

        const data = parsed as Partial<ThemeExportPayload>;
        const userPresets = sanitizeThemePresets(data.userPresets);
        const customization = sanitizeThemeCustomization(
          data.customization,
          defaultCustomization,
          userPresets,
        );

        set({ customization, userPresets });
        get().applyCustomization();
        return true;
      },
    }),
    {
      name: 'theme-customization',
      storage: getZustandStorage(),
      version: 3,
      migrate: migrateThemeStoreState,
      partialize: (state) => ({
        customization: state.customization,
        userPresets: state.userPresets,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setTimeout(() => state.applyCustomization(), 0);
        }
      },
    },
  ),
);
