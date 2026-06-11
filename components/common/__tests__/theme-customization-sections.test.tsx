/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeCustomization, ThemePreset } from '@/lib/stores/theme-store';
import {
  ThemeAnimationsSection,
  ThemeComponentStyleSection,
  ThemeModeSection,
  ThemePaletteEditor,
  ThemePresetSection,
  ThemeRadiusSection,
  ThemeResetButton,
  ThemeTypographySection,
  useThemeCustomizationBindings,
} from '../theme-customization-sections';

const mockSetTheme = jest.fn();
let mockThemeName: 'light' | 'dark' | 'system' | undefined = undefined;
let mockResolvedTheme = 'light';

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

const createCustomization = (): ThemeCustomization => ({
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
    light: {
      primary: '#fafafa',
    },
    dark: {
      primary: '#101010',
    },
  },
});

const mockUserPreset: ThemePreset = {
  id: 'custom-night',
  name: 'Custom Night',
  colors: {
    light: {
      primary: '#123456',
      background: '#ffffff',
    },
    dark: {
      primary: '#abcdef',
      background: '#050505',
    },
  },
};

const mockStoreState = {
  customization: createCustomization(),
  userPresets: [mockUserPreset] as ThemePreset[],
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
  saveCurrentAsPreset: mockSaveCurrentAsPreset,
  duplicatePreset: mockDuplicatePreset,
  renameUserPreset: mockRenameUserPreset,
  saveCurrentToUserPreset: mockSaveCurrentToUserPreset,
  deleteUserPreset: mockDeleteUserPreset,
  resetCustomization: mockResetCustomization,
};

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockThemeName,
    setTheme: mockSetTheme,
    resolvedTheme: mockResolvedTheme,
  }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    className: _className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button type={props.type ?? 'button'} {...props}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    className: _className,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) => (
    <input {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className: _className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    className: _className,
    ...props
  }: {
    value?: number[];
    onValueChange?: (value: number[]) => void;
    className?: string;
  }) => (
    <input
      aria-label="slider"
      type="range"
      value={value?.[0] ?? 0}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      aria-label="switch"
      checked={checked}
      role="switch"
      type="checkbox"
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/toggle-group', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const ToggleGroupContext = React.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});

  return {
    ToggleGroup: ({
      value,
      onValueChange,
      children,
      className: _className,
    }: React.PropsWithChildren<{
      value?: string;
      onValueChange?: (value: string) => void;
      className?: string;
    }>) => (
      <ToggleGroupContext.Provider value={{ value, onValueChange }}>
        <div>{children}</div>
      </ToggleGroupContext.Provider>
    ),
    ToggleGroupItem: ({
      value,
      children,
      className: _className,
      size: _size,
      ...props
    }: React.PropsWithChildren<{
      value: string;
      className?: string;
      size?: string;
    }>) => {
      const context = React.useContext(ToggleGroupContext);

      return (
        <button
          type="button"
          aria-pressed={context.value === value}
          data-state={context.value === value ? 'on' : 'off'}
          onClick={() => context.onValueChange?.(value)}
          {...props}
        >
          {children}
        </button>
      );
    },
  };
});

jest.mock('@/components/ui/select', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const collectItems = (
    node: React.ReactNode,
    items: Array<{ value: string; label: React.ReactNode }> = []
  ) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) {
        return;
      }

      const element = child as React.ReactElement<{
        children?: React.ReactNode;
        value?: string;
      }>;

      if ((element.type as { displayName?: string }).displayName === 'MockSelectItem') {
        items.push({
          value: element.props.value ?? '',
          label: element.props.children,
        });
        return;
      }

      if (element.props.children) {
        collectItems(element.props.children, items);
      }
    });

    return items;
  };

  const Select = ({
    value,
    onValueChange,
    children,
  }: React.PropsWithChildren<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>) => {
    const items = collectItems(children);

    return (
      <select value={value} onChange={(event) => onValueChange?.(event.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectItem = ({ children }: React.PropsWithChildren<{ value: string }>) => <>{children}</>;
  (SelectItem as { displayName?: string }).displayName = 'MockSelectItem';

  return {
    Select,
    SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectItem,
    SelectTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    SelectValue: () => null,
  };
});

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: () => mockStoreState,
  componentStylePresets: ['default', 'observatory', 'floating'],
  componentStyleDensityValues: ['comfortable', 'compact'],
  componentStyleTransparencyValues: ['solid', 'balanced', 'high'],
  componentStyleBorderValues: ['soft', 'medium', 'strong'],
  componentStyleElevationValues: ['flat', 'raised', 'floating'],
  customizableThemeColorKeys: ['primary', 'background'],
  getAvailableThemePresets: (userPresets: typeof mockStoreState.userPresets = []) => [
    {
      id: 'preset1',
      name: 'Preset 1',
      colors: {
        light: {
          primary: '#000000',
          background: '#ffffff',
          foreground: '#101010',
          border: '#cccccc',
          card: '#f4f4f4',
          secondary: '#e8e8e8',
          accent: '#d8d8d8',
          muted: '#f1f1f1',
          destructive: '#ff0000',
        },
        dark: {
          primary: '#ffffff',
          background: '#050505',
          foreground: '#f5f5f5',
          border: '#444444',
          card: '#101010',
          secondary: '#202020',
          accent: '#303030',
          muted: '#181818',
          destructive: '#ff6666',
        },
      },
    },
    ...userPresets,
  ],
  getFontPreview: (font: string) => {
    const previews: Record<string, string> = {
      default: 'Libre Baskerville, serif',
      serif: 'Georgia, serif',
      mono: 'ui-monospace, monospace',
      system: 'system-ui, sans-serif',
    };

    return previews[font] ?? previews.default;
  },
  getPresetThemeColors: (
    customization: typeof mockStoreState.customization,
    mode: 'light' | 'dark',
    userPresets: typeof mockStoreState.userPresets
  ) => {
    const preset = [
      {
        id: 'preset1',
        colors: {
          light: {
            primary: '#000000',
            background: '#ffffff',
          },
          dark: {
            primary: '#ffffff',
            background: '#050505',
          },
        },
      },
      ...userPresets,
    ].find((item) => item.id === customization.activePreset);

    return (
      preset?.colors[mode] ?? {
        primary: mode === 'light' ? '#111111' : '#eeeeee',
        background: mode === 'light' ? '#ffffff' : '#050505',
      }
    );
  },
  getThemeContrastWarnings: (_customization: unknown, mode: 'light' | 'dark') =>
    mode === 'light'
      ? [
          {
            pairId: 'foreground/background',
            mode,
            ratio: 2.1,
            threshold: 4.5,
          },
        ]
      : [],
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
      densityGap: mode === 'light' ? '0.375rem' : '0.25rem',
      densityPadding: mode === 'light' ? '0.375rem' : '0.25rem',
      sectionPadding: mode === 'light' ? '0.75rem' : '0.625rem',
      controlHeight: mode === 'light' ? '2.25rem' : '2rem',
      surfaceBackground: mode === 'light' ? 'rgba(255,255,255,0.84)' : 'rgba(17,17,17,0.72)',
      surfaceStrongBackground: mode === 'light' ? 'rgba(255,255,255,0.90)' : 'rgba(17,17,17,0.80)',
      surfaceBorder: mode === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
      surfaceShadow: mode === 'light' ? '0 12px 28px -16px rgb(15 23 42 / 0.35)' : '0 20px 44px -18px rgb(0 0 0 / 0.4)',
      surfaceBlur: mode === 'light' ? '12px' : '18px',
    },
    componentStyle: mockStoreState.customization.componentStyle,
  }),
  isValidThemeColorValue: (value: string) => /^#[0-9a-f]{6}$/i.test(value),
  cssColorToHex: (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null),
}));

const renderPaletteEditor = () =>
  render(
    <ThemePaletteEditor
      customization={mockStoreState.customization}
      userPresets={mockStoreState.userPresets}
      initialEditingMode="light"
      setCustomColor={mockSetCustomColor}
      clearCustomColor={mockClearCustomColor}
    />
  );

describe('theme-customization-sections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockThemeName = undefined;
    mockResolvedTheme = 'light';
    mockStoreState.customization = createCustomization();
    mockStoreState.userPresets = [mockUserPreset];
  });

  it('binds theme and store state with safe fallbacks', () => {
    const { result } = renderHook(() => useThemeCustomizationBindings());

    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedTheme).toBe('light');
    expect(result.current.customization).toBe(mockStoreState.customization);
    expect(result.current.setTheme).toBe(mockSetTheme);
  });

  it('updates the selected app theme from the mode section', async () => {
    const user = userEvent.setup();

    render(<ThemeModeSection theme="light" setTheme={mockSetTheme} />);

    await user.click(screen.getByText('settingsNew.appearance.dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('renders presets, toggles built-in presets, and hides the label when requested', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ThemePresetSection
        customization={{ ...mockStoreState.customization, activePreset: null }}
        userPresets={mockStoreState.userPresets}
        resolvedTheme="light"
        setActivePreset={mockSetActivePreset}
        saveCurrentAsPreset={mockSaveCurrentAsPreset}
        duplicatePreset={mockDuplicatePreset}
        renameUserPreset={mockRenameUserPreset}
        saveCurrentToUserPreset={mockSaveCurrentToUserPreset}
        deleteUserPreset={mockDeleteUserPreset}
      />
    );

    expect(screen.getByText('theme.colorPresets')).toBeInTheDocument();
    expect(screen.getByText('Preset 1')).toBeInTheDocument();
    expect(screen.getAllByText('theme.customPresets')).toHaveLength(2);

    await user.click(screen.getByText('Preset 1'));
    expect(mockSetActivePreset).toHaveBeenCalledWith('preset1');

    rerender(
      <ThemePresetSection
        customization={{ ...mockStoreState.customization, activePreset: 'preset1' }}
        userPresets={mockStoreState.userPresets}
        resolvedTheme="light"
        setActivePreset={mockSetActivePreset}
        saveCurrentAsPreset={mockSaveCurrentAsPreset}
        duplicatePreset={mockDuplicatePreset}
        renameUserPreset={mockRenameUserPreset}
        saveCurrentToUserPreset={mockSaveCurrentToUserPreset}
        deleteUserPreset={mockDeleteUserPreset}
        showLabel={false}
      />
    );

    await user.click(screen.getByText('Preset 1'));
    expect(mockSetActivePreset).toHaveBeenCalledWith(null);
    expect(screen.queryByText('theme.colorPresets')).not.toBeInTheDocument();
  });

  it('manages custom presets from the preset section', async () => {
    const user = userEvent.setup();

    render(
      <ThemePresetSection
        customization={{ ...mockStoreState.customization, activePreset: 'custom-night' }}
        userPresets={mockStoreState.userPresets}
        resolvedTheme="dark"
        setActivePreset={mockSetActivePreset}
        saveCurrentAsPreset={mockSaveCurrentAsPreset}
        duplicatePreset={mockDuplicatePreset}
        renameUserPreset={mockRenameUserPreset}
        saveCurrentToUserPreset={mockSaveCurrentToUserPreset}
        deleteUserPreset={mockDeleteUserPreset}
      />
    );

    const nameInput = screen.getByPlaceholderText('theme.presetNamePlaceholder');

    expect(nameInput).toHaveValue('Custom Night');

    await user.clear(nameInput);
    await user.type(nameInput, 'Aurora');
    await user.click(screen.getByText('theme.savePreset'));
    await user.click(screen.getByText('theme.duplicatePreset'));
    await user.click(screen.getByText('theme.renamePreset'));
    await user.click(screen.getByText('theme.updatePreset'));
    await user.click(screen.getByText('theme.deletePreset'));

    expect(mockSaveCurrentAsPreset).toHaveBeenCalledWith('Aurora');
    expect(mockDuplicatePreset).toHaveBeenCalledWith('custom-night', 'Aurora');
    expect(mockRenameUserPreset).toHaveBeenCalledWith('custom-night', 'Aurora');
    expect(mockSaveCurrentToUserPreset).toHaveBeenCalledWith('custom-night');
    expect(mockDeleteUserPreset).toHaveBeenCalledWith('custom-night');
  });

  it('edits palette colors, validates bad values, and switches preview modes', async () => {
    const user = userEvent.setup();

    renderPaletteEditor();

    const inputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');

    expect(inputs[0]).toHaveValue('#fafafa');

    fireEvent.blur(inputs[1]);
    expect(mockSetCustomColor).not.toHaveBeenCalled();
    expect(mockClearCustomColor).not.toHaveBeenCalled();

    await user.clear(inputs[0]);
    fireEvent.blur(inputs[0]);
    expect(mockClearCustomColor).toHaveBeenCalledWith('light', 'primary');

    await user.type(inputs[0], 'invalid');
    fireEvent.blur(inputs[0]);
    expect(mockSetCustomColor).not.toHaveBeenCalled();
    expect(screen.getByText('theme.invalidColor')).toBeInTheDocument();

    await user.clear(inputs[0]);
    await user.type(inputs[0], '#123456');
    fireEvent.blur(inputs[0]);
    expect(mockSetCustomColor).toHaveBeenCalledWith('light', 'primary', '#123456');

    await user.click(screen.getAllByRole('button', { name: 'theme.clearColor' })[0]);
    expect(mockClearCustomColor).toHaveBeenLastCalledWith('light', 'primary');

    await user.click(screen.getByText('settingsNew.appearance.dark'));
    const darkInputs = screen.getAllByPlaceholderText('theme.colorValuePlaceholder');
    await user.clear(darkInputs[0]);
    await user.type(darkInputs[0], '#654321');
    fireEvent.blur(darkInputs[0]);
    expect(mockSetCustomColor).toHaveBeenCalledWith('dark', 'primary', '#654321');

    expect(screen.getByText('theme.warningPairForegroundBackground')).toBeInTheDocument();
    await user.click(screen.getByText('theme.previewDark'));
    expect(screen.getByText('theme.noAccessibilityWarnings')).toBeInTheDocument();
  });

  it('commits a hex color chosen from the native color picker', () => {
    renderPaletteEditor();

    const pickers = screen.getAllByLabelText('theme.pickColor');
    fireEvent.change(pickers[0], { target: { value: '#abcdef' } });

    expect(mockSetCustomColor).toHaveBeenCalledWith('light', 'primary', '#abcdef');
  });

  it('updates radius and animation settings from simple control sections', async () => {
    const user = userEvent.setup();

    render(
      <>
        <ThemeRadiusSection
          radius={0.5}
          setRadius={mockSetRadius}
          label="theme.borderRadius"
          previewText="theme.preview"
          squareText="theme.square"
          roundedText="theme.rounded"
        />
        <ThemeAnimationsSection
          animationsEnabled={true}
          setAnimationsEnabled={mockSetAnimationsEnabled}
          description="theme.animationsDescription"
        />
      </>
    );

    fireEvent.change(screen.getByLabelText('slider'), { target: { value: '0.8' } });
    await user.click(screen.getByRole('switch'));

    expect(mockSetRadius).toHaveBeenCalledWith(0.8);
    expect(mockSetAnimationsEnabled).toHaveBeenCalledWith(false);
    expect(screen.getByText('0.50rem')).toBeInTheDocument();
  });

  it('renders component style controls and representative shell previews', async () => {
    const user = userEvent.setup();

    render(
      <ThemeComponentStyleSection
        customization={mockStoreState.customization}
        userPresets={mockStoreState.userPresets}
        initialPreviewMode="light"
        setComponentStylePreset={mockSetComponentStylePreset}
        setComponentStyleDensity={mockSetComponentStyleDensity}
        setComponentStyleTransparency={mockSetComponentStyleTransparency}
        setComponentStyleBorder={mockSetComponentStyleBorder}
        setComponentStyleElevation={mockSetComponentStyleElevation}
      />
    );

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'floating');
    await user.selectOptions(selects[1], 'compact');
    await user.selectOptions(selects[2], 'high');
    await user.selectOptions(selects[3], 'strong');
    await user.selectOptions(selects[4], 'flat');

    expect(mockSetComponentStylePreset).toHaveBeenCalledWith('floating');
    expect(mockSetComponentStyleDensity).toHaveBeenCalledWith('compact');
    expect(mockSetComponentStyleTransparency).toHaveBeenCalledWith('high');
    expect(mockSetComponentStyleBorder).toHaveBeenCalledWith('strong');
    expect(mockSetComponentStyleElevation).toHaveBeenCalledWith('flat');
    expect(screen.getByText('theme.componentPreviewToolbar')).toBeInTheDocument();
    expect(screen.getByText('theme.componentPreviewPanel')).toBeInTheDocument();
    expect(screen.getByText('theme.componentPreviewSection')).toBeInTheDocument();
  });

  it('updates font family and font size from the typography section', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTypographySection
        customization={mockStoreState.customization}
        setFontFamily={mockSetFontFamily}
        setFontSize={mockSetFontSize}
        fontFamilyLabel="theme.fontFamily"
        fontSizeLabel="theme.fontSize"
      />
    );

    const selects = screen.getAllByRole('combobox');

    expect(screen.getByText('theme.fontPreviewText')).toHaveStyle({
      fontFamily: 'Libre Baskerville, serif',
    });

    await user.selectOptions(selects[0], 'serif');
    await user.selectOptions(selects[1], 'large');

    expect(mockSetFontFamily).toHaveBeenCalledWith('serif');
    expect(mockSetFontSize).toHaveBeenCalledWith('large');
  });

  it('invokes reset handlers from the reset button section', async () => {
    const user = userEvent.setup();

    render(<ThemeResetButton onReset={mockResetCustomization} />);

    await user.click(screen.getByText('common.reset'));

    expect(mockResetCustomization).toHaveBeenCalledTimes(1);
  });
});
