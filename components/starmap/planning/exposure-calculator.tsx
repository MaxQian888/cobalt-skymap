'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Calculator,
  Clock,
  Aperture,
  Sun,
  Crosshair,
  Camera,
  Layers,
  Filter,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  ResponsiveDialogDescription,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  BORTLE_SCALE,
  calculateExposure,
  calculateTotalIntegration,
  formatDuration,
} from '@/lib/astronomy/astro-utils';
import {
  calculateSNR,
  estimateFileSize,
  calculateOptimalSubExposure,
  estimateSessionTime,
  calculateSmartExposure,
} from '@/lib/astronomy/exposure-utils';
import { checkSampling } from '@/lib/astronomy/imaging/exposure';
import { COMMON_FILTERS, BINNING_OPTIONS, IMAGE_TYPES, FILTER_SEQUENCE_PRESETS } from '@/lib/core/constants/planning';
import type { ExposurePlan, ExposureCalculatorProps } from '@/types/starmap/planning';
import { useEquipmentStore } from '@/lib/stores';
import { clipboardService } from '@/lib/services/clipboard-service';

// ============================================================================
// Sub Components
// ============================================================================

function SNRIndicator({ snr }: { snr: number }) {
  const t = useTranslations();
  const level = snr > 50 ? 'excellent' : snr > 30 ? 'good' : snr > 15 ? 'fair' : 'poor';
  const colors = {
    excellent: 'bg-green-500',
    good: 'bg-emerald-400',
    fair: 'bg-yellow-500',
    poor: 'bg-red-500',
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', colors[level])} />
      <span className="text-sm font-mono">{snr.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({t(`exposure.snrLevel.${level}`)})</span>
    </div>
  );
}

function ExposureTimeSlider({
  value,
  onChange,
  max = 600,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  // Common exposure times for quick selection
  const presets = [1, 5, 10, 30, 60, 120, 180, 300, 600];
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {presets.slice(0, 6).map((preset) => (
            <Button
              key={preset}
              variant={value === preset ? 'default' : 'outline'}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChange(preset)}
            >
              {preset}s
            </Button>
          ))}
        </div>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(1, parseInt(e.target.value) || 1))}
          className="h-7 w-20 text-right text-sm"
          min={1}
          max={max}
        />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={1}
        max={max}
        step={1}
        className="w-full"
      />
    </div>
  );
}

const GAIN_STRATEGY_OPTIONS = [
  { value: 'unity' as const, labelKey: 'exposure.gainStrategyUnity' },
  { value: 'max_dynamic_range' as const, labelKey: 'exposure.gainStrategyMaxDynamicRange' },
  { value: 'manual' as const, labelKey: 'exposure.gainStrategyManual' },
];

// ============================================================================
// Main Component
// ============================================================================

export function ExposureCalculator({
  focalLength: propFocalLength,
  aperture: propAperture,
  pixelSize: propPixelSize,
  onExposurePlanChange,
}: ExposureCalculatorProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Per-field selectors — ExposureCalculator must not re-render on unrelated
  // equipment-store changes. Actions/getters are stable Zustand refs.
  const exposureDefaults = useEquipmentStore((s) => s.exposureDefaults);
  const storeFocalLength = useEquipmentStore((s) => s.focalLength);
  const storeAperture = useEquipmentStore((s) => s.aperture);
  const storePixelSize = useEquipmentStore((s) => s.pixelSize);
  const sensorWidth = useEquipmentStore((s) => s.sensorWidth);
  const sensorHeight = useEquipmentStore((s) => s.sensorHeight);
  const getResolution = useEquipmentStore((s) => s.getResolution);

  // Equipment settings - prefer props, fallback to store
  const [focalLength, setFocalLength] = useState(propFocalLength ?? storeFocalLength);
  const [aperture, setAperture] = useState(propAperture ?? storeAperture);
  const [pixelSize, setPixelSize] = useState(propPixelSize ?? storePixelSize);
  
  // Environment - use store defaults
  const [bortle, setBortle] = useState(exposureDefaults.bortle);
  
  // Exposure settings - use store defaults
  const [exposureTime, setExposureTime] = useState(exposureDefaults.exposureTime);
  const [gain, setGain] = useState(exposureDefaults.gain);
  const [offset, setOffset] = useState(exposureDefaults.offset);
  const [binning, setBinning] = useState<typeof BINNING_OPTIONS[number]>(exposureDefaults.binning);
  const [imageType, setImageType] = useState<'LIGHT' | 'DARK' | 'FLAT' | 'BIAS'>('LIGHT');
  const [filter, setFilter] = useState(exposureDefaults.filter);
  const [frameCount, setFrameCount] = useState(exposureDefaults.frameCount);
  
  // Dither settings - use store defaults
  const [ditherEnabled, setDitherEnabled] = useState(exposureDefaults.ditherEnabled);
  const [ditherEvery, setDitherEvery] = useState(exposureDefaults.ditherEvery);
  
  // Target settings - use store defaults
  const [targetType, setTargetType] = useState<'galaxy' | 'nebula' | 'cluster' | 'planetary'>(exposureDefaults.targetType);
  const [tracking, setTracking] = useState<'none' | 'basic' | 'guided'>(exposureDefaults.tracking);
  
  // UI state
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Professional model defaults (Smart Histogram style)
  const [sqmOverride, setSqmOverride] = useState<number | undefined>(exposureDefaults.sqmOverride);
  const [filterBandwidthNm, setFilterBandwidthNm] = useState(
    exposureDefaults.filterBandwidthNm
      ?? COMMON_FILTERS.find((f) => f.id === exposureDefaults.filter)?.bandwidthNm
      ?? 300
  );
  const [readNoiseLimitPercent, setReadNoiseLimitPercent] = useState(exposureDefaults.readNoiseLimitPercent ?? 5);
  const [gainStrategy, setGainStrategy] = useState<'unity' | 'max_dynamic_range' | 'manual'>(
    exposureDefaults.gainStrategy ?? 'unity'
  );
  const [manualGain, setManualGain] = useState(exposureDefaults.manualGain ?? exposureDefaults.gain);
  const [manualReadNoiseEnabled, setManualReadNoiseEnabled] = useState(exposureDefaults.manualReadNoiseEnabled ?? false);
  const [manualReadNoise, setManualReadNoise] = useState(exposureDefaults.manualReadNoise ?? 1.8);
  const [manualDarkCurrent, setManualDarkCurrent] = useState(exposureDefaults.manualDarkCurrent ?? 0.002);
  const [manualFullWell, setManualFullWell] = useState(exposureDefaults.manualFullWell ?? 50000);
  const [manualQE, setManualQE] = useState(exposureDefaults.manualQE ?? 0.8);
  const [manualEPeraDu, setManualEPeraDu] = useState(exposureDefaults.manualEPeraDu ?? 1);
  const [targetSurfaceBrightness, setTargetSurfaceBrightness] = useState(exposureDefaults.targetSurfaceBrightness ?? 22);
  const [targetSignalRate, setTargetSignalRate] = useState(exposureDefaults.targetSignalRate ?? 0);
  
  // Calculations
  const selectedFilterInfo = useMemo(() => {
    return COMMON_FILTERS.find((f) => f.id === filter);
  }, [filter]);

  const isNarrowband = useMemo(() => {
    return selectedFilterInfo?.type === 'narrowband';
  }, [selectedFilterInfo]);
  
  const exposureCalc = useMemo(() => {
    return calculateExposure({
      bortle,
      focalLength,
      aperture,
      tracking,
    });
  }, [bortle, focalLength, aperture, tracking]);
  
  const integrationCalc = useMemo(() => {
    return calculateTotalIntegration({
      bortle,
      targetType,
      isNarrowband,
    });
  }, [bortle, targetType, isNarrowband]);
  
  const fRatio = aperture > 0 ? focalLength / aperture : 5;
  const imageScale = focalLength > 0 ? (206.265 * pixelSize) / focalLength : 0;

  const snr = useMemo(() => {
    return calculateSNR(exposureTime, gain, bortle, isNarrowband, fRatio, pixelSize);
  }, [exposureTime, gain, bortle, isNarrowband, fRatio, pixelSize]);

  const optimalSub = useMemo(() => {
    return calculateOptimalSubExposure(bortle, fRatio, pixelSize, focalLength, isNarrowband, undefined, gain);
  }, [bortle, fRatio, pixelSize, focalLength, isNarrowband, gain]);

  const smartExposure = useMemo(() => {
    const maxExposureSec = tracking === 'none'
      ? Math.max(10, Math.floor(exposureCalc.maxUntracked))
      : 600;

    return calculateSmartExposure({
      camera: manualReadNoiseEnabled
        ? {
            readNoise: manualReadNoise,
            darkCurrent: manualDarkCurrent,
            fullWell: manualFullWell,
            qe: manualQE,
            ePerAdu: manualEPeraDu,
          }
        : undefined,
      sky: {
        bortle,
        sqm: sqmOverride,
        filterBandwidthNm,
        isNarrowband,
        fRatio,
        pixelSize,
        focalLength,
        targetSurfaceBrightness,
        targetSignalRate: targetSignalRate > 0 ? targetSignalRate : undefined,
      },
      readNoiseLimitPercent,
      gainStrategy,
      manualGain,
      minExposureSec: 2,
      maxExposureSec,
      targetSNR: 10,
      targetTimeNoiseRatio: 80,
    });
  }, [
    exposureCalc.maxUntracked,
    manualReadNoiseEnabled,
    manualReadNoise,
    manualDarkCurrent,
    manualFullWell,
    manualQE,
    manualEPeraDu,
    bortle,
    sqmOverride,
    filterBandwidthNm,
    isNarrowband,
    fRatio,
    pixelSize,
    focalLength,
    targetSurfaceBrightness,
    targetSignalRate,
    readNoiseLimitPercent,
    gainStrategy,
    manualGain,
    tracking,
  ]);
  
  const totalIntegrationMinutes = useMemo(() => {
    return (exposureTime * frameCount) / 60;
  }, [exposureTime, frameCount]);

  const sessionTime = useMemo(() => {
    return estimateSessionTime(exposureTime, frameCount, ditherEnabled, ditherEvery);
  }, [exposureTime, frameCount, ditherEnabled, ditherEvery]);
  
  const sensorResolution = useMemo(() => {
    return getResolution();
  }, [getResolution, sensorWidth, sensorHeight]);

  const fileSize = useMemo(() => {
    return estimateFileSize(binning, 16, sensorResolution.width, sensorResolution.height);
  }, [binning, sensorResolution]);
  
  const totalStorageGB = useMemo(() => {
    return (fileSize * frameCount) / 1024;
  }, [fileSize, frameCount]);
  
  const bortleInfo = BORTLE_SCALE.find((b) => b.value === bortle);
  
  // Plan summary
  const plan = useMemo((): ExposurePlan => ({
    settings: {
      exposureTime,
      gain,
      offset,
      binning,
      imageType,
      count: frameCount,
      filter,
      ditherEvery,
      ditherEnabled,
    },
    totalExposure: totalIntegrationMinutes,
    totalFrames: frameCount,
    estimatedFileSize: fileSize,
    estimatedTime: formatDuration(totalIntegrationMinutes),
    advanced: {
      sqm: sqmOverride ?? bortleInfo?.sqm,
      filterBandwidthNm,
      readNoiseLimitPercent,
      gainStrategy: smartExposure.gainStrategyUsed,
      recommendedGain: smartExposure.recommendedGain,
      recommendedExposureSec: smartExposure.recommendedExposureSec,
      skyFluxPerPixel: smartExposure.skyFluxPerPixel,
      targetSignalPerPixelPerSec: smartExposure.targetSignalPerPixelPerSec,
      dynamicRangeScore: smartExposure.dynamicRangeScore,
      dynamicRangeStops: smartExposure.dynamicRangeStops,
      readNoiseUsed: smartExposure.readNoiseUsed,
      darkCurrentUsed: smartExposure.darkCurrentUsed,
      noiseFractions: {
        read: smartExposure.noiseBreakdown.readFraction,
        sky: smartExposure.noiseBreakdown.skyFraction,
        dark: smartExposure.noiseBreakdown.darkFraction,
      },
      stackEstimate: {
        recommendedFrameCount: smartExposure.stackEstimate.recommendedFrameCount,
        estimatedTotalMinutes: smartExposure.stackEstimate.estimatedTotalMinutes,
        framesForTargetSNR: smartExposure.stackEstimate.framesForTargetSNR,
        framesForTimeNoise: smartExposure.stackEstimate.framesForTimeNoise,
        targetSNR: smartExposure.stackEstimate.targetSNR,
        targetTimeNoiseRatio: smartExposure.stackEstimate.targetTimeNoiseRatio,
      },
    },
  }), [
    exposureTime,
    gain,
    offset,
    binning,
    imageType,
    frameCount,
    filter,
    ditherEvery,
    ditherEnabled,
    totalIntegrationMinutes,
    fileSize,
    sqmOverride,
    bortleInfo?.sqm,
    filterBandwidthNm,
    readNoiseLimitPercent,
    smartExposure,
  ]);
  
  const handleApply = useCallback(() => {
    onExposurePlanChange?.(plan);
    setOpen(false);
  }, [plan, onExposurePlanChange]);

  const handleFilterChange = useCallback((nextFilter: string) => {
    setFilter(nextFilter);
    const matched = COMMON_FILTERS.find((f) => f.id === nextFilter);
    if (matched?.bandwidthNm) {
      setFilterBandwidthNm(matched.bandwidthNm);
    }
  }, []);
  
  const handleReset = useCallback(() => {
    setFocalLength(propFocalLength ?? storeFocalLength);
    setAperture(propAperture ?? storeAperture);
    setPixelSize(propPixelSize ?? storePixelSize);
    setBortle(exposureDefaults.bortle);
    setExposureTime(exposureDefaults.exposureTime);
    setGain(exposureDefaults.gain);
    setOffset(exposureDefaults.offset);
    setBinning(exposureDefaults.binning);
    setImageType('LIGHT');
    setFilter(exposureDefaults.filter);
    setFilterBandwidthNm(
      exposureDefaults.filterBandwidthNm ?? COMMON_FILTERS.find((f) => f.id === exposureDefaults.filter)?.bandwidthNm ?? 300
    );
    setFrameCount(exposureDefaults.frameCount);
    setDitherEnabled(exposureDefaults.ditherEnabled);
    setDitherEvery(exposureDefaults.ditherEvery);
    setTargetType(exposureDefaults.targetType);
    setTracking(exposureDefaults.tracking);
    setSqmOverride(exposureDefaults.sqmOverride);
    setReadNoiseLimitPercent(exposureDefaults.readNoiseLimitPercent ?? 5);
    setGainStrategy(exposureDefaults.gainStrategy ?? 'unity');
    setManualGain(exposureDefaults.manualGain ?? exposureDefaults.gain);
    setManualReadNoiseEnabled(exposureDefaults.manualReadNoiseEnabled ?? false);
    setManualReadNoise(exposureDefaults.manualReadNoise ?? 1.8);
    setManualDarkCurrent(exposureDefaults.manualDarkCurrent ?? 0.002);
    setManualFullWell(exposureDefaults.manualFullWell ?? 50000);
    setManualQE(exposureDefaults.manualQE ?? 0.8);
    setManualEPeraDu(exposureDefaults.manualEPeraDu ?? 1);
    setTargetSurfaceBrightness(exposureDefaults.targetSurfaceBrightness ?? 22);
    setTargetSignalRate(exposureDefaults.targetSignalRate ?? 0);
    setShowAdvanced(false);
  }, [propFocalLength, propAperture, propPixelSize, storeFocalLength, storeAperture, storePixelSize, exposureDefaults]);

  const handleCopy = useCallback(async () => {
    const text = `Exposure: ${exposureTime}s × ${frameCount} = ${formatDuration(totalIntegrationMinutes)}\nFilter: ${filter} | Gain: ${gain} | Binning: ${binning}`;
    try {
      await clipboardService.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard failures should not interrupt planning flow.
    }
  }, [exposureTime, frameCount, totalIntegrationMinutes, filter, gain, binning]);
  
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="complex-editor">
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent touch-target toolbar-btn"
            >
              <Calculator className="h-5 w-5" />
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t('exposure.exposureCalculator')}</p>
        </TooltipContent>
      </Tooltip>

      <ResponsiveDialogContent
        desktopClassName="w-[95vw] max-w-[640px]"
        className="overflow-hidden flex flex-col p-4 sm:p-6"
      >
        <ResponsiveDialogHeader className="shrink-0">
          <ResponsiveDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calculator className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {t('exposure.exposureCalculator')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="text-xs sm:text-sm">
            {t('exposure.calculatorDescription')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        
        <Tabs defaultValue="exposure" className="flex-1 flex flex-col min-h-0 mt-2">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="exposure" className="text-[10px] sm:text-xs px-1 sm:px-3">
              <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('exposure.exposureTab')}</span>
              <span className="sm:hidden">{t('exposure.exposureTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="equipment" className="text-[10px] sm:text-xs px-1 sm:px-3">
              <Aperture className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('exposure.equipmentTab')}</span>
              <span className="sm:hidden">{t('exposure.equipmentTabShort')}</span>
            </TabsTrigger>
            <TabsTrigger value="plan" className="text-[10px] sm:text-xs px-1 sm:px-3">
              <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 sm:mr-1.5" />
              <span className="hidden sm:inline">{t('exposure.planTab')}</span>
              <span className="sm:hidden">{t('exposure.planTabShort')}</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Exposure Tab */}
          <TabsContent value="exposure" className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pt-3 sm:pt-4 pr-1">
            {/* Environment Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Sun className="h-4 w-4 text-yellow-500" />
                  {t('exposure.lightPollution')}
                </Label>
                <Badge variant="outline" className="text-xs font-mono">
                  SQM: {bortleInfo?.sqm.toFixed(2)}
                </Badge>
              </div>
              <Select
                value={bortle.toString()}
                onValueChange={(v) => setBortle(parseInt(v))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BORTLE_SCALE.map((b) => (
                    <SelectItem key={b.value} value={b.value.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono w-4">{b.value}</span>
                        <span>{b.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            {/* Exposure Time */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Clock className="h-4 w-4" />
                  {t('exposure.singleExposure')}
                </Label>
                <SNRIndicator snr={snr} />
              </div>
              <ExposureTimeSlider
                value={exposureTime}
                onChange={setExposureTime}
                max={tracking === 'none' ? Math.floor(exposureCalc.maxUntracked) : 600}
              />
              {tracking === 'none' && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {t('exposure.maxUntracked', { seconds: exposureCalc.maxUntracked.toFixed(1) })}
                </p>
              )}
            </div>
            
            {/* Filter & Gain/Offset */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {t('exposure.filter')}
                </Label>
                <Select value={filter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_FILTERS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'w-2 h-2 rounded-full',
                            f.type === 'narrowband' ? 'bg-red-500' : 'bg-blue-500'
                          )} />
                          <span>{t(f.nameKey)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('exposure.gain')}</Label>
                <Input
                  type="number"
                  value={gain}
                  onChange={(e) => setGain(parseInt(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('exposure.offset')}</Label>
                <Input
                  type="number"
                  value={offset}
                  onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
                  className="h-8"
                />
              </div>
            </div>
            
            {/* Binning & Image Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="space-y-2">
                <Label className="text-xs">{t('exposure.binning')}</Label>
                <ToggleGroup type="single" value={binning} onValueChange={(v) => v && setBinning(v as typeof binning)} variant="outline" size="sm" className="w-full">
                  {BINNING_OPTIONS.map((b) => (
                    <ToggleGroupItem key={b} value={b} className="flex-1 h-7 text-xs">
                      {b}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('exposure.imageType')}</Label>
                <Select value={imageType} onValueChange={(v) => setImageType(v as typeof imageType)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {t(type.nameKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Frame Count */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t('exposure.frameCount')}</Label>
                <span className="text-xs text-muted-foreground">
                  {t('exposure.totalTime')}: {formatDuration(totalIntegrationMinutes)}
                </span>
              </div>
              <div className="flex gap-2">
                <Slider
                  value={[frameCount]}
                  onValueChange={([v]) => setFrameCount(v)}
                  min={1}
                  max={200}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={frameCount}
                  onChange={(e) => setFrameCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 w-20 text-right"
                />
              </div>
            </div>
            
            {/* Advanced Options */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8">
                  <span className="text-xs">{t('exposure.advancedOptions')}</span>
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                {/* Dither Settings */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs">{t('exposure.dither')}</Label>
                    <p className="text-[10px] text-muted-foreground">
                      {t('exposure.ditherDescription')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={ditherEnabled}
                      onCheckedChange={setDitherEnabled}
                    />
                    {ditherEnabled && (
                      <Input
                        type="number"
                        value={ditherEvery}
                        onChange={(e) => setDitherEvery(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-7 w-12 text-center text-xs"
                        min={1}
                      />
                    )}
                  </div>
                </div>
                
                {/* Tracking Mode */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('exposure.tracking')}</Label>
                  <ToggleGroup type="single" value={tracking} onValueChange={(v) => v && setTracking(v as typeof tracking)} variant="outline" size="sm" className="w-full">
                    {(['none', 'basic', 'guided'] as const).map((trackingMode) => (
                      <ToggleGroupItem key={trackingMode} value={trackingMode} className="flex-1 h-7 text-xs">
                        {trackingMode === 'none' 
                          ? t('exposure.trackingNone') 
                          : trackingMode === 'basic' 
                            ? t('exposure.trackingBasic') 
                            : t('exposure.trackingGuided')}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                
                {/* Target Type */}
                <div className="space-y-2">
                  <Label className="text-xs">{t('exposure.targetType')}</Label>
                  <ToggleGroup type="single" value={targetType} onValueChange={(v) => v && setTargetType(v as typeof targetType)} variant="outline" size="sm" className="w-full">
                    {(['galaxy', 'nebula', 'cluster', 'planetary'] as const).map((type) => (
                      <ToggleGroupItem key={type} value={type} className="flex-1 h-6 text-[10px]">
                        {t(`exposure.${type}`)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-xs font-medium">{t('exposure.professionalParameters')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.sqmOverride')}</Label>
                      <Input
                        type="number"
                        value={sqmOverride ?? ''}
                        placeholder="Auto"
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          setSqmOverride(raw ? Math.max(16, Math.min(23, parseFloat(raw) || 0)) : undefined);
                        }}
                        step={0.01}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.filterBandwidthNm')}</Label>
                      <Input
                        type="number"
                        value={filterBandwidthNm}
                        onChange={(e) => setFilterBandwidthNm(Math.max(2, Math.min(300, parseFloat(e.target.value) || 300)))}
                        className="h-8"
                        min={2}
                        max={300}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.readNoiseLimitPercent')}</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[readNoiseLimitPercent]}
                          onValueChange={([v]) => setReadNoiseLimitPercent(Math.max(2, Math.min(20, v)))}
                          min={2}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <Badge variant="outline" className="min-w-10 justify-center">
                          {readNoiseLimitPercent}%
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.gainStrategy')}</Label>
                      <Select
                        value={gainStrategy}
                        onValueChange={(value) => setGainStrategy(value as typeof gainStrategy)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GAIN_STRATEGY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {gainStrategy === 'manual' && (
                      <div className="space-y-1">
                        <Label className="text-xs">{t('exposure.manualGain')}</Label>
                        <Input
                          type="number"
                          value={manualGain}
                          onChange={(e) => setManualGain(Math.max(0, Math.min(300, parseInt(e.target.value) || 0)))}
                          className="h-8"
                          min={0}
                          max={300}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.targetSurfaceBrightness')}</Label>
                      <Input
                        type="number"
                        value={targetSurfaceBrightness}
                        onChange={(e) => setTargetSurfaceBrightness(Math.max(10, Math.min(30, parseFloat(e.target.value) || 22)))}
                        className="h-8"
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.targetSignalRate')}</Label>
                      <Input
                        type="number"
                        value={targetSignalRate}
                        onChange={(e) => setTargetSignalRate(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8"
                        step={0.01}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-xs">{t('exposure.manualCameraNoise')}</Label>
                    <p className="text-[10px] text-muted-foreground">{t('exposure.manualCameraNoiseDescription')}</p>
                  </div>
                  <Switch checked={manualReadNoiseEnabled} onCheckedChange={setManualReadNoiseEnabled} />
                </div>

                {manualReadNoiseEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.readNoiseE')}</Label>
                      <Input
                        type="number"
                        value={manualReadNoise}
                        onChange={(e) => setManualReadNoise(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                        className="h-8"
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.darkCurrentE')}</Label>
                      <Input
                        type="number"
                        value={manualDarkCurrent}
                        onChange={(e) => setManualDarkCurrent(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="h-8"
                        step={0.0001}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.fullWellE')}</Label>
                      <Input
                        type="number"
                        value={manualFullWell}
                        onChange={(e) => setManualFullWell(Math.max(1000, parseFloat(e.target.value) || 1000))}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.quantumEfficiency')}</Label>
                      <Input
                        type="number"
                        value={manualQE}
                        onChange={(e) => setManualQE(Math.max(0.05, Math.min(1, parseFloat(e.target.value) || 0.8)))}
                        className="h-8"
                        step={0.01}
                        min={0.05}
                        max={1}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('exposure.ePerAdu')}</Label>
                      <Input
                        type="number"
                        value={manualEPeraDu}
                        onChange={(e) => setManualEPeraDu(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                        className="h-8"
                        step={0.01}
                      />
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
          
          {/* Equipment Tab */}
          <TabsContent value="equipment" className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pt-3 sm:pt-4 pr-1">
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Crosshair className="h-3 w-3" />
                  {t('exposure.focalLength')} (mm)
                </Label>
                <Input
                  type="number"
                  value={focalLength}
                  onChange={(e) => setFocalLength(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Aperture className="h-3 w-3" />
                  {t('exposure.aperture')} (mm)
                </Label>
                <Input
                  type="number"
                  value={aperture}
                  onChange={(e) => setAperture(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t('exposure.pixelSize')} (μm)</Label>
                <Input
                  type="number"
                  value={pixelSize}
                  onChange={(e) => setPixelSize(parseFloat(e.target.value) || 0)}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('exposure.fRatio')}</Label>
                <div className="h-10 flex items-center px-3 bg-muted rounded-md font-mono text-sm">
                  f/{fRatio.toFixed(1)}
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Calculated Values */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('exposure.calculatedValues')}</CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('exposure.imageScale')}</span>
                  <span className="font-mono">{imageScale.toFixed(2)} &quot;/px</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('exposure.sampling')}</span>
                  {(() => {
                    const sampling = checkSampling(imageScale, 2.5);
                    const samplingColors = {
                      undersampled: 'text-yellow-500',
                      optimal: 'text-green-500',
                      oversampled: 'text-orange-500',
                    };
                    return (
                      <span className={cn('font-mono text-xs', samplingColors[sampling])}>
                        {t(`exposure.sampling${sampling.charAt(0).toUpperCase() + sampling.slice(1)}`)}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('exposure.recommendedSingle')}</span>
                  <span className="font-mono">{exposureCalc.recommendedSingle}s</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('exposure.recommendedTotal')}</span>
                  <span className="font-mono">{integrationCalc.recommended}m</span>
                </div>
              </CardContent>
            </Card>

            {/* Optimal Sub-Exposure */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-yellow-500" />
                  {t('exposure.optimalSubExposure')}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground">{t('exposure.aggressive')}</p>
                    <p className="text-sm font-mono font-medium">{optimalSub.aggressive}s</p>
                    <p className="text-[9px] text-muted-foreground">10%</p>
                  </div>
                  <div className="p-2 rounded-lg border border-primary bg-primary/10">
                    <p className="text-[10px] text-primary">{t('exposure.balanced')}</p>
                    <p className="text-sm font-mono font-medium">{optimalSub.balanced}s</p>
                    <p className="text-[9px] text-muted-foreground">5%</p>
                  </div>
                  <div className="p-2 rounded-lg border border-border">
                    <p className="text-[10px] text-muted-foreground">{t('exposure.conservativeSub')}</p>
                    <p className="text-sm font-mono font-medium">{optimalSub.conservative}s</p>
                    <p className="text-[9px] text-muted-foreground">2%</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t('exposure.optimalSubDescription', { readNoise: optimalSub.readNoiseUsed.toFixed(1), skyFlux: optimalSub.skyFluxPerPixel.toFixed(2) })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{t('exposure.professionalRecommendation')}</CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg border border-primary/40 bg-primary/5">
                    <p className="text-muted-foreground">{t('exposure.recommendedSubExposure')}</p>
                    <p className="font-mono text-sm font-medium">{smartExposure.recommendedExposureSec.toFixed(0)}s</p>
                  </div>
                  <div className="p-2 rounded-lg border border-border">
                    <p className="text-muted-foreground">{t('exposure.gain')}</p>
                    <p className="font-mono text-sm font-medium">{smartExposure.recommendedGain.toFixed(0)}</p>
                  </div>
                  <div className="p-2 rounded-lg border border-border">
                    <p className="text-muted-foreground">{t('exposure.usableExposureRange')}</p>
                    <p className="font-mono text-sm">
                      {smartExposure.exposureRangeSec.min.toFixed(0)}s - {smartExposure.exposureRangeSec.max.toFixed(0)}s
                    </p>
                  </div>
                  <div className="p-2 rounded-lg border border-border">
                    <p className="text-muted-foreground">{t('exposure.dynamicRange')}</p>
                    <p className="font-mono text-sm">{smartExposure.dynamicRangeStops.toFixed(1)} stops</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded border border-border">
                    <p className="text-muted-foreground">{t('exposure.readNoiseShort')}</p>
                    <p className="font-mono">{(smartExposure.noiseBreakdown.readFraction * 100).toFixed(1)}%</p>
                  </div>
                  <div className="p-2 rounded border border-border">
                    <p className="text-muted-foreground">{t('exposure.skyNoiseShort')}</p>
                    <p className="font-mono">{(smartExposure.noiseBreakdown.skyFraction * 100).toFixed(1)}%</p>
                  </div>
                  <div className="p-2 rounded border border-border">
                    <p className="text-muted-foreground">{t('exposure.darkNoiseShort')}</p>
                    <p className="font-mono">{(smartExposure.noiseBreakdown.darkFraction * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground space-y-1">
                  <p>
                    {t('exposure.recommendedGainStrategy')}: {t(`exposure.gainStrategy${smartExposure.gainStrategyUsed === 'unity' ? 'Unity' : smartExposure.gainStrategyUsed === 'max_dynamic_range' ? 'MaxDynamicRange' : 'Manual'}`)}
                  </p>
                  <p>{smartExposure.recommendedGainReason}</p>
                  <p>
                    {t('exposure.stackPlan')}: {smartExposure.stackEstimate.recommendedFrameCount} {t('exposure.subs')} ·{' '}
                    {formatDuration(smartExposure.stackEstimate.estimatedTotalMinutes)}
                  </p>
                  {smartExposure.stackEstimate.framesForTargetSNR && (
                    <p>
                      {t('exposure.framesForTargetSNR')}: {smartExposure.stackEstimate.framesForTargetSNR}
                    </p>
                  )}
                  <p>{t('exposure.framesForTimeNoise')}: {smartExposure.stackEstimate.framesForTimeNoise}</p>
                  <p>
                    {t('exposure.constraints')}: {smartExposure.constraintHits.join(', ')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Plan Summary Tab */}
          <TabsContent value="plan" className="flex-1 overflow-y-auto space-y-3 sm:space-y-4 pt-3 sm:pt-4 pr-1">
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{t('exposure.sessionSummary')}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => void handleCopy()}
                    >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('exposure.singleExposure')}</span>
                    <p className="font-mono font-medium">{exposureTime}s</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('exposure.frameCount')}</span>
                    <p className="font-mono font-medium">{frameCount}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('exposure.totalIntegration')}</span>
                    <p className="font-mono font-medium text-primary">{formatDuration(totalIntegrationMinutes)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('exposure.storageRequired')}</span>
                    <p className="font-mono font-medium">{totalStorageGB.toFixed(2)} GB</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">{t('exposure.sessionDuration')}</span>
                    <p className="font-mono font-medium">{formatDuration(sessionTime.totalMinutes)}</p>
                  </div>
                  {sessionTime.overheadMinutes > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">{t('exposure.overhead')}</span>
                      <p className="font-mono font-medium text-muted-foreground">+{formatDuration(sessionTime.overheadMinutes)}</p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{filter}</Badge>
                  <Badge variant="outline">{t('exposure.gainLabel', { value: gain })}</Badge>
                  <Badge variant="outline">{binning}</Badge>
                  <Badge variant="outline">{imageType}</Badge>
                  {ditherEnabled && (
                    <Badge variant="outline">{t('exposure.ditherLabel', { value: ditherEvery })}</Badge>
                  )}
                </div>
                
                {/* Recommendation */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    {totalIntegrationMinutes >= integrationCalc.recommended
                      ? t('exposure.meetsRecommended')
                      : t('exposure.belowRecommended', { 
                          recommended: integrationCalc.recommended,
                          current: Math.round(totalIntegrationMinutes)
                        })
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Integration Comparison */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className={cn(
                'p-2 rounded-lg border',
                totalIntegrationMinutes >= integrationCalc.minimum ? 'border-green-500/50 bg-green-500/10' : 'border-border'
              )}>
                <p className="text-[10px] text-muted-foreground">{t('exposure.minimum')}</p>
                <p className="text-sm font-mono">{integrationCalc.minimum}m</p>
              </div>
              <div className={cn(
                'p-2 rounded-lg border',
                totalIntegrationMinutes >= integrationCalc.recommended ? 'border-primary bg-primary/10' : 'border-border'
              )}>
                <p className="text-[10px] text-primary">{t('exposure.recommended')}</p>
                <p className="text-sm font-mono font-medium">{integrationCalc.recommended}m</p>
              </div>
              <div className={cn(
                'p-2 rounded-lg border',
                totalIntegrationMinutes >= integrationCalc.ideal ? 'border-purple-500/50 bg-purple-500/10' : 'border-border'
              )}>
                <p className="text-[10px] text-muted-foreground">{t('exposure.ideal')}</p>
                <p className="text-sm font-mono">{integrationCalc.ideal}m</p>
              </div>
            </div>

            {/* Multi-Filter Sequence Planner */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg border border-border hover:bg-accent/50 text-sm">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-purple-500" />
                  {t('exposure.multiFilterSequence')}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                {FILTER_SEQUENCE_PRESETS.map((preset) => {
                  const totalRatio = preset.filters.reduce((sum, f) => sum + f.ratio, 0);
                  const totalFramesForPreset = frameCount;
                  return (
                    <Card key={preset.id} className="border-border/50">
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs font-medium">{t(preset.nameKey)}</CardTitle>
                      </CardHeader>
                      <CardContent className="py-1 px-3">
                        <div className="space-y-1">
                          {preset.filters.map((f, idx) => {
                            const filterInfo = COMMON_FILTERS.find(cf => cf.id === f.filterId);
                            const filterFrames = Math.round((f.ratio / totalRatio) * totalFramesForPreset);
                            const filterMinutes = (filterFrames * exposureTime) / 60;
                            return (
                              <div key={`${f.filterId}-${idx}`} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    filterInfo?.type === 'narrowband' ? 'bg-red-500' : 'bg-blue-500'
                                  )} />
                                  <span>{filterInfo ? t(filterInfo.nameKey) : f.filterId}</span>
                                  <span className="text-muted-foreground">×{f.ratio}</span>
                                </div>
                                <span className="font-mono text-muted-foreground">
                                  {filterFrames}f · {filterMinutes.toFixed(0)}m
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="my-1.5" />
                        <div className="flex justify-between text-xs font-medium">
                          <span>{t('exposure.totalTime')}</span>
                          <span className="font-mono">{formatDuration(totalIntegrationMinutes)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        </Tabs>
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('exposure.resetDefaults')}</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          {onExposurePlanChange && (
            <Button className="flex-1" onClick={handleApply}>
              {t('exposure.applyToTarget')}
            </Button>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}


