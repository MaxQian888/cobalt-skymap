/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { getVisibleDependencies } from '@/lib/constants/about-data';
import {
  getDialogMobileRequirement,
  STARMAP_DIALOG_ROLLOUT_ORDER,
} from '../mobile-dialog-inventory';

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => <p data-testid="dialog-description" className={className}>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    asChild?: boolean;
  }) => (
    asChild ? <>{children}</> : <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs">{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-content">{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button data-testid="tabs-trigger">{children}</button>,
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

jest.mock('../stellarium-credits', () => ({
  StellariumCredits: () => <div data-testid="stellarium-credits">Stellarium Credits</div>,
}));

jest.mock('../feedback-dialog', () => ({
  FeedbackDialog: () => <div data-testid="feedback-dialog">Feedback Dialog</div>,
}));

import { AboutDialog } from '../about-dialog';

describe('AboutDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error test cleanup
    delete window.__TAURI__;
    // @ts-expect-error test cleanup
    delete window.__TAURI_INTERNALS__;
  });

  it('renders without crashing', () => {
    render(<AboutDialog />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger button', () => {
    render(<AboutDialog />);
    expect(screen.getByTestId('about-button')).toBeInTheDocument();
  });

  it('renders dialog content', () => {
    render(<AboutDialog />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders tabs component', () => {
    render(<AboutDialog />);
    expect(screen.getByTestId('tabs')).toBeInTheDocument();
  });

  it('trigger button has aria-label for accessibility', () => {
    render(<AboutDialog />);
    const triggerButton = screen.getByTestId('about-button');
    expect(triggerButton).toHaveAttribute('aria-label');
  });

  it('renders StellariumCredits component in data credits section', () => {
    render(<AboutDialog />);
    expect(screen.getByTestId('stellarium-credits')).toBeInTheDocument();
  });

  it('renders DialogDescription for accessibility', () => {
    render(<AboutDialog />);
    const description = screen.getByTestId('dialog-description');
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass('sr-only');
  });

  it('renders three tab triggers', () => {
    render(<AboutDialog />);
    const tabTriggers = screen.getAllByTestId('tabs-trigger');
    expect(tabTriggers).toHaveLength(3);
  });

  it('displays version info from environment variable', () => {
    render(<AboutDialog />);
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });

  it('renders license cards', () => {
    render(<AboutDialog />);
    expect(screen.getByText('Stellarium Web Engine')).toBeInTheDocument();
    expect(screen.getByText('Next.js')).toBeInTheDocument();
  });

  it('renders dependency rows', () => {
    render(<AboutDialog />);
    expect(screen.getByText('next')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  it('renders report issue entry point and feedback dialog mount point', () => {
    render(<AboutDialog />);
    expect(screen.getByText('about.reportIssue')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument();
  });

  it('opens feedback dialog when report issue button is clicked', () => {
    render(<AboutDialog />);
    const reportBtn = screen.getByTestId('report-issue-button');
    expect(reportBtn).toBeInTheDocument();
    fireEvent.click(reportBtn);
    // FeedbackDialog is rendered as mock, so we verify the button is clickable
    expect(screen.getByTestId('feedback-dialog')).toBeInTheDocument();
  });

  it('renders data credit rows with links', () => {
    render(<AboutDialog />);
    // Data credits from about-data.ts
    expect(screen.getByText('about.credit.hipsSurveys')).toBeInTheDocument();
    expect(screen.getByText('CDS, Strasbourg')).toBeInTheDocument();
  });

  it('renders copyright with current year', () => {
    render(<AboutDialog />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
  });

  it('renders total dependencies count', () => {
    render(<AboutDialog />);
    expect(screen.getByText(/about.totalDeps/)).toBeInTheDocument();
  });

  it('hides desktop-only dependencies in web runtime', () => {
    render(<AboutDialog />);

    expect(screen.queryByText('@tauri-apps/api')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dependency-group-desktop')).not.toBeInTheDocument();
  });

  it('shows desktop dependency group in tauri runtime', () => {
    // @ts-expect-error runtime marker for test
    window.__TAURI__ = {};

    render(<AboutDialog />);

    expect(screen.getByTestId('dependency-group-desktop')).toBeInTheDocument();
    expect(screen.getByText('@tauri-apps/api')).toBeInTheDocument();
  });

  it('renders the visible dependency rows for the active runtime', () => {
    render(<AboutDialog />);

    expect(screen.getAllByTestId('dependency-row')).toHaveLength(getVisibleDependencies(false).length);
  });

  it('registers the about dialog in the mobile dialog inventory', () => {
    const requirement = getDialogMobileRequirement('about-dialog');

    expect(requirement).toMatchObject({
      id: 'about-dialog',
      area: 'dialogs',
      tier: 'complex-editor',
      mobileMode: 'full-screen',
      stickyFooter: false,
      closeBehavior: 'deterministic-close',
    });
  });

  it('keeps dialog rollout order sorted by priority and returns null for unknown ids', () => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 } as const;
    const priorities = STARMAP_DIALOG_ROLLOUT_ORDER.map((id) => {
      const requirement = getDialogMobileRequirement(id);
      expect(requirement).not.toBeNull();
      return priorityOrder[requirement!.rolloutPriority];
    });

    expect(priorities).toEqual([...priorities].sort((left, right) => left - right));
    expect(getDialogMobileRequirement('missing-dialog')).toBeNull();
  });
});
