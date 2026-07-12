'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Plus,
  Save,
  Settings,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { generateStars } from '@/lib/astronomy/ocular-utils';
import type {
  BarlowPreset,
  EyepiecePreset,
  OcularTelescopePreset,
} from '@/lib/constants/equipment-presets';
import { useEquipmentStore } from '@/lib/stores';
import {
  useOcularSimulation,
  type OcularEquipmentSource,
} from '@/lib/hooks/use-ocular-simulation';
import type { OcularSimulatorProps, OcularViewPreviewProps } from '@/types/starmap/overlays';

function sourceLabel(t: ReturnType<typeof useTranslations>, source: OcularEquipmentSource): string {
  if (source === 'custom') return t('ocular.sourceCustom');
  if (source === 'desktop') return t('ocular.sourceDesktop');
  return t('ocular.sourceBuiltin');
}

function OcularViewPreview({
  tfov,
  magnification,
  exitPupil,
  isOverMagnified,
  isUnderMagnified,
}: OcularViewPreviewProps) {
  const stars = useMemo(() => {
    const baseStars = generateStars(40);
    const magFactor = Math.min(magnification / 20, 2.5);
    return baseStars.map((star) => ({
      ...star,
      size: Math.max(1, star.size * (1 + magFactor * 0.4)),
      opacity: star.opacity * Math.min(exitPupil / 3, 1),
    }));
  }, [exitPupil, magnification]);

  const viewSize = Math.min(190, Math.max(70, tfov * 82));
  const borderClass = isOverMagnified
    ? 'border-red-500/60'
    : isUnderMagnified
      ? 'border-yellow-500/60'
      : 'border-sky-400/50';

  return (
    <div className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-lg bg-black">
      <div
        className="absolute overflow-hidden rounded-full"
        style={{ width: viewSize, height: viewSize }}
      >
        {stars.map((star) => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              width: star.size,
              height: star.size,
              left: `${star.left}%`,
              top: `${star.top}%`,
              opacity: star.opacity,
            }}
          />
        ))}
      </div>
      <div className={cn('absolute rounded-full border-2', borderClass)} style={{ width: viewSize, height: viewSize }} />
      <div className="absolute bottom-2 rounded bg-black/70 px-1.5 text-[10px] text-white/75">
        TFOV {tfov.toFixed(2)}° · {magnification.toFixed(0)}x · EP {exitPupil.toFixed(1)}mm
      </div>
    </div>
  );
}

interface SelectorProps<T extends { id: string; name: string; source: OcularEquipmentSource; isCustom?: boolean }> {
  label: string;
  items: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleAdd: () => void;
  showAdd: boolean;
  form: ReactNode;
  renderLabel: (item: T) => string;
}

function EquipmentSelector<T extends { id: string; name: string; source: OcularEquipmentSource; isCustom?: boolean }>({
  label,
  items,
  selectedId,
  onSelect,
  onDelete,
  onToggleAdd,
  showAdd,
  form,
  renderLabel,
}: SelectorProps<T>) {
  const t = useTranslations();
  const selected = items.find((item) => item.id === selectedId);
  const builtin = items.filter((item) => item.source === 'builtin');
  const desktop = items.filter((item) => item.source === 'desktop');
  const custom = items.filter((item) => item.source === 'custom');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">{label}</Label>
          {selected && <Badge variant="secondary" className="h-4 px-1 text-[9px]">{sourceLabel(t, selected.source)}</Badge>}
        </div>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={onToggleAdd}>
          <Plus className="mr-0.5 h-3 w-3" />
          {t('ocular.addCustom')}
        </Button>
      </div>

      <div className="flex gap-1.5">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {builtin.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">{t('ocular.builtinPresets')}</SelectLabel>
                {builtin.map((item) => <SelectItem key={item.id} value={item.id} className="text-xs">{renderLabel(item)}</SelectItem>)}
              </SelectGroup>
            )}
            {desktop.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">{t('ocular.desktopPresets')}</SelectLabel>
                {desktop.map((item) => <SelectItem key={item.id} value={item.id} className="text-xs">{renderLabel(item)}</SelectItem>)}
              </SelectGroup>
            )}
            {custom.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px]">{t('ocular.customPresets')}</SelectLabel>
                {custom.map((item) => <SelectItem key={item.id} value={item.id} className="text-xs">{renderLabel(item)}</SelectItem>)}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {onDelete && selected?.isCustom && (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(selectedId)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {showAdd && form}
    </div>
  );
}

function isInRange(value: number | undefined, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function OcularSimulator({ onApplyFov, currentFov }: OcularSimulatorProps = {}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCustomTelescope, setShowCustomTelescope] = useState(false);
  const [showCustomEyepiece, setShowCustomEyepiece] = useState(false);
  const [showCustomBarlow, setShowCustomBarlow] = useState(false);
  const [fovBeforeApply, setFovBeforeApply] = useState<number | null>(null);
  const [displayBeforeApply, setDisplayBeforeApply] = useState<ReturnType<typeof useEquipmentStore.getState>['ocularDisplay'] | null>(null);

  const addCustomEyepiece = useEquipmentStore((s) => s.addCustomEyepiece);
  const addCustomBarlow = useEquipmentStore((s) => s.addCustomBarlow);
  const addCustomOcularTelescope = useEquipmentStore((s) => s.addCustomOcularTelescope);
  const removeCustomEyepiece = useEquipmentStore((s) => s.removeCustomEyepiece);
  const removeCustomBarlow = useEquipmentStore((s) => s.removeCustomBarlow);
  const removeCustomOcularTelescope = useEquipmentStore((s) => s.removeCustomOcularTelescope);
  const ocularDisplay = useEquipmentStore((s) => s.ocularDisplay);
  const setOcularDisplay = useEquipmentStore((s) => s.setOcularDisplay);

  const simulation = useOcularSimulation();

  const [customTelescopeForm, setCustomTelescopeForm] = useState<Partial<OcularTelescopePreset>>({ name: '', focalLength: 1000, aperture: 200, type: 'reflector' });
  const [customEyepieceForm, setCustomEyepieceForm] = useState<Partial<EyepiecePreset>>({ name: '', focalLength: 10, afov: 68 });
  const [customBarlowForm, setCustomBarlowForm] = useState<Partial<BarlowPreset>>({ name: '', magnification: 2 });

  const telescopeValid = customTelescopeForm.name?.trim() && isInRange(customTelescopeForm.focalLength, 50, 10000) && isInRange(customTelescopeForm.aperture, 20, 1000);
  const eyepieceValid = customEyepieceForm.name?.trim() && isInRange(customEyepieceForm.focalLength, 2, 80) && isInRange(customEyepieceForm.afov, 30, 120) && (customEyepieceForm.fieldStop === undefined || customEyepieceForm.fieldStop === 0 || isInRange(customEyepieceForm.fieldStop, 1, 60));
  const barlowValid = customBarlowForm.name?.trim() && isInRange(customBarlowForm.magnification, 0.2, 8);

  const onApply = useCallback(() => {
    if (!onApplyFov || !(simulation.viewData.tfov > 0)) return;
    if (fovBeforeApply === null && typeof currentFov === 'number' && Number.isFinite(currentFov)) {
      setFovBeforeApply(currentFov);
    }
    if (displayBeforeApply === null) setDisplayBeforeApply({ ...ocularDisplay });
    onApplyFov(simulation.viewData.tfov);
    setOcularDisplay({ enabled: true, appliedFov: simulation.viewData.tfov });
  }, [currentFov, displayBeforeApply, fovBeforeApply, ocularDisplay, onApplyFov, setOcularDisplay, simulation.viewData.tfov]);

  const onRestore = useCallback(() => {
    if (!onApplyFov || fovBeforeApply === null) return;
    onApplyFov(fovBeforeApply);
    setFovBeforeApply(null);
    if (displayBeforeApply) {
      setOcularDisplay(displayBeforeApply);
    } else {
      setOcularDisplay({ enabled: false, appliedFov: null });
    }
    setDisplayBeforeApply(null);
  }, [displayBeforeApply, fovBeforeApply, onApplyFov, setOcularDisplay]);

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="complex-editor">
      <ResponsiveDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('ocular.simulator')} className="h-9 w-9">
          <Eye className="h-4 w-4" />
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-[680px]" desktopClassName="overflow-hidden flex flex-col">
        <ResponsiveDialogHeader><ResponsiveDialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />{t('ocular.eyepieceSimulator')}</ResponsiveDialogTitle></ResponsiveDialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-2">
            <OcularViewPreview tfov={simulation.viewData.tfov} magnification={simulation.viewData.magnification} exitPupil={simulation.viewData.exitPupil} isOverMagnified={simulation.viewData.isOverMagnified} isUnderMagnified={simulation.viewData.isUnderMagnified} />
            {simulation.hasDesktopSource && <p className="text-[10px] text-blue-300">{t('ocular.desktopMergeHint')}</p>}

            <EquipmentSelector label={t('ocular.telescope')} items={simulation.telescopes} selectedId={simulation.selectedOcularTelescopeId} onSelect={simulation.setSelectedOcularTelescopeId} onDelete={removeCustomOcularTelescope} onToggleAdd={() => setShowCustomTelescope((p) => !p)} showAdd={showCustomTelescope} renderLabel={(item) => `${item.name} (f/${(item.focalLength / item.aperture).toFixed(1)})`} form={<Card className="border-dashed"><CardContent className="p-2.5 space-y-2"><Input placeholder={t('ocular.telescopeName')} className="h-7 text-xs" value={customTelescopeForm.name} onChange={(e) => setCustomTelescopeForm((p) => ({ ...p, name: e.target.value }))} /><div className="grid grid-cols-2 gap-2"><Input type="number" className="h-7 text-xs" value={customTelescopeForm.focalLength} onChange={(e) => setCustomTelescopeForm((p) => ({ ...p, focalLength: Number(e.target.value) }))} /><Input type="number" className="h-7 text-xs" value={customTelescopeForm.aperture} onChange={(e) => setCustomTelescopeForm((p) => ({ ...p, aperture: Number(e.target.value) }))} /></div>{!telescopeValid && <p className="text-[10px] text-destructive">{t('ocular.validationTelescope')}</p>}<Button size="sm" className="w-full h-7 text-xs" disabled={!telescopeValid} onClick={() => { if (!telescopeValid) return; addCustomOcularTelescope({ name: customTelescopeForm.name!.trim(), focalLength: customTelescopeForm.focalLength!, aperture: customTelescopeForm.aperture!, type: customTelescopeForm.type || 'reflector' }); setShowCustomTelescope(false); setCustomTelescopeForm({ name: '', focalLength: 1000, aperture: 200, type: 'reflector' }); }}><Save className="h-3 w-3 mr-1" />{t('common.save')}</Button></CardContent></Card>} />
            <EquipmentSelector label={t('ocular.eyepiece')} items={simulation.eyepieces} selectedId={simulation.selectedEyepieceId} onSelect={simulation.setSelectedEyepieceId} onDelete={removeCustomEyepiece} onToggleAdd={() => setShowCustomEyepiece((p) => !p)} showAdd={showCustomEyepiece} renderLabel={(item) => `${item.name} (${item.afov}° AFOV)`} form={<Card className="border-dashed"><CardContent className="p-2.5 space-y-2"><Input placeholder={t('ocular.eyepieceName')} className="h-7 text-xs" value={customEyepieceForm.name} onChange={(e) => setCustomEyepieceForm((p) => ({ ...p, name: e.target.value }))} /><div className="grid grid-cols-3 gap-2"><Input type="number" className="h-7 text-xs" value={customEyepieceForm.focalLength} onChange={(e) => setCustomEyepieceForm((p) => ({ ...p, focalLength: Number(e.target.value) }))} /><Input type="number" className="h-7 text-xs" value={customEyepieceForm.afov} onChange={(e) => setCustomEyepieceForm((p) => ({ ...p, afov: Number(e.target.value) }))} /><Input type="number" className="h-7 text-xs" value={customEyepieceForm.fieldStop ?? ''} onChange={(e) => setCustomEyepieceForm((p) => ({ ...p, fieldStop: e.target.value ? Number(e.target.value) : undefined }))} /></div>{!eyepieceValid && <p className="text-[10px] text-destructive">{t('ocular.validationEyepiece')}</p>}<Button size="sm" className="w-full h-7 text-xs" disabled={!eyepieceValid} onClick={() => { if (!eyepieceValid) return; addCustomEyepiece({ name: customEyepieceForm.name!.trim(), focalLength: customEyepieceForm.focalLength!, afov: customEyepieceForm.afov!, fieldStop: customEyepieceForm.fieldStop }); setShowCustomEyepiece(false); setCustomEyepieceForm({ name: '', focalLength: 10, afov: 68 }); }}><Save className="h-3 w-3 mr-1" />{t('common.save')}</Button></CardContent></Card>} />
            <EquipmentSelector label={t('ocular.barlowReducer')} items={simulation.barlows} selectedId={simulation.selectedBarlowId} onSelect={simulation.setSelectedBarlowId} onDelete={removeCustomBarlow} onToggleAdd={() => setShowCustomBarlow((p) => !p)} showAdd={showCustomBarlow} renderLabel={(item) => `${item.name} (${item.magnification}x)`} form={<Card className="border-dashed"><CardContent className="p-2.5 space-y-2"><Input placeholder={t('ocular.barlowName')} className="h-7 text-xs" value={customBarlowForm.name} onChange={(e) => setCustomBarlowForm((p) => ({ ...p, name: e.target.value }))} /><Input type="number" step="0.1" className="h-7 text-xs" value={customBarlowForm.magnification} onChange={(e) => setCustomBarlowForm((p) => ({ ...p, magnification: Number(e.target.value) }))} />{!barlowValid && <p className="text-[10px] text-destructive">{t('ocular.validationBarlow')}</p>}<Button size="sm" className="w-full h-7 text-xs" disabled={!barlowValid} onClick={() => { if (!barlowValid) return; addCustomBarlow({ name: customBarlowForm.name!.trim(), magnification: customBarlowForm.magnification! }); setShowCustomBarlow(false); setCustomBarlowForm({ name: '', magnification: 2 }); }}><Save className="h-3 w-3 mr-1" />{t('common.save')}</Button></CardContent></Card>} />

            <Separator />
            <div className="grid grid-cols-4 gap-2">
              <Card><CardContent className="p-2 text-center"><div className="text-lg font-bold text-primary">{simulation.viewData.magnification.toFixed(0)}x</div><div className="text-[10px] text-muted-foreground">{t('ocular.magnification')}</div></CardContent></Card>
              <Card><CardContent className="p-2 text-center"><div className="text-lg font-bold text-primary">{simulation.viewData.tfov.toFixed(simulation.viewData.tfov >= 1 ? 1 : 2)}°</div><div className="text-[10px] text-muted-foreground">{t('ocular.trueFov')}</div></CardContent></Card>
              <Card><CardContent className="p-2 text-center"><div className="text-lg font-bold text-primary">{simulation.viewData.exitPupil.toFixed(1)}mm</div><div className="text-[10px] text-muted-foreground">{t('ocular.exitPupil')}</div></CardContent></Card>
              <Card><CardContent className="p-2 text-center"><div className="text-lg font-bold text-primary">{simulation.viewData.dawesLimit.toFixed(1)}&quot;</div><div className="text-[10px] text-muted-foreground">{t('ocular.resolution')}</div></CardContent></Card>
            </div>

            <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={onApply} disabled={!onApplyFov}>{t('ocular.applyToMap')}</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRestore} disabled={!onApplyFov || fovBeforeApply === null}>{t('ocular.restoreFov')}</Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('ocular.overlayEnabled')}</Label>
                  <Switch checked={ocularDisplay.enabled} onCheckedChange={(enabled) => setOcularDisplay({ enabled, appliedFov: enabled ? (ocularDisplay.appliedFov ?? simulation.viewData.tfov) : null })} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between"><Label className="text-xs">{t('ocular.overlayOpacity')}</Label><span className="text-[10px]">{Math.round(ocularDisplay.opacity)}%</span></div>
                  <Slider value={[ocularDisplay.opacity]} min={10} max={95} step={1} onValueChange={(value) => setOcularDisplay({ opacity: value[0] ?? ocularDisplay.opacity })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t('ocular.overlayCrosshair')}</Label>
                  <Switch checked={ocularDisplay.showCrosshair} onCheckedChange={(showCrosshair) => setOcularDisplay({ showCrosshair })} />
                </div>
              </div>
            </div>

            {simulation.viewData.isOverMagnified && <Alert variant="destructive" className="py-2"><AlertTriangle className="h-3.5 w-3.5" /><AlertDescription className="text-xs">{t('ocular.overMagnifiedWarning')}</AlertDescription></Alert>}
            {simulation.viewData.isUnderMagnified && !simulation.viewData.isOverMagnified && <Alert className="py-2"><Info className="h-3.5 w-3.5" /><AlertDescription className="text-xs">{t('ocular.underMagnifiedWarning')}</AlertDescription></Alert>}

            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="w-full justify-between h-7"><span className="flex items-center gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" />{t('ocular.advancedInfo')}</span>{showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</Button></CollapsibleTrigger>
              <CollapsibleContent className="pt-2 grid grid-cols-2 gap-1.5 text-xs">
                <div className="flex justify-between p-1.5 bg-muted/50 rounded"><span>{t('ocular.focalRatio')}</span><span className="font-mono">f/{simulation.viewData.focalRatio.toFixed(1)}</span></div>
                <div className="flex justify-between p-1.5 bg-muted/50 rounded"><span>{t('ocular.effectiveFL')}</span><span className="font-mono">{simulation.viewData.effectiveFocalLength.toFixed(0)}mm</span></div>
                <div className="flex justify-between p-1.5 bg-muted/50 rounded"><span>{t('ocular.lightGathering')}</span><span className="font-mono">{simulation.viewData.lightGathering.toFixed(0)}x</span></div>
                <div className="flex justify-between p-1.5 bg-muted/50 rounded"><span>{t('ocular.limitingMag')}</span><span className="font-mono">{simulation.viewData.limitingMag.toFixed(1)}</span></div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
