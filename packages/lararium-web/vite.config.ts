import { defineConfig } from "vite";
import { resolve } from "path";

const coreRoot = resolve(__dirname, "../lararium-core/src");

export default defineConfig({
  define: {
    // Stub Node globals that TW5 or lararium-core may reference
    "globalThis.process": "{}",
  },
  resolve: {
    alias: {
      // TW5 filter engine: swap Node (createRequire) path for pre-built browser bundle.
      // Both export the same filterMemesTW / precomputeRooms API.
      // Re-generate the browser bundle: node scripts/build-tw-browser-filter.mjs
      [`${coreRoot}/tw-filter.js`]: resolve(coreRoot, "tw-filter-browser.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "LarariumWeb",
      fileName: (format) => `lararium-web.${format}.js`,
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: [],
    },
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    // Pre-bundle the generated TW5 browser engine so Vite doesn't re-process it each HMR
    include: [],
    exclude: ["tiddlywiki"],
  },
});
