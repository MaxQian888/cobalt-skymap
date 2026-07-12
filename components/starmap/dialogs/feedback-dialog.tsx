'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  AlertTriangle,
  Bug,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  Eye,
  Lightbulb,
  Loader2,
  RotateCcw,
  Send,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SwitchItem } from '@/components/ui/switch-item';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useFeedbackStore } from '@/lib/stores/feedback-store';
import {
  buildGitHubIssueUrl,
  buildIssueBodyMarkdown,
  collectDiagnostics,
  exportDiagnosticsBundle,
} from '@/lib/feedback/feedback-utils';
import { openExternalUrl } from '@/lib/tauri/app-control-api';
import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';
import { useMobileDialogViewport } from './responsive-dialog-shell';
import type {
  FeedbackDiagnostics,
  FeedbackType,
  FeedbackSeverity,
  FeedbackPriority,
} from '@/types/feedback';

interface FeedbackDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TITLE_MAX = 120;
const DESC_SOFT_MAX = 2000;
const STEPS_SOFT_MAX = 1500;
const EXPECTED_SOFT_MAX = 1500;
const ADDITIONAL_SOFT_MAX = 1000;

function CharCounter({
  current,
  max,
  soft,
}: {
  current: number;
  max?: number;
  soft?: boolean;
}) {
  const isOver = max !== undefined && current > max;
  const isNear = max !== undefined && current > max * 0.9;
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        isOver
          ? 'text-destructive'
          : isNear
            ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-muted-foreground'
      )}
    >
      {current}
      {max !== undefined && `/${max}`}
      {soft && isOver && ' ⚠'}
    </span>
  );
}

function validateDraft(
  type: FeedbackType,
  title: string,
  description: string,
  reproductionSteps: string,
  expectedBehavior: string
): string | null {
  if (!title.trim()) {
    return 'feedback.errors.titleRequired';
  }
  if (!description.trim()) {
    return 'feedback.errors.descriptionRequired';
  }
  if (type === 'bug' && !reproductionSteps.trim()) {
    return 'feedback.errors.stepsRequired';
  }
  if (type === 'bug' && !expectedBehavior.trim()) {
    return 'feedback.errors.expectedRequired';
  }
  return null;
}

export function FeedbackDialog({ trigger, open, onOpenChange }: FeedbackDialogProps) {
  const t = useTranslations();
  const [internalOpen, setInternalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState('');
  const [showDiagnosticsPreview, setShowDiagnosticsPreview] = useState(false);
  const [diagnosticsPreviewData, setDiagnosticsPreviewData] = useState<string | null>(null);
  const [loadingDiagnosticsPreview, setLoadingDiagnosticsPreview] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draft = useFeedbackStore((state) => state.draft);
  const setType = useFeedbackStore((state) => state.setType);
  const updateDraft = useFeedbackStore((state) => state.updateDraft);
  const setIncludeSystemInfo = useFeedbackStore((state) => state.setIncludeSystemInfo);
  const setIncludeLogs = useFeedbackStore((state) => state.setIncludeLogs);
  const setSeverity = useFeedbackStore((state) => state.setSeverity);
  const setPriority = useFeedbackStore((state) => state.setPriority);
  const setScreenshot = useFeedbackStore((state) => state.setScreenshot);
  const resetDraft = useFeedbackStore((state) => state.resetDraft);

  const isMobileViewport = useMobileDialogViewport();
  const isControlled = typeof open === 'boolean';
  const dialogOpen = isControlled ? open : internalOpen;
  const isBusy = copying || submitting || exporting;

  const issueTypeHint = useMemo(
    () => (draft.type === 'bug' ? t('feedback.typeBugHint') : t('feedback.typeFeatureHint')),
    [draft.type, t]
  );

  const triggerDraftSaveIndicator = useCallback(() => {
    setDraftSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setDraftSaveStatus('saved');
      saveTimerRef.current = setTimeout(() => setDraftSaveStatus('idle'), 2000);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleDraftChange = useCallback(
    (patch: Parameters<typeof updateDraft>[0]) => {
      updateDraft(patch);
      triggerDraftSaveIndicator();
    },
    [updateDraft, triggerDraftSaveIndicator]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setResetConfirmOpen(false);
      setShowPreview(false);
      setShowDiagnosticsPreview(false);
      setDiagnosticsPreviewData(null);
    }
  };

  const resolveDiagnostics = async (): Promise<FeedbackDiagnostics | null> => {
    return collectDiagnostics({
      includeSystemInfo: draft.includeSystemInfo,
      includeLogs: draft.includeLogs,
    });
  };

  const handleCopyMarkdown = async () => {
    const validationError = validateDraft(
      draft.type,
      draft.title,
      draft.description,
      draft.reproductionSteps,
      draft.expectedBehavior
    );
    if (validationError) {
      toast.error(t(validationError));
      return;
    }

    setCopying(true);
    try {
      const diagnostics = await resolveDiagnostics();
      const markdown = buildIssueBodyMarkdown({ draft, diagnostics });
      await copyTextWithFeedback({
        text: markdown,
        successMessage: t('feedback.toast.markdownCopied'),
        errorMessage: t('feedback.toast.copyFailed'),
      });
    } catch {
      // copyTextWithFeedback already handles user-facing failure toasts.
    } finally {
      setCopying(false);
    }
  };

  const handleDownloadDiagnostics = async () => {
    if (!draft.includeSystemInfo && !draft.includeLogs) {
      toast.info(t('feedback.toast.enableDiagnosticsForExport'));
      return;
    }

    setExporting(true);
    try {
      const diagnostics = await resolveDiagnostics();
      if (!diagnostics) {
        toast.info(t('feedback.toast.noDiagnosticsCollected'));
        return;
      }
      const output = await exportDiagnosticsBundle(diagnostics);
      if (output) {
        toast.success(t('feedback.toast.diagnosticsExported'), {
          description: output,
        });
      } else {
        toast.info(t('feedback.toast.downloadCancelled'));
      }
    } catch {
      toast.error(t('feedback.toast.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateDraft(
      draft.type,
      draft.title,
      draft.description,
      draft.reproductionSteps,
      draft.expectedBehavior
    );
    if (validationError) {
      toast.error(t(validationError));
      return;
    }

    setSubmitting(true);
    try {
      const diagnostics = await resolveDiagnostics();
      const result = buildGitHubIssueUrl({ draft, diagnostics });
      await openExternalUrl(result.url);
      if (result.truncated) {
        toast.warning(t('feedback.toast.urlTruncated'));
      }
      toast.success(t('feedback.toast.openedInBrowser'));
      resetDraft();
      handleOpenChange(false);
    } catch {
      toast.error(t('feedback.toast.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !isBusy) {
        event.preventDefault();
        void handleSubmit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, isBusy]
  );

  const handleResetConfirmed = () => {
    setResetConfirmOpen(false);
    resetDraft();
    toast.info(t('feedback.toast.draftCleared'));
  };

  const handleTogglePreview = async () => {
    if (!showPreview) {
      const diagnostics = await resolveDiagnostics();
      const md = buildIssueBodyMarkdown({ draft, diagnostics });
      setPreviewMarkdown(md);
    }
    setShowPreview((prev) => !prev);
  };

  const handleToggleDiagnosticsPreview = async () => {
    if (!showDiagnosticsPreview) {
      setLoadingDiagnosticsPreview(true);
      try {
        const diagnostics = await resolveDiagnostics();
        setDiagnosticsPreviewData(
          diagnostics ? JSON.stringify(diagnostics, null, 2) : null
        );
      } catch {
        setDiagnosticsPreviewData(null);
      } finally {
        setLoadingDiagnosticsPreview(false);
      }
    }
    setShowDiagnosticsPreview((prev) => !prev);
  };

  const handleCaptureScreenshot = async () => {
    setCapturingScreenshot(true);
    try {
      const mod = await import(/* webpackIgnore: true */ 'html2canvas' as never);
      const html2canvas = (mod.default ?? mod) as (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => Promise<HTMLCanvasElement>;
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      const dataUrl = canvas.toDataURL('image/png', 0.7);
      setScreenshot(dataUrl);
      toast.success(t('feedback.toast.screenshotCaptured'));
    } catch {
      toast.error(t('feedback.toast.screenshotFailed'));
    } finally {
      setCapturingScreenshot(false);
    }
  };

  const isBug = draft.type === 'bug';

  const draftStatusIndicator = draftSaveStatus !== 'idle' ? (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      {draftSaveStatus === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('feedback.draftSaving')}
        </>
      )}
      {draftSaveStatus === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-500" />
          {t('feedback.draftSaved')}
        </>
      )}
    </span>
  ) : null;

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="feedback-type">{t('feedback.type')}</Label>
          <Select
            value={draft.type}
            onValueChange={(value) => {
              setType(value as FeedbackType);
              triggerDraftSaveIndicator();
            }}
          >
            <SelectTrigger id="feedback-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bug">
                <span className="inline-flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  {t('feedback.typeBug')}
                </span>
              </SelectItem>
              <SelectItem value="feature">
                <span className="inline-flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  {t('feedback.typeFeature')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{issueTypeHint}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-severity">
            {isBug ? t('feedback.severity') : t('feedback.priority')}
          </Label>
          {isBug ? (
            <Select
              value={draft.severity ?? ''}
              onValueChange={(value) => {
                setSeverity((value || undefined) as FeedbackSeverity | undefined);
                triggerDraftSaveIndicator();
              }}
            >
              <SelectTrigger id="feedback-severity" data-testid="feedback-severity-select">
                <SelectValue placeholder={t('feedback.severityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    {t('feedback.severityCritical')}
                  </span>
                </SelectItem>
                <SelectItem value="major">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    {t('feedback.severityMajor')}
                  </span>
                </SelectItem>
                <SelectItem value="minor">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    {t('feedback.severityMinor')}
                  </span>
                </SelectItem>
                <SelectItem value="cosmetic">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-500" />
                    {t('feedback.severityCosmetic')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={draft.priority ?? ''}
              onValueChange={(value) => {
                setPriority((value || undefined) as FeedbackPriority | undefined);
                triggerDraftSaveIndicator();
              }}
            >
              <SelectTrigger id="feedback-severity" data-testid="feedback-priority-select">
                <SelectValue placeholder={t('feedback.priorityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">{t('feedback.priorityHigh')}</SelectItem>
                <SelectItem value="medium">{t('feedback.priorityMedium')}</SelectItem>
                <SelectItem value="low">{t('feedback.priorityLow')}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="feedback-title">{t('feedback.titleField')}</Label>
            <CharCounter current={draft.title.length} max={TITLE_MAX} />
          </div>
          <Input
            id="feedback-title"
            data-testid="feedback-title-input"
            value={draft.title}
            onChange={(event) => handleDraftChange({ title: event.target.value })}
            placeholder={t('feedback.titlePlaceholder')}
            maxLength={TITLE_MAX}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="feedback-description">{t('feedback.descriptionField')}</Label>
          <CharCounter current={draft.description.length} max={DESC_SOFT_MAX} soft />
        </div>
        <Textarea
          id="feedback-description"
          data-testid="feedback-description-input"
          value={draft.description}
          onChange={(event) => handleDraftChange({ description: event.target.value })}
          placeholder={t('feedback.descriptionPlaceholder')}
          rows={4}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="feedback-steps">
              {isBug ? t('feedback.stepsField') : t('feedback.useCaseField')}
            </Label>
            <CharCounter current={draft.reproductionSteps.length} max={STEPS_SOFT_MAX} soft />
          </div>
          <Textarea
            id="feedback-steps"
            data-testid="feedback-steps-input"
            value={draft.reproductionSteps}
            onChange={(event) =>
              handleDraftChange({ reproductionSteps: event.target.value })
            }
            placeholder={
              isBug ? t('feedback.stepsPlaceholder') : t('feedback.useCasePlaceholder')
            }
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="feedback-expected">
              {isBug ? t('feedback.expectedField') : t('feedback.proposalField')}
            </Label>
            <CharCounter
              current={draft.expectedBehavior.length}
              max={EXPECTED_SOFT_MAX}
              soft
            />
          </div>
          <Textarea
            id="feedback-expected"
            data-testid="feedback-expected-input"
            value={draft.expectedBehavior}
            onChange={(event) =>
              handleDraftChange({ expectedBehavior: event.target.value })
            }
            placeholder={
              isBug
                ? t('feedback.expectedPlaceholder')
                : t('feedback.proposalPlaceholder')
            }
            rows={4}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="feedback-additional">{t('feedback.additionalField')}</Label>
          <CharCounter
            current={draft.additionalContext.length}
            max={ADDITIONAL_SOFT_MAX}
            soft
          />
        </div>
        <Textarea
          id="feedback-additional"
          data-testid="feedback-additional-input"
          value={draft.additionalContext}
          onChange={(event) =>
            handleDraftChange({ additionalContext: event.target.value })
          }
          placeholder={t('feedback.additionalPlaceholder')}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('feedback.screenshotLabel')}</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCaptureScreenshot}
              disabled={capturingScreenshot || isBusy}
              data-testid="feedback-screenshot-button"
            >
              {capturingScreenshot ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Camera className="h-3 w-3 mr-1" />
              )}
              {t('feedback.captureScreenshot')}
            </Button>
            {draft.screenshot && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setScreenshot(null)}
                data-testid="feedback-remove-screenshot"
              >
                <X className="h-3 w-3 mr-1" />
                {t('feedback.removeScreenshot')}
              </Button>
            )}
          </div>
        </div>
        {draft.screenshot && (
          <div className="rounded-md border overflow-hidden max-h-40">
            <Image
              src={draft.screenshot}
              alt="Screenshot"
              width={640}
              height={160}
              className="w-full h-auto object-contain max-h-40"
              unoptimized
            />
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm font-medium">{t('feedback.diagnosticsTitle')}</p>
        <SwitchItem
          label={t('feedback.includeSystemInfo')}
          description={t('feedback.includeSystemInfoDesc')}
          checked={draft.includeSystemInfo}
          onCheckedChange={(v) => {
            setIncludeSystemInfo(v);
            triggerDraftSaveIndicator();
          }}
          className="rounded-md border p-3"
          switchProps={{ 'data-testid': 'feedback-include-system-switch' }}
        />
        <SwitchItem
          label={t('feedback.includeLogs')}
          description={t('feedback.includeLogsDesc')}
          checked={draft.includeLogs}
          onCheckedChange={(v) => {
            setIncludeLogs(v);
            triggerDraftSaveIndicator();
          }}
          className="rounded-md border p-3"
          switchProps={{ 'data-testid': 'feedback-include-logs-switch' }}
        />
        <p className="text-xs text-muted-foreground">{t('feedback.privacyHint')}</p>

        {(draft.includeSystemInfo || draft.includeLogs) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggleDiagnosticsPreview}
            data-testid="feedback-diagnostics-preview-toggle"
            className="text-xs"
          >
            {loadingDiagnosticsPreview ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : showDiagnosticsPreview ? (
              <ChevronUp className="h-3 w-3 mr-1" />
            ) : (
              <ChevronDown className="h-3 w-3 mr-1" />
            )}
            {t('feedback.previewDiagnostics')}
          </Button>
        )}
        {showDiagnosticsPreview && diagnosticsPreviewData && (
          <pre className="text-xs bg-muted rounded-md p-3 max-h-48 overflow-auto font-mono whitespace-pre-wrap">
            {diagnosticsPreviewData}
          </pre>
        )}
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleTogglePreview}
          data-testid="feedback-preview-toggle"
          className="text-xs"
        >
          <Eye className="h-3 w-3 mr-1" />
          {showPreview ? t('feedback.hidePreview') : t('feedback.showPreview')}
        </Button>
        {showPreview && (
          <pre className="text-xs bg-muted rounded-md p-3 max-h-64 overflow-auto font-mono whitespace-pre-wrap">
            {previewMarkdown || t('feedback.previewEmpty')}
          </pre>
        )}
      </div>
    </div>
  );

  const supportButtons = (
    <>
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            data-testid="feedback-reset-button"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {t('feedback.resetForm')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('feedback.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('feedback.resetConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('feedback.resetCancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="feedback-reset-confirm-button"
              onClick={handleResetConfirmed}
            >
              {t('feedback.resetConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopyMarkdown}
        disabled={isBusy}
        data-testid="feedback-copy-button"
      >
        {copying ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ClipboardCopy className="h-4 w-4 mr-1" />
        )}
        {t('feedback.copyMarkdown')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDownloadDiagnostics}
        disabled={isBusy}
        data-testid="feedback-download-button"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        {t('feedback.downloadDiagnostics')}
      </Button>
    </>
  );

  const submitButton = (
    <Button
      type="button"
      onClick={handleSubmit}
      disabled={isBusy}
      data-testid="feedback-submit-button"
      className={cn(isMobileViewport && 'w-full')}
    >
      {submitting ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Send className="h-4 w-4 mr-1" />
      )}
      {t('feedback.submitToGitHub')}
      <kbd className="ml-2 hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        ⌘↵
      </kbd>
    </Button>
  );

  if (isMobileViewport) {
    return (
      <Drawer open={dialogOpen} onOpenChange={handleOpenChange}>
        {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
        <DrawerContent
          className="h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh] rounded-none border-x-0 border-b-0 flex flex-col overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          <DrawerHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <DrawerTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                {t('feedback.title')}
              </DrawerTitle>
              {draftStatusIndicator}
            </div>
            <DrawerDescription>{t('feedback.description')}</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
            {formFields}
          </div>
          <DrawerFooter className="sticky bottom-0 z-10 mt-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
            <div className="flex flex-wrap items-center gap-2">
              {supportButtons}
            </div>
            {submitButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className="sm:max-w-[720px] max-h-[88vh] max-h-[88dvh] overflow-y-auto"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              {t('feedback.title')}
            </DialogTitle>
            {draftStatusIndicator}
          </div>
          <DialogDescription>{t('feedback.description')}</DialogDescription>
        </DialogHeader>
        {formFields}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">{supportButtons}</div>
          {submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
