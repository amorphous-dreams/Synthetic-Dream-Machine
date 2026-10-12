/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/nalu-engine
type: application/javascript
module-type: startup
\*/
/**
 * nalu-engine — the applier. It lands ONE inbound change in the wiki, synchronously.
 *
 * The wiki shore (`island-adaptor.ts`, `wave-landing.ts`) owns everything about WHEN a change lands:
 * the ordered queue, the slices and their host-task pacing, the seed checkpoint, and the meeting of a
 * wave with an unsent hand. This module owns HOW one lands, and nothing else:
 *
 *   applyNalu(change)   a tombstone or an absent record deletes the title; anything else adds the
 *                       tiddler `toWikiFields` builds from the envelope. No queue, no timer, no frame.
 *   isApplyingNalu()    true while an `applyNalu` call runs, restored in a `finally`.
 *
 * The shore installs its own queue door at `$tw.lares.enqueueNalu` and removes it at teardown; this
 * module never holds one.
 *
 * Position in the stack:
 *
 *   TS shore (Automerge, network, crypto, storage)
 *     AutomergeDocStore → MemeProvider → projection bus → IslandAdaptor.onUriChanged
 *     WaveLanding queue → IslandAdaptor._landOne → $tw.lares.applyNalu(change)
 *   ───────────────────────────────────────────────────────────────────────
 *   TW5 startup module (this file)
 *     applyNalu(change) → wiki.addTiddler / wiki.deleteTiddler
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/modules/nalu-engine
 */

import type { TW5Instance, TW5Wiki } from "../types/tiddlywiki.js";
// A PACKED MODULE REACHES BY SUBPATH, NEVER THE BARREL. This bundles to CJS, and the barrel's graph
// carries automerge's wasm shim — whose top-level await no CJS output can express, so a bare
// `@lararium/mesh` here fails the whole plugin build even for a type-only import: the specifier still
// enters the bundler's graph. `carrier-filetype` already keeps this law; so does the cold-boot mirror,
// by inlining. Reach for the module that holds what you need.
import type { LarTiddlerChange, TW5TiddlerInputFieldsWithTitle } from "@lararium/mesh/tiddler-store";
import type { LaresTw5Extension } from "../types/lares-globals.js";

// ---------------------------------------------------------------------------
// TW5 startup lifecycle
// ---------------------------------------------------------------------------

export const name        = "lararium-nalu-engine";
export const after       = ["startup"];
export const synchronous = true;

// TW5's evalGlobal injects $tw as a direct function parameter.
declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;

// ---------------------------------------------------------------------------
// Module-level state (one applier per wiki — singleton)
// ---------------------------------------------------------------------------

let _applying                  = false;
let _wiki:      TW5Wiki | null = null;

/** The applier ran with no wiki under it: boot the TW5 wiki with this module before landing a change. */
export class NaluWikiUnavailableError extends Error {
  override readonly name = "NaluWikiUnavailableError";
  constructor(title: string) { super(`nalu-engine: no wiki stands to apply "${title}" to — boot the TW5 wiki with this module before landing a change`); }
}

/**
 * The wiki fields an inbound change lands as. CRDT records store the title as the doc key, not nested
 * in `tiddler` — restore it from `change.title` so the wiki tiddler carries its identity.
 *
 * Residency Model — every inbound write annotates `$origin-bag` from the ENVELOPE so the operator
 * can answer "which bag does this come from?" at every read (Anti-pattern #4 defense). `bag` is
 * user space: an author's own field rides through untouched, as TiddlyWeb's stamp would ride under
 * theirs — the host's provenance wears a name no author collides with.
 */
export function toWikiFields(change: LarTiddlerChange): TW5TiddlerInputFieldsWithTitle {
  return {
    ...change.record!.tiddler,
    title: change.title,
    ...(change.bag !== undefined ? { "$origin-bag": change.bag } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API — exposed at $tw.lares.*
// ---------------------------------------------------------------------------

/** Apply ONE inbound change to the wiki, synchronously. */
export function applyNalu(change: LarTiddlerChange): void {
  const Tiddler = $tw?.Tiddler;
  if (!_wiki || !Tiddler) throw new NaluWikiUnavailableError(change.title);
  // An apply that begins inside another (a listener that lands a change of its own) restores the flag it
  // found, so the outer apply still reads raised until it ends.
  const outer = _applying;
  _applying = true;
  try {
    if (change.record === null || change.record.meta?.deleted) _wiki.deleteTiddler(change.title);
    else _wiki.addTiddler(new Tiddler(toWikiFields(change)));
  } finally {
    _applying = outer;
  }
}

/** True while an `applyNalu` call runs. */
export function isApplyingNalu(): boolean {
  return _applying;
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

export function startup(): void {
  const wiki = $tw?.wiki;
  if (!wiki) return;
  _wiki = wiki;

  const lares = ($tw!.lares ?? {}) as Record<string, unknown>;
  lares["applyNalu"]      = applyNalu;
  lares["isApplyingNalu"] = isApplyingNalu;
  ($tw as { lares?: Record<string, unknown> }).lares = lares;
}
