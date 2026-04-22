'use client';

import { memo, forwardRef } from 'react';
import { useTranslations } from 'next-intl';
import { translateCelestialName } from '@/lib/translations';
import type { SkyCultureLanguage } from '@/lib/core/types';
import type { SearchResultItemProps } from '@/types/starmap/search';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HighlightText } from './search-utils';
import { SourceBadge } from './online-search-settings';

export { getResultId } from '@/lib/core/search-utils';
export { type SkyCultureLanguage } from '@/lib/core/types';
export type { SearchResultItemProps } from '@/types/starmap/search';

export const SearchResultItemRow = memo(forwardRef<HTMLDivElement, SearchResultItemProps>(function SearchResultItemRow({
  item,
  itemId,
  checked,
  isHighlighted = false,
  showCheckbox = true,
  skyCultureLanguage,
  onSelect,
  onToggleSelection,
  onMouseEnter,
  onAddToTargetList,
  globalIndex = 0,
  searchQuery = '',
}, ref) {
  const t = useTranslations();

  return (
    <div
      ref={ref}
      id={`search-option-${itemId}`}
      role="option"
      aria-selected={isHighlighted}
      className={cn(
        'flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors',
        checked && 'bg-accent/30',
        isHighlighted && 'ring-2 ring-primary bg-accent/40'
      )}
      onMouseEnter={() => onMouseEnter?.(globalIndex)}
    >
      {showCheckbox && onToggleSelection && (
        <Checkbox
          checked={checked}
          onCheckedChange={() => onToggleSelection(itemId)}
          className="h-4 w-4"
        />
      )}
      
      <div
        className="flex-1 flex items-center gap-2 min-w-0 text-left"
        onClick={() => onSelect(item)}
      >
        <div className="flex-1 min-w-0">
          <HighlightText
            text={translateCelestialName(item.Name, skyCultureLanguage as SkyCultureLanguage)}
            query={searchQuery}
            className="text-sm text-foreground font-medium truncate block"
          />
          {item['Common names'] && (
            <HighlightText
              text={translateCelestialName(item['Common names'], skyCultureLanguage as SkyCultureLanguage)}
              query={searchQuery}
              className="text-xs text-muted-foreground truncate block"
            />
          )}
        </div>
        
        <div className="flex items-center gap-1.5 shrink-0">
          {item._onlineSource && (
            <SourceBadge source={item._onlineSource} />
          )}
          {item.Magnitude !== undefined && (
            <Badge variant="secondary" className="h-4 text-[10px] px-1 py-0">
              {item.Magnitude.toFixed(1)}m
            </Badge>
          )}
          {item.Size && (
            <Badge variant="outline" className="h-4 text-[10px] px-1 py-0">
              {item.Size}
            </Badge>
          )}
          {item.RA !== undefined && item.Dec !== undefined && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {item.RA.toFixed(1)}°/{item.Dec.toFixed(1)}°
            </span>
          )}
        </div>
      </div>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onAddToTargetList(item);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {t('actions.addToTargetList')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}));
