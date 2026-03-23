/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TimeTab } from '../time-tab';
const translate = (key: string) => key;

jest.mock('next-intl', () => ({
  useTranslations: () => translate,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    ...props
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    [key: string]: unknown;
  }) => <input value={value ?? ''} onChange={onChange} {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
}));

describe('TimeTab', () => {
  it('renders the time scale and hour-angle panels for a valid datetime input', () => {
    render(<TimeTab longitude={116.4} />);

    expect(screen.getByText('astroCalc.timeScales')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.hourAngle')).toBeInTheDocument();
    expect(screen.getByText(/^JD:/)).toBeInTheDocument();
    expect(screen.getByText(/^GMST:/)).toBeInTheDocument();
  });

  it('shows a validation error when longitude is invalid', () => {
    render(<TimeTab longitude={116.4} />);

    fireEvent.change(screen.getByDisplayValue('116.400000'), {
      target: { value: 'east-ish' },
    });

    expect(screen.getByText('astroCalc.invalidLongitude')).toBeInTheDocument();
  });

  it('uses shared date/time props and forwards datetime-local edits back to the parent', () => {
    const onSharedDateChange = jest.fn();
    const onSharedTimeChange = jest.fn();

    render(
      <TimeTab
        longitude={116.4}
        sharedDate="2025-07-01"
        sharedTime="21:45"
        onSharedDateChange={onSharedDateChange}
        onSharedTimeChange={onSharedTimeChange}
      />,
    );

    const dateTimeInput = screen.getByDisplayValue('2025-07-01T21:45') as HTMLInputElement;
    expect(dateTimeInput).toBeInTheDocument();

    fireEvent.change(dateTimeInput, {
      target: { value: '2025-07-02T05:15' },
    });

    expect(onSharedDateChange).toHaveBeenCalledWith('2025-07-02');
    expect(onSharedTimeChange).toHaveBeenCalledWith('05:15');
  });

  it('switches between datetime, JD, and MJD input modes', () => {
    render(<TimeTab longitude={116.4} />);

    const modeSelect = screen.getByRole('combobox');
    fireEvent.change(modeSelect, { target: { value: 'jd' } });
    expect(screen.getByDisplayValue('2460400.500000')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('2460400.500000'), {
      target: { value: '2460500.500000' },
    });
    expect(screen.getByDisplayValue('2460500.500000')).toBeInTheDocument();

    fireEvent.change(modeSelect, { target: { value: 'mjd' } });
    expect(screen.getByDisplayValue('60400.000000')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('60400.000000'), {
      target: { value: '60500.500000' },
    });
    expect(screen.getByDisplayValue('60500.500000')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('00:00:00'), {
      target: { value: '12:34:56' },
    });
    expect(screen.getByDisplayValue('12:34:56')).toBeInTheDocument();
  });
});
