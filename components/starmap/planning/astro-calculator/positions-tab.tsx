'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchInput } from '@/components/ui/search-input';
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
import { Plus, Telescope, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  calculateTargetVisibility,
  angularSeparation,
  formatTimeShort,
} from '@/lib/astronomy/astro-utils';
import { raDecToAltAzAtTime, raDecToEcliptic, raDecToGalactic } from '@/lib/astronomy/coordinates/transforms';
import { TranslatedName } from '../../objects/translated-name';
import {
  useSkyAtlasStore,
  initializeSkyAtlas,
  DSO_TYPE_LABELS,
  CONSTELLATION_NAMES,
} from '@/lib/catalogs';
import { SortableHeader } from './sortable-header';
import {
  AstroCalculatorResultActionsBar,
  ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME,
  ASTRO_CALCULATOR_ROW_ACTION_BUTTON_CLASSNAME,
} from './result-action-layout';
import { useAstroCalculatorResultActions } from './result-actions';
import type { AstroCalculatorObserverContext, CelestialPosition } from './types';
import { runCalculatorEphemerisBatch, summarizeCalculatorMeta, type CalculatorMetaSummary } from './orchestrator';

interface PositionsTabProps {
  latitude: number;
  longitude: number;
  observerContext?: AstroCalculatorObserverContext;
  onSelectObject: (ra: number, dec: number) => void;
  onAddToList: (name: string, ra: number, dec: number) => void;
}

export function PositionsTab({ latitude, longitude, observerContext, onSelectObject, onAddToList }: PositionsTabProps) {
  const t = useTranslations();
  const { copyResults, exportResults } = useAstroCalculatorResultActions(observerContext);
  const [catalog, setCatalog] = useState<'messier' | 'ngc' | 'caldwell' | 'planets' | 'all'>('messier');
  const [magnitudeLimit, setMagnitudeLimit] = useState(12);
  const [minAltitude, setMinAltitude] = useState(0);
  const [showAboveHorizon, setShowAboveHorizon] = useState(false);
  const [showGalactic, setShowGalactic] = useState(false);
  const [showEcliptic, setShowEcliptic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'altitude',
    direction: 'desc',
  });
  
  const { catalog: dsoCatalog } = useSkyAtlasStore();
  const [solarReference, setSolarReference] = useState<{
    sun: { ra: number; dec: number } | null;
    moon: { ra: number; dec: number } | null;
  }>({
    sun: null,
    moon: null,
  });
  const [solarReferenceMeta, setSolarReferenceMeta] = useState<CalculatorMetaSummary | null>(null);
  
  // Initialize catalog
  useEffect(() => {
    if (dsoCatalog.length === 0) {
      initializeSkyAtlas(latitude, longitude);
    }
  }, [dsoCatalog.length, latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    async function loadReferences() {
      try {
        const [sunResult, moonResult] = await runCalculatorEphemerisBatch([
          {
            body: 'Sun',
            observer: { latitude, longitude },
            startDate: new Date(),
            stepHours: 24,
            steps: 1,
            contextKey: observerContext?.contextKey,
          },
          {
            body: 'Moon',
            observer: { latitude, longitude },
            startDate: new Date(),
            stepHours: 24,
            steps: 1,
            contextKey: observerContext?.contextKey,
          },
        ], { concurrency: 2 });

        if (!cancelled) {
          setSolarReference({
            sun: sunResult.response.points[0] ? { ra: sunResult.response.points[0].ra, dec: sunResult.response.points[0].dec } : null,
            moon: moonResult.response.points[0] ? { ra: moonResult.response.points[0].ra, dec: moonResult.response.points[0].dec } : null,
          });
          setSolarReferenceMeta(summarizeCalculatorMeta([sunResult.meta, moonResult.meta]));
        }
      } catch {
        if (!cancelled) {
          setSolarReference({ sun: null, moon: null });
          setSolarReferenceMeta(null);
        }
      }
    }

    void loadReferences();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, observerContext?.contextKey]);
  
  // Calculate positions for all objects
  const positions = useMemo(() => {
    let objects = dsoCatalog;
    
    // Filter by catalog
    if (catalog !== 'all') {
      objects = objects.filter(obj => {
        const name = obj.name.toLowerCase();
        switch (catalog) {
          case 'messier':
            return name.startsWith('m') && /^m\d+/.test(name);
          case 'ngc':
            return name.startsWith('ngc');
          case 'caldwell':
            return name.startsWith('c') && /^c\d+/.test(name);
          default:
            return true;
        }
      });
    }
    
    // Filter by magnitude
    if (magnitudeLimit < 15) {
      objects = objects.filter(obj => (obj.magnitude ?? 15) <= magnitudeLimit);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      objects = objects.filter(obj => 
        obj.name.toLowerCase().includes(query) ||
        (obj.alternateNames?.some(n => n.toLowerCase().includes(query)))
      );
    }
    
    // Calculate current positions
    const now = new Date();
    const positionedObjects: (CelestialPosition & {
      galacticL?: number;
      galacticB?: number;
      eclipticLon?: number;
      eclipticLat?: number;
      moonDistance?: number;
    })[] = objects.map(obj => {
      const altAz = raDecToAltAzAtTime(obj.ra, obj.dec, latitude, longitude, now);
      const visibility = calculateTargetVisibility(obj.ra, obj.dec, latitude, longitude, 30);
      const galactic = raDecToGalactic(obj.ra, obj.dec, now);
      const ecliptic = raDecToEcliptic(obj.ra, obj.dec, now);
      const elongation = solarReference.sun
        ? angularSeparation(obj.ra, obj.dec, solarReference.sun.ra, solarReference.sun.dec)
        : undefined;
      const moonDistance = solarReference.moon
        ? angularSeparation(obj.ra, obj.dec, solarReference.moon.ra, solarReference.moon.dec)
        : undefined;
      
      return {
        name: obj.name,
        type: DSO_TYPE_LABELS[obj.type] || obj.type,
        ra: obj.ra,
        dec: obj.dec,
        magnitude: obj.magnitude,
        angularSize: obj.sizeMax,
        altitude: altAz.altitude,
        azimuth: altAz.azimuth,
        transitTime: visibility.transitTime,
        maxElevation: visibility.transitAltitude,
        elongation,
        moonDistance,
        galacticL: galactic.l,
        galacticB: galactic.b,
        eclipticLon: ecliptic.longitude,
        eclipticLat: ecliptic.latitude,
        constellation: CONSTELLATION_NAMES[obj.constellation] || obj.constellation,
      };
    });
    
    // Filter by altitude
    let filtered = positionedObjects;
    if (showAboveHorizon) {
      filtered = filtered.filter(obj => obj.altitude > 0);
    }
    if (minAltitude > 0) {
      filtered = filtered.filter(obj => obj.altitude >= minAltitude);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      
      switch (sortConfig.key) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'altitude':
          aVal = a.altitude;
          bVal = b.altitude;
          break;
        case 'magnitude':
          aVal = a.magnitude ?? 99;
          bVal = b.magnitude ?? 99;
          break;
        case 'transit':
          aVal = a.transitTime?.getTime() ?? 0;
          bVal = b.transitTime?.getTime() ?? 0;
          break;
        case 'maxElevation':
          aVal = a.maxElevation;
          bVal = b.maxElevation;
          break;
        default:
          aVal = a.altitude;
          bVal = b.altitude;
      }
      
      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      
      return sortConfig.direction === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
    
    return filtered.slice(0, 200); // Limit for performance
  }, [dsoCatalog, catalog, magnitudeLimit, minAltitude, showAboveHorizon, searchQuery, sortConfig, latitude, longitude, solarReference]);

  const exportLines = useMemo(() => {
    return [
      `Catalog: ${catalog}`,
      `Magnitude limit: ${magnitudeLimit}`,
      `Min altitude: ${minAltitude}`,
      `Above horizon only: ${showAboveHorizon}`,
      '',
      ...positions.map((obj) => [
        obj.name,
        `Type=${obj.type}`,
        `RA=${degreesToHMS(obj.ra)}`,
        `Dec=${degreesToDMS(obj.dec)}`,
        `Mag=${obj.magnitude !== undefined ? obj.magnitude.toFixed(1) : '--'}`,
        `Alt=${obj.altitude.toFixed(1)}`,
        `Transit=${formatTimeShort(obj.transitTime)}`,
        `MaxEl=${obj.maxElevation.toFixed(1)}`,
      ].join(' | ')),
    ];
  }, [catalog, magnitudeLimit, minAltitude, positions, showAboveHorizon]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };
  
  return (
    <div className="flex flex-1 min-h-0 flex-col gap-4">
      {/* Filters Row 1: Catalog + Search (two-up on phones so the results area keeps room) */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.catalog')}</Label>
          <Select value={catalog} onValueChange={(v) => setCatalog(v as typeof catalog)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('astroCalc.allObjects')}</SelectItem>
              <SelectItem value="messier">Messier</SelectItem>
              <SelectItem value="ngc">NGC</SelectItem>
              <SelectItem value="caldwell">Caldwell</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-xs">{t('astroCalc.search')}</Label>
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="M31, NGC..."
            inputClassName="h-8 text-sm"
          />
        </div>
      </div>
      
      {/* Filters Row 2: Sliders */}
      <div className="grid grid-cols-2 gap-4 shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('astroCalc.magnitudeLimit')}</Label>
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-mono">
              {magnitudeLimit}
            </Badge>
          </div>
          <Slider
            value={[magnitudeLimit]}
            onValueChange={([v]) => setMagnitudeLimit(v)}
            min={4}
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
            min={0}
            max={80}
            step={5}
          />
        </div>
      </div>
      
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="aboveHorizon"
              checked={showAboveHorizon}
              onCheckedChange={(checked) => setShowAboveHorizon(!!checked)}
            />
            <Label htmlFor="aboveHorizon" className="text-xs">
              {t('astroCalc.showAboveHorizonOnly')}
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="showGalactic"
              checked={showGalactic}
              onCheckedChange={(checked) => setShowGalactic(!!checked)}
            />
            <Label htmlFor="showGalactic" className="text-xs">
              {t('astroCalc.showGalactic')}
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id="showEcliptic"
              checked={showEcliptic}
              onCheckedChange={(checked) => setShowEcliptic(!!checked)}
            />
            <Label htmlFor="showEcliptic" className="text-xs">
              {t('astroCalc.showEcliptic')}
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {solarReferenceMeta && (
            <Badge variant="secondary" className="text-[10px]" data-testid="positions-meta">
              {`src:${solarReferenceMeta.sourceCounts.tauri > 0 ? 'tauri' : 'fallback'} cache:${solarReferenceMeta.cacheHits}/${solarReferenceMeta.total}`}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {positions.length} {t('astroCalc.objects')}
          </Badge>
        </div>
      </div>
      
      {/* Results Table */}
      <ScrollArea className="min-h-0 flex-1 border rounded-lg">
        {positions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <Telescope className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('astroCalc.noObjectsFound')}</p>
            <p className="text-xs mt-1">{t('astroCalc.adjustFilters')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <SortableHeader label={t('astroCalc.name')} sortKey="name" currentSort={sortConfig} onSort={handleSort} />
                <TableHead>{t('astroCalc.type')}</TableHead>
                <TableHead>{t('astroCalc.tableRA')}</TableHead>
                <TableHead>{t('astroCalc.tableDec')}</TableHead>
                <SortableHeader label={t('astroCalc.mag')} sortKey="magnitude" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label={t('astroCalc.alt')} sortKey="altitude" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label={t('astroCalc.transit')} sortKey="transit" currentSort={sortConfig} onSort={handleSort} />
                <SortableHeader label={t('astroCalc.maxEl')} sortKey="maxElevation" currentSort={sortConfig} onSort={handleSort} />
                {showGalactic && (
                  <>
                    <TableHead className="text-right">{t('astroCalc.galacticL')}</TableHead>
                    <TableHead className="text-right">{t('astroCalc.galacticB')}</TableHead>
                  </>
                )}
                {showEcliptic && (
                  <>
                    <TableHead className="text-right">{t('astroCalc.eclipticLon')}</TableHead>
                    <TableHead className="text-right">{t('astroCalc.eclipticLat')}</TableHead>
                  </>
                )}
                <TableHead className="text-right">{t('astroCalc.moonDistance')}</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((obj) => (
                <TableRow 
                  key={obj.name} 
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => onSelectObject(obj.ra, obj.dec)}
                >
                  <TableCell className="font-medium text-sm">
                    <TranslatedName name={obj.name} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{obj.type}</TableCell>
                  <TableCell className="font-mono text-xs">{degreesToHMS(obj.ra)}</TableCell>
                  <TableCell className="font-mono text-xs">{degreesToDMS(obj.dec)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{obj.magnitude?.toFixed(1) ?? '--'}</TableCell>
                  <TableCell className={cn(
                    'text-xs font-medium text-right tabular-nums',
                    obj.altitude > 30 ? 'text-green-500' : obj.altitude > 0 ? 'text-yellow-500' : 'text-red-500'
                  )}>
                    {obj.altitude.toFixed(1)}°
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatTimeShort(obj.transitTime)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{obj.maxElevation.toFixed(1)}°</TableCell>
                  {showGalactic && (
                    <>
                      <TableCell className="text-xs text-right tabular-nums">{(obj as { galacticL?: number }).galacticL?.toFixed(2) ?? '--'}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{(obj as { galacticB?: number }).galacticB?.toFixed(2) ?? '--'}</TableCell>
                    </>
                  )}
                  {showEcliptic && (
                    <>
                      <TableCell className="text-xs text-right tabular-nums">{(obj as { eclipticLon?: number }).eclipticLon?.toFixed(2) ?? '--'}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{(obj as { eclipticLat?: number }).eclipticLat?.toFixed(2) ?? '--'}</TableCell>
                    </>
                  )}
                  <TableCell className="text-xs text-right tabular-nums">{(obj as { moonDistance?: number }).moonDistance?.toFixed(1) ?? '--'}</TableCell>
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

      {positions.length > 0 && (
        <AstroCalculatorResultActionsBar className="shrink-0 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={ASTRO_CALCULATOR_RESULT_ACTION_BUTTON_CLASSNAME}
            aria-label={t('astroCalc.copyResults')}
            onClick={() => void copyResults({
              title: t('astroCalc.positions'),
              fileStem: 'astro-calculator-positions',
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
              title: t('astroCalc.positions'),
              fileStem: 'astro-calculator-positions',
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
