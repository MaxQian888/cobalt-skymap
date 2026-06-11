/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppearanceSettings } from '../appearance-settings';

const mockSetTheme = jest.fn();
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

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: mockSetTheme,
    resolvedTheme: 'dark',
  }),
}));

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: () => ({
    customization: {
      radius: 0.5,
      fontFamily: 'default',
      fontSize: 'default',
      letterSpacing: 'normal',
      lineHeight: 'normal',
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
    setLetterSpacing: jest.fn(),
    setLineHeight: jest.fn(),
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
  letterSpacingValues: ['tight', 'normal', 'wide'],
  lineHeightValues: ['compact', 'normal', 'relaxed'],
  cssColorToHex: (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null),
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
        id: 'default',
        colors: {
          light: { primary: '#eeeeee', secondary: '#cccccc', accent: '#bbbbbb' },
          dark: { primary: '#222222', secondary: '#444444', accent: '#666666' },
        },
      },
    ].find((item) => item.id === customization.activePreset);

    return preset ? preset.colors[mode] : {};
  },
  isValidThemeColorValue: (value: string) => value !== 'not-a-valid-color',
  getAvailableThemePresets: (userPresets: Array<{ id: string; name: string; colors: { light: Record<string, string>; dark: Record<string, string> } }> = []) => ([
    {
      id: 'default',
      name: 'Default',
      colors: {
        light: { primary: '#eeeeee', secondary: '#cccccc', accent: '#bbbbbb' },
        dark: { primary: '#222222', secondary: '#444444', accent: '#666666' },
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
  getThemeContrastWarnings: (_customization: unknown, mode: 'light' | 'dark') => mode === 'dark'
    ? [{
      pairId: 'foreground/background',
      mode,
      foregroundToken: 'foreground',
      backgroundToken: 'background',
      ratio: 2.4,
      threshold: 4.5,
    }]
    : [],
  getFontPreview: (font: string) => {
    const map: Record<string, string> = {
      default: 'Libre Baskerville, serif',
      serif: 'ui-serif, Georgia, serif',
      mono: 'ui-monospace, monospace',
      system: 'system-ui, sans-serif',
    };

    return map[font] || 'Libre Baskerville, serif';
  },
  themePresets: [
    {
      id: 'default',
      name: 'Default',
      colors: {
        light: { primary: '#eeeeee', secondary: '#cccccc', accent: '#bbbbbb' },
        dark: { primary: '#222222', secondary: '#444444', accent: '#666666' },
      },
    },
  ],
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, type = 'button', disabled, className, variant }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button type={type} disabled={disabled} onClick={onClick} className={className} data-variant={variant}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, onBlur, onKeyDown, placeholder, className, 'aria-invalid': ariaInvalid }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    'aria-invalid'?: boolean;
  }) => (
    <input
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
      aria-invalid={ariaInvalid}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (next: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(event) => onValueChange([Number(event.target.value)])}
    />
  ),
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span>select</span>,
}));

jest.mock('../settings-shared', () => ({
  SettingsSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
  ToggleItem: ({ id, label, checked, onCheckedChange }: {
    id: string;
    label: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
    </label>
  ),
}));

describe('AppearanceSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders editable rows for all customizable colors', () => {
    render(<AppearanceSettings />);
    expect(screen.getAllByPlaceholderText('theme.colorValuePlaceholder')).toHaveLength(9);
  });

  it('commits valid color values to current editing mode', () => {
    render(<AppearanceSettings />);

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: '#123456' } });
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).toHaveBeenCalledWith('dark', 'primary', '#123456');
  });

  it('can switch editing mode and write to light palette', () => {
    render(<AppearanceSettings />);

    const lightButtons = screen.getAllByRole('radio', { name: 'settingsNew.appearance.light' });
    fireEvent.click(lightButtons[lightButtons.length - 1]);
    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: '#abcdef' } });
    fireEvent.blur(inputs[0]);

    expect(mockSetCustomColor).toHaveBeenCalledWith('light', 'primary', '#abcdef');
  });

  it('shows error for invalid CSS colors and does not persist', () => {
    render(<AppearanceSettings />);

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    fireEvent.change(inputs[0], { target: { value: 'not-a-valid-color' } });
    fireEvent.blur(inputs[0]);

    expect(screen.getByText('theme.invalidColor')).toBeInTheDocument();
    expect(mockSetCustomColor).not.toHaveBeenCalled();
  });

  it('clears custom color override for current mode', () => {
    render(<AppearanceSettings />);

    const clearButtons = screen.getAllByText('theme.clearColor');
    fireEvent.click(clearButtons[0]);

    expect(mockClearCustomColor).toHaveBeenCalledWith('dark', 'primary');
  });

  it('toggles animations setting', () => {
    render(<AppearanceSettings />);

    fireEvent.click(screen.getByRole('switch'));
    expect(mockSetAnimationsEnabled).toHaveBeenCalledWith(false);
  });

  it('renders preview workspace and accessibility warnings in the appearance settings flow', () => {
    render(<AppearanceSettings />);

    expect(screen.getAllByText('theme.previewWorkspace').length).toBeGreaterThan(0);
    expect(screen.getByText('theme.accessibilityWarnings')).toBeInTheDocument();
    expect(screen.getByText('theme.warningPairForegroundBackground')).toBeInTheDocument();
  });

  it('exposes custom preset save controls from settings', () => {
    render(<AppearanceSettings />);

    fireEvent.change(screen.getByPlaceholderText('theme.presetNamePlaceholder'), { target: { value: 'Nebula' } });
    fireEvent.click(screen.getByText('theme.savePreset'));

    expect(mockSaveCurrentAsPreset).toHaveBeenCalledWith('Nebula');
  });

  it('renders component style controls and representative previews inside settings', () => {
    render(<AppearanceSettings />);

    expect(screen.getAllByText('theme.componentStylePreset').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewToolbar').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewPanel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme.componentPreviewSection').length).toBeGreaterThan(0);
  });
});
