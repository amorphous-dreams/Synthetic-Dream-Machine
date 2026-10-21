/** Keep each face's atom under its PersonaGroup label in a host's custody rows. */
import { faceAtomKeyFromSeed, mintFaceAtomSeed, type FaceAtomKey } from "./face-atom.js";

export interface FaceAtomRows {
  read(personaGroup: string): Promise<Uint8Array | undefined>;
  /** Hold one group's read, decision and optional write as one act. */
  withRow<T>(personaGroup: string, step: (standing: Uint8Array | undefined, write: (seed: Uint8Array) => Promise<void>) => Promise<T>): Promise<T>;
}

/** A row already holds a different seed for this face. */
export class FaceAtomConflict extends Error {
  override readonly name = "FaceAtomConflict";
  constructor(readonly personaGroup: string) {
    super(`the atom row for ${personaGroup} holds another seed`);
  }
}

/** A face with no local atom cannot sign for an existing edge. */
export class FaceAtomMissing extends Error {
  override readonly name = "FaceAtomMissing";
  constructor(readonly personaGroup: string) {
    super(`this face holds no atom; re-found or re-admit it (${personaGroup})`);
  }
}

function seedOf(held: Uint8Array, personaGroup: string): Uint8Array {
  if (!(held instanceof Uint8Array) || held.length !== 32) throw new Error(`the atom row for ${personaGroup} holds no 32-byte seed`);
  return Uint8Array.from(held);
}

function requireGroup(personaGroup: string): void {
  if (personaGroup.length === 0) throw new Error("face-atom: an atom names its PersonaGroup");
}

/** Read the key of the seed at rest without handing its bytes to the caller. */
export async function readFaceAtom(rows: FaceAtomRows, personaGroup: string): Promise<FaceAtomKey | undefined> {
  requireGroup(personaGroup);
  const held = await rows.read(personaGroup);
  if (held === undefined) return undefined;
  const seed = seedOf(held, personaGroup);
  try { return faceAtomKeyFromSeed(seed, personaGroup); } finally { seed.fill(0); }
}

/** Read a copy of the atom seed; the caller zeroes it. */
export async function requireFaceAtomSeed(rows: FaceAtomRows, personaGroup: string): Promise<Uint8Array> {
  requireGroup(personaGroup);
  const held = await rows.read(personaGroup);
  if (held === undefined) throw new FaceAtomMissing(personaGroup);
  return seedOf(held, personaGroup);
}

/** Return the held seed, or mint and keep one within the row's custody act. The caller zeroes the copy. */
export async function standFaceAtomSeed(rows: FaceAtomRows, personaGroup: string): Promise<Uint8Array> {
  requireGroup(personaGroup);
  return rows.withRow(personaGroup, async (standing, write) => {
    if (standing !== undefined) return seedOf(standing, personaGroup);
    const seed = mintFaceAtomSeed();
    try {
      faceAtomKeyFromSeed(seed, personaGroup);
      await write(seed);
      return Uint8Array.from(seed);
    } finally { seed.fill(0); }
  });
}

/** Keep a founding seed once, and refuse a different seed without changing the row. */
export async function keepFaceAtomSeed(rows: FaceAtomRows, personaGroup: string, seed: Uint8Array): Promise<"minted" | "kept"> {
  faceAtomKeyFromSeed(seed, personaGroup);
  return rows.withRow(personaGroup, async (standing, write) => {
    if (standing === undefined) { await write(Uint8Array.from(seed)); return "minted"; }
    const held = seedOf(standing, personaGroup);
    try {
      if (held.some((byte, i) => byte !== seed[i])) throw new FaceAtomConflict(personaGroup);
      return "kept";
    } finally { held.fill(0); }
  });
}
