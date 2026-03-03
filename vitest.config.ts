import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "node_modules/**",
      "dist/**",
      "packages/**",
    ],
    coverage: {
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
      },
    },
  },
});
