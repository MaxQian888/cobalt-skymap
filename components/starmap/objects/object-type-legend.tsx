'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Star,
  Library,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getLegendItems } from '@/lib/astronomy/object-type-utils';
import type { ObjectTypeLegendContentProps, ObjectTypeLegendProps } from '@/types/starmap/objects';

function ObjectTypeLegendContent({ compact = false }: ObjectTypeLegendContentProps) {
  const t = useTranslations('objects');
  const tLegend = useTranslations('legend');

  const allItems = getLegendItems();

  const categories = [
    { key: 'galaxy' as const, label: tLegend('galaxies') },
    { key: 'nebula' as const, label: tLegend('nebulae') },
    { key: 'cluster' as const, label: tLegend('clusters') },
    { key: 'star' as const, label: tLegend('stars') },
    { key: 'solar' as const, label: tLegend('solarSystem') },
    { key: 'exotic' as const, label: tLegend('exoticObjects') },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 p-2">
        {allItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.labelKey} className="flex items-center gap-2 text-xs">
              <Icon className={cn('h-4 w-4 shrink-0', item.color)} />
              <span className="text-foreground truncate">{t(item.labelKey)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const items = allItems.filter((item) => item.group === category.key);
        if (items.length === 0) return null;

        return (
          <div key={category.key}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {category.label}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.labelKey}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('p-1.5 rounded-md bg-background/50', item.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-foreground">{t(item.labelKey)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const ObjectTypeLegend = memo(function ObjectTypeLegend({
  variant = 'popover',
  triggerClassName,
}: ObjectTypeLegendProps) {
  const t = useTranslations('legend');

  const triggerButton = (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-8 px-2 text-xs gap-1.5 touch-target', triggerClassName)}
    >
      <Library className="h-4 w-4" />
      <span className="hidden sm:inline">{t('objectTypes')}</span>
    </Button>
  );

  if (variant === 'dialog') {
    return (
      <Dialog>
        <DialogTrigger asChild>{triggerButton}</DialogTrigger>
        <DialogContent className="max-w-md max-h-[80vh] max-h-[80dvh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" />
              {t('objectTypesTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('objectTypesTitle')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] max-h-[60dvh] pr-4">
            <ObjectTypeLegendContent />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="flex items-center gap-2 mb-3">
          <Star className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t('objectTypesTitle')}</h3>
        </div>
        <ScrollArea className="max-h-[50vh] max-h-[50dvh]">
          <ObjectTypeLegendContent compact />
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});

export { ObjectTypeLegendContent };
