# Logger Module

[Root](../../CLAUDE.md) > [lib](../README.md) > **logger**

> **Last Updated:** 2026-02-01
> **Module Type:** TypeScript Library

---

## Module Responsibility

The `lib/logger` module provides a unified logging system for the Cobalt Skymap application. It replaces scattered `console.*` calls with a structured, configurable logging framework that supports:

- **Multiple log levels**: DEBUG, INFO, WARN, ERROR
- **Module-based loggers**: Each module gets its own named logger
- **Multiple transports**: Console, Memory (for UI), Tauri (for backend)
- **Filtering and searching**: Query logs by level, module, or text
- **Export functionality**: Export logs as text or JSON

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      LogManager (Singleton)                  │
├─────────────────────────────────────────────────────────────┤
│  - Configuration                                             │
│  - Logger factory                                            │
│  - Transport management                                      │
└──────────────┬──────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│Console │ │Memory  │ │ Tauri  │
│Transport│ │Transport│ │Transport│
└────────┘ └────────┘ └────────┘
    │          │          │
    ▼          ▼          ▼
 Browser    In-Memory   Rust
 Console    Storage     Backend
```

---

## Usage

### Basic Usage

```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('my-component');

logger.debug('Debug info', { detail: 'value' });
logger.info('Operation completed');
logger.warn('Potential issue detected');
logger.error('Operation failed', error);
```

### Configuration

```typescript
import { logManager, LogLevel } from '@/lib/logger';

// Set global log level
logManager.getInstance().setLevel(LogLevel.WARN);

// Disable console output
logManager.getInstance().setConfig({
  enableConsole: false,
});
```

### Accessing Logs

```typescript
import { getLogs, getFilteredLogs, clearLogs, LogLevel } from '@/lib/logger';

// Get all logs
const allLogs = getLogs();

// Filter logs
const errorLogs = getFilteredLogs({
  level: LogLevel.ERROR,
  module: 'cache',
  search: 'failed',
});

// Clear logs
clearLogs();
```

### Subscribing to Logs

```typescript
import { subscribeToLogs, onLogsChanged } from '@/lib/logger';

// Subscribe to new entries
const unsubscribe = subscribeToLogs((entry) => {
  console.log('New log:', entry);
});

// Subscribe to all changes
const unsubscribe2 = onLogsChanged((logs) => {
  console.log('Logs updated:', logs.length);
});
```

---

## File Structure

| File | Purpose |
|------|---------|
| `index.ts` | Public API exports |
| `types.ts` | TypeScript type definitions |
| `utils.ts` | Utility functions |
| `log-manager.ts` | Central log manager |
| `transports/` | Output transports |
| `transports/console-transport.ts` | Browser console output |
| `transports/memory-transport.ts` | In-memory storage |
| `transports/tauri-transport.ts` | Tauri backend bridge |

---

## Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| DEBUG | 0 | Detailed debugging information |
| INFO | 1 | General operational messages |
| WARN | 2 | Warning conditions |
| ERROR | 3 | Error conditions |
| NONE | 4 | Disable all logging |

---

## Best Practices

1. **Create one logger per module**: Use descriptive module names
2. **Use appropriate levels**: DEBUG for development, INFO for operations, WARN for issues, ERROR for failures
3. **Include context**: Pass relevant data as the second parameter
4. **Handle errors properly**: Pass Error objects to `logger.error()`
5. **Avoid logging sensitive data**: Don't log passwords, tokens, etc.

---

## Module Naming Convention

Use kebab-case for module names matching the file/component name:

- `stellarium-store` for `stellarium-store.ts`
- `cache-manager` for `cache-manager.tsx`
- `target-list-store` for `target-list-store.ts`
