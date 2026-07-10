'use client';

import { useTranslations } from 'next-intl';
import {
  Accessibility,
  Eye,
  Type,
  Focus,
  Palette,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAccessibilityDraftModel } from '@/lib/hooks/use-settings-draft';
import { FONT_SCALE_MIN, FONT_SCALE_MAX, type ColorBlindMode } from '@/lib/stores/settings-store';
import { SettingsSection, ToggleItem } from './settings-shared';

const COLOR_BLIND_MODES: ColorBlindMode[] = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
];

// Reference swatches for the live color-vision preview. When a mode is active
// the root SVG filter recolors these too, giving an at-a-glance simulation.
const PREVIEW_SWATCHES = ['#e02424', '#16a34a', '#2563eb', '#eab308', '#db2777', '#0891b2'];

export function AccessibilitySettings() {
  const t = useTranslations();

  const { accessibility, setAccessibilitySetting } = useAccessibilityDraftModel();
  const fontScalePercent = Math.round(accessibility.fontScale * 100);

  return (
    <div className="space-y-4">
      {/* Visual */}
      <SettingsSection
        title={t('settingsNew.accessibility.visual')}
        icon={<Eye className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-2">
          <ToggleItem
            id="high-contrast"
            label={t('settingsNew.accessibility.highContrast')}
            description={t('settingsNew.accessibility.highContrastDesc')}
            checked={accessibility.highContrast}
            onCheckedChange={(checked) => setAccessibilitySetting('highContrast', checked)}
          />
          <ToggleItem
            id="reduce-transparency"
            label={t('settingsNew.accessibility.reduceTransparency')}
            description={t('settingsNew.accessibility.reduceTransparencyDesc')}
            checked={accessibility.reduceTransparency}
            onCheckedChange={(checked) => setAccessibilitySetting('reduceTransparency', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Text size */}
      <SettingsSection
        title={t('settingsNew.accessibility.text')}
        icon={<Type className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3 py-2 px-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <Label className="text-sm" htmlFor="font-scale">
              {t('settingsNew.accessibility.fontScale')}
            </Label>
            <Badge variant="outline" className="font-mono">{fontScalePercent}%</Badge>
          </div>
          <Slider
            id="font-scale"
            aria-label={t('settingsNew.accessibility.fontScale')}
            value={[accessibility.fontScale]}
            onValueChange={([v]) => setAccessibilitySetting('fontScale', v)}
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={0.05}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(FONT_SCALE_MIN * 100)}%</span>
            <span>{Math.round(FONT_SCALE_MAX * 100)}%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.accessibility.fontScaleDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Color vision */}
      <SettingsSection
        title={t('settingsNew.accessibility.colorVision')}
        icon={<Palette className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-3 py-2 px-3 rounded-lg bg-muted/30">
          <Label className="text-xs text-muted-foreground" htmlFor="color-blind-mode">
            {t('settingsNew.accessibility.colorBlindMode')}
          </Label>
          <Select
            value={accessibility.colorBlindMode}
            onValueChange={(v) => setAccessibilitySetting('colorBlindMode', v as ColorBlindMode)}
          >
            <SelectTrigger id="color-blind-mode" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLOR_BLIND_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`settingsNew.accessibility.colorBlind_${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {PREVIEW_SWATCHES.map((color) => (
              <span
                key={color}
                className="h-5 flex-1 rounded-sm border border-border/50"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.accessibility.colorBlindModeDesc')}
          </p>
        </div>
      </SettingsSection>

      <Separator />

      {/* Navigation */}
      <SettingsSection
        title={t('settingsNew.accessibility.navigation')}
        icon={<Focus className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="focus-indicators"
            label={t('settingsNew.accessibility.focusIndicators')}
            description={t('settingsNew.accessibility.focusIndicatorsDesc')}
            checked={accessibility.focusIndicators}
            onCheckedChange={(checked) => setAccessibilitySetting('focusIndicators', checked)}
          />
        </div>
      </SettingsSection>

      <Separator />

      {/* Screen Reader */}
      <SettingsSection
        title={t('settingsNew.accessibility.screenReader')}
        icon={<Accessibility className="h-4 w-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          <ToggleItem
            id="screen-reader-optimized"
            label={t('settingsNew.accessibility.screenReaderOptimized')}
            description={t('settingsNew.accessibility.screenReaderOptimizedDesc')}
            checked={accessibility.screenReaderOptimized}
            onCheckedChange={(checked) => setAccessibilitySetting('screenReaderOptimized', checked)}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
