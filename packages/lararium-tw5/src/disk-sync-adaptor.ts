/**
 * LarDiskSyncAdaptor — TW5SyncAdaptor that writes meme carrier text to lares/ files.
 *
 * All tiddlers with `lar:` titles are Lararium memes — their URI is the title.
 * `resolveLarUri` derives the lares/ path from the URI directly; no pre-built
 * index is needed. Virtual caps URIs (laresRelPath: null) are silently skipped —
 * they have no on-disk representation.
 *
 * Trust model: by the time saveTiddler is called, the change has already passed
 * the Automerge sharePolicy (UCAN gate). All surviving writes are trusted.
 *
 * Echo-loop guard:
 *   When a disk change arrives via the lares/ file watcher and is written into
 *   Automerge, the Automerge→TW5→saveTiddler chain would otherwise re-trigger a
 *   disk write for the same URI. The `writing` Set exposes which URIs are
 *   currently pending a debounced disk write so the watcher can skip them.
 *
 * Write law:
 *   - Non-lar: titles are skipped (system tiddlers have lar: URIs in Lararium).
 *   - Path traversal guard: resolved path must stay within laresRoot.
 *   - Writes are debounced per-URI to coalesce rapid collaborative edits.
 *   - mkdirSync ensures parent directories exist (new memes may have no dir yet).
 */

import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { resolveLarUri } from "@lararium/core";
import { replaceCarrierSlot } from "./carrier-split.js";
import type { TW5SyncAdaptor } from "./lararium-tw5.js";

// ---------------------------------------------------------------------------
// LarDiskSyncAdaptor
// ---------------------------------------------------------------------------

export class LarDiskSyncAdaptor implements TW5SyncAdaptor {
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * URIs currently pending a debounced disk write.
   * The lares/ file watcher checks this to avoid echo-looping its own writes
   * back through Automerge → TW5 → saveTiddler → disk again.
   */
  readonly writing = new Set<string>();

  constructor(
    /** Absolute path to lares/ root directory. */
    private readonly laresRoot: string,
    /** Debounce delay in ms (default 1 s). */
    private readonly debounceMs = 1000,
  ) {}

  saveTiddler(
    tiddler: unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    const t = tiddler as Record<string, unknown>;
    const fields = (t["fields"] as Record<string, unknown> | undefined) ?? t;
    const title      = (fields["title"]        as string | undefined) ?? "";
    const text       = (fields["text"]         as string | undefined) ?? "";
    const ahuSlot    = (fields["ahu-slot"]      as string | undefined);
    const ahuParent  = (fields["ahu-parent"]    as string | undefined);
    const carrierText = (fields["carrier-text"] as string | undefined);

    if (!title.startsWith("lar:")) { callback(null, {}, "0"); return; }

    // ── Child slot write-back ────────────────────────────────────────────────
    // A child tiddler (has ahu-slot + ahu-parent) represents one ahu section of
    // the parent carrier. Editing it writes only that slot's body back to disk
    // via replaceCarrierSlot — the parent carrier file is the unit of storage.
    if (ahuSlot && ahuParent) {
      let parentLaresPath: string | null;
      try {
        parentLaresPath = resolveLarUri(ahuParent).laresRelPath;
      } catch {
        parentLaresPath = null;
      }
      if (!parentLaresPath) { callback(null, {}, "0"); return; }

      const parentFilePath = join(this.laresRoot, parentLaresPath);
      if (!resolve(parentFilePath).startsWith(resolve(this.laresRoot) + "/")) {
        callback(new Error("path-traversal-rejected"), {}, "0");
        return;
      }

      this.writing.add(ahuParent);
      const existing = this._timers.get(ahuParent);
      if (existing) clearTimeout(existing);

      this._timers.set(ahuParent, setTimeout(() => {
        this._timers.delete(ahuParent);
        try {
          const currentCarrier = readFileSync(parentFilePath, "utf-8");
          const updated = replaceCarrierSlot(currentCarrier, ahuSlot, text);
          if (updated === null) {
            console.warn(`[disk-sync] slot ${ahuSlot} not found in ${parentLaresPath} — skipped`);
          } else {
            mkdirSync(resolve(parentFilePath, ".."), { recursive: true });
            writeFileSync(parentFilePath, updated, "utf-8");
            console.log(`[disk-sync] ← ${parentLaresPath} (slot ${ahuSlot})`);
          }
          callback(null, {}, String(Date.now()));
        } catch (err) {
          console.error(`[disk-sync] slot write failed for ${ahuParent}:`, err);
          callback(err instanceof Error ? err : new Error(String(err)), {}, "0");
        } finally {
          this.writing.delete(ahuParent);
        }
      }, this.debounceMs));

      callback(null, {}, String(Date.now()));
      return;
    }

    // ── Parent carrier write-back ────────────────────────────────────────────
    // Parent tiddler text is now the template delegate `{{||...}}`.
    // The actual on-disk content is in carrier-text. Fall back to text if absent
    // (non-carrier lar: tiddlers, or tiddlers created before this convention).
    const diskText = carrierText ?? text;
    if (!diskText) { callback(null, {}, "0"); return; }

    let laresRelPath: string | null;
    try {
      laresRelPath = resolveLarUri(title).laresRelPath;
    } catch {
      laresRelPath = null;
    }
    if (!laresRelPath) { callback(null, {}, "0"); return; }

    const filePath = join(this.laresRoot, laresRelPath);
    if (!resolve(filePath).startsWith(resolve(this.laresRoot) + "/")) {
      callback(new Error("path-traversal-rejected"), {}, "0");
      return;
    }

    this.writing.add(title);
    const existing = this._timers.get(title);
    if (existing) clearTimeout(existing);

    this._timers.set(title, setTimeout(() => {
      this._timers.delete(title);
      try {
        mkdirSync(resolve(filePath, ".."), { recursive: true });
        writeFileSync(filePath, diskText, "utf-8");
        console.log(`[disk-sync] ← ${laresRelPath}`);
        callback(null, {}, String(Date.now()));
      } catch (err) {
        console.error(`[disk-sync] write failed for ${title}:`, err);
        callback(err instanceof Error ? err : new Error(String(err)), {}, "0");
      } finally {
        this.writing.delete(title);
      }
    }, this.debounceMs));

    callback(null, {}, String(Date.now()));
  }

  deleteTiddler(
    title: string,
    callback: (err: Error | null) => void,
  ): void {
    // Deletion from disk requires explicit canon demotion — not automatic.
    if (title.startsWith("lar:")) {
      console.log(`[disk-sync] delete skipped for ${title} — requires canon demotion`);
    }
    callback(null);
  }

  /** Cancel all pending debounced writes. Call on server shutdown. */
  flush(): void {
    for (const [, timer] of this._timers) clearTimeout(timer);
    this._timers.clear();
    this.writing.clear();
  }
}
