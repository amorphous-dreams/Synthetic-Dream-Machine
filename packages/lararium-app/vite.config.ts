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
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
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
        // TW5 recipe VM worker — loaded via TW5WorkerProxy in browser peers.
        // Fixed name (no hash) so TW5WorkerProxy can reference it at a stable URL.
        "tw5-worker": "src/tw5-worker-entry.ts",
      },
      output: {
        // TW5 worker must land at root with a fixed name — no hash.
        entryFileNames: (chunk) =>
          chunk.name === "tw5-worker"
            ? `${chunk.name}.js`
            : "assets/[name]-[hash].js",
      },
    },
  },
  optimizeDeps: {
    exclude: ["@automerge/automerge"],
  },
});
