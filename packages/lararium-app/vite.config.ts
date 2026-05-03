import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm(), react()],
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
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
        // TW5 recipe VM worker — loaded via TW5WorkerProxy in browser peers.
        // Fixed name (no hash) so TW5WorkerProxy can reference it at a stable URL.
        "tw5-worker": "src/tw5-worker-entry.ts",
      },
      output: {
        // SW and TW5 worker must land at root with fixed names — no hash.
        entryFileNames: (chunk) =>
          (chunk.name === "sw" || chunk.name === "tw5-worker")
            ? `${chunk.name}.js`
            : "assets/[name]-[hash].js",
      },
    },
  },
  optimizeDeps: {
    exclude: ["@automerge/automerge"],
  },
});
