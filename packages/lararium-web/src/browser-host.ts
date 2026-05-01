/**
 * Browser host for lararium-core — STUB.
 *
 * Intent (pending Automerge-native redesign):
 *   Two boot modes:
 *     snapshot  — hydrate from an embedded or fetched JSON bundle (offline-capable)
 *     sync      — receive meme content from the Automerge peer network (live)
 *
 * No Node APIs. No MCP SDK. No fs/path/process.
 * This module is the lararium-web host adapter — it does what lararium-node does
 * for the file system, but for the browser.
 *
 * Redesign target: replace snapshot-pull model with Automerge doc URL received
 * from <meta name="lararium-meme-store"> and hydrated via automerge-store.ts.
 * The BrowserRuntime interface below expresses the stable surface; implementation
 * will switch from snapshot.json to Automerge doc hydration.
 */

// ---------------------------------------------------------------------------
// Snapshot format — produced by lararium-node's snapshot builder
// (used for offline/embedded mode; live mode uses Automerge doc URL)
// ---------------------------------------------------------------------------

export interface LarSnapshot {
  /** Snapshot format version */
  version: 1;
  /** ISO timestamp when the snapshot was compiled */
  compiledAt: string;
  /** Carrier memes: uri → { text, laresRelPath } */
  memes: Record<string, { text: string; laresRelPath: string | null }>;
  /**
   * Pre-computed room filter results (TW5 engine, Node build-time).
   * roomId → ordered list of meme URIs matching the room's filter expression.
   */
  rooms?: Record<string, string[]>;
  /** Total meme count in the minimal boot closure */
  bootMemeCount?: number;
}

// ---------------------------------------------------------------------------
// Browser runtime interface
// ---------------------------------------------------------------------------

export interface BrowserRuntime {
  /** Resolve a lar:/// URI (pure — no I/O) */
  resolve(uri: string): { laresRelPath: string | null; virtual: boolean };
  /** Read carrier text from the hydrated store */
  readText(uri: string): string;
  /** The Automerge doc URL (if live), or null (if snapshot-only) */
  memeStoreUrl: string | null;
}

// ---------------------------------------------------------------------------
// Stubs — pending Automerge-native redesign
// ---------------------------------------------------------------------------

/** @stub Hydrate a BrowserRuntime from a pre-fetched snapshot object. */
export async function createBrowserRuntime(_snapshot: LarSnapshot): Promise<BrowserRuntime> {
  throw new Error("createBrowserRuntime: not implemented — pending Automerge-native browser host redesign");
}

/** @stub Fetch a snapshot JSON from a URL and hydrate a BrowserRuntime. */
export async function loadSnapshotFromUrl(_url: string): Promise<LarSnapshot> {
  throw new Error("loadSnapshotFromUrl: not implemented — pending Automerge-native browser host redesign");
}

/** @stub Fetch snapshot from URL and boot a BrowserRuntime. */
export async function bootFromUrl(_url: string): Promise<BrowserRuntime> {
  throw new Error("bootFromUrl: not implemented — pending Automerge-native browser host redesign");
}
