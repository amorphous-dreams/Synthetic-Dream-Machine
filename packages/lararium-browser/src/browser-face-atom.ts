/**
 * browser-face-atom — the one key a browser vessel meets a face through (K15 step 2c, the browser half).
 *
 * The browser holds no place signer and signs no face act with the device seed. Each face act signs with that
 * face's atom, a random seed no other seed derives, and the face's group secret seals to it. The seed rests in the
 * face's own custody row, `face-atom/<PersonaGroup>`, under the slot tree beside the face's other secret rows: a
 * face's secret rows take a slot first, so a vessel with no slot mints no atom. A browser that restores onto a
 * fresh origin finds no row and mints a fresh atom; the old one never resurrects.
 *
 * The record "this browser holds atom X for group G" rests as that row alone, never on a wire or a board.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-face-atom
 */
import { faceAtomKeyFromSeed, mintFaceAtomSeed, type FaceAtomKey } from "@lararium/mesh";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";

/** The custody row that keeps one face's atom seed. */
export const faceAtomRow = (personaGroup: string): string => {
  if (personaGroup.length === 0) throw new Error("[browser-face-atom] an atom names its PersonaGroup");
  return `face-atom/${personaGroup}`;
};

const seedOf = (held: unknown, personaGroup: string): Uint8Array => {
  if (!(held instanceof Uint8Array) || held.length !== 32) throw new Error(`[browser-face-atom] the atom row for ${personaGroup} holds no 32-byte seed`);
  return Uint8Array.from(held);
};

/** The face's atom as it rests, or `undefined` when none was ever minted. */
export async function readBrowserFaceAtom(idbName: string, personaGroup: string): Promise<FaceAtomKey | undefined> {
  const held = await readKeystoreRow(idbName, faceAtomRow(personaGroup));
  if (held === undefined) return undefined;
  const seed = seedOf(held, personaGroup);
  try { return faceAtomKeyFromSeed(seed, personaGroup); } finally { seed.fill(0); }
}

/** The face's atom: the one at rest, or a fresh one sealed there in the same custody act when none stands. */
export async function browserFaceAtom(idbName: string, personaGroup: string): Promise<FaceAtomKey> {
  const row = faceAtomRow(personaGroup);
  return withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(row);
    const seed = standing === undefined ? mintFaceAtomSeed() : seedOf(standing, personaGroup);
    try {
      // The key builds before the seed rests: a seed that makes no key never lands in a row.
      const atom = faceAtomKeyFromSeed(seed, personaGroup);
      if (standing === undefined) await rows.write(row, seed);
      return atom;
    } finally { seed.fill(0); }
  });
}

/** A face that holds no atom here: its edge delegates to a key this browser cannot sign as. */
export class BrowserFaceAtomMissing extends Error {
  override readonly name = "BrowserFaceAtomMissing";
  constructor(readonly personaGroup: string) {
    super(`this face holds no atom; re-found or re-admit it (${personaGroup})`);
  }
}

/** The atom seed a face rests, or a refusal by name: a boot never mints over a face whose edge names another key. */
export async function requireBrowserFaceAtomSeed(idbName: string, personaGroup: string): Promise<Uint8Array> {
  const held = await readKeystoreRow(idbName, faceAtomRow(personaGroup));
  if (held === undefined) throw new BrowserFaceAtomMissing(personaGroup);
  return seedOf(held, personaGroup);
}

/** The atom seed for a face being joined or founded: the one at rest, or a fresh one sealed there. The caller zeroes the copy. */
export async function standBrowserFaceAtomSeed(idbName: string, personaGroup: string): Promise<Uint8Array> {
  const row = faceAtomRow(personaGroup);
  return withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(row);
    if (standing !== undefined) return seedOf(standing, personaGroup);
    const seed = mintFaceAtomSeed();
    faceAtomKeyFromSeed(seed, personaGroup);
    await rows.write(row, seed);
    const copy = Uint8Array.from(seed);
    seed.fill(0);
    return copy;
  });
}

/** Keep the seed a founding minted under the group it founded; a row already standing must hold the same seed. */
export async function keepBrowserFaceAtomSeed(idbName: string, personaGroup: string, seed: Uint8Array): Promise<void> {
  const row = faceAtomRow(personaGroup);
  faceAtomKeyFromSeed(seed, personaGroup);
  await withCustodyRows(idbName, async (rows) => {
    const standing = await rows.read(row);
    if (standing === undefined) { await rows.write(row, seed); return; }
    const held = seedOf(standing, personaGroup);
    const same = held.length === seed.length && held.every((b, i) => b === seed[i]);
    held.fill(0);
    if (!same) throw new Error(`[browser-face-atom] the atom row for ${personaGroup} holds another seed than the one this founding minted`);
  });
}
