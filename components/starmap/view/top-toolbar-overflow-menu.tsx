'use client';

import { Ellipsis } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TOOLBAR_ICON_TOGGLE_CLASS } from '@/components/common/toolbar-button';

interface TopToolbarOverflowMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The folded toolbar groups, in their original left-to-right order. */
  children: React.ReactNode;
}

/**
 * Priority+ overflow trigger for the desktop top toolbar. The lowest-priority
 * toolbar groups fold into this popover when the row would otherwise clip. The
 * folded groups keep their `data-tour-id` anchors, so the onboarding tour can
 * reveal them by opening this menu (via the `openToolbarOverflow` bridge action).
 */
export function TopToolbarOverflowMenu({ open, onOpenChange, children }: TopToolbarOverflowMenuProps) {
  const t = useTranslations();
  const label = t('mobileToolbar.more');

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="toolbar-overflow-trigger"
              data-tour-id="toolbar-overflow"
              aria-label={label}
              aria-haspopup="menu"
              aria-expanded={open}
              className={TOOLBAR_ICON_TOGGLE_CLASS}
            >
              <Ellipsis className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        data-starmap-ui-control="true"
        data-testid="toolbar-overflow-content"
        className="flex w-auto flex-col items-stretch gap-1.5 p-2"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
