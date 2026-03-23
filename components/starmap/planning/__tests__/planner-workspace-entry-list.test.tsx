/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlannerWorkspaceEntryList } from '../planner-workspace-entry-list';
import type { PlannerWorkspaceEntry } from '@/lib/hooks/use-planner-workspace-model';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'sessionPlanner.workspaceSource.savedPlan': 'Saved plan',
      'sessionPlanner.workspaceSource.localTemplate': 'Local template',
      'sessionPlanner.workspaceSource.desktopTemplate': 'Desktop template',
      'sessionPlanner.workspaceSource.fileImport': 'Imported file',
      'sessionPlanner.workspaceSource.cliImport': 'Imported from CLI',
      'sessionPlanner.workspaceSource.recovery': 'Recovered draft',
      'sessionPlanner.executionStatus.active': 'In Progress',
      'sessionPlanner.executionSummaryRemaining': `${values?.count ?? 0} remaining`,
      'sessionPlanner.workspaceImportUnmatched': 'Unmatched',
    };
    return translations[key] ?? key;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    onClick,
  }: React.PropsWithChildren<{ className?: string; onClick?: () => void }>) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

function createPlanEntry(): PlannerWorkspaceEntry {
  return {
    id: 'plan-1',
    type: 'plan',
    source: 'local-plan',
    title: 'Saved Plan',
    updatedAt: '2025-06-15T19:00:00.000Z',
    searchText: 'saved plan',
    plan: {} as never,
    targetCount: 4,
    executionStatus: 'active',
    remainingTargets: 2,
    actionFlags: {
      canLoad: true,
      canRename: false,
      canDuplicate: false,
      canDelete: false,
      canResumeExecution: false,
      canReviewExecution: false,
      canRestoreDraft: false,
      canDismiss: false,
    },
  };
}

function createEntries(): PlannerWorkspaceEntry[] {
  return [
    createPlanEntry(),
    {
      id: 'template-local',
      type: 'template',
      source: 'local-template',
      title: 'Local Template',
      updatedAt: '2025-06-15T19:00:00.000Z',
      searchText: 'local template',
      template: {} as never,
      actionFlags: {
        canLoad: false,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
        canResumeExecution: false,
        canReviewExecution: false,
        canRestoreDraft: false,
        canDismiss: false,
      },
    },
    {
      id: 'template-desktop',
      type: 'template',
      source: 'desktop-template',
      title: 'Desktop Template',
      updatedAt: '2025-06-15T19:00:00.000Z',
      searchText: 'desktop template',
      template: {} as never,
      actionFlags: {
        canLoad: false,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
        canResumeExecution: false,
        canReviewExecution: false,
        canRestoreDraft: false,
        canDismiss: false,
      },
    },
    {
      id: 'import-file',
      type: 'import',
      source: 'file-import',
      title: 'Imported File',
      updatedAt: '2025-06-15T19:00:00.000Z',
      searchText: 'imported file',
      importRecord: {
        diagnostics: {
          format: 'json',
          unmatchedTargets: ['M42', 'M45'],
          createdTargets: ['M31'],
          skippedRows: 0,
          warnings: [],
        },
      } as never,
      actionFlags: {
        canLoad: false,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
        canResumeExecution: false,
        canReviewExecution: false,
        canRestoreDraft: false,
        canDismiss: false,
      },
    },
    {
      id: 'import-cli',
      type: 'import',
      source: 'cli-import',
      title: 'CLI Import',
      updatedAt: '2025-06-15T19:00:00.000Z',
      searchText: 'cli import',
      importRecord: {
        diagnostics: {
          format: 'csv',
          unmatchedTargets: [],
          createdTargets: [],
          skippedRows: 1,
          warnings: [],
        },
      } as never,
      actionFlags: {
        canLoad: false,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
        canResumeExecution: false,
        canReviewExecution: false,
        canRestoreDraft: false,
        canDismiss: false,
      },
    },
    {
      id: 'recovery-1',
      type: 'recovery',
      source: 'draft-recovery',
      title: 'Recovered Draft',
      updatedAt: '2025-06-15T19:00:00.000Z',
      searchText: 'recovered draft',
      recovery: {} as never,
      actionFlags: {
        canLoad: false,
        canRename: false,
        canDuplicate: false,
        canDelete: false,
        canResumeExecution: false,
        canReviewExecution: false,
        canRestoreDraft: false,
        canDismiss: false,
      },
    },
  ];
}

describe('PlannerWorkspaceEntryList', () => {
  it('renders every workspace source label and exposes plan/import status badges', () => {
    render(
      <PlannerWorkspaceEntryList
        entries={createEntries()}
        selectedEntryId="plan-1"
        onSelectEntry={jest.fn()}
      />,
    );

    expect(screen.getByText('Saved plan')).toBeInTheDocument();
    expect(screen.getByText('Local template')).toBeInTheDocument();
    expect(screen.getByText('Desktop template')).toBeInTheDocument();
    expect(screen.getByText('Imported file')).toBeInTheDocument();
    expect(screen.getByText('Imported from CLI')).toBeInTheDocument();
    expect(screen.getByText('Recovered draft')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('2 remaining')).toBeInTheDocument();
    expect(screen.getByText('json')).toBeInTheDocument();
    expect(screen.getByText('Unmatched: 2')).toBeInTheDocument();
  });

  it('highlights the selected entry and reports clicks through onSelectEntry', () => {
    const onSelectEntry = jest.fn();

    render(
      <PlannerWorkspaceEntryList
        entries={createEntries()}
        selectedEntryId="plan-1"
        onSelectEntry={onSelectEntry}
      />,
    );

    const selectedButton = screen.getByRole('button', { name: /Saved Plan/i });
    expect(selectedButton.className).toContain('border-primary');

    fireEvent.click(screen.getByRole('button', { name: /Imported File/i }));
    expect(onSelectEntry).toHaveBeenCalledWith('import-file');
  });
});
