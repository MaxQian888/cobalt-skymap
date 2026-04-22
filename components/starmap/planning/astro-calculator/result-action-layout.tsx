'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME = 'w-full sm:w-auto';
export const ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME = 'h-8 w-8 shrink-0';

interface AstroCalculatorResultActionsBarProps {
  children: ReactNode;
  className?: string;
}

export function AstroCalculatorResultActionsBar({
  children,
  className,
}: AstroCalculatorResultActionsBarProps) {
  return (
    <div
      data-testid="astro-calculator-result-actions"
      className={cn(
        'grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface AstroCalculatorRowActionsProps {
  rowKey: string;
  children: ReactNode;
  className?: string;
}

export function AstroCalculatorRowActions({
  rowKey,
  children,
  className,
}: AstroCalculatorRowActionsProps) {
  return (
    <div
      data-testid={`astro-calculator-row-actions-${rowKey}`}
      className={cn('flex flex-wrap items-center justify-end gap-1 sm:flex-nowrap', className)}
    >
      {children}
    </div>
  );
}
