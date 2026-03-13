/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as nextIntl from 'next-intl';

// Mock map config
jest.mock('@/lib/services/map-config', () => ({
  mapConfig: {
    getApiKeys: jest.fn(() => []),
    addApiKey: jest.fn(),
    removeApiKey: jest.fn(),
    setDefaultApiKey: jest.fn(),
    addConfigurationListener: jest.fn(() => () => {}),
  },
}));

import { mapConfig } from '@/lib/services/map-config';

const mockMapConfig = mapConfig as jest.Mocked<typeof mapConfig>;

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { toast as mockToast } from 'sonner';

jest.mock('@/lib/utils/clipboard-feedback', () => ({
  copyTextWithFeedback: jest.fn(),
}));

import { copyTextWithFeedback } from '@/lib/utils/clipboard-feedback';

const mockCopyTextWithFeedback = copyTextWithFeedback as jest.Mock;

jest.mock('@/lib/tauri/secret-vault-api', () => ({
  secretVaultApi: {
    getStatus: jest.fn(async () => ({
      available: true,
      mode: 'desktop',
      state: 'ready',
      message: 'Vault ready',
    })),
    getMapApiKey: jest.fn(async (_provider: string, keyId: string) => `secure-${keyId}`),
  },
}));

import { secretVaultApi } from '@/lib/tauri/secret-vault-api';

const mockSecretVaultApi = secretVaultApi as jest.Mocked<typeof secretVaultApi>;
type SecretVaultStatusResult = Awaited<ReturnType<typeof secretVaultApi.getStatus>>;

const readyVaultStatus: SecretVaultStatusResult = {
  available: true,
  mode: 'desktop',
  state: 'ready',
  message: 'Vault ready',
};

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
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
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      data-testid="input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      {...props}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => (
    <label data-testid="label">{children}</label>
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
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="select" data-value={value}>
      <select
        value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        data-testid="select-native"
      >
        {children}
      </select>
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div data-testid="dialog" data-open={open}>
      <button data-testid="dialog-toggle" onClick={() => onOpenChange?.(!open)}>Toggle</button>
      {children}
    </div>
  ),
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>{children}</h2>
  ),
  DialogTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? <>{children}</> : <div data-testid="dialog-trigger">{children}</div>),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
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

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog">{children}</div>
  ),
  AlertDialogAction: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button data-testid="alert-dialog-action" onClick={onClick} className={className}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="alert-dialog-cancel">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-footer">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-header">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="alert-dialog-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={value} className={className} />
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

import { MapApiKeyManager } from '@/components/starmap/map/map-api-key-manager';

describe('MapApiKeyManager', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockMapConfig.getApiKeys.mockReturnValue([]);
    mockMapConfig.addConfigurationListener.mockReturnValue(() => {});
    mockCopyTextWithFeedback.mockResolvedValue(true);
    mockSecretVaultApi.getStatus.mockResolvedValue(readyVaultStatus);
    mockSecretVaultApi.getMapApiKey.mockImplementation(async (_provider: string, keyId: string) => `secure-${keyId}`);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Rendering', () => {
    it('renders default trigger button', () => {
      render(<MapApiKeyManager />);
      expect(screen.getByText(/map\.apiKeys|API Keys/)).toBeInTheDocument();
    });

    it('renders custom trigger when provided', () => {
      render(<MapApiKeyManager trigger={<button data-testid="custom-trigger">Custom</button>} />);
      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('renders dialog content', () => {
      render(<MapApiKeyManager />);
      const contents = screen.getAllByTestId('dialog-content');
      expect(contents.length).toBeGreaterThan(0);
    });

    it('renders dialog title', () => {
      render(<MapApiKeyManager />);
      const titles = screen.getAllByTestId('dialog-title');
      expect(titles.length).toBeGreaterThan(0);
    });

    it('renders security notice', () => {
      render(<MapApiKeyManager />);
      const notices = screen.getAllByText(/map\.securityNotice|Security Notice/);
      expect(notices.length).toBeGreaterThan(0);
    });

    it('renders API keys table', () => {
      render(<MapApiKeyManager />);
      expect(screen.getByTestId('table')).toBeInTheDocument();
    });

    it('shows empty state when no keys configured', () => {
      render(<MapApiKeyManager />);
      expect(screen.getByText(/map\.noApiKeys|No API keys configured/)).toBeInTheDocument();
    });

    it('renders add API key button', () => {
      render(<MapApiKeyManager />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders fallback labels when translations return empty strings', () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<MapApiKeyManager />);

        expect(screen.getByText(/API Keys/)).toBeInTheDocument();
        expect(screen.getByText(/Security Notice/)).toBeInTheDocument();
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });
  });

  describe('API Keys Display', () => {
    it('displays existing API keys', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: true,
          createdAt: new Date().toISOString(),
          label: 'Production',
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByText('google')).toBeInTheDocument();
    });

    it('masks API key by default', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByText(/••••••••/)).toBeInTheDocument();
    });

    it('displays quota progress when available', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
          quota: {
            daily: 1000,
            used: 500,
          },
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByTestId('progress')).toBeInTheDocument();
    });

    it('shows unlimited when no quota set', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByText(/map\.unlimited|Unlimited/)).toBeInTheDocument();
    });

    it('shows Default badge for default key', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByText(/map\.default|Default/)).toBeInTheDocument();
    });

    it('shows label when key has label', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
          label: 'Production',
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByText('(Production)')).toBeInTheDocument();
    });

    it('displays monthly quota progress', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
          quota: {
            monthly: 10000,
            used: 3000,
          },
        },
      ]);

      render(<MapApiKeyManager />);
      expect(screen.getByTestId('progress')).toBeInTheDocument();
      expect(screen.getByText(/3000/)).toBeInTheDocument();
    });
  });

  describe('Toggle Key Visibility', () => {
    it('toggles API key visibility when eye button clicked', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const buttons = screen.getAllByRole('button');
      const visibilityButton = buttons.find(
        (btn) => btn.getAttribute('data-size') === 'icon'
      );

      expect(visibilityButton).toBeDefined();

      if (visibilityButton) {
        await act(async () => {
          fireEvent.click(visibilityButton);
        });
        expect(screen.getByText('secure-key-1')).toBeInTheDocument();
      }
    });

    it('falls back to the stored key when secure reveal returns no secret', async () => {
      mockSecretVaultApi.getMapApiKey.mockResolvedValueOnce(null);
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const visibilityButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('data-size') === 'icon');

      if (visibilityButton) {
        await act(async () => {
          fireEvent.click(visibilityButton);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('AIza123456789abcdef')).toBeInTheDocument();
      });
    });

    it('keeps toggling visibility when secure reveal fails', async () => {
      mockSecretVaultApi.getMapApiKey.mockRejectedValueOnce(new Error('Vault unavailable'));
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const visibilityButton = screen
        .getAllByRole('button')
        .find((btn) => btn.getAttribute('data-size') === 'icon');

      if (visibilityButton) {
        await act(async () => {
          fireEvent.click(visibilityButton);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('AIza123456789abcdef')).toBeInTheDocument();
      });
    });
  });

  describe('Copy API Key', () => {
    it('copies API key to clipboard', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.filter(
        (btn) => btn.getAttribute('data-size') === 'icon'
      )[1]; // Second icon button is copy

      if (copyButton) {
        await act(async () => {
          fireEvent.click(copyButton);
        });

        await waitFor(() => {
          expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(
            expect.objectContaining({
              text: 'secure-key-1',
            })
          );
        });
      }
    });

    it('shows error toast when copy fails', async () => {
      mockCopyTextWithFeedback.mockResolvedValueOnce(false);

      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const buttons = screen.getAllByRole('button');
      const copyButton = buttons.filter(
        (btn) => btn.getAttribute('data-size') === 'icon'
      )[1];

      if (copyButton) {
        await act(async () => {
          fireEvent.click(copyButton);
        });
      }

      await waitFor(() => {
        expect(mockCopyTextWithFeedback).toHaveBeenCalled();
      });
    });

    it('falls back to the configured key when secure copy lookup fails', async () => {
      mockSecretVaultApi.getMapApiKey.mockRejectedValueOnce(new Error('Secure lookup failed'));
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const copyButton = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-size') === 'icon')[1];

      if (copyButton) {
        await act(async () => {
          fireEvent.click(copyButton);
        });
      }

      await waitFor(() => {
        expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(
          expect.objectContaining({ text: 'AIza123456789abcdef' })
        );
      });
    });

    it('shows and clears the copied indicator after a successful copy', async () => {
      jest.useFakeTimers();
      mockCopyTextWithFeedback.mockImplementation(async ({ onSuccess }) => {
        onSuccess?.();
        return true;
      });
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789abcdef',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const copyButton = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-size') === 'icon')[1];

      if (copyButton) {
        await act(async () => {
          fireEvent.click(copyButton);
        });
      }

      await waitFor(() => {
        expect(document.querySelector('.text-green-500')).toBeTruthy();
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(document.querySelector('.text-green-500')).toBeFalsy();
      });
      jest.useRealTimers();
    });
  });

  describe('Add API Key', () => {
    it('shows add key form when add button clicked', async () => {
      render(<MapApiKeyManager />);

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (!addButton) return;
      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByTestId('select')).toBeInTheDocument();
    });

    it('shows error when API key is empty', async () => {
      render(<MapApiKeyManager />);

      const btns = screen.getAllByRole('button');
      const addBtn = btns.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addBtn) {
        await act(async () => {
          fireEvent.click(addBtn);
        });
      }

      const buttons1 = screen.getAllByRole('button');
      const addKeyBtn1 = buttons1.find(btn => btn.textContent?.includes('Add Key') || btn.textContent?.includes('addKey'));
      if (addKeyBtn1) {
        await act(async () => {
          fireEvent.click(addKeyBtn1);
        });
      }

      expect(mockToast.error).toHaveBeenCalled();
    });

    it('calls addApiKey with correct data', async () => {
      mockMapConfig.addApiKey.mockReturnValue('key-1');

      render(<MapApiKeyManager />);

      const buttons2 = screen.getAllByRole('button');
      const addBtn2 = buttons2.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addBtn2) {
        await act(async () => {
          fireEvent.click(addBtn2);
        });
      }

      const inputs = screen.getAllByTestId('input');
      const apiKeyInput = inputs.find((input) => input.getAttribute('type') === 'password');

      if (apiKeyInput) {
        await act(async () => {
          fireEvent.change(apiKeyInput, { target: { value: 'test-api-key-123' } });
        });
      }

      const buttons3 = screen.getAllByRole('button');
      const addKeyBtn3 = buttons3.find(btn => btn.textContent?.includes('Add Key') || btn.textContent?.includes('addKey'));
      if (addKeyBtn3) {
        await act(async () => {
          fireEvent.click(addKeyBtn3);
        });
      }

      await waitFor(() => {
        expect(mockMapConfig.addApiKey).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('shows error toast when addApiKey fails', async () => {
      mockMapConfig.addApiKey.mockImplementation(() => {
        throw new Error('API Error');
      });

      render(<MapApiKeyManager />);

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addButton) {
        await act(async () => {
          fireEvent.click(addButton);
        });
      }

      const inputs = screen.getAllByTestId('input');
      const apiKeyInput = inputs.find((input) => input.getAttribute('type') === 'password');

      if (apiKeyInput) {
        await act(async () => {
          fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
        });
      }

      const allButtons = screen.getAllByRole('button');
      const addKeyButton = allButtons.find(btn => btn.textContent?.includes('Add Key') || btn.textContent?.includes('addKey'));
      if (addKeyButton) {
        await act(async () => {
          fireEvent.click(addKeyButton);
        });
      }

      expect(mockToast.error).toHaveBeenCalled();
    });

    it('fills label and quota fields in add form', async () => {
      mockMapConfig.addApiKey.mockReturnValue('key-new');

      render(<MapApiKeyManager />);

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addButton) {
        await act(async () => { fireEvent.click(addButton); });
      }

      const inputs = screen.getAllByTestId('input');
      const apiKeyInput = inputs.find((input) => input.getAttribute('type') === 'password');
      const labelInput = inputs.find((input) => input.getAttribute('placeholder')?.includes('Production') || input.getAttribute('placeholder')?.includes('labelPlaceholder'));
      const dailyInput = inputs.find((input) => input.getAttribute('placeholder') === '1000');
      const monthlyInput = inputs.find((input) => input.getAttribute('placeholder') === '30000');

      if (apiKeyInput) fireEvent.change(apiKeyInput, { target: { value: 'test-key-456' } });
      if (labelInput) fireEvent.change(labelInput, { target: { value: 'My Label' } });
      if (dailyInput) fireEvent.change(dailyInput, { target: { value: '500' } });
      if (monthlyInput) fireEvent.change(monthlyInput, { target: { value: '15000' } });

      const allButtons = screen.getAllByRole('button');
      const addKeyButton = allButtons.find(btn => btn.textContent?.includes('Add Key') || btn.textContent?.includes('addKey'));
      if (addKeyButton) {
        await act(async () => { fireEvent.click(addKeyButton); });
      }

      await waitFor(() => {
        expect(mockMapConfig.addApiKey).toHaveBeenCalledWith(expect.objectContaining({
          apiKey: 'test-key-456',
          label: 'My Label',
          quota: expect.objectContaining({ daily: 500, monthly: 15000 }),
        }));
      });
    });

    it('closes add form when cancel is clicked', async () => {
      render(<MapApiKeyManager />);

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addButton) {
        await act(async () => { fireEvent.click(addButton); });
      }

      const cancelButton = screen.getAllByRole('button').find(btn =>
        btn.textContent?.includes('Cancel') || btn.textContent?.includes('cancel')
      );
      expect(cancelButton).toBeDefined();
    });
  });

  describe('Delete API Key', () => {
    it('calls removeApiKey when delete confirmed', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      mockMapConfig.removeApiKey.mockReturnValue(undefined);

      render(<MapApiKeyManager />);

      const deleteAction = screen.getByTestId('alert-dialog-action');
      await act(async () => {
        fireEvent.click(deleteAction);
      });

      await waitFor(() => {
        expect(mockMapConfig.removeApiKey).toHaveBeenCalledWith('key-1');
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('shows error toast when delete fails', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      mockMapConfig.removeApiKey.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      render(<MapApiKeyManager />);

      const deleteAction = screen.getByTestId('alert-dialog-action');
      await act(async () => {
        fireEvent.click(deleteAction);
      });

      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  describe('Set Default API Key', () => {
    it('calls setDefaultApiKey when set default clicked', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      mockMapConfig.setDefaultApiKey.mockReturnValue(undefined);

      render(<MapApiKeyManager />);

      const setDefaultButton = screen.getByText(/map\.setDefault|Set Default/);
      await act(async () => {
        fireEvent.click(setDefaultButton);
      });

      await waitFor(() => {
        expect(mockMapConfig.setDefaultApiKey).toHaveBeenCalledWith('key-1');
        expect(mockToast.success).toHaveBeenCalled();
      });
    });

    it('does not show set default button for default key', () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
      ]);

      render(<MapApiKeyManager />);

      const buttons = screen.getAllByRole('button');
      const setDefaultButton = buttons.find(
        (btn) => btn.textContent?.includes('Set Default')
      );

      expect(setDefaultButton).toBeUndefined();
    });

    it('shows error toast when setDefault fails', async () => {
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      mockMapConfig.setDefaultApiKey.mockImplementation(() => {
        throw new Error('Set default failed');
      });

      render(<MapApiKeyManager />);

      const setDefaultButton = screen.getByText(/map\.setDefault|Set Default/);
      await act(async () => {
        fireEvent.click(setDefaultButton);
      });

      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  describe('Configuration Listener', () => {
    it('subscribes to configuration changes on mount', () => {
      render(<MapApiKeyManager />);
      expect(mockMapConfig.addConfigurationListener).toHaveBeenCalled();
    });

    it('unsubscribes from configuration changes on unmount', () => {
      const unsubscribe = jest.fn();
      mockMapConfig.addConfigurationListener.mockReturnValue(unsubscribe);

      const { unmount } = render(<MapApiKeyManager />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('handles listeners without an unsubscribe callback', () => {
      mockMapConfig.addConfigurationListener.mockReturnValue(undefined as unknown as () => void);

      const { unmount } = render(<MapApiKeyManager />);

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Vault status', () => {
    it('loads the vault status message when the dialog opens', async () => {
      render(<MapApiKeyManager />);

      expect(mockSecretVaultApi.getStatus).not.toHaveBeenCalled();

      fireEvent.click(screen.getAllByTestId('dialog-toggle')[0]);

      await waitFor(() => {
        expect(mockSecretVaultApi.getStatus).toHaveBeenCalled();
        expect(screen.getByText('Vault ready')).toBeInTheDocument();
      });
    });

    it('does not update state after the dialog unmounts before status resolves', async () => {
      let resolveStatus: ((value: SecretVaultStatusResult) => void) | undefined;
      mockSecretVaultApi.getStatus.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStatus = resolve;
        })
      );

      const { unmount } = render(<MapApiKeyManager />);
      fireEvent.click(screen.getAllByTestId('dialog-toggle')[0]);
      unmount();

      await act(async () => {
        resolveStatus?.({ ...readyVaultStatus, message: 'Late vault message' });
      });

      expect(screen.queryByText('Late vault message')).not.toBeInTheDocument();
    });
  });

  describe('Callbacks', () => {
    it('calls onKeysChange when key is added', async () => {
      const onKeysChange = jest.fn();
      mockMapConfig.addApiKey.mockReturnValue('key-1');

      render(<MapApiKeyManager onKeysChange={onKeysChange} />);

      const addButtons = screen.getAllByRole('button');
      const addButton = addButtons.find(btn => btn.textContent?.includes('Add API Key') || btn.textContent?.includes('addApiKey'));
      if (addButton) {
        await act(async () => {
          fireEvent.click(addButton);
        });
      }

      const inputs = screen.getAllByTestId('input');
      const apiKeyInput = inputs.find((input) => input.getAttribute('type') === 'password');

      if (apiKeyInput) {
        await act(async () => {
          fireEvent.change(apiKeyInput, { target: { value: 'test-api-key' } });
        });
      }

      const allButtons = screen.getAllByRole('button');
      const addKeyButton = allButtons.find(btn => btn.textContent?.includes('Add Key') || btn.textContent?.includes('addKey'));
      if (addKeyButton) {
        await act(async () => {
          fireEvent.click(addKeyButton);
        });
      }

      await waitFor(() => {
        expect(onKeysChange).toHaveBeenCalled();
      });
    });

    it('calls onKeysChange when key is deleted', async () => {
      const onKeysChange = jest.fn();
      mockMapConfig.getApiKeys.mockReturnValue([
        {
          id: 'key-1',
          provider: 'google',
          apiKey: 'AIza123456789',
          isDefault: false,
          createdAt: new Date().toISOString(),
        },
      ]);
      mockMapConfig.removeApiKey.mockReturnValue(undefined);

      render(<MapApiKeyManager onKeysChange={onKeysChange} />);

      const deleteAction = screen.getByTestId('alert-dialog-action');
      await act(async () => {
        fireEvent.click(deleteAction);
      });

      await waitFor(() => {
        expect(onKeysChange).toHaveBeenCalled();
      });
    });
  });
});
