import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  define: {
    // Stub Node globals that TW5 or lararium-core may reference
    "globalThis.process": "{}",
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
    include: [],
    exclude: ["tiddlywiki"],
  },
});
