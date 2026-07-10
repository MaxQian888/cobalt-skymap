'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Moon, Star, Plus, ChevronUp, ChevronDown, Telescope, Download } from 'lucide-react';
import {
  calculateTwilightTimes,
  calculateTargetVisibility,
  calculateImagingFeasibility,
  getMoonPhase,
  getMoonPhaseName,
  getMoonIllumination,
  formatTimeShort,
} from '@/lib/astronomy/astro-utils';
import { TranslatedName } from '../../objects/translated-name';
import {
  useSkyAtlasStore,
  initializeSkyAtlas,
  DSO_TYPE_LABELS,
  CONSTELLATION_NAMES,
} from '@/lib/catalogs';
import {
  AstroCalculatorResultActionsBar,
  ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME,
  ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME,
} from './result-action-layout';
import { useAstroCalculatorResultActions } from './result-actions';
import type { AstroCalculatorObserverContext, WUTObject } from './types';

interface WUTTabProps {
  latitude: number;
  longitude: number;
  observerContext?: AstroCalculatorObserverContext;
  onSelectObject: (ra: number, dec: number) => void;
  onAddToList: (name: string, ra: number, dec: number) => void;
}

function isHourInWindow(hour: number, startHour: number, endHour: number): boolean {
  if (startHour <= endHour) {
    return hour >= startHour && hour <= endHour;
  }
  return hour >= startHour || hour <= endHour;
}

export function WUTTab({ latitude, longitude, observerContext, onSelectObject, onAddToList }: WUTTabProps) {
  const t = useTranslations();
  const { copyResults, exportResults } = useAstroCalculatorResultActions(observerContext);
  const [objectType, setObjectType] = useState<'all' | 'galaxy' | 'nebula' | 'cluster' | 'planetary'>('all');
  const [magnitudeRange, setMagnitudeRange] = useState<[number, number]>([0, 12]);
  const [minAltitude, setMinAltitude] = useState(30);
  const [timeWindow, setTimeWindow] = useState<'evening' | 'midnight' | 'morning' | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'altitude' | 'transit' | 'magnitude' | 'size'>('score');
  const [minSize, setMinSize] = useState(0); // arcminutes
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const { catalog: dsoCatalog } = useSkyAtlasStore();

  // WUT is the calculator's default tab, so it must bootstrap the DSO catalog
  // itself — otherwise it shows "no objects" until the Positions tab is visited.
  useEffect(() => {
    if (dsoCatalog.length === 0) {
      initializeSkyAtlas(latitude, longitude);
    }
  }, [dsoCatalog.length, latitude, longitude]);

  const twilight = useMemo(() => calculateTwilightTimes(latitude, longitude), [latitude, longitude]);
  
  // Get WUT objects
  const wutObjects = useMemo(() => {
    let objects = dsoCatalog;
    
    // Filter by type
    if (objectType !== 'all') {
      objects = objects.filter(obj => {
        const typeStr = obj.type as string;
        switch (objectType) {
          case 'galaxy':
            return typeStr === 'Galaxy';
          case 'nebula':
            return ['Nebula', 'EmissionNebula', 'ReflectionNebula', 'DarkNebula', 'SupernovaRemnant'].includes(typeStr);
          case 'cluster':
            return ['OpenCluster', 'GlobularCluster', 'StarCluster'].includes(typeStr);
          case 'planetary':
            return typeStr === 'PlanetaryNebula';
          default:
            return true;
        }
      });
    }
    
    // Filter by magnitude
    objects = objects.filter(obj => {
      const mag = obj.magnitude ?? 15;
      return mag >= magnitudeRange[0] && mag <= magnitudeRange[1];
    });
    
    // Filter by size
    if (minSize > 0) {
      objects = objects.filter(obj => (obj.sizeMax ?? 0) >= minSize);
    }
    
    
    // Calculate visibility and scores
    const wutResults: WUTObject[] = objects.map(obj => {
      const visibility = calculateTargetVisibility(obj.ra, obj.dec, latitude, longitude, minAltitude);
      const feasibility = calculateImagingFeasibility(obj.ra, obj.dec, latitude, longitude);
      
      return {
        name: obj.name,
        type: DSO_TYPE_LABELS[obj.type] || obj.type,
        ra: obj.ra,
        dec: obj.dec,
        magnitude: obj.magnitude,
        riseTime: visibility.riseTime,
        transitTime: visibility.transitTime,
        setTime: visibility.setTime,
        maxElevation: visibility.transitAltitude,
        angularSize: obj.sizeMax,
        constellation: CONSTELLATION_NAMES[obj.constellation] || obj.constellation,
        score: feasibility.score,
      };
    });
    
    // Filter by visibility tonight
    const filtered = wutResults.filter(obj => {
      // Must have positive imaging time
      if (obj.maxElevation < minAltitude) return false;
      
      // Filter by time window
      if (timeWindow !== 'all' && obj.transitTime && twilight.astronomicalDusk && twilight.astronomicalDawn) {
        const transitHour = obj.transitTime.getHours();
        const duskHour = twilight.astronomicalDusk.getHours();
        const dawnHour = twilight.astronomicalDawn.getHours();
        
        switch (timeWindow) {
          case 'evening':
            return isHourInWindow(transitHour, duskHour, 23);
          case 'midnight':
            return isHourInWindow(transitHour, 22, 2);
          case 'morning':
            return isHourInWindow(transitHour, 2, dawnHour);
        }
      }
      
      return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'altitude':
          return b.maxElevation - a.maxElevation;
        case 'transit':
          return (a.transitTime?.getTime() ?? 0) - (b.transitTime?.getTime() ?? 0);
        case 'magnitude':
          return (a.magnitude ?? 99) - (b.magnitude ?? 99);
        default:
          return b.score - a.score;
      }
    });
    
    return filtered.slice(0, 100);
  }, [dsoCatalog, objectType, magnitudeRange, minAltitude, minSize, timeWindow, sortBy, latitude, longitude, twilight]);

  const exportLines = useMemo(() => {
    return [
      `Object type: ${objectType}`,
      `Magnitude: ${magnitudeRange[0]}-${magnitudeRange[1]}`,
      `Min altitude: ${minAltitude}`,
      `Time window: ${timeWindow}`,
      `Sort by: ${sortBy}`,
      '',
      ...wutObjects.map((obj) => [
        obj.name,
        `Type=${obj.type}`,
        `Mag=${obj.magnitude !== undefined ? obj.magnitude.toFixed(1) : '--'}`,
        `Rise=${formatTimeShort(obj.riseTime)}`,
        `Transit=${formatTimeShort(obj.transitTime)}`,
        `Set=${formatTimeShort(obj.setTime)}`,
        `MaxEl=${obj.maxElevation.toFixed(0)}`,
        `Score=${obj.score}`,
      ].join(' | ')),
    ];
  }, [magnitudeRange, minAltitude, objectType, sortBy, timeWindow, wutObjects]);

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      {/* Night Info */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <Moon className="h-4 w-4 text-amber-400" />
            <span>{getMoonPhaseName(getMoonPhase())}</span>
            <span className="text-muted-foreground">({getMoonIllumination(getMoonPhase())}%)</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-indigo-400" />
            <span>{t('astroCalc.darkHours')}: {twilight.darknessDuration.toFixed(1)}h</span>
          </div>
        </div>
        <Badge variant={twilight.isCurrentlyNight ? 'default' : 'secondary'}>
          {twilight.isCurrentlyNight ? t('astroCalc.night') : t('astroCalc.daylight')}
        </Badge>
      </div>
      
      {/* Filters Row 1: Dropdowns (two-up on phones so the results area keeps room) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.objectType')}</Label>
          <Select value={objectType} onValueChange={(v) => setObjectType(v as typeof objectType)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('astroCalc.allTypes')}</SelectItem>
              <SelectItem value="galaxy">{t('objects.galaxy')}</SelectItem>
              <SelectItem value="nebula">{t('objects.nebula')}</SelectItem>
              <SelectItem value="cluster">{t('objects.openCluster')}</SelectItem>
              <SelectItem value="planetary">{t('objects.planetaryNebula')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.timeWindow')}</Label>
          <Select value={timeWindow} onValueChange={(v) => setTimeWindow(v as typeof timeWindow)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('astroCalc.allNight')}</SelectItem>
              <SelectItem value="evening">{t('astroCalc.evening')}</SelectItem>
              <SelectItem value="midnight">{t('astroCalc.midnight')}</SelectItem>
              <SelectItem value="morning">{t('astroCalc.morning')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.sortBy')}</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">{t('astroCalc.score')}</SelectItem>
              <SelectItem value="altitude">{t('astroCalc.maxAltitude')}</SelectItem>
              <SelectItem value="transit">{t('astroCalc.transitTime')}</SelectItem>
              <SelectItem value="magnitude">{t('astroCalc.magnitude')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Filters Row 2: Sliders */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('astroCalc.magnitude')}</Label>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              {magnitudeRange[0]}-{magnitudeRange[1]}
            </Badge>
          </div>
          <Slider
            value={magnitudeRange}
            onValueChange={(v) => setMagnitudeRange(v as [number, number])}
            min={0}
            max={15}
            step={0.5}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('astroCalc.minAltitude')}</Label>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              {minAltitude}°
            </Badge>
          </div>
          <Slider
            value={[minAltitude]}
            onValueChange={([v]) => setMinAltitude(v)}
            min={10}
            max={60}
            step={5}
          />
        </div>
      </div>
      
      {/* Advanced Filters + Count */}
      <div className="flex items-center justify-between shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs h-7 px-2"
        >
          {showAdvanced ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
          {t('astroCalc.advancedFilters')}
        </Button>
        <Badge variant="outline" className="text-xs">
          {wutObjects.length} {t('astroCalc.objectsVisible')}
        </Badge>
      </div>
      
      {showAdvanced && (
        <div className="shrink-0 p-3 rounded-lg bg-muted/30">
          <div className="max-w-xs space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('astroCalc.minSize')}</Label>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
                {minSize > 0 ? `${minSize}'` : t('astroCalc.any')}
              </Badge>
            </div>
            <Slider
              value={[minSize]}
              onValueChange={([v]) => setMinSize(v)}
              min={0}
              max={60}
              step={1}
            />
          </div>
        </div>
      )}
      
      {/* Results Table */}
      <ScrollArea className="min-h-0 flex-1 border rounded-lg">
        {wutObjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <Telescope className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noObjectsFound')}</p>
            <p className="text-xs mt-1">{t('astroCalc.adjustFilters')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>{t('astroCalc.name')}</TableHead>
                <TableHead>{t('astroCalc.type')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.mag')}</TableHead>
                <TableHead>{t('astroCalc.rise')}</TableHead>
                <TableHead>{t('astroCalc.transit')}</TableHead>
                <TableHead className="text-right">{t('astroCalc.maxEl')}</TableHead>
                <TableHead>{t('astroCalc.set')}</TableHead>
                <TableHead className="text-right hidden lg:table-cell">{t('astroCalc.size')}</TableHead>
                <TableHead className="text-center">{t('astroCalc.score')}</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wutObjects.map((obj) => (
                <TableRow 
                  key={obj.name}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => onSelectObject(obj.ra, obj.dec)}
                >
                  <TableCell className="font-medium text-sm">
                    <TranslatedName name={obj.name} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{obj.type}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{obj.magnitude?.toFixed(1) ?? '--'}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(obj.riseTime)}</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(obj.transitTime)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{obj.maxElevation.toFixed(0)}°</TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(obj.setTime)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums hidden lg:table-cell">
                    {obj.angularSize ? `${obj.angularSize.toFixed(1)}'` : '--'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={obj.score >= 70 ? 'default' : obj.score >= 50 ? 'secondary' : 'outline'}
                      className="text-[10px] px-1.5"
                    >
                      {obj.score}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-8">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME}
                      aria-label={`${t('astroCalc.addToList')}: ${obj.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToList(obj.name, obj.ra, obj.dec);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {wutObjects.length > 0 && (
        <AstroCalculatorResultActionsBar className="shrink-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.copyResults')}
            onClick={() => void copyResults({
              title: t('astroCalc.wut'),
              fileStem: 'astro-calculator-wut',
              observerContext,
              diagnostics: [],
              contentLines: exportLines,
            })}
          >
            {t('astroCalc.copyResults')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.exportResults')}
            onClick={() => exportResults({
              title: t('astroCalc.wut'),
              fileStem: 'astro-calculator-wut',
              observerContext,
              diagnostics: [],
              contentLines: exportLines,
            })}
          >
            <Download className="h-3.5 w-3.5" />
            {t('astroCalc.exportResults')}
          </Button>
        </AstroCalculatorResultActionsBar>
      )}
    </div>
  );
}
