/**
 * vite.plugin.config.ts — Vite library config that compiles each
 * plugin-eligible TS source to an independent CJS bundle.
 *
 * Output JS files land in `src/tiddlers/` alongside the committed
 * `.tid` template files and `plugin.info`. TW5's `--packplugins`
 * assembles the final plugin artifact from that folder.
 *
 * Each compiled JS file gets a `/*\ ... \*\/` header comment so TW5
 * can read the tiddler title and module-type directly from the file —
 * no `.meta` sidecar required (native TW5 pattern).
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
 *   The `tiddlywiki` npm package is also externalized — tw5-vm.ts uses
 *   a dynamic `import("tiddlywiki")` for Node-side VM; that must never
 *   be bundled into the plugin tiddler.
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PLUGIN_TITLE_LAR = "lar:///plugins/lares/memetic-wikitext";

function moduleTypeToSubpath(moduleType: string): string {
  switch (moduleType) {
    case "wikirule":           return "wikirules";
    case "widget":             return "widgets";
    case "parser":             return "parsers";
    case "tiddlerdeserializer": return "deserializers";
    case "macro":              return "macros";
    default:                   return moduleType + "s";
  }
}

/**
 * Plugin source entries. Each TS file gets compiled to its own CJS
 * bundle and lands in src/tiddlers/ with an embedded TW5 header comment.
 */
export const PLUGIN_ENTRIES: Array<{
  entry:      string;
  name:       string;
  moduleType: "wikirule" | "widget" | "parser" | "tiddlerdeserializer" | "macro";
}> = [
  { entry: "src/wikirules/lar-sigil-block.ts",           name: "lar-sigil-block",                moduleType: "wikirule"           },
  { entry: "src/wikirules/lar-sigil-inline.ts",          name: "lar-sigil-inline",               moduleType: "wikirule"           },
  { entry: "src/wikirules/lar-doctype-comment.ts",       name: "lar-doctype-comment",            moduleType: "wikirule"           },
  { entry: "src/widgets/ahu.ts",                         name: "ahu",                            moduleType: "widget"             },
  { entry: "src/widgets/aka.ts",                         name: "aka",                            moduleType: "widget"             },
  { entry: "src/widgets/kahea.ts",                       name: "kahea",                          moduleType: "widget"             },
  { entry: "src/widgets/loulou.ts",                      name: "loulou",                         moduleType: "widget"             },
  { entry: "src/widgets/pranala.ts",                     name: "pranala",                        moduleType: "widget"             },
  { entry: "src/widgets/pranala-header.ts",              name: "pranala-header",                 moduleType: "widget"             },
  { entry: "src/widgets/kau.ts",                         name: "kau",                            moduleType: "widget"             },
  { entry: "src/widgets/lar-meme-split.ts",              name: "lar-meme-split",                 moduleType: "widget"             },
  { entry: "src/memetic-parser.ts",                      name: "memetic-parser",                 moduleType: "parser"             },
  { entry: "src/deserializer.ts",                        name: "memetic-wikitext-deserializer",  moduleType: "tiddlerdeserializer" },
  { entry: "src/macros/lar-iam-block.ts",                name: "lar-iam-block",                  moduleType: "macro"              },
];

const OUT_DIR = "src/tiddlers";

async function main(): Promise<void> {
  for (const entry of PLUGIN_ENTRIES) {
    const tiddlerTitle = `${PLUGIN_TITLE_LAR}/${moduleTypeToSubpath(entry.moduleType)}/${entry.name}.js`;
    const banner = `/*\\\ntitle: ${tiddlerTitle}\ntype: application/javascript\nmodule-type: ${entry.moduleType}\n\\*/\n`;

    await build({
      configFile: false,
      logLevel:   "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry.entry),
          formats:  ["cjs"],
          fileName: () => `${entry.name}.js`,
        },
        outDir:      OUT_DIR,
        emptyOutDir: false,
        sourcemap:   false,
        minify:      false,
        rollupOptions: {
          external: (id) => id.startsWith("$:/") || id === "tiddlywiki" || id.startsWith("tiddlywiki/"),
          output: {
            banner,
            esModule: false,
            exports:  "named",
          },
        },
      },
      resolve: {
        alias: {
          "@lararium/core/meme-ast": path.resolve(__dirname, "../lararium-core/src/meme-ast/index.ts"),
          "@lararium/core":          path.resolve(__dirname, "../lararium-core/src/index.ts"),
        },
      },
    });
  }

  console.log(`✓ Vite emitted ${PLUGIN_ENTRIES.length} plugin module bundles to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
