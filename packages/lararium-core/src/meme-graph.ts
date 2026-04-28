/**
 * MemeGraph — adjacency structure over reachable memes in the carrier DAG.
 *
 * Pure in-memory structure. I/O belongs to lararium-node.
 */

import { type PranaEdge } from "./pranala-parser.js";
import { type CarrierShape } from "./carrier.js";
import { utf8Bytes, sha256Hex, defaultCryptoProvider } from "./crypto.js";

// ---------------------------------------------------------------------------
// Meme
// ---------------------------------------------------------------------------

export interface Meme {
  uri: string;
  /** Relative path within lares/ — null for virtual memes. */
  laresRelPath: string | null;
  contentHash: string;
  metadata: Record<string, unknown>;
  edgesOut: PranaEdge[];
  virtual: boolean;
  exists: boolean;
  shape: CarrierShape | null;
}

export function memeImplements(meme: Meme): string[] {
  return meme.edgesOut
    .filter((e) => e.role === "implements" && e.family === "control")
    .map((e) => e.toUri);
}

export async function makeMemeHash(uri: string, fileBytes: Uint8Array | null): Promise<string> {
  const content = fileBytes ? new TextDecoder().decode(fileBytes) : "virtual";
  const payload = uri + ":" + content;
  return "sha256:" + await sha256Hex(utf8Bytes(payload), defaultCryptoProvider);
}

// ---------------------------------------------------------------------------
// DeclaredUnresolved
// ---------------------------------------------------------------------------

export interface DeclaredUnresolved {
  uri: string;
  edge: PranaEdge;
  severity: "error" | "warning" | "info";
}

export function declaredUnresolvedFromEdge(edge: PranaEdge): DeclaredUnresolved {
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
// MemeGraph
// ---------------------------------------------------------------------------

export class MemeGraph {
  readonly memes = new Map<string, Meme>();
  // adjacency.get(family)?.get(fromUri) → PranaEdge[]
  private readonly adjacency = new Map<string, Map<string, PranaEdge[]>>();

  addMeme(meme: Meme): void {
    this.memes.set(meme.uri, meme);
    for (const edge of meme.edgesOut) {
      let familyMap = this.adjacency.get(edge.family);
      if (!familyMap) { familyMap = new Map(); this.adjacency.set(edge.family, familyMap); }
      let list = familyMap.get(edge.fromUri);
      if (!list) { list = []; familyMap.set(edge.fromUri, list); }
      list.push(edge);
    }
  }

  successors(uri: string, family: string): string[] {
    return (this.adjacency.get(family)?.get(uri) ?? []).map((e) => e.toUri);
  }

  edgesOut(uri: string, family?: string): PranaEdge[] {
    const meme = this.memes.get(uri);
    if (!meme) return [];
    return family ? meme.edgesOut.filter((e) => e.family === family) : [...meme.edgesOut];
  }

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
        for (const target of this.successors(uri, family)) visit(target);
        stackPath.pop();
        color.set(uri, BLACK);
      };

      for (const fromUri of (this.adjacency.get(family)?.keys() ?? [])) {
        if (!color.has(fromUri)) visit(fromUri);
      }
    }
    return violations;
  }

  topologicalSort(uriSet: Iterable<string>, family = "control"): string[] {
    const nodes = new Set(uriSet);
    const inDegree = new Map<string, number>();
    const successorsMap = new Map<string, string[]>();

    for (const uri of nodes) { inDegree.set(uri, 0); successorsMap.set(uri, []); }
    for (const uri of nodes) {
      for (const target of this.successors(uri, family)) {
        if (nodes.has(target)) {
          inDegree.set(target, (inDegree.get(target) ?? 0) + 1);
          successorsMap.get(uri)!.push(target);
        }
      }
    }

    const queue: string[] = [];
    for (const [uri, deg] of inDegree) { if (deg === 0) queue.push(uri); }

    const result: string[] = [];
    while (queue.length > 0) {
      const uri = queue.shift()!;
      result.push(uri);
      for (const target of (successorsMap.get(uri) ?? [])) {
        const newDeg = (inDegree.get(target) ?? 1) - 1;
        inDegree.set(target, newDeg);
        if (newDeg === 0) queue.push(target);
      }
    }

    // cycle residue appended in stable order
    const resultSet = new Set(result);
    const remaining = [...nodes].filter((u) => !resultSet.has(u)).sort();
    result.push(...remaining);
    return result;
  }


  declaredUnresolved(): DeclaredUnresolved[] {
    const RANK: Record<string, number> = { error: 2, warning: 1, info: 0 };
    const best = new Map<string, DeclaredUnresolved>();
    for (const meme of this.memes.values()) {
      for (const edge of meme.edgesOut) {
        if (!this.memes.has(edge.toUri)) {
          const du = declaredUnresolvedFromEdge(edge);
          const existing = best.get(du.uri);
          if (!existing || (RANK[du.severity] ?? 0) > (RANK[existing.severity] ?? 0)) {
            best.set(du.uri, du);
          }
        }
      }
    }
    return [...best.values()].sort((a, b) => {
      const rd = (RANK[b.severity] ?? 0) - (RANK[a.severity] ?? 0);
      return rd !== 0 ? rd : a.uri.localeCompare(b.uri);
    });
  }
}
