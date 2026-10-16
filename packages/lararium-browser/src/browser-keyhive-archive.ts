/**
 * browser-keyhive-archive — where a browser vessel keeps the keyhive Archives its foundings hand out.
 *
 * A keyhive Archive holds an identity's prekey secrets and the key agreement state of every document it
 * created. Cap events carry the membership lattice and never that state, so a creator that stands again from
 * its seed and the replayed events alone knows its documents and can seal nothing into them. The founding and
 * the admit therefore hand their Archives out, and this shore keeps them.
 *
 * WHERE THEY REST: the vessel's own IndexedDB `keystore`, beside the device seed. Until a slot binds, both rest
 * in the clear; once one does, both rest sealed under the vessel key and read only through this page's unlock
 * (`browser-custody.ts`). Every read and write here rides that one row door, so an Archive never lands in the
 * clear beside a slot tree, and a sealed keystore with no unlock refuses `sealed-locked` by name.
 *
 * READING: a row that never stood reads `undefined`. A row that stands and holds anything other than bytes
 * refuses `BrowserArchiveRowUnreadable` by row name: nothing reads a torn row as an empty one, and nothing
 * mints an identity over it.
 *
 * Rows: `keyhive-archive` (the vessel individual) · `veil-archive-h<N>` (face N's creator-veil).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-keyhive-archive
 */
import { readKeystoreRow, writeKeystoreRow } from "./browser-custody.js";

const VESSEL_ARCHIVE_ROW = "keyhive-archive";

/** The row that keeps face `handleIndex`'s creator-veil Archive. */
export function browserVeilArchiveRow(handleIndex: number): string {
  if (!Number.isSafeInteger(handleIndex) || handleIndex < 0) {
    throw new Error(`[browser-keyhive-archive] a veil archive row names a face index; got ${String(handleIndex)}`);
  }
  return `veil-archive-h${handleIndex}`;
}

/** A row that stands and does not hold Archive bytes. */
export class BrowserArchiveRowUnreadable extends Error {
  override readonly name = "BrowserArchiveRowUnreadable";
  constructor(readonly row: string) {
    super(`[browser-keyhive-archive] the ${row} row stands in the keystore and holds no Archive bytes; nothing stands over it`);
  }
}

async function readRow(idbName: string, row: string): Promise<Uint8Array | undefined> {
  const held = await readKeystoreRow(idbName, row);
  if (held === undefined) return undefined;
  if (!(held instanceof Uint8Array) || held.byteLength === 0) throw new BrowserArchiveRowUnreadable(row);
  return held;
}

async function writeRow(idbName: string, row: string, bytes: Uint8Array): Promise<void> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error(`[browser-keyhive-archive] refusing to keep an empty Archive in the ${row} row`);
  }
  // THE WRITE RETURNS WHEN ITS TRANSACTION COMPLETES, never at the request's success: a later write in another
  // transaction (the bootstrap that commits a founding) may then never land ahead of this row. The door copies the
  // caller's buffer, which may belong to a wasm heap that moves under it.
  await writeKeystoreRow(idbName, row, bytes);
}

/** A founded vessel whose keystore holds no Archive for its own individual. */
export class BrowserArchiveRowMissing extends Error {
  override readonly name = "BrowserArchiveRowMissing";
  constructor(readonly row: string, idbName: string) {
    super(`[browser-keyhive-archive] the vessel "${idbName}" stands founded and its keystore holds no ${row} row. ` +
      `Its individual would stand from the seed alone and could seal nothing into a document it created; no reader ` +
      `rebuilds the row. Clear this origin's site data and found the vessel again.`);
  }
}

/** The vessel individual's Archive for a vessel whose bootstrap stands: the bytes, or a refusal by row name. */
export async function requireBrowserKeyhiveArchive(idbName: string): Promise<Uint8Array> {
  const held = await readRow(idbName, VESSEL_ARCHIVE_ROW);
  if (!held) throw new BrowserArchiveRowMissing(VESSEL_ARCHIVE_ROW, idbName);
  return held;
}

/** The vessel individual's Archive as it rests, or `undefined` when none ever stood. */
export function loadBrowserKeyhiveArchive(idbName = "lares:vessel"): Promise<Uint8Array | undefined> {
  return readRow(idbName, VESSEL_ARCHIVE_ROW);
}

/** Keep the vessel individual's Archive. */
export function saveBrowserKeyhiveArchive(idbName: string, bytes: Uint8Array): Promise<void> {
  return writeRow(idbName, VESSEL_ARCHIVE_ROW, bytes);
}

/** Face `handleIndex`'s creator-veil Archive as it rests, or `undefined` when none ever stood. */
export function loadBrowserVeilArchive(idbName = "lares:vessel", handleIndex = 0): Promise<Uint8Array | undefined> {
  return readRow(idbName, browserVeilArchiveRow(handleIndex));
}

/** Keep face `handleIndex`'s creator-veil Archive. */
export function saveBrowserVeilArchive(idbName: string, handleIndex: number, bytes: Uint8Array): Promise<void> {
  return writeRow(idbName, browserVeilArchiveRow(handleIndex), bytes);
}
