'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Circle, Palette, Sparkles, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ThemeAnimationsSection,
  ThemeComponentStyleSection,
  ThemeModeSection,
  ThemePaletteEditor,
  ThemePresetSection,
  ThemeRadiusSection,
  ThemeResetButton,
  ThemeShareSection,
  ThemeTypographySection,
  useThemeCustomizationBindings,
} from '@/components/common/theme-customization-sections';

interface ThemeCustomizerProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ThemeCustomizer({ trigger, open, onOpenChange }: ThemeCustomizerProps) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
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
  } = useThemeCustomizationBindings();

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <Palette className="h-4 w-4" />
      {t('theme.customize')}
    </Button>
  );

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={setIsOpen} tier="complex-editor">
      <ResponsiveDialogTrigger asChild>{trigger ?? defaultTrigger}</ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="max-w-lg flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('theme.customizeTheme')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t('theme.customizeDescription')}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-4 sm:px-0 sm:pr-4">
          <Tabs defaultValue="presets" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="presets" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {t('theme.presets')}
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-1">
                <Circle className="h-3 w-3" />
                {t('theme.appearance')}
              </TabsTrigger>
              <TabsTrigger value="typography" className="gap-1">
                <Type className="h-3 w-3" />
                {t('theme.typography')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="presets" className="space-y-4 mt-4">
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
              />
              <Separator />
              <ThemeShareSection exportTheme={exportTheme} importTheme={importTheme} />
              <Separator />
              <div className="text-sm text-muted-foreground">{resolvedTheme === 'dark' ? t('common.darkMode') : t('common.lightMode')}</div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6 mt-4">
              <ThemeModeSection theme={theme} setTheme={setTheme} />
              <Separator />
              <ThemePaletteEditor
                customization={customization}
                userPresets={userPresets}
                initialEditingMode={resolvedTheme}
                setCustomColor={setCustomColor}
                clearCustomColor={clearCustomColor}
              />
              <Separator />
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
              <Separator />
              <ThemeRadiusSection
                radius={customization.radius}
                setRadius={setRadius}
                label={t('theme.borderRadius')}
                previewText={t('theme.preview')}
                squareText={t('theme.square')}
                roundedText={t('theme.rounded')}
              />
              <Separator />
              <ThemeAnimationsSection
                animationsEnabled={customization.animationsEnabled}
                setAnimationsEnabled={setAnimationsEnabled}
                description={t('theme.animationsDescription')}
              />
            </TabsContent>

            <TabsContent value="typography" className="space-y-6 mt-4">
              <ThemeTypographySection
                customization={customization}
                setFontFamily={setFontFamily}
                setFontSize={setFontSize}
                fontFamilyLabel={t('theme.fontFamily')}
                fontSizeLabel={t('theme.fontSize')}
              />
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <Separator className="my-2" />

        <div className="flex justify-between px-4 pb-[calc(var(--safe-area-bottom)+0.5rem)] sm:px-0 sm:pb-0">
          <ThemeResetButton onReset={resetCustomization} />
          <Button size="sm" onClick={() => setIsOpen(false)}>
            {t('common.close')}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function ThemeCustomizerButton() {
  const t = useTranslations();

  return (
    <ThemeCustomizer
      trigger={
        <Button variant="ghost" size="icon" className="h-10 w-10">
          <Palette className="h-5 w-5" />
          <span className="sr-only">{t('theme.customize')}</span>
        </Button>
      }
    />
  );
}
