/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '../responsive-dialog-shell';
import {
  STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS,
  STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER,
  STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS,
  STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS,
} from '../dialog-layout';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches,
      media: '(max-width: 640px)',
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    onOpenChange,
  }: React.PropsWithChildren<{ onOpenChange?: (open: boolean) => void }>) => (
    <div data-testid="dialog-root">
      <button data-testid="dialog-close-action" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      {children}
    </div>
  ),
  DialogTrigger: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  DialogContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="dialog-content" data-classname={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="dialog-footer" data-classname={className}>
      {children}
    </div>
  ),
  DialogClose: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({
    children,
    onOpenChange,
  }: React.PropsWithChildren<{ onOpenChange?: (open: boolean) => void }>) => (
    <div data-testid="drawer-root">
      <button data-testid="drawer-close-action" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      {children}
    </div>
  ),
  DrawerTrigger: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  DrawerContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="drawer-content" data-classname={className}>
      {children}
    </div>
  ),
  DrawerHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DrawerFooter: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="drawer-footer" data-classname={className}>
      {children}
    </div>
  ),
  DrawerClose: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

describe('ResponsiveDialogShell', () => {
  it('uses desktop dialog by default', () => {
    mockMatchMedia(false);
    render(
      <ResponsiveDialog open={true} onOpenChange={jest.fn()} tier="standard-form">
        <ResponsiveDialogTrigger>Open desktop dialog</ResponsiveDialogTrigger>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Desktop</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Desktop description</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogClose>Dismiss desktop dialog</ResponsiveDialogClose>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );

    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-root')).not.toBeInTheDocument();
    expect(screen.getByText('Open desktop dialog')).toBeInTheDocument();
    expect(screen.getByText('Desktop description')).toBeInTheDocument();
    expect(screen.getByText('Dismiss desktop dialog')).toBeInTheDocument();
    expect(STARMAP_DIALOG_DESKTOP_CONTENT_BASE_CLASS).toContain('overflow-hidden');
    expect(screen.getByTestId('dialog-content').getAttribute('data-classname')).toContain(
      'max-h-[88dvh]'
    );
    expect(screen.getByTestId('dialog-content').getAttribute('data-classname')).toContain(
      'overflow-hidden'
    );
  });

  it('uses mobile drawer when viewport is mobile', () => {
    mockMatchMedia(true);
    render(
      <ResponsiveDialog open={true} onOpenChange={jest.fn()} tier="standard-form">
        <ResponsiveDialogTrigger>Open mobile dialog</ResponsiveDialogTrigger>
        <ResponsiveDialogContent mobileClassName="mobile-shell">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mobile</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Mobile description</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogClose>Dismiss mobile dialog</ResponsiveDialogClose>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );

    expect(screen.getByTestId('drawer-root')).toBeInTheDocument();
    expect(screen.queryByTestId('dialog-root')).not.toBeInTheDocument();
    expect(screen.getByText('Open mobile dialog')).toBeInTheDocument();
    expect(screen.getByText('Mobile description')).toBeInTheDocument();
    expect(screen.getByText('Dismiss mobile dialog')).toBeInTheDocument();
    expect(STARMAP_DIALOG_MOBILE_CONTENT_CLASS_BY_TIER['standard-form']).toContain(
      'max-h-[92dvh]'
    );
    expect(screen.getByTestId('drawer-content').getAttribute('data-classname')).toContain(
      'max-h-[92dvh]'
    );
    expect(screen.getByTestId('drawer-content').getAttribute('data-classname')).toContain(
      STARMAP_DIALOG_SCROLL_BODY_MOBILE_CLASS
    );
    expect(screen.getByTestId('drawer-content').getAttribute('data-classname')).toContain(
      'mobile-shell'
    );
  });

  it('keeps desktop dialog for custom tier even on mobile viewport', () => {
    mockMatchMedia(true);
    render(
      <ResponsiveDialog open={true} onOpenChange={jest.fn()} tier="custom">
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Custom</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );

    expect(screen.getByTestId('dialog-root')).toBeInTheDocument();
    expect(screen.queryByTestId('drawer-root')).not.toBeInTheDocument();
  });

  it('routes close interactions through one onOpenChange path', () => {
    mockMatchMedia(true);
    const onOpenChange = jest.fn();
    render(
      <ResponsiveDialog open={true} onOpenChange={onOpenChange} tier="standard-form">
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Close</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );

    fireEvent.click(screen.getByTestId('drawer-close-action'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies sticky mobile footer class only on mobile', () => {
    mockMatchMedia(true);
    const { unmount } = render(
      <ResponsiveDialog open={true} onOpenChange={jest.fn()}>
        <ResponsiveDialogContent>
          <ResponsiveDialogFooter stickyOnMobile>Actions</ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
    expect(screen.getByTestId('drawer-footer').getAttribute('data-classname')).toContain(
      STARMAP_DIALOG_MOBILE_STICKY_FOOTER_CLASS
    );

    unmount();
    mockMatchMedia(false);
    render(
      <ResponsiveDialog open={true} onOpenChange={jest.fn()}>
        <ResponsiveDialogContent>
          <ResponsiveDialogFooter stickyOnMobile>Actions</ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
    expect(
      screen.getByTestId('dialog-footer').getAttribute('data-classname') ?? ''
    ).not.toContain('sticky');
  });

  it('re-exports the responsive dialog shell from the dialogs entrypoint', () => {
    jest.isolateModules(() => {
      jest.doMock('../about-dialog', () => ({ AboutDialog: 'AboutDialogMock' }));
      jest.doMock('../feedback-dialog', () => ({ FeedbackDialog: 'FeedbackDialogMock' }));
      jest.doMock('../keyboard-shortcuts-dialog', () => ({
        KeyboardShortcutsDialog: 'KeyboardShortcutsDialogMock',
      }));
      jest.doMock('../stellarium-credits', () => ({
        StellariumCredits: 'StellariumCreditsMock',
      }));
      jest.doMock('../responsive-dialog-shell', () => ({
        ResponsiveDialog: 'ResponsiveDialogMock',
        ResponsiveDialogClose: 'ResponsiveDialogCloseMock',
        ResponsiveDialogContent: 'ResponsiveDialogContentMock',
        ResponsiveDialogDescription: 'ResponsiveDialogDescriptionMock',
        ResponsiveDialogFooter: 'ResponsiveDialogFooterMock',
        ResponsiveDialogHeader: 'ResponsiveDialogHeaderMock',
        ResponsiveDialogTitle: 'ResponsiveDialogTitleMock',
        ResponsiveDialogTrigger: 'ResponsiveDialogTriggerMock',
      }));

      const dialogs = jest.requireActual<typeof import('../index')>('../index');

      expect(dialogs.ResponsiveDialog).toBe('ResponsiveDialogMock');
      expect(dialogs.ResponsiveDialogTrigger).toBe('ResponsiveDialogTriggerMock');
      expect(dialogs.ResponsiveDialogClose).toBe('ResponsiveDialogCloseMock');
      expect(dialogs.ResponsiveDialogDescription).toBe('ResponsiveDialogDescriptionMock');
    });
  });
});
