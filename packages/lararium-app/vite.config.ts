import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const coreRoot = resolve(__dirname, "../lararium-core/src");
const coreDist = resolve(__dirname, "../lararium-core/dist");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // TW5 filter engine — redirect both the src and dist paths to the browser bundle.
      // lararium-core is consumed from dist/ by vite, so the dist alias is the one that fires.
      { find: resolve(coreDist, "tw-filter.js"), replacement: resolve(coreRoot, "tw-filter-browser.ts") },
      { find: resolve(coreRoot, "tw-filter.js"), replacement: resolve(coreRoot, "tw-filter-browser.ts") },
    ],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    exclude: ["tiddlywiki"],
  },
});
