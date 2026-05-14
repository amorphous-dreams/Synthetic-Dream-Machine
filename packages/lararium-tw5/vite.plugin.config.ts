/**
 * vite.plugin.config.ts — discover and compile TW5 plugin modules from `src/`.
 *
 * Any TS source file whose first line is `/*\` is a TW5 module tiddler.
 * The build script discovers them automatically — no manual registry.
 *
 * Module identity lives in the source file's `/*\ ... \*\/` header block:
 *   title:       lar:/// URI — becomes the tiddler title in the plugin
 *   type:        application/javascript
 *   module-type: widget | wikirule | parser | tiddlerdeserializer | startup | macro | library
 *
 * Output filename = last segment of the tiddler title URI.
 * The TW5 pack step bundles `tiddlers/src/*.js` + static `tiddlers/*.tid` into
 * the compiled plugin blob carried in genesis.
 */

import { build }                        from "vite";
import { readdirSync, readFileSync }    from "fs";
import path                             from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR   = path.resolve(__dirname, "src");

export const TIDDLERS_DIR    = "tiddlers";
export const TIDDLER_SRC_DIR = "tiddlers/src";

/** Kept for build-plugin-tiddler.ts compatibility; anchor patching now driven by bags/ scan. */
export const PLUGIN_ENTRIES: Array<{ name: string; anchor?: string }> = [];

// ---------------------------------------------------------------------------
// Discovery — walk src/, collect TS files that open with /*\
// ---------------------------------------------------------------------------

function* walkTs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { yield* walkTs(full); continue; }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) yield full;
  }
}

interface TiddlerModule {
  /** Absolute path to the TS source file. */
  absPath:    string;
  /** Path relative to the project root — used as Vite entry. */
  entry:      string;
  /** Output JS filename (no extension) — last segment of the tiddler title URI. */
  name:       string;
  /** Full TW5 header banner string prepended to the compiled output. */
  banner:     string;
}

// TW5 header sentinel: files whose first line is exactly /*\  (4 chars: / * \ newline)
const HEADER_START = "/*\\\n";
// Extracts the body between /*\ ... \*/  (uses RegExp ctor to avoid literal-escaping issues)
const HEADER_RE = new RegExp(String.raw`^/\*\\\n([\s\S]*?)\n\\\*/`, "m");

function discoverModules(): TiddlerModule[] {
  const results: TiddlerModule[] = [];
  for (const absPath of walkTs(SRC_DIR)) {
    const src = readFileSync(absPath, "utf8");
    if (!src.startsWith(HEADER_START)) continue;

    const headerMatch = HEADER_RE.exec(src);
    if (!headerMatch) continue;
    const headerBody = headerMatch[1]!;

    const titleMatch = /^title:\s*(.+)$/m.exec(headerBody);
    if (!titleMatch) throw new Error(`[plugin-build] /*\\ block missing title: in ${absPath}`);
    const title = titleMatch[1]!.trim();

    const name  = title.split("/").at(-1)!;
    const entry = path.relative(__dirname, absPath);

    const banner = HEADER_START + headerBody + "\n\\*/\n";
    results.push({ absPath, entry, name, banner });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildPluginCjsTiddlers(outDir = TIDDLER_SRC_DIR): Promise<void> {
  const modules = discoverModules();
  for (const mod of modules) {
    await build({
      configFile: false,
      logLevel:   "warn",
      build: {
        lib: {
          entry:    mod.absPath,
          formats:  ["cjs"],
          fileName: () => `${mod.name}.js`,
        },
        outDir,
        emptyOutDir: false,
        sourcemap:   false,
        minify:      false,
        rollupOptions: {
          external: (id) => id.startsWith("$:/") || id === "tiddlywiki" || id.startsWith("tiddlywiki/"),
          output: {
            banner:   mod.banner,
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
    console.log(`[plugin-build] ${outDir}/${mod.name}.js`);
  }
  console.log(`✓ Vite emitted ${modules.length} plugin module bundles to ${outDir}/`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildPluginCjsTiddlers().catch((err) => { console.error(err); process.exit(1); });
}
