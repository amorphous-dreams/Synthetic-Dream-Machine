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
import type {
  LarTiddlerStore, LarTiddlerChange, ReadinessMap, BagMirrorConfig,
} from "@lararium/core";

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

  /** Subscribe to store changes and begin projecting. Returns unsubscribe fn. */
  start(store: LarTiddlerStore): () => void {
    const unsubscribe = store.subscribe((change: LarTiddlerChange) => {
      this.schedule(change);
    });
    return () => { unsubscribe(); this.stop(); };
  }

  stop(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.writing.clear();
  }

  private schedule(change: LarTiddlerChange): void {
    const { title, record, origin } = change;
    if (!title.startsWith("lar:")) return;
    // Skip canon-hydrate replays at boot — the file already exists with that
    // content; rewriting churns the file watcher and git for no reason.
    if (origin.kind === "canon-hydrate") return;

    // Tombstone path: a delete in a mirrored bag MUST unlink the file.
    // Canon-promotion's contract — the source-bag's tombstone is what makes
    // "git diff IS the operator's signature" work. A tombstone with no
    // surviving record.bag still has to know which mirror to unlink against;
    // for tombstones we trust title alone and try every mirror whose strategy
    // resolves the URI (typically only one).
    if (!record || record.deleted) {
      this._scheduleUnlink(title, change);
      return;
    }

    const bagId = record.bag;
    if (!bagId) return;
    if (!this.mirrors.some((m) => m.bagId === bagId)) return;

    const fields    = record.fields as Record<string, string | string[] | undefined> ?? {};

    // Always-split architectural law (operator-confirmed): every tiddler
    // with a writable URI projects to its own file. The deserializer +
    // action widget split every ahu sigil into its own tiddler at sync/
    // save time; each slot child IS a file root. Disk projection becomes
    // a function of (bag, URI) — no tag discriminator, no transitive
    // climbs. Roslyn / recast / XInclude consensus: serialization is a
    // function of the tree, never of external metadata.
    //
    // Two opt-out surfaces remain for operator authoring:
    //   - `disk-projection: "no"` field — keep in bag, skip disk.
    //   - `lar-generated: "yes"` field is informational only; widget-
    //     emitted children DO project. Only operator-toggled opt-out
    //     stops projection.
    if (fields["disk-projection"] === "no") return;

    // The render unit is THIS tiddler; URI fragment-path projects via
    // `resolveLarUri.appendFragment` to a unique disk path. The path-
    // strategy returns null for URIs that have no disk home (virtual
    // caps, etc.); the projector silently skips those.
    const parentUri = title;

    const key = `${bagId}\0${parentUri}`;
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      void this.flush(bagId, parentUri);
    }, this.debounceMs));
  }

  private _scheduleUnlink(title: string, change: LarTiddlerChange): void {
    // Per-bag unlink: each AutomergeDocStore tombstone fires with
    // change.record.bag set to the source bag. Unlink ONLY that bag's mirror
    // file. Other layers' mirrors stay intact — that's the canon-promotion
    // contract: room file disappears, canonical file appears.
    const candidateBag = change.record?.bag ?? null;
    if (!candidateBag) return;
    const mirror = this.mirrors.find((m) => m.bagId === candidateBag);
    if (!mirror) return;
    const relPath = mirror.toRelPath(title);
    if (!relPath) return;
    const root      = resolvePath(mirror.mirrorRoot);
    const candidate = resolvePath(join(root, relPath));
    if (!candidate.startsWith(root + "/") && candidate !== root) return;
    try {
      if (existsSync(candidate)) {
        this.writing.add(title);
        try { unlinkSync(candidate); } finally { this.writing.delete(title); }
      }
    } catch { /* best-effort — operator can clean up manually */ }
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
