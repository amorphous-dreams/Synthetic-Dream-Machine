/**
 * LarDiskProjector — unidirectional projection: store → lares/ files on disk.
 *
 * The Automerge store IS the mind. Disk files are a projection of it.
 * This projector NEVER reads from disk — that direction belongs to the ingest
 * path (file watcher → store.put).
 *
 * Projection law (Fontany-Fuller-Zelenka):
 *   Disk projection is a RENDER operation, not a string copy.
 *   The TW5 VM (with fakeDOM) re-renders the carrier from its normalized
 *   tiddler records — the same pipeline used to bootstrap the browser client.
 *   carrier-text is NOT stored in Automerge; the VM is the source for render.
 *
 * The renderFn is injected by the caller (typically serve.ts) and wraps:
 *   1. sync changed tiddler(s) into the corpus VM  (vm.setTiddler / removeTiddler)
 *   2. call exportCarrierText(vm, parentUri) → carrier string
 *
 * Projection triggers:
 *   Slot child change  → debounce → flush parent (renderFn)
 *   Parent change      → debounce → flush parent (renderFn)
 *
 * The writing Set guards against ingest echo:
 *   file watcher MUST check writing.has(uri) before ingesting a change.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, resolve as resolvePath, dirname } from "path";
import type { LarTiddlerStore, LarTiddlerChange } from "@lararium/core";

// ---------------------------------------------------------------------------
// LarDiskProjector
// ---------------------------------------------------------------------------

export class LarDiskProjector {
  /**
   * URIs currently being written to disk.
   * File watcher MUST check writing.has(uri) before ingesting — skip own writes.
   */
  readonly writing = new Set<string>();

  private readonly timers  = new Map<string, ReturnType<typeof setTimeout>>();
  private activeStore: LarTiddlerStore | null = null;

  constructor(
    /** Absolute path to the lares/ root directory. */
    private readonly laresRoot: string,
    /**
     * Render a parent URI to its carrier text string.
     * Called after debounce; receives the store so it can read current tiddler state.
     * Returns null if the URI should not be projected (unknown type, render error, etc.).
     * Typically wraps: sync tiddlers into TW5 VM → exportCarrierText(vm, uri).
     */
    private readonly renderFn: (parentUri: string, store: LarTiddlerStore) => Promise<string | null>,
    /** Debounce delay in ms. Default 1000ms; tests use 20ms. */
    private readonly debounceMs = 1000,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Subscribe to store changes and begin projecting. Returns unsubscribe fn. */
  start(store: LarTiddlerStore): () => void {
    this.activeStore = store;
    const unsubscribe = store.subscribe((change: LarTiddlerChange) => {
      this.schedule(change);
    });
    return () => { unsubscribe(); this.stop(); };
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.writing.clear();
    this.activeStore = null;
  }

  // ---------------------------------------------------------------------------
  // Scheduling — debounce by parent URI
  // ---------------------------------------------------------------------------

  private schedule(change: LarTiddlerChange): void {
    const { title, record } = change;
    if (!title.startsWith("lar:")) return;
    if (!record || record.deleted) return;
    if (!this.activeStore) return;

    const fields    = record.fields as Record<string, string | string[] | undefined> ?? {};
    const ahuParent = typeof fields["ahu-parent"] === "string" ? fields["ahu-parent"] : null;

    const parentUri = ahuParent ?? title;
    const store     = this.activeStore;

    const existing = this.timers.get(parentUri);
    if (existing) clearTimeout(existing);
    this.timers.set(parentUri, setTimeout(() => {
      this.timers.delete(parentUri);
      void this.flush(parentUri, store);
    }, this.debounceMs));
  }

  // ---------------------------------------------------------------------------
  // Flush — render via TW5 VM, write to disk (unidirectional; never reads disk)
  // ---------------------------------------------------------------------------

  private async flush(parentUri: string, store: LarTiddlerStore): Promise<void> {
    const filePath = this.uriToPath(parentUri);
    if (!filePath) return;

    const output = await this.renderFn(parentUri, store);
    if (output === null) return;

    this.writing.add(parentUri);
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, output, "utf-8");
    } finally {
      this.writing.delete(parentUri);
    }
  }

  // ---------------------------------------------------------------------------
  // URI → absolute file path
  // ---------------------------------------------------------------------------

  private uriToPath(uri: string): string | null {
    const match = uri.match(/^lar:\/\/\/(.+)$/);
    if (!match) return null;
    const raw        = match[1]!;
    const normalized = raw.replace(/^ha\.ka\.ba\//, "ha-ka-ba/");
    const candidate  = resolvePath(join(this.laresRoot, normalized + ".md"));
    if (!candidate.startsWith(resolvePath(this.laresRoot) + "/")) return null;
    return candidate;
  }
}

// ---------------------------------------------------------------------------
// LarDiskSyncAdaptor — backward-compat alias.
// @deprecated Use LarDiskProjector.
// ---------------------------------------------------------------------------

/** @deprecated */
export const LarDiskSyncAdaptor = LarDiskProjector;
