/**
 * Browser host for lararium-core.
 *
 * Two boot modes:
 *   snapshot  — hydrate from an embedded or fetched JSON bundle (offline-capable)
 *   sync      — fetch a bundle from a URL, then merge with any locally available data
 *
 * No Node APIs. No MCP SDK. No fs/path/process.
 * This module is the lararium-web host adapter — it does what lararium-node does
 * for the file system, but for the browser.
 */

import {
  resolveLarUri,
  parseCarrier,
  parsePranalaEdges,
  MemeGraph,
  makeMemeHash,
  type CarrierRecord,
  type LarResolution,
} from "@lararium/core";

// ---------------------------------------------------------------------------
// Snapshot format — produced by lararium-node's snapshot builder
// ---------------------------------------------------------------------------

export interface LarSnapshot {
  /** Snapshot format version */
  version: 1;
  /** ISO timestamp when the snapshot was compiled */
  compiledAt: string;
  /** Carrier memes: uri → { text, laresRelPath } */
  memes: Record<string, { text: string; laresRelPath: string }>;
  /**
   * Pre-computed room filter results (TW5 engine, Node build-time).
   * roomId → ordered list of meme URIs matching the room's filter expression.
   * The browser can use these directly OR re-filter dynamically via
   * tw-filter-browser.ts (same TW5 grammar, pre-built browser bundle).
   */
  rooms?: Record<string, string[]>;
  /** Total meme count in the minimal boot closure */
  bootMemeCount?: number;
}

// ---------------------------------------------------------------------------
// Browser runtime
// ---------------------------------------------------------------------------

export interface BrowserRuntime {
  /** All carrier records hydrated from the snapshot */
  carriers: CarrierRecord[];
  /** Resolve a lar:/// URI (pure — no I/O) */
  resolve(uri: string): LarResolution;
  /** Read carrier text from the snapshot */
  readText(uri: string): string;
  /** Read and parse a carrier from the snapshot */
  readCarrier(uri: string): CarrierRecord;
  /** The populated MemeGraph (read-only after boot) */
  graph: MemeGraph;
}

export function createBrowserRuntime(snapshot: LarSnapshot): BrowserRuntime {
  const textByUri = new Map<string, string>();
  const recordByUri = new Map<string, CarrierRecord>();
  const graph = new MemeGraph();

  // Hydrate all memes from snapshot
  for (const [uri, { text, laresRelPath }] of Object.entries(snapshot.memes)) {
    textByUri.set(uri, text);
    const record = parseCarrier(uri, text);
    recordByUri.set(uri, record);

    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(text);
    const edges = parsePranalaEdges(uri, text);

    graph.addMeme({
      uri,
      laresRelPath,
      contentHash: makeMemeHash(uri, fileBytes),
      metadata: record.metadata,
      edgesOut: edges,
      virtual: false,
      exists: true,
      shape: record.shape,
    });
  }

  return {
    carriers: [...recordByUri.values()],
    graph,
    resolve: resolveLarUri,
    readText(uri) {
      const text = textByUri.get(uri);
      if (!text) throw new Error(`${uri} not found in snapshot`);
      return text;
    },
    readCarrier(uri) {
      const record = recordByUri.get(uri);
      if (!record) throw new Error(`${uri} not found in snapshot`);
      return record;
    },
  };
}

// ---------------------------------------------------------------------------
// Snapshot loader — fetch from URL or use embedded bundle
// ---------------------------------------------------------------------------

export async function loadSnapshotFromUrl(url: string): Promise<LarSnapshot> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch snapshot: ${resp.status} ${resp.statusText}`);
  return resp.json() as Promise<LarSnapshot>;
}

export async function bootFromUrl(url: string): Promise<BrowserRuntime> {
  const snapshot = await loadSnapshotFromUrl(url);
  return createBrowserRuntime(snapshot);
}
