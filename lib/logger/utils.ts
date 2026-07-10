/**
 * Logger Utilities
 *
 * Helper functions for the logging system.
 */

import { LogLevel, LogEntry, LOG_LEVEL_NAMES } from './types';

/**
 * Default sensitive key patterns for nested object redaction.
 */
export const DEFAULT_REDACTION_KEYS = [
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'passwd',
  'pwd',
  'secret',
  'apiKey',
  'api_key',
  'apikey',
  'cookie',
  'set-cookie',
];

interface SanitizeOptions {
  redactionKeys?: string[];
}

export interface SerializeDataOptions {
  sanitize?: boolean;
  redactionKeys?: string[];
}

export interface LogExportOptions {
  filters?: Record<string, unknown> | null;
  app?: Record<string, unknown>;
  redactionKeys?: string[];
}

export interface LogDiagnosticsBundle {
  bundleVersion: string;
  generatedAt: string;
  runtime: {
    environment: 'web' | 'tauri' | 'unknown';
    platform?: string;
    userAgent?: string;
    language?: string;
  };
  app?: Record<string, unknown>;
  filters: Record<string, unknown> | null;
  summary: {
    totalEntries: number;
    groupedEntries: number;
    suppressedDuplicates: number;
    byLevel: Record<string, number>;
    byModule: Record<string, number>;
  };
  logs: Array<{
    id: string;
    timestamp: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    level: string;
    module: string;
    message: string;
    data?: unknown;
    stack?: string;
    errorName?: string;
    eventCode?: string;
    operationId?: string;
    sessionId?: string;
    tags?: string[];
    occurrenceCount?: number;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRedactionKeys(keys?: string[]): string[] {
  const source = keys && keys.length > 0 ? keys : DEFAULT_REDACTION_KEYS;
  return source.map((key) => key.toLowerCase());
}

function isSensitiveKey(key: string, redactionKeys: string[]): boolean {
  const normalizedKey = key.toLowerCase();
  return redactionKeys.some((pattern) => normalizedKey.includes(pattern));
}

/**
 * Redact sensitive text patterns from free-form string content.
 */
export function redactSensitiveString(input: string): string {
  if (!input) {
    return input;
  }

  let output = input;

  // Authorization header with bearer token.
  output = output.replace(
    /\bauthorization\s*[:=]\s*bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
    'authorization=[REDACTED]'
  );

  // Authorization/header-like key-value pairs.
  output = output.replace(
    /\b(authorization|token|password|passwd|pwd|secret|api[_-]?key|cookie|set-cookie)\s*[:=]\s*([^\r\n\s;,]+)/gi,
    (_match, key: string) => `${key}=[REDACTED]`
  );

  // Query-string credentials.
  output = output.replace(
    /([?&](?:access_token|token|api_key|apikey|key|password)=)([^&\s]+)/gi,
    '$1[REDACTED]'
  );

  // Bearer/JWT-like tokens.
  output = output.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]');
  output = output.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g, '[REDACTED_JWT]');

  // Email addresses.
  output = output.replace(/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi, '[REDACTED_EMAIL]');

  return output;
}

function sanitizeUnknownDataInternal(
  value: unknown,
  redactionKeys: string[],
  visited: WeakSet<object>
): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return String(value);
  }

  if (value instanceof Date) {
    return new Date(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      stack: value.stack ? redactSensitiveString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknownDataInternal(item, redactionKeys, visited));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  if (visited.has(value)) {
    return '[Circular]';
  }
  visited.add(value);

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isSensitiveKey(key, redactionKeys)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeUnknownDataInternal(child, redactionKeys, visited);
    }
  }

  return sanitized;
}

/**
 * Sanitize arbitrary data by masking sensitive nested values.
 */
export function sanitizeUnknownData(data: unknown, options: SanitizeOptions = {}): unknown {
  const redactionKeys = normalizeRedactionKeys(options.redactionKeys);
  return sanitizeUnknownDataInternal(data, redactionKeys, new WeakSet<object>());
}

/**
 * Sanitize log entry fields that may contain sensitive data.
 */
export function sanitizeLogEntry(entry: LogEntry, options: SanitizeOptions = {}): LogEntry {
  const redactionKeys = normalizeRedactionKeys(options.redactionKeys);

  return {
    ...entry,
    message: redactSensitiveString(entry.message),
    data: entry.data !== undefined ? sanitizeUnknownDataInternal(entry.data, redactionKeys, new WeakSet<object>()) : undefined,
    stack: entry.stack ? redactSensitiveString(entry.stack) : undefined,
    occurrenceCount: entry.occurrenceCount ?? 1,
    firstTimestamp: entry.firstTimestamp ?? entry.timestamp,
    lastTimestamp: entry.lastTimestamp ?? entry.timestamp,
  };
}

/**
 * Generate a unique ID for log entries
 */
export function generateLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format a full timestamp for export
 */
export function formatFullTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Format a log level for display
 */
export function formatLogLevel(level: LogLevel): string {
  const name = LOG_LEVEL_NAMES[level];
  return name.toUpperCase().padEnd(5);
}

/**
 * Serialize data for logging
 */
export function serializeData(data: unknown, options: SerializeDataOptions = {}): string {
  if (data === undefined) {
    return '';
  }

  const shouldSanitize = options.sanitize !== false;
  const payload = shouldSanitize
    ? sanitizeUnknownData(data, { redactionKeys: options.redactionKeys })
    : data;

  if (payload === null) {
    return 'null';
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'number' || typeof payload === 'boolean' || typeof payload === 'bigint') {
    return String(payload);
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * Extract error information
 */
export function extractErrorInfo(error: unknown): { message: string; stack?: string; name?: string } {
  if (error instanceof Error) {
    return {
      message: redactSensitiveString(error.message),
      stack: error.stack ? redactSensitiveString(error.stack) : undefined,
      name: error.name,
    };
  }

  if (typeof error === 'string') {
    return { message: redactSensitiveString(error) };
  }

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    return {
      message: redactSensitiveString(String(obj.message || obj.error || JSON.stringify(error))),
      stack: typeof obj.stack === 'string' ? redactSensitiveString(obj.stack) : undefined,
      name: typeof obj.name === 'string' ? obj.name : undefined,
    };
  }

  return { message: redactSensitiveString(String(error)) };
}

/**
 * Format a log entry as a single line string
 */
export function formatLogLine(entry: LogEntry, includeTimestamp = true, includeModule = true): string {
  const safeEntry = sanitizeLogEntry(entry);
  const parts: string[] = [];

  if (includeTimestamp) {
    parts.push(`[${formatTimestamp(safeEntry.timestamp)}]`);
  }

  parts.push(`[${formatLogLevel(safeEntry.level)}]`);

  if (includeModule) {
    parts.push(`[${safeEntry.module}]`);
  }

  parts.push(safeEntry.message);

  if (safeEntry.data !== undefined) {
    const dataStr = serializeData(safeEntry.data, { sanitize: false });
    if (dataStr) {
      parts.push(dataStr);
    }
  }

  if ((safeEntry.occurrenceCount ?? 1) > 1) {
    parts.push(`(x${safeEntry.occurrenceCount})`);
  }

  return parts.join(' ');
}

/**
 * Format a log entry as JSON
 */
export function formatLogJson(entry: LogEntry): string {
  const safeEntry = sanitizeLogEntry(entry);
  return JSON.stringify({
    id: safeEntry.id,
    timestamp: safeEntry.timestamp.toISOString(),
    firstTimestamp: safeEntry.firstTimestamp?.toISOString(),
    lastTimestamp: safeEntry.lastTimestamp?.toISOString(),
    level: LOG_LEVEL_NAMES[safeEntry.level],
    module: safeEntry.module,
    message: safeEntry.message,
    data: safeEntry.data,
    stack: safeEntry.stack,
    errorName: safeEntry.errorName,
    eventCode: safeEntry.eventCode,
    operationId: safeEntry.operationId,
    sessionId: safeEntry.sessionId,
    tags: safeEntry.tags,
    occurrenceCount: safeEntry.occurrenceCount,
  });
}

function getRuntimeContext(): LogDiagnosticsBundle['runtime'] {
  const isBrowser = typeof window !== 'undefined';
  const tauriRuntime = isBrowser && '__TAURI__' in window;

  return {
    environment: tauriRuntime ? 'tauri' : isBrowser ? 'web' : 'unknown',
    platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
  };
}

function computeSuppressionSummary(logs: LogEntry[]): { groupedEntries: number; suppressedDuplicates: number } {
  let groupedEntries = 0;
  let suppressedDuplicates = 0;

  for (const entry of logs) {
    const count = Math.max(1, entry.occurrenceCount ?? 1);
    if (count > 1) {
      groupedEntries += 1;
      suppressedDuplicates += count - 1;
    }
  }

  return { groupedEntries, suppressedDuplicates };
}

/**
 * Build a versioned diagnostics bundle from logs.
 */
export function buildLogDiagnosticsBundle(
  logs: LogEntry[],
  options: LogExportOptions = {}
): LogDiagnosticsBundle {
  const sanitizedLogs = logs.map((entry) => sanitizeLogEntry(entry, { redactionKeys: options.redactionKeys }));
  const stats = getLogStats(sanitizedLogs);
  const suppression = computeSuppressionSummary(sanitizedLogs);

  return {
    bundleVersion: '2.0',
    generatedAt: new Date().toISOString(),
    runtime: getRuntimeContext(),
    app: options.app,
    filters: options.filters ?? null,
    summary: {
      totalEntries: sanitizedLogs.length,
      groupedEntries: suppression.groupedEntries,
      suppressedDuplicates: suppression.suppressedDuplicates,
      byLevel: stats.byLevel,
      byModule: stats.byModule,
    },
    logs: sanitizedLogs.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      firstTimestamp: entry.firstTimestamp?.toISOString(),
      lastTimestamp: entry.lastTimestamp?.toISOString(),
      level: LOG_LEVEL_NAMES[entry.level],
      module: entry.module,
      message: entry.message,
      data: entry.data,
      stack: entry.stack,
      errorName: entry.errorName,
      eventCode: entry.eventCode,
      operationId: entry.operationId,
      sessionId: entry.sessionId,
      tags: entry.tags,
      occurrenceCount: entry.occurrenceCount,
    })),
  };
}

/**
 * Export logs to a downloadable text format
 */
export function exportLogsAsText(logs: LogEntry[], options: LogExportOptions = {}): string {
  const bundle = buildLogDiagnosticsBundle(logs, options);
  const header = [
    'Cobalt Skymap Application Logs',
    `Bundle Version: ${bundle.bundleVersion}`,
    `Generated: ${bundle.generatedAt}`,
    `Runtime: ${bundle.runtime.environment}`,
    `Total Entries: ${bundle.summary.totalEntries}`,
    `Suppressed Duplicates: ${bundle.summary.suppressedDuplicates}`,
    '='.repeat(80),
    '',
  ].join('\n');

  const body = bundle.logs
    .map((entry) => {
      let line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}] ${entry.message}`;

      if ((entry.occurrenceCount ?? 1) > 1) {
        line += `\n  Occurrences: ${entry.occurrenceCount} (${entry.firstTimestamp} -> ${entry.lastTimestamp})`;
      }

      if (entry.eventCode) {
        line += `\n  Event: ${entry.eventCode}`;
      }

      if (entry.operationId || entry.sessionId) {
        line += `\n  Correlation: operationId=${entry.operationId ?? '-'}, sessionId=${entry.sessionId ?? '-'}`;
      }

      if (entry.data !== undefined) {
        line += `\n  Data: ${serializeData(entry.data, { sanitize: false })}`;
      }

      if (entry.stack) {
        line += `\n  Stack:\n${entry.stack.split('\n').map((segment) => `    ${segment}`).join('\n')}`;
      }

      return line;
    })
    .join('\n\n');

  return header + body;
}

/**
 * Export logs to JSON format
 */
export function exportLogsAsJson(logs: LogEntry[], options: LogExportOptions = {}): string {
  return JSON.stringify(buildLogDiagnosticsBundle(logs, options), null, 2);
}

/**
 * Format a log entry as copyable text (for clipboard)
 */
export function formatLogEntryToText(entry: LogEntry): string {
  const safeEntry = sanitizeLogEntry(entry);
  return [
    `[${safeEntry.timestamp.toISOString()}] [${LOG_LEVEL_NAMES[safeEntry.level].toUpperCase()}] [${safeEntry.module}]`,
    safeEntry.message,
    safeEntry.eventCode ? `Event: ${safeEntry.eventCode}` : '',
    safeEntry.operationId || safeEntry.sessionId
      ? `Correlation: operationId=${safeEntry.operationId ?? '-'}, sessionId=${safeEntry.sessionId ?? '-'}`
      : '',
    safeEntry.occurrenceCount && safeEntry.occurrenceCount > 1
      ? `Occurrences: ${safeEntry.occurrenceCount} (${safeEntry.firstTimestamp?.toISOString()} -> ${safeEntry.lastTimestamp?.toISOString()})`
      : '',
    safeEntry.data !== undefined ? `Data: ${serializeData(safeEntry.data, { sanitize: false })}` : '',
    safeEntry.stack ? `Stack: ${safeEntry.stack}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Filter logs based on criteria
 */
export function filterLogs(logs: LogEntry[], filter: {
  level?: LogLevel;
  module?: string;
  search?: string;
  startTime?: Date;
  endTime?: Date;
}): LogEntry[] {
  return logs.filter(entry => {
    // Level filter
    if (filter.level !== undefined && entry.level < filter.level) {
      return false;
    }

    // Module filter (prefix match)
    if (filter.module && !entry.module.toLowerCase().startsWith(filter.module.toLowerCase())) {
      return false;
    }

    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const messageMatch = entry.message.toLowerCase().includes(searchLower);
      const moduleMatch = entry.module.toLowerCase().includes(searchLower);
      const eventMatch = entry.eventCode?.toLowerCase().includes(searchLower) ?? false;
      const dataMatch = entry.data ? serializeData(entry.data).toLowerCase().includes(searchLower) : false;

      if (!messageMatch && !moduleMatch && !eventMatch && !dataMatch) {
        return false;
      }
    }

    // Time range filter
    if (filter.startTime && entry.timestamp < filter.startTime) {
      return false;
    }

    if (filter.endTime && entry.timestamp > filter.endTime) {
      return false;
    }

    return true;
  });
}

/**
 * Get unique modules from logs
 */
export function getUniqueModules(logs: LogEntry[]): string[] {
  const modules = new Set<string>();
  for (const entry of logs) {
    modules.add(entry.module);
  }
  return Array.from(modules).sort();
}

/**
 * Get log statistics
 */
export function getLogStats(logs: LogEntry[]): {
  total: number;
  byLevel: Record<string, number>;
  byModule: Record<string, number>;
} {
  const byLevel: Record<string, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };

  const byModule: Record<string, number> = {};

  for (const entry of logs) {
    const levelName = LOG_LEVEL_NAMES[entry.level];
    const count = Math.max(1, entry.occurrenceCount ?? 1);
    if (levelName !== 'none') {
      byLevel[levelName] += count;
    }

    byModule[entry.module] = (byModule[entry.module] || 0) + count;
  }

  return {
    total: logs.reduce((sum, entry) => sum + Math.max(1, entry.occurrenceCount ?? 1), 0),
    byLevel,
    byModule,
  };
}

/**
 * Grouped log entry — represents one or more consecutive identical logs
 */
export interface GroupedLogEntry {
  /** The representative log entry */
  entry: LogEntry;
  /** Number of consecutive duplicates (1 = no duplicates) */
  count: number;
  /** Timestamps of all occurrences */
  timestamps: Date[];
}

function entryDuplicateKey(entry: LogEntry): string {
  return `${entry.module}::${entry.message}::${entry.eventCode ?? ''}`;
}

/**
 * Group consecutive duplicate log entries.
 * Two entries are considered duplicates if they share the same module/message/eventCode.
 */
export function groupConsecutiveLogs(logs: LogEntry[]): GroupedLogEntry[] {
  if (logs.length === 0) return [];

  const groups: GroupedLogEntry[] = [];
  const first = logs[0];
  const firstCount = Math.max(1, first.occurrenceCount ?? 1);
  let current: GroupedLogEntry = {
    entry: {
      ...first,
      occurrenceCount: firstCount,
      firstTimestamp: first.firstTimestamp ?? first.timestamp,
      lastTimestamp: first.lastTimestamp ?? first.timestamp,
    },
    count: firstCount,
    timestamps: [first.firstTimestamp ?? first.timestamp],
  };

  for (let i = 1; i < logs.length; i++) {
    const entry = logs[i];
    const entryCount = Math.max(1, entry.occurrenceCount ?? 1);
    if (entryDuplicateKey(entry) === entryDuplicateKey(current.entry)) {
      current.count += entryCount;
      current.entry.occurrenceCount = current.count;

      const incomingFirst = entry.firstTimestamp ?? entry.timestamp;
      const incomingLast = entry.lastTimestamp ?? entry.timestamp;

      if (!current.entry.firstTimestamp || incomingFirst < current.entry.firstTimestamp) {
        current.entry.firstTimestamp = incomingFirst;
      }

      if (!current.entry.lastTimestamp || incomingLast > current.entry.lastTimestamp) {
        current.entry.lastTimestamp = incomingLast;
      }

      current.timestamps.push(incomingLast);
    } else {
      groups.push(current);
      current = {
        entry: {
          ...entry,
          occurrenceCount: entryCount,
          firstTimestamp: entry.firstTimestamp ?? entry.timestamp,
          lastTimestamp: entry.lastTimestamp ?? entry.timestamp,
        },
        count: entryCount,
        timestamps: [entry.firstTimestamp ?? entry.timestamp],
      };
    }
  }

  groups.push(current);
  return groups;
}
