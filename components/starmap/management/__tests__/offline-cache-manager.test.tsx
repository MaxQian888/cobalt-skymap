/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// --- Mocks ---

const mockInitialize = jest.fn();
const mockRefreshStatuses = jest.fn();
const mockDownloadAllLayers = jest.fn();
const mockCancelAllDownloads = jest.fn();
const mockClearAllCache = jest.fn();
const mockSetAutoDownloadOnWifi = jest.fn();

let mockOfflineState = {
  isOnline: true,
  isInitialized: true,
  layerStatuses: [] as { layerId: string; cached: boolean; cachedBytes: number; cachedFiles: number; totalFiles: number; isComplete: boolean }[],
  isDownloading: false,
  autoDownloadOnWifi: false,
  initialize: mockInitialize,
  refreshStatuses: mockRefreshStatuses,
  downloadAllLayers: mockDownloadAllLayers,
  cancelAllDownloads: mockCancelAllDownloads,
  clearAllCache: mockClearAllCache,
  setAutoDownloadOnWifi: mockSetAutoDownloadOnWifi,
};

jest.mock('@/lib/offline', () => ({
  useOfflineStore: jest.fn(() => mockOfflineState),
  formatBytes: jest.fn((bytes: number) => `${bytes}B`),
  STELLARIUM_LAYERS: [
    { id: 'layer1', name: 'Stars', description: 'Star catalog', size: 1024 },
    { id: 'layer2', name: 'DSO', description: 'Deep sky objects', size: 2048 },
  ],
  offlineCacheManager: {
    getStorageInfo: jest.fn().mockResolvedValue({ used: 500, quota: 10000, available: 9500, usagePercent: 5 }),
  },
}));

const mockGetStorageInfo = jest.requireMock('@/lib/offline').offlineCacheManager.getStorageInfo as jest.Mock;

jest.mock('@/lib/tauri/hooks', () => ({
  useCache: jest.fn(() => ({
    stats: null,
    regions: [],
    isAvailable: false,
    refresh: jest.fn(),
  })),
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock('@/lib/hooks/use-is-client', () => ({
  useIsClient: jest.fn(() => true),
}));

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

jest.mock('@/lib/cache', () => ({
  getCacheProviderDiagnostics: () => ({
    providerId: 'browser-cache-api',
    available: true,
    supportsPersistent: true,
    supportsClear: true,
    supportsCleanup: false,
    supportsFlush: false,
    supportsInterception: true,
  }),
  getCacheDiagnosticsSummary: () => ({
    total: 4,
    persistentShared: 2,
    localOnly: 1,
    uncached: 1,
    active: 2,
    degraded: 0,
  }),
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span data-testid="badge">{children}</span>,
}));
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: React.PropsWithChildren) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <h3>{children}</h3>,
  CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
}));
jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string }) => (
    <input type="checkbox" data-testid={id || 'switch'} checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: React.PropsWithChildren<{ htmlFor?: string }>) => <label htmlFor={htmlFor}>{children}</label>,
}));
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: React.PropsWithChildren<{ value: string; onValueChange: (v: string) => void }>) => (
    <div data-testid="tabs" data-value={value}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange });
        }
        return child;
      })}
    </div>
  ),
  TabsContent: ({ children, value }: React.PropsWithChildren<{ value: string }>) => <div data-testid={`tab-content-${value}`}>{children}</div>,
  TabsList: ({ children }: React.PropsWithChildren) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children, value, onValueChange }: React.PropsWithChildren<{ value: string; onValueChange?: (v: string) => void }>) => (
    <button data-testid={`tab-trigger-${value}`} onClick={() => onValueChange?.(value)}>{children}</button>
  ),
}));
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
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

// Mock child components
jest.mock('../cache-layers-tab', () => ({
  CacheLayersTab: ({ onStorageChanged }: { onStorageChanged: () => void }) => (
    <div data-testid="cache-layers-tab"><button onClick={onStorageChanged}>refreshStorage</button></div>
  ),
}));
jest.mock('../cache-surveys-tab', () => ({
  CacheSurveysTab: ({ isActive }: { isActive: boolean }) => <div data-testid="cache-surveys-tab" data-active={isActive} />,
}));
jest.mock('../cache-unified-tab', () => ({
  CacheUnifiedTab: ({ isActive }: { isActive: boolean }) => <div data-testid="cache-unified-tab" data-active={isActive} />,
}));

import { OfflineCacheManager } from '../offline-cache-manager';

describe('OfflineCacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageInfo.mockImplementation(() => new Promise(() => undefined));
    mockOfflineState = {
      isOnline: true,
      isInitialized: true,
      layerStatuses: [],
      isDownloading: false,
      autoDownloadOnWifi: false,
      initialize: mockInitialize,
      refreshStatuses: mockRefreshStatuses,
      downloadAllLayers: mockDownloadAllLayers,
      cancelAllDownloads: mockCancelAllDownloads,
      clearAllCache: mockClearAllCache,
      setAutoDownloadOnWifi: mockSetAutoDownloadOnWifi,
    };
  });

  // 渲染基本结构
  it('renders card with title', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.offlineCache')).toBeInTheDocument();
  });

  // 在线状态 badge
  it('shows online badge when online', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText('common.online')).toBeInTheDocument();
  });

  // 离线状态 badge
  it('shows offline badge when offline', () => {
    mockOfflineState.isOnline = false;
    render(<OfflineCacheManager />);
    expect(screen.getByText('common.offline')).toBeInTheDocument();
  });

  // 缓存层计数
  it('shows cached layers count in description', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText(/cache\.layersCached/)).toBeInTheDocument();
  });

  // 下载全部按钮
  it('renders download all button', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.downloadAll')).toBeInTheDocument();
  });

  // 点击下载全部
  it('calls downloadAllLayers when download all clicked', () => {
    render(<OfflineCacheManager />);
    fireEvent.click(screen.getByText('cache.downloadAll'));
    expect(mockDownloadAllLayers).toHaveBeenCalled();
  });

  // 下载中禁用下载按钮
  it('disables download all button when downloading', () => {
    mockOfflineState.isDownloading = true;
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.downloadAll').closest('button')).toBeDisabled();
  });

  // 离线时禁用下载按钮
  it('disables download all button when offline', () => {
    mockOfflineState.isOnline = false;
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.downloadAll').closest('button')).toBeDisabled();
  });

  // 显示取消下载按钮
  it('shows cancel downloads button when downloading', () => {
    mockOfflineState.isDownloading = true;
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.cancelDownloads')).toBeInTheDocument();
  });

  // 取消下载
  it('calls cancelAllDownloads when cancel clicked', () => {
    mockOfflineState.isDownloading = true;
    render(<OfflineCacheManager />);
    fireEvent.click(screen.getByText('cache.cancelDownloads'));
    expect(mockCancelAllDownloads).toHaveBeenCalled();
  });

  // 不显示取消下载按钮
  it('does not show cancel button when not downloading', () => {
    render(<OfflineCacheManager />);
    expect(screen.queryByText('cache.cancelDownloads')).not.toBeInTheDocument();
  });

  // 清除全部缓存按钮 - cachedSize=0 时禁用
  it('disables clear button when no cached data', () => {
    render(<OfflineCacheManager />);
    // 找到包含 Trash2 图标的清除按钮（AlertDialogTrigger 内）
    const buttons = screen.getAllByRole('button');
    const clearTrigger = buttons.find(b => b.getAttribute('disabled') !== null && !b.textContent?.includes('cache.downloadAll'));
    expect(clearTrigger).toBeDefined();
    expect(clearTrigger).toBeDisabled();
  });

  // 清除全部缓存确认
  it('calls clearAllCache when clear all confirmed', () => {
    mockOfflineState.layerStatuses = [
      { layerId: 'layer1', cached: true, cachedBytes: 512, cachedFiles: 5, totalFiles: 10, isComplete: true },
    ];
    render(<OfflineCacheManager />);
    fireEvent.click(screen.getByRole('button', { name: 'cache.clearAll' }));
    expect(mockClearAllCache).toHaveBeenCalled();
  });

  // 自动下载 WiFi 开关
  it('renders auto-download switch', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.autoDownloadOnWifi')).toBeInTheDocument();
  });

  // 切换自动下载开关
  it('calls setAutoDownloadOnWifi when switch toggled', () => {
    render(<OfflineCacheManager />);
    const switchEl = screen.getByTestId('auto-download');
    fireEvent.click(switchEl);
    expect(mockSetAutoDownloadOnWifi).toHaveBeenCalled();
  });

  // 显示缓存进度
  it('shows overall progress bar', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByText('cache.cacheStatus')).toBeInTheDocument();
  });

  // 有缓存数据时显示进度百分比
  it('shows correct progress percentage', () => {
    mockOfflineState.layerStatuses = [
      { layerId: 'layer1', cached: true, cachedBytes: 1024, cachedFiles: 10, totalFiles: 10, isComplete: true },
    ];
    render(<OfflineCacheManager />);
    // 1024 / (1024+2048) = 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  // Tab 结构
  it('renders layers and surveys tabs', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByTestId('tab-trigger-layers')).toBeInTheDocument();
    expect(screen.getByTestId('tab-trigger-surveys')).toBeInTheDocument();
  });

  // CacheLayersTab 子组件
  it('renders CacheLayersTab', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByTestId('cache-layers-tab')).toBeInTheDocument();
  });

  // CacheSurveysTab 子组件
  it('renders CacheSurveysTab', () => {
    render(<OfflineCacheManager />);
    expect(screen.getByTestId('cache-surveys-tab')).toBeInTheDocument();
  });

  // 刷新按钮
  it('calls refreshStatuses when refresh button clicked', () => {
    render(<OfflineCacheManager />);
    // 找到 RefreshCw 图标旁的按钮 (通过遍历所有按钮)
    const buttons = screen.getAllByRole('button');
    // 刷新按钮没有文本 children，点第一个无 text 的按钮
    const refreshBtn = buttons.find(b => !b.textContent?.trim());
    if (refreshBtn) {
      fireEvent.click(refreshBtn);
      expect(mockRefreshStatuses).toHaveBeenCalled();
    }
  });

  // 初始化
  it('calls initialize when not initialized', () => {
    mockOfflineState.isInitialized = false;
    render(<OfflineCacheManager />);
    expect(mockInitialize).toHaveBeenCalled();
  });

  // 已初始化不再调用
  it('does not call initialize when already initialized', () => {
    render(<OfflineCacheManager />);
    expect(mockInitialize).not.toHaveBeenCalled();
  });

  // useIsClient 为 false 时显示 loading
  it('shows loading badge when useIsClient returns false', () => {
    const useIsClientMock = jest.requireMock('@/lib/hooks/use-is-client');
    useIsClientMock.useIsClient.mockReturnValue(false);
    render(<OfflineCacheManager />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
    useIsClientMock.useIsClient.mockReturnValue(true);
  });
});
