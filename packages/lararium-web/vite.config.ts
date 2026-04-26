import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  // Shim Node's crypto.createHash with the Web Crypto API for browser builds
  define: {
    "globalThis.process": "{}",
  },
  resolve: {
    alias: {
      // Redirect Node crypto to a browser-compatible shim via the web crypto API
      crypto: resolve(__dirname, "src/crypto-shim.ts"),
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
});
