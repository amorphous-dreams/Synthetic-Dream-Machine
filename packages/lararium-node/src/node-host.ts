/**
 * File-backed Lararium host for Node.js.
 *
 * Responsibility: walk the lares/ tree, load carrier files, populate MemeGraph,
 * and drive the compiler. No carrier semantics live here — only I/O.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";
import { join, relative, dirname } from "path";

import {
  resolveLarUri,
  parseCarrier,
  parsePranalaEdges,
  grammarRulesFromText,
  MemeGraph,
  Meme,
  laresRelPathToLarUri,
  compileBoot,
  compileBootReceipt,
  ENTRY_URI,
  type BootArtifact,
  type BootReceipt,
  type CarrierRecord,
  type GrammarRules,
} from "@lararium/core";

// Sync SHA-256 content hash — Node-only. Same algorithm and output format as the
// async makeMemeHash in lararium-core, but synchronous for use in the carrier loader.
function makeMemeHashSync(uri: string, fileBytes: Uint8Array | null): string {
  const content = fileBytes ? new TextDecoder().decode(fileBytes) : "virtual";
  const payload = uri + ":" + content;
  return "sha256:" + createHash("sha256").update(payload, "utf8").digest("hex");
}

import { laresRoot } from "@lararium/lares";

export const LARES_ROOT = laresRoot;
export const REPO_ROOT  = dirname(laresRoot);

// ---------------------------------------------------------------------------
// Grammar rules reader — Phase 2 scaffolding
//
// Reads lares/grammars/memetic-wikitext.md and extracts [[sigils]] and
// [[families]] TOML arrays into a GrammarRules object.
// Returns null if the grammar carrier does not exist (bootstrap safety net).
// ---------------------------------------------------------------------------

export function loadGrammarRules(): GrammarRules | null {
  const grammarPath = join(LARES_ROOT, "grammars", "memetic-wikitext.md");
  if (!existsSync(grammarPath)) return null;
  const text = readFileSync(grammarPath, "utf8");
  return grammarRulesFromText("lar:///lares/grammars/memetic-wikitext", text);
}

// ---------------------------------------------------------------------------
// Corpus source registry — loaded from lares meme at runtime
// Schema: lar:///ha.ka.ba/api/v0.1/lararium/schema/corpus-sources
// ---------------------------------------------------------------------------

export interface CorpusSource {
  /** pnpm workspace package name */
  name: string;
  /** path relative to monorepo root */
  path: string;
  /** Automerge bag name — matches LarTiddlerRecord["bag"] */
  bag: string;
  /** quine-corpus: this corpus defines the infrastructure the machinery reads */
  quine?: true;
}

export function loadCorpusSources(): CorpusSource[] {
  const memeFile = join(LARES_ROOT, "ha-ka-ba/api/v0.1/lararium/schema/corpus-sources.md");
  if (!existsSync(memeFile)) return [];
  const text = readFileSync(memeFile, "utf8");

  const sources: CorpusSource[] = [];
  // Extract all ```toml ... ``` fences
  for (const fence of text.matchAll(/```toml\s*([\s\S]*?)```/g)) {
    const block = fence[1] ?? "";
    // Parse [[corpus]] array-of-tables
    const tableRe = /\[\[corpus\]\]([\s\S]*?)(?=\[\[|$)/g;
    for (const m of block.matchAll(tableRe)) {
      const entry: Record<string, string> = {};
      for (const line of (m[1] ?? "").split("\n")) {
        const kv = line.match(/^\s*([\w_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(true|false)(?=\s|$))/);
        if (kv) entry[kv[1]!] = kv[2] ?? kv[3] ?? kv[4] ?? "";
      }
      if (entry["name"] && entry["path"] && entry["bag"]) {
        sources.push({
          name: entry["name"]!,
          path: entry["path"]!,
          bag:  entry["bag"]!,
          ...(entry["quine"] === "true" ? { quine: true as const } : {}),
        });
      }
    }
  }
  return sources;
}

/** The quine-corpus — infrastructure definitions read by the machinery itself. */
export function loadLaresCorpus(): CorpusSource {
  const all = loadCorpusSources();
  const lares = all.find((c) => c.quine);
  if (!lares) throw new Error("corpus-sources meme has no quine-corpus entry");
  return lares;
}

/** Resolve a corpus source's path to an absolute filesystem path. */
export function corpusAbsPath(source: CorpusSource): string {
  return join(REPO_ROOT, source.path);
}

/**
 * Map a lar: URI back to an absolute disk path under lares/.
 * Returns null if the URI is virtual (no file backing) or unresolvable.
 */
export function larUriToLaresAbsPath(uri: string): string | null {
  try {
    const resolution = resolveLarUri(uri);
    if (!resolution.laresRelPath) return null;
    return join(LARES_ROOT, resolution.laresRelPath);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File reader
// ---------------------------------------------------------------------------

export function readLarResource(uri: string): string {
  const resolution = resolveLarUri(uri);
  if (resolution.virtual) throw new Error(`${uri} names a virtual lar resource`);
  if (!resolution.laresRelPath) throw new Error(`${uri} has no file path`);
  const abs = join(LARES_ROOT, resolution.laresRelPath);
  if (!existsSync(abs)) throw new Error(`${uri} does not resolve to an existing file: ${abs}`);
  return readFileSync(abs, "utf8");
}

// ---------------------------------------------------------------------------
// Carrier reader
// ---------------------------------------------------------------------------

export function readCarrier(uri: string): CarrierRecord {
  const resolution = resolveLarUri(uri);
  if (resolution.virtual) throw new Error(`${uri} names a virtual carrier namespace`);
  if (!resolution.laresRelPath) throw new Error(`${uri} has no file path`);
  const abs = join(LARES_ROOT, resolution.laresRelPath);
  if (!existsSync(abs)) throw new Error(`${uri} does not resolve to an existing carrier file`);
  const text = readFileSync(abs, "utf8");
  return parseCarrier(uri, text);
}

// ---------------------------------------------------------------------------
// Meme loader (for graph population)
// ---------------------------------------------------------------------------

function loadMeme(uri: string, grammar?: GrammarRules): Meme | null {
  let resolution;
  try { resolution = resolveLarUri(uri); } catch { return null; }

  if (resolution.virtual) {
    return { uri, laresRelPath: null, contentHash: makeMemeHashSync(uri, null), metadata: {}, edgesOut: [], virtual: true, exists: false, shape: null };
  }

  if (!resolution.laresRelPath) return null;
  const abs = join(LARES_ROOT, resolution.laresRelPath);

  if (!existsSync(abs)) {
    return { uri, laresRelPath: resolution.laresRelPath, contentHash: makeMemeHashSync(uri, null), metadata: {}, edgesOut: [], virtual: false, exists: false, shape: null };
  }

  try {
    const fileBytes = readFileSync(abs);
    const text = fileBytes.toString("utf8");
    const record = parseCarrier(uri, text);
    const edges = parsePranalaEdges(uri, text, grammar);
    return {
      uri,
      laresRelPath: resolution.laresRelPath,
      contentHash: makeMemeHashSync(uri, fileBytes),
      metadata: record.metadata,
      edgesOut: edges,
      virtual: false,
      exists: true,
      shape: record.shape,
    };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Control closure BFS
// ---------------------------------------------------------------------------

function buildControlClosure(entryUri: string): { graph: MemeGraph; topoUris: string[]; violations: string[][]; grammar: GrammarRules | undefined } {
  // Phase 2: load grammar rules from lares/grammars/memetic-wikitext.md before the walk.
  // Falls back to built-in patterns when the grammar carrier is absent (bootstrap safety net).
  const grammar = loadGrammarRules() ?? undefined;

  const graph = new MemeGraph();
  const queue: string[] = [entryUri];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const uri = queue.shift()!;
    if (visited.has(uri)) continue;
    visited.add(uri);

    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri, grammar);
      if (meme) graph.addMeme(meme);
    }

    for (const edge of graph.edgesOut(uri, "control")) {
      if (edge.role === "implements") continue;
      if (!visited.has(edge.toUri)) queue.push(edge.toUri);
    }
  }

  const topoUris = graph.topologicalSort(visited, "control");
  const violations = graph.detectCycles(["control"]);
  return { graph, topoUris, violations, grammar };
}

// Schema: lar:///ha.ka.ba/api/v0.1/lararium/modules/node-host
// Known interface URIs loaded in Phase 1 before index construction
const INTERFACE_URIS = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant",
];

function loadInterfaces(graph: MemeGraph, grammar?: GrammarRules): void {
  for (const uri of INTERFACE_URIS) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri, grammar);
      if (meme) graph.addMeme(meme);
    }
  }
}

// ---------------------------------------------------------------------------
// Carrier index walker — walks all of lares/, filtered by .laresignore
// ---------------------------------------------------------------------------

function loadIgnorePatterns(): RegExp[] {
  const ignoreFile = join(LARES_ROOT, ".laresignore");
  if (!existsSync(ignoreFile)) return [];
  return readFileSync(ignoreFile, "utf8")
    .split("\n")
    .map((l: string) => l.replace(/#.*$/, "").trim())
    .filter(Boolean)
    .map((pattern: string) => {
      // Convert glob-like pattern to RegExp:
      // trailing / → matches directory segment anywhere in path
      // *.ext → matches filename with that extension
      // plain name → exact filename match or path segment
      const anchored = pattern.endsWith("/");
      const core = pattern.replace(/\/$/, "");
      const escaped = core.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
      return anchored
        ? new RegExp(`(^|/)${escaped}(/|$)`)
        : new RegExp(`(^|/)${escaped}$`);
    });
}

function* walkLares(dir: string, ignorePatterns: RegExp[], laresRoot: string): Iterable<string> {
  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    if (entry.startsWith(".")) continue; // skip dotfiles/dotdirs
    const full = join(dir, entry);
    const rel = relative(laresRoot, full).replace(/\\/g, "/");
    if (ignorePatterns.some((re) => re.test(rel))) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walkLares(full, ignorePatterns, laresRoot);
    else if (entry.endsWith(".md")) yield full;
  }
}

function* iterSourceCarrierPaths(): Iterable<string> {
  const ignorePatterns = loadIgnorePatterns();
  yield* walkLares(LARES_ROOT, ignorePatterns, LARES_ROOT);
}

export function compileCarrierIndex(): CarrierRecord[] {
  const records: CarrierRecord[] = [];
  for (const absPath of iterSourceCarrierPaths()) {
    try {
      const relPath = relative(LARES_ROOT, absPath).replace(/\\/g, "/");
      const uri = laresRelPathToLarUri(relPath);
      records.push(readCarrier(uri));
    } catch { continue; }
  }
  return records;
}

// ---------------------------------------------------------------------------
// Public runtime API
// ---------------------------------------------------------------------------

export interface LarariumRuntime {
  readResource(uri: string): string;
  readCarrier(uri: string): CarrierRecord;
  compileBoot(): BootArtifact;
  compileBootReceipt(artifact: BootArtifact): Promise<BootReceipt>;
  // compileCarrierIndex intentionally absent — filesystem scan is a build-time
  // seeding tool, not a store query. Use compileCarrierIndex() from node-host directly.
}

export function createLarariumRuntime(_opts?: { writeback?: boolean }): LarariumRuntime {
  return {
    readResource: readLarResource,
    readCarrier,

    compileBoot(): BootArtifact {
      const { graph, topoUris, violations, grammar } = buildControlClosure(ENTRY_URI);
      loadInterfaces(graph, grammar);
      return compileBoot(graph, topoUris, violations);
    },

    compileBootReceipt,
  };
}
