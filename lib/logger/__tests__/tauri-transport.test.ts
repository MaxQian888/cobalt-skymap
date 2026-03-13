/**
 * Tests for tauri-transport.ts
 * Tauri backend log transport
 */

import { createTauriTransport } from '../transports';
import { TauriTransport } from '../transports/tauri-transport';
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

describe('TauriTransport', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should have name "tauri"', () => {
    const transport = new TauriTransport();
    expect(transport.name).toBe('tauri');
  });

  it('should write without error in non-Tauri env', () => {
    const transport = new TauriTransport({ enabled: false });
    expect(() => transport.write(makeEntry())).not.toThrow();
  });

  it('should accept custom config', () => {
    const transport = new TauriTransport({
      enabled: false,
      minLevel: LogLevel.WARN,
      batching: false,
      maxQueueSize: 10,
    });
    expect(transport.name).toBe('tauri');
  });

  it('should flush without error', () => {
    const transport = new TauriTransport({ enabled: false });
    expect(() => transport.flush?.()).not.toThrow();
  });

  it('tracks dropped items when queue exceeds max size', () => {
    const transport = new TauriTransport({
      enabled: true,
      batching: true,
      maxQueueSize: 2,
      dropWarnInterval: 1,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.INFO]: jest.fn(async () => undefined) },
    });

    transport.write(makeEntry(LogLevel.INFO));
    transport.write(makeEntry(LogLevel.INFO));
    transport.write(makeEntry(LogLevel.INFO));

    expect(transport.getDroppedCount()).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('disables backend forwarding after an intentional plugin failure', async () => {
    const failingLogFn = jest.fn(async (_message: string) => {
      throw new Error('plugin unavailable');
    });
    const transport = new TauriTransport({
      enabled: true,
      batching: false,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.INFO]: failingLogFn },
    });

    transport.write(makeEntry(LogLevel.INFO));
    await Promise.resolve();
    transport.write(makeEntry(LogLevel.INFO));

    expect(failingLogFn).toHaveBeenCalledTimes(1);
    expect(transport.isAvailable()).toBe(false);
  });

  it('batches logs and flushes them on the interval', async () => {
    jest.useFakeTimers();
    const infoFn = jest.fn(async (_message: string) => undefined);
    const transport = createTauriTransport({
      enabled: true,
      batching: true,
      batchInterval: 50,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.INFO]: infoFn },
    });

    transport.write(makeEntry(LogLevel.INFO));
    transport.write({
      ...makeEntry(LogLevel.INFO),
      message: 'With data',
      data: { target: 'M42' },
      stack: 'trace line',
    });

    expect(infoFn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(50);
    await Promise.resolve();

    expect(infoFn).toHaveBeenCalledTimes(2);
    expect(infoFn).toHaveBeenNthCalledWith(1, '[test] Test message');
    expect(infoFn).toHaveBeenNthCalledWith(2, expect.stringContaining('[test] With data |'));
    expect(infoFn.mock.calls[1][0]).toContain('trace line');
  });

  it('respects minLevel and missing log functions without throwing', async () => {
    const warnFn = jest.fn(async (_message: string) => undefined);
    const transport = new TauriTransport({
      enabled: true,
      batching: false,
      minLevel: LogLevel.WARN,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.WARN]: warnFn },
    });

    transport.write(makeEntry(LogLevel.INFO));
    transport.write(makeEntry(LogLevel.WARN));
    transport.write(makeEntry(LogLevel.ERROR));
    await Promise.resolve();

    expect(warnFn).toHaveBeenCalledTimes(1);
  });

  it('flushes queued items and exposes mutable configuration safely', async () => {
    jest.useFakeTimers();
    const infoFn = jest.fn(async () => undefined);
    const transport = new TauriTransport({
      enabled: true,
      batching: true,
      batchInterval: 100,
      maxQueueSize: 2,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.INFO]: infoFn },
    });

    transport.write(makeEntry(LogLevel.INFO));
    transport.flush();
    await Promise.resolve();

    expect(infoFn).toHaveBeenCalledTimes(1);

    transport.setConfig({ dropWarnInterval: 0, batching: false });
    expect(transport.getConfig()).toEqual(expect.objectContaining({
      dropWarnInterval: 0,
      batching: false,
      maxQueueSize: 2,
    }));
  });

  it('can reset dropped counters and dispose the backend hooks', () => {
    const transport = new TauriTransport({
      enabled: true,
      batching: true,
      maxQueueSize: 1,
      dropWarnInterval: 0,
    });

    Object.assign(transport as object, {
      isTauri: true,
      logFns: { [LogLevel.INFO]: jest.fn(async () => undefined) },
    });

    transport.write(makeEntry(LogLevel.INFO));
    transport.write(makeEntry(LogLevel.INFO));

    expect(transport.getDroppedCount()).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();

    transport.resetDroppedCount();
    expect(transport.getDroppedCount()).toBe(0);

    transport.dispose();
    expect((transport as unknown as { logFns: unknown }).logFns).toBeNull();
  });
});
