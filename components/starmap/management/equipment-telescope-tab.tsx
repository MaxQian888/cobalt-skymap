'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Telescope, Plus } from 'lucide-react';
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
import type { TelescopeType as TScopeType } from '@/lib/tauri';
import { useEquipmentStore } from '@/lib/stores/equipment-store';
import { useShallow } from 'zustand/react/shallow';
import { validateTelescopeForm, validateTelescopeFields, type FieldErrors } from '@/lib/core/management-validators';
import { normalizeTelescopes } from '@/lib/core/equipment-normalize';
import type { NormalizedTelescope } from '@/types/starmap/management';
import { EmptyState } from '@/components/ui/empty-state';
import { EquipmentListItem } from './equipment-list-item';

interface TelescopeTabProps {
  isTauriAvailable: boolean;
  rawTelescopes: unknown[];
  onDeleteRequest: (id: string, name: string, type: 'telescope') => void;
  onRefresh: () => void;
}

export function TelescopeTab({ isTauriAvailable, rawTelescopes, onDeleteRequest, onRefresh }: TelescopeTabProps) {
  const t = useTranslations();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    aperture: '',
    focal_length: '',
    telescope_type: 'reflector' as TScopeType,
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<'name' | 'aperture' | 'focal_length'>>({});

  const {
    addCustomTelescope,
    updateCustomTelescope,
    applyTelescope,
    customTelescopes,
    activeTelescopeId,
  } = useEquipmentStore(useShallow((state) => ({
    addCustomTelescope: state.addCustomTelescope,
    updateCustomTelescope: state.updateCustomTelescope,
    applyTelescope: state.applyTelescope,
    customTelescopes: state.customTelescopes,
    activeTelescopeId: state.activeTelescopeId,
  })));

  const telescopeList = useMemo(
    () => normalizeTelescopes(rawTelescopes as Parameters<typeof normalizeTelescopes>[0], isTauriAvailable),
    [rawTelescopes, isTauriAvailable]
  );

  const resetForm = () => {
    setForm({ name: '', aperture: '', focal_length: '', telescope_type: 'reflector' });
    setFieldErrors({});
    setAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (scope: NormalizedTelescope) => {
    setForm({
      name: scope.name,
      aperture: String(scope.aperture),
      focal_length: String(scope.focalLength),
      telescope_type: 'reflector',
    });
    // Try to recover the original telescope_type from raw data
    if (isTauriAvailable) {
      const raw = rawTelescopes.find((r: unknown) => (r as { id: string }).id === scope.id) as { telescope_type?: TScopeType } | undefined;
      if (raw?.telescope_type) {
        setForm(prev => ({ ...prev, telescope_type: raw.telescope_type! }));
      }
    } else {
      const preset = customTelescopes.find(p => p.id === scope.id);
      if (preset?.type) {
        setForm(prev => ({ ...prev, telescope_type: preset.type as TScopeType }));
      }
    }
    setEditingId(scope.id);
    setAdding(true);
  };

  const handleSave = async () => {
    const errors = validateTelescopeFields(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const errorKey = validateTelescopeForm(form);
      if (errorKey) toast.error(t(errorKey) || errorKey);
      return;
    }
    setFieldErrors({});

    const aperture = parseFloat(form.aperture);
    const focal_length = parseFloat(form.focal_length);

    if (editingId) {
      // Update existing
      if (isTauriAvailable) {
        try {
          const original = rawTelescopes.find((r: unknown) => (r as { id: string }).id === editingId) as Record<string, unknown> | undefined;
          await tauriApi.equipment.updateTelescope({
            id: editingId,
            name: form.name,
            aperture,
            focal_length,
            focal_ratio: focal_length / aperture,
            telescope_type: form.telescope_type,
            is_default: (original?.is_default as boolean) ?? false,
            created_at: (original?.created_at as string) ?? '',
            updated_at: new Date().toISOString(),
          });
          toast.success(t('equipment.updated') || 'Telescope updated');
          onRefresh();
        } catch (e) {
          toast.error((e as Error).message);
          return;
        }
      } else {
        updateCustomTelescope(editingId, {
          name: form.name,
          focalLength: focal_length,
          aperture,
          type: form.telescope_type,
        });
        toast.success(t('equipment.updated') || 'Telescope updated');
      }
    } else {
      // Add new
      if (isTauriAvailable) {
        try {
          await tauriApi.equipment.addTelescope({
            name: form.name,
            aperture,
            focal_length,
            focal_ratio: focal_length / aperture,
            telescope_type: form.telescope_type,
            is_default: rawTelescopes.length === 0,
          });
          toast.success(t('equipment.telescopeAdded') || 'Telescope added');
          onRefresh();
        } catch (e) {
          toast.error((e as Error).message);
          return;
        }
      } else {
        addCustomTelescope({
          name: form.name,
          focalLength: focal_length,
          aperture,
          type: form.telescope_type,
        });
        toast.success(t('equipment.telescopeAdded') || 'Telescope added');
      }
    }

    resetForm();
  };

  const handleSelect = (scope: NormalizedTelescope) => {
    if (!isTauriAvailable) {
      const preset = customTelescopes.find(p => p.id === scope.id);
      if (preset) {
        applyTelescope(preset);
        toast.success(t('equipment.selected') || 'Telescope selected');
      }
    }
  };

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[200px]">
        {telescopeList.length === 0 ? (
          <EmptyState
            icon={Telescope}
            message={t('equipment.noTelescopes') || 'No telescopes added'}
            iconClassName="h-10 w-10 mb-3"
          />
        ) : (
          <div className="space-y-2">
            {telescopeList.map((scope) => (
              <EquipmentListItem
                key={scope.id}
                icon={Telescope}
                name={scope.name}
                detail={`${scope.aperture}mm f/${scope.focalRatio.toFixed(1)}`}
                isSelected={!isTauriAvailable && activeTelescopeId === scope.id}
                isDefault={scope.isDefault}
                selectable={!isTauriAvailable}
                deleteLabel={t('equipment.delete')}
                editLabel={t('equipment.edit') || 'Edit'}
                onSelect={() => handleSelect(scope)}
                onEdit={() => handleStartEdit(scope)}
                onDelete={() => onDeleteRequest(scope.id, scope.name, 'telescope')}
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
                  placeholder={t('equipment.telescopeNamePlaceholder')}
                  className={fieldErrors.name ? 'border-destructive' : ''}
                  autoFocus
                />
                {fieldErrors.name && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.name)}</p>}
              </div>
              <div>
                <Label>{t('equipment.type') || 'Type'}</Label>
                <Select
                  value={form.telescope_type}
                  onValueChange={(v) => setForm({ ...form, telescope_type: v as TScopeType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refractor">{t('equipment.telescopeTypes.refractor')}</SelectItem>
                    <SelectItem value="reflector">{t('equipment.telescopeTypes.reflector')}</SelectItem>
                    <SelectItem value="catadioptric">{t('equipment.telescopeTypes.catadioptric')}</SelectItem>
                    <SelectItem value="other">{t('equipment.telescopeTypes.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>{t('equipment.aperture') || 'Aperture (mm)'}</Label>
                <Input
                  type="number"
                  value={form.aperture}
                  onChange={(e) => { setForm({ ...form, aperture: e.target.value }); setFieldErrors((prev) => ({ ...prev, aperture: undefined })); }}
                  placeholder="200"
                  className={fieldErrors.aperture ? 'border-destructive' : ''}
                />
                {fieldErrors.aperture && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.aperture)}</p>}
              </div>
              <div>
                <Label>{t('equipment.focalLength') || 'Focal Length (mm)'}</Label>
                <Input
                  type="number"
                  value={form.focal_length}
                  onChange={(e) => { setForm({ ...form, focal_length: e.target.value }); setFieldErrors((prev) => ({ ...prev, focal_length: undefined })); }}
                  placeholder="1000"
                  className={fieldErrors.focal_length ? 'border-destructive' : ''}
                />
                {fieldErrors.focal_length && <p className="text-xs text-destructive mt-0.5">{t(fieldErrors.focal_length)}</p>}
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
          {t('equipment.addTelescope') || 'Add Telescope'}
        </Button>
      )}
    </div>
  );
}
