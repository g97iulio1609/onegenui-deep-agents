import { describe, it, expect } from "vitest";
import {
  GaussError,
  ToolExecutionError,
  PluginError,
  McpConnectionError,
  RuntimeError,
  StreamingError,
  ConfigurationError,
} from "../index.js";

describe("Domain Error Classes", () => {
  describe("GaussError", () => {
    it("sets name, message, and code", () => {
      const err = new GaussError("test message", "TEST_CODE");
      expect(err.name).toBe("GaussError");
      expect(err.message).toBe("test message");
      expect(err.code).toBe("TEST_CODE");
      expect(err.cause).toBeUndefined();
      expect(err).toBeInstanceOf(Error);
    });

    it("preserves cause", () => {
      const cause = new Error("root");
      const err = new GaussError("wrapped", "WRAP", cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("ToolExecutionError", () => {
    it("has correct name and code", () => {
      const err = new ToolExecutionError("tool failed");
      expect(err.name).toBe("ToolExecutionError");
      expect(err.code).toBe("TOOL_EXECUTION_ERROR");
      expect(err).toBeInstanceOf(GaussError);
      expect(err).toBeInstanceOf(Error);
    });

    it("preserves cause", () => {
      const cause = new TypeError("bad arg");
      const err = new ToolExecutionError("tool failed", cause);
      expect(err.cause).toBe(cause);
    });
  });

  describe("PluginError", () => {
    it("has correct name and code", () => {
      const err = new PluginError("plugin failed");
      expect(err.name).toBe("PluginError");
      expect(err.code).toBe("PLUGIN_ERROR");
      expect(err).toBeInstanceOf(GaussError);
    });
  });

  describe("McpConnectionError", () => {
    it("has correct name and code", () => {
      const err = new McpConnectionError("connection refused");
      expect(err.name).toBe("McpConnectionError");
      expect(err.code).toBe("MCP_CONNECTION_ERROR");
      expect(err).toBeInstanceOf(GaussError);
    });
  });

  describe("RuntimeError", () => {
    it("has correct name and code", () => {
      const err = new RuntimeError("runtime crash");
      expect(err.name).toBe("RuntimeError");
      expect(err.code).toBe("RUNTIME_ERROR");
      expect(err).toBeInstanceOf(GaussError);
    });
  });

  describe("StreamingError", () => {
    it("has correct name and code", () => {
      const err = new StreamingError("stream broke");
      expect(err.name).toBe("StreamingError");
      expect(err.code).toBe("STREAMING_ERROR");
      expect(err).toBeInstanceOf(GaussError);
    });
  });

  describe("ConfigurationError", () => {
    it("has correct name and code", () => {
      const err = new ConfigurationError("bad config");
      expect(err.name).toBe("ConfigurationError");
      expect(err.code).toBe("CONFIGURATION_ERROR");
      expect(err).toBeInstanceOf(GaussError);
    });
  });
});
