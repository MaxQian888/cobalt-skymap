/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSettingsStore } from '@/lib/stores';

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      data-testid="input" 
      {...props} 
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div
      data-testid="select"
      data-value={value}
      onClick={() => onValueChange?.(value === 'http' || value === 'https' ? 'https' : 'manual')}
    >
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button onClick={onClick} data-testid="button">{children}</button>
  ),
}));

jest.mock('@/lib/storage/platform', () => {
  const actual = jest.requireActual('@/lib/storage/platform');
  return {
    ...actual,
    isTauri: jest.fn(() => false),
  };
});

jest.mock('@/lib/tauri/http-api', () => ({
  httpApi: {
    getEffectiveProxyState: jest.fn(),
  },
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
}));

import { ConnectionSettings } from '../connection-settings';

function setStoreState(
  connection: { ip: string; port: string },
  protocol: 'http' | 'https' = 'http',
  proxy: { mode: 'auto' | 'manual' | 'off'; manualUrl: string; fallbackToDirectOnFailure: boolean } = {
    mode: 'auto',
    manualUrl: '',
    fallbackToDirectOnFailure: true,
  },
) {
  useSettingsStore.setState({
    connection,
    backendProtocol: protocol,
    proxy,
  });
}

describe('ConnectionSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setStoreState({ ip: 'localhost', port: '1888' });
  });

  it('renders connection settings section', () => {
    render(<ConnectionSettings />);
    expect(screen.getByTestId('collapsible')).toBeInTheDocument();
  });

  it('renders protocol select', () => {
    render(<ConnectionSettings />);
    expect(screen.getAllByTestId('select').length).toBeGreaterThanOrEqual(2);
  });

  it('renders IP address and port inputs', () => {
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs.length).toBe(2);
  });

  it('displays current connection values', () => {
    setStoreState({ ip: '192.168.1.100', port: '8080' }, 'https');
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('192.168.1.100');
    expect(inputs[1]).toHaveAttribute('value', '8080');
  });

  it('calls setConnection when IP is changed', () => {
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.change(inputs[0], { target: { value: '192.168.1.1' } });
    expect(useSettingsStore.getState().connection.ip).toBe('192.168.1.1');
  });

  it('calls setConnection when port is changed', () => {
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.change(inputs[1], { target: { value: '9000' } });
    expect(useSettingsStore.getState().connection.port).toBe('9000');
  });

  it('renders labels for connection fields', () => {
    render(<ConnectionSettings />);
    expect(screen.getAllByTestId('label').length).toBeGreaterThan(0);
  });
});

describe('ConnectionSettings validation tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setStoreState({ ip: 'localhost', port: '1888' });
  });

  it('handles empty IP address', () => {
    setStoreState({ ip: '', port: '1888' });
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('');
  });

  it('handles empty port', () => {
    setStoreState({ ip: 'localhost', port: '' });
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[1]).toHaveAttribute('value', '');
  });

  it('handles IPv4 address', () => {
    setStoreState({ ip: '192.168.1.100', port: '8080' });
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('192.168.1.100');
  });

  it('handles IPv6 address', () => {
    setStoreState({ ip: '::1', port: '8080' });
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('::1');
  });

  it('handles hostname with subdomain', () => {
    setStoreState({ ip: 'api.example.com', port: '443' }, 'https');
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('api.example.com');
  });

  it('handles https protocol', () => {
    setStoreState({ ip: 'localhost', port: '443' }, 'https');
    render(<ConnectionSettings />);
    expect(screen.getAllByTestId('select')[0]).toHaveAttribute('data-value', 'https');
  });

  it('handles port change to non-standard port', () => {
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.change(inputs[1], { target: { value: '65535' } });
    expect(useSettingsStore.getState().connection.port).toBe('65535');
  });

  it('handles special characters in IP field', () => {
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    fireEvent.change(inputs[0], { target: { value: 'test-server.local' } });
    expect(useSettingsStore.getState().connection.ip).toBe('test-server.local');
  });

  it('handles both fields empty', () => {
    setStoreState({ ip: '', port: '' });
    render(<ConnectionSettings />);
    const inputs = screen.getAllByTestId('input');
    expect(inputs[0]).toHaveValue('');
    expect(inputs[1]).toHaveAttribute('value', '');
  });

  it('handles protocol change callback', () => {
    render(<ConnectionSettings />);
    fireEvent.click(screen.getAllByTestId('select')[0]);
    expect(useSettingsStore.getState().backendProtocol).toBe('https');
  });

  it('updates proxy mode when proxy select is changed', () => {
    render(<ConnectionSettings />);
    fireEvent.click(screen.getAllByTestId('select')[1]);
    expect(useSettingsStore.getState().proxy.mode).toBe('manual');
  });
});
