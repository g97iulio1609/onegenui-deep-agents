import { describe, it, expect } from "vitest";
import { ApiKeyAuthAdapter, JwtAuthAdapter, CompositeAuthAdapter, RbacAuthorizationAdapter } from "../auth.adapter.js";
import type { AuthUser } from "../../../ports/auth.port.js";

// Helper: create a HS256 JWT
async function createJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

describe("ApiKeyAuthAdapter", () => {
  const adapter = new ApiKeyAuthAdapter({
    "sk-abc123": { id: "user1", roles: ["admin"] },
    "sk-xyz789": { id: "user2", roles: ["reader"] },
  });

  it("authenticates valid key", async () => {
    const result = await adapter.authenticate("sk-abc123");
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe("user1");
  });

  it("rejects invalid key", async () => {
    const result = await adapter.authenticate("sk-invalid");
    expect(result.authenticated).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("JwtAuthAdapter", () => {
  const secret = "test-secret-key-1234567890";
  const adapter = new JwtAuthAdapter({ secret, issuer: "gauss", audience: "app" });

  it("authenticates valid JWT", async () => {
    const token = await createJwt({
      sub: "user1",
      roles: ["admin"],
      iss: "gauss",
      aud: "app",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, secret);
    const result = await adapter.authenticate(token);
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe("user1");
    expect(result.user?.roles).toEqual(["admin"]);
  });

  it("rejects expired JWT", async () => {
    const token = await createJwt({
      sub: "user1", iss: "gauss", aud: "app",
      exp: Math.floor(Date.now() / 1000) - 100,
    }, secret);
    const result = await adapter.authenticate(token);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe("Token expired");
  });

  it("rejects wrong signature", async () => {
    const token = await createJwt({ sub: "user1", iss: "gauss", aud: "app" }, "wrong-secret");
    const result = await adapter.authenticate(token);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe("Invalid signature");
  });

  it("rejects wrong issuer", async () => {
    const token = await createJwt({ sub: "user1", iss: "other", aud: "app" }, secret);
    const result = await adapter.authenticate(token);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe("Invalid issuer");
  });

  it("rejects malformed token", async () => {
    const result = await adapter.authenticate("not.a.jwt.at.all");
    expect(result.authenticated).toBe(false);
  });
});

describe("CompositeAuthAdapter", () => {
  it("tries providers in order, returns first success", async () => {
    const apiKey = new ApiKeyAuthAdapter({ "key1": { id: "user1", roles: [] } });
    const jwt = new JwtAuthAdapter({ secret: "s" });
    const composite = new CompositeAuthAdapter([apiKey, jwt]);
    const result = await composite.authenticate("key1");
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe("user1");
  });

  it("rejects if all providers fail", async () => {
    const a = new ApiKeyAuthAdapter({});
    const b = new ApiKeyAuthAdapter({});
    const composite = new CompositeAuthAdapter([a, b]);
    const result = await composite.authenticate("nope");
    expect(result.authenticated).toBe(false);
    expect(result.error).toContain("All authentication providers rejected");
  });
});

describe("RbacAuthorizationAdapter", () => {
  const rbac = new RbacAuthorizationAdapter({
    admin: ["*"],
    editor: ["read", "write"],
    viewer: ["read"],
  });

  it("admin has wildcard access", async () => {
    const user: AuthUser = { id: "u1", roles: ["admin"] };
    expect(await rbac.authorize(user, "anything")).toBe(true);
  });

  it("editor can write", async () => {
    const user: AuthUser = { id: "u2", roles: ["editor"] };
    expect(await rbac.authorize(user, "write")).toBe(true);
  });

  it("viewer cannot write", async () => {
    const user: AuthUser = { id: "u3", roles: ["viewer"] };
    expect(await rbac.authorize(user, "write")).toBe(false);
  });

  it("multi-role user has union of permissions", async () => {
    const user: AuthUser = { id: "u4", roles: ["viewer", "editor"] };
    expect(await rbac.authorize(user, "write")).toBe(true);
  });
});
