/**
 * @deprecated web2-era — ingest uses splitCarrierToTiddlers (disk as source of truth
 * via carrier stack). Do NOT add new exports here.
 *
 * Principles worth keeping:
 *   - Echo guard (projector.writing.has(uri)) is FFZ-aligned; closes the
 *     render→watch loop. Preserve this exact guard in the new model.
 *   - Direction is correct: disk change → store.put(). The Automerge store
 *     is the mind; the disk watcher IS a valid operator-import signal path.
 *   - Only lares/ URIs ingested. $:/ and temp/ exclusions are invariant.
 *   - ChangeOrigin { kind: "operator-import", sessionId } tag stays.
 *
 * Rebuild target: meme-disk-watcher.ts — replaces splitCarrierToTiddlers
 *   with parseMemeText() + splitMemeToTiddlers() from the deserializer.
 *   Imports from @lararium/core/meme-ast, not @lararium/tw5 carrier stack.
 *
 * LarDiskWatcher — unidirectional ingest: lares/ files on disk → Automerge store.
 *
 * The ingest counterpart to LarDiskProjector.  Watches laresRoot for .md file
 * changes and feeds changed carriers into the corpus store via splitCarrierToTiddlers.
 *
 * Echo guard: checks projector.writing.has(uri) before ingesting — skips files
 * that the projector itself just wrote, closing the render→watch loop safely.
 *
 * Ingest law (Fontany-Fuller-Zelenka):
 *   1. Human edits .md file on disk.
 *   2. Watcher fires; path → lar URI.
 *   3. Echo guard: skip if projector.writing.has(uri).
 *   4. Read file text; splitCarrierToTiddlers → [parent, ...children].
 *   5. store.put() each record with origin { kind: "operator-import", sessionId }.
 *   6. Automerge CRDT propagates change to all live peers (browser, MCP, etc.).
 *
 * Only carriers (lar:/// URIs resolved from laresRoot/*.md) are ingested.
 * System tiddlers ($:/) are excluded at the split boundary.
 */

import { watch, readFileSync, existsSync } from "fs";
import { join, resolve as resolvePath, relative, extname } from "path";
import type { LarTiddlerStore, ChangeOrigin } from "@lararium/core";
import { laresRelPathToLarUri } from "@lararium/core";
import { splitCarrierToTiddlers } from "@lararium/tw5";
import type { LarDiskProjector } from "@lararium/tw5";

function toStringFields(fields: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v.join(" ") : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LarDiskWatcher
// ---------------------------------------------------------------------------

export class LarDiskWatcher {
  private _watcher: ReturnType<typeof watch> | null = null;
  private readonly _sessionId: string;
  /** Engine-owned $:/ titles — never written to the corpus store. */
  private readonly _engineTitles: ReadonlySet<string>;

  constructor(
    private readonly laresRoot: string,
    private readonly store: LarTiddlerStore,
    private readonly projector: LarDiskProjector,
    /** systemTitles from LarariumDoc — passed in by serve.ts after the lararium island loads. */
    engineSystemTitles: readonly string[] = [],
    sessionId = `disk-watcher:${Date.now()}`,
  ) {
    this._engineTitles = new Set(engineSystemTitles);
    this._sessionId = sessionId;
  }

  start(): void {
    if (this._watcher) return;
    this._watcher = watch(
      this.laresRoot,
      { recursive: true, persistent: false },
      (_eventType, filename) => {
        if (!filename) return;
        if (extname(filename) !== ".md") return;
        const absPath = resolvePath(join(this.laresRoot, filename));
        const uri = this._pathToUri(absPath);
        if (!uri) return;
        if (this.projector.writing.has(uri)) return;
        void this._ingest(uri, absPath);
      },
    );
  }

  stop(): void {
    this._watcher?.close();
    this._watcher = null;
  }

  private async _ingest(uri: string, absPath: string): Promise<void> {
    if (!existsSync(absPath)) return;
    let text: string;
    try {
      text = readFileSync(absPath, "utf-8");
    } catch {
      return;
    }

    const origin: ChangeOrigin = { kind: "operator-import", sessionId: this._sessionId };

    let split;
    try {
      split = splitCarrierToTiddlers(uri, text);
    } catch {
      return;
    }

    const { parent, children } = split;

    // Parent — stored without raw carrier text (VM render is canonical projection)
    await this.store.put(
      { title: uri, fields: toStringFields(parent.fields), text: parent.text },
      origin,
    );

    for (const child of children) {
      if (this._engineTitles.has(child.title) || child.title.startsWith("$:/")) continue;
      await this.store.put(
        { title: child.title, fields: toStringFields(child.fields), text: child.text },
        origin,
      );
    }
  }

  private _pathToUri(absPath: string): string | null {
    const root = resolvePath(this.laresRoot);
    if (!absPath.startsWith(root + "/")) return null;
    const rel = relative(root, absPath);
    try { return laresRelPathToLarUri(rel); } catch { return null; }
  }
}
