'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CalendarDays, Flag, ListOrdered, MapPin, Telescope } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { degreesToDMS, degreesToHMS } from '@/lib/astronomy/astro-utils';
import { getMessierObjects } from '@/lib/catalogs';
import type { MessierMarathonCheckpoint } from '@/lib/messier-marathon';
import type { SessionDraftV2 } from '@/types/starmap/session-planner-v2';
import { useMessierMarathonStore } from '@/lib/stores/messier-marathon-store';
import { useMountStore } from '@/lib/stores/mount-store';
import { usePlanningUiStore } from '@/lib/stores/planning-ui-store';
import { useSessionPlanStore } from '@/lib/stores/session-plan-store';
import { useTargetListStore } from '@/lib/stores/target-list-store';

function toDateInputValue(value: string): string {
  return value.slice(0, 10);
}

function toTimeInputValue(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '00:00';
  return date.toISOString().slice(11, 16);
}

function checkpointStatusFromExecution(status: string): 'completed' | 'skipped' | null {
  if (status === 'completed') return 'completed';
  if (status === 'skipped' || status === 'failed') return 'skipped';
  return null;
}

function buildListName(date: string): string {
  return `Messier Marathon ${toDateInputValue(date)}`;
}

export function MessierMarathonGuideDialog() {
  const t = useTranslations();
  const open = usePlanningUiStore((state) => state.messierMarathonGuideOpen);
  const setOpen = usePlanningUiStore((state) => state.setMessierMarathonGuideOpen);
  const launchPlannerWithDraftSeed = usePlanningUiStore((state) => state.launchPlannerWithDraftSeed);
  const activeSession = useMessierMarathonStore((state) => state.activeSession);
  const lastCompletedSessionId = useMessierMarathonStore((state) => state.lastCompletedSessionId);
  const startSession = useMessierMarathonStore((state) => state.startSession);
  const updateCheckpointStatus = useMessierMarathonStore((state) => state.updateCheckpointStatus);
  const linkPlanner = useMessierMarathonStore((state) => state.linkPlanner);
  const linkExecution = useMessierMarathonStore((state) => state.linkExecution);
  const resetGuide = useMessierMarathonStore((state) => state.resetGuide);
  const latitude = useMountStore((state) => state.profileInfo.AstrometrySettings.Latitude || 0);
  const longitude = useMountStore((state) => state.profileInfo.AstrometrySettings.Longitude || 0);
  const executions = useSessionPlanStore((state) => state.executions);
  const createList = useTargetListStore((state) => state.createList);
  const setActiveList = useTargetListStore((state) => state.setActiveList);
  const addEntryToList = useTargetListStore((state) => state.addEntryToList);
  const getEntriesForList = useTargetListStore((state) => state.getEntriesForList);
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInputValue(
      useMessierMarathonStore.getState().activeSession?.date
      ?? new Date().toISOString(),
    ),
  );

  const refreshSession = useCallback(() => {
    startSession({
      date: new Date(`${selectedDate}T12:00:00.000Z`),
      latitude,
      longitude,
    });
  }, [latitude, longitude, selectedDate, startSession]);

  useEffect(() => {
    if (!open || activeSession || lastCompletedSessionId) return;
    refreshSession();
  }, [activeSession, lastCompletedSessionId, open, refreshSession]);

  useEffect(() => {
    if (!activeSession) return;
    const relatedExecution = executions.find((execution) =>
      (activeSession.sourceExecutionId && execution.id === activeSession.sourceExecutionId)
      || (activeSession.sourcePlanId && execution.sourcePlanId === activeSession.sourcePlanId),
    );
    const bindings = relatedExecution?.guideContext?.catalogIdByPlannerTargetId;
    if (!relatedExecution || !bindings) return;

    relatedExecution.targets.forEach((target) => {
      const checkpointId = bindings[target.targetId];
      const nextStatus = checkpointStatusFromExecution(target.status);
      const currentStatus = activeSession.checkpoints.find(
        (checkpoint) => checkpoint.targetId === checkpointId,
      )?.status;
      if (checkpointId && nextStatus && currentStatus !== nextStatus) {
        updateCheckpointStatus(checkpointId, nextStatus);
      }
    });

    if (
      activeSession.sourceExecutionId
      && relatedExecution.id !== activeSession.sourceExecutionId
    ) {
      linkExecution(relatedExecution.id);
    }
  }, [activeSession, executions, linkExecution, updateCheckpointStatus]);

  const checkpointCatalog = useMemo(() => {
    return new Map(getMessierObjects().map((target) => [target.id, target]));
  }, []);

  const handleSeedPlanner = useCallback(() => {
    if (!activeSession) return;

    let listId = activeSession.sourceListId;
    if (!listId) {
      listId = createList({
        name: buildListName(activeSession.date),
        description: 'Messier Marathon seeded targets',
      });
    }

    const existingEntries = getEntriesForList(listId) ?? [];
    const existingTargetIds = new Map(
      existingEntries.map((entry) => [entry.name.toLowerCase(), entry.id]),
    );

    const plannerTargetIdByCatalogId: Record<string, string> = {};
    const catalogIdByPlannerTargetId: Record<string, string> = {};
    const stageByTargetId: Record<string, MessierMarathonCheckpoint['stageId']> = {};
    const checkpointOrder: string[] = [];
    const criticalCheckpointIds: string[] = [];

    activeSession.checkpoints.forEach((checkpoint) => {
      const catalogTarget = checkpointCatalog.get(checkpoint.targetId);
      if (!catalogTarget) return;

      let plannerTargetId = existingTargetIds.get(checkpoint.targetId.toLowerCase());
      if (!plannerTargetId) {
        const entry = addEntryToList(listId!, {
          name: checkpoint.targetId,
          ra: catalogTarget.ra,
          dec: catalogTarget.dec,
          raString: degreesToHMS(catalogTarget.ra),
          decString: degreesToDMS(catalogTarget.dec),
          priority: checkpoint.critical ? 'high' : 'medium',
          tags: ['messier-marathon', checkpoint.stageId],
        });
        plannerTargetId = entry.id;
      }

      plannerTargetIdByCatalogId[checkpoint.targetId] = plannerTargetId;
      catalogIdByPlannerTargetId[plannerTargetId] = checkpoint.targetId;
      stageByTargetId[plannerTargetId] = checkpoint.stageId;
      checkpointOrder.push(plannerTargetId);
      if (checkpoint.critical) {
        criticalCheckpointIds.push(plannerTargetId);
      }
    });

    setActiveList(listId);
    linkPlanner({ sourceListId: listId, sourcePlanId: activeSession.sourcePlanId });

    const criticalEdits = activeSession.checkpoints
      .filter((checkpoint) => checkpoint.critical)
      .map((checkpoint) => ({
        targetId: plannerTargetIdByCatalogId[checkpoint.targetId],
        startTime: toTimeInputValue(checkpoint.recommendedWindowStart),
        locked: true,
        reason: checkpoint.stageId,
      }))
      .filter((edit) => Boolean(edit.targetId));

    const firstCheckpoint = activeSession.checkpoints[0];
    const lastCheckpoint = activeSession.checkpoints[activeSession.checkpoints.length - 1];

    const draft: SessionDraftV2 = {
      planDate: activeSession.date,
      strategy: 'balanced',
      constraints: {
        minAltitude: 20,
        minImagingTime: 30,
        sessionWindow:
          firstCheckpoint && lastCheckpoint
            ? {
                startTime: toTimeInputValue(firstCheckpoint.recommendedWindowStart),
                endTime: toTimeInputValue(lastCheckpoint.recommendedWindowEnd),
              }
            : undefined,
        minMoonDistance: 20,
        useExposurePlanDuration: false,
      },
      excludedTargetIds: [],
      manualEdits: criticalEdits,
      notes: `Messier Marathon (${activeSession.readiness})`,
      guideContext: {
        kind: 'messier-marathon',
        sessionId: activeSession.sessionId,
        readiness: activeSession.readiness,
        mode: activeSession.recovery.mode,
        checkpointOrder,
        criticalCheckpointIds,
        stageByTargetId,
        plannerTargetIdByCatalogId,
        catalogIdByPlannerTargetId,
        sourceListId: listId,
        sourcePlanId: activeSession.sourcePlanId,
        sourceExecutionId: activeSession.sourceExecutionId,
      },
    };

    launchPlannerWithDraftSeed(draft);
    setOpen(false);
  }, [
    activeSession,
    addEntryToList,
    checkpointCatalog,
    createList,
    getEntriesForList,
    launchPlannerWithDraftSeed,
    linkPlanner,
    setActiveList,
    setOpen,
  ]);

  const readinessLabel = activeSession
    ? t(`messierMarathon.readiness.${activeSession.readiness}`)
    : t('messierMarathon.readiness.not_recommended');
  const modeLabel = activeSession
    ? t(`messierMarathon.mode.${activeSession.recovery.mode}`)
    : t('messierMarathon.mode.best_effort');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Telescope className="h-5 w-5 text-primary" />
            {t('messierMarathon.title')}
          </DialogTitle>
          <DialogDescription>
            {t('messierMarathon.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1">
              <Label htmlFor="messier-marathon-date">{t('messierMarathon.fields.date')}</Label>
              <Input
                id="messier-marathon-date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={refreshSession}>
                <CalendarDays className="mr-1.5 h-4 w-4" />
                {t('messierMarathon.actions.refresh')}
              </Button>
            </div>
            <div className="flex items-end justify-end">
              <Badge variant={activeSession?.readiness === 'recommended' ? 'default' : 'secondary'}>
                {readinessLabel}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" />
                {t('messierMarathon.fields.location')}
              </div>
              <p className="mt-1 text-muted-foreground">
                {latitude.toFixed(1)}°, {longitude.toFixed(1)}°
              </p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Flag className="h-4 w-4" />
                {t('messierMarathon.fields.progress')}
              </div>
              <p className="mt-1 text-muted-foreground">
                {activeSession
                  ? `${activeSession.visibleTargetCount}/${activeSession.totalMessierCount}`
                  : '0/0'}
              </p>
            </div>
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <ListOrdered className="h-4 w-4" />
                {t('messierMarathon.fields.mode')}
              </div>
              <p className="mt-1 text-muted-foreground">{modeLabel}</p>
            </div>
          </div>

          {activeSession?.limitingFactors.length ? (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              {activeSession.limitingFactors.map((factor) => (
                <div key={factor.code} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <span>{t(`messierMarathon.limitingFactors.${factor.code}`)}</span>
                </div>
              ))}
            </div>
          ) : null}

          <Separator />

          <ScrollArea className="max-h-[45vh] pr-3">
            <div className="space-y-3">
              {activeSession?.checkpoints.map((checkpoint) => (
                <div
                  key={checkpoint.targetId}
                  className="rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{checkpoint.targetName}</span>
                        {checkpoint.critical ? (
                          <Badge variant="destructive">{t('messierMarathon.labels.critical')}</Badge>
                        ) : null}
                        <Badge variant="outline">{t(`messierMarathon.stages.${checkpoint.stageId}`)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {checkpoint.recommendedWindowStart.slice(11, 16)}
                        {' - '}
                        {checkpoint.recommendedWindowEnd.slice(11, 16)}
                      </p>
                    </div>
                    <Badge variant={checkpoint.status === 'completed' ? 'default' : 'secondary'}>
                      {t(`messierMarathon.status.${checkpoint.status}`)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={t('messierMarathon.actions.markCompleted')}
                      onClick={() => updateCheckpointStatus(checkpoint.targetId, 'completed')}
                    >
                      {t('messierMarathon.actions.markCompleted')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={t('messierMarathon.actions.skipCheckpoint')}
                      onClick={() => updateCheckpointStatus(checkpoint.targetId, 'skipped')}
                    >
                      {t('messierMarathon.actions.skipCheckpoint')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="ghost" onClick={resetGuide}>
            {t('messierMarathon.actions.resetGuide')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common.close')}
            </Button>
            <Button
              onClick={handleSeedPlanner}
              aria-label={t('messierMarathon.actions.openPlanner')}
              disabled={!activeSession || activeSession.checkpoints.length === 0}
            >
              {t('messierMarathon.actions.openPlanner')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
