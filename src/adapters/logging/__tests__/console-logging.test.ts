import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { ConsoleLoggingAdapter } from "../console-logging.adapter.js";

describe("ConsoleLoggingAdapter", () => {
  let logger: ConsoleLoggingAdapter;
  let spies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    logger = new ConsoleLoggingAdapter();
    spies = [
      vi.spyOn(console, "debug").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    spies.forEach((s) => s.mockRestore());
  });

  it("should log debug messages", () => {
    logger.debug("debug msg", { key: "val" });
    expect(console.debug).toHaveBeenCalledWith("debug msg", { key: "val" });
    expect(logger.getEntries()).toHaveLength(1);
    expect(logger.getEntries()[0]!.level).toBe("debug");
  });

  it("should log info messages", () => {
    logger.info("info msg");
    expect(console.info).toHaveBeenCalledWith("info msg");
    expect(logger.getEntries()[0]!.level).toBe("info");
  });

  it("should log warn messages", () => {
    logger.warn("warn msg");
    expect(console.warn).toHaveBeenCalledWith("warn msg");
    expect(logger.getEntries()[0]!.level).toBe("warn");
  });

  it("should log error messages", () => {
    logger.error("error msg");
    expect(console.error).toHaveBeenCalledWith("error msg");
    expect(logger.getEntries()[0]!.level).toBe("error");
  });

  it("should use log() with explicit level", () => {
    logger.log("warn", "generic log");
    expect(console.warn).toHaveBeenCalledWith("generic log");
    expect(logger.getEntries()[0]!.level).toBe("warn");
  });

  it("should store entries with timestamps", () => {
    const before = Date.now();
    logger.info("timestamped");
    const after = Date.now();
    const entry = logger.getEntries()[0]!;
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it("should store context in entries", () => {
    logger.info("with context", { requestId: "abc" });
    expect(logger.getEntries()[0]!.context).toEqual({ requestId: "abc" });
  });

  it("should clear entries", () => {
    logger.info("msg1");
    logger.info("msg2");
    logger.clear();
    expect(logger.getEntries()).toHaveLength(0);
  });
});
