/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { AstroCalculatorDialog } from '../astro-calculator-dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/starmap/dialogs/responsive-dialog-shell', () => ({
  ResponsiveDialog: ({ children }: React.PropsWithChildren) => (
    <div data-testid="responsive-dialog">{children}</div>
  ),
  ResponsiveDialogContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="responsive-dialog-content" className={className}>
      {children}
    </div>
  ),
  ResponsiveDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ResponsiveDialogTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  ResponsiveDialogTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: React.PropsWithChildren) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-slot="tabs-list" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({ children, value, className }: React.PropsWithChildren<{ value: string; className?: string }>) => (
    <button type="button" className={className} data-value={value}>
      {children}
    </button>
  ),
  TabsContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <span className={className}>{children}</span>
  ),
}));

const mockSetViewDirection = jest.fn();
const mockAddTarget = jest.fn();

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (state: unknown) => unknown) =>
    selector({
      profileInfo: {
        AstrometrySettings: {
          Latitude: 39.9042,
          Longitude: 116.4074,
        },
      },
    }),
  useStellariumStore: (selector: (state: unknown) => unknown) =>
    selector({
      setViewDirection: mockSetViewDirection,
    }),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) =>
    selector({
      addTarget: mockAddTarget,
    }),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value}h`,
  degreesToDMS: (value: number) => `${value}d`,
}));

jest.mock('../astro-calculator', () => ({
  PositionsTab: ({
    onSelectObject,
    onAddToList,
  }: {
    onSelectObject: (ra: number, dec: number) => void;
    onAddToList: (name: string, ra: number, dec: number) => void;
  }) => (
    <div data-testid="tab-positions">
      <button type="button" onClick={() => onSelectObject(12.3, 45.6)}>
        select target
      </button>
      <button type="button" onClick={() => onAddToList('M31', 12.3, 45.6)}>
        add target
      </button>
    </div>
  ),
  WUTTab: () => <div data-testid="tab-wut" />,
  RTSTab: () => <div data-testid="tab-rts" />,
  EphemerisTab: () => <div data-testid="tab-ephemeris" />,
  AlmanacTab: () => <div data-testid="tab-almanac" />,
  PhenomenaTab: () => <div data-testid="tab-phenomena" />,
  CoordinateTab: () => <div data-testid="tab-coordinate" />,
  TimeTab: () => <div data-testid="tab-time" />,
  SolarSystemTab: () => <div data-testid="tab-solar-system" />,
  ASTRO_CALCULATOR_TAB_ORDER: [
    'wut',
    'positions',
    'rts',
    'ephemeris',
    'almanac',
    'phenomena',
    'coordinate',
    'time',
    'solar-system',
  ],
  ASTRO_CALCULATOR_CAPABILITY_MATRIX: {
    wut: { labelKey: 'astroCalc.wut' },
    positions: { labelKey: 'astroCalc.positions' },
    rts: { labelKey: 'astroCalc.rts' },
    ephemeris: { labelKey: 'astroCalc.ephemeris' },
    almanac: { labelKey: 'astroCalc.almanac' },
    phenomena: { labelKey: 'astroCalc.phenomena' },
    coordinate: { labelKey: 'astroCalc.coordinate' },
    time: { labelKey: 'astroCalc.timeCalc' },
    'solar-system': { labelKey: 'astroCalc.solarSystem' },
  },
}));

describe('AstroCalculatorDialog', () => {
  it('renders the dialog trigger, title, location badge, and all tab labels', () => {
    render(<AstroCalculatorDialog />);

    expect(screen.getAllByText('astroCalc.title').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('39.90°, 116.41°')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.wut')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.positions')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.rts')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.ephemeris')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.almanac')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.phenomena')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.coordinate')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.timeCalc')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.solarSystem')).toBeInTheDocument();
  });

  it('keeps the responsive tab navigation shell and renders all tab panels', () => {
    render(<AstroCalculatorDialog />);

    const nav = screen.getByTestId('astro-calculator-tab-nav');
    expect(nav.className).toContain('overflow-x-auto');

    const tabsList = screen.getByTestId('tabs').querySelector('[data-slot="tabs-list"]');
    expect(tabsList).not.toBeNull();
    expect(tabsList?.className).toContain('inline-flex');
    expect(tabsList?.className).toContain('sm:grid');
    expect(screen.getByTestId('tab-coordinate')).toBeInTheDocument();
    expect(screen.getByTestId('tab-time')).toBeInTheDocument();
    expect(screen.getByTestId('tab-solar-system')).toBeInTheDocument();
  });

  it('wires selection and add-to-list callbacks through the tab props', () => {
    render(<AstroCalculatorDialog />);

    screen.getByRole('button', { name: 'select target' }).click();
    screen.getByRole('button', { name: 'add target' }).click();

    expect(mockSetViewDirection).toHaveBeenCalledWith(12.3, 45.6);
    expect(mockAddTarget).toHaveBeenCalledWith({
      name: 'M31',
      ra: 12.3,
      dec: 45.6,
      raString: '12.3h',
      decString: '45.6d',
      priority: 'medium',
    });
  });
});
