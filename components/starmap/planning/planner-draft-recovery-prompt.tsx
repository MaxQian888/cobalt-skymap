'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { PlannerDraftRecoverySnapshot } from '@/lib/stores/session-plan-store';

interface PlannerDraftRecoveryPromptProps {
  recovery: PlannerDraftRecoverySnapshot | null;
  visible: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function PlannerDraftRecoveryPrompt({
  recovery,
  visible,
  onRestore,
  onDiscard,
}: PlannerDraftRecoveryPromptProps) {
  const t = useTranslations();

  if (!visible || !recovery) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm lg:flex-row lg:items-center lg:justify-between"
      data-testid="planner-draft-recovery-prompt"
    >
      <div>
        <p className="font-medium">{t('sessionPlanner.recoveryPromptTitle')}</p>
        <p className="text-xs text-muted-foreground">
          {recovery.relatedPlanName ?? t('sessionPlanner.recoveryPromptFallback')}
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onRestore}>
          {t('sessionPlanner.recoveryPromptRestore')}
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>
          {t('sessionPlanner.recoveryPromptDiscard')}
        </Button>
      </div>
    </div>
  );
}
