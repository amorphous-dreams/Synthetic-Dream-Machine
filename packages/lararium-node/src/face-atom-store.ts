/** Each face's atom rests in an identity row named by its PersonaGroup digest. */
import { createHash } from "node:crypto";
import { keepFaceAtomSeed, mintFaceAtomSeed, readFaceAtom, standFaceAtomSeed, type FaceAtomRows } from "@lararium/mesh";
import { readCustodyRow, removeCustodyRow, updateCustodyRow } from "./custody-seat.js";
import { loadActivePersonaIndex } from "./node-vessel-identity.js";
import { loadIdentityAnchors } from "./identity-anchors.js";

export const FACE_ATOM_GROUP_FILE = /^face-atom-g([0-9a-f]{64})\.bin$/;
export const FACE_ATOM_ASK_FILE = /^face-atom-ask-([0-9a-f]{64})\.bin$/;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
export const faceAtomGroupFile = (group: string): string => {
  if (!group) throw new Error("face atom row names no PersonaGroup");
  return `face-atom-g${digest(group)}.bin`;
};

/** The founding checkpoint's ask, with the compartment included in its custody name. */
export interface FoundingAtomAsk {
  readonly hearthTrueName: string;
  readonly bindingMode: "self-stood" | "contracted";
  readonly personaKelPrefix: string | null;
  readonly mount: boolean;
  readonly handleIndex: number;
}

export function foundingAskDigest(ask: FoundingAtomAsk): string {
  if (!Number.isSafeInteger(ask.handleIndex) || ask.handleIndex < 0) throw new Error("founding ask names no compartment");
  return digest(JSON.stringify([ask.hearthTrueName, ask.bindingMode, ask.personaKelPrefix, ask.mount, ask.handleIndex]));
}

export const pendingFoundingFile = (ask: FoundingAtomAsk): string => `face-atom-ask-${foundingAskDigest(ask)}.bin`;

/** Read an ask seed without minting one. */
export async function loadPendingFoundingSeed(ask: FoundingAtomAsk): Promise<Uint8Array | null> {
  const seed = await readCustodyRow("identity", pendingFoundingFile(ask));
  if (seed && seed.length !== 32) throw new Error("pending founding atom holds no 32-byte seed");
  return seed;
}

/** Adapt the custody seat's synchronous decision to the mesh row's asynchronous step. */
export const nodeFaceAtomRows: FaceAtomRows = {
  async read(group) { return (await readCustodyRow("identity", faceAtomGroupFile(group))) ?? undefined; },
  async withRow<T>(group: string, step: (standing: Uint8Array | undefined, write: (seed: Uint8Array) => Promise<void>) => Promise<T>): Promise<T> {
    let result: Promise<T> | undefined;
    let deciding = false;
    await updateCustodyRow("identity", faceAtomGroupFile(group), (standing) => {
      let next: Uint8Array | null = null;
      deciding = true;
      result = step(standing ?? undefined, async (seed) => {
        if (!deciding) throw new Error("face atom row write left its custody decision");
        next = Uint8Array.from(seed);
      });
      void result.catch(() => undefined);
      deciding = false;
      return { plaintext: next, value: undefined };
    });
    return await result!;
  },
};

/** Read a group's held seed; the caller zeroes its copy. */
export async function loadFaceAtomOfGroup(group: string): Promise<Uint8Array | null> {
  const seed = await nodeFaceAtomRows.read(group);
  if (seed && seed.length !== 32) throw new Error(`the atom row for ${group} holds no 32-byte seed`);
  return seed ?? null;
}

/** Keep one group's founding seed, refusing any different seed. */
export function keepFaceAtom(group: string, seed: Uint8Array): Promise<"minted" | "kept"> {
  return keepFaceAtomSeed(nodeFaceAtomRows, group, seed);
}

/** Mint or read one group's seed; the caller zeroes its copy. */
export function standFaceAtom(group: string): Promise<Uint8Array> {
  return standFaceAtomSeed(nodeFaceAtomRows, group);
}

/** Read a compartment's group from its anchors, then read that group's atom. */
export async function loadFaceAtom(handleIndex: number): Promise<Uint8Array | null> {
  const anchors = await loadIdentityAnchors(handleIndex);
  return anchors ? loadFaceAtomOfGroup(anchors.personaGroupId) : null;
}

/** Mint or read the seed for this exact founding ask before a group exists. */
export async function standPendingFoundingSeed(ask: FoundingAtomAsk): Promise<Uint8Array> {
  return updateCustodyRow("identity", pendingFoundingFile(ask), (standing) => {
    if (standing) {
      if (standing.length !== 32) throw new Error("pending founding atom holds no 32-byte seed");
      return { plaintext: null, value: Uint8Array.from(standing) };
    }
    const seed = mintFaceAtomSeed();
    return { plaintext: seed, value: Uint8Array.from(seed) };
  });
}

/** Clear the ask row after the group row keeps its seed. */
export async function retirePendingFoundingSeed(ask: FoundingAtomAsk): Promise<void> {
  await removeCustodyRow("identity", pendingFoundingFile(ask));
}

/** The active face's atom key names its local realm and edge ledgers. */
export async function loadWornFaceAtomKey(): Promise<string> {
  const index = (await loadActivePersonaIndex()) ?? 0;
  const anchors = await loadIdentityAnchors(index);
  if (!anchors) throw new Error("this face holds no atom; re-found or re-admit it");
  const atom = await readFaceAtom(nodeFaceAtomRows, anchors.personaGroupId);
  if (!atom) throw new Error("this face holds no atom; re-found or re-admit it");
  return atom.key;
}
