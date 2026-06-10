'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  List,
  Plus,
  Trash2,
  Play,
  Check,
  ChevronUp,
  ChevronDown,
  Target,
  Clock,
  Camera,
  X,
  Eye,
  AlertTriangle,
  Moon,
  BarChart3,
  Star,
  Archive,
  Square,
  Heart,
  Layers,
  Download,
  Upload,
  FileText,
  MoreVertical,
  Search,
  Filter,
  Tag,
  SortAsc,
  SortDesc,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

import { cn } from '@/lib/utils';
import { useTargetListStore, useMountStore, useEquipmentStore, useStellariumStore, usePlanningUiStore, type TargetItem } from '@/lib/stores';
import { tauriApi } from '@/lib/tauri';
import { isTauri } from '@/lib/storage/platform';
import { toast } from 'sonner';
import type { ExportFormat, TargetExportItem } from '@/lib/tauri/types';
import { TranslatedName } from '../objects/translated-name';
import {
  planMultipleTargets,
  calculateImagingFeasibility,
  formatTimeShort,
  formatDuration,
  type ImagingFeasibility,
} from '@/lib/astronomy/astro-utils';
import { getStatusColor, getPriorityColor } from '@/lib/core/constants/planning-styles';
import type { PlannedTarget } from '@/lib/core/types/astronomy';
import { FeasibilityBadge } from './feasibility-badge';
import type { ShotListProps } from '@/types/starmap/planning';
import { TargetDetailDialog } from './target-detail-dialog';
import { createLogger } from '@/lib/logger';

const logger = createLogger('shot-list');


interface TargetCardProps {
  target: TargetItem;
  index: number;
  total: number;
  isSelected: boolean;
  isActive: boolean;
  isManualSort: boolean;
  feasibility?: ImagingFeasibility;
  planTarget?: PlannedTarget;
  t: ReturnType<typeof useTranslations>;
  onToggleSelection: (id: string) => void;
  onNavigate: (target: TargetItem) => void;
  onStatusChange: (id: string, status: TargetItem['status']) => void;
  onDelete: (target: TargetItem) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number, total: number) => void;
  onUpdateTarget: (id: string, updates: Partial<TargetItem>) => void;
  onToggleFavorite: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onEdit: (target: TargetItem) => void;
}

const TargetCard = memo(function TargetCard({
  target, index, total, isSelected, isActive, isManualSort,
  feasibility, planTarget, t,
  onToggleSelection, onNavigate, onStatusChange, onDelete,
  onMoveUp, onMoveDown, onUpdateTarget, onToggleFavorite, onToggleArchive, onEdit,
}: TargetCardProps) {
  return (
    <Card
      className={cn(
        'transition-colors',
        isActive
          ? 'bg-primary/20 border-primary'
          : isSelected
          ? 'bg-accent/30 border-accent'
          : 'bg-muted/50 border-border hover:border-muted-foreground'
      )}
    >
      <CardContent className="p-2">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(target.id)}
          className="mt-0.5 h-4 w-4"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <button
              className="text-sm text-foreground font-medium truncate flex-1 text-left hover:text-primary transition-colors"
              onClick={() => onEdit(target)}
            >
              <TranslatedName name={target.name} />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className={`h-5 w-5 ${target.isFavorite ? 'text-red-400' : 'text-muted-foreground/50 hover:text-red-400'}`}
              onClick={() => onToggleFavorite(target.id)}
            >
              <Heart className={`h-3 w-3 ${target.isFavorite ? 'fill-red-400' : ''}`} />
            </Button>
            {target.isArchived && (
              <Archive className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            {target.raString} / {target.decString}
          </p>
          {target.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {target.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="h-4 text-[9px] px-1">
                  {tag}
                </Badge>
              ))}
              {target.tags.length > 3 && (
                <Badge variant="secondary" className="h-4 text-[9px] px-1">
                  +{target.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          {target.notes && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate italic">
              {target.notes}
            </p>
          )}
        </div>
        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Badge className={`${getStatusColor(target.status)} text-white text-[10px] h-5 cursor-pointer`}>
              {t(`shotList.${target.status === 'in_progress' ? 'inProgress' : target.status}`)}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(['planned', 'in_progress', 'completed'] as const).map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={target.status === s}
                onCheckedChange={() => onStatusChange(target.id, s)}
              >
                {t(`shotList.${s === 'in_progress' ? 'inProgress' : s}`)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* FOV info */}
      {target.focalLength && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Camera className="h-3 w-3" />
          <span>{target.focalLength}mm</span>
          {target.mosaic?.enabled && (
            <span>• {target.mosaic.cols}×{target.mosaic.rows}</span>
          )}
        </div>
      )}

      {/* Exposure plan */}
      {target.exposurePlan && (
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {target.exposurePlan.subFrames}× {target.exposurePlan.singleExposure}s
            ({target.exposurePlan.totalExposure}m)
          </span>
        </div>
      )}

      {/* Feasibility indicator */}
      {feasibility && (
        <div className="mt-1.5 space-y-1">
          <FeasibilityBadge feasibility={feasibility} variant="badge" tooltipSide="left" />
          {planTarget?.windowStart && planTarget?.windowEnd && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Moon className="h-3 w-3" />
              <span>
                {formatTimeShort(planTarget.windowStart)} - {formatTimeShort(planTarget.windowEnd)}
                {planTarget.duration != null && ` (${formatDuration(planTarget.duration)})`}
              </span>
            </div>
          )}
          {planTarget?.conflicts && planTarget.conflicts.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              <span>{t('shotList.overlapsWith', { count: planTarget.conflicts.length })}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {isManualSort && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => onMoveDown(index, total)}
                disabled={index === total - 1}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] h-5 cursor-pointer ${getPriorityColor(target.priority)}`}
            onClick={() => {
              const priorities: TargetItem['priority'][] = ['low', 'medium', 'high'];
              const currentIdx = priorities.indexOf(target.priority);
              const nextPriority = priorities[(currentIdx + 1) % 3];
              onUpdateTarget(target.id, { priority: nextPriority });
            }}
          >
            {t(`shotList.priority.${target.priority}`)}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-primary hover:text-primary/80"
                onClick={() => onNavigate(target)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('actions.goToTarget')}</TooltipContent>
          </Tooltip>

          {target.status === 'planned' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-400 hover:text-amber-300"
                  onClick={() => onStatusChange(target.id, 'in_progress')}
                >
                  <Play className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('actions.startImaging')}</TooltipContent>
            </Tooltip>
          )}

          {target.status === 'in_progress' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-400 hover:text-green-300"
                  onClick={() => onStatusChange(target.id, 'completed')}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('actions.markComplete')}</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-muted-foreground/80"
                onClick={() => onToggleArchive(target.id)}
              >
                <Archive className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{target.isArchived ? t('shotList.unarchive') : t('shotList.archive')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-400 hover:text-red-300"
                onClick={() => onDelete(target)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.remove')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      </CardContent>
    </Card>
  );
});
TargetCard.displayName = 'TargetCard';


export function ShotList({
  onNavigateToTarget,
  currentSelection,
}: ShotListProps) {
  const t = useTranslations();
  const open = usePlanningUiStore((state) => state.shotListOpen);
  const setOpen = usePlanningUiStore((state) => state.setShotListOpen);
  const [showPlanAnalysis, setShowPlanAnalysis] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetItem | null>(null);
  
  // Store state
  const targets = useTargetListStore((state) => state.targets);
  const activeTargetId = useTargetListStore((state) => state.activeTargetId);
  const selectedIds = useTargetListStore((state) => state.selectedIds);
  const groupBy = useTargetListStore((state) => state.groupBy);
  const showArchived = useTargetListStore((state) => state.showArchived);
  const searchQuery = useTargetListStore((state) => state.searchQuery);
  const filterStatus = useTargetListStore((state) => state.filterStatus);
  const filterPriority = useTargetListStore((state) => state.filterPriority);
  const sortBy = useTargetListStore((state) => state.sortBy);
  const sortOrder = useTargetListStore((state) => state.sortOrder);
  
  // Store actions
  const addTarget = useTargetListStore((state) => state.addTarget);
  const removeTarget = useTargetListStore((state) => state.removeTarget);
  const updateTarget = useTargetListStore((state) => state.updateTarget);
  const setActiveTarget = useTargetListStore((state) => state.setActiveTarget);
  const reorderTargets = useTargetListStore((state) => state.reorderTargets);
  const clearCompleted = useTargetListStore((state) => state.clearCompleted);
  const clearAll = useTargetListStore((state) => state.clearAll);
  const toggleSelection = useTargetListStore((state) => state.toggleSelection);
  const selectAll = useTargetListStore((state) => state.selectAll);
  const clearSelection = useTargetListStore((state) => state.clearSelection);
  const setGroupBy = useTargetListStore((state) => state.setGroupBy);
  const setShowArchived = useTargetListStore((state) => state.setShowArchived);
  const setSearchQuery = useTargetListStore((state) => state.setSearchQuery);
  const setFilterStatus = useTargetListStore((state) => state.setFilterStatus);
  const setFilterPriority = useTargetListStore((state) => state.setFilterPriority);
  const setSortBy = useTargetListStore((state) => state.setSortBy);
  const setSortOrder = useTargetListStore((state) => state.setSortOrder);
  const removeTargetsBatch = useTargetListStore((state) => state.removeTargetsBatch);
  const setStatusBatch = useTargetListStore((state) => state.setStatusBatch);
  const setPriorityBatch = useTargetListStore((state) => state.setPriorityBatch);
  const addTargetsBatch = useTargetListStore((state) => state.addTargetsBatch);
  const getFilteredTargets = useTargetListStore((state) => state.getFilteredTargets);
  const getGroupedTargets = useTargetListStore((state) => state.getGroupedTargets);
  const toggleFavorite = useTargetListStore((state) => state.toggleFavorite);
  const toggleArchive = useTargetListStore((state) => state.toggleArchive);
  const addTagBatch = useTargetListStore((state) => state.addTagBatch);
  const removeTagBatch = useTargetListStore((state) => state.removeTagBatch);
  const availableTags = useTargetListStore((state) => state.availableTags);
  const checkDuplicate = useTargetListStore((state) => state.checkDuplicate);
  
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const profileInfo = useMountStore((state) => state.profileInfo);
  
  // Equipment store for FOV settings
  const sensorWidth = useEquipmentStore((state) => state.sensorWidth);
  const sensorHeight = useEquipmentStore((state) => state.sensorHeight);
  const focalLength = useEquipmentStore((state) => state.focalLength);
  const rotationAngle = useEquipmentStore((state) => state.rotationAngle);
  const mosaic = useEquipmentStore((state) => state.mosaic);
  
  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;

  // Calculate multi-target plan with feasibility. Gated on `open`: every
  // consumer lives inside the (closed-unmounted) DrawerContent, so there is no
  // reason to run this O(n^2) plan while the shot list is closed.
  const targetPlan = useMemo(() => {
    if (!open || targets.length === 0) return null;

    const targetData = targets.map(t => ({
      id: t.id,
      name: t.name,
      ra: t.ra,
      dec: t.dec,
    }));

    return planMultipleTargets(targetData, latitude, longitude);
  }, [open, targets, latitude, longitude]);

  // Get feasibility for individual targets (also drawer-only, gated on `open`).
  const targetFeasibility = useMemo(() => {
    const feasibilityMap = new Map<string, ImagingFeasibility>();
    if (!open) return feasibilityMap;

    targets.forEach(target => {
      const feasibility = calculateImagingFeasibility(
        target.ra, target.dec, latitude, longitude
      );
      feasibilityMap.set(target.id, feasibility);
    });

    return feasibilityMap;
  }, [open, targets, latitude, longitude]);

  // Filtered targets — memoized on the real filter inputs (all subscribed
  // above) so an unrelated ShotList re-render doesn't re-run the filter/sort.
  const filteredTargets = useMemo(
    () => getFilteredTargets(),
    // getFilteredTargets reads these store slices internally; list them so the
    // memo recomputes when the filter/sort inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getFilteredTargets, targets, showArchived, searchQuery, filterStatus, sortBy],
  );

  const handleAddCurrentTarget = useCallback(() => {
    if (!currentSelection) return;
    
    const duplicate = checkDuplicate(currentSelection.name, currentSelection.ra, currentSelection.dec);
    if (duplicate) {
      toast.warning(t('shotList.duplicateWarning', { name: duplicate.name }), {
        action: {
          label: t('shotList.addAnyway'),
          onClick: () => {
            addTarget({
              name: currentSelection.name,
              ra: currentSelection.ra,
              dec: currentSelection.dec,
              raString: currentSelection.raString,
              decString: currentSelection.decString,
              sensorWidth,
              sensorHeight,
              focalLength,
              rotationAngle,
              mosaic: mosaic.enabled ? {
                enabled: mosaic.enabled,
                rows: mosaic.rows,
                cols: mosaic.cols,
                overlap: mosaic.overlap,
              } : undefined,
              priority: 'medium',
            });
          },
        },
        duration: 5000,
      });
      return;
    }
    
    addTarget({
      name: currentSelection.name,
      ra: currentSelection.ra,
      dec: currentSelection.dec,
      raString: currentSelection.raString,
      decString: currentSelection.decString,
      sensorWidth,
      sensorHeight,
      focalLength,
      rotationAngle,
      mosaic: mosaic.enabled ? {
        enabled: mosaic.enabled,
        rows: mosaic.rows,
        cols: mosaic.cols,
        overlap: mosaic.overlap,
      } : undefined,
      priority: 'medium',
    });
  }, [currentSelection, sensorWidth, sensorHeight, focalLength, rotationAngle, mosaic, addTarget, checkDuplicate, t]);

  const handleNavigate = useCallback((target: TargetItem) => {
    setActiveTarget(target.id);
    if (setViewDirection) {
      setViewDirection(target.ra, target.dec);
    }
    onNavigateToTarget?.(target.ra, target.dec);
  }, [setActiveTarget, setViewDirection, onNavigateToTarget]);

  const handleMoveUp = useCallback((index: number) => {
    if (index > 0) {
      reorderTargets(index, index - 1);
    }
  }, [reorderTargets]);

  const handleMoveDown = useCallback((index: number, total: number) => {
    if (index < total - 1) {
      reorderTargets(index, index + 1);
    }
  }, [reorderTargets]);

  const handleStatusChange = useCallback((id: string, status: TargetItem['status']) => {
    updateTarget(id, { status });
  }, [updateTarget]);

  const handleDeleteWithUndo = useCallback((target: TargetItem) => {
    removeTarget(target.id);
    toast(t('shotList.targetRemoved', { name: target.name }), {
      action: {
        label: t('common.undo'),
        onClick: () => {
          addTarget({
            name: target.name,
            ra: target.ra,
            dec: target.dec,
            raString: target.raString,
            decString: target.decString,
            priority: target.priority,
            notes: target.notes,
            tags: target.tags,
            sensorWidth: target.sensorWidth,
            sensorHeight: target.sensorHeight,
            focalLength: target.focalLength,
            rotationAngle: target.rotationAngle,
            mosaic: target.mosaic,
            exposurePlan: target.exposurePlan,
          });
        },
      },
      duration: 5000,
    });
  }, [removeTarget, addTarget, t]);

  // Grouped targets for rendering
  // Drawer-only and correctly keyed. The previous memo keyed on the stable
  // getGroupedTargets ref, so it computed once and went stale when the targets
  // or filters changed (the grouped view showed outdated groups).
  const groupedTargets = useMemo(
    () => (open ? getGroupedTargets() : new Map<string, TargetItem[]>()),
    // getGroupedTargets re-derives from the filtered targets + groupBy; key on
    // them so the grouped view stays fresh (the old [getGroupedTargets] memo
    // keyed on a stable ref and never updated).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open, getGroupedTargets, filteredTargets, groupBy],
  );
  const hasActiveFilters = searchQuery.trim() !== '' || filterStatus !== 'all' || filterPriority !== 'all';
  const isManualSort = sortBy === 'manual';

  // Batch actions
  const handleBatchDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    removeTargetsBatch(ids);
  }, [selectedIds, removeTargetsBatch]);

  const handleBatchStatus = useCallback((status: TargetItem['status']) => {
    const ids = Array.from(selectedIds);
    setStatusBatch(ids, status);
    clearSelection();
  }, [selectedIds, setStatusBatch, clearSelection]);

  const handleBatchPriority = useCallback((priority: TargetItem['priority']) => {
    const ids = Array.from(selectedIds);
    setPriorityBatch(ids, priority);
    clearSelection();
  }, [selectedIds, setPriorityBatch, clearSelection]);

  // Import/Export handlers
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!isTauri()) {
      toast.error(t('shotList.desktopOnly'));
      return;
    }
    
    if (targets.length === 0) {
      toast.error(t('shotList.noTargetsToExport'));
      return;
    }

    try {
      const exportTargets: TargetExportItem[] = targets.map(target => ({
        name: target.name,
        ra: target.ra,
        dec: target.dec,
        ra_string: target.raString,
        dec_string: target.decString,
        priority: target.priority,
        tags: target.tags.join(', '),
        notes: target.notes,
      }));

      const result = await tauriApi.targetIo.exportTargets(exportTargets, format);
      toast.success(t('shotList.exportSuccess'), {
        description: result,
      });
    } catch (error) {
      logger.error('Export failed', error);
      toast.error(t('shotList.exportFailed'), {
        description: String(error),
      });
    }
  }, [targets, t]);

  const handleImport = useCallback(async () => {
    if (!isTauri()) {
      toast.error(t('shotList.desktopOnly'));
      return;
    }

    try {
      const result = await tauriApi.targetIo.importTargets();
      
      if (result.targets.length > 0) {
        // Convert imported targets to our format and add them
        const batchTargets = result.targets.map(t => ({
          name: t.name,
          ra: t.ra,
          dec: t.dec,
          raString: t.ra_string,
          decString: t.dec_string,
        }));
        
        addTargetsBatch(batchTargets, { priority: 'medium' });
        
        toast.success(t('shotList.importSuccess'), {
          description: t('shotList.importDescription', { imported: result.imported, skipped: result.skipped }),
        });
      } else {
        toast.info(t('shotList.noTargetsImported'));
      }
      
      if (result.errors.length > 0) {
        logger.warn('Import warnings', { errors: result.errors });
      }
    } catch (error) {
      logger.error('Import failed', error);
      toast.error(t('shotList.importFailed'), {
        description: String(error),
      });
    }
  }, [t, addTargetsBatch]);




  const plannedCount = filteredTargets.filter((t) => t.status === 'planned').length;
  const completedCount = filteredTargets.filter((t) => t.status === 'completed').length;
  const selectedCount = selectedIds.size;

  return (
    <TooltipProvider>
      <Drawer open={open} onOpenChange={setOpen} direction="right">
        <Tooltip>
          <TooltipTrigger asChild>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent relative touch-target toolbar-btn"
              >
                <List className="h-5 w-5" />
                {targets.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full text-[10px] flex items-center justify-center text-primary-foreground animate-bounce-in">
                    {targets.length}
                  </span>
                )}
              </Button>
            </DrawerTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t('shotList.shotList')} ({targets.length})</p>
          </TooltipContent>
        </Tooltip>

        <DrawerContent className="w-[85vw] max-w-[360px] sm:max-w-[420px] md:max-w-[480px] h-full bg-card border-border drawer-content">
          <DrawerHeader>
            <DrawerTitle className="text-foreground flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('shotList.shotList')}
            </DrawerTitle>
          </DrawerHeader>

          <div className="mt-4 flex flex-col gap-4 flex-1 min-h-0">
            {/* Stats & Toolbar */}
            <div className="space-y-2">
              {/* Stats Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {plannedCount} {t('shotList.planned')}
                  </Badge>
                  <Badge variant="outline" className="border-green-600 text-green-400">
                    {completedCount} {t('shotList.done')}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {targets.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowPlanAnalysis(!showPlanAnalysis)}
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {t('shotList.analysis')}
                    </Button>
                  )}
                  
                  {/* View/Sort/Group Options Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Layers className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>{t('shotList.groupBy')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={groupBy === 'none'}
                        onCheckedChange={() => setGroupBy('none')}
                      >
                        {t('shotList.noGrouping')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={groupBy === 'priority'}
                        onCheckedChange={() => setGroupBy('priority')}
                      >
                        {t('shotList.byPriority')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={groupBy === 'status'}
                        onCheckedChange={() => setGroupBy('status')}
                      >
                        {t('shotList.byStatus')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={groupBy === 'tag'}
                        onCheckedChange={() => setGroupBy('tag')}
                      >
                        {t('shotList.byTag')}
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t('shotList.sortByLabel')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(['manual', 'name', 'priority', 'status', 'addedAt', 'feasibility'] as const).map((s) => (
                        <DropdownMenuCheckboxItem
                          key={s}
                          checked={sortBy === s}
                          onCheckedChange={() => setSortBy(s)}
                        >
                          {t(`shotList.sort.${s}`)}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {sortBy !== 'manual' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                            {sortOrder === 'asc' ? <SortAsc className="h-3 w-3 mr-2" /> : <SortDesc className="h-3 w-3 mr-2" />}
                            {sortOrder === 'asc' ? t('shotList.sort.ascending') : t('shotList.sort.descending')}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={showArchived}
                        onCheckedChange={setShowArchived}
                      >
                        <Archive className="h-3 w-3 mr-2" />
                        {t('shotList.showArchived')}
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Filter Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className={`h-7 w-7 ${hasActiveFilters ? 'text-primary' : ''}`}>
                        <Filter className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>{t('shotList.filterByStatus')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(['all', 'planned', 'in_progress', 'completed'] as const).map((s) => (
                        <DropdownMenuCheckboxItem
                          key={s}
                          checked={filterStatus === s}
                          onCheckedChange={() => setFilterStatus(s)}
                        >
                          {s === 'all' ? t('shotList.allTargets') : t(`shotList.${s === 'in_progress' ? 'inProgress' : s}`)}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t('shotList.filterByPriority')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                        <DropdownMenuCheckboxItem
                          key={p}
                          checked={filterPriority === p}
                          onCheckedChange={() => setFilterPriority(p)}
                        >
                          {p === 'all' ? t('shotList.allTargets') : t(`shotList.${p}Priority`)}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {hasActiveFilters && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setSearchQuery(''); }}>
                            <X className="h-3 w-3 mr-2" />
                            {t('shotList.clearFilters')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Import/Export Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>{t('shotList.importExport')}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleImport} disabled={!isTauri()}>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('shotList.import')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        {t('shotList.exportAs')}
                      </DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={() => handleExport('csv')} 
                        disabled={targets.length === 0 || !isTauri()}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleExport('json')} 
                        disabled={targets.length === 0 || !isTauri()}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleExport('stellarium')} 
                        disabled={targets.length === 0 || !isTauri()}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Stellarium
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleExport('mosaic')} 
                        disabled={targets.length === 0 || !isTauri()}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Mosaic Planner
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              {/* Search bar */}
              {targets.length > 0 && (
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('shotList.searchPlaceholder')}
                  inputClassName="h-7 text-xs bg-muted/50"
                />
              )}
              
              {/* Multi-select toolbar */}
              {selectedCount > 0 && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center gap-2 text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearSelection}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t('search.clearSelection')}
                    </Button>
                    <span className="text-muted-foreground">
                      {t('search.selectedCount', { count: selectedCount })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Batch Status */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Play className="h-3 w-3 mr-1" />
                          {t('shotList.setStatus')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBatchStatus('planned')}>
                          {t('shotList.planned')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchStatus('in_progress')}>
                          {t('shotList.inProgress')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchStatus('completed')}>
                          {t('shotList.completed')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Batch Priority */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Star className="h-3 w-3 mr-1" />
                          {t('shotList.setPriority')}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleBatchPriority('high')}>
                          {t('shotList.highPriority')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchPriority('medium')}>
                          {t('shotList.mediumPriority')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchPriority('low')}>
                          {t('shotList.lowPriority')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Batch Tag */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel className="text-xs">{t('shotList.addTagLabel')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableTags.map((tag) => (
                          <DropdownMenuItem key={tag} onClick={() => addTagBatch(Array.from(selectedIds), tag)}>
                            {tag}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-xs">{t('shotList.removeTagLabel')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableTags.map((tag) => (
                          <DropdownMenuItem key={`rm-${tag}`} onClick={() => removeTagBatch(Array.from(selectedIds), tag)}>
                            <X className="h-3 w-3 mr-1" />{tag}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Batch Archive */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            const ids = Array.from(selectedIds);
                            ids.forEach(id => toggleArchive(id));
                            clearSelection();
                          }}
                        >
                          <Archive className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('shotList.archiveSelected')}</TooltipContent>
                    </Tooltip>
                    
                    {/* Batch Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                      onClick={handleBatchDelete}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Select All / Clear when not in selection mode */}
              {targets.length > 0 && selectedCount === 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={selectAll}
                  >
                    <Square className="h-3 w-3 mr-1" />
                    {t('search.selectAll')}
                  </Button>
                </div>
              )}
            </div>

            {/* Plan Analysis Panel */}
            {showPlanAnalysis && targetPlan && (
              <div className="p-2 rounded-lg bg-muted/50 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('shotList.totalImaging')}</span>
                  <span className="text-foreground">{formatDuration(targetPlan.totalImagingTime)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t('shotList.nightCoverage')}</span>
                  <span className={targetPlan.nightCoverage > 100 ? 'text-yellow-400' : 'text-green-400'}>
                    {targetPlan.nightCoverage.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(100, targetPlan.nightCoverage)} className="h-1" />
                {targetPlan.nightCoverage > 100 && (
                  <div className="flex items-center gap-1 text-[10px] text-yellow-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{t('shotList.tooManyTargets')}</span>
                  </div>
                )}
                {targetPlan.recommendations.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {targetPlan.recommendations[0]}
                  </div>
                )}
              </div>
            )}

            {/* Add current target */}
            {currentSelection && (
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleAddCurrentTarget}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('shotList.addTarget', { name: currentSelection.name })}
              </Button>
            )}

            <Separator className="bg-border" />

            {/* Target list */}
            <ScrollArea className="flex-1 min-h-0">
              {targets.length === 0 ? (
                <EmptyState
                  icon={Target}
                  message={t('shotList.noTargetsInList')}
                  hint={t('shotList.selectAndAdd')}
                />
              ) : filteredTargets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <EmptyState icon={Search} message={t('shotList.noMatchingTargets')} className="py-0" />
                  <Button variant="link" size="sm" className="text-xs" onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setSearchQuery(''); }}>
                    {t('shotList.clearFilters')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {groupBy !== 'none' ? (
                    // Grouped rendering
                    Array.from(groupedTargets.entries()).map(([groupKey, groupTargets]) => (
                      <Collapsible key={groupKey} defaultOpen>
                        <CollapsibleTrigger className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-muted/50 text-xs font-medium text-muted-foreground">
                          <ChevronRight className="h-3 w-3 transition-transform data-[state=open]:rotate-90" />
                          <span className="capitalize">{groupKey}</span>
                          <Badge variant="secondary" className="h-4 text-[9px] px-1 ml-auto">
                            {groupTargets.length}
                          </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 mt-1">
                          {groupTargets.map((target, index) => (
                            <TargetCard
                              key={target.id}
                              target={target}
                              index={index}
                              total={groupTargets.length}
                              isSelected={selectedIds.has(target.id)}
                              isActive={activeTargetId === target.id}
                              isManualSort={false}
                              feasibility={targetFeasibility.get(target.id)}
                              planTarget={targetPlan?.targets.find(pt => pt.id === target.id)}
                              t={t}
                              onToggleSelection={toggleSelection}
                              onNavigate={handleNavigate}
                              onStatusChange={handleStatusChange}
                              onDelete={handleDeleteWithUndo}
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                              onUpdateTarget={updateTarget}
                              onToggleFavorite={toggleFavorite}
                              onToggleArchive={toggleArchive}
                              onEdit={setEditingTarget}
                            />
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  ) : (
                    // Flat rendering
                    filteredTargets.map((target, index) => (
                      <TargetCard
                        key={target.id}
                        target={target}
                        index={index}
                        total={filteredTargets.length}
                        isSelected={selectedIds.has(target.id)}
                        isActive={activeTargetId === target.id}
                        isManualSort={isManualSort}
                        feasibility={targetFeasibility.get(target.id)}
                        planTarget={targetPlan?.targets.find(pt => pt.id === target.id)}
                        t={t}
                        onToggleSelection={toggleSelection}
                        onNavigate={handleNavigate}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteWithUndo}
                        onMoveUp={handleMoveUp}
                        onMoveDown={handleMoveDown}
                        onUpdateTarget={updateTarget}
                        onToggleFavorite={toggleFavorite}
                        onToggleArchive={toggleArchive}
                        onEdit={setEditingTarget}
                      />
                    ))
                  )}
                </div>
              )}
            </ScrollArea>

            <TargetDetailDialog
              target={editingTarget}
              open={editingTarget !== null}
              onOpenChange={(isOpen) => { if (!isOpen) setEditingTarget(null); }}
            />

            {/* Footer actions */}
            {targets.length > 0 && (
              <>
                <Separator className="bg-border" />
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border text-muted-foreground hover:bg-accent"
                    onClick={clearCompleted}
                    disabled={completedCount === 0}
                  >
                    <X className="h-3 w-3 mr-1" />
                    {t('shotList.clearDone')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-red-600 text-red-400 hover:bg-red-900/30"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {t('shotList.clearAll')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">{t('shotList.clearAllTargets')}</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                          {t('shotList.clearAllDescription', { count: targets.length })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted border-border text-muted-foreground hover:bg-accent">
                          {t('common.cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={clearAll}
                        >
                          {t('shotList.clearAll')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </TooltipProvider>
  );
}


