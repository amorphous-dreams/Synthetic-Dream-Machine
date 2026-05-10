/**
 * vite.plugin.config.ts — Vite library config that compiles each
 * plugin-eligible TS source to an independent CJS bundle.
 *
 * The output JS files land in `dist-plugin/` and feed
 * `scripts/build-plugin-tiddler.ts`, which wraps them into a single
 * `$:/plugins/lares/memetic-wikitext` plugin tiddler artifact
 * (drag-and-drop installable in any TW5 5.4+ wiki).
 *
 * **Format is CJS, not ESM:**
 *   TW5 wraps each module source as `(function(exports, require,
 *   module, $tw){...})`. Pure ESM `export default` does not run inside
 *   that wrapper. Vite's `output.format: "cjs"` + `exports: "named"`
 *   produces compatible output.
 *
 * **Externalize TW5 core:**
 *   Plugin modules `require("$:/core/...")` at runtime; we must NOT
 *   inline TW5 core into our bundle. The `external` predicate matches
 *   `^\$:/` paths so Vite leaves them as `require()` calls.
 *
 * **No source maps:**
 *   TW5's `evalGlobal` swallows external `.map` files. Inline maps
 *   bloat the plugin tiddler's text field. V.1 ships without maps;
 *   future enhancement: inline-data-URI maps if DX warrants.
 *
 * Run:
 *   pnpm --filter @lararium/tw5 build:plugin
 */

import { build } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Plugin source entries. Each TS file gets compiled to its own CJS
 * bundle; the build script wraps the output with a tiddler envelope
 * carrying the `module-type` field.
 */
export const PLUGIN_ENTRIES: Array<{
  /** Source file relative to the package root. */
  entry: string;
  /** Output basename (no extension). */
  name:  string;
  /** TW5 module-type for the resulting tiddler. */
  moduleType: "wikirule" | "widget" | "parser" | "tiddlerdeserializer";
}> = [
  { entry: "src/wikirules/lar-sigil-block.ts",      name: "lar-sigil-block",      moduleType: "wikirule" },
  { entry: "src/wikirules/lar-sigil-inline.ts",     name: "lar-sigil-inline",     moduleType: "wikirule" },
  { entry: "src/wikirules/lar-doctype-comment.ts",  name: "lar-doctype-comment",  moduleType: "wikirule" },
  { entry: "src/widgets/ahu.ts",                       name: "ahu",                    moduleType: "widget"   },
  { entry: "src/widgets/kau.ts",                       name: "kau",                    moduleType: "widget"   },
  { entry: "src/widgets/lar-meme-split.ts",            name: "lar-meme-split",         moduleType: "widget"   },
  { entry: "src/memetic-parser.ts",                    name: "memetic-parser",         moduleType: "parser"   },
  { entry: "src/deserializer.ts",                      name: "memetic-wikitext-deserializer", moduleType: "tiddlerdeserializer" },
];

const OUT_DIR = "dist-plugin";

async function main(): Promise<void> {
  mkdirSync(path.resolve(__dirname, OUT_DIR), { recursive: true });

  for (const entry of PLUGIN_ENTRIES) {
    await build({
      configFile: false,
      logLevel:   "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry.entry),
          formats:  ["cjs"],
          fileName: () => `${entry.name}.cjs.js`,
        },
        outDir:    OUT_DIR,
        emptyOutDir: false,
        sourcemap: false,
        minify:    false,
        rollupOptions: {
          // Externalize TW5 core — plugin modules call `require("$:/...")`
          // at runtime. Vite must leave those references intact rather
          // than attempt to bundle them.
          external: (id) => id.startsWith("$:/"),
          output: {
            esModule: false,
            exports:  "named",
          },
        },
      },
      resolve: {
        // Inline @lararium/core so the plugin is self-contained — operators
        // installing in vanilla TW5 wikis don't have @lararium/core
        // available at runtime. Path-alias resolves to the source TS so
        // Vite compiles the deps into our bundle.
        alias: {
          "@lararium/core/meme-ast": path.resolve(__dirname, "../lararium-core/src/meme-ast/index.ts"),
          "@lararium/core":          path.resolve(__dirname, "../lararium-core/src/index.ts"),
        },
      },
    });
    // Vite emits to dist-plugin/<name>.cjs.js. Rename suffix in
    // build-plugin-tiddler.ts when wrapping.
  }

  console.log(`✓ Vite emitted ${PLUGIN_ENTRIES.length} plugin module bundles to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
