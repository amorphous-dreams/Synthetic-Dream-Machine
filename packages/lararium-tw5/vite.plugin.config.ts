/**
 * vite.plugin.config.ts — compile all plugin-owned TS entries to TW5 CJS tiddlers.
 *
 * Output JS files land in `tiddlers/src/`. The TW5 pack step loads `tiddlers/`
 * as a plugin folder and packs both static tiddlers and generated CJS modules.
 *
 * Each TS source file carries a native TW5 `/*\ ... \*\/` header block declaring
 * its tiddler title and module-type. `readTiddlerHeader()` extracts that block and
 * uses it as the Rollup banner — the compiled JS is self-describing, matching the
 * convention used by TW5 core and official plugins.
 *
 * Adding a new module: put the `/*\ ... \*\/` block at the top of the TS file, then
 * add a `{ entry, name }` line to PLUGIN_ENTRIES. No type enum or title helper needed.
 */

import { build }                     from "vite";
import { readFileSync }              from "fs";
import path                          from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface PluginBuildEntry {
  entry:   string;
  name:    string;
  /** Extra JS appended after the bundle — for module key re-exports. */
  footer?: string;
}

export const TIDDLERS_DIR     = "tiddlers";
export const TIDDLER_SRC_DIR  = "tiddlers/src";

/**
 * Read the `/*\ ... \*\/` tiddler field block from a TS source file and
 * return it as the Rollup banner string. Throws at build time if the block
 * is missing — enforcing the header contract on every new module.
 */
export function readTiddlerHeader(entryPath: string): string {
  const src = readFileSync(path.resolve(__dirname, entryPath), "utf8");
  const m   = /^\/\*\\\n([\s\S]*?)\n\\\*\//m.exec(src);
  if (!m) throw new Error(`[plugin-build] missing /*\\ ... \\*/ header in ${entryPath}`);
  return `/*\\\n${m[1]}\n\\*/\n`;
}

export const PLUGIN_ENTRIES: PluginBuildEntry[] = [
  // Wikirules.
  { entry: "src/wikirules/lar-sigil-block.ts",     name: "lar-sigil-block"     },
  { entry: "src/wikirules/lar-sigil-inline.ts",    name: "lar-sigil-inline"    },
  { entry: "src/wikirules/lar-doctype-comment.ts", name: "lar-doctype-comment" },

  // Widgets.
  { entry: "src/widgets/ahu.ts",            name: "ahu"            },
  { entry: "src/widgets/aka.ts",            name: "aka"            },
  { entry: "src/widgets/kahea.ts",          name: "kahea"          },
  { entry: "src/widgets/loulou.ts",         name: "loulou"         },
  { entry: "src/widgets/pranala.ts",        name: "pranala"        },
  { entry: "src/widgets/pranala-header.ts", name: "pranala-header" },
  { entry: "src/widgets/kau.ts",            name: "kau"            },
  { entry: "src/widgets/lar-meme-split.ts", name: "lar-meme-split" },

  // Parser / deserializer / macro.
  { entry: "src/memetic-parser.ts",       name: "memetic-parser"               },
  { entry: "src/macros/lar-iam-block.ts", name: "lar-iam-block"                },
  {
    entry:  "src/deserializer.ts",
    name:   "memetic-wikitext-deserializer",
    footer: `\nexports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;`,
  },

  // Startup modules.
  { entry: "src/grammar-cache.ts", name: "grammar-cache" },

  // Library modules + filter helpers.
  { entry: "src/modules/lar-promote.ts",  name: "lar-promote"        },
  { entry: "src/meme-ast-entry.ts",       name: "meme-ast"           },
  { entry: "src/cold-boot-ceremony.ts",   name: "cold-boot-ceremony" },
  { entry: "src/filters/implementors.ts", name: "implementors"       },
  { entry: "src/filters/edge.ts",         name: "edge"               },
  { entry: "src/filters/toml-field.ts",   name: "toml-field"         },
];

export async function buildPluginCjsTiddlers(outDir = TIDDLER_SRC_DIR): Promise<void> {
  for (const entry of PLUGIN_ENTRIES) {
    await build({
      configFile: false,
      logLevel:   "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry.entry),
          formats:  ["cjs"],
          fileName: () => `${entry.name}.js`,
        },
        outDir,
        emptyOutDir: false,
        sourcemap:   false,
        minify:      false,
        rollupOptions: {
          external: (id) => id.startsWith("$:/") || id === "tiddlywiki" || id.startsWith("tiddlywiki/"),
          output: {
            banner:   readTiddlerHeader(entry.entry),
            esModule: false,
            exports:  "named",
            ...(entry.footer ? { footer: entry.footer } : {}),
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
    console.log(`[plugin-build] ${outDir}/${entry.name}.js`);
  }
}

async function main(): Promise<void> {
  await buildPluginCjsTiddlers();
  console.log(`✓ Vite emitted ${PLUGIN_ENTRIES.length} plugin module bundles to ${TIDDLER_SRC_DIR}/`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
