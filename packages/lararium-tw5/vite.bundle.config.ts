/**
 * vite.bundle.config.ts — IIFE bundle for TW5 module meme injection.
 *
 * Produces a single self-contained JS string from memetic-parser.ts +
 * tw5-widgets.ts with @lararium/core inlined. The output is written into
 * lares/ha-ka-ba/api/v0.1/lararium/modules/tw5-modules.md between its
 * STX/ETX markers by the postbuild script (scripts/write-module-meme.ts).
 *
 * The bundle exposes one global: `window.__lararium_tw5_modules` which the
 * kernel injection gate reads via _bootModules() after corpus load.
 */

import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry:    path.resolve(__dirname, "src/bundle-entry.ts"),
      name:     "__lararium_tw5_modules",
      formats:  ["iife"],
      fileName: () => "lararium-tw5-modules.iife.js",
    },
    outDir:    "dist-bundle",
    sourcemap: false,
    minify:    false,
    rollupOptions: {
      // tiddlywiki is provided by the host TW5 instance at runtime — do not inline.
      external: ["tiddlywiki"],
      output: {
        globals: { tiddlywiki: "$tw" },
      },
    },
  },
  resolve: {
    alias: {
      "@lararium/core": path.resolve(__dirname, "../lararium-core/src/index.ts"),
    },
  },
});
