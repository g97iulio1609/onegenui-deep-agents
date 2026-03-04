import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GaussErrorBoundary } from "../components/error-boundary.js";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test explosion");
  return <div>All good</div>;
}

describe("GaussErrorBoundary", () => {
  it("should render children when no error", () => {
    render(
      <GaussErrorBoundary>
        <div>Child content</div>
      </GaussErrorBoundary>,
    );
    expect(screen.getByText("Child content")).toBeTruthy();
  });

  it("should render default fallback on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <GaussErrorBoundary>
        <ThrowingComponent shouldThrow />
      </GaussErrorBoundary>,
    );
    expect(screen.getByTestId("gauss-error-boundary")).toBeTruthy();
    expect(screen.getByText("Test explosion")).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
    spy.mockRestore();
  });

  it("should render custom fallback ReactNode", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <GaussErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow />
      </GaussErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeTruthy();
    spy.mockRestore();
  });

  it("should render custom fallback function with error and reset", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <GaussErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent shouldThrow />
      </GaussErrorBoundary>,
    );
    expect(screen.getByText("Error: Test explosion")).toBeTruthy();
    spy.mockRestore();
  });

  it("should call onError callback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <GaussErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow />
      </GaussErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe("Test explosion");
    spy.mockRestore();
  });
});
