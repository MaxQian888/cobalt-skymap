'use client';

import { useState, type CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, Copy, Download, Layers3, Monitor, Moon, RotateCcw, Save, Sun, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
  componentStyleBorderValues,
  componentStyleElevationValues,
  componentStylePresets,
  componentStyleTransparencyValues,
  componentStyleDensityValues,
  cssColorToHex,
  getComponentStylePreviewData,
  customizableThemeColorKeys,
  getAvailableThemePresets,
  getFontPreview,
  getPresetThemeColors,
  getThemeContrastWarnings,
  getThemePreviewData,
  isValidThemeColorValue,
  letterSpacingValues,
  lineHeightValues,
  themeUiScaleValues,
  type ThemeColors,
  type ThemeCustomization,
  type ThemeMode,
  type ThemePreset,
  useThemeStore,
} from '@/lib/stores/theme-store';

type ThemeName = 'light' | 'dark' | 'system';

type DraftState = Record<ThemeMode, Partial<Record<keyof ThemeColors, string>>>;

const warningLabelKeys: Record<string, string> = {
  'foreground/background': 'theme.warningPairForegroundBackground',
  'foreground/card': 'theme.warningPairForegroundCard',
  'foreground/muted': 'theme.warningPairForegroundMuted',
};

function removeDraftValue(
  current: DraftState,
  mode: ThemeMode,
  key: keyof ThemeColors,
): DraftState {
  const nextModeDrafts = { ...current[mode] };
  delete nextModeDrafts[key];

  return {
    ...current,
    [mode]: nextModeDrafts,
  };
}

function removeInvalidKey(
  current: DraftState,
  mode: ThemeMode,
  key: keyof ThemeColors,
): DraftState {
  const nextModeInvalid = { ...current[mode] };
  delete nextModeInvalid[key];

  return {
    ...current,
    [mode]: nextModeInvalid,
  };
}

export function useThemeCustomizationBindings() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // NOTE: intentionally a whole-store read. This bindings hook consumes both
  // reactive fields the theme store exposes (`customization` + `userPresets`),
  // which together are essentially its entire reactive surface — per-field
  // selectors would yield no re-render reduction here, only churn. (Audit #5
  // does not apply to this hook.)
  const {
    customization,
    userPresets,
    setComponentStylePreset,
    setComponentStyleDensity,
    setComponentStyleTransparency,
    setComponentStyleBorder,
    setComponentStyleElevation,
    setRadius,
    setFontFamily,
    setFontSize,
    setUiScale,
    setScrollbarAccent,
    setLetterSpacing,
    setLineHeight,
    setAnimationsEnabled,
    setActivePreset,
    setCustomColor,
    clearCustomColor,
    saveCurrentAsPreset,
    duplicatePreset,
    renameUserPreset,
    saveCurrentToUserPreset,
    deleteUserPreset,
    resetCustomization,
    exportTheme,
    importTheme,
  } = useThemeStore();

  return {
    theme: (theme ?? 'system') as ThemeName,
    setTheme,
    resolvedTheme: (resolvedTheme === 'dark' ? 'dark' : 'light') as ThemeMode,
    customization,
    userPresets,
    setComponentStylePreset,
    setComponentStyleDensity,
    setComponentStyleTransparency,
    setComponentStyleBorder,
    setComponentStyleElevation,
    setRadius,
    setFontFamily,
    setFontSize,
    setUiScale,
    setScrollbarAccent,
    setLetterSpacing,
    setLineHeight,
    setAnimationsEnabled,
    setActivePreset,
    setCustomColor,
    clearCustomColor,
    saveCurrentAsPreset,
    duplicatePreset,
    renameUserPreset,
    saveCurrentToUserPreset,
    deleteUserPreset,
    resetCustomization,
    exportTheme,
    importTheme,
  };
}

interface ThemeModeSectionProps {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

export function ThemeModeSection({ theme, setTheme }: ThemeModeSectionProps) {
  const t = useTranslations();

  return (
    <div className="space-y-3">
      <Label>{t('settingsNew.appearance.themeMode')}</Label>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) => {
          if (value === 'light' || value === 'dark' || value === 'system') {
            setTheme(value);
          }
        }}
        className="grid w-full grid-cols-3 gap-1.5 sm:gap-2"
      >
        <ToggleGroupItem
          value="light"
          className="flex-col gap-0.5 sm:gap-1 h-auto py-2 sm:py-3 px-1 sm:px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="text-[10px] sm:text-xs">{t('settingsNew.appearance.light')}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          className="flex-col gap-0.5 sm:gap-1 h-auto py-2 sm:py-3 px-1 sm:px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="text-[10px] sm:text-xs">{t('settingsNew.appearance.dark')}</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="system"
          className="flex-col gap-0.5 sm:gap-1 h-auto py-2 sm:py-3 px-1 sm:px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <Monitor className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="text-[10px] sm:text-xs">{t('settingsNew.appearance.system')}</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

interface ThemePresetSectionProps {
  customization: ThemeCustomization;
  userPresets: ThemePreset[];
  resolvedTheme: ThemeMode;
  setActivePreset: (presetId: string | null) => void;
  saveCurrentAsPreset: (name: string) => string | null;
  duplicatePreset: (presetId: string, name: string) => string | null;
  renameUserPreset: (presetId: string, name: string) => void;
  saveCurrentToUserPreset: (presetId: string) => void;
  deleteUserPreset: (presetId: string) => void;
  showLabel?: boolean;
}

export function ThemePresetSection({
  customization,
  userPresets,
  resolvedTheme,
  setActivePreset,
  saveCurrentAsPreset,
  duplicatePreset,
  renameUserPreset,
  saveCurrentToUserPreset,
  deleteUserPreset,
  showLabel = true,
}: ThemePresetSectionProps) {
  const t = useTranslations();
  const availablePresets = getAvailableThemePresets(userPresets);
  const activePreset = availablePresets.find((preset) => preset.id === customization.activePreset) ?? null;
  const activeCustomPreset = userPresets.find((preset) => preset.id === customization.activePreset) ?? null;
  const [draftName, setDraftName] = useState(activeCustomPreset?.name ?? '');

  const normalizedName = draftName.trim();

  return (
    <div className="space-y-4">
      {showLabel ? <Label>{t('theme.colorPresets')}</Label> : null}

      {userPresets.length > 0 ? <p className="text-xs text-muted-foreground">{t('theme.customPresets')}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {availablePresets.map((preset) => {
          const colors = resolvedTheme === 'dark' ? preset.colors.dark : preset.colors.light;
          const isActive = customization.activePreset === preset.id;
          const isCustom = userPresets.some((item) => item.id === preset.id);

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setActivePreset(isActive ? null : preset.id);
                if (isCustom) {
                  setDraftName(preset.name);
                }
              }}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-lg border-2 p-3 transition-all hover:bg-accent/50',
                isActive ? 'border-primary bg-accent/30' : 'border-border',
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  <div className="h-4 w-4 rounded-full border border-background" style={{ background: colors.primary }} />
                  <div className="h-4 w-4 rounded-full border border-background" style={{ background: colors.secondary }} />
                  <div className="h-4 w-4 rounded-full border border-background" style={{ background: colors.accent }} />
                </div>
                <span className="text-sm font-medium">{preset.name}</span>
              </div>
              {isCustom ? <span className="text-[11px] text-muted-foreground">{t('theme.customPresets')}</span> : null}
              {isActive ? (
                <div className="absolute right-2 top-2">
                  <Check className="h-4 w-4 text-primary" />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 p-3">
        <Input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder={t('theme.presetNamePlaceholder')}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => {
              if (normalizedName) {
                saveCurrentAsPreset(normalizedName);
              }
            }}
            disabled={!normalizedName}
          >
            <Save className="h-4 w-4" />
            {t('theme.savePreset')}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (activePreset && normalizedName) {
                duplicatePreset(activePreset.id, normalizedName);
              }
            }}
            disabled={!activePreset || !normalizedName}
          >
            <Copy className="h-4 w-4" />
            {t('theme.duplicatePreset')}
          </Button>

          {activeCustomPreset ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (normalizedName) {
                    renameUserPreset(activeCustomPreset.id, normalizedName);
                  }
                }}
                disabled={!normalizedName}
              >
                {t('theme.renamePreset')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => saveCurrentToUserPreset(activeCustomPreset.id)}
              >
                {t('theme.updatePreset')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => deleteUserPreset(activeCustomPreset.id)}
              >
                <Trash2 className="h-4 w-4" />
                {t('theme.deletePreset')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface ThemeShareSectionProps {
  exportTheme: () => string;
  importTheme: (raw: string) => boolean;
}

export function ThemeShareSection({ exportTheme, importTheme }: ThemeShareSectionProps) {
  const t = useTranslations();
  const [importValue, setImportValue] = useState('');
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    const json = exportTheme();
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(json);
        setCopied(true);
        return;
      } catch {
        // Clipboard write blocked — fall through to manual-copy fallback.
      }
    }
    // No clipboard access: drop the JSON into the import box so it can be copied by hand.
    setImportValue(json);
  };

  const handleImport = () => {
    const ok = importTheme(importValue.trim());
    setImportStatus(ok ? 'success' : 'error');
    if (ok) {
      setImportValue('');
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <Label>{t('theme.shareTheme')}</Label>
        <p className="text-xs text-muted-foreground">{t('theme.shareDescription')}</p>
      </div>

      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleExport}>
        <Download className="h-4 w-4" />
        {copied ? t('theme.exportCopied') : t('theme.exportTheme')}
      </Button>

      <textarea
        value={importValue}
        onChange={(event) => {
          setImportValue(event.target.value);
          setImportStatus('idle');
        }}
        placeholder={t('theme.importPlaceholder')}
        rows={3}
        className={cn(
          'w-full resize-y rounded-md border border-border/70 bg-background p-2 font-mono text-xs',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          importStatus === 'error' && 'border-destructive',
        )}
        aria-invalid={importStatus === 'error'}
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={handleImport}
          disabled={!importValue.trim()}
        >
          <Upload className="h-4 w-4" />
          {t('theme.importTheme')}
        </Button>
        {importStatus === 'error' ? (
          <span className="text-xs text-destructive">{t('theme.importInvalid')}</span>
        ) : null}
        {importStatus === 'success' ? (
          <span className="text-xs text-muted-foreground">{t('theme.importSuccess')}</span>
        ) : null}
      </div>
    </div>
  );
}

interface ThemePaletteEditorProps {
  customization: ThemeCustomization;
  userPresets: ThemePreset[];
  initialEditingMode: ThemeMode;
  setCustomColor: (mode: ThemeMode, key: keyof ThemeColors, value: string) => void;
  clearCustomColor: (mode: ThemeMode, key: keyof ThemeColors) => void;
}

export function ThemePaletteEditor({
  customization,
  userPresets,
  initialEditingMode,
  setCustomColor,
  clearCustomColor,
}: ThemePaletteEditorProps) {
  const t = useTranslations();
  const [editingMode, setEditingMode] = useState<ThemeMode>(initialEditingMode);
  const [previewMode, setPreviewMode] = useState<ThemeMode>(initialEditingMode);
  const [drafts, setDrafts] = useState<DraftState>({ light: {}, dark: {} });
  const [invalidKeys, setInvalidKeys] = useState<DraftState>({ light: {}, dark: {} });

  const presetColors = getPresetThemeColors(customization, editingMode, userPresets);
  const modeCustomColors = customization.customColors[editingMode];
  const preview = getThemePreviewData(customization, previewMode, userPresets);
  const warnings = getThemeContrastWarnings(customization, previewMode, userPresets);

  const getCurrentInputValue = (key: keyof ThemeColors): string => (
    drafts[editingMode][key] ?? modeCustomColors[key] ?? presetColors[key] ?? ''
  );

  const updateDraft = (key: keyof ThemeColors, value: string) => {
    setDrafts((current) => ({
      ...current,
      [editingMode]: {
        ...current[editingMode],
        [key]: value,
      },
    }));
    setInvalidKeys((current) => removeInvalidKey(current, editingMode, key));
  };

  const commitColor = (key: keyof ThemeColors) => {
    if (!Object.prototype.hasOwnProperty.call(drafts[editingMode], key)) {
      return;
    }

    const rawValue = (drafts[editingMode][key] ?? '').trim();

    if (!rawValue) {
      clearCustomColor(editingMode, key);
      setDrafts((current) => removeDraftValue(current, editingMode, key));
      setInvalidKeys((current) => removeInvalidKey(current, editingMode, key));
      return;
    }

    if (!isValidThemeColorValue(rawValue)) {
      setInvalidKeys((current) => ({
        ...current,
        [editingMode]: {
          ...current[editingMode],
          [key]: rawValue,
        },
      }));
      return;
    }

    setCustomColor(editingMode, key, rawValue);
    setDrafts((current) => removeDraftValue(current, editingMode, key));
    setInvalidKeys((current) => removeInvalidKey(current, editingMode, key));
  };

  const clearColor = (key: keyof ThemeColors) => {
    clearCustomColor(editingMode, key);
    setDrafts((current) => removeDraftValue(current, editingMode, key));
    setInvalidKeys((current) => removeInvalidKey(current, editingMode, key));
  };

  const applyPickedColor = (key: keyof ThemeColors, value: string) => {
    setCustomColor(editingMode, key, value);
    setDrafts((current) => removeDraftValue(current, editingMode, key));
    setInvalidKeys((current) => removeInvalidKey(current, editingMode, key));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>{t('settingsNew.appearance.colorMode')}</Label>
        <ToggleGroup
          type="single"
          value={editingMode}
          onValueChange={(value) => {
            if (value === 'light' || value === 'dark') {
              setEditingMode(value);
            }
          }}
          className="gap-1"
        >
          <ToggleGroupItem
            value="light"
            size="sm"
            className="h-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Sun className="h-3 w-3 mr-1" />
            {t('settingsNew.appearance.light')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="dark"
            size="sm"
            className="h-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Moon className="h-3 w-3 mr-1" />
            {t('settingsNew.appearance.dark')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <p className="text-xs text-muted-foreground">{t('theme.customOverridesPreset')}</p>

      <div className="space-y-2">
        {customizableThemeColorKeys.map((key) => {
          const previewColor = modeCustomColors[key] ?? presetColors[key] ?? `var(--${key})`;
          const value = getCurrentInputValue(key);
          const isInvalid = Boolean(invalidKeys[editingMode][key]);
          const swatchHex = cssColorToHex(value || previewColor) ?? '#000000';

          return (
            <div key={key} className="rounded-md border border-border/70 p-2">
              <div className="flex items-center gap-2">
                <label
                  className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded border border-border"
                  style={{ background: previewColor }}
                  title={t('theme.pickColor', { name: t(`theme.${key}`) })}
                >
                  <input
                    type="color"
                    value={swatchHex}
                    onChange={(event) => applyPickedColor(key, event.target.value)}
                    aria-label={t('theme.pickColor', { name: t(`theme.${key}`) })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <Label className="w-24 shrink-0 text-xs capitalize">{t(`theme.${key}`)}</Label>
                <Input
                  value={value}
                  onChange={(event) => updateDraft(key, event.target.value)}
                  onBlur={() => commitColor(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder={t('theme.colorValuePlaceholder')}
                  aria-invalid={isInvalid}
                  className="h-8 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => clearColor(key)}
                  disabled={!modeCustomColors[key]}
                >
                  {t('theme.clearColor')}
                </Button>
              </div>
              {isInvalid ? <p className="mt-1 text-[11px] text-destructive">{t('theme.invalidColor')}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label>{t('theme.previewWorkspace')}</Label>
          <ToggleGroup
            type="single"
            value={previewMode}
            onValueChange={(value) => {
              if (value === 'light' || value === 'dark') {
                setPreviewMode(value);
              }
            }}
            className="gap-1"
          >
            <ToggleGroupItem value="light" size="sm" className="h-7 px-2 text-xs">
              {t('theme.previewLight')}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" size="sm" className="h-7 px-2 text-xs">
              {t('theme.previewDark')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div
          className="rounded-lg border p-3 space-y-3"
          style={{
            background: preview.tokens.background,
            color: preview.tokens.foreground,
            borderColor: preview.tokens.border,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t('theme.previewWorkspace')}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: preview.tokens.accent, color: preview.tokens.background }}
            >
              {preview.mode === 'light' ? t('theme.previewLight') : t('theme.previewDark')}
            </span>
          </div>
          <div
            className="rounded-md border p-3 space-y-2"
            style={{
              background: preview.tokens.card,
              color: preview.tokens.foreground,
              borderColor: preview.tokens.border,
            }}
          >
            <div className="text-sm font-medium">{t('theme.preview')}</div>
            <div className="flex flex-wrap gap-2">
              <span
                className="rounded-md px-3 py-1 text-xs"
                style={{ background: preview.tokens.primary, color: preview.tokens.background }}
              >
                Primary
              </span>
              <span
                className="rounded-md px-3 py-1 text-xs"
                style={{ background: preview.tokens.secondary, color: preview.tokens.foreground }}
              >
                Secondary
              </span>
              <span
                className="rounded-md px-3 py-1 text-xs"
                style={{ background: preview.tokens.muted, color: preview.tokens.foreground }}
              >
                Muted
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <Label>{t('theme.accessibilityWarnings')}</Label>
          </div>
          {warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('theme.noAccessibilityWarnings')}</p>
          ) : (
            warnings.map((warning) => (
              <div key={`${warning.pairId}-${warning.mode}`} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <div className="text-sm font-medium">{t(warningLabelKeys[warning.pairId] ?? 'theme.accessibilityWarnings')}</div>
                <div className="text-xs text-muted-foreground">
                  {warning.ratio.toFixed(1)} / {warning.threshold.toFixed(1)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ThemeComponentStyleSectionProps {
  customization: ThemeCustomization;
  userPresets: ThemePreset[];
  initialPreviewMode: ThemeMode;
  setComponentStylePreset: (preset: ThemeCustomization['componentStyle']['preset']) => void;
  setComponentStyleDensity: (density: ThemeCustomization['componentStyle']['density']) => void;
  setComponentStyleTransparency: (transparency: ThemeCustomization['componentStyle']['transparency']) => void;
  setComponentStyleBorder: (border: ThemeCustomization['componentStyle']['border']) => void;
  setComponentStyleElevation: (elevation: ThemeCustomization['componentStyle']['elevation']) => void;
  setScrollbarAccent: (color: string | null) => void;
}

function buildPreviewThemeVars(preview: ReturnType<typeof getComponentStylePreviewData>): CSSProperties {
  return {
    '--background': preview.themeTokens.background,
    '--foreground': preview.themeTokens.foreground,
    '--card': preview.themeTokens.card,
    '--border': preview.themeTokens.border,
    '--primary': preview.themeTokens.primary,
    '--secondary': preview.themeTokens.secondary,
    '--accent': preview.themeTokens.accent,
    '--muted': preview.themeTokens.muted,
    '--destructive': preview.themeTokens.destructive,
  } as CSSProperties;
}

function buildSurfaceStyle(preview: ReturnType<typeof getComponentStylePreviewData>): CSSProperties {
  return {
    background: preview.surfaceTokens.surfaceBackground,
    borderColor: preview.surfaceTokens.surfaceBorder,
    boxShadow: preview.surfaceTokens.surfaceShadow,
    backdropFilter: `blur(${preview.surfaceTokens.surfaceBlur})`,
    WebkitBackdropFilter: `blur(${preview.surfaceTokens.surfaceBlur})`,
    color: preview.themeTokens.foreground,
  };
}

export function ThemeComponentStyleSection({
  customization,
  userPresets,
  initialPreviewMode,
  setComponentStylePreset,
  setComponentStyleDensity,
  setComponentStyleTransparency,
  setComponentStyleBorder,
  setComponentStyleElevation,
  setScrollbarAccent,
}: ThemeComponentStyleSectionProps) {
  const t = useTranslations();
  const [previewMode, setPreviewMode] = useState<ThemeMode>(initialPreviewMode);
  const scrollbarAccentHex = customization.scrollbarAccent
    ? cssColorToHex(customization.scrollbarAccent) ?? '#38bdf8'
    : '#38bdf8';
  const preview = getComponentStylePreviewData(customization, previewMode, userPresets);
  const previewThemeVars = buildPreviewThemeVars(preview);
  const baseSurfaceStyle = buildSurfaceStyle(preview);

  return (
    <div className="space-y-4">
      <Label>{t('theme.componentStyle')}</Label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('theme.componentStylePreset')}</Label>
          <Select
            value={customization.componentStyle.preset}
            onValueChange={(value) => setComponentStylePreset(value as ThemeCustomization['componentStyle']['preset'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {componentStylePresets.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`theme.componentPreset${preset[0].toUpperCase()}${preset.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('theme.componentDensity')}</Label>
          <Select
            value={customization.componentStyle.density}
            onValueChange={(value) => setComponentStyleDensity(value as ThemeCustomization['componentStyle']['density'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {componentStyleDensityValues.map((density) => (
                <SelectItem key={density} value={density}>
                  {t(`theme.componentDensity${density[0].toUpperCase()}${density.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('theme.componentTransparency')}</Label>
          <Select
            value={customization.componentStyle.transparency}
            onValueChange={(value) => setComponentStyleTransparency(value as ThemeCustomization['componentStyle']['transparency'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {componentStyleTransparencyValues.map((transparency) => (
                <SelectItem key={transparency} value={transparency}>
                  {t(`theme.componentTransparency${transparency[0].toUpperCase()}${transparency.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('theme.componentBorder')}</Label>
          <Select
            value={customization.componentStyle.border}
            onValueChange={(value) => setComponentStyleBorder(value as ThemeCustomization['componentStyle']['border'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {componentStyleBorderValues.map((border) => (
                <SelectItem key={border} value={border}>
                  {t(`theme.componentBorder${border[0].toUpperCase()}${border.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t('theme.componentElevation')}</Label>
          <Select
            value={customization.componentStyle.elevation}
            onValueChange={(value) => setComponentStyleElevation(value as ThemeCustomization['componentStyle']['elevation'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {componentStyleElevationValues.map((elevation) => (
                <SelectItem key={elevation} value={elevation}>
                  {t(`theme.componentElevation${elevation[0].toUpperCase()}${elevation.slice(1)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label>{t('theme.scrollbarAccent')}</Label>
          <div className="flex items-center gap-2">
            <label
              className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded border border-border"
              style={{ background: customization.scrollbarAccent ?? 'var(--scrollbar-thumb)' }}
              title={t('theme.scrollbarAccent')}
            >
              <input
                type="color"
                value={scrollbarAccentHex}
                onChange={(event) => setScrollbarAccent(event.target.value)}
                aria-label={t('theme.scrollbarAccent')}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <Input
              value={customization.scrollbarAccent ?? ''}
              onChange={(event) => setScrollbarAccent(event.target.value.trim() ? event.target.value : null)}
              placeholder={t('theme.scrollbarAccentAuto')}
              className="h-8 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setScrollbarAccent(null)}
              disabled={!customization.scrollbarAccent}
            >
              {t('theme.clearColor')}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('theme.scrollbarAccentDescription')}</p>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-primary" />
            <Label>{t('theme.componentStyle')}</Label>
          </div>
          <ToggleGroup
            type="single"
            value={previewMode}
            onValueChange={(value) => {
              if (value === 'light' || value === 'dark') {
                setPreviewMode(value);
              }
            }}
            className="gap-1"
          >
            <ToggleGroupItem value="light" size="sm" className="h-7 px-2 text-xs">
              {t('theme.previewLight')}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" size="sm" className="h-7 px-2 text-xs">
              {t('theme.previewDark')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div
          className="space-y-3 rounded-lg border p-3"
          style={{
            ...previewThemeVars,
            background: preview.themeTokens.background,
            borderColor: preview.themeTokens.border,
            color: preview.themeTokens.foreground,
          }}
        >
          <div
            className="flex items-center justify-between rounded-lg border"
            style={{
              ...baseSurfaceStyle,
              padding: preview.surfaceTokens.densityPadding,
              gap: preview.surfaceTokens.densityGap,
            }}
          >
            <span className="text-sm font-medium">{t('theme.componentPreviewToolbar')}</span>
            <div className="flex items-center" style={{ gap: preview.surfaceTokens.densityGap }}>
              <span
                className="rounded-md border px-3 text-xs"
                style={{
                  ...baseSurfaceStyle,
                  background: preview.surfaceTokens.surfaceStrongBackground,
                  minHeight: preview.surfaceTokens.controlHeight,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {t('theme.preview')}
              </span>
              <span
                className="rounded-md border px-3 text-xs"
                style={{
                  ...baseSurfaceStyle,
                  background: preview.surfaceTokens.surfaceStrongBackground,
                  minHeight: preview.surfaceTokens.controlHeight,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {t('theme.componentStylePreset')}
              </span>
            </div>
          </div>

          <div
            className="rounded-lg border"
            style={{
              ...baseSurfaceStyle,
              padding: preview.surfaceTokens.sectionPadding,
            }}
          >
            <div className="text-sm font-medium">{t('theme.componentPreviewPanel')}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t('theme.customizeDescription')}</p>
          </div>

          <div
            className="rounded-lg border"
            style={{
              ...baseSurfaceStyle,
              padding: preview.surfaceTokens.sectionPadding,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('theme.componentPreviewSection')}</span>
              <span
                className="rounded-md border px-3 text-xs"
                style={{
                  ...baseSurfaceStyle,
                  background: preview.surfaceTokens.surfaceStrongBackground,
                  minHeight: preview.surfaceTokens.controlHeight,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                {preview.componentStyle.density}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThemeRadiusSectionProps {
  radius: number;
  setRadius: (radius: number) => void;
  label: string;
  previewText: string;
  squareText: string;
  roundedText: string;
}

export function ThemeRadiusSection({
  radius,
  setRadius,
  label,
  previewText,
  squareText,
  roundedText,
}: ThemeRadiusSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">{radius.toFixed(2)}rem</span>
      </div>
      <Slider
        value={[radius]}
        onValueChange={([value]) => setRadius(value)}
        min={0}
        max={1}
        step={0.05}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{squareText}</span>
        <span>{roundedText}</span>
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-10 w-10 bg-primary" style={{ borderRadius: `${radius}rem` }} />
        <div
          className="h-10 flex-1 bg-muted border-2 border-border flex items-center justify-center text-xs"
          style={{ borderRadius: `${radius}rem` }}
        >
          {previewText}
        </div>
      </div>
    </div>
  );
}

interface ThemeAnimationsSectionProps {
  animationsEnabled: boolean;
  setAnimationsEnabled: (enabled: boolean) => void;
  description: string;
}

export function ThemeAnimationsSection({
  animationsEnabled,
  setAnimationsEnabled,
  description,
}: ThemeAnimationsSectionProps) {
  const t = useTranslations();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label>{t('theme.animations')}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={animationsEnabled} onCheckedChange={setAnimationsEnabled} />
    </div>
  );
}

interface ThemeTypographySectionProps {
  customization: ThemeCustomization;
  setFontFamily: (font: ThemeCustomization['fontFamily']) => void;
  setFontSize: (size: ThemeCustomization['fontSize']) => void;
  setUiScale: (scale: ThemeCustomization['uiScale']) => void;
  setLetterSpacing: (spacing: ThemeCustomization['letterSpacing']) => void;
  setLineHeight: (lineHeight: ThemeCustomization['lineHeight']) => void;
  fontFamilyLabel: string;
  fontSizeLabel: string;
}

const titleCase = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`;

export function ThemeTypographySection({
  customization,
  setFontFamily,
  setFontSize,
  setUiScale,
  setLetterSpacing,
  setLineHeight,
  fontFamilyLabel,
  fontSizeLabel,
}: ThemeTypographySectionProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label>{fontFamilyLabel}</Label>
        <Select
          value={customization.fontFamily}
          onValueChange={(value) => setFontFamily(value as ThemeCustomization['fontFamily'])}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('theme.fontDefault')}</SelectItem>
            <SelectItem value="serif">{t('theme.fontSerif')}</SelectItem>
            <SelectItem value="mono">{t('theme.fontMono')}</SelectItem>
            <SelectItem value="system">{t('theme.fontSystem')}</SelectItem>
          </SelectContent>
        </Select>
        <p
          className="text-sm text-muted-foreground"
          style={{
            fontFamily: getFontPreview(customization.fontFamily),
            letterSpacing: customization.letterSpacing === 'tight' ? '-0.01em' : customization.letterSpacing === 'wide' ? '0.04em' : undefined,
          }}
        >
          {t('theme.fontPreviewText')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3">
          <Label>{fontSizeLabel}</Label>
          <Select
            value={customization.fontSize}
            onValueChange={(value) => setFontSize(value as ThemeCustomization['fontSize'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">{t('theme.fontSizeSmall')}</SelectItem>
              <SelectItem value="default">{t('theme.fontSizeDefault')}</SelectItem>
              <SelectItem value="large">{t('theme.fontSizeLarge')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>{t('theme.uiScale')}</Label>
          <Select
            value={customization.uiScale}
            onValueChange={(value) => setUiScale(value as ThemeCustomization['uiScale'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themeUiScaleValues.map((scale) => (
                <SelectItem key={scale} value={scale}>
                  {t(`theme.uiScale${titleCase(scale)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{t('theme.uiScaleDescription')}</p>
        </div>

        <div className="space-y-3">
          <Label>{t('theme.letterSpacing')}</Label>
          <Select
            value={customization.letterSpacing}
            onValueChange={(value) => setLetterSpacing(value as ThemeCustomization['letterSpacing'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {letterSpacingValues.map((spacing) => (
                <SelectItem key={spacing} value={spacing}>
                  {t(`theme.letterSpacing${titleCase(spacing)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>{t('theme.lineHeight')}</Label>
          <Select
            value={customization.lineHeight}
            onValueChange={(value) => setLineHeight(value as ThemeCustomization['lineHeight'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lineHeightValues.map((lineHeight) => (
                <SelectItem key={lineHeight} value={lineHeight}>
                  {t(`theme.lineHeight${titleCase(lineHeight)}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

interface ThemeResetButtonProps {
  onReset: () => void;
}

export function ThemeResetButton({ onReset }: ThemeResetButtonProps) {
  const t = useTranslations();

  return (
    <Button variant="outline" size="sm" onClick={onReset} className="gap-2">
      <RotateCcw className="h-4 w-4" />
      {t('common.reset')}
    </Button>
  );
}
