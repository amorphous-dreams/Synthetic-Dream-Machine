/** Each face's atom rests in an identity row named by its PersonaGroup digest. */
import { createHash } from "node:crypto";
import { keepFaceAtomSeed, readFaceAtom, standFaceAtomSeed, type FaceAtomRecords } from "@lararium/mesh/face-atom-custody";
import { mintFaceAtomSeed } from "@lararium/mesh/face-atom";
import { tiddlerText } from "@lararium/mesh/base-doc";
import { type StoredLarRecord } from "@lararium/mesh/stored-value";
import { openCheckpoint } from "@lararium/keyhive";
import { readCustodyRecord, removeCustodyRecord, updateCustodyRecord, moveCustodyRecord, withCustodyRecords, openFaceFileNames } from "./custody-seat.js";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { FaceLocked } from "./custody-holder.js";
import { ensureFaceCustodyOfAsk } from "./face-route.js";
import { personaGroupDigest } from "./persona-group-file.js";

import { resolveFace } from "./face-selector.js";
export const FACE_ATOM_GROUP_FILE = /^face-atom-g([0-9a-f]{64})\.bin$/;
export const FACE_ATOM_ASK_FILE = /^face-atom-ask-([0-9a-f]{64})\.bin$/;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
export const faceAtomGroupFile = (group: string): string => {
  if (!group) throw new Error("face atom row names no PersonaGroup");
  return `face-atom-g${personaGroupDigest(group)}.bin`;
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

/** Retire an ask only when a group row already holds its exact seed. */
export async function sweepFoundingSeeds(): Promise<void> {
  await withCustodyRecords(async (records) => {
    const groupsByAsk = new Map<string, Set<string>>();
    for (const index of await listAnchoredPersonas(records.read)) {
      const anchors = await loadIdentityAnchors(index, records.read);
      if (!anchors?.foundingAskDigest) continue;
      const groups = groupsByAsk.get(anchors.foundingAskDigest) ?? new Set<string>();
      groups.add(faceAtomGroupFile(anchors.personaGroupId));
      groupsByAsk.set(anchors.foundingAskDigest, groups);
    }
    // The sweep walks the faces this seat names open (a face resting locked, or outside a pūlama session's lei, holds its rows
    // shut to it) and leaves the rest alone; a face that locks while the sweep reads holds its rows shut the same way.
    const names = await openFaceFileNames();
    const held = new Map<string, Uint8Array>();
    const readOpen = async (file: string): Promise<Uint8Array | null> => {
      try { return await records.read("identity", file); } catch (err) { if (err instanceof FaceLocked) return null; throw err; }
    };
    for (const file of names.filter((name) => FACE_ATOM_GROUP_FILE.test(name))) {
      const seed = await readOpen(file);
      if (seed) {
        if (seed.length !== 32) throw new Error(`group atom ${file} holds no 32-byte seed`);
        held.set(file, seed);
      }
    }
    for (const file of names.filter((name) => FACE_ATOM_ASK_FILE.test(name))) {
      const seed = await readOpen(file);
      if (seed && seed.length !== 32) throw new Error(`pending founding atom ${file} holds no 32-byte seed`);
      const digest = FACE_ATOM_ASK_FILE.exec(file)?.[1];
      if (!seed || !digest || ![...(groupsByAsk.get(digest) ?? [])].some((group) => {
        const groupSeed = held.get(group);
        return groupSeed?.length === seed.length && groupSeed.every((byte, i) => byte === seed[i]);
      })) continue;
      await records.remove("identity", file, (standing) =>
        standing.length === seed.length && standing.every((byte, i) => byte === seed[i]));
    }
  });
}

/** Read an ask seed without minting one. */
export async function loadPendingFoundingSeed(ask: FoundingAtomAsk): Promise<Uint8Array | null> {
  const seed = await readCustodyRecord("identity", pendingFoundingFile(ask));
  if (seed && seed.length !== 32) throw new Error("pending founding atom holds no 32-byte seed");
  return seed;
}

/** Adapt the custody seat's synchronous decision to the mesh row's asynchronous step. */
export const nodeFaceAtomRecords: FaceAtomRecords = {
  async read(group) { return (await readCustodyRecord("identity", faceAtomGroupFile(group))) ?? undefined; },
  async withRecord<T>(group: string, step: (standing: Uint8Array | undefined, write: (seed: Uint8Array) => Promise<void>) => Promise<T>): Promise<T> {
    let result: Promise<T> | undefined;
    let deciding = false;
    await updateCustodyRecord("identity", faceAtomGroupFile(group), (standing) => {
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
  const seed = await nodeFaceAtomRecords.read(group);
  if (seed && seed.length !== 32) throw new Error(`the atom row for ${group} holds no 32-byte seed`);
  return seed ?? null;
}

/** Keep one group's founding seed, refusing any different seed. */
export function keepFaceAtom(group: string, seed: Uint8Array): Promise<"minted" | "kept"> {
  return keepFaceAtomSeed(nodeFaceAtomRecords, group, seed);
}

/** Mint or read one group's seed; the caller zeroes its copy. */
export function standFaceAtom(group: string): Promise<Uint8Array> {
  return standFaceAtomSeed(nodeFaceAtomRecords, group);
}

/** Read a compartment's group from its anchors, then read that group's atom. */
export async function loadFaceAtom(handleIndex: number): Promise<Uint8Array | null> {
  const anchors = await loadIdentityAnchors(handleIndex);
  return anchors ? loadFaceAtomOfGroup(anchors.personaGroupId) : null;
}

/** Mint or read the seed for this exact founding ask before a group exists. */
export async function standPendingFoundingSeed(ask: FoundingAtomAsk): Promise<Uint8Array> {
  // THE FACE'S CUSTODY STANDS BEFORE ITS FIRST ROW, under the route the face asks for; the ask names it until a group exists.
  await ensureFaceCustodyOfAsk(foundingAskDigest(ask), `h${ask.handleIndex}`, ask.handleIndex);
  return updateCustodyRecord("identity", pendingFoundingFile(ask), (standing) => {
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
  await removeCustodyRecord("identity", pendingFoundingFile(ask));
}

/** Hand the founding seed from its ask row to its group row under one custody claim. */
export async function keepAndRetireFoundingSeed(group: string, ask: FoundingAtomAsk, seed: Uint8Array): Promise<void> {
  if (seed.length !== 32) throw new Error("founding atom holds no 32-byte seed");
  await moveCustodyRecord("identity", pendingFoundingFile(ask), faceAtomGroupFile(group), seed);
}

/**
 * An interrupted handoff leaves its seed in a group row before anchors land. Open the founding checkpoint
 * with each unanchored group seed; its authenticated scope and group id select the one this ask can resume.
 */
export async function recoverFoundingSeedFromGroup(
  ask: FoundingAtomAsk, checkpoints: Readonly<Record<string, unknown>>,
): Promise<Uint8Array | null> {
  return (await recoverFoundingGroup(ask, checkpoints))?.seed ?? null;
}

/** Whether a founding checkpoint for this ask, opened under `seed`, names `group`: the founding of that group stands interrupted
 *  (a completed founding retires its checkpoint with its bootstrap entry). */
export async function foundingCheckpointNames(
  ask: FoundingAtomAsk, checkpoints: Readonly<Record<string, unknown>>, seed: Uint8Array, group: string,
): Promise<boolean> {
  const scope = JSON.stringify([ask.hearthTrueName, ask.bindingMode, ask.personaKelPrefix, ask.mount, foundingAskDigest(ask)]);
  const prefix = "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/";
  for (const [title, record] of Object.entries(checkpoints)) {
    if (!title.startsWith(prefix)) continue;
    const body = tiddlerText(record as StoredLarRecord);
    if (body === null) continue;
    try {
      const checkpoint = await openCheckpoint(body, seed) as { scope?: unknown; result?: { personaGroupId?: unknown } };
      if (checkpoint.scope === scope && checkpoint.result?.personaGroupId === group) return true;
    } catch { /* another seed's checkpoint */ }
  }
  return false;
}

/** The interrupted founding this ask resumes, as `recoverFoundingSeedFromGroup` finds it: its group seed and the group its checkpoint names. */
export async function recoverFoundingGroup(
  ask: FoundingAtomAsk, checkpoints: Readonly<Record<string, unknown>>,
): Promise<{ readonly seed: Uint8Array; readonly group: string } | null> {
  const scope = JSON.stringify([ask.hearthTrueName, ask.bindingMode, ask.personaKelPrefix, ask.mount, foundingAskDigest(ask)]);
  const prefix = "lar:///ha.ka.ba/dreamnet/face-founding-checkpoint/";
  const bodies = Object.entries(checkpoints).filter(([title]) => title.startsWith(prefix))
    .map(([, record]) => tiddlerText(record as StoredLarRecord))
    .filter((body): body is string => body !== null);
  if (bodies.length === 0) return null;
  const anchored = new Set<string>();
  for (const index of await listAnchoredPersonas()) {
    const anchors = await loadIdentityAnchors(index);
    if (anchors) anchored.add(anchors.personaGroupId);
  }
  let matched: { seed: Uint8Array; group: string } | null = null;
  // The group rows of the faces this seat serves alone (`openFaceFileNames`): a face outside the lend holds its rows shut.
  for (const file of (await openFaceFileNames()).filter((name) => FACE_ATOM_GROUP_FILE.test(name))) {
    const seed = await readCustodyRecord("identity", file);
    if (!seed || seed.length !== 32) throw new Error(`group atom ${file} holds no 32-byte seed`);
    for (const body of bodies) {
      let checkpoint: { scope?: unknown; result?: { personaGroupId?: unknown } };
      try { checkpoint = await openCheckpoint(body, seed); } catch { continue; }
      const group = checkpoint.result?.personaGroupId;
      if (checkpoint.scope !== scope || typeof group !== "string" || anchored.has(group) || faceAtomGroupFile(group) !== file) continue;
      if (matched) throw new Error("founding ask opens more than one unanchored group");
      matched = { seed, group };
    }
  }
  return matched;
}

/** The acting face's atom key (`face`, else the one face standing open) names its local realm and edge ledgers. */
export async function loadFaceAtomKey(face?: number): Promise<string> {
  const index = await resolveFace(face);
  const anchors = await loadIdentityAnchors(index);
  if (!anchors) throw new Error("this face holds no atom; re-found or re-admit it");
  const atom = await readFaceAtom(nodeFaceAtomRecords, anchors.personaGroupId);
  if (!atom) throw new Error("this face holds no atom; re-found or re-admit it");
  return atom.key;
}
