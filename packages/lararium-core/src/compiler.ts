/**
 * Hydration closure compiler — pure graph operations.
 *
 * The host (lararium-node) is responsible for loading memes into the graph.
 * These functions operate on a populated MemeGraph and return serialisable artifacts.
 */

import { type MemeGraph, memeImplements } from "./meme-graph.js";
import { type DigestProvider, defaultCryptoProvider, sha256Hex, canonicalJsonBytes } from "./crypto.js";
import { type PranaEdge, validatePranaEdge, type PranaEdgeViolation } from "./pranala-parser.js";

export const ENTRY_URI = "lar:///AGENTS";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClosureEntry {
  uri: string;
  laresRelPath: string | null;
  kind: string;
  virtual: boolean;
  exists: boolean;
  role: string;
  hydrationSocket: string;
  implements: string[];
  contentHash: string;
  depth: number;
  /** Operator-set confidence scalar from carrier TOML #iam block. 0 if absent. */
  confidence: number;
  /** Operator-assigned confidence register code (e.g. "CS", "GR", "OS", "US", "DS", "S"). */
  register: string;
  /** Operator-set observability/interoperability score. 0 if absent. */
  manaoio: number;
  /** Operator-set mana (epistemic authority weight). 0 if absent. */
  mana: number;
  /** Operator-set manao (relational trust weight). 0 if absent. */
  manao: number;
}

export interface ValidationResult {
  allResolved: boolean;
  allExist: boolean;
  missing: string[];
  dagViolations: string[][];
  declaredUnresolved: { uri: string; severity: string; family: string }[];
  edgeViolations: PranaEdgeViolation[];
}

/** Serialised edge record — subset of PranaEdge safe for JSON transport. */
export interface EdgeRecord {
  readonly fromUri:    string;
  readonly fromSocket: string;
  readonly toUri:      string;
  readonly family:     string;
  readonly role:       string | null;
}

export interface BootArtifact {
  artifact: "boot";
  compiledAt: string;
  entry: string;
  closure: ClosureEntry[];
  memeCount: number;
  locusCount: number;
  interfaceIndex: Record<string, number | string[]>;
  invariantIndex: Record<string, number | string[]>;
  validation: ValidationResult;
  edgeCount?: number;
  pranalaEdges?: EdgeRecord[];
  /** kumu type definitions collected from the boot closure — Phase 3 widget tree. */
  kumuDefs?: import("./ast.js").KumuDef[];
}

export interface BootReceipt {
  artifact: "boot-receipt";
  compiledAt: string;
  entry: string;
  mode: string;
  memeCount: number;
  locusCount: number;
  edgeCount: number;
  sha256: string;
  validation: { allResolved: boolean; allExist: boolean; missing: string[]; dagViolations: string[][]; edgeViolationCount: number; edgeErrors: number };
  compactionNotes: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDepthMap(graph: MemeGraph, topoUris: string[]): Map<string, number> {
  const depthMap = new Map<string, number>();
  if (topoUris.length > 0) depthMap.set(topoUris[0]!, 0);
  for (const uri of topoUris) {
    const depth = depthMap.get(uri) ?? 0;
    for (const target of graph.successors(uri, "control")) {
      depthMap.set(target, Math.max(depthMap.get(target) ?? 0, depth + 1));
    }
  }
  return depthMap;
}

function buildSocketMap(graph: MemeGraph, topoUris: string[]): Map<string, string> {
  const socketMap = new Map<string, string>();
  if (topoUris.length > 0) socketMap.set(topoUris[0]!, "entry");
  for (const uri of topoUris) {
    for (const edge of graph.edgesOut(uri, "control")) {
      if (!socketMap.has(edge.toUri)) socketMap.set(edge.toUri, edge.fromSocket);
    }
  }
  return socketMap;
}

function closureEntry(graph: MemeGraph, uri: string, depth: number, hydrationSocket: string): ClosureEntry {
  const meme = graph.memes.get(uri);
  const num = (key: string) => typeof meme?.metadata[key] === "number" ? (meme.metadata[key] as number) : 0;
  if (!meme) {
    return Object.freeze({ uri, laresRelPath: null, kind: "unknown", virtual: false, exists: false, role: "", hydrationSocket, implements: [], contentHash: "", depth, confidence: 0, register: "", manaoio: 0, mana: 0, manao: 0 });
  }
  return Object.freeze({
    uri,
    laresRelPath: meme.laresRelPath,
    kind: meme.virtual ? "caps-virtual" : meme.laresRelPath?.includes("-") ? "tuple-file" : "caps-file",
    virtual: meme.virtual,
    exists: meme.exists,
    role:     (meme.metadata["role"]     as string | undefined) ?? "",
    register: (meme.metadata["register"] as string | undefined) ?? "",
    hydrationSocket,
    implements: memeImplements(meme),
    contentHash: meme.contentHash,
    depth,
    confidence: num("confidence"),
    manaoio:    num("manaoio"),
    mana:       num("mana"),
    manao:      num("manao"),
  });
}

function buildInterfaceIndexes(
  graph: MemeGraph,
  allUris: string[],
): { interfaceIndex: Map<string, string[]>; invariantIndex: Map<string, string[]> } {
  const interfaceIndex = new Map<string, string[]>();
  const invariantIndex = new Map<string, string[]>();
  for (const uri of allUris) {
    const meme = graph.memes.get(uri);
    if (!meme) continue;
    for (const ifaceUri of memeImplements(meme)) {
      let list = interfaceIndex.get(ifaceUri);
      if (!list) { list = []; interfaceIndex.set(ifaceUri, list); }
      list.push(uri);
      if (ifaceUri.includes("invariant")) {
        let ilist = invariantIndex.get(ifaceUri);
        if (!ilist) { ilist = []; invariantIndex.set(ifaceUri, ilist); }
        ilist.push(uri);
      }
    }
  }
  for (const list of interfaceIndex.values()) list.sort();
  for (const list of invariantIndex.values()) list.sort();
  return { interfaceIndex, invariantIndex };
}

function validateClosure(
  closure: ClosureEntry[],
  violations: string[][],
  graph: MemeGraph,
): ValidationResult {
  const missing = closure.filter((e) => !e.exists && !e.virtual).map((e) => e.uri);
  const du = graph.declaredUnresolved()
    .filter((d) => d.severity === "error" || d.severity === "warning")
    .map((d) => ({ uri: d.uri, severity: d.severity, family: d.edge.family }));

  // Family contract validation — runs against all edges in the graph
  const edgeViolations: PranaEdgeViolation[] = [];
  for (const meme of graph.memes.values()) {
    for (const edge of meme.edgesOut) {
      edgeViolations.push(...validatePranaEdge(edge));
    }
  }

  return { allResolved: true, allExist: missing.length === 0, missing, dagViolations: violations, declaredUnresolved: du, edgeViolations };
}

// ---------------------------------------------------------------------------
// Public API — takes a populated MemeGraph
// ---------------------------------------------------------------------------

/**
 * BFS over control edges from entryUri on an already-loaded MemeGraph.
 * Used by the browser runtime (snapshot already loaded) and by lararium-node
 * (graph loaded from file system before calling this).
 *
 * Returns { topoUris, violations } — the same shape as buildControlClosure in node-host,
 * minus the file-loading step.
 */
export function buildBootClosure(
  graph: MemeGraph,
  entryUri: string = ENTRY_URI,
): { topoUris: string[]; violations: string[][] } {
  const queue: string[] = [entryUri];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const uri = queue.shift()!;
    if (visited.has(uri)) continue;
    visited.add(uri);
    for (const edge of graph.edgesOut(uri, "control")) {
      if (edge.role === "implements") continue;
      if (!visited.has(edge.toUri)) queue.push(edge.toUri);
    }
  }

  const topoUris = graph.topologicalSort(visited, "control");
  const violations = graph.detectCycles(["control"]);
  return { topoUris, violations };
}

export function compileBoot(
  graph: MemeGraph,
  topoUris: string[],
  violations: string[][],
  kumuDefs?: import("./ast.js").KumuDef[],
): BootArtifact {
  const socketMap = buildSocketMap(graph, topoUris);
  const depthMap = buildDepthMap(graph, topoUris);

  const closure = topoUris.map((uri) =>
    closureEntry(graph, uri, depthMap.get(uri) ?? 0, socketMap.get(uri) ?? "")
  );

  const allEdges: PranaEdge[] = [];
  for (const meme of graph.memes.values()) allEdges.push(...meme.edgesOut);

  const { interfaceIndex, invariantIndex } = buildInterfaceIndexes(graph, topoUris);

  return {
    artifact: "boot",
    compiledAt: new Date().toISOString(),
    entry: ENTRY_URI,
    closure,
    memeCount: closure.length,
    locusCount: closure.length,
    edgeCount: allEdges.length,
    pranalaEdges: allEdges.map((e) => ({ fromUri: e.fromUri, fromSocket: e.fromSocket, toUri: e.toUri, family: e.family, role: e.role })),
    interfaceIndex: Object.fromEntries([...interfaceIndex.entries()].map(([k, v]) => [k, v.length])),
    invariantIndex: Object.fromEntries([...invariantIndex.entries()].map(([k, v]) => [k, v.length])),
    validation: validateClosure(closure, violations, graph),
    ...(kumuDefs !== undefined && { kumuDefs }),
  };
}

export async function compileBootReceipt(
  artifact: BootArtifact,
  provider: DigestProvider = defaultCryptoProvider,
): Promise<BootReceipt> {
  // Hash stable content only — exclude compiledAt so two compiles of the same
  // graph produce an identical receipt hash (determinism invariant).
  const stablePayload = {
    entry: artifact.entry,
    closure: artifact.closure,
    memeCount: artifact.memeCount,
    edgeCount: artifact.edgeCount ?? 0,
    pranalaEdges: artifact.pranalaEdges ?? [],
    interfaceIndex: artifact.interfaceIndex,
    invariantIndex: artifact.invariantIndex,
  };
  const sha = await sha256Hex(canonicalJsonBytes(stablePayload), provider);
  const v = artifact.validation;
  const modeName = artifact.artifact.replace("boot-", "").replace("-boot", "") || "unknown";

  return {
    artifact: "boot-receipt",
    compiledAt: artifact.compiledAt,
    entry: artifact.entry,
    mode: modeName,
    memeCount: artifact.memeCount,
    locusCount: artifact.locusCount,
    edgeCount: artifact.edgeCount ?? 0,
    sha256: sha,
    validation: {
      allResolved: v.allResolved,
      allExist: v.allExist,
      missing: v.missing,
      dagViolations: v.dagViolations,
      edgeViolationCount: v.edgeViolations.length,
      edgeErrors: v.edgeViolations.filter((e) => e.severity === "error").length,
    },
    compactionNotes: "",
  };
}
