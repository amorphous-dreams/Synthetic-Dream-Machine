/**
 * tw5-canvas-projection — derive tldraw shape records from TW5 wiki state.
 *
 * Local-first: TW5 wiki is the authoritative corpus. The canvas is a projection
 * of the wiki, not a separate CRDT synced from the server.
 *
 * Pipeline (same as server-side, now running in the browser):
 *   TW5 filterTiddlers()  →  uri list
 *   tiddler fields        →  ClosureEntry[]
 *   projectToTldraw()     →  LarTLSnapshot
 *   selectLayout()        →  LarTLLayout
 *   emitTldrawRecords()   →  { pages, shapes, bindings }
 *   editor.store.put()    →  live tldraw canvas
 *
 * Incremental updates: caller re-runs projectFromTw5 for changed URIs and
 * calls editor.store.put() / editor.store.remove() as needed.
 */

import type { LarariumTW5 } from "@lararium/tw5";
import { renderToTldraw, type TldrawEmission } from "@lararium/tldraw";
import type { BootArtifact, ClosureEntry } from "@lararium/core";

// ---------------------------------------------------------------------------
// closureEntryFromTiddler — read a ClosureEntry from TW5 tiddler fields
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function closureEntryFromTiddler(uri: string, fields: Record<string, any>): ClosureEntry {
  // implements: stored as tiddler tags (entryToFields adds them alongside "lar:meme")
  const rawTags: string | string[] = fields.tags ?? [];
  const tags = Array.isArray(rawTags)
    ? rawTags
    : String(rawTags).split(" ").filter(Boolean);
  const implements_ = tags.filter((t: string) => t.startsWith("lar:") && t !== "lar:meme");

  return {
    uri,
    laresRelPath:    null,
    kind:            String(fields.rating    ?? "meme"),
    virtual:         false,
    exists:          true,
    role:            String(fields.role      ?? ""),
    hydrationSocket: "",
    implements:      implements_,
    contentHash:     "",
    depth:           Number(fields.depth      ?? 0),
    confidence:      Number(fields.confidence ?? 0),
    register:        String(fields.register   ?? "S"),
    manaoio:         Number(fields.manaoio    ?? 0),
    mana:            Number(fields.mana       ?? 0),
    manao:           Number(fields.manao      ?? 0),
  };
}

// ---------------------------------------------------------------------------
// projectFromTw5 — full TW5 wiki → TldrawEmission
// ---------------------------------------------------------------------------

export function projectFromTw5(tw5: LarariumTW5): TldrawEmission {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wiki = tw5.wiki as any;

  const uris = tw5.filterTiddlers("[all[tiddlers]prefix[lar:]]");
  const closure: ClosureEntry[] = [];

  for (const uri of uris) {
    const tiddler = wiki.getTiddler?.(uri);
    if (!tiddler) continue;
    closure.push(closureEntryFromTiddler(uri, tiddler.fields ?? {}));
  }

  const readText = (uri: string): string | null =>
    wiki.getTiddlerText?.(uri) ?? null;

  // Minimal BootArtifact — projectToTldraw only reads artifact/closure/compiledAt/memeCount
  const artifact = {
    artifact:       "session",
    compiledAt:     new Date().toISOString(),
    entry:          "lar:///AGENTS",
    closure,
    memeCount:      closure.length,
    locusCount:     0,
    edgeCount:      0,
    interfaceIndex: {},
    invariantIndex: {},
    validation:     { allResolved: true, allExist: true, missing: [], dagViolations: [], declaredUnresolved: [], edgeViolations: [] },
  } as unknown as BootArtifact;

  return renderToTldraw(artifact, { readText, includeAhuFrames: false });
}
