'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { MarkerIconDisplay } from '@/lib/constants/marker-icons';
import { parseRACoordinate, parseDecCoordinate } from '@/lib/astronomy/coordinates/conversions';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  type SkyMarker,
  type MarkerIcon,
  MARKER_COLORS,
  MARKER_ICONS,
} from '@/lib/stores';
import type { MarkerFormData } from '@/types/starmap/management';

interface MarkerEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: MarkerFormData;
  onFormDataChange: (data: MarkerFormData) => void;
  editingMarker: SkyMarker | null;
  groups: string[];
  onSave: () => void;
  t: (key: string) => string;
}

export function MarkerEditDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  editingMarker,
  groups,
  onSave,
  t,
}: MarkerEditDialogProps) {
  // Editable coordinate text (create AND edit). Accepts decimal degrees and
  // sexagesimal ("00h42m44s" / "+41°16'09\"") via the shared parsers; the
  // numeric ra/dec plus canonical strings propagate into formData when valid.
  const [raText, setRaText] = useState('');
  const [decText, setDecText] = useState('');
  const [raValid, setRaValid] = useState(true);
  const [decValid, setDecValid] = useState(true);

  useEffect(() => {
    if (!open) return;
    // Re-seed local editable text state from formData only on open. This is a genuine
    // false positive for set-state-in-effect: the seed must apply synchronously within
    // the effect so the inputs show the values before paint, and it can't be computed
    // during render (formData changes on every keystroke, which would clobber edits).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRaText(formData.raString || degreesToHMS(formData.ra));
    setDecText(formData.decString || degreesToDMS(formData.dec));
    setRaValid(true);
    setDecValid(true);
  // Re-seed only when the dialog opens (formData itself changes on every keystroke).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleRaChange = (value: string) => {
    setRaText(value);
    const parsed = parseRACoordinate(value);
    setRaValid(parsed !== null);
    if (parsed !== null) {
      onFormDataChange({ ...formData, ra: parsed, raString: degreesToHMS(parsed) });
    }
  };

  const handleDecChange = (value: string) => {
    setDecText(value);
    const parsed = parseDecCoordinate(value);
    setDecValid(parsed !== null);
    if (parsed !== null) {
      onFormDataChange({ ...formData, dec: parsed, decString: degreesToDMS(parsed) });
    }
  };

  const coordinatesValid = raValid && decValid;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="standard-form">
      <ResponsiveDialogContent className="sm:max-w-md max-h-[92vh] max-h-[92dvh] overflow-hidden flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {editingMarker ? t('markers.editMarker') : t('markers.addMarker')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="grid gap-4 py-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-2">
            <Label htmlFor="name">{t('markers.name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder={t('markers.namePlaceholder')}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">{t('markers.description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder={t('markers.descriptionPlaceholder')}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="marker-ra">{t('coordinates.ra')}</Label>
              <Input
                id="marker-ra"
                value={raText}
                onChange={(e) => handleRaChange(e.target.value)}
                placeholder="00h 42m 44s"
                autoComplete="off"
                className="font-mono"
                aria-invalid={!raValid}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="marker-dec">{t('coordinates.dec')}</Label>
              <Input
                id="marker-dec"
                value={decText}
                onChange={(e) => handleDecChange(e.target.value)}
                placeholder={'+41° 16\' 09"'}
                autoComplete="off"
                className="font-mono"
                aria-invalid={!decValid}
              />
            </div>
            {!coordinatesValid && (
              <p className="col-span-2 text-xs text-destructive" data-testid="marker-coords-error">
                {t('coordinates.invalidCoordinates')}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>{t('markers.icon')}</Label>
            <ToggleGroup
              type="single"
              value={formData.icon}
              onValueChange={(value) => value && onFormDataChange({ ...formData, icon: value as MarkerIcon })}
              className="flex-wrap justify-start"
            >
              {MARKER_ICONS.map((icon) => {
                const IconComponent = MarkerIconDisplay[icon];
                return (
                  <ToggleGroupItem
                    key={icon}
                    value={icon}
                    aria-label={icon}
                    className="h-9 w-9"
                  >
                    <IconComponent className="h-4 w-4" />
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>

          <div className="grid gap-2">
            <Label>{t('markers.color')}</Label>
            <div className="flex gap-1 flex-wrap">
              {MARKER_COLORS.map((color) => (
                <Button
                  key={color}
                  variant="ghost"
                  size="icon"
                  aria-label={color}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 p-0',
                    formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => onFormDataChange({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group">{t('markers.group')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Input
                  id="group"
                  value={formData.group}
                  onChange={(e) => onFormDataChange({ ...formData, group: e.target.value })}
                  placeholder={t('markers.groupPlaceholder')}
                  autoComplete="off"
                />
              </PopoverTrigger>
              {groups.length > 0 && (
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-1"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                    {groups
                      .filter((g) => !formData.group || g.toLowerCase().includes(formData.group.toLowerCase()))
                      .map((group) => (
                        <Button
                          key={group}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm h-auto px-2 py-1.5"
                          onClick={() => onFormDataChange({ ...formData, group })}
                        >
                          {group}
                        </Button>
                      ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          </div>
        </div>
        <ResponsiveDialogFooter stickyOnMobile>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSave} disabled={!formData.name.trim() || !coordinatesValid}>
            {t('common.save')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
