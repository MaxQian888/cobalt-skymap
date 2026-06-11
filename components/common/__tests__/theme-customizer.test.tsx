/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeCustomizer, ThemeCustomizerButton } from '../theme-customizer';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock next-themes
const mockSetTheme = jest.fn();
let mockResolvedTheme = 'light';
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme,
  }),
}));

// Mock theme store
const mockSetRadius = jest.fn();
const mockSetFontFamily = jest.fn();
const mockSetFontSize = jest.fn();
const mockSetAnimationsEnabled = jest.fn();
const mockSetActivePreset = jest.fn();
const mockSetCustomColor = jest.fn();
const mockClearCustomColor = jest.fn();
const mockSetComponentStylePreset = jest.fn();
const mockSetComponentStyleDensity = jest.fn();
const mockSetComponentStyleTransparency = jest.fn();
const mockSetComponentStyleBorder = jest.fn();
const mockSetComponentStyleElevation = jest.fn();
const mockResetCustomization = jest.fn();
const mockSaveCurrentAsPreset = jest.fn();
const mockDuplicatePreset = jest.fn();
const mockRenameUserPreset = jest.fn();
const mockSaveCurrentToUserPreset = jest.fn();
const mockDeleteUserPreset = jest.fn();

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: () => ({
    customization: {
      radius: 0.5,
      fontFamily: 'default',
      fontSize: 'default',
      animationsEnabled: true,
      activePreset: 'custom-night',
      componentStyle: {
        preset: 'default',
        density: 'comfortable',
        transparency: 'balanced',
        border: 'medium',
        elevation: 'raised',
      },
      customColors: {
        light: { primary: '#fafafa' },
        dark: { primary: '#101010' },
      },
    },
    userPresets: [
      {
        id: 'custom-night',
        name: 'Custom Night',
        colors: {
          light: { primary: '#123456', background: '#f8f8f8' },
          dark: { primary: '#abcdef', background: '#050505' },
        },
      },
    ],
    setRadius: mockSetRadius,
    setFontFamily: mockSetFontFamily,
    setFontSize: mockSetFontSize,
    setAnimationsEnabled: mockSetAnimationsEnabled,
    setActivePreset: mockSetActivePreset,
    setCustomColor: mockSetCustomColor,
    clearCustomColor: mockClearCustomColor,
    setComponentStylePreset: mockSetComponentStylePreset,
    setComponentStyleDensity: mockSetComponentStyleDensity,
    setComponentStyleTransparency: mockSetComponentStyleTransparency,
    setComponentStyleBorder: mockSetComponentStyleBorder,
    setComponentStyleElevation: mockSetComponentStyleElevation,
    resetCustomization: mockResetCustomization,
    saveCurrentAsPreset: mockSaveCurrentAsPreset,
    duplicatePreset: mockDuplicatePreset,
    renameUserPreset: mockRenameUserPreset,
    saveCurrentToUserPreset: mockSaveCurrentToUserPreset,
    deleteUserPreset: mockDeleteUserPreset,
    exportTheme: jest.fn(() => '{"version":3}'),
    importTheme: jest.fn(() => true),
  }),
  componentStylePresets: ['default', 'observatory', 'floating'],
  componentStyleDensityValues: ['comfortable', 'compact'],
  componentStyleTransparencyValues: ['solid', 'balanced', 'high'],
  componentStyleBorderValues: ['soft', 'medium', 'strong'],
  componentStyleElevationValues: ['flat', 'raised', 'floating'],
  customizableThemeColorKeys: [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'muted',
    'card',
    'border',
    'destructive',
  ],
  getPresetThemeColors: (customization: { activePreset: string | null }, mode: 'light' | 'dark') => {
    const preset = [
      {
        id: 'preset1',
        colors: {
          light: { primary: '#000', secondary: '#111', accent: '#222' },
          dark: { primary: '#fff', secondary: '#eee', accent: '#ddd' },
        },
      },
    ].find((item) => item.id === customization.activePreset);

    return preset ? preset.colors[mode] : {};
  },
  isValidThemeColorValue: (value: string) => value !== 'not-a-valid-color',
  cssColorToHex: (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null),
  getAvailableThemePresets: (userPresets: Array<{ id: string; name: string; colors: { light: Record<string, string>; dark: Record<string, string> } }> = []) => ([
    {
      id: 'preset1',
      name: 'Preset 1',
      colors: {
        light: { primary: '#000', secondary: '#111', accent: '#222' },
        dark: { primary: '#fff', secondary: '#eee', accent: '#ddd' },
      },
    },
    ...userPresets,
  ]),
  getThemePreviewData: (_customization: unknown, mode: 'light' | 'dark') => ({
    mode,
    tokens: {
      primary: mode === 'light' ? '#123456' : '#abcdef',
      secondary: mode === 'light' ? '#ddeeff' : '#334455',
      accent: mode === 'light' ? '#8899aa' : '#556677',
      background: mode === 'light' ? '#ffffff' : '#050505',
      foreground: mode === 'light' ? '#121212' : '#f5f5f5',
      muted: mode === 'light' ? '#eeeeee' : '#222222',
      card: mode === 'light' ? '#f6f6f6' : '#111111',
      border: mode === 'light' ? '#cccccc' : '#333333',
      destructive: '#cc0000',
    },
  }),
  getComponentStylePreviewData: (_customization: unknown, mode: 'light' | 'dark') => ({
    mode,
    themeTokens: {
      primary: mode === 'light' ? '#123456' : '#abcdef',
      secondary: mode === 'light' ? '#ddeeff' : '#334455',
      accent: mode === 'light' ? '#8899aa' : '#556677',
      background: mode === 'light' ? '#ffffff' : '#050505',
      foreground: mode === 'light' ? '#121212' : '#f5f5f5',
      muted: mode === 'light' ? '#eeeeee' : '#222222',
      card: mode === 'light' ? '#f6f6f6' : '#111111',
      border: mode === 'light' ? '#cccccc' : '#333333',
      destructive: '#cc0000',
    },
    surfaceTokens: {
      densityGap: '0.375rem',
      densityPadding: '0.375rem',
      sectionPadding: '0.75rem',
      controlHeight: '2.25rem',
      surfaceBackground: mode === 'light' ? 'rgba(255,255,255,0.84)' : 'rgba(17,17,17,0.72)',
      surfaceStrongBackground: mode === 'light' ? 'rgba(255,255,255,0.90)' : 'rgba(17,17,17,0.80)',
      surfaceBorder: mode === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
      surfaceShadow: '0 12px 28px -16px rgb(15 23 42 / 0.35)',
      surfaceBlur: mode === 'light' ? '12px' : '18px',
    },
    componentStyle: {
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    },
  }),
  getThemeContrastWarnings: (_customization: unknown, mode: 'light' | 'dark') => mode === 'light'
    ? [{
      pairId: 'foreground/background',
      mode,
      foregroundToken: 'foreground',
      backgroundToken: 'background',
      ratio: 2.1,
      threshold: 4.5,
    }]
    : [],
  themePresets: [
    {
      id: 'preset1',
      name: 'Preset 1',
      colors: {
        light: { primary: '#000', secondary: '#111', accent: '#222' },
        dark: { primary: '#fff', secondary: '#eee', accent: '#ddd' },
      },
    },
  ],
  getFontPreview: (font: string) => {
    const map: Record<string, string> = {
      default: 'Libre Baskerville, serif',
      serif: 'ui-serif, Georgia, serif',
      mono: 'ui-monospace, monospace',
      system: 'system-ui, sans-serif',
    };
    return map[font] || 'Libre Baskerville, serif';
  },
}));

const messages = {
  theme: {
    customize: 'Customize',
    customizeTheme: 'Customize Theme',
    customizeDescription: 'Change the look and feel of the app.',
    presets: 'Presets',
    appearance: 'Appearance',
    typography: 'Typography',
    colorPresets: 'Color Presets',
    borderRadius: 'Border Radius',
    square: 'Square',
    rounded: 'Rounded',
    preview: 'Preview',
    animations: 'Animations',
    animationsDescription: 'Enable or disable UI animations.',
    fontFamily: 'Font Family',
    fontDefault: 'Default',
    fontSerif: 'Serif',
    fontMono: 'Monospace',
    fontSystem: 'System',
    fontPreviewText: 'The quick brown fox jumps over the lazy dog.',
    fontSize: 'Font Size',
    fontSizeSmall: 'Small',
    fontSizeDefault: 'Default',
    fontSizeLarge: 'Large',
    clearColor: 'Clear color',
    invalidColor: 'Invalid color',
    colorValuePlaceholder: 'Enter a color',
    colors: 'Colors',
    customOverridesPreset: 'Custom overrides preset',
    customPresets: 'Custom Presets',
    presetNamePlaceholder: 'Preset name',
    savePreset: 'Save preset',
    duplicatePreset: 'Duplicate preset',
    renamePreset: 'Rename preset',
    updatePreset: 'Update preset',
    deletePreset: 'Delete preset',
    previewWorkspace: 'Preview workspace',
    previewMode: 'Preview mode',
    previewLight: 'Preview light',
    previewDark: 'Preview dark',
    accessibilityWarnings: 'Accessibility warnings',
    noAccessibilityWarnings: 'No accessibility warnings',
    warningPairForegroundBackground: 'Foreground vs background',
    componentStyle: 'Component style',
    componentStylePreset: 'Component style preset',
    componentDensity: 'Density',
    componentTransparency: 'Transparency',
    componentBorder: 'Border emphasis',
    componentElevation: 'Elevation',
    componentPreviewToolbar: 'Toolbar preview',
    componentPreviewPanel: 'Panel preview',
    componentPreviewSection: 'Section preview',
    componentPresetDefault: 'Default surface',
    componentPresetObservatory: 'Observatory',
    componentPresetFloating: 'Floating glass',
    componentDensityComfortable: 'Comfortable',
    componentDensityCompact: 'Compact',
    componentTransparencySolid: 'Solid',
    componentTransparencyBalanced: 'Balanced',
    componentTransparencyHigh: 'High',
    componentBorderSoft: 'Soft',
    componentBorderMedium: 'Medium',
    componentBorderStrong: 'Strong',
    componentElevationFlat: 'Flat',
    componentElevationRaised: 'Raised',
    componentElevationFloating: 'Floating',
  },
  common: {
    reset: 'Reset',
    close: 'Close',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
  },
  settingsNew: {
    appearance: {
      themeMode: 'Theme mode',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      colors: 'Colors',
      colorMode: 'Edit palette',
      colorPresets: 'Color presets',
      fontFamily: 'Font family',
      fontSize: 'Font size',
      typography: 'Typography',
      borderRadius: 'Border radius',
      roundness: 'Roundness',
      preview: 'Preview',
      square: 'Square',
      rounded: 'Rounded',
      enableAnimationsDesc: 'Enable animations',
    },
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>
        {ui}
      </TooltipProvider>
    </NextIntlClientProvider>
  );
};

describe('ThemeCustomizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolvedTheme = 'light';
  });

  it('renders trigger button', () => {
    renderWithProviders(<ThemeCustomizer />);
    expect(screen.getByText('theme.customize')).toBeInTheDocument();
  });

  it('opens dialog when trigger is clicked', () => {
    renderWithProviders(<ThemeCustomizer />);
    fireEvent.click(screen.getByText('theme.customize'));
    expect(screen.getByText('theme.customizeTheme')).toBeInTheDocument();
  });

  it('opens with a custom trigger when one is provided', () => {
    renderWithProviders(
      <ThemeCustomizer trigger={<button type="button">Open customizer</button>} />
    );

    fireEvent.click(screen.getByText('Open customizer'));

    expect(screen.getByText('theme.customizeTheme')).toBeInTheDocument();
  });

  it('shows presets by default', () => {
    renderWithProviders(<ThemeCustomizer open={true} />);
    expect(screen.getByText('theme.colorPresets')).toBeInTheDocument();
    expect(screen.getByText('Preset 1')).toBeInTheDocument();
  });

  it('shows the resolved dark mode label on the presets tab', () => {
    mockResolvedTheme = 'dark';

    renderWithProviders(<ThemeCustomizer open={true} />);

    expect(screen.getByText('common.darkMode')).toBeInTheDocument();
  });

  it('calls setActivePreset when a preset is clicked', () => {
    renderWithProviders(<ThemeCustomizer open={true} />);
    fireEvent.click(screen.getByText('Preset 1'));
    expect(mockSetActivePreset).toHaveBeenCalledWith('preset1');
  });

  it('switches to appearance tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);
    await user.click(screen.getByText('theme.appearance'));
    expect(screen.getByText('theme.borderRadius')).toBeInTheDocument();
    expect(screen.getByText('theme.animations')).toBeInTheDocument();
  });

  it('shows theme mode and palette controls in appearance tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    expect(screen.getByText('settingsNew.appearance.themeMode')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('theme.colorValuePlaceholder')).toHaveLength(9);
  });

  it('shows component style controls in the appearance tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    expect(screen.getAllByText('theme.componentStylePreset').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewToolbar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewPanel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewSection').length).toBeGreaterThan(0);
  });

  it('commits valid palette overrides from the quick customizer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    await user.clear(inputs[0]);
    await user.type(inputs[0], '#123456');
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).toHaveBeenCalledWith('light', 'primary', '#123456');
  });

  it('hydrates palette inputs from persisted customization state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    expect(inputs[0]).toHaveValue('#fafafa');
  });

  it('shows an error for invalid palette overrides in the quick customizer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    await user.clear(inputs[0]);
    await user.type(inputs[0], 'not-a-valid-color');
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).not.toHaveBeenCalled();
    expect(screen.getByText('theme.invalidColor')).toBeInTheDocument();
  });

  it('switches to typography tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);
    await user.click(screen.getByText('theme.typography'));
    expect(screen.getByText('theme.fontFamily')).toBeInTheDocument();
    expect(screen.getByText('theme.fontSize')).toBeInTheDocument();
  });

  it('calls resetCustomization when reset button is clicked', () => {
    renderWithProviders(<ThemeCustomizer open={true} />);
    fireEvent.click(screen.getByText('common.reset'));
    expect(mockResetCustomization).toHaveBeenCalled();
  });

  it('calls onOpenChange when close button is clicked', () => {
    const mockOnOpenChange = jest.fn();
    renderWithProviders(<ThemeCustomizer open={true} onOpenChange={mockOnOpenChange} />);
    fireEvent.click(screen.getByText('common.close'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders custom preset controls and saves a reusable preset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    expect(screen.getByText('Custom Night')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('theme.presetNamePlaceholder');
    await user.clear(nameInput);
    await user.type(nameInput, 'Aurora');
    await user.click(screen.getByText('theme.savePreset'));

    expect(mockSaveCurrentAsPreset).toHaveBeenCalledWith('Aurora');
  });

  it('renders preview workspace and accessibility guidance in appearance tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeCustomizer open={true} />);

    await user.click(screen.getByText('theme.appearance'));

    expect(screen.getAllByText('theme.previewWorkspace').length).toBeGreaterThan(0);
    expect(screen.getByText('theme.accessibilityWarnings')).toBeInTheDocument();
    expect(screen.getByText('theme.warningPairForegroundBackground')).toBeInTheDocument();
  });

  it('renders the icon button wrapper entry point', () => {
    renderWithProviders(<ThemeCustomizerButton />);

    expect(screen.getByText('theme.customize')).toBeInTheDocument();
  });
});
