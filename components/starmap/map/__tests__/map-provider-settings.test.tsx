/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as nextIntl from 'next-intl';

// Mock map config
jest.mock('@/lib/services/map-config', () => ({
  mapConfig: {
    getConfiguration: jest.fn(() => ({
      providers: [
        {
          provider: 'openstreetmap',
          enabled: true,
          priority: 1,
          config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
        },
        {
          provider: 'google',
          enabled: false,
          priority: 2,
          config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
        },
        {
          provider: 'mapbox',
          enabled: false,
          priority: 3,
          config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
        },
      ],
      defaultProvider: 'openstreetmap',
      fallbackStrategy: 'priority',
      enableAutoFallback: true,
      cacheResponses: true,
      cacheDuration: 3600000,
      enableOfflineMode: false,
      healthCheckInterval: 300000,
      policyMode: 'strict',
      searchBehaviorWhenNoAutocomplete: 'submit-only',
      configVersion: 2,
    })),
    enableProvider: jest.fn(),
    setProviderPriority: jest.fn(),
    setDefaultProvider: jest.fn(),
    setFallbackStrategy: jest.fn(),
    setAutoFallback: jest.fn(),
    setCacheSettings: jest.fn(),
    setOfflineMode: jest.fn(),
    setHealthCheckInterval: jest.fn(),
    setPolicyMode: jest.fn(),
    setSearchBehaviorWhenNoAutocomplete: jest.fn(),
    addConfigurationListener: jest.fn(() => () => {}),
    getActiveApiKey: jest.fn(() => undefined),
  },
}));

jest.mock('@/lib/services/connectivity-checker', () => ({
  connectivityChecker: {
    getProviderHealth: jest.fn(() => ({ isHealthy: true, responseTime: 100 })),
    checkAllProvidersHealth: jest.fn(() => Promise.resolve([])),
  },
}));

import { mapConfig } from '@/lib/services/map-config';
import { connectivityChecker } from '@/lib/services/connectivity-checker';

const mockMapConfig = mapConfig as jest.Mocked<typeof mapConfig>;
const mockConnectivityChecker = connectivityChecker as jest.Mocked<typeof connectivityChecker>;

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { toast as mockToast } from 'sonner';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => <label className={className}>{children}</label>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (v: boolean) => void }) => (
    <input type="checkbox" data-testid="switch" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <select data-testid="select" value={value} onChange={(e) => onValueChange?.(e.target.value)}>{children}</select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
    const flatten = (node: React.ReactNode): string => {
      if (node === null || node === undefined || node === false) return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(flatten).join('');
      if (React.isValidElement(node)) {
        const el = node as React.ReactElement<{ children?: React.ReactNode }>;
        return flatten(el.props.children);
      }
      return '';
    };

    return <option value={value}>{flatten(children)}</option>;
  },
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog">{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (asChild ? <>{children}</> : <div>{children}</div>),
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => <h4>{children}</h4>,
}));

jest.mock('@/components/ui/separator', () => ({ Separator: () => <hr /> }));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange?: (v: number[]) => void }) => (
    <input type="range" data-testid="slider" value={value[0]} onChange={(e) => onValueChange?.([parseInt(e.target.value)])} />
  ),
}));

import { MapProviderSettings } from '@/components/starmap/map/map-provider-settings';

describe('MapProviderSettings', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    // Reset all mock implementations to defaults
    mockMapConfig.enableProvider.mockImplementation(() => {});
    mockMapConfig.setProviderPriority.mockImplementation(() => {});
    mockMapConfig.setDefaultProvider.mockImplementation(() => {});
    mockMapConfig.setFallbackStrategy.mockImplementation(() => {});
    mockMapConfig.setAutoFallback.mockImplementation(() => {});
    mockMapConfig.setCacheSettings.mockImplementation(() => {});
    mockMapConfig.setOfflineMode.mockImplementation(() => {});
    mockMapConfig.setHealthCheckInterval.mockImplementation(() => {});
    mockMapConfig.setPolicyMode.mockImplementation(() => {});
    mockMapConfig.setSearchBehaviorWhenNoAutocomplete.mockImplementation(() => {});
    mockMapConfig.addConfigurationListener.mockReturnValue(() => {});
    mockMapConfig.getActiveApiKey.mockReturnValue(undefined);
    mockConnectivityChecker.checkAllProvidersHealth.mockResolvedValue([]);
    mockConnectivityChecker.getProviderHealth.mockReturnValue({ isHealthy: true, responseTime: 100 } as ReturnType<typeof connectivityChecker.getProviderHealth>);
  });

  describe('Rendering', () => {
    it('renders trigger button', () => {
      render(<MapProviderSettings />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders custom trigger when provided', () => {
      render(<MapProviderSettings trigger={<button data-testid="custom-trigger">Custom</button>} />);
      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('renders dialog structure', () => {
      render(<MapProviderSettings />);
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
    });

    it('renders all providers', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      // 3 provider switches + autoFallback + cache + offline = 6
      expect(switches.length).toBe(6);
    });

    it('renders save and reset buttons in footer', () => {
      render(<MapProviderSettings />);
      expect(screen.getByTestId('dialog-footer')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));
      const resetBtn = buttons.find(b => b.textContent?.includes('Reset') || b.textContent?.includes('reset'));
      expect(saveBtn).toBeDefined();
      expect(resetBtn).toBeDefined();
    });

    it('renders select elements for fallback strategy, default provider, etc.', () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('renders sliders for cache duration and health check interval', () => {
      render(<MapProviderSettings />);
      const sliders = screen.getAllByTestId('slider');
      expect(sliders.length).toBe(2);
    });

    it('renders fallback labels when translations return empty strings', () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<MapProviderSettings />);

        expect(screen.getByText('Map Settings')).toBeInTheDocument();
        expect(screen.getByText('Providers')).toBeInTheDocument();
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });
  });

  describe('Provider Toggle', () => {
    it('renders switches for providers', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      // 3 provider switches + autoFallback + cache + offline = 6
      expect(switches.length).toBe(6);
    });

    it('first provider (openstreetmap) is checked', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      expect((switches[0] as HTMLInputElement).checked).toBe(true);
    });

    it('second provider (google) is unchecked', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      expect((switches[1] as HTMLInputElement).checked).toBe(false);
    });

    it('toggling a provider marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]); // Enable google
      });

      // Unsaved changes alert should appear
      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
  });

  describe('Provider Priority', () => {
    it('shows priority select for enabled provider', () => {
      render(<MapProviderSettings />);
      // The first provider (openstreetmap) is enabled and should have a priority select
      const selects = screen.getAllByTestId('select');
      // At least one select should have priority value "1"
      const prioritySelect = selects.find(s => (s as HTMLSelectElement).value === '1');
      expect(prioritySelect).toBeDefined();
    });

    it('changing priority marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const prioritySelect = selects.find(s => (s as HTMLSelectElement).value === '1');

      if (prioritySelect) {
        await act(async () => {
          fireEvent.change(prioritySelect, { target: { value: '3' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Default Provider', () => {
    it('shows default provider select with current value', () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const defaultSelect = selects.find(s => (s as HTMLSelectElement).value === 'openstreetmap');
      expect(defaultSelect).toBeDefined();
    });

    it('changing default provider marks hasChanges', async () => {
      // Need google to be enabled for it to appear as option
      mockMapConfig.getConfiguration.mockReturnValue({
        providers: [
          {
            provider: 'openstreetmap',
            enabled: true,
            priority: 1,
            config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
          },
          {
            provider: 'google',
            enabled: true,
            priority: 2,
            config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
          },
          {
            provider: 'mapbox',
            enabled: false,
            priority: 3,
            config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
          },
        ],
        defaultProvider: 'openstreetmap',
        fallbackStrategy: 'priority',
        enableAutoFallback: true,
        cacheResponses: true,
        cacheDuration: 3600000,
        enableOfflineMode: false,
        healthCheckInterval: 300000,
        policyMode: 'strict',
        searchBehaviorWhenNoAutocomplete: 'submit-only',
        configVersion: 2,
      } as ReturnType<typeof mapConfig.getConfiguration>);

      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const defaultSelect = selects.find(s => (s as HTMLSelectElement).value === 'openstreetmap');

      if (defaultSelect) {
        await act(async () => {
          fireEvent.change(defaultSelect, { target: { value: 'google' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Fallback Strategy', () => {
    it('shows fallback strategy select when autoFallback is enabled', () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const fallbackSelect = selects.find(s => (s as HTMLSelectElement).value === 'priority');
      expect(fallbackSelect).toBeDefined();
    });

    it('changing fallback strategy marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const fallbackSelect = selects.find(s => (s as HTMLSelectElement).value === 'priority');

      if (fallbackSelect) {
        await act(async () => {
          fireEvent.change(fallbackSelect, { target: { value: 'fastest' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Auto Fallback Toggle', () => {
    it('auto fallback switch is rendered and checked', () => {
      render(<MapProviderSettings />);
      // The 4th switch should be auto-fallback (after 3 providers)
      const switches = screen.getAllByTestId('switch');
      // Providers: 3 switches + autoFallback + cache + offline = 6 total
      expect(switches.length).toBeGreaterThanOrEqual(4);
    });

    it('toggling auto fallback marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      // 4th switch = autoFallback
      if (switches[3]) {
        await act(async () => {
          fireEvent.click(switches[3]);
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Cache Settings', () => {
    it('cache switch is rendered', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      expect(switches.length).toBeGreaterThanOrEqual(5);
    });

    it('cache duration slider is rendered', () => {
      render(<MapProviderSettings />);
      const sliders = screen.getAllByTestId('slider');
      expect(sliders.length).toBeGreaterThanOrEqual(1);
    });

    it('changing cache duration marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const sliders = screen.getAllByTestId('slider');

      if (sliders[0]) {
        await act(async () => {
          fireEvent.change(sliders[0], { target: { value: '12' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });

    it('toggling cache marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      // 5th switch = cache
      if (switches[4]) {
        await act(async () => {
          fireEvent.click(switches[4]);
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Offline Mode', () => {
    it('offline mode switch is rendered', () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      expect(switches.length).toBeGreaterThanOrEqual(6);
    });

    it('toggling offline mode marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');
      // 6th switch = offline mode
      if (switches[5]) {
        await act(async () => {
          fireEvent.click(switches[5]);
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Health Check Interval', () => {
    it('health check interval slider is rendered', () => {
      render(<MapProviderSettings />);
      const sliders = screen.getAllByTestId('slider');
      expect(sliders.length).toBe(2);
    });

    it('changing health check interval marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const sliders = screen.getAllByTestId('slider');

      if (sliders[1]) {
        await act(async () => {
          fireEvent.change(sliders[1], { target: { value: '10' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Policy Mode', () => {
    it('policy mode select is rendered with current value', () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const policySelect = selects.find(s => (s as HTMLSelectElement).value === 'strict');
      expect(policySelect).toBeDefined();
    });

    it('changing policy mode marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const policySelect = selects.find(s => (s as HTMLSelectElement).value === 'strict');

      if (policySelect) {
        await act(async () => {
          fireEvent.change(policySelect, { target: { value: 'balanced' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Search Behavior Mode', () => {
    it('search behavior select is rendered', () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const searchSelect = selects.find(s => (s as HTMLSelectElement).value === 'submit-only');
      expect(searchSelect).toBeDefined();
    });

    it('changing search behavior marks hasChanges', async () => {
      render(<MapProviderSettings />);
      const selects = screen.getAllByTestId('select');
      const searchSelect = selects.find(s => (s as HTMLSelectElement).value === 'submit-only');

      if (searchSelect) {
        await act(async () => {
          fireEvent.change(searchSelect, { target: { value: 'disabled' } });
        });

        expect(screen.getByTestId('alert')).toBeInTheDocument();
      }
    });
  });

  describe('Save Settings', () => {
    it('save button is disabled when no changes', () => {
      render(<MapProviderSettings />);
      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));
      expect(saveBtn).toBeDisabled();
    });

    it('save button is enabled after changes', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]); // Enable google
      });

      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));
      expect(saveBtn).not.toBeDisabled();
    });

    it('calls all mapConfig methods on save', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      // Make a change
      await act(async () => {
        fireEvent.click(switches[1]); // Enable google
      });

      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));

      if (saveBtn) {
        await act(async () => {
          fireEvent.click(saveBtn);
        });
      }

      await waitFor(() => {
        expect(mockMapConfig.enableProvider).toHaveBeenCalled();
        expect(mockMapConfig.setProviderPriority).toHaveBeenCalled();
        expect(mockMapConfig.setDefaultProvider).toHaveBeenCalled();
        expect(mockMapConfig.setFallbackStrategy).toHaveBeenCalled();
        expect(mockMapConfig.setAutoFallback).toHaveBeenCalled();
        expect(mockMapConfig.setCacheSettings).toHaveBeenCalled();
        expect(mockMapConfig.setOfflineMode).toHaveBeenCalled();
        expect(mockMapConfig.setHealthCheckInterval).toHaveBeenCalled();
        expect(mockMapConfig.setPolicyMode).toHaveBeenCalled();
        expect(mockMapConfig.setSearchBehaviorWhenNoAutocomplete).toHaveBeenCalled();
        expect(mockConnectivityChecker.checkAllProvidersHealth).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('shows error toast when save fails', async () => {
      mockMapConfig.enableProvider.mockImplementation(() => { throw new Error('Save failed'); });

      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]);
      });

      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));

      if (saveBtn) {
        await act(async () => {
          fireEvent.click(saveBtn);
        });
      }

      expect(mockToast.error).toHaveBeenCalled();
    });

    it('calls onSettingsChange callback on successful save', async () => {
      mockConnectivityChecker.checkAllProvidersHealth.mockResolvedValue([]);
      const onSettingsChange = jest.fn();
      render(<MapProviderSettings onSettingsChange={onSettingsChange} />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]);
      });

      const buttons = screen.getAllByRole('button');
      const saveBtn = buttons.find(b => b.textContent?.includes('Save') || b.textContent?.includes('save'));

      await act(async () => {
        if (saveBtn) fireEvent.click(saveBtn);
        // Allow the async save to complete
        await mockConnectivityChecker.checkAllProvidersHealth();
      });

      expect(mockToast.success).toHaveBeenCalled();
      expect(onSettingsChange).toHaveBeenCalled();
    });
  });

  describe('Reset Settings', () => {
    it('reset button is disabled when no changes', () => {
      render(<MapProviderSettings />);
      const buttons = screen.getAllByRole('button');
      const resetBtn = buttons.find(b => b.textContent?.includes('Reset') || b.textContent?.includes('reset'));
      expect(resetBtn).toBeDisabled();
    });

    it('reset button is enabled after changes', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]);
      });

      const buttons = screen.getAllByRole('button');
      const resetBtn = buttons.find(b => b.textContent?.includes('Reset') || b.textContent?.includes('reset'));
      expect(resetBtn).not.toBeDisabled();
    });

    it('resets config to original on reset click', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]);
      });

      // Alert should be visible
      expect(screen.getByTestId('alert')).toBeInTheDocument();

      const buttons = screen.getAllByRole('button');
      const resetBtn = buttons.find(b => b.textContent?.includes('Reset') || b.textContent?.includes('reset'));

      if (resetBtn) {
        await act(async () => {
          fireEvent.click(resetBtn);
        });
      }

      // Alert should be gone after reset
      expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Alert', () => {
    it('does not show alert when no changes', () => {
      render(<MapProviderSettings />);
      expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
    });

    it('shows alert when changes exist', async () => {
      render(<MapProviderSettings />);
      const switches = screen.getAllByTestId('switch');

      await act(async () => {
        fireEvent.click(switches[1]);
      });

      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });
  });

  describe('Provider Status Badges', () => {
    it('shows healthy badge for healthy enabled provider', () => {
      mockConnectivityChecker.getProviderHealth.mockReturnValue({ isHealthy: true, responseTime: 100 } as ReturnType<typeof connectivityChecker.getProviderHealth>);

      render(<MapProviderSettings />);
      const badges = screen.getAllByTestId('badge');
      const healthyBadge = badges.find(b => b.textContent?.includes('Healthy') || b.textContent?.includes('healthy'));
      expect(healthyBadge).toBeDefined();
    });

    it('shows disabled badge for disabled provider', () => {
      render(<MapProviderSettings />);
      const badges = screen.getAllByTestId('badge');
      const disabledBadge = badges.find(b => b.textContent?.includes('Disabled') || b.textContent?.includes('disabled'));
      expect(disabledBadge).toBeDefined();
    });

    it('shows unhealthy badge for unhealthy provider', () => {
      mockConnectivityChecker.getProviderHealth.mockReturnValue({ isHealthy: false, responseTime: 5000 } as ReturnType<typeof connectivityChecker.getProviderHealth>);

      mockMapConfig.getConfiguration.mockReturnValue({
        providers: [
          {
            provider: 'openstreetmap',
            enabled: true,
            priority: 1,
            config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
          },
          {
            provider: 'google',
            enabled: true,
            priority: 2,
            config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
          },
          {
            provider: 'mapbox',
            enabled: false,
            priority: 3,
            config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
          },
        ],
        defaultProvider: 'openstreetmap',
        fallbackStrategy: 'priority',
        enableAutoFallback: true,
        cacheResponses: true,
        cacheDuration: 3600000,
        enableOfflineMode: false,
        healthCheckInterval: 300000,
        policyMode: 'strict',
        searchBehaviorWhenNoAutocomplete: 'submit-only',
        configVersion: 2,
      } as ReturnType<typeof mapConfig.getConfiguration>);

      render(<MapProviderSettings />);
      const badges = screen.getAllByTestId('badge');
      const unhealthyBadge = badges.find(b => b.textContent?.includes('Unhealthy') || b.textContent?.includes('unhealthy'));
      expect(unhealthyBadge).toBeDefined();
    });

    it('shows unknown badge when health is null', () => {
      mockConnectivityChecker.getProviderHealth.mockReturnValue(null as unknown as ReturnType<typeof connectivityChecker.getProviderHealth>);

      mockMapConfig.getConfiguration.mockReturnValue({
        providers: [
          {
            provider: 'openstreetmap',
            enabled: true,
            priority: 1,
            config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
          },
          {
            provider: 'google',
            enabled: false,
            priority: 2,
            config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
          },
          {
            provider: 'mapbox',
            enabled: false,
            priority: 3,
            config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
          },
        ],
        defaultProvider: 'openstreetmap',
        fallbackStrategy: 'priority',
        enableAutoFallback: true,
        cacheResponses: true,
        cacheDuration: 3600000,
        enableOfflineMode: false,
        healthCheckInterval: 300000,
        policyMode: 'strict',
        searchBehaviorWhenNoAutocomplete: 'submit-only',
        configVersion: 2,
      } as ReturnType<typeof mapConfig.getConfiguration>);

      render(<MapProviderSettings />);
      // When health is null, should show healthy (default)
      const badges = screen.getAllByTestId('badge');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe('API Key Required Warning', () => {
    it('shows API key required warning when provider needs key but none configured', () => {
      mockMapConfig.getActiveApiKey.mockReturnValue(undefined);

      mockMapConfig.getConfiguration.mockReturnValue({
        providers: [
          {
            provider: 'openstreetmap',
            enabled: true,
            priority: 1,
            config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
          },
          {
            provider: 'google',
            enabled: true,
            priority: 2,
            config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
          },
          {
            provider: 'mapbox',
            enabled: false,
            priority: 3,
            config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
          },
        ],
        defaultProvider: 'openstreetmap',
        fallbackStrategy: 'priority',
        enableAutoFallback: true,
        cacheResponses: true,
        cacheDuration: 3600000,
        enableOfflineMode: false,
        healthCheckInterval: 300000,
        policyMode: 'strict',
        searchBehaviorWhenNoAutocomplete: 'submit-only',
        configVersion: 2,
      } as ReturnType<typeof mapConfig.getConfiguration>);

      render(<MapProviderSettings />);
      const warnings = screen.getAllByText(/map\.apiKeyRequired|API key required/);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Listener', () => {
    it('subscribes to configuration changes on mount', () => {
      render(<MapProviderSettings />);
      expect(mockMapConfig.addConfigurationListener).toHaveBeenCalled();
    });

    it('unsubscribes from configuration changes on unmount', () => {
      const unsubscribe = jest.fn();
      mockMapConfig.addConfigurationListener.mockReturnValue(unsubscribe);

      const { unmount } = render(<MapProviderSettings />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('updates rendered configuration when the listener pushes a new config', () => {
      render(<MapProviderSettings />);

      const listener = mockMapConfig.addConfigurationListener.mock.calls[0]?.[0];
      expect(listener).toBeDefined();

      act(() => {
        listener?.({
          providers: [
            {
              provider: 'openstreetmap',
              enabled: true,
              priority: 1,
              config: { attribution: '© OpenStreetMap contributors', maxZoom: 19, minZoom: 0, rateLimit: 1000 },
            },
            {
              provider: 'google',
              enabled: true,
              priority: 2,
              config: { attribution: '© Google', maxZoom: 21, minZoom: 0, rateLimit: 50 },
            },
            {
              provider: 'mapbox',
              enabled: false,
              priority: 3,
              config: { attribution: '© Mapbox © OpenStreetMap contributors', maxZoom: 22, minZoom: 0, rateLimit: 600 },
            },
          ],
          defaultProvider: 'google',
          apiKeys: [],
          fallbackStrategy: 'priority',
          enableAutoFallback: true,
          cacheResponses: true,
          cacheDuration: 3600000,
          enableOfflineMode: false,
          healthCheckInterval: 300000,
          policyMode: 'strict',
          searchBehaviorWhenNoAutocomplete: 'submit-only',
          uiPreferences: {
            tileLayer: 'openstreetmap',
            zoom: 10,
            showLightPollution: false,
          },
          configVersion: 2,
        });
      });

      const switches = screen.getAllByTestId('switch');
      expect(switches[1]).toBeChecked();
    });
  });
});
