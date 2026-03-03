import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mockApiPlugin } from "./src/mock-api";

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
  server: {
    port: 4001,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
