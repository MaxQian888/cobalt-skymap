'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const statusToggleButtonVariants = cva(
  'h-9 w-9 backdrop-blur-md border border-border/50 transition-colors touch-target toolbar-btn',
  {
    variants: {
      tone: {
        primary: '',
        night: '',
      },
      active: { true: '', false: '' },
    },
    compoundVariants: [
      {
        active: false,
        className: 'bg-card/60 text-foreground/80 hover:text-foreground hover:bg-accent',
      },
      {
        tone: 'primary',
        active: true,
        className: 'bg-primary/20 text-primary border-primary/50',
      },
      {
        tone: 'night',
        active: true,
        className: 'bg-red-900/50 text-red-400 hover:bg-red-900/70',
      },
    ],
    defaultVariants: { tone: 'primary', active: false },
  }
);

export interface StatusToggleButtonProps
  extends Omit<React.ComponentProps<typeof Button>, 'children'>,
    VariantProps<typeof statusToggleButtonVariants> {
  icon: React.ReactNode;
  /** Accessible name + tooltip text */
  label: string;
  /** On/off state — drives aria-pressed and active styling */
  active: boolean;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Icon button that reflects an on/off state. Unifies the resting toolbar
 * style and tone-driven active style so search/night/sensor/AR toggles stop
 * re-declaring the same class strings (see ui-audit #11). Exposes the label as
 * the accessible name and the on/off state as aria-pressed.
 */
export function StatusToggleButton({
  icon,
  label,
  active,
  tone = 'primary',
  tooltipSide = 'bottom',
  className,
  ...props
}: StatusToggleButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={active}
          className={cn(statusToggleButtonVariants({ tone, active }), className)}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
