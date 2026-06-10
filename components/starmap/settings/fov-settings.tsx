'use client';

import { useTranslations } from 'next-intl';
import { LayoutGrid, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { NumberStepper } from '@/components/ui/number-stepper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEquipmentStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { ToggleItem } from './settings-shared';
import { GRID_TYPE_OPTIONS, FRAME_COLORS, MAX_MOSAIC_ROWS, MAX_MOSAIC_COLS } from './settings-constants';

export function FOVSettings() {
  const t = useTranslations();
  // Per-field selectors — this panel must not re-render on unrelated equipment
  // store changes (telescope/camera selection, sensor dims, etc.). Actions are
  // stable Zustand refs.
  const fovDisplay = useEquipmentStore((s) => s.fovDisplay);
  const mosaic = useEquipmentStore((s) => s.mosaic);
  const setFOVDisplay = useEquipmentStore((s) => s.setFOVDisplay);
  const setFOVEnabled = useEquipmentStore((s) => s.setFOVEnabled);
  const setGridType = useEquipmentStore((s) => s.setGridType);
  const setMosaic = useEquipmentStore((s) => s.setMosaic);
  const setMosaicEnabled = useEquipmentStore((s) => s.setMosaicEnabled);
  const setMosaicGrid = useEquipmentStore((s) => s.setMosaicGrid);
  const setMosaicOverlap = useEquipmentStore((s) => s.setMosaicOverlap);

  return (
    <div className="space-y-4">
      {/* Enable FOV Overlay */}
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
        <Label htmlFor="fov-enabled" className="text-sm cursor-pointer flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          {t('fov.showFovOverlay')}
        </Label>
        <Switch
          id="fov-enabled"
          checked={fovDisplay.enabled}
          onCheckedChange={setFOVEnabled}
        />
      </div>

      {/* Grid Type */}
      <div className="space-y-2">
        <Label className="text-sm">{t('fov.compositionGrid')}</Label>
        <ToggleGroup
          type="single"
          value={fovDisplay.gridType}
          onValueChange={(value) => { if (value) setGridType(value as typeof fovDisplay.gridType); }}
          className="grid grid-cols-5 gap-1 w-full"
        >
          {GRID_TYPE_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="h-10 flex-col gap-0.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <span className="text-base font-mono">{option.icon}</span>
              <span className="text-[10px]">{t(option.labelKey)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Separator />

      {/* Mosaic Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm">
            <Grid3X3 className="h-4 w-4" />
            {t('fov.enableMosaic')}
          </Label>
          <Switch
            checked={mosaic.enabled}
            onCheckedChange={setMosaicEnabled}
          />
        </div>
        
        {mosaic.enabled && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberStepper
                label={t('fov.columns')}
                value={mosaic.cols}
                onChange={(v) => setMosaicGrid(mosaic.rows, v)}
                min={1}
                max={MAX_MOSAIC_COLS}
                step={1}
              />
              <NumberStepper
                label={t('fov.rows')}
                value={mosaic.rows}
                onChange={(v) => setMosaicGrid(v, mosaic.cols)}
                min={1}
                max={MAX_MOSAIC_ROWS}
                step={1}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('fov.overlap')}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {mosaic.overlap}{mosaic.overlapUnit === 'percent' ? '%' : 'px'}
                  </Badge>
                  <Select
                    value={mosaic.overlapUnit}
                    onValueChange={(v: 'percent' | 'pixels') => setMosaic({ ...mosaic, overlapUnit: v })}
                  >
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="pixels">px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Slider
                value={[mosaic.overlap]}
                onValueChange={([v]) => setMosaicOverlap(v)}
                min={0}
                max={mosaic.overlapUnit === 'percent' ? 50 : 500}
                step={mosaic.overlapUnit === 'percent' ? 5 : 50}
              />
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Display Options */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('fov.displayOptions')}</Label>
        <div className="space-y-2">
          <ToggleItem
            id="fov-show-coordinate-grid"
            label={t('fov.showCoordinateGrid')}
            checked={fovDisplay.showCoordinateGrid}
            onCheckedChange={(checked) => setFOVDisplay({ showCoordinateGrid: checked })}
          />
          <ToggleItem
            id="fov-show-dso-labels"
            label={t('fov.showDSOLabels')}
            checked={fovDisplay.showDSOLabels}
            onCheckedChange={(checked) => setFOVDisplay({ showDSOLabels: checked })}
          />
        </div>
      </div>

      <Separator />

      {/* Overlay Opacity */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('fov.overlayOpacity')}</Label>
          <span className="text-xs text-muted-foreground font-mono">{fovDisplay.overlayOpacity}%</span>
        </div>
        <Slider
          value={[fovDisplay.overlayOpacity]}
          onValueChange={([v]) => setFOVDisplay({ overlayOpacity: v })}
          min={10}
          max={100}
          step={5}
        />
      </div>

      {/* Frame Color */}
      <div className="space-y-2">
        <Label className="text-sm">{t('fov.frameColor')}</Label>
        <div className="flex gap-1">
          {FRAME_COLORS.map((color) => (
            <Button
              key={color}
              variant="outline"
              size="icon"
              className={cn(
                "w-7 h-7 p-0 rounded-full",
                fovDisplay.frameColor === color && "ring-2 ring-primary ring-offset-2"
              )}
              style={{ backgroundColor: color }}
              onClick={() => setFOVDisplay({ frameColor: color })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
