'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
  ResponsiveDialogFooter,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  Settings2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Clock,
  Compass,
  Target,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMountStore } from '@/lib/stores';
import { useTargetListStore } from '@/lib/stores/target-list-store';
import { degreesToHMS, degreesToDMS } from '@/lib/astronomy/starmap-utils';
import {
  calculateTwilightTimes,
} from '@/lib/astronomy/astro-utils';
import { optimizeSchedule } from '@/lib/astronomy/session-scheduler';
import {
  type MountType,
  type MountSafetyConfig,
  type SafetyIssueSeverity,
} from '@/lib/astronomy/mount-safety';
import {
  simulateSequence,
  type SimulationResult,
  type SimulationTarget,
} from '@/lib/astronomy/mount-simulator';
import type { OptimizationStrategy } from '@/types/starmap/planning';

// ============================================================================
// Helper Components
// ============================================================================

function SeverityIcon({ severity }: { severity: SafetyIssueSeverity }) {
  switch (severity) {
    case 'danger':
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-400 shrink-0" />;
  }
}

function SeverityBadge({ severity, count }: { severity: SafetyIssueSeverity; count: number }) {
  const colorMap = {
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <Badge variant="outline" className={cn('text-xs', colorMap[severity])}>
      {count}
    </Badge>
  );
}

function OverallStatusIcon({ result }: { result: SimulationResult }) {
  if (result.summary.dangers > 0) {
    return <ShieldX className="h-6 w-6 text-red-500" />;
  }
  if (result.summary.warnings > 0) {
    return <ShieldAlert className="h-6 w-6 text-amber-500" />;
  }
  return <ShieldCheck className="h-6 w-6 text-green-500" />;
}

// ============================================================================
// Mount Config Panel
// ============================================================================

interface ConfigPanelProps {
  config: MountSafetyConfig;
  onConfigChange: (config: Partial<MountSafetyConfig>) => void;
  onReset: () => void;
}

function MountConfigPanel({ config, onConfigChange, onReset }: ConfigPanelProps) {
  const t = useTranslations('mountSafety');

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between" size="sm">
          <span className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            {t('config.title')}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3 px-1">
        {/* Mount Type */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('config.mountType')}</Label>
            <Select
              value={config.mountType}
              onValueChange={(v) => onConfigChange({ mountType: v as MountType })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gem">{t('config.mountTypeGem')}</SelectItem>
                <SelectItem value="fork">{t('config.mountTypeFork')}</SelectItem>
                <SelectItem value="altaz">{t('config.mountTypeAltaz')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('config.minAltitude')}: {config.minAltitude}°
            </Label>
            <Slider
              value={[config.minAltitude]}
              onValueChange={([v]) => onConfigChange({ minAltitude: v })}
              min={0}
              max={45}
              step={1}
            />
          </div>
        </div>

        {/* HA Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('config.haLimitEast')}: {config.hourAngleLimitEast}°
            </Label>
            <Slider
              value={[config.hourAngleLimitEast]}
              onValueChange={([v]) => onConfigChange({ hourAngleLimitEast: v })}
              min={-180}
              max={0}
              step={5}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('config.haLimitWest')}: {config.hourAngleLimitWest}°
            </Label>
            <Slider
              value={[config.hourAngleLimitWest]}
              onValueChange={([v]) => onConfigChange({ hourAngleLimitWest: v })}
              min={0}
              max={180}
              step={5}
            />
          </div>
        </div>

        {/* Dec Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('config.decLimitMin')}: {config.declinationLimitMin}°
            </Label>
            <Input
              type="number"
              value={config.declinationLimitMin}
              onChange={(e) =>
                onConfigChange({ declinationLimitMin: Number(e.target.value) })
              }
              className="h-8"
              min={-90}
              max={0}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">
              {t('config.decLimitMax')}: {config.declinationLimitMax}°
            </Label>
            <Input
              type="number"
              value={config.declinationLimitMax}
              onChange={(e) =>
                onConfigChange({ declinationLimitMax: Number(e.target.value) })
              }
              className="h-8"
              min={0}
              max={90}
            />
          </div>
        </div>

        {/* Meridian Flip (GEM only) */}
        {config.mountType === 'gem' && (
          <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{t('config.meridianFlip')}</Label>
              <Switch
                checked={config.meridianFlip.enabled}
                onCheckedChange={(enabled) =>
                  onConfigChange({
                    meridianFlip: { ...config.meridianFlip, enabled },
                  })
                }
              />
            </div>
            {config.meridianFlip.enabled && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    {t('config.flipAfter')}
                  </Label>
                  <Input
                    type="number"
                    value={config.meridianFlip.minutesAfterMeridian}
                    onChange={(e) =>
                      onConfigChange({
                        meridianFlip: {
                          ...config.meridianFlip,
                          minutesAfterMeridian: Number(e.target.value),
                        },
                      })
                    }
                    className="h-7 text-xs"
                    min={0}
                    max={60}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    {t('config.flipMax')}
                  </Label>
                  <Input
                    type="number"
                    value={config.meridianFlip.maxMinutesAfterMeridian}
                    onChange={(e) =>
                      onConfigChange({
                        meridianFlip: {
                          ...config.meridianFlip,
                          maxMinutesAfterMeridian: Number(e.target.value),
                        },
                      })
                    }
                    className="h-7 text-xs"
                    min={0}
                    max={120}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    {t('config.flipPause')}
                  </Label>
                  <Input
                    type="number"
                    value={config.meridianFlip.pauseBeforeMeridian}
                    onChange={(e) =>
                      onConfigChange({
                        meridianFlip: {
                          ...config.meridianFlip,
                          pauseBeforeMeridian: Number(e.target.value),
                        },
                      })
                    }
                    className="h-7 text-xs"
                    min={0}
                    max={30}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Telescope Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('config.tubeLength')}</Label>
            <Input
              type="number"
              value={config.telescopeLength}
              onChange={(e) =>
                onConfigChange({ telescopeLength: Number(e.target.value) })
              }
              className="h-8"
              min={100}
              max={3000}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('config.cwBarLength')}</Label>
            <Input
              type="number"
              value={config.counterweightBarLength}
              onChange={(e) =>
                onConfigChange({
                  counterweightBarLength: Number(e.target.value),
                })
              }
              className="h-8"
              min={100}
              max={1000}
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3 mr-1.5" />
          {t('config.reset')}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Target Safety Card
// ============================================================================

interface TargetSafetyCardProps {
  check: import('@/lib/astronomy/mount-safety').TargetSafetyCheck;
}

function TargetSafetyCard({ check }: TargetSafetyCardProps) {
  const t = useTranslations('mountSafety');

  const dangerCount = check.issues.filter((i) => i.severity === 'danger').length;
  const warningCount = check.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = check.issues.filter((i) => i.severity === 'info').length;

  const statusIcon = dangerCount > 0 ? (
    <XCircle className="h-4 w-4 text-red-500" />
  ) : warningCount > 0 ? (
    <AlertTriangle className="h-4 w-4 text-amber-500" />
  ) : (
    <CheckCircle2 className="h-4 w-4 text-green-500" />
  );

  const borderColor = dangerCount > 0
    ? 'border-red-500/30 bg-red-500/5'
    : warningCount > 0
      ? 'border-amber-500/30 bg-amber-500/5'
      : 'border-green-500/30 bg-green-500/5';

  return (
    <Collapsible>
      <div className={cn('border rounded-lg p-3 transition-colors', borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {statusIcon}
            <div>
              <div className="font-medium text-sm">{check.targetName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-mono">{degreesToHMS(check.ra)}</span>
                <span className="font-mono">{degreesToDMS(check.dec)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {dangerCount > 0 && <SeverityBadge severity="danger" count={dangerCount} />}
            {warningCount > 0 && <SeverityBadge severity="warning" count={warningCount} />}
            {infoCount > 0 && <SeverityBadge severity="info" count={infoCount} />}
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 [&[data-state=open]>svg]:rotate-180"
              >
                <ChevronDown className="h-3.5 w-3.5 transition-transform" />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Compass className="h-3 w-3" />
            HA: {check.hourAngleAtStart.toFixed(1)}° → {check.hourAngleAtEnd.toFixed(1)}°
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Alt: {check.minAltitude.toFixed(0)}° – {check.maxAltitude.toFixed(0)}°
          </span>
          <span>
            {t('results.pierSide')}: {check.pierSideAtStart}
            {check.pierSideAtStart !== check.pierSideAtEnd && ` → ${check.pierSideAtEnd}`}
          </span>
          {check.needsMeridianFlip && (
            <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
              {t('results.flipNeeded')}
            </Badge>
          )}
        </div>

        {/* Expanded issues */}
        <CollapsibleContent>
          {check.issues.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {check.issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <SeverityIcon severity={issue.severity} />
                  <div className="space-y-0.5">
                    <p>{t(issue.descriptionKey, issue.descriptionParams)}</p>
                    <p className="text-muted-foreground">
                      {t(issue.suggestionKey, issue.suggestionParams)}
                    </p>
                    {issue.time && (
                      <p className="text-muted-foreground/70">
                        <Clock className="h-2.5 w-2.5 inline mr-1" />
                        {issue.time.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-border text-xs text-green-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t('results.allClear')}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Slew Safety Card
// ============================================================================

interface SlewCardProps {
  slew: import('@/lib/astronomy/mount-simulator').SlewEvent;
}

function SlewCard({ slew }: SlewCardProps) {
  const t = useTranslations('mountSafety');

  if (slew.issues.length === 0 && !slew.hasMeridianFlip) return null;

  return (
    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted/30 border border-border/50">
      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">
        {slew.fromTargetName} → {slew.toTargetName}
      </span>
      <span className="text-muted-foreground/70">
        ({slew.totalAngle.toFixed(1)}° / ~{Math.ceil(slew.estimatedDuration)}s)
      </span>
      {slew.hasMeridianFlip && (
        <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
          {t('results.flipDuringSlew')}
        </Badge>
      )}
      {slew.issues
        .filter((i) => i.type !== 'meridian_flip')
        .map((issue, i) => (
          <span key={i} className="flex items-center gap-1">
            <SeverityIcon severity={issue.severity} />
            {t(issue.descriptionKey, issue.descriptionParams)}
          </span>
        ))}
    </div>
  );
}

// ============================================================================
// Polar Safety Diagram (HA vs Dec)
// ============================================================================

interface PolarDiagramProps {
  result: SimulationResult;
  config: MountSafetyConfig;
}

function PolarSafetyDiagram({ result, config }: PolarDiagramProps) {
  const t = useTranslations('mountSafety');
  const width = 320;
  const height = 200;
  const pad = 30;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  // Map HA (-180..180) to x, Dec (-90..90) to y
  const haToX = (ha: number) => pad + ((ha + 180) / 360) * plotW;
  const decToY = (dec: number) => pad + ((90 - dec) / 180) * plotH;

  // Target colors
  const colors = [
    '#3b82f6', '#22c55e', '#a855f7', '#f59e0b',
    '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  ];

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium flex items-center gap-2">
        <Compass className="h-4 w-4" />
        {t('diagram.title')}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full border rounded-lg bg-muted/30"
        style={{ maxHeight: 200 }}
      >
        {/* Grid */}
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="currentColor" strokeOpacity={0.1} />
        <line x1={width - pad} y1={pad} x2={width - pad} y2={height - pad} stroke="currentColor" strokeOpacity={0.1} />
        <line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke="currentColor" strokeOpacity={0.1} />
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="currentColor" strokeOpacity={0.1} />

        {/* Meridian line (HA=0) */}
        <line
          x1={haToX(0)}
          y1={pad}
          x2={haToX(0)}
          y2={height - pad}
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          opacity={0.6}
        />
        <text
          x={haToX(0)}
          y={pad - 5}
          textAnchor="middle"
          fontSize={8}
          fill="#ef4444"
          opacity={0.8}
        >
          {t('diagram.meridian')}
        </text>

        {/* HA limit zones (danger areas) */}
        <rect
          x={pad}
          y={pad}
          width={haToX(config.hourAngleLimitEast) - pad}
          height={plotH}
          fill="#ef4444"
          opacity={0.08}
        />
        <rect
          x={haToX(config.hourAngleLimitWest)}
          y={pad}
          width={width - pad - haToX(config.hourAngleLimitWest)}
          height={plotH}
          fill="#ef4444"
          opacity={0.08}
        />

        {/* HA limit lines */}
        <line
          x1={haToX(config.hourAngleLimitEast)}
          y1={pad}
          x2={haToX(config.hourAngleLimitEast)}
          y2={height - pad}
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />
        <line
          x1={haToX(config.hourAngleLimitWest)}
          y1={pad}
          x2={haToX(config.hourAngleLimitWest)}
          y2={height - pad}
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.4}
        />

        {/* Dec limit zones */}
        <rect
          x={pad}
          y={pad}
          width={plotW}
          height={decToY(config.declinationLimitMax) - pad}
          fill="#f59e0b"
          opacity={0.06}
        />
        <rect
          x={pad}
          y={decToY(config.declinationLimitMin)}
          width={plotW}
          height={height - pad - decToY(config.declinationLimitMin)}
          fill="#f59e0b"
          opacity={0.06}
        />

        {/* Target positions (HA at start and end) */}
        {result.targets.map((tc, i) => {
          const color = colors[i % colors.length];
          const x1 = haToX(tc.hourAngleAtStart);
          const x2 = haToX(tc.hourAngleAtEnd);
          const y = decToY(tc.dec);

          return (
            <g key={tc.targetId}>
              {/* Track line */}
              <line
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={color}
                strokeWidth={2}
                opacity={0.7}
              />
              {/* Start dot */}
              <circle cx={x1} cy={y} r={3} fill={color} />
              {/* End dot */}
              <circle cx={x2} cy={y} r={3} fill={color} stroke="white" strokeWidth={0.5} />
              {/* Label */}
              <text
                x={Math.min(x1, x2) + Math.abs(x2 - x1) / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={7}
                fill={color}
              >
                {tc.targetName.length > 10
                  ? tc.targetName.slice(0, 10) + '…'
                  : tc.targetName}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text x={pad} y={height - 5} fontSize={8} fill="currentColor" opacity={0.5}>
          E -180°
        </text>
        <text x={width - pad} y={height - 5} fontSize={8} fill="currentColor" opacity={0.5} textAnchor="end">
          W +180°
        </text>
        <text x={5} y={pad + 4} fontSize={8} fill="currentColor" opacity={0.5}>
          +90°
        </text>
        <text x={5} y={height - pad} fontSize={8} fill="currentColor" opacity={0.5}>
          -90°
        </text>
        <text x={width / 2} y={height - 3} fontSize={8} fill="currentColor" opacity={0.5} textAnchor="middle">
          {t('diagram.hourAngle')}
        </text>
      </svg>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface MountSafetySimulatorProps {
  planDate?: Date;
  strategy?: OptimizationStrategy;
  minAltitude?: number;
  minImagingTime?: number;
}

export function MountSafetySimulator({
  planDate: planDateProp,
  strategy = 'balanced',
  minAltitude = 30,
  minImagingTime = 30,
}: MountSafetySimulatorProps) {
  const t = useTranslations('mountSafety');
  const [open, setOpen] = useState(false);
  // Stable fallback date — a `planDate = new Date()` default prop would be a
  // new object every render and recompute the plan + simulation each time.
  const [defaultPlanDate] = useState(() => new Date());
  const planDate = planDateProp ?? defaultPlanDate;

  const profileInfo = useMountStore((state) => state.profileInfo);
  const safetyConfig = useMountStore((state) => state.safetyConfig);
  const setSafetyConfig = useMountStore((state) => state.setSafetyConfig);
  const resetSafetyConfig = useMountStore((state) => state.resetSafetyConfig);

  const targets = useTargetListStore((state) => state.targets);

  const latitude = profileInfo.AstrometrySettings.Latitude ?? 0;
  const longitude = profileInfo.AstrometrySettings.Longitude ?? 0;

  // Active (non-archived, non-completed) targets
  const activeTargets = useMemo(
    () => targets.filter((t) => !t.isArchived && t.status !== 'completed'),
    [targets]
  );

  // Calculate twilight and generate optimized schedule
  const twilight = useMemo(
    () => calculateTwilightTimes(latitude, longitude, planDate),
    [latitude, longitude, planDate]
  );

  const plan = useMemo(
    () =>
      optimizeSchedule(
        activeTargets,
        latitude,
        longitude,
        twilight,
        strategy,
        minAltitude,
        minImagingTime,
        planDate
      ),
    [activeTargets, latitude, longitude, twilight, strategy, minAltitude, minImagingTime, planDate]
  );

  // Convert scheduled targets to simulation targets
  const simTargets = useMemo((): SimulationTarget[] => {
    return plan.targets.map((st) => ({
      id: st.target.id,
      name: st.target.name,
      ra: st.target.ra,
      dec: st.target.dec,
      startTime: st.startTime,
      endTime: st.endTime,
      exposureDuration: st.target.exposurePlan?.singleExposure,
    }));
  }, [plan.targets]);

  // Run simulation
  const simulationResult = useMemo((): SimulationResult => {
    if (simTargets.length === 0) {
      return {
        targets: [],
        slews: [],
        allIssues: [],
        overallSafe: true,
        totalMeridianFlips: 0,
        totalSlewTime: 0,
        cumulativeRotation: 0,
        cableWrapRisk: false,
        summary: { safe: 0, warnings: 0, dangers: 0 },
      };
    }
    return simulateSequence(simTargets, safetyConfig, latitude, longitude);
  }, [simTargets, safetyConfig, latitude, longitude]);

  const handleConfigChange = useCallback(
    (config: Partial<MountSafetyConfig>) => {
      setSafetyConfig(config);
    },
    [setSafetyConfig]
  );

  return (
    <ResponsiveDialog tier="complex-editor" open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 gap-1.5 text-xs',
                simulationResult.summary.dangers > 0 && 'text-red-400',
                simulationResult.summary.dangers === 0 &&
                  simulationResult.summary.warnings > 0 &&
                  'text-amber-400'
              )}
            >
              {simulationResult.summary.dangers > 0 ? (
                <ShieldX className="h-3.5 w-3.5" />
              ) : simulationResult.summary.warnings > 0 ? (
                <ShieldAlert className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              {t('trigger')}
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('triggerTooltip')}</p>
        </TooltipContent>
      </Tooltip>

      <ResponsiveDialogContent desktopClassName="sm:max-w-2xl overflow-hidden flex flex-col">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <OverallStatusIcon result={simulationResult} />
            {t('title')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Summary */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-sm">{simulationResult.summary.safe} {t('results.safe')}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm">{simulationResult.summary.warnings} {t('results.warnings')}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm">{simulationResult.summary.dangers} {t('results.dangers')}</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span>
              {t('results.flips')}: {simulationResult.totalMeridianFlips}
            </span>
            <span>
              {t('results.slewTime')}: {Math.ceil(simulationResult.totalSlewTime)}s
            </span>
            {simulationResult.cableWrapRisk && (
              <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                {t('results.cableWrapRisk')}
              </Badge>
            )}
          </div>
        </div>

        {/* Mount Configuration */}
        <MountConfigPanel
          config={safetyConfig}
          onConfigChange={handleConfigChange}
          onReset={resetSafetyConfig}
        />

        <Separator />

        {/* Polar Diagram */}
        {simulationResult.targets.length > 0 && (
          <PolarSafetyDiagram result={simulationResult} config={safetyConfig} />
        )}

        {/* Target Safety List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-4">
            {simulationResult.targets.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 space-y-2">
                <ShieldCheck className="h-8 w-8 mx-auto opacity-50" />
                <p className="text-sm">{t('results.noTargets')}</p>
                <p className="text-xs">{t('results.noTargetsHint')}</p>
              </div>
            ) : (
              <>
                {simulationResult.targets.map((check, i) => (
                  <div key={check.targetId}>
                    <TargetSafetyCard check={check} />
                    {/* Show slew between this and next target */}
                    {i < simulationResult.slews.length && (
                      <SlewCard slew={simulationResult.slews[i]} />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
