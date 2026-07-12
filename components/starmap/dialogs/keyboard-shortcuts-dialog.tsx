'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Keyboard, Command, Navigation, Eye, Clock,
  Settings2, RotateCcw, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command as CommandRoot,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/starmap/dialogs/responsive-dialog-shell';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ShortcutItem, KeyboardShortcutsDialogProps } from '@/types/keyboard-shortcuts';
import { SHORTCUT_GROUP_DEFINITIONS } from '@/lib/constants/keyboard-shortcuts-data';
import {
  useKeybindingStore,
  formatKeyBinding,
  eventToKeyBinding,
  type ShortcutActionId,
  type KeyBinding,
} from '@/lib/stores';
import { STARMAP_DIALOG_ICON_TRIGGER_CLASS } from './dialog-layout';

const ICON_MAP: Record<string, LucideIcon> = {
  Navigation,
  Command,
  Eye,
  Clock,
};

function ShortcutKeyDisplay({ displayText, dimmed = false }: { displayText: string; dimmed?: boolean }) {
  const tokens = displayText.split('+').filter(Boolean);

  return (
    <KbdGroup className={cn(dimmed && 'opacity-60')}>
      {tokens.map((token) => (
        <Kbd key={token}>{token}</Kbd>
      ))}
    </KbdGroup>
  );
}

function KeyCaptureButton({
  actionId,
  onCapture,
  isRecording,
  onStartRecording,
}: {
  actionId: ShortcutActionId;
  onCapture: (actionId: ShortcutActionId, binding: KeyBinding) => void;
  isRecording: boolean;
  onStartRecording: (actionId: ShortcutActionId) => void;
}) {
  const t = useTranslations('shortcuts');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const binding = useKeybindingStore((s) => s.getBinding(actionId));
  const isCustom = useKeybindingStore((s) => s.isCustom(actionId));

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        onStartRecording('' as ShortcutActionId);
        return;
      }

      const captured = eventToKeyBinding(e);
      if (captured) {
        onCapture(actionId, captured);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isRecording, actionId, onCapture, onStartRecording]);

  useEffect(() => {
    if (isRecording) {
      buttonRef.current?.focus();
    }
  }, [isRecording]);

  const displayText = isRecording ? t('pressKey') : formatKeyBinding(binding);

  return (
    <Button
      ref={buttonRef}
      variant="outline"
      size="xs"
      className={cn(
        'font-mono cursor-pointer select-none min-w-[4rem] justify-center',
        isRecording
          ? 'border-primary bg-primary/10 text-primary animate-pulse'
          : isCustom
            ? 'border-primary/50 bg-primary/5 text-primary hover:bg-primary/10'
            : 'bg-muted/50 hover:bg-muted',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onStartRecording(isRecording ? '' as ShortcutActionId : actionId);
      }}
      title={isRecording ? t('pressKeyOrEsc') : t('clickToEdit')}
    >
      {displayText}
    </Button>
  );
}

function ShortcutKeyRowView({
  shortcut,
  t,
}: {
  shortcut: ShortcutItem;
  t: ReturnType<typeof useTranslations>;
}) {
  const actionId = shortcut.actionId as ShortcutActionId | undefined;
  const binding = useKeybindingStore((s) =>
    actionId ? s.getBinding(actionId) : null
  );

  const displayText = binding
    ? formatKeyBinding(binding)
    : shortcut.modifier
      ? `${shortcut.modifier}+${shortcut.key}`
      : shortcut.key;

  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-muted-foreground">
        {t(`shortcuts.${shortcut.descriptionKey}`)}
      </span>
      <ShortcutKeyDisplay displayText={displayText} />
    </div>
  );
}

function ShortcutKeyRowEdit({
  shortcut,
  recordingAction,
  conflictAction,
  onCapture,
  onStartRecording,
  onReset,
  t,
}: {
  shortcut: ShortcutItem;
  recordingAction: ShortcutActionId | null;
  conflictAction: ShortcutActionId | null;
  onCapture: (actionId: ShortcutActionId, binding: KeyBinding) => void;
  onStartRecording: (actionId: ShortcutActionId) => void;
  onReset: (actionId: ShortcutActionId) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const actionId = shortcut.actionId as ShortcutActionId | undefined;
  const isCustom = useKeybindingStore((s) =>
    actionId ? s.isCustom(actionId) : false
  );

  if (!actionId) {
    const displayText = shortcut.modifier
      ? `${shortcut.modifier}+${shortcut.key}`
      : shortcut.key;

    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-sm text-muted-foreground">
          {t(`shortcuts.${shortcut.descriptionKey}`)}
        </span>
        <ShortcutKeyDisplay displayText={displayText} dimmed />
      </div>
    );
  }

  const isConflict = conflictAction === actionId;

  return (
    <div className={cn(
      'flex items-center justify-between py-1.5 gap-2',
      isConflict && 'bg-destructive/10 -mx-2 px-2 rounded',
    )}>
      <span className="text-sm text-muted-foreground flex-1 min-w-0 truncate">
        {t(`shortcuts.${shortcut.descriptionKey}`)}
        {isConflict && (
          <AlertTriangle className="inline ml-1 h-3 w-3 text-destructive" />
        )}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <KeyCaptureButton
          actionId={actionId}
          onCapture={onCapture}
          isRecording={recordingAction === actionId}
          onStartRecording={onStartRecording}
        />
        {isCustom && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onReset(actionId)}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{t('resetToDefault')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog({ trigger }: KeyboardShortcutsDialogProps) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [recordingAction, setRecordingAction] = useState<ShortcutActionId | null>(null);
  const [conflictAction, setConflictAction] = useState<ShortcutActionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const setBinding = useKeybindingStore((s) => s.setBinding);
  const resetBinding = useKeybindingStore((s) => s.resetBinding);
  const resetAllBindings = useKeybindingStore((s) => s.resetAllBindings);
  const findConflict = useKeybindingStore((s) => s.findConflict);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return SHORTCUT_GROUP_DEFINITIONS;
    }

    return SHORTCUT_GROUP_DEFINITIONS
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter((shortcut) => {
          const description = t(`shortcuts.${shortcut.descriptionKey}`).toLowerCase();
          const keyText = shortcut.modifier
            ? `${shortcut.modifier}+${shortcut.key}`.toLowerCase()
            : shortcut.key.toLowerCase();
          const actionId = shortcut.actionId?.toLowerCase() ?? '';
          return (
            description.includes(query) ||
            keyText.includes(query) ||
            actionId.includes(query)
          );
        }),
      }))
      .filter((group) => group.shortcuts.length > 0);
  }, [searchQuery, t]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setEditing(false);
      setRecordingAction(null);
      setConflictAction(null);
      setSearchQuery('');
    }
  }, []);

  const handleStartRecording = useCallback((actionId: ShortcutActionId) => {
    setRecordingAction(actionId || null);
    setConflictAction(null);
  }, []);

  const handleCapture = useCallback((actionId: ShortcutActionId, binding: KeyBinding) => {
    const conflict = findConflict(binding, actionId);
    if (conflict) {
      setConflictAction(conflict);
      setBinding(actionId, binding);
    } else {
      setConflictAction(null);
      setBinding(actionId, binding);
    }
    setRecordingAction(null);
  }, [findConflict, setBinding]);

  const handleReset = useCallback((actionId: ShortcutActionId) => {
    resetBinding(actionId);
    setConflictAction(null);
  }, [resetBinding]);

  const handleResetAll = useCallback(() => {
    resetAllBindings();
    setConflictAction(null);
    setRecordingAction(null);
  }, [resetAllBindings]);

  const handleGlobalShortcut = useCallback((event: KeyboardEvent) => {
    const activeElement = document.activeElement;
    const tagName = activeElement?.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return;
    }
    if (document.querySelector('[role="dialog"][data-state="open"]')) {
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault();
      handleOpenChange(true);
    }
  }, [handleOpenChange]);

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [handleGlobalShortcut]);

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange} tier="standard-form">
      {trigger ? (
        <ResponsiveDialogTrigger asChild>
          {trigger}
        </ResponsiveDialogTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <ResponsiveDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={STARMAP_DIALOG_ICON_TRIGGER_CLASS}
                aria-label={t('shortcuts.keyboardShortcuts')}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </ResponsiveDialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{t('shortcuts.keyboardShortcuts')}</p>
          </TooltipContent>
        </Tooltip>
      )}
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <div className="flex items-center justify-between">
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              {t('shortcuts.keyboardShortcuts')}
            </ResponsiveDialogTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editing ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(!editing)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{editing ? t('shortcuts.doneEditing') : t('shortcuts.customize')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <ResponsiveDialogDescription>
            {editing ? t('shortcuts.editDescription') : t('shortcuts.description')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <CommandRoot shouldFilter={false} className="rounded-lg border">
          <CommandInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={t('shortcuts.searchPlaceholder')}
            data-testid="shortcuts-search-input"
          />
          <CommandList className="max-h-[56vh] max-h-[56dvh]">
            {filteredGroups.length === 0 ? (
              <CommandEmpty>{t('shortcuts.noResults')}</CommandEmpty>
            ) : (
              <div className="space-y-4 p-2">
                {filteredGroups.map((group, index) => {
                  const IconComponent = ICON_MAP[group.iconName];
                  return (
                    <div key={group.titleKey}>
                      {index > 0 && <Separator className="my-3" />}
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-primary">
                          {IconComponent && <IconComponent className="h-4 w-4" />}
                        </span>
                        <h3 className="text-sm font-medium">
                          {t(`shortcuts.${group.titleKey}`)}
                        </h3>
                      </div>
                      <div className="space-y-0.5 pl-6">
                        {group.shortcuts.map((shortcut) =>
                          editing ? (
                            <ShortcutKeyRowEdit
                              key={(shortcut.actionId || shortcut.key) + shortcut.descriptionKey}
                              shortcut={shortcut}
                              recordingAction={recordingAction}
                              conflictAction={conflictAction}
                              onCapture={handleCapture}
                              onStartRecording={handleStartRecording}
                              onReset={handleReset}
                              t={t}
                            />
                          ) : (
                            <ShortcutKeyRowView
                              key={(shortcut.actionId || shortcut.key) + shortcut.descriptionKey}
                              shortcut={shortcut}
                              t={t}
                            />
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CommandList>
        </CommandRoot>

        <div className="pt-2 border-t flex items-center justify-between">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={handleResetAll}
              >
                <RotateCcw className="h-3 w-3" />
                {t('shortcuts.resetAll')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('shortcuts.clickToEdit')}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center w-full">
              {t('shortcuts.pressQuestionMark')}
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
