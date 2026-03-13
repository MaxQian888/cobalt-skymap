/**
 * Tests for console-transport.ts
 * Console transport for log output
 */

import { createConsoleTransport } from '../transports';
import { ConsoleTransport } from '../transports/console-transport';
import { LogLevel } from '../types';
import type { LogEntry } from '../types';

function makeEntry(level: LogLevel = LogLevel.INFO): LogEntry {
  return {
    id: 'test-1',
    timestamp: new Date('2025-01-15T10:30:00.000Z'),
    level,
    module: 'test',
    message: 'Test message',
  };
}

describe('ConsoleTransport', () => {
  let infoSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have name "console"', () => {
    const transport = new ConsoleTransport();
    expect(transport.name).toBe('console');
  });

  it('should write a log entry without error', () => {
    const transport = new ConsoleTransport();
    expect(() => transport.write(makeEntry())).not.toThrow();
    expect(infoSpy).toHaveBeenCalled();
  });

  it('should write at different levels', () => {
    const transport = new ConsoleTransport();
    expect(() => transport.write(makeEntry(LogLevel.DEBUG))).not.toThrow();
    expect(() => transport.write(makeEntry(LogLevel.WARN))).not.toThrow();
    expect(() => transport.write(makeEntry(LogLevel.ERROR))).not.toThrow();
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('should accept custom config', () => {
    const transport = new ConsoleTransport({
      timestamps: false,
      modules: false,
      colors: false,
    });
    expect(() => transport.write(makeEntry())).not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith('Test message');
  });

  it('formats object data with styled output when colors are enabled', () => {
    const transport = new ConsoleTransport();
    transport.write({
      ...makeEntry(),
      data: { foo: 'bar' },
    });

    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('%c[test]'),
      expect.any(String),
      expect.any(String),
      'color: inherit',
      { foo: 'bar' }
    );
  });

  it('serializes primitive data and appends stack traces for non-Error payloads', () => {
    const transport = new ConsoleTransport({
      timestamps: false,
      modules: false,
      colors: false,
    });
    transport.write({
      ...makeEntry(LogLevel.ERROR),
      data: 42,
      stack: 'line 1\nline 2',
    });

    expect(errorSpy).toHaveBeenCalledWith('Test message', '42', '\nline 1\nline 2');
  });

  it('prefers passing through Error objects without duplicating stacks', () => {
    const transport = new ConsoleTransport({
      timestamps: false,
      modules: false,
      colors: false,
    });
    const error = new Error('kapow');

    transport.write({
      ...makeEntry(LogLevel.ERROR),
      data: error,
      stack: 'line 1\nline 2',
    });

    expect(errorSpy).toHaveBeenCalledWith('Test message', error);
  });

  it('updates and exposes configuration', () => {
    const transport = createConsoleTransport({ colors: false });
    transport.setConfig({ grouping: true, modules: false });

    expect(transport.getConfig()).toEqual({
      timestamps: true,
      modules: false,
      colors: false,
      grouping: true,
    });
  });
});
