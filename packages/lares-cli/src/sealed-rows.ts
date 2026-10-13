/**
 * sealed-rows — a command's readers and writers over the vessel's sealed rows, each one an act on the custody door.
 *
 * A command never opens a sealed row by a node function of its own: it asks `sealedAct` (`sealed-act-door`), which
 * runs the act inside the standing vessel when one answers and in this process otherwise. This module spells the
 * acts a command needs as the shapes commands already hold: the roster, the two own-persona stores, the
 * handle-book, and the seal ceremony's hand, which signs as a held persona root while the seed stays behind the door.
 */
import {
  HandleBook, type HandleBookSnapshot, type OwnPersonaPetnameStore, type PersonaDeclaration, type PersonaDeclarationStore,
  type RecoveryShare,
} from "@lararium/mesh";
import type { SealReserveState } from "@lararium/node";
import { sealedAct } from "./sealed-act-door.js";

/** The roster as one read: each held root's index and public key, the worn index, and every orphan root. */
export interface PersonaRoots {
  readonly roots:   ReadonlyArray<{ readonly handleIndex: number; readonly verifyingKey: string }>;
  readonly active:  number | null;
  readonly orphans: readonly number[];
}

/** Read the roster. It opens no root row and never mints. */
export function readPersonaRoots(): Promise<PersonaRoots> {
  return sealedAct<PersonaRoots>("persona.roots");
}

/** The public key of the persona root held at `handleIndex`, or undefined when this vessel holds none there. */
export async function personaRootKey(handleIndex: number): Promise<string | undefined> {
  return (await readPersonaRoots()).roots.find((r) => r.handleIndex === handleIndex)?.verifyingKey;
}

/** This vessel's own private labels for its faces, as the store shape a fleet mirror wraps. */
export function sealedPetnameStore(): OwnPersonaPetnameStore {
  const entries = async () => (await sealedAct<{ entries: Array<[number, string]> }>("petname.entries")).entries;
  return {
    get: async (handleIndex) => (await entries()).find(([i]) => i === handleIndex)?.[1],
    set: async (handleIndex, petname) => { await sealedAct("petname.set", { handleIndex, petname }); },
    clear: async (handleIndex) => { await sealedAct("petname.clear", { handleIndex }); },
    entries,
  };
}

/** Each face's declared Handle, seat claim and chair label, as the store shape a fleet mirror wraps. */
export function sealedDeclarationStore(): PersonaDeclarationStore {
  const entries = async () => (await sealedAct<{ entries: Array<[number, PersonaDeclaration]> }>("declaration.entries")).entries;
  return {
    get: async (handleIndex) => (await entries()).find(([i]) => i === handleIndex)?.[1],
    set: async (handleIndex, declaration) => { await sealedAct("declaration.set", { handleIndex, declaration: { ...declaration } }); },
    clear: async (handleIndex) => { await sealedAct("declaration.clear", { handleIndex }); },
    entries,
  };
}

/**
 * The root key of the face this vessel wears, or undefined where it wears none it holds a root for. A recognition
 * made while a face stands worn rests under that face's tag in the handle-book, so that face's backup bundle
 * carries it; made under no worn face, it rests untagged and stays on this vessel.
 */
export async function wornFaceKey(): Promise<string | undefined> {
  const roster = await readPersonaRoots();
  return roster.active === null ? undefined : roster.roots.find((r) => r.handleIndex === roster.active)?.verifyingKey;
}

/** Load the recogniser's handle-book: the snapshot crosses the recogniser's own verification on the way in. */
export async function loadHandleBook(): Promise<HandleBook> {
  const { snapshot } = await sealedAct<{ snapshot: HandleBookSnapshot }>("handle-book.load");
  return HandleBook.restore(snapshot);
}

/** Seal the recogniser's handle-book as it stands. */
export async function saveHandleBook(book: HandleBook): Promise<void> {
  await sealedAct("handle-book.save", { snapshot: book.snapshot() });
}

/** The charter reserve's state: the pre-rotation commit and the guardian labels. Null where no reserve stands. */
export async function readReserveState(): Promise<SealReserveState | null> {
  return (await sealedAct<{ state: SealReserveState | null }>("reserve.state")).state;
}

/**
 * Seal the operator's own share of a reserve seed and the state that commits it. The frame carries ONE share,
 * which alone rebuilds nothing; the seed and the two guardian shares stay in the command's own process.
 */
export async function provisionReserve(share: RecoveryShare, state: SealReserveState): Promise<void> {
  await sealedAct("reserve.provision", {
    share: { x: share.bytes.x, ys: [...share.bytes.ys], custodian: share.custodian, recoveryEpoch: share.recoveryEpoch },
    state: { ...state },
  });
}

/**
 * A hand of the seal ceremony's ROLL: it signs as the persona root held at one index, and the seed stays behind
 * the custody door. The door reads the charter that stands and signs only a roll its standing head licenses; it
 * signs no other image. (A crossing's marks ride the rite's own acts, which take no image at all.)
 */
export interface SealHand {
  /** The root's public key, lower-case hex. */
  readonly signer: string;
  /** Sign a charter roll's bytes; answers the signature as lower-case hex. */
  readonly sign: (bytes: Uint8Array) => Promise<string>;
}

/** The seal hand for the root at `handleIndex`. Refuses when this vessel holds no root there. */
export async function sealHand(handleIndex: number): Promise<SealHand> {
  const signer = await personaRootKey(handleIndex);
  if (!signer) {
    throw new Error(`[persona-vault] no persona-root at h${handleIndex} — mint it via the founding ceremony first (founder-only; a joining vessel never holds the root seed)`);
  }
  return {
    signer,
    sign: async (bytes) => (await sealedAct<{ sig: string }>("seal.sign", { handleIndex, image: Buffer.from(bytes).toString("hex") })).sig,
  };
}
