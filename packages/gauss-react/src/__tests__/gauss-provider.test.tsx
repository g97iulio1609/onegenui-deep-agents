import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GaussProvider, useGaussConfig } from "../components/gauss-provider.js";

function ConfigDisplay() {
  const config = useGaussConfig();
  return (
    <div data-testid="config">
      <span data-testid="api">{config.api ?? "none"}</span>
      <span data-testid="headers">{JSON.stringify(config.headers ?? {})}</span>
    </div>
  );
}

describe("GaussProvider", () => {
  it("should provide config to children", () => {
    render(
      <GaussProvider config={{ api: "/custom-api", headers: { "X-Key": "abc" } }}>
        <ConfigDisplay />
      </GaussProvider>,
    );
    expect(screen.getByTestId("api").textContent).toBe("/custom-api");
    expect(screen.getByTestId("headers").textContent).toContain("X-Key");
  });

  it("should return empty config when no provider", () => {
    render(<ConfigDisplay />);
    expect(screen.getByTestId("api").textContent).toBe("none");
    expect(screen.getByTestId("headers").textContent).toBe("{}");
  });

  it("should allow nested providers (inner overrides)", () => {
    render(
      <GaussProvider config={{ api: "/outer" }}>
        <GaussProvider config={{ api: "/inner" }}>
          <ConfigDisplay />
        </GaussProvider>
      </GaussProvider>,
    );
    expect(screen.getByTestId("api").textContent).toBe("/inner");
  });
});
