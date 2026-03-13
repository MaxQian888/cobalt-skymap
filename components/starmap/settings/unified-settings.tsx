'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Settings,
  RotateCcw,
  Save,
  Undo2,
  Eye,
  Camera,
  Sliders,
  HardDrive,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  useEquipmentStore,
  useOnboardingBridgeStore,
} from '@/lib/stores';
import { useThemeStore } from '@/lib/stores/theme-store';
import { useOnboardingStore } from '@/lib/stores/onboarding-store';
import { TOUR_DEFINITIONS } from '@/lib/constants/onboarding-capabilities';
import { MapProviderSettings, MapHealthMonitor, MapApiKeyManager } from '../map';
import { cn } from '@/lib/utils';
import { DisplaySettings } from './display-settings';
import { EquipmentSettings } from './equipment-settings';
import { FOVSettings } from './fov-settings';
import { ExposureSettings } from './exposure-settings';
import { LocationSettings } from './location-settings';
import { ConnectionSettings } from './connection-settings';
import { PreferencesTabContent } from './preferences-tab-content';
import { AboutSettings } from './about-settings';
import { DataManager } from '../management/data-manager';
import { OnboardingRestartButton } from '../onboarding/welcome-dialog';
import { EventSourcesSettings } from './event-sources-settings';
import { SettingsExportImport } from './settings-export-import';
import { StoragePathSettings } from './storage-path-settings';
import { UpdateSettings } from '../management/updater/update-settings';
import { DeviceWorkspace } from '../management/device-workspace';
import { isTauri } from '@/lib/tauri/app-control-api';
import {
  useSettingsDraftLifecycle,
  useSettingsDraftStatus,
} from '@/lib/hooks/use-settings-draft';

export function UnifiedSettings() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('display');
  const [mapRefreshToken, setMapRefreshToken] = useState(0);
  const [resetCurrentTabOpen, setResetCurrentTabOpen] = useState(false);
  const [pendingGlobalReset, setPendingGlobalReset] = useState(false);
  const openSettingsDrawerRequestId = useOnboardingBridgeStore((state) => state.openSettingsDrawerRequestId);
  const closeTransientPanelsRequestId = useOnboardingBridgeStore((state) => state.closeTransientPanelsRequestId);
  const settingsDrawerTab = useOnboardingBridgeStore((state) => state.settingsDrawerTab);
  const setSettingsDrawerOpen = useOnboardingBridgeStore((state) => state.setSettingsDrawerOpen);
  const handledOpenRequestRef = useRef(0);
  const handledCloseRequestRef = useRef(0);

  const startTourById = useOnboardingStore((state) => state.startTourById);
  const restartTourModule = useOnboardingStore((state) => state.restartTourModule);
  const resumeTour = useOnboardingStore((state) => state.resumeTour);
  const getTourProgress = useOnboardingStore((state) => state.getTourProgress);
  const completedTours = useOnboardingStore((state) => state.completedTours);

  const moduleTours = useMemo(
    () => TOUR_DEFINITIONS.filter((tour) => !tour.isCore),
    [],
  );

  const {
    startSession,
    cancelSession,
    clearSession,
    applyDraft,
    resetCategoryDraft,
    resetAllDraftToDefaults,
    clearLastApplyResult,
  } = useSettingsDraftLifecycle();

  const {
    hasDirty,
    canApply,
    sessionActive,
    validation,
  } = useSettingsDraftStatus();

  const resettableCategories = useMemo(() => {
    switch (activeTab) {
      case 'display':
        return ['connection', 'location'] as const;
      case 'preferences':
        return ['preferences', 'performance', 'accessibility', 'notifications', 'search'] as const;
      default:
        return [] as const;
    }
  }, [activeTab]);

  const canResetCurrentTab = resettableCategories.length > 0;

  const handleDrawerOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && sessionActive) {
      cancelSession();
      clearSession();
      setPendingGlobalReset(false);
    }
    setSettingsDrawerOpen(nextOpen);
    setOpen(nextOpen);
  }, [cancelSession, clearSession, sessionActive, setSettingsDrawerOpen]);

  useEffect(() => {
    if (open && !sessionActive) {
      startSession();
      clearLastApplyResult();
    }
  }, [clearLastApplyResult, open, sessionActive, startSession]);

  const handleCancelChanges = useCallback(() => {
    cancelSession();
    clearLastApplyResult();
    setPendingGlobalReset(false);
  }, [cancelSession, clearLastApplyResult]);

  const handleApplyChanges = useCallback(async () => {
    const result = await applyDraft();
    if (result.success) {
      if (pendingGlobalReset) {
        useEquipmentStore.getState().resetToDefaults();
        useThemeStore.getState().resetCustomization();
        setPendingGlobalReset(false);
      }
      toast.success(t('settings.settingsSaved'));
      return;
    }

    const failureSummary = result.failedDomains
      .map((failure) => `${failure.domain}: ${failure.error}`)
      .join('; ');

    toast.error(t('settings.settingsSaveFailed'), {
      description: failureSummary || undefined,
    });
  }, [applyDraft, pendingGlobalReset, t]);

  const handleResetCurrentTab = useCallback(() => {
    for (const category of resettableCategories) {
      resetCategoryDraft(category);
    }
    setResetCurrentTabOpen(false);
  }, [resetCategoryDraft, resettableCategories]);

  const handleResetAll = useCallback(() => {
    resetAllDraftToDefaults();
    setPendingGlobalReset(true);
  }, [resetAllDraftToDefaults]);

  const handleMapSettingsUpdated = useCallback(() => {
    setMapRefreshToken(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (
      openSettingsDrawerRequestId > 0 &&
      openSettingsDrawerRequestId !== handledOpenRequestRef.current
    ) {
      handledOpenRequestRef.current = openSettingsDrawerRequestId;
      const timer = window.setTimeout(() => {
        setSettingsDrawerOpen(true);
        setOpen(true);
        if (settingsDrawerTab) {
          setActiveTab(settingsDrawerTab);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [openSettingsDrawerRequestId, setSettingsDrawerOpen, settingsDrawerTab]);

  useEffect(() => {
    if (
      closeTransientPanelsRequestId > 0 &&
      closeTransientPanelsRequestId !== handledCloseRequestRef.current
    ) {
      handledCloseRequestRef.current = closeTransientPanelsRequestId;
      const timer = window.setTimeout(() => {
        setSettingsDrawerOpen(false);
        setOpen(false);
        setPendingGlobalReset(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [closeTransientPanelsRequestId, setSettingsDrawerOpen]);

  return (
    <Drawer open={open} onOpenChange={handleDrawerOpenChange} direction="right">
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger asChild>
            <Button
              data-tour-id="settings"
              data-testid="settings-button"
              variant="ghost"
              size="icon"
              aria-label={t('settings.allSettings')}
              title={t('settings.allSettings')}
              className={cn(
                "h-9 w-9 backdrop-blur-md border border-border/50 touch-target toolbar-btn",
                open
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "bg-card/80 text-foreground/80 hover:text-foreground hover:bg-accent"
              )}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t('settings.displaySettings')}</p>
        </TooltipContent>
      </Tooltip>
      
      <DrawerContent
        data-testid="settings-panel"
        aria-label={t('settings.allSettings')}
        className="w-[90vw] max-w-[340px] sm:max-w-[420px] md:max-w-[480px] h-full flex flex-col drawer-content"
      >
        <DrawerHeader className="border-b shrink-0 pb-2">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {t('settings.allSettings')}
            </DrawerTitle>
            <div className="flex items-center gap-1">
              <Button
                data-testid="settings-cancel-button"
                variant="ghost"
                size="sm"
                disabled={!(hasDirty || pendingGlobalReset)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleCancelChanges}
              >
                <Undo2 className="h-3 w-3 mr-1" />
                {t('common.cancel')}
              </Button>
              <Button
                data-testid="settings-save-button"
                variant="ghost"
                size="sm"
                disabled={!(canApply || pendingGlobalReset)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleApplyChanges}
              >
                <Save className="h-3 w-3 mr-1" />
                {t('common.save')}
              </Button>
              <AlertDialog open={resetCurrentTabOpen} onOpenChange={setResetCurrentTabOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canResetCurrentTab}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t('common.reset')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('common.reset')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.resetAllDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetCurrentTab}>
                      {t('common.reset')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t('settings.resetAll')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('common.reset')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.resetAllDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetAll}>
                      {t('common.reset')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {sessionActive && (
            <div className="pt-2 space-y-1">
              {(hasDirty || pendingGlobalReset) && (
                <p className="text-[11px] text-muted-foreground">
                  {t('settings.unsavedChanges')}
                </p>
              )}
              {!validation.isValid && (
                <p className="text-[11px] text-destructive">
                  {t('settings.settingsSaveFailed')} ({validation.issues.length})
                </p>
              )}
            </div>
          )}
        </DrawerHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-5 shrink-0 mx-2 sm:mx-4 mt-2 h-auto" style={{ width: 'calc(100% - 1rem)' }}>
            <TabsTrigger value="display" className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-1.5 flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto">
              <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline truncate">{t('settings.displayTab')}</span>
              <span className="sm:hidden truncate">{t('settings.displayTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-1.5 flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto">
              <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline truncate">{t('settings.equipmentTab')}</span>
              <span className="sm:hidden truncate">{t('settings.equipmentTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-1.5 flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto">
              <Sliders className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline truncate">{t('settingsNew.tabs.general')}</span>
              <span className="sm:hidden truncate">{t('settingsNew.tabs.generalShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-1.5 flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto">
              <HardDrive className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline truncate">{t('settings.dataTab')}</span>
              <span className="sm:hidden truncate">{t('settings.dataTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="about" className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-1.5 flex-col sm:flex-row gap-0.5 sm:gap-1 h-auto">
              <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline truncate">{t('settingsNew.tabs.about')}</span>
              <span className="sm:hidden truncate">{t('settingsNew.tabs.aboutShort')}</span>
            </TabsTrigger>
          </TabsList>

          {/* Display Settings Tab — includes stellarium display, connection, location */}
          <TabsContent value="display" className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-full">
              <DisplaySettings />
              <Separator className="mx-4" />
              <div className="px-4 pb-4">
                <ConnectionSettings />
                <Separator className="my-4" />
                <LocationSettings />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Equipment Tab — includes equipment, FOV, exposure */}
          <TabsContent value="equipment" className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <DeviceWorkspace />
                <Separator />
                <EquipmentSettings />
                <Separator />
                <FOVSettings />
                <Separator />
                <ExposureSettings />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Preferences Tab — includes general, appearance, performance, accessibility, notifications, search, keyboard */}
          <TabsContent value="preferences" className="flex-1 mt-0 overflow-hidden">
            <PreferencesTabContent />
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                <MapHealthMonitor className="mb-4" refreshToken={mapRefreshToken} />
                <MapProviderSettings onSettingsChange={handleMapSettingsUpdated} />
                <MapApiKeyManager onKeysChange={handleMapSettingsUpdated} />
                <Separator className="my-4" />
                <EventSourcesSettings />
                <Separator className="my-4" />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t('dataManager.title')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('dataManager.description')}
                  </p>
                </div>
                <DataManager 
                  trigger={
                    <Button variant="outline" className="w-full">
                      <HardDrive className="h-4 w-4 mr-2" />
                      {t('dataManager.openManager')}
                    </Button>
                  } 
                />
                {isTauri() && (
                  <>
                    <Separator className="my-4" />
                    <StoragePathSettings />
                  </>
                )}
                <Separator className="my-4" />
                <SettingsExportImport />
                {isTauri() && (
                  <>
                    <Separator className="my-4" />
                    <UpdateSettings />
                  </>
                )}
                <Separator className="my-4" />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t('setupWizard.steps.welcome.title')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('onboarding.welcome.subtitle')}
                  </p>
                </div>
                <OnboardingRestartButton variant="outline" className="w-full" />
                <p className="text-[11px] text-muted-foreground">
                  {t('onboarding.restartAllDescription')}
                </p>
                <Separator className="my-4" />
                <div className="space-y-2" data-tour-id="onboarding-tour-center">
                  <h3 className="text-sm font-medium">{t('onboarding.hub.title')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('onboarding.hub.description')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('onboarding.moduleRestartDescription')}
                  </p>
                  <div className="space-y-2">
                    {moduleTours.map((tour) => {
                      const progress = getTourProgress(tour.id);
                      const done = completedTours.includes(tour.id);
                      return (
                        <div key={tour.id} className="rounded-md border border-border p-2">
                          <p className="text-xs font-medium">{t(tour.titleKey)}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {done
                              ? t('onboarding.hub.completed')
                              : t('onboarding.hub.progress', {
                                  current: Math.max(progress.currentStepIndex + 1, 0),
                                  total: progress.totalSteps,
                                })}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant={done ? 'outline' : 'secondary'}
                            className="mt-2 h-7 text-xs"
                            onClick={() => {
                              setOpen(false);
                              if (done) {
                                restartTourModule(tour.id);
                                return;
                              }
                              if (progress.currentStepIndex > 0 && !progress.completed) {
                                resumeTour(tour.id);
                                return;
                              }
                              startTourById(tour.id);
                            }}
                          >
                            {done
                              ? t('onboarding.hub.restart')
                              : progress.currentStepIndex > 0 && !progress.completed
                                ? t('onboarding.hub.resume')
                                : t('onboarding.hub.start')}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="flex-1 mt-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <AboutSettings />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
