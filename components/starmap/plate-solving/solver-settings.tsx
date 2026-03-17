'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import {
  Settings,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  AlertTriangle,
  HardDrive,
  Globe,
  Cpu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { SwitchItem } from '@/components/ui/switch-item';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  usePlateSolverStore,
  selectActiveSolver,
  selectCanSolve,
  selectDetectedSolversWithReadiness,
} from '@/lib/stores/plate-solver-store';
import type { SolverType, SolverInfo } from '@/lib/tauri/plate-solver-api';
import type { SolverSettingsProps } from '@/types/starmap/plate-solving';
import {
  isLocalSolver,
  formatFileSize,
  validateSolverPath,
} from '@/lib/tauri/plate-solver-api';

// Re-export types for backward compatibility
export type { SolverSettingsProps } from '@/types/starmap/plate-solving';

// ============================================================================
// Inline helpers to reduce repeated form patterns
// ============================================================================

function SliderField({ label, value, displayValue, onChange, min, max, step }: {
  label: string;
  value: number;
  displayValue: string;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm text-muted-foreground">{displayValue}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}


// ============================================================================
// Component
// ============================================================================

export function SolverSettings({ onClose, className }: SolverSettingsProps) {
  const t = useTranslations();
  const {
    isDetecting,
    detectionError,
    config,
    onlineApiKey,
    detectSolvers,
    setConfig,
    saveConfig,
    loadConfig,
    setOnlineApiKey,
  } = usePlateSolverStore();
  const detectedSolvers = usePlateSolverStore(selectDetectedSolversWithReadiness);

  const activeSolver = usePlateSolverStore(selectActiveSolver);
  const canSolve = usePlateSolverStore(selectCanSolve);

  const [customPath, setCustomPath] = useState(config.executable_path || '');
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  // Detect solvers on mount
  useEffect(() => {
    if (detectedSolvers.length === 0) {
      detectSolvers();
    }
    void loadConfig();
  }, [detectedSolvers.length, detectSolvers, loadConfig]);

  // Validate custom path
  const handleValidatePath = useCallback(async () => {
    if (!customPath) {
      setPathValid(null);
      return;
    }

    setIsValidatingPath(true);
    try {
      const valid = await validateSolverPath(config.solver_type, customPath);
      setPathValid(valid);
      if (valid) {
        setConfig({ executable_path: customPath });
      }
    } catch (_error) {
      setPathValid(false);
    } finally {
      setIsValidatingPath(false);
    }
  }, [customPath, config.solver_type, setConfig]);

  // Handle solver type change
  const handleSolverChange = useCallback(
    (value: string) => {
      setConfig({ solver_type: value as SolverType });
      setCustomPath('');
      setPathValid(null);
    },
    [setConfig]
  );

  // Save settings
  const handleSave = useCallback(async () => {
    await saveConfig();
    onClose?.();
  }, [saveConfig, onClose]);

  // Get solver icon
  const getSolverIcon = (solver: SolverInfo) => {
    if (solver.solver_type === 'astrometry_net_online') {
      return <Globe className="h-4 w-4" />;
    }
    return <Cpu className="h-4 w-4" />;
  };

  // Get status badge
  const getStatusBadge = (solver: SolverInfo) => {
    if (solver.solver_type === 'astrometry_net_online') {
      return (
        <Badge variant="secondary" className="text-xs">
          {t('plateSolving.online')}
        </Badge>
      );
    }
    if (solver.is_available) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          {t('plateSolving.installed')}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-xs">
        <XCircle className="h-3 w-3 mr-1" />
        {t('plateSolving.notInstalled')}
      </Badge>
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Solver Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t('plateSolving.solverSelection')}
          </CardTitle>
          <CardDescription>
            {t('plateSolving.solverSelectionDesc') ||
              'Choose which plate solver to use'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={detectSolvers}
              disabled={isDetecting}
            >
              {isDetecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('plateSolving.detectSolvers')}
            </Button>
          </div>

          {detectionError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{detectionError}</AlertDescription>
            </Alert>
          )}

          {/* Solver List */}
          <div className="space-y-2">
            {detectedSolvers.length === 0 && !isDetecting && !detectionError && (
              <div className="text-sm text-muted-foreground text-center py-6">
                {t('plateSolving.noSolversDetected')}
              </div>
            )}
            {detectedSolvers.map((solver) => (
              <div
                key={solver.solver_type}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                  config.solver_type === solver.solver_type
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                )}
                onClick={() => handleSolverChange(solver.solver_type)}
                role="button"
                tabIndex={0}
                aria-pressed={config.solver_type === solver.solver_type}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSolverChange(solver.solver_type);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  {getSolverIcon(solver)}
                  <div>
                    <div className="font-medium">{solver.name}</div>
                    {solver.profile_name && solver.profile_name !== solver.name && (
                      <div className="text-xs text-muted-foreground">
                        {solver.profile_name}
                      </div>
                    )}
                    {solver.version && (
                      <div className="text-xs text-muted-foreground">
                        {solver.version}
                      </div>
                    )}
                    {solver.availability_reason && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        {solver.availability_reason}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(solver)}
                  {config.solver_type === solver.solver_type && (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Custom Path (for local solvers) */}
          {isLocalSolver(config.solver_type) && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>
                  {t('plateSolving.customPath')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={customPath}
                    onChange={(e) => {
                      setCustomPath(e.target.value);
                      setPathValid(null);
                    }}
                    placeholder={
                      activeSolver?.executable_path ||
                      t('plateSolving.pathPlaceholder')
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    onClick={handleValidatePath}
                    disabled={!customPath || isValidatingPath}
                  >
                    {isValidatingPath ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pathValid === true ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : pathValid === false ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      t('plateSolving.validate')
                    )}
                  </Button>
                </div>
                {pathValid === false && (
                  <p className="text-xs text-red-500">
                    {t('plateSolving.invalidPath')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Online API Key */}
          {config.solver_type === 'astrometry_net_online' && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  {t('plateSolving.apiKey')}
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={onlineApiKey}
                  onChange={(e) => setOnlineApiKey(e.target.value)}
                  placeholder={
                    t('plateSolving.apiKeyPlaceholder')
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {t('plateSolving.apiKeyHint') ||
                    'Get your free API key at nova.astrometry.net'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Solver Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t('plateSolving.solverOptions')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SliderField
            label={t('plateSolving.timeout')}
            value={config.timeout_seconds}
            displayValue={`${config.timeout_seconds}s`}
            onChange={(value) => setConfig({ timeout_seconds: value })}
            min={30} max={300} step={10}
          />
          <SliderField
            label={t('plateSolving.downsample')}
            value={config.downsample}
            displayValue={config.downsample === 0 ? t('plateSolving.auto') : `${config.downsample}x`}
            onChange={(value) => setConfig({ downsample: value })}
            min={0} max={4} step={1}
          />
          <SliderField
            label={t('plateSolving.searchRadius')}
            value={config.search_radius}
            displayValue={`${config.search_radius}°`}
            onChange={(value) => setConfig({ search_radius: value })}
            min={5} max={180} step={5}
          />

          {/* Use SIP */}
          {isLocalSolver(config.solver_type) && (
            <SwitchItem
              label={t('plateSolving.useSip')}
              description={t('plateSolving.useSipDesc') || 'Add polynomial distortion correction'}
              checked={config.use_sip}
              onCheckedChange={(checked) => setConfig({ use_sip: checked })}
            />
          )}

          {/* ASTAP-specific options */}
          {config.solver_type === 'astap' && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  {t('plateSolving.astapOptions')}
                </h4>

                <SliderField
                  label={t('plateSolving.maxStars')}
                  value={config.astap_max_stars}
                  displayValue={`${config.astap_max_stars}`}
                  onChange={(value) => setConfig({ astap_max_stars: value })}
                  min={100} max={1000} step={50}
                />
                <SliderField
                  label={t('plateSolving.tolerance')}
                  value={config.astap_tolerance * 1000}
                  displayValue={config.astap_tolerance.toFixed(4)}
                  onChange={(value) => setConfig({ astap_tolerance: value / 1000 })}
                  min={1} max={20} step={1}
                />
                <SliderField
                  label={t('plateSolving.minStarSize')}
                  value={config.astap_min_star_size * 10}
                  displayValue={`${config.astap_min_star_size.toFixed(1)}"`}
                  onChange={(value) => setConfig({ astap_min_star_size: value / 10 })}
                  min={5} max={50} step={5}
                />
                <SwitchItem
                  label={t('plateSolving.equaliseBackground')}
                  description={t('plateSolving.equaliseBackgroundDesc') || 'For images with gradient backgrounds'}
                  checked={config.astap_equalise_background}
                  onCheckedChange={(checked) => setConfig({ astap_equalise_background: checked })}
                />
              </div>
            </>
          )}

          {/* Astrometry.net-specific options */}
          {config.solver_type === 'astrometry_net' && (
            <>
              <Separator className="my-4" />
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  {t('plateSolving.astrometryOptions') || 'Astrometry.net Options'}
                </h4>

                {/* Scale Low */}
                <div className="space-y-2">
                  <Label>
                    {t('plateSolving.scaleLow') || 'Scale Low'}
                  </Label>
                  <Input
                    type="number"
                    value={config.astrometry_scale_low ?? ''}
                    onChange={(e) => setConfig({ 
                      astrometry_scale_low: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    placeholder={t('plateSolving.auto') || 'Auto'}
                    step={0.1}
                  />
                </div>

                {/* Scale High */}
                <div className="space-y-2">
                  <Label>
                    {t('plateSolving.scaleHigh') || 'Scale High'}
                  </Label>
                  <Input
                    type="number"
                    value={config.astrometry_scale_high ?? ''}
                    onChange={(e) => setConfig({ 
                      astrometry_scale_high: e.target.value ? parseFloat(e.target.value) : null 
                    })}
                    placeholder={t('plateSolving.auto') || 'Auto'}
                    step={0.1}
                  />
                </div>

                <SwitchItem
                  label={t('plateSolving.skipVerify') || 'Skip Verification'}
                  description={t('plateSolving.skipVerifyDesc') || 'Faster but may reduce accuracy'}
                  checked={config.astrometry_no_verify}
                  onCheckedChange={(checked) => setConfig({ astrometry_no_verify: checked })}
                />
                <SwitchItem
                  label={t('plateSolving.crpixCenter') || 'Center Reference Pixel'}
                  description={t('plateSolving.crpixCenterDesc') || 'Set reference point to image center'}
                  checked={config.astrometry_crpix_center}
                  onCheckedChange={(checked) => setConfig({ astrometry_crpix_center: checked })}
                />
              </div>
            </>
          )}

          {/* General Options */}
          <Separator className="my-4" />
          <div className="space-y-4">
            <h4 className="text-sm font-medium">
              {t('plateSolving.generalOptions') || 'General Options'}
            </h4>

            <SwitchItem
              label={t('plateSolving.autoHints') || 'Auto Position Hints'}
              description={t('plateSolving.autoHintsDesc') || 'Use current view position as hint'}
              checked={config.auto_hints}
              onCheckedChange={(checked) => setConfig({ auto_hints: checked })}
            />
            <SwitchItem
              label={t('plateSolving.keepWcs') || 'Keep WCS File'}
              description={t('plateSolving.keepWcsDesc') || 'Save WCS output for later use'}
              checked={config.keep_wcs_file}
              onCheckedChange={(checked) => setConfig({ keep_wcs_file: checked })}
            />
            <SwitchItem
              label={t('plateSolving.retryOnFailure') || 'Retry on Failure'}
              description={t('plateSolving.retryOnFailureDesc') || 'Retry with different settings'}
              checked={config.retry_on_failure}
              onCheckedChange={(checked) => setConfig({ retry_on_failure: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Index Status */}
      {activeSolver && isLocalSolver(config.solver_type) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              {t('plateSolving.indexStatus') || 'Index Files'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSolver.installed_indexes.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm">
                  {activeSolver.installed_indexes.length}{' '}
                  {t('plateSolving.indexesInstalled') || 'index files installed'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('plateSolving.totalSize') || 'Total size'}:{' '}
                  {formatFileSize(
                    activeSolver.installed_indexes.reduce(
                      (sum, idx) => sum + idx.size_bytes,
                      0
                    )
                  )}
                </div>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {t('plateSolving.noIndexes') ||
                    'No index files found. Download indexes to use this solver.'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {!canSolve && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {config.solver_type === 'astrometry_net_online'
              ? (
                activeSolver?.availability_reason
                ?? t('plateSolving.needApiKey')
                ?? 'API key required for online solving'
              )
              : t('plateSolving.solverNotReady') ||
                'Solver is not ready. Check installation and index files.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel') || 'Cancel'}
          </Button>
        )}
        <Button onClick={handleSave}>
          {t('common.save') || 'Save'}
        </Button>
      </div>
    </div>
  );
}

export default SolverSettings;
