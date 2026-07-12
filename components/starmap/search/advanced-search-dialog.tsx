'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useObjectSearch, type ObjectType, useSkyCultureLanguage, useSelectTarget } from '@/lib/hooks';
import { useTargetListActions } from '@/lib/hooks/use-target-list-actions';
import type { AdvancedSearchDialogProps } from '@/types/starmap/search';
import { ALL_OBJECT_TYPES, CATALOG_PRESETS } from '@/lib/core/constants/search';
import { isValidRA, isValidDec } from '@/lib/astronomy/coordinate-validators';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  CircleDot,
  Loader2,
  SlidersHorizontal,
  Bookmark,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelectToolbar } from './multi-select-toolbar';
import { GroupedResultsList } from './grouped-results-list';
import { getTypeIcon } from './search-utils';

export type { AdvancedSearchDialogProps } from '@/types/starmap/search';

export function AdvancedSearchDialog({ open, onOpenChange, onSelect, searchHook }: AdvancedSearchDialogProps) {
  const t = useTranslations();
  
  // Local state for advanced filters
  const [localQuery, setLocalQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ObjectType[]>(ALL_OBJECT_TYPES);
  const [minMagnitude, setMinMagnitude] = useState<number | undefined>(undefined);
  const [maxMagnitude, setMaxMagnitude] = useState<number | undefined>(undefined);
  const [coordinateMode, setCoordinateMode] = useState<'name' | 'coordinates'>('name');
  const [raInput, setRaInput] = useState('');
  const [decInput, setDecInput] = useState('');
  const [searchRadius, setSearchRadius] = useState(5); // degrees
  const [includeTargetList, setIncludeTargetList] = useState(true);
  const [autoSearch, setAutoSearch] = useState(true);
  const [activeTab, setActiveTab] = useState('filters');
  const [batchQuery, setBatchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use shared search hook from parent, or create own instance as fallback
  const ownSearch = useObjectSearch();
  const {
    results,
    groupedResults,
    isSearching,
    isOnlineSearching,
    searchOutcome,
    searchMessages,
    selectedIds,
    sortBy,
    onlineAvailable,
    setQuery,
    clearSearch,
    toggleSelection,
    selectAll,
    clearSelection,
    setFilters,
    setSortBy,
    addRecentSearch,
    getSelectedItems,
    isSelected,
    searchStats,
  } = searchHook ?? ownSearch;
  
  // Get sky culture language for name translation
  const skyCultureLanguage = useSkyCultureLanguage();

  // Shared target list actions
  const targetListOptions = useMemo(() => ({
    getSelectedItems,
    clearSelection,
  }), [getSelectedItems, clearSelection]);
  const { handleAddToTargetList, handleBatchAdd } = useTargetListActions(targetListOptions);
  
  // Memoize close dialog handler
  const handleCloseDialog = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Toggle type filter
  const toggleTypeFilter = useCallback((type: ObjectType) => {
    setSelectedTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  }, []);

  // Execute search with current filters
  const executeSearch = useCallback(() => {
    // Update filters in hook
    setFilters({
      types: selectedTypes,
      includeTargetList,
      searchMode: coordinateMode,
      minMagnitude,
      maxMagnitude,
      searchRadius,
    });
    
    // Set query to trigger search
    if (coordinateMode === 'coordinates' && raInput && decInput) {
      setQuery(`${raInput} ${decInput}`);
    } else {
      setQuery(localQuery);
    }
  }, [localQuery, selectedTypes, includeTargetList, coordinateMode, raInput, decInput, minMagnitude, maxMagnitude, searchRadius, setFilters, setQuery]);

  const applyBatchQuery = useCallback(() => {
    const normalized = batchQuery
      .split(/\r?\n|,/)
      .map(v => v.trim())
      .filter(Boolean)
      .join('\n');
    if (!normalized) return;
    setLocalQuery(normalized);
    setQuery(normalized);
    setActiveTab('results');
  }, [batchQuery, setQuery]);

  const importBatchFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const normalized = text
        .split(/\r?\n|,/)
        .map(v => v.trim())
        .filter(Boolean)
        .join('\n');
      setBatchQuery(normalized);
    };
    reader.readAsText(file);
  }, []);

  // Auto-search effect (must be after executeSearch is declared)
  useEffect(() => {
    if (!autoSearch || !open) return;
    
    const timer = setTimeout(() => {
      if (localQuery.length >= 2 || (coordinateMode === 'coordinates' && raInput && decInput)) {
        executeSearch();
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [localQuery, raInput, decInput, selectedTypes, autoSearch, open, coordinateMode, executeSearch]);

  // Navigate to target in Stellarium (shared hook)
  const selectTargetCallbacks = useMemo(() => ({
    onSelect,
    addRecentSearch,
  }), [onSelect, addRecentSearch]);
  const selectTarget = useSelectTarget(selectTargetCallbacks);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setLocalQuery('');
    setSelectedTypes(ALL_OBJECT_TYPES);
    setMinMagnitude(undefined);
    setMaxMagnitude(undefined);
    setCoordinateMode('name');
    setRaInput('');
    setDecInput('');
    setSearchRadius(5);
    setIncludeTargetList(true);
    clearSearch();
    clearSelection();
  }, [clearSearch, clearSelection]);

  const selectedCount = selectedIds.size;
  const hasResults = results.length > 0;
  const hasPartialOutcome = searchOutcome === 'partial_success';
  const hasErrorOutcome = searchOutcome === 'error';
  const firstSearchMessage = searchMessages[0]?.message;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="complex-editor">
      <ResponsiveDialogContent className="sm:max-w-3xl max-h-[100vh] max-h-[100dvh] flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('search.advancedSearch')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="filters">{t('search.filters')}</TabsTrigger>
            <TabsTrigger value="results">
              {t('search.results')}
              {hasResults && (
                <Badge variant="secondary" className="ml-2">
                  {results.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Filters Tab */}
          <TabsContent value="filters" className="flex-1 space-y-4 overflow-auto">
            {/* Search Mode */}
            <div className="space-y-2">
              <Label>{t('search.searchMode')}</Label>
              <Select value={coordinateMode} onValueChange={(v) => setCoordinateMode(v as 'name' | 'coordinates')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t('search.searchByName')}</SelectItem>
                  <SelectItem value="coordinates">{t('search.searchByCoordinates')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name Search */}
            {coordinateMode === 'name' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>{t('search.objectName')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      value={localQuery}
                      onChange={(e) => setLocalQuery(e.target.value)}
                      placeholder={t('starmap.searchPlaceholder')}
                      className="pl-9"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          executeSearch();
                          setActiveTab('results');
                        }
                      }}
                    />
                  </div>
                </div>
                
                {/* Catalog Presets */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Bookmark className="h-3 w-3" />
                    {t('search.catalogPresets')}
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {CATALOG_PRESETS.map((preset) => (
                      <Button
                        key={preset.id}
                        variant={localQuery.startsWith(preset.query) ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setLocalQuery(preset.query)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('search.batchSearch', { defaultValue: 'Batch Search' })}</Label>
                  <Textarea
                    value={batchQuery}
                    onChange={(e) => setBatchQuery(e.target.value)}
                    placeholder={t('search.batchPlaceholder', { defaultValue: 'One object per line, e.g.\nM31\nNGC7000\n火星' })}
                    className="min-h-24 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          importBatchFile(file);
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('search.importList', { defaultValue: 'Import List' })}
                    </Button>
                    <Button
                      size="sm"
                      onClick={applyBatchQuery}
                      disabled={!batchQuery.trim()}
                    >
                      {t('search.runBatchSearch', { defaultValue: 'Run Batch Search' })}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Coordinate Search */}
            {coordinateMode === 'coordinates' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('coordinates.ra')}</Label>
                    <Input
                      type="text"
                      value={raInput}
                      onChange={(e) => setRaInput(e.target.value)}
                      placeholder={t('coordinates.raPlaceholder')}
                      className={cn(raInput && !isValidRA(raInput) && 'border-destructive')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('coordinates.dec')}</Label>
                    <Input
                      type="text"
                      value={decInput}
                      onChange={(e) => setDecInput(e.target.value)}
                      placeholder={t('coordinates.decPlaceholder')}
                      className={cn(decInput && !isValidDec(decInput) && 'border-destructive')}
                    />
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-1">
                  <p>{t('search.coordinateFormats')}</p>
                  <p className="font-mono">• 10.68, 41.27 ({t('search.decimal')})</p>
                  <p className="font-mono">• 00h42m44s +41°16′09″</p>
                  <p className="font-mono">• 00:42:44 +41:16:09</p>
                </div>
                <div className="space-y-2">
                  <Label>{t('search.searchRadius')}: {searchRadius}°</Label>
                  <Slider
                    value={[searchRadius]}
                    onValueChange={([v]) => setSearchRadius(v)}
                    min={1}
                    max={30}
                    step={1}
                  />
                </div>
              </div>
            )}

            {/* Object Type Filters */}
            <div className="space-y-2">
              <Label>{t('search.objectTypes')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {ALL_OBJECT_TYPES.map((type) => (
                  <div
                    key={type}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedTypes.includes(type) ? 'bg-accent border-accent-foreground/20' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => toggleTypeFilter(type)}
                  >
                    <Checkbox
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleTypeFilter(type)}
                    />
                    {getTypeIcon(type)}
                    <span className="text-sm">{t(`objects.${type.toLowerCase()}`)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Magnitude Filter */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('search.minMagnitude')}</Label>
                <Input
                  type="number"
                  value={minMagnitude ?? ''}
                  onChange={(e) => setMinMagnitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder={t('skyAtlas.any')}
                  step={0.5}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('search.maxMagnitude')}</Label>
                <Input
                  type="number"
                  value={maxMagnitude ?? ''}
                  onChange={(e) => setMaxMagnitude(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder={t('skyAtlas.any')}
                  step={0.5}
                />
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <Label>{t('search.sortBy')}</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'type' | 'ra' | 'relevance' | 'magnitude' | 'altitude' | 'distance')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{t('search.sortByRelevance')}</SelectItem>
                  <SelectItem value="name">{t('search.sortByName')}</SelectItem>
                  <SelectItem value="type">{t('search.sortByType')}</SelectItem>
                  <SelectItem value="ra">{t('search.sortByRA')}</SelectItem>
                  <SelectItem value="magnitude">{t('search.sortByMagnitude', { defaultValue: 'Magnitude' })}</SelectItem>
                  <SelectItem value="altitude">{t('search.sortByAltitude', { defaultValue: 'Altitude' })}</SelectItem>
                  <SelectItem value="distance">{t('search.sortByDistance', { defaultValue: 'Distance' })}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Include Target List */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeTargetList"
                checked={includeTargetList}
                onCheckedChange={(checked) => setIncludeTargetList(!!checked)}
              />
              <Label htmlFor="includeTargetList" className="cursor-pointer">
                {t('search.includeTargetList')}
              </Label>
            </div>

            {/* Auto-search toggle */}
            <Separator className="my-2" />
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="autoSearch" className="cursor-pointer text-sm">
                {t('search.autoSearch')}
              </Label>
              <Switch
                id="autoSearch"
                checked={autoSearch}
                onCheckedChange={setAutoSearch}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => { executeSearch(); setActiveTab('results'); }} className="flex-1">
                <Search className="h-4 w-4 mr-2" />
                {t('common.search')}
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4 mr-2" />
                {t('common.reset')}
              </Button>
            </div>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="flex-1 flex flex-col min-h-0">
            {/* Search Statistics */}
            {searchStats && hasResults && !isSearching && (
              <div className="flex items-center gap-3 py-2 px-1 text-xs text-muted-foreground border-b">
                <span className="font-medium">{t('search.foundResults', { count: searchStats.totalResults })}</span>
                <span className="text-muted-foreground/50">|</span>
                {onlineAvailable && (
                  <>
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                      {t('search.onlineLabel', { defaultValue: 'Online' })}
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                  </>
                )}
                {Object.entries(searchStats.resultsByType).map(([type, count]) => (
                  <span key={type} className="flex items-center gap-1">
                    {getTypeIcon(type)}
                    <span>{count}</span>
                  </span>
                ))}
                <span className="ml-auto text-[10px]">{searchStats.searchTimeMs}ms</span>
              </div>
            )}

            {/* Loading indicator */}
            {(isSearching || isOnlineSearching) && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  {isOnlineSearching ? t('search.searchingOnline', { defaultValue: 'Searching online...' }) : t('common.loading')}
                </span>
              </div>
            )}

            {/* Partial-success indicator */}
            {!isSearching && hasPartialOutcome && (
              <div className="mx-1 mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                {t('search.partialResults', {
                  defaultValue: 'Partial results: showing available matches while some sources failed.',
                })}
                {firstSearchMessage ? ` ${firstSearchMessage}` : ''}
              </div>
            )}

            {/* Multi-select toolbar */}
            {hasResults && (
              <MultiSelectToolbar
                selectedCount={selectedCount}
                onToggleSelectAll={() => selectedCount > 0 ? clearSelection() : selectAll()}
                onBatchAdd={handleBatchAdd}
                className="py-2 border-b"
              />
            )}

            {/* Results List */}
            {hasResults && !isSearching && (
              <ScrollArea className="flex-1">
                <div className="py-2">
                  <GroupedResultsList
                    groupedResults={groupedResults}
                    isSelected={isSelected}
                    skyCultureLanguage={skyCultureLanguage}
                    onSelect={(item) => {
                      selectTarget(item);
                      handleCloseDialog();
                    }}
                    onToggleSelection={toggleSelection}
                    onAddToTargetList={handleAddToTargetList}
                    defaultExpanded={['DSO', 'Planet', 'Constellation']}
                    searchQuery={localQuery}
                  />
                </div>
              </ScrollArea>
            )}

            {/* Empty State */}
            {!hasResults && !isSearching && !hasErrorOutcome && (
              <EmptyState
                icon={CircleDot}
                message={t('search.noResultsYet')}
                hint={t('search.configureFiltersAndSearch')}
                className="flex-1 flex flex-col items-center justify-center"
                iconClassName="h-12 w-12"
              />
            )}

            {/* Error State */}
            {!isSearching && hasErrorOutcome && (
              <EmptyState
                icon={CircleDot}
                message={t('search.searchFailed', { defaultValue: 'Search failed' })}
                hint={firstSearchMessage || t('search.onlineSearchFailed')}
                className="flex-1 flex flex-col items-center justify-center"
                iconClassName="h-12 w-12"
              />
            )}
          </TabsContent>
        </Tabs>

        <ResponsiveDialogFooter stickyOnMobile>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}


