'use client';

import { useState, useSyncExternalStore, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import {
  Telescope,
  Camera,
  Plus,
  Loader2,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useEquipment, tauriApi } from '@/lib/tauri';
import { useEquipmentStore } from '@/lib/stores/equipment-store';
import { createLogger } from '@/lib/logger';
import type { EquipmentManagerProps } from '@/types/starmap/management';
import { EmptyState } from '@/components/ui/empty-state';
import { EquipmentListItem } from './equipment-list-item';
import { TelescopeTab } from './equipment-telescope-tab';
import { CameraTab } from './equipment-camera-tab';

const logger = createLogger('equipment-manager');

export function EquipmentManager({ trigger }: EquipmentManagerProps) {
  const t = useTranslations();
  const { equipment, loading, refresh, isAvailable: isTauriAvailable } = useEquipment();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('telescopes');
  const [addingBarlow, setAddingBarlow] = useState(false);
  const [addingFilter, setAddingFilter] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'telescope' | 'camera' | 'barlow' | 'filter' } | null>(null);

  // Barlow form state
  const [barlowForm, setBarlowForm] = useState({
    name: '',
    factor: '',
  });

  // Filter form state
  const [filterForm, setFilterForm] = useState({
    name: '',
    filter_type: 'luminance' as string,
    bandwidth: '',
  });

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setAddingBarlow(false);
      setAddingFilter(false);
      setDeleteTarget(null);
      setBarlowForm({ name: '', factor: '' });
      setFilterForm({ name: '', filter_type: 'luminance', bandwidth: '' });
    }
  }, []);

  // Web equipment store (only for delete in web mode)
  const {
    removeCustomCamera,
    removeCustomTelescope,
    customTelescopes,
    customCameras,
  } = useEquipmentStore(useShallow((state) => ({
    removeCustomCamera: state.removeCustomCamera,
    removeCustomTelescope: state.removeCustomTelescope,
    customTelescopes: state.customTelescopes,
    customCameras: state.customCameras,
  })));

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    try {
      if (isTauriAvailable) {
        await tauriApi.equipment.delete(id);
        refresh();
      } else if (type === 'telescope') {
        removeCustomTelescope(id);
      } else if (type === 'camera') {
        removeCustomCamera(id);
      } else {
        // barlow/filter types are only available in Tauri mode;
        // this branch should not be reachable but guard against it
        logger.warn(`Cannot delete ${type} in web mode`);
        toast.error(t('equipment.deleteNotSupported') || 'This equipment type cannot be deleted in web mode');
        setDeleteTarget(null);
        return;
      }
      toast.success(t('equipment.deleted') || 'Equipment deleted');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, isTauriAvailable, refresh, removeCustomTelescope, removeCustomCamera, t]);

  // Fix hydration mismatch by only rendering Dialog after mount
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const handleAddBarlow = async () => {
    if (!barlowForm.name.trim()) {
      toast.error(t('equipment.fillRequired') || 'Please fill required fields');
      return;
    }
    const factor = parseFloat(barlowForm.factor);
    if (isNaN(factor) || factor < 0.1 || factor > 10) {
      toast.error(t('equipment.validation.factorRange') || 'Factor must be between 0.1 and 10');
      return;
    }

    try {
      await tauriApi.equipment.addBarlowReducer({
        name: barlowForm.name,
        factor,
      });
      
      toast.success(t('equipment.barlowAdded') || 'Barlow/Reducer added');
      setBarlowForm({ name: '', factor: '' });
      setAddingBarlow(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleAddFilter = async () => {
    if (!filterForm.name || !filterForm.filter_type) {
      toast.error(t('equipment.fillRequired') || 'Please fill required fields');
      return;
    }

    try {
      await tauriApi.equipment.addFilter({
        name: filterForm.name,
        filter_type: filterForm.filter_type,
        bandwidth: filterForm.bandwidth ? parseFloat(filterForm.bandwidth) : undefined,
      });
      
      toast.success(t('equipment.filterAdded') || 'Filter added');
      setFilterForm({ name: '', filter_type: 'luminance', bandwidth: '' });
      setAddingFilter(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Return null during SSR to avoid hydration mismatch
  if (!mounted) {
    return null;
  }

  // Determine raw data source
  const rawTelescopes = isTauriAvailable ? equipment?.telescopes ?? [] : customTelescopes;
  const rawCameras = isTauriAvailable ? equipment?.cameras ?? [] : customCameras;

  const handleDeleteRequest = (id: string, name: string, type: 'telescope' | 'camera' | 'barlow' | 'filter') => {
    setDeleteTarget({ id, name, type });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} tier="standard-form">
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            {trigger || (
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Wrench className="h-4 w-4" />
              </Button>
            )}
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('equipment.title') || 'Equipment Manager'}</p>
        </TooltipContent>
      </Tooltip>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {t('equipment.title') || 'Equipment Manager'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t('equipment.description') || 'Manage your telescopes, cameras, and accessories'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {isTauriAvailable && loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={isTauriAvailable ? "grid w-full grid-cols-4" : "grid w-full grid-cols-2"}>
              <TabsTrigger value="telescopes" className="flex items-center gap-1 text-xs">
                <Telescope className="h-3 w-3" />
                {t('equipment.telescopes') || 'Scopes'}
              </TabsTrigger>
              <TabsTrigger value="cameras" className="flex items-center gap-1 text-xs">
                <Camera className="h-3 w-3" />
                {t('equipment.cameras') || 'Cameras'}
              </TabsTrigger>
              {isTauriAvailable && (
                <>
                  <TabsTrigger value="barlows" className="flex items-center gap-1 text-xs">
                    <Plus className="h-3 w-3" />
                    {t('equipment.barlows') || 'Barlows'}
                  </TabsTrigger>
                  <TabsTrigger value="filters" className="flex items-center gap-1 text-xs">
                    <Wrench className="h-3 w-3" />
                    {t('equipment.filters') || 'Filters'}
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="telescopes">
              <TelescopeTab
                isTauriAvailable={isTauriAvailable}
                rawTelescopes={rawTelescopes}
                onDeleteRequest={(id, name) => handleDeleteRequest(id, name, 'telescope')}
                onRefresh={refresh}
              />
            </TabsContent>

            <TabsContent value="cameras">
              <CameraTab
                isTauriAvailable={isTauriAvailable}
                rawCameras={rawCameras}
                onDeleteRequest={(id, name) => handleDeleteRequest(id, name, 'camera')}
                onRefresh={refresh}
              />
            </TabsContent>

            {/* Barlows Tab (Tauri only) */}
            <TabsContent value="barlows" className="space-y-4">
              <ScrollArea className="h-[200px]">
                {equipment?.barlow_reducers.length === 0 ? (
                  <EmptyState
                    icon={Plus}
                    message={t('equipment.noBarlows') || 'No barlows/reducers added'}
                    iconClassName="h-10 w-10 mb-3"
                  />
                ) : (
                  <div className="space-y-2">
                    {equipment?.barlow_reducers.map((barlow) => (
                      <EquipmentListItem
                        key={barlow.id}
                        icon={Plus}
                        name={barlow.name}
                        detail={`${barlow.factor}x ${barlow.factor > 1 ? t('equipment.barlowLabel') : t('equipment.reducerLabel')}`}
                        deleteLabel={t('equipment.delete')}
                        onDelete={() => handleDeleteRequest(barlow.id, barlow.name, 'barlow')}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {addingBarlow ? (
                <Card className="py-3">
                  <CardContent className="space-y-3 px-3">
                  <form onSubmit={(e) => { e.preventDefault(); handleAddBarlow(); }}>
                  <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t('equipment.name') || 'Name'}</Label>
                      <Input
                        value={barlowForm.name}
                        onChange={(e) => setBarlowForm({ ...barlowForm, name: e.target.value })}
                        placeholder={t('equipment.barlowNamePlaceholder')}
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>{t('equipment.factor') || 'Factor'}</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={barlowForm.factor}
                        onChange={(e) => setBarlowForm({ ...barlowForm, factor: e.target.value })}
                        placeholder="2.0"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" type="submit">
                      {t('common.save') || 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => setAddingBarlow(false)}>
                      {t('common.cancel') || 'Cancel'}
                    </Button>
                  </div>
                  </div>
                  </form>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setAddingBarlow(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('equipment.addBarlow') || 'Add Barlow/Reducer'}
                </Button>
              )}
            </TabsContent>

            {/* Filters Tab (Tauri only) */}
            <TabsContent value="filters" className="space-y-4">
              <ScrollArea className="h-[200px]">
                {equipment?.filters.length === 0 ? (
                  <EmptyState
                    icon={Wrench}
                    message={t('equipment.noFilters') || 'No filters added'}
                    iconClassName="h-10 w-10 mb-3"
                  />
                ) : (
                  <div className="space-y-2">
                    {equipment?.filters.map((filter) => (
                      <EquipmentListItem
                        key={filter.id}
                        icon={Wrench}
                        name={filter.name}
                        detail={`${filter.filter_type}${filter.bandwidth ? ` (${filter.bandwidth}nm)` : ''}`}
                        deleteLabel={t('equipment.delete')}
                        onDelete={() => handleDeleteRequest(filter.id, filter.name, 'filter')}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {addingFilter ? (
                <Card className="py-3">
                  <CardContent className="space-y-3 px-3">
                  <form onSubmit={(e) => { e.preventDefault(); handleAddFilter(); }}>
                  <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>{t('equipment.name') || 'Name'}</Label>
                      <Input
                        value={filterForm.name}
                        onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })}
                        placeholder={t('equipment.filterNamePlaceholder')}
                        autoFocus
                      />
                    </div>
                    <div>
                      <Label>{t('equipment.type') || 'Type'}</Label>
                      <Select
                        value={filterForm.filter_type}
                        onValueChange={(v) => setFilterForm({ ...filterForm, filter_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="luminance">{t('equipment.filterTypes.luminance') || 'Luminance'}</SelectItem>
                          <SelectItem value="red">{t('equipment.filterTypes.red') || 'Red'}</SelectItem>
                          <SelectItem value="green">{t('equipment.filterTypes.green') || 'Green'}</SelectItem>
                          <SelectItem value="blue">{t('equipment.filterTypes.blue') || 'Blue'}</SelectItem>
                          <SelectItem value="ha">{t('equipment.filterTypes.ha') || 'H-Alpha'}</SelectItem>
                          <SelectItem value="oiii">{t('equipment.filterTypes.oiii') || 'OIII'}</SelectItem>
                          <SelectItem value="sii">{t('equipment.filterTypes.sii') || 'SII'}</SelectItem>
                          <SelectItem value="uhc_lps">{t('equipment.filterTypes.uhcLps') || 'UHC/LPS'}</SelectItem>
                          <SelectItem value="cls">{t('equipment.filterTypes.cls') || 'CLS'}</SelectItem>
                          <SelectItem value="other">{t('equipment.filterTypes.other') || 'Other'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>{t('equipment.bandwidth') || 'Bandwidth (nm)'}</Label>
                    <Input
                      type="number"
                      value={filterForm.bandwidth}
                      onChange={(e) => setFilterForm({ ...filterForm, bandwidth: e.target.value })}
                      placeholder="7"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" type="submit">
                      {t('common.save') || 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" type="button" onClick={() => setAddingFilter(false)}>
                      {t('common.cancel') || 'Cancel'}
                    </Button>
                  </div>
                  </div>
                  </form>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setAddingFilter(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('equipment.addFilter') || 'Add Filter'}
                </Button>
              )}
            </TabsContent>
          </Tabs>
        )}
      </ResponsiveDialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('equipment.deleteConfirmTitle') || 'Delete Equipment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('equipment.deleteConfirmDescription', { name: deleteTarget?.name ?? '' }) || 
                `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              {t('common.delete') || 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveDialog>
  );
}
