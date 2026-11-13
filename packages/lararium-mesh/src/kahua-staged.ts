/**
 * kahua-staged — the row a kahua lift names: one record of the face's LOCAL canon `bags/daemon-<F>`, read by title and
 * bound by its content digest, so a signed lift carries exactly what the local canon held and nothing a hand typed in.
 *
 * Memory climbs in two crossings (kahua-memory-stage#/the-recipe): working -> `daemon-<F>` (the AI or the hand stages,
 * local and unsigned: `stageKahuaRow`), then `daemon-<F>` -> `kahua-<F>` (the human lifts, signed). The lift names the
 * staged row by title and `kahuaRowDigest`; the door reads the row back, refuses `kahua-lift-unstaged` where none stands
 * and `kahua-lift-digest-moved` where the row moved since the person read it, and lifts the row's own body and fields.
 * The digest rides the signed act as one of its `sources` (`kahuaStagedSource`), so the grant covers it.
 *
 * Platform-blind: node and browser read and stage through these same functions.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { canonicalJsonBytes, sha256HexBytesSync } from "./crypto.js";
import type { LarDoc } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";
import { ownEntry, plainRecord, storedDeleted, isPrototypeKey } from "./stored-value.js";
import type { KahuaSource } from "./kahua-stage.js";

/** One staged row as a lift reads it: its body, the fields a lift may carry, and its content digest. */
export interface KahuaStagedRow {
  readonly title: string;
  readonly text: string;
  readonly fields: Readonly<Record<string, string>>;
  /** `kahuaRowDigest` over the body and fields: what a lift names, and what its grant covers. */
  readonly digest: string;
}

/** The `sources` revision prefix that names a staged row's digest on a signed lift. */
export const KAHUA_STAGED_REVISION_PREFIX = "staged:";

/** A field a staged row carries onto a lift: the stage law's own (`liftField`, kahua-stage.ts), string-valued alone. */
const carried = (k: string, v: unknown): v is string => typeof v === "string" && k !== "title" && k !== "text" && !k.startsWith("kahua-");

/** The content digest of a row: sha-256 over its body and its carried fields, key-sorted. A field that moves moves it. */
export function kahuaRowDigest(row: { readonly text: string; readonly fields: Readonly<Record<string, string>> }): string {
  const fields = Object.fromEntries(Object.entries(row.fields).filter(([k, v]) => carried(k, v)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return sha256HexBytesSync(canonicalJsonBytes({ text: row.text, fields }));
}

/** The row `title` of a local canon document, or null where none stands live (absent, a tombstone, or no body). */
export function readKahuaStagedRow(doc: LarDoc | null | undefined, title: string): KahuaStagedRow | null {
  if (title.length === 0 || isPrototypeKey(title)) return null;
  const record = ownEntry(doc?.tiddlers, title);
  if (!record || storedDeleted(record)) return null;
  const tiddler = plainRecord(record).tiddler as Record<string, unknown>;
  if (typeof tiddler["text"] !== "string") return null;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(tiddler)) if (carried(k, v)) fields[k] = v;
  const text = tiddler["text"] as string;
  return { title, text, fields, digest: kahuaRowDigest({ text, fields }) };
}

/**
 * Stage one row into a local canon document (inside a change). A row that already reads the same digest takes no write,
 * so a replay lands nothing. Answers the staged row and whether it wrote.
 */
export function stageKahuaRow(draft: LarDoc, row: { readonly title: string; readonly text: string; readonly fields?: Readonly<Record<string, string>> }, authority: string): { readonly row: KahuaStagedRow; readonly wrote: boolean } {
  if (row.title.length === 0 || isPrototypeKey(row.title)) throw new Error("kahua-stage-title: name the row's title");
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.fields ?? {})) if (carried(k, v)) fields[k] = v;
  const wanted: KahuaStagedRow = { title: row.title, text: row.text, fields, digest: kahuaRowDigest({ text: row.text, fields }) };
  if (readKahuaStagedRow(draft, row.title)?.digest === wanted.digest) return { row: wanted, wrote: false };
  draft.tiddlers[row.title] = storedLarRecord(row.title, { ...fields, text: row.text }, authority);
  return { row: wanted, wrote: true };
}

/** The source a lift of this row names: the row's title beside its digest, so the signed act covers the digest. */
export function kahuaStagedSource(row: Pick<KahuaStagedRow, "title" | "digest">): KahuaSource {
  return { title: row.title, revision: `${KAHUA_STAGED_REVISION_PREFIX}${row.digest}` };
}
