'use client';

import { useTranslations } from 'next-intl';
import { Circle, Paintbrush, Palette, Type, WandSparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
} from '@/components/common/theme-customization-sections';
import { SettingsSection } from './settings-shared';

export function AppearanceSettings() {
  const t = useTranslations();
  const {
    theme,
    setTheme,
    resolvedTheme,
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
  } = useThemeCustomizationBindings();

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('settingsNew.appearance.themeMode')}
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={true}
      >
        <ThemeModeSection theme={theme} setTheme={setTheme} />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('settingsNew.appearance.colorPresets')}
        icon={<Paintbrush className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemePresetSection
          customization={customization}
          userPresets={userPresets}
          resolvedTheme={resolvedTheme}
          setActivePreset={setActivePreset}
          saveCurrentAsPreset={saveCurrentAsPreset}
          duplicatePreset={duplicatePreset}
          renameUserPreset={renameUserPreset}
          saveCurrentToUserPreset={saveCurrentToUserPreset}
          deleteUserPreset={deleteUserPreset}
          showLabel={false}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('settingsNew.appearance.colors')}
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemePaletteEditor
          customization={customization}
          userPresets={userPresets}
          initialEditingMode={resolvedTheme}
          setCustomColor={setCustomColor}
          clearCustomColor={clearCustomColor}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('theme.componentStyle')}
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemeComponentStyleSection
          customization={customization}
          userPresets={userPresets}
          initialPreviewMode={resolvedTheme}
          setComponentStylePreset={setComponentStylePreset}
          setComponentStyleDensity={setComponentStyleDensity}
          setComponentStyleTransparency={setComponentStyleTransparency}
          setComponentStyleBorder={setComponentStyleBorder}
          setComponentStyleElevation={setComponentStyleElevation}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('settingsNew.appearance.borderRadius')}
        icon={<Circle className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemeRadiusSection
          radius={customization.radius}
          setRadius={setRadius}
          label={t('settingsNew.appearance.roundness')}
          previewText={t('settingsNew.appearance.preview')}
          squareText={t('settingsNew.appearance.square')}
          roundedText={t('settingsNew.appearance.rounded')}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('theme.animations')}
        icon={<WandSparkles className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemeAnimationsSection
          animationsEnabled={customization.animationsEnabled}
          setAnimationsEnabled={setAnimationsEnabled}
          description={t('settingsNew.appearance.enableAnimationsDesc')}
        />
      </SettingsSection>

      <Separator />

      <SettingsSection
        title={t('settingsNew.appearance.typography')}
        icon={<Type className="h-4 w-4" />}
        defaultOpen={false}
      >
        <ThemeTypographySection
          customization={customization}
          setFontFamily={setFontFamily}
          setFontSize={setFontSize}
          setLetterSpacing={setLetterSpacing}
          setLineHeight={setLineHeight}
          fontFamilyLabel={t('settingsNew.appearance.fontFamily')}
          fontSizeLabel={t('settingsNew.appearance.fontSize')}
        />
      </SettingsSection>

      <Separator />

      <div className="flex justify-end">
        <ThemeResetButton onReset={resetCustomization} />
      </div>
    </div>
  );
}
