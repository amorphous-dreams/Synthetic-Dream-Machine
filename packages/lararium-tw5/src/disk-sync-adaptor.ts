/**
 * LarDiskProjector — STUB.
 *
 * Intent (pending redesign):
 *   Projects LarTiddlerStore changes to lares/ files on disk.
 *   Subscribes directly to the Automerge store so it receives all changes with
 *   their ChangeOrigin. The server is a peer; it persists every change regardless
 *   of origin. The file watcher (when wired) checks `projector.writing` to avoid
 *   echo-looping its own writes back through the store.
 *
 * Intended flow (server peer, redesign target):
 *   Local edit:   TW5 wiki → store.put → [this] → lares/ file
 *   Remote edit:  Automerge sync → store.put → [this] → lares/ file
 *   Human edit:   lares/ file → file watcher → (writing.has? skip) → store.put
 *
 * Write law (to preserve in redesign):
 *   - Only lar: URI records are written; system tiddlers ($:/) are skipped.
 *   - Carrier parents: write carrier-text field (raw carrier format).
 *   - Ahu child slots: readFileSync parent → replaceCarrierSlot → write.
 *   - Path traversal guard: resolved path must stay within laresRoot.
 *   - Writes debounce per parent URI to coalesce rapid collaborative edits.
 */

import type { LarTiddlerStore, LarTiddlerChange, MemeProjection } from "@lararium/core";

// ---------------------------------------------------------------------------
// LarDiskProjector — stub
// ---------------------------------------------------------------------------

export class LarDiskProjector implements MemeProjection {
  /**
   * URIs currently pending a disk write.
   * File watcher must check `writing.has(uri)` before feeding a change to the
   * store — if present, the watcher sees its own write and must skip.
   */
  readonly writing = new Set<string>();

  constructor(
    /** Absolute path to lares/ root directory. */
    private readonly laresRoot: string,
    /** Debounce delay in ms. */
    private readonly debounceMs = 1000,
  ) {
    void this.laresRoot;
    void this.debounceMs;
  }

  /** Called by MemeProvider or store.subscribe for each store change. */
  onUriChanged(_change: LarTiddlerChange): void {
    // stub — disk write redesign pending
  }

  /** Subscribe to a LarTiddlerStore and start projecting. Returns unsubscribe fn. */
  start(_store: LarTiddlerStore): () => void {
    // stub — disk write redesign pending
    return () => this.stop();
  }

  stop(): void {
    this.writing.clear();
  }
}

// ---------------------------------------------------------------------------
// LarDiskSyncAdaptor — backward-compat alias.
// @deprecated Use LarDiskProjector with store.subscribe() instead.
// ---------------------------------------------------------------------------

/** @deprecated */
export const LarDiskSyncAdaptor = LarDiskProjector;
