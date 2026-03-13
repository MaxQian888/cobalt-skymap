/**
 * Logger Utils Tests
 */

import {
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
  exportLogsAsText,
  exportLogsAsJson,
  formatLogEntryToText,
  filterLogs,
  getUniqueModules,
  getLogStats,
  groupConsecutiveLogs,
  buildLogDiagnosticsBundle,
} from '../utils';
import { LogLevel, LogEntry } from '../types';

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? generateLogId(),
    timestamp: overrides.timestamp ?? new Date('2025-01-15T10:30:00.123Z'),
    level: overrides.level ?? LogLevel.INFO,
    module: overrides.module ?? 'test',
    message: overrides.message ?? 'test message',
    data: overrides.data,
    stack: overrides.stack,
    errorName: overrides.errorName,
    eventCode: overrides.eventCode,
    operationId: overrides.operationId,
    sessionId: overrides.sessionId,
    tags: overrides.tags,
    occurrenceCount: overrides.occurrenceCount,
    firstTimestamp: overrides.firstTimestamp,
    lastTimestamp: overrides.lastTimestamp,
  };
}

describe('generateLogId', () => {
  it('generates unique IDs', () => {
    const id1 = generateLogId();
    const id2 = generateLogId();
    expect(id1).not.toBe(id2);
  });

  it('returns a string', () => {
    expect(typeof generateLogId()).toBe('string');
  });
});

describe('formatTimestamp', () => {
  it('formats HH:MM:SS.mmm', () => {
    const date = new Date('2025-01-15T08:05:09.007Z');
    const result = formatTimestamp(date);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

describe('formatFullTimestamp', () => {
  it('returns ISO string', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    expect(formatFullTimestamp(date)).toBe('2025-01-15T10:30:00.000Z');
  });
});

describe('formatLogLevel', () => {
  it('formats DEBUG', () => {
    expect(formatLogLevel(LogLevel.DEBUG).trim()).toBe('DEBUG');
  });

  it('formats INFO', () => {
    expect(formatLogLevel(LogLevel.INFO).trim()).toBe('INFO');
  });

  it('formats WARN', () => {
    expect(formatLogLevel(LogLevel.WARN).trim()).toBe('WARN');
  });

  it('formats ERROR', () => {
    expect(formatLogLevel(LogLevel.ERROR).trim()).toBe('ERROR');
  });
});

describe('serializeData', () => {
  it('returns empty string for undefined', () => {
    expect(serializeData(undefined)).toBe('');
  });

  it('returns "null" for null', () => {
    expect(serializeData(null)).toBe('null');
  });

  it('returns string as-is', () => {
    expect(serializeData('hello')).toBe('hello');
  });

  it('converts number to string', () => {
    expect(serializeData(42)).toBe('42');
  });

  it('serializes objects as JSON', () => {
    const result = serializeData({ a: 1, b: 'two' });
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ a: 1, b: 'two' });
  });

  it('handles arrays', () => {
    const result = serializeData([1, 2, 3]);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('redacts sensitive keys by default', () => {
    const result = serializeData({ token: 'abc123', nested: { password: 'secret' } });
    expect(result).toContain('[REDACTED]');
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('secret');
  });

  it('can skip sanitization for raw exports', () => {
    const result = serializeData({ token: 'abc123' }, { sanitize: false });
    expect(result).toContain('abc123');
  });

  it('falls back to String() when JSON serialization fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(serializeData(circular, { sanitize: false })).toBe('[object Object]');
  });
});

describe('redaction helpers', () => {
  it('redacts sensitive string patterns', () => {
    const output = redactSensitiveString('authorization: Bearer abc123 token=xyz user@example.com');
    expect(output).toContain('[REDACTED]');
    expect(output).toContain('[REDACTED_EMAIL]');
    expect(output).not.toContain('abc123');
    expect(output).not.toContain('xyz');
  });

  it('sanitizes nested objects', () => {
    const sanitized = sanitizeUnknownData({
      authToken: 'abc',
      profile: { password: 'secret', city: 'Shanghai' },
    }) as Record<string, unknown>;

    expect(sanitized.authToken).toBe('[REDACTED]');
    expect((sanitized.profile as Record<string, unknown>).password).toBe('[REDACTED]');
    expect((sanitized.profile as Record<string, unknown>).city).toBe('Shanghai');
  });

  it('sanitizes special values and circular references', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    circular.createdAt = new Date('2025-01-15T10:30:00.000Z');
    circular.big = BigInt(10);
    circular.handler = () => 'secret';
    circular.marker = Symbol('secret');
    circular.failure = new Error('token=abc');

    const sanitized = sanitizeUnknownData(circular) as Record<string, unknown>;

    expect(sanitized.self).toBe('[Circular]');
    expect(sanitized.createdAt).toEqual(new Date('2025-01-15T10:30:00.000Z'));
    expect(sanitized.big).toBe('10');
    expect(typeof sanitized.handler).toBe('string');
    expect(typeof sanitized.marker).toBe('string');
    expect(sanitized.failure).toEqual(expect.objectContaining({
      message: 'token=[REDACTED]',
    }));
  });

  it('sanitizes log entries', () => {
    const entry = sanitizeLogEntry(makeEntry({
      message: 'token=abc',
      data: { authorization: 'Bearer x' },
      stack: 'password=secret',
    }));

    expect(entry.message).toContain('[REDACTED]');
    expect(JSON.stringify(entry.data)).toContain('[REDACTED]');
    expect(entry.stack).toContain('[REDACTED]');
  });
});

describe('extractErrorInfo', () => {
  it('extracts from Error object', () => {
    const err = new Error('test error');
    const info = extractErrorInfo(err);
    expect(info.message).toBe('test error');
    expect(info.name).toBe('Error');
    expect(info.stack).toBeDefined();
  });

  it('handles string errors', () => {
    const info = extractErrorInfo('something went wrong');
    expect(info.message).toBe('something went wrong');
  });

  it('handles unknown types', () => {
    const info = extractErrorInfo(42);
    expect(info.message).toBeDefined();
  });

  it('extracts message, stack, and name from plain objects', () => {
    const info = extractErrorInfo({
      name: 'BackendError',
      message: 'authorization=abc',
      stack: 'token=xyz',
    });

    expect(info).toEqual({
      message: 'authorization=[REDACTED]',
      stack: 'token=[REDACTED]',
      name: 'BackendError',
    });
  });
});

describe('format helpers', () => {
  it('formats a log entry as a single line', () => {
    const line = formatLogLine(makeEntry({
      message: 'token=abc',
      data: { password: 'secret' },
      occurrenceCount: 3,
    }));

    expect(line).toContain('[INFO ]');
    expect(line).toContain('[test]');
    expect(line).toContain('token=[REDACTED]');
    expect(line).toContain('[REDACTED]');
    expect(line).toContain('(x3)');
  });

  it('omits optional prefixes when disabled', () => {
    const line = formatLogLine(makeEntry({ message: 'minimal' }), false, false);

    expect(line).toBe('[INFO ] minimal');
  });

  it('formats a log entry as JSON', () => {
    const json = JSON.parse(formatLogJson(makeEntry({
      message: 'password=secret',
      eventCode: 'JSON_EVENT',
      occurrenceCount: 2,
    })));

    expect(json.level).toBe('info');
    expect(json.message).toContain('[REDACTED]');
    expect(json.eventCode).toBe('JSON_EVENT');
    expect(json.occurrenceCount).toBe(2);
  });

  it('formats a log entry as copyable text', () => {
    const text = formatLogEntryToText(makeEntry({
      message: 'copied log',
      eventCode: 'COPY_EVENT',
      operationId: 'op-1',
      sessionId: 'sess-1',
      occurrenceCount: 2,
      firstTimestamp: new Date('2025-01-15T10:30:00.000Z'),
      lastTimestamp: new Date('2025-01-15T10:31:00.000Z'),
      data: { foo: 'bar' },
      stack: 'line 1\nline 2',
    }));

    expect(text).toContain('COPY_EVENT');
    expect(text).toContain('Correlation: operationId=op-1, sessionId=sess-1');
    expect(text).toContain('Occurrences: 2');
    expect(text).toContain('Data:');
    expect(text).toContain('Stack: line 1');
  });
});

describe('filterLogs', () => {
  const logs: LogEntry[] = [
    makeEntry({ level: LogLevel.DEBUG, module: 'auth', message: 'debug msg' }),
    makeEntry({ level: LogLevel.INFO, module: 'auth', message: 'info msg' }),
    makeEntry({ level: LogLevel.WARN, module: 'api', message: 'warn msg' }),
    makeEntry({ level: LogLevel.ERROR, module: 'api', message: 'error msg' }),
  ];

  it('filters by level', () => {
    const result = filterLogs(logs, { level: LogLevel.WARN });
    expect(result.length).toBe(2);
    expect(result.every((entry) => entry.level >= LogLevel.WARN)).toBe(true);
  });

  it('filters by module', () => {
    const result = filterLogs(logs, { module: 'auth' });
    expect(result.length).toBe(2);
    expect(result.every((entry) => entry.module === 'auth')).toBe(true);
  });

  it('filters by search text', () => {
    const result = filterLogs(logs, { search: 'warn' });
    expect(result.length).toBe(1);
    expect(result[0].message).toBe('warn msg');
  });

  it('matches search text against event codes and serialized data', () => {
    const result = filterLogs([
      makeEntry({ message: 'plain', eventCode: 'LOGIN_OK', data: { note: 'deep sky' } }),
      makeEntry({ message: 'other', module: 'api' }),
    ], { search: 'deep sky' });

    expect(result).toHaveLength(1);
    expect(result[0].eventCode).toBe('LOGIN_OK');
  });

  it('combines filters', () => {
    const result = filterLogs(logs, { level: LogLevel.INFO, module: 'api' });
    expect(result.length).toBe(2);
  });

  it('returns all with empty filter', () => {
    const result = filterLogs(logs, {});
    expect(result.length).toBe(4);
  });

  it('filters by time range', () => {
    const now = new Date();
    const old = new Date(now.getTime() - 3600000);
    const logsWithTime = [
      makeEntry({ timestamp: old, message: 'old' }),
      makeEntry({ timestamp: now, message: 'new' }),
    ];
    const result = filterLogs(logsWithTime, {
      startTime: new Date(now.getTime() - 1000),
    });
    expect(result.length).toBe(1);
    expect(result[0].message).toBe('new');
  });
});

describe('getUniqueModules', () => {
  it('returns unique module names', () => {
    const logs = [
      makeEntry({ module: 'auth' }),
      makeEntry({ module: 'api' }),
      makeEntry({ module: 'auth' }),
    ];
    const modules = getUniqueModules(logs);
    expect(modules).toHaveLength(2);
    expect(modules).toContain('auth');
    expect(modules).toContain('api');
  });

  it('returns empty for no logs', () => {
    expect(getUniqueModules([])).toEqual([]);
  });
});

describe('getLogStats', () => {
  it('counts by level', () => {
    const logs = [
      makeEntry({ level: LogLevel.DEBUG }),
      makeEntry({ level: LogLevel.INFO }),
      makeEntry({ level: LogLevel.INFO }),
      makeEntry({ level: LogLevel.ERROR }),
    ];
    const stats = getLogStats(logs);
    expect(stats.total).toBe(4);
    expect(stats.byLevel.debug).toBe(1);
    expect(stats.byLevel.info).toBe(2);
    expect(stats.byLevel.warn).toBe(0);
    expect(stats.byLevel.error).toBe(1);
  });

  it('counts by module', () => {
    const logs = [
      makeEntry({ module: 'a' }),
      makeEntry({ module: 'b' }),
      makeEntry({ module: 'a' }),
    ];
    const stats = getLogStats(logs);
    expect(stats.byModule['a']).toBe(2);
    expect(stats.byModule['b']).toBe(1);
  });

  it('includes occurrenceCount in totals', () => {
    const logs = [
      makeEntry({ module: 'a', occurrenceCount: 3 }),
      makeEntry({ module: 'b', occurrenceCount: 2 }),
      makeEntry({ level: LogLevel.NONE, module: 'silent' }),
    ];
    const stats = getLogStats(logs);
    expect(stats.total).toBe(6);
    expect(stats.byModule['a']).toBe(3);
    expect(stats.byModule['b']).toBe(2);
    expect(stats.byLevel.error).toBe(0);
  });
});

describe('groupConsecutiveLogs', () => {
  it('returns empty for empty input', () => {
    expect(groupConsecutiveLogs([])).toEqual([]);
  });

  it('does not group different messages', () => {
    const logs = [
      makeEntry({ message: 'a' }),
      makeEntry({ message: 'b' }),
    ];
    const groups = groupConsecutiveLogs(logs);
    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(1);
    expect(groups[1].count).toBe(1);
  });

  it('groups consecutive identical logs', () => {
    const logs = [
      makeEntry({ module: 'test', message: 'repeat' }),
      makeEntry({ module: 'test', message: 'repeat' }),
      makeEntry({ module: 'test', message: 'repeat' }),
    ];
    const groups = groupConsecutiveLogs(logs);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(3);
    expect(groups[0].timestamps).toHaveLength(3);
  });

  it('accumulates embedded occurrenceCount when grouping', () => {
    const logs = [
      makeEntry({ module: 'test', message: 'repeat', occurrenceCount: 3 }),
      makeEntry({ module: 'test', message: 'repeat', occurrenceCount: 2 }),
    ];
    const groups = groupConsecutiveLogs(logs);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(5);
  });

  it('does not group non-consecutive duplicates', () => {
    const logs = [
      makeEntry({ module: 'test', message: 'a' }),
      makeEntry({ module: 'test', message: 'b' }),
      makeEntry({ module: 'test', message: 'a' }),
    ];
    const groups = groupConsecutiveLogs(logs);
    expect(groups).toHaveLength(3);
  });

  it('does not group same message from different modules', () => {
    const logs = [
      makeEntry({ module: 'mod1', message: 'same' }),
      makeEntry({ module: 'mod2', message: 'same' }),
    ];
    const groups = groupConsecutiveLogs(logs);
    expect(groups).toHaveLength(2);
  });
});

describe('buildLogDiagnosticsBundle', () => {
  it('creates versioned bundle with runtime and summary', () => {
    const logs = [
      makeEntry({ level: LogLevel.INFO, module: 'app', occurrenceCount: 3 }),
      makeEntry({ level: LogLevel.ERROR, module: 'api' }),
    ];
    const bundle = buildLogDiagnosticsBundle(logs, { filters: { level: 'info' } });

    expect(bundle.bundleVersion).toBe('2.0');
    expect(bundle.generatedAt).toBeDefined();
    expect(bundle.summary.totalEntries).toBe(2);
    expect(bundle.summary.suppressedDuplicates).toBe(2);
    expect(bundle.filters).toEqual({ level: 'info' });
    expect(bundle.logs).toHaveLength(2);
  });

  it('detects the tauri runtime when the window flag is present', () => {
    const originalTauri = (window as typeof window & { __TAURI__?: unknown }).__TAURI__;
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {},
    });

    const bundle = buildLogDiagnosticsBundle([makeEntry()], { app: { version: '1.0.0' } });
    expect(bundle.runtime.environment).toBe('tauri');
    expect(bundle.app).toEqual({ version: '1.0.0' });

    if (originalTauri === undefined) {
      delete (window as typeof window & { __TAURI__?: unknown }).__TAURI__;
    } else {
      Object.defineProperty(window, '__TAURI__', {
        configurable: true,
        value: originalTauri,
      });
    }
  });
});

describe('export helpers', () => {
  const exportedLogs = [
    makeEntry({
      level: LogLevel.ERROR,
      module: 'api',
      message: 'request failed',
      data: { token: 'abc123' },
      stack: 'line 1\nline 2',
      eventCode: 'REQ_FAIL',
      operationId: 'op-9',
      sessionId: 'sess-9',
      occurrenceCount: 2,
      firstTimestamp: new Date('2025-01-15T10:30:00.000Z'),
      lastTimestamp: new Date('2025-01-15T10:31:00.000Z'),
    }),
  ];

  it('exports logs as readable text', () => {
    const text = exportLogsAsText(exportedLogs, {
      app: { build: 'test' },
      filters: { module: 'api' },
    });

    expect(text).toContain('SkyMap Application Logs');
    expect(text).toContain('Runtime:');
    expect(text).toContain('Event: REQ_FAIL');
    expect(text).toContain('Correlation: operationId=op-9, sessionId=sess-9');
    expect(text).toContain('Occurrences: 2');
    expect(text).toContain('[REDACTED]');
    expect(text).toContain('Stack:');
  });

  it('exports logs as structured JSON', () => {
    const json = JSON.parse(exportLogsAsJson(exportedLogs, {
      app: { build: 'test' },
      filters: { module: 'api' },
    }));

    expect(json.bundleVersion).toBe('2.0');
    expect(json.filters).toEqual({ module: 'api' });
    expect(json.app).toEqual({ build: 'test' });
    expect(json.logs[0].message).toBe('request failed');
    expect(json.logs[0].data.token).toBe('[REDACTED]');
  });
});
