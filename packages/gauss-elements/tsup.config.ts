import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    headless: "src/headless.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom"],
});
