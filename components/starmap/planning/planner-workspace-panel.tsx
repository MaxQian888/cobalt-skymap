'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PlannerWorkspaceFilter, PlannerWorkspaceTab } from '@/lib/stores/planning-ui-store';
import type { PlannerWorkspaceEntry, PlannerWorkspaceModel } from '@/lib/hooks/use-planner-workspace-model';
import { PlannerWorkspaceEntryList } from './planner-workspace-entry-list';
import { PlannerWorkspacePreview } from './planner-workspace-preview';

interface PlannerWorkspacePanelProps {
  model: PlannerWorkspaceModel;
  query: string;
  filter: PlannerWorkspaceFilter;
  selectedEntryId: string | null;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: PlannerWorkspaceFilter) => void;
  onSelectEntry: (entryId: string) => void;
  onSaveTemplate: () => void;
  onClose: () => void;
  onLoad: (entry: PlannerWorkspaceEntry) => void;
  onRename: (entry: PlannerWorkspaceEntry) => void;
  onDuplicate: (entry: PlannerWorkspaceEntry) => void;
  onDelete: (entry: PlannerWorkspaceEntry) => void;
  onResumeExecution: (entry: PlannerWorkspaceEntry) => void;
  onReviewExecution: (entry: PlannerWorkspaceEntry) => void;
  onRestoreDraft: (entry: PlannerWorkspaceEntry) => void;
  onDismiss: (entry: PlannerWorkspaceEntry) => void;
}

const FILTER_OPTIONS: PlannerWorkspaceTab[] = ['plans', 'templates', 'imports', 'recovery'];

export function PlannerWorkspacePanel({
  model,
  query,
  filter,
  selectedEntryId,
  onQueryChange,
  onFilterChange,
  onSelectEntry,
  onSaveTemplate,
  onClose,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  onResumeExecution,
  onReviewExecution,
  onRestoreDraft,
  onDismiss,
}: PlannerWorkspacePanelProps) {
  const t = useTranslations();
  const selectedEntry = model.entries.find((entry) => entry.id === selectedEntryId) ?? model.entries[0] ?? null;

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4" data-testid="planner-workspace-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{t('sessionPlanner.workspace')}</p>
            <Badge variant="secondary" className="text-[10px]">
              {model.entries.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{t('sessionPlanner.workspaceDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onSaveTemplate}>
            {t('sessionPlanner.saveTemplate')}
          </Button>
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('sessionPlanner.workspaceSearchPlaceholder')}
          className="h-8 lg:max-w-xs"
          data-testid="planner-workspace-search"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'secondary' : 'outline'}
            onClick={() => onFilterChange('all')}
          >
            {t('sessionPlanner.workspaceFilter.all')}
          </Button>
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? 'secondary' : 'outline'}
              onClick={() => onFilterChange(option)}
            >
              {t(`sessionPlanner.workspaceFilter.${option}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-[46%]">
          <PlannerWorkspaceEntryList
            entries={model.entries}
            selectedEntryId={selectedEntry?.id ?? null}
            onSelectEntry={onSelectEntry}
          />
        </div>
        <div className="lg:flex-1">
          <PlannerWorkspacePreview
            entry={selectedEntry}
            onLoad={onLoad}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onResumeExecution={onResumeExecution}
            onReviewExecution={onReviewExecution}
            onRestoreDraft={onRestoreDraft}
            onDismiss={onDismiss}
          />
        </div>
      </div>
    </div>
  );
}
