/**
 * vite.tiddlers.config.ts — per-tiddler CJS builds for TW5 VM modules.
 *
 * Builds each TS entry as an independent CommonJS tiddler file with a native
 * TiddlyWiki header comment. The emitted `.js` file itself is the TW5 tiddler:
 * no parallel raw-js artifact and no memetic wrapper splice.
 */

import { build } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type TiddlerEntryKind = "widget" | "filter" | "deserializer" | "library";

export interface TiddlerBuildEntry {
  entry:      string;
  exportKey:  string;
  name:       string;
  kind:       TiddlerEntryKind;
  title:      string;
  moduleType: string;
  footer?:    string;
}

// Widget entry points.
export const WIDGET_ENTRIES: TiddlerBuildEntry[] = [
  { entry: "src/widgets/pranala.ts", exportKey: "pranala", name: "pranala", kind: "widget", title: "lar:///ha.ka.ba/@lararium/tw5/widgets/pranala-tw5", moduleType: "widget" },
  { entry: "src/widgets/ahu.ts",     exportKey: "ahu",     name: "ahu",     kind: "widget", title: "lar:///ha.ka.ba/@lararium/tw5/widgets/ahu-tw5",     moduleType: "widget" },
  { entry: "src/widgets/kau.ts",     exportKey: "kau",     name: "kau",     kind: "widget", title: "lar:///ha.ka.ba/@lararium/tw5/widgets/kau-tw5",     moduleType: "widget" },
];

// Filter helpers currently register imperatively through tw5-vm boot. Keeping
// this list lets us emit headered tiddlers for corpus/module review without
// claiming module-type=filteroperator support in the packed plugin.
export const FILTER_ENTRIES: TiddlerBuildEntry[] = [
  { entry: "src/filters/implementors.ts", exportKey: "implementors", name: "implementors", kind: "filter", title: "lar:///ha.ka.ba/@lararium/tw5/filters/implementors-tw5", moduleType: "library" },
  { entry: "src/filters/edge.ts",         exportKey: "edge",         name: "edge",         kind: "filter", title: "lar:///ha.ka.ba/@lararium/tw5/filters/edge-tw5",         moduleType: "library" },
  { entry: "src/filters/toml-field.ts",   exportKey: "toml",         name: "toml-field",   kind: "filter", title: "lar:///ha.ka.ba/@lararium/tw5/filters/toml-field-tw5",   moduleType: "library" },
];

// Deserializer entry points.
export const DESERIALIZER_ENTRIES: TiddlerBuildEntry[] = [
  {
    entry:      "src/deserializer.ts",
    exportKey:  "memeticWikitextDeserializer",
    name:       "deserializer",
    kind:       "deserializer",
    title:      "lar:///ha.ka.ba/@lararium/tw5/modules/deserializer-tw5",
    moduleType: "tiddlerdeserializer",
    footer:     `\nexports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;`,
  },
];

// Module bundle entry points — CJS modules loaded as TW5 library modules.
export const MODULE_ENTRIES: TiddlerBuildEntry[] = [
  { entry: "src/meme-ast-entry.ts",       exportKey: "memeAst",    name: "meme-ast",           kind: "library", title: "lar:///ha.ka.ba/@lararium/tw5/modules/meme-ast-tw5",           moduleType: "library" },
  { entry: "src/cold-boot-ceremony.ts",   exportKey: "coldBoot",   name: "cold-boot-ceremony", kind: "library", title: "lar:///ha.ka.ba/@lararium/tw5/modules/cold-boot-ceremony-tw5", moduleType: "library" },
  { entry: "src/modules/lar-promote.ts",  exportKey: "larPromote", name: "lar-promote",        kind: "library", title: "lar:///ha.ka.ba/@lararium/tw5/modules/lar-promote-tw5",        moduleType: "library" },
];

export const TIDDLER_BUILD_ENTRIES: TiddlerBuildEntry[] = [
  ...WIDGET_ENTRIES,
  ...FILTER_ENTRIES,
  ...DESERIALIZER_ENTRIES,
  ...MODULE_ENTRIES,
];

export function tiddlerHeader(entry: TiddlerBuildEntry): string {
  return `/*\\\ntitle: ${entry.title}\ntype: application/javascript\nmodule-type: ${entry.moduleType}\n\\*/\n`;
}

export async function buildAll(outDir = "dist-tiddlers"): Promise<void> {
  for (const entry of TIDDLER_BUILD_ENTRIES) {
    await build({
      configFile: false,
      logLevel: "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry.entry),
          formats:  ["cjs"],
          fileName: () => `${entry.name}.js`,
        },
        outDir,
        emptyOutDir: false,
        sourcemap: false,
        minify:    false,
        rollupOptions: {
          external: (id: string) => id.startsWith("$:/"),
          output: {
            banner:   tiddlerHeader(entry),
            esModule: false,
            exports:  "named",
            ...(entry.footer ? { footer: entry.footer } : {}),
          },
        },
      },
    });
    console.log(`[build:tiddlers] ${entry.name}.js`);
  }
}
