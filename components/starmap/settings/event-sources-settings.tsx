'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Calendar,
  Pencil,
  RotateCcw,
  Plus,
  Trash2,
  Globe,
  Key,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useEventSourcesStore, type EventSourceConfig } from '@/lib/stores';
import { smartFetch } from '@/lib/services/http-fetch';
import { createLogger } from '@/lib/logger';
import { isTauri } from '@/lib/storage/platform';

const logger = createLogger('event-sources-settings');

// ============================================================================
// Edit Dialog
// ============================================================================

interface EditSourceDialogProps {
  source: EventSourceConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<EventSourceConfig>) => void;
  isNew?: boolean;
  onAdd?: (source: EventSourceConfig) => void;
}

function EditSourceDialog({
  source,
  open,
  onOpenChange,
  onSave,
  isNew,
  onAdd,
}: EditSourceDialogProps) {
  const t = useTranslations();
  const [name, setName] = useState(source?.name ?? '');
  const [apiUrl, setApiUrl] = useState(source?.apiUrl ?? '');
  const [apiKey, setApiKey] = useState(source?.apiKey ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Reset form when source changes
  const resetForm = useCallback(() => {
    setName(source?.name ?? '');
    setApiUrl(source?.apiUrl ?? '');
    setApiKey(source?.apiKey ?? '');
    setTestResult(null);
  }, [source]);

  // Test connection
  const handleTestConnection = async () => {
    if (!apiUrl) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await smartFetch(apiUrl, { timeout: 10000 });
      setTestResult(response.ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (isNew && onAdd) {
      const newId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      onAdd({
        id: newId || `custom-${Date.now()}`,
        name: name || 'Custom Source',
        apiUrl,
        apiKey,
        enabled: true,
        priority: 50,
        cacheMinutes: 60,
      });
    } else if (source) {
      onSave(source.id, { name, apiUrl, apiKey });
    }
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) resetForm();
        onOpenChange(isOpen);
      }}
      tier="standard-form"
    >
      <ResponsiveDialogContent className="sm:max-w-[420px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {isNew
              ? t('eventSources.addSource')
              : t('eventSources.editSource')}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="source-name">{t('eventSources.sourceName')}</Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom API"
            />
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="source-url" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {t('eventSources.apiUrl')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="source-url"
                value={apiUrl}
                onChange={(e) => {
                  setApiUrl(e.target.value);
                  setTestResult(null);
                }}
                placeholder="https://api.example.com/v1"
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={handleTestConnection}
                    disabled={!apiUrl || testing}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : testResult === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : testResult === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('eventSources.testConnection')}
                </TooltipContent>
              </Tooltip>
            </div>
            {testResult === 'success' && (
              <p className="text-xs text-green-500">
                {t('eventSources.connectionSuccess')}
              </p>
            )}
            {testResult === 'error' && (
              <p className="text-xs text-red-500">
                {t('eventSources.connectionFailed')}
              </p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="source-key" className="flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5" />
              {t('eventSources.apiKey')}
            </Label>
            <Input
              id="source-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('eventSources.apiKeyPlaceholder')}
            />
            <p className="text-[11px] text-muted-foreground">
              {isTauri()
                ? t('eventSources.apiKeyHint')
                : `${t('eventSources.apiKeyHint')} ${t('eventSources.description')}`}
            </p>
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EventSourcesSettings() {
  const t = useTranslations();
  const sources = useEventSourcesStore((state) => state.sources);
  const toggleSource = useEventSourcesStore((state) => state.toggleSource);
  const updateSource = useEventSourcesStore((state) => state.updateSource);
  const addSource = useEventSourcesStore((state) => state.addSource);
  const removeSource = useEventSourcesStore((state) => state.removeSource);
  const resetToDefaults = useEventSourcesStore(
    (state) => state.resetToDefaults
  );

  const [editingSource, setEditingSource] = useState<EventSourceConfig | null>(
    null
  );
  const [isAddingNew, setIsAddingNew] = useState(false);

  const isBuiltIn = (id: string) =>
    ['usno', 'imo', 'nasa', 'mpc', 'astronomyapi', 'local'].includes(id);

  const handleAdd = useCallback(
    (source: EventSourceConfig) => {
      addSource(source);
      setIsAddingNew(false);
    },
    [addSource]
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (!isBuiltIn(id)) {
        removeSource(id);
      }
    },
    [removeSource]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {t('eventSources.title')}
        </h3>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsAddingNew(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('eventSources.addSource')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={resetToDefaults}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.reset')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('eventSources.description')}
      </p>

      <div className="space-y-2">
        {sources
          .sort((a, b) => a.priority - b.priority)
          .map((source) => (
            <Card key={source.id} className="border-border">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Switch
                      id={`src-${source.id}`}
                      checked={source.enabled}
                      onCheckedChange={() => toggleSource(source.id)}
                    />
                    <div className="min-w-0">
                      <Label
                        htmlFor={`src-${source.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {source.name}
                      </Label>
                      {source.apiUrl && (
                        <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                          {source.apiUrl}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(source.hasStoredSecret || source.apiKey) && (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 text-green-500 border-green-500/30"
                      >
                        <Key className="h-2.5 w-2.5 mr-0.5" />
                        API
                      </Badge>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingSource(source)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('eventSources.editSource')}
                      </TooltipContent>
                    </Tooltip>
                    {!isBuiltIn(source.id) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleRemove(source.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('eventSources.removeSource')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Separator />

      {/* Edit Dialog */}
      <EditSourceDialog
        key={editingSource?.id ?? 'none'}
        source={editingSource}
        open={editingSource !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingSource(null);
        }}
        onSave={(id, updates) => {
          updateSource(id, updates);
          logger.info(`Updated event source: ${id}`, updates);
        }}
      />

      {/* Add New Dialog */}
      <EditSourceDialog
        source={null}
        open={isAddingNew}
        onOpenChange={setIsAddingNew}
        onSave={() => {}}
        isNew
        onAdd={handleAdd}
      />
    </div>
  );
}
