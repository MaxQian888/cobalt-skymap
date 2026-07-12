'use client';

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import {
  Satellite,
  Eye,
  Clock,
  MapPin,
  RefreshCw,
  Star,
  Orbit,
  ArrowUp,
  Timer,
  Wifi,
  WifiOff,
  Settings,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMountStore, useStellariumStore, useSatelliteStore, type TrackedSatellite } from '@/lib/stores';
import type { SatelliteData } from '@/lib/core/types';
import type { SatelliteCardProps, PassCardProps } from '@/types/starmap/overlays';
import { getSatelliteTypeColor, getSatelliteTypeLabelKey } from '@/lib/constants/satellite-constants';
import { type ObserverLocation } from '@/lib/services/satellite-propagator';
import {
  fetchSatellitesFromCelesTrak,
  SAMPLE_SATELLITES,
  generateSamplePasses,
  SATELLITE_SOURCES,
  getAvailableGroups,
} from '@/lib/services/satellite/celestrak-service';
import { createLogger } from '@/lib/logger';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/search-input';

const logger = createLogger('satellite-tracker');

// ============================================================================
// Satellite Card Component (Memoized)
// ============================================================================

const SatelliteCard = memo(function SatelliteCard({ 
  satellite, 
  onTrack 
}: SatelliteCardProps) {
  const t = useTranslations();
  
  return (
    <Card className="border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Satellite className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-sm truncate">{satellite.name}</span>
              {satellite.isVisible && (
                <Badge className="bg-green-500/20 text-green-400 text-[10px]">
                  {t('satellites.visible')}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn('text-[10px]', getSatelliteTypeColor(satellite.type))}>
                {t(getSatelliteTypeLabelKey(satellite.type))}
              </Badge>
              <span className="text-xs text-muted-foreground">
                NORAD: {satellite.noradId}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="block text-[10px]">{t('satellites.altitude')}</span>
                <span className="text-foreground">{satellite.altitude} km</span>
              </div>
              <div>
                <span className="block text-[10px]">{t('satellites.velocity')}</span>
                <span className="text-foreground">{satellite.velocity} km/s</span>
              </div>
              <div>
                <span className="block text-[10px]">{t('satellites.period')}</span>
                <span className="text-foreground">{(satellite.period ?? 0).toFixed(1)} min</span>
              </div>
            </div>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onTrack}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('satellites.track')}</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Pass Card Component (Memoized)
// ============================================================================

const PassCard = memo(function PassCard({ 
  pass, 
  onTrack 
}: PassCardProps) {
  const t = useTranslations();
  const now = new Date();
  const isActive = pass.startTime <= now && pass.endTime >= now;
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const getTimeUntil = () => {
    if (isActive) return t('satellites.inProgress');
    const diff = pass.startTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  
  return (
    <Card className={cn(
      'border-border transition-colors',
      isActive && 'border-green-500/50 bg-green-500/5'
    )}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm truncate">{pass.satellite.name}</span>
              {isActive && (
                <Badge className="bg-green-500/20 text-green-400 text-[10px] animate-pulse">
                  {t('satellites.live')}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
              <div className="flex items-center gap-1">
                <Timer className="h-3 w-3" />
                <span>{getTimeUntil()}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3" />
                <span>{pass.maxEl}°</span>
              </div>
              {pass.magnitude && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  <span>mag {pass.magnitude.toFixed(1)}</span>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center p-1 bg-muted/50 rounded">
                <div className="text-[10px] text-muted-foreground">{t('satellites.start')}</div>
                <div className="font-mono">{formatTime(pass.startTime)}</div>
                <div className="text-[10px] text-muted-foreground">{pass.startAz}° Az</div>
              </div>
              <div className="text-center p-1 bg-primary/10 rounded">
                <div className="text-[10px] text-muted-foreground">{t('satellites.max')}</div>
                <div className="font-mono text-primary">{formatTime(pass.maxTime)}</div>
                <div className="text-[10px] text-primary">{pass.maxEl}° El</div>
              </div>
              <div className="text-center p-1 bg-muted/50 rounded">
                <div className="text-[10px] text-muted-foreground">{t('satellites.end')}</div>
                <div className="font-mono">{formatTime(pass.endTime)}</div>
                <div className="text-[10px] text-muted-foreground">{pass.endAz}° Az</div>
              </div>
            </div>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onTrack}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('satellites.track')}</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Main Component
// ============================================================================

export function SatelliteTracker() {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<'passes' | 'catalog'>('passes');
  const [showSettings, setShowSettings] = useState(false);
  const [dataSources, setDataSources] = useState(() => 
    SATELLITE_SOURCES.map(s => ({ ...s }))
  );
  
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const profileInfo = useMountStore((state) => state.profileInfo);
  
  // Satellite display store
  const showSatellitesOnMap = useSatelliteStore((state) => state.showSatellites);
  const setShowSatellitesOnMap = useSatelliteStore((state) => state.setShowSatellites);
  const addTrackedSatellite = useSatelliteStore((state) => state.addTrackedSatellite);
  const selectedGroups = useSatelliteStore((state) => state.selectedGroups);
  const setSelectedGroups = useSatelliteStore((state) => state.setSelectedGroups);
  const availableGroups = useMemo(() => getAvailableGroups(), []);
  
  // Satellites state - start with sample data, fetch real data when online
  const [satellites, setSatellites] = useState<SatelliteData[]>(SAMPLE_SATELLITES);
  const passes = useMemo(() => generateSamplePasses(satellites), [satellites]);
  
  // Get observer location for SGP4 calculations
  const observerLocation: ObserverLocation = useMemo(() => ({
    latitude: profileInfo.AstrometrySettings.Latitude || 0,
    longitude: profileInfo.AstrometrySettings.Longitude || 0,
    altitude: profileInfo.AstrometrySettings.Elevation || 0,
  }), [profileInfo.AstrometrySettings]);
  
  // Fetch satellites when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const fetchSatellites = async () => {
      setIsLoading(true);
      try {
        // Fetch from enabled sources
        const enabledSources = dataSources.filter(s => s.enabled);
        const allSatellites: SatelliteData[] = [];
        
        for (const source of enabledSources) {
          if (source.id === 'celestrak') {
            // Fetch the user-selected CelesTrak groups with observer location for SGP4.
            const categories = selectedGroups.length > 0 ? selectedGroups : ['stations'];
            for (const cat of categories) {
              const sats = await fetchSatellitesFromCelesTrak(cat, observerLocation);
              allSatellites.push(...sats);
            }
          }
        }
        
        if (allSatellites.length > 0) {
          // Deduplicate by NORAD ID
          const uniqueSats = Array.from(
            new Map(allSatellites.map(s => [s.noradId, s])).values()
          );
          setSatellites(uniqueSats);
          setIsOnline(true);
        } else {
          // Fallback to sample data
          setSatellites(SAMPLE_SATELLITES);
          setIsOnline(false);
        }
      } catch (error) {
        logger.error('Failed to fetch satellites', error);
        setIsOnline(false);
        setSatellites(SAMPLE_SATELLITES);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSatellites();
  }, [open, dataSources, observerLocation, selectedGroups]);
  
  // Filter satellites
  const filteredSatellites = useMemo(() => {
    let filtered = satellites;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.noradId.toString().includes(query)
      );
    }
    
    if (showOnlyVisible) {
      filtered = filtered.filter(s => s.isVisible);
    }
    
    return filtered;
  }, [satellites, searchQuery, showOnlyVisible]);
  
  // Filter passes (next 24 hours)
  const upcomingPasses = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return passes.filter(p => p.endTime >= now && p.startTime <= tomorrow);
  }, [passes]);
  
  // Toggle data source
  const toggleDataSource = useCallback((id: string) => {
    setDataSources(prev => prev.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  }, []);

  // Toggle a CelesTrak group in the refresh selection (keep at least one).
  const toggleGroup = useCallback((group: string) => {
    const next = selectedGroups.includes(group)
      ? selectedGroups.filter(g => g !== group)
      : [...selectedGroups, group];
    if (next.length > 0) setSelectedGroups(next);
  }, [selectedGroups, setSelectedGroups]);
  
  // Handle track satellite - jump to position and add to tracked list
  const handleTrack = useCallback((satellite: SatelliteData) => {
    // Add to tracked satellites for rendering on map
    const trackedSat: TrackedSatellite = {
      id: satellite.id,
      name: satellite.name,
      noradId: satellite.noradId,
      type: satellite.type,
      altitude: satellite.altitude,
      velocity: satellite.velocity,
      inclination: satellite.inclination ?? 0,
      period: satellite.period ?? 0,
      ra: satellite.ra ?? 0,
      dec: satellite.dec ?? 0,
      azimuth: satellite.azimuth,
      elevation: satellite.elevation,
      magnitude: satellite.magnitude,
      isVisible: satellite.isVisible,
      source: satellite.source,
    };
    addTrackedSatellite(trackedSat);
    
    // Enable satellite display if not already
    if (!showSatellitesOnMap) {
      setShowSatellitesOnMap(true);
    }
    
    // Jump to satellite position
    if (setViewDirection && satellite.ra !== undefined && satellite.dec !== undefined) {
      setViewDirection(satellite.ra, satellite.dec);
      setOpen(false);
    } else {
      // If no coordinates, just close the dialog
      logger.warn('Satellite has no RA/Dec coordinates', { name: satellite.name });
      setOpen(false);
    }
  }, [setViewDirection, addTrackedSatellite, showSatellitesOnMap, setShowSatellitesOnMap]);
  
  // Refresh data
  const handleRefresh = useCallback(() => {
    setSatellites([]);
    // Trigger re-fetch
    setDataSources(prev => [...prev]);
  }, []);
  
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="standard-form">
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('satellites.tracker')} className="h-9 w-9">
              <Satellite className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('satellites.tracker')}</p>
        </TooltipContent>
      </Tooltip>
      
      <ResponsiveDialogContent
        className="sm:max-w-[550px]"
        desktopClassName="overflow-hidden flex flex-col"
      >
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Satellite className="h-5 w-5 text-primary" />
            {t('satellites.satelliteTracker')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        {/* Satellite Display Toggle */}
        <div className="flex items-center justify-between py-2 px-1 bg-muted/50 rounded-lg mb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="show-satellites" className="text-sm font-medium">
              {t('satellites.showOnMap')}
            </Label>
          </div>
          <Switch
            id="show-satellites"
            checked={showSatellitesOnMap}
            onCheckedChange={setShowSatellitesOnMap}
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'passes' | 'catalog')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="passes" className="text-sm">
              <Clock className="h-4 w-4 mr-1" />
              {t('satellites.upcomingPasses')}
            </TabsTrigger>
            <TabsTrigger value="catalog" className="text-sm">
              <Orbit className="h-4 w-4 mr-1" />
              {t('satellites.catalog')}
            </TabsTrigger>
          </TabsList>
          
          {/* Passes Tab */}
          <TabsContent value="passes" className="flex-1 min-h-0 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                {t('satellites.next24Hours')} ({upcomingPasses.length})
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-2">
                {upcomingPasses.length === 0 ? (
                  <EmptyState icon={Satellite} message={t('satellites.noPasses')} />
                ) : (
                  upcomingPasses.map((pass, index) => (
                    <PassCard 
                      key={`${pass.satellite.id}-${index}`}
                      pass={pass}
                      onTrack={() => handleTrack(pass.satellite)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          {/* Catalog Tab */}
          <TabsContent value="catalog" className="flex-1 min-h-0 mt-4">
            <div className="space-y-3 mb-3">
              {/* Search & Status */}
              <div className="flex items-center gap-2">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('satellites.searchPlaceholder')}
                  className="flex-1"
                />
                {isOnline ? (
                  <Badge variant="outline" className="text-green-500 border-green-500/50 shrink-0">
                    <Wifi className="h-3 w-3 mr-1" />
                    {t('satellites.online')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 shrink-0">
                    <WifiOff className="h-3 w-3 mr-1" />
                    {t('satellites.offline')}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Data Sources Settings */}
              <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                <CollapsibleContent>
                  <Card className="border-dashed">
                    <CardContent className="p-3 space-y-2">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {t('satellites.dataSources')}
                      </div>
                      {dataSources.map(source => (
                        <div key={source.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`source-${source.id}`} className="text-sm">
                              {source.name}
                            </Label>
                            <a 
                              href={source.apiUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                          <Switch
                            id={`source-${source.id}`}
                            checked={source.enabled}
                            onCheckedChange={() => toggleDataSource(source.id)}
                          />
                        </div>
                      ))}

                      <Separator className="my-1" />

                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        {t('satellites.groups')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableGroups.map((group) => {
                          const active = selectedGroups.includes(group);
                          return (
                            <Badge
                              key={group}
                              variant={active ? 'default' : 'outline'}
                              role="button"
                              tabIndex={0}
                              aria-pressed={active}
                              className="cursor-pointer select-none"
                              onClick={() => toggleGroup(group)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleGroup(group);
                                }
                              }}
                            >
                              {group}
                            </Badge>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
              
              {/* Filter */}
              <div className="flex items-center justify-between">
                <Label htmlFor="visible-only" className="text-sm">
                  {t('satellites.showVisibleOnly')}
                </Label>
                <Switch
                  id="visible-only"
                  checked={showOnlyVisible}
                  onCheckedChange={setShowOnlyVisible}
                />
              </div>
            </div>
            
            <Separator className="mb-3" />
            
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-2">
                {isLoading ? (
                  <EmptyState icon={Loader2} message={t('satellites.loading')} iconClassName="animate-spin" />
                ) : filteredSatellites.length === 0 ? (
                  <EmptyState icon={Satellite} message={t('satellites.noSatellites')} />
                ) : (
                  filteredSatellites.map(satellite => (
                    <SatelliteCard 
                      key={satellite.id}
                      satellite={satellite}
                      onTrack={() => handleTrack(satellite)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        {/* Location Info & Stats */}
        <div className="shrink-0 pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            <span>
              {profileInfo.AstrometrySettings.Latitude?.toFixed(2)}°, 
              {profileInfo.AstrometrySettings.Longitude?.toFixed(2)}°
            </span>
          </div>
          <span>{filteredSatellites.length} {t('satellites.satellitesFound')}</span>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}


