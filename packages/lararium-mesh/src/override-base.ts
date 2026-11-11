/**
 * override-base — the canon text a working override forked from, carried on the override itself.
 *
 * A wiki composes its working layer (`wikis/<slug>/working`) over its canon bag (`bags/<slug>`). A hand that saves a
 * title canon holds writes a WORKING OVERRIDE: the working record shadows the canon record of the same title, and the
 * recipe stack alone decides what shows. When canon later moves underneath it (a seed's INGEST, a promotion), the copy
 * keeps shadowing, and a person deserves the word that canon now says something fresher than what the copy forked from.
 *
 * So the override REMEMBERS ITS BASE, an instrument and never a gate: the hash of the canon record's text at the moment the override forked
 * (`overrideBase`, a key on the record's `meta` envelope). The placement law picks the envelope:
 *   - it travels with the record in the record's own bag doc (one owner, one title, no sidecar map to keep in step);
 *   - it never projects: the disk projector renders a record's `tiddler` fields alone, so the base adds no byte to any
 *     file on disk (no content noise in the tracked tree);
 *   - the doc store's merge keeps a meta key a later writer omits, and the composite carries it forward onto every
 *     later write of the title, so each edit after the fork keeps the base without each write path naming it.
 *
 * The hash reads the record's `text` alone: the question reads "does canon's text still say what it said when the copy
 * forked?", and a title's other fields (modified, revision) move on every save.
 */

import { sha256HexBytesSync } from "./crypto.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** The `meta` key naming the canon text hash a working override forked from. */
export const OVERRIDE_BASE_META = "overrideBase";

const WORKING_LAYER = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/working$/;
const CANON_BAG = /^lar:\/\/\/ha\.ka\.ba\/bags\/([^/]+)$/;

/** Whether `bag` names a wiki's working layer (`lar:///ha.ka.ba/wikis/<slug>/working`). */
export function isWorkingLayerBag(bag: string): boolean {
  return WORKING_LAYER.test(bag);
}

/** The working layer of the wiki a canon bag opens as (`bags/<slug>` → `wikis/<slug>/working`), or null. */
export function workingLayerOfCanon(canonBag: string): string | null {
  const m = CANON_BAG.exec(canonBag);
  return m ? `lar:///ha.ka.ba/wikis/${m[1]}/working` : null;
}

/** The canon bag a working layer composes over (`wikis/<slug>/working` → `bags/<slug>`), or null. */
export function canonOfWorkingLayer(workingBag: string): string | null {
  const m = WORKING_LAYER.exec(workingBag);
  return m ? `lar:///ha.ka.ba/bags/${m[1]}` : null;
}

/** The hash an override base names: sha-256 over the record's `text`, tagged. */
export function overrideTextHash(tiddler: { readonly [field: string]: unknown }): string {
  const text = tiddler["text"];
  return `sha256:${sha256HexBytesSync(new TextEncoder().encode(typeof text === "string" ? text : text === undefined || text === null ? "" : String(text)))}`;
}

/** The base a working record names, or null where it names none. */
export function overrideBaseOf(record: LarTiddlerRecord | null | undefined): string | null {
  const base = record?.meta?.[OVERRIDE_BASE_META];
  return typeof base === "string" && base !== "" ? base : null;
}
