/**
 * LarDiskProjector — bag-aware unidirectional projection: store → disk.
 *
 * The Automerge store functions as the mind. Disk files project from it.
 * This projector NEVER reads from disk — that direction belongs to the ingest
 * path (file watcher → store.put).
 *
 * Bag-aware (S5.5+): each writable bag may opt into a filesystem mirror via
 * BagMirrorConfig. Bags without a mirror config never write to disk. Edits in
 * the room bag mirror to `wikis/{slug}/...`; canonical bags mirror to
 * `packages/...`. Promotion is a deliberate ceremony that moves a tiddler
 * between bags, with the disk side effect of a file move — the git diff IS
 * the operator's signature on canon.
 *
 * Projection law (Fontany-Fuller-Zelenka):
 *   Disk projection is a RENDER operation, not a string copy.
 *   The TW5 VM (with fakeDOM) re-renders the carrier from its normalized
 *   tiddler records — the same pipeline used to bootstrap the browser client.
 *
 * Projection triggers:
 *   Slot child change  → debounce → flush parent (renderFn)
 *   Parent change      → debounce → flush parent (renderFn)
 *
 * The writing Set guards against ingest echo:
 *   file watcher MUST check writing.has(uri) before ingesting a change.
 */

import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join, resolve as resolvePath, dirname } from "path";
import type { ReadinessMap, BagMirrorConfig } from "@lararium/core";
import type { TW5Engine } from "@lararium/tw5";

export class LarDiskProjector {
  /**
   * URIs currently being written to disk.
   * File watcher MUST check writing.has(uri) before ingesting — skip own writes.
   */
  readonly writing = new Set<string>();

  /** Timer key shape: `${bagId}\0${parentUri}` — debounce per (bag, parent). */
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private _firstFlushDone = false;

  constructor(
    /** Bag mirrors. Bags absent from this list never write to disk. */
    private readonly mirrors: readonly BagMirrorConfig[],
    /**
     * Render a parent URI to its carrier text string.
     * Called after debounce. Returns null to skip writing.
     */
    private readonly renderFn: (parentUri: string) => Promise<string | null>,
    /** Debounce delay in ms. */
    private readonly debounceMs = 1000,
    /** Optional readiness map — lights `disk-projector` after first flush. */
    private readonly readinessMap?: ReadinessMap,
  ) {}

  /**
   * Subscribe to TW5 wiki change events and begin projecting.
   *
   * Architecture law (TW5 VM Primacy): only the MemeSyncAdaptor subscribes
   * to Automerge stores. The disk projector subscribes to TW5 wiki change
   * events — the same surface that drives in-browser render. Bag provenance
   * reaches TW5 via the `bag` field that MemeSyncAdaptor stamps on each
   * tiddler it loads; the projector reads it from the TW5 tiddler directly.
   *
   * Returns an unsubscribe fn.
   */
  start(tw5: TW5Engine): () => void {
    const wiki = tw5.wiki;
    const handler = (changes: Record<string, unknown>) => {
      for (const title of Object.keys(changes)) {
        if (!title.startsWith("lar:")) continue;
        const tiddler = wiki.getTiddler?.(title);
        if (!tiddler) {
          // Deleted — try all mirrors for unlink.
          this._scheduleUnlinkByTitle(title);
          continue;
        }
        const fields = tiddler.fields as Record<string, string | string[] | undefined>;
        if (fields["disk-projection"] === "no") continue;
        const bagId = typeof fields["bag"] === "string" ? fields["bag"] : undefined;
        if (!bagId) continue;
        if (!this.mirrors.some((m) => m.bagId === bagId)) continue;

        const key = `${bagId}\0${title}`;
        const existing = this.timers.get(key);
        if (existing) clearTimeout(existing);
        this.timers.set(key, setTimeout(() => {
          this.timers.delete(key);
          void this.flush(bagId, title);
        }, this.debounceMs));
      }
    };
    wiki.addEventListener?.("change", handler);
    return () => { wiki.removeEventListener?.("change", handler); this.stop(); };
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.writing.clear();
  }

  /** Unlink by trying all mirrors whose path strategy resolves the URI. */
  private _scheduleUnlinkByTitle(title: string): void {
    for (const mirror of this.mirrors) {
      const relPath = mirror.toRelPath(title);
      if (!relPath) continue;
      const root      = resolvePath(mirror.mirrorRoot);
      const candidate = resolvePath(join(root, relPath));
      if (!candidate.startsWith(root + "/") && candidate !== root) continue;
      try {
        if (existsSync(candidate)) {
          this.writing.add(title);
          try { unlinkSync(candidate); } finally { this.writing.delete(title); }
        }
      } catch { /* best-effort — operator can clean up manually */ }
    }
  }

  private async flush(bagId: string, parentUri: string): Promise<void> {
    const mirror = this.mirrors.find((m) => m.bagId === bagId);
    if (!mirror) return;

    const relPath = mirror.toRelPath(parentUri);
    if (!relPath) return;

    const root      = resolvePath(mirror.mirrorRoot);
    const candidate = resolvePath(join(root, relPath));
    // Path-traversal guard.
    if (!candidate.startsWith(root + "/") && candidate !== root) return;

    const output = await this.renderFn(parentUri);
    if (output === null) return;

    this.writing.add(parentUri);
    try {
      mkdirSync(dirname(candidate), { recursive: true });
      writeFileSync(candidate, output, "utf-8");
      if (!this._firstFlushDone) {
        this._firstFlushDone = true;
        this.readinessMap?.mark("disk-projector");
      }
    } finally {
      this.writing.delete(parentUri);
    }
  }
}
