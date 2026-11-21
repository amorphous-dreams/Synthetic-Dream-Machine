/**
 * browser-keyhive-archive — where a browser vessel keeps the keyhive Archives its foundings hand out.
 *
 * A keyhive Archive holds an identity's prekey secrets and the key agreement state of every document it
 * created. Cap events carry the membership lattice and never that state, so a creator that stands again from
 * its seed and the replayed events alone knows its documents and can seal nothing into them. The founding and
 * the admit therefore hand their Archives out, and this shore keeps them.
 *
 * WHERE THEY REST: the vessel's own IndexedDB `keystore`. Until a slot binds, the veil archive may rest
 * in the clear; once one does, it rests sealed under the vessel key and reads only through this page's unlock
 * (`browser-custody.ts`). Every read and write here rides that one row door, so an Archive never lands in the
 * clear beside a slot tree, and a sealed keystore with no unlock refuses `sealed-locked` by name.
 *
 * READING: a row that never stood reads `undefined`. A row that stands and holds anything other than bytes
 * refuses `BrowserArchiveRowUnreadable` by row name: nothing reads a torn row as an empty one, and nothing
 * mints an identity over it.
 *
 * Row: `veil-archive-g<PersonaGroup>` (a face's creator-veil).
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-keyhive-archive
 */
import { readKeystoreRecord, writeKeystoreRecord } from "./browser-custody.js";
import { requireArchiveOf } from "@lararium/keyhive";
import { requireBrowserFaceAtomSeed } from "./browser-face-atom.js";

/** The row that keeps one PersonaGroup's creator-veil Archive. */
export function browserVeilArchiveRow(personaGroup: string): string {
  if (!personaGroup) throw new Error("[browser-keyhive-archive] a veil archive row names its PersonaGroup");
  return `veil-archive-g${personaGroup}`;
}

/** A row that stands and does not hold Archive bytes. */
export class BrowserArchiveRowUnreadable extends Error {
  override readonly name = "BrowserArchiveRowUnreadable";
  constructor(readonly row: string) {
    super(`[browser-keyhive-archive] the ${row} row stands in the keystore and holds no Archive bytes; nothing stands over it`);
  }
}

async function readRow(idbName: string, row: string): Promise<Uint8Array | undefined> {
  const held = await readKeystoreRecord(idbName, row);
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
  await writeKeystoreRecord(idbName, row, bytes);
}

/** A PersonaGroup's creator-veil Archive as it rests, or `undefined` when none ever stood. */
export function loadBrowserVeilArchive(idbName: string, personaGroup: string): Promise<Uint8Array | undefined> {
  return readRow(idbName, browserVeilArchiveRow(personaGroup));
}

/**
 * Keep a PersonaGroup's creator-veil Archive. THE SEAL PROVES THE BYTES: the face's atom seed stands a throwaway provider over
 * them (`requireArchiveOf`) before the row moves, so an Archive of another identity refuses `ArchiveIdentityMismatch`, one that
 * does not decode refuses its own fault, and a face holding no atom refuses; the row stands unchanged on every refusal. Every
 * writer passes here: the founding, the admit and the lift's custody write alike.
 */
export async function saveBrowserVeilArchive(idbName: string, personaGroup: string, bytes: Uint8Array): Promise<void> {
  const row = browserVeilArchiveRow(personaGroup);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error(`[browser-keyhive-archive] refusing to keep an empty Archive in the ${row} row`);
  }
  const seed = await requireBrowserFaceAtomSeed(idbName, personaGroup);
  try { await requireArchiveOf(seed, bytes); } finally { seed.fill(0); }
  await writeRow(idbName, row, bytes);
}
