import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    server: "src/server.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom"],
});
