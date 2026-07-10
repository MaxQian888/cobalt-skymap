/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WUTTab } from '../wut-tab';

const mockCalculateTargetVisibility = jest.fn();
const mockCalculateImagingFeasibility = jest.fn();
function atLocalHour(hour: number, dayOffset = 0) {
  const date = new Date(2025, 0, 1 + dayOffset, 0, 0, 0, 0);
  date.setHours(hour, 0, 0, 0);
  return date;
}

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/catalogs', () => ({
  useSkyAtlasStore: () => ({
    catalog: [
      {
        name: 'M101',
        type: 'Galaxy',
        ra: 10,
        dec: 40,
        magnitude: 8.1,
        sizeMax: 20,
        constellation: 'UMa',
      },
      {
        name: 'M102',
        type: 'Galaxy',
        ra: 20,
        dec: 45,
        magnitude: 9.0,
        sizeMax: 18,
        constellation: 'Dra',
      },
      {
        name: 'M103',
        type: 'Galaxy',
        ra: 30,
        dec: 50,
        magnitude: 9.2,
        sizeMax: 15,
        constellation: 'Cas',
      },
    ],
  }),
  DSO_TYPE_LABELS: { Galaxy: 'Galaxy' },
  CONSTELLATION_NAMES: { UMa: 'Ursa Major', Dra: 'Draco', Cas: 'Cassiopeia' },
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  calculateTwilightTimes: () => ({
    astronomicalDusk: atLocalHour(20),
    astronomicalDawn: atLocalHour(5, 1),
    darknessDuration: 8,
    isCurrentlyNight: true,
  }),
  calculateTargetVisibility: (...args: unknown[]) => mockCalculateTargetVisibility(...args),
  calculateImagingFeasibility: (...args: unknown[]) => mockCalculateImagingFeasibility(...args),
  getMoonPhase: () => 0.5,
  getMoonPhaseName: () => 'First Quarter',
  getMoonIllumination: () => 50,
  formatTimeShort: (date: Date | null) => (date ? `${date.getUTCHours()}:00` : '--'),
}));

jest.mock('@/components/starmap/objects/translated-name', () => ({
  TranslatedName: ({ name }: { name: string }) => <span>{name}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void }>) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: React.PropsWithChildren<{ htmlFor?: string }>) => <label htmlFor={htmlFor}>{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange?: (value: number[]) => void }) => (
    <input
      type="range"
      value={value?.[0] ?? 0}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
    />
  ),
}));

jest.mock('@/components/ui/select', () => {
  const SelectContext = React.createContext<(value: string) => void>(() => undefined);

  return {
    Select: ({ children, onValueChange }: React.PropsWithChildren<{ onValueChange?: (value: string) => void }>) => (
      <SelectContext.Provider value={onValueChange ?? (() => undefined)}>
        <div>{children}</div>
      </SelectContext.Provider>
    ),
    SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => {
      const onValueChange = React.useContext(SelectContext);
      return <button type="button" onClick={() => onValueChange(value)}>{children}</button>;
    },
    SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    SelectValue: () => <span />,
  };
});

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
  TableBody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
  TableRow: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <tr onClick={onClick}>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
}));

describe('WUTTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCalculateImagingFeasibility.mockReturnValue({ score: 80 });
    mockCalculateTargetVisibility.mockImplementation((ra: number) => {
      const transitByRa = new Map<number, Date>([
        [10, atLocalHour(23)],
        [20, atLocalHour(1, 1)],
        [30, atLocalHour(21)],
      ]);

      return {
        riseTime: atLocalHour(18),
        transitTime: transitByRa.get(ra) ?? atLocalHour(0),
        setTime: atLocalHour(6, 1),
        transitAltitude: 55,
      };
    });
  });

  it('filters midnight window correctly across day boundary', async () => {
    render(
      <WUTTab
        latitude={39.9}
        longitude={116.4}
        onSelectObject={jest.fn()}
        onAddToList={jest.fn()}
      />
    );

    expect(screen.getByText('M101')).toBeInTheDocument();
    expect(screen.getByText('M102')).toBeInTheDocument();
    expect(screen.getByText('M103')).toBeInTheDocument();

    fireEvent.click(screen.getByText('astroCalc.midnight'));

    await waitFor(() => {
      expect(screen.getByText('M101')).toBeInTheDocument();
      expect(screen.getByText('M102')).toBeInTheDocument();
      expect(screen.queryByText('M103')).not.toBeInTheDocument();
    });
  });
});
