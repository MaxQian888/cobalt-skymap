/**
 * Log Store
 * 
 * Zustand store for accessing logs in React components.
 * Provides reactive access to the logging system.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  LogLevel,
  LogEntry,
  LogFilter,
  LogPolicyState,
  LogSuppressionStats,
  getLogs,
  getFilteredLogs,
  clearLogs as clearAllLogs,
  setLogLevel,
  getLogLevel,
  getLogPolicyState,
  getLogSuppressionStats,
  setLogSuppressionEnabled,
  onLogsChanged,
  getUniqueModules,
  getLogStats,
  exportLogsAsText,
  exportLogsAsJson,
} from '@/lib/logger';
import { isTauri } from '@/lib/storage/platform';

export interface LogStoreState {
  /** Current logs (may be filtered) */
  logs: LogEntry[];
  /** Total log count (unfiltered) */
  totalCount: number;
  /** Current filter settings */
  filter: LogFilter;
  /** Current log level */
  level: LogLevel;
  /** Available modules (for filter dropdown) */
  modules: string[];
  /** Log statistics */
  stats: {
    total: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  };
  /** Effective logger policy state */
  policy: LogPolicyState;
  /** Duplicate suppression and transport pressure stats */
  suppression: LogSuppressionStats;
  /** Whether the log panel is open */
  isPanelOpen: boolean;
  /** Whether auto-scroll is enabled */
  autoScroll: boolean;
}

export interface LogStoreActions {
  /** Refresh logs from the log manager */
  refresh: () => void;
  /** Set filter options */
  setFilter: (filter: Partial<LogFilter>) => void;
  /** Clear filter */
  clearFilter: () => void;
  /** Set log level */
  setLevel: (level: LogLevel) => void;
  /** Clear all logs */
  clearLogs: () => void;
  /** Export logs as text */
  exportAsText: () => string;
  /** Export logs as JSON */
  exportAsJson: () => string;
  /** Download logs as file */
  downloadLogs: (format: 'text' | 'json') => void | Promise<void>;
  /** Open log panel */
  openPanel: () => void;
  /** Close log panel */
  closePanel: () => void;
  /** Toggle log panel */
  togglePanel: () => void;
  /** Set auto-scroll */
  setAutoScroll: (enabled: boolean) => void;
  /** Set duplicate suppression enabled state */
  setSuppressionEnabled: (enabled: boolean) => void;
}

export type LogStore = LogStoreState & LogStoreActions;

const initialFilter: LogFilter = {
  level: undefined,
  module: undefined,
  search: undefined,
  limit: 500,
};

export const useLogStore = create<LogStore>((set, get) => {
  // Subscribe to log changes
  let unsubscribe: (() => void) | null = null;
  let lastNotifySignature = '';

  const setupSubscription = () => {
    if (unsubscribe) {
      unsubscribe();
    }

    unsubscribe = onLogsChanged((logs) => {
      // Skip redundant refreshes when a throttled notification carries no new
      // information (same count, same trailing entry). Guards against feedback
      // loops where a refresh-driven re-render emits an identical log. Explicit
      // refresh() callers (filters, panel open) bypass this and always apply.
      const last = logs[logs.length - 1];
      const signature = last
        ? `${logs.length}:${(last.lastTimestamp ?? last.timestamp).getTime()}:${last.occurrenceCount ?? 1}`
        : `${logs.length}`;
      if (signature === lastNotifySignature) return;
      lastNotifySignature = signature;
      get().refresh();
    });
  };
  
  // Setup subscription on store creation
  if (typeof window !== 'undefined') {
    setTimeout(setupSubscription, 0);
  }
  
  return {
    // State
    logs: [],
    totalCount: 0,
    filter: initialFilter,
    level: getLogLevel(),
    modules: [],
    stats: {
      total: 0,
      byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
      byModule: {},
    },
    policy: getLogPolicyState(),
    suppression: getLogSuppressionStats(),
    isPanelOpen: false,
    autoScroll: true,
    
    // Actions
    refresh: () => {
      const allLogs = getLogs();
      const { filter } = get();
      
      // Apply filters
      const filteredLogs = Object.keys(filter).some(k => filter[k as keyof LogFilter] !== undefined)
        ? getFilteredLogs(filter)
        : allLogs;
      
      // Get modules and stats from all logs (not filtered)
      const modules = getUniqueModules(allLogs);
      const stats = getLogStats(allLogs);
      const policy = getLogPolicyState();
      const suppression = getLogSuppressionStats();
      
      set({
        logs: filteredLogs,
        totalCount: allLogs.length,
        modules,
        stats,
        policy,
        suppression,
      });
    },
    
    setFilter: (newFilter) => {
      const { filter } = get();
      set({ filter: { ...filter, ...newFilter } });
      get().refresh();
    },
    
    clearFilter: () => {
      set({ filter: initialFilter });
      get().refresh();
    },
    
    setLevel: (level) => {
      setLogLevel(level);
      set({
        level,
        policy: getLogPolicyState(),
      });
    },
    
    clearLogs: () => {
      clearAllLogs();
      set({
        logs: [],
        totalCount: 0,
        modules: [],
        stats: {
          total: 0,
          byLevel: { debug: 0, info: 0, warn: 0, error: 0 },
          byModule: {},
        },
        suppression: getLogSuppressionStats(),
      });
    },
    
    exportAsText: () => {
      const allLogs = getLogs();
      return exportLogsAsText(allLogs);
    },
    
    exportAsJson: () => {
      const allLogs = getLogs();
      return exportLogsAsJson(allLogs);
    },
    
    downloadLogs: async (format) => {
      const { exportAsText, exportAsJson } = get();
      const content = format === 'text' ? exportAsText() : exportAsJson();
      const extension = format === 'text' ? 'txt' : 'json';
      const filename = `skymap-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      
      // Use Tauri native save dialog when available
      if (isTauri()) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          const filePath = await save({
            defaultPath: filename,
            filters: [{
              name: format === 'text' ? 'Text Files' : 'JSON Files',
              extensions: [extension],
            }],
          });
          if (filePath) {
            await writeTextFile(filePath, content);
            return;
          }
          // User cancelled — fall through to no-op
          return;
        } catch {
          // Fall through to browser download on error
        }
      }
      
      // Browser fallback
      const mimeType = format === 'text' ? 'text/plain' : 'application/json';
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    
    openPanel: () => {
      set({ isPanelOpen: true });
      get().refresh();
    },
    
    closePanel: () => {
      set({ isPanelOpen: false });
    },
    
    togglePanel: () => {
      const { isPanelOpen, refresh } = get();
      set({ isPanelOpen: !isPanelOpen });
      if (!isPanelOpen) {
        refresh();
      }
    },
    
    setAutoScroll: (enabled) => {
      set({ autoScroll: enabled });
    },

    setSuppressionEnabled: (enabled) => {
      setLogSuppressionEnabled(enabled);
      set({ suppression: getLogSuppressionStats() });
      get().refresh();
    },
  };
});

/**
 * Hook to get log panel state
 */
export function useLogPanel() {
  return useLogStore(useShallow((state) => ({
    isOpen: state.isPanelOpen,
    open: state.openPanel,
    close: state.closePanel,
    toggle: state.togglePanel,
  })));
}

/**
 * Hook to get log statistics
 */
export function useLogStats() {
  return useLogStore(useShallow((state) => ({
    stats: state.stats,
    totalCount: state.totalCount,
  })));
}
