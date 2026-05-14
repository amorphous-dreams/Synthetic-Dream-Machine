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
import { readdirSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { createHash }                   from "crypto";
import path                             from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR   = path.resolve(__dirname, "src");

export const TIDDLERS_DIR    = "tiddlers";
export const TIDDLER_SRC_DIR = "tiddlers/src";
export const MODULE_MANIFEST = "dist-plugin/module-manifest.json";

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
  /** Parsed TW5 tiddler fields from the source header. */
  fields:     Record<string, string>;
  /** Path to the source file relative to this package root. */
  sourcePath: string;
}

interface ModuleManifestEntry {
  title:      string;
  moduleType: string;
  sourcePath: string;
  outputPath: string;
  sha256:     string;
}

// TW5 header sentinel: files whose first line is exactly /*\  (4 chars: / * \ newline)
const HEADER_START = "/*\\\n";
// Extracts the body between /*\ ... \*/  (uses RegExp ctor to avoid literal-escaping issues)
const HEADER_RE = new RegExp(String.raw`^/\*\\\n([\s\S]*?)\n\\\*/`, "m");

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function parseHeaderFields(headerBody: string, absPath: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [idx, rawLine] of headerBody.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_.:-]+):\s*(.*)$/.exec(line);
    if (!match) {
      throw new Error(`[plugin-build] invalid TW5 header line ${idx + 2} in ${absPath}: ${rawLine}`);
    }
    const key = match[1]!;
    if (fields[key] !== undefined) {
      throw new Error(`[plugin-build] duplicate TW5 header field "${key}" in ${absPath}`);
    }
    fields[key] = match[2]!.trim();
  }
  return fields;
}

function validateHeaderFields(fields: Record<string, string>, absPath: string): void {
  const required = ["title", "type", "module-type"] as const;
  for (const key of required) {
    if (!fields[key]) throw new Error(`[plugin-build] /*\\ block missing ${key}: in ${absPath}`);
  }
  if (fields["type"] !== "application/javascript") {
    throw new Error(`[plugin-build] ${absPath} has type=${fields["type"]}; TW5 module sources must use application/javascript`);
  }
  const title = fields["title"]!;
  if (!title.startsWith("lar:///") && !title.startsWith("$:/")) {
    throw new Error(`[plugin-build] ${absPath} has non-canonical module title: ${title}`);
  }
}

function discoverModules(): TiddlerModule[] {
  const results: TiddlerModule[] = [];
  for (const absPath of walkTs(SRC_DIR)) {
    const src = readFileSync(absPath, "utf8");
    if (!src.startsWith(HEADER_START)) continue;

    const headerMatch = HEADER_RE.exec(src);
    if (!headerMatch) continue;
    const headerBody = headerMatch[1]!;

    const fields = parseHeaderFields(headerBody, absPath);
    validateHeaderFields(fields, absPath);
    const title = fields["title"]!;

    const name  = title.split("/").at(-1)!;
    const entry = path.relative(__dirname, absPath);
    const sourcePath = path.relative(__dirname, absPath);

    const banner = HEADER_START + headerBody + "\n\\*/\n";
    results.push({ absPath, entry, name, banner, fields, sourcePath });
  }
  return results.sort((a, b) => a.fields["title"]!.localeCompare(b.fields["title"]!));
}

function assertUniqueModules(modules: TiddlerModule[]): void {
  const seenTitles = new Map<string, string>();
  const seenNames  = new Map<string, string>();
  for (const mod of modules) {
    const title = mod.fields["title"]!;
    const priorTitle = seenTitles.get(title);
    if (priorTitle) {
      throw new Error(`[plugin-build] duplicate module title ${title}\n  ${priorTitle}\n  ${mod.sourcePath}`);
    }
    seenTitles.set(title, mod.sourcePath);

    const priorName = seenNames.get(mod.name);
    if (priorName) {
      throw new Error(
        `[plugin-build] output filename collision "${mod.name}.js"\n` +
        `  ${priorName}\n` +
        `  ${mod.sourcePath}\n` +
        `Use distinct final title segments or change the emitted filename rule.`,
      );
    }
    seenNames.set(mod.name, mod.sourcePath);
  }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function buildPluginCjsTiddlers(outDir = TIDDLER_SRC_DIR): Promise<void> {
  const outDirAbs = path.resolve(__dirname, outDir);
  rmSync(outDirAbs, { recursive: true, force: true });
  mkdirSync(outDirAbs, { recursive: true });
  const modules = discoverModules();
  assertUniqueModules(modules);

  const manifest: ModuleManifestEntry[] = [];
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
        outDir: outDirAbs,
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
    const outputPath = path.join(outDirAbs, `${mod.name}.js`);
    const outputText = readFileSync(outputPath, "utf8");
    manifest.push({
      title:      mod.fields["title"]!,
      moduleType: mod.fields["module-type"]!,
      sourcePath: mod.sourcePath,
      outputPath: path.relative(__dirname, outputPath),
      sha256:     sha256(outputText),
    });
    console.log(`[plugin-build] ${outDir}/${mod.name}.js`);
  }
  const manifestPath = path.resolve(__dirname, MODULE_MANIFEST);
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify({
      generatedBy: "packages/lararium-tw5/vite.plugin.config.ts",
      outDir,
      modules: manifest,
    }, null, 2) + "\n",
    "utf8",
  );
  console.log(`✓ Vite emitted ${modules.length} plugin module bundles to ${outDir}/`);
  console.log(`✓ Vite wrote ${path.relative(__dirname, manifestPath)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildPluginCjsTiddlers().catch((err) => { console.error(err); process.exit(1); });
}
