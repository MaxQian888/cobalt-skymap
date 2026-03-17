'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Target,
  Star,
  Clock,
  Camera,
  Tag,
  FileText,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { useTargetListStore, type TargetItem } from '@/lib/stores';

interface TargetDetailDialogProps {
  target: TargetItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TargetDetailDialog({ target, open, onOpenChange }: TargetDetailDialogProps) {
  if (!target) return null;
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="standard-form">
      <TargetDetailForm key={target.id} target={target} onOpenChange={onOpenChange} />
    </ResponsiveDialog>
  );
}

function TargetDetailForm({ target, onOpenChange }: { target: TargetItem; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations();
  const updateTarget = useTargetListStore((state) => state.updateTarget);
  const availableTags = useTargetListStore((state) => state.availableTags);
  const addTag = useTargetListStore((state) => state.addTag);

  const [notes, setNotes] = useState(target.notes || '');
  const [priority, setPriority] = useState<TargetItem['priority']>(target.priority);
  const [status, setStatus] = useState<TargetItem['status']>(target.status);
  const [tags, setTags] = useState<string[]>([...target.tags]);
  const [newTag, setNewTag] = useState('');
  const [singleExposure, setSingleExposure] = useState(target.exposurePlan?.singleExposure?.toString() || '');
  const [totalExposure, setTotalExposure] = useState(target.exposurePlan?.totalExposure?.toString() || '');
  const [subFrames, setSubFrames] = useState(target.exposurePlan?.subFrames?.toString() || '');
  const [filter, setFilter] = useState(target.exposurePlan?.filter || '');

  const handleSingleExposureChange = (val: string) => {
    setSingleExposure(val);
    const se = parseFloat(val);
    const sf = parseInt(subFrames);
    if (se > 0 && sf > 0) {
      setTotalExposure(((se * sf) / 60).toFixed(1));
    }
  };

  const handleSubFramesChange = (val: string) => {
    setSubFrames(val);
    const se = parseFloat(singleExposure);
    const sf = parseInt(val);
    if (se > 0 && sf > 0) {
      setTotalExposure(((se * sf) / 60).toFixed(1));
    }
  };

  const handleTotalExposureChange = (val: string) => {
    setTotalExposure(val);
    const te = parseFloat(val);
    const se = parseFloat(singleExposure);
    if (te > 0 && se > 0) {
      setSubFrames(Math.ceil((te * 60) / se).toString());
    }
  };

  const handleSave = () => {
    if (!target) return;

    const exposurePlan = singleExposure || totalExposure || subFrames ? {
      singleExposure: parseFloat(singleExposure) || 0,
      totalExposure: parseFloat(totalExposure) || 0,
      subFrames: parseInt(subFrames) || 0,
      filter: filter || undefined,
      advanced: target.exposurePlan?.advanced,
    } : target.exposurePlan;

    updateTarget(target.id, {
      notes: notes || undefined,
      priority,
      status,
      tags,
      exposurePlan,
    });

    onOpenChange(false);
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      if (!availableTags.includes(trimmed)) {
        addTag(trimmed);
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddExistingTag = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
  };

  const formatMosaicPlanMinutes = (minutes: number | null | undefined) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null;
    return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min`;
  };

  return (
      <ResponsiveDialogContent className="sm:max-w-[440px] bg-card border-border flex max-h-[92vh] max-h-[92dvh] flex-col overflow-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            {target.name}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          {/* Coordinates (read-only) */}
          <div className="text-xs text-muted-foreground font-mono">
            RA: {target.raString} / Dec: {target.decString}
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('shotList.setStatus')}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TargetItem['status'])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">{t('shotList.planned')}</SelectItem>
                  <SelectItem value="in_progress">{t('shotList.inProgress')}</SelectItem>
                  <SelectItem value="completed">{t('shotList.completed')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('shotList.setPriority')}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TargetItem['priority'])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-red-400" />{t('shotList.highPriority')}</span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400" />{t('shotList.mediumPriority')}</span>
                  </SelectItem>
                  <SelectItem value="low">
                    <span className="flex items-center gap-1"><Star className="h-3 w-3 text-muted-foreground" />{t('shotList.lowPriority')}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {t('targetDetail.notes')}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('targetDetail.notesPlaceholder')}
              className="text-xs min-h-[60px] resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {t('targetDetail.tags')}
            </Label>
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="h-5 text-[10px] px-1.5 gap-1">
                  {tag}
                  <Button variant="ghost" size="icon" className="h-4 w-4 hover:text-red-400" onClick={() => handleRemoveTag(tag)}>
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder={t('targetDetail.newTag')}
                className="h-7 text-xs flex-1"
              />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddTag}>
                +
              </Button>
            </div>
            {availableTags.filter(t => !tags.includes(t)).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableTags.filter(t => !tags.includes(t)).map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="h-5 text-[10px] px-1.5 cursor-pointer hover:bg-accent"
                    onClick={() => handleAddExistingTag(tag)}
                  >
                    + {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Exposure Plan */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('targetDetail.exposurePlan')}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('targetDetail.singleExposure')}</Label>
                <Input
                  type="number"
                  value={singleExposure}
                  onChange={(e) => handleSingleExposureChange(e.target.value)}
                  placeholder="s"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('targetDetail.totalExposure')}</Label>
                <Input
                  type="number"
                  value={totalExposure}
                  onChange={(e) => handleTotalExposureChange(e.target.value)}
                  placeholder="min"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('targetDetail.subFrames')}</Label>
                <Input
                  type="number"
                  value={subFrames}
                  onChange={(e) => handleSubFramesChange(e.target.value)}
                  placeholder="#"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('targetDetail.filter')}</Label>
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="L, R, G, B..."
                  className="h-7 text-xs"
                />
              </div>
            </div>
            {/* Auto-calculated summary */}
            {parseFloat(singleExposure) > 0 && parseInt(subFrames) > 0 && (
              <div className="col-span-2 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                {parseInt(subFrames)} × {parseFloat(singleExposure)}s = {((parseFloat(singleExposure) * parseInt(subFrames)) / 60).toFixed(1)} {t('targetDetail.minutesTotal')}
              </div>
            )}
          </div>

          {/* FOV info (read-only) */}
          {target.focalLength && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-2">
              <Camera className="h-3 w-3" />
              <span>{target.focalLength}mm</span>
              {target.mosaic?.enabled && <span>• Mosaic {target.mosaic.cols}×{target.mosaic.rows}</span>}
            </div>
          )}

          {target.mosaicPlan && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                <span>{t('targetDetail.mosaicPlanPanels')}</span>
                <span>{target.mosaicPlan.totalPanels}</span>
                <span>{t('targetDetail.mosaicPlanLayout')}</span>
                <span>{target.mosaicPlan.layoutMode}</span>
                <span>{t('targetDetail.mosaicPlanOrder')}</span>
                <span>{target.mosaicPlan.panelOrder}</span>
                {formatMosaicPlanMinutes(target.mosaicPlan.estimatedTotalMinutes) && (
                  <>
                    <span>{t('targetDetail.mosaicPlanTime')}</span>
                    <span>{formatMosaicPlanMinutes(target.mosaicPlan.estimatedTotalMinutes)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card/95 pt-2 pb-[calc(var(--safe-area-bottom)+0.25rem)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSave}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
  );
}
