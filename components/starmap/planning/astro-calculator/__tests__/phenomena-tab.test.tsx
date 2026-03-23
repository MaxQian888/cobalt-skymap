/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PhenomenaTab } from '../phenomena-tab';

const mockSearchPhenomena = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/astronomy/engine', () => ({
  searchPhenomena: (...args: unknown[]) => mockSearchPhenomena(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked }: { checked?: boolean }) => <input type="checkbox" readOnly checked={checked} />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

describe('PhenomenaTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchPhenomena.mockResolvedValue({
      events: [
        {
          date: new Date('2025-01-20T00:00:00Z'),
          type: 'conjunction',
          object1: 'Moon',
          object2: 'Venus',
          separation: 1.2,
          details: 'Moon conjunction Venus',
          importance: 'high',
          source: 'computed',
        },
      ],
      meta: { backend: 'fallback', model: 'test-model' },
    });
  });

  it('renders phenomena event list from engine results', async () => {
    render(<PhenomenaTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(mockSearchPhenomena).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Moon conjunction Venus')).toBeInTheDocument();
      expect(screen.getByText('astroCalc.eventType.conjunction')).toBeInTheDocument();
    });
  });
});
