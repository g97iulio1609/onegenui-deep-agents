import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
  },
  format: ["cjs", "esm"],
  splitting: true,
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["gauss-napi"],
});

