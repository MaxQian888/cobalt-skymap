'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { PlannerWorkspaceEntry } from '@/lib/hooks/use-planner-workspace-model';

interface PlannerWorkspacePreviewProps {
  entry: PlannerWorkspaceEntry | null;
  onLoad: (entry: PlannerWorkspaceEntry) => void;
  onRename: (entry: PlannerWorkspaceEntry) => void;
  onDuplicate: (entry: PlannerWorkspaceEntry) => void;
  onDelete: (entry: PlannerWorkspaceEntry) => void;
  onResumeExecution: (entry: PlannerWorkspaceEntry) => void;
  onReviewExecution: (entry: PlannerWorkspaceEntry) => void;
  onRestoreDraft: (entry: PlannerWorkspaceEntry) => void;
  onDismiss: (entry: PlannerWorkspaceEntry) => void;
}

export function PlannerWorkspacePreview({
  entry,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  onResumeExecution,
  onReviewExecution,
  onRestoreDraft,
  onDismiss,
}: PlannerWorkspacePreviewProps) {
  const t = useTranslations();

  if (!entry) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        {t('sessionPlanner.workspaceEmptySelection')}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border px-4 py-4" data-testid="planner-workspace-preview">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{entry.title}</h3>
          <Badge variant="secondary" className="text-[10px]">{t(`sessionPlanner.workspaceType.${entry.type}`)}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{new Date(entry.updatedAt).toLocaleString()}</p>
      </div>

      {entry.type === 'plan' && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{`${t('sessionPlanner.targets')}: ${entry.targetCount}`}</p>
          {entry.executionStatus && (
            <p>{t(`sessionPlanner.executionStatus.${entry.executionStatus}`)}</p>
          )}
          {entry.executionStatus && (
            <p>{t('sessionPlanner.executionSummaryRemaining', { count: entry.remainingTargets })}</p>
          )}
        </div>
      )}

      {entry.type === 'template' && (
        <div className="text-xs text-muted-foreground">
          {entry.source === 'desktop-template'
            ? t('sessionPlanner.workspaceDesktopTemplateHint')
            : t('sessionPlanner.workspaceLocalTemplateHint')}
        </div>
      )}

      {entry.type === 'import' && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{`${t('sessionPlanner.workspaceImportFormat')}: ${entry.importRecord.diagnostics.format}`}</p>
          <p>{`${t('sessionPlanner.workspaceImportCreated')}: ${entry.importRecord.diagnostics.createdTargets.length}`}</p>
          <p>{`${t('sessionPlanner.workspaceImportUnmatched')}: ${entry.importRecord.diagnostics.unmatchedTargets.length}`}</p>
          <p>{`${t('sessionPlanner.workspaceImportSkipped')}: ${entry.importRecord.diagnostics.skippedRows}`}</p>
        </div>
      )}

      {entry.type === 'recovery' && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t(`sessionPlanner.workspaceRecoverySource.${entry.recovery.source}`)}</p>
          {entry.recovery.relatedPlanName && <p>{entry.recovery.relatedPlanName}</p>}
        </div>
      )}

      <Separator />

      <div className="flex flex-wrap gap-2">
        {entry.actionFlags.canLoad && (
          <Button
            size="sm"
            variant="secondary"
            data-testid="planner-workspace-action-load"
            onClick={() => onLoad(entry)}
          >
            {t('sessionPlanner.workspaceActionLoad')}
          </Button>
        )}
        {entry.actionFlags.canRename && (
          <Button
            size="sm"
            variant="outline"
            data-testid="planner-workspace-action-rename"
            onClick={() => onRename(entry)}
          >
            {t('sessionPlanner.workspaceActionRename')}
          </Button>
        )}
        {entry.actionFlags.canDuplicate && (
          <Button
            size="sm"
            variant="outline"
            data-testid="planner-workspace-action-duplicate"
            onClick={() => onDuplicate(entry)}
          >
            {t('sessionPlanner.workspaceActionDuplicate')}
          </Button>
        )}
        {entry.actionFlags.canDelete && (
          <Button
            size="sm"
            variant="outline"
            data-testid="planner-workspace-action-delete"
            onClick={() => onDelete(entry)}
          >
            {t('sessionPlanner.workspaceActionDelete')}
          </Button>
        )}
        {entry.actionFlags.canResumeExecution && (
          <Button
            size="sm"
            variant="secondary"
            data-testid="planner-workspace-action-resume"
            onClick={() => onResumeExecution(entry)}
          >
            {t('sessionPlanner.workspaceActionResume')}
          </Button>
        )}
        {entry.actionFlags.canReviewExecution && (
          <Button
            size="sm"
            variant="outline"
            data-testid="planner-workspace-action-review"
            onClick={() => onReviewExecution(entry)}
          >
            {t('sessionPlanner.workspaceActionReview')}
          </Button>
        )}
        {entry.actionFlags.canRestoreDraft && (
          <Button
            size="sm"
            variant="secondary"
            data-testid="planner-workspace-action-restore"
            onClick={() => onRestoreDraft(entry)}
          >
            {t('sessionPlanner.workspaceActionRestore')}
          </Button>
        )}
        {entry.actionFlags.canDismiss && (
          <Button
            size="sm"
            variant="outline"
            data-testid="planner-workspace-action-dismiss"
            onClick={() => onDismiss(entry)}
          >
            {t('sessionPlanner.workspaceActionDismiss')}
          </Button>
        )}
      </div>
    </div>
  );
}
