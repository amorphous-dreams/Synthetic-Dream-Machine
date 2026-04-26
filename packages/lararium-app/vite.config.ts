import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const coreRoot = resolve(__dirname, "../lararium-core/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // TW5 filter engine: same browser-bundle swap as lararium-web
      [`${coreRoot}/tw-filter.js`]: resolve(coreRoot, "tw-filter-browser.ts"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["tiddlywiki"],
  },
});
