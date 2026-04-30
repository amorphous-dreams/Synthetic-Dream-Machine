/**
 * Source meme emitter — reads priority TypeScript/TSX source files and returns
 * them as meme entries for the Automerge store.
 *
 * URI scheme: lar:///source/<package-name>/src/<relative-path>
 *   e.g. lar:///source/lararium-core/src/causal-island.ts
 *
 * Source memes carry the verbatim source text as their body.
 * They have no laresRelPath (not on-disk in lares/) — seeded into the store only.
 * Interface law: lares/ha-ka-ba/api/v0.1/pono/source-module.md
 */

import { readFileSync, existsSync } from "fs";
import { createHash }                from "crypto";
import { join, dirname }             from "path";
import { fileURLToPath }             from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Monorepo packages root — two levels up from scripts/
const PACKAGES_ROOT = join(__dirname, "../../");

// Priority source modules to emit as memes at boot.
// Keep this list small — agents read source through the graph, not by scanning.
const PRIORITY_SOURCES: Array<{ pkg: string; relPath: string }> = [
  { pkg: "lararium-core", relPath: "src/parser.ts" },
  { pkg: "lararium-core", relPath: "src/ast.ts" },
  { pkg: "lararium-core", relPath: "src/causal-island.ts" },
  { pkg: "lararium-core", relPath: "src/live-protocol.ts" },
  { pkg: "lararium-tw5",  relPath: "src/lararium-tw5.ts" },
  { pkg: "lararium-app",  relPath: "src/LarariumPanel.tsx" },
  { pkg: "lararium-app",  relPath: "src/LarariumShell.tsx" },
];

export interface SourceMemeEntry {
  uri:          string;
  text:         string;
  contentHash:  string;
  fields: {
    package:     string;
    "src-path":  string;
    lang:        string;
    "built-at":  string;
    "content-hash": string;
  };
}

export function buildSourceMemes(builtAt: string): SourceMemeEntry[] {
  const result: SourceMemeEntry[] = [];

  for (const { pkg, relPath } of PRIORITY_SOURCES) {
    const abs = join(PACKAGES_ROOT, pkg, relPath);
    if (!existsSync(abs)) continue;

    const text = readFileSync(abs, "utf8");
    const contentHash = createHash("sha256").update(text).digest("hex");
    const uri = `lar:///source/${pkg}/${relPath}`;
    const lang = relPath.endsWith(".tsx") ? "tsx" : "typescript";

    result.push({
      uri,
      text,
      contentHash,
      fields: {
        package:          `@lararium/${pkg.replace("lararium-", "")}`,
        "src-path":       relPath,
        lang,
        "built-at":       builtAt,
        "content-hash":   contentHash,
      },
    });
  }

  return result;
}
