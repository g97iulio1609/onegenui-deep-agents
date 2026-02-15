// =============================================================================
// Domain Error Classes
// =============================================================================

export class GaussFlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GaussFlowError";
  }
}

export class ToolExecutionError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "TOOL_EXECUTION_ERROR", cause);
    this.name = "ToolExecutionError";
  }
}

export class PluginError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "PLUGIN_ERROR", cause);
    this.name = "PluginError";
  }
}

export class McpConnectionError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "MCP_CONNECTION_ERROR", cause);
    this.name = "McpConnectionError";
  }
}

export class RuntimeError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "RUNTIME_ERROR", cause);
    this.name = "RuntimeError";
  }
}

export class StreamingError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "STREAMING_ERROR", cause);
    this.name = "StreamingError";
  }
}

export class ConfigurationError extends GaussFlowError {
  constructor(message: string, cause?: unknown) {
    super(message, "CONFIGURATION_ERROR", cause);
    this.name = "ConfigurationError";
  }
}
