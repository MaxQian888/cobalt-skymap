'use client';

/**
 * Online Search Settings Component
 * Allows users to configure online search sources and preferences
 */

import { useTranslations } from 'next-intl';
import { useSearchStore, type SearchSourceConfig } from '@/lib/stores/search-store';
import { ONLINE_SEARCH_SOURCES } from '@/lib/services/online-search-service';
import type { OnlineSearchSettingsProps, OnlineSearchSettingsContentProps } from '@/types/starmap/search';
import { SOURCE_COLOR_MAP } from '@/lib/core/constants/search';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SwitchItem } from '@/components/ui/switch-item';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Globe,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Trash2,
} from 'lucide-react';

export type { OnlineSearchSettingsProps, OnlineSearchSettingsContentProps } from '@/types/starmap/search';

export function OnlineSearchSettings({ compact = false }: OnlineSearchSettingsProps) {
  const t = useTranslations();
  
  const {
    settings,
    currentSearchMode,
    onlineStatus,
    updateSettings,
    setSearchMode,
    toggleOnlineSource,
    clearCache,
  } = useSearchStore();
  
  const sourceConfigs: Array<{
    config: SearchSourceConfig;
    info: typeof ONLINE_SEARCH_SOURCES[keyof typeof ONLINE_SEARCH_SOURCES];
    isOnline: boolean;
  }> = settings.onlineSources
    .filter(s => s.id !== 'local')
    .map(config => ({
      config,
      info: ONLINE_SEARCH_SOURCES[config.id as keyof typeof ONLINE_SEARCH_SOURCES],
      isOnline: onlineStatus[config.id] ?? false,
    }));
  
  if (compact) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Globe className={`h-4 w-4 ${currentSearchMode !== 'local' ? 'text-green-500' : 'text-muted-foreground'}`} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {t('search.onlineSearchSettings')}
          </TooltipContent>
        </Tooltip>
        
        <PopoverContent className="w-80" align="end">
          <OnlineSearchSettingsContent
            t={t}
            settings={settings}
            currentSearchMode={currentSearchMode}
            sourceConfigs={sourceConfigs}
            updateSettings={updateSettings}
            setSearchMode={setSearchMode}
            toggleOnlineSource={toggleOnlineSource}
            clearCache={clearCache}
          />
        </PopoverContent>
      </Popover>
    );
  }
  
  return (
    <div className="space-y-4">
      <OnlineSearchSettingsContent
        t={t}
        settings={settings}
        currentSearchMode={currentSearchMode}
        sourceConfigs={sourceConfigs}
        updateSettings={updateSettings}
        setSearchMode={setSearchMode}
        toggleOnlineSource={toggleOnlineSource}
        clearCache={clearCache}
      />
    </div>
  );
}

function OnlineSearchSettingsContent({
  t,
  settings,
  currentSearchMode,
  sourceConfigs,
  updateSettings,
  setSearchMode,
  toggleOnlineSource,
  clearCache,
}: OnlineSearchSettingsContentProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <span className="font-medium text-sm">{t('search.onlineSearch')}</span>
      </div>
      
      {/* Search Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t('search.searchMode')}</Label>
        <ToggleGroup
          type="single"
          value={currentSearchMode}
          onValueChange={(value) => { if (value) setSearchMode(value as 'local' | 'hybrid' | 'online'); }}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ToggleGroupItem value="local" className="flex-1 h-7 text-xs">
            <WifiOff className="h-3 w-3 mr-1" />
            {t('search.mode.local')}
          </ToggleGroupItem>
          <ToggleGroupItem value="hybrid" className="flex-1 h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" />
            {t('search.mode.hybrid')}
          </ToggleGroupItem>
          <ToggleGroupItem value="online" className="flex-1 h-7 text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            {t('search.mode.online')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      
      <Separator />
      
      {/* Online Sources */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t('search.onlineSources')}</Label>
        <div className="space-y-2">
          {sourceConfigs.map(({ config, info, isOnline }) => (
            <div
              key={config.id}
              className="flex items-center justify-between p-2 rounded-md border bg-card"
            >
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => toggleOnlineSource(config.id, checked)}
                  disabled={currentSearchMode === 'local'}
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{info?.name || config.id}</span>
                    {isOnline ? (
                      <Badge variant="outline" className="h-4 text-[10px] bg-green-500/10 text-green-500 border-green-500/30">
                        {t('common.online')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 text-[10px] bg-red-500/10 text-red-500 border-red-500/30">
                        {t('common.offline')}
                      </Badge>
                    )}
                  </div>
                  {info?.id && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {t(`search.${info.id}Description` as Parameters<typeof t>[0])}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <Separator />
      
      {/* Settings */}
      <div className="space-y-3">
        {/* Timeout */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('search.timeout')}
            </Label>
            <span className="text-xs text-muted-foreground">{settings.timeout / 1000}s</span>
          </div>
          <Slider
            value={[settings.timeout]}
            onValueChange={([v]) => updateSettings({ timeout: v })}
            min={5000}
            max={30000}
            step={1000}
            disabled={currentSearchMode === 'local'}
          />
        </div>
        
        {/* Cache settings */}
        <SwitchItem
          label={t('search.cacheResults')}
          checked={settings.cacheResults}
          onCheckedChange={(checked) => updateSettings({ cacheResults: checked })}
          className="text-xs"
        />
        
        {/* Show source badges */}
        <SwitchItem
          label={t('search.showSourceBadges')}
          checked={settings.showSourceBadges}
          onCheckedChange={(checked) => updateSettings({ showSourceBadges: checked })}
          className="text-xs"
        />

        {/* Group by source */}
        <SwitchItem
          label={t('search.groupBySource', { defaultValue: 'Group by Source' })}
          checked={settings.groupBySource}
          onCheckedChange={(checked) => updateSettings({ groupBySource: checked })}
          className="text-xs"
        />
        
        {/* Clear cache */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={clearCache}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          {t('search.clearCache')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Source badge component for search results
 */
export function SourceBadge({ source }: { source: string }) {
  const t = useTranslations();
  const { settings } = useSearchStore();
  
  if (!settings.showSourceBadges || source === 'local') {
    return null;
  }
  
  const sourceInfo = ONLINE_SEARCH_SOURCES[source as keyof typeof ONLINE_SEARCH_SOURCES];
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`h-4 text-[9px] px-1 ${SOURCE_COLOR_MAP[source] || 'bg-gray-500/10 text-gray-500'}`}
        >
          {sourceInfo?.name || source}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {t('search.sourceFrom', { source: sourceInfo?.name || source })}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Online status indicator
 */
export function OnlineStatusIndicator() {
  const t = useTranslations();
  const { currentSearchMode, onlineStatus } = useSearchStore();
  
  const anyOnline = Object.values(onlineStatus).some(v => v);
  const isOnlineMode = currentSearchMode !== 'local';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1 text-xs ${
          isOnlineMode && anyOnline ? 'text-green-500' : 'text-muted-foreground'
        }`}>
          {isOnlineMode && anyOnline ? (
            <Wifi className="h-3 w-3" />
          ) : isOnlineMode ? (
            <WifiOff className="h-3 w-3 text-yellow-500" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isOnlineMode && anyOnline 
          ? t('search.onlineSearchActive')
          : isOnlineMode 
            ? t('search.onlineSearchUnavailable')
            : t('search.localSearchOnly')
        }
      </TooltipContent>
    </Tooltip>
  );
}
