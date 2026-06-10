'use client';

import { memo, forwardRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Star, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StellariumSearch, type StellariumSearchRef } from '../search/stellarium-search';
import { FavoritesQuickAccess } from '../search/favorites-quick-access';
import { OnlineSearchSettings } from '../search/online-search-settings';
import type { SearchPanelProps } from '@/types/starmap/view';

export const SearchPanel = memo(forwardRef<StellariumSearchRef, SearchPanelProps>(
  function SearchPanel({ isOpen, isMobileShell = false, onClose, onSelect }, ref) {
    const t = useTranslations();
    const [showFavorites, setShowFavorites] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const mobileControlClass = isMobileShell ? 'h-9 w-9 min-w-9 touch-target' : 'h-6 w-6 min-w-6';

    const panelBody = (
      <ScrollArea
        data-starmap-ui-control="true"
        data-starmap-scroll-surface="true"
        className="max-h-[70vh] max-h-[70dvh] overscroll-contain"
      >
        {showFavorites ? (
          <FavoritesQuickAccess
            onSelect={(_item) => {
              setShowFavorites(false);
              onSelect();
            }}
            onNavigate={(_item) => {
              setShowFavorites(false);
              onSelect();
            }}
          />
        ) : showSettings ? (
          <OnlineSearchSettings compact />
        ) : (
          <StellariumSearch
            ref={ref}
            onSelect={onSelect}
            enableMultiSelect={true}
          />
        )}
      </ScrollArea>
    );

    const headerControls = (
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={showFavorites}
              onPressedChange={(pressed) => {
                setShowFavorites(pressed);
                if (pressed) setShowSettings(false);
              }}
              size="sm"
              className={`${mobileControlClass} data-[state=on]:bg-secondary`}
              aria-label={t('search.favorites')}
            >
              <Star className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{t('search.favorites')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              pressed={showSettings}
              onPressedChange={(pressed) => {
                setShowSettings(pressed);
                if (pressed) setShowFavorites(false);
              }}
              size="sm"
              className={`${mobileControlClass} data-[state=on]:bg-secondary`}
              aria-label={t('search.onlineSearchSettings')}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{t('search.onlineSearchSettings')}</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          className={mobileControlClass}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );

    if (isMobileShell) {
      return (
        <Drawer
          open={isOpen}
          repositionInputs={false}
          onOpenChange={(open) => { if (!open) onClose(); }}
        >
          <DrawerContent
            data-testid="search-panel"
            data-starmap-ui-control="true"
            className="max-h-[75vh] max-h-[75dvh] bg-card border-border"
          >
            <DrawerHeader className="pb-2 flex flex-row items-center justify-between border-b">
              <DrawerTitle className="text-base text-foreground">{t('starmap.searchObjects')}</DrawerTitle>
              {headerControls}
            </DrawerHeader>
            <div className="px-4 pb-4 pt-2">
              {panelBody}
            </div>
          </DrawerContent>
        </Drawer>
      );
    }

    return (
      <Card
        data-testid="search-panel"
        data-starmap-ui-control="true"
        className={cn(
        'absolute top-14 sm:top-16 left-2 sm:left-3 w-[calc(100vw-16px)] sm:w-96 md:w-[420px] sm:max-w-[calc(100vw-24px)] bg-card/95 backdrop-blur-sm border-border z-50 shadow-xl transition-all duration-200',
        isOpen
          ? 'animate-scale-in opacity-100 scale-100'
          : 'opacity-0 scale-95 pointer-events-none'
      )}
      >
        <CardHeader data-starmap-ui-control="true" className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-foreground">{t('starmap.searchObjects')}</CardTitle>
          {headerControls}
        </CardHeader>
        <CardContent>
          {panelBody}
        </CardContent>
      </Card>
    );
  }
));
SearchPanel.displayName = 'SearchPanel';
