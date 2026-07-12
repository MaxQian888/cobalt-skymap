'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  MapPin,
  Eye,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  BarChart3,
  Cloud,
  Thermometer,
  Wind,
  Download,
} from 'lucide-react';
import { StarRating } from './star-rating';
import { StatCard } from './stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { tauriApi } from '@/lib/tauri';
import { isTauri } from '@/lib/storage/platform';
import { useMobileShell } from '@/components/starmap/view/use-mobile-shell';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useSessionPlanStore } from '@/lib/stores/session-plan-store';
import {
  applyExecutionTargetStatusAction,
  buildObservationExecutionWorkspaceViewModel,
} from '@/lib/stores/session-execution-helpers';
import { useLocations, useEquipment } from '@/lib/tauri/hooks';
import { exportExecutionSummary, type ExecutionExportFormat } from '@/lib/astronomy/execution-exporter';
import type { 
  ObservationSession, 
  Observation, 
  ObservationStats,
  ObservationSearchHit,
  ObservationQueryFilters,
} from '@/lib/tauri/types';
import type { ObservationLogProps } from '@/types/starmap/planning';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';
import { createLogger } from '@/lib/logger';

const logger = createLogger('observation-log');

export function ObservationLog({ currentSelection }: ObservationLogProps) {
  const t = useTranslations();
  const { isMobileShell } = useMobileShell();
  const { locations } = useLocations();
  const { equipment } = useEquipment();
  const [open, setOpen] = useState(false);
  const hasPreloadedRef = useRef(false);
  const [sessions, setSessions] = useState<ObservationSession[]>([]);
  const [stats, setStats] = useState<ObservationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'search' | 'stats'>('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ObservationSearchHit[]>([]);
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [searchObjectType, setSearchObjectType] = useState('all');
  const [searchMinRating, setSearchMinRating] = useState('all');
  const [selectedSession, setSelectedSession] = useState<ObservationSession | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  
  // Dialog states
  const [showNewSession, setShowNewSession] = useState(false);
  const [showAddObservation, setShowAddObservation] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'session' | 'observation'; id: string; sessionId?: string } | null>(null);
  const [editingSession, setEditingSession] = useState<ObservationSession | null>(null);
  const [editingObservation, setEditingObservation] = useState<Observation | null>(null);
  const [editingObservationSessionId, setEditingObservationSessionId] = useState<string | null>(null);
  
  // New session form
  const [newSessionDate, setNewSessionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [newSessionLocation, setNewSessionLocation] = useState('');
  const [newSessionLocationId, setNewSessionLocationId] = useState<string | undefined>(undefined);
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [newSessionSeeing, setNewSessionSeeing] = useState<number>(3);
  const [newSessionTransparency, setNewSessionTransparency] = useState<number>(3);
  const [newSessionBortle, setNewSessionBortle] = useState<number>(5);
  
  // New observation form
  const [obsObjectName, setObsObjectName] = useState('');
  const [obsObjectType, setObsObjectType] = useState('');
  const [obsRating, setObsRating] = useState<number>(3);
  const [obsDifficulty, setObsDifficulty] = useState<number>(3);
  const [obsNotes, setObsNotes] = useState('');
  const [obsTelescopeId, setObsTelescopeId] = useState('');
  const [obsCameraId, setObsCameraId] = useState('');
  const [selectedExecutionTargetId, setSelectedExecutionTargetId] = useState<string | null>(null);
  const savedPlans = useSessionPlanStore((state) => state.savedPlans);
  const importPlanV2 = useSessionPlanStore((state) => state.importPlanV2);
  const syncExecutionFromObservationSession = useSessionPlanStore((state) => state.syncExecutionFromObservationSession);
  const updateExecutionTarget = useSessionPlanStore((state) => state.updateExecutionTarget);
  const completeExecution = useSessionPlanStore((state) => state.completeExecution);
  const archiveExecution = useSessionPlanStore((state) => state.archiveExecution);
  const openSessionPlanner = usePlanningUiStore((state) => state.openSessionPlanner);

  // Load data
  const loadData = useCallback(async () => {
    if (!isTauri()) return;
    
    setLoading(true);
    try {
      const [logData, statsData] = await Promise.all([
        tauriApi.observationLog.load(),
        tauriApi.observationLog.getStats(),
      ]);
      const sorted = (logData.sessions || []).slice().sort((a, b) => b.date.localeCompare(a.date));
      setSessions(sorted);
      sorted.forEach((session) => {
        if (session.source_plan_id && session.execution_targets?.length) {
          syncExecutionFromObservationSession(session);
        }
      });
      setStats(statsData);
    } catch (error) {
      logger.error('Failed to load observation log', error);
      toast.error(t('observationLog.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [syncExecutionFromObservationSession, t]);

  useEffect(() => {
    if (isTauri() && !hasPreloadedRef.current) {
      hasPreloadedRef.current = true;
      void loadData();
    }
  }, [loadData]);

  // Open edit session dialog with pre-filled data
  const handleStartEditSession = useCallback((session: ObservationSession) => {
    setEditingSession(session);
    setNewSessionDate(session.date);
    setNewSessionLocation(session.location_name || '');
    setNewSessionLocationId(session.location_id || undefined);
    setNewSessionNotes(session.notes || '');
    setNewSessionSeeing(session.seeing ?? 3);
    setNewSessionTransparency(session.transparency ?? 3);
    setNewSessionBortle(session.bortle_class ?? 5);
    setShowNewSession(true);
  }, []);

  // Save edited session
  const handleSaveEditSession = useCallback(async () => {
    if (!isTauri() || !editingSession) return;

    try {
      await tauriApi.observationLog.updateSession({
        ...editingSession,
        location_id: newSessionLocationId,
        location_name: newSessionLocation || undefined,
        seeing: newSessionSeeing,
        transparency: newSessionTransparency,
        bortle_class: newSessionBortle,
        notes: newSessionNotes || undefined,
      });

      toast.success(t('observationLog.sessionCreated'));
      setShowNewSession(false);
      setEditingSession(null);
      loadData();
    } catch (error) {
      logger.error('Failed to update session', error);
      toast.error(t('observationLog.createFailed'));
    }
  }, [editingSession, newSessionLocationId, newSessionLocation, newSessionNotes, newSessionSeeing, newSessionTransparency, newSessionBortle, t, loadData]);

  // Create new session
  const handleCreateSession = useCallback(async () => {
    if (!isTauri()) return;
    
    try {
      const session = await tauriApi.observationLog.createSession(
        newSessionDate,
        newSessionLocationId,
        newSessionLocation || undefined
      );
      
      // Always update session with weather conditions and notes
      await tauriApi.observationLog.updateSession({
        ...session,
        seeing: newSessionSeeing,
        transparency: newSessionTransparency,
        bortle_class: newSessionBortle,
        notes: newSessionNotes || undefined,
      });
      
      toast.success(t('observationLog.sessionCreated'));
      setShowNewSession(false);
      setNewSessionDate(new Date().toISOString().split('T')[0]);
      setNewSessionLocation('');
      setNewSessionLocationId(undefined);
      setNewSessionNotes('');
      loadData();
    } catch (error) {
      logger.error('Failed to create session', error);
      toast.error(t('observationLog.createFailed'));
    }
  }, [newSessionDate, newSessionLocationId, newSessionLocation, newSessionNotes, newSessionSeeing, newSessionTransparency, newSessionBortle, t, loadData]);

  const handleCreateDraftFromLatestPlan = useCallback(() => {
    if (savedPlans.length === 0) {
      toast.error(t('observationLog.noPlannerSession'));
      return;
    }

    const latestPlan = savedPlans[0];
    const manualEdits = latestPlan.targets.map((target) => {
      const start = new Date(target.startTime);
      const end = new Date(target.endTime);
      const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
      return {
        targetId: target.targetId,
        startTime: start.toTimeString().slice(0, 5),
        endTime: end.toTimeString().slice(0, 5),
        durationMinutes,
        locked: true,
      };
    });

    const constraints = latestPlan.constraints ?? {
      minAltitude: latestPlan.minAltitude,
      minImagingTime: latestPlan.minImagingTime,
      minMoonDistance: 20,
      useExposurePlanDuration: true,
      weatherLimits: {
        maxCloudCover: 70,
        maxHumidity: 90,
        maxWindSpeed: 25,
      },
      safetyLimits: {
        enforceMountSafety: false,
        avoidMeridianFlipWindow: false,
      },
    };

    const draft: SessionDraftV2 = {
      planDate: latestPlan.planDate,
      strategy: latestPlan.strategy,
      constraints,
      excludedTargetIds: latestPlan.excludedTargetIds,
      manualEdits,
      notes: latestPlan.notes,
      weatherSnapshot: latestPlan.weatherSnapshot,
    };

    importPlanV2(
      draft,
      `${t('sessionPlanner.title')} - ${new Date(latestPlan.planDate).toLocaleDateString()}`,
    );
    setOpen(false);
    openSessionPlanner();
    toast.success(t('observationLog.plannerDraftCreated'));
  }, [importPlanV2, openSessionPlanner, savedPlans, t]);

  const updateSessionCollection = useCallback((updatedSession: ObservationSession) => {
    setSessions((previous) => {
      const exists = previous.some((session) => session.id === updatedSession.id);
      if (!exists) return [updatedSession, ...previous];
      return previous.map((session) => session.id === updatedSession.id ? updatedSession : session);
    });
    setSelectedSession((previous) => (
      previous?.id === updatedSession.id ? updatedSession : previous
    ));
  }, []);

  const activeSession = sessions.find(s => !s.end_time);
  const activeExecutionSession = useMemo(
    () => sessions.find((session) => !session.end_time && session.execution_targets?.length),
    [sessions],
  );
  const activeExecutionView = useMemo(
    () => buildObservationExecutionWorkspaceViewModel(activeExecutionSession),
    [activeExecutionSession],
  );

  const handleExecutionTargetStatus = useCallback(async (
    session: ObservationSession,
    targetId: string,
    status: NonNullable<ObservationSession['execution_targets']>[number]['status'],
  ) => {
    if (!session.execution_targets) return;

    try {
      const updatedSession = await applyExecutionTargetStatusAction({
        runtime: isTauri() ? 'tauri' : 'web',
        executionId: session.id,
        targetId,
        nextStatus: status,
        observationSession: session,
        persistSession: isTauri()
          ? async (nextSession) => tauriApi.observationLog.updateSession(nextSession)
          : undefined,
        syncExecutionFromObservationSession,
        storeActions: {
          updateExecutionTarget,
          completeExecution,
          archiveExecution,
        },
      });
      if (updatedSession) {
        updateSessionCollection(updatedSession);
      }
    } catch (error) {
      logger.error('Failed to update execution target status', error);
      toast.error(t('observationLog.updateFailed'));
    }
  }, [archiveExecution, completeExecution, syncExecutionFromObservationSession, t, updateExecutionTarget, updateSessionCollection]);

  const resetObservationForm = useCallback(() => {
    setObsObjectName('');
    setObsObjectType('');
    setObsRating(3);
    setObsDifficulty(3);
    setObsNotes('');
    setObsTelescopeId('');
    setObsCameraId('');
    setSelectedExecutionTargetId(null);
    setEditingObservation(null);
    setEditingObservationSessionId(null);
  }, []);

  const buildObservationFilters = useCallback((): ObservationQueryFilters | undefined => {
    const filters: ObservationQueryFilters = {};
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) filters.text = trimmedQuery;
    if (searchStartDate) filters.startDate = searchStartDate;
    if (searchEndDate) filters.endDate = searchEndDate;
    if (searchObjectType !== 'all') filters.objectType = searchObjectType;
    if (searchMinRating !== 'all') filters.minRating = Number(searchMinRating);
    return Object.keys(filters).length > 0 ? filters : undefined;
  }, [searchEndDate, searchMinRating, searchObjectType, searchQuery, searchStartDate]);

  const handleOpenExecutionObservation = useCallback((session: ObservationSession, targetId: string, targetName: string) => {
    setSelectedSession(session);
    setEditingObservation(null);
    setEditingObservationSessionId(null);
    setSelectedExecutionTargetId(targetId);
    setObsObjectName(targetName);
    setObsObjectType('');
    setObsRating(3);
    setObsDifficulty(3);
    setObsNotes('');
    setObsTelescopeId('');
    setObsCameraId('');
    setShowAddObservation(true);
  }, []);

  const handleStartEditObservation = useCallback((sessionId: string, observation: Observation) => {
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) return;

    setSelectedSession(session);
    setEditingObservation(observation);
    setEditingObservationSessionId(sessionId);
    setSelectedExecutionTargetId(observation.execution_target_id ?? null);
    setObsObjectName(observation.object_name);
    setObsObjectType(observation.object_type || '');
    setObsRating(observation.rating ?? 3);
    setObsDifficulty(observation.difficulty ?? 3);
    setObsNotes(observation.notes || '');
    setObsTelescopeId(observation.telescope_id || '');
    setObsCameraId(observation.camera_id || '');
    setShowAddObservation(true);
  }, [sessions]);

  // Add or edit observation in session
  const handleSubmitObservation = useCallback(async () => {
    const targetSessionId = editingObservationSessionId
      ?? selectedSession?.id
      ?? sessions.find((session) => session.id === activeSession?.id)?.id
      ?? null;
    if (!isTauri() || !targetSessionId) return;

    const objectName = (obsObjectName || currentSelection?.name || '').trim();
    if (!objectName) {
      toast.error(t('observationLog.objectNameRequired'));
      return;
    }

    try {
      let updatedSession: ObservationSession;
      if (editingObservation) {
        updatedSession = await tauriApi.observationLog.updateObservation(targetSessionId, {
          ...editingObservation,
          object_name: objectName,
          object_type: obsObjectType || undefined,
          telescope_id: obsTelescopeId || undefined,
          camera_id: obsCameraId || undefined,
          rating: obsRating,
          difficulty: obsDifficulty,
          notes: obsNotes || undefined,
          execution_target_id: selectedExecutionTargetId || undefined,
          image_paths: editingObservation.image_paths ?? [],
        });
        setSearchResults((previous) => previous.map((entry) => (
          entry.id === editingObservation.id && entry.session_id === targetSessionId
            ? {
                ...entry,
                object_name: objectName,
                object_type: obsObjectType || undefined,
                telescope_id: obsTelescopeId || undefined,
                camera_id: obsCameraId || undefined,
                rating: obsRating,
                difficulty: obsDifficulty,
                notes: obsNotes || undefined,
                execution_target_id: selectedExecutionTargetId || undefined,
              }
            : entry
        )));
      } else {
        updatedSession = await tauriApi.observationLog.addObservation(targetSessionId, {
          object_name: objectName,
          object_type: obsObjectType || currentSelection?.type,
          ra: currentSelection?.ra,
          dec: currentSelection?.dec,
          constellation: currentSelection?.constellation,
          telescope_id: obsTelescopeId || undefined,
          camera_id: obsCameraId || undefined,
          rating: obsRating,
          difficulty: obsDifficulty,
          notes: obsNotes || undefined,
          image_paths: [],
          execution_target_id: selectedExecutionTargetId || undefined,
        });
      }

      toast.success(t(editingObservation ? 'observationLog.observationUpdated' : 'observationLog.observationAdded'));
      setShowAddObservation(false);
      resetObservationForm();
      updateSessionCollection(updatedSession);
      if (updatedSession.source_plan_id && updatedSession.execution_targets?.length) {
        syncExecutionFromObservationSession(updatedSession);
      }
      await loadData();
    } catch (error) {
      logger.error('Failed to save observation', error);
      toast.error(t(editingObservation ? 'observationLog.updateFailed' : 'observationLog.addFailed'));
    }
  }, [activeSession, currentSelection, editingObservation, editingObservationSessionId, loadData, obsCameraId, obsDifficulty, obsNotes, obsObjectName, obsObjectType, obsRating, obsTelescopeId, resetObservationForm, selectedExecutionTargetId, selectedSession, sessions, syncExecutionFromObservationSession, t, updateSessionCollection]);

  // End session
  const handleEndSession = useCallback(async (sessionId: string) => {
    if (!isTauri()) return;
    
    try {
      await tauriApi.observationLog.endSession(sessionId);
      toast.success(t('observationLog.sessionEnded'));
      loadData();
    } catch (error) {
      logger.error('Failed to end session', error);
      toast.error(t('observationLog.endFailed'));
    }
  }, [t, loadData]);

  // Delete session
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!isTauri()) return;
    
    try {
      await tauriApi.observationLog.deleteSession(sessionId);
      toast.success(t('observationLog.sessionDeleted'));
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
      loadData();
    } catch (error) {
      logger.error('Failed to delete session', error);
      toast.error(t('observationLog.deleteFailed'));
    }
  }, [selectedSession, t, loadData]);

  // Delete observation
  const handleDeleteObservation = useCallback(async (sessionId: string, observationId: string) => {
    if (!isTauri()) return;
    
    try {
      await tauriApi.observationLog.deleteObservation(sessionId, observationId);
      toast.success(t('observationLog.observationDeleted'));
      setSearchResults((previous) => previous.filter((entry) => !(entry.id === observationId && entry.session_id === sessionId)));
      if (editingObservation?.id === observationId) {
        setShowAddObservation(false);
        resetObservationForm();
      }
      loadData();
    } catch (error) {
      logger.error('Failed to delete observation', error);
      toast.error(t('observationLog.deleteFailed'));
    }
  }, [editingObservation, loadData, resetObservationForm, t]);

  // Export observation log
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    if (!isTauri()) return;
    
    try {
      const filters = buildObservationFilters();
      const data = await tauriApi.observationLog.exportLog(format, filters);
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `observation-log.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t(filters ? 'observationLog.exportFilteredSuccess' : 'observationLog.exportSuccess'));
    } catch (error) {
      logger.error('Export failed', error);
      toast.error(t('observationLog.exportFailed'));
    }
  }, [buildObservationFilters, t]);

  const handleExportExecution = useCallback(async (format: ExecutionExportFormat) => {
    if (!isTauri() || !activeExecutionSession) return;

    try {
      const content = exportExecutionSummary(activeExecutionSession, { format });
      await tauriApi.sessionIo.exportSessionPlan(
        content,
        format === 'markdown' ? 'markdown' : format,
      );
      toast.success(t('observationLog.executionExportSuccess'));
    } catch (error) {
      logger.error('Execution export failed', error);
      toast.error(t('observationLog.exportFailed'));
    }
  }, [activeExecutionSession, t]);

  // Search observations
  const handleSearch = useCallback(async () => {
    if (!isTauri()) return;
    
    try {
      const results = await tauriApi.observationLog.search(buildObservationFilters() ?? {});
      setSearchResults(results);
    } catch (error) {
      logger.error('Search failed', error);
    }
  }, [buildObservationFilters]);

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Format time
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return '--:--';
    try {
      return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };


  const filteredSessions = sessions.filter((s) => {
    if (dateFilter === 'all') return true;
    const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return new Date(s.date) >= cutoff;
  });

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
                <BookOpen className="h-5 w-5" />
                {activeSession && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </Button>
            </DrawerTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t('observationLog.title')}</p>
          </TooltipContent>
        </Tooltip>

        <DrawerContent
          // vaul portals outside the [data-shell] root — re-set it so
          // shell-mobile:/shell-desktop: variants inside resolve correctly.
          data-shell={isMobileShell ? 'mobile' : 'desktop'}
          className="w-[85vw] max-w-[360px] sm:max-w-[420px] md:max-w-[480px] h-full bg-card border-border drawer-content"
        >
          <DrawerHeader>
            <DrawerTitle className="text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t('observationLog.title')}
            </DrawerTitle>
          </DrawerHeader>

          {!isTauri() ? (
            <div className="p-4 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('observationLog.desktopOnly')}</p>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'sessions' | 'search' | 'stats')}
              className="flex-1"
            >
              <TabsList className="mx-4 grid w-[calc(100%-2rem)] grid-cols-3">
                <TabsTrigger value="sessions">
                  {t('observationLog.sessions')}
                </TabsTrigger>
                <TabsTrigger value="search">
                  {t('observationLog.search')}
                </TabsTrigger>
                <TabsTrigger value="stats">
                  {t('observationLog.stats')}
                </TabsTrigger>
              </TabsList>

              {/* Sessions Tab */}
              <TabsContent value="sessions" className="flex-1 mt-4 px-4">
                <div className="space-y-4">
                  {/* New Session Button */}
                  <Button
                    className="w-full"
                    onClick={() => setShowNewSession(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('observationLog.newSession')}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCreateDraftFromLatestPlan}
                    disabled={savedPlans.length === 0}
                    data-testid="observation-log-create-planner-draft"
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    {t('observationLog.usePlannerSession')}
                  </Button>

                  {/* Date Filter */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex gap-1 flex-1">
                      {(['all', '7d', '30d', '90d'] as const).map((f) => (
                        <Button
                          key={f}
                          variant={dateFilter === f ? 'secondary' : 'ghost'}
                          size="sm"
                          className="h-6 text-[10px] px-2 flex-1"
                          onClick={() => setDateFilter(f)}
                        >
                          {f === 'all' ? t('observationLog.allTime') : f === '7d' ? '7d' : f === '30d' ? '30d' : '90d'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Active Session Indicator */}
                  {activeSession && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm font-medium text-green-400">
                            {t('observationLog.activeSession')}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleEndSession(activeSession.id)}
                        >
                          {t('observationLog.endSession')}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(activeSession.date)} • {activeSession.observations.length} {t('observationLog.observations')}
                      </p>
                    </div>
                  )}

                  {activeExecutionSession && activeExecutionSession.execution_targets && (
                    <div
                      className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
                      data-testid="observation-log-execution-workspace"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{t('observationLog.executionWorkspace')}</p>
                          <p className="text-xs text-muted-foreground">{activeExecutionSession.source_plan_name || t('observationLog.activeSession')}</p>
                        </div>
                        <Badge>{activeExecutionSession.execution_status || 'active'}</Badge>
                      </div>
                      <div
                        className="rounded-md border border-border/60 bg-background/70 p-2 text-xs text-muted-foreground"
                        data-testid="observation-log-execution-summary"
                      >
                        <p>
                          {t('observationLog.executionSummaryCompleted', { count: activeExecutionView.summary.completedTargets })} ·{' '}
                          {t('observationLog.executionSummarySkipped', { count: activeExecutionView.summary.skippedTargets })} ·{' '}
                          {t('observationLog.executionSummaryFailed', { count: activeExecutionView.summary.failedTargets })} ·{' '}
                          {t('observationLog.executionSummaryRemaining', { count: activeExecutionView.summary.remainingTargets })}
                        </p>
                        {activeExecutionView.focusTarget && (
                          <p className="mt-1">
                            {activeExecutionView.activeTarget
                              ? t('observationLog.currentTargetLabel')
                              : t('observationLog.nextTargetLabel')}
                            : {activeExecutionView.focusTarget.targetName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {activeExecutionSession.execution_targets.map((target) => (
                          <div
                            key={target.id}
                            className="rounded-md border border-border/70 bg-background/60 p-2"
                            data-testid={`observation-log-execution-target-${target.target_id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{target.target_name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatTime(target.scheduled_start)} - {formatTime(target.scheduled_end)}
                                </p>
                              </div>
                              <Badge>{target.status}</Badge>
                            </div>
                            <div className="mt-2 flex gap-2">
                              {(activeExecutionView.targetActions[target.target_id] ?? []).includes('start') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => void handleExecutionTargetStatus(activeExecutionSession, target.target_id, 'in_progress')}
                                >
                                  {t('observationLog.startTarget')}
                                </Button>
                              )}
                              {(activeExecutionView.targetActions[target.target_id] ?? []).includes('complete') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => void handleExecutionTargetStatus(activeExecutionSession, target.target_id, 'completed')}
                                >
                                  {t('observationLog.completeTarget')}
                                </Button>
                              )}
                              {(activeExecutionView.targetActions[target.target_id] ?? []).includes('skip') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => void handleExecutionTargetStatus(activeExecutionSession, target.target_id, 'skipped')}
                                >
                                  {t('observationLog.skipTarget')}
                                </Button>
                              )}
                              {(activeExecutionView.targetActions[target.target_id] ?? []).includes('fail') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => void handleExecutionTargetStatus(activeExecutionSession, target.target_id, 'failed')}
                                >
                                  {t('observationLog.failTarget')}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleOpenExecutionObservation(activeExecutionSession, target.target_id, target.target_name)}
                              >
                                {t('observationLog.addTargetObservation')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        data-testid="observation-log-open-linked-planner"
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          setOpen(false);
                          openSessionPlanner();
                        }}
                      >
                        {t('observationLog.openLinkedPlanner')}
                      </Button>
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => void handleExportExecution('markdown')}
                        >
                          MD
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => void handleExportExecution('json')}
                        >
                          JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs"
                          onClick={() => void handleExportExecution('csv')}
                        >
                          CSV
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Sessions List */}
                  <ScrollArea className="h-[calc(100vh-320px)] h-[calc(100dvh-320px)] min-h-0">
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {t('common.loading')}
                      </div>
                    ) : sessions.length === 0 ? (
                      <EmptyState icon={Calendar} message={t('observationLog.noSessions')} hint={t('observationLog.createFirst')} />
                    ) : (
                      <div className="space-y-2">
                        {filteredSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedSession?.id === session.id
                                ? 'bg-primary/20 border-primary'
                                : 'bg-muted/50 border-border hover:border-muted-foreground'
                            }`}
                            onClick={() => setSelectedSession(
                              selectedSession?.id === session.id ? null : session
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{formatDate(session.date)}</span>
                                  {!session.end_time && (
                                    <Badge className="bg-green-500 text-white text-[10px] h-4">
                                      {t('observationLog.activeSession')}
                                    </Badge>
                                  )}
                                </div>
                                {session.location_name && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {session.location_name}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(session.start_time)} - {formatTime(session.end_time)}
                                  <span>•</span>
                                  <Eye className="h-3 w-3" />
                                  {session.observations.length} {t('observationLog.addObs')}
                                </div>
                              </div>
                              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                                selectedSession?.id === session.id ? 'rotate-90' : ''
                              }`} />
                            </div>

                            {/* Expanded Session Details */}
                            {selectedSession?.id === session.id && (
                              <div className="mt-3 pt-3 border-t border-border space-y-2">
                                {/* Conditions */}
                                {(session.seeing || session.transparency) && (
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {session.seeing && (
                                      <span className="flex items-center gap-1">
                                        <Wind className="h-3 w-3" />
                                        {t('observationLog.seeing')}: {session.seeing}/5
                                      </span>
                                    )}
                                    {session.transparency && (
                                      <span className="flex items-center gap-1">
                                        <Eye className="h-3 w-3" />
                                        {t('observationLog.transparency')}: {session.transparency}/5
                                      </span>
                                    )}
                                  </div>
                                )}

                                {session.notes && (
                                  <p className="text-xs text-muted-foreground">{session.notes}</p>
                                )}
                                
                                {/* Observations */}
                                {session.observations.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium">{t('observationLog.observations')}:</p>
                                    {session.observations.slice(0, 5).map((obs) => (
                                      <div key={obs.id} className="flex items-center justify-between text-xs p-1 rounded bg-background/50 group/obs">
                                        <span className="truncate">{obs.object_name}</span>
                                        <div className="flex items-center gap-1">
                                          {obs.rating ? <StarRating value={obs.rating} /> : null}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 shell-mobile:min-h-11 shell-mobile:min-w-11 shell-desktop:opacity-0 shell-desktop:group-hover/obs:opacity-100"
                                            data-testid={`observation-log-edit-observation-${obs.id}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartEditObservation(session.id, obs);
                                            }}
                                          >
                                            <Pencil className="h-2.5 w-2.5" />
                                          </Button>
                                          {!session.end_time && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 shell-mobile:min-h-11 shell-mobile:min-w-11 shell-desktop:opacity-0 shell-desktop:group-hover/obs:opacity-100 text-red-400 hover:text-red-300"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteTarget({ type: 'observation', id: obs.id, sessionId: session.id });
                                              }}
                                            >
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    {session.observations.length > 5 && (
                                      <p className="text-[10px] text-muted-foreground">
                                        {t('observationLog.moreObservations', { count: session.observations.length - 5 })}
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-2">
                                  {!session.end_time && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="flex-1 h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSession(session);
                                        resetObservationForm();
                                        setShowAddObservation(true);
                                      }}
                                    >
                                      <Plus className="h-3 w-3 mr-1" />
                                      {t('observationLog.addObs')}
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEditSession(session);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-red-400 hover:text-red-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({ type: 'session', id: session.id });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Search Tab */}
              <TabsContent value="search" className="flex-1 mt-4 px-4">
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('observationLog.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button size="icon" onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('observationLog.filterFromDate')}</Label>
                      <Input
                        type="date"
                        value={searchStartDate}
                        onChange={(e) => setSearchStartDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('observationLog.filterToDate')}</Label>
                      <Input
                        type="date"
                        value={searchEndDate}
                        onChange={(e) => setSearchEndDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('observationLog.filterObjectType')}</Label>
                      <Select value={searchObjectType} onValueChange={setSearchObjectType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('observationLog.filterAny')}</SelectItem>
                          <SelectItem value="galaxy">{t('objects.galaxy')}</SelectItem>
                          <SelectItem value="nebula">{t('objects.nebula')}</SelectItem>
                          <SelectItem value="cluster">{t('observationLog.cluster')}</SelectItem>
                          <SelectItem value="planetary">{t('objects.planetaryNebula')}</SelectItem>
                          <SelectItem value="star">{t('objects.star')}</SelectItem>
                          <SelectItem value="double">{t('objects.doubleStar')}</SelectItem>
                          <SelectItem value="planet">{t('objects.planet')}</SelectItem>
                          <SelectItem value="moon">{t('objects.moon')}</SelectItem>
                          <SelectItem value="other">{t('observationLog.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('observationLog.filterMinRating')}</Label>
                      <Select value={searchMinRating} onValueChange={setSearchMinRating}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('observationLog.filterAny')}</SelectItem>
                          <SelectItem value="1">1+</SelectItem>
                          <SelectItem value="2">2+</SelectItem>
                          <SelectItem value="3">3+</SelectItem>
                          <SelectItem value="4">4+</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchStartDate('');
                        setSearchEndDate('');
                        setSearchObjectType('all');
                        setSearchMinRating('all');
                        setSearchResults([]);
                      }}
                    >
                      {t('observationLog.clearFilters')}
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 min-h-0">
                    {searchResults.length === 0 ? (
                      <EmptyState icon={Search} message={t('observationLog.searchHint')} />
                    ) : (
                      <div className="space-y-2">
                        {searchResults.map((obs) => (
                          <div key={`${obs.session_id}-${obs.id}`} className="p-3 rounded-lg bg-muted/50 border border-border">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{obs.object_name}</p>
                                {obs.object_type && (
                                  <Badge variant="secondary" className="text-[10px] mt-1">
                                    {obs.object_type}
                                  </Badge>
                                )}
                              </div>
                              {obs.rating ? <StarRating value={obs.rating} /> : null}
                            </div>
                            {obs.notes && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{obs.notes}</p>
                            )}
                            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(obs.session_date)}</span>
                              {obs.session_location_name && (
                                <>
                                  <span>•</span>
                                  <MapPin className="h-3 w-3" />
                                  <span>{obs.session_location_name}</span>
                                </>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {formatDate(obs.observed_at)}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                data-testid={`observation-log-open-session-${obs.session_id}-${obs.id}`}
                                onClick={() => {
                                  const session = sessions.find((entry) => entry.id === obs.session_id);
                                  if (!session) return;
                                  setSelectedSession(session);
                                  setActiveTab('sessions');
                                }}
                              >
                                {t('observationLog.openSession')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => {
                                  handleStartEditObservation(obs.session_id, obs);
                                  setActiveTab('sessions');
                                }}
                              >
                                {t('common.edit')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="flex-1 mt-4 px-4">
                {stats ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard value={stats.total_sessions} label={t('observationLog.totalSessions')} className="border border-border p-3" />
                      <StatCard value={stats.total_observations} label={t('observationLog.totalObs')} className="border border-border p-3" />
                      <StatCard value={stats.unique_objects} label={t('observationLog.uniqueObjects')} className="border border-border p-3" />
                      <StatCard value={`${stats.total_hours.toFixed(1)}h`} label={t('observationLog.totalHours')} className="border border-border p-3" />
                    </div>

                    {stats.objects_by_type.length > 0 && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border">
                        <p className="text-sm font-medium mb-2">{t('observationLog.byType')}</p>
                        <div className="space-y-1">
                          {stats.objects_by_type.slice(0, 5).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{type}</span>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.monthly_counts.length > 0 && (() => {
                      const maxCount = Math.max(...stats.monthly_counts.map(([, c]) => c), 1);
                      const recent = stats.monthly_counts.slice(-12);
                      return (
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                          <p className="text-sm font-medium mb-3">{t('observationLog.monthlyTrend')}</p>
                          <div className="flex items-end gap-1 h-24">
                            {recent.map(([month, count]) => (
                              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] text-muted-foreground">{count}</span>
                                <div
                                  className="w-full rounded-t bg-primary/70 min-h-[2px]"
                                  style={{ height: `${(count / maxCount) * 100}%` }}
                                />
                                <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                                  {month.slice(5)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <Separator />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleExport('csv')}>
                        <Download className="h-3 w-3 mr-1" />
                        CSV
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleExport('json')}>
                        <Download className="h-3 w-3 mr-1" />
                        JSON
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={BarChart3} message={t('observationLog.noStats')} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </DrawerContent>
      </Drawer>

      {/* New/Edit Session Dialog */}
      <ResponsiveDialog tier="standard-form" open={showNewSession} onOpenChange={(open) => {
        setShowNewSession(open);
        if (!open) setEditingSession(null);
      }}>
        <ResponsiveDialogContent className="sm:max-w-[400px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editingSession ? t('observationLog.editSession') : t('observationLog.newSession')}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {editingSession ? t('observationLog.editSessionDesc') : t('observationLog.newSessionDesc')}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('observationLog.date')}</Label>
              <Input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('observationLog.location')}</Label>
              {locations && locations.locations.length > 0 ? (
                <Select
                  value={newSessionLocationId || '_manual'}
                  onValueChange={(v) => {
                    if (v === '_manual') {
                      setNewSessionLocationId(undefined);
                      setNewSessionLocation('');
                      setNewSessionBortle(5);
                    } else {
                      const loc = locations.locations.find(l => l.id === v);
                      if (loc) {
                        setNewSessionLocationId(loc.id);
                        setNewSessionLocation(loc.name);
                        if (loc.bortle_class) setNewSessionBortle(loc.bortle_class);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('observationLog.locationPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_manual">{t('observationLog.locationPlaceholder')}</SelectItem>
                    {locations.locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}{loc.bortle_class ? ` (B${loc.bortle_class})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={t('observationLog.locationPlaceholder')}
                  value={newSessionLocation}
                  onChange={(e) => setNewSessionLocation(e.target.value)}
                />
              )}
            </div>
            {/* Weather Conditions */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <Label className="flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                {t('observationLog.conditions')}
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Wind className="h-3 w-3" />
                    {t('observationLog.seeing')}
                  </Label>
                  <Select value={String(newSessionSeeing)} onValueChange={(v) => setNewSessionSeeing(Number(v))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - {t('observationLog.poor')}</SelectItem>
                      <SelectItem value="2">2 - {t('observationLog.fair')}</SelectItem>
                      <SelectItem value="3">3 - {t('observationLog.average')}</SelectItem>
                      <SelectItem value="4">4 - {t('observationLog.good')}</SelectItem>
                      <SelectItem value="5">5 - {t('observationLog.excellent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {t('observationLog.transparency')}
                  </Label>
                  <Select value={String(newSessionTransparency)} onValueChange={(v) => setNewSessionTransparency(Number(v))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - {t('observationLog.poor')}</SelectItem>
                      <SelectItem value="2">2 - {t('observationLog.fair')}</SelectItem>
                      <SelectItem value="3">3 - {t('observationLog.average')}</SelectItem>
                      <SelectItem value="4">4 - {t('observationLog.good')}</SelectItem>
                      <SelectItem value="5">5 - {t('observationLog.excellent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    {t('observationLog.bortle')}
                  </Label>
                  <Select value={String(newSessionBortle)} onValueChange={(v) => setNewSessionBortle(Number(v))}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - {t('observationLog.bortle1')}</SelectItem>
                      <SelectItem value="2">2 - {t('observationLog.bortle2')}</SelectItem>
                      <SelectItem value="3">3 - {t('observationLog.bortle3')}</SelectItem>
                      <SelectItem value="4">4 - {t('observationLog.bortle4')}</SelectItem>
                      <SelectItem value="5">5 - {t('observationLog.bortle5')}</SelectItem>
                      <SelectItem value="6">6 - {t('observationLog.bortle6')}</SelectItem>
                      <SelectItem value="7">7 - {t('observationLog.bortle7')}</SelectItem>
                      <SelectItem value="8">8 - {t('observationLog.bortle8')}</SelectItem>
                      <SelectItem value="9">9 - {t('observationLog.bortle9')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t('observationLog.notes')}</Label>
              <Textarea
                placeholder={t('observationLog.notesPlaceholder')}
                value={newSessionNotes}
                onChange={(e) => setNewSessionNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => { setShowNewSession(false); setEditingSession(null); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={editingSession ? handleSaveEditSession : handleCreateSession}>
              {editingSession ? t('common.save') : t('observationLog.startSession')}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Add Observation Dialog */}
      <ResponsiveDialog
        tier="standard-form"
        open={showAddObservation}
        onOpenChange={(nextOpen) => {
          setShowAddObservation(nextOpen);
          if (!nextOpen) {
            resetObservationForm();
          }
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-[400px]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{editingObservation ? t('observationLog.editObservation') : t('observationLog.addObservation')}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {editingObservation ? t('observationLog.editObsDesc') : t('observationLog.addObsDesc')}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('observationLog.objectName')}</Label>
              <Input
                placeholder={currentSelection?.name || 'M31, NGC 7000...'}
                value={obsObjectName}
                onChange={(e) => setObsObjectName(e.target.value)}
              />
              {currentSelection && !obsObjectName && (
                <p className="text-xs text-muted-foreground">
                  {t('observationLog.usingSelected', { name: currentSelection.name })}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('observationLog.objectType')}</Label>
              <Select value={obsObjectType} onValueChange={setObsObjectType}>
                <SelectTrigger>
                  <SelectValue placeholder={currentSelection?.type || t('observationLog.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="galaxy">{t('objects.galaxy')}</SelectItem>
                  <SelectItem value="nebula">{t('objects.nebula')}</SelectItem>
                  <SelectItem value="cluster">{t('observationLog.cluster')}</SelectItem>
                  <SelectItem value="planetary">{t('objects.planetaryNebula')}</SelectItem>
                  <SelectItem value="star">{t('objects.star')}</SelectItem>
                  <SelectItem value="double">{t('objects.doubleStar')}</SelectItem>
                  <SelectItem value="planet">{t('objects.planet')}</SelectItem>
                  <SelectItem value="moon">{t('objects.moon')}</SelectItem>
                  <SelectItem value="other">{t('observationLog.other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {equipment && (equipment.telescopes.length > 0 || equipment.cameras.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {equipment.telescopes.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('equipment.telescopes')}</Label>
                    <Select value={obsTelescopeId} onValueChange={setObsTelescopeId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder={t('common.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('common.select')}</SelectItem>
                        {equipment.telescopes.map((tel) => (
                          <SelectItem key={tel.id} value={tel.id}>{tel.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {equipment.cameras.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">{t('equipment.cameras')}</Label>
                    <Select value={obsCameraId} onValueChange={setObsCameraId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder={t('common.select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('common.select')}</SelectItem>
                        {equipment.cameras.map((cam) => (
                          <SelectItem key={cam.id} value={cam.id}>{cam.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('observationLog.rating')}</Label>
                <StarRating value={obsRating} onChange={setObsRating} size="md" />
              </div>
              <div className="space-y-2">
                <Label>{t('observationLog.difficulty')}</Label>
                <Select value={String(obsDifficulty)} onValueChange={(v) => setObsDifficulty(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - {t('observationLog.easy')}</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3 - {t('observationLog.medium')}</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5 - {t('observationLog.hard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('observationLog.notes')}</Label>
              <Textarea
                placeholder={t('observationLog.obsNotesPlaceholder')}
                value={obsNotes}
                onChange={(e) => setObsNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button variant="outline" onClick={() => { setShowAddObservation(false); resetObservationForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmitObservation}>
              {editingObservation ? t('common.save') : t('observationLog.addObservation')}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('observationLog.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget?.type === 'session') {
                  handleDeleteSession(deleteTarget.id);
                } else if (deleteTarget?.type === 'observation' && deleteTarget.sessionId) {
                  handleDeleteObservation(deleteTarget.sessionId, deleteTarget.id);
                }
                setDeleteTarget(null);
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
