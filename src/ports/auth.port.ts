// =============================================================================
// AuthPort — Authentication & authorization contract
// =============================================================================

export interface AuthUser {
  id: string;
  roles: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthUser;
  error?: string;
}

export interface AuthPort {
  /** Authenticate a request, returning the user if valid */
  authenticate(token: string): Promise<AuthResult>;
}

export interface AuthorizationPort {
  /** Check if user has required permission */
  authorize(user: AuthUser, permission: string): Promise<boolean>;
}
