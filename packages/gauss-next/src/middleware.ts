/**
 * Next.js middleware helper for Gauss routes.
 *
 * Adds CORS headers and rate-limiting headers to Gauss API routes.
 */

/** Options for withGauss middleware. */
export interface GaussMiddlewareOptions {
  /** API route path prefix. Default: "/api/chat". */
  apiPath?: string;
  /** Allowed origins for CORS. */
  cors?: string | string[];
  /** Custom headers to add to Gauss API responses. */
  headers?: Record<string, string>;
}

/** Next.js middleware request shape. */
interface MiddlewareRequest {
  nextUrl: { pathname: string };
  method: string;
}

/** Next.js NextResponse-like shape. */
interface NextResponseLike {
  headers: { set(name: string, value: string): void };
}

/** next() function type. */
type NextFn = () => NextResponseLike;

/**
 * Create a middleware wrapper for Gauss API routes.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { withGauss } from "@gauss-ai/next";
 *
 * const gaussMiddleware = withGauss({
 *   apiPath: "/api/chat",
 *   cors: "https://myapp.com",
 * });
 *
 * export function middleware(request: NextRequest) {
 *   return gaussMiddleware(request, () => NextResponse.next());
 * }
 *
 * export const config = { matcher: ["/api/chat/:path*"] };
 * ```
 */
export function withGauss(
  options: GaussMiddlewareOptions = {},
): (request: MiddlewareRequest, next: NextFn) => NextResponseLike {
  const {
    apiPath = "/api/chat",
    cors,
    headers: customHeaders,
  } = options;

  return (request, next) => {
    const { pathname } = request.nextUrl;

    if (!pathname.startsWith(apiPath)) {
      return next();
    }

    const response = next();

    // Apply CORS headers
    if (cors) {
      const origin = Array.isArray(cors) ? cors.join(", ") : cors;
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    }

    // Apply custom headers
    if (customHeaders) {
      for (const [key, value] of Object.entries(customHeaders)) {
        response.headers.set(key, value);
      }
    }

    // Disable buffering for SSE
    response.headers.set("X-Accel-Buffering", "no");

    return response;
  };
}
