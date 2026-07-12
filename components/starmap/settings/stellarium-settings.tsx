'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DisplaySettings } from './display-settings';

export function StellariumSettings() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="standard-form">
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 backdrop-blur-sm ${open ? 'bg-primary/30 text-primary' : 'bg-background/60 text-foreground hover:bg-background/80'}`}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('settings.displaySettings')}</p>
        </TooltipContent>
      </Tooltip>
      <ResponsiveDialogContent desktopClassName="sm:max-w-md flex flex-col overflow-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t('settings.displaySettings')}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <ScrollArea className="flex-1 -mx-2 px-2">
          <DisplaySettings />
        </ScrollArea>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
