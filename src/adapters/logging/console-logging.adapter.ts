// =============================================================================
// ConsoleLoggingAdapter — Console-based implementation of LoggingPort
// =============================================================================

import type { LoggingPort, LogLevel, LogEntry } from "../../ports/logging.port.js";

export class ConsoleLoggingAdapter implements LoggingPort {
  private readonly entries: LogEntry[] = [];

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = { level, message, timestamp: Date.now(), context };
    this.entries.push(entry);
    console[level](message, ...(context ? [context] : []));
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  /** Get all recorded log entries */
  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  /** Clear all recorded entries */
  clear(): void {
    this.entries.length = 0;
  }
}
