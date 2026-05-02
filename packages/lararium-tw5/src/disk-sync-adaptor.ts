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
 *
 * The renderFn is injected by the caller and wraps renderCarrier() from server-api.
 * The recipe VM (booted via bootRecipeVm) stays in sync via store subscription —
 * renderFn needs no store argument.
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
import type { LarTiddlerStore, LarTiddlerChange, ReadinessMap } from "@lararium/core";
import { resolveLarUri } from "@lararium/core";

export class LarDiskProjector {
  /**
   * URIs currently being written to disk.
   * File watcher MUST check writing.has(uri) before ingesting — skip own writes.
   */
  readonly writing = new Set<string>();

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private _firstFlushDone = false;

  constructor(
    /** Absolute path to the lares/ root directory. */
    private readonly laresRoot: string,
    /**
     * Render a parent URI to its carrier text string.
     * Called after debounce. Returns null to skip writing (unknown type, render error).
     * Typically wraps renderCarrier(recipeId, uri) from server-api.
     * The recipe VM (bootRecipeVm) is kept current via store subscription —
     * no store argument needed here.
     */
    private readonly renderFn: (parentUri: string) => Promise<string | null>,
    /** Debounce delay in ms. Default 1000ms; tests use 20ms. */
    private readonly debounceMs = 1000,
    /** Optional readiness map — lights disk-projector after the first successful flush. */
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
    const { title, record } = change;
    if (!title.startsWith("lar:")) return;
    if (!record || record.deleted) return;

    const fields    = record.fields as Record<string, string | string[] | undefined> ?? {};
    const ahuParent = typeof fields["ahu-parent"] === "string" ? fields["ahu-parent"] : null;
    const parentUri = ahuParent ?? title;

    const existing = this.timers.get(parentUri);
    if (existing) clearTimeout(existing);
    this.timers.set(parentUri, setTimeout(() => {
      this.timers.delete(parentUri);
      void this.flush(parentUri);
    }, this.debounceMs));
  }

  private async flush(parentUri: string): Promise<void> {
    const filePath = this.uriToPath(parentUri);
    if (!filePath) return;

    const output = await this.renderFn(parentUri);
    if (output === null) return;

    this.writing.add(parentUri);
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, output, "utf-8");
      if (!this._firstFlushDone) {
        this._firstFlushDone = true;
        this.readinessMap?.mark("disk-projector");
      }
    } finally {
      this.writing.delete(parentUri);
    }
  }

  private uriToPath(uri: string): string | null {
    try {
      const resolution = resolveLarUri(uri);
      if (!resolution.laresRelPath) return null;
      const candidate = resolvePath(join(this.laresRoot, resolution.laresRelPath));
      if (!candidate.startsWith(resolvePath(this.laresRoot) + "/")) return null;
      return candidate;
    } catch { return null; }
  }
}
