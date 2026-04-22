'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronUp, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatTimeShort } from '@/lib/astronomy/astro-utils';
import type { RiseTransitSetGridProps } from '@/types/starmap/objects';

export const RiseTransitSetGrid = memo(function RiseTransitSetGrid({
  visibility,
  variant = 'full',
  className,
}: RiseTransitSetGridProps) {
  const t = useTranslations();

  const isCompact = variant === 'compact';

  const cardClass = isCompact
    ? 'gap-0 rounded-md border-border/50 bg-muted/30 py-0 shadow-none'
    : 'gap-0 rounded-lg border-border/70 bg-muted/30 py-0 shadow-none';

  const labelClass = isCompact
    ? 'text-[10px] text-muted-foreground'
    : 'text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1';

  const valueClass = isCompact
    ? 'font-mono text-foreground'
    : 'font-mono text-sm font-medium';

  return (
    <div className={cn(
      'grid grid-cols-3',
      isCompact ? 'gap-0.5 sm:gap-1 text-xs' : 'gap-2',
      className,
    )}>
      <Card className={cardClass}>
        <CardContent className={cn(isCompact ? 'space-y-1 p-1' : 'space-y-1 p-3')}>
          <div className={labelClass}>
            {!isCompact && <ChevronUp className="h-3 w-3" />}
            {t('time.rise')}
          </div>
          <p className={valueClass}>
            {visibility.isCircumpolar ? '∞' : formatTimeShort(visibility.riseTime)}
          </p>
        </CardContent>
      </Card>
      <Card className={cardClass}>
        <CardContent className={cn(isCompact ? 'space-y-1 p-1' : 'space-y-1 p-3')}>
          <div className={labelClass}>
            {!isCompact && <Clock className="h-3 w-3" />}
            {t('time.transit')}
          </div>
          <p className={valueClass}>
            {formatTimeShort(visibility.transitTime)}
          </p>
        </CardContent>
      </Card>
      <Card className={cardClass}>
        <CardContent className={cn(isCompact ? 'space-y-1 p-1' : 'space-y-1 p-3')}>
          <div className={labelClass}>
            {!isCompact && <ChevronUp className="h-3 w-3 rotate-180" />}
            {t('time.set')}
          </div>
          <p className={valueClass}>
            {visibility.isCircumpolar ? '∞' : formatTimeShort(visibility.setTime)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
});
