import { describe, it, expect } from "vitest";
import { AgentNetworkAdapter } from "../agent-network.adapter.js";
import type { DelegationRequest } from "../../../ports/agent-network.port.js";

describe("AgentNetworkAdapter", () => {
  const echoHandler = async (req: DelegationRequest) => `${req.to}: ${req.task}`;

  describe("registration & discovery", () => {
    it("registers and lists agents", () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      net.register({ name: "a1", capabilities: ["code"] });
      net.register({ name: "a2", capabilities: ["code", "test"] });
      expect(net.agents()).toHaveLength(2);
    });

    it("unregisters agent", () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      net.register({ name: "a1", capabilities: [] });
      net.unregister("a1");
      expect(net.agents()).toHaveLength(0);
    });

    it("discovers by capabilities (all required)", () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      net.register({ name: "a1", capabilities: ["code"] });
      net.register({ name: "a2", capabilities: ["code", "test"] });
      net.register({ name: "a3", capabilities: ["docs"] });
      const found = net.discover(["code", "test"]);
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe("a2");
    });
  });

  describe("delegation", () => {
    it("delegates successfully (mesh)", async () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      net.register({ name: "worker", capabilities: ["code"] });
      const result = await net.delegate({ from: "boss", to: "worker", task: "write code" });
      expect(result.success).toBe(true);
      expect(result.result).toBe("worker: write code");
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("returns error for unknown agent", async () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      const result = await net.delegate({ from: "a", to: "missing", task: "x" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("respects delegation timeout", async () => {
      const slow = async () => new Promise(r => setTimeout(r, 5000));
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: slow, timeout: 50 });
      net.register({ name: "slow", capabilities: [] });
      const result = await net.delegate({ from: "a", to: "slow", task: "x" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    });

    it("hierarchical: blocks non-parent delegation", async () => {
      const net = new AgentNetworkAdapter({
        topology: "hierarchical",
        handler: echoHandler,
        hierarchy: { child: "parent" },
      });
      net.register({ name: "child", capabilities: [] });
      const result = await net.delegate({ from: "stranger", to: "child", task: "x" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not parent");
    });

    it("hierarchical: allows parent delegation", async () => {
      const net = new AgentNetworkAdapter({
        topology: "hierarchical",
        handler: echoHandler,
        hierarchy: { child: "parent" },
      });
      net.register({ name: "child", capabilities: [] });
      const result = await net.delegate({ from: "parent", to: "child", task: "do it" });
      expect(result.success).toBe(true);
    });
  });

  describe("broadcast", () => {
    it("broadcasts to all matching agents", async () => {
      const net = new AgentNetworkAdapter({ topology: "mesh", handler: echoHandler });
      net.register({ name: "a1", capabilities: ["code"] });
      net.register({ name: "a2", capabilities: ["code"] });
      net.register({ name: "a3", capabilities: ["docs"] });
      const results = await net.broadcast("write code", ["code"]);
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  it("reports topology", () => {
    const net = new AgentNetworkAdapter({ topology: "star", handler: echoHandler });
    expect(net.topology()).toBe("star");
  });
});
