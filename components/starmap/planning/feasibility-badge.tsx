'use client';

import { useTranslations } from 'next-intl';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getFeasibilityColor, getFeasibilityBadgeColor } from '@/lib/core/constants/planning-styles';
import type { ImagingFeasibility } from '@/lib/astronomy/astro-utils';

interface FeasibilityBadgeProps {
  feasibility: ImagingFeasibility;
  variant?: 'badge' | 'inline';
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom';
  className?: string;
}

export function FeasibilityBadge({
  feasibility,
  variant = 'badge',
  tooltipSide = 'left',
  className,
}: FeasibilityBadgeProps) {
  const t = useTranslations();

  const tooltipContent = (
    <div className="space-y-1 text-xs">
      <div className="grid grid-cols-2 gap-x-2">
        <span>{t('feasibility.moon')}:</span><span>{feasibility.moonScore}</span>
        <span>{t('feasibility.altitude')}:</span><span>{feasibility.altitudeScore}</span>
        <span>{t('feasibility.duration')}:</span><span>{feasibility.durationScore}</span>
        <span>{t('feasibility.twilight')}:</span><span>{feasibility.twilightScore}</span>
      </div>
      {feasibility.warnings.length > 0 && (
        <div className="text-yellow-400 mt-1">
          {feasibility.warnings[0]}
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Item
            variant="muted"
            size="sm"
            className={cn(
              'justify-between rounded-lg text-xs',
              getFeasibilityColor(feasibility.recommendation),
              className,
            )}
          >
            <ItemContent className="min-w-0 gap-0">
              <ItemTitle className="gap-1.5 text-xs font-medium">
                {feasibility.recommendation === 'excellent' || feasibility.recommendation === 'good'
                  ? <TrendingUp className="h-3 w-3" />
                  : <AlertTriangle className="h-3 w-3" />
                }
                <span className="capitalize">{t(`shotList.feasibility.${feasibility.recommendation}`)}</span>
              </ItemTitle>
            </ItemContent>
            <ItemActions className="font-mono text-xs">
              <span>{feasibility.score}/100</span>
            </ItemActions>
          </Item>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="max-w-56">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-2', className)}>
          <Badge className={`${getFeasibilityBadgeColor(feasibility.recommendation)} text-white text-[10px] h-5`}>
            {feasibility.recommendation === 'excellent' || feasibility.recommendation === 'good'
              ? <TrendingUp className="h-3 w-3" />
              : <AlertTriangle className="h-3 w-3" />
            }
            <span className="ml-1 capitalize">{t(`shotList.feasibility.${feasibility.recommendation}`)}</span>
          </Badge>
          <span className="text-[10px] text-muted-foreground">{feasibility.score}/100</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="max-w-48">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
