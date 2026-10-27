/**
 * place-kel-board — the place KEL's public events on the Nexus carriage board.
 *
 * A place files its inception and every rotation as one tiddler per event under `PLACE_KEL_PREFIX`, keyed by the stable
 * AID and the event digest, beside the acts and the place floor pins (`place-floor-pin`). The records are public bytes: a
 * herm carries them opaque and a reader trusts none of them until `foldPlaceKel` has walked the pinned inception to a head.
 * The row's key never decides anything; the reader recomputes each digest from the event itself, so a forged key, a row
 * filed under another AID and a torn payload each read as noise and advance nothing.
 *
 * Platform-blind: rides ./base-doc, ./carriage-board, ./stored-record and ./vessel-kel alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/place-kel
 */
import type { LarDoc } from "./base-doc.js";
import { tiddlerText } from "./base-doc.js";
import { CARRIAGE_ENTRY_PREFIX } from "./carriage-board.js";
import { storedLarRecord } from "./stored-record.js";
import { acceptPlaceHead, decodePlaceKelEvent, foldPlaceKel, placeKelEventDigest, type PlaceKelEvent, type PlaceKelReading } from "./vessel-kel.js";

/** The board prefix one place's KEL events ride under. */
export const PLACE_KEL_PREFIX = `${CARRIAGE_ENTRY_PREFIX}place-kel/` as const;

/** The tiddler key one event rides under: the AID the chain answers to, then the event's own digest. */
export function placeKelKey(aid: string, event: PlaceKelEvent): string {
  return `${PLACE_KEL_PREFIX}${aid}/${placeKelEventDigest(event)}`;
}

/** Land one event onto a carriage board draft. Call INSIDE a `handle.change()` callback. Writes no trust: the reader decides. */
export function writePlaceKelEvent(draft: LarDoc, aid: string, event: PlaceKelEvent): void {
  const key = placeKelKey(aid, event);
  draft.tiddlers[key] = storedLarRecord(key, { text: JSON.stringify(event) }, "place-kel");
}

/** The most KEL rows one board read takes, and the longest payload one row may carry: a lawful event is under a kilobyte. */
export const PLACE_KEL_BOARD_ROWS = 4096;
export const PLACE_KEL_ROW_CHARS = 2048;

/** Read the rows under `prefix` in key order, bounded at the board: a payload past the byte bound is noise, and no more than the row bound parse. */
function boundedRows(doc: LarDoc | undefined | null, prefix: string): unknown[] {
  const out: unknown[] = [];
  for (const title of Object.keys(doc?.tiddlers ?? {}).filter((t) => t.startsWith(prefix)).sort()) {
    if (out.length >= PLACE_KEL_BOARD_ROWS) break;
    const text = tiddlerText(doc!.tiddlers[title]);
    if (text === null || text.length > PLACE_KEL_ROW_CHARS) continue;
    try { out.push(JSON.parse(text) as unknown); } catch { /* a torn row files nothing */ }
  }
  return out;
}

/** Every event-shaped payload filed under `aid`, unread and bounded. A torn payload files nothing. */
export function placeKelEventsFromBoard(doc: LarDoc | undefined | null, aid: string): unknown[] {
  return boundedRows(doc, `${PLACE_KEL_PREFIX}${aid}/`);
}

/** Every parseable place KEL payload on the board, across all inception AIDs, bounded. The carry reader verifies each chain. */
export function placeKelRowsFromBoard(doc: LarDoc | undefined | null): unknown[] {
  return boundedRows(doc, PLACE_KEL_PREFIX);
}

/**
 * The head a reader accepts from a board: the events filed under the pinned AID folded from the pinned inception, then held
 * against the head the reader last accepted. A row that decodes to no event never counts.
 */
export function placeKelHeadFromBoard(
  doc: LarDoc | undefined | null,
  pinned: { readonly aid: string },
  lastAccepted: { readonly aid: string; readonly seq: number; readonly headDigest: string } | null,
): PlaceKelReading {
  const events = placeKelEventsFromBoard(doc, pinned.aid).filter((raw) => decodePlaceKelEvent(raw) !== null);
  return acceptPlaceHead(lastAccepted, foldPlaceKel(events, pinned));
}
