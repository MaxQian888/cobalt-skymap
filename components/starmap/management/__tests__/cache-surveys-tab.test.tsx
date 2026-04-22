/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CacheSurveysTab } from '../cache-surveys-tab';

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
  useOfflineStore: jest.fn(() => ({ isOnline: true })),
  formatBytes: jest.fn((bytes: number) => `${bytes}B`),
  offlineCacheManager: {
    getHiPSCacheStatus: jest.fn().mockResolvedValue({ cached: false, cachedTiles: 0, totalTiles: 100, cachedBytes: 0 }),
    downloadHiPSSurvey: jest.fn().mockResolvedValue(true),
    clearHiPSCache: jest.fn().mockResolvedValue(true),
    clearAllHiPSCaches: jest.fn().mockResolvedValue(true),
  },
  convertToHiPSSurvey: jest.fn((s: { id: string }) => s),
}));

jest.mock('@/lib/core/constants', () => ({
  SKY_SURVEYS: [
    { id: 'survey1', name: 'DSS2', description: 'Digitized Sky Survey 2', url: 'https://example.com/dss2' },
  ],
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/progress', () => ({ Progress: () => <div data-testid="progress" /> }));
jest.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
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

import { offlineCacheManager } from '@/lib/offline';
const mockCacheManager = offlineCacheManager as jest.Mocked<typeof offlineCacheManager>;

describe('CacheSurveysTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheManager.getHiPSCacheStatus.mockImplementation(() => new Promise(() => undefined));
  });

  it('renders survey list', () => {
    render(<CacheSurveysTab isActive={true} />);
    expect(screen.getByText('DSS2')).toBeInTheDocument();
    expect(screen.getByText('Digitized Sky Survey 2')).toBeInTheDocument();
  });

  it('renders cached count summary', () => {
    render(<CacheSurveysTab isActive={true} />);
    expect(screen.getByText(/survey\.surveysCached/)).toBeInTheDocument();
  });

  it('renders without crashing when inactive', () => {
    render(<CacheSurveysTab isActive={false} />);
    expect(screen.getByText('DSS2')).toBeInTheDocument();
  });

  // 刷新按钮调用 refreshSurveyStatuses
  it('calls getHiPSCacheStatus when active', async () => {
    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(mockCacheManager.getHiPSCacheStatus).toHaveBeenCalled();
    });
  });

  // 显示缓存状态后的清除按钮
  it('renders download button for uncached survey', async () => {
    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(mockCacheManager.getHiPSCacheStatus).toHaveBeenCalled();
    });
    // 下载按钮应该存在（survey 未缓存时）
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // 下载 survey - 验证下载按钮存在且可点击
  it('renders clickable download button for uncached survey', async () => {
    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(mockCacheManager.getHiPSCacheStatus).toHaveBeenCalled();
    });

    // 找到下载按钮
    const buttons = screen.getAllByRole('button');
    const downloadBtn = buttons.find(b => !b.hasAttribute('disabled') && !b.textContent?.trim());
    expect(downloadBtn).toBeDefined();
  });

  // 清除单个 survey 缓存
  it('renders clear all button when surveys are cached', async () => {
    mockCacheManager.getHiPSCacheStatus.mockResolvedValue({
      surveyId: 'test', surveyName: 'Test', surveyUrl: 'http://test', cached: true, cachedTiles: 50, totalTiles: 100, cachedBytes: 5000, estimatedTotalBytes: 10000, cachedOrders: [3], maxCachedOrder: 3,
    });

    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(mockCacheManager.getHiPSCacheStatus).toHaveBeenCalled();
    });

    // 缓存后应该有清除按钮和 clear all 触发器
    await waitFor(() => {
      expect(screen.getByText('cache.clearAll')).toBeInTheDocument();
    });
  });

  // 清除全部 survey 缓存
  it('calls clearAllHiPSCaches when clear all confirmed', async () => {
    mockCacheManager.getHiPSCacheStatus.mockResolvedValue({
      surveyId: 'test', surveyName: 'Test', surveyUrl: 'http://test', cached: true, cachedTiles: 50, totalTiles: 100, cachedBytes: 5000, estimatedTotalBytes: 10000, cachedOrders: [3], maxCachedOrder: 3,
    });

    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(screen.getByText('cache.clearAll')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('cache.clearAll'));
    await waitFor(() => {
      expect(mockCacheManager.clearAllHiPSCaches).toHaveBeenCalled();
    });
  });

  // 加载失败显示 toast
  it('shows error toast when loading fails', async () => {
    mockCacheManager.getHiPSCacheStatus.mockRejectedValue(new Error('Load failed'));
    const { toast } = jest.requireMock('sonner') as { toast: { error: jest.Mock } };

    render(<CacheSurveysTab isActive={true} />);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('cache.loadFailed');
    });
  });
});
