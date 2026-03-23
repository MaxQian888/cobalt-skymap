/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlannerWorkspacePreview } from '../planner-workspace-preview';
import type { PlannerWorkspaceEntry } from '@/lib/hooks/use-planner-workspace-model';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'sessionPlanner.workspaceEmptySelection': 'Choose an entry to preview',
      'sessionPlanner.workspaceType.plan': 'Plan',
      'sessionPlanner.workspaceType.template': 'Template',
      'sessionPlanner.workspaceType.import': 'Import',
      'sessionPlanner.workspaceType.recovery': 'Recovery',
      'sessionPlanner.targets': 'Targets',
      'sessionPlanner.executionStatus.active': 'In Progress',
      'sessionPlanner.executionSummaryRemaining': `${values?.count ?? 0} remaining`,
      'sessionPlanner.workspaceDesktopTemplateHint': 'Desktop template hint',
      'sessionPlanner.workspaceLocalTemplateHint': 'Local template hint',
      'sessionPlanner.workspaceImportFormat': 'Format',
      'sessionPlanner.workspaceImportCreated': 'Created',
      'sessionPlanner.workspaceImportUnmatched': 'Unmatched',
      'sessionPlanner.workspaceImportSkipped': 'Skipped',
      'sessionPlanner.workspaceActionLoad': 'Load',
      'sessionPlanner.workspaceActionRename': 'Rename',
      'sessionPlanner.workspaceActionDuplicate': 'Duplicate',
      'sessionPlanner.workspaceActionDelete': 'Delete',
      'sessionPlanner.workspaceActionResume': 'Resume',
      'sessionPlanner.workspaceActionReview': 'Review',
      'sessionPlanner.workspaceActionRestore': 'Restore',
      'sessionPlanner.workspaceActionDismiss': 'Dismiss',
    };
    return translations[key] ?? key;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
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
      canRename: true,
      canDuplicate: true,
      canDelete: true,
      canResumeExecution: true,
      canReviewExecution: true,
      canRestoreDraft: true,
      canDismiss: true,
    },
  };
}

describe('PlannerWorkspacePreview', () => {
  function renderPreview(entry: PlannerWorkspaceEntry | null) {
    const handlers = {
      onLoad: jest.fn(),
      onRename: jest.fn(),
      onDuplicate: jest.fn(),
      onDelete: jest.fn(),
      onResumeExecution: jest.fn(),
      onReviewExecution: jest.fn(),
      onRestoreDraft: jest.fn(),
      onDismiss: jest.fn(),
    };

    render(<PlannerWorkspacePreview entry={entry} {...handlers} />);
    return handlers;
  }

  it('renders the empty state when no entry is selected', () => {
    renderPreview(null);
    expect(screen.getByText('Choose an entry to preview')).toBeInTheDocument();
    expect(screen.queryByTestId('planner-workspace-preview')).not.toBeInTheDocument();
  });

  it('renders plan details and wires every visible action button to the same entry', () => {
    const entry = createPlanEntry();
    const handlers = renderPreview(entry);

    expect(screen.getByTestId('planner-workspace-preview')).toBeInTheDocument();
    expect(screen.getByText('Saved Plan')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Targets: 4')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('2 remaining')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(handlers.onLoad).toHaveBeenCalledWith(entry);
    expect(handlers.onRename).toHaveBeenCalledWith(entry);
    expect(handlers.onDuplicate).toHaveBeenCalledWith(entry);
    expect(handlers.onDelete).toHaveBeenCalledWith(entry);
    expect(handlers.onResumeExecution).toHaveBeenCalledWith(entry);
    expect(handlers.onReviewExecution).toHaveBeenCalledWith(entry);
    expect(handlers.onRestoreDraft).toHaveBeenCalledWith(entry);
    expect(handlers.onDismiss).toHaveBeenCalledWith(entry);
  });

  it('renders local and desktop template hints from the source branch', () => {
    const { rerender } = render(
      <PlannerWorkspacePreview
        entry={{
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
        }}
        onLoad={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
        onResumeExecution={jest.fn()}
        onReviewExecution={jest.fn()}
        onRestoreDraft={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Local template hint')).toBeInTheDocument();

    rerender(
      <PlannerWorkspacePreview
        entry={{
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
        }}
        onLoad={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
        onResumeExecution={jest.fn()}
        onReviewExecution={jest.fn()}
        onRestoreDraft={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Desktop template hint')).toBeInTheDocument();
  });

  it('renders import details and recovery details for their respective entry types', () => {
    const { rerender } = render(
      <PlannerWorkspacePreview
        entry={{
          id: 'import-1',
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
        }}
        onLoad={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
        onResumeExecution={jest.fn()}
        onReviewExecution={jest.fn()}
        onRestoreDraft={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('Format: json')).toBeInTheDocument();
    expect(screen.getByText('Created: 1')).toBeInTheDocument();
    expect(screen.getByText('Unmatched: 2')).toBeInTheDocument();
    expect(screen.getByText('Skipped: 1')).toBeInTheDocument();

    rerender(
      <PlannerWorkspacePreview
        entry={{
          id: 'recovery-1',
          type: 'recovery',
          source: 'draft-recovery',
          title: 'Recovered Draft',
          updatedAt: '2025-06-15T19:00:00.000Z',
          searchText: 'recovered draft',
          recovery: {
            source: 'startup',
            relatedPlanName: 'Saved Plan',
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
        }}
        onLoad={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
        onResumeExecution={jest.fn()}
        onReviewExecution={jest.fn()}
        onRestoreDraft={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByText('sessionPlanner.workspaceRecoverySource.startup')).toBeInTheDocument();
    expect(screen.getByText('Saved Plan')).toBeInTheDocument();
  });
});
