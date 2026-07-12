'use client';

import { useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Telescope, Plus, Trash2 } from 'lucide-react';
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
  BUILTIN_TELESCOPE_PRESETS,
  type TelescopePreset,
} from '@/lib/stores';

const TYPE_ORDER = ['Lens', 'APO', 'Newtonian', 'SCT', 'RC', 'RASA', 'Mak'];

export function TelescopeSelector() {
  const t = useTranslations();
  const [addTelescopeOpen, setAddTelescopeOpen] = useState(false);
  const [telescopeSearch, setTelescopeSearch] = useState('');
  const [newTelescopeName, setNewTelescopeName] = useState('');
  const [newTelescopeFocalLength, setNewTelescopeFocalLength] = useState('');
  const [newTelescopeAperture, setNewTelescopeAperture] = useState('');

  const activeTelescopeId = useEquipmentStore((s) => s.activeTelescopeId);
  const focalLength = useEquipmentStore((s) => s.focalLength);
  const aperture = useEquipmentStore((s) => s.aperture);
  const customTelescopes = useEquipmentStore((s) => s.customTelescopes);
  const setFocalLength = useEquipmentStore((s) => s.setFocalLength);
  const setAperture = useEquipmentStore((s) => s.setAperture);
  const applyTelescope = useEquipmentStore((s) => s.applyTelescope);
  const addCustomTelescope = useEquipmentStore((s) => s.addCustomTelescope);
  const removeCustomTelescope = useEquipmentStore((s) => s.removeCustomTelescope);

  const allTelescopes = useMemo(() => [...BUILTIN_TELESCOPE_PRESETS, ...customTelescopes], [customTelescopes]);

  const groupedTelescopes = useMemo(() => {
    const searchLower = telescopeSearch.toLowerCase().trim();
    const filtered = telescopeSearch.trim()
      ? BUILTIN_TELESCOPE_PRESETS.filter((tel) =>
          tel.name.toLowerCase().includes(searchLower) ||
          (tel.type && tel.type.toLowerCase().includes(searchLower))
        )
      : BUILTIN_TELESCOPE_PRESETS;

    const groups: Record<string, TelescopePreset[]> = {};
    filtered.forEach((telescope) => {
      const type = telescope.type || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(telescope);
    });

    return TYPE_ORDER
      .filter((type) => groups[type]?.length > 0)
      .map((type) => ({ type, telescopes: groups[type] }));
  }, [telescopeSearch]);

  const filteredCustomTelescopes = useMemo(() => {
    const searchLower = telescopeSearch.toLowerCase().trim();
    return telescopeSearch.trim()
      ? customTelescopes.filter((t) =>
          t.name.toLowerCase().includes(searchLower) ||
          (t.type && t.type.toLowerCase().includes(searchLower))
        )
      : customTelescopes;
  }, [telescopeSearch, customTelescopes]);

  const totalFilteredTelescopes = useMemo(() =>
    groupedTelescopes.reduce((sum, g) => sum + g.telescopes.length, 0) + filteredCustomTelescopes.length, [groupedTelescopes, filteredCustomTelescopes]);

  const handleAddTelescope = useCallback(() => {
    if (!newTelescopeName || !newTelescopeFocalLength) return;
    const fl = parseFloat(newTelescopeFocalLength);
    const ap = parseFloat(newTelescopeAperture) || 80;
    if (fl <= 0 || fl > 10000 || ap <= 0 || ap > 2000) return;
    addCustomTelescope({ name: newTelescopeName.trim(), focalLength: fl, aperture: ap, type: 'Custom' });
    setNewTelescopeName('');
    setNewTelescopeFocalLength('');
    setNewTelescopeAperture('');
    setAddTelescopeOpen(false);
  }, [newTelescopeName, newTelescopeFocalLength, newTelescopeAperture, addCustomTelescope]);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <Telescope className="h-4 w-4" />
        {t('equipment.telescope')}
      </Label>
      <div className="flex gap-2">
        <Select
          value={activeTelescopeId || 'custom'}
          onValueChange={(value) => {
            if (value === 'custom') return;
            const telescope = allTelescopes.find((tel) => tel.id === value);
            if (telescope) applyTelescope(telescope);
          }}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={t('equipment.selectTelescope')} />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <div className="px-2 pb-2 sticky top-0 bg-popover z-10">
              <Input
                placeholder={t('equipment.searchTelescope')}
                value={telescopeSearch}
                onChange={(e) => setTelescopeSearch(e.target.value)}
                className="h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <SelectItem value="custom">
              <span className="text-muted-foreground">{t('equipment.manualInput')}</span>
            </SelectItem>
            {groupedTelescopes.length > 0 && groupedTelescopes.map((group) => (
              <SelectGroup key={group.type}>
                <SelectLabel className="text-xs font-semibold text-primary/80">
                  {group.type} ({group.telescopes.length})
                </SelectLabel>
                {group.telescopes.map((telescope) => (
                  <SelectItem key={telescope.id} value={telescope.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{telescope.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {telescope.focalLength}mm f/{(telescope.focalLength / telescope.aperture).toFixed(1)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {totalFilteredTelescopes === 0 && telescopeSearch && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t('equipment.noResults')}
              </div>
            )}
            {filteredCustomTelescopes.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-xs font-semibold text-primary/80">
                  {t('equipment.customPresets')} ({filteredCustomTelescopes.length})
                </SelectLabel>
                {filteredCustomTelescopes.map((telescope) => (
                  <SelectItem key={telescope.id} value={telescope.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{telescope.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {telescope.focalLength}mm
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <ResponsiveDialog open={addTelescopeOpen} onOpenChange={setAddTelescopeOpen} tier="standard-form">
          <ResponsiveDialogTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>{t('equipment.addTelescope')}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>{t('equipment.addTelescopeDescription')}</ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-2">
                <Label>{t('equipment.name')}</Label>
                <Input
                  value={newTelescopeName}
                  onChange={(e) => setNewTelescopeName(e.target.value)}
                  placeholder={t('equipment.telescopeNamePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>{t('fov.focalLength')} (mm)</Label>
                  <Input
                    type="number"
                    value={newTelescopeFocalLength}
                    onChange={(e) => setNewTelescopeFocalLength(e.target.value)}
                    placeholder={t('fov.focalLengthPlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('equipment.aperture')} (mm)</Label>
                  <Input
                    type="number"
                    value={newTelescopeAperture}
                    onChange={(e) => setNewTelescopeAperture(e.target.value)}
                    placeholder={t('equipment.aperturePlaceholder')}
                  />
                </div>
              </div>
            </div>
            <ResponsiveDialogFooter>
              <Button variant="outline" onClick={() => setAddTelescopeOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddTelescope} disabled={!newTelescopeName || !newTelescopeFocalLength}>
                {t('common.add')}
              </Button>
            </ResponsiveDialogFooter>
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {/* Telescope Manual Input */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('fov.focalLength')} (mm)</Label>
          <Input
            type="number"
            min={1}
            value={focalLength}
            onChange={(e) => setFocalLength(Math.max(1, parseFloat(e.target.value) || 1))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('equipment.aperture')} (mm)</Label>
          <Input
            type="number"
            min={1}
            value={aperture}
            onChange={(e) => setAperture(Math.max(1, parseFloat(e.target.value) || 1))}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Custom telescopes list */}
      {customTelescopes.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('equipment.customPresets')}</Label>
          <div className="flex flex-wrap gap-1">
            {customTelescopes.map((telescope) => (
              <Badge
                key={telescope.id}
                variant={activeTelescopeId === telescope.id ? 'default' : 'secondary'}
                className="cursor-pointer gap-1 pr-1"
                onClick={() => applyTelescope(telescope)}
              >
                {telescope.name}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-destructive/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCustomTelescope(telescope.id);
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
