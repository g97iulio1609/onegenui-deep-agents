// =============================================================================
// HttpServerPort — Zero-dependency HTTP server contract
// =============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string>;
  body: unknown;
  params: Record<string, string>;
}

export interface HttpResponse {
  status(code: number): HttpResponse;
  json(data: unknown): void;
  text(data: string): void;
  stream(generator: AsyncGenerator<string>): void;
  header(name: string, value: string): HttpResponse;
}

export type HttpHandler = (req: HttpRequest, res: HttpResponse) => Promise<void> | void;
export type HttpMiddleware = (req: HttpRequest, res: HttpResponse, next: () => Promise<void>) => Promise<void> | void;

export interface Route {
  method: HttpMethod;
  path: string;
  handler: HttpHandler;
  middleware?: HttpMiddleware[];
}

export interface HttpServerPort {
  /** Register a route */
  route(method: HttpMethod, path: string, handler: HttpHandler, middleware?: HttpMiddleware[]): void;

  /** Register global middleware */
  use(middleware: HttpMiddleware): void;

  /** Start listening */
  listen(port: number, hostname?: string): Promise<void>;

  /** Stop the server */
  close(): Promise<void>;

  /** Get registered routes */
  routes(): Route[];
}
