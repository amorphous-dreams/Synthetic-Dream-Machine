import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm(), react()],
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: {
        // Main app shell
        index: "index.html",
        // Service worker — emitted at dist/sw.js (root-scoped)
        sw: "src/sw.ts",
      },
      output: {
        // SW must land at the root with a fixed name (no hash) — browsers require it.
        entryFileNames: (chunk) => chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js",
      },
    },
  },
  optimizeDeps: {
    exclude: ["@automerge/automerge"],
  },
});
