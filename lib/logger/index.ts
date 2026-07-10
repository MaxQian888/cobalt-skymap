/**
 * Logger Module
 * 
 * Unified logging system for Cobalt Skymap application.
 * 
 * @example
 * ```typescript
 * import { createLogger, LogLevel } from '@/lib/logger';
 * 
 * const logger = createLogger('my-module');
 * 
 * logger.debug('Debug message', { data: 123 });
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message', new Error('Something went wrong'));
 * ```
 */

// Types
export {
  LogLevel,
  type LogLevelName,
  type LogContext,
  type LogContextPayload,
  type LogEntry,
  type Logger,
  type LogTransport,
  type LogFilter,
  type LogManagerConfig,
  type LogPolicyState,
  type LogSuppressionStats,
  DEFAULT_CONFIG,
  LOG_LEVEL_NAMES,
  LOG_LEVEL_VALUES,
  LOG_LEVEL_COLORS,
} from './types';

// Utils
export {
  generateLogId,
  formatTimestamp,
  formatFullTimestamp,
  formatLogLevel,
  serializeData,
  redactSensitiveString,
  sanitizeUnknownData,
  sanitizeLogEntry,
  extractErrorInfo,
  formatLogLine,
  formatLogJson,
  formatLogEntryToText,
  exportLogsAsText,
  exportLogsAsJson,
  buildLogDiagnosticsBundle,
  filterLogs,
  getUniqueModules,
  getLogStats,
  DEFAULT_REDACTION_KEYS,
  groupConsecutiveLogs,
  type GroupedLogEntry,
  type SerializeDataOptions,
  type LogExportOptions,
  type LogDiagnosticsBundle,
} from './utils';

// Log Manager
export {
  logManager,
  LogManager,
  createLogger,
  getLogs,
  getFilteredLogs,
  clearLogs,
  setLogLevel,
  getLogLevel,
  setModuleLogLevel,
  getModuleLogLevels,
  getEffectiveLogLevel,
  getLogPolicyState,
  setLogSuppressionEnabled,
  getLogSuppressionStats,
  resetLogTransportDropStats,
  subscribeToLogs,
  onLogsChanged,
  flushLogs,
} from './log-manager';

// Transports
export {
  ConsoleTransport,
  createConsoleTransport,
  type ConsoleTransportConfig,
  MemoryTransport,
  createMemoryTransport,
  type MemoryTransportConfig,
  type LogListener,
  type LogsChangedListener,
  TauriTransport,
  createTauriTransport,
  type TauriTransportConfig,
} from './transports';
