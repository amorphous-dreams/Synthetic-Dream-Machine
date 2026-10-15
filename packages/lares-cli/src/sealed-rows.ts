/**
 * sealed-rows — a command's readers and writers over the vessel's sealed rows, each one an act on the custody door.
 *
 * A command never opens a sealed row by a node function of its own: it asks `sealedAct` (`sealed-act-door`), which
 * runs the act inside the standing vessel when one answers and in this process otherwise. This module spells the
 * acts a command needs as the shapes commands already hold: the roster, the two own-persona stores, the
 * handle-book, and the seal rite's own acts: the arming of a head, a seat's hand on a roll, and the retirement of a
 * seat key nothing needs. A seat's key mints, signs and leaves behind the door; a command holds public halves alone.
 */
import {
  HandleBook, type HandleBookSnapshot, type OwnPersonaPetnameStore, type PersonaDeclaration, type PersonaDeclarationStore,
} from "@lararium/mesh";
import type { ArmedGenesis, ArmedRoll, SeatKept } from "@lararium/node";
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

/**
 * A hand of the seal ceremony's ROLL: it signs as one seat, named by that seat's public key, and the key stays
 * behind the custody door. The door reads the charter that stands and signs only a roll its standing head
 * licenses; it signs no other image. (A crossing's marks ride the rite's own acts, which take no image at all.)
 */
export interface SealHand {
  /** The seat's public key, lower-case hex. */
  readonly signer: string;
  /** Sign a charter roll's bytes; answers the signature as lower-case hex. */
  readonly sign: (bytes: Uint8Array) => Promise<string>;
}

/** The seal hand of the seat `verifyingKey` names. The door refuses at the signature where this vessel holds no such seat key. */
export function sealHand(verifyingKey: string): SealHand {
  const signer = verifyingKey.toLowerCase();
  return {
    signer,
    sign: async (bytes) => (await sealedAct<{ sig: string }>("seal.sign", { seat: signer, image: Buffer.from(bytes).toString("hex") })).sig,
  };
}

/** The inception hand of the seat `verifyingKey` names. The door signs only an inception the image licenses. */
export function inceptHand(verifyingKey: string): SealHand {
  const signer = verifyingKey.toLowerCase();
  return {
    signer,
    sign: async (bytes) => (await sealedAct<{ sig: string }>("seal.incept", { seat: signer, image: Buffer.from(bytes).toString("hex") })).sig,
  };
}

/** Which of `keys` this vessel holds a seat key for, lower-case. A reading of row names: it opens nothing. */
export async function heldSeats(keys: readonly string[]): Promise<string[]> {
  if (keys.length === 0) return [];
  return (await sealedAct<{ held: string[] }>("seat.held", { keys: keys.map((k) => k.toLowerCase()) })).held;
}

/** Arm a genesis behind the door: each standing chair's seat key mints there, and the roster answers. */
export function armGenesisSeats(threshold?: number): Promise<ArmedGenesis> {
  return sealedAct<ArmedGenesis>("seat.arm-genesis", threshold === undefined ? {} : { threshold });
}

/**
 * Arm a roll behind the door from the cards a person typed back: each revealed key the standing head committed
 * becomes its chair's seat key there, and the door answers the roster that stands and its hands. The cards cross the
 * custody door alone, never a store verb.
 */
export function armRollSeats(cards: readonly Uint8Array[], threshold?: number): Promise<ArmedRoll> {
  const hex = cards.map((card) => Buffer.from(card).toString("hex"));
  return sealedAct<ArmedRoll>("seat.arm-roll", threshold === undefined ? { cards: hex } : { cards: hex, threshold });
}

/** Whether a card's read-back stands in: a staged test root whose custody proves the published test route. */
export async function readBackStandsIn(): Promise<boolean> {
  return (await sealedAct<{ standIn: boolean }>("seat.readback-stand-in")).standIn;
}

/** Retire the seat keys among `keys` that nothing needs; the door's own licence decides, whatever this names. */
export async function retireSeats(keys: readonly string[]): Promise<{ retired: string[]; kept: Array<{ key: string; why: SeatKept }> }> {
  if (keys.length === 0) return { retired: [], kept: [] };
  return sealedAct("seat.retire", { keys: keys.map((k) => k.toLowerCase()) });
}
