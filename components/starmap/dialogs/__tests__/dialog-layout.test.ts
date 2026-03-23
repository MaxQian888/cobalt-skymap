/**
 * @jest-environment jsdom
 */

import {
  STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS,
  STARMAP_DIALOG_ICON_TRIGGER_CLASS,
  STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER,
  STARMAP_DIALOG_MOBILE_MEDIA_QUERY,
  STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS,
  STARMAP_DIALOG_SCROLL_BODY_CLASS,
  STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS,
} from '../dialog-layout';

describe('dialog-layout constants', () => {
  it('defines icon trigger class for dialog toolbar buttons', () => {
    expect(STARMAP_DIALOG_ICON_TRIGGER_CLASS).toContain('h-9');
    expect(STARMAP_DIALOG_ICON_TRIGGER_CLASS).toContain('w-9');
    expect(STARMAP_DIALOG_ICON_TRIGGER_CLASS).toContain('hover:bg-accent');
  });

  it('uses the expected mobile viewport media query', () => {
    expect(STARMAP_DIALOG_MOBILE_MEDIA_QUERY).toBe('(max-width: 640px)');
  });

  it('defines shared scroll classes for desktop and mobile dialog bodies', () => {
    expect(STARMAP_DIALOG_SCROLL_BODY_CLASS).toContain('85vh-13rem');
    expect(STARMAP_DIALOG_SCROLL_BODY_CLASS).toContain('85dvh-13rem');
    expect(STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS).toContain('overflow-y-auto');
    expect(STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS).toContain('touch-pan-y');
  });

  it('defines desktop and tier-specific mobile content classes', () => {
    expect(STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS).toContain('max-h-[88dvh]');
    expect(STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS).toContain('overflow-hidden');

    expect(Object.keys(STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER)).toEqual([
      'compact-confirmation',
      'standard-form',
      'complex-editor',
    ]);
    expect(STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER['compact-confirmation']).toContain(
      '78dvh'
    );
    expect(STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER['standard-form']).toContain('92dvh');
    expect(STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER['complex-editor']).toContain(
      'h-[100dvh]'
    );
  });

  it('defines sticky mobile footer class with safe-area support', () => {
    expect(STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS).toContain('sticky bottom-0');
    expect(STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS).toContain('--safe-area-bottom');
    expect(STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS).toContain('backdrop-blur');
  });
});
