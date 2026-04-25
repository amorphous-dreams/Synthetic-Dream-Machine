/**
 * File-backed Lararium host for Node.js.
 *
 * Responsibility: walk the lares/ tree, load carrier files, populate MemeGraph,
 * and drive the compiler. No carrier semantics live here — only I/O.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";

import {
  resolveLarUri,
  parseCarrier,
  parsePranalaEdges,
  MemeGraph,
  Meme,
  makeMemeHash,
  laresRelPathToLarUri,
  compileMinimalBoot,
  compileFullBoot,
  compileBootReceipt,
  ENTRY_URI,
  type BootArtifact,
  type BootReceipt,
  type CarrierRecord,
} from "@lararium/core";

// ---------------------------------------------------------------------------
// Locate lares/ root relative to this file's location in packages/lararium-node/
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// packages/lararium-node/dist/ → ../../lares/
export const LARES_ROOT = resolve(__dirname, "..", "..", "..", "lares");

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

function loadMeme(uri: string): Meme | null {
  let resolution;
  try { resolution = resolveLarUri(uri); } catch { return null; }

  if (resolution.virtual) {
    return { uri, laresRelPath: null, contentHash: makeMemeHash(uri, null), metadata: {}, edgesOut: [], virtual: true, exists: false, shape: null };
  }

  if (!resolution.laresRelPath) return null;
  const abs = join(LARES_ROOT, resolution.laresRelPath);

  if (!existsSync(abs)) {
    return { uri, laresRelPath: resolution.laresRelPath, contentHash: makeMemeHash(uri, null), metadata: {}, edgesOut: [], virtual: false, exists: false, shape: null };
  }

  try {
    const fileBytes = readFileSync(abs);
    const text = fileBytes.toString("utf8");
    const record = parseCarrier(uri, text);
    const edges = parsePranalaEdges(uri, text);
    return {
      uri,
      laresRelPath: resolution.laresRelPath,
      contentHash: makeMemeHash(uri, fileBytes),
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

function buildControlClosure(entryUri: string): { graph: MemeGraph; topoUris: string[]; violations: string[][] } {
  const graph = new MemeGraph();
  const queue: string[] = [entryUri];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const uri = queue.shift()!;
    if (visited.has(uri)) continue;
    visited.add(uri);

    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri);
      if (meme) graph.addMeme(meme);
    }

    for (const edge of graph.edgesOut(uri, "control")) {
      if (edge.role === "implements") continue;
      if (!visited.has(edge.toUri)) queue.push(edge.toUri);
    }
  }

  const topoUris = graph.topologicalSort(visited, "control");
  const violations = graph.detectCycles(["control"]);
  return { graph, topoUris, violations };
}

// Known interface URIs loaded in Phase 1 before index construction
const INTERFACE_URIS = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci",
  "lar:///ha.ka.ba/api/v0.1/pono/invariant",
];

function loadInterfaces(graph: MemeGraph): void {
  for (const uri of INTERFACE_URIS) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri);
      if (meme) graph.addMeme(meme);
    }
  }
}

// ---------------------------------------------------------------------------
// Carrier index walker
// ---------------------------------------------------------------------------

function* iterSourceCarrierPaths(): Iterable<string> {
  const apiRoot = join(LARES_ROOT, "ha-ka-ba", "api", "v0.1");
  yield* walkMd(apiRoot);
  for (const capsRoot of ["AGENTS", "LARES"]) {
    const p = join(LARES_ROOT, `${capsRoot}.md`);
    if (existsSync(p)) yield p;
  }
}

function* walkMd(dir: string): Iterable<string> {
  const entries = readdirSync(dir).sort();
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walkMd(full);
    else if (entry.endsWith(".md")) yield full;
  }
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
// Full boot closure (adds relation expansion + carrier index)
// ---------------------------------------------------------------------------

function buildFullClosure(graph: MemeGraph, topoUris: string[]): { additionalUris: string[] } {
  const additional = graph.oneHopRelation(topoUris);
  for (const uri of additional) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri);
      if (meme) graph.addMeme(meme);
    }
  }

  const indexUris = new Set(compileCarrierIndex().map((r) => r.uri));
  const topoSet = new Set([...topoUris, ...additional]);
  const indexAdditional = [...indexUris].filter((u) => !topoSet.has(u));
  for (const uri of indexAdditional.sort()) {
    if (!graph.memes.has(uri)) {
      const meme = loadMeme(uri);
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
  compileBootReceipt(artifact: BootArtifact): BootReceipt;
  compileCarrierIndex(): CarrierRecord[];
}

export function createLarariumRuntime(_opts?: { writeback?: boolean }): LarariumRuntime {
  return {
    readResource: readLarResource,
    readCarrier,
    compileCarrierIndex,

    compileMinimalBoot(): BootArtifact {
      const { graph, topoUris, violations } = buildControlClosure(ENTRY_URI);
      loadInterfaces(graph);
      return compileMinimalBoot(graph, topoUris, violations);
    },

    compileFullBoot(): BootArtifact {
      const { graph, topoUris, violations } = buildControlClosure(ENTRY_URI);
      const { additionalUris } = buildFullClosure(graph, topoUris);
      loadInterfaces(graph);
      return compileFullBoot(graph, topoUris, additionalUris, violations);
    },

    compileBootReceipt,
  };
}
