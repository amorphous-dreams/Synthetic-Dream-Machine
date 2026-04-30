/**
 * LarDiskProjector — projects LarTiddlerStore changes to lares/ files on disk.
 *
 * Subscribes directly to the Automerge store (not TW5 wiki events) so it
 * receives ALL changes with their ChangeOrigin — local user edits AND remote
 * peer changes. The server is a peer; it persists every change regardless of
 * origin. The file watcher checks `projector.writing` to avoid echo-looping
 * its own writes back through the store.
 *
 * Flow (server peer):
 *   Local edit:   TW5 wiki → LarariumCrdtSyncAdaptor → store.put → [this] → lares/ file
 *   Remote edit:  Automerge sync → store.put → [this] → lares/ file
 *   Human edit:   lares/ file → file watcher → (writing.has? skip) → store.put
 *
 * "The server is just another client peer." — same adaptor, same store, same
 * Automerge sync path. Disk is a human-readable projection, not the authority.
 *
 * Write law:
 *   - Only lar: URI records are written; system tiddlers ($:/) are skipped.
 *   - Carrier parents: write carrier-text field (raw carrier format).
 *   - Ahu child slots: readFileSync parent carrier → replaceCarrierSlot → write.
 *   - Path traversal guard: resolved path must stay within laresRoot.
 *   - Writes debounced per parent URI to coalesce rapid collaborative edits.
 *   - mkdirSync ensures parent directories exist (new memes may have no dir yet).
 */

import { writeFileSync, readFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { resolveLarUri } from "@lararium/core";
import type { LarTiddlerStore } from "@lararium/core";
import { composeCarrierSlotBody, replaceCarrierSlot } from "./carrier-split.js";

// ---------------------------------------------------------------------------
// LarDiskProjector
// ---------------------------------------------------------------------------

export class LarDiskProjector {
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly _pendingSlots = new Map<string, Map<string, string>>();
  private _unsubscribe: (() => void) | null = null;

  /**
   * URIs currently pending a debounced disk write.
   * File watcher must check `writing.has(uri)` before feeding a change to the
   * store — if present, the watcher is seeing its own write and must skip.
   */
  readonly writing = new Set<string>();

  constructor(
    /** Absolute path to lares/ root directory. */
    private readonly laresRoot: string,
    /** Debounce delay in ms (default 1 s). */
    private readonly debounceMs = 1000,
  ) {}

  /**
   * Start projecting store changes to disk.
   * Call once after the store is ready. Returns an unsubscribe/stop function.
   */
  start(store: LarTiddlerStore): () => void {
    this._unsubscribe = store.subscribe((change) => {
      const { title, record } = change;
      if (!title.startsWith("lar:")) return;
      if (record === null || record.deleted) {
        // Deletion: skip disk removal — carrier files are versioned in git;
        // removal requires explicit canon demotion, not automatic deletion.
        return;
      }

      const fields = record.fields as Record<string, string | undefined>;
      const ahuSlot   = fields["ahu-slot"];
      const ahuParent = fields["ahu-parent"];
      const carrierText = fields["carrier-text"] ?? record.text;

      if (ahuSlot && ahuParent) {
        // Child slot: surgical write-back to parent carrier file.
        this._writeSlot(ahuParent, ahuSlot, composeCarrierSlotBody(fields, record.text ?? ""));
      } else if (carrierText) {
        // Parent or plain lar: tiddler: write carrier-text (or text) to disk.
        this._writeDirect(title, carrierText);
      }
    });
    return () => this.stop();
  }

  stop(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
    for (const [, t] of this._timers) clearTimeout(t);
    this._timers.clear();
    this._pendingSlots.clear();
    this.writing.clear();
  }

  // ── Private write helpers ─────────────────────────────────────────────────

  private _resolveFilePath(uri: string): string | null {
    let laresRelPath: string | null;
    try {
      laresRelPath = resolveLarUri(uri).laresRelPath;
    } catch {
      return null;
    }
    if (!laresRelPath) return null;
    const filePath = join(this.laresRoot, laresRelPath);
    if (!resolve(filePath).startsWith(resolve(this.laresRoot) + "/")) return null;
    return filePath;
  }

  private _writeDirect(uri: string, content: string): void {
    const filePath = this._resolveFilePath(uri);
    if (!filePath) return;

    this.writing.add(uri);
    const existing = this._timers.get(uri);
    if (existing) clearTimeout(existing);

    this._timers.set(uri, setTimeout(() => {
      this._timers.delete(uri);
      try {
        mkdirSync(resolve(filePath, ".."), { recursive: true });
        writeFileSync(filePath, content, "utf-8");
        console.log(`[disk] ← ${uri}`);
      } catch (err) {
        console.error(`[disk] write failed for ${uri}:`, err);
      } finally {
        this.writing.delete(uri);
      }
    }, this.debounceMs));
  }

  private _writeSlot(parentUri: string, slot: string, slotBody: string): void {
    const filePath = this._resolveFilePath(parentUri);
    if (!filePath) return;

    // Debounce keyed on parent URI — coalesces multiple slot edits in one write.
    let pending = this._pendingSlots.get(parentUri);
    if (!pending) {
      pending = new Map<string, string>();
      this._pendingSlots.set(parentUri, pending);
    }
    pending.set(slot, slotBody);

    this.writing.add(parentUri);
    const existing = this._timers.get(parentUri);
    if (existing) clearTimeout(existing);

    this._timers.set(parentUri, setTimeout(() => {
      this._timers.delete(parentUri);
      try {
        const queued = this._pendingSlots.get(parentUri);
        this._pendingSlots.delete(parentUri);
        if (!queued || queued.size === 0) return;

        let updated = readFileSync(filePath, "utf-8");
        const writtenSlots: string[] = [];
        for (const [queuedSlot, queuedBody] of queued) {
          const next = replaceCarrierSlot(updated, queuedSlot, queuedBody);
          if (next === null) {
            console.warn(`[disk] slot ${queuedSlot} not found in ${parentUri} — skipped`);
            continue;
          }
          updated = next;
          writtenSlots.push(queuedSlot);
        }
        if (writtenSlots.length === 0) return;

        mkdirSync(resolve(filePath, ".."), { recursive: true });
        writeFileSync(filePath, updated, "utf-8");
        console.log(`[disk] ← ${parentUri} (slots ${writtenSlots.join(", ")})`);
      } catch (err) {
        console.error(`[disk] slot write failed for ${parentUri}:`, err);
      } finally {
        this.writing.delete(parentUri);
      }
    }, this.debounceMs));
  }
}

// ---------------------------------------------------------------------------
// LarDiskSyncAdaptor — backward-compat alias.
// @deprecated Use LarDiskProjector with store.subscribe() instead.
// ---------------------------------------------------------------------------

/** @deprecated */
export const LarDiskSyncAdaptor = LarDiskProjector;
