/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as nextIntl from 'next-intl';

// Mock connectivity checker
jest.mock('@/lib/services/connectivity-checker', () => ({
  connectivityChecker: {
    getAllProviderHealth: jest.fn(() => []),
    getNetworkQuality: jest.fn(() => null),
    addHealthListener: jest.fn(() => () => {}),
    quickConnectivityTest: jest.fn(),
    checkAllProvidersHealth: jest.fn(() => Promise.resolve([])),
  },
}));

import { connectivityChecker } from '@/lib/services/connectivity-checker';

const mockConnectivityChecker = connectivityChecker as jest.Mocked<typeof connectivityChecker>;

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="card-description">{children}</p>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => (
    <table data-testid="table">{children}</table>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody data-testid="table-body">{children}</tbody>
  ),
  TableCell: ({ children, colSpan, className }: { children: React.ReactNode; colSpan?: number; className?: string }) => (
    <td data-testid="table-cell" colSpan={colSpan} className={className}>{children}</td>
  ),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <th data-testid="table-head" className={className}>{children}</th>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead data-testid="table-header">{children}</thead>
  ),
  TableRow: ({ children }: { children: React.ReactNode }) => (
    <tr data-testid="table-row">{children}</tr>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

import { MapHealthMonitor } from '@/components/starmap/map/map-health-monitor';

describe('MapHealthMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectivityChecker.getAllProviderHealth.mockReturnValue([]);
    mockConnectivityChecker.getNetworkQuality.mockReturnValue({ isOnline: false, successRate: 0, averageResponseTime: 0 });
    mockConnectivityChecker.addHealthListener.mockReturnValue(() => {});
    mockConnectivityChecker.quickConnectivityTest.mockResolvedValue(true);
    mockConnectivityChecker.checkAllProvidersHealth.mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('renders health monitor card', () => {
      render(<MapHealthMonitor />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('renders card title', () => {
      render(<MapHealthMonitor />);
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
    });

    it('renders card description', () => {
      render(<MapHealthMonitor />);
      expect(screen.getByTestId('card-description')).toBeInTheDocument();
    });

    it('renders refresh button', () => {
      render(<MapHealthMonitor />);
      expect(screen.getByText(/common\.refresh|Refresh/)).toBeInTheDocument();
    });

    it('renders provider table', () => {
      render(<MapHealthMonitor />);
      expect(screen.getByTestId('table')).toBeInTheDocument();
    });

    it('passes className to card', () => {
      render(<MapHealthMonitor className="custom-class" />);
      expect(screen.getByTestId('card')).toHaveAttribute('class', 'custom-class');
    });

    it('renders fallback labels when translations return empty strings', () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<MapHealthMonitor />);

        expect(screen.getByText('Provider Health')).toBeInTheDocument();
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });
  });

  describe('Compact Mode', () => {
    it('renders compact view when compact prop is true', () => {
      render(<MapHealthMonitor compact />);
      expect(screen.queryByTestId('card-title')).not.toBeInTheDocument();
    });

    it('shows provider count in compact mode', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
        { provider: 'google', isHealthy: true, successRate: 1, responseTime: 150, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
      ]);

      render(<MapHealthMonitor compact />);
      expect(screen.getByText('2/2')).toBeInTheDocument();
    });

    it('shows tooltip content in compact mode', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
      ]);
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        successRate: 1,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor compact />);
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });
  });

  describe('Network Status', () => {
    it('shows online status when network is online', () => {
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        effectiveConnectionType: '4g',
        downlink: 10,
        rtt: 50,
        successRate: 1,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.online|Online/)).toBeInTheDocument();
    });

    it('shows offline status when network is offline', () => {
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: false,
        successRate: 0,
        averageResponseTime: 0,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.offline|Offline/)).toBeInTheDocument();
    });

    it('shows connection type when available', () => {
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        effectiveConnectionType: '4g',
        downlink: 10,
        rtt: 50,
        successRate: 1,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText(/4G/)).toBeInTheDocument();
    });

    it('shows success rate percentage', () => {
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        successRate: 0.95,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText('95%')).toBeInTheDocument();
    });
  });

  describe('Provider Health', () => {
    it('shows empty message when no providers', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([]);

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.noProviders|No providers configured/)).toBeInTheDocument();
    });

    it('displays provider health status', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: true,
          successRate: 1,
          responseTime: 100,
          errorCount: 0,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText('openstreetmap')).toBeInTheDocument();
    });

    it('renders an indeterminate provider status when health is undefined', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: undefined as unknown as boolean,
          successRate: 0.6,
          responseTime: 250,
          errorCount: 1,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);

      expect(screen.getByText('openstreetmap')).toBeInTheDocument();
      expect(screen.getByText(/map\.degraded|Degraded/)).toBeInTheDocument();
    });

    it('shows healthy badge for healthy provider', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: true,
          successRate: 1,
          responseTime: 100,
          errorCount: 0,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getAllByText(/map\.healthy|Healthy/).length).toBeGreaterThan(0);
    });

    it('shows degraded badge for partially healthy provider', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: false,
          successRate: 0.7,
          responseTime: 2000,
          errorCount: 3,
          lastChecked: Date.now(),
          status: { isConnected: false, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.degraded|Degraded/)).toBeInTheDocument();
    });

    it('shows unhealthy badge for unhealthy provider', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: false,
          successRate: 0.3,
          responseTime: 5000,
          errorCount: 7,
          lastChecked: Date.now(),
          status: { isConnected: false, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.unhealthy|Unhealthy/)).toBeInTheDocument();
    });

    it('displays response time', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: true,
          successRate: 1,
          responseTime: 150,
          errorCount: 0,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText('150ms')).toBeInTheDocument();
    });

    it('formats response time in seconds when > 1000ms', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: false,
          successRate: 0.5,
          responseTime: 2500,
          errorCount: 5,
          lastChecked: Date.now(),
          status: { isConnected: false, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText('2.5s')).toBeInTheDocument();
    });

    it('displays success rate with progress bar', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        {
          provider: 'openstreetmap',
          isHealthy: true,
          successRate: 0.85,
          responseTime: 100,
          errorCount: 2,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('calls checkAllProvidersHealth when refresh clicked', async () => {
      render(<MapHealthMonitor />);

      const refreshButton = screen.getByText(/common\.refresh|Refresh/);
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockConnectivityChecker.checkAllProvidersHealth).toHaveBeenCalled();
      });
    });

    it('disables refresh button while refreshing', async () => {
      mockConnectivityChecker.checkAllProvidersHealth.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<MapHealthMonitor />);

      const refreshButton = screen.getByText(/common\.refresh|Refresh/);
      
      await act(async () => {
        fireEvent.click(refreshButton);
      });

      expect(refreshButton).toBeDisabled();
    });
  });

  describe('Statistics', () => {
    it('displays average response time', () => {
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        successRate: 1,
        averageResponseTime: 125,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText('125ms')).toBeInTheDocument();
    });

    it('displays healthy provider count', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
        { provider: 'google', isHealthy: true, successRate: 1, responseTime: 150, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
        { provider: 'mapbox', isHealthy: false, successRate: 0.5, responseTime: 2000, errorCount: 5, lastChecked: Date.now(), status: { isConnected: false, lastChecked: Date.now() } },
      ]);
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        successRate: 1,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays total error count', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 1, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
        { provider: 'google', isHealthy: false, successRate: 0.8, responseTime: 500, errorCount: 4, lastChecked: Date.now(), status: { isConnected: false, lastChecked: Date.now() } },
      ]);
      mockConnectivityChecker.getNetworkQuality.mockReturnValue({
        isOnline: true,
        successRate: 1,
        averageResponseTime: 100,
      });

      render(<MapHealthMonitor />);
      // Total errors: 1 + 4 = 5
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('Last Updated', () => {
    it('displays last updated time', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
      ]);

      render(<MapHealthMonitor />);
      expect(screen.getByText(/map\.lastUpdated|Last updated/)).toBeInTheDocument();
    });
  });

  describe('Health Listener', () => {
    it('subscribes to health updates on mount', () => {
      render(<MapHealthMonitor />);
      expect(mockConnectivityChecker.addHealthListener).toHaveBeenCalled();
    });

    it('unsubscribes from health updates on unmount', () => {
      const unsubscribe = jest.fn();
      mockConnectivityChecker.addHealthListener.mockReturnValue(unsubscribe);

      const { unmount } = render(<MapHealthMonitor />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('updates provider health when listener callback fires for new provider', () => {
      let healthCallback: ((status: import('@/lib/services/connectivity-checker').ProviderHealthStatus) => void) | undefined;
      mockConnectivityChecker.addHealthListener.mockImplementation((callback) => {
        healthCallback = callback;
        return () => {};
      });

      render(<MapHealthMonitor />);

      act(() => {
        healthCallback?.({
          provider: 'openstreetmap',
          isHealthy: true,
          successRate: 1,
          responseTime: 100,
          errorCount: 0,
          lastChecked: Date.now(),
          status: { isConnected: true, lastChecked: Date.now() },
        });
      });

      expect(screen.getByText('openstreetmap')).toBeInTheDocument();
    });

    it('updates existing provider health when listener callback fires', () => {
      mockConnectivityChecker.getAllProviderHealth.mockReturnValue([
        { provider: 'openstreetmap', isHealthy: true, successRate: 1, responseTime: 100, errorCount: 0, lastChecked: Date.now(), status: { isConnected: true, lastChecked: Date.now() } },
      ]);

      let healthCallback: ((status: import('@/lib/services/connectivity-checker').ProviderHealthStatus) => void) | undefined;
      mockConnectivityChecker.addHealthListener.mockImplementation((callback) => {
        healthCallback = callback;
        return () => {};
      });

      render(<MapHealthMonitor />);

      // Update existing provider to unhealthy
      act(() => {
        healthCallback?.({
          provider: 'openstreetmap',
          isHealthy: false,
          successRate: 0.3,
          responseTime: 5000,
          errorCount: 7,
          lastChecked: Date.now(),
          status: { isConnected: false, lastChecked: Date.now() },
        });
      });

      expect(screen.getByText(/map\.unhealthy|Unhealthy/)).toBeInTheDocument();
    });
  });

  describe('RefreshToken', () => {
    it('reloads data when refreshToken changes', () => {
      const { rerender } = render(<MapHealthMonitor refreshToken={0} />);

      const callCount = mockConnectivityChecker.getAllProviderHealth.mock.calls.length;

      rerender(<MapHealthMonitor refreshToken={1} />);

      expect(mockConnectivityChecker.getAllProviderHealth.mock.calls.length).toBeGreaterThan(callCount);
    });
  });
});
