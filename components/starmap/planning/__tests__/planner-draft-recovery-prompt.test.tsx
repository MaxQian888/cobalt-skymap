/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlannerDraftRecoveryPrompt } from '../planner-draft-recovery-prompt';
import type { PlannerDraftRecoverySnapshot } from '@/lib/stores/session-plan-store';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'sessionPlanner.recoveryPromptTitle': 'Recover planner draft',
      'sessionPlanner.recoveryPromptFallback': 'Unsaved recovery',
      'sessionPlanner.recoveryPromptRestore': 'Restore',
      'sessionPlanner.recoveryPromptDiscard': 'Discard',
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

function createRecovery(overrides?: Partial<PlannerDraftRecoverySnapshot>): PlannerDraftRecoverySnapshot {
  return {
    draft: {} as never,
    updatedAt: '2025-06-15T19:00:00.000Z',
    source: 'startup' as never,
    ...overrides,
  } as PlannerDraftRecoverySnapshot;
}

describe('PlannerDraftRecoveryPrompt', () => {
  it('renders nothing when hidden or when no recovery snapshot is available', () => {
    const { rerender } = render(
      <PlannerDraftRecoveryPrompt
        recovery={createRecovery()}
        visible={false}
        onRestore={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('planner-draft-recovery-prompt')).not.toBeInTheDocument();

    rerender(
      <PlannerDraftRecoveryPrompt
        recovery={null}
        visible
        onRestore={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('planner-draft-recovery-prompt')).not.toBeInTheDocument();
  });

  it('renders the related plan name and invokes restore/discard callbacks', () => {
    const onRestore = jest.fn();
    const onDiscard = jest.fn();

    render(
      <PlannerDraftRecoveryPrompt
        recovery={createRecovery({ relatedPlanName: 'Messier Marathon Draft' })}
        visible
        onRestore={onRestore}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText('Recover planner draft')).toBeInTheDocument();
    expect(screen.getByText('Messier Marathon Draft')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('falls back to the generic recovery label when no related plan name exists', () => {
    render(
      <PlannerDraftRecoveryPrompt
        recovery={createRecovery({ relatedPlanName: undefined })}
        visible
        onRestore={jest.fn()}
        onDiscard={jest.fn()}
      />,
    );

    expect(screen.getByText('Unsaved recovery')).toBeInTheDocument();
  });
});
