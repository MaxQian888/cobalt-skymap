import * as logger from '../index';

describe('logger public index', () => {
  afterEach(() => {
    logger.logManager.reset();
  });

  it('re-exports the public logger surface', () => {
    expect(logger.LogLevel.INFO).toBeDefined();
    expect(logger.DEFAULT_CONFIG).toBeDefined();
    expect(logger.LOG_LEVEL_NAMES[logger.LogLevel.DEBUG]).toBe('debug');
    expect(typeof logger.createLogger).toBe('function');
    expect(typeof logger.generateLogId).toBe('function');
    expect(typeof logger.createConsoleTransport).toBe('function');
    expect(typeof logger.createMemoryTransport).toBe('function');
    expect(typeof logger.createTauriTransport).toBe('function');
  });

  it('supports end-to-end usage through the barrel exports', () => {
    logger.logManager.initialize({ enableConsole: false });
    logger.setLogLevel(logger.LogLevel.DEBUG);

    const moduleLogger = logger.createLogger('barrel-module');
    moduleLogger.info('barrel token=abcd123', {
      password: 'secret-value',
    }, {
      eventCode: 'BARREL_EVENT',
      tags: ['barrel', 'barrel'],
    });

    const logs = logger.getFilteredLogs({ module: 'barrel-module' });
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('[REDACTED]');
    expect(logs[0].eventCode).toBe('BARREL_EVENT');
    expect(logs[0].tags).toEqual(['barrel']);

    const exported = JSON.parse(logger.exportLogsAsJson(logs));
    expect(exported.logs[0].module).toBe('barrel-module');

    logger.clearLogs();
    expect(logger.getLogs()).toEqual([]);
  });
});
