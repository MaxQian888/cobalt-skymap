'use client';

import { type ChangeEvent, useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SettingsSection } from './settings-shared';
import { isTauri } from '@/lib/storage/platform';
import {
  SETTINGS_PROFILE_DOMAINS,
  buildSettingsProfile,
  parseSettingsProfile,
  type ParsedSettingsProfileResult,
  type SettingsProfileDomain,
  type SettingsProfileSkippedDomain,
  type SettingsProfileWarning,
} from '@/lib/settings/settings-profile';
import {
  openSettingsProfileFile,
  readSettingsProfileBrowserFile,
  saveSettingsProfileFile,
} from '@/lib/settings/settings-profile-io';
import {
  applySettingsProfileImport,
  restoreLastSettingsImport,
} from '@/lib/settings/settings-profile-transaction';
import { useSettingsImportRestoreStore } from '@/lib/stores/settings-import-restore-store';

type StatusKind = 'idle' | 'success' | 'error';
type SelectionState = Record<SettingsProfileDomain, boolean>;

interface ImportPreviewState {
  parsed: ParsedSettingsProfileResult & { ok: true };
  selection: SelectionState;
}

function createSelectionState(selectedDomains: readonly SettingsProfileDomain[]): SelectionState {
  return SETTINGS_PROFILE_DOMAINS.reduce((accumulator, domain) => {
    accumulator[domain] = selectedDomains.includes(domain);
    return accumulator;
  }, {} as SelectionState);
}

function normalizeThemeMode(value: string | undefined): 'light' | 'dark' | 'system' | undefined {
  return value === 'light' || value === 'dark' || value === 'system' ? value : undefined;
}

export function SettingsExportImport() {
  const t = useTranslations();
  const { theme: currentThemeMode, setTheme } = useTheme();
  const restorePoint = useSettingsImportRestoreStore((state) => state.restorePoint);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exportSelection, setExportSelection] = useState<SelectionState>(
    createSelectionState(SETTINGS_PROFILE_DOMAINS),
  );
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [status, setStatus] = useState<StatusKind>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const selectedExportDomains = useMemo(
    () => SETTINGS_PROFILE_DOMAINS.filter((domain) => exportSelection[domain]),
    [exportSelection],
  );

  const selectedImportDomains = useMemo(() => {
    if (!importPreview) {
      return [] as SettingsProfileDomain[];
    }
    return importPreview.parsed.importableDomains.filter((domain) => importPreview.selection[domain]);
  }, [importPreview]);

  const toggleSelection = useCallback((domain: SettingsProfileDomain, scope: 'export' | 'import') => {
    if (scope === 'export') {
      setExportSelection((current) => ({ ...current, [domain]: !current[domain] }));
      return;
    }

    setImportPreview((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        selection: {
          ...current.selection,
          [domain]: !current.selection[domain],
        },
      };
    });
  }, []);

  const resolveErrorMessage = useCallback((errorCode?: string) => {
    switch (errorCode) {
      case 'unsupportedVersion':
        return t('settingsNew.exportImport.unsupportedVersion');
      case 'noImportableDomains':
        return t('settingsNew.exportImport.noImportableDomains');
      case 'invalidFileFormat':
      default:
        return t('settingsNew.exportImport.invalidFile');
    }
  }, [t]);

  const resolveSkippedDomainMessage = useCallback((item: SettingsProfileSkippedDomain) => (
    `${t(`settingsNew.exportImport.domains.${item.domain}`)}: ${t(`settingsNew.exportImport.reasons.${item.reason}`)}`
  ), [t]);

  const resolveWarningMessage = useCallback((warning: SettingsProfileWarning) => {
    const label = warning.domain ? `${t(`settingsNew.exportImport.domains.${warning.domain}`)}: ` : '';
    return `${label}${t(`settingsNew.exportImport.warningMessages.${warning.code}`)}`;
  }, [t]);

  const setErrorStatus = useCallback((message: string) => {
    setStatus('error');
    setStatusMessage(message);
  }, []);

  const handleExport = useCallback(async () => {
    if (selectedExportDomains.length === 0) {
      setErrorStatus(t('settingsNew.exportImport.selectAtLeastOne'));
      return;
    }

    try {
      const profile = buildSettingsProfile({
        domains: selectedExportDomains,
        themeMode: normalizeThemeMode(currentThemeMode),
      });
      const saved = await saveSettingsProfileFile(profile);
      if (!saved) {
        return;
      }
      setStatus('idle');
      setStatusMessage('');
    } catch {
      setErrorStatus(t('settingsNew.exportImport.exportError'));
    }
  }, [currentThemeMode, selectedExportDomains, setErrorStatus, t]);

  const handleParsedImport = useCallback((parsed: ParsedSettingsProfileResult) => {
    if (!parsed.ok || !parsed.data) {
      setErrorStatus(resolveErrorMessage(parsed.error));
      return;
    }

    setImportPreview({
      parsed: parsed as ParsedSettingsProfileResult & { ok: true },
      selection: createSelectionState(parsed.importableDomains),
    });
    setStatus('idle');
    setStatusMessage('');
  }, [resolveErrorMessage, setErrorStatus]);

  const handleImportText = useCallback((text: string) => {
    try {
      const raw = JSON.parse(text) as unknown;
      handleParsedImport(parseSettingsProfile(raw));
    } catch {
      setErrorStatus(t('settingsNew.exportImport.parseError'));
    }
  }, [handleParsedImport, setErrorStatus, t]);

  const handleImportButton = useCallback(async () => {
    if (isTauri()) {
      try {
        const text = await openSettingsProfileFile();
        if (!text) {
          return;
        }
        handleImportText(text);
      } catch {
        setErrorStatus(t('settingsNew.exportImport.importError'));
      }
      return;
    }

    fileInputRef.current?.click();
  }, [handleImportText, setErrorStatus, t]);

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await readSettingsProfileBrowserFile(file);
      handleImportText(text);
    } catch {
      setErrorStatus(t('settingsNew.exportImport.importError'));
    } finally {
      event.target.value = '';
    }
  }, [handleImportText, setErrorStatus, t]);

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview || !importPreview.parsed.data) {
      return;
    }

    const result = await applySettingsProfileImport(importPreview.parsed.data, {
      domains: selectedImportDomains,
      applyThemeMode: setTheme,
      currentThemeMode: normalizeThemeMode(currentThemeMode),
    });

    if (!result.success) {
      setErrorStatus(result.error ?? t('settingsNew.exportImport.importError'));
      return;
    }

    setStatus('success');
    setStatusMessage(t('settingsNew.exportImport.importSuccess'));
    setImportPreview(null);
  }, [currentThemeMode, importPreview, selectedImportDomains, setErrorStatus, setTheme, t]);

  const handleRestoreLastImport = useCallback(async () => {
    const result = await restoreLastSettingsImport({ applyThemeMode: setTheme });
    if (!result.success) {
      setErrorStatus(result.error ?? t('settingsNew.exportImport.restoreError'));
      return;
    }

    setStatus('success');
    setStatusMessage(t('settingsNew.exportImport.restoreSuccess'));
  }, [setErrorStatus, setTheme, t]);

  return (
    <div className="space-y-4">
      <SettingsSection
        title={t('settingsNew.exportImport.title')}
        icon={<FileJson className="h-4 w-4" />}
        defaultOpen={true}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t('settingsNew.exportImport.description')}
          </p>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t('settingsNew.exportImport.selectDomains')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SETTINGS_PROFILE_DOMAINS.map((domain) => {
                const inputId = `export-domain-${domain}`;
                return (
                  <label key={domain} htmlFor={inputId} className="flex items-center gap-2 text-xs text-foreground">
                    <Checkbox
                      id={inputId}
                      checked={exportSelection[domain]}
                      onCheckedChange={() => toggleSelection(domain, 'export')}
                    />
                    <span>{t(`settingsNew.exportImport.domains.${domain}`)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleExport}
            disabled={selectedExportDomains.length === 0}
          >
            <Download className="h-4 w-4" />
            {t('settingsNew.exportImport.export')}
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleImportButton}
          >
            <Upload className="h-4 w-4" />
            {t('settingsNew.exportImport.import')}
          </Button>

          {restorePoint && (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleRestoreLastImport}
            >
              <RotateCcw className="h-4 w-4" />
              {t('settingsNew.exportImport.restoreLastImport')}
            </Button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />

          {status === 'success' && (
            <p className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {statusMessage}
            </p>
          )}
          {status === 'error' && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {statusMessage}
            </p>
          )}
        </div>
      </SettingsSection>

      <AlertDialog open={!!importPreview} onOpenChange={(open) => !open && setImportPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settingsNew.exportImport.previewTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settingsNew.exportImport.previewDescription')}
              {importPreview?.parsed.data && (
                <span className="mt-2 block text-xs font-mono text-muted-foreground">
                  {t('settingsNew.exportImport.exportedAt')}: {new Date(importPreview.parsed.data.exportedAt).toLocaleString()}
                  <br />
                  {t('settingsNew.exportImport.schemaVersion')}: {importPreview.parsed.data.metadata?.schemaVersion ?? importPreview.parsed.data.version}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {importPreview && (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">
                  {t('settingsNew.exportImport.importableDomains')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {importPreview.parsed.importableDomains.map((domain) => {
                    const inputId = `import-domain-${domain}`;
                    return (
                      <label key={domain} htmlFor={inputId} className="flex items-center gap-2 text-xs text-foreground">
                        <Checkbox
                          id={inputId}
                          checked={importPreview.selection[domain]}
                          onCheckedChange={() => toggleSelection(domain, 'import')}
                        />
                        <span>{t(`settingsNew.exportImport.domains.${domain}`)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {importPreview.parsed.skippedDomains.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {t('settingsNew.exportImport.skippedDomains')}
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {importPreview.parsed.skippedDomains.map((item) => (
                      <li key={`${item.domain}-${item.reason}`}>{resolveSkippedDomainMessage(item)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.parsed.warnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    {t('settingsNew.exportImport.warnings')}
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {importPreview.parsed.warnings.map((warning) => (
                      <li key={`${warning.domain ?? 'global'}-${warning.code}`}>{resolveWarningMessage(warning)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedImportDomains.length === 0 && (
                <p className="text-xs text-destructive">
                  {t('settingsNew.exportImport.selectAtLeastOne')}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImport}
              disabled={selectedImportDomains.length === 0}
            >
              {t('settingsNew.exportImport.confirmImport')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
