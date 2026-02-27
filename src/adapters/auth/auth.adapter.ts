// =============================================================================
// Auth Adapters — API Key, JWT (HMAC), RBAC
// =============================================================================

import type { AuthPort, AuthorizationPort, AuthResult, AuthUser } from "../../ports/auth.port.js";

// --- API Key Adapter ---

export class ApiKeyAuthAdapter implements AuthPort {
  private keys: Map<string, AuthUser>;

  constructor(keys: Record<string, AuthUser>) {
    this.keys = new Map(Object.entries(keys));
  }

  async authenticate(token: string): Promise<AuthResult> {
    const user = this.keys.get(token);
    if (user) return { authenticated: true, user };
    return { authenticated: false, error: "Invalid API key" };
  }
}

// --- JWT Adapter (HMAC-SHA256, zero-dependency) ---

function base64UrlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, "base64url").toString("utf-8");
}

async function hmacSha256(secret: string, data: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export interface JwtAuthOptions {
  secret: string;
  issuer?: string;
  audience?: string;
  clockToleranceSec?: number;
}

export class JwtAuthAdapter implements AuthPort {
  constructor(private opts: JwtAuthOptions) {}

  async authenticate(token: string): Promise<AuthResult> {
    const parts = token.split(".");
    if (parts.length !== 3) return { authenticated: false, error: "Malformed JWT" };
    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature (timing-safe comparison)
    const expected = await hmacSha256(this.opts.secret, `${headerB64}.${payloadB64}`);
    const { timingSafeEqual } = await import("node:crypto");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureB64);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { authenticated: false, error: "Invalid signature" };
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(base64UrlDecode(payloadB64)); }
    catch { return { authenticated: false, error: "Invalid payload" }; }

    // Validate claims
    const now = Math.floor(Date.now() / 1000);
    const tolerance = this.opts.clockToleranceSec ?? 0;

    if (typeof payload.exp === "number" && now > payload.exp + tolerance) {
      return { authenticated: false, error: "Token expired" };
    }
    if (typeof payload.nbf === "number" && now < payload.nbf - tolerance) {
      return { authenticated: false, error: "Token not yet valid" };
    }
    if (this.opts.issuer && payload.iss !== this.opts.issuer) {
      return { authenticated: false, error: "Invalid issuer" };
    }
    if (this.opts.audience && payload.aud !== this.opts.audience) {
      return { authenticated: false, error: "Invalid audience" };
    }

    const user: AuthUser = {
      id: (payload.sub as string) ?? "unknown",
      roles: Array.isArray(payload.roles) ? payload.roles as string[] : [],
      metadata: payload,
    };

    return { authenticated: true, user };
  }
}

// --- Composite Auth (try multiple providers in order) ---

export class CompositeAuthAdapter implements AuthPort {
  constructor(private providers: AuthPort[]) {}

  async authenticate(token: string): Promise<AuthResult> {
    for (const provider of this.providers) {
      const result = await provider.authenticate(token);
      if (result.authenticated) return result;
    }
    return { authenticated: false, error: "All authentication providers rejected" };
  }
}

// --- RBAC Authorization ---

export class RbacAuthorizationAdapter implements AuthorizationPort {
  private permissions: Map<string, Set<string>>;

  constructor(rolePermissions: Record<string, string[]>) {
    this.permissions = new Map();
    for (const [role, perms] of Object.entries(rolePermissions)) {
      this.permissions.set(role, new Set(perms));
    }
  }

  async authorize(user: AuthUser, permission: string): Promise<boolean> {
    for (const role of user.roles) {
      const perms = this.permissions.get(role);
      if (perms?.has(permission) || perms?.has("*")) return true;
    }
    return false;
  }
}
