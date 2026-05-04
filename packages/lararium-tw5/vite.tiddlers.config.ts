/**
 * vite.tiddlers.config.ts — per-tiddler CJS builds for lares/ module tiddler injection.
 *
 * Builds each widget class and filter operator as an independent CJS module with no
 * external dependencies beyond the TW5 widget API (which is provided at runtime).
 * Outputs go to dist-widgets/{name}.iife.js (filename kept for write-tiddler-memes compat).
 *
 * Format is CJS (not IIFE) so that TW5's CommonJS module wrapper provides the real
 * `exports` object — IIFE format would shadow TW5's exports with a fresh {}, making
 * every module invisible to `require()` and widget/deserializer registration.
 *
 * postbuild: scripts/write-tiddler-memes.ts reads each file and splices it into
 * the corresponding lares/.../widgets/{name}-tw5.md and .../filters/{name}-tw5.md.
 *
 * run:
 *   pnpm --filter @lararium/tw5 build:widgets
 */

import { build } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Widget entry points: [entryFile, exportKey, outputName]
export const WIDGET_ENTRIES: Array<{ entry: string; exportKey: string; name: string }> = [
  { entry: "src/widgets/pranala.ts",   exportKey: "pranala",  name: "pranala"  },
  { entry: "src/widgets/pae.ts",       exportKey: "pae",      name: "pae"      },
  { entry: "src/widgets/lele.ts",      exportKey: "lele",     name: "lele"     },
  { entry: "src/widgets/papalohe.ts",  exportKey: "papalohe", name: "papalohe" },
  { entry: "src/widgets/kukali.ts",    exportKey: "kukali",   name: "kukali"   },
  { entry: "src/widgets/toml.ts",      exportKey: "toml",     name: "toml"     },
  { entry: "src/widgets/sigil.ts",     exportKey: "sigil",    name: "sigil"    },
  { entry: "src/widgets/dynamic.ts",   exportKey: "dynamic",  name: "dynamic"  },
  { entry: "src/widgets/ahu.ts",       exportKey: "ahu",      name: "ahu"      },
  { entry: "src/widgets/kumu.ts",      exportKey: "kumu",     name: "kumu"     },
  { entry: "src/widgets/kau.ts",       exportKey: "kau",      name: "kau"      },
];

// Filter operator entry points
export const FILTER_ENTRIES: Array<{ entry: string; exportKey: string; name: string }> = [
  { entry: "src/filters/implementors.ts", exportKey: "implementors", name: "implementors" },
  { entry: "src/filters/edge.ts",         exportKey: "edge",         name: "edge"         },
  { entry: "src/filters/toml-field.ts",   exportKey: "toml",         name: "toml-field"   },
];

// Deserializer entry points — compiled to IIFE, exported as exports["content/type"]
// module-type: tiddlerdeserializer in the corresponding lares/ module tiddler.
export const DESERIALIZER_ENTRIES: Array<{ entry: string; exportKey: string; name: string }> = [
  { entry: "src/deserializer.ts", exportKey: "memeticWikitextDeserializer", name: "deserializer" },
];

// Module bundle entry points — self-contained IIFEs loaded as TW5 library modules.
// module-type: library in the corresponding memes/modules/*-tw5.md tiddler.
export const MODULE_ENTRIES: Array<{ entry: string; exportKey: string; name: string }> = [
  { entry: "src/meme-ast-entry.ts",        exportKey: "memeAst",     name: "meme-ast"           },
  { entry: "src/cold-boot-ceremony.ts",   exportKey: "coldBoot",    name: "cold-boot-ceremony" },
];

export async function buildAll(): Promise<void> {
  const all = [
    ...WIDGET_ENTRIES.map((e) => ({ ...e, kind: "widget" as const })),
    ...FILTER_ENTRIES.map((e) => ({ ...e, kind: "filter" as const })),
    ...DESERIALIZER_ENTRIES.map((e) => ({ ...e, kind: "module" as const })),
    ...MODULE_ENTRIES.map((e) => ({ ...e, kind: "module" as const })),
  ];

  const isDeserializer = new Set(DESERIALIZER_ENTRIES.map((e) => e.name));

  for (const { entry, name } of all) {
    // Deserializer: TW5 tiddlerdeserializer module type expects exports keyed by MIME type.
    // Append the MIME key alias after the named function export.
    const footer = isDeserializer.has(name)
      ? `\nexports["text/x-memetic-wikitext"] = exports.memeticWikitextDeserializer;`
      : undefined;

    await build({
      configFile: false,
      logLevel: "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry),
          formats:  ["cjs"],
          fileName: () => `${name}.tw5.js`,
        },
        outDir:    "dist-widgets",
        emptyOutDir: false,
        sourcemap: false,
        minify:    false,
        rollupOptions: {
          output: {
            esModule:  false,
            exports:   "named",
            ...(footer ? { footer } : {}),
          },
        },
      },
    });
    console.log(`[build:widgets] ${name}.iife.js`);
  }
}
