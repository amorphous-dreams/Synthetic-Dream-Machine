/**
 * vite.widgets.config.ts — per-widget IIFE builds for lares/ module tiddler injection.
 *
 * Builds each widget class and filter operator as an independent IIFE with no
 * external dependencies beyond the TW5 widget API (which is provided at runtime).
 * Outputs go to dist-widgets/{name}.iife.js.
 *
 * postbuild: scripts/write-widget-memes.ts reads each IIFE and splices it into
 * the corresponding lares/.../widgets/{name}-tw5.md and .../filters/{name}-tw5.md.
 *
 * run:
 *   pnpm --filter @lararium/tw5 build:widgets
 */

import { defineConfig, build } from "vite";
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

export async function buildAll(): Promise<void> {
  const all = [
    ...WIDGET_ENTRIES.map((e) => ({ ...e, kind: "widget" as const })),
    ...FILTER_ENTRIES.map((e) => ({ ...e, kind: "filter" as const })),
  ];

  for (const { entry, name } of all) {
    await build({
      configFile: false,
      logLevel: "warn",
      build: {
        lib: {
          entry:    path.resolve(__dirname, entry),
          name:     `__lar_${name.replace(/-/g, "_")}`,
          formats:  ["iife"],
          fileName: () => `${name}.iife.js`,
        },
        outDir:    "dist-widgets",
        emptyOutDir: false,
        sourcemap: false,
        minify:    false,
        rollupOptions: {
          // No external deps — widget API is accessed via `this` at runtime.
          output: { inlineDynamicImports: true },
        },
      },
    });
    console.log(`[build:widgets] ${name}.iife.js`);
  }
}
