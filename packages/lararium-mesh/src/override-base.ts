/**
 * override-base — the canon record a working override forked from, named by its carrier identity on the override itself.
 *
 * A wiki composes its working layer (`wikis/<slug>/working`) over its canon bag (`bags/<slug>`). A hand that saves a
 * title canon holds writes a WORKING OVERRIDE: the working record shadows the canon record of the same title, and the
 * recipe stack alone decides what shows. When canon later moves underneath it (a seed's INGEST, a promotion), the copy
 * keeps shadowing, and a person deserves the word that canon now says something fresher than what the copy forked from.
 *
 * So the override REMEMBERS ITS BASE, an instrument and never a gate: the canon record's carrier identity at the moment the
 * override forked (`overrideBase`, a key on the record's `meta` envelope). The placement law picks the envelope:
 *   - it travels with the record in the record's own bag doc (one owner, one title, no sidecar map to keep in step);
 *   - it never projects: the disk projector renders a record's `tiddler` fields alone, so the base adds no byte to any
 *     file on disk (no content noise in the tracked tree);
 *   - the doc store's merge keeps a meta key a later writer omits, and the composite carries it forward onto every
 *     later write of the title, so each edit after the fork keeps the base without each write path naming it.
 *
 * THE BASE NAMES THE CANON RECORD'S CARRIER IDENTITY, never a fresh hash: `carrierHash` (`crypto.ts`), algorithm-tagged
 * `sha256:<hex>`, over the record's TW5-native canonical carrier form (its field block, a blank line, then its text: how
 * TW5 serializes a tiddler to one `.tid` file, the unpersisted residency stamps left out). That digest names every record
 * out of band, the one the disk projector's Synced tree and the INGEST gate compare for every carrier; a meme's bcc stays
 * its own in-band seal, and no other type carries one. Bases compare through `digestsEqual` alone: a bare hex names no
 * algorithm and matches nothing.
 */

import { carrierHash } from "./crypto.js";
import { digestsEqual } from "./agile-digest.js";
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** The `meta` key naming the carrier identity of the canon record a working override forked from. */
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

/** The residency stamps a carrier never persists (TW5's file serializer leaves them out). */
const UNPERSISTED_FIELDS: ReadonlySet<string> = new Set(["text", "bag", "$origin-bag"]);

/** A field's string as TW5 writes it to a field block: a list in `[[…]]` form, anything else as its string. */
function fieldString(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => { const s = String(v); return /\s/.test(s) ? `[[${s}]]` : s; }).join(" ");
  return value === undefined || value === null ? "" : String(value);
}

/**
 * The record's TW5-native canonical carrier form: the field block (every persisted field but `text`, sorted by name, one
 * `name: value` line each, as `$tw.Tiddler.getFieldStringBlock` writes it), then a blank line and the text where it holds
 * any (the `.tid` form).
 */
export function canonicalCarrierForm(tiddler: { readonly [field: string]: unknown }): string {
  const block = Object.keys(tiddler).filter((k) => !UNPERSISTED_FIELDS.has(k)).sort().map((k) => `${k}: ${fieldString(tiddler[k])}`).join("\n");
  const text = tiddler["text"];
  const body = typeof text === "string" ? text : text === undefined || text === null ? "" : String(text);
  return body === "" ? block : `${block}\n\n${body}`;
}

/** The carrier identity an override base names: `carrierHash` over the record's canonical carrier form (`sha256:<hex>`). */
export function overrideCarrierHash(tiddler: { readonly [field: string]: unknown }): string {
  return carrierHash(canonicalCarrierForm(tiddler));
}

/** Whether two bases name one carrier identity (`digestsEqual`: a bare hex, or null, matches nothing). */
export function basesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return typeof a === "string" && typeof b === "string" && digestsEqual(a, b);
}

/** The base a working record names, or null where it names none. */
export function overrideBaseOf(record: LarTiddlerRecord | null | undefined): string | null {
  const base = record?.meta?.[OVERRIDE_BASE_META];
  return typeof base === "string" && base !== "" ? base : null;
}
