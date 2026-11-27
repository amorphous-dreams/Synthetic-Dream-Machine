/**
 * nalu-form — THE NALU FORM: the one shape a change takes as a wiki tiddler, above the engine and below it.
 *
 * Below, the applier (`modules/nalu-engine.ts`, `$tw.lares.applyNalu`) lands each wave's change through it. Above, wave zero
 * (`island-seed.ts`) hands the seed to `$tw.preloadTiddlers` through it before TiddlyWiki starts, and the glass mirror boots
 * its store through it (`glass-mirror.ts`). One form above and below: a preloaded record and the record a later landing of the
 * same change would write carry the same fields byte for byte, so the shore reads them as the same (`sameWithStamp`) and
 * writes nothing.
 *
 * A LEAF MODULE. The packed startup module imports this by a relative path and bundles it into CJS, so it reaches nothing but
 * `draft-book.ts` (itself import-free): no barrel, no automerge, no host global (the barrel warning in `nalu-engine.ts`).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/nalu-engine
 */
import { withoutDraftBase } from "./draft-book.js";

/** What the form reads off a change: its title, its record's tiddler fields and the bag the envelope names. A `LarTiddlerChange` fits. */
export interface NaluFormInput {
  readonly title: string;
  readonly record: { readonly tiddler: Readonly<Record<string, unknown>>; readonly meta?: { readonly deleted?: unknown } | undefined } | null;
  readonly bag?: string | undefined;
}

/** True when the change lands a tiddler; false when it deletes the title (an absent record or a tombstone). */
export function naluLands(change: NaluFormInput): boolean {
  return change.record !== null && !change.record.meta?.deleted;
}

/**
 * The wiki fields a landing change takes. A CRDT record stores its title as the document key, so the form restores `title` from
 * the envelope; the draft-base fields live on the store record alone and never reach the wiki (`draft-book.ts`); and every
 * landing annotates `$origin-bag` from the ENVELOPE, so each read can answer which bag a tiddler came from. `bag` stays user
 * space: an author's own field rides through untouched. The caller asks only for a change that lands (`naluLands`).
 */
export function naluFieldsOf(change: NaluFormInput): Record<string, unknown> & { title: string } {
  return {
    ...withoutDraftBase({ ...change.record!.tiddler }),
    title: change.title,
    ...(change.bag !== undefined ? { "$origin-bag": change.bag } : {}),
  };
}
