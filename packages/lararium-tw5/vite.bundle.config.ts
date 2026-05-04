/**
 * vite.bundle.config.ts — CJS bundle for TW5 module meme injection.
 *
 * Produces a single self-contained CJS string from memetic-parser.ts +
 * tw5-widgets.ts with @lararium/core inlined. The output is written into
 * lares/ha-ka-ba/api/v0.1/lararium/modules/tw5-modules.md between its
 * STX/ETX markers by the postbuild script (scripts/write-module-meme.ts).
 *
 * Format is CJS (not IIFE) so that TW5's CommonJS module wrapper provides
 * the real `exports` object — IIFE would shadow it with a fresh {}.
 *
 * bundle-entry.ts is currently @deprecated (web2-era). This config remains
 * for when the bundle is rebuilt with the new meme-parser.ts entry point.
 */

import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry:    path.resolve(__dirname, "src/bundle-entry.ts"),
      formats:  ["cjs"],
      fileName: () => "lararium-tw5-modules.tw5.js",
    },
    outDir:    "dist-bundle",
    sourcemap: false,
    minify:    false,
    rollupOptions: {
      output: {
        esModule: false,
        exports:  "named",
      },
    },
  },
  resolve: {
    alias: {
      "@lararium/core": path.resolve(__dirname, "../lararium-core/src/index.ts"),
    },
  },
});
