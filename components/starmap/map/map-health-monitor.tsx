'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { connectivityChecker, type ProviderHealthStatus, type NetworkQualityMetrics } from '@/lib/services/connectivity-checker';
import { formatResponseTime } from '@/lib/utils/map-utils';

interface MapHealthMonitorProps {
  className?: string;
  compact?: boolean;
  refreshToken?: number;
}

function MapHealthMonitorComponent({ className, compact = false, refreshToken = 0 }: MapHealthMonitorProps) {
  const t = useTranslations();
  const [providerHealth, setProviderHealth] = useState<ProviderHealthStatus[]>([]);
  const [networkQuality, setNetworkQuality] = useState<NetworkQualityMetrics | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadHealthData = useCallback(() => {
    const health = connectivityChecker.getAllProviderHealth();
    const network = connectivityChecker.getNetworkQuality();
    setProviderHealth(health);
    setNetworkQuality(network);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    // Sync initial snapshot from the connectivityChecker external singleton before
    // subscribing to further updates below. Genuine false positive for
    // set-state-in-effect: the snapshot must apply synchronously so the panel shows
    // provider health on first paint rather than a frame later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHealthData();

    const unsubscribe = connectivityChecker.addHealthListener((status) => {
      setProviderHealth(prev => {
        const index = prev.findIndex(p => p.provider === status.provider);
        if (index >= 0) {
          const newHealth = [...prev];
          newHealth[index] = status;
          return newHealth;
        }
        return [...prev, status];
      });
      setLastUpdated(new Date());
    });

    return unsubscribe;
  }, [loadHealthData]);

  useEffect(() => {
    // Re-sync from the connectivityChecker external singleton whenever the parent
    // requests a refresh via refreshToken (synchronous snapshot from an external store,
    // mirroring the initial-sync effect above).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHealthData();
  }, [refreshToken, loadHealthData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await connectivityChecker.checkAllProvidersHealth();
      loadHealthData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHealthData]);

  const getStatusIcon = (isHealthy: boolean | undefined) => {
    if (isHealthy === undefined) {
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
    return isHealthy ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  };

  const getStatusBadge = (status: ProviderHealthStatus) => {
    if (status.isHealthy) {
      return (
        <Badge variant="default" className="bg-green-500">
          {t('map.healthy') || 'Healthy'}
        </Badge>
      );
    }
    if (status.successRate > 0.5) {
      return (
        <Badge variant="secondary" className="bg-amber-500 text-white">
          {t('map.degraded') || 'Degraded'}
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        {t('map.unhealthy') || 'Unhealthy'}
      </Badge>
    );
  };


  // Memoize computed values
  const healthyCount = useMemo(() => 
    providerHealth.filter(p => p.isHealthy).length,
    [providerHealth]
  );

  const totalErrors = useMemo(() => 
    providerHealth.reduce((sum, p) => sum + p.errorCount, 0),
    [providerHealth]
  );


  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {networkQuality?.isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-destructive" />
              )}
              <span className="text-xs text-muted-foreground">
                {providerHealth.filter(p => p.isHealthy).length}/{providerHealth.length}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('map.healthyProviders') || 'Healthy providers'}: {providerHealth.filter(p => p.isHealthy).length}/{providerHealth.length}</p>
            {networkQuality && (
              <p>{t('map.avgResponseTime') || 'Avg response time'}: {formatResponseTime(networkQuality.averageResponseTime)}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('map.healthMonitor') || 'Provider Health'}
            </CardTitle>
            <CardDescription>
              {t('map.healthMonitorDescription') || 'Real-time status of map providers'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            {t('common.refresh') || 'Refresh'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {networkQuality?.isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-destructive" />
            )}
            <div>
              <p className="font-medium text-sm">
                {networkQuality?.isOnline 
                  ? (t('map.online') || 'Online')
                  : (t('map.offline') || 'Offline')}
              </p>
              {networkQuality?.effectiveConnectionType && (
                <p className="text-xs text-muted-foreground">
                  {networkQuality.effectiveConnectionType.toUpperCase()}
                  {networkQuality.downlink && ` • ${networkQuality.downlink} Mbps`}
                </p>
              )}
            </div>
          </div>
          {networkQuality && (
            <div className="text-right">
              <p className="text-sm font-medium">
                {Math.round(networkQuality.successRate * 100)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {t('map.successRate') || 'Success rate'}
              </p>
            </div>
          )}
        </div>

        {/* Provider Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('map.provider') || 'Provider'}</TableHead>
              <TableHead>{t('map.status') || 'Status'}</TableHead>
              <TableHead className="text-right">{t('map.responseTime') || 'Response'}</TableHead>
              <TableHead className="text-right">{t('map.successRate') || 'Success'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providerHealth.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  {t('map.noProviders') || 'No providers configured'}
                </TableCell>
              </TableRow>
            ) : (
              providerHealth.map((status) => (
                <TableRow key={status.provider}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status.isHealthy)}
                      <span className="capitalize">{status.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(status)}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      status.responseTime > 2000 && 'text-amber-500',
                      status.responseTime > 5000 && 'text-destructive'
                    )}>
                      {formatResponseTime(status.responseTime)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Progress 
                        value={status.successRate * 100} 
                        className="w-16 h-2"
                      />
                      <span className="text-xs w-10 text-right">
                        {Math.round(status.successRate * 100)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Statistics */}
        {networkQuality && (
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {formatResponseTime(networkQuality.averageResponseTime)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('map.avgResponse') || 'Avg Response'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {healthyCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('map.healthyCount') || 'Healthy'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {totalErrors}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('map.totalErrors') || 'Errors'}
              </p>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && (
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2">
            <Clock className="h-3 w-3" />
            {t('map.lastUpdated') || 'Last updated'}: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const MapHealthMonitor = memo(MapHealthMonitorComponent);
