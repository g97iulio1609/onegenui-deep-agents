/**
 * @gauss-ai/next
 *
 * Next.js integration for Gauss AI — zero-config route handlers.
 *
 * @example App Router (one line)
 * ```ts
 * // app/api/chat/route.ts
 * import { createGaussRoute } from "@gauss-ai/next";
 *
 * export const { POST } = createGaussRoute(async (messages, stream) => {
 *   for await (const chunk of myAgent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * });
 * ```
 *
 * @example Pages Router
 * ```ts
 * // pages/api/chat.ts
 * import { createGaussPagesRoute } from "@gauss-ai/next";
 *
 * export default createGaussPagesRoute(async (messages, stream) => {
 *   for await (const chunk of myAgent.stream(messages)) {
 *     stream.writeText(chunk);
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

export { createGaussRoute } from "./route-handler.js";
export type { GaussRouteOptions, GaussRouteResult } from "./route-handler.js";

export { createGaussPagesRoute } from "./pages-handler.js";
export type { GaussPagesRouteOptions } from "./pages-handler.js";

export { GaussNextProvider, useGaussNext } from "./provider.js";
export type { GaussNextConfig, GaussNextProviderProps } from "./provider.js";

export { withGauss } from "./middleware.js";
export type { GaussMiddlewareOptions } from "./middleware.js";
