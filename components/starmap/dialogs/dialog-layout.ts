export const STARMAP_DIALOG_ICON_TRIGGER_CLASS =
  'h-9 w-9 text-foreground/80 hover:bg-accent hover:text-foreground';

export type StarmapDialogTier =
  | 'compact-confirmation'
  | 'standard-form'
  | 'complex-editor'
  | 'custom';

export const STARMAP_DIALOG_SCROLL_BODY_CLASS =
  'max-h-[calc(85vh-13rem)] max-h-[calc(85dvh-13rem)]';

export const STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS =
  'overflow-y-auto overscroll-contain touch-pan-y';

export const STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS =
  'max-h-[88vh] max-h-[88dvh] overflow-hidden';

export const STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER: Record<
  Exclude<StarmapDialogTier, 'custom'>,
  string
> = {
  'compact-confirmation': 'max-h-[78vh] max-h-[78dvh]',
  'standard-form': 'max-h-[92vh] max-h-[92dvh]',
  'complex-editor':
    'h-[100vh] h-[100dvh] max-h-[100vh] max-h-[100dvh] rounded-none border-x-0 border-b-0',
};

export const STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS =
  'sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 pb-[calc(var(--safe-area-bottom)+0.5rem)]';
