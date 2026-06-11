'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { tauriApi } from '@/lib/tauri';
import type { CameraType as TCamType } from '@/lib/tauri';
import { useEquipmentStore } from '@/lib/stores/equipment-store';
import { useShallow } from 'zustand/react/shallow';
import { validateCameraForm, validateCameraFields, type FieldErrors } from '@/lib/core/management-validators';
import { normalizeCameras } from '@/lib/core/equipment-normalize';
import type { NormalizedCamera } from '@/types/starmap/management';
import { EmptyState } from '@/components/ui/empty-state';
import { EquipmentListItem } from './equipment-list-item';

interface CameraTabProps {
  isTauriAvailable: boolean;
  rawCameras: unknown[];
  onDeleteRequest: (id: string, name: string, type: 'camera') => void;
  onRefresh: () => void;
}

export function CameraTab({ isTauriAvailable, rawCameras, onDeleteRequest, onRefresh }: CameraTabProps) {
  const t = useTranslations();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    sensor_width: '',
    sensor_height: '',
    pixel_size: '',
    resolution_x: '',
    resolution_y: '',
    camera_type: 'cmos' as TCamType,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<'name' | 'sensor_width' | 'sensor_height'>>({});

  const {
    addCustomCamera,
    updateCustomCamera,
    applyCamera,
    customCameras,
    activeCameraId,
  } = useEquipmentStore(useShallow((state) => ({
    addCustomCamera: state.addCustomCamera,
    updateCustomCamera: state.updateCustomCamera,
    applyCamera: state.applyCamera,
    customCameras: state.customCameras,
    activeCameraId: state.activeCameraId,
  })));

  const cameraList = useMemo(
    () => normalizeCameras(rawCameras as Parameters<typeof normalizeCameras>[0], isTauriAvailable),
    [rawCameras, isTauriAvailable]
  );

  const resetForm = () => {
    setForm({ name: '', sensor_width: '', sensor_height: '', pixel_size: '', resolution_x: '', resolution_y: '', camera_type: 'cmos' });
    setFieldErrors({});
    setAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (cam: NormalizedCamera) => {
    const baseForm = {
      name: cam.name,
      sensor_width: String(cam.sensorWidth),
      sensor_height: String(cam.sensorHeight),
      pixel_size: '',
      resolution_x: '',
      resolution_y: '',
      camera_type: 'cmos' as TCamType,
    };

    if (isTauriAvailable) {
      const raw = rawCameras.find((r: unknown) => (r as { id: string }).id === cam.id) as Record<string, unknown> | undefined;
      if (raw) {
        baseForm.pixel_size = String(raw.pixel_size ?? '');
        baseForm.resolution_x = String(raw.resolution_x ?? '');
        baseForm.resolution_y = String(raw.resolution_y ?? '');
        baseForm.camera_type = (raw.camera_type as TCamType) ?? 'cmos';
      }
    } else {
      const preset = customCameras.find(p => p.id === cam.id);
      if (preset) {
        baseForm.pixel_size = String(preset.pixelSize ?? '');
        baseForm.resolution_x = String(preset.resolutionX ?? '');
        baseForm.resolution_y = String(preset.resolutionY ?? '');
      }
    }

    setForm(baseForm);
    setEditingId(cam.id);
    setAdding(true);
  };

  const handleSave = async () => {
    const errors = validateCameraFields(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorKey = validateCameraForm(form);
      if (errorKey) toast.error(t(errorKey) || errorKey);
      return;
    }
    setFieldErrors({});

    if (editingId) {
      // Update existing
      if (isTauriAvailable) {
        try {
          const original = rawCameras.find((r: unknown) => (r as { id: string }).id === editingId) as Record<string, unknown> | undefined;
          await tauriApi.equipment.updateCamera({
            id: editingId,
            name: form.name,
            sensor_width: parseFloat(form.sensor_width),
            sensor_height: parseFloat(form.sensor_height),
            pixel_size: parseFloat(form.pixel_size) || 0,
            resolution_x: parseInt(form.resolution_x) || 0,
            resolution_y: parseInt(form.resolution_y) || 0,
            camera_type: form.camera_type,
            has_cooler: (original?.has_cooler as boolean) ?? false,
            is_default: (original?.is_default as boolean) ?? false,
            created_at: (original?.created_at as string) ?? '',
            updated_at: new Date().toISOString(),
          });
          toast.success(t('equipment.updated') || 'Camera updated');
          onRefresh();
        } catch (e) {
          toast.error((e as Error).message);
          return;
        }
      } else {
        updateCustomCamera(editingId, {
          name: form.name,
          sensorWidth: parseFloat(form.sensor_width),
          sensorHeight: parseFloat(form.sensor_height),
          pixelSize: parseFloat(form.pixel_size) || 3.76,
          resolutionX: parseInt(form.resolution_x) || undefined,
          resolutionY: parseInt(form.resolution_y) || undefined,
        });
        toast.success(t('equipment.updated') || 'Camera updated');
      }
    } else {
      // Add new
      if (isTauriAvailable) {
        try {
          await tauriApi.equipment.addCamera({
            name: form.name,
            sensor_width: parseFloat(form.sensor_width),
            sensor_height: parseFloat(form.sensor_height),
            pixel_size: parseFloat(form.pixel_size) || 0,
            resolution_x: parseInt(form.resolution_x) || 0,
            resolution_y: parseInt(form.resolution_y) || 0,
            camera_type: form.camera_type,
            has_cooler: false,
            is_default: rawCameras.length === 0,
          });
          toast.success(t('equipment.cameraAdded') || 'Camera added');
          onRefresh();
        } catch (e) {
          toast.error((e as Error).message);
          return;
        }
      } else {
        addCustomCamera({
          name: form.name,
          sensorWidth: parseFloat(form.sensor_width),
          sensorHeight: parseFloat(form.sensor_height),
          pixelSize: parseFloat(form.pixel_size) || 3.76,
          resolutionX: parseInt(form.resolution_x) || undefined,
          resolutionY: parseInt(form.resolution_y) || undefined,
        });
        toast.success(t('equipment.cameraAdded') || 'Camera added');
      }
    }

    resetForm();
  };

  const handleSelect = (cam: NormalizedCamera) => {
    if (!isTauriAvailable) {
      const preset = customCameras.find(p => p.id === cam.id);
      if (preset) {
        applyCamera(preset);
        toast.success(t('equipment.selected') || 'Camera selected');
      }
    }
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[200px]">
        {cameraList.length === 0 ? (
          <EmptyState
            icon={Camera}
            message={t('equipment.noCameras') || 'No cameras added'}
            iconClassName="h-10 w-10 mb-3"
          />
        ) : (
          <div className="space-y-2">
            {cameraList.map((cam) => (
              <EquipmentListItem
                key={cam.id}
                icon={Camera}
                name={cam.name}
                detail={`${cam.sensorWidth}×${cam.sensorHeight}mm`}
                isSelected={!isTauriAvailable && activeCameraId === cam.id}
                isDefault={cam.isDefault}
                selectable={!isTauriAvailable}
                deleteLabel={t('equipment.delete')}
                editLabel={t('equipment.edit') || 'Edit'}
                onSelect={() => handleSelect(cam)}
                onEdit={() => handleStartEdit(cam)}
                onDelete={() => onDeleteRequest(cam.id, cam.name, 'camera')}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {adding ? (
        <Card className="py-3">
          <CardContent className="space-y-3 px-3">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>{t('equipment.name') || 'Name'}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((prev) => ({ ...prev, name: undefined })); }}
                  placeholder={t('equipment.cameraNamePlaceholder')}
                  className={fieldErrors.name ? 'border-destructive' : ''}
                  autoFocus
                />
                {fieldErrors.name && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.name)}</p>}
              </div>
              <div>
                <Label>{t('equipment.type') || 'Type'}</Label>
                <Select
                  value={form.camera_type}
                  onValueChange={(v) => setForm({ ...form, camera_type: v as TCamType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cmos">{t('equipment.cameraTypes.cmos')}</SelectItem>
                    <SelectItem value="ccd">{t('equipment.cameraTypes.ccd')}</SelectItem>
                    <SelectItem value="dslr">{t('equipment.cameraTypes.dslr')}</SelectItem>
                    <SelectItem value="mirrorless">{t('equipment.cameraTypes.mirrorless')}</SelectItem>
                    <SelectItem value="other">{t('equipment.cameraTypes.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>{t('equipment.sensorWidth') || 'Sensor Width (mm)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.sensor_width}
                  onChange={(e) => { setForm({ ...form, sensor_width: e.target.value }); setFieldErrors((prev) => ({ ...prev, sensor_width: undefined })); }}
                  placeholder="23.2"
                  className={fieldErrors.sensor_width ? 'border-destructive' : ''}
                />
                {fieldErrors.sensor_width && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.sensor_width)}</p>}
              </div>
              <div>
                <Label>{t('equipment.sensorHeight') || 'Sensor Height (mm)'}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.sensor_height}
                  onChange={(e) => { setForm({ ...form, sensor_height: e.target.value }); setFieldErrors((prev) => ({ ...prev, sensor_height: undefined })); }}
                  placeholder="15.5"
                  className={fieldErrors.sensor_height ? 'border-destructive' : ''}
                />
                {fieldErrors.sensor_height && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.sensor_height)}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit">
                {editingId ? (t('common.update') || 'Update') : (t('common.save') || 'Save')}
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={resetForm}>
                {t('common.cancel') || 'Cancel'}
              </Button>
            </div>
            </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('equipment.addCamera') || 'Add Camera'}
        </Button>
      )}
    </div>
  );
}
