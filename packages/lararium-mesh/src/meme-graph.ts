/**
 * meme-graph — pure adjacency structure over reachable memes in the lares DAG.
 *
 * Isomorphic: no fs/path/DOM imports. I/O belongs to lararium-node.
 * No CarrierShape dependency — shape lives in the projection layer.
 * MemeRating derived at ingest boundary and stored on MemeRecord, not on Meme.
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-graph
 */

import type { PranalaEdge } from "./pranala-parser.js";
import { utf8Bytes, sha256Hex, defaultCryptoProvider } from "./crypto.js";

// ---------------------------------------------------------------------------
// MemeRating — derived at ingest, stored on MemeRecord
// ---------------------------------------------------------------------------

/**
 * Rating assigned at the ingest boundary when a meme is put into the store.
 * Never stored on the graph node — the graph operates on `Meme` (structural),
 * not on ingest-boundary judgments.
 *
 * "kapu"  — restricted; access control applies; do not traverse without auth check
 * "ano"   — anomalous; failed one or more validation rules at ingest
 * "meme"  — standard carrier; passes all checks; default for valid corpus memes
 * "data"  — pure data tiddler; no control/reaction edges expected or validated
 * "noise" — unrecognized structure; skipped by graph traversal
 */
export type MemeRating = "kapu" | "ano" | "meme" | "data" | "noise";

// ---------------------------------------------------------------------------
// MemeRecord — ingest boundary output (replaces CarrierRecord)
// ---------------------------------------------------------------------------

/**
 * Output of the ingest boundary: a meme validated and rated, ready for the graph.
 * Immutable by convention — the graph receives it as a snapshot.
 */
export interface MemeRecord {
  readonly uri:        string;
  readonly metadata:   Record<string, unknown>;
  readonly implements: readonly string[];
  readonly edges:      readonly PranalaEdge[];
  readonly rating:     MemeRating;
}

// ---------------------------------------------------------------------------
// Meme — graph node (pure structure, no I/O, no shape)
// ---------------------------------------------------------------------------

export interface Meme {
  uri:          string;
  /** Relative path within lares/memes/ — null for virtual or hostful memes. */
  laresRelPath: string | null;
  contentHash:  string;
  metadata:     Record<string, unknown>;
  edgesOut:     PranalaEdge[];
  virtual:      boolean;
  exists:       boolean;
}

// ---------------------------------------------------------------------------
// DeclaredUnresolved — edge that references a URI not present in the graph
// ---------------------------------------------------------------------------

export interface DeclaredUnresolved {
  uri:      string;
  edge:     PranalaEdge;
  severity: "error" | "warning" | "info";
}

export function declaredUnresolvedFromEdge(edge: PranalaEdge): DeclaredUnresolved {
  let severity: "error" | "warning" | "info";
  if (edge.family === "control") {
    severity = edge.role === "implements" ? "info" : "error";
  } else if (edge.family === "relation") {
    severity = "warning";
  } else {
    severity = "info";
  }
  return { uri: edge.toUri, edge, severity };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the interface URIs this meme composes (control:implements edges). */
export function memeImplements(meme: Meme): string[] {
  return meme.edgesOut
    .filter((e) => e.role === "implements" && e.family === "control")
    .map((e) => e.toUri);
}

/** Returns the single parent class URI (control:extends edge), or undefined if absent. */
export function memeExtends(meme: Meme): string | undefined {
  return meme.edgesOut
    .find((e) => e.role === "extends" && e.family === "control")
    ?.toUri;
}

/**
 * Compute a stable content hash for a meme.
 * Uses the URI + raw bytes as the preimage so the hash identifies both location and content.
 * null bytes → virtual meme (no disk content).
 */
export async function makeMemeHash(uri: string, fileBytes: Uint8Array | null): Promise<string> {
  const content = fileBytes ? new TextDecoder().decode(fileBytes) : "virtual";
  const payload = uri + ":" + content;
  return "sha256:" + await sha256Hex(utf8Bytes(payload), defaultCryptoProvider);
}

// ---------------------------------------------------------------------------
// MemeGraph — pure adjacency structure
// ---------------------------------------------------------------------------

export class MemeGraph {
  readonly memes = new Map<string, Meme>();

  // adjacency.get(family)?.get(fromUri) → PranalaEdge[]
  private readonly adjacency = new Map<string, Map<string, PranalaEdge[]>>();

  // Reverse index: interfaceUri → Set<memeUri> (for memesByInterface — control:implements)
  private readonly _byInterface = new Map<string, Set<string>>();
  // Reverse index: parentUri → Set<memeUri> (for memesByParent — control:extends)
  private readonly _byParent = new Map<string, Set<string>>();

  addMeme(meme: Meme): void {
    this.memes.set(meme.uri, meme);
    for (const edge of meme.edgesOut) {
      // Forward adjacency
      let familyMap = this.adjacency.get(edge.family);
      if (!familyMap) { familyMap = new Map(); this.adjacency.set(edge.family, familyMap); }
      let list = familyMap.get(edge.fromUri);
      if (!list) { list = []; familyMap.set(edge.fromUri, list); }
      list.push(edge);

      // Reverse implements index (control:implements → interface conformance)
      if (edge.family === "control" && edge.role === "implements") {
        let set = this._byInterface.get(edge.toUri);
        if (!set) { set = new Set(); this._byInterface.set(edge.toUri, set); }
        set.add(meme.uri);
      }
      // Reverse extends index (control:extends → single class parent)
      if (edge.family === "control" && edge.role === "extends") {
        let set = this._byParent.get(edge.toUri);
        if (!set) { set = new Set(); this._byParent.set(edge.toUri, set); }
        set.add(meme.uri);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Forward traversal
  // ---------------------------------------------------------------------------

  successors(uri: string, family: string): string[] {
    return (this.adjacency.get(family)?.get(uri) ?? []).map((e) => e.toUri);
  }

  edgesOut(uri: string, family?: string): PranalaEdge[] {
    const meme = this.memes.get(uri);
    if (!meme) return [];
    return family ? meme.edgesOut.filter((e) => e.family === family) : [...meme.edgesOut];
  }

  // ---------------------------------------------------------------------------
  // Graph queries
  // ---------------------------------------------------------------------------

  /**
   * Expand a set of control URIs by one hop in the `relation` family.
   * Returns the input set PLUS all relation-adjacent URIs (one hop only).
   */
  oneHopRelation(controlUris: Iterable<string>): Set<string> {
    const seen = new Set(controlUris);
    const additional = new Set<string>();
    for (const uri of seen) {
      for (const target of this.successors(uri, "relation")) {
        if (!seen.has(target)) { additional.add(target); seen.add(target); }
      }
    }
    return additional;
  }

  /**
   * All memes whose `control:implements` edge targets the given interface URI.
   * Returns an empty set if no meme implements the interface.
   */
  memesByInterface(interfaceUri: string): ReadonlySet<string> {
    return this._byInterface.get(interfaceUri) ?? new Set();
  }

  /**
   * All memes whose `control:extends` edge targets the given parent URI.
   * Returns direct children only — use `allTransitiveDeps` for full inheritance chains.
   */
  memesByParent(parentUri: string): ReadonlySet<string> {
    return this._byParent.get(parentUri) ?? new Set();
  }

  /**
   * Full transitive closure of successors from `rootUri` over `family` edges.
   * Returns all URIs reachable (excluding the root itself unless it is in a cycle).
   */
  allTransitiveDeps(rootUri: string, family = "control"): Set<string> {
    const visited = new Set<string>();
    const stack = [rootUri];
    while (stack.length > 0) {
      const uri = stack.pop()!;
      for (const next of this.successors(uri, family)) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    return visited;
  }

  /**
   * Resolved closure: all URIs transitively reachable from any of `rootUris`
   * via `control` edges, INCLUDING the roots, filtered to memes that exist.
   */
  resolvedClosure(rootUris: Iterable<string>): Set<string> {
    const result = new Set<string>();
    for (const root of rootUris) {
      result.add(root);
      for (const dep of this.allTransitiveDeps(root, "control")) {
        result.add(dep);
      }
    }
    return result;
  }

  /**
   * Topological sort of a subset of nodes (`nodeSet`) over edges in `family`.
   * Uses Kahn's algorithm. Returns nodes in dependency order (roots first).
   * Any cycles in the family will cause affected nodes to be omitted from the result;
   * call `detectCycles()` separately to surface them.
   */
  topologicalSort(nodeSet: ReadonlySet<string>, family: string): string[] {
    // Build in-degree map within the subset
    const inDegree = new Map<string, number>();
    for (const uri of nodeSet) inDegree.set(uri, 0);

    for (const uri of nodeSet) {
      for (const next of this.successors(uri, family)) {
        if (nodeSet.has(next)) {
          inDegree.set(next, (inDegree.get(next) ?? 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [uri, deg] of inDegree) {
      if (deg === 0) queue.push(uri);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const uri = queue.shift()!;
      result.push(uri);
      for (const next of this.successors(uri, family)) {
        if (!nodeSet.has(next)) continue;
        const newDeg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) queue.push(next);
      }
    }

    return result;
  }

  /**
   * All edges in the graph that point to URIs not present in this graph.
   * The severity follows `declaredUnresolvedFromEdge` rules:
   *   control (non-implements) → "error", relation → "warning", others → "info".
   */
  declaredUnresolved(): DeclaredUnresolved[] {
    const result: DeclaredUnresolved[] = [];
    for (const meme of this.memes.values()) {
      for (const edge of meme.edgesOut) {
        if (!this.memes.has(edge.toUri)) {
          result.push(declaredUnresolvedFromEdge(edge));
        }
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Cycle detection
  // ---------------------------------------------------------------------------

  /**
   * DFS cycle detection over the given families (default: all families in the graph).
   * Returns an array of cycle paths — each path is the list of URIs forming the cycle,
   * with the first URI repeated at the end: [A, B, C, A].
   */
  detectCycles(families?: string[]): string[][] {
    const fams = families ?? [...this.adjacency.keys()];
    const violations: string[][] = [];

    for (const family of fams) {
      const WHITE = 0, GRAY = 1, BLACK = 2;
      const color = new Map<string, number>();
      const stackPath: string[] = [];

      const visit = (uri: string): void => {
        if (color.get(uri) === GRAY) {
          const cycleStart = stackPath.indexOf(uri);
          violations.push([...stackPath.slice(cycleStart), uri]);
          return;
        }
        if (color.get(uri) === BLACK) return;
        color.set(uri, GRAY);
        stackPath.push(uri);
        for (const next of this.successors(uri, family)) {
          visit(next);
        }
        stackPath.pop();
        color.set(uri, BLACK);
      };

      for (const uri of this.memes.keys()) {
        if (!color.has(uri)) visit(uri);
      }
    }

    return violations;
  }
}

