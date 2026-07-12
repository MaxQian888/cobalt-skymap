'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { mapConfig } from '@/lib/services/map-config';
import { createLogger } from '@/lib/logger';
import type { MapProviderType } from '@/types/starmap/map';
import { PROVIDER_STATIC_INFO } from '@/lib/constants/map';
import { maskApiKey, getQuotaUsagePercent } from '@/lib/utils/map-utils';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';
import { secretVaultApi } from '@/lib/tauri/secret-vault-api';

const logger = createLogger('map-api-key-manager');

interface MapApiKeyManagerProps {
  trigger?: React.ReactNode;
  onKeysChange?: () => void;
}


export function MapApiKeyManager({ trigger, onKeysChange }: MapApiKeyManagerProps) {
  const t = useTranslations();

  // Dynamic provider info with i18n names
  const PROVIDER_INFO = useMemo(() => ({
    openstreetmap: {
      name: t('map.providerNames.openstreetmap'),
      ...PROVIDER_STATIC_INFO.openstreetmap,
    },
    google: {
      name: t('map.providerNames.google'),
      ...PROVIDER_STATIC_INFO.google,
    },
    mapbox: {
      name: t('map.providerNames.mapbox'),
      ...PROVIDER_STATIC_INFO.mapbox,
    },
  }), [t]);
  const [open, setOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [loadedSecrets, setLoadedSecrets] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState(() => mapConfig.getApiKeys());
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);
  
  // Form state for adding new key
  const [newKey, setNewKey] = useState({
    provider: 'google' as MapProviderType,
    apiKey: '',
    label: '',
    dailyQuota: '',
    monthlyQuota: '',
  });

  useEffect(() => {
    const unsubscribe = mapConfig.addConfigurationListener?.(() => {
      setApiKeys(mapConfig.getApiKeys());
    });
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    void secretVaultApi.getStatus().then((status) => {
      if (!cancelled) {
        setVaultMessage(status.message ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleToggleVisibility = useCallback(async (keyId: string) => {
    const key = apiKeys.find((item) => item.id === keyId);
    if (!key) return;

    if (!visibleKeys.has(keyId)) {
      try {
        const secureValue = await secretVaultApi.getMapApiKey(key.provider, key.id);
        if (secureValue) {
          setLoadedSecrets((prev) => ({ ...prev, [keyId]: secureValue }));
        }
      } catch (error) {
        logger.warn(`Failed to reveal secure map key ${keyId}`, error);
      }
    }

    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  }, [apiKeys, visibleKeys]);

  const handleCopyKey = useCallback(async (keyId: string) => {
    const key = apiKeys.find((item) => item.id === keyId);
    const apiKey = key
      ? (await secretVaultApi.getMapApiKey(key.provider, key.id).catch(() => key.apiKey)) || key.apiKey
      : '';

    await copyTextWithFeedback({
      text: apiKey,
      successMessage: t('map.keyCopied') || 'API key copied to clipboard',
      errorMessage: t('map.copyFailed') || 'Failed to copy',
      onSuccess: () => {
        setCopiedKey(keyId);
        setTimeout(() => setCopiedKey(null), 2000);
      },
    });
  }, [apiKeys, t]);

  const handleAddKey = useCallback(() => {
    if (!newKey.apiKey.trim()) {
      toast.error(t('map.apiKeyRequired') || 'API key is required');
      return;
    }

    try {
      mapConfig.addApiKey({
        provider: newKey.provider,
        apiKey: newKey.apiKey.trim(),
        label: newKey.label.trim() || undefined,
        quota: {
          daily: newKey.dailyQuota ? parseInt(newKey.dailyQuota) : undefined,
          monthly: newKey.monthlyQuota ? parseInt(newKey.monthlyQuota) : undefined,
        },
      });

      toast.success(t('map.keyAdded') || 'API key added');
      setNewKey({
        provider: 'google',
        apiKey: '',
        label: '',
        dailyQuota: '',
        monthlyQuota: '',
      });
      setAddDialogOpen(false);
      onKeysChange?.();
    } catch (error) {
      toast.error(t('map.addKeyFailed') || 'Failed to add API key');
      logger.error('Failed to add API key', error);
    }
  }, [newKey, t, onKeysChange]);

  const handleDeleteKey = useCallback((keyId: string) => {
    try {
      mapConfig.removeApiKey(keyId);
      toast.success(t('map.keyDeleted') || 'API key deleted');
      onKeysChange?.();
    } catch (error) {
      toast.error(t('map.deleteKeyFailed') || 'Failed to delete API key');
      logger.error('Failed to delete API key', error);
    }
  }, [t, onKeysChange]);

  const handleSetDefault = useCallback((keyId: string) => {
    try {
      mapConfig.setDefaultApiKey(keyId);
      toast.success(t('map.keySetDefault') || 'API key set as default');
      onKeysChange?.();
    } catch (error) {
      toast.error(t('map.setDefaultFailed') || 'Failed to set default');
      logger.error('Failed to set default API key', error);
    }
  }, [t, onKeysChange]);


  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen} tier="complex-editor">
      <ResponsiveDialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Key className="h-4 w-4 mr-2" />
            {t('map.apiKeys') || 'API Keys'}
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-2xl" desktopClassName="overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('map.apiKeyManager') || 'API Key Manager'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t('map.apiKeyManagerDescription') || 'Manage API keys for map providers. Desktop secrets are stored in the secure vault; web secrets stay in the current session only.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          {/* Security Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>
              {t('map.securityNotice') || 'Security Notice'}
            </AlertTitle>
            <AlertDescription>
              {t('map.securityNoticeDescription') || 'Never share your API keys publicly. Desktop builds keep them in secure storage.'}
            </AlertDescription>
          </Alert>

          {vaultMessage && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>{vaultMessage}</AlertDescription>
            </Alert>
          )}

          {/* API Keys Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('map.provider') || 'Provider'}</TableHead>
                <TableHead>{t('map.apiKey') || 'API Key'}</TableHead>
                <TableHead>{t('map.quota') || 'Quota'}</TableHead>
                <TableHead className="text-right">{t('map.actions') || 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      icon={Key}
                      message={t('map.noApiKeys') || 'No API keys configured'}
                    />
                    <p className="text-xs text-center text-muted-foreground -mt-4">{t('map.addKeyHint') || 'Add an API key to enable premium map features'}</p>
                  </TableCell>
                </TableRow>
              ) : (
                apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{key.provider}</span>
                        {key.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            {t('map.default') || 'Default'}
                          </Badge>
                        )}
                        {key.label && (
                          <span className="text-xs text-muted-foreground">({key.label})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {visibleKeys.has(key.id)
                            ? (loadedSecrets[key.id] ?? key.apiKey)
                            : maskApiKey(loadedSecrets[key.id] ?? key.apiKey)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => void handleToggleVisibility(key.id)}
                        >
                          {visibleKeys.has(key.id) ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => void handleCopyKey(key.id)}
                        >
                          {copiedKey === key.id ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {key.quota && (key.quota.daily || key.quota.monthly) ? (
                        <div className="space-y-1">
                          <Progress value={getQuotaUsagePercent(key)} className="h-2 w-20" />
                          <p className="text-xs text-muted-foreground">
                            {key.quota.used || 0} / {key.quota.daily || key.quota.monthly}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t('map.unlimited') || 'Unlimited'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!key.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(key.id)}
                          >
                            {t('map.setDefault') || 'Set Default'}
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('map.deleteKeyTitle') || 'Delete API Key?'}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('map.deleteKeyDescription') || 'This action cannot be undone. The API key will be permanently removed.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteKey(key.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                {t('common.delete') || 'Delete'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Separator />

          {/* Add New Key Dialog */}
          <ResponsiveDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} tier="standard-form">
            <ResponsiveDialogTrigger asChild>
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t('map.addApiKey') || 'Add API Key'}
              </Button>
            </ResponsiveDialogTrigger>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>{t('map.addApiKey') || 'Add API Key'}</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {t('map.addApiKeyDescription') || 'Add a new API key for a map provider.'}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('map.provider') || 'Provider'}</Label>
                  <Select
                    value={newKey.provider}
                    onValueChange={(v) => setNewKey({ ...newKey, provider: v as MapProviderType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">{PROVIDER_INFO.google.name}</SelectItem>
                      <SelectItem value="mapbox">{PROVIDER_INFO.mapbox.name}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {PROVIDER_INFO[newKey.provider].keyFormat}
                    {' • '}
                    <a 
                      href={PROVIDER_INFO[newKey.provider].docsUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t('map.getDocs') || 'Get API Key'}
                    </a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('map.apiKey') || 'API Key'}</Label>
                  <Input
                    type="password"
                    value={newKey.apiKey}
                    onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
                    placeholder={PROVIDER_INFO[newKey.provider].keyFormat}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('map.label') || 'Label (Optional)'}</Label>
                  <Input
                    value={newKey.label}
                    onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                    placeholder={t('map.labelPlaceholder') || 'e.g., Production, Development'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('map.dailyQuota') || 'Daily Quota'}</Label>
                    <Input
                      type="number"
                      value={newKey.dailyQuota}
                      onChange={(e) => setNewKey({ ...newKey, dailyQuota: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('map.monthlyQuota') || 'Monthly Quota'}</Label>
                    <Input
                      type="number"
                      value={newKey.monthlyQuota}
                      onChange={(e) => setNewKey({ ...newKey, monthlyQuota: e.target.value })}
                      placeholder="30000"
                    />
                  </div>
                </div>
              </div>

              <ResponsiveDialogFooter stickyOnMobile>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  {t('common.cancel') || 'Cancel'}
                </Button>
                <Button onClick={handleAddKey}>
                  {t('map.addKey') || 'Add Key'}
                </Button>
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
