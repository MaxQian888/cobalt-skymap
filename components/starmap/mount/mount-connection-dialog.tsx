'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Wifi, WifiOff, Radio, Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

import { useMountStore } from '@/lib/stores';
import { mountApi, type DiscoveredDevice } from '@/lib/tauri/mount-api';
import { isTauri } from '@/lib/tauri/app-control-api';
import { createLogger } from '@/lib/logger';
import type { MountProtocol } from '@/lib/core/types';
import { PRIMARY_MOUNT_DEVICE_PROFILE_ID, useDeviceStore } from '@/lib/stores/device-store';
import {
  buildSupportedMountDeviceId,
  createSimulatorMountDevice,
} from '@/lib/core/mount-support';

const logger = createLogger('mount-connection');

interface MountConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MountConnectionDialog({ open, onOpenChange }: MountConnectionDialogProps) {
  const t = useTranslations('mount');
  const connectionProtocol = useMountStore((s) => s.connectionConfig.protocol);
  const connectionHost = useMountStore((s) => s.connectionConfig.host);
  const connectionPort = useMountStore((s) => s.connectionConfig.port);
  const connectionDeviceId = useMountStore((s) => s.connectionConfig.deviceId);
  const connectionSelectedDeviceId = useMountStore((s) => s.connectionConfig.selectedDeviceId);
  const selectedDevice = useMountStore((s) => s.selectedDevice);
  const setConnectionConfig = useMountStore((s) => s.setConnectionConfig);
  const setCapabilities = useMountStore((s) => s.setCapabilities);
  const setSelectedDevice = useMountStore((s) => s.setSelectedDevice);
  const setCapabilitySnapshot = useMountStore((s) => s.setCapabilitySnapshot);
  const applyMountState = useMountStore((s) => s.applyMountState);
  const resetMountInfo = useMountStore((s) => s.resetMountInfo);
  const connected = useMountStore((s) => s.mountInfo.Connected);
  const beginConnection = useDeviceStore((s) => s.beginConnection);
  const markConnected = useDeviceStore((s) => s.markConnected);
  const markFailed = useDeviceStore((s) => s.markFailed);
  const disconnectConnection = useDeviceStore((s) => s.disconnectConnection);
  const retryConnection = useDeviceStore((s) => s.retryConnection);
  const syncFromMountStore = useDeviceStore((s) => s.syncFromMountStore);
  const mountConnectionState = useDeviceStore((s) => s.connections[PRIMARY_MOUNT_DEVICE_PROFILE_ID]);
  const mountDiagnostics = useDeviceStore((s) => s.diagnostics[PRIMARY_MOUNT_DEVICE_PROFILE_ID]);

  const [protocol, setProtocol] = useState<MountProtocol>(connectionProtocol);
  const [host, setHost] = useState(connectionHost);
  const [port, setPort] = useState(String(connectionPort));
  const [deviceId, setDeviceId] = useState(String(connectionDeviceId));
  const [connecting, setConnecting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [selectedDiscoveredDevice, setSelectedDiscoveredDevice] = useState<DiscoveredDevice | null>(null);
  const [error, setError] = useState('');

  // Reset local state to store values when dialog opens
  useEffect(() => {
    if (open && !connected) {
      // Re-seed local editable form state from the store only when the dialog opens.
      // Genuine false positive for set-state-in-effect: the seed must apply synchronously
      // so the form shows the store values before paint (connectionProtocol/host/port/
      // deviceId can change independently while the dialog is closed).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProtocol(connectionProtocol);
      setHost(connectionHost);
      setPort(String(connectionPort));
      setDeviceId(String(connectionDeviceId));
      setSelectedDiscoveredDevice(
        selectedDevice && selectedDevice.protocol === connectionProtocol
          ? selectedDevice
          : null,
      );
      setError('');
      setDevices([]);
    }
  }, [connected, connectionDeviceId, connectionHost, connectionPort, connectionProtocol, open, selectedDevice]);

  useEffect(() => {
    syncFromMountStore({
      connected,
      protocol: connectionProtocol,
      host: connectionHost,
      port: connectionPort,
      deviceId: connectionDeviceId,
      selectedDeviceId: connectionSelectedDeviceId,
      selectedDevice: selectedDevice ?? undefined,
    });
  }, [
    connected,
    connectionDeviceId,
    connectionHost,
    connectionPort,
    connectionSelectedDeviceId,
    connectionProtocol,
    selectedDevice,
    syncFromMountStore,
  ]);

  const parsedPort = parseInt(port, 10);
  const parsedDeviceId = parseInt(deviceId, 10);
  const latestDiagnostic = mountDiagnostics && mountDiagnostics.length > 0
    ? mountDiagnostics[mountDiagnostics.length - 1]
    : null;
  const isValid = useMemo(() => {
    if (protocol === 'simulator') return true;
    if (!host.trim()) return false;
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) return false;
    if (isNaN(parsedDeviceId) || parsedDeviceId < 0) return false;
    return true;
  }, [protocol, host, parsedPort, parsedDeviceId]);

  const handleConnect = useCallback(async () => {
    if (!isTauri()) {
      setError(t('notDesktop'));
      return;
    }

    beginConnection(PRIMARY_MOUNT_DEVICE_PROFILE_ID, 'user_connect', 'mount-dialog-connect');
    setConnecting(true);
    setError('');

    const mountDevice = protocol === 'simulator'
      ? createSimulatorMountDevice()
      : (selectedDiscoveredDevice ?? {
        id: buildSupportedMountDeviceId({
          protocol,
          host,
          port: parseInt(port, 10) || 11111,
          deviceId: parseInt(deviceId, 10) || 0,
        }),
        protocol,
        host,
        port: parseInt(port, 10) || 11111,
        deviceId: parseInt(deviceId, 10) || 0,
        name: `${host || 'localhost'} #${parseInt(deviceId, 10) || 0}`,
        deviceType: 'telescope',
        source: 'manual',
        description: t('manualConnectionFallback'),
      });

    const config = {
      protocol,
      host,
      port: parseInt(port, 10) || 11111,
      deviceId: parseInt(deviceId, 10) || 0,
      selectedDeviceId: mountDevice.id,
    };

    try {
      setConnectionConfig(config);
      setSelectedDevice(mountDevice);
      const caps = await mountApi.connect(config);
      setCapabilities(caps);
      setCapabilitySnapshot({
        ...caps,
        capturedAt: new Date().toISOString(),
      });

      // Fetch initial state
      const state = await mountApi.getState();
      applyMountState(state);
      markConnected(PRIMARY_MOUNT_DEVICE_PROFILE_ID, 'user_connect', 'mount-dialog-connect');

      logger.info('Mount connected', { protocol, host: config.host, port: config.port });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      markFailed(
        PRIMARY_MOUNT_DEVICE_PROFILE_ID,
        {
          code: 'mount-connect-failed',
          message: msg,
          recoverable: true,
        },
        'user_connect',
        'mount-dialog-connect',
      );
      logger.error('Mount connection failed', { error: msg });
    } finally {
      setConnecting(false);
    }
  }, [
    protocol,
    host,
    port,
    deviceId,
    selectedDiscoveredDevice,
    setConnectionConfig,
    setCapabilities,
    setSelectedDevice,
    setCapabilitySnapshot,
    applyMountState,
    markConnected,
    beginConnection,
    markFailed,
    onOpenChange,
    t,
  ]);

  const handleDisconnect = useCallback(async () => {
    try {
      await mountApi.disconnect();
      resetMountInfo();
      disconnectConnection(PRIMARY_MOUNT_DEVICE_PROFILE_ID, 'user_disconnect', 'mount-dialog-disconnect');
      logger.info('Mount disconnected');
    } catch (e) {
      logger.error('Disconnect error', { error: e });
    }
  }, [disconnectConnection, resetMountInfo]);

  const handleRetryConnect = useCallback(async () => {
    retryConnection(PRIMARY_MOUNT_DEVICE_PROFILE_ID, 'mount-dialog-retry');
    await handleConnect();
  }, [handleConnect, retryConnection]);

  const handleDiscover = useCallback(async () => {
    if (!isTauri()) return;
    setDiscovering(true);
    setDevices([]);
    try {
      const found = await mountApi.discover();
      setDevices(found);
      if (found.length > 0) {
        setHost(found[0].host);
        setPort(String(found[0].port));
        setDeviceId(String(found[0].deviceId));
        setSelectedDiscoveredDevice(found[0]);
        setError('');
      } else {
        setSelectedDiscoveredDevice(null);
        setError(t('discoveryNoDevices'));
      }
    } catch (e) {
      logger.error('Discovery failed', { error: e });
    } finally {
      setDiscovering(false);
    }
  }, [t]);

  const handleDeviceSelect = useCallback((device: DiscoveredDevice) => {
    setHost(device.host);
    setPort(String(device.port));
    setDeviceId(String(device.deviceId));
    setSelectedDiscoveredDevice(device);
  }, []);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} tier="standard-form">
      <ResponsiveDialogContent
        className="overflow-hidden flex flex-col"
        desktopClassName="sm:max-w-md max-h-[92vh] max-h-[92dvh]"
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            {connected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
            {t('connectionSettings')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            {t('connectionSettings')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        {connected ? (
          <Card className="py-4 gap-3 shadow-none">
            <CardContent className="px-4 space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">{t('connected')}</Badge>
                {mountConnectionState && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {mountConnectionState.state}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {selectedDevice?.name ?? (connectionProtocol === 'simulator' ? t('simulator') : `${connectionHost}:${connectionPort}`)}
                </span>
              </div>
              <Button variant="destructive" onClick={handleDisconnect} className="w-full">
                <WifiOff className="h-4 w-4 mr-2" />
                {t('disconnect')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 py-4">
            {/* Protocol Selection */}
            <div className="grid gap-2">
              <Label>{t('protocol')}</Label>
              <Select value={protocol} onValueChange={(v) => setProtocol(v as MountProtocol)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simulator">
                    <span className="flex items-center gap-2">
                      <Radio className="h-3 w-3" />
                      {t('simulator')}
                    </span>
                  </SelectItem>
                  <SelectItem value="alpaca">
                    <span className="flex items-center gap-2">
                      <Wifi className="h-3 w-3" />
                      ASCOM Alpaca
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Alpaca Settings */}
            {protocol === 'alpaca' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="mount-host">{t('host')}</Label>
                    <Input
                      id="mount-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mount-port">{t('port')}</Label>
                    <Input
                      id="mount-port"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="11111"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mount-device-id">{t('deviceId')}</Label>
                  <Input
                    id="mount-device-id"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="0"
                    className="font-mono text-sm w-20"
                  />
                </div>

                {/* Discovery */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDiscover}
                    disabled={discovering}
                    className="w-full"
                  >
                    {discovering ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Search className="h-3 w-3 mr-2" />}
                    {t('discoverDevices')}
                  </Button>

                  {selectedDiscoveredDevice && (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                      <p className="font-medium">{t('selectedDevice')}: {selectedDiscoveredDevice.name}</p>
                      <p className="text-muted-foreground">
                        {selectedDiscoveredDevice.description ?? `${selectedDiscoveredDevice.host}:${selectedDiscoveredDevice.port}`}
                      </p>
                    </div>
                  )}

                  {devices.length > 0 && (
                    <div className="space-y-1">
                      {devices.map((d, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          className="w-full justify-start text-xs h-auto py-2 px-2 font-normal"
                          onClick={() => handleDeviceSelect(d)}
                        >
                          <span className="font-medium">{d.name}</span>
                          <span className="text-muted-foreground ml-2">{d.description ?? `${d.host}:${d.port}`}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <Alert variant="destructive" className="py-2 text-xs">
                <WifiOff className="h-3.5 w-3.5" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {mountConnectionState && (
              <Alert className="py-2 text-xs">
                <AlertDescription className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Connection lifecycle</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {mountConnectionState.state}
                    </Badge>
                  </div>
                  {mountConnectionState.lastError && (
                    <p className="text-destructive">
                      {mountConnectionState.lastError.message}
                    </p>
                  )}
                  {latestDiagnostic && (
                    <p className="text-muted-foreground">
                      Last event: {latestDiagnostic.from} → {latestDiagnostic.to}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        </div>

        {!connected && (
          <ResponsiveDialogFooter stickyOnMobile>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleConnect} disabled={connecting || !isValid}>
              {connecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Wifi className="h-4 w-4 mr-2" />
              {t('connect')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleRetryConnect()}
              disabled={connecting || !isValid || !(mountConnectionState?.state === 'failed' || mountConnectionState?.state === 'degraded')}
            >
              <Loader2 className={connecting ? 'h-4 w-4 mr-2 animate-spin' : 'h-4 w-4 mr-2'} />
              Retry
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
