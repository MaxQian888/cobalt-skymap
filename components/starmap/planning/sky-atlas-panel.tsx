'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import {
  Telescope,
  Search,
  Filter,
  Moon,
  Sun,
  Sparkles,
  Target,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  ArrowUpDown,
  Loader2,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import { getScoreBadgeVariant, formatPlanningTime } from '@/lib/core/constants/planning-styles';
import type { DSOCardProps, FilterPanelProps } from '@/types/starmap/planning';
import { useMountStore, useStellariumStore } from '@/lib/stores';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { TranslatedName } from '../objects/translated-name';
import {
  useSkyAtlasStore,
  initializeSkyAtlas,
  type DeepSkyObject,
  type DSOType,
  MOON_PHASE_NAMES,
  DSO_TYPE_LABELS,
  CONSTELLATIONS,
  CONSTELLATION_NAMES,
} from '@/lib/catalogs';


// ============================================================================
// DSO Card Component
// ============================================================================


const DSOCard = memo(function DSOCard({ object, onSelect, onAddToList, onGoto, isSelected }: DSOCardProps) {
  const t = useTranslations();
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:bg-accent/50',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect(object)}
    >
      <CardContent className="p-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate"><TranslatedName name={object.name} /></span>
              {object.imagingScore !== undefined && (
                <Badge variant={getScoreBadgeVariant(object.imagingScore)} className="text-xs px-1.5">
                  {object.imagingScore}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="outline" className="text-xs">
                {DSO_TYPE_LABELS[object.type] || object.type}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {CONSTELLATION_NAMES[object.constellation] || object.constellation}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {onAddToList && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToList(object);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('skyAtlas.addToShotList')}</TooltipContent>
              </Tooltip>
            )}
            {onGoto && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onGoto(object);
                    }}
                  >
                    <Target className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('skyAtlas.goToObject')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        
        {/* Object Details */}
        <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
          <div>
            <span className="text-muted-foreground/70">{t('skyAtlas.magnitude')}:</span>{' '}
            {object.magnitude?.toFixed(1) ?? '--'}
          </div>
          <div>
            <span className="text-muted-foreground/70">{t('skyAtlas.size')}:</span>{' '}
            {object.sizeMax ? `${object.sizeMax.toFixed(1)}'` : '--'}
          </div>
          <div>
            <span className="text-muted-foreground/70">{t('skyAtlas.altitude')}:</span>{' '}
            <span className={object.altitude && object.altitude > 30 ? 'text-green-400' : ''}>
              {object.altitude?.toFixed(0) ?? '--'}°
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
          <div>
            <span className="text-muted-foreground/70">RA:</span>{' '}
            {degreesToHMS(object.ra)}
          </div>
          <div>
            <span className="text-muted-foreground/70">Dec:</span>{' '}
            {degreesToDMS(object.dec)}
          </div>
        </div>
        
        {object.moonDistance !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Moon className="h-3 w-3" />
            {t('skyAtlas.moonDistance')}: {object.moonDistance.toFixed(0)}°
          </div>
        )}
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Filter Panel Component
// ============================================================================


function FilterPanel({ isOpen, onToggle }: FilterPanelProps) {
  const t = useTranslations();
  const filters = useSkyAtlasStore((s) => s.filters);
  const setFilters = useSkyAtlasStore((s) => s.setFilters);
  const resetFilters = useSkyAtlasStore((s) => s.resetFilters);
  
  const [localObjectName, setLocalObjectName] = useState(filters.objectName);
  
  // Debounce object name filter
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localObjectName !== filters.objectName) {
        setFilters({ objectName: localObjectName });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localObjectName, filters.objectName, setFilters]);
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-2 py-1 h-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium text-sm">{t('skyAtlas.filters')}</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {/* Object Name Search */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('skyAtlas.searchByName')}</Label>
          <SearchInput
            value={localObjectName}
            onChange={setLocalObjectName}
            placeholder={t('skyAtlas.searchPlaceholder')}
            inputClassName="h-8 text-sm"
          />
        </div>
        
        {/* Object Types */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('skyAtlas.objectTypes')}</Label>
          <div className="flex flex-wrap gap-1">
            {filters.objectTypes.map((typeFilter) => (
              <Badge
                key={typeFilter.type}
                variant={typeFilter.selected ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => {
                  setFilters({
                    objectTypes: filters.objectTypes.map(tf =>
                      tf.type === typeFilter.type
                        ? { ...tf, selected: !tf.selected }
                        : tf
                    ),
                  });
                }}
              >
                {DSO_TYPE_LABELS[typeFilter.type as DSOType] || typeFilter.type}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* Constellation Filter */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('skyAtlas.constellation')}</Label>
          <Select
            value={filters.constellation || 'all'}
            onValueChange={(v) => setFilters({ constellation: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t('skyAtlas.allConstellations')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('skyAtlas.allConstellations')}</SelectItem>
              {CONSTELLATIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CONSTELLATION_NAMES[c] || c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Altitude Filter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs">{t('skyAtlas.minimumAltitude')}</Label>
            <span className="text-xs text-muted-foreground">{filters.minimumAltitude}°</span>
          </div>
          <Slider
            value={[filters.minimumAltitude]}
            onValueChange={([v]) => setFilters({ minimumAltitude: v })}
            min={0}
            max={80}
            step={10}
            className="w-full"
          />
        </div>
        
        {/* Moon Distance Filter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs">{t('skyAtlas.minimumMoonDistance')}</Label>
            <span className="text-xs text-muted-foreground">{filters.minimumMoonDistance}°</span>
          </div>
          <Slider
            value={[filters.minimumMoonDistance]}
            onValueChange={([v]) => setFilters({ minimumMoonDistance: v })}
            min={0}
            max={180}
            step={15}
            className="w-full"
          />
        </div>

        {/* Altitude Duration Filter (NINA-style) */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs">{t('skyAtlas.altitudeDuration')}</Label>
            <span className="text-xs text-muted-foreground">{filters.altitudeDuration || 1}h</span>
          </div>
          <Slider
            value={[filters.altitudeDuration || 1]}
            onValueChange={([v]) => setFilters({ altitudeDuration: v })}
            min={1}
            max={8}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">{t('skyAtlas.altitudeDurationDesc')}</p>
        </div>

        {/* Transit Time Filter (NINA-style) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('skyAtlas.transitTimeFrom')}</Label>
            <Select
              value={filters.transitTimeFrom ? filters.transitTimeFrom.getHours().toString() : 'any'}
              onValueChange={(v) => {
                if (v === 'any') {
                  setFilters({ transitTimeFrom: null });
                } else {
                  const date = new Date(filters.filterDate);
                  date.setHours(Number(v), 0, 0, 0);
                  setFilters({ transitTimeFrom: date });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('skyAtlas.any')}</SelectItem>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <SelectItem key={h} value={h.toString()}>
                    {h.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('skyAtlas.transitTimeTo')}</Label>
            <Select
              value={filters.transitTimeThrough ? filters.transitTimeThrough.getHours().toString() : 'any'}
              onValueChange={(v) => {
                if (v === 'any') {
                  setFilters({ transitTimeThrough: null });
                } else {
                  const date = new Date(filters.filterDate);
                  date.setHours(Number(v), 0, 0, 0);
                  setFilters({ transitTimeThrough: date });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('skyAtlas.any')}</SelectItem>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <SelectItem key={h} value={h.toString()}>
                    {h.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Magnitude Range */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('skyAtlas.magnitudeFrom')}</Label>
            <Select
              value={filters.magnitudeRange.from?.toString() || 'any'}
              onValueChange={(v) => setFilters({
                magnitudeRange: { ...filters.magnitudeRange, from: v === 'any' ? null : Number(v) },
              })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('skyAtlas.any')}</SelectItem>
                {Array.from({ length: 15 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('skyAtlas.magnitudeTo')}</Label>
            <Select
              value={filters.magnitudeRange.through?.toString() || 'any'}
              onValueChange={(v) => setFilters({
                magnitudeRange: { ...filters.magnitudeRange, through: v === 'any' ? null : Number(v) },
              })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('skyAtlas.any')}</SelectItem>
                {Array.from({ length: 15 }, (_, i) => i + 6).map((m) => (
                  <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Reset Filters */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={resetFilters}
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          {t('skyAtlas.resetFilters')}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Nighttime Info Component
// ============================================================================

function NighttimeInfo() {
  const t = useTranslations();
  const nighttimeData = useSkyAtlasStore((s) => s.nighttimeData);
  
  if (!nighttimeData) return null;
  
  return (
    <div className="space-y-2 p-2 bg-muted/30 rounded-lg">
      <div className="text-xs font-medium flex items-center gap-1">
        <Moon className="h-3 w-3" />
        {t('skyAtlas.moonInfo')}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          {t('skyAtlas.phase')}: {MOON_PHASE_NAMES[nighttimeData.moonPhase]}
        </div>
        <div>
          {t('skyAtlas.illumination')}: {nighttimeData.moonIllumination.toFixed(0)}%
        </div>
      </div>
      
      <Separator className="my-2" />
      
      <div className="text-xs font-medium flex items-center gap-1">
        <Sun className="h-3 w-3" />
        {t('skyAtlas.twilightInfo')}
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        <div>{t('skyAtlas.sunset')}: {formatPlanningTime(nighttimeData.sunRiseAndSet.set)}</div>
        <div>{t('skyAtlas.sunrise')}: {formatPlanningTime(nighttimeData.sunRiseAndSet.rise)}</div>
        <div>{t('skyAtlas.astronomicalDusk')}: {formatPlanningTime(nighttimeData.twilightRiseAndSet.set)}</div>
        <div>{t('skyAtlas.astronomicalDawn')}: {formatPlanningTime(nighttimeData.twilightRiseAndSet.rise)}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Sky Atlas Panel Component
// ============================================================================

export function SkyAtlasPanel() {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  
  // Get location from mount store
  const profileInfo = useMountStore((state) => state.profileInfo);
  const latitude = profileInfo.AstrometrySettings.Latitude || 0;
  const longitude = profileInfo.AstrometrySettings.Longitude || 0;
  
  // Sky Atlas store — per-field selectors. The ~260-object `catalog` is NEVER
  // selected into render (it would re-render the whole panel whenever it loads);
  // its length is read transiently via getState() inside the init effect.
  const searchResult = useSkyAtlasStore((s) => s.searchResult);
  const isSearching = useSkyAtlasStore((s) => s.isSearching);
  const selectedObject = useSkyAtlasStore((s) => s.selectedObject);
  const tonightsBest = useSkyAtlasStore((s) => s.tonightsBest);
  const setLocation = useSkyAtlasStore((s) => s.setLocation);
  const search = useSkyAtlasStore((s) => s.search);
  const selectObject = useSkyAtlasStore((s) => s.selectObject);
  const filters = useSkyAtlasStore((s) => s.filters);
  const setFilters = useSkyAtlasStore((s) => s.setFilters);
  
  // Target list store for adding objects
  const addTarget = useTargetListStore((state) => state.addTarget);
  
  // Initialize when opened
  useEffect(() => {
    if (isOpen && useSkyAtlasStore.getState().catalog.length === 0) {
      initializeSkyAtlas(latitude, longitude);
    }
  }, [isOpen, latitude, longitude]);
  
  // Update location when it changes
  useEffect(() => {
    if (latitude !== 0 || longitude !== 0) {
      setLocation(latitude, longitude);
    }
  }, [latitude, longitude, setLocation]);
  
  // Handle search
  const handleSearch = useCallback(() => {
    search();
  }, [search]);
  
  // Handle add to shot list
  const handleAddToList = useCallback((object: DeepSkyObject) => {
    addTarget({
      name: object.name,
      ra: object.ra,
      dec: object.dec,
      raString: degreesToHMS(object.ra),
      decString: degreesToDMS(object.dec),
      priority: 'medium',
      notes: `${DSO_TYPE_LABELS[object.type] || object.type} in ${CONSTELLATION_NAMES[object.constellation] || object.constellation}${object.magnitude ? ` | Mag: ${object.magnitude.toFixed(1)}` : ''}`,
    });
  }, [addTarget]);
  
  // Handle go to object — navigate the active sky engine to the object's coordinates
  const handleGoto = useCallback((object: DeepSkyObject) => {
    selectObject(object);
    const { setViewDirection } = useStellariumStore.getState();
    if (setViewDirection) {
      setViewDirection(object.ra, object.dec);
    }
  }, [selectObject]);
  
  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Telescope className="h-4 w-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        data-starmap-ui-control="true"
        className="w-[85vw] max-w-[360px] sm:max-w-[420px] md:max-w-[480px] h-full overflow-hidden p-0 flex flex-col"
      >
        <DrawerHeader className="p-4 pb-2 border-b">
          <DrawerTitle className="flex items-center gap-2">
            <Telescope className="h-5 w-5" />
            {t('skyAtlas.title')}
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea
          data-testid="sky-atlas-panel-scroll-area"
          data-starmap-ui-control="true"
          data-starmap-scroll-surface="true"
          className="flex-1 min-h-0 overscroll-contain"
        >
          <div className="flex flex-col">
            {/* Location Info */}
            {(latitude !== 0 || longitude !== 0) && (
              <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-1 border-b">
                <MapPin className="h-3 w-3" />
                {latitude.toFixed(2)}°, {longitude.toFixed(2)}°
              </div>
            )}
            
            {/* Nighttime Info */}
            <div className="px-4 py-2 border-b">
              <NighttimeInfo />
            </div>
            
            {/* Filters */}
            <div className="px-4 py-2 border-b">
              <FilterPanel isOpen={showFilters} onToggle={() => setShowFilters(!showFilters)} />
            </div>
            
            {/* Sort & Search Controls */}
            <div className="px-4 py-2 border-b flex gap-2">
              <Select
                value={filters.orderByField}
                onValueChange={(v) => setFilters({ orderByField: v as typeof filters.orderByField })}
              >
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <ArrowUpDown className="h-3 w-3 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imagingScore">{t('skyAtlas.sortByScore')}</SelectItem>
                  <SelectItem value="name">{t('skyAtlas.sortByName')}</SelectItem>
                  <SelectItem value="magnitude">{t('skyAtlas.sortByMagnitude')}</SelectItem>
                  <SelectItem value="size">{t('skyAtlas.sortBySize')}</SelectItem>
                  <SelectItem value="altitude">{t('skyAtlas.sortByAltitude')}</SelectItem>
                  <SelectItem value="transitTime">{t('skyAtlas.sortByTransit')}</SelectItem>
                  <SelectItem value="moonDistance">{t('skyAtlas.sortByMoonDistance')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {t('skyAtlas.search')}
              </Button>
            </div>
            
            {/* Tonight's Best */}
            {tonightsBest.length > 0 && !searchResult && (
              <div className="px-4 py-2 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">{t('skyAtlas.tonightsBest')}</span>
                </div>
                <div className="space-y-2 pb-2">
                  {tonightsBest.slice(0, 5).map((obj) => (
                    <DSOCard
                      key={obj.id}
                      object={obj}
                      onSelect={selectObject}
                      onAddToList={handleAddToList}
                      onGoto={handleGoto}
                      isSelected={selectedObject?.id === obj.id}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Search Results */}
            {searchResult && (
              <div className="flex flex-col">
                <div className="px-4 py-2 text-xs text-muted-foreground border-b">
                  {t('skyAtlas.resultsCount', { count: searchResult.totalCount })}
                  {searchResult.totalPages > 1 && (
                    <span className="ml-2">
                      ({t('skyAtlas.pageInfo', { 
                        current: searchResult.currentPage, 
                        total: searchResult.totalPages 
                      })})
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {searchResult.objects.map((obj) => (
                    <DSOCard
                      key={obj.id}
                      object={obj}
                      onSelect={selectObject}
                      onAddToList={handleAddToList}
                      onGoto={handleGoto}
                      isSelected={selectedObject?.id === obj.id}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Empty State */}
            {!searchResult && tonightsBest.length === 0 && !isSearching && (
              <div className="flex min-h-[240px] items-center justify-center p-8 text-center text-muted-foreground">
                <div>
                  <Telescope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">{t('skyAtlas.emptyState')}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={handleSearch}
                  >
                    {t('skyAtlas.startSearch')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}


