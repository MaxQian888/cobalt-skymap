/**
 * Tests for log-manager.ts
 * Central log manager singleton
 */

import {
  createLogger,
  getLogs,
  clearLogs,
  getFilteredLogs,
  setLogLevel,
  getLogLevel,
  setModuleLogLevel,
  getModuleLogLevels,
  getEffectiveLogLevel,
  getLogPolicyState,
  getLogSuppressionStats,
  resetLogTransportDropStats,
  subscribeToLogs,
  onLogsChanged,
  flushLogs,
  logManager,
  LogManager,
} from '../log-manager';
import { LogLevel, type LogTransport } from '../types';

describe('LogManager', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    logManager.reset();
  });

  it('should create a logger with a module name', () => {
    const logger = createLogger('test-module');
    expect(logger.getModule()).toBe('test-module');
  });

  it('should log messages at different levels', () => {
    const logger = createLogger('test');
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    const logs = getLogs();
    expect(logs.length).toBeGreaterThanOrEqual(4);
  });

  it('should clear logs', () => {
    const logger = createLogger('test');
    logger.info('test message');
    clearLogs();
    const logs = getLogs();
    expect(logs.length).toBe(0);
  });

  it('should get and set log level', () => {
    const original = getLogLevel();
    setLogLevel(LogLevel.ERROR);
    expect(getLogLevel()).toBe(LogLevel.ERROR);
    setLogLevel(original);
  });

  it('should filter logs below current level', () => {
    setLogLevel(LogLevel.ERROR);
    const logger = createLogger('test');
    logger.debug('should be filtered');
    logger.info('should be filtered');
    logger.error('should appear');

    const logs = getLogs();
    const errorLogs = logs.filter((entry) => entry.module === 'test');
    expect(errorLogs.length).toBe(1);
    expect(errorLogs[0].message).toBe('should appear');
  });

  it('applies module-level overrides over global level', () => {
    setLogLevel(LogLevel.WARN);
    setModuleLogLevel('test-module', LogLevel.DEBUG);

    const logger = createLogger('test-module');
    logger.debug('debug with module override');

    const logs = getLogs().filter((entry) => entry.module === 'test-module');
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('debug with module override');
  });

  it('accepts contextual payload in second argument', () => {
    const logger = createLogger('test');
    logger.info('context test', {
      data: { foo: 'bar' },
      eventCode: 'TEST_EVENT',
      operationId: 'op-1',
      sessionId: 'sess-1',
      tags: ['alpha', 'beta'],
    });

    const entry = getLogs().find((log) => log.message.includes('context test'));
    expect(entry).toBeDefined();
    expect(entry?.eventCode).toBe('TEST_EVENT');
    expect(entry?.operationId).toBe('op-1');
    expect(entry?.sessionId).toBe('sess-1');
    expect(entry?.tags).toEqual(['alpha', 'beta']);
  });

  it('merges explicit context with nested context envelopes', () => {
    const logger = createLogger('test');
    logger.info(
      'nested context test',
      {
        data: { foo: 'bar' },
        context: {
          eventCode: 'CTX_EVENT',
          tags: ['alpha', 'alpha', '', 'beta'],
        },
      },
      {
        operationId: 'op-42',
        sessionId: 'sess-42',
      }
    );

    const entry = getLogs().find((log) => log.message.includes('nested context test'));
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual({ foo: 'bar' });
    expect(entry?.eventCode).toBe('CTX_EVENT');
    expect(entry?.operationId).toBe('op-42');
    expect(entry?.sessionId).toBe('sess-42');
    expect(entry?.tags).toEqual(['alpha', 'beta']);
  });

  it('redacts sensitive values before storing entries', () => {
    const logger = createLogger('test');
    logger.info('token=abcd1234', { password: 'secret123' });

    const entry = getLogs().find((log) => log.module === 'test');
    expect(entry).toBeDefined();
    expect(entry?.message).toContain('[REDACTED]');
    expect(JSON.stringify(entry?.data)).toContain('[REDACTED]');
    expect(JSON.stringify(entry?.data)).not.toContain('secret123');
  });

  it('exposes policy and suppression stats', () => {
    setLogLevel(LogLevel.ERROR);
    setModuleLogLevel('test', LogLevel.DEBUG);

    const policy = getLogPolicyState();
    expect(policy.globalLevel).toBe(LogLevel.ERROR);
    expect(policy.moduleLevels.test).toBe(LogLevel.DEBUG);
    expect(getEffectiveLogLevel('test')).toBe(LogLevel.DEBUG);

    const logger = createLogger('test');
    logger.warn('repeat');
    logger.warn('repeat');
    const suppression = getLogSuppressionStats();
    expect(suppression.enabled).toBe(true);
    expect(suppression.suppressedDuplicates).toBeGreaterThanOrEqual(1);
  });

  it('stores error metadata and normalizes explicit context tags', () => {
    const logger = createLogger('test');
    const error = new TypeError('token=shhh');
    error.stack = 'password=top-secret';

    logger.error('request failed', error, {
      tags: ['network', 'network', '', 'critical'],
      eventCode: 'REQ_FAIL',
    });

    const entry = getLogs().find((log) => log.message.includes('request failed'));
    expect(entry).toEqual(expect.objectContaining({
      errorName: 'TypeError',
      eventCode: 'REQ_FAIL',
      tags: ['network', 'critical'],
    }));
    expect(entry?.message).toContain('[REDACTED]');
    expect(entry?.data).toEqual({
      name: 'TypeError',
      message: 'token=[REDACTED]',
    });
    expect(entry?.stack).toContain('[REDACTED]');
  });

  it('returns cached logger instances per module', () => {
    const first = createLogger('shared-module');
    const second = createLogger('shared-module');

    expect(second).toBe(first);
  });

  it('supports filtering and subscriptions through public helpers', () => {
    jest.useFakeTimers();
    const entryListener = jest.fn();
    const logsListener = jest.fn();
    const unsubscribeEntry = subscribeToLogs(entryListener);
    const unsubscribeLogs = onLogsChanged(logsListener);

    createLogger('auth').info('login success', { username: 'astro' });

    expect(entryListener).toHaveBeenCalledWith(expect.objectContaining({
      module: 'auth',
      message: 'login success',
    }));

    expect(LogManager.getInstance().getLogCount()).toBe(1);
    jest.advanceTimersByTime(150);

    expect(logsListener).toHaveBeenCalled();
    expect(getFilteredLogs({ module: 'auth', search: 'login' })).toHaveLength(1);

    unsubscribeEntry();
    unsubscribeLogs();
  });

  it('initializes and updates singleton configuration with cloned state', () => {
    const manager = logManager.initialize({
      enableConsole: false,
      enablePersistence: false,
      maxLogs: 5,
      consoleModules: false,
      consoleTimestamps: false,
      moduleLevels: { alpha: LogLevel.ERROR },
      redactionKeys: ['secret'],
    });

    expect(manager.getTransport('console')).toBeUndefined();
    expect(manager.getTransport('tauri')).toBeUndefined();
    expect(manager.getTransport('memory')).toBeDefined();

    const initialConfig = manager.getConfig();
    initialConfig.moduleLevels.alpha = LogLevel.DEBUG;
    initialConfig.redactionKeys.push('mutated');

    const snapshotAfterMutation = manager.getConfig();
    expect(snapshotAfterMutation.moduleLevels.alpha).toBe(LogLevel.ERROR);
    expect(snapshotAfterMutation.redactionKeys).toEqual(['secret']);

    const updated = logManager.initialize({
      enableConsole: true,
      enablePersistence: true,
      moduleLevels: { beta: LogLevel.WARN },
      redactionKeys: ['token'],
    });

    expect(updated).toBe(manager);
    expect(manager.getTransport('console')).toBeDefined();
    expect(manager.getTransport('tauri')).toBeDefined();
    expect(manager.getConfig().moduleLevels).toEqual({ beta: LogLevel.WARN });
    expect(manager.getConfig().redactionKeys).toEqual(['token']);
  });

  it('manages module overrides including blank and cleared values', () => {
    const manager = LogManager.getInstance();

    manager.setModuleLevel('module-a', LogLevel.ERROR);
    manager.setModuleLevel('   ', LogLevel.DEBUG);
    expect(getModuleLogLevels()).toEqual({ 'module-a': LogLevel.ERROR });

    manager.setModuleLevel('module-a');
    expect(manager.getModuleLevels()).toEqual({});
  });

  it('manages custom transports and flush lifecycle', () => {
    const manager = LogManager.getInstance();
    const customTransport: LogTransport = {
      name: 'custom',
      write: jest.fn(),
      flush: jest.fn(),
      dispose: jest.fn(),
    };

    manager.addTransport(customTransport);
    expect(manager.getTransport('custom')).toBe(customTransport);

    manager.createLogger('transport-module').info('hello transport');
    expect(customTransport.write).toHaveBeenCalledWith(expect.objectContaining({
      module: 'transport-module',
      message: 'hello transport',
    }));

    flushLogs();
    expect(customTransport.flush).toHaveBeenCalled();

    manager.removeTransport('custom');
    expect(customTransport.dispose).toHaveBeenCalled();
    expect(manager.getTransport('custom')).toBeUndefined();
  });

  it('resets transport drop stats and exposes direct memory transport access', () => {
    const manager = LogManager.getInstance();
    const tauriTransport = manager.getTransport('tauri');
    const memoryTransport = manager.getMemoryTransport();

    expect(memoryTransport).toBe(manager.getTransport('memory'));

    Object.assign(tauriTransport as object, { droppedCount: 4 });
    expect(getLogSuppressionStats().droppedTransportLogs).toBe(4);

    resetLogTransportDropStats();
    expect(getLogSuppressionStats().droppedTransportLogs).toBe(0);
  });

  it('disposes transports, clears loggers, and keeps the manager reusable', () => {
    const manager = LogManager.getInstance();
    const customTransport: LogTransport = {
      name: 'custom-dispose',
      write: jest.fn(),
      flush: jest.fn(),
      dispose: jest.fn(),
    };
    const firstLogger = manager.createLogger('dispose-module');

    manager.addTransport(customTransport);
    manager.dispose();

    expect(customTransport.flush).toHaveBeenCalled();
    expect(customTransport.dispose).toHaveBeenCalled();

    const secondLogger = manager.createLogger('dispose-module');
    expect(secondLogger).not.toBe(firstLogger);
  });
});
