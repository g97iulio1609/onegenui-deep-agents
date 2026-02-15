// =============================================================================
// Logging Port — Contract for structured logging
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Record<string, unknown>;
}

export interface LoggingPort {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
