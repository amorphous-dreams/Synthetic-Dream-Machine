/**
 * vite.plugin.config.ts — compile all plugin-owned TS entries to TW5 CJS tiddlers.
 *
 * Output JS files land in `tiddlers/src/`, while hand-authored `.tid` files and
 * `plugin.info` live in `tiddlers/`. The TW5 pack step loads `tiddlers/` as a
 * plugin folder and packs both static tiddlers and generated CJS module tiddlers.
 *
 * Each compiled JS file gets a native TW5 `/*\ ... \*\/` header comment so TW5
 * can read the tiddler title and module-type directly from the file.
 */

import { build } from "vite";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type PluginModuleType =
  | "wikirule"
  | "widget"
  | "parser"
  | "tiddlerdeserializer"
  | "macro"
  | "startup"
  | "library";

export interface PluginBuildEntry {
  entry:      string;
  name:       string;
  moduleType: PluginModuleType;
  title:      string;
  anchor?:    string;
  footer?:    string;
}

export const TIDDLERS_DIR = "tiddlers";
export const TIDDLER_SRC_DIR = "tiddlers/src";

const LAR_TW5 = "lar:///ha.ka.ba/@lararium/tw5";

function tw5Title(subpath: string, name: string): string {
  return `${LAR_TW5}/${subpath}/${name}`;
}

function anchor(subpath: string, name: string): string {
  return `${subpath}/${name}.md`;
}

/**
 * All generated CJS tiddlers that belong in the packed plugin.
 *
 * Early-alpha rule: one build path owns executable TW5 JavaScript. Bag memes may
 * point at these bodies by hash/module-ref, but the executable tiddlers get
 * packed from `tiddlers/src/`, not duplicated into `bags/`.
 */
export const PLUGIN_ENTRIES: PluginBuildEntry[] = [
  // Wikirules.
  { entry: "src/wikirules/lar-sigil-block.ts",     name: "lar-sigil-block",     moduleType: "wikirule", title: tw5Title("wikirules", "lar-sigil-block") },
  { entry: "src/wikirules/lar-sigil-inline.ts",    name: "lar-sigil-inline",    moduleType: "wikirule", title: tw5Title("wikirules", "lar-sigil-inline") },
  { entry: "src/wikirules/lar-doctype-comment.ts", name: "lar-doctype-comment", moduleType: "wikirule", title: tw5Title("wikirules", "lar-doctype-comment") },

  // Widgets.
  { entry: "src/widgets/ahu.ts",            name: "ahu",            moduleType: "widget", title: tw5Title("widgets", "ahu"),            anchor: anchor("widgets", "ahu") },
  { entry: "src/widgets/aka.ts",            name: "aka",            moduleType: "widget", title: tw5Title("widgets", "aka") },
  { entry: "src/widgets/kahea.ts",          name: "kahea",          moduleType: "widget", title: tw5Title("widgets", "kahea") },
  { entry: "src/widgets/loulou.ts",         name: "loulou",         moduleType: "widget", title: tw5Title("widgets", "loulou") },
  { entry: "src/widgets/pranala.ts",        name: "pranala",        moduleType: "widget", title: tw5Title("widgets", "pranala"),        anchor: anchor("widgets", "pranala") },
  { entry: "src/widgets/pranala-header.ts", name: "pranala-header", moduleType: "widget", title: tw5Title("widgets", "pranala-header") },
  { entry: "src/widgets/kau.ts",            name: "kau",            moduleType: "widget", title: tw5Title("widgets", "kau"),            anchor: anchor("widgets", "kau") },
  { entry: "src/widgets/lar-meme-split.ts", name: "lar-meme-split", moduleType: "widget", title: tw5Title("widgets", "lar-meme-split") },

  // Parser/deserializer/macros.
  { entry: "src/memetic-parser.ts",       name: "memetic-parser",               moduleType: "parser",             title: tw5Title("parsers", "memetic-parser") },
  {
    entry:      "src/deserializer.ts",
    name:       "memetic-wikitext-deserializer",
    moduleType: "tiddlerdeserializer",
    title:      tw5Title("modules", "deserializer"),
    anchor:     anchor("modules", "deserializer"),
    footer:     `\nexports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;`,
  },
  { entry: "src/macros/lar-iam-block.ts", name: "lar-iam-block", moduleType: "macro", title: tw5Title("macros", "lar-iam-block") },

  // Startup modules — register listeners and services at TW5 boot.
  { entry: "src/grammar-cache.ts", name: "grammar-cache", moduleType: "startup", title: tw5Title("modules", "grammar-cache") },

  // Library modules + filter helpers that the Lararium VM can require/register.
  { entry: "src/modules/lar-promote.ts",  name: "lar-promote",        moduleType: "library", title: tw5Title("modules", "lar-promote"),        anchor: anchor("modules", "lar-promote") },
  { entry: "src/meme-ast-entry.ts",       name: "meme-ast",           moduleType: "library", title: tw5Title("modules", "meme-ast") },
  { entry: "src/cold-boot-ceremony.ts",   name: "cold-boot-ceremony", moduleType: "library", title: tw5Title("modules", "cold-boot-ceremony"), anchor: anchor("modules", "cold-boot-ceremony") },
  { entry: "src/filters/implementors.ts", name: "implementors",       moduleType: "library", title: tw5Title("filters", "implementors"),       anchor: anchor("filters", "implementors") },
  { entry: "src/filters/edge.ts",         name: "edge",               moduleType: "library", title: tw5Title("filters", "edge"),               anchor: anchor("filters", "edge") },
  { entry: "src/filters/toml-field.ts",   name: "toml-field",         moduleType: "library", title: tw5Title("filters", "toml-field"),         anchor: anchor("filters", "toml-field") },
];

export function tiddlerHeader(entry: PluginBuildEntry): string {
  return `/*\\\ntitle: ${entry.title}\ntype: application/javascript\nmodule-type: ${entry.moduleType}\n\\*/\n`;
}

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
            banner:   tiddlerHeader(entry),
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
