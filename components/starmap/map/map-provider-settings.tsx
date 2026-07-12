'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Settings,
  AlertTriangle,
  Info,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SwitchItem } from '@/components/ui/switch-item';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { createLogger } from '@/lib/logger';

const logger = createLogger('map-provider-settings');
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { mapConfig, type MapConfiguration } from '@/lib/services/map-config';
import { connectivityChecker } from '@/lib/services/connectivity-checker';
import type { MapProviderType } from '@/types/starmap/map';
import { PROVIDER_REQUIRES_KEY } from '@/lib/constants/map';

interface MapProviderSettingsProps {
  trigger?: React.ReactNode;
  onSettingsChange?: (config: MapConfiguration) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}


export function MapProviderSettings({
  trigger,
  onSettingsChange,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: MapProviderSettingsProps) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  // Dynamic provider info with i18n
  const PROVIDER_INFO = useMemo(() => ({
    openstreetmap: {
      name: t('map.providerNames.openstreetmap'),
      description: t('map.providerDescriptions.openstreetmap'),
      requiresKey: PROVIDER_REQUIRES_KEY['openstreetmap'],
    },
    google: {
      name: t('map.providerNames.google'),
      description: t('map.providerDescriptions.google'),
      requiresKey: PROVIDER_REQUIRES_KEY['google'],
    },
    mapbox: {
      name: t('map.providerNames.mapbox'),
      description: t('map.providerDescriptions.mapbox'),
      requiresKey: PROVIDER_REQUIRES_KEY['mapbox'],
    },
  }), [t]);

  // Dynamic fallback strategies with i18n
  const FALLBACK_STRATEGIES = useMemo(() => [
    { value: 'priority', label: t('map.fallbackStrategies.priority'), description: t('map.fallbackStrategies.priorityDesc') },
    { value: 'fastest', label: t('map.fallbackStrategies.fastest'), description: t('map.fallbackStrategies.fastestDesc') },
    { value: 'random', label: t('map.fallbackStrategies.random'), description: t('map.fallbackStrategies.randomDesc') },
    { value: 'round-robin', label: t('map.fallbackStrategies.roundRobin'), description: t('map.fallbackStrategies.roundRobinDesc') },
  ], [t]);
  const [config, setConfig] = useState<MapConfiguration>(mapConfig.getConfiguration());
  const [hasChanges, setHasChanges] = useState(false);

  // Compute provider health status directly via useMemo
  const providerHealth = useMemo(() => {
    const healthStatus: Record<string, { healthy: boolean; responseTime: number }> = {};
    config.providers.forEach(p => {
      const health = connectivityChecker.getProviderHealth(p.provider);
      healthStatus[p.provider] = {
        healthy: health?.isHealthy ?? true,
        responseTime: health?.responseTime ?? 0,
      };
    });
    return healthStatus;
  }, [config.providers]);

  // Listen for config changes
  useEffect(() => {
    const unsubscribe = mapConfig.addConfigurationListener((newConfig) => {
      setConfig(newConfig);
    });
    return unsubscribe;
  }, []);

  const handleProviderToggle = useCallback((provider: MapProviderType, enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.provider === provider ? { ...p, enabled } : p
      ),
    }));
    setHasChanges(true);
  }, []);

  const handleProviderPriorityChange = useCallback((provider: MapProviderType, newPriority: number) => {
    setConfig(prev => ({
      ...prev,
      providers: prev.providers.map(p =>
        p.provider === provider ? { ...p, priority: newPriority } : p
      ).sort((a, b) => a.priority - b.priority),
    }));
    setHasChanges(true);
  }, []);

  const handleDefaultProviderChange = useCallback((provider: MapProviderType) => {
    setConfig(prev => ({
      ...prev,
      defaultProvider: provider,
    }));
    setHasChanges(true);
  }, []);

  const handleFallbackStrategyChange = useCallback((strategy: MapConfiguration['fallbackStrategy']) => {
    setConfig(prev => ({
      ...prev,
      fallbackStrategy: strategy,
    }));
    setHasChanges(true);
  }, []);

  const handleAutoFallbackToggle = useCallback((enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      enableAutoFallback: enabled,
    }));
    setHasChanges(true);
  }, []);

  const handleCacheToggle = useCallback((enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      cacheResponses: enabled,
    }));
    setHasChanges(true);
  }, []);

  const handleCacheDurationChange = useCallback((hours: number[]) => {
    setConfig(prev => ({
      ...prev,
      cacheDuration: hours[0] * 60 * 60 * 1000,
    }));
    setHasChanges(true);
  }, []);

  const handleOfflineModeToggle = useCallback((enabled: boolean) => {
    setConfig(prev => ({
      ...prev,
      enableOfflineMode: enabled,
    }));
    setHasChanges(true);
  }, []);

  const handleHealthCheckIntervalChange = useCallback((minutes: number[]) => {
    setConfig(prev => ({
      ...prev,
      healthCheckInterval: minutes[0] * 60 * 1000,
    }));
    setHasChanges(true);
  }, []);

  const handlePolicyModeChange = useCallback((policyMode: MapConfiguration['policyMode']) => {
    setConfig(prev => ({
      ...prev,
      policyMode,
    }));
    setHasChanges(true);
  }, []);

  const handleSearchBehaviorModeChange = useCallback((mode: MapConfiguration['searchBehaviorWhenNoAutocomplete']) => {
    setConfig(prev => ({
      ...prev,
      searchBehaviorWhenNoAutocomplete: mode,
    }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      // Apply all settings
      config.providers.forEach(p => {
        mapConfig.enableProvider(p.provider, p.enabled);
        mapConfig.setProviderPriority(p.provider, p.priority);
      });
      mapConfig.setDefaultProvider(config.defaultProvider);
      mapConfig.setFallbackStrategy(config.fallbackStrategy);
      mapConfig.setAutoFallback(config.enableAutoFallback);
      mapConfig.setCacheSettings(config.cacheResponses, config.cacheDuration);
      mapConfig.setOfflineMode(config.enableOfflineMode);
      mapConfig.setHealthCheckInterval(config.healthCheckInterval);
      mapConfig.setPolicyMode(config.policyMode);
      mapConfig.setSearchBehaviorWhenNoAutocomplete(config.searchBehaviorWhenNoAutocomplete);
      await connectivityChecker.checkAllProvidersHealth();

      toast.success(t('map.settingsSaved') || 'Settings saved');
      setHasChanges(false);
      onSettingsChange?.(config);
    } catch (error) {
      toast.error(t('map.settingsSaveFailed') || 'Failed to save settings');
      logger.error('Failed to save map settings', error);
    }
  }, [config, t, onSettingsChange]);

  const handleReset = useCallback(() => {
    setConfig(mapConfig.getConfiguration());
    setHasChanges(false);
  }, []);

  const getProviderStatusBadge = (provider: MapProviderType) => {
    const health = providerHealth[provider];
    const providerConfig = config.providers.find(p => p.provider === provider);

    if (!providerConfig?.enabled) {
      return <Badge variant="outline">{t('map.disabled') || 'Disabled'}</Badge>;
    }

    if (!health) {
      return <Badge variant="secondary">{t('map.unknown') || 'Unknown'}</Badge>;
    }

    if (health.healthy) {
      return (
        <Badge variant="default" className="bg-green-500">
          {t('map.healthy') || 'Healthy'} ({health.responseTime}ms)
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        {t('map.unhealthy') || 'Unhealthy'}
      </Badge>
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="standard-form">
      <ResponsiveDialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            {t('map.providerSettings') || 'Map Settings'}
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-lg" desktopClassName="overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('map.providerSettings') || 'Map Provider Settings'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t('map.providerSettingsDescription') || 'Configure map providers, fallback strategies, and caching options.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-6 py-4">
          {/* Providers Section */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">{t('map.providers') || 'Providers'}</h4>
            
            {config.providers.map((provider) => {
              const info = PROVIDER_INFO[provider.provider];
              return (
                <Card key={provider.provider} className={cn(!provider.enabled && 'opacity-60')}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{info.name}</span>
                            {getProviderStatusBadge(provider.provider)}
                          </div>
                          <p className="text-xs text-muted-foreground">{info.description}</p>
                          {info.requiresKey && !mapConfig.getActiveApiKey(provider.provider)?.apiKey && (
                            <div className="flex items-center gap-1 text-xs text-amber-500">
                              <AlertTriangle className="h-3 w-3" />
                              {t('map.apiKeyRequired') || 'API key required'}
                            </div>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={(checked) => handleProviderToggle(provider.provider, checked)}
                      />
                    </div>
                    
                    {provider.enabled && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{t('map.priority') || 'Priority'}</Label>
                          <Select
                            value={String(provider.priority)}
                            onValueChange={(v) => handleProviderPriorityChange(provider.provider, parseInt(v))}
                          >
                            <SelectTrigger className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3].map((p) => (
                                <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator />

          {/* Default Provider */}
          <div className="space-y-3">
            <Label>{t('map.defaultProvider') || 'Default Provider'}</Label>
            <Select
              value={config.defaultProvider}
              onValueChange={(v) => handleDefaultProviderChange(v as MapProviderType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.providers
                  .filter(p => p.enabled)
                  .map((p) => (
                    <SelectItem key={p.provider} value={p.provider}>
                      {PROVIDER_INFO[p.provider].name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Fallback Settings */}
          <div className="space-y-4">
            <SwitchItem
              label={t('map.autoFallback') || 'Auto Fallback'}
              description={t('map.autoFallbackDescription') || 'Automatically switch to backup provider on failure'}
              checked={config.enableAutoFallback}
              onCheckedChange={handleAutoFallbackToggle}
            />

            {config.enableAutoFallback && (
              <div className="space-y-3">
                <Label>{t('map.fallbackStrategy') || 'Fallback Strategy'}</Label>
                <Select
                  value={config.fallbackStrategy}
                  onValueChange={(v) => handleFallbackStrategyChange(v as MapConfiguration['fallbackStrategy'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FALLBACK_STRATEGIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <div>
                          <div>{s.label}</div>
                          <div className="text-xs text-muted-foreground">{s.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Cache Settings */}
          <div className="space-y-4">
            <SwitchItem
              label={t('map.cacheResponses') || 'Cache Responses'}
              description={t('map.cacheDescription') || 'Cache geocoding results to reduce API calls'}
              checked={config.cacheResponses}
              onCheckedChange={handleCacheToggle}
            />

            {config.cacheResponses && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('map.cacheDuration') || 'Cache Duration'}</Label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(config.cacheDuration / (60 * 60 * 1000))} {t('map.hours') || 'hours'}
                  </span>
                </div>
                <Slider
                  value={[Math.round(config.cacheDuration / (60 * 60 * 1000))]}
                  onValueChange={handleCacheDurationChange}
                  min={1}
                  max={72}
                  step={1}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Policy Settings */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>{t('map.policyMode') || 'Policy Mode'}</Label>
              <Select
                value={config.policyMode}
                onValueChange={(v) => handlePolicyModeChange(v as MapConfiguration['policyMode'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">{t('map.policyModes.strict') || 'Strict'}</SelectItem>
                  <SelectItem value="balanced">{t('map.policyModes.balanced') || 'Balanced'}</SelectItem>
                  <SelectItem value="legacy">{t('map.policyModes.legacy') || 'Legacy'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>{t('map.searchBehaviorWhenNoAutocomplete') || 'Search Behavior Without Autocomplete'}</Label>
              <Select
                value={config.searchBehaviorWhenNoAutocomplete}
                onValueChange={(v) => handleSearchBehaviorModeChange(v as MapConfiguration['searchBehaviorWhenNoAutocomplete'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submit-only">{t('map.searchFallback.submitOnly') || 'Submit only'}</SelectItem>
                  <SelectItem value="disabled">{t('map.searchFallback.disabled') || 'Disabled'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Offline Mode */}
          <SwitchItem
            label={t('map.offlineMode') || 'Offline Mode'}
            description={t('map.offlineModeDescription') || 'Use cached data when offline'}
            checked={config.enableOfflineMode}
            onCheckedChange={handleOfflineModeToggle}
          />

          <Separator />

          {/* Health Check Interval */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('map.healthCheckInterval') || 'Health Check Interval'}</Label>
              <span className="text-sm text-muted-foreground">
                {Math.round(config.healthCheckInterval / (60 * 1000))} {t('map.minutes') || 'minutes'}
              </span>
            </div>
            <Slider
              value={[Math.round(config.healthCheckInterval / (60 * 1000))]}
              onValueChange={handleHealthCheckIntervalChange}
              min={1}
              max={30}
              step={1}
            />
          </div>

          {hasChanges && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>{t('map.unsavedChanges') || 'Unsaved Changes'}</AlertTitle>
              <AlertDescription>
                {t('map.unsavedChangesDescription') || 'You have unsaved changes. Click Save to apply them.'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <ResponsiveDialogFooter className="gap-2" stickyOnMobile>
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('common.reset') || 'Reset'}
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {t('common.save') || 'Save'}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
