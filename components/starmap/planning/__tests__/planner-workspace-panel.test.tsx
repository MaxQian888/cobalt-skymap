/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlannerWorkspacePanel } from '../planner-workspace-panel';
import type { PlannerWorkspaceModel } from '@/lib/hooks/use-planner-workspace-model';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'sessionPlanner.workspace': 'Workspace',
      'sessionPlanner.workspaceDescription': 'Review plans, templates, imports, and recoveries.',
      'sessionPlanner.saveTemplate': 'Save as Template',
      'common.close': 'Close',
      'sessionPlanner.workspaceSearchPlaceholder': 'Search workspace',
      'sessionPlanner.workspaceFilter.all': 'All',
      'sessionPlanner.workspaceFilter.plans': 'Plans',
      'sessionPlanner.workspaceFilter.templates': 'Templates',
      'sessionPlanner.workspaceFilter.imports': 'Imports',
      'sessionPlanner.workspaceFilter.recovery': 'Recovery',
      'sessionPlanner.workspaceSource.savedPlan': 'Saved plan',
      'sessionPlanner.workspaceType.plan': 'Plan',
      'sessionPlanner.targets': 'Targets',
      'sessionPlanner.executionStatus.active': 'In Progress',
      'sessionPlanner.executionSummaryRemaining': `${values?.count ?? 0} remaining`,
      'sessionPlanner.workspaceActionLoad': 'Load',
    };
    return translations[key] ?? key;
  },
}));

describe('PlannerWorkspacePanel', () => {
  it('translates panel labels, entry badges, and preview actions', () => {
    const model: PlannerWorkspaceModel = {
      entries: [{
        id: 'plan-1',
        type: 'plan',
        source: 'local-plan',
        title: 'Saved Plan',
        updatedAt: '2025-06-15T19:00:00.000Z',
        searchText: 'saved plan',
        plan: {
          id: 'plan-1',
          name: 'Saved Plan',
          createdAt: '2025-06-15T19:00:00.000Z',
          updatedAt: '2025-06-15T19:00:00.000Z',
          planDate: '2025-06-15T00:00:00.000Z',
          latitude: 40,
          longitude: -74,
          strategy: 'balanced',
          minAltitude: 20,
          minImagingTime: 30,
          targets: [],
          excludedTargetIds: [],
          totalImagingTime: 0,
          nightCoverage: 0,
          efficiency: 0,
        },
        targetCount: 2,
        executionStatus: 'active',
        remainingTargets: 1,
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
      }],
      counts: {
        plans: 1,
        templates: 0,
        imports: 0,
        recovery: 0,
      },
    };

    render(
      <PlannerWorkspacePanel
        model={model}
        query=""
        filter="all"
        selectedEntryId="plan-1"
        onQueryChange={jest.fn()}
        onFilterChange={jest.fn()}
        onSelectEntry={jest.fn()}
        onSaveTemplate={jest.fn()}
        onClose={jest.fn()}
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

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Review plans, templates, imports, and recoveries.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Template' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search workspace')).toBeInTheDocument();
    expect(screen.getByText('Saved plan')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Targets: 2')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 remaining').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
  });
});
