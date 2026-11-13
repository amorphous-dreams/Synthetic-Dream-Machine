/**
 * node-circle-store — the node's LOCAL adapter for the recogniser's HANDLE-BOOK: others' nyms and the private
 * labels this vessel's reader keeps for them. It rests under the identity home, sealed under the vessel key, and
 * never federates.
 *
 * ── THE FOLLOW GRAPH LIVES ELSEWHERE, IN ONE HOME ───────────────────────────────────────────────
 * "Adding to a circle IS the follow." The graph rests on the persona-scoped circles plane, reached through the
 * daemon's circle verbs; this module holds no row of it and no file under the identity home carries an edge. The
 * handle-book stays here because it holds what a follow never publishes: which cards this vessel verified, and
 * what its reader calls them.
 *
 * The three identity stores stay distinct here as everywhere: the handle-book (others' nyms + the
 * recogniser's private labels) ⊥ the persona-petname map (the human's OWN faces) ⊥ the published glamour
 * (the ONE federated surface, deliberately posted). This module holds the first; it touches neither the
 * second nor the wire.
 *
 * ── AT REST ─────────────────────────────────────────────────────────────────────────────────────
 * The row passes through the custody seat (`custody-seat`): the one sealed writer on the way down, the sealed
 * open on the way up. At the floor both doors here refuse `CustodyLocked`.
 *
 * ── THE ROW READS WHOLE OR REFUSES ──────────────────────────────────────────────────────────────
 * Nothing at the row's path reads as a book that recognises nobody: a vessel learns it from its own acts, and a
 * lost row costs only this vessel's own memory, which the same cards teach again. A row that stands and does not
 * open (torn, bare, another key's) refuses `CustodyRowUnavailable`, and so does one that opens to another shape.
 * No reader folds a refusal to empty, so no recognition writes over a row it could not read. The book saves as a
 * whole snapshot the caller built: its acts verify cards and may call a standing vessel in between, and no
 * custody hold spans those.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/membership-doctrine#/the-two-stacks
 */

import { mkdirSync } from "node:fs";
import { HandleBook, HANDLE_BOOK_SNAPSHOT_ERA, type HandleBookSnapshot } from "@lararium/mesh";
import { CustodyRowUnavailable } from "./custody-holder.js";
import { readCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { larIdentityDir } from "./vessel-paths.js";

/** The recogniser's serialised handle-book of ONE face: others' nyms and the private labels that face keeps for them, in that face's own row. */
export const HANDLE_BOOK_FILE = /^\.handle-book-h(0|[1-9]\d*)\.json$/;
export const handleBookFile = (face: number): string => `.handle-book-h${face}.json`;

const utf8 = new TextEncoder();
function parseJson(bytes: Uint8Array, file: string): unknown {
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new CustodyRowUnavailable("identity", file, "malformed"); }
}

/** The snapshot a row's plaintext carries: this era, a record list, and every record shaped as a record. Any other shape refuses. */
function parseSnapshot(bytes: Uint8Array, file: string): HandleBookSnapshot {
  const bad = (): CustodyRowUnavailable => new CustodyRowUnavailable("identity", file, "malformed");
  const snapshot = parseJson(bytes, file) as Partial<HandleBookSnapshot> | null;
  if (!snapshot || typeof snapshot !== "object" || snapshot.era !== HANDLE_BOOK_SNAPSHOT_ERA || !Array.isArray(snapshot.records)) throw bad();
  for (const raw of snapshot.records as unknown[]) {
    const record = raw as { nym?: unknown; accepted?: unknown } | null;
    if (!record || typeof record !== "object" || typeof record.nym !== "string" || !Array.isArray(record.accepted)) throw bad();
    for (const card of record.accepted as unknown[]) {
      if (!card || typeof card !== "object" || (card as { nym?: unknown }).nym !== record.nym) throw bad();
    }
  }
  return snapshot as HandleBookSnapshot;
}

/**
 * Load the recogniser's handle-book through the async verification boundary: raw JSON never enters a recogniser
 * by constructor, and `HandleBook.restore` drops any record whose own causal closure does not verify. Nothing at
 * the path reads as a book that recognises nobody. A row that does not open, or opens to anything but a snapshot
 * of this era whose every record holds a record's shape, refuses by name.
 */
export async function loadNodeHandleBook(face: number): Promise<HandleBook> {
  const file = handleBookFile(face);
  const bytes = await readCustodyRow("identity", file);
  if (bytes === null) return new HandleBook();
  return HandleBook.restore(parseSnapshot(bytes, file));
}

/**
 * Seal the handle-book snapshot: the recogniser's private memory of others' keys and labels. The save reads what
 * stands inside its own custody hold and lands only over nothing or over a snapshot that reads whole, so a row
 * that turned unreadable since the caller loaded its book keeps its bytes.
 */
export async function saveNodeHandleBook(face: number, book: HandleBook): Promise<void> {
  mkdirSync(larIdentityDir(), { recursive: true, mode: 0o700 });
  const file = handleBookFile(face);
  const next = utf8.encode(JSON.stringify(book.snapshot(), null, 2));
  await updateCustodyRow("identity", file, (bytes) => {
    if (bytes !== null) parseSnapshot(bytes, file);
    return { plaintext: next, value: undefined };
  });
}
