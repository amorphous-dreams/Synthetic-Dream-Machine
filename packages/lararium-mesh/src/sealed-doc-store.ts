/**
 * sealed-doc-store — the document store's own rest for a sealed bag: every value the engine hands to storage rests as
 * a sealed `change` or `checkpoint` value, and every read answers to the session's face.
 *
 * ONE FORMAT SEALS IT. An incremental save seals as a `change`, a snapshot as a `checkpoint`, each under the logical
 * reference its storage key names, through the content-key holder's own seal (`sealValues`), so one save signs one
 * manifest. A change names, as its parents, the addresses of the values this store already held for its document;
 * a checkpoint names them as its cover. The inner adapter rests a pointer that names the sealed address and nothing
 * of the body, so no clear byte of a sealed bag reaches rest. A sync state carries peers' heads in the clear, so a
 * sealed bag rests none.
 *
 * A SESSION SIGNS A SAVE, OR NOTHING RESTS (sealed-store#/owed, R2). The Repo saves on its own timer, so a save names
 * no session of its own: every change books the session that wrote it (`sessionOf`, the vessel's book), and the
 * store's seal signs under that booked session. A save no session booked (a peer's change that arrived unsealed, a
 * change after the lock) refuses by name (`save-unbooked`) and stays here in memory: never written clear, never
 * dropped, readable through this store, and sealed by `reseal` once a session books it. `flush` awaits every seal in
 * flight, so a lock flushes the Repo and this store before it drops any signer or overwrites a key.
 *
 * HYDRATION ANSWERS TO THE SESSION'S FACE. A key alone grants no read: before any byte or name moves, the session
 * must wear the face the bag belongs to (`session-face-foreign`, `session-absent`; a face of the vessel's lit set answers
 * for its own bags alone, `openFaces`), and an opened value whose
 * manifest another face's session signed refuses (`writer-face-foreign`). A value that does not open reads as its
 * named refusal, never as an absent value.
 *
 * THE FRESH BASE. A from-now admission opens a span on a document of present values alone. `cutFreshBase` founds
 * one from the live document, so its opened document holds its own founding change and no other, and
 * `readsAsFreshBase` refuses a base that holds more. `freshBasePort` hands the holder that cut.
 *
 * UNKNOWN MEANS HOLD (the clear-name roster). A peer can push a document no local caller asked for and no map names yet (a
 * sibling's slot ahead of its announcement). Where the vessel hands its roster of documents named clear (`namesClear`), a
 * document neither mapped sealed nor named clear, nor opened by a local caller of the Repo (`solicited`), saves nothing to
 * rest: its bytes wait in memory (`save-unnamed`), readable here, until a name arrives. The roster releases them clear
 * (`mapMoved`, `solicited`); the map seals them (`reseal`). No byte of an unnamed document lands clear on a guess.
 * Each held unnamed row reads `contentFree` where every save it holds is a sync state (peers' heads, no change and no
 * checkpoint): a stop drops no content there. Any held content save, whoever made it, keeps the row owed: an island keeps no
 * store of its own, and a face writes under its own derived actor, so no origin read tells a copy that survives elsewhere.
 *
 * NEVER CLEAR AND NEVER LOST (the sealed-pending rest). A save of a sealed-class document that no session sealed
 * (`save-unbooked`, `save-unmapped`, `save-unsealed`) waits in memory AND rests at its own storage key sealed under the
 * vessel's own key (`vesselKey`), bound to its document and to the face its bag wears (`pendingRestBag`): no clear byte lands,
 * and a crash or a kill keeps the save. The next process that reads the key under THAT face, with the vessel's key in reach,
 * carries the save back into its wait (`#carry`), and the next session of the face seals it over the pending value, in place.
 * A value held for one face never opens for another: the vessel's key serves every face, so the face rides the seal's
 * context. Where the vessel's key stands out of reach (a locked custody, a store that hands none), or no lit face owns the
 * save yet (no bag maps it, its bag's face has not lit), the save waits in memory alone and its notice says so.
 *
 * A COUNTED CEILING PER DOCUMENT (`HELD_MAX_SAVES_PER_DOCUMENT`). One document holds at most that many unsealed saves; a
 * further one refuses by name (`held-bound`): nothing more waits, the engine keeps the change and hands it again inside its
 * next save, the writer's door reads it owed, and the census names the row at its bound. No clock reads here.
 *
 * Platform-blind: the inner adapter, the bag map, the session's face, the book and the holder's seal and open ride ports.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (step three) · lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";
import type { BagLocator } from "./sealed-records.js";
import { mergedSourceOf } from "./wait-handle.js";
import { bearsSealedMark, namesSealedPointer, readSealedAddress, SEALED_VALUE_POINTER, type KeyVersionId, type SealedAddress } from "./sealed-chunk.js";
import { openPublished, sealPublished, type PublishedLookup } from "./published-bag-key.js";
import { openHeld, sealHeld, type HeldRestKey } from "./held-rest-key.js";
import type { DocumentValue, FreshBase, HolderRefusal, OpenedValue, SealedValues } from "./content-key-holder.js";

export const SEALED_DOCUMENT_REFUSALS = [
  "session-absent",          // no session stands behind the read
  "session-face-foreign",    // the session wears another face than the bag belongs to
  "writer-face-foreign",     // the value opened, and another face's session signed the manifest that authorized it
  "pointer-malformed",       // the inner rest holds no pointer this store wrote
  "bag-unmapped",            // a sealed value rests for a document the bag map names no bag for (yet): no byte moves
  "save-unbooked",           // no session booked the change a save carries: it stays in memory, unsealed and unwritten
  "save-unmapped",           // the document rests sealed and the map names no bag for it now: the save waits in memory, never clear
  "save-unsealed",           // the holder refused or never answered the seal: the save waits in memory, and the next reseal tries again
  "save-unnamed",            // neither the map nor the clear-name roster names the document (an unsolicited peer push): the save waits in memory, never clear
  "unnamed-bound",           // the saves held unnamed already fill their bound (count or bytes): this one neither waits nor rests, and the engine keeps it
  "held-bound",              // one document's unsealed saves already fill their counted ceiling: this one neither waits nor rests, and the engine keeps it
  "held-clear-at-rest",      // a held bag (the vessel's secret home) found a clear chunk at rest: a fault, never read as the document
  "holder-locked",           // a vessel-held home whose key has not opened (custody locked, no floor key): no byte opens until it does
] as const;
export type SealedDocumentRefusalName = (typeof SEALED_DOCUMENT_REFUSALS)[number];

/**
 * THE REFUSALS THAT CARRY INTEGRITY EVIDENCE: the bytes at rest, or the value a pointer names, fail the keyed load itself (a
 * pointer this store never wrote, a clear chunk in a held home, an envelope too short, bytes that hash to another address,
 * an unknown format, a segment tag that fails, a sequence cut on a whole segment, a value the holder does not hold). Every
 * other refusal names liveness (no session yet, the door unanswered, the holder locked, the rest standing down), a face
 * that may not read here, or custody: `context-mismatch` (the commitment fails) reads the same for another bag, role or
 * reference, or another key, as for altered bytes, so it never moves bytes on its own word.
 */
export const SEALED_INTEGRITY_REFUSALS: ReadonlySet<string> = new Set([
  "pointer-malformed", "held-clear-at-rest",
  "envelope-malformed", "address-mismatch", "format-unknown", "sequence-broken", "truncated",
  "value-absent",
]);
/** Does this refusal name integrity evidence against the document (`SEALED_INTEGRITY_REFUSALS`)? */
export function isIntegrityRefusal(refusal: string | null | undefined): boolean {
  return typeof refusal === "string" && SEALED_INTEGRITY_REFUSALS.has(refusal);
}

/** What `onHeld` hears: the refusal that kept a save in memory, its document, and for a holder's refusal its name and cause. */
export interface HeldNotice {
  readonly refusal: HeldRefusal;
  readonly documentId: string;
  readonly error?: string;
  readonly cause?: string;
  /** The bag the map names for the document as the save waits (null: none), and that bag's face (null: none lit). */
  readonly bagId?: string | null;
  readonly face?: string | null;
  /** WHERE THE SAVE RESTS WHILE IT WAITS: `sealed-pending` (at its storage key under the vessel's key: a stop keeps it) or
   *  `memory` (this process alone: a stop drops it). */
  readonly rests?: HeldRest;
  /** A `save-unnamed` notice alone: true where the save carries a sync state (peers' heads, no change, no checkpoint). */
  readonly syncState?: boolean;
  /** True where an earlier process left this save sealed-pending and this one carried it back into its wait. */
  readonly carried?: boolean;
}

/** Where a held save rests while it waits (`HeldNotice.rests`). */
export type HeldRest = "sealed-pending" | "memory";

/** The refusals that keep a save in memory rather than at rest. */
export const HELD_REFUSALS = ["save-unbooked", "save-unmapped", "save-unsealed", "save-unnamed"] as const;
export type HeldRefusal = (typeof HELD_REFUSALS)[number];

/** One document's saves held in memory under one refusal (`SealedDocumentStore.held`): its id, never its body. */
export interface HeldSaves {
  readonly documentId: string;
  readonly refusal: HeldRefusal;
  readonly saves: number;
  readonly bagId: string | null;
  /** How many of the row's saves also rest sealed-pending under the vessel's key: a stop keeps those, and drops the others. */
  readonly pending?: number;
  /** True where the document's unsealed saves fill their counted ceiling (`HELD_MAX_SAVES_PER_DOCUMENT`): a further save refuses. */
  readonly atBound?: boolean;
  /** A `save-unnamed` row alone: the bytes its saves hold in memory. */
  readonly bytes?: number;
  /** A `save-unnamed` row alone: true only where every save it holds is a sync state, so it carries no change and no
   *  checkpoint; any held content save leaves it false, and the census counts the row as owed. */
  readonly contentFree?: boolean;
  /** A `save-unnamed` row alone: how many saves this store took since the document's first save waited unnamed, the row's
   *  age read causally (the house reads no wall clock). */
  readonly heldAcross?: number;
}

/** A refusal by name: this store's own (`SEALED_DOCUMENT_REFUSALS`) or the holder's, passed through. */
export class SealedDocumentRefusal extends Error {
  override readonly name = "SealedDocumentRefusal";
  constructor(readonly refusal: string, readonly why?: string) {
    super(`sealed document store: ${refusal}${why ? ` (${why})` : ""} — no byte and no name moved`);
  }
}

/** The session a change booked, as the store reads it: an id the vessel's book knows it by, and its proof subject
 *  (`faceProofSubjectRef`), which must name the bag's own face. */
export interface SaveSession {
  readonly id: string;
  readonly subject: string;
}

/** What the store's seal answers: the address of each value it sealed, or a refusal by name. */
export type SealedValueAddresses = Pick<SealedValues, "values">;

/**
 * The `wornAt` port for a vessel that wears one face at more than one anchor: it answers true only when `face` (the
 * bag's face) names the face this vessel wears now, and `subject` names that face at one of the anchors the vessel's
 * own chain holds (its place, the dial's Nexus). A bag of another face never passes through the worn subject; a vessel
 * that wears no face passes nothing. `anchors` reads fresh at each ask: a dial composes and stands down.
 */
export function wornAtOf(
  worn: () => string | null,
  anchors: () => ReadonlyArray<string | null>,
): (face: string, subject: string) => boolean {
  return (face, subject) => face === worn() && anchors().some((anchor) => anchor !== null && anchor === subject);
}

export interface SealedDocumentPorts {
  /** The engine-facing rest this store wraps: an unsealed bag's values pass straight to it. */
  readonly inner: StorageAdapterInterface;
  /** The bag a document belongs to and that bag's face (`faceProofSubjectRef`); null: the bag rests unsealed. A public
   *  or crossroads bag names its published lookup (`published`): it rests sealed under the key that lookup derives, and
   *  opens for whoever holds it, with no session, no face and no holder (`published-bag-key`). The vessel's secret home
   *  names its held key (`held`): it rests sealed under the key its vessel's custody alone keeps, and opens for that vessel
   *  with no session and no face (`held-rest-key`). */
  bagOf(documentId: string): SealedBagRow | null;
  /**
   * THE MAP BEFORE THE BYTES: the row a document of `bagId` maps to under the vessel's map now, read by the bag alone (its face,
   * or `face: null` while that face has not lit); null: the bag rests clear. A document a caller names for a bag ahead of any
   * byte (`nameDocument`) maps by this row wherever `bagOf` names it nothing yet. Absent: no document maps before its map.
   */
  bagRow?(bagId: string): SealedBagRow | null;
  /**
   * THE CLEAR-NAME ROSTER: does the vessel's own registry name `documentId` as a document it carries (a bag's document the map
   * rests clear, a catalog row, a slot a resolver announced)? Present, the store turns fail-closed for every document neither
   * mapped sealed (`bagOf`), named clear here, nor opened by a local caller (`solicited`): its saves wait in memory
   * (`save-unnamed`) and land once a name arrives. Absent: an unmapped document rests as the engine wrote it.
   */
  namesClear?(documentId: string): boolean | Promise<boolean>;
  /** The face the session wears (`faceProofSubjectRef`); null where no session stands. */
  sessionFace(): string | null;
  /**
   * THE REALM WORKBENCH (cabal-realm#/the-workbench): `keeps` names a bag a realm's workbench rests in (its working slot, bound
   * by the vessel's ledger), and `wears` reads whether a session's subject names a lit face that realm seats. A session of any
   * seated face saves into such a bag through its own holder, and a value opens whichever seated writer signed it (the holder
   * read that writer's standing under the roster). Absent: one bag, one face, as before.
   */
  readonly realm?: { keeps(bagId: string): boolean; wears(bagId: string, subject: string): boolean };
  /**
   * THE LIT SET: every face that stands open on this vessel now (each a `faceProofSubjectRef`), the worn one among them. A
   * bag of any face in the set opens and saves under THAT face (its own key, through its own session), never under another
   * member's; a bag of a face outside the set still refuses `session-face-foreign`. Absent: the set holds the worn face
   * alone (a browser vessel, a set of one).
   */
  openFaces?(): readonly string[];
  /** ONE FACE, TWO ANCHORS (session-contract#/the-hands): does `subject` name `face` (the bag's face) at another anchor
   *  the vessel's own chain names (its place, while a dial names the face by its Nexus subject; the dial's Nexus, while
   *  it stands at its place)? The port answers true only for the face the vessel wears (`wornAtOf`): a bag of any other
   *  face never passes through the worn subject. A session that face's other anchor booked seals for the bag, and a
   *  value it sealed opens. Absent: the bag's face reads by one subject. */
  wornAt?(face: string, subject: string): boolean;
  /** The session that booked the latest change of a document (R2), reading the save's own bytes where it hands them
   *  (the change's writer, T4); null: no session booked it, and its save waits. */
  sessionOf(documentId: string, data?: Uint8Array): SaveSession | null;
  /** The holder's seal of one write batch, signed under the session that booked it. */
  seal(args: { readonly bagId: string; readonly values: readonly DocumentValue[]; readonly session: SaveSession; readonly peer?: string }): Promise<SealedValueAddresses | HolderRefusal>;
  /** The change's own writer as booked (`session:<id>` or `peer:<actor>`), so a peer's change seals naming its actor in
   *  the manifest (U3); absent or null: the signing session wrote it. */
  writerOf?(documentId: string): string | null;
  /** A holder that stands no session and no bag map (the node's direct holder, T2): a document the map names no bag
   *  for, whose rest already holds a sealed value, refuses a clear save by name (`bag-unmapped`), so no clear byte
   *  ever lands beside a sealed one. Read once per document. */
  readonly refuseClearOverSealed?: boolean;
  /**
   * THE VESSEL'S OWN HELD KEY, where it stands open (the-veil-ladder#/the-base-model, the Lift): a face's bag whose rest still
   * holds a value sealed under this key (a document the veil floor minted, lifted into the face with the same document id)
   * opens that value with it, and `refileHeld` seals it again under the face. Null (the custody locked): such a value
   * refuses `holder-locked`, which a hydrating load waits out. A key that does not open it refuses by the open's own name.
   * Absent: such a value refuses `pointer-malformed`, as any byte run this store never wrote.
   *
   * THE SEALED-PENDING REST RIDES THE SAME KEY: a save no session sealed rests at its storage key under this key, bound to
   * its document and its bag's face (`pendingRestBag`), so a stop keeps it; null or absent, or with no lit face owning the
   * save, such a save waits in memory alone (`HeldNotice.rests`).
   */
  vesselKey?(): HeldRestKey | null;
  /** Told once per save the store holds back unsealed, naming its document, the bag and face the map reads for it, and
   *  where the save rests while it waits (`rests`); a `save-unsealed` names the holder's own refusal (`error`) and its cause
   *  beside it. A `save-unnamed` tells once per document while its saves wait, so a peer's push names itself once. A save an
   *  earlier process left sealed-pending tells as it joins this process's wait (`carried`). */
  onHeld?(held: HeldNotice): void;
  /** Told once per save the store REFUSED outright (it throws, keeps nothing in memory and rests nothing): a face-foreign
   *  session, an unmapped bag over a sealed rest, a seal that refused at the held or published key, a document whose
   *  unsealed saves already fill their counted ceiling (`held-bound`). The change lives only
   *  in the engine's own memory, so a write door reads it as owed, never ok (`restOwedWatch`). */
  onRefused?(refused: { readonly documentId: string; readonly refusal: string; readonly cause?: string }): void;
  /** Told once per document and refusal when a hydrating load waits (`hydrates`): which refusal it waits on, and the bag
   *  the map names for that document now (null: none). */
  onHydrationWait?(wait: { readonly documentId: string; readonly refusal: string; readonly bagId: string | null }): void;
  /** A vessel's store (P1): a document that rests sealed, or mapped sealed once this process, keeps its rest class
   *  while the map names no bag for it (a dial that dropped, the floor): its save waits in memory (`save-unmapped`),
   *  never lands clear, and no removal reaches a sealed pointer, until the map stands again and the save seals. */
  readonly waitOverSealed?: boolean;
  /** The holder's open of one value by its role and logical reference. */
  /** `face`: the face the document's bag wears (`SealedBag#face`), so the island opens it through THAT face's holder. */
  open(args: { readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string; readonly face?: string | null }): Promise<OpenedValue | HolderRefusal>;
  /** A RESTART'S HYDRATION (a vessel's store): a load of a sealed document that refuses only because its map, its
   *  session or its holder has not stood yet waits for the next `mapMoved` and reads again, so a document the engine
   *  asks for ahead of its dial never strands unavailable; `endHydration` (the rest stands down) ends every such wait
   *  with its own refusal. No clock decides it. Absent or false: it refuses at once. */
  readonly hydrates?: boolean;
}

/** The refusals a hydrating load waits out: each names a piece that stands later in a vessel's boot. */
const HYDRATION_WAITS: ReadonlySet<string> = new Set(["bag-unmapped", "session-absent", "chain-absent", "holder-locked", "sealed-store-unavailable", "signer-unavailable", "door-unanswered"]);

/** THE BOUND ON SAVES HELD UNNAMED: a peer's unsolicited pushes wait in memory, so their count and bytes stay bounded. Past
 *  either, a further unnamed save refuses by name (`unnamed-bound`): nothing rests, and the engine keeps the change in memory. */
export const UNNAMED_HELD_MAX_SAVES = 4096;
export const UNNAMED_HELD_MAX_BYTES = 64 * 1024 * 1024;

/** THE COUNTED CEILING ON ONE DOCUMENT'S UNSEALED SAVES (`save-unbooked`, `save-unmapped`, `save-unsealed`): past it a further
 *  save of that document refuses by name (`held-bound`), so a signer that refuses for a whole boot never grows memory. */
export const HELD_MAX_SAVES_PER_DOCUMENT = 64;

/** The context a sealed-pending value binds under the vessel's key: its document AND the face its bag wore as the save
 *  waited. The vessel's key opens for every face of the vessel, so the face rides the seal's own context: a value held for
 *  face A opens under A alone, whatever bag a later map names its document under, and never for a sibling face. */
export function pendingRestBag(documentId: string, face: string): string {
  return `lar:///ha.ka.ba/lararium/mesh/sealed-store/pending/${encodeURIComponent(face)}/${documentId}`;
}

const ROLES: Readonly<Record<string, DocumentValue["role"]>> = { incremental: "change", snapshot: "checkpoint" };
const POINTER = SEALED_VALUE_POINTER;
/** The Automerge chunk magic: a value the engine itself wrote, clear, before its bag mapped sealed. */
const AUTOMERGE_MAGIC = [0x85, 0x6f, 0x4a, 0x83] as const;
const readsClear = (bytes: Uint8Array): boolean => AUTOMERGE_MAGIC.every((b, i) => bytes[i] === b);
const readsSealed = bearsSealedMark;
/** What the bag map names for one document: its bag, that bag's face, and the key a keyed bag rests under. */
export interface SealedBagRow { readonly bagId: string; readonly face: string | null; readonly published?: PublishedLookup; readonly held?: HeldRestKey; readonly locked?: true }
type PublicBag = { readonly bagId: string; readonly published: PublishedLookup };
type HeldBag = { readonly bagId: string; readonly held: HeldRestKey };
const isPublic = (bag: { readonly published?: PublishedLookup } | null): bag is PublicBag & { readonly face: string | null } => bag?.published !== undefined;
const isHeld = (bag: SealedBagRow | null): bag is SealedBagRow & HeldBag => bag?.held !== undefined;
/** A bag that rests under a key its reader holds (public or held): it seals and opens with no session and no holder. */
const isKeyed = (bag: SealedBagRow | null): boolean => isPublic(bag) || isHeld(bag);
const nameOf = (key: StorageKey): string => key.join("\u0000");

/** The logical reference a storage key names inside its bag. */
export function logicalRefOf(key: StorageKey): string {
  return hex(sha256(utf8Bytes(["lares-document-value", ...key].join("\u0000"))));
}
function readPointer(bytes: Uint8Array): SealedAddress | null {
  if (!namesSealedPointer(bytes)) return null;
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  return text.startsWith(POINTER) ? readSealedAddress(text.slice(POINTER.length)) : null;
}
/** Does a byte run open as this store's pointer, well-formed or not? */
const namesPointer = namesSealedPointer;
function frontierOf(saved: Uint8Array): string[] {
  try { return [...A.getHeads(A.load(saved))].sort(); } catch { return []; }
}

export class SealedDocumentStore implements StorageAdapterInterface {
  readonly #ports: SealedDocumentPorts;
  /** The sealed address of each value this store holds, by document and storage key: a change's parents, a checkpoint's cover. */
  readonly #held = new Map<string, Map<string, SealedAddress>>();
  /** The saves no session booked, by storage key, in arrival order: in memory alone, until a session books them. Each
   *  names the refusal that held it back. */
  readonly #waiting = new Map<string, { readonly key: StorageKey; readonly data: Uint8Array; readonly refusal: HeldRefusal; readonly pending?: boolean }>();
  /** Each document held unnamed, by the save count this store stood at when its first save waited. */
  readonly #unnamedSince = new Map<string, number>();
  /** How many saves this store took: the causal tick an unnamed row's age reads against. */
  #saves = 0;
  /** Drop one waiting save; once its document waits on nothing, its unnamed age leaves with it. */
  #unwait(name: string): boolean {
    const w = this.#waiting.get(name);
    const gone = this.#waiting.delete(name);
    if (w !== undefined && this.#unnamedSince.has(w.key[0]!) && ![...this.#waiting.values()].some((x) => x.key[0] === w.key[0])) this.#unnamedSince.delete(w.key[0]!);
    return gone;
  }
  /** How many sealed-class saves of one document wait unsealed (an unnamed save counts under its own bound). */
  #heldCount(documentId: string): number {
    let n = 0;
    for (const w of this.#waiting.values()) if (w.key[0] === documentId && w.refusal !== "save-unnamed") n++;
    return n;
  }

  /** The vessel's own key where it stands in reach: the key a sealed-pending value rests under. Null: none in reach. */
  #pendingKey(): HeldRestKey | null {
    try { return this.#ports.vesselKey?.() ?? null; } catch { return null; }
  }

  /**
   * REST ONE WAITING SAVE SEALED-PENDING: its bytes seal under the vessel's key, bound to its document and to `face`, the face
   * its bag wears (`pendingRestBag`), and land at its own storage key, so no clear byte rests and a stop keeps the save.
   * Answers whether it rested: false where no face owns the save yet (no bag maps it, or its bag's face has not lit: a value
   * bound to no face would open for any), the key names no sealed role, the vessel's key stands out of reach, or the inner
   * rest faulted. The save then waits in memory alone.
   */
  async #restPending(key: StorageKey, data: Uint8Array, face: string | null): Promise<boolean> {
    const role = ROLES[key[1] ?? ""];
    if (face === null) return false;
    const held = this.#pendingKey();
    if (role === undefined || held === null || typeof key[0] !== "string") return false;
    try {
      const out = sealHeld({ bagId: pendingRestBag(key[0], face), held, role, ref: logicalRefOf(key), plaintext: data });
      if (!("chunk" in out)) return false;
      await this.#ports.inner.save(key, out.chunk.sealed);
      return true;
    } catch { return false; }
  }

  /**
   * HOLD ONE SAVE OF A SEALED-CLASS DOCUMENT UNSEALED: it waits in memory, readable through this store, and rests
   * sealed-pending where the vessel's key stands in reach (`rest`; a fallback's merge rests under its source's own id, so it
   * rests nothing here). Past the document's counted ceiling the save refuses by name (`held-bound`) and nothing more waits.
   */
  async #hold(key: StorageKey, data: Uint8Array, refusal: Exclude<HeldRefusal, "save-unnamed">, bag: SealedBagRow | null,
    why: { readonly error?: string; readonly cause?: string } = {}, rest = true): Promise<void> {
    const documentId = key[0]!;
    const name = nameOf(key);
    if (!this.#waiting.has(name)) {
      const held = this.#heldCount(documentId);
      if (held >= HELD_MAX_SAVES_PER_DOCUMENT) {
        throw new SealedDocumentRefusal("held-bound", `${held} save(s) of this document already wait unsealed (${refusal}), its counted ceiling`);
      }
    }
    // THE WAIT STANDS BEFORE ANY AWAIT: a read that lands while the pending value rests finds the save here.
    const entry = { key: [...key], data: Uint8Array.from(data), refusal };
    this.#waiting.set(name, entry);
    let rests: HeldRest = "memory";
    if (rest && await this.#restPending(key, entry.data, bag?.face ?? null)) {
      if (this.#waiting.get(name) === entry) { this.#waiting.set(name, { ...entry, pending: true }); rests = "sealed-pending"; }
      // A LATER SAVE OF THE SAME KEY TOOK THE WAIT: it rests and tells for itself.
      else if (this.#waiting.has(name)) return;
      else {
        // THE SAVE LEFT ITS WAIT WHILE ITS PENDING VALUE LANDED: a seal's pointer stands again over it; a removal removes it.
        const sealed = this.#held.get(documentId)?.get(name);
        try {
          if (sealed !== undefined) await this.#ports.inner.save(key, utf8Bytes(POINTER + sealed));
          else await this.#ports.inner.remove(key);
        } catch { /* the next read of the key carries the pending value back into its wait */ }
        return;
      }
    }
    try {
      this.#ports.onHeld?.({ refusal, documentId, ...why, bagId: bag?.bagId ?? null, face: bag?.face ?? null, rests });
    } catch { /* a listener's fault never drops the wait */ }
  }

  /**
   * AN EARLIER PROCESS LEFT THIS SAVE SEALED-PENDING: the value at `key` opened under the vessel's key and its document's
   * pending context, so it joins this process's wait (`save-unbooked`: no session of this process booked it) and the next
   * session of its face seals it over the pending value. Told once per carried save.
   */
  #carry(key: StorageKey, plaintext: Uint8Array, bag: { readonly bagId: string; readonly face?: string | null }): void {
    const name = nameOf(key);
    if (this.#waiting.has(name)) return;
    this.#waiting.set(name, { key: [...key], data: Uint8Array.from(plaintext), refusal: "save-unbooked", pending: true });
    try {
      this.#ports.onHeld?.({ refusal: "save-unbooked", documentId: key[0]!, bagId: bag.bagId, face: bag.face ?? null, rests: "sealed-pending", carried: true });
    } catch { /* a listener's fault never drops the wait */ }
  }

  /** The removals a compaction asked while its snapshot waits unbooked, by document. */
  readonly #deferred = new Map<string, StorageKey[]>();
  /** The documents whose rest this store already read for clear chunks, this process. */
  readonly #swept = new Set<string>();
  /** The documents whose rest holds a sealed value, read once each (`refuseClearOverSealed`). */
  readonly #sealedAtRest = new Map<string, Promise<boolean>>();
  /** The documents this store mapped sealed, this process: a map that drops never moves their rest class. */
  readonly #classedSealed = new Set<string>();
  /** Seals run one at a time, in arrival order, so a change's parents name what rested before it. */
  /** ONE TURN LINE PER BAG: seals of one bag take their turns in order, and a bag of one face never waits behind another's. */
  readonly #tails = new Map<string, Promise<unknown>>();

  constructor(ports: SealedDocumentPorts) { this.#ports = ports; }

  /** The bag each document a caller named before its bytes belongs to (`nameDocument`), by document. */
  readonly #named = new Map<string, string>();

  /**
   * THE MAP BEFORE THE BYTES: name `documentId` for `bagId` before any byte of it moves. Where the bag rests sealed
   * (`bagRow`), the document maps by the bag's row wherever the map names it nothing yet, and keeps its sealed class for this
   * process: a byte of it that arrives (a local read, a peer's sync) rests sealed, or waits in memory while the bag's face has
   * not lit (`save-unmapped`), never clear. Answers whether the bag rests sealed; a clear bag names nothing.
   */
  nameDocument(documentId: string, bagId: string): boolean {
    if ((this.#ports.bagRow?.(bagId) ?? null) === null) {
      // A CLEAR BAG'S DOCUMENT JOINS THE CLEAR-NAME ROSTER: the caller named its bag, so its saves land as the engine wrote them.
      void this.#solicit(documentId);
      return false;
    }
    this.#named.set(documentId, bagId);
    this.#classedSealed.add(documentId);
    return true;
  }

  /** The documents a local caller of the Repo opened (`solicited`): each counts as named for the roster. */
  readonly #solicited = new Set<string>();

  /**
   * THE VESSEL KNOWS THIS DOCUMENT (it minted it over the Repo this store stands under, or a derivation named it at its open), so
   * it never waits as an unsolicited push. Saves of it held `save-unnamed` land now, by the rule its map reads.
   */
  solicited(documentId: string): Promise<number> { return this.#solicit(documentId); }

  /** Name the document, and answer the release of its held saves (a fault keeps them waiting by name, and answers 0). */
  #solicit(documentId: string): Promise<number> {
    if (this.#solicited.has(documentId)) return Promise.resolve(0);
    this.#solicited.add(documentId);
    return this.#releaseNamed().catch(() => 0);
  }

  /** Does the roster name this document: the vessel's registry names it, or a local caller opened it? True where no roster
   *  stands (the store reads unmapped documents as clear). */
  async #namedClear(documentId: string): Promise<boolean> {
    if (this.#ports.namesClear === undefined || this.#solicited.has(documentId)) return true;
    // FAIL-CLOSED: a roster that faults, or answers anything but true, names nothing.
    try { return (await this.#ports.namesClear(documentId)) === true; } catch { return false; }
  }

  /**
   * THE ROSTER NAMED A HELD DOCUMENT: each save held `save-unnamed` whose document the roster names now, and the map still names
   * no bag for (nor kept sealed this process), lands clear as the engine wrote it. A document the map names waits for `reseal`,
   * which seals it. Answers how many landed.
   */
  async #releaseNamed(): Promise<number> {
    let landed = 0;
    for (const [name, w] of [...this.#waiting]) {
      if (w.refusal !== "save-unnamed") continue;
      const documentId = w.key[0]!;
      if (this.bagOf(documentId) !== null || this.#classedSealed.has(documentId) || !(await this.#namedClear(documentId))) continue;
      // THE CLASS READS AGAIN AFTER THE ROSTER'S ANSWER: a map that named the document sealed meanwhile keeps it for `reseal`.
      if (!this.#landsClear(documentId) || this.#waiting.get(name) !== w) continue;
      this.#unwait(name);
      try { await this.#ports.inner.save(w.key, w.data); landed++; }
      catch (error) { if (!this.#waiting.has(name)) this.#waiting.set(name, w); throw error; }
    }
    return landed;
  }

  /** May a clear byte of this document rest now: no bag maps it and it never mapped sealed this process? Read right before
   *  each clear write, after every await. */
  #landsClear(documentId: string): boolean {
    return this.bagOf(documentId) === null && !this.#classedSealed.has(documentId);
  }

  /** The refusal holding a save of this document in memory (the first that waits), or null where none waits. A receipt reads
   *  it: a save held here has not reached rest, so it acknowledges nothing (`receiptInStore`). */
  heldRefusalOf(documentId: string): HeldRefusal | null {
    for (const w of this.#waiting.values()) if (w.key[0] === documentId) return w.refusal;
    return null;
  }

  /** The bag a document maps to: the map's row for it, else the row of the bag a caller named it for (`nameDocument`). */
  bagOf(documentId: string): SealedBagRow | null {
    const mapped = this.#ports.bagOf(documentId);
    if (mapped !== null) return mapped;
    const named = this.#named.get(documentId);
    return named === undefined ? null : (this.#ports.bagRow?.(named) ?? null);
  }

  /** The next move of the map (`mapMoved`): a hydrating load waits on it. */
  #moved = SealedDocumentStore.#nextMove();
  static #nextMove(): { readonly promise: Promise<void>; readonly resolve: () => void } {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  }

  /** The bag map, the session or the holder moved (a dial composed, a slot named, a lift stood): every load waiting to
   *  hydrate reads again, and each save held `save-unnamed` whose document the roster names now lands clear. */
  mapMoved(): void {
    const moved = this.#moved; this.#moved = SealedDocumentStore.#nextMove(); moved.resolve();
    if (this.#ports.namesClear !== undefined) void this.#releaseNamed().catch(() => { /* a release that faults keeps its saves waiting by name */ });
  }

  /** The rest stands down: no map, session or holder stands again for this store, so every load waiting to hydrate
   *  refuses now by its own refusal, and a later load refuses at once. */
  endHydration(): void { this.#hydrationEnded = true; this.mapMoved(); }
  #hydrationEnded = false;

  /** The waits already named, by document and refusal: each names itself once. */
  readonly #waitsNamed = new Set<string>();

  /** The refusal each document's latest load ended on, by document; a load that answers clears it. */
  readonly #refusals = new Map<string, string>();
  /** The refusal the latest load of this document ended on (a `SealedDocumentRefusal` name), or null where its latest
   *  load answered or none ran. A mount reads it to tell integrity evidence from liveness (`isIntegrityRefusal`). */
  refusalOf(documentId: string): string | null { return this.#refusals.get(documentId) ?? null; }

  async #hydrating<T>(documentId: unknown, read: () => Promise<T>): Promise<T> {
    try {
      const out = await this.#hydratingRead(documentId, read);
      if (typeof documentId === "string") this.#refusals.delete(documentId);
      return out;
    } catch (error) {
      if (typeof documentId === "string" && error instanceof SealedDocumentRefusal) this.#refusals.set(documentId, error.refusal);
      throw error;
    }
  }

  async #hydratingRead<T>(documentId: unknown, read: () => Promise<T>): Promise<T> {
    for (;;) {
      const moved = this.#moved.promise;
      try { return await read(); }
      catch (error) {
        if (!(error instanceof SealedDocumentRefusal) || !HYDRATION_WAITS.has(error.refusal)) throw error;
        if (this.#ports.hydrates !== true || this.#hydrationEnded) throw error;
        if (typeof documentId === "string" && !this.#waitsNamed.has(`${documentId}\u0000${error.refusal}`)) {
          this.#waitsNamed.add(`${documentId}\u0000${error.refusal}`);
          try { this.#ports.onHydrationWait?.({ documentId, refusal: error.refusal, bagId: this.bagOf(documentId)?.bagId ?? null }); } catch { /* a listener's fault never holds the load */ }
        }
        await moved;
        if (this.#hydrationEnded) throw error;
      }
    }
  }

  #inTurn<T>(bagId: string, act: () => Promise<T>): Promise<T> {
    const run = (this.#tails.get(bagId) ?? Promise.resolve()).then(act, act);
    const tail = run.then(() => undefined, () => undefined);
    this.#tails.set(bagId, tail);
    void tail.then(() => { if (this.#tails.get(bagId) === tail) this.#tails.delete(bagId); });
    return run;
  }

  /** Await every seal in flight (or those of the named bags alone): a lock flushes here, after the Repo's own flush, before any
   *  signer drops; a face's drain names its own bags, so it never waits behind another face's seals. */
  async flush(bagIds?: readonly string[]): Promise<void> {
    const tails = bagIds === undefined ? [...this.#tails.values()] : bagIds.flatMap((b) => { const t = this.#tails.get(b); return t ? [t] : []; });
    await Promise.all(tails);
  }

  /** How many saves wait unbooked, for one document or for all. */
  waiting(documentId?: string): number {
    return documentId === undefined ? this.#waiting.size : [...this.#waiting.values()].filter((w) => w.key[0] === documentId).length;
  }

  /** V2: does this store hold `documentId`'s rest as a sealed rest: its bag maps now, it mapped sealed this process, or
   *  its rest holds a sealed value? An island's own store rests no byte of such a document (`islandRestGuard`). */
  async holdsSealed(documentId: string): Promise<boolean> {
    if (this.bagOf(documentId) !== null || this.#classedSealed.has(documentId)) return true;
    if (this.#ports.waitOverSealed !== true && this.#ports.refuseClearOverSealed !== true) return false;
    return this.#restsSealed(documentId);
  }

  /** V3: seal the clear chunks a mapped document's rest still holds (it rested before its bag mapped), under the session
   *  that books it now; they leave rest. Answers whether any sealed. */
  async sealClearRest(documentId: string): Promise<boolean> {
    const bag = this.bagOf(documentId);
    if (bag === null || isKeyed(bag)) return false;
    const clear = (await this.#ports.inner.loadRange([documentId])).filter((c): c is Chunk & { data: Uint8Array } => ROLES[c.key[1] ?? ""] !== undefined && c.data !== undefined && readsClear(c.data));
    if (clear.length === 0) return false;
    const session = this.#ports.sessionOf(documentId);
    if (session === null || !this.#wears(bag.face, session.subject, bag.bagId)) return false;
    this.#classedSealed.add(documentId);
    this.#swept.delete(documentId);
    await this.#inTurn(bag.bagId, () => this.#sweep(bag, documentId, clear[0]!.data, session));
    return true;
  }

  /**
   * THE LIFT RE-FILES A SEAL, NEVER A DOCUMENT: each value of `documentId` that still rests sealed under the vessel's held key
   * (it rested at the veil floor before a face's bag mapped it) opens under that key and seals again under the bag's face,
   * through the session that books it now, at the same storage key. Answers how many re-filed. A value already under the
   * face stays as it rests, so a replay re-files nothing; with no vessel key in reach, or no session of the bag's face, none moves.
   */
  async refileHeld(documentId: string): Promise<number> {
    const bag = this.bagOf(documentId);
    const held = this.#ports.vesselKey?.() ?? null;
    if (bag === null || isKeyed(bag) || held === null) return 0;
    const under = (await this.#ports.inner.loadRange([documentId])).filter((c): c is Chunk & { data: Uint8Array } => ROLES[c.key[1] ?? ""] !== undefined && c.data !== undefined && readsSealed(c.data));
    if (under.length === 0) return 0;
    const session = this.#ports.sessionOf(documentId);
    if (session === null || !this.#wears(bag.face, session.subject, bag.bagId)) return 0;
    this.#classedSealed.add(documentId);
    let refiled = 0;
    for (const chunk of under) {
      const opened = openHeld({ bagId: bag.bagId, held, role: ROLES[chunk.key[1]!]!, ref: logicalRefOf(chunk.key), sealed: chunk.data });
      if (!("plaintext" in opened)) continue;
      await this.#inTurn(bag.bagId, () => this.#seal(bag, chunk.key, opened.plaintext, session));
      refiled++;
    }
    return refiled;
  }

  /**
   * THE CENSUS OF HELD SAVES: each document with a save waiting in memory, the refusal that holds it, how many saves
   * wait, and the bag the map names for it now (null: none). It names the document and never a byte of its body, so a
   * stop that would drop these saves can list them first.
   */
  held(): HeldSaves[] {
    const rows = new Map<string, { documentId: string; refusal: HeldRefusal; saves: number; bytes: number; contentFree: boolean; pending: number }>();
    for (const { key, data, refusal, pending } of this.#waiting.values()) {
      const documentId = key[0]!;
      const name = `${documentId}\u0000${refusal}`;
      // Only a sync state reads content-free; a change, a checkpoint, or any key this store does not know counts as content.
      const content = key[1] !== "sync-state";
      const row = rows.get(name);
      if (row) { row.saves++; row.bytes += data.byteLength; row.contentFree &&= !content; row.pending += pending ? 1 : 0; }
      else rows.set(name, { documentId, refusal, saves: 1, bytes: data.byteLength, contentFree: !content, pending: pending ? 1 : 0 });
    }
    return [...rows.values()].map(({ bytes, contentFree, pending, ...row }) => ({
      ...row, bagId: this.bagOf(row.documentId)?.bagId ?? null,
      // A ROW NAMES WHAT A STOP KEEPS (its saves at rest sealed-pending) AND WHETHER ITS DOCUMENT STANDS AT ITS CEILING.
      ...(pending > 0 ? { pending } : {}),
      ...(row.refusal !== "save-unnamed" && this.#heldCount(row.documentId) >= HELD_MAX_SAVES_PER_DOCUMENT ? { atBound: true } : {}),
      // AN UNNAMED ROW NAMES ITS BYTES, WHETHER IT HOLDS ANY CONTENT, AND ITS AGE, so a census can tell heads alone from an owed save.
      ...(row.refusal === "save-unnamed" ? {
        bytes,
        contentFree,
        heldAcross: this.#saves - (this.#unnamedSince.get(row.documentId) ?? this.#saves),
      } : {}),
    }));
  }

  /**
   * A FACE LEFT THE LIT SET (`vault lock --face N`): every save waiting in memory for these documents drops from memory, and
   * none lands clear. Answers how many saves dropped. The documents' sealed rest stays as it rests, and so does each save
   * that rests sealed-pending under the vessel's key: the face's next light reads it back into its wait and seals it.
   */
  forget(documentIds: readonly string[]): number {
    const gone = new Set(documentIds);
    let dropped = 0;
    for (const [name, w] of [...this.#waiting]) if (gone.has(w.key[0]!)) { this.#unwait(name); dropped++; }
    return dropped;
  }

  /** The documents with a save waiting unbooked. */
  waitingDocuments(): string[] { return [...new Set([...this.#waiting.values()].map((w) => w.key[0]!))]; }

  /** Seal every waiting save (of the named documents alone, where named) whose document a session now books; the rest keep
   *  waiting. Answers how many sealed. */
  async reseal(documentIds?: readonly string[]): Promise<number> {
    let sealed = 0;
    const only = documentIds === undefined ? null : new Set(documentIds);
    for (const [name, { key, data }] of [...this.#waiting]) {
      if (only !== null && !only.has(key[0]!)) continue;
      const bag = this.#bagOf(key);
      // A KEY THAT NAMES NO SEALED ROLE (a peer's sync state held unnamed) never rests for a sealed bag: it drops.
      if (bag !== null && ROLES[key[1] ?? ""] === undefined) { this.#unwait(name); continue; }
      // A HELD HOME WHOSE KEY NOW STANDS (the vessel's custody opened): its waiting saves seal under the held key, no session.
      if (bag !== null && isHeld(bag)) {
        const role = ROLES[key[1] ?? ""];
        if (role === undefined) { this.#unwait(name); continue; }
        const out = sealHeld({ bagId: bag.bagId, held: bag.held, role, ref: logicalRefOf(key), plaintext: data });
        if (!("chunk" in out)) continue;
        await this.#ports.inner.save(key, out.chunk.sealed);
        this.#unwait(name);
        sealed++;
        continue;
      }
      const session = this.#ports.sessionOf(key[0]!, data);
      if (bag === null || isKeyed(bag) || session === null || !this.#wears(bag.face, session.subject, bag.bagId)) continue;
      try { await this.#inTurn(bag.bagId, () => this.#seal(bag, key, data, session)); }
      catch (error) { if (error instanceof SealedDocumentRefusal) continue; throw error; }
      this.#unwait(name);
      sealed++;
    }
    // A RELEASE THAT FAULTS NEVER SKIPS THE DEFERRED REMOVALS: they run, then the fault rises.
    let releaseFault: unknown = null;
    if (this.#ports.namesClear !== undefined) { try { await this.#releaseNamed(); } catch (error) { releaseFault = error ?? new Error("release faulted"); } }
    for (const [documentId, keys] of [...this.#deferred]) {
      if (this.waiting(documentId) > 0 || this.bagOf(documentId) === null) continue;
      this.#deferred.delete(documentId);
      for (const key of keys) await this.remove(key);
    }
    if (releaseFault !== null) throw releaseFault;
    return sealed;
  }

  /** Does `subject` name `face`, the bag's own face: its own subject, or the worn face's subject at another anchor? */
  #wears(face: string | null, subject: string, bagId?: string): boolean {
    if (face !== null && (subject === face || (this.#ports.wornAt?.(face, subject) ?? false))) return true;
    // A REALM WORKBENCH'S BAG: any face the realm seats saves into it, under its own session and its own holder.
    return face !== null && bagId !== undefined && (this.#ports.realm?.wears(bagId, subject) ?? false);
  }

  #bagOf(key: StorageKey): SealedBagRow | null {
    return key.length >= 1 && typeof key[0] === "string" ? this.bagOf(key[0]) : null;
  }
  #heldOf(documentId: string): Map<string, SealedAddress> {
    let held = this.#held.get(documentId);
    if (!held) { held = new Map(); this.#held.set(documentId, held); }
    return held;
  }
  /** The face gate, before any byte or name moves. A sealed bag no lit face wears yet opens for no one. */
  #face(bag: { readonly face: string | null; readonly locked?: true }): string {
    // A VESSEL-HELD HOME WHOSE KEY HAS NOT OPENED refuses by its own name: no session opens it, only the vessel's key.
    if (bag.locked === true) throw new SealedDocumentRefusal("holder-locked", "the vessel's held key for this home has not opened");
    const worn = this.#ports.sessionFace();
    const open = this.#ports.openFaces?.() ?? [];
    if ((worn === null && open.length === 0) || bag.face === null) throw new SealedDocumentRefusal("session-absent");
    // THE LIT SET: the bag's own face answers when it stands open, worn or beside the worn one; never another face's.
    if (bag.face !== worn && !open.includes(bag.face)) throw new SealedDocumentRefusal("session-face-foreign");
    return bag.face;
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    try { return await this.#save(key, data); }
    catch (error) {
      if (error instanceof SealedDocumentRefusal && typeof key[0] === "string") {
        try { this.#ports.onRefused?.({ documentId: key[0], refusal: error.refusal, ...(error.why !== undefined ? { cause: error.why } : {}) }); } catch { /* a listener's fault never hides the refusal */ }
      }
      throw error;
    }
  }

  async #save(key: StorageKey, data: Uint8Array): Promise<void> {
    this.#saves++;
    const bag = this.#bagOf(key);
    if (bag === null) {
      // A FALLBACK CARRYING A SEALED DOCUMENT'S MERGE LANDS NO CLEAR BYTE (`waitHandle`): its id names no bag, yet its history
      // holds what rests sealed under the source's id. The save waits in memory (`save-unmapped`), never clear; the content
      // rests sealed under the source's own id.
      const source = typeof key[0] === "string" ? mergedSourceOf(key[0]) : undefined;
      if (source !== undefined && (this.bagOf(source) !== null || this.#classedSealed.has(source))) {
        return this.#hold(key, data, "save-unmapped", null, {}, false);
      }
      if (typeof key[0] === "string" && key.length >= 2 && await this.#keepsSealedClass(key[0])) {
        if (this.#ports.waitOverSealed) {
          this.#swept.delete(key[0]);
          return this.#hold(key, data, "save-unmapped", null);
        }
        throw new SealedDocumentRefusal("bag-unmapped", "this document rests sealed, and no clear byte lands beside it");
      }
      // UNKNOWN MEANS HOLD: a document neither the map nor the roster names (an unsolicited peer push) waits in memory, never clear.
      // A key of one part (the Repo's own `storage-adapter-id`) names no document, and rests as written.
      if (typeof key[0] === "string" && key.length >= 2 && !(await this.#namedClear(key[0]))) {
        const name = nameOf(key);
        if (!this.#waiting.has(name)) {
          const unnamed = [...this.#waiting.values()].filter((w) => w.refusal === "save-unnamed");
          const bytes = unnamed.reduce((n, w) => n + w.data.byteLength, 0);
          if (unnamed.length >= UNNAMED_HELD_MAX_SAVES || bytes + data.byteLength > UNNAMED_HELD_MAX_BYTES) {
            throw new SealedDocumentRefusal("unnamed-bound", `${unnamed.length} save(s), ${bytes} byte(s) already wait unnamed`);
          }
        }
        const first = this.waiting(key[0]) === 0;
        if (first) this.#unnamedSince.set(key[0], this.#saves);
        this.#waiting.set(name, { key: [...key], data: Uint8Array.from(data), refusal: "save-unnamed" });
        if (first) this.#ports.onHeld?.({ refusal: "save-unnamed", documentId: key[0], bagId: null, face: null, rests: "memory", syncState: key[1] === "sync-state" });
        return;
      }
      // THE CLASS READS AGAIN RIGHT BEFORE THE CLEAR WRITE: a map that named the document sealed across the awaits above keeps
      // this save in memory for `reseal`, never clear.
      if (typeof key[0] === "string" && key.length >= 2 && !this.#landsClear(key[0])) {
        return this.#hold(key, data, "save-unmapped", this.#bagOf(key));
      }
      return this.#ports.inner.save(key, data);
    }
    if (!isPublic(bag) && typeof key[0] === "string") this.#classedSealed.add(key[0]);
    const role = ROLES[key[1] ?? ""];
    if (role === undefined) return;
    // THE SECRET HOME RESTS SEALED UNDER ITS VESSEL'S HELD KEY: the sealed value itself rests, before any session stands.
    if (isHeld(bag)) {
      const out = sealHeld({ bagId: bag.bagId, held: bag.held, role, ref: logicalRefOf(key), plaintext: data });
      if (!("chunk" in out)) throw new SealedDocumentRefusal(out.refusal);
      return this.#ports.inner.save(key, out.chunk.sealed);
    }
    // A SEALED BAG NO FACE WEARS YET (the floor, before its face lights): its save waits in memory, never clear, until
    // the face lights and a session books it.
    if (!isPublic(bag) && bag.face === null) return this.#hold(key, data, "save-unmapped", bag);
    // A PUBLIC BAG RESTS SEALED UNDER ITS PUBLISHED KEY: the sealed value itself rests, and no session signs it.
    if (isPublic(bag)) {
      const out = sealPublished({ bagId: bag.bagId, lookup: bag.published, role, ref: logicalRefOf(key), plaintext: data });
      if (!("chunk" in out)) throw new SealedDocumentRefusal(out.refusal);
      return this.#ports.inner.save(key, out.chunk.sealed);
    }
    // R2: the save signs under the session that booked the change, never under whichever session stands now.
    const session = this.#ports.sessionOf(key[0]!, data);
    if (session === null) return this.#hold(key, data, "save-unbooked", bag);
    if (!this.#wears(bag.face, session.subject, bag.bagId)) throw new SealedDocumentRefusal("session-face-foreign");
    // A SEAL THE HOLDER CANNOT ANSWER KEEPS ITS CHANGE: the save waits in memory, readable, rests sealed-pending where the
    // vessel's key stands in reach, and the next reseal seals it.
    try { await this.#inTurn(bag.bagId, () => this.#seal(bag, key, data, session)); }
    catch (error) {
      if (!(error instanceof SealedDocumentRefusal)) throw error;
      return this.#hold(key, data, "save-unsealed", bag, { error: error.refusal, ...(error.why !== undefined ? { cause: error.why } : {}) });
    }
    this.#unwait(nameOf(key));
  }

  /**
   * A CLEAR CHUNK OF A SEALED BAG LEAVES REST AT THE FIRST BOOKED SAVE. A document the engine wrote before its bag
   * mapped sealed (a genesis ahead of its face's lighting) rests Automerge's own bytes; the first seal of that document
   * gathers them with the change it carries into one checkpoint, seals it, and removes each clear chunk.
   */
  async #sweep(bag: { readonly bagId: string }, documentId: string, data: Uint8Array, session: SaveSession): Promise<void> {
    if (this.#swept.has(documentId)) return;
    this.#swept.add(documentId);
    try {
      const clear = (await this.#ports.inner.loadRange([documentId])).filter((c): c is Chunk & { data: Uint8Array } => ROLES[c.key[1] ?? ""] !== undefined && c.data !== undefined && readsClear(c.data));
      if (clear.length === 0) return;
      let whole = A.init<unknown>();
      for (const chunk of [...clear.map((c) => c.data), data]) whole = A.loadIncremental(whole, chunk);
      const snapshot = A.save(whole);
      await this.#seal(bag, [documentId, "snapshot", hex(sha256(snapshot))], snapshot, session);
      for (const chunk of clear) await this.#ports.inner.remove(chunk.key);
    } catch (error) { this.#swept.delete(documentId); throw error; }
  }

  async #seal(bag: { readonly bagId: string }, key: StorageKey, data: Uint8Array, session: SaveSession): Promise<void> {
    await this.#sweep(bag, key[0]!, data, session);
    const role = ROLES[key[1] ?? ""]!;
    const held = this.#heldOf(key[0]!);
    const parents = [...new Set(held.values())].sort();
    const value: DocumentValue = { role, ref: logicalRefOf(key), parents, plaintext: data, ...(role === "checkpoint" ? { frontier: frontierOf(data) } : {}) };
    const writer = this.#ports.writerOf?.(key[0]!) ?? null;
    const peer = writer !== null && writer.startsWith("peer:") ? writer.slice("peer:".length) : undefined;
    const sealed = await this.#ports.seal({ bagId: bag.bagId, values: [value], session, ...(peer !== undefined ? { peer } : {}) });
    if ("refusal" in sealed) throw new SealedDocumentRefusal(sealed.refusal, sealed.cause);
    const address = sealed.values[0]!.address;
    await this.#ports.inner.save(key, utf8Bytes(POINTER + address));
    held.set(nameOf(key), address);
  }

  load(key: StorageKey): Promise<Uint8Array | undefined> { return this.#hydrating(key[0], () => this.#load(key)); }

  async #load(key: StorageKey): Promise<Uint8Array | undefined> {
    const bag = this.#bagOf(key);
    if (bag === null) {
      // AN UNNAMED SAVE READS BACK FROM MEMORY; a sealed-class save that waits unmapped never reads here as if it were clear.
      const waiting = this.#waiting.get(nameOf(key));
      return waiting?.refusal === "save-unnamed" ? Uint8Array.from(waiting.data) : this.#unmapped(await this.#ports.inner.load(key));
    }
    if (isPublic(bag)) return this.#openPublic(bag, key, await this.#ports.inner.load(key));
    if (isHeld(bag)) return this.#openHeld(bag, key, await this.#ports.inner.load(key));
    // A KEY THAT NAMES NO SEALED ROLE (the engine's per-peer sync state) never rests for a sealed bag (`save` drops it), so
    // its load answers nothing at once, with no session asked: a session the face has not stood never holds a peer's sync.
    if (ROLES[key[1] ?? ""] === undefined) return undefined;
    const face = this.#face(bag);
    const waiting = this.#waiting.get(nameOf(key));
    return waiting ? Uint8Array.from(waiting.data) : this.#open(bag, key, face);
  }

  /** Does an unmapped document keep its sealed class: it mapped sealed this process, or its rest holds a sealed value
   *  (read where this store guards the rest: `waitOverSealed`, `refuseClearOverSealed`)? */
  async #keepsSealedClass(documentId: string): Promise<boolean> {
    if (this.#classedSealed.has(documentId)) return true;
    if (!this.#ports.waitOverSealed && !this.#ports.refuseClearOverSealed) return false;
    return this.#restsSealed(documentId);
  }

  #restsSealed(documentId: string): Promise<boolean> {
    let read = this.#sealedAtRest.get(documentId);
    if (read === undefined) {
      read = this.#ports.inner.loadRange([documentId]).then((chunks) => chunks.some((c) => c.data !== undefined && (namesPointer(c.data) || readsSealed(c.data))));
      this.#sealedAtRest.set(documentId, read);
    }
    return read;
  }

  /** A public bag's value opens with its published lookup alone; a clear chunk the engine wrote before it published
   *  reads as written. Any other byte run refuses by name. */
  #openPublic(bag: PublicBag, key: StorageKey, rested: Uint8Array | undefined): Uint8Array | undefined {
    const role = ROLES[key[1] ?? ""];
    if (role === undefined || rested === undefined) return undefined;
    if (readsClear(rested)) return rested;
    if (!readsSealed(rested)) throw new SealedDocumentRefusal("pointer-malformed");
    const opened = openPublished({ bagId: bag.bagId, lookup: bag.published, role, ref: logicalRefOf(key), sealed: rested });
    if (!("plaintext" in opened)) throw new SealedDocumentRefusal(opened.refusal);
    return opened.plaintext;
  }

  /** A held bag's value opens with its vessel's held key alone. No clear byte of it ever rests: one found there refuses by
   *  name and never reaches the engine. */
  #openHeld(bag: HeldBag, key: StorageKey, rested: Uint8Array | undefined): Uint8Array | undefined {
    const role = ROLES[key[1] ?? ""];
    if (role === undefined || rested === undefined) return undefined;
    if (readsClear(rested)) throw new SealedDocumentRefusal("held-clear-at-rest");
    if (!readsSealed(rested)) throw new SealedDocumentRefusal("pointer-malformed");
    const opened = openHeld({ bagId: bag.bagId, held: bag.held, role, ref: logicalRefOf(key), sealed: rested });
    if (!("plaintext" in opened)) throw new SealedDocumentRefusal(opened.refusal);
    return opened.plaintext;
  }

  /** A document the map names no bag for reads its inner rest as the engine wrote it; a sealed value there (a face's
   *  pointer, or a value sealed under the vessel's held key or a published lookup) never reaches the engine as if it
   *  were clear (`bag-unmapped`): the read waits for the map to name its bag. */
  #unmapped<T extends Uint8Array | undefined>(bytes: T): T {
    if (bytes !== undefined && (namesPointer(bytes) || readsSealed(bytes))) throw new SealedDocumentRefusal("bag-unmapped");
    return bytes;
  }

  async #open(bag: { readonly bagId: string }, key: StorageKey, face: string, pointer?: Uint8Array): Promise<Uint8Array | undefined> {
    const role = ROLES[key[1] ?? ""];
    if (role === undefined) return undefined;
    const rested = pointer ?? (await this.#ports.inner.load(key));
    if (rested === undefined) return undefined;
    // A clear chunk the engine wrote before the bag mapped sealed reads for the bag's own face, and the first booked save
    // sweeps it (`#sweep`); any other byte run names no pointer this store wrote.
    if (readPointer(rested) === null) {
      if (readsClear(rested)) return rested;
      // A value the veil floor sealed under the vessel's own key, in a document a face lifted with the same id: it opens with
      // that key while it stands in reach, and `refileHeld` moves its seal to the face. While the custody stays locked the
      // read waits on the holder (`holder-locked`, a hydration wait); a key that does not open it refuses by its own name.
      if (readsSealed(rested) && this.#ports.vesselKey !== undefined) {
        const held = this.#ports.vesselKey();
        if (held === null) throw new SealedDocumentRefusal("holder-locked", "a value sealed under the vessel's own key rests here, and that key is not in reach");
        const lifted = openHeld({ bagId: bag.bagId, held, role, ref: logicalRefOf(key), sealed: rested });
        if ("plaintext" in lifted) return lifted.plaintext;
        // A SAVE AN EARLIER PROCESS LEFT SEALED-PENDING opens under the same key and the pending context of its document AND
        // THIS BAG'S FACE: it reads here and joins this process's wait, so the next session of the face seals it (`#carry`).
        // A value held for another face (its document mapped under a sibling's bag since) opens under no context this face
        // names: it refuses below, never read and never carried, as a pointer another face signed refuses `writer-face-foreign`.
        const pending = openHeld({ bagId: pendingRestBag(key[0]!, face), held, role, ref: logicalRefOf(key), sealed: rested });
        if ("plaintext" in pending) { this.#carry(key, pending.plaintext, { bagId: bag.bagId, face }); return pending.plaintext; }
        throw new SealedDocumentRefusal(lifted.refusal);
      }
      throw new SealedDocumentRefusal("pointer-malformed");
    }
    const opened = await this.#ports.open({ bagId: bag.bagId, role, ref: logicalRefOf(key), face });
    if ("refusal" in opened) throw new SealedDocumentRefusal(opened.refusal, opened.cause);
    // A REALM WORKBENCH'S VALUE opens whoever of its writers signed it: the holder already read that writer's standing under the
    // realm's roster, keyed to the lineage, so a revoked writer's earlier writes still read and its later ones never verified.
    const realmKept = this.#ports.realm?.keeps(bag.bagId) ?? false;
    if (!realmKept && !this.#wears(face, opened.writer)) { opened.plaintext.fill(0); throw new SealedDocumentRefusal("writer-face-foreign"); }
    this.#heldOf(key[0]!).set(nameOf(key), opened.address);
    return opened.plaintext;
  }

  loadRange(prefix: StorageKey): Promise<Chunk[]> { return this.#hydrating(prefix[0], () => this.#loadRange(prefix)); }

  async #loadRange(prefix: StorageKey): Promise<Chunk[]> {
    const whole = this.#bagOf(prefix);
    const face = whole === null || isKeyed(whole) ? null : this.#face(whole);
    const out: Chunk[] = [];
    // A save this walk carries back from its sealed-pending rest answers once, from the walk, never again from the wait.
    const walked = new Set<string>();
    for (const chunk of await this.#ports.inner.loadRange(prefix)) {
      const bag = this.#bagOf(chunk.key);
      if (bag === null) { if (chunk.data !== undefined) this.#unmapped(chunk.data); out.push(chunk); continue; }
      if (isPublic(bag)) { const data = this.#openPublic(bag, chunk.key, chunk.data); if (data !== undefined) out.push({ key: chunk.key, data }); continue; }
      if (isHeld(bag)) { const data = this.#openHeld(bag, chunk.key, chunk.data); if (data !== undefined) out.push({ key: chunk.key, data }); continue; }
      if (this.#waiting.has(nameOf(chunk.key))) continue;
      const data = await this.#open(bag, chunk.key, face ?? this.#face(bag), chunk.data);
      if (data !== undefined) { out.push({ key: chunk.key, data }); walked.add(nameOf(chunk.key)); }
    }
    for (const { key, data, refusal } of this.#waiting.values()) {
      if (key.slice(0, prefix.length).join("\u0000") !== nameOf(prefix) || walked.has(nameOf(key))) continue;
      const bag = this.#bagOf(key);
      // THE RANGE READ KEEPS THE ONE-KEY LAW (`#load`): unmapped, an unnamed save reads back from memory, and a sealed-class save
      // that waits unmapped never rides out as if it were clear.
      if (bag === null && refusal !== "save-unnamed") continue;
      if (bag !== null && !isKeyed(bag)) this.#face(bag);
      out.push({ key: [...key], data: Uint8Array.from(data) });
    }
    return out;
  }

  async remove(key: StorageKey): Promise<void> {
    // A COMPACTION NEVER OUTRUNS ITS SNAPSHOT. The engine removes a document's earlier chunks once its snapshot saved;
    // where that snapshot waits unbooked, the sealed chunks it replaces stay at rest until it seals (`reseal`).
    const documentId = key[0];
    // A DROPPED MAP REMOVES NO SEALED POINTER: an unmapped document that keeps its sealed class defers every removal
    // until the map stands again and its waiting saves seal.
    const unmappedSealed = typeof documentId === "string" && this.#bagOf(key) === null && this.#ports.waitOverSealed === true && await this.#keepsSealedClass(documentId);
    if (unmappedSealed && this.#waiting.has(nameOf(key))) {
      const pending = this.#waiting.get(nameOf(key))?.pending === true;
      this.#unwait(nameOf(key));
      // ITS SEALED-PENDING VALUE LEAVES WITH IT: the compaction that asked this removal already holds the save's content.
      if (pending) await this.#ports.inner.remove(key);
      return;
    }
    if (typeof documentId === "string" && (unmappedSealed || (this.#bagOf(key) !== null && !this.#waiting.has(nameOf(key)) && this.waiting(documentId) > 0))) {
      const deferred = this.#deferred.get(documentId) ?? [];
      deferred.push([...key]);
      this.#deferred.set(documentId, deferred);
      return;
    }
    if (key.length >= 1) this.#held.get(key[0]!)?.delete(nameOf(key));
    this.#unwait(nameOf(key));
    await this.#ports.inner.remove(key);
  }

  async removeRange(prefix: StorageKey): Promise<void> {
    // A whole document's removal while its map stands dropped would take its sealed rest with it: it waits.
    if (prefix.length >= 1 && this.#bagOf(prefix) === null && this.#ports.waitOverSealed === true && await this.#keepsSealedClass(prefix[0]!)) {
      const deferred = this.#deferred.get(prefix[0]!) ?? [];
      for (const chunk of await this.#ports.inner.loadRange(prefix)) deferred.push([...chunk.key]);
      this.#deferred.set(prefix[0]!, deferred);
      return;
    }
    if (prefix.length >= 1) {
      const held = this.#held.get(prefix[0]!);
      for (const name of [...(held?.keys() ?? [])]) if (name.split("\u0000").slice(0, prefix.length).join("\u0000") === nameOf(prefix)) held!.delete(name);
      for (const name of [...this.#waiting.keys()]) if (name.split("\u0000").slice(0, prefix.length).join("\u0000") === nameOf(prefix)) this.#unwait(name);
    }
    await this.#ports.inner.removeRange(prefix);
  }

  close(): void | Promise<void> { return this.#ports.inner.close?.(); }
}

// ── The fresh base ──────────────────────────────────────────────────────────────────────────────
/** Found a new document from the live document's present values: one founding change, no earlier operation. */
export function cutFreshBase(live: Uint8Array): FreshBase | null {
  try {
    const present = A.toJS(A.load(live)) as Record<string, unknown>;
    const fresh = A.from(present);
    const frontier = [...A.getHeads(fresh)].sort();
    return { plaintext: A.save(fresh), ref: hex(sha256(utf8Bytes(["lares-fresh-base", ...frontier].join("\u0000")))), frontier };
  } catch { return null; }
}

/** Does `bytes` open to a fresh base: a whole document holding no change but its own founding one? */
export function readsAsFreshBase(bytes: Uint8Array): boolean {
  try { return A.getAllChanges(A.load(bytes)).length <= 1; } catch { return false; }
}

/** The holder's `freshBase` port over the live document of each bag, as the document store holds it in memory. */
export function freshBasePort(liveOf: (bagId: string) => Uint8Array | null | Promise<Uint8Array | null>):
  (args: { readonly bagId: string; readonly founding: BagLocator; readonly keyVersion: KeyVersionId }) => Promise<FreshBase | null> {
  return async ({ bagId }) => {
    const live = await liveOf(bagId);
    return live === null ? null : cutFreshBase(live);
  };
}
