/**
 * File-backed Lararium host for Node.js.
 *
 * Responsibility: walk the lares/ tree, load carrier files, populate MemeGraph,
 * and drive the compiler. No carrier semantics live here — only I/O.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";

import {
  resolveLarUri,
  parseCarrier,
  parsePranalaEdges,
  parseMemeCarrier,
  MemeGraph,
  Meme,
  laresRelPathToLarUri,
  compileMinimalBoot,
  compileFullBoot,
  compileBootReceipt,
  collectKumuDefs,
  ENTRY_URI,
  type BootArtifact,
  type BootReceipt,
  type CarrierRecord,
  type GrammarRules,
  type SigilRule,
  type FamilyRule,
  type KumuDef,
} from "@lararium/core";

// Sync SHA-256 content hash — Node-only. Same algorithm and output format as the
// async makeMemeHash in lararium-core, but synchronous for use in the carrier loader.
function makeMemeHashSync(uri: string, fileBytes: Uint8Array | null): string {
  const content = fileBytes ? new TextDecoder().decode(fileBytes) : "virtual";
  const payload = uri + ":" + content;
  return "sha256:" + createHash("sha256").update(payload, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Locate lares/ root relative to this file's location in packages/lararium-node/
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// packages/lararium-node/dist/ → ../../lares/
export const LARES_ROOT = resolve(__dirname, "..", "..", "..", "lares");

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

  // Extract all ```toml ... ``` fences
  const fences: string[] = [];
  for (const m of text.matchAll(/```toml\s*([\s\S]*?)```/g)) {
    fences.push(m[1] ?? "");
  }
  const combined = fences.join("\n");

  // Minimal TOML array-of-tables parser for [[sigils]] and [[families]]
  function parseArrayOfTables(src: string, tableName: string): Record<string, string>[] {
    const entries: Record<string, string>[] = [];
    const tableRe = new RegExp(`\\[\\[${tableName}\\]\\]([\\s\\S]*?)(?=\\[\\[|$)`, "g");
    for (const m of src.matchAll(tableRe)) {
      const block = m[1] ?? "";
      const entry: Record<string, string> = {};
      for (const line of block.split("\n")) {
        // Match quoted strings first (self-terminating); bare true/false for booleans.
        // No end-of-line anchor — avoids stripping # inside regex patterns stored in TOML strings.
        const kv = line.match(/^\s*([\w_]+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(true|false)(?=[\s#]|$))/);
        if (kv) {
          const key = kv[1]!;
          const val = kv[2] ?? kv[3] ?? kv[4] ?? "";
          entry[key] = val;
        }
      }
      if (Object.keys(entry).length > 0) entries.push(entry);
    }
    return entries;
  }

  const rawSigils = parseArrayOfTables(combined, "sigils");
  const rawFamilies = parseArrayOfTables(combined, "families");

  const sigils: SigilRule[] = rawSigils.map((r): SigilRule => ({
    name: r["name"] ?? "",
    kind: (r["kind"] ?? "edge") as SigilRule["kind"],
    ...(r["inline_pattern"]      !== undefined && { inlinePattern:      r["inline_pattern"] }),
    ...(r["block_pattern"]       !== undefined && { blockPattern:       r["block_pattern"] }),
    ...(r["open_pattern"]        !== undefined && { openPattern:        r["open_pattern"] }),
    ...(r["close_pattern"]       !== undefined && { closePattern:       r["close_pattern"] }),
    ...(r["pattern"]             !== undefined && { pattern:            r["pattern"] }),
    ...(r["default_family"]      !== undefined && { defaultFamily:      r["default_family"] }),
    ...(r["default_propagation"] !== undefined && { defaultPropagation: r["default_propagation"] }),
    ...(r["pragma_pattern"]      !== undefined && { pragmaPattern:      r["pragma_pattern"] }),
    ...(r["alias_for"]           !== undefined && { aliasFor:           r["alias_for"] }),
    ...(r["layer"] === "compile" || r["layer"] === "render" || r["layer"] === "both"
      ? { layer: r["layer"] as "compile" | "render" | "both" } : {}),
  }));

  const families: FamilyRule[] = rawFamilies.map((r) => ({
    name: r["name"] ?? "",
    dagRequired: r["dag_required"] === "true",
    roleRecommended: r["role_recommended"] === "true",
    confidenceBounded: r["confidence_bounded"] === "true",
  }));

  return { sigils, families };
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
// KumuDef collection — walks the loaded meme graph and extracts kumu type
// definitions from carrier text. Called after the closure BFS is complete.
// Each carrier is re-read once here; the AST parse is cheap relative to I/O.
// ---------------------------------------------------------------------------

function collectKumuDefsFromGraph(graph: MemeGraph, uris: string[]): KumuDef[] {
  const result: KumuDef[] = [];
  for (const uri of uris) {
    const meme = graph.memes.get(uri);
    if (!meme?.laresRelPath || !meme.exists) continue;
    const abs = join(LARES_ROOT, meme.laresRelPath);
    try {
      const text = readFileSync(abs, "utf8");
      const ast = parseMemeCarrier(uri, text);
      result.push(...collectKumuDefs(uri, ast));
    } catch { continue; }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Full boot closure (adds relation expansion + carrier index)
// ---------------------------------------------------------------------------

function buildFullClosure(graph: MemeGraph, topoUris: string[], grammar?: GrammarRules): { additionalUris: string[] } {
  const additional = graph.oneHopRelation(topoUris);
  for (const uri of additional) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri, grammar);
      if (meme) graph.addMeme(meme);
    }
  }

  const indexUris = new Set(compileCarrierIndex().map((r) => r.uri));
  const topoSet = new Set([...topoUris, ...additional]);
  const indexAdditional = [...indexUris].filter((u) => !topoSet.has(u));
  for (const uri of indexAdditional.sort()) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri, grammar);
      if (meme) graph.addMeme(meme);
    }
  }

  return { additionalUris: [...[...additional].sort(), ...indexAdditional.sort()] };
}

// ---------------------------------------------------------------------------
// Public runtime API
// ---------------------------------------------------------------------------

export interface LarariumRuntime {
  readResource(uri: string): string;
  readCarrier(uri: string): CarrierRecord;
  compileMinimalBoot(): BootArtifact;
  compileFullBoot(): BootArtifact;
  compileBootReceipt(artifact: BootArtifact): Promise<BootReceipt>;
  compileCarrierIndex(): CarrierRecord[];
}

export function createLarariumRuntime(_opts?: { writeback?: boolean }): LarariumRuntime {
  return {
    readResource: readLarResource,
    readCarrier,
    compileCarrierIndex,

    compileMinimalBoot(): BootArtifact {
      const { graph, topoUris, violations, grammar } = buildControlClosure(ENTRY_URI);
      loadInterfaces(graph, grammar);
      return compileMinimalBoot(graph, topoUris, violations);
    },

    compileFullBoot(): BootArtifact {
      const { graph, topoUris, violations, grammar } = buildControlClosure(ENTRY_URI);
      const { additionalUris } = buildFullClosure(graph, topoUris, grammar);
      loadInterfaces(graph, grammar);
      return compileFullBoot(graph, topoUris, additionalUris, violations);
    },

    compileBootReceipt,
  };
}
