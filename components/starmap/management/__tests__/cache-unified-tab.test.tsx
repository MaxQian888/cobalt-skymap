/**
 * CacheUnifiedTab Tests
 * 
 * Strategy: Mock the async functions to resolve synchronously via
 * immediate resolution. Use React's `act` with real timers (not fake)
 * and rely on `findBy*` queries which internally use `waitFor`.
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CacheUnifiedTab } from '../cache-unified-tab';

// Mutable flags
let _isTauri = false;
let _isAvailable = false;
const mockGetStats = jest.fn();
const mockListKeys = jest.fn();
const mockClearCache = jest.fn();
const mockCleanup = jest.fn();
const mockFlush = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}(${JSON.stringify(params)})`;
    return key;
  },
}));

jest.mock('sonner', () => ({
  toast: { loading: jest.fn(), success: jest.fn(), error: jest.fn(), dismiss: jest.fn() },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

jest.mock('@/lib/offline', () => ({
  formatBytes: jest.fn((bytes: number) => `${bytes}B`),
  unifiedCache: {
    getSize: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    getCacheStats: jest.fn(() => ({ hitRate: 0 })),
    clear: jest.fn().mockResolvedValue(undefined),
    cleanupExpired: jest.fn().mockResolvedValue(0),
    flush: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/tauri', () => ({
  unifiedCacheApi: {
    isAvailable: () => _isAvailable,
    getStats: (...args: unknown[]) => mockGetStats(...args),
    listKeys: (...args: unknown[]) => mockListKeys(...args),
    clearCache: (...args: unknown[]) => mockClearCache(...args),
    cleanup: (...args: unknown[]) => mockCleanup(...args),
    flush: (...args: unknown[]) => mockFlush(...args),
  },
}));

jest.mock('@/lib/cache', () => ({
  getCacheProviderDiagnostics: () => ({
    providerId: 'tauri-unified-cache',
    available: true,
    supportsPersistent: true,
    supportsClear: true,
    supportsCleanup: true,
    supportsFlush: true,
    supportsInterception: true,
  }),
  getCacheIntegrationDiagnostics: () => ([
    {
      id: 'hips-registry',
      title: 'HiPS registry fetches',
      modulePath: 'lib/services/hips-service.ts',
      policyId: 'hips-registry',
      owner: 'starmap-settings',
      environments: ['web', 'tauri'],
      implementation: 'shared-policy',
      cacheMode: 'persistent-shared',
      status: 'active',
      strategy: 'network-first',
      ttl: 86400000,
      providerId: 'tauri-unified-cache',
      runtimeEnvironment: 'tauri',
      environmentSupported: true,
    },
    {
      id: 'astro-iss-position',
      title: 'ISS realtime position',
      modulePath: 'lib/services/astro-data-sources.ts',
      policyId: 'astro-iss-position',
      owner: 'astro-events',
      environments: ['web', 'tauri'],
      implementation: 'uncached',
      reason: 'Realtime position lookups are intentionally kept fresh on every request.',
      cacheMode: 'uncached',
      status: 'uncached-by-design',
      strategy: 'network-only',
      ttl: 0,
      providerId: 'tauri-unified-cache',
      runtimeEnvironment: 'tauri',
      environmentSupported: true,
      statusReason: 'Realtime position lookups are intentionally kept fresh on every request.',
    },
  ]),
  getCacheDiagnosticsSummary: () => ({
    total: 2,
    persistentShared: 1,
    localOnly: 0,
    uncached: 1,
    active: 1,
    degraded: 0,
    mismatch: 0,
  }),
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => _isTauri,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
jest.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

describe('CacheUnifiedTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _isTauri = false;
    _isAvailable = false;
  });

  // 非 Tauri 环境显示空状态
  it('renders empty state when not in Tauri', () => {
    render(<CacheUnifiedTab isActive={true} />);
    expect(screen.getByText('cache.unifiedCacheEmpty')).toBeInTheDocument();
  });

  it('renders without crashing when inactive', () => {
    render(<CacheUnifiedTab isActive={false} />);
    expect(screen.getByText('cache.unifiedCacheEmpty')).toBeInTheDocument();
  });

  // Tauri 环境加载统计数据
  it('loads and displays stats when in Tauri and active', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 42, total_size: 8192, hit_rate: 0.85 });
    mockListKeys.mockResolvedValue(['key1', 'key2']);

    render(<CacheUnifiedTab isActive={true} />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('8192B')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
    expect(screen.getByText('cache.provider')).toBeInTheDocument();
    expect(screen.getAllByText('cache.persistentShared').length).toBeGreaterThan(0);
    expect(screen.getByText('cache.modulePath: lib/services/hips-service.ts')).toBeInTheDocument();
    expect(screen.getAllByText('cache.statusActive').length).toBeGreaterThan(0);
  });

  it('calls flush when flush button clicked', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 10, total_size: 500, hit_rate: 0.5 });
    mockListKeys.mockResolvedValue([]);
    mockFlush.mockResolvedValue(undefined);

    render(<CacheUnifiedTab isActive={true} />);

    const flushButton = await screen.findByRole('button', { name: 'cache.flush' });
    fireEvent.click(flushButton);

    await waitFor(() => expect(mockFlush).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(mockListKeys.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // 显示 cached items 列表
  it('displays cached items list', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 2, total_size: 1024, hit_rate: 0.5 });
    mockListKeys.mockResolvedValue(['cache:item1', 'cache:item2']);

    render(<CacheUnifiedTab isActive={true} />);

    expect(await screen.findByText('cache:item1')).toBeInTheDocument();
    expect(screen.getByText('cache:item2')).toBeInTheDocument();
  });

  // 超过 20 项时显示截断提示
  it('shows truncation message when more than 20 items', async () => {
    _isTauri = true;
    _isAvailable = true;
    const keys = Array.from({ length: 25 }, (_, i) => `key-${i}`);
    mockGetStats.mockResolvedValue({ total_entries: 25, total_size: 2048, hit_rate: 0.7 });
    mockListKeys.mockResolvedValue(keys);

    render(<CacheUnifiedTab isActive={true} />);

    expect(await screen.findByText(/cache\.moreItems/)).toBeInTheDocument();
  });

  // 点击 cleanup 按钮
  it('calls cleanup when cleanup button clicked', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 10, total_size: 500, hit_rate: 0.5 });
    mockListKeys.mockResolvedValue([]);
    // cleanup returns a number, and handler then calls refreshUnifiedCache
    mockCleanup.mockImplementation(() => Promise.resolve(3));

    render(<CacheUnifiedTab isActive={true} />);

    const cleanupBtn = await screen.findByRole('button', { name: 'cache.cleanup' });
    fireEvent.click(cleanupBtn);

    // cleanup is called synchronously after click handler invokes the async fn
    await waitFor(() => expect(mockCleanup).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(mockListKeys.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // 点击 clear all 确认
  it('calls clearCache when clear all confirmed', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 10, total_size: 500, hit_rate: 0.5 });
    mockListKeys.mockResolvedValue([]);
    mockClearCache.mockImplementation(() => Promise.resolve(10));

    render(<CacheUnifiedTab isActive={true} />);

    // Wait for stats to load
    await screen.findByRole('button', { name: 'cache.cleanup' });

    const clearButtons = screen.getAllByRole('button', { name: 'cache.clearAll' });
    fireEvent.click(clearButtons[clearButtons.length - 1]);

    await waitFor(() => expect(mockClearCache).toHaveBeenCalled(), { timeout: 3000 });
    await waitFor(() => expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    expect(mockListKeys.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // 0 entries 时禁用 clear 按钮
  it('disables clear all when entries is 0', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 0, total_size: 0, hit_rate: 0 });
    mockListKeys.mockResolvedValue([]);

    render(<CacheUnifiedTab isActive={true} />);

    await screen.findByRole('button', { name: 'cache.cleanup' });

    const clearBtns = screen.getAllByRole('button', { name: 'cache.clearAll' });
    const triggerBtn = clearBtns.find((button) => button.className.includes('text-destructive'));
    expect(triggerBtn).toBeDefined();
    expect(triggerBtn).toBeDisabled();
  });

  // 加载失败显示错误 toast
  it('shows error toast when loading fails', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockRejectedValue(new Error('Load failed'));
    mockListKeys.mockResolvedValue([]);

    render(<CacheUnifiedTab isActive={true} />);

    const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('cache.loadFailed'));
  });

  // cleanup 失败显示错误 toast
  it('shows error toast when cleanup fails', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 5, total_size: 200, hit_rate: 0.3 });
    mockListKeys.mockResolvedValue([]);
    mockCleanup.mockRejectedValue(new Error('Cleanup failed'));

    render(<CacheUnifiedTab isActive={true} />);

    const cleanupBtn = await screen.findByRole('button', { name: 'cache.cleanup' });
    await act(async () => { fireEvent.click(cleanupBtn); });

    const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('cache.cleanupFailed'));
  });

  // clear 失败显示错误 toast
  it('shows error toast when clear fails', async () => {
    _isTauri = true;
    _isAvailable = true;
    mockGetStats.mockResolvedValue({ total_entries: 5, total_size: 200, hit_rate: 0.3 });
    mockListKeys.mockResolvedValue([]);
    mockClearCache.mockRejectedValue(new Error('Clear failed'));

    render(<CacheUnifiedTab isActive={true} />);

    await screen.findByRole('button', { name: 'cache.cleanup' });

    const clearButtons = screen.getAllByRole('button', { name: 'cache.clearAll' });
    await act(async () => { fireEvent.click(clearButtons[clearButtons.length - 1]); });

    const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('cache.clearFailed'));
  });
});
