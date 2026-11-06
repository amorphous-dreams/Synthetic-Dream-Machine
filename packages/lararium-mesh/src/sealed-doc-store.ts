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
 * must wear the face the bag belongs to (`session-face-foreign`, `session-absent`), and an opened value whose
 * manifest another face's session signed refuses (`writer-face-foreign`). A value that does not open reads as its
 * named refusal, never as an absent value.
 *
 * THE FRESH BASE. A from-now admission opens a span on a document of present values alone. `cutFreshBase` founds
 * one from the live document, so its opened document holds its own founding change and no other, and
 * `readsAsFreshBase` refuses a base that holds more. `freshBasePort` hands the holder that cut.
 *
 * Platform-blind: the inner adapter, the bag map, the session's face, the book and the holder's seal and open ride ports.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed (step three) · lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import * as A from "@automerge/automerge";
import type { Chunk, StorageAdapterInterface, StorageKey } from "@automerge/automerge-repo";
import { sha256 } from "@noble/hashes/sha2.js";
import { hex, utf8Bytes } from "./crypto.js";
import type { BagLocator } from "./sealed-records.js";
import { readSealedAddress, type KeyVersionId, type SealedAddress } from "./sealed-chunk.js";
import type { DocumentValue, FreshBase, HolderRefusal, OpenedValue, SealedValues } from "./content-key-holder.js";

export const SEALED_DOCUMENT_REFUSALS = [
  "session-absent",          // no session stands behind the read
  "session-face-foreign",    // the session wears another face than the bag belongs to
  "writer-face-foreign",     // the value opened, and another face's session signed the manifest that authorized it
  "pointer-malformed",       // the inner rest holds no pointer this store wrote
  "bag-unmapped",            // a sealed value rests for a document the bag map names no bag for (yet): no byte moves
  "save-unbooked",           // no session booked the change a save carries: it stays in memory, unsealed and unwritten
] as const;
export type SealedDocumentRefusalName = (typeof SEALED_DOCUMENT_REFUSALS)[number];

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

export interface SealedDocumentPorts {
  /** The engine-facing rest this store wraps: an unsealed bag's values pass straight to it. */
  readonly inner: StorageAdapterInterface;
  /** The bag a document belongs to and that bag's face (`faceProofSubjectRef`); null: the bag rests unsealed. */
  bagOf(documentId: string): { readonly bagId: string; readonly face: string } | null;
  /** The face the session wears (`faceProofSubjectRef`); null where no session stands. */
  sessionFace(): string | null;
  /** The session that booked the latest change of a document (R2); null: no session booked it, and its save waits. */
  sessionOf(documentId: string): SaveSession | null;
  /** The holder's seal of one write batch, signed under the session that booked it. */
  seal(args: { readonly bagId: string; readonly values: readonly DocumentValue[]; readonly session: SaveSession }): Promise<SealedValueAddresses | HolderRefusal>;
  /** Told once per save the store holds back unsealed (`save-unbooked`), naming its document alone. */
  onHeld?(held: { readonly refusal: "save-unbooked"; readonly documentId: string }): void;
  /** The holder's open of one value by its role and logical reference. */
  open(args: { readonly bagId: string; readonly role: DocumentValue["role"]; readonly ref: string }): Promise<OpenedValue | HolderRefusal>;
}

const ROLES: Readonly<Record<string, DocumentValue["role"]>> = { incremental: "change", snapshot: "checkpoint" };
const POINTER = "lares-sealed-value:";
/** The Automerge chunk magic: a value the engine itself wrote, clear, before its bag mapped sealed. */
const AUTOMERGE_MAGIC = [0x85, 0x6f, 0x4a, 0x83] as const;
const readsClear = (bytes: Uint8Array): boolean => AUTOMERGE_MAGIC.every((b, i) => bytes[i] === b);
const nameOf = (key: StorageKey): string => key.join("\u0000");

/** The logical reference a storage key names inside its bag. */
export function logicalRefOf(key: StorageKey): string {
  return hex(sha256(utf8Bytes(["lares-document-value", ...key].join("\u0000"))));
}
const POINTER_BYTES = utf8Bytes(POINTER);
function readPointer(bytes: Uint8Array): SealedAddress | null {
  if (bytes.length < POINTER_BYTES.length || POINTER_BYTES.some((b, i) => bytes[i] !== b)) return null;
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  return text.startsWith(POINTER) ? readSealedAddress(text.slice(POINTER.length)) : null;
}
function frontierOf(saved: Uint8Array): string[] {
  try { return [...A.getHeads(A.load(saved))].sort(); } catch { return []; }
}

export class SealedDocumentStore implements StorageAdapterInterface {
  readonly #ports: SealedDocumentPorts;
  /** The sealed address of each value this store holds, by document and storage key: a change's parents, a checkpoint's cover. */
  readonly #held = new Map<string, Map<string, SealedAddress>>();
  /** The saves no session booked, by storage key, in arrival order: in memory alone, until a session books them. */
  readonly #waiting = new Map<string, { readonly key: StorageKey; readonly data: Uint8Array }>();
  /** The removals a compaction asked while its snapshot waits unbooked, by document. */
  readonly #deferred = new Map<string, StorageKey[]>();
  /** The documents whose rest this store already read for clear chunks, this process. */
  readonly #swept = new Set<string>();
  /** Seals run one at a time, in arrival order, so a change's parents name what rested before it. */
  #tail: Promise<unknown> = Promise.resolve();

  constructor(ports: SealedDocumentPorts) { this.#ports = ports; }

  #inTurn<T>(act: () => Promise<T>): Promise<T> {
    const run = this.#tail.then(act, act);
    this.#tail = run.then(() => undefined, () => undefined);
    return run;
  }

  /** Await every seal in flight: a lock flushes here, after the Repo's own flush, before any signer drops. */
  async flush(): Promise<void> { await this.#inTurn(async () => undefined); }

  /** How many saves wait unbooked, for one document or for all. */
  waiting(documentId?: string): number {
    return documentId === undefined ? this.#waiting.size : [...this.#waiting.values()].filter((w) => w.key[0] === documentId).length;
  }

  /** The documents with a save waiting unbooked. */
  waitingDocuments(): string[] { return [...new Set([...this.#waiting.values()].map((w) => w.key[0]!))]; }

  /** Seal every waiting save whose document a session now books; the rest keep waiting. Answers how many sealed. */
  async reseal(): Promise<number> {
    let sealed = 0;
    for (const [name, { key, data }] of [...this.#waiting]) {
      const bag = this.#bagOf(key);
      const session = this.#ports.sessionOf(key[0]!);
      if (bag === null || session === null || session.subject !== bag.face) continue;
      await this.#inTurn(() => this.#seal(bag, key, data, session));
      this.#waiting.delete(name);
      sealed++;
    }
    for (const [documentId, keys] of [...this.#deferred]) {
      if (this.waiting(documentId) > 0) continue;
      this.#deferred.delete(documentId);
      for (const key of keys) await this.remove(key);
    }
    return sealed;
  }

  #bagOf(key: StorageKey): { readonly bagId: string; readonly face: string } | null {
    return key.length >= 1 && typeof key[0] === "string" ? this.#ports.bagOf(key[0]) : null;
  }
  #heldOf(documentId: string): Map<string, SealedAddress> {
    let held = this.#held.get(documentId);
    if (!held) { held = new Map(); this.#held.set(documentId, held); }
    return held;
  }
  /** The face gate, before any byte or name moves. */
  #face(bag: { readonly face: string }): string {
    const face = this.#ports.sessionFace();
    if (face === null) throw new SealedDocumentRefusal("session-absent");
    if (face !== bag.face) throw new SealedDocumentRefusal("session-face-foreign");
    return face;
  }

  async save(key: StorageKey, data: Uint8Array): Promise<void> {
    const bag = this.#bagOf(key);
    if (bag === null) return this.#ports.inner.save(key, data);
    const role = ROLES[key[1] ?? ""];
    if (role === undefined) return;
    // R2: the save signs under the session that booked the change, never under whichever session stands now.
    const session = this.#ports.sessionOf(key[0]!);
    if (session === null) {
      this.#waiting.set(nameOf(key), { key: [...key], data: Uint8Array.from(data) });
      this.#ports.onHeld?.({ refusal: "save-unbooked", documentId: key[0]! });
      return;
    }
    if (session.subject !== bag.face) throw new SealedDocumentRefusal("session-face-foreign");
    await this.#inTurn(() => this.#seal(bag, key, data, session));
    this.#waiting.delete(nameOf(key));
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
    const sealed = await this.#ports.seal({ bagId: bag.bagId, values: [value], session });
    if ("refusal" in sealed) throw new SealedDocumentRefusal(sealed.refusal, sealed.cause);
    const address = sealed.values[0]!.address;
    await this.#ports.inner.save(key, utf8Bytes(POINTER + address));
    held.set(nameOf(key), address);
  }

  async load(key: StorageKey): Promise<Uint8Array | undefined> {
    const bag = this.#bagOf(key);
    if (bag === null) return this.#unmapped(await this.#ports.inner.load(key));
    const face = this.#face(bag);
    const waiting = this.#waiting.get(nameOf(key));
    return waiting ? Uint8Array.from(waiting.data) : this.#open(bag, key, face);
  }

  /** A document the map names no bag for reads its inner rest as the engine wrote it; a sealed value there never
   *  reaches the engine as if it were clear (`bag-unmapped`). */
  #unmapped<T extends Uint8Array | undefined>(bytes: T): T {
    if (bytes !== undefined && readPointer(bytes) !== null) throw new SealedDocumentRefusal("bag-unmapped");
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
      throw new SealedDocumentRefusal("pointer-malformed");
    }
    const opened = await this.#ports.open({ bagId: bag.bagId, role, ref: logicalRefOf(key) });
    if ("refusal" in opened) throw new SealedDocumentRefusal(opened.refusal, opened.cause);
    if (opened.writer !== face) { opened.plaintext.fill(0); throw new SealedDocumentRefusal("writer-face-foreign"); }
    this.#heldOf(key[0]!).set(nameOf(key), opened.address);
    return opened.plaintext;
  }

  async loadRange(prefix: StorageKey): Promise<Chunk[]> {
    const whole = this.#bagOf(prefix);
    const face = whole === null ? null : this.#face(whole);
    const out: Chunk[] = [];
    for (const chunk of await this.#ports.inner.loadRange(prefix)) {
      const bag = this.#bagOf(chunk.key);
      if (bag === null) { if (chunk.data !== undefined) this.#unmapped(chunk.data); out.push(chunk); continue; }
      if (this.#waiting.has(nameOf(chunk.key))) continue;
      const data = await this.#open(bag, chunk.key, face ?? this.#face(bag), chunk.data);
      if (data !== undefined) out.push({ key: chunk.key, data });
    }
    for (const { key, data } of this.#waiting.values()) {
      if (key.slice(0, prefix.length).join("\u0000") !== nameOf(prefix)) continue;
      const bag = this.#bagOf(key);
      if (bag !== null) this.#face(bag);
      out.push({ key: [...key], data: Uint8Array.from(data) });
    }
    return out;
  }

  async remove(key: StorageKey): Promise<void> {
    // A COMPACTION NEVER OUTRUNS ITS SNAPSHOT. The engine removes a document's earlier chunks once its snapshot saved;
    // where that snapshot waits unbooked, the sealed chunks it replaces stay at rest until it seals (`reseal`).
    const documentId = key[0];
    if (typeof documentId === "string" && this.#bagOf(key) !== null && !this.#waiting.has(nameOf(key)) && this.waiting(documentId) > 0) {
      const deferred = this.#deferred.get(documentId) ?? [];
      deferred.push([...key]);
      this.#deferred.set(documentId, deferred);
      return;
    }
    if (key.length >= 1) this.#held.get(key[0]!)?.delete(nameOf(key));
    this.#waiting.delete(nameOf(key));
    await this.#ports.inner.remove(key);
  }

  async removeRange(prefix: StorageKey): Promise<void> {
    if (prefix.length >= 1) {
      const held = this.#held.get(prefix[0]!);
      for (const name of [...(held?.keys() ?? [])]) if (name.split("\u0000").slice(0, prefix.length).join("\u0000") === nameOf(prefix)) held!.delete(name);
      for (const name of [...this.#waiting.keys()]) if (name.split("\u0000").slice(0, prefix.length).join("\u0000") === nameOf(prefix)) this.#waiting.delete(name);
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
