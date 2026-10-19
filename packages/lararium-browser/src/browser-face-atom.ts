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
