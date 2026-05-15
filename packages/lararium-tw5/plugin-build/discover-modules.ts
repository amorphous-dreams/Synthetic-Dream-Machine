import { readdirSync, readFileSync } from "fs";
import path from "path";
import { ROOT, SRC_DIR } from "./paths.js";
import { parseTw5Header } from "./tw5-header.js";

export interface TiddlerModule {
  /** Absolute path to the TS source file. */
  absPath: string;
  /** Path relative to the package root — used as Vite entry/debug claim. */
  entry: string;
  /** Output JS filename (no extension) — last segment of the tiddler title URI. */
  name: string;
  /** Full TW5 header banner string prepended to the compiled output. */
  banner: string;
  /** Parsed TW5 tiddler fields from the source header. */
  fields: Record<string, string>;
  /** Path to the source file relative to this package root. */
  sourcePath: string;
}

function* walkTs(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { yield* walkTs(full); continue; }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) yield full;
  }
}

export function discoverModules(srcDir = SRC_DIR): TiddlerModule[] {
  const results: TiddlerModule[] = [];
  for (const absPath of walkTs(srcDir)) {
    const src = readFileSync(absPath, "utf8");
    const header = parseTw5Header(src, absPath);
    if (!header) continue;

    const title = header.fields["title"]!;
    const name = title.split("/").at(-1)!;
    const sourcePath = path.relative(ROOT, absPath);

    results.push({
      absPath,
      entry: sourcePath,
      name,
      banner: header.banner,
      fields: header.fields,
      sourcePath,
    });
  }
  const modules = results.sort((a, b) => a.fields["title"]!.localeCompare(b.fields["title"]!));
  assertUniqueModules(modules);
  return modules;
}

function assertUniqueModules(modules: TiddlerModule[]): void {
  const seenTitles = new Map<string, string>();
  const seenNames = new Map<string, string>();
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
