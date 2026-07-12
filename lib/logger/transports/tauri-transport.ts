/**
 * Tauri Transport
 * 
 * Bridges frontend logs to Tauri backend logging system
 * via the official @tauri-apps/plugin-log JS bindings.
 */

import { LogEntry, LogTransport, LogLevel } from '../types';
import { serializeData } from '../utils';
import { isTauri as isTauriRuntime } from '@/lib/storage/platform';

export interface TauriTransportConfig {
  /** Whether the transport is enabled */
  enabled: boolean;
  /** Minimum level to send to Tauri */
  minLevel: LogLevel;
  /** Whether to batch logs */
  batching: boolean;
  /** Batch interval in ms */
  batchInterval: number;
  /** Maximum buffered items before dropping oldest */
  maxQueueSize: number;
  /** Warn every N dropped items due to queue pressure */
  dropWarnInterval: number;
}

const DEFAULT_CONFIG: TauriTransportConfig = {
  enabled: true,
  minLevel: LogLevel.INFO,
  batching: true,
  batchInterval: 1000,
  maxQueueSize: 500,
  dropWarnInterval: 50,
};

interface LogBatchItem {
  level: LogLevel;
  message: string;
}

type TauriLogFn = (message: string) => Promise<void>;

/**
 * Tauri transport for sending logs to the Rust backend
 * using @tauri-apps/plugin-log
 */
export class TauriTransport implements LogTransport {
  readonly name = 'tauri';
  private config: TauriTransportConfig;
  private batch: LogBatchItem[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isTauri: boolean = false;
  private logFns: Record<number, TauriLogFn> | null = null;
  private droppedCount = 0;
  
  constructor(config: Partial<TauriTransportConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initTauri();
  }
  
  private async initTauri(): Promise<void> {
    try {
      if (isTauriRuntime()) {
        const { debug, info, warn, error } = await import('@tauri-apps/plugin-log');
        this.logFns = {
          [LogLevel.DEBUG]: debug,
          [LogLevel.INFO]: info,
          [LogLevel.WARN]: warn,
          [LogLevel.ERROR]: error,
        };
        this.isTauri = true;
      }
    } catch {
      this.isTauri = false;
    }
  }
  
  write(entry: LogEntry): void {
    if (!this.config.enabled || !this.isTauri) {
      return;
    }
    
    // Filter by level
    if (entry.level < this.config.minLevel) {
      return;
    }
    
    // Format message: [module] message [data] [stack]
    let message = `[${entry.module}] ${entry.message}`;
    
    if (entry.data !== undefined) {
      const dataStr = serializeData(entry.data);
      if (dataStr) {
        message += ` | ${dataStr}`;
      }
    }
    
    if (entry.stack) {
      message += `\n${entry.stack}`;
    }
    
    const item: LogBatchItem = {
      level: entry.level,
      message,
    };
    
    if (this.config.batching) {
      this.addToBatch(item);
    } else {
      this.sendLog(item);
    }
  }
  
  private addToBatch(item: LogBatchItem): void {
    if (this.batch.length >= this.config.maxQueueSize) {
      this.batch.shift();
      this.droppedCount += 1;
      this.maybeWarnDropped();
    }

    this.batch.push(item);
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchInterval);
    }
  }
  
  private flushBatch(): void {
    if (this.batch.length === 0) {
      return;
    }
    
    const items = [...this.batch];
    this.batch = [];
    this.batchTimer = null;
    
    for (const item of items) {
      this.sendLog(item);
    }
  }
  
  private async sendLog(item: LogBatchItem): Promise<void> {
    if (!this.logFns) {
      return;
    }
    
    try {
      const fn = this.logFns[item.level];
      if (fn) {
        await fn(item.message);
      }
    } catch {
      this.logFns = null;
      this.isTauri = false;
      // Silently fail - we don't want logging errors to break the app
    }
  }
  
  flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBatch();
  }
  
  dispose(): void {
    this.flush();
    this.logFns = null;
  }

  /**
   * Get number of logs dropped due to queue pressure.
   */
  getDroppedCount(): number {
    return this.droppedCount;
  }

  /**
   * Reset dropped counter (used after surfacing stats).
   */
  resetDroppedCount(): void {
    this.droppedCount = 0;
  }
  
  /**
   * Check if Tauri is available
   */
  isAvailable(): boolean {
    return this.isTauri;
  }
  
  /**
   * Update configuration
   */
  setConfig(config: Partial<TauriTransportConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): TauriTransportConfig {
    return { ...this.config };
  }

  private maybeWarnDropped(): void {
    if (this.config.dropWarnInterval <= 0) {
      return;
    }

    if (this.droppedCount === 1 || this.droppedCount % this.config.dropWarnInterval === 0) {
      // Console warning only; avoid recursion through logger itself.
      console.warn(`[logger] Tauri transport queue pressure detected. Dropped ${this.droppedCount} log item(s).`);
    }
  }
}

/**
 * Create a Tauri transport instance
 */
export function createTauriTransport(config?: Partial<TauriTransportConfig>): TauriTransport {
  return new TauriTransport(config);
}
