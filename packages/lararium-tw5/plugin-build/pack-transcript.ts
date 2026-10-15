/**
 * pack-transcript.ts — auditable record of the TW5 CLI pack step.
 *
 * The TW5 CLI pack step runs as an external process and could silently transform
 * content in unexpected ways. The pack transcript records:
 *   - what binary packed the plugin (path + package version)
 *   - what command arguments it received
 *   - a digest of the input tree before packing
 *   - a digest of the raw exported JSON before any field augmentation
 *
 * Pono note: the transcript MUST NOT include the final attestation hash. The
 * attestation links the transcript; not the other way around. Keep manifests
 * acyclic: source → pack-transcript → attestation, never the reverse.
 *
 * Agent/dev note: this module stays tw5-specific. The hash primitive (sha256HexSync)
 * lives in @lararium/mesh. The schema versioning string and the TW5-specific
 * pack-step shape live here.
 */

import { sha256HexSync } from "@lararium/mesh";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export const PACK_TRANSCRIPT_FORMAT = "lararium-tw5-pack-transcript/v2";

export interface PackTranscript {
  format: typeof PACK_TRANSCRIPT_FORMAT;
  generatedBy: string;
  /** Stable repo-relative path to the TW5 binary used. */
  tw5BinPath: string;
  /** Version string from tiddlywiki's package.json. */
  tw5PackageVersion: string;
  /**
   * Pack command arguments as passed to spawnSync.
   * The temp input path appears as literal `{tmpInput}` — ephemeral paths
   * carry no provenance value; the inputRootSha256 proves the content.
   */
  packArgs: string[];
  /**
   * SHA-256 of the sorted concatenation of all files in the temp input root
   * after cpSync and before spawnSync. Each entry contributes:
   *   `${relPath}:${fileContent}\n`
   * Sorted by relative path (lexicographic). Proves the TW5 CLI received the
   * expected content, not a mutated tree.
   */
  inputRootSha256: string;
  /**
   * SHA-256 of the raw plugin.json bytes as exported by TW5, before any
   * field augmentation by the build script. Proves the TW5 CLI transformation
   * produced a known output.
   */
  exportedPluginSha256: string;
}

/** Walk a directory recursively, returning all file paths sorted lexicographically. */
function walkDir(rootDir: string): string[] {
  const results: string[] = [];
  function recurse(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        recurse(abs);
      } else if (entry.isFile()) {
        results.push(abs);
      }
    }
  }
  recurse(rootDir);
  return results;
}

/**
 * Compute a single SHA-256 digest representing the full content of a directory
 * tree. Each file contributes its relative path + ":" + UTF-8 content, joined
 * with newlines, sorted lexicographically by relative path.
 */
export function computeInputRootSha256(rootDir: string): string {
  const files = walkDir(rootDir);
  const parts = files.map((abs) => {
    const rel = path.relative(rootDir, abs);
    const content = readFileSync(abs, "utf8");
    return `${rel}:${content}`;
  });
  return sha256HexSync(parts.join("\n"));
}

/** Read the version field from tiddlywiki's package.json, resolved from a given base path. */
export function resolveTw5Version(resolveFrom: string): string {
  // Walk upward from resolveFrom searching node_modules/tiddlywiki/package.json.
  let dir = resolveFrom;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "node_modules", "tiddlywiki", "package.json");
    try {
      const { version } = JSON.parse(readFileSync(candidate, "utf8")) as { version?: string };
      if (version) return version;
    } catch { /* not found at this level */ }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // pnpm virtual store fallback: find tiddlywiki@X.Y.Z entry under .pnpm/.
  try {
    const pnpmStore = path.join(resolveFrom, "node_modules", ".pnpm");
    const entries = readdirSync(pnpmStore, { withFileTypes: true });
    const tw5Entry = entries.find((e) => e.isDirectory() && e.name.startsWith("tiddlywiki@"));
    if (tw5Entry) {
      const pkgJson = path.join(pnpmStore, tw5Entry.name, "node_modules", "tiddlywiki", "package.json");
      const { version } = JSON.parse(readFileSync(pkgJson, "utf8")) as { version?: string };
      if (version) return version;
    }
  } catch { /* ignored */ }
  return "unknown";
}

export function writePackTranscript(pathname: string, transcript: PackTranscript): void {
  if (transcript.format !== PACK_TRANSCRIPT_FORMAT) {
    throw new Error(`[pack-transcript] unexpected format: ${transcript.format}`);
  }
  mkdirSync(path.dirname(pathname), { recursive: true });
  writeFileSync(pathname, JSON.stringify(transcript, null, 2) + "\n", "utf8");
}

export function readPackTranscript(pathname: string): PackTranscript {
  const text = readFileSync(pathname, "utf8");
  const t = JSON.parse(text) as PackTranscript;
  if (t.format !== PACK_TRANSCRIPT_FORMAT) {
    throw new Error(`[pack-transcript] unsupported format: ${t.format}`);
  }
  return t;
}
