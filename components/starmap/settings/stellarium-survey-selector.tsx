'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SKY_SURVEYS } from '@/lib/core/constants';
import { hipsService, type HiPSSurvey } from '@/lib/services/hips-service';
import { fetchCatalogHiPS } from '@/lib/services/hips/service';
import type { HiPSSurvey as CatalogHiPSSurvey } from '@/lib/services/hips/types';
import { useHipsSurveyStore } from '@/lib/stores';
import { offlineCacheManager, type HiPSCacheStatus } from '@/lib/offline';
import {
  Map,
  Telescope,
  Search,
  Globe,
  Download,
  Check,
  Loader2,
  HardDrive,
  Wifi,
  WifiOff,
  Star,
  Database,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('survey-selector');

interface StellariumSurveySelectorProps {
  surveyEnabled: boolean;
  surveyId: string;
  surveyUrl?: string;
  onSurveyChange: (surveyId: string, surveyUrl?: string) => void;
  onSurveyToggle: (enabled: boolean) => void;
}

// Convert local SKY_SURVEYS to HiPSSurvey format
function convertToHiPSSurvey(survey: typeof SKY_SURVEYS[0]): HiPSSurvey {
  return {
    id: survey.id,
    name: survey.name,
    url: survey.url,
    description: survey.description,
    category: survey.category,
    maxOrder: 11,
    tileFormat: 'jpeg',
    frame: 'equatorial',
    isLocal: true,
  };
}

export function StellariumSurveySelector({
  surveyEnabled,
  surveyId,
  surveyUrl,
  onSurveyChange,
  onSurveyToggle,
}: StellariumSurveySelectorProps) {
  const t = useTranslations();
  
  // State for online survey search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [onlineSurveys, setOnlineSurveys] = useState<HiPSSurvey[]>([]);
  const [activeTab, setActiveTab] = useState<'local' | 'online' | 'catalogs'>('local');
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // Catalog HiPS discovery (Gaia, etc.) — managed in the dedicated survey store.
  const discoveredCatalogs = useHipsSurveyStore((s) => s.discoveredCatalogs);
  const setDiscoveredCatalogs = useHipsSurveyStore((s) => s.setDiscoveredCatalogs);
  const selectedCatalogId = useHipsSurveyStore((s) => s.selectedSurveyId);
  const setSelectedCatalog = useHipsSurveyStore((s) => s.setSelectedSurvey);
  const favoriteSurveyIds = useHipsSurveyStore((s) => s.favoriteSurveyIds);
  const toggleFavorite = useHipsSurveyStore((s) => s.toggleFavorite);
  const [isOnline, setIsOnline] = useState(true);
  
  // State for cache status
  const [cacheStatuses, setCacheStatuses] = useState<Record<string, HiPSCacheStatus>>({});
  const [downloadingIds, setDownloadingIds] = useState<string[]>([]);
  
  // Convert local surveys to HiPSSurvey format
  const localSurveys = useMemo(() => SKY_SURVEYS.map(convertToHiPSSurvey), []);
  
  // Group local surveys by category
  const opticalSurveys = localSurveys.filter((s) => s.category === 'optical');
  const infraredSurveys = localSurveys.filter((s) => s.category === 'infrared');
  const otherSurveys = localSurveys.filter((s) => s.category === 'other');

  // Find selected survey from either local or online
  const selectedSurvey = useMemo(() => {
    const local = localSurveys.find((s) => s.id === surveyId);
    if (local) return local;
    return onlineSurveys.find((s) => s.id === surveyId || s.url === surveyUrl);
  }, [surveyId, surveyUrl, localSurveys, onlineSurveys]);

  // Check online status
  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Fetch cache statuses for local surveys
  useEffect(() => {
    const fetchCacheStatuses = async () => {
      const results = await Promise.all(
        localSurveys.map((survey) => offlineCacheManager.getHiPSCacheStatus(survey))
      );
      const statuses: Record<string, HiPSCacheStatus> = {};
      localSurveys.forEach((survey, i) => {
        statuses[survey.id] = results[i];
      });
      setCacheStatuses(statuses);
    };
    fetchCacheStatuses();
  }, [localSurveys]);

  // Search online surveys
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !isOnline) return;
    
    setIsSearching(true);
    try {
      const results = await hipsService.searchSurveys(searchQuery, 30);
      setOnlineSurveys(results);
    } catch (error) {
      logger.error('Error searching surveys', error);
      toast.error(t('survey.searchFailed'));
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isOnline, t]);

  // Load recommended surveys when online tab is first opened
  useEffect(() => {
    if (activeTab === 'online' && onlineSurveys.length === 0 && isOnline) {
      const loadRecommended = async () => {
        setIsSearching(true);
        try {
          const recommended = await hipsService.getRecommendedSurveys();
          setOnlineSurveys(recommended);
        } catch (error) {
          logger.error('Error loading recommended surveys', error);
        } finally {
          setIsSearching(false);
        }
      };
      loadRecommended();
    }
  }, [activeTab, onlineSurveys.length, isOnline]);

  // Discover catalog HiPS (Gaia, etc.) when the catalogs tab is first opened
  useEffect(() => {
    if (activeTab === 'catalogs' && discoveredCatalogs.length === 0) {
      let cancelled = false;
      // Async data fetch triggered by tab activation; defer the loading-state set past
      // the effect body so it doesn't run synchronously during the effect.
      queueMicrotask(() => {
        if (!cancelled) setIsLoadingCatalogs(true);
      });
      fetchCatalogHiPS()
        .then((catalogs) => {
          if (!cancelled) setDiscoveredCatalogs(catalogs);
        })
        .catch((error) => logger.error('Error loading catalog HiPS', error))
        .finally(() => {
          if (!cancelled) setIsLoadingCatalogs(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, discoveredCatalogs.length, setDiscoveredCatalogs]);

  // Handle survey selection
  const handleSelectSurvey = useCallback((survey: HiPSSurvey) => {
    onSurveyChange(survey.id, survey.url);
  }, [onSurveyChange]);

  // Download survey for offline use
  const handleDownloadSurvey = useCallback(async (survey: HiPSSurvey) => {
    if (downloadingIds.includes(survey.id)) return;
    
    setDownloadingIds(prev => [...prev, survey.id]);
    
    try {
      toast.loading(t('survey.downloadingTiles'), { id: `download-${survey.id}` });
      
      const success = await offlineCacheManager.downloadHiPSSurvey(
        survey,
        3, // Cache up to order 3
        (progress) => {
          const percent = Math.round((progress.downloadedFiles / progress.totalFiles) * 100);
          toast.loading(`${t('survey.downloadingTiles')} ${percent}%`, { id: `download-${survey.id}` });
        }
      );
      
      toast.dismiss(`download-${survey.id}`);
      
      if (success) {
        toast.success(t('survey.downloadComplete'));
        // Refresh cache status
        const status = await offlineCacheManager.getHiPSCacheStatus(survey);
        setCacheStatuses(prev => ({ ...prev, [survey.id]: status }));
      } else {
        toast.error(t('survey.downloadFailed'));
      }
    } catch (error) {
      toast.dismiss(`download-${survey.id}`);
      toast.error(t('survey.downloadFailed'));
      logger.error('Error downloading survey', error);
    } finally {
      setDownloadingIds(prev => prev.filter(id => id !== survey.id));
    }
  }, [downloadingIds, t]);

  // Render survey item
  const renderSurveyItem = (survey: HiPSSurvey, isSelected: boolean) => {
    const cacheStatus = cacheStatuses[survey.id];
    const isDownloading = downloadingIds.includes(survey.id);
    const isCached = cacheStatus?.cached ?? false;
    
    return (
      <div
        key={survey.id}
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors overflow-hidden',
          isSelected 
            ? 'bg-primary/20 border border-primary/50' 
            : 'hover:bg-muted/50 border border-transparent'
        )}
        onClick={() => handleSelectSurvey(survey)}
      >
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium truncate max-w-[140px]">{survey.name}</span>
            {isCached && (
              <Tooltip>
                <TooltipTrigger>
                  <HardDrive className="h-3 w-3 text-green-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>{t('survey.cachedOffline')}</TooltipContent>
              </Tooltip>
            )}
            {survey.isLocal && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 shrink-0">
                {t('survey.builtin')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{survey.description}</p>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : !isCached && isOnline ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadSurvey(survey);
                  }}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('survey.downloadForOffline')}</TooltipContent>
            </Tooltip>
          ) : null}
          
          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-3 w-full overflow-hidden">
        {/* Survey Enable Toggle */}
        <div className="flex items-center justify-between bg-muted/50 border border-border p-2.5 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <Map className="h-4 w-4 text-primary shrink-0" />
            <Label htmlFor="survey-enabled" className="text-foreground cursor-pointer text-sm truncate">
              {t('settings.skySurveyOverlay')}
            </Label>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-yellow-500" />
            )}
            <Switch
              id="survey-enabled"
              checked={surveyEnabled}
              onCheckedChange={onSurveyToggle}
            />
          </div>
        </div>

        {/* Survey Selector */}
        {surveyEnabled && (
          <div className="space-y-2 overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'local' | 'online' | 'catalogs')} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="local" className="text-xs h-7 px-2">
                  <Star className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{t('survey.builtinSurveys')}</span>
                </TabsTrigger>
                <TabsTrigger value="online" className="text-xs h-7 px-2" disabled={!isOnline}>
                  <Globe className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{t('survey.onlineSearch')}</span>
                </TabsTrigger>
                <TabsTrigger value="catalogs" className="text-xs h-7 px-2" disabled={!isOnline}>
                  <Database className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{t('survey.catalogs')}</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Local/Built-in Surveys */}
              <TabsContent value="local" className="mt-2">
                <ScrollArea className="h-[220px] pr-1">
                  <div className="space-y-3">
                    {/* Optical Surveys */}
                    <div>
                      <h4 className="text-xs font-semibold text-primary mb-2">
                        {t('settings.opticalSurveys')}
                      </h4>
                      <div className="space-y-1">
                        {opticalSurveys.map((survey) => 
                          renderSurveyItem(survey, survey.id === surveyId)
                        )}
                      </div>
                    </div>
                    
                    {/* Infrared Surveys */}
                    <div>
                      <h4 className="text-xs font-semibold text-orange-500 mb-2">
                        {t('settings.infraredSurveys')}
                      </h4>
                      <div className="space-y-1">
                        {infraredSurveys.map((survey) => 
                          renderSurveyItem(survey, survey.id === surveyId)
                        )}
                      </div>
                    </div>
                    
                    {/* Other Surveys */}
                    <div>
                      <h4 className="text-xs font-semibold text-purple-500 mb-2">
                        {t('settings.otherWavelengths')}
                      </h4>
                      <div className="space-y-1">
                        {otherSurveys.map((survey) => 
                          renderSurveyItem(survey, survey.id === surveyId)
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              
              {/* Online Survey Search */}
              <TabsContent value="online" className="mt-2">
                <div className="space-y-2">
                  {/* Search Input */}
                  <div className="flex gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder={t('survey.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="pl-7 h-8 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 px-2 shrink-0"
                      onClick={handleSearch}
                      disabled={isSearching || !searchQuery.trim()}
                    >
                      {isSearching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Search Results */}
                  <ScrollArea className="h-[180px] pr-1">
                    {isSearching ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : onlineSurveys.length > 0 ? (
                      <div className="space-y-1">
                        {onlineSurveys.map((survey) => 
                          renderSurveyItem(survey, survey.id === surveyId || survey.url === surveyUrl)
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Globe className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">{t('survey.searchForSurveys')}</p>
                        <p className="text-xs">{t('survey.searchHint')}</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>

              {/* Catalog HiPS (Gaia DR3, etc.) */}
              <TabsContent value="catalogs" className="mt-2">
                <ScrollArea className="h-[220px] pr-1">
                  {isLoadingCatalogs ? (
                    <div className="flex items-center justify-center h-[200px]">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : discoveredCatalogs.length > 0 ? (
                    <div className="space-y-1">
                      {discoveredCatalogs.map((catalog: CatalogHiPSSurvey) => {
                        const isSelected = catalog.id === selectedCatalogId;
                        const isFavorite = favoriteSurveyIds.includes(catalog.id);
                        return (
                          <div
                            key={catalog.id}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-accent',
                              isSelected && 'bg-primary/10 ring-1 ring-primary/40'
                            )}
                            onClick={() => setSelectedCatalog(isSelected ? null : catalog.id)}
                          >
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm truncate flex-1">{catalog.name}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {catalog.category}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              aria-label={t('survey.toggleFavorite')}
                              aria-pressed={isFavorite}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(catalog.id);
                              }}
                            >
                              <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current text-yellow-500')} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                      <Database className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">{t('survey.noCatalogs')}</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Selected Survey Info */}
            {selectedSurvey && (
              <div className="bg-muted/30 rounded-lg p-2 border border-border">
                <div className="flex items-center gap-2 mb-0.5">
                  <Telescope className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium truncate">{selectedSurvey.name}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{selectedSurvey.description}</p>
                {selectedSurvey.regime && (
                  <Badge variant="outline" className="mt-1 text-[10px] h-4">
                    {selectedSurvey.regime}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}



