/**
 * browser-face-atom — the one key a browser vessel meets a face through (K15 step 2c, the browser half).
 *
 * The browser's place signer arms its KEL and signs no face act. Each face act signs with that
 * face's atom, a random seed no other seed derives, and the face's group secret seals to it. The seed rests in the
 * face's own custody row, `face-atom/<PersonaGroup>`, under the slot tree beside the face's other secret rows: a
 * face's secret rows take a slot first, so a vessel with no slot mints no atom. A browser that restores onto a
 * fresh origin finds no row and mints a fresh atom; the old one never resurrects.
 *
 * The record "this browser holds atom X for group G" rests as that row alone, never on a wire or a board.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-face-atom
 */
import {
  faceAtomKeyFromSeed,
  keepFaceAtomSeed,
  readFaceAtom,
  requireFaceAtomSeed,
  standFaceAtomSeed,
  type FaceAtomKey,
  type FaceAtomRows,
} from "@lararium/mesh";
import { readKeystoreRow, withCustodyRows } from "./browser-custody.js";

/** The custody row that keeps one face's atom seed. */
export const faceAtomRow = (personaGroup: string): string => {
  if (personaGroup.length === 0) throw new Error("[browser-face-atom] an atom names its PersonaGroup");
  return `face-atom/${personaGroup}`;
};

/** This browser's row store for one face atom custody contract. */
export function browserFaceAtomRows(idbName: string): FaceAtomRows {
  return {
    async read(personaGroup) {
      const held = await readKeystoreRow(idbName, faceAtomRow(personaGroup));
      return held as Uint8Array | undefined;
    },
    withRow(personaGroup, step) {
      const row = faceAtomRow(personaGroup);
      return withCustodyRows(idbName, async (rows) => step(
        await rows.read(row) as Uint8Array | undefined,
        async (seed) => { await rows.write(row, Uint8Array.from(seed)); },
      ));
    },
  };
}

/** The face's atom as it rests, or `undefined` when none was ever minted. */
export async function readBrowserFaceAtom(idbName: string, personaGroup: string): Promise<FaceAtomKey | undefined> {
  return readFaceAtom(browserFaceAtomRows(idbName), personaGroup);
}

/** The face's atom: the one at rest, or a fresh one sealed there in the same custody act when none stands. */
export async function browserFaceAtom(idbName: string, personaGroup: string): Promise<FaceAtomKey> {
  const seed = await standBrowserFaceAtomSeed(idbName, personaGroup);
  try { return faceAtomKeyFromSeed(seed, personaGroup); } finally { seed.fill(0); }
}

/** The atom seed a face rests, or a refusal by name: a boot never mints over a face whose edge names another key. */
export async function requireBrowserFaceAtomSeed(idbName: string, personaGroup: string): Promise<Uint8Array> {
  return requireFaceAtomSeed(browserFaceAtomRows(idbName), personaGroup);
}

/** The atom seed for a face being joined or founded: the one at rest, or a fresh one sealed there. The caller zeroes the copy. */
export async function standBrowserFaceAtomSeed(idbName: string, personaGroup: string): Promise<Uint8Array> {
  return standFaceAtomSeed(browserFaceAtomRows(idbName), personaGroup);
}

/** Keep the seed a founding minted under the group it founded; a row already standing must hold the same seed. */
export async function keepBrowserFaceAtomSeed(idbName: string, personaGroup: string, seed: Uint8Array): Promise<void> {
  await keepFaceAtomSeed(browserFaceAtomRows(idbName), personaGroup, seed);
}

/** The custody row that keeps one face's address secret: its working documents derive their addresses from it. */
export const faceAddressSecretRow = (personaGroup: string): string => {
  if (personaGroup.length === 0) throw new Error("[browser-face-atom] an address secret names its PersonaGroup");
  return `face-address-secret/${personaGroup}`;
};

/**
 * THE FACE'S ADDRESS SECRET MINTS AT ITS FOUNDING, beside its atom, under the same slot tree: 32 random bytes where none
 * stands; a row already standing keeps its bytes. No read mints one, and a joined browser lands the bytes its answer
 * carried (`browser-fleet-join`).
 */
export async function mintBrowserFaceAddressSecret(idbName: string, personaGroup: string): Promise<void> {
  const row = faceAddressSecretRow(personaGroup);
  await withCustodyRows(idbName, async (rows) => {
    const held = await rows.read(row);
    if (held instanceof Uint8Array && held.length === 32) return;
    if (held !== undefined) throw new Error("[browser-face-atom] the face's address secret row reads malformed");
    const fresh = crypto.getRandomValues(new Uint8Array(32));
    try { await rows.write(row, Uint8Array.from(fresh)); } finally { fresh.fill(0); }
  });
}

/** The face's address secret this browser holds (the caller zeroes the copy), or null; a read never mints. */
export async function readBrowserFaceAddressSecret(idbName: string, personaGroup: string): Promise<Uint8Array | null> {
  const held = await readKeystoreRow(idbName, faceAddressSecretRow(personaGroup));
  return held instanceof Uint8Array && held.length === 32 ? Uint8Array.from(held) : null;
}
