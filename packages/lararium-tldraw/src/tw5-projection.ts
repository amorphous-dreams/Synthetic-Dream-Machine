/**
 * tw5-projection — derive tldraw shape records from TW5 wiki state.
 *
 * Local-first: TW5 wiki is the authoritative corpus. The canvas is a projection
 * of the wiki, not a separate CRDT synced from the server.
 *
 * Pipeline (runs in browser against the live Automerge-backed TW5 instance):
 *   TW5 filterTiddlers()  →  uri list
 *   tiddler fields        →  ClosureEntry[]
 *   renderToTldraw()      →  { pages, shapes, bindings }
 *   editor.store.put()    →  live tldraw canvas
 *
 * Incremental updates: re-run projectFromTw5 for changed URIs and call
 * editor.store.put() / editor.store.remove() as needed.
 */

import type { TW5Engine } from "@lararium/tw5";
import type { BootArtifact, ClosureEntry } from "@lararium/core";
import { renderToTldraw } from "./render.js";
import type { TldrawEmission } from "./tldraw-shapes.js";

// ---------------------------------------------------------------------------
// closureEntryFromTiddler — read a ClosureEntry from TW5 tiddler fields
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function closureEntryFromTiddler(uri: string, fields: Record<string, any>): ClosureEntry {
  const splitField = (v: unknown): string[] => {
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
    if (typeof v === "string") return v.split(/\s+/).filter(Boolean);
    return [];
  };

  return {
    uri,
    laresRelPath:    null,
    kind:            String(fields.rating    ?? "meme"),
    virtual:         false,
    exists:          true,
    role:            String(fields.role      ?? ""),
    hydrationSocket: "",
    implements:      splitField(fields.implements),
    tags:            splitField(fields.tags),
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

export function projectFromTw5(tw5: TW5Engine): TldrawEmission {
  const uris = tw5.filterTiddlers("[all[tiddlers]prefix[lar:]]");
  const closure: ClosureEntry[] = [];

  for (const uri of uris) {
    const fields = tw5.getTiddler(uri);
    if (!fields) continue;
    closure.push(closureEntryFromTiddler(uri, fields));
  }

  const readText = (uri: string): string | null =>
    tw5.getTiddlerText(uri) ?? null;

  // Minimal BootArtifact — renderToTldraw only reads artifact/closure/compiledAt/memeCount
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
