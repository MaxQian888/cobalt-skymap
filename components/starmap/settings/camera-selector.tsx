'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  useEquipmentStore,
  BUILTIN_CAMERA_PRESETS,
  type CameraPreset,
} from '@/lib/stores';

function getCameraBrand(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('sony') || nameLower.includes('a7')) return 'Sony';
  if (nameLower.includes('canon') || nameLower.includes('eos')) return 'Canon';
  if (nameLower.includes('nikon') || nameLower.includes('nikkor')) return 'Nikon';
  if (nameLower.includes('zwo') || nameLower.includes('asi')) return 'ZWO';
  if (nameLower.includes('qhy')) return 'QHY';
  if (nameLower.includes('player one') || nameLower.includes('poseidon') || nameLower.includes('ares') || nameLower.includes('neptune') || nameLower.includes('uranus') || nameLower.includes('mars-c')) return 'Player One';
  if (nameLower.includes('atik')) return 'Atik';
  if (nameLower.includes('sbig')) return 'SBIG';
  if (nameLower.includes('fli') || nameLower.includes('kepler')) return 'FLI';
  if (nameLower.includes('moravian')) return 'Moravian';
  if (nameLower.includes('fuji')) return 'Fujifilm';
  if (nameLower.includes('olympus') || nameLower.includes('om system')) return 'OM System';
  if (nameLower.includes('panasonic')) return 'Panasonic';
  if (nameLower.includes('full frame') || nameLower.includes('aps-c') || nameLower.includes('micro')) return 'Generic';
  return 'Other';
}

const BRAND_ORDER = ['Canon', 'Sony', 'Nikon', 'Fujifilm', 'OM System', 'Panasonic', 'ZWO', 'QHY', 'Player One', 'Atik', 'SBIG', 'FLI', 'Moravian', 'Generic', 'Other'];

export function CameraSelector() {
  const t = useTranslations();
  const [addCameraOpen, setAddCameraOpen] = useState(false);
  const [cameraSearch, setCameraSearch] = useState('');
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraSensorWidth, setNewCameraSensorWidth] = useState('');
  const [newCameraSensorHeight, setNewCameraSensorHeight] = useState('');
  const [newCameraPixelSize, setNewCameraPixelSize] = useState('');

  const activeCameraId = useEquipmentStore((s) => s.activeCameraId);
  const sensorWidth = useEquipmentStore((s) => s.sensorWidth);
  const sensorHeight = useEquipmentStore((s) => s.sensorHeight);
  const pixelSize = useEquipmentStore((s) => s.pixelSize);
  const customCameras = useEquipmentStore((s) => s.customCameras);
  const setSensorWidth = useEquipmentStore((s) => s.setSensorWidth);
  const setSensorHeight = useEquipmentStore((s) => s.setSensorHeight);
  const setPixelSize = useEquipmentStore((s) => s.setPixelSize);
  const applyCamera = useEquipmentStore((s) => s.applyCamera);
  const addCustomCamera = useEquipmentStore((s) => s.addCustomCamera);
  const removeCustomCamera = useEquipmentStore((s) => s.removeCustomCamera);

  const allCameras = useMemo(() => [...BUILTIN_CAMERA_PRESETS, ...customCameras], [customCameras]);

  const groupedCameras = useMemo(() => {
    const searchLower = cameraSearch.toLowerCase().trim();
    const filtered = cameraSearch.trim()
      ? BUILTIN_CAMERA_PRESETS.filter((camera) => camera.name.toLowerCase().includes(searchLower))
      : BUILTIN_CAMERA_PRESETS;

    const groups: Record<string, CameraPreset[]> = {};
    filtered.forEach((camera) => {
      const brand = getCameraBrand(camera.name);
      if (!groups[brand]) groups[brand] = [];
      groups[brand].push(camera);
    });

    return BRAND_ORDER
      .filter((brand) => groups[brand]?.length > 0)
      .map((brand) => ({ brand, cameras: groups[brand] }));
  }, [cameraSearch]);

  const filteredCustomCameras = useMemo(() => {
    const searchLower = cameraSearch.toLowerCase().trim();
    return cameraSearch.trim()
      ? customCameras.filter((c) => c.name.toLowerCase().includes(searchLower))
      : customCameras;
  }, [cameraSearch, customCameras]);

  const totalFilteredCameras = useMemo(() =>
    groupedCameras.reduce((sum, g) => sum + g.cameras.length, 0) + filteredCustomCameras.length, [groupedCameras, filteredCustomCameras]);

  const handleAddCamera = useCallback(() => {
    if (!newCameraName || !newCameraSensorWidth || !newCameraSensorHeight) return;
    const sw = parseFloat(newCameraSensorWidth);
    const sh = parseFloat(newCameraSensorHeight);
    const ps = parseFloat(newCameraPixelSize) || 3.76;
    if (sw <= 0 || sw > 100 || sh <= 0 || sh > 100 || ps <= 0) return;
    addCustomCamera({ name: newCameraName.trim(), sensorWidth: sw, sensorHeight: sh, pixelSize: ps });
    setNewCameraName('');
    setNewCameraSensorWidth('');
    setNewCameraSensorHeight('');
    setNewCameraPixelSize('');
    setAddCameraOpen(false);
  }, [newCameraName, newCameraSensorWidth, newCameraSensorHeight, newCameraPixelSize, addCustomCamera]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4" />
        {t('equipment.camera')}
      </Label>
      <div className="flex gap-2">
        <Select
          value={activeCameraId || 'custom'}
          onValueChange={(value) => {
            if (value === 'custom') return;
            const camera = allCameras.find((c) => c.id === value);
            if (camera) applyCamera(camera);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('equipment.selectCamera')} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
              <Input
                placeholder={t('equipment.searchCamera')}
                value={cameraSearch}
                onChange={(e) => setCameraSearch(e.target.value)}
                className="h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <SelectItem value="custom">
              <span className="text-muted-foreground">{t('equipment.manualInput')}</span>
            </SelectItem>
            {groupedCameras.length > 0 && groupedCameras.map((group) => (
              <SelectGroup key={group.brand}>
                <SelectLabel className="text-xs font-semibold text-primary/80">
                  {group.brand} ({group.cameras.length})
                </SelectLabel>
                {group.cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{camera.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {camera.sensorWidth}×{camera.sensorHeight}mm
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {totalFilteredCameras === 0 && cameraSearch && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t('equipment.noResults')}
              </div>
            )}
            {filteredCustomCameras.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-semibold text-primary/80">
                  {t('equipment.customPresets')} ({filteredCustomCameras.length})
                </SelectLabel>
                {filteredCustomCameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{camera.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {camera.sensorWidth}×{camera.sensorHeight}mm
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <ResponsiveDialog open={addCameraOpen} onOpenChange={setAddCameraOpen} tier="standard-form">
          <ResponsiveDialogTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{t('equipment.addCamera')}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>{t('equipment.addCameraDescription')}</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label>{t('equipment.name')}</Label>
                <Input
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder={t('equipment.cameraNamePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t('fov.sensorWidth')} (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newCameraSensorWidth}
                    onChange={(e) => setNewCameraSensorWidth(e.target.value)}
                    placeholder={t('fov.sensorWidthPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('fov.sensorHeight')} (mm)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newCameraSensorHeight}
                    onChange={(e) => setNewCameraSensorHeight(e.target.value)}
                    placeholder={t('fov.sensorHeightPlaceholder')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('fov.pixelSize')} (μm)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCameraPixelSize}
                  onChange={(e) => setNewCameraPixelSize(e.target.value)}
                  placeholder={t('fov.pixelSizePlaceholder')}
                />
              </div>
            </div>
            <ResponsiveDialogFooter>
              <Button variant="outline" onClick={() => setAddCameraOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddCamera} disabled={!newCameraName || !newCameraSensorWidth || !newCameraSensorHeight}>
                {t('common.add')}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {/* Camera Manual Input */}
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('fov.sensorWidth')}</Label>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            value={sensorWidth}
            onChange={(e) => setSensorWidth(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('fov.sensorHeight')}</Label>
          <Input
            type="number"
            step="0.1"
            min={0.1}
            value={sensorHeight}
            onChange={(e) => setSensorHeight(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('fov.pixelSize')}</Label>
          <Input
            type="number"
            step="0.01"
            min={0.01}
            value={pixelSize}
            onChange={(e) => setPixelSize(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Custom cameras list */}
      {customCameras.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('equipment.customPresets')}</Label>
          <div className="flex flex-wrap gap-1">
            {customCameras.map((camera) => (
              <Badge
                key={camera.id}
                variant={activeCameraId === camera.id ? 'default' : 'secondary'}
                className="cursor-pointer gap-1 pr-1"
                onClick={() => applyCamera(camera)}
              >
                {camera.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustomCamera(camera.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
