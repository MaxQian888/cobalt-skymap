'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PlannerWorkspaceEntry } from '@/lib/hooks/use-planner-workspace-model';

interface PlannerWorkspaceEntryListProps {
  entries: PlannerWorkspaceEntry[];
  selectedEntryId: string | null;
  onSelectEntry: (entryId: string) => void;
}

function getSourceLabel(
  entry: PlannerWorkspaceEntry,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (entry.source) {
    case 'local-plan':
      return t('sessionPlanner.workspaceSource.savedPlan');
    case 'local-template':
      return t('sessionPlanner.workspaceSource.localTemplate');
    case 'desktop-template':
      return t('sessionPlanner.workspaceSource.desktopTemplate');
    case 'file-import':
      return t('sessionPlanner.workspaceSource.fileImport');
    case 'cli-import':
      return t('sessionPlanner.workspaceSource.cliImport');
    case 'draft-recovery':
      return t('sessionPlanner.workspaceSource.recovery');
  }
}

export function PlannerWorkspaceEntryList({
  entries,
  selectedEntryId,
  onSelectEntry,
}: PlannerWorkspaceEntryListProps) {
  const t = useTranslations();

  return (
    <ScrollArea className="max-h-72 lg:max-h-[26rem]">
      <div className="space-y-2 pr-3">
        {entries.map((entry) => (
          <Button
            key={`${entry.type}-${entry.id}`}
            variant="ghost"
            className={cn(
              'h-auto w-full justify-start rounded-lg border px-3 py-3 text-left',
              selectedEntryId === entry.id && 'border-primary bg-primary/5',
            )}
            onClick={() => onSelectEntry(entry.id)}
          >
            <div className="w-full space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{entry.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(entry.updatedAt).toLocaleString()}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {getSourceLabel(entry, t)}
                </Badge>
              </div>
              {entry.type === 'plan' && entry.executionStatus && (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {t(`sessionPlanner.executionStatus.${entry.executionStatus}`)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {t('sessionPlanner.executionSummaryRemaining', { count: entry.remainingTargets })}
                  </Badge>
                </div>
              )}
              {entry.type === 'import' && (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {entry.importRecord.diagnostics.format}
                  </Badge>
                  {entry.importRecord.diagnostics.unmatchedTargets.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      {`${t('sessionPlanner.workspaceImportUnmatched')}: ${entry.importRecord.diagnostics.unmatchedTargets.length}`}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
