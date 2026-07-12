'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Moon,
  Clock,
  Mountain,
  Target,
  RefreshCw,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Sunrise,
  Sunset,
  CalendarDays,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getScoreBadgeVariant, formatPlanningTime } from '@/lib/core/constants/planning-styles';
import type { NightTimelineProps, MoonPhaseDisplayProps } from '@/types/starmap/planning';
import { useTonightRecommendations, useGeolocation, type RecommendedTarget } from '@/lib/hooks';
import { useStellariumStore, usePlanningUiStore } from '@/lib/stores';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { useMountStore } from '@/lib/stores';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { TranslatedName } from '../objects/translated-name';
import { useAstronomy } from '@/lib/tauri/hooks';
import { MoonPhaseSVG } from './moon-phase-svg';


// ============================================================================
// Night Timeline Component - Beautiful day/night visualization
// ============================================================================


function NightTimeline({ twilight, currentTime }: NightTimelineProps) {
  const t = useTranslations();
  
  // Dynamically calculate timeline based on actual sunset/sunrise
  // Use sunset - 1 hour as start, sunrise + 1 hour as end
  const timelineStart = useMemo(() => {
    if (twilight.sunset) {
      const start = new Date(twilight.sunset);
      start.setHours(start.getHours() - 1);
      return start;
    }
    // Fallback: 6 PM today
    const fallback = new Date(currentTime);
    fallback.setHours(18, 0, 0, 0);
    return fallback;
  }, [twilight.sunset, currentTime]);
  
  const timelineEnd = useMemo(() => {
    if (twilight.sunrise) {
      const end = new Date(twilight.sunrise);
      end.setHours(end.getHours() + 1);
      return end;
    }
    // Fallback: 6 AM next day
    const fallback = new Date(currentTime);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(6, 0, 0, 0);
    return fallback;
  }, [twilight.sunrise, currentTime]);
  
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  
  // Calculate positions as percentages
  const getPosition = (date: Date | null): number => {
    if (!date) return 0;
    const ms = date.getTime() - timelineStart.getTime();
    return Math.max(0, Math.min(100, (ms / totalMs) * 100));
  };
  
  const sunsetPos = getPosition(twilight.sunset);
  const civilDuskPos = getPosition(twilight.civilDusk);
  const nauticalDuskPos = getPosition(twilight.nauticalDusk);
  const astroDuskPos = getPosition(twilight.astronomicalDusk);
  const astroDawnPos = getPosition(twilight.astronomicalDawn);
  const nauticalDawnPos = getPosition(twilight.nauticalDawn);
  const civilDawnPos = getPosition(twilight.civilDawn);
  const sunrisePos = getPosition(twilight.sunrise);
  const currentPos = getPosition(currentTime);
  
  // Generate dynamic time labels based on timeline span
  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    const spanHours = totalMs / (1000 * 60 * 60);
    const interval = spanHours > 10 ? 2 : 1; // 2 hour intervals for long nights
    
    const labelTime = new Date(timelineStart);
    while (labelTime <= timelineEnd) {
      labels.push(labelTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      labelTime.setHours(labelTime.getHours() + interval);
    }
    return labels.slice(0, 7); // Max 7 labels for display
  }, [timelineStart, timelineEnd, totalMs]);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sunset className="h-3 w-3" />
          {t('tonight.evening')}
        </span>
        <span className="flex items-center gap-1">
          {t('tonight.morning')}
          <Sunrise className="h-3 w-3" />
        </span>
      </div>
      
      {/* Main timeline bar */}
      <div className="relative h-8 rounded-lg overflow-hidden">
        {/* Background gradient - day to night to day */}
        <div className="absolute inset-0 flex">
          {/* Evening twilight gradient */}
          <div 
            className="h-full"
            style={{ 
              width: `${sunsetPos}%`,
              background: 'linear-gradient(to right, #f97316, #ea580c)',
            }}
          />
          {/* Civil twilight - orange to deep orange */}
          <div 
            className="h-full"
            style={{ 
              width: `${civilDuskPos - sunsetPos}%`,
              background: 'linear-gradient(to right, #ea580c, #c2410c)',
            }}
          />
          {/* Nautical twilight - deep orange to purple */}
          <div 
            className="h-full"
            style={{ 
              width: `${nauticalDuskPos - civilDuskPos}%`,
              background: 'linear-gradient(to right, #c2410c, #7c3aed)',
            }}
          />
          {/* Astronomical twilight - purple to dark blue */}
          <div 
            className="h-full"
            style={{ 
              width: `${astroDuskPos - nauticalDuskPos}%`,
              background: 'linear-gradient(to right, #7c3aed, #1e1b4b)',
            }}
          />
          {/* Full night - dark blue */}
          <div 
            className="h-full"
            style={{ 
              width: `${astroDawnPos - astroDuskPos}%`,
              background: '#0f0a1e',
            }}
          />
          {/* Morning astronomical twilight */}
          <div 
            className="h-full"
            style={{ 
              width: `${nauticalDawnPos - astroDawnPos}%`,
              background: 'linear-gradient(to right, #1e1b4b, #7c3aed)',
            }}
          />
          {/* Morning nautical twilight */}
          <div 
            className="h-full"
            style={{ 
              width: `${civilDawnPos - nauticalDawnPos}%`,
              background: 'linear-gradient(to right, #7c3aed, #c2410c)',
            }}
          />
          {/* Morning civil twilight */}
          <div 
            className="h-full"
            style={{ 
              width: `${sunrisePos - civilDawnPos}%`,
              background: 'linear-gradient(to right, #c2410c, #ea580c)',
            }}
          />
          {/* After sunrise */}
          <div 
            className="h-full flex-1"
            style={{ 
              background: 'linear-gradient(to right, #ea580c, #f97316)',
            }}
          />
        </div>
        
        {/* Stars overlay for night section */}
        <div 
          className="absolute top-0 h-full pointer-events-none"
          style={{ 
            left: `${astroDuskPos}%`,
            width: `${astroDawnPos - astroDuskPos}%`,
          }}
        >
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-60"
              style={{
                left: `${(i * 8 + 4) % 100}%`,
                top: `${(i * 17 + 10) % 80 + 10}%`,
              }}
            />
          ))}
        </div>
        
        {/* Current time indicator */}
        {currentPos > 0 && currentPos < 100 && (
          <div 
            className="absolute top-0 h-full w-0.5 bg-white shadow-lg z-10"
            style={{ left: `${currentPos}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow" />
          </div>
        )}
        
        {/* Twilight markers */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute top-0 h-full w-px bg-orange-400/50 cursor-help"
              style={{ left: `${sunsetPos}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.sunset')}: {formatPlanningTime(twilight.sunset)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute top-0 h-full w-px bg-purple-400/50 cursor-help"
              style={{ left: `${astroDuskPos}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.astronomicalDusk')}: {formatPlanningTime(twilight.astronomicalDusk)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute top-0 h-full w-px bg-purple-400/50 cursor-help"
              style={{ left: `${astroDawnPos}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.astronomicalDawn')}: {formatPlanningTime(twilight.astronomicalDawn)}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute top-0 h-full w-px bg-orange-400/50 cursor-help"
              style={{ left: `${sunrisePos}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.sunrise')}: {formatPlanningTime(twilight.sunrise)}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        {timeLabels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-linear-to-r from-orange-500 to-orange-700" />
          <span>{t('tonight.twilight')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-[#0f0a1e]" />
          <span>{t('tonight.darkSky')}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white border border-muted" />
          <span>{t('tonight.now')}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Moon Phase Visualization
// ============================================================================


function MoonPhaseDisplay({ phase, illumination, phaseName }: MoonPhaseDisplayProps) {
  const t = useTranslations();
  
  return (
    <div className="flex items-center gap-3">
      <MoonPhaseSVG phase={phase} size={40} />
      
      {/* Moon info */}
      <div className="flex-1">
        <div className="text-sm font-medium">{phaseName}</div>
        <div className="text-xs text-muted-foreground">
          {illumination}% {t('tonight.illuminated')}
        </div>
      </div>
    </div>
  );
}

// Target card component
function TargetCard({
  target,
  onSelect,
  onAddToList,
}: {
  target: RecommendedTarget;
  onSelect: () => void;
  onAddToList: () => void;
}) {
  const t = useTranslations();
  
  return (
    <Card className="border-border hover:bg-accent/50 transition-colors">
      <CardContent className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Button
              variant="link"
              className="h-auto p-0 text-sm font-medium hover:text-primary transition-colors truncate"
              onClick={onSelect}
            >
              <TranslatedName name={target.Name} />
            </Button>
            <Badge variant={getScoreBadgeVariant(target.score)} className="shrink-0">
              {target.score}
            </Badge>
            <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
              {target.scoreProfile}
            </Badge>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {target.scoreConfidence}
            </Badge>
          </div>
          {target['Common names'] && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              <TranslatedName name={target['Common names']} />
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onAddToList}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('actions.addToTargetList')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onSelect}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('tonight.goToTarget')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Stats row */}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1">
            <Mountain className="h-3 w-3" />
            <span>{target.maxAltitude.toFixed(0)}°</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.maxAltitude')}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{target.imagingHours.toFixed(1)}h</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.imagingTime')}</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1">
            <Moon className="h-3 w-3" />
            <span>{target.moonDistance.toFixed(0)}°</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('tonight.moonDistance')}</p>
          </TooltipContent>
        </Tooltip>
        
        {target.transitTime && (
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{formatPlanningTime(target.transitTime)}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('tonight.transitTime')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      
      {/* Reasons and warnings */}
      {(target.reasons.length > 0 || target.warnings.length > 0) && (
        <div className="mt-2 space-y-1">
          {target.reasons.slice(0, 2).map((reason, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/8 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{t(reason.key, reason.params)}</span>
            </div>
          ))}
          {target.warnings.slice(0, 1).map((warning, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="truncate">{t(warning.key, warning.params)}</span>
            </div>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  );
}

export function TonightRecommendations() {
  const t = useTranslations();
  const open = usePlanningUiStore((state) => state.tonightRecommendationsOpen);
  const setOpen = usePlanningUiStore((state) => state.setTonightRecommendationsOpen);
  const [sortBy, setSortBy] = useState<'score' | 'altitude' | 'time'>('score');
  const [filterType, setFilterType] = useState<'all' | 'galaxy' | 'nebula' | 'cluster'>('all');
  const observationProfile = useSettingsStore((state) => state.observationProfile);
  const setObservationProfile = useSettingsStore((state) => state.setObservationProfile);
  
  const { recommendations, conditions, isLoading, refresh, planDate, setPlanDate } = useTonightRecommendations(observationProfile);
  const setViewDirection = useStellariumStore((state) => state.setViewDirection);
  const addTarget = useTargetListStore((state) => state.addTarget);
  const setScoreProfile = useTargetListStore((state) => state.setScoreProfile);
  const setProfileInfo = useMountStore((state) => state.setProfileInfo);
  
  // Geolocation hook
  const geolocation = useGeolocation({ autoRequest: false });
  
  // Tauri astronomy hook for enhanced data in desktop mode
  const astronomy = useAstronomy(conditions?.latitude, conditions?.longitude);
  
  // Use Tauri moon data if available, otherwise fallback to conditions
  const moonPhaseData = useMemo(() => {
    if (astronomy.isAvailable && astronomy.moonPhase) {
      return {
        phase: astronomy.moonPhase.phase,
        illumination: astronomy.moonPhase.illumination * 100,
        phaseName: astronomy.moonPhase.phase_name,
      };
    }
    if (conditions) {
      return {
        phase: conditions.moonPhase,
        illumination: conditions.moonIllumination,
        phaseName: conditions.moonPhaseName,
      };
    }
    return null;
  }, [astronomy.isAvailable, astronomy.moonPhase, conditions]);
  
  // Handle location request and update mount store
  const handleRequestLocation = useCallback(async () => {
    await geolocation.requestLocation();
  }, [geolocation]);
  
  // Update profile when geolocation changes
  useEffect(() => {
    if (geolocation.latitude !== null && geolocation.longitude !== null) {
      setProfileInfo({
        AstrometrySettings: {
          Latitude: geolocation.latitude,
          Longitude: geolocation.longitude,
          Elevation: geolocation.altitude ?? 0,
        },
      });
      // Refresh recommendations with new location
      refresh();
    }
  }, [geolocation.latitude, geolocation.longitude, geolocation.altitude, setProfileInfo, refresh]);

  useEffect(() => {
    setScoreProfile(observationProfile);
  }, [observationProfile, setScoreProfile]);
  
  // Sort and filter recommendations
  const filteredRecommendations = useMemo(() => {
    let filtered = [...recommendations];
    
    // Filter by type (based on common names or target name patterns)
    if (filterType !== 'all') {
      filtered = filtered.filter(target => {
        const name = (target['Common names'] || '').toLowerCase();
        switch (filterType) {
          case 'galaxy':
            return name.includes('galaxy') || name.includes('galax');
          case 'nebula':
            return name.includes('nebula') || name.includes('planetary');
          case 'cluster':
            return name.includes('cluster') || name.includes('pleiades');
          default:
            return true;
        }
      });
    }
    
    // Sort
    switch (sortBy) {
      case 'altitude':
        filtered.sort((a, b) => b.maxAltitude - a.maxAltitude);
        break;
      case 'time':
        filtered.sort((a, b) => b.imagingHours - a.imagingHours);
        break;
      default:
        filtered.sort((a, b) => b.score - a.score);
    }
    
    return filtered;
  }, [recommendations, sortBy, filterType]);
  
  const handleSelectTarget = useCallback((target: RecommendedTarget) => {
    if (setViewDirection && target.RA !== undefined && target.Dec !== undefined) {
      setViewDirection(target.RA, target.Dec);
    }
  }, [setViewDirection]);
  
  const handleAddToList = useCallback((target: RecommendedTarget) => {
    if (target.RA !== undefined && target.Dec !== undefined) {
      addTarget({
        name: target.Name,
        ra: target.RA,
        dec: target.Dec,
        raString: degreesToHMS(target.RA),
        decString: degreesToDMS(target.Dec),
        priority: 'medium',
      });
    }
  }, [addTarget]);
  
  const handleAddAllToList = useCallback(() => {
    filteredRecommendations.slice(0, 10).forEach(target => {
      if (target.RA !== undefined && target.Dec !== undefined) {
        addTarget({
          name: target.Name,
          ra: target.RA,
          dec: target.Dec,
          raString: degreesToHMS(target.RA),
          decString: degreesToDMS(target.Dec),
          priority: 'medium',
        });
      }
    });
  }, [filteredRecommendations, addTarget]);
  
  return (
    <ResponsiveDialog tier="standard-form" open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('tonight.recommendations')}</p>
        </TooltipContent>
      </Tooltip>
      
      <ResponsiveDialogContent className="sm:max-w-[560px]" desktopClassName="overflow-hidden flex flex-col">
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('tonight.title')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        {/* Tonight's conditions with beautiful visualization */}
        {conditions && (
          <div className="theme-surface-strong relative shrink-0 overflow-hidden rounded-xl border p-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/12 via-transparent to-secondary/14 opacity-80"
            />
            <div className="relative z-10 space-y-4">
            {/* Header with date picker and refresh */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{t('tonight.conditions')}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1.5 border-border/70 bg-background/45 text-xs font-normal text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    >
                      <CalendarDays className="h-3 w-3" />
                      {planDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={planDate}
                      onSelect={(d) => {
                        if (d) {
                          setPlanDate(d);
                          setTimeout(refresh, 0);
                        }
                      }}
                      defaultMonth={planDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                onClick={refresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </Button>
            </div>
            
            {/* Night Timeline */}
            <NightTimeline twilight={conditions.twilight} currentTime={conditions.currentTime} />
            
            {/* Moon and Location Info */}
            <div className="grid grid-cols-2 gap-4">
              {/* Moon Phase - uses Tauri data when available */}
              {moonPhaseData && (
                <MoonPhaseDisplay 
                  phase={moonPhaseData.phase}
                  illumination={moonPhaseData.illumination}
                  phaseName={moonPhaseData.phaseName}
                />
              )}
              
              {/* Quick Stats */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{conditions.totalDarkHours.toFixed(1)}h {t('tonight.darkHours')}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      onClick={handleRequestLocation}
                      disabled={geolocation.loading}
                    >
                      <MapPin className={cn('h-3.5 w-3.5', geolocation.loading && 'animate-pulse')} />
                      <span>{conditions.latitude.toFixed(2)}°, {conditions.longitude.toFixed(2)}°</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t('tonight.clickToUpdateLocation')}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
          </div>
        )}
        
        {/* Filter and Sort Controls */}
        <div className="shrink-0 flex items-center gap-2 flex-wrap overflow-x-auto">
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">{t('tonight.profile')}:</span>
            <ToggleGroup
              type="single"
              value={observationProfile}
              onValueChange={(v) => v && setObservationProfile(v as typeof observationProfile)}
              variant="outline"
              size="sm"
            >
              {(['imaging', 'visual', 'hybrid'] as const).map((mode) => (
                <ToggleGroupItem key={mode} value={mode} className="h-6 px-2 text-xs capitalize">
                  {t(`tonight.profileType.${mode}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Filter buttons */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground mr-1">{t('tonight.filter')}:</span>
            <ToggleGroup type="single" value={filterType} onValueChange={(v) => v && setFilterType(v as typeof filterType)} variant="outline" size="sm">
              {(['all', 'galaxy', 'nebula', 'cluster'] as const).map((type) => (
                <ToggleGroupItem key={type} value={type} className="h-6 px-2 text-xs">
                  {t(`tonight.filterType.${type}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          
          {/* Sort buttons */}
          <div className="flex items-center gap-1 text-xs ml-auto">
            <span className="text-muted-foreground mr-1">{t('tonight.sort')}:</span>
            <ToggleGroup type="single" value={sortBy} onValueChange={(v) => v && setSortBy(v as typeof sortBy)} variant="outline" size="sm">
              {(['score', 'altitude', 'time'] as const).map((sort) => (
                <ToggleGroupItem key={sort} value={sort} className="h-6 px-2 text-xs">
                  {t(`tonight.sortType.${sort}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
        
        {/* Recommendations list */}
        <div className="flex-1 min-h-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {t('tonight.topTargets')} ({filteredRecommendations.length})
            </span>
            {filteredRecommendations.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={handleAddAllToList}
              >
                <Plus className="h-3 w-3" />
                {t('tonight.addTop10')}
              </Button>
            )}
          </div>
          
          {isLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredRecommendations.length === 0 ? (
            <EmptyState icon={Sparkles} message={t('tonight.noRecommendations')} />
          ) : (
            <ScrollArea className="h-[38vh] h-[38dvh] min-h-[200px]">
              <div className="space-y-2 pr-2">
                {filteredRecommendations.map((target, index) => (
                  <TargetCard
                    key={`${target.Name}-${index}`}
                    target={target}
                    onSelect={() => handleSelectTarget(target)}
                    onAddToList={() => handleAddToList(target)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        
        {/* Score legend */}
        <div className="shrink-0 flex items-center justify-center gap-3 border-t pt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2 py-1 text-emerald-700 dark:text-emerald-300">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>80+ {t('tonight.excellent')}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-amber-700 dark:text-amber-300">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>60+ {t('tonight.good')}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/8 px-2 py-1 text-orange-700 dark:text-orange-300">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            <span>40+ {t('tonight.fair')}</span>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}


