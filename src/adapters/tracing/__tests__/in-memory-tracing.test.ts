import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryTracingAdapter } from "../in-memory-tracing.adapter.js";

describe("InMemoryTracingAdapter", () => {
  let tracer: InMemoryTracingAdapter;

  beforeEach(() => {
    tracer = new InMemoryTracingAdapter();
  });

  it("should create a span with unique IDs", () => {
    const span = tracer.startSpan("test.operation");
    expect(span.name).toBe("test.operation");
    expect(span.traceId).toBeTruthy();
    expect(span.spanId).toBeTruthy();
  });

  it("should store spans", () => {
    tracer.startSpan("span1");
    tracer.startSpan("span2");
    expect(tracer.getSpans()).toHaveLength(2);
  });

  it("should set attributes on a span", () => {
    const span = tracer.startSpan("test");
    span.setAttribute("key", "value");
    span.setAttribute("count", 42);
    span.setAttribute("enabled", true);
    expect(span.attributes.get("key")).toBe("value");
    expect(span.attributes.get("count")).toBe(42);
    expect(span.attributes.get("enabled")).toBe(true);
  });

  it("should set status on a span", () => {
    const span = tracer.startSpan("test");
    span.setStatus("ok");
    expect(span.status).toBe("ok");

    const errorSpan = tracer.startSpan("error-test");
    errorSpan.setStatus("error", "something failed");
    expect(errorSpan.status).toBe("error");
    expect(errorSpan.statusMessage).toBe("something failed");
  });

  it("should end a span", () => {
    const span = tracer.startSpan("test");
    expect(span.ended).toBe(false);
    span.end();
    expect(span.ended).toBe(true);
  });

  it("should inherit traceId from parent span", () => {
    const parent = tracer.startSpan("parent");
    const child = tracer.startSpan("child", parent);
    expect(child.traceId).toBe(parent.traceId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it("should create independent traceId without parent", () => {
    const span1 = tracer.startSpan("span1");
    const span2 = tracer.startSpan("span2");
    expect(span1.traceId).not.toBe(span2.traceId);
  });

  it("should clear all spans", () => {
    tracer.startSpan("span1");
    tracer.startSpan("span2");
    tracer.clear();
    expect(tracer.getSpans()).toHaveLength(0);
  });
});
