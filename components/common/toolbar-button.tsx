"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Unified resting surface/color for toolbar icon toggles. Shared so the bespoke
 * Sensor/AR toggles' resting branch matches the StatusToggleButton primitive
 * (search/night) and the LanguageSwitcher — one resting look across the row
 * (resolves the bg-card/60 vs bg-background/60 drift; ui-audit #11 / NEW-consistency-1).
 * Apply to a toggle's OWN resting branch, never as a trailing className over an
 * active conditional (it would override the active style).
 */
export const TOOLBAR_ICON_RESTING_CLASS =
  "bg-card/60 border border-border/50 text-foreground/80 hover:text-foreground hover:bg-accent";

/** Full resting class (sizing + blur + resting surface) for chrome-less, stateless toggles like LanguageSwitcher. */
export const TOOLBAR_ICON_TOGGLE_CLASS = cn(
  "h-9 w-9 rounded-md backdrop-blur-md",
  TOOLBAR_ICON_RESTING_CLASS,
);

const toolbarButtonVariants = cva(
  "gap-1.5 transition-all duration-200 bg-card/80 backdrop-blur-sm border border-border/50 text-foreground/80 hover:text-foreground hover:bg-accent hover:border-border",
  {
    variants: {
      size: {
        sm: "h-8 px-2",
        default: "h-9 px-2",
        lg: "h-10 px-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toolbarButtonVariants> {
  /** Icon element to display */
  icon: React.ReactNode;
  /** Label text (shown in larger screens or tooltip) */
  label: string;
  /** Whether to always show only the icon */
  iconOnly?: boolean;
  /** Breakpoint at which to show label (default: 'lg') */
  showLabelAt?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Tooltip placement */
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /** Active state */
  isActive?: boolean;
  /** Button variant */
  variant?: "default" | "ghost" | "outline";
}

/**
 * Responsive toolbar button that shows icon-only on small screens
 * and icon + label on larger screens. Always shows a tooltip with the label.
 */
export function ToolbarButton({
  icon,
  label,
  iconOnly = false,
  showLabelAt = "lg",
  tooltipSide = "bottom",
  size = "default",
  isActive = false,
  className,
  variant = "ghost",
  ...props
}: ToolbarButtonProps) {
  // Build responsive classes for label visibility
  const labelVisibilityClass = iconOnly
    ? "hidden"
    : {
        sm: "hidden sm:inline",
        md: "hidden md:inline",
        lg: "hidden lg:inline",
        xl: "hidden xl:inline",
        "2xl": "hidden 2xl:inline",
      }[showLabelAt];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          className={cn(
            toolbarButtonVariants({ size }),
            isActive && "bg-primary/20 text-primary border-primary/50",
            className
          )}
          {...props}
        >
          <span className="shrink-0">{icon}</span>
          <span
            className={cn(
              "text-xs font-medium truncate max-w-[80px]",
              labelVisibilityClass
            )}
          >
            {label}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export interface ToolbarGroupProps {
  children: React.ReactNode;
  className?: string;
  /** Gap between buttons */
  gap?: "none" | "sm" | "md";
  /** Layout axis (default horizontal) */
  orientation?: "horizontal" | "vertical";
}

/**
 * Container for grouping toolbar buttons together
 */
export function ToolbarGroup({
  children,
  className,
  gap = "sm",
  orientation = "horizontal",
}: ToolbarGroupProps) {
  const gapClass = {
    none: "gap-0",
    sm: "gap-1",
    md: "gap-2",
  }[gap];

  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={cn(
        "flex items-center",
        orientation === "vertical" ? "flex-col" : "flex-row",
        "bg-card/60 backdrop-blur-md",
        "border border-border/50 rounded-lg",
        "p-1",
        gapClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export interface ToolbarSeparatorProps {
  className?: string;
  orientation?: "vertical" | "horizontal";
}

/**
 * Visual separator for toolbar sections
 */
export function ToolbarSeparator({ className, orientation = "vertical" }: ToolbarSeparatorProps) {
  return (
    <div
      className={cn(
        "bg-border/50",
        orientation === "vertical" ? "w-px h-6 mx-1" : "h-px w-full my-1",
        className
      )}
    />
  );
}
