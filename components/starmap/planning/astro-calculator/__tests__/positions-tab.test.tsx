/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PositionsTab } from '../positions-tab';

const mockComputeEphemeris = jest.fn();
const mockAngularSeparation = jest.fn();
const mockInitializeSkyAtlas = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/catalogs', () => ({
  useSkyAtlasStore: () => ({
    catalog: [
      {
        name: 'M31',
        type: 'Galaxy',
        ra: 10.684,
        dec: 41.269,
        magnitude: 3.4,
        sizeMax: 190,
        constellation: 'And',
      },
    ],
  }),
  initializeSkyAtlas: (...args: unknown[]) => mockInitializeSkyAtlas(...args),
  DSO_TYPE_LABELS: { Galaxy: 'Galaxy' },
  CONSTELLATION_NAMES: { And: 'Andromeda' },
}));

jest.mock('@/lib/astronomy/engine', () => ({
  computeEphemeris: (...args: unknown[]) => mockComputeEphemeris(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

jest.mock('@/lib/astronomy/coordinates/transforms', () => ({
  raDecToAltAzAtTime: () => ({ altitude: 45, azimuth: 120 }),
  raDecToGalactic: () => ({ l: 123.456, b: -12.34 }),
  raDecToEcliptic: () => ({ longitude: 210.987, latitude: 6.54 }),
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  calculateTargetVisibility: () => ({
    transitTime: new Date('2025-01-01T12:00:00Z'),
    transitAltitude: 70,
  }),
  angularSeparation: (...args: unknown[]) => mockAngularSeparation(...args),
  formatTimeShort: () => '12:00',
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
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

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ''} onChange={onChange} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: React.PropsWithChildren<{ htmlFor?: string; className?: string }>) => (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
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

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
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

jest.mock('../sortable-header', () => ({
  SortableHeader: ({ label }: { label: string }) => <th>{label}</th>,
}));

describe('PositionsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAngularSeparation.mockImplementation((_ra: number, _dec: number, referenceRa: number) =>
      referenceRa === 100 ? 55 : 20
    );
    mockComputeEphemeris.mockImplementation(async ({ body }: { body: string }) => ({
      body,
      points: [
        {
          date: new Date('2025-01-01T00:00:00Z'),
          ra: body === 'Sun' ? 100 : 110,
          dec: body === 'Sun' ? 10 : 8,
          altitude: 0,
          azimuth: 0,
          galacticL: 0,
          galacticB: 0,
          eclipticLon: 0,
          eclipticLat: 0,
          magnitude: 0,
        },
      ],
      meta: { backend: 'fallback', model: 'test-model' },
    }));
  });

  it('loads solar references via engine and shows galactic/ecliptic columns', async () => {
    render(
      <PositionsTab
        latitude={39.9}
        longitude={116.4}
        onSelectObject={jest.fn()}
        onAddToList={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(mockComputeEphemeris).toHaveBeenCalledWith(expect.objectContaining({ body: 'Sun' }));
      expect(mockComputeEphemeris).toHaveBeenCalledWith(expect.objectContaining({ body: 'Moon' }));
    });

    expect(screen.queryByText('astroCalc.galacticL')).not.toBeInTheDocument();
    expect(screen.queryByText('astroCalc.eclipticLon')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('astroCalc.showGalactic'));
    fireEvent.click(screen.getByLabelText('astroCalc.showEcliptic'));

    await waitFor(() => {
      expect(screen.getByText('astroCalc.galacticL')).toBeInTheDocument();
      expect(screen.getByText('astroCalc.eclipticLon')).toBeInTheDocument();
      expect(screen.getByText('123.46')).toBeInTheDocument();
      expect(screen.getByText('210.99')).toBeInTheDocument();
      expect(screen.getByText('20.0')).toBeInTheDocument();
    });
  });
});
