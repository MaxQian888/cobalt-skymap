'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConnectionDraftModel } from '@/lib/hooks/use-settings-draft';
import { isTauri } from '@/lib/storage/platform';
import { httpApi } from '@/lib/tauri/http-api';
import type { EffectiveProxyState, ProxyMode, ProxySource } from '@/lib/tauri/http-api';
import { SettingsSection, ToggleItem } from './settings-shared';

function proxySourceToLabel(source: ProxySource, t: ReturnType<typeof useTranslations>) {
  switch (source) {
    case 'manual':
      return t('settings.proxySourceManual');
    case 'env':
      return t('settings.proxySourceEnv');
    case 'system':
      return t('settings.proxySourceSystem');
    default:
      return t('settings.proxySourceNone');
  }
}

export function ConnectionSettings() {
  const t = useTranslations();
  const tauriRuntime = isTauri();
  const {
    connection,
    setConnection,
    backendProtocol,
    setBackendProtocol,
    proxy,
    setProxySettings,
  } = useConnectionDraftModel();
  const [effectiveProxyState, setEffectiveProxyState] = useState<EffectiveProxyState | null>(null);
  const [proxyStateError, setProxyStateError] = useState<string | null>(null);

  useEffect(() => {
    if (!tauriRuntime) {
      return;
    }

    let cancelled = false;
    void httpApi
      .getEffectiveProxyState()
      .then((state) => {
        if (!cancelled) {
          setEffectiveProxyState(state);
          setProxyStateError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProxyStateError(error instanceof Error ? error.message : t('settings.proxyStatusError'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [proxy.mode, proxy.manualUrl, proxy.fallbackToDirectOnFailure, tauriRuntime, t]);

  return (
    <SettingsSection
      title={t('settings.connection')}
      icon={<Link className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('settings.protocol')}</Label>
          <Select
            value={backendProtocol}
            onValueChange={(v) => setBackendProtocol(v as 'http' | 'https')}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">{t('settings.protocolHttp')}</SelectItem>
              <SelectItem value="https">{t('settings.protocolHttps')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('settings.ipAddress')}</Label>
            <Input
              value={connection.ip}
              onChange={(e) => setConnection({ ip: e.target.value })}
              onBlur={(e) => setConnection({ ip: e.target.value.trim() })}
              placeholder={t('settings.ipAddressPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('settings.port')}</Label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={connection.port}
              onChange={(e) => {
                // Allow any input during typing, validate on blur
                setConnection({ port: e.target.value });
              }}
              onBlur={(e) => {
                // Validate and clamp port number on blur
                const port = parseInt(e.target.value);
                const validPort = isNaN(port) ? 1888 : Math.max(1, Math.min(65535, port));
                setConnection({ port: String(validPort) });
              }}
              placeholder={t('settings.portPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('settings.proxyMode')}</Label>
          <Select
            value={proxy.mode}
            onValueChange={(value) => setProxySettings({ mode: value as ProxyMode })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('settings.proxyModeAuto')}</SelectItem>
              <SelectItem value="manual">{t('settings.proxyModeManual')}</SelectItem>
              <SelectItem value="off">{t('settings.proxyModeOff')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {proxy.mode === 'manual' && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('settings.proxyManualUrl')}</Label>
            <Input
              value={proxy.manualUrl}
              onChange={(e) => setProxySettings({ manualUrl: e.target.value })}
              onBlur={(e) => setProxySettings({ manualUrl: e.target.value.trim() })}
              placeholder={t('settings.proxyManualUrlPlaceholder')}
              className="h-8 text-sm font-mono"
            />
          </div>
        )}

        <ToggleItem
          id="proxy-fallback-direct"
          label={t('settings.proxyFallbackDirect')}
          description={t('settings.proxyFallbackDirectDescription')}
          checked={proxy.fallbackToDirectOnFailure}
          onCheckedChange={(checked) => setProxySettings({ fallbackToDirectOnFailure: checked })}
        />

        {tauriRuntime && (
          <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-1">
            <p className="font-medium text-foreground/90">
              {t('settings.proxyEffectiveState')}
            </p>
            {effectiveProxyState && (
              <>
                <p className="text-muted-foreground">
                  {t('settings.proxyEffectiveSource')}: {proxySourceToLabel(effectiveProxyState.source, t)}
                </p>
                {effectiveProxyState.resolved_proxy && (
                  <p className="text-muted-foreground break-all">
                    {t('settings.proxyEffectiveUrl')}: {effectiveProxyState.resolved_proxy}
                  </p>
                )}
                {effectiveProxyState.last_error && (
                  <p className="text-destructive break-all">
                    {t('settings.proxyEffectiveLastError')}: {effectiveProxyState.last_error}
                  </p>
                )}
              </>
            )}
            {!effectiveProxyState && !proxyStateError && (
              <p className="text-muted-foreground">{t('settings.proxyStatusUnavailable')}</p>
            )}
            {proxyStateError && (
              <p className="text-destructive break-all">
                {t('settings.proxyStatusError')}: {proxyStateError}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground px-1">
          {t('settings.connectionDescription')}
        </p>
      </div>
    </SettingsSection>
  );
}
