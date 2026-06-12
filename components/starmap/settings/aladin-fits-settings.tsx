'use client';

import { useState } from 'react';
import { FileImage, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAladinStore, type AladinFitsMode } from '@/lib/stores/aladin-store';
import { useAladinColormaps } from '@/lib/hooks/aladin';
import { SettingsSection, ToggleItem } from './settings-shared';

const FITS_STRETCHES = ['linear', 'log', 'sqrt', 'asinh', 'pow'] as const;

export function AladinFitsSettings() {
  const t = useTranslations();
  const colormaps = useAladinColormaps();
  const [fitsName, setFitsName] = useState('');
  const [fitsUrl, setFitsUrl] = useState('');
  const [fitsMode, setFitsMode] = useState<AladinFitsMode>('overlay');

  const fitsLayers = useAladinStore((state) => state.fitsLayers);
  const addFitsLayer = useAladinStore((state) => state.addFitsLayer);
  const removeFitsLayer = useAladinStore((state) => state.removeFitsLayer);
  const toggleFitsLayer = useAladinStore((state) => state.toggleFitsLayer);
  const updateFitsLayer = useAladinStore((state) => state.updateFitsLayer);

  const addLayer = () => {
    if (!fitsUrl.trim()) return;

    addFitsLayer({
      name: fitsName.trim() || fitsUrl.trim(),
      url: fitsUrl.trim(),
      mode: fitsMode,
      enabled: true,
      opacity: 0.8,
    });

    setFitsName('');
    setFitsUrl('');
  };

  return (
    <SettingsSection
      title={t('settings.aladinFitsLayers')}
      icon={<FileImage className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-2 rounded-lg bg-muted/30 p-2">
        <Label className="text-xs text-muted-foreground">{t('settings.aladinAddFitsLayer')}</Label>
        <Input
          value={fitsName}
          onChange={(e) => setFitsName(e.target.value)}
          placeholder={t('settings.aladinFitsNamePlaceholder')}
          className="h-8"
        />
        <Input
          value={fitsUrl}
          onChange={(e) => setFitsUrl(e.target.value)}
          placeholder={t('settings.aladinFitsUrlPlaceholder')}
          className="h-8"
        />
        <div className="flex gap-2">
          <Select value={fitsMode} onValueChange={(value: AladinFitsMode) => setFitsMode(value)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overlay">{t('settings.aladinFitsModeOverlay')}</SelectItem>
              <SelectItem value="base">{t('settings.aladinFitsModeBase')}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={addLayer}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {fitsLayers.map((layer) => (
        <div key={layer.id} className="space-y-2 rounded-lg bg-muted/30 p-2">
          <div className="flex items-start justify-between gap-2">
            <ToggleItem
              id={`fits-${layer.id}`}
              label={layer.name}
              checked={layer.enabled}
              onCheckedChange={() => toggleFitsLayer(layer.id)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              onClick={() => removeFitsLayer(layer.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {layer.enabled && (
            <div className="space-y-2 px-2 pb-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('settings.aladinFitsMode')}</Label>
                <Select
                  value={layer.mode}
                  onValueChange={(value: AladinFitsMode) => updateFitsLayer(layer.id, { mode: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overlay">{t('settings.aladinFitsModeOverlay')}</SelectItem>
                    <SelectItem value="base">{t('settings.aladinFitsModeBase')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{t('settings.aladinOverlayOpacity')}</Label>
                  <span className="text-xs text-muted-foreground">{Math.round(layer.opacity * 100)}%</span>
                </div>
                <Slider
                  value={[layer.opacity]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([value]) => updateFitsLayer(layer.id, { opacity: value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('settings.aladinColormap')}</Label>
                <Select
                  value={layer.colormap ?? 'native'}
                  onValueChange={(value) => updateFitsLayer(layer.id, { colormap: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colormaps.map((cm) => (
                      <SelectItem key={cm} value={cm}>
                        {cm === 'native'
                          ? t('settings.aladinColormapNative')
                          : cm.charAt(0).toUpperCase() + cm.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('settings.aladinStretch')}</Label>
                <Select
                  value={layer.stretch ?? 'linear'}
                  onValueChange={(value) => updateFitsLayer(layer.id, { stretch: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FITS_STRETCHES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('settings.aladinMinCut')}</Label>
                  <Input
                    type="number"
                    value={layer.minCut ?? ''}
                    onChange={(e) =>
                      updateFitsLayer(layer.id, {
                        minCut: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('settings.aladinMaxCut')}</Label>
                  <Input
                    type="number"
                    value={layer.maxCut ?? ''}
                    onChange={(e) =>
                      updateFitsLayer(layer.id, {
                        maxCut: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </SettingsSection>
  );
}
