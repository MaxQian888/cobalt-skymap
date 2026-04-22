/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock hooks
jest.mock('@/lib/hooks', () => ({
  useTonightRecommendations: jest.fn(() => ({
    recommendations: [],
    conditions: {
      moonPhase: 0.25,
      moonIllumination: 50,
      moonPhaseName: 'First Quarter',
      darkHoursStart: new Date(),
      darkHoursEnd: new Date(),
      totalDarkHours: 8,
      latitude: 40.7128,
      longitude: -74.006,
      twilight: {
        sunset: new Date(),
        sunrise: new Date(),
        civilDusk: new Date(),
        civilDawn: new Date(),
        nauticalDusk: new Date(),
        nauticalDawn: new Date(),
        astronomicalDusk: new Date(),
        astronomicalDawn: new Date(),
      },
      currentTime: new Date(),
    },
    isLoading: false,
    refresh: jest.fn(),
    planDate: new Date('2024-06-15T00:00:00'),
    setPlanDate: jest.fn(),
  })),
  useGeolocation: jest.fn(() => ({
    latitude: 40.7128,
    longitude: -74.006,
    error: null,
    loading: false,
  })),
}));

// Mock stores with selector pattern
const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    stel: null,
    isReady: true,
    setViewDirection: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseTargetListStore = jest.fn((selector) => {
  const state = {
    addTarget: jest.fn(),
    targets: [],
    setScoreProfile: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Latitude: 40.7128,
        Longitude: -74.006,
      },
    },
    setProfileInfo: jest.fn(),
  };
  return selector ? selector(state) : state;
});

const mockUsePlanningUiStore = jest.fn((selector) => {
  const state = {
    tonightRecommendationsOpen: false,
    setTonightRecommendationsOpen: jest.fn(),
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
  usePlanningUiStore: (selector: (state: unknown) => unknown) => mockUsePlanningUiStore(selector),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) => mockUseTargetListStore(selector),
}));

// Mock utils
jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: jest.fn(() => '00h 00m 00s'),
  degreesToDMS: jest.fn(() => '+00° 00\' 00"'),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock TranslatedName
jest.mock('../../objects/translated-name', () => ({
  TranslatedName: ({ name }: { name: string }) => <span data-testid="translated-name">{name}</span>,
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

import { TonightRecommendations } from '../tonight-recommendations';

describe('TonightRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<TonightRecommendations />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('renders dialog trigger button', () => {
    render(<TonightRecommendations />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders dialog content', () => {
    render(<TonightRecommendations />);
    expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('renders dialog header', () => {
    render(<TonightRecommendations />);
    expect(screen.getByTestId('dialog-header')).toBeInTheDocument();
  });

  it('renders dialog title', () => {
    render(<TonightRecommendations />);
    expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
  });

  it('renders dialog title', () => {
    render(<TonightRecommendations />);
    expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
  });

  it('renders multiple buttons', () => {
    render(<TonightRecommendations />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders multiple buttons', () => {
    render(<TonightRecommendations />);
    const buttons = screen.getAllByTestId('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('renders tooltip components', () => {
    render(<TonightRecommendations />);
    const tooltips = screen.getAllByTestId('tooltip');
    expect(tooltips.length).toBeGreaterThanOrEqual(1);
  });

  it('uses themed surface styling for tonight conditions', () => {
    const { container } = render(<TonightRecommendations />);
    const themedConditions = container.querySelector('.theme-surface-strong');

    expect(themedConditions).toBeInTheDocument();
    expect(themedConditions?.className).not.toContain('from-slate');
    expect(themedConditions?.className).not.toContain('border-slate');
    expect(themedConditions?.className).not.toContain('text-slate');
  });
});


