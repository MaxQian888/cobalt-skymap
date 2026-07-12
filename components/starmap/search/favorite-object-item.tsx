'use client';

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import { Star, Navigation, MoreHorizontal, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { FavoriteObject } from '@/lib/stores';

export interface FavoriteObjectItemProps {
  object: FavoriteObject;
  isFavorite?: boolean;
  showActions?: boolean;
  onSelect: (object: FavoriteObject) => void;
  onNavigate?: (object: FavoriteObject) => void;
  onEditTags?: (id: string) => void;
  onRemove?: (id: string) => void;
}

export const FavoriteObjectItem = memo(function FavoriteObjectItem({
  object,
  isFavorite = true,
  showActions = true,
  onSelect,
  onNavigate,
  onEditTags,
  onRemove,
}: FavoriteObjectItemProps) {
  const t = useTranslations();

  return (
    <div
      className="group flex items-center gap-2 px-2 py-1.5 hover:bg-accent rounded-md transition-colors cursor-pointer"
      onClick={() => onSelect(object)}
    >
      <Star className={cn(
        'h-4 w-4 shrink-0',
        isFavorite
          ? 'text-yellow-500 fill-yellow-500'
          : 'text-muted-foreground'
      )} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{object.name}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {object.type && <span>{object.type}</span>}
          {object.constellation && (
            <>
              <span>•</span>
              <span>{object.constellation}</span>
            </>
          )}
        </div>
      </div>

      {object.tags.length > 0 && (
        <div className="flex gap-0.5">
          {object.tags.slice(0, 2).map(tag => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] px-1 py-0"
            >
              {t(`favorites.tags.${tag}` as Parameters<typeof t>[0], { defaultValue: tag })}
            </Badge>
          ))}
          {object.tags.length > 2 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              +{object.tags.length - 2}
            </Badge>
          )}
        </div>
      )}

      {showActions && (
        <div className="flex items-center gap-0.5 shell-desktop:opacity-0 shell-desktop:group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shell-mobile:min-h-11 shell-mobile:min-w-11"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate?.(object);
                }}
              >
                <Navigation className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('favorites.goTo')}</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shell-mobile:min-h-11 shell-mobile:min-w-11"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onEditTags?.(object.id)}>
                <Tag className="h-4 w-4 mr-2" />
                {t('favorites.manageTags')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onRemove?.(object.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('favorites.remove')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
});
